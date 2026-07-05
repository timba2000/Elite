import * as THREE from 'three';
import { radialGlowTexture } from '../fx/textures.js';

const _vel = new THREE.Vector3();
const _col = new THREE.Color();

// Kill FX: particle burst + expanding shockwave ring + light flash + debris.
export class Explosions {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles; // shared ParticleSystem

    this.ringTex = radialGlowTexture(128, 'rgba(255,200,140,0.0)', 'rgba(255,160,80,0)');
    // ring texture: bright edge — draw manually
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(255,190,120,1)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.filter = 'blur(6px)';
    ctx.stroke();
    this.ringTex = new THREE.CanvasTexture(c);

    this.rings = [];
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.ringTex, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, opacity: 0,
      });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      scene.add(s);
      this.rings.push({ sprite: s, life: 0 });
    }

    this.flash = new THREE.PointLight(0xffa050, 0, 600, 1.2);
    scene.add(this.flash);
    this.flashLife = 0;

    this.debris = [];
    const dGeo = new THREE.BoxGeometry(0.7, 0.5, 0.9);
    const dMat = new THREE.MeshStandardMaterial({ color: 0x2a2020, roughness: 0.9 });
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(dGeo, dMat);
      m.visible = false;
      scene.add(m);
      this.debris.push({ mesh: m, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0 });
    }
  }

  spawn(pos, scale = 1) {
    // small scale = laser-hit spark: just a few particles, no ring/flash/debris
    const isSpark = scale < 0.5;
    const count = isSpark ? 10 : 80;
    if (!isSpark) this.sfx?.play('explosion');
    // particle burst
    for (let i = 0; i < count; i++) {
      _vel.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize().multiplyScalar((14 + Math.random() * 46) * scale);
      const heat = Math.random();
      _col.setRGB(2.5, 0.5 + heat * 1.4, 0.2 + heat * 0.4);
      this.particles.spawn(pos, _vel, _col, (1.6 + Math.random() * 2.2) * scale, 0.6 + Math.random() * 0.5);
    }
    if (isSpark) return;
    // ring
    const ring = this.rings.find((r) => r.life <= 0);
    if (ring) {
      ring.life = 0.7;
      ring.sprite.visible = true;
      ring.sprite.position.copy(pos);
      ring.sprite.scale.setScalar(2 * scale);
      ring.sprite.material.opacity = 1;
      ring.growth = 90 * scale;
    }
    // flash
    this.flash.position.copy(pos);
    this.flash.intensity = 800 * scale;
    this.flashLife = 0.22;
    // debris
    let spawned = 0;
    for (const d of this.debris) {
      if (d.life > 0 || spawned >= 4) continue;
      spawned++;
      d.life = 1.6;
      d.mesh.visible = true;
      d.mesh.position.copy(pos);
      d.vel.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize().multiplyScalar(18 * scale);
      d.spin.set(Math.random() * 5, Math.random() * 5, Math.random() * 5);
    }
  }

  update(dt) {
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      r.sprite.scale.addScalar(r.growth * dt);
      r.sprite.material.opacity = Math.max(0, r.life / 0.7);
      if (r.life <= 0) r.sprite.visible = false;
    }
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      this.flash.intensity = Math.max(0, this.flash.intensity - dt * 4000);
      if (this.flashLife <= 0) this.flash.intensity = 0;
    }
    for (const d of this.debris) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      if (d.life <= 0) d.mesh.visible = false;
    }
  }
}
