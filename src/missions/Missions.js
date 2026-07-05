import { C } from '../constants.js';
import { COMMODITIES } from '../economy/commodities.js';
import { SYSTEM } from '../world/SystemDef.js';
import { Progression } from '../player/Progression.js';

// Station contracts: courier deliveries (cargo provided), supply runs
// (source the goods yourself), and pirate hunts. Active missions are plain
// objects on playerData.missions so they serialize with the save.

const MAX_ACTIVE = 4;

function gscale(pd) { return 1 + ((pd.galaxy ?? 1) - 1) * 0.45; }
function makeId() { return 'm' + Math.random().toString(36).slice(2, 9); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const PIRATE_FIRST = ['KRAIT', 'RAZOR', 'VOID', 'SCAR', 'HEX', 'JACKAL', 'IRON', 'GHOST'];
const PIRATE_LAST = ['ZAVORA', 'KAINE', 'MURDOCK', 'VEX', 'THORNE', 'DRAX', 'SALVO', 'MORROW'];

// mission types that carry cargo the player must hold to redeem
const CARGO_TYPES = ['deliver', 'supply', 'smuggle'];

export const Missions = {
  MAX_ACTIVE,

  // Fresh offers each time the player docks (3-4 per visit).
  generateOffers(planetDef, pd, market = null) {
    const s = gscale(pd) * pd.getDerivedStats().rewardMult; // Contract Broker perk
    const legal = COMMODITIES.filter((g) => g.id !== 'narcotics');
    const others = SYSTEM.planets.filter((p) => p.id !== planetDef.id);
    const imports = legal.filter((g) => planetDef.imports.includes(g.id));
    const offers = [];
    const count = 3 + (Math.random() < 0.5 ? 1 : 0);

    // active news event here spawns an urgent relief contract at crisis rates
    const ev = market?.events.find((e) => e.planetId === planetDef.id);
    if (ev) {
      const good = COMMODITIES.find((g) => g.id === ev.good);
      const qty = 6 + Math.floor(Math.random() * 9);
      offers.push({
        id: makeId(), type: 'supply', urgent: true,
        good: good.id, goodName: good.name, qty,
        targetId: planetDef.id, targetName: planetDef.name,
        originName: planetDef.name,
        reward: Math.round(good.base * C.IMPORT_BIAS * ev.mult * 1.25 * qty * s),
        penalty: 0,
        timeLeft: 300 + qty * 6,
        armed: false,
      });
    }

    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      if (roll < 0.4 && others.length) {
        // courier: cargo handed over on accept, drop it at the target station
        const target = pick(others);
        const good = pick(legal);
        const qty = 3 + Math.floor(Math.random() * 8);
        const dist = planetDef.position.distanceTo(target.position);
        offers.push({
          id: makeId(), type: 'deliver',
          good: good.id, goodName: good.name, qty,
          targetId: target.id, targetName: target.name,
          originName: planetDef.name,
          reward: Math.round((good.base * qty * 0.9 + dist * 0.05) * s),
          penalty: Math.round(good.base * qty * 0.8 * s),
          timeLeft: Math.round(90 + dist / 70),
          armed: true,
        });
      } else if (roll < 0.75 && imports.length) {
        // supply: bring goods this station imports, paid over market rate
        const good = pick(imports);
        const qty = 4 + Math.floor(Math.random() * 9);
        offers.push({
          id: makeId(), type: 'supply',
          good: good.id, goodName: good.name, qty,
          targetId: planetDef.id, targetName: planetDef.name,
          originName: planetDef.name,
          reward: Math.round(good.base * C.IMPORT_BIAS * 1.35 * qty * s),
          penalty: 0,
          timeLeft: 240 + qty * 6,
          armed: false, // must leave the station before it can be redeemed
        });
      } else {
        const kills = 2 + Math.floor(Math.random() * 3);
        offers.push({
          id: makeId(), type: 'hunt',
          kills, killsDone: 0,
          originName: planetDef.name,
          reward: Math.round(kills * (450 + Math.random() * 350) * s),
          penalty: 0,
          timeLeft: null,
          armed: true,
        });
      }
    }

    // shady work where narcotics flow — 3x courier pay, Trade 2 required
    const narcoTargets = others.filter((p) => p.imports.includes('narcotics'));
    const narcoHere = planetDef.exports.includes('narcotics') || planetDef.imports.includes('narcotics');
    if (narcoHere && narcoTargets.length && Math.random() < 0.6) {
      const target = pick(narcoTargets);
      const good = COMMODITIES.find((g) => g.id === 'narcotics');
      const qty = 2 + Math.floor(Math.random() * 5);
      const dist = planetDef.position.distanceTo(target.position);
      offers.push({
        id: makeId(), type: 'smuggle',
        good: good.id, goodName: good.name, qty,
        targetId: target.id, targetName: target.name,
        originName: planetDef.name,
        reward: Math.round((good.base * qty * 0.9 + dist * 0.05) * 3 * s),
        penalty: Math.round(good.base * qty * 0.6 * s),
        timeLeft: Math.round(90 + dist / 70),
        armed: true,
        requires: { skill: 'trade', tier: 2 },
      });
    }

    // a wanted poster — one named target, Gunnery 2 required
    if (Math.random() < 0.5) {
      const shipType = Math.random() < 0.35 ? 'dreadnought' : 'marauder';
      offers.push({
        id: makeId(), type: 'hunt',
        named: `${pick(PIRATE_FIRST)} ${pick(PIRATE_LAST)}`, shipType,
        kills: 1, killsDone: 0,
        originName: planetDef.name,
        reward: Math.round((shipType === 'dreadnought' ? 3200 : 1900) * s),
        penalty: 0,
        timeLeft: null,
        armed: true,
        requires: { skill: 'gunnery', tier: 2 },
      });
    }
    return offers;
  },

  lockedReason(offer, pd) {
    if (!offer.requires) return null;
    const { skill, tier } = offer.requires;
    if ((pd.skills[skill] || 0) >= tier) return null;
    return `REQUIRES ${skill.toUpperCase()} ${tier}`;
  },

  accept(offer, pd) {
    if (pd.missions.length >= MAX_ACTIVE) {
      return { ok: false, reason: `CONTRACT LIMIT REACHED (${MAX_ACTIVE})` };
    }
    const locked = this.lockedReason(offer, pd);
    if (locked) return { ok: false, reason: locked };
    if (offer.type === 'deliver' || offer.type === 'smuggle') {
      if (pd.cargoSpace() < offer.qty) {
        return { ok: false, reason: `NEED ${offer.qty} FREE CARGO SPACE` };
      }
      pd.addCargo(offer.good, offer.qty, 0);
      if (offer.type === 'smuggle') {
        pd.notoriety = Math.min(100, (pd.notoriety || 0) + 2);
      }
    }
    pd.missions.push({ ...offer });
    return { ok: true };
  },

  canComplete(m, planetId, pd) {
    return CARGO_TYPES.includes(m.type)
      && m.armed
      && m.targetId === planetId
      && (pd.cargo[m.good] || 0) >= m.qty;
  },

  completeOne(m, pd) {
    pd.removeCargo(m.good, m.qty);
    this.payout(m, pd);
    pd.missions = pd.missions.filter((x) => x.id !== m.id);
  },

  payout(m, pd) {
    pd.credits += m.reward;
    pd.career.creditsEarned += m.reward;
    pd.career.contractsCompleted++;
    m.xp = Progression.XP.contract(m.reward);
    Progression.award(pd, m.xp);
  },

  // Auto-redeem qualifying cargo contracts on dock. Returns completed missions.
  onDock(planetId, pd) {
    const done = pd.missions.filter((m) => this.canComplete(m, planetId, pd));
    for (const m of done) this.completeOne(m, pd);
    return done;
  },

  // Named target destroyed: complete its wanted contract directly.
  onNamedKill(missionId, pd) {
    const m = pd.missions.find((x) => x.id === missionId);
    if (!m) return null;
    this.payout(m, pd);
    pd.missions = pd.missions.filter((x) => x.id !== missionId);
    return m;
  },

  // Called per generic pirate kill; returns finished hunts and progress.
  // Named contracts only complete via onNamedKill.
  onPirateKill(pd) {
    const completed = [];
    const progress = [];
    pd.missions = pd.missions.filter((m) => {
      if (m.type !== 'hunt' || m.named) return true;
      m.killsDone++;
      if (m.killsDone >= m.kills) {
        this.payout(m, pd);
        completed.push(m);
        return false;
      }
      progress.push(m);
      return true;
    });
    return { completed, progress };
  },

  // Advance deadlines with real flight seconds. Returns expired missions.
  tick(dt, pd) {
    const failed = [];
    for (const m of pd.missions) {
      m.armed = true; // once flying, supply contracts become redeemable
      if (m.timeLeft == null) continue;
      m.timeLeft -= dt;
    }
    pd.missions = pd.missions.filter((m) => {
      if (m.timeLeft == null || m.timeLeft > 0) return true;
      if (m.penalty) pd.credits = Math.max(0, pd.credits - m.penalty);
      failed.push(m);
      return false;
    });
    return failed;
  },

  // Provided cargo (courier and smuggling runs) goes down with the ship.
  onDeath(pd) {
    const failed = pd.missions.filter((m) => m.type === 'deliver' || m.type === 'smuggle');
    pd.missions = pd.missions.filter((m) => m.type !== 'deliver' && m.type !== 'smuggle');
    return failed;
  },

  fmtTime(t) {
    if (t == null) return '';
    const s = Math.max(0, Math.ceil(t));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },

  hudLine(m) {
    if (m.type === 'hunt') {
      return m.named ? `HUNT ${m.named}` : `HUNT PIRATES ${m.killsDone}/${m.kills}`;
    }
    const verb = m.type === 'deliver' ? 'DELIVER' : m.type === 'smuggle' ? 'SMUGGLE' : 'SUPPLY';
    return `${verb} ${m.qty} ${m.goodName.toUpperCase()} → ${m.targetName} · ${this.fmtTime(m.timeLeft)}`;
  },
};
