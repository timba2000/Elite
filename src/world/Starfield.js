import * as THREE from 'three';
import { mulberry32 } from '../fx/textures.js';

// Shell of ~9000 point stars that follows the camera (infinite-distance feel).
export class Starfield {
  constructor(count = 9000, radius = 40000) {
    const rnd = mulberry32(42);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

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
      positions[i * 3] = s * Math.cos(phi) * radius;
      positions[i * 3 + 1] = u * radius;
      positions[i * 3 + 2] = s * Math.sin(phi) * radius;

      const col = palette[Math.floor(rnd() * palette.length)];
      const bright = 0.35 + rnd() * 0.65;
      colors[i * 3] = col[0] * bright;
      colors[i * 3 + 1] = col[1] * bright;
      colors[i * 3 + 2] = col[2] * bright;
      sizes[i] = 1.0 + Math.pow(rnd(), 3) * 3.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: /* glsl */`
        attribute float aSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * a, 1.0);
        }
      `,
      vertexColors: true,
      transparent: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = -9;
  }

  update(cameraPos) {
    this.points.position.copy(cameraPos);
  }
}
