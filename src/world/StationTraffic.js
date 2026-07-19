import * as THREE from 'three';
import { buildTrader, buildInterceptor, buildPolice } from '../ships/ShipFactory.js';

const _v = new THREE.Vector3();
const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
// arrivals fly nose-into-the-port: station -z with the station's own roll
const _q180 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

const ACTIVE_RANGE = 1500;  // only simulate traffic near the camera
const DESPAWN_RANGE = 2500; // clean up ships the player has left behind
const MAX_PER_STATION = 3;
const CORRIDOR_Z = 30;      // station-local z where arrivals join the slot axis
const HOLD_Z = 14;          // arrivals hold here while the doors open
const INSIDE_Z = -0.5;      // spawn/despawn point inside the hub
const TUNNEL_SPEED = 6.5;   // local units/s along the slot axis (~14 world)

// Ambient dock traffic: NPC ships that leave and arrive through the station
// slot on their own schedules. They request the doors, thread the tunnel
// co-rotating with the station, and are solid to the player — so a manual
// docking run now has to share the lane.
export class StationTraffic {
  constructor(scene) {
    this.scene = scene;
    this.ships = [];
    this.timers = new Map(); // station id -> seconds until the next movement
  }

  clear() {
    for (const s of this.ships) this.scene.remove(s.group);
    this.ships = [];
    this.timers.clear();
  }

  remove(s) {
    const i = this.ships.indexOf(s);
    if (i >= 0) {
      this.scene.remove(s.group);
      this.ships.splice(i, 1);
    }
  }

  // the slot only admits one ship at a time
  tunnelBusy(st) {
    return this.ships.some((s) => s.st === st
      && (s.phase === 'exitTunnel' || s.phase === 'enterTunnel'));
  }

  buildShip() {
    const roll = Math.random();
    if (roll < 0.55) {
      return buildTrader({
        wear: 0.3 + Math.random() * 0.6,
        cargoTier: 1 + Math.floor(Math.random() * 3),
        baseColor: ['#7a8d6a', '#8a6a8d', '#8a8d92'][Math.floor(Math.random() * 3)],
        rustColor: '#5a4a2a',
        seed: Math.floor(Math.random() * 90),
        scale: 0.85 + Math.random() * 0.3,
      });
    }
    if (roll < 0.8) return buildInterceptor({ wear: 0.4 + Math.random() * 0.5 });
    return buildPolice(Math.floor(Math.random() * 50));
  }

  spawn(st, cameraPos) {
    const built = this.buildShip();
    const s = {
      st,
      group: built.group,
      boundingRadius: built.boundingRadius,
      hull: 40,
      velocity: new THREE.Vector3(),
      prevPos: new THREE.Vector3(),
      z: 0,     // slot-axis position while in the corridor (station-local)
      dir: new THREE.Vector3(),
      speed: 0,
      phase: '',
    };
    // departures start hidden inside the hub; don't materialize one while the
    // player is right on top of the station, and never two in the hub at once
    const hubFree = !this.ships.some((o) => o.st === st
      && (o.phase === 'waitDoors' || o.phase === 'exitTunnel'));
    if (Math.random() < 0.5 && hubFree && cameraPos.distanceTo(st.group.position) > 40) {
      s.phase = 'waitDoors';
      s.z = INSIDE_Z;
      s.group.position.copy(st.group.localToWorld(_v.set(0, 0, s.z)));
      s.group.quaternion.copy(st.group.quaternion);
    } else {
      s.phase = 'cruiseIn';
      _dir.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.2, 1.5).normalize();
      s.group.position.copy(st.group.position).addScaledVector(_dir, 550 + Math.random() * 250);
    }
    s.prevPos.copy(s.group.position);
    this.scene.add(s.group);
    this.ships.push(s);
  }

  update(dt, stations, cameraPos) {
    for (const st of stations) {
      st.trafficDoorOpen = false;
      if (st.group.position.distanceTo(cameraPos) > ACTIVE_RANGE) continue;
      let t = (this.timers.get(st.id) ?? 3 + Math.random() * 6) - dt;
      if (t <= 0) {
        if (this.ships.filter((s) => s.st === st).length < MAX_PER_STATION) {
          this.spawn(st, cameraPos);
        }
        t = 12 + Math.random() * 16;
      }
      this.timers.set(st.id, t);
    }

    for (let i = this.ships.length - 1; i >= 0; i--) {
      const s = this.ships[i];
      const st = s.st;
      if (s.group.position.distanceTo(cameraPos) > DESPAWN_RANGE) {
        this.remove(s);
        continue;
      }
      s.prevPos.copy(s.group.position);

      switch (s.phase) {
        case 'waitDoors':
          st.trafficDoorOpen = true;
          s.group.position.copy(st.group.localToWorld(_v.set(0, 0, s.z)));
          s.group.quaternion.copy(st.group.quaternion);
          if (st.doorOpenFactor > 0.9 && !this.tunnelBusy(st)) s.phase = 'exitTunnel';
          break;

        case 'exitTunnel':
          if (s.z < 6) st.trafficDoorOpen = true; // hold the doors until clear
          s.z += TUNNEL_SPEED * dt;
          s.group.position.copy(st.group.localToWorld(_v.set(0, 0, s.z)));
          s.group.quaternion.copy(st.group.quaternion);
          if (s.z >= CORRIDOR_Z) {
            s.phase = 'cruiseOut';
            s.dir.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5, 1).normalize();
            s.speed = TUNNEL_SPEED * st.group.scale.x;
          }
          break;

        case 'cruiseOut':
          s.speed = Math.min(70, s.speed + 18 * dt);
          s.group.position.addScaledVector(s.dir, s.speed * dt);
          _m.lookAt(_target.copy(s.group.position).add(s.dir), s.group.position, _up);
          _q.setFromRotationMatrix(_m);
          s.group.quaternion.slerp(_q, Math.min(1, 3 * dt));
          if (s.group.position.distanceTo(st.group.position) > 800) this.remove(s);
          break;

        case 'cruiseIn': {
          _target.copy(st.group.localToWorld(_v.set(0, 0, CORRIDOR_Z)));
          _dir.copy(_target).sub(s.group.position);
          const dist = _dir.length();
          const speed = THREE.MathUtils.clamp(dist * 0.35, 10, 65);
          if (dist > 1e-3) _dir.divideScalar(dist);
          s.group.position.addScaledVector(_dir, Math.min(dist, speed * dt));
          _m.lookAt(_target, s.group.position, _up);
          _q.setFromRotationMatrix(_m);
          s.group.quaternion.slerp(_q, Math.min(1, 3 * dt));
          if (dist < 3) { s.phase = 'hold'; s.z = CORRIDOR_Z; }
          break;
        }

        case 'hold': {
          st.trafficDoorOpen = true;
          // creep to the hold point, matching the station's roll while waiting
          s.z = Math.max(HOLD_Z, s.z - 3.5 * dt);
          s.group.position.copy(st.group.localToWorld(_v.set(0, 0, s.z)));
          _q.copy(st.group.quaternion).multiply(_q180);
          s.group.quaternion.slerp(_q, Math.min(1, 4 * dt));
          if (s.z <= HOLD_Z && st.doorOpenFactor > 0.9 && !this.tunnelBusy(st)) {
            s.phase = 'enterTunnel';
          }
          break;
        }

        case 'enterTunnel':
          st.trafficDoorOpen = true;
          s.z -= TUNNEL_SPEED * dt;
          s.group.position.copy(st.group.localToWorld(_v.set(0, 0, s.z)));
          s.group.quaternion.copy(st.group.quaternion).multiply(_q180);
          if (s.z <= INSIDE_Z) { this.remove(s); continue; }
          break;
      }

      s.velocity.copy(s.group.position).sub(s.prevPos).divideScalar(Math.max(dt, 1e-4));
    }
  }
}
