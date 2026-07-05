import * as THREE from 'three';
import { C } from '../constants.js';
import { buildPirate } from './ShipFactory.js';

const _toPlayer = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _origin = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

let pirateCounter = 0;

// Raider with a 4-state AI: PURSUE -> ATTACK -> BREAK -> (FLEE below 25% hull)
export class Pirate {
  constructor(scene, position, scale = 1) {
    this.scene = scene;
    this.ship = buildPirate(++pirateCounter);
    this.group = this.ship.group;
    this.group.position.copy(position);
    scene.add(this.group);

    this.hullMax = C.PIRATE.HULL * scale;
    this.hull = this.hullMax;
    this.shield = C.PIRATE.SHIELD * scale;
    this.shieldTimer = 0;
    this.damage = C.PIRATE.DAMAGE * scale;
    this.speed = C.PIRATE.SPEED * (0.9 + Math.random() * 0.25);
    this.turn = C.PIRATE.TURN * (0.9 + Math.random() * 0.2);

    this.state = 'PURSUE';
    this.stateTimer = 0;
    this.fireTimer = Math.random();
    this.breakTarget = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.alive = true;
    this.throttle = 1;
  }

  get position() { return this.group.position; }
  get boundingRadius() { return this.ship.boundingRadius; }

  update(dt, player, laserPool) {
    if (!this.alive) return;
    this.stateTimer -= dt;
    this.fireTimer -= dt;
    this.shieldTimer += dt;
    if (this.shieldTimer > C.SHIELD_REGEN_DELAY) {
      this.shield = Math.min(C.PIRATE.SHIELD, this.shield + 4 * dt);
    }

    _toPlayer.copy(player.position).sub(this.group.position);
    const dist = _toPlayer.length();

    // state transitions
    if (this.hull / this.hullMax < C.PIRATE.FLEE_HULL) {
      this.state = 'FLEE';
    } else if (this.state === 'PURSUE' && dist < C.PIRATE.ATTACK_DIST) {
      this.state = 'ATTACK';
    } else if (this.state === 'ATTACK' && dist < C.PIRATE.BREAK_DIST) {
      this.state = 'BREAK';
      this.stateTimer = 3 + Math.random();
      // pick a lateral fly-past point
      const lateral = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize().multiplyScalar(220);
      this.breakTarget.copy(player.position).add(lateral);
    } else if (this.state === 'BREAK' && this.stateTimer <= 0) {
      this.state = 'PURSUE';
    }

    // steering target
    if (this.state === 'FLEE') {
      _desired.copy(this.group.position).sub(player.position).normalize()
        .multiplyScalar(1000).add(this.group.position);
      this.throttle = 1;
    } else if (this.state === 'BREAK') {
      _desired.copy(this.breakTarget);
      this.throttle = 1;
    } else {
      // lead the player slightly
      _desired.copy(player.position).addScaledVector(player.velocity, dist / C.LASER_SPEED);
      this.throttle = this.state === 'ATTACK' && dist < 120 ? 0.55 : 1;
    }

    // turn toward desired with capped rate
    _m.lookAt(_desired, this.group.position, _up);
    _q.setFromRotationMatrix(_m);
    const maxStep = this.turn * dt;
    this.group.quaternion.rotateTowards(_q, maxStep);

    _fwd.set(0, 0, 1).applyQuaternion(this.group.quaternion);
    this.velocity.copy(_fwd).multiplyScalar(this.speed * this.throttle);
    this.group.position.addScaledVector(this.velocity, dt);

    // fire when in range and roughly on target
    if (this.state === 'ATTACK' && this.fireTimer <= 0 && dist < C.LASER_RANGE_HINT) {
      _aim.copy(_toPlayer).normalize();
      const angle = _fwd.angleTo(_aim);
      if (angle < C.PIRATE.AIM_CONE) {
        this.fireTimer = C.PIRATE.FIRE_INTERVAL * (0.85 + Math.random() * 0.3);
        // aim jitter so they miss sometimes
        _aim.x += (Math.random() - 0.5) * C.PIRATE.AIM_JITTER * 2;
        _aim.y += (Math.random() - 0.5) * C.PIRATE.AIM_JITTER * 2;
        _aim.z += (Math.random() - 0.5) * C.PIRATE.AIM_JITTER * 2;
        _aim.normalize();
        this.ship.hardpoints[0].getWorldPosition(_origin);
        laserPool.fire(_origin, _aim, 'pirate', this.damage, this.velocity);
      }
    }
  }

  // returns true if destroyed
  takeDamage(dmg) {
    this.shieldTimer = 0;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) this.hull -= dmg;
    if (this.hull <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
