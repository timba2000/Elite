// Hireable crew: one NPC per role, seats limited by hull. Effects apply in
// PlayerData.getDerivedStats() and FlightState (engineer repair, navigator
// supercruise). Wages are charged per game-hour whenever the player docks.

const FIRST = ['JAX', 'MIRA', 'KOVA', 'DEX', 'SABLE', 'ORIN', 'TESSA', 'BRICK', 'LYRA', 'FINN'];
const LAST = ['HOLLOWAY', 'VANCE', 'OKAFOR', 'REYES', 'STONE', 'IBARRA', 'KLINE', 'MOSS'];

export const ROLES = {
  gunner: {
    name: 'Gunner',
    desc: (t) => `+${t >= 2 ? 15 : 10}% laser damage`,
  },
  navigator: {
    name: 'Navigator',
    desc: (t) => `+${t >= 2 ? 50 : 30}% supercruise acceleration · −${t >= 2 ? 30 : 20}% interdiction odds`,
  },
  quartermaster: {
    name: 'Quartermaster',
    desc: (t) => `+${t >= 2 ? 10 : 6} cargo capacity · +${t >= 2 ? 100 : 50}% scoop radius`,
  },
  engineer: {
    name: 'Engineer',
    desc: (t) => `Repairs hull in flight (${t >= 2 ? 0.7 : 0.4}/s) · −${t >= 2 ? 40 : 25}% boost drain`,
  },
  negotiator: {
    name: 'Negotiator',
    desc: (t) => `Buy −${t >= 2 ? 5 : 3}% · sell +${t >= 2 ? 5 : 3}%`,
  },
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export const Crew = {
  ROLES,

  // 2-3 candidates at the station bar; a pilot you rescued may show up
  // asking half price out of gratitude.
  generateCandidates(pd) {
    const out = [];
    const roleIds = Object.keys(ROLES);
    const count = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const role = pick(roleIds);
      const tier = Math.random() < 0.3 ? 2 : 1;
      out.push({
        name: `${pick(FIRST)} ${pick(LAST)}`,
        role, tier,
        fee: tier === 2 ? 2200 : 900,
        wage: tier === 2 ? 110 : 60, // credits per game-hour
        rescued: false,
      });
    }
    if ((pd.rescuedPilots || 0) > 0) {
      const role = pick(roleIds);
      const tier = Math.random() < 0.5 ? 2 : 1;
      out.push({
        name: `${pick(FIRST)} ${pick(LAST)}`,
        role, tier,
        fee: Math.round((tier === 2 ? 2200 : 900) / 2),
        wage: tier === 2 ? 110 : 60,
        rescued: true, // the pilot you scooped out of the void
      });
    }
    return out;
  },

  hire(cand, pd) {
    const stats = pd.getDerivedStats();
    if (pd.crew.length >= stats.crewSlots) {
      return { ok: false, reason: stats.crewSlots === 0 ? 'THIS HULL HAS NO CREW SEATS' : 'ALL CREW SEATS FILLED' };
    }
    if (pd.crew.some((c) => c.role === cand.role)) {
      return { ok: false, reason: `ALREADY EMPLOY A ${ROLES[cand.role].name.toUpperCase()}` };
    }
    if (pd.credits < cand.fee) return { ok: false, reason: 'INSUFFICIENT CREDITS' };
    pd.credits -= cand.fee;
    if (cand.rescued) pd.rescuedPilots = Math.max(0, pd.rescuedPilots - 1);
    pd.crew.push({ name: cand.name, role: cand.role, tier: cand.tier, wage: cand.wage });
    return { ok: true };
  },

  fire(name, pd) {
    pd.crew = pd.crew.filter((c) => c.name !== name);
  },

  // Charge accumulated wages on dock. If the player can't pay, the whole
  // crew walks. Hours are capped so a long haul can't bankrupt outright.
  chargeWages(pd) {
    if (!pd.crew.length) {
      pd.lastWagePaidAt = pd.gameTime;
      return { charged: 0, quit: [] };
    }
    const hours = Math.min(12, Math.max(0, (pd.gameTime - (pd.lastWagePaidAt || 0)) / 3600));
    pd.lastWagePaidAt = pd.gameTime;
    const total = Math.round(pd.crew.reduce((a, c) => a + c.wage, 0) * hours);
    if (total <= 0) return { charged: 0, quit: [] };
    if (pd.credits >= total) {
      pd.credits -= total;
      return { charged: total, quit: [] };
    }
    const quit = pd.crew.map((c) => c.name);
    pd.crew = [];
    return { charged: 0, quit };
  },
};
