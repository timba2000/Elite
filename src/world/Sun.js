import * as THREE from 'three';
import { radialGlowTexture } from '../fx/textures.js';

export class Sun {
  constructor(radius = 300, colorHex = '#ffeedd') {
    this.group = new THREE.Group();
    const col = new THREE.Color(colorHex);
    const emissiveCol = new THREE.Color(col.r * 3.0, col.g * 2.7, col.b * 2.2);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshBasicMaterial({ color: emissiveCol })
    );
    this.group.add(core);

    // Layered glow sprites — bloom finishes the lens-flare look
    const glows = [
      { tex: radialGlowTexture(256, `rgba(${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)},0.9)`, 'rgba(255,200,120,0)'), scale: radius * 4.5 },
      { tex: radialGlowTexture(256, `rgba(${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)},0.28)`, 'rgba(255,140,60,0)'), scale: radius * 8 },
      { tex: radialGlowTexture(256, `rgba(${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)},0.10)`, 'rgba(255,100,40,0)'), scale: radius * 14 },
    ];
    this.sprites = glows.map(({ tex, scale }) => {
      const mat = new THREE.SpriteMaterial({
        map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
      });
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(scale);
      this.group.add(s);
      return s;
    });

    // The system's key light
    this.light = new THREE.PointLight(col, 2.4, 0, 0);
    this.group.add(this.light);
  }
}
