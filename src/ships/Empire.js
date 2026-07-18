import * as THREE from 'three';
import { C } from '../constants.js';
import { buildTieFighter, buildTieInterceptor, buildStarDestroyer, buildVaderTie } from './ShipFactory.js';

const _toPlayer = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _origin = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

let empireCounter = 0;

// Imperial ships. Fighters reuse the pirate AI shape but never flee; the
// Star Destroyer is a standoff turret platform that launches TIE escorts.
export class Empire {
  constructor(scene, position, scale = 1, type = 'tie') {
    this.scene = scene;
    this.type = type;
    this.faction = 'empire';

    const S = C.EMPIRE[type.toUpperCase()];
    if (type === 'stardestroyer') {
      this.ship = buildStarDestroyer(++empireCounter);
      this.reinforceTimer = 6; // first TIE launch shortly after arrival
    } else if (type === 'vader') {
      this.ship = buildVaderTie(++empireCounter);
      this.empireName = 'DARTH VADER';
    } else if (type === 'interceptor') {
      this.ship = buildTieInterceptor(++empireCounter);
    } else {
      this.ship = buildTieFighter(++empireCounter);
    }
    this.hullMax = S.HULL * scale;
    this.shield = S.SHIELD * scale;
    this.damage = S.DAMAGE * scale;
    this.speed = S.SPEED * (type === 'tie' ? 0.92 + Math.random() * 0.16 : 1);
    this.turn = S.TURN;
    this.aimJitterMult = S.JITTER_MULT ?? 1;

    // only Vader carries ordnance beyond lasers
    this.hasMissiles = type === 'vader';
    this.hasEcm = type === 'vader';
    this.missileTimer = 6.0 + Math.random() * 6.0;
    this.missileLock = 0;
    this.lockBeepT = 0;
    this.noFlee = true; // Imperial pilots do not run

    this.hull = this.hullMax;
    this.shieldMax = this.shield;
    this.shieldTimer = 0;
    this.wingLeader = null;
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

    if (this.type === 'stardestroyer') {
      this.updateCapital(dt, player, laserPool);
      return;
    }

    _toPlayer.copy(player.position).sub(this.group.position);
    const dist = _toPlayer.length();

    if (this.state === 'PURSUE' && dist < C.EMPIRE.ATTACK_DIST) {
      this.state = 'ATTACK';
    } else if (this.state === 'ATTACK' && dist < C.EMPIRE.BREAK_DIST) {
      this.state = 'BREAK';
      this.stateTimer = 2.2 + Math.random();
      const lateral = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize().multiplyScalar(200);
      this.breakTarget.copy(player.position).add(lateral);
    } else if (this.state === 'BREAK' && this.stateTimer <= 0) {
      this.state = 'PURSUE';
    }

    if (this.state === 'BREAK') {
      _desired.copy(this.breakTarget);
      this.throttle = 1;
    } else {
      // lead the player slightly
      _desired.copy(player.position).addScaledVector(player.velocity, dist / C.LASER_SPEED);
      this.throttle = this.state === 'ATTACK' && dist < 120 ? 0.6 : 1;
    }

    _m.lookAt(_desired, this.group.position, _up);
    _q.setFromRotationMatrix(_m);
    this.group.quaternion.rotateTowards(_q, this.turn * dt);

    _fwd.set(0, 0, 1).applyQuaternion(this.group.quaternion);
    this.velocity.copy(_fwd).multiplyScalar(this.speed * this.throttle);
    this.group.position.addScaledVector(this.velocity, dt);

    if (this.state === 'ATTACK' && this.fireTimer <= 0 && dist < C.LASER_RANGE_HINT) {
      _aim.copy(_toPlayer).normalize();
      if (_fwd.angleTo(_aim) < C.EMPIRE.AIM_CONE) {
        const S = C.EMPIRE[this.type.toUpperCase()];
        this.fireTimer = S.FIRE_INTERVAL * (0.85 + Math.random() * 0.3);
        const jitter = C.PIRATE.AIM_JITTER * this.aimJitterMult;
        _aim.x += (Math.random() - 0.5) * jitter * 2;
        _aim.y += (Math.random() - 0.5) * jitter * 2;
        _aim.z += (Math.random() - 0.5) * jitter * 2;
        _aim.normalize();
        this.ship.hardpoints.forEach((hp) => {
          hp.getWorldPosition(_origin);
          laserPool.fire(_origin, _aim, 'empire', this.damage, this.velocity);
        });
      }
    }

    // Vader's seeker: same audible lock-on run as pirate missile boats
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

  // The Star Destroyer holds standoff range and fires turret batteries with
  // no facing requirement, launching TIE reinforcements from the hangar.
  updateCapital(dt, player, laserPool) {
    const S = C.EMPIRE.STARDESTROYER;
    _toPlayer.copy(player.position).sub(this.group.position);
    const dist = _toPlayer.length();

    _desired.copy(player.position);
    _m.lookAt(_desired, this.group.position, _up);
    _q.setFromRotationMatrix(_m);
    this.group.quaternion.rotateTowards(_q, this.turn * dt);

    this.throttle = dist > S.STANDOFF ? 1 : 0;
    _fwd.set(0, 0, 1).applyQuaternion(this.group.quaternion);
    this.velocity.copy(_fwd).multiplyScalar(this.speed * this.throttle);
    this.group.position.addScaledVector(this.velocity, dt);

    // turret batteries: two random hardpoints per volley, aimed at the led
    // player position — the batteries traverse, so no aim-cone gate
    if (this.fireTimer <= 0 && dist < S.FIRE_RANGE) {
      this.fireTimer = S.FIRE_INTERVAL * (0.85 + Math.random() * 0.3);
      _aim.copy(player.position).addScaledVector(player.velocity, dist / C.LASER_SPEED)
        .sub(this.group.position).normalize();
      const jitter = C.PIRATE.AIM_JITTER * 1.4;
      for (let i = 0; i < 2; i++) {
        const hp = this.ship.hardpoints[Math.floor(Math.random() * this.ship.hardpoints.length)];
        hp.getWorldPosition(_origin);
        const shot = _aim.clone();
        shot.x += (Math.random() - 0.5) * jitter * 2;
        shot.y += (Math.random() - 0.5) * jitter * 2;
        shot.z += (Math.random() - 0.5) * jitter * 2;
        shot.normalize();
        laserPool.fire(_origin, shot, 'empire', this.damage, this.velocity);
      }
    }

    // hangar launches keep a TIE screen in space
    this.reinforceTimer -= dt;
    if (this.reinforceTimer <= 0) {
      this.reinforceTimer = S.REINFORCE_INTERVAL;
      const g = window.game;
      if (g && g.encounters) {
        const escorts = g.encounters.empire.filter((e) => e.alive && e.wingLeader === this).length;
        if (escorts < S.MAX_ESCORT) {
          g.encounters.spawnEmpireEscort(this);
          g.ui.hud.toast('STAR DESTROYER LAUNCHING TIE FIGHTERS', 'warn');
        }
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
