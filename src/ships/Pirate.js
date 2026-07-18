import * as THREE from 'three';
import { C } from '../constants.js';
import { buildPirate, buildMediumPirate, buildHeavyPirate, buildCutthroat, buildCorsair } from './ShipFactory.js';

const _toPlayer = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _origin = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

let pirateCounter = 0;

export class Pirate {
  constructor(scene, position, scale = 1, type = 'raider') {
    this.scene = scene;
    this.type = type;
    this.faction = 'pirate';

    if (this.type === 'dreadnought') {
      this.ship = buildHeavyPirate(++pirateCounter);
      this.hullMax = C.PIRATE.HULL * 3.5 * scale;
      this.shield = C.PIRATE.SHIELD * 3.0 * scale;
      this.damage = C.PIRATE.DAMAGE * 1.5 * scale;
      this.speed = C.PIRATE.SPEED * 0.65;
      this.turn = C.PIRATE.TURN * 0.55;
      this.missileTimer = 6.0 + Math.random() * 6.0;
    } else if (this.type === 'marauder') {
      this.ship = buildMediumPirate(++pirateCounter);
      this.hullMax = C.PIRATE.HULL * 1.8 * scale;
      this.shield = C.PIRATE.SHIELD * 1.6 * scale;
      this.damage = C.PIRATE.DAMAGE * 1.15 * scale;
      this.speed = C.PIRATE.SPEED * 0.85;
      this.turn = C.PIRATE.TURN * 0.8;
    } else if (this.type === 'cutthroat') {
      // glass-cannon interceptor: fast, hits hard, folds quickly
      this.ship = buildCutthroat(++pirateCounter);
      this.hullMax = C.PIRATE.HULL * 0.7 * scale;
      this.shield = C.PIRATE.SHIELD * 0.8 * scale;
      this.damage = C.PIRATE.DAMAGE * 1.3 * scale;
      this.speed = C.PIRATE.SPEED * 1.35;
      this.turn = C.PIRATE.TURN * 1.3;
      this.aimJitterMult = 0.7;
    } else if (this.type === 'corsair') {
      // veteran ace: durable, unnervingly accurate, always carries ECM
      this.ship = buildCorsair(++pirateCounter);
      this.hullMax = C.PIRATE.HULL * 2.2 * scale;
      this.shield = C.PIRATE.SHIELD * 2.0 * scale;
      this.damage = C.PIRATE.DAMAGE * 1.3 * scale;
      this.speed = C.PIRATE.SPEED * 1.05;
      this.turn = C.PIRATE.TURN * 1.05;
      this.aimJitterMult = 0.55;
    } else {
      this.ship = buildPirate(++pirateCounter);
      this.hullMax = C.PIRATE.HULL * scale;
      this.shield = C.PIRATE.SHIELD * scale;
      this.damage = C.PIRATE.DAMAGE * scale;
      this.speed = C.PIRATE.SPEED * (0.9 + Math.random() * 0.25);
      this.turn = C.PIRATE.TURN * (0.9 + Math.random() * 0.2);
    }

    // loadout: dreadnoughts and cutthroats always carry missiles, lighter
    // hulls often do; plenty of pirates also mount anti-missile ECM
    this.hasMissiles = this.type === 'dreadnought' || this.type === 'cutthroat'
      || Math.random() < C.PIRATE.MISSILE_CHANCE;
    this.hasEcm = this.type === 'corsair' || Math.random() < C.PIRATE.ECM_CHANCE;
    this.aimJitterMult = this.aimJitterMult ?? 1;
    this.missileTimer = this.missileTimer ?? 8.0 + Math.random() * 8.0;
    this.missileLock = 0; // seconds of seeker lock accumulated on the player
    this.lockBeepT = 0;

    this.hull = this.hullMax;
    this.shieldMax = this.shield;
    this.shieldTimer = 0;
    this.wingLeader = null; // set by EncounterManager when spawned as a wing
    this.group = this.ship.group;
    this.group.position.copy(position);
    scene.add(this.group);

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
      this.shield = Math.min(this.shieldMax, this.shield + 4 * dt);
    }

    _toPlayer.copy(player.position).sub(this.group.position);
    const dist = _toPlayer.length();

    // state transitions (named contract targets fight to the death);
    // wingmen lose their nerve once their leader is gone
    const fleeHull = this.wingLeader && !this.wingLeader.alive
      ? C.PIRATE.WING_BROKEN_FLEE : C.PIRATE.FLEE_HULL;
    if (!this.noFlee && this.hull / this.hullMax < fleeHull) {
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
        // coordinated wingmen shoot noticeably straighter; aces do too
        const jitter = C.PIRATE.AIM_JITTER * this.aimJitterMult
          * (this.wingLeader && this.wingLeader.alive ? C.PIRATE.WING_JITTER_MULT : 1);
        _aim.x += (Math.random() - 0.5) * jitter * 2;
        _aim.y += (Math.random() - 0.5) * jitter * 2;
        _aim.z += (Math.random() - 0.5) * jitter * 2;
        _aim.normalize();

        this.ship.hardpoints.forEach((hp) => {
          hp.getWorldPosition(_origin);
          laserPool.fire(_origin, _aim, 'pirate', this.damage, this.velocity);
        });
      }
    }

    // Missile fire: the seeker needs an audible lock-on run before launch —
    // the player hears the warning and can chaff the lock or boost away
    if (this.alive && this.hasMissiles && this.state === 'ATTACK'
        && dist > C.PIRATE.MISSILE_MIN_DIST && dist < C.PIRATE.MISSILE_MAX_DIST) {
      this.missileTimer -= dt;
      if (this.missileTimer <= 0) {
        const g = window.game;
        this.missileLock += dt;
        this.lockBeepT -= dt;
        if (g && this.lockBeepT <= 0) {
          this.lockBeepT = 0.34;
          g.sfx.play('missileLockWarn');
          if (this.missileLock <= dt) g.ui.hud.toast('HOSTILE MISSILE LOCK — CHAFF (X) OR BOOST!', 'warn');
        }
        if (this.missileLock >= C.PIRATE.MISSILE_LOCK_TIME) {
          this.missileLock = 0;
          this.missileTimer = 10.0 + Math.random() * 8.0;
          if (g && g.enemyMissilePool) {
            const origin = new THREE.Vector3();
            if (this.ship.group.userData && this.ship.group.userData.mslHp) {
              this.ship.group.userData.mslHp.getWorldPosition(origin);
            } else {
              origin.copy(this.group.position).addScaledVector(_fwd, 4.0);
            }
            g.enemyMissilePool.fire(origin, _fwd.clone(), g.ship, C.PIRATE.MISSILE_DAMAGE, this.velocity);
            g.sfx.play('missileLaunch');
            g.ui.hud.toast('WARNING — INCOMING HOSTILE MISSILE!', 'warn');
          }
        }
      }
    } else {
      this.missileLock = 0;
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
