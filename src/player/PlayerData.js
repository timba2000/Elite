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
  }

  getDerivedStats() {
    const u = this.upgrades;
    const eng = C.UPGRADES.engine.tiers[u.engine];
    const wep = C.UPGRADES.weapons.tiers[u.weapons];
    const shd = C.UPGRADES.shield.tiers[u.shield];
    const hul = C.UPGRADES.hull.tiers[u.hull];
    const crg = C.UPGRADES.cargo.tiers[u.cargo];
    const msl = C.UPGRADES.missiles.tiers[u.missiles ?? 0];
    return {
      maxSpeed: eng.maxSpeed,
      boost: eng.boost,
      turnMult: eng.turnMult,
      laserDamage: wep.damage,
      laserEnergy: wep.energy,
      fireInterval: wep.interval,
      twin: wep.twin,
      shieldMax: shd.max,
      shieldRegen: shd.regen,
      hullMax: hul.max,
      cargoMax: crg.max,
      dockingComputer: C.UPGRADES.dockingComputer.tiers[u.dockingComputer].fitted,
      missilesMaxAmmo: msl.maxAmmo,
      missilesDamage: msl.damage,
      galacticHyperdrive: C.UPGRADES.galacticHyperdrive.tiers[u.galacticHyperdrive || 0].fitted,
    };
  }

  cargoUsed() {
    return Object.values(this.cargo).reduce((a, b) => a + b, 0);
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
    return p;
  }
}
