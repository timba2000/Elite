// XP curve, level-ups, and the three skill tracks. Perk effects are applied
// in PlayerData.getDerivedStats(); this file owns the curve and the copy
// shown in the station Pilot tab.
export const Progression = {
  // XP needed to advance FROM this level (~1.5x per level). Steep on purpose:
  // late-game trade profits are huge, so the curve has to outgrow the income
  // or veterans level faster than rookies.
  xpToNext(level) {
    return Math.round(100 * Math.pow(1.5, level - 1));
  },

  // Skill points thin out as the commander ranks up: one per level early,
  // even levels only from 8, every third level from 16. Maxing all three
  // skill tracks (12 points) now takes ~level 21 instead of 13.
  skillPointsFor(level) {
    if (level < 8) return 1;
    if (level < 16) return level % 2 === 0 ? 1 : 0;
    return level % 3 === 0 ? 1 : 0;
  },

  // Add XP, consuming it into levels. Levels grant skill points per the
  // cadence above plus the flat +1% shield recharge applied in
  // getDerivedStats. Returns levels gained so callers can announce it.
  award(pd, amount) {
    if (amount <= 0) return 0;
    let levels = 0;
    pd.xp += amount;
    while (pd.xp >= this.xpToNext(pd.level)) {
      pd.xp -= this.xpToNext(pd.level);
      pd.level++;
      pd.skillPoints += this.skillPointsFor(pd.level);
      levels++;
    }
    return levels;
  },

  // Combat rank: a ladder separate from level, climbed only by killing
  // pirates. Score is weighted by tier via combatScoreFor.
  COMBAT_RANKS: [
    { name: 'HARMLESS', score: 0 },
    { name: 'MOSTLY HARMLESS', score: 4 },
    { name: 'NOVICE', score: 10 },
    { name: 'COMPETENT', score: 22 },
    { name: 'DANGEROUS', score: 42 },
    { name: 'DEADLY', score: 75 },
    { name: 'ELITE', score: 130 },
  ],
  WARLORD_RANK: 5, // DEADLY unlocks the warlord encounter

  combatScoreFor(type) {
    return type === 'dreadnought' ? 4 : type === 'marauder' ? 2 : 1;
  },

  combatRank(pd) {
    const score = pd.career?.combatScore ?? 0;
    let index = 0;
    for (let i = 0; i < this.COMBAT_RANKS.length; i++) {
      if (score >= this.COMBAT_RANKS[i].score) index = i;
    }
    return { ...this.COMBAT_RANKS[index], index, next: this.COMBAT_RANKS[index + 1] ?? null };
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
