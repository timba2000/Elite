import { C } from '../constants.js';
import { COMMODITIES } from '../economy/commodities.js';

// Everything the player owns and has done. Serialized by SaveSystem.
export class PlayerData {
  constructor() {
    this.credits = C.START_CREDITS;
    this.cargo = { ...C.START_CARGO };
    this.costBasis = {}; // goodId -> avg credits paid per unit held
    this.upgrades = { engine: 1, weapons: 1, shield: 1, hull: 1, cargo: 1, dockingComputer: 0, missiles: 0, galacticHyperdrive: 0 };
    this.hull = C.UPGRADES.hull.tiers[1].max;
    this.lastStationId = 'veridia-station';
    this.gameTime = 0;
    this.notoriety = 0;
    this.inSpace = false;
    this.spacePos = null;
    this.spaceRot = null;
    this.spaceVel = null;
    this.spaceThrottle = 0;
    this.spaceMode = 'manual';
    this.spaceTargetId = null;
    this.galaxy = 1;
    this.missions = [];
    this.xp = 0;
    this.level = 1;
    this.skillPoints = 0;
    this.skills = { piloting: 0, gunnery: 0, trade: 0 };
    this.career = { creditsEarned: 0, piratesKilled: 0, contractsCompleted: 0, distanceFlown: 0 };
    this.visitedStations = [];
    this.shipId = 'trader';
    this.modules = [];
    this.rescuedPilots = 0;
    this.rares = []; // rare goods in the hold (count toward cargo space)
  }

  modulesValue() {
    return this.modules.reduce((a, id) => a + (C.MODULES[id]?.price || 0), 0);
  }

  getDerivedStats() {
    const u = this.upgrades;
    const eng = C.UPGRADES.engine.tiers[u.engine];
    const wep = C.UPGRADES.weapons.tiers[u.weapons];
    const shd = C.UPGRADES.shield.tiers[u.shield];
    const hul = C.UPGRADES.hull.tiers[u.hull];
    const crg = C.UPGRADES.cargo.tiers[u.cargo];
    const msl = C.UPGRADES.missiles.tiers[u.missiles ?? 0];
    const sk = this.skills;
    const ship = C.SHIPS[this.shipId] ?? C.SHIPS.trader;
    const has = (id) => this.modules.includes(id);
    return {
      maxSpeed: eng.maxSpeed * ship.speedMult * (sk.piloting >= 1 ? 1.08 : 1),
      boost: eng.boost * ship.speedMult * (has('afterburner') ? 1.15 : 1) * (sk.piloting >= 1 ? 1.08 : 1),
      turnMult: eng.turnMult * ship.turnMult * (sk.piloting >= 4 ? 1.1 : 1),
      laserDamage: wep.damage * ship.damageMult * (sk.gunnery >= 1 ? 1.15 : 1),
      laserEnergy: wep.energy * (sk.gunnery >= 2 ? 0.75 : 1),
      fireInterval: wep.interval,
      twin: wep.twin,
      shieldMax: Math.round(shd.max * ship.shieldMult * (has('shieldCell') ? 1.4 : 1)),
      // every pilot level adds +1% shield recharge (the flat level perk)
      shieldRegen: shd.regen * (1 + 0.01 * (this.level - 1)),
      hullMax: Math.round(hul.max * ship.hullMult),
      cargoMax: Math.round(crg.max * ship.cargoMult) + (has('cargoRacks') ? 8 : 0),
      moduleSlots: ship.slots,
      crewSlots: ship.crew,
      shipName: ship.name,
      scoopMult: has('salvageScoop') ? 2 : 1,
      ecm: has('ecm'),
      chargeTime: sk.piloting >= 2 ? 1.5 : 2.2,
      interdictionMult: sk.piloting >= 3 ? 0.65 : 1,
      boostDrainMult: sk.piloting >= 4 ? 0.6 : 1,
      lockTime: sk.gunnery >= 3 ? 0.8 : 1.5,
      critChance: sk.gunnery >= 4 ? 0.12 : 0,
      buyMult: sk.trade >= 1 ? 0.95 : 1,
      sellMult: sk.trade >= 2 ? 1.05 : 1,
      rewardMult: sk.trade >= 3 ? 1.2 : 1,
      deathTaxMult: sk.trade >= 4 ? 0.5 : 1,
      repairMult: sk.trade >= 4 ? 0.7 : 1,
      dockingComputer: C.UPGRADES.dockingComputer.tiers[u.dockingComputer].fitted,
      missilesMaxAmmo: msl.maxAmmo,
      missilesDamage: msl.damage,
      galacticHyperdrive: C.UPGRADES.galacticHyperdrive.tiers[u.galacticHyperdrive || 0].fitted,
    };
  }

  cargoUsed() {
    return Object.values(this.cargo).reduce((a, b) => a + b, 0)
      + this.rares.reduce((a, r) => a + r.qty, 0);
  }
  cargoSpace() {
    return this.getDerivedStats().cargoMax - this.cargoUsed();
  }
  // unitCost feeds the running average cost basis (what you paid per unit).
  // Scooped/free cargo passes 0, which correctly dilutes the basis.
  addCargo(goodId, qty, unitCost = 0) {
    const held = this.cargo[goodId] || 0;
    const basis = this.costBasis[goodId] || 0;
    this.costBasis[goodId] = (basis * held + unitCost * qty) / (held + qty);
    this.cargo[goodId] = held + qty;
  }
  removeCargo(goodId, qty) {
    this.cargo[goodId] = Math.max(0, (this.cargo[goodId] || 0) - qty);
    if (this.cargo[goodId] === 0) {
      delete this.cargo[goodId];
      delete this.costBasis[goodId];
    }
  }
  // average price paid per unit currently held (0 if none tracked)
  getCostBasis(goodId) {
    return this.costBasis[goodId] || 0;
  }
  // eject one random cargo unit; returns goodId or null
  ejectRandomCargo() {
    const held = Object.keys(this.cargo).filter((k) => this.cargo[k] > 0);
    if (!held.length) return null;
    const good = held[Math.floor(Math.random() * held.length)];
    this.removeCargo(good, 1);
    return good;
  }

  cargoValue() {
    let v = 0;
    for (const [id, qty] of Object.entries(this.cargo)) {
      const g = COMMODITIES.find((c) => c.id === id);
      if (g) v += g.base * qty;
    }
    return v;
  }

  totalUpgradeTiers() {
    const u = this.upgrades;
    return u.engine + u.weapons + u.shield + u.hull + u.cargo;
  }

  // 0..1-ish factor for scaling pirates with player wealth
  netWorthFactor() {
    return Math.min(1, (this.credits + this.cargoValue()) / 20000);
  }

  serialize() {
    return {
      credits: this.credits,
      cargo: this.cargo,
      costBasis: this.costBasis,
      upgrades: this.upgrades,
      hull: this.hull,
      lastStationId: this.lastStationId,
      gameTime: this.gameTime,
      notoriety: this.notoriety,
      inSpace: this.inSpace,
      spacePos: this.spacePos,
      spaceRot: this.spaceRot,
      spaceVel: this.spaceVel,
      spaceThrottle: this.spaceThrottle,
      spaceMode: this.spaceMode,
      spaceTargetId: this.spaceTargetId,
      galaxy: this.galaxy,
      missions: this.missions,
      xp: this.xp,
      level: this.level,
      skillPoints: this.skillPoints,
      skills: this.skills,
      career: this.career,
      visitedStations: this.visitedStations,
      shipId: this.shipId,
      modules: this.modules,
      rescuedPilots: this.rescuedPilots,
      rares: this.rares,
    };
  }

  static deserialize(data) {
    const p = new PlayerData();
    p.credits = data.credits ?? p.credits;
    p.cargo = data.cargo ?? p.cargo;
    p.costBasis = data.costBasis ?? {};
    p.upgrades = { ...p.upgrades, ...data.upgrades };
    p.hull = data.hull ?? p.hull;
    p.lastStationId = data.lastStationId ?? p.lastStationId;
    p.gameTime = data.gameTime ?? 0;
    p.notoriety = data.notoriety ?? 0;
    p.inSpace = data.inSpace ?? false;
    p.spacePos = data.spacePos ?? null;
    p.spaceRot = data.spaceRot ?? null;
    p.spaceVel = data.spaceVel ?? null;
    p.spaceThrottle = data.spaceThrottle ?? 0;
    p.spaceMode = data.spaceMode ?? 'manual';
    p.spaceTargetId = data.spaceTargetId ?? null;
    p.galaxy = data.galaxy ?? 1;
    p.missions = Array.isArray(data.missions) ? data.missions : [];
    p.xp = data.xp ?? 0;
    p.level = data.level ?? 1;
    p.skillPoints = data.skillPoints ?? 0;
    p.skills = { ...p.skills, ...data.skills };
    p.career = { ...p.career, ...data.career };
    p.visitedStations = Array.isArray(data.visitedStations) ? data.visitedStations : [];
    p.shipId = C.SHIPS[data.shipId] ? data.shipId : 'trader';
    p.modules = Array.isArray(data.modules) ? data.modules.filter((id) => C.MODULES[id]) : [];
    p.rescuedPilots = data.rescuedPilots ?? 0;
    p.rares = Array.isArray(data.rares) ? data.rares : [];
    return p;
  }
}
