import * as THREE from 'three';
import { C } from '../constants.js';

const _seg = new THREE.Vector3();
const _toT = new THREE.Vector3();
const _closest = new THREE.Vector3();

// Pooled laser bolts for both sides. Hit test: swept segment vs bounding sphere.
export class LaserPool {
  constructor(scene, max = 80) {
    this.scene = scene;
    this.pool = [];
    const geo = new THREE.BoxGeometry(0.14, 0.14, 6);
    const matPlayer = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 3.0, 0.8) });
    const matPirate = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.35, 0.25) });
    const matPolice = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.8, 3.0) });
    for (let i = 0; i < max; i++) {
      const mesh = new THREE.Mesh(geo, matPlayer);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        mesh, matPlayer, matPirate, matPolice,
        vel: new THREE.Vector3(),
        prev: new THREE.Vector3(),
        life: 0, owner: null, damage: 0,
      });
    }
  }

  fire(origin, dir, owner, damage, inheritVel) {
    const b = this.pool.find((x) => x.life <= 0);
    if (!b) return;
    this.sfx?.play(owner === 'player' ? 'laser' : 'laserEnemy');
    b.owner = owner;
    b.damage = damage;
    b.life = C.LASER_LIFE;
    b.mesh.material = owner === 'player' ? b.matPlayer : (owner === 'police' ? b.matPolice : b.matPirate);
    b.mesh.position.copy(origin);
    b.prev.copy(origin);
    b.vel.copy(dir).normalize().multiplyScalar(C.LASER_SPEED);
    if (inheritVel) b.vel.addScaledVector(inheritVel, 0.7);
    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    b.mesh.visible = true;
  }

  // targets: [{ entity, position, radius, side }] — side is 'player'|'pirate'
  // onHit(entity, bolt, hitPoint)
  update(dt, targets, onHit) {
    for (const b of this.pool) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.prev.copy(b.mesh.position);
      b.mesh.position.addScaledVector(b.vel, dt);
      if (b.life <= 0) { b.mesh.visible = false; continue; }

      for (const t of targets) {
        if (t.side === b.owner) continue;
        if (segmentSphereHit(b.prev, b.mesh.position, t.position, t.radius)) {
          b.life = 0;
          b.mesh.visible = false;
          onHit(t, b, b.mesh.position);
          break;
        }
      }
    }
  }

  clear() {
    for (const b of this.pool) { b.life = 0; b.mesh.visible = false; }
  }
}

function segmentSphereHit(a, bPos, center, radius) {
  _seg.copy(bPos).sub(a);
  const segLen2 = _seg.lengthSq();
  _toT.copy(center).sub(a);
  let t = segLen2 > 0 ? _toT.dot(_seg) / segLen2 : 0;
  t = Math.max(0, Math.min(1, t));
  _closest.copy(a).addScaledVector(_seg, t);
  return _closest.distanceToSquared(center) <= radius * radius;
}
