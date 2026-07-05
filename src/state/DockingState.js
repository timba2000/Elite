import * as THREE from 'three';
import { C } from '../constants.js';

const _start = new THREE.Vector3();
const _end = new THREE.Vector3();
const _startQ = new THREE.Quaternion();
const _endQ = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _camPos = new THREE.Vector3();

// Final glide into the station. Two ways in: the docking computer autopilot
// (long cinematic approach) or the station tractor after a manual capture.
export class DockingState {
  constructor(game) {
    this.game = game;
  }

  enter({ station, manual }) {
    const g = this.game;
    this.station = station;
    this.station.setDockingActive(true); // Open the doors!
    this.t = 0;
    this.manual = !!manual;
    this.duration = this.manual ? C.DOCK_TRACTOR_DURATION : C.DOCK_DURATION;
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
    this.startVel = g.ship.velocity.clone();
  }

  update(dt) {
    const g = this.game;
    this.t += dt / this.duration;
    const k = Math.min(1, this.t);
    const ease = k * k * (3 - 2 * k); // smoothstep

    // target: the tractor pulls a manual capture through the aperture into the
    // hub; the autopilot glides to the marker in front of it
    if (this.manual) _end.copy(this.station.group.position);
    else this.station.dockingPoint.getWorldPosition(_end);

    // Calculate heading pointing into the port, aligned with the station's rotating Y-axis (doors)
    const stationQ = this.station.group.quaternion;
    const stationUp = new THREE.Vector3(0, 1, 0).applyQuaternion(stationQ);
    _m.lookAt(_end, _start, stationUp);
    _endQ.setFromRotationMatrix(_m);

    g.ship.group.position.lerpVectors(_start, _end, ease);
    g.ship.group.quaternion.slerpQuaternions(_startQ, _endQ, Math.min(1, k * 2));
    g.ship.velocity.set(0, 0, 0);
    g.ship.throttle = Math.max(0, 0.4 * (1 - k));

    // Dynamic Cinematic Camera Cuts
    if (this.manual) {
      const side = new THREE.Vector3(1, 0.35, 0)
        .applyQuaternion(this.station.group.quaternion).normalize().multiplyScalar(120);
      g.camera.position.copy(this.station.group.position).add(side);
      g.camera.lookAt(g.ship.group.position);
    } else {
      if (k < 0.45) {
        // Act I: Follow chase view trailing the ship
        const back = new THREE.Vector3(0, 6, -26).applyQuaternion(g.ship.group.quaternion);
        g.camera.position.copy(g.ship.group.position).add(back);
        g.camera.lookAt(_end);
      } else if (k < 0.8) {
        // Act II: Gate close-up, panning fly-by as ship enters slot
        const gateOffset = new THREE.Vector3(26, 12, 10).applyQuaternion(stationQ);
        g.camera.position.copy(_end).add(gateOffset);
        g.camera.lookAt(g.ship.group.position);
      } else {
        // Act III: Interior landing bay hangar view
        const bayOffset = new THREE.Vector3(-12, 10, -25).applyQuaternion(stationQ);
        g.camera.position.copy(_end).add(bayOffset);
        g.camera.lookAt(g.ship.group.position);
      }
    }

    g.world.update(dt, g.camera.position);
    g.particles.update(dt);
    g.explosions.update(dt);
    g.engineTrail?.update(dt, g.ship.throttle, false, g.ship.velocity);

    if (this.t > 0.8) g.ui.hud.fade(true);
    if (this.t >= 1) {
      g.sm.change(g.states.station, { station: this.station });
    }
  }

  exit() {
    this.station?.setDockingActive(false); // Close the doors!
    this.game.ui.hud.fade(false);
    this.game.sfx.stopBlueDanube();
  }
}
