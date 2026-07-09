// The shared galaxy economy. Reuses the game's own Market + SystemDef modules
// so server prices drift with the exact same simulation players see offline.
// One Market instance per visited (galaxy, system), ticked by wall-clock time.
//
// SYSTEM in SystemDef.js is a mutable singleton: generateSystem() must point it
// at the right system before any Market call. Node is single-threaded and we
// never await between generateSystem() and the market operation, so this is safe.
import { generateSystem } from '../src/world/SystemDef.js';
import { Market } from '../src/economy/Market.js';
import { COMMODITIES } from '../src/economy/commodities.js';
import { SYSTEM } from '../src/world/SystemDef.js';

const MAX_CATCHUP_SECONDS = 7 * 24 * 3600; // cap simulation catch-up after downtime

export class SharedMarkets {
  constructor(storage) {
    this.storage = storage;
    this.entries = new Map(); // key -> { market, galaxy, system, lastTick }
  }

  key(galaxy, system) { return `g${galaxy}s${system}`; }

  validCoords(galaxy, system) {
    return Number.isInteger(galaxy) && galaxy >= 1 && galaxy <= 99
      && Number.isInteger(system) && system >= 0 && system <= 3;
  }

  async get(galaxy, system) {
    const key = this.key(galaxy, system);
    let entry = this.entries.get(key);
    if (!entry) {
      generateSystem(galaxy - 1, system);
      const saved = await this.storage.getMarket(key);
      // deserialize() reads the SYSTEM singleton — regenerate after the await
      generateSystem(galaxy - 1, system);
      const market = saved?.state ? Market.deserialize(saved.state) : new Market();
      entry = { market, galaxy, system, lastTick: saved?.lastTick ?? Date.now() };
      this.entries.set(key, entry);
    }
    this.tick(entry);
    await this.persist(key, entry);
    return entry;
  }

  tick(entry) {
    const now = Date.now();
    const dt = Math.min((now - entry.lastTick) / 1000, MAX_CATCHUP_SECONDS);
    entry.lastTick = now;
    if (dt <= 0) return;
    generateSystem(entry.galaxy - 1, entry.system);
    entry.market.update(dt);
    entry.market.consumeNews(); // server has no toast UI; drop the queue
  }

  async persist(key, entry) {
    await this.storage.putMarket(key, {
      state: entry.market.serialize(),
      lastTick: entry.lastTick,
    });
  }

  // Apply a player's trade to the shared price state.
  async trade(galaxy, system, planetId, goodId, qty, isBuy) {
    const entry = await this.get(galaxy, system);
    generateSystem(galaxy - 1, system);
    if (!SYSTEM.planets.some((p) => p.id === planetId)) return { error: 'Unknown planet' };
    if (!COMMODITIES.some((g) => g.id === goodId)) return { error: 'Unknown commodity' };
    const n = Math.max(1, Math.min(1000, Math.floor(qty)));
    entry.market.recordTrade(planetId, goodId, n, !!isBuy);
    await this.persist(this.key(galaxy, system), entry);
    return { ok: true };
  }
}
