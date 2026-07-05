import { C } from '../constants.js';
import { COMMODITIES } from '../economy/commodities.js';

// Everything the player owns and has done. Serialized by SaveSystem.
export class PlayerData {
  constructor() {
    this.credits = C.START_CREDITS;
    this.cargo = { ...C.START_CARGO };
    this.upgrades = { engine: 1, weapons: 1, shield: 0, hull: 1, cargo: 1, dockingComputer: 0 };
    this.hull = C.UPGRADES.hull.tiers[1].max;
    this.lastStationId = 'veridia-station';
    this.gameTime = 0;
  }

  getDerivedStats() {
    const u = this.upgrades;
    const eng = C.UPGRADES.engine.tiers[u.engine];
    const wep = C.UPGRADES.weapons.tiers[u.weapons];
    const shd = C.UPGRADES.shield.tiers[u.shield];
    const hul = C.UPGRADES.hull.tiers[u.hull];
    const crg = C.UPGRADES.cargo.tiers[u.cargo];
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
    };
  }

  cargoUsed() {
    return Object.values(this.cargo).reduce((a, b) => a + b, 0);
  }
  cargoSpace() {
    return this.getDerivedStats().cargoMax - this.cargoUsed();
  }
  addCargo(goodId, qty) {
    this.cargo[goodId] = (this.cargo[goodId] || 0) + qty;
  }
  removeCargo(goodId, qty) {
    this.cargo[goodId] = Math.max(0, (this.cargo[goodId] || 0) - qty);
    if (this.cargo[goodId] === 0) delete this.cargo[goodId];
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
      upgrades: this.upgrades,
      hull: this.hull,
      lastStationId: this.lastStationId,
      gameTime: this.gameTime,
    };
  }

  static deserialize(data) {
    const p = new PlayerData();
    p.credits = data.credits ?? p.credits;
    p.cargo = data.cargo ?? p.cargo;
    p.upgrades = { ...p.upgrades, ...data.upgrades };
    p.hull = data.hull ?? p.hull;
    p.lastStationId = data.lastStationId ?? p.lastStationId;
    p.gameTime = data.gameTime ?? 0;
    return p;
  }
}
