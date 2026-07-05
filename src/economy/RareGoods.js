import { SYSTEM } from '../world/SystemDef.js';

// One signature commodity per station, bought only at its origin and worth
// more the further it's carried. Held rares live on playerData.rares:
// { id, name, originId, originName, base, paid, qty }

const BY_TYPE = {
  'Agricultural World': ['Whisky', 320],
  'Mining Colony': ['Geode Cores', 300],
  'Refinery World': ['Forge Glass', 310],
  'Hi-Tech World': ['Neural Silk', 380],
  'Tourist Orbital (Gas Giant)': ['Storm Pearls', 400],
  'Frontier Outpost': ['Void Salt', 290],
  'Industrial Core': ['Chrome Orchids', 340],
};

function titleCase(s) {
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export const RareGoods = {
  gscale(pd) { return 1 + ((pd.galaxy ?? 1) - 1) * 0.45; },

  // the local specialty sold at this station
  offerFor(planetDef, pd) {
    const [suffix, base] = BY_TYPE[planetDef.type] || ['Relics', 300];
    return {
      id: planetDef.id + '-rare',
      name: `${titleCase(planetDef.name)} ${suffix}`,
      originId: planetDef.id,
      originName: planetDef.name,
      base,
      price: Math.round(base * this.gscale(pd)),
    };
  },

  // sell value appreciates with distance from origin; origins from a
  // previous galaxy count as maximally exotic
  sellValue(rare, herePlanetDef, pd) {
    const origin = SYSTEM.planets.find((p) => p.id === rare.originId);
    const dist = origin ? origin.position.distanceTo(herePlanetDef.position) : 12000;
    return Math.round(rare.base * (1 + dist / 3500) * this.gscale(pd));
  },

  buy(offer, qty, pd) {
    const cost = offer.price * qty;
    if (pd.credits < cost || pd.cargoSpace() < qty) return false;
    pd.credits -= cost;
    const held = pd.rares.find((r) => r.id === offer.id);
    if (held) {
      held.paid = (held.paid * held.qty + offer.price * qty) / (held.qty + qty);
      held.qty += qty;
    } else {
      pd.rares.push({
        id: offer.id, name: offer.name, originId: offer.originId,
        originName: offer.originName, base: offer.base, paid: offer.price, qty,
      });
    }
    return true;
  },

  // returns { proceeds, profit } or null
  sell(rareId, herePlanetDef, pd) {
    const r = pd.rares.find((x) => x.id === rareId);
    if (!r) return null;
    const unit = this.sellValue(r, herePlanetDef, pd);
    const proceeds = unit * r.qty;
    const profit = Math.round((unit - r.paid) * r.qty);
    pd.credits += proceeds;
    pd.career.creditsEarned += proceeds;
    pd.rares = pd.rares.filter((x) => x.id !== rareId);
    return { proceeds, profit, name: r.name };
  },
};
