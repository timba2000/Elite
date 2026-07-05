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

export const Missions = {
  MAX_ACTIVE,

  // Fresh offers each time the player docks (3-4 per visit).
  generateOffers(planetDef, pd) {
    const s = gscale(pd) * pd.getDerivedStats().rewardMult; // Contract Broker perk
    const legal = COMMODITIES.filter((g) => g.id !== 'narcotics');
    const others = SYSTEM.planets.filter((p) => p.id !== planetDef.id);
    const imports = legal.filter((g) => planetDef.imports.includes(g.id));
    const offers = [];
    const count = 3 + (Math.random() < 0.5 ? 1 : 0);

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
    return offers;
  },

  accept(offer, pd) {
    if (pd.missions.length >= MAX_ACTIVE) {
      return { ok: false, reason: `CONTRACT LIMIT REACHED (${MAX_ACTIVE})` };
    }
    if (offer.type === 'deliver') {
      if (pd.cargoSpace() < offer.qty) {
        return { ok: false, reason: `NEED ${offer.qty} FREE CARGO SPACE` };
      }
      pd.addCargo(offer.good, offer.qty, 0);
    }
    pd.missions.push({ ...offer });
    return { ok: true };
  },

  canComplete(m, planetId, pd) {
    return (m.type === 'deliver' || m.type === 'supply')
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

  // Called per pirate kill; returns finished hunts and in-progress updates.
  onPirateKill(pd) {
    const completed = [];
    const progress = [];
    pd.missions = pd.missions.filter((m) => {
      if (m.type !== 'hunt') return true;
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

  // Provided courier cargo goes down with the ship.
  onDeath(pd) {
    const failed = pd.missions.filter((m) => m.type === 'deliver');
    pd.missions = pd.missions.filter((m) => m.type !== 'deliver');
    return failed;
  },

  fmtTime(t) {
    if (t == null) return '';
    const s = Math.max(0, Math.ceil(t));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },

  hudLine(m) {
    if (m.type === 'hunt') return `HUNT PIRATES ${m.killsDone}/${m.kills}`;
    const verb = m.type === 'deliver' ? 'DELIVER' : 'SUPPLY';
    return `${verb} ${m.qty} ${m.goodName.toUpperCase()} → ${m.targetName} · ${this.fmtTime(m.timeLeft)}`;
  },
};
