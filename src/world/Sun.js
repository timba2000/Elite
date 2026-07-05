import * as THREE from 'three';
import { radialGlowTexture } from '../fx/textures.js';

export class Sun {
  constructor(radius = 300) {
    this.group = new THREE.Group();

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.7, 2.2) })
    );
    this.group.add(core);

    // Layered glow sprites — bloom finishes the lens-flare look
    const glows = [
      { tex: radialGlowTexture(256, 'rgba(255,240,210,0.9)', 'rgba(255,200,120,0)'), scale: radius * 4.5 },
      { tex: radialGlowTexture(256, 'rgba(255,200,140,0.28)', 'rgba(255,140,60,0)'), scale: radius * 8 },
      { tex: radialGlowTexture(256, 'rgba(255,160,90,0.10)', 'rgba(255,100,40,0)'), scale: radius * 14 },
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
    this.light = new THREE.PointLight(0xfff2dd, 2.4, 0, 0);
    this.group.add(this.light);
  }
}
