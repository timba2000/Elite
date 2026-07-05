import * as THREE from 'three';
import { C } from '../constants.js';

const _start = new THREE.Vector3();
const _end = new THREE.Vector3();
const _startQ = new THREE.Quaternion();
const _endQ = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _camPos = new THREE.Vector3();

// Scripted autopilot glide into the station. Cosmetic, no fail state.
export class DockingState {
  constructor(game) {
    this.game = game;
  }

  enter({ station }) {
    const g = this.game;
    this.station = station;
    this.t = 0;
    g.input.exitPointerLock();
    g.ui.hud.setPrompt('');
    g.ui.hud.toast(`DOCKING CLEARANCE GRANTED — ${station.name}`);

    _start.copy(g.ship.group.position);
    _startQ.copy(g.ship.group.quaternion);
    this.startVel = g.ship.velocity.clone();

    // wide side-on camera to watch the glide
    const side = new THREE.Vector3(1, 0.35, 0)
      .applyQuaternion(station.group.quaternion).normalize().multiplyScalar(120);
    _camPos.copy(station.group.position).add(side);
    g.camera.position.copy(_camPos);
  }

  update(dt) {
    const g = this.game;
    this.t += dt / C.DOCK_DURATION;
    const k = Math.min(1, this.t);
    const ease = k * k * (3 - 2 * k); // smoothstep

    // target: station hub
    this.station.dockingPoint.getWorldPosition(_end);
    _m.lookAt(_end, _start, _up);
    _endQ.setFromRotationMatrix(_m);

    g.ship.group.position.lerpVectors(_start, _end, ease);
    g.ship.group.quaternion.slerpQuaternions(_startQ, _endQ, Math.min(1, k * 2));
    g.ship.velocity.set(0, 0, 0);
    g.ship.throttle = Math.max(0, 0.4 * (1 - k));

    g.camera.lookAt(g.ship.group.position);

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
    this.game.ui.hud.fade(false);
  }
}
