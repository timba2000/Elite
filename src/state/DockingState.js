import * as THREE from 'three';
import { C } from '../constants.js';
import { DockingBay, OPEN_X } from '../world/DockingBay.js';

const _start = new THREE.Vector3();
const _end = new THREE.Vector3();
const _startQ = new THREE.Quaternion();
const _endQ = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _euler = new THREE.Euler();
const _dust = new THREE.Vector3();
const _dustVel = new THREE.Vector3();
const _col = new THREE.Color();
// nose-into-the-port: station -z with the station's own up
const _q180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

function smooth(k) { return k * k * (3 - 2 * k); }

// Final glide into the station. Two ways in: the docking computer autopilot
// (long cinematic approach + a run down the docking tunnel) or the station
// tractor after a manual capture. Both then cut to the hangar interior, where
// the ship flies in through the force field, hover-turns, and sets down on
// the centre pad before the station UI takes over.
export class DockingState {
  constructor(game) {
    this.game = game;
  }

  enter({ station, manual }) {
    const g = this.game;
    this.station = station;
    this.station.setDockingActive(true); // Open the doors!
    this.t = 0;
    this.elapsed = 0;
    this.phase = manual ? 'tractor' : 'approach';
    this.manual = !!manual;
    g.ship.ship.group.visible = true; // exterior shot
    g.sfx.play('dockGranted');
    if (!this.manual) {
      g.sfx.startBlueDanube();
    }
    g.sfx.setEngine(0, false, false);
    g.input.exitPointerLock();
    g.ui.hud.setPrompt('');
    g.ui.hud.toast(this.manual
      ? `TRACTOR LOCK — WELCOME TO ${station.name}`
      : `DOCKING COMPUTER ENGAGED — ${station.name}`);

    _start.copy(g.ship.group.position);
    _startQ.copy(g.ship.group.quaternion);
  }

  nextPhase(phase) {
    this.phase = phase;
    this.t = 0;
    _start.copy(this.game.ship.group.position);
    _startQ.copy(this.game.ship.group.quaternion);
  }

  update(dt) {
    const g = this.game;
    this.elapsed += dt;
    switch (this.phase) {
      case 'approach': this.updateApproach(dt); break;
      case 'tractor': this.updateTractor(dt); break;
      case 'enter': this.updateEnter(dt); break;
      case 'landing': this.updateLanding(dt); break;
    }

    g.world.update(dt, g.camera.position);
    g.particles.update(dt);
    g.explosions.update(dt);
    g.engineTrail?.update(dt, g.ship.throttle, false, g.ship.velocity);
  }

  // ---------- Act I/II: autopilot glide to the marker on the slot axis ----------
  updateApproach(dt) {
    const g = this.game;
    this.t += dt / C.DOCK_DURATION;
    const k = Math.min(1, this.t);
    const ease = smooth(k);

    this.station.dockingPoint.getWorldPosition(_end);
    const stationQ = this.station.group.quaternion;
    const stationUp = _up.set(0, 1, 0).applyQuaternion(stationQ);
    _m.lookAt(_end, _start, stationUp);
    _endQ.setFromRotationMatrix(_m);

    g.ship.group.position.lerpVectors(_start, _end, ease);
    g.ship.group.quaternion.slerpQuaternions(_startQ, _endQ, Math.min(1, k * 2));
    g.ship.velocity.set(0, 0, 0);
    g.ship.throttle = 0.2 + 0.2 * (1 - k);

    if (k < 0.55) {
      // Act I: follow chase view trailing the ship
      _v.set(0, 6, -26).applyQuaternion(g.ship.group.quaternion);
      g.camera.position.copy(g.ship.group.position).add(_v);
      g.camera.lookAt(_end);
    } else {
      // Act II: gate close-up as the ship lines up on the slot
      _v.set(26, 12, 10).applyQuaternion(stationQ);
      g.camera.position.copy(_end).add(_v);
      g.camera.lookAt(g.ship.group.position);
    }

    if (k >= 1) this.nextPhase('enter');
  }

  // ---------- manual capture: the tractor pulls the ship through the aperture ----------
  updateTractor(dt) {
    const g = this.game;
    this.t += dt / C.DOCK_TRACTOR_DURATION;
    const k = Math.min(1, this.t);

    _end.copy(this.station.group.position);
    const stationQ = this.station.group.quaternion;
    const stationUp = _up.set(0, 1, 0).applyQuaternion(stationQ);
    _m.lookAt(_end, _start, stationUp);
    _endQ.setFromRotationMatrix(_m);

    g.ship.group.position.lerpVectors(_start, _end, smooth(k));
    g.ship.group.quaternion.slerpQuaternions(_startQ, _endQ, Math.min(1, k * 2));
    g.ship.velocity.set(0, 0, 0);
    g.ship.throttle = 0;

    _v.set(1, 0.35, 0).applyQuaternion(stationQ).normalize().multiplyScalar(120);
    g.camera.position.copy(this.station.group.position).add(_v);
    g.camera.lookAt(g.ship.group.position);

    if (this.t > 0.75) g.ui.hud.fade(true, true);
    if (k >= 1) this.beginLanding();
  }

  // ---------- Act III: thread the docking tunnel, co-rotating with the doors ----------
  updateEnter(dt) {
    const g = this.game;
    this.t += dt / C.DOCK_ENTER_DURATION;
    const k = Math.min(1, this.t);

    // run the slot axis in station-local space so the ship rolls with the
    // station as it passes the doors (marker z=10 → inside the hub)
    const localZ = THREE.MathUtils.lerp(10, -0.6, smooth(k));
    g.ship.group.position.copy(this.station.group.localToWorld(_v.set(0, 0, localZ)));

    _endQ.copy(this.station.group.quaternion).multiply(_q180);
    if (k < 0.35) g.ship.group.quaternion.slerpQuaternions(_startQ, _endQ, smooth(k / 0.35));
    else g.ship.group.quaternion.copy(_endQ);
    g.ship.velocity.set(0, 0, 0);
    g.ship.throttle = 0.25;

    if (k < 0.5) {
      // gate close-up: the ship slides through the open doors
      this.station.dockingPoint.getWorldPosition(_end);
      _v.set(26, 12, 10).applyQuaternion(this.station.group.quaternion);
      g.camera.position.copy(_end).add(_v);
    } else {
      // just off the aperture, watching the ship recede down the glowing
      // tunnel toward the hangar
      g.camera.position.copy(this.station.group.localToWorld(_v.set(1.2, -0.55, 7.5)));
    }
    g.camera.lookAt(g.ship.group.position);

    if (this.t > 0.82) g.ui.hud.fade(true, true); // black cut to the hangar
    if (k >= 1) this.beginLanding();
  }

  // ---------- cut to the hangar interior ----------
  beginLanding() {
    const g = this.game;
    const st = g.states.station;
    if (!st.bay) st.bay = new DockingBay(g.scene);
    this.bay = st.bay;
    this.bay.show(this.station, g.playerData);
    this.bay.playerShip.group.visible = false; // the real ship lands instead
    g.postfx.sunHidden = true; // no sun flare indoors

    const B = this.bay.group.position;
    const fp = this.bay.focus;
    this.pad = new THREE.Vector3(fp.x, B.y + 1.15, fp.z); // parked-copy rest pose
    this.parkYaw = this.bay.playerShip.group.rotation.y;  // nose toward the opening
    this.fieldX = B.x + OPEN_X;
    // fly-in path: outside the force field → decelerate → hover over the pad
    this.p0 = new THREE.Vector3(B.x + OPEN_X + 32, B.y + 16, B.z + 9);
    this.p1 = new THREE.Vector3(B.x + OPEN_X - 16, B.y + 12, B.z + 4);
    this.p2 = new THREE.Vector3(this.pad.x, B.y + 8.5, this.pad.z);
    this.prevX = this.p0.x;
    this.flyYaw = 0;
    this.touchedDown = false;
    // end the shot exactly where StationState's orbit camera will pick up
    this.camAngle = 0.9;
    this.camPos = new THREE.Vector3(
      fp.x + Math.cos(this.camAngle) * 26,
      fp.y + 6 + Math.sin(this.camAngle * 2.7) * 1.5,
      fp.z + Math.sin(this.camAngle) * 26
    );
    this.lookTarget = new THREE.Vector3(fp.x, fp.y + 1, fp.z);
    this.nextPhase('landing');
  }

  // ---------- Act IV: through the force field, hover-turn, set down ----------
  updateLanding(dt) {
    const g = this.game;
    this.t += dt / C.DOCK_LANDING_DURATION;
    const k = Math.min(1, this.t);
    const ship = g.ship.group;

    if (this.t > 0.04) g.ui.hud.fade(false, true);

    if (k < 0.42) {
      // glide in through the force field, braking toward the hover point
      const s = smooth(k / 0.42);
      const a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s;
      ship.position.set(
        a * this.p0.x + b * this.p1.x + c * this.p2.x,
        a * this.p0.y + b * this.p1.y + c * this.p2.y,
        a * this.p0.z + b * this.p1.z + c * this.p2.z
      );
      _v.set(
        (1 - s) * (this.p1.x - this.p0.x) + s * (this.p2.x - this.p1.x),
        0,
        (1 - s) * (this.p1.z - this.p0.z) + s * (this.p2.z - this.p1.z)
      );
      this.flyYaw = Math.atan2(_v.x, _v.z);
      ship.quaternion.setFromEuler(_euler.set(0, this.flyYaw, 0));
      g.ship.throttle = 0.35;
      // cyan shimmer as the hull crosses the force field
      if (this.prevX >= this.fieldX && ship.position.x < this.fieldX) this.spawnFieldRipple();
      this.prevX = ship.position.x;
    } else if (k < 0.68) {
      // hover over the pad, turning to park nose-out like the other ships
      const u = smooth((k - 0.42) / 0.26);
      ship.position.set(this.p2.x, this.p2.y + Math.sin(this.elapsed * 3) * 0.12, this.p2.z);
      ship.quaternion.setFromEuler(_euler.set(0, THREE.MathUtils.lerp(this.flyYaw, this.parkYaw, u), 0));
      g.ship.throttle = 0.25;
    } else if (k < 0.93) {
      // vertical descent onto the pad, kicking up dust near the deck
      const u = smooth((k - 0.68) / 0.25);
      ship.position.set(this.p2.x, THREE.MathUtils.lerp(this.p2.y, this.pad.y, u), this.p2.z);
      ship.quaternion.setFromEuler(_euler.set(0, this.parkYaw, 0));
      g.ship.throttle = 0.15;
      if (ship.position.y < this.pad.y + 3.5) this.spawnDust(2, 4);
    } else {
      // touchdown: clunk, dust burst, a little suspension dip
      if (!this.touchedDown) {
        this.touchedDown = true;
        g.sfx.play('clamp');
        this.spawnDust(36, 7);
      }
      const u = Math.min(1, (k - 0.93) / 0.07);
      ship.position.set(this.p2.x, this.pad.y - 0.07 * Math.sin(u * Math.PI), this.p2.z);
      ship.quaternion.setFromEuler(_euler.set(0, this.parkYaw, 0));
      g.ship.throttle = 0;
    }

    g.camera.position.copy(this.camPos);
    _v.copy(ship.position);
    if (k > 0.8) _v.lerp(this.lookTarget, smooth((k - 0.8) / 0.2));
    g.camera.lookAt(_v);
    this.bay.update(dt);

    if (k >= 1) {
      g.states.station.angle = this.camAngle; // orbit picks up from this shot
      g.sm.change(g.states.station, { station: this.station, landed: true });
    }
  }

  spawnFieldRipple() {
    const g = this.game;
    const p = g.ship.group.position;
    for (let i = 0; i < 18; i++) {
      _dust.set(this.fieldX, p.y + (Math.random() - 0.5) * 6, p.z + (Math.random() - 0.5) * 8);
      _dustVel.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      _col.setRGB(0.3, 1.6, 2.2);
      g.particles.spawn(_dust, _dustVel, _col, 1.6, 0.4 + Math.random() * 0.3);
    }
  }

  spawnDust(count, spread) {
    const g = this.game;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * spread;
      _dust.set(this.pad.x + Math.cos(a) * r, this.pad.y - 0.65, this.pad.z + Math.sin(a) * r);
      _dustVel.set(Math.cos(a) * (4 + Math.random() * 6), 0.4 + Math.random() * 1.2, Math.sin(a) * (4 + Math.random() * 6));
      _col.setRGB(0.45, 0.47, 0.5);
      g.particles.spawn(_dust, _dustVel, _col, 1.4, 0.5 + Math.random() * 0.4);
    }
  }

  exit() {
    this.station?.setDockingActive(false); // Close the doors!
    this.game.ui.hud.fade(false);
    this.game.sfx.stopBlueDanube();
  }
}
