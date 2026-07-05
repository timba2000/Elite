import { C } from '../constants.js';
import { COMMODITIES } from './commodities.js';
import { SYSTEM } from '../world/SystemDef.js';

// Galactic news events: temporary price spikes at one planet for one good.
const EVENT_TYPES = [
  { good: 'food', mult: 2.6, headline: 'FAMINE ON %P — FOOD PRICES SURGING' },
  { good: 'water', mult: 2.4, headline: 'RESERVOIR FAILURE ON %P — WATER CRITICAL' },
  { good: 'medicine', mult: 3.0, headline: 'PLAGUE OUTBREAK ON %P — MEDICINE DESPERATELY NEEDED' },
  { good: 'ore', mult: 2.2, headline: 'MINING STRIKE ON %P — ORE SUPPLY CHOKED' },
  { good: 'fuel', mult: 2.0, headline: 'REFINERY FIRE ON %P — FUEL RESERVES BURNING' },
  { good: 'luxuries', mult: 1.9, headline: 'GRAND FESTIVAL ON %P — LUXURIES IN DEMAND' },
];

// Per-planet prices: base * typeBias * drift * event.
// drift is a mean-reverting random walk per (planet, good), advanced by game time.
export class Market {
  constructor() {
    this.drift = {};
    this.history = {};
    for (const p of SYSTEM.planets) {
      this.drift[p.id] = {};
      this.history[p.id] = {};
      for (const g of COMMODITIES) {
        this.drift[p.id][g.id] = 0.85 + Math.random() * 0.3;
        this.history[p.id][g.id] = [];
      }
    }
    this.initializeHistory();
    this.minuteAccum = 0;
    this.events = [];   // { planetId, planetName, good, mult, headline, timeLeft }
    this.news = [];     // headlines not yet shown to the player
  }

  initializeHistory() {
    for (const p of SYSTEM.planets) {
      if (!this.history[p.id]) this.history[p.id] = {};
      for (const g of COMMODITIES) {
        if (!this.history[p.id][g.id] || this.history[p.id][g.id].length === 0) {
          this.history[p.id][g.id] = this.simulateHistoricalPrices(p.id, g.id, 15);
        }
      }
    }
  }

  simulateHistoricalPrices(planetId, goodId, steps) {
    const planet = SYSTEM.planets.find((p) => p.id === planetId);
    const good = COMMODITIES.find((g) => g.id === goodId);
    const prices = [];
    let d = this.drift[planetId]?.[goodId] ?? (0.85 + Math.random() * 0.3);
    
    for (let i = 0; i < steps; i++) {
      const raw = good.base * this.typeBias(planet, goodId) * d;
      const galaxy = (typeof window !== 'undefined' && window.game?.playerData?.galaxy) || 1;
      const priceScale = 1.0 + (galaxy - 1) * 0.45;
      const buyPrice = Math.max(1, Math.round(raw * priceScale));
      prices.unshift(buyPrice);

      // Simulate step backwards
      d = d + (d - 1) * C.DRIFT_REVERT - gaussian() * good.volatility;
      d = clamp(d, C.DRIFT_MIN, C.DRIFT_MAX);
    }
    return prices;
  }

  recordHistory() {
    for (const p of SYSTEM.planets) {
      if (!this.history[p.id]) this.history[p.id] = {};
      for (const g of COMMODITIES) {
        if (!this.history[p.id][g.id]) this.history[p.id][g.id] = [];
        const currentBuyPrice = this.price(p.id, g.id).buy;
        this.history[p.id][g.id].push(currentBuyPrice);
        if (this.history[p.id][g.id].length > 15) {
          this.history[p.id][g.id].shift();
        }
      }
    }
  }

  eventFor(planetId, goodId) {
    return this.events.find((e) => e.planetId === planetId && e.good === goodId) || null;
  }

  // headlines queued since last call (flight state toasts these)
  consumeNews() {
    const n = this.news;
    this.news = [];
    return n;
  }

  spawnEvent() {
    const t = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const candidates = SYSTEM.planets.filter((p) => !this.eventFor(p.id, t.good));
    if (!candidates.length) return;
    const p = candidates[Math.floor(Math.random() * candidates.length)];
    const headline = t.headline.replace('%P', p.name);
    this.events.push({
      planetId: p.id, planetName: p.name, good: t.good, mult: t.mult,
      headline, timeLeft: 420 + Math.random() * 300, // game-seconds
    });
    this.news.push(headline);
  }

  typeBias(planetDef, goodId) {
    if (planetDef.exports.includes(goodId)) return C.EXPORT_BIAS;
    if (planetDef.imports.includes(goodId)) return C.IMPORT_BIAS;
    return 1.0;
  }

  // advance economy time (seconds of game time)
  update(gameSeconds) {
    for (const e of this.events) e.timeLeft -= gameSeconds;
    const ended = this.events.filter((e) => e.timeLeft <= 0);
    for (const e of ended) this.news.push(`MARKETS STEADY — ${e.headline.split(' — ')[0]} HAS ENDED`);
    if (ended.length) this.events = this.events.filter((e) => e.timeLeft > 0);

    this.minuteAccum += gameSeconds;
    let didTick = false;
    while (this.minuteAccum >= 60) {
      this.minuteAccum -= 60;
      didTick = true;
      if (this.events.length < 2 && Math.random() < 0.2) this.spawnEvent();
      for (const p of SYSTEM.planets) {
        if (!this.drift[p.id]) this.drift[p.id] = {};
        for (const g of COMMODITIES) {
          if (typeof this.drift[p.id][g.id] !== 'number') {
            this.drift[p.id][g.id] = 0.85 + Math.random() * 0.3;
          }
          let d = this.drift[p.id][g.id];
          d += (1 - d) * C.DRIFT_REVERT + gaussian() * g.volatility;
          this.drift[p.id][g.id] = clamp(d, C.DRIFT_MIN, C.DRIFT_MAX);
        }
      }
    }
    if (didTick) {
      this.recordHistory();
    }
  }

  price(planetId, goodId) {
    const planet = SYSTEM.planets.find((p) => p.id === planetId);
    if (!planet) return { buy: 1, sell: 1 };
    
    if (!this.drift[planetId]) this.drift[planetId] = {};
    if (typeof this.drift[planetId][goodId] !== 'number') {
      this.drift[planetId][goodId] = 0.85 + Math.random() * 0.3;
    }

    const good = COMMODITIES.find((g) => g.id === goodId);
    let raw = good.base * this.typeBias(planet, goodId) * this.drift[planetId][goodId];
    const ev = this.eventFor(planetId, goodId);
    if (ev) raw *= ev.mult;
    
    // Scale prices up per galaxy for bigger absolute profits!
    const galaxy = (typeof window !== 'undefined' && window.game?.playerData?.galaxy) || 1;
    const priceScale = 1.0 + (galaxy - 1) * 0.45;

    const buy = Math.max(1, Math.round(raw * priceScale));
    const sell = Math.max(1, Math.round(raw * 0.93 * priceScale));
    return { buy, sell };
  }

  // player trades nudge local price (buying raises, selling lowers)
  recordTrade(planetId, goodId, qty, isBuy) {
    if (!this.drift[planetId]) this.drift[planetId] = {};
    if (typeof this.drift[planetId][goodId] !== 'number') {
      this.drift[planetId][goodId] = 0.85 + Math.random() * 0.3;
    }
    const delta = C.TRADE_PRICE_IMPACT * qty * (isBuy ? 1 : -1);
    this.drift[planetId][goodId] = clamp(
      this.drift[planetId][goodId] + delta, C.DRIFT_MIN, C.DRIFT_MAX
    );
    // Update latest point in history to match the new price immediately
    if (this.history[planetId] && this.history[planetId][goodId] && this.history[planetId][goodId].length > 0) {
      const idx = this.history[planetId][goodId].length - 1;
      this.history[planetId][goodId][idx] = this.price(planetId, goodId).buy;
    }
  }

  galacticAverage(goodId) {
    return COMMODITIES.find((g) => g.id === goodId).base;
  }

  serialize() {
    return { drift: this.drift, events: this.events, history: this.history };
  }

  static deserialize(data) {
    const m = new Market();
    // Legacy saves stored the drift map directly; new saves wrap it as
    // {drift, events}. Detect by the events array — a planet id can shadow
    // the "drift" key (Keller's Drift is literally id "drift").
    const isNew = data && Array.isArray(data.events);
    const drift = isNew ? data.drift : data;
    const history = isNew ? data.history : null;
    if (drift) {
      for (const p of SYSTEM.planets) {
        if (!m.drift[p.id]) m.drift[p.id] = {};
        for (const g of COMMODITIES) {
          if (drift[p.id] && typeof drift[p.id][g.id] === 'number') {
            m.drift[p.id][g.id] = drift[p.id][g.id];
          } else {
            m.drift[p.id][g.id] = 0.85 + Math.random() * 0.3;
          }
        }
      }
    }
    m.history = {};
    for (const p of SYSTEM.planets) {
      m.history[p.id] = {};
      for (const g of COMMODITIES) {
        if (history && history[p.id] && Array.isArray(history[p.id][g.id])) {
          m.history[p.id][g.id] = [...history[p.id][g.id]];
        } else {
          m.history[p.id][g.id] = [];
        }
      }
    }
    m.initializeHistory();
    if (data && Array.isArray(data.events)) {
      m.events = data.events.filter((e) => SYSTEM.planets.some((p) => p.id === e.planetId));
    }
    return m;
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function gaussian() {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
