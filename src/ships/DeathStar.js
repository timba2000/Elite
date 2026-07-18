import * as THREE from 'three';
import { C } from '../constants.js';
import { buildDeathStar } from './ShipFactory.js';

const _aim = new THREE.Vector3();
const _origin = new THREE.Vector3();

// The Empire's battle station. Static, invulnerable to lasers, ringed by
// turbolaser fire and hangar-launched TIEs, on a superlaser countdown.
// The only kill: a missile into the thermal exhaust port.
export class DeathStar {
  constructor(scene, position) {
    this.scene = scene;
    this.faction = 'empire';
    this.isDeathStar = true;
    this.type = 'deathstar';
    this.ship = buildDeathStar();
    this.group = this.ship.group;
    this.group.position.copy(position);
    scene.add(this.group);

    this.alive = true;
    this.velocity = new THREE.Vector3(); // it does not move; bolts inherit zero
    this.fireTimer = 2.5;
    this.tieTimer = 5;
    this.superlaserT = C.DEATHSTAR.SUPERLASER_TIME;
    this.superlaserFired = false;
    this.warned = {};

    const ds = this;
    // the one vulnerable spot — lockable, missile-only (lasers are handled
    // as ray-shielded in FlightState.handleHit)
    this.port = {
      isExhaustPort: true,
      faction: 'empire',
      empireName: 'EXHAUST PORT',
      type: 'port',
      alive: true,
      boundingRadius: 7,
      position: new THREE.Vector3(),
      takeDamage() { this.alive = false; ds.alive = false; return true; },
    };
  }

  get position() { return this.group.position; }
  get boundingRadius() { return this.ship.boundingRadius; }

  // turbolaser armor: lasers never scratch it
  takeDamage() { return false; }

  update(dt, player, laserPool) {
    if (!this.alive) return;
    this.ship.port.getWorldPosition(this.port.position);

    const dist = player.position.distanceTo(this.group.position);
    const surfaceDist = dist - this.boundingRadius;

    // turbolaser batteries: volleys from surface turrets on the near side
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && surfaceDist < C.DEATHSTAR.TURRET_RANGE) {
      this.fireTimer = C.DEATHSTAR.TURRET_INTERVAL * (0.8 + Math.random() * 0.4);
      for (let volley = 0; volley < 2; volley++) {
        // pick a turret facing the player so bolts don't fire through the hull
        let turret = null;
        for (let i = 0; i < 4 && !turret; i++) {
          const t = this.ship.turrets[Math.floor(Math.random() * this.ship.turrets.length)];
          t.getWorldPosition(_origin);
          _aim.copy(player.position).sub(_origin);
          if (_aim.dot(_origin.clone().sub(this.group.position)) > 0) turret = t;
        }
        if (!turret) continue;
        turret.getWorldPosition(_origin);
        _aim.copy(player.position)
          .addScaledVector(player.velocity, _origin.distanceTo(player.position) / C.LASER_SPEED)
          .sub(_origin).normalize();
        const jitter = C.PIRATE.AIM_JITTER * 1.6;
        _aim.x += (Math.random() - 0.5) * jitter * 2;
        _aim.y += (Math.random() - 0.5) * jitter * 2;
        _aim.z += (Math.random() - 0.5) * jitter * 2;
        _aim.normalize();
        laserPool.fire(_origin, _aim, 'empire', C.DEATHSTAR.TURRET_DAMAGE, this.velocity);
      }
    }

    // hangar keeps a TIE screen in space
    this.tieTimer -= dt;
    if (this.tieTimer <= 0) {
      this.tieTimer = C.DEATHSTAR.TIE_INTERVAL;
      const g = window.game;
      if (g && g.encounters) {
        const ties = g.encounters.empire.filter((e) => e.alive && e.type === 'tie').length;
        if (ties < C.DEATHSTAR.MAX_TIES) {
          g.encounters.spawnEmpireEscort(this);
          g.ui.hud.toast('DEATH STAR HANGAR LAUNCHING TIE FIGHTERS', 'warn');
        }
      }
    }

    // superlaser countdown: the dish glow swells until it fires
    this.superlaserT -= dt;
    const charge = 1 - this.superlaserT / C.DEATHSTAR.SUPERLASER_TIME;
    this.ship.dishGlow.scale.setScalar(Math.max(0.01, charge * 70 * (0.9 + 0.1 * Math.sin(this.superlaserT * 6))));
    const g = window.game;
    for (const mark of [120, 60, 30, 10]) {
      if (this.superlaserT <= mark && !this.warned[mark]) {
        this.warned[mark] = true;
        g?.ui.hud.toast(`DEATH STAR SUPERLASER CHARGING — ${mark} SECONDS TO FIRE`, 'warn');
      }
    }
    if (this.superlaserT <= 0 && !this.superlaserFired) {
      this.superlaserFired = true; // FlightState turns this into the kill shot
    }
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
