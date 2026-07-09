import * as THREE from 'three';
import { buildPlayerShip } from './ShipFactory.js';

// Renders other commanders' ships from Presence peer snapshots: interpolates
// ~150ms in the past between updates so 10Hz networking looks like flight.
const RENDER_DELAY = 150; // ms

const _pa = new THREE.Vector3();
const _pb = new THREE.Vector3();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();

export class RemoteShips {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map(); // peerId -> { group, ship, shipId, tag }
  }

  removePeer(id) {
    const m = this.meshes.get(id);
    if (!m) return;
    this.scene.remove(m.group);
    m.tag.material.map.dispose();
    m.tag.material.dispose();
    this.meshes.delete(id);
  }

  clear() {
    for (const id of [...this.meshes.keys()]) this.removePeer(id);
  }

  ensureMesh(id, peer) {
    let m = this.meshes.get(id);
    if (m && m.shipId !== peer.ship) { this.removePeer(id); m = null; }
    if (m) return m;
    const group = new THREE.Group();
    const ship = buildPlayerShip(peer.ship, {});
    group.add(ship.group);
    const tag = makeNameTag(peer.name);
    tag.position.set(0, 14, 0);
    group.add(tag);
    this.scene.add(group);
    m = { group, ship, shipId: peer.ship, tag };
    this.meshes.set(id, m);
    return m;
  }

  update(presence, camera) {
    if (!presence) return;
    const renderT = Date.now() - RENDER_DELAY;

    for (const [id, peer] of presence.peers) {
      const snaps = peer.snaps;
      if (!snaps.length) continue;
      const m = this.ensureMesh(id, peer);

      // find the two snapshots straddling renderT
      let a = snaps[0], b = snaps[snaps.length - 1];
      for (let i = 0; i < snaps.length - 1; i++) {
        if (snaps[i].t <= renderT && snaps[i + 1].t >= renderT) {
          a = snaps[i]; b = snaps[i + 1];
          break;
        }
      }
      let alpha = a === b ? 1 : (renderT - a.t) / Math.max(1, b.t - a.t);
      alpha = Math.max(0, Math.min(1.25, alpha)); // small extrapolation allowed
      _pa.fromArray(a.p); _pb.fromArray(b.p);
      m.group.position.lerpVectors(_pa, _pb, alpha);
      if (alpha > 1) {
        // ran out of data: coast on last known velocity
        m.group.position.addScaledVector(_pb.fromArray(b.v), (alpha - 1) * (b.t - a.t) / 1000);
      }
      _qa.fromArray(a.q); _qb.fromArray(b.q);
      m.group.quaternion.slerpQuaternions(_qa, _qb, Math.min(1, alpha));

      // name tag: readable at range, fades when very far
      const dist = camera.position.distanceTo(m.group.position);
      const s = Math.max(18, dist * 0.045);
      m.tag.scale.set(s, s * 0.25, 1);
      m.tag.material.opacity = dist > 30000 ? 0.35 : 0.9;
    }

    // despawn meshes whose peers vanished
    for (const id of [...this.meshes.keys()]) {
      if (!presence.peers.has(id)) this.removePeer(id);
    }
  }
}

function makeNameTag(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '700 52px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = `CMDR ${name.toUpperCase()}`;
  ctx.strokeStyle = 'rgba(0, 20, 30, 0.9)';
  ctx.lineWidth = 8;
  ctx.strokeText(label, 256, 64);
  ctx.fillStyle = '#7fe8ff';
  ctx.fillText(label, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false,
  }));
  sprite.renderOrder = 999;
  return sprite;
}
