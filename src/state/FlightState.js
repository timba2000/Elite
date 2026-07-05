import * as THREE from 'three';
import { C } from '../constants.js';
import { SaveSystem } from '../save/SaveSystem.js';

const _camTarget = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _lookAt = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _shake = new THREE.Vector3();
const _dockPos = new THREE.Vector3();
const _dockN = new THREE.Vector3();
const _dockRel = new THREE.Vector3();
// camera looks down -Z but ship forward is +Z; rotate 180° about Y to face forward
const _FLIP_Y = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

// The core sim: manual flight, supercruise, combat, docking approach.
export class FlightState {
  constructor(game) {
    this.game = game;
    this.mode = 'manual'; // 'manual' | 'super' | 'dead'
    this.paused = false;
    this.superSpeed = 0;
    this.deathTimer = 0;
    this.shakeT = 0;
    this.targetIndex = -1;
    this.target = null;
    this.cameraView = 'cockpit'; // 'cockpit' | 'chase'
    this.clearance = null;   // station we have docking clearance at
    this.dockBounceT = 0;    // cooldown after bouncing off the hub
    this.lockTarget = null;
    this.lockTimer = 0;
    this.locked = false;
  }

  enter(params = {}) {
    const g = this.game;
    this.paused = false;
    this.mode = 'manual';
    this.superSpeed = 0;
    this.shakeT = 0;
    this.setClearance(null);
    this.dockBounceT = 0;
    this.lockTarget = null;
    this.lockTimer = 0;
    this.locked = false;
    g.ui.hud.show();
    g.ui.hud.navTargets = g.world.getNavTargets();
    g.ui.stationUI.hide();
    g.ship.group.visible = true;

    if (params.spawnAtStation) {
      const st = g.world.getStation(params.spawnAtStation);
      const out = st.group.position.clone().sub(st.planetDef.position).normalize();
      g.ship.group.position.copy(st.group.position).addScaledVector(out, 160);
      _m.lookAt(g.ship.group.position.clone().addScaledVector(out, 100), g.ship.group.position, _up);
      g.ship.group.quaternion.setFromRotationMatrix(_m);
      g.ship.velocity.set(0, 0, 0);
      g.ship.throttle = 0.3;
      // snap camera behind ship
      this.updateCamera(1, true);
    } else if (params.loadFromSpace) {
      const pd = g.playerData;
      if (pd.spacePos) {
        g.ship.group.position.set(pd.spacePos.x, pd.spacePos.y, pd.spacePos.z);
      }
      if (pd.spaceRot) {
        g.ship.group.quaternion.set(pd.spaceRot.x, pd.spaceRot.y, pd.spaceRot.z, pd.spaceRot.w);
      }
      if (pd.spaceVel) {
        g.ship.velocity.set(pd.spaceVel.x, pd.spaceVel.y, pd.spaceVel.z);
      }
      g.ship.throttle = pd.spaceThrottle ?? 0;
      this.mode = pd.spaceMode ?? 'manual';
      if (this.mode === 'super') {
        this.superSpeed = g.ship.velocity.length();
      }

      // Restore target
      if (pd.spaceTargetId) {
        const targets = g.world.getNavTargets();
        const found = targets.find((t) => t.id === pd.spaceTargetId);
        if (found) {
          this.target = found;
          this.targetIndex = targets.indexOf(found);
        }
      }

      // snap camera behind ship
      this.updateCamera(1, true);
    }
    if (params.pointerLock) g.input.requestPointerLock();
  }

  exit() {
    this.setClearance(null);
    this.game.ui.hud.setPrompt('');
    this.game.sfx.setEngine(0, false, false);
  }

  // ---------- events wired from EncounterManager ----------
  onInterdiction() {
    const g = this.game;
    if (this.mode === 'super') {
      this.mode = 'manual';
      this.superSpeed = 0;
      g.ship.velocity.clampLength(0, g.ship.stats.maxSpeed);
    }
    this.shakeT = 0.8;
    g.ui.hud.toast('WARNING — INTERDICTION! PIRATES ON SCANNER', 'warn');
  }

  // ---------- pause ----------
  setPaused(on) {
    const g = this.game;
    this.paused = on;
    if (on) {
      g.input.exitPointerLock();
      g.ui.menuUI.showPause({
        onResume: () => { this.setPaused(false); g.input.requestPointerLock(); },
        onSave: () => {
          this.prepareSaveData();
          SaveSystem.save(g.playerData, g.market);
          g.ui.hud.toast('GAME SAVED', 'gold');
          this.setPaused(false);
        },
        onQuit: () => {
          this.setPaused(false);
          g.sm.change(g.states.menu);
        },
      });
    } else {
      g.ui.menuUI.hidePause();
    }
  }

  update(dt) {
    const g = this.game;
    const input = g.input;

    if (input.pressed('Escape')) this.setPaused(!this.paused);
    if (this.paused) return;

    const ship = g.ship;
    const timeScale = this.mode === 'super' ? C.TIME_SCALE_SUPER : 1;
    g.playerData.gameTime += dt * timeScale;
    g.market.update(dt * timeScale);
    if (g.playerData.notoriety > 0) {
      g.playerData.notoriety = Math.max(0, g.playerData.notoriety - dt * timeScale * 0.015);
    }

    // ---------- death ----------
    if (this.mode === 'dead') {
      this.deathTimer -= dt;
      if (this.deathTimer < 1.2) g.ui.hud.fade(true);
      if (this.deathTimer <= 0) this.respawn();
      this.updateWorldAndFx(dt);
      return;
    }

    // ---------- edge-triggered actions ----------
    if (input.pressed('KeyT') || input.pressed('Tab')) this.cycleTarget();
    if (input.pressed('KeyJ')) this.toggleSupercruise();
    if (input.pressed('KeyV')) {
      this.cameraView = this.cameraView === 'cockpit' ? 'chase' : 'cockpit';
      g.ui.hud.toast(this.cameraView === 'cockpit' ? 'COCKPIT VIEW' : 'EXTERNAL VIEW');
    }
    if (input.pressed('KeyM')) {
      const muted = g.sfx.toggleMute();
      g.ui.hud.toast(muted ? 'SOUND MUTED' : 'SOUND ON');
    }
    if (input.pressed('F5')) {
      this.prepareSaveData();
      SaveSystem.save(g.playerData, g.market);
      g.ui.hud.toast('GAME SAVED', 'gold');
    }

    // ---------- flight ----------
    if (this.mode === 'manual') {
      ship.updateManual(dt, input);
      if (input.firing) ship.tryFire(g.laserPool);
    } else if (this.mode === 'super') {
      this.updateSupercruise(dt);
      ship.updateSystems(dt);
    }

    this.keepOutOfBodies();

    // ---------- docking ----------
    let dockPrompt = null;
    if (this.mode === 'manual') {
      dockPrompt = this.updateDocking(dt);
      if (dockPrompt === true) return; // state changed
    }
    if (typeof dockPrompt === 'string') {
      g.ui.hud.setPrompt(dockPrompt);
    } else if (this.mode === 'manual' && this.target && !g.encounters.inCombat) {
      const d = this.target.object.position.distanceTo(ship.position);
      if (d > this.dropDistance(this.target)) {
        g.ui.hud.setPrompt(`J — SUPERCRUISE TO ${this.target.name}`);
      } else g.ui.hud.setPrompt('');
    } else if (g.encounters.inCombat) {
      g.ui.hud.setPrompt('');
    } else if (!input.pointerLocked && this.mode === 'manual') {
      g.ui.hud.setPrompt('CLICK TO ENGAGE MOUSE FLIGHT');
    } else {
      g.ui.hud.setPrompt('');
    }

    // ---------- combat ----------
    g.encounters.update(dt, ship, g.laserPool, this.mode === 'super');

    const targets = [
      { entity: ship, position: ship.position, radius: ship.boundingRadius, side: 'player' },
      ...g.encounters.pirates.map((p) => ({
        entity: p, position: p.position, radius: p.boundingRadius, side: 'pirate',
      })),
      ...g.encounters.police.map((p) => ({
        entity: p, position: p.position, radius: p.boundingRadius, side: 'police',
      })),
    ];
    g.laserPool.update(dt, targets, (t, bolt, hitPos) => this.handleHit(t, bolt, hitPos));

    // ---------- ship-to-ship collisions ----------
    if (this.mode === 'manual') {
      for (const p of g.encounters.pirates.concat(g.encounters.police)) {
        if (!p.alive) continue;
        const minDist = (ship.boundingRadius + p.boundingRadius) * 0.95;
        const d = ship.position.distanceTo(p.position);
        if (d < minDist) {
          const N = ship.position.clone().sub(p.position).normalize();
          const overlap = minDist - d;

          // Push apart
          ship.group.position.addScaledVector(N, overlap * 0.5);
          p.group.position.addScaledVector(N, -overlap * 0.5);

          const relativeVelocity = ship.velocity.clone().sub(p.velocity);
          const impactSpeed = -relativeVelocity.dot(N);
          const dmg = Math.max(3, impactSpeed * 1.5);

          g.ui.hud.damageFlash();
          g.sfx.play(ship.shield > 0 ? 'hitShield' : 'hitHull');
          this.shakeT = Math.max(this.shakeT, 0.4);

          const { destroyed, hullHit } = ship.takeDamage(dmg);
          const pKilled = p.takeDamage(dmg);

          // Bounce velocities
          const bounceSpeed = Math.max(8, impactSpeed * 0.4);
          ship.velocity.addScaledVector(N, bounceSpeed);
          p.velocity.addScaledVector(N, -bounceSpeed);

          if (pKilled) {
            if (p.strobeTimer !== undefined) {
              g.encounters.onPoliceKilled(p, g.explosions);
            } else {
              g.encounters.onPirateKilled(p, g.explosions);
            }
          }

          if (destroyed) {
            this.die();
            break;
          }
        }
      }
    }

    // ---------- missiles ----------
    if (this.mode === 'manual' && g.playerData.upgrades.missiles > 0) {
      if (ship.missilesAmmo > 0) {
        // Search for active NPC ships in crosshair sights
        const hostiles = g.encounters.pirates.concat(g.encounters.police).filter((p) => p.alive);
        let bestHostile = null;
        let minNdcDist = Infinity;

        for (const h of hostiles) {
          const ndc = h.position.clone().project(g.camera);
          if (ndc.z < 1) {
            const ndcDist = Math.hypot(ndc.x, ndc.y);
            if (ndcDist < 0.12 && ndcDist < minNdcDist) {
              minNdcDist = ndcDist;
              bestHostile = h;
            }
          }
        }

        if (bestHostile) {
          if (this.lockTarget === bestHostile) {
            this.lockTimer += dt;
            if (this.lockTimer >= 3.0) {
              this.lockTimer = 3.0;
              if (!this.locked) {
                this.locked = true;
                g.ui.hud.toast('MISSILE LOCK ACQUIRED', 'gold');
                g.sfx.play('cash');
              }
            }
          } else {
            this.lockTarget = bestHostile;
            this.lockTimer = 0;
            this.locked = false;
          }
        } else {
          this.lockTarget = null;
          this.lockTimer = 0;
          this.locked = false;
        }
      } else {
        this.lockTarget = null;
        this.lockTimer = 0;
        this.locked = false;
      }

      if (input.pressed('KeyQ')) {
        this.tryLaunchMissile();
      }
    } else {
      this.lockTarget = null;
      this.lockTimer = 0;
      this.locked = false;
    }

    if (g.missilePool) {
      g.missilePool.update(dt, (t, missile) => this.handleMissileHit(t, missile));
    }

    this.updateWorldAndFx(dt);
    this.updateCamera(dt);

    let lockState = 'none';
    if (this.locked) {
      lockState = 'locked';
    } else if (this.lockTimer > 0) {
      lockState = 'locking';
    }

    g.ui.hud.update(dt, {
      ship, playerData: g.playerData, stats: ship.stats,
      target: this.target, mode: this.mode, camera: g.camera,
      pirates: g.encounters.pirates, police: g.encounters.police, pods: g.encounters.pods,
      lockState,
    });
  }

  updateWorldAndFx(dt) {
    const g = this.game;
    let warp = 0;
    if (this.mode === 'super') {
      const ratio = this.superSpeed / C.SUPER_SPEED;
      warp = Math.min(1.5, ratio * 1.6);
      if (warp > 1.0) {
        warp = 1.0 + (warp - 1.0) * 0.25;
      }
    }
    g.world.update(dt, g.camera.position, warp);
    g.particles.update(dt);
    g.explosions.update(dt);
    if (this.mode !== 'dead') {
      g.engineTrail?.update(dt,
        this.mode === 'super' ? 1 : g.ship.throttle,
        g.ship.boosting || this.mode === 'super',
        g.ship.velocity);
    }
    g.sfx.setEngine(
      this.mode === 'dead' ? 0 : g.ship.throttle,
      this.mode !== 'dead' && g.ship.boosting,
      this.mode === 'super'
    );
  }

  handleHit(t, bolt, hitPos) {
    const g = this.game;
    if (t.side === 'pirate' || t.side === 'police') {
      const killed = t.entity.takeDamage(bolt.damage);
      // small spark
      g.explosions.spawn(hitPos, 0.15);
      g.sfx.play('hitSpark');
      if (killed) {
        if (t.side === 'police') {
          g.encounters.onPoliceKilled(t.entity, g.explosions);
        } else {
          g.encounters.onPirateKilled(t.entity, g.explosions);
        }
      }
    } else {
      const { destroyed, hullHit } = g.ship.takeDamage(bolt.damage);
      g.sfx.play(hullHit ? 'hitHull' : 'hitShield');
      g.ui.hud.damageFlash();
      this.shakeT = Math.max(this.shakeT, 0.3);
      if (hullHit) {
        const stats = g.ship.stats;
        if (g.playerData.hull < stats.hullMax * 0.3) {
          g.ui.hud.toast('WARNING — HULL CRITICAL', 'warn');
        }
        if (g.playerData.hull < stats.hullMax * 0.5 && Math.random() < C.CARGO_EJECT_CHANCE) {
          const lost = g.playerData.ejectRandomCargo();
          if (lost) g.ui.hud.toast(`CARGO HATCH BREACH — LOST 1x ${lost.toUpperCase()}`, 'warn');
        }
      }
      if (destroyed) this.die();
    }
  }

  prepareSaveData() {
    const g = this.game;
    const ship = g.ship;
    const pd = g.playerData;

    pd.inSpace = true;
    pd.spacePos = { x: ship.group.position.x, y: ship.group.position.y, z: ship.group.position.z };
    pd.spaceRot = { x: ship.group.quaternion.x, y: ship.group.quaternion.y, z: ship.group.quaternion.z, w: ship.group.quaternion.w };
    pd.spaceVel = { x: ship.velocity.x, y: ship.velocity.y, z: ship.velocity.z };
    pd.spaceThrottle = ship.throttle;
    pd.spaceMode = this.mode;
    pd.spaceTargetId = this.target ? this.target.id : null;
  }

  tryLaunchMissile() {
    const g = this.game;
    const ship = g.ship;

    if (ship.missilesAmmo <= 0) {
      g.ui.hud.toast('NO MISSILES REMAINING', 'warn');
      return;
    }

    if (!this.locked || !this.lockTarget || !this.lockTarget.alive) {
      g.ui.hud.toast('NO TARGET LOCK', 'warn');
      return;
    }

    // Launch!
    ship.missilesAmmo--;

    // Launch position slightly in front of ship
    const origin = ship.group.position.clone().addScaledVector(ship.forward, 3.5);
    const dir = ship.forward;

    g.missilePool.fire(origin, dir, this.lockTarget, ship.stats.missilesDamage, ship.velocity);
    g.ui.hud.toast('MISSILE LAUNCHED', 'gold');

    // Reset lock
    this.locked = false;
    this.lockTimer = 0;
    this.lockTarget = null;
  }

  handleMissileHit(t, missile) {
    const g = this.game;
    g.explosions.spawn(missile.mesh.position, 1.8);
    g.sfx.play('hitHull');

    const killed = t.takeDamage(missile.damage);
    if (killed) {
      if (t.strobeTimer !== undefined) {
        g.encounters.onPoliceKilled(t, g.explosions);
      } else {
        g.encounters.onPirateKilled(t, g.explosions);
      }
    }
  }

  die() {
    const g = this.game;
    g.explosions.spawn(g.ship.position, 2.2);
    g.ship.group.visible = false;
    this.mode = 'dead';
    this.deathTimer = 2.4;
    g.ui.hud.toast('SHIP DESTROYED', 'warn');
  }

  respawn() {
    const g = this.game;
    const stats = g.playerData.getDerivedStats();
    g.playerData.hull = stats.hullMax;
    g.playerData.cargo = {};
    g.playerData.credits = Math.floor(g.playerData.credits * (1 - C.DEATH_CREDIT_TAX));
    g.ship.alive = true;
    g.ship.shield = stats.shieldMax;
    g.ship.energy = C.ENERGY_MAX;
    g.ship.missilesAmmo = stats.missilesMaxAmmo;
    g.ship.velocity.set(0, 0, 0);
    g.ship.group.visible = true;
    g.encounters.clearAll();
    g.laserPool.clear();
    if (g.missilePool) g.missilePool.clear();
    g.ui.hud.fade(false);
    this.mode = 'manual';
    const station = g.world.getStation(g.playerData.lastStationId);
    g.sm.change(g.states.station, { station, respawned: true });
  }

  // ---------- targets / supercruise ----------
  cycleTarget() {
    const g = this.game;
    const targets = g.world.getNavTargets();
    if (targets.length === 0) return;

    // Check if there is a planet in front of the ship (within a ~28 degree cone)
    const ship = g.ship;
    const fwd = ship.forward;
    let bestPlanet = null;
    let minAngle = 0.5;

    targets.forEach((t, index) => {
      if (t.type === 'planet') {
        const toTarget = t.object.position.clone().sub(ship.position).normalize();
        const angle = fwd.angleTo(toTarget);
        if (angle < minAngle) {
          minAngle = angle;
          bestPlanet = { target: t, index };
        }
      }
    });

    // Target the front-facing planet if we aren't already targeting it
    if (bestPlanet && (!this.target || this.target.id !== bestPlanet.target.id)) {
      this.target = bestPlanet.target;
      this.targetIndex = bestPlanet.index;
      return;
    }

    this.targetIndex = (this.targetIndex + 1) % targets.length;
    this.target = targets[this.targetIndex];
  }

  dropDistance(target) {
    return target.radius * 3 + C.SUPER_DROP_MARGIN;
  }

  toggleSupercruise() {
    const g = this.game;
    if (this.mode === 'super') {
      this.mode = 'manual';
      this.superSpeed = 0;
      g.ship.velocity.clampLength(0, g.ship.stats.maxSpeed);
      g.sfx.play('superDrop');
      return;
    }
    if (!this.target) {
      g.ui.hud.toast('NO NAV TARGET — PRESS T', 'warn');
      return;
    }
    const d = this.target.object.position.distanceTo(g.ship.position);
    if (d <= this.dropDistance(this.target)) {
      g.ui.hud.toast('TOO CLOSE TO TARGET', 'warn');
      return;
    }
    if (g.encounters.nearestPirateDist(g.ship.position) < C.SUPER_MIN_PIRATE_DIST) {
      g.ui.hud.toast('CANNOT ENGAGE — HOSTILES NEARBY', 'warn');
      return;
    }
    this.mode = 'super';
    this.superSpeed = g.ship.velocity.length();
    g.sfx.play('superEngage');
    g.ui.hud.toast(`SUPERCRUISE — ${this.target.name}`);
  }

  updateSupercruise(dt) {
    const g = this.game;
    const ship = g.ship;
    if (!this.target) { this.mode = 'manual'; return; }

    // align toward target
    _m.lookAt(this.target.object.position, ship.position, _up);
    _q.setFromRotationMatrix(_m);
    ship.group.quaternion.rotateTowards(_q, 1.4 * dt);

    // ramp speed
    this.superSpeed = Math.min(C.SUPER_SPEED, this.superSpeed + C.SUPER_ACCEL * dt);
    _fwd.set(0, 0, 1).applyQuaternion(ship.group.quaternion);
    ship.velocity.copy(_fwd).multiplyScalar(this.superSpeed);
    ship.group.position.addScaledVector(ship.velocity, dt);
    ship.throttle = 1;

    // auto-drop at destination
    _toTarget.copy(this.target.object.position).sub(ship.position);
    const dist = _toTarget.length();
    // don't overshoot: also drop if we'd pass it next frame
    if (dist < this.dropDistance(this.target) || this.superSpeed * dt * 2 > dist) {
      this.mode = 'manual';
      this.superSpeed = 0;
      ship.velocity.clampLength(0, ship.stats.maxSpeed);
      ship.throttle = 0.5;
      g.sfx.play('superDrop');
      g.ui.hud.toast(`ARRIVED — ${this.target.name}`);
    }
  }

  nearestDockableStation() {
    const g = this.game;
    for (const st of g.world.stations) {
      if (st.group.position.distanceTo(g.ship.position) < C.DOCK_RANGE) return st;
    }
    return null;
  }

  // ---------- docking ----------
  setClearance(st) {
    if (this.clearance && this.clearance !== st) this.clearance.setDockingActive(false);
    this.clearance = st;
    if (st) st.setDockingActive(true);
  }

  // Returns true if the game state changed, a prompt string while docking is
  // in play, or null when no station is relevant this frame.
  updateDocking(dt) {
    const g = this.game;
    this.dockBounceT = Math.max(0, this.dockBounceT - dt);

    if (this.clearance) {
      const st = this.clearance;
      if (st.group.position.distanceTo(g.ship.position) > C.DOCK_CLEARANCE_RANGE) {
        this.setClearance(null);
        g.ui.hud.toast('DOCKING CLEARANCE EXPIRED', 'warn');
        return null;
      }
      st.getDockingFrame(_dockPos, _dockN);
      const speed = g.ship.velocity.length();

      if (this.dockBounceT <= 0 && this.tryDockCapture(st, speed)) return true;

      const dist = _dockPos.distanceTo(g.ship.position);
      let msg = `DOCK — APERTURE ${Math.round(dist * 10)}M · SPEED ${Math.round(speed * 10)}M/S`;
      if (speed > C.DOCK_MAX_SPEED) msg += ` — SLOW BELOW ${Math.round(C.DOCK_MAX_SPEED * 10)}M/S`;
      return msg;
    }

    const dockStation = this.nearestDockableStation();
    if (!dockStation) return null;
    if (g.input.pressed('KeyF')) {
      if (g.ship.stats.dockingComputer) {
        g.sm.change(g.states.docking, { station: dockStation });
        return true;
      }
      this.setClearance(dockStation);
      g.ui.hud.toast(`CLEARANCE GRANTED — ENTER THE HUB APERTURE UNDER ${Math.round(C.DOCK_MAX_SPEED * 10)} M/S`, 'gold');
      return 'PROCEED TO THE GREEN APERTURE';
    }
    return 'F — REQUEST DOCKING';
  }

  // Contact with the hub face: a clean, slow, centred, nose-in approach docks;
  // anything else bounces the ship off with speed-scaled damage.
  tryDockCapture(st, speed) {
    const g = this.game;
    const ship = g.ship;
    _dockRel.copy(ship.position).sub(_dockPos);
    const axial = _dockRel.dot(_dockN);
    const lateral = Math.sqrt(Math.max(0, _dockRel.lengthSq() - axial * axial));

    // only react when the ship reaches the hub face from outside
    if (axial > C.DOCK_FACE_DIST || axial < -C.DOCK_FACE_DIST || lateral > C.DOCK_FACE_RADIUS) return false;

    _fwd.set(0, 0, 1).applyQuaternion(ship.group.quaternion);
    const inward = speed > 0.01 ? -ship.velocity.dot(_dockN) / speed : 0;
    const nose = -_fwd.dot(_dockN);

    // Calculate roll alignment between ship and rotating station doors
    const shipUp = new THREE.Vector3(0, 1, 0).applyQuaternion(ship.group.quaternion);
    const stationQ = st.group.quaternion;
    const stationUp = new THREE.Vector3(0, 1, 0).applyQuaternion(stationQ);
    const rollDot = Math.abs(shipUp.dot(stationUp));

    // Calculate rectangular off-center offsets
    const stationX = new THREE.Vector3(1, 0, 0).applyQuaternion(stationQ).normalize();
    const stationY = new THREE.Vector3(0, 1, 0).applyQuaternion(stationQ).normalize();
    const localX = Math.abs(_dockRel.dot(stationX));
    const localY = Math.abs(_dockRel.dot(stationY));

    const scale = st.group.scale.x; // 2.2
    const limitX = 2.15 * scale;
    const limitY = 1.35 * scale;

    const doorsClosed = st.doorOpenFactor < 0.9;
    const tooFast = speed > C.DOCK_MAX_SPEED;
    const offCentre = localX > limitX || localY > limitY;
    const misaligned = nose < C.DOCK_ALIGN_DOT || inward < C.DOCK_INWARD_DOT;
    const rollMisaligned = rollDot < 0.92;

    if (!doorsClosed && !tooFast && !offCentre && !misaligned && !rollMisaligned) {
      this.setClearance(null);
      g.sm.change(g.states.docking, { station: st, manual: true });
      return true;
    }

    // bounce off the hub
    const vDotN = ship.velocity.dot(_dockN);
    ship.velocity.addScaledVector(_dockN, -2 * vDotN).multiplyScalar(0.45);
    // push back out in front of the face, keeping the lateral offset
    _dockRel.addScaledVector(_dockN, -axial);
    ship.group.position.copy(_dockPos).add(_dockRel).addScaledVector(_dockN, C.DOCK_FACE_DIST + 2);
    this.dockBounceT = 1.2;
    this.shakeT = Math.max(this.shakeT, 0.5);

    let reason = 'MISALIGNED';
    if (doorsClosed) reason = 'DOORS LOCKED/CLOSED';
    else if (tooFast) reason = 'APPROACH TOO FAST';
    else if (offCentre) reason = 'OFF CENTRE';
    else if (rollMisaligned) reason = 'ALIGN SHIP ROLL WITH DOORS (LEVEL)';

    g.ui.hud.toast(`DOCKING ABORTED — ${reason}`, 'warn');

    const dmg = Math.max(0, speed - C.DOCK_SAFE_SPEED) * C.DOCK_BOUNCE_DAMAGE;
    if (dmg > 0) {
      g.ui.hud.damageFlash();
      const { destroyed, hullHit } = ship.takeDamage(dmg);
      g.sfx.play(hullHit ? 'hitHull' : 'hitShield');
      if (destroyed) { this.die(); return true; }
    }
    return false;
  }

  // soft push-out so you can't fly inside the sun or planets, with collision damage and supercruise dropout
  keepOutOfBodies() {
    const g = this.game;
    const ship = g.ship;
    const pos = ship.group.position;
    const sunMin = 420;

    if (this.mode === 'dead') return;

    if (pos.length() < sunMin) {
      if (this.mode === 'super') {
        this.mode = 'manual';
        this.superSpeed = 0;
        ship.velocity.clampLength(0, ship.stats.maxSpeed);
        ship.throttle = 0.3;
        g.sfx.play('superDrop');
        g.ui.hud.toast('DROPPED OUT — TOO CLOSE TO STAR', 'warn');
      }

      const N = pos.clone().normalize();
      pos.setLength(sunMin + 2);

      const impactSpeed = -ship.velocity.dot(N);
      ship.velocity.addScaledVector(N, -2 * ship.velocity.dot(N)).multiplyScalar(0.4);

      const dmg = Math.max(0, impactSpeed - C.DOCK_SAFE_SPEED) * C.DOCK_BOUNCE_DAMAGE + 5;
      if (dmg > 0) {
        g.ui.hud.damageFlash();
        const { destroyed, hullHit } = ship.takeDamage(dmg);
        g.sfx.play(hullHit ? 'hitHull' : 'hitShield');
        this.shakeT = Math.max(this.shakeT, 0.5);
        if (destroyed) { this.die(); return; }
      }
    }

    for (const p of g.world.planets) {
      const min = p.radius + 25;
      const d = pos.distanceTo(p.group.position);
      if (d < min) {
        if (this.mode === 'super') {
          this.mode = 'manual';
          this.superSpeed = 0;
          ship.velocity.clampLength(0, ship.stats.maxSpeed);
          ship.throttle = 0.3;
          g.sfx.play('superDrop');
          g.ui.hud.toast(`DROPPED OUT — TOO CLOSE TO ${p.def.name.toUpperCase()}`, 'warn');
        }

        const N = pos.clone().sub(p.group.position).normalize();
        pos.copy(p.group.position).addScaledVector(N, min + 2);

        const impactSpeed = -ship.velocity.dot(N);
        ship.velocity.addScaledVector(N, -2 * ship.velocity.dot(N)).multiplyScalar(0.4);

        const dmg = Math.max(0, impactSpeed - C.DOCK_SAFE_SPEED) * C.DOCK_BOUNCE_DAMAGE + 3;
        if (dmg > 0) {
          g.ui.hud.damageFlash();
          const { destroyed, hullHit } = ship.takeDamage(dmg);
          g.sfx.play(hullHit ? 'hitHull' : 'hitShield');
          this.shakeT = Math.max(this.shakeT, 0.45);
          if (destroyed) { this.die(); return; }
        }
      }
    }
  }

  // ---------- camera ----------
  updateCamera(dt, snap = false) {
    const g = this.game;
    const ship = g.ship;
    const speedFactor = this.mode === 'super' ? Math.min(1, this.superSpeed / C.SUPER_SPEED) : 0;

    const cockpit = this.cameraView === 'cockpit';
    // hide own hull in cockpit view (outer group visibility is owned by death logic)
    ship.ship.group.visible = !cockpit && this.mode !== 'dead';

    if (cockpit) {
      // eye at the canopy, locked rigidly to the ship
      _camOffset.set(0, 0.95, 2.0).applyQuaternion(ship.group.quaternion);
      g.camera.position.copy(ship.group.position).add(_camOffset);
      g.camera.quaternion.copy(ship.group.quaternion).multiply(_FLIP_Y);
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const s = this.shakeT * 0.9;
        _shake.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
        g.camera.position.add(_shake);
      }
    } else {
      _camOffset.set(C.CAM_OFFSET.x, C.CAM_OFFSET.y, -(C.CAM_OFFSET.z + speedFactor * 9 + (ship.boosting ? 3 : 0)));
      _camOffset.applyQuaternion(ship.group.quaternion);
      _camTarget.copy(ship.group.position).add(_camOffset);

      if (snap) g.camera.position.copy(_camTarget);
      else {
        const a = 1 - Math.exp(-C.CAM_EASE * dt);
        g.camera.position.lerp(_camTarget, a);
      }

      // shake
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const s = this.shakeT * 1.6;
        _shake.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
        g.camera.position.add(_shake);
      }

      _fwd.set(0, 0, 1).applyQuaternion(ship.group.quaternion);
      _lookAt.copy(ship.group.position).addScaledVector(_fwd, 30);
      g.camera.up.set(0, 1, 0).applyQuaternion(ship.group.quaternion);
      g.camera.lookAt(_lookAt);
    }

    // FOV kick: Star Wars jump warp FOV stretch
    let targetFov = C.CAMERA_FOV;
    if (ship.boosting) {
      targetFov = C.CAMERA_FOV_BOOST;
    } else if (this.mode === 'super') {
      const ratio = this.superSpeed / C.SUPER_SPEED;
      targetFov = C.CAMERA_FOV + ratio * 45; // 60 -> 105 degrees!
    }
    g.camera.fov += (targetFov - g.camera.fov) * Math.min(1, 6 * dt);
    g.camera.updateProjectionMatrix();
  }
}
