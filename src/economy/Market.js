import { C } from '../constants.js';
import { COMMODITIES } from './commodities.js';
import { SYSTEM } from '../world/SystemDef.js';

// Per-planet prices: base * typeBias * drift.
// drift is a mean-reverting random walk per (planet, good), advanced by game time.
export class Market {
  constructor() {
    this.drift = {};
    for (const p of SYSTEM.planets) {
      this.drift[p.id] = {};
      for (const g of COMMODITIES) {
        this.drift[p.id][g.id] = 0.85 + Math.random() * 0.3;
      }
    }
    this.minuteAccum = 0;
  }

  typeBias(planetDef, goodId) {
    if (planetDef.exports.includes(goodId)) return C.EXPORT_BIAS;
    if (planetDef.imports.includes(goodId)) return C.IMPORT_BIAS;
    return 1.0;
  }

  // advance economy time (seconds of game time)
  update(gameSeconds) {
    this.minuteAccum += gameSeconds;
    while (this.minuteAccum >= 60) {
      this.minuteAccum -= 60;
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
  }

  price(planetId, goodId) {
    const planet = SYSTEM.planets.find((p) => p.id === planetId);
    if (!planet) return { buy: 1, sell: 1 };
    
    if (!this.drift[planetId]) this.drift[planetId] = {};
    if (typeof this.drift[planetId][goodId] !== 'number') {
      this.drift[planetId][goodId] = 0.85 + Math.random() * 0.3;
    }

    const good = COMMODITIES.find((g) => g.id === goodId);
    const raw = good.base * this.typeBias(planet, goodId) * this.drift[planetId][goodId];
    
    // Scale prices up per galaxy for bigger absolute profits!
    const galaxy = window.game?.playerData?.galaxy ?? 1;
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
  }

  galacticAverage(goodId) {
    return COMMODITIES.find((g) => g.id === goodId).base;
  }

  serialize() {
    return this.drift;
  }

  static deserialize(data) {
    const m = new Market();
    if (data) {
      for (const p of SYSTEM.planets) {
        if (!m.drift[p.id]) m.drift[p.id] = {};
        for (const g of COMMODITIES) {
          if (data[p.id] && typeof data[p.id][g.id] === 'number') {
            m.drift[p.id][g.id] = data[p.id][g.id];
          } else {
            m.drift[p.id][g.id] = 0.85 + Math.random() * 0.3;
          }
        }
      }
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
