import * as THREE from 'three';
import { C } from '../constants.js';
import { buildTrader } from './ShipFactory.js';

const _fwd = new THREE.Vector3();
const _target = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();

// The player's beat-up trader: flight model, energy, shields, guns.
export class PlayerShip {
  constructor(scene, playerData) {
    this.scene = scene;
    this.playerData = playerData;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.velocity = new THREE.Vector3();
    this.throttle = 0;
    this.energy = C.ENERGY_MAX;
    this.shield = 0;
    this.shieldTimer = 0;
    this.fireTimer = 0;
    this.boosting = false;
    this.alive = true;

    this.ship = null;
    this.rebuildMesh();
    this.applyStats();
    this.shield = this.stats.shieldMax;
    this.missilesAmmo = this.stats.missilesMaxAmmo;
  }

  rebuildMesh() {
    if (this.ship) this.group.remove(this.ship.group);
    const u = this.playerData.upgrades;
    // ship visually sheds its rust as hull plating is upgraded
    const wear = Math.max(0.15, 1 - (u.hull - 1) * 0.45);
    this.ship = buildTrader({ wear, cargoTier: u.cargo, engineTier: u.engine });
    this.group.add(this.ship.group);
  }

  applyStats() {
    this.stats = this.playerData.getDerivedStats();
    this.shield = Math.min(this.shield, this.stats.shieldMax);
    this.missilesAmmo = Math.min(this.missilesAmmo ?? this.stats.missilesMaxAmmo, this.stats.missilesMaxAmmo);
  }

  get position() { return this.group.position; }
  get quaternion() { return this.group.quaternion; }
  get forward() { return _fwd.set(0, 0, 1).applyQuaternion(this.group.quaternion).clone(); }
  get boundingRadius() { return this.ship.boundingRadius; }

  updateManual(dt, input) {
    // throttle
    if (input.throttleUp) this.throttle = Math.min(1, this.throttle + 0.7 * dt);
    if (input.throttleDown) this.throttle = Math.max(0, this.throttle - 0.9 * dt);

    // rotation (screen-right is -X when looking along ship forward +Z,
    // so mouse-right must yaw toward -X and Q must roll the horizon right)
    const turn = C.TURN_RATE * this.stats.turnMult;
    this.group.rotateX(-input.pitch * turn * dt);
    this.group.rotateY(input.yaw * turn * dt);
    this.group.rotateZ(-input.roll * C.ROLL_RATE * dt);

    // boost
    this.boosting = input.boost && this.energy > 1 && this.throttle > 0.1;
    if (this.boosting) this.energy -= C.BOOST_DRAIN * dt;

    // velocity: ease toward target vector (arcade drift)
    const speed = this.boosting ? this.stats.boost : this.throttle * this.stats.maxSpeed;
    _fwd.set(0, 0, 1).applyQuaternion(this.group.quaternion);
    _target.copy(_fwd).multiplyScalar(speed);
    const a = 1 - Math.exp(-C.VELOCITY_EASE * dt);
    this.velocity.lerp(_target, a);
    this.group.position.addScaledVector(this.velocity, dt);

    this.updateSystems(dt);
  }

  updateSystems(dt) {
    // energy regen
    this.energy = Math.min(C.ENERGY_MAX, this.energy + C.ENERGY_REGEN * dt);
    // shield regen ONLY IF energy bar is full
    if (this.stats.shieldMax > 0 && this.energy >= C.ENERGY_MAX) {
      this.shield = Math.min(this.stats.shieldMax, this.shield + this.stats.shieldRegen * dt);
    }
    this.fireTimer -= dt;
  }

  tryFire(laserPool) {
    if (this.fireTimer > 0) return false;
    const w = this.stats;
    if (this.energy < w.laserEnergy) return false;
    this.fireTimer = w.fireInterval;
    this.energy -= w.laserEnergy;

    _dir.set(0, 0, 1).applyQuaternion(this.group.quaternion);
    const hps = w.twin ? this.ship.hardpoints : [this.ship.hardpoints[0], this.ship.hardpoints[1]];
    // single-fire alternates barrels; twin fires both
    if (w.twin) {
      for (const hp of hps) {
        hp.getWorldPosition(_origin);
        laserPool.fire(_origin, _dir, 'player', w.laserDamage, this.velocity);
      }
    } else {
      this._barrel = (this._barrel || 0) ^ 1;
      this.ship.hardpoints[this._barrel].getWorldPosition(_origin);
      laserPool.fire(_origin, _dir, 'player', w.laserDamage, this.velocity);
    }
    return true;
  }

  // returns { destroyed, hullHit }
  takeDamage(dmg) {
    this.shieldTimer = 0;
    let hullHit = false;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) {
      this.playerData.hull -= dmg;
      hullHit = true;
    }
    const destroyed = this.playerData.hull <= 0;
    if (destroyed) this.alive = false;
    return { destroyed, hullHit };
  }
}
