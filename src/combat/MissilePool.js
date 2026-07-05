import * as THREE from 'three';

// Homing missiles launched by the player that track active hostile targets.
export class MissilePool {
  constructor(scene, max = 8) {
    this.scene = scene;
    this.pool = [];
    this.sfx = null;

    // Build the missile mesh (cylindrical body with red engine glow)
    const group = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.18, 2.2, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x888c95, metalness: 0.8, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2; // align along local Z axis
    group.add(body);

    const exhaustGeo = new THREE.ConeGeometry(0.2, 0.6, 8);
    const exhaustMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.2, 0.1) });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.z = -1.2;
    exhaust.rotation.x = -Math.PI / 2;
    group.add(exhaust);

    for (let i = 0; i < max; i++) {
      const mesh = group.clone();
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        mesh,
        vel: new THREE.Vector3(),
        target: null,
        life: 0,
        damage: 0,
        speed: 190,
        turnRate: 3.8, // turns tight enough to hit but can be outmaneuvered
      });
    }
  }

  fire(origin, dir, target, damage, inheritVel) {
    const m = this.pool.find((x) => x.life <= 0);
    if (!m) return;
    
    m.target = target;
    m.damage = damage;
    m.life = 6.0; // 6 seconds fuel lifetime
    m.mesh.position.copy(origin);
    m.vel.copy(dir).normalize().multiplyScalar(m.speed);
    if (inheritVel) m.vel.addScaledVector(inheritVel, 0.6);
    m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), m.vel.clone().normalize());
    m.mesh.visible = true;
  }

  update(dt, onHit) {
    const toTarget = new THREE.Vector3();
    const axis = new THREE.Vector3();

    for (const m of this.pool) {
      if (m.life <= 0) continue;
      m.life -= dt;

      if (m.life <= 0) {
        m.mesh.visible = false;
        m.target = null;
        continue;
      }

      // Homing logic: nudge velocity vector towards the target
      if (m.target && m.target.alive) {
        toTarget.copy(m.target.position).sub(m.mesh.position).normalize();
        const currentDir = m.vel.clone().normalize();
        const dot = currentDir.dot(toTarget);

        if (dot < 0.999 && dot > -0.999) {
          const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
          const maxTurn = m.turnRate * dt;
          const turnAngle = Math.min(angle, maxTurn);

          axis.crossVectors(currentDir, toTarget).normalize();
          currentDir.applyAxisAngle(axis, turnAngle);
          m.vel.copy(currentDir).multiplyScalar(m.speed);
        } else if (dot <= -0.999) {
          // opposite direction, push slightly to Y axis to start turn
          axis.set(0, 1, 0);
          currentDir.applyAxisAngle(axis, 0.05);
          m.vel.copy(currentDir).multiplyScalar(m.speed);
        }
      }

      m.mesh.position.addScaledVector(m.vel, dt);

      // Rotate to point in velocity direction
      if (m.vel.lengthSq() > 0.01) {
        m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), m.vel.clone().normalize());
      }

      // Check collision
      if (m.target && m.target.alive) {
        const dist = m.mesh.position.distanceTo(m.target.position);
        const hitRadius = m.target.boundingRadius + 2.5;
        if (dist < hitRadius) {
          m.life = 0;
          m.mesh.visible = false;
          onHit(m.target, m);
          m.target = null;
        }
      }
    }
  }

  clear() {
    for (const m of this.pool) {
      m.life = 0;
      m.mesh.visible = false;
      m.target = null;
    }
  }
}
