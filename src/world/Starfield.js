import * as THREE from 'three';
import { mulberry32 } from '../fx/textures.js';

// Shell of ~9000 line-based stars that follows the camera.
// When uWarp increases, stars stretch out radially into long streaks (hyperspace warp).
export class Starfield {
  constructor(count = 9000, radius = 40000) {
    const rnd = mulberry32(42);
    const positions = new Float32Array(count * 2 * 3);
    const colors = new Float32Array(count * 2 * 3);
    const warpDir = new Float32Array(count * 2);

    const palette = [
      [1.0, 1.0, 1.0],
      [0.75, 0.85, 1.0],
      [1.0, 0.9, 0.75],
      [1.0, 0.75, 0.6],
    ];

    for (let i = 0; i < count; i++) {
      // uniform on sphere
      const u = rnd() * 2 - 1;
      const phi = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const px = s * Math.cos(phi) * radius;
      const py = u * radius;
      const pz = s * Math.sin(phi) * radius;

      const col = palette[Math.floor(rnd() * palette.length)];
      const bright = 0.45 + rnd() * 0.55;
      const r = col[0] * bright;
      const g = col[1] * bright;
      const b = col[2] * bright;

      // Leading vertex (closer to outer boundary)
      positions[i * 6] = px;
      positions[i * 6 + 1] = py;
      positions[i * 6 + 2] = pz;
      colors[i * 6] = r;
      colors[i * 6 + 1] = g;
      colors[i * 6 + 2] = b;
      warpDir[i * 2] = 0.0;

      // Trailing vertex
      positions[i * 6 + 3] = px;
      positions[i * 6 + 4] = py;
      positions[i * 6 + 5] = pz;
      colors[i * 6 + 3] = r;
      colors[i * 6 + 4] = g;
      colors[i * 6 + 5] = b;
      warpDir[i * 2 + 1] = 1.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aWarpDir', new THREE.BufferAttribute(warpDir, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uWarp: { value: 0 },
      },
      vertexShader: /* glsl */`
        attribute float aWarpDir;
        uniform float uWarp;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec3 radDir = normalize(position);
          vec3 pos = position;
          
          // Trailing vertex pulls backward to form a radial streak.
          // Tiny base offset of 30.0 ensures lines are always drawn on all GPUs.
          if (aWarpDir > 0.5) {
            pos -= radDir * (30.0 + uWarp * 16000.0);
          }
          
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        void main() {
          gl_FragColor = vec4(vColor, 1.0);
        }
      `,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.LineSegments(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = -9;
  }

  update(cameraPos, warpFactor = 0) {
    this.points.position.copy(cameraPos);
    this.points.material.uniforms.uWarp.value = warpFactor;
  }
}
