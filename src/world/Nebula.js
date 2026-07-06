import * as THREE from 'three';
import { Graphics } from '../fx/Graphics.js';

// Inverted skysphere with FBM noise nebula. Static; follows camera.
// Photo tier turns it into an HDR skybox: extra fine-structure octaves plus
// embedded hero stars whose tints follow blackbody colour temperature, bright
// enough (>1.0) to feed the bloom pass.
export class Nebula {
  constructor(radius = 45000) {
    const geo = new THREE.SphereGeometry(radius, 32, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uColorA: { value: new THREE.Color(0x2a0a4a) }, // deep purple
        uColorB: { value: new THREE.Color(0x0a3a45) }, // teal
        uColorC: { value: new THREE.Color(0x521430) }, // magenta ember
        uQuality: { value: Graphics.photo ? 1.0 : 0.0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vDir;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        uniform float uQuality;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float noise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z);
        }
        float fbm(vec3 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.1 + vec3(13.7);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 d = vDir;
          float n1 = fbm(d * 3.0 + vec3(7.1, 2.3, 4.9));
          float n2 = fbm(d * 5.0 + vec3(1.7, 9.2, 3.1));
          // Large-scale lobes masking where each nebula colour lives
          float lobeA = smoothstep(0.45, 0.8, fbm(d * 1.4 + vec3(3.0)));
          float lobeB = smoothstep(0.5, 0.85, fbm(d * 1.7 + vec3(11.0)));
          float lobeC = smoothstep(0.55, 0.9, fbm(d * 1.2 + vec3(23.0)));

          vec3 col = vec3(0.004, 0.005, 0.01); // near-black space
          col += uColorA * lobeA * n1 * 0.55;
          col += uColorB * lobeB * n2 * 0.5;
          col += uColorC * lobeC * n1 * n2 * 0.8;

          // faint milky band
          float band = pow(max(0.0, 1.0 - abs(d.y + 0.15 * sin(d.x * 3.0))), 6.0);
          col += vec3(0.05, 0.055, 0.075) * band * n2;

          if (uQuality > 0.5) {
            // fine wisps of structure inside the bright lobes
            float fine = fbm(d * 11.0 + vec3(31.7, 5.3, 17.9));
            col += (uColorA * lobeA + uColorB * lobeB + uColorC * lobeC)
                   * fine * fine * 0.45;
            col *= 1.25;

            // hero stars: sparse points on a 3D cell grid over the sky
            // direction, tinted by blackbody temperature (M-red → O-blue)
            // and pushed past 1.0 so they bloom like real point sources
            vec3 g = normalize(d) * 70.0;
            vec3 id = floor(g);
            vec3 f = fract(g);
            float h = hash(id);
            if (h > 0.80) {
              vec3 sp = vec3(hash(id + 1.3), hash(id + 2.7), hash(id + 4.1));
              sp = 0.15 + sp * 0.7; // keep clear of cell edges
              float dist = length(f - sp);
              float star = pow(smoothstep(0.14, 0.0, dist), 3.0);
              float temp = hash(id + 9.2);
              vec3 tint = mix(vec3(1.0, 0.52, 0.28),   // cool M dwarf
                              vec3(0.62, 0.74, 1.0),   // hot O/B star
                              temp);
              tint = mix(tint, vec3(1.0), 0.3);
              col += tint * star * (1.2 + 3.0 * hash(id + 6.6));
            }
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mat = mat;
  }

  setQuality() {
    this.mat.uniforms.uQuality.value = Graphics.photo ? 1.0 : 0.0;
  }

  update(cameraPos) {
    this.mesh.position.copy(cameraPos);
  }
}
