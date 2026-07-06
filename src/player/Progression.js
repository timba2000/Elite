// XP curve, level-ups, and the three skill tracks. Perk effects are applied
// in PlayerData.getDerivedStats(); this file owns the curve and the copy
// shown in the station Pilot tab.
export const Progression = {
  // XP needed to advance FROM this level (~1.35x per level, soft cap by cost)
  xpToNext(level) {
    return Math.round(100 * Math.pow(1.35, level - 1));
  },

  // Add XP, consuming it into levels. Each level grants 1 skill point plus
  // the flat +1% shield recharge applied in getDerivedStats. Returns levels
  // gained so callers can announce it.
  award(pd, amount) {
    if (amount <= 0) return 0;
    let levels = 0;
    pd.xp += amount;
    while (pd.xp >= this.xpToNext(pd.level)) {
      pd.xp -= this.xpToNext(pd.level);
      pd.level++;
      pd.skillPoints++;
      levels++;
    }
    return levels;
  },

  // XP awards by source
  XP: {
    tradeProfit: (profit) => Math.round(profit * 0.5),
    contract: (reward) => Math.round(reward * 0.35),
    kill: (type) => (type === 'dreadnought' ? 120 : type === 'marauder' ? 70 : 40),
    firstVisit: 60,
    scan: 45, // first surface scan of a body
    closeCall: 150, // survive combat with hull under 25%
  },

  SKILLS: {
    piloting: {
      name: 'Piloting',
      tiers: [
        { name: 'Slipstream Tuning', desc: '+8% top speed and boost' },
        { name: 'Quick Charge', desc: 'Hyperdrive charge 2.2s → 1.5s' },
        { name: 'Evasive Profile', desc: 'Pirate interdiction odds −35%' },
        { name: 'Overdrive', desc: 'Boost energy drain −40% · turn rate +10%' },
      ],
    },
    gunnery: {
      name: 'Gunnery',
      tiers: [
        { name: 'Focused Optics', desc: 'Laser damage +15%' },
        { name: 'Heat Management', desc: 'Laser energy cost −25%' },
        { name: 'Fast Lock', desc: 'Missile lock 1.5s → 0.8s' },
        { name: 'Critical Systems', desc: '12% chance of a 2.5× critical hit' },
      ],
    },
    trade: {
      name: 'Trade',
      tiers: [
        { name: 'Haggler', desc: 'Buy prices −5%' },
        { name: 'Negotiator', desc: 'Sell prices +5%' },
        { name: 'Contract Broker', desc: 'Mission board rewards +20%' },
        { name: 'Underwriter', desc: 'Death credit tax halved · repairs −30%' },
      ],
    },
  },
};
