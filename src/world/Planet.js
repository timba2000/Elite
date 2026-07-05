import * as THREE from 'three';

const NOISE_GLSL = /* glsl */`
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
      p = p * 2.02 + vec3(19.1);
      a *= 0.5;
    }
    return v;
  }
`;

// Shader-textured planet with day/night terminator, optional city lights,
// polar caps, gas-giant banding, and an additive fresnel atmosphere shell.
export class Planet {
  constructor(def) {
    this.def = def;
    this.group = new THREE.Group();
    this.group.position.copy(def.position);
    this.radius = def.radius;
    this.spinRate = def.gas ? 0.02 : 0.008;

    const surfMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uOcean: { value: new THREE.Color(def.palette[0]) },
        uLand: { value: new THREE.Color(def.palette[1]) },
        uHigh: { value: new THREE.Color(def.palette[2]) },
        uSeed: { value: def.seed * 7.31 },
        uGas: { value: def.gas ? 1.0 : 0.0 },
        uCity: { value: def.inhabited ? 1.0 : 0.0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vNormalW;
        varying vec3 vNormalO;
        void main() {
          vNormalO = normalize(position);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: NOISE_GLSL + /* glsl */`
        varying vec3 vNormalW;
        varying vec3 vNormalO;
        uniform vec3 uSunDir;
        uniform vec3 uOcean;
        uniform vec3 uLand;
        uniform vec3 uHigh;
        uniform float uSeed;
        uniform float uGas;
        uniform float uCity;

        void main() {
          vec3 p = vNormalO;
          vec3 col;

          if (uGas > 0.5) {
            // Banded gas giant: stretch noise along y
            float bands = fbm(vec3(p.x * 1.5, p.y * 7.0 + uSeed, p.z * 1.5));
            float swirl = fbm(p * 3.0 + vec3(uSeed));
            float t = fract(p.y * 3.5 + bands * 0.6 + swirl * 0.2);
            col = mix(uOcean, uLand, smoothstep(0.2, 0.5, t));
            col = mix(col, uHigh, smoothstep(0.75, 0.95, bands));
          } else {
            float terrain = fbm(p * 3.5 + vec3(uSeed));
            float detail = fbm(p * 9.0 + vec3(uSeed * 2.7));
            float h = terrain * 0.75 + detail * 0.25;
            col = mix(uOcean, uLand, smoothstep(0.42, 0.55, h));
            col = mix(col, uHigh, smoothstep(0.62, 0.78, h));
            // polar caps
            float pole = smoothstep(0.78, 0.92, abs(p.y) + detail * 0.08);
            col = mix(col, vec3(0.92, 0.95, 1.0), pole);
          }

          // day/night terminator
          float daylight = clamp(dot(normalize(vNormalW), normalize(uSunDir)), -1.0, 1.0);
          float lit = smoothstep(-0.12, 0.25, daylight);
          vec3 dayCol = col * (0.15 + 0.95 * max(daylight, 0.0));

          // night side city lights
          float cities = 0.0;
          if (uCity > 0.5 && uGas < 0.5) {
            float spots = noise(p * 60.0 + vec3(uSeed * 3.3));
            float clusters = fbm(p * 6.0 + vec3(uSeed * 1.9));
            cities = step(0.82, spots) * smoothstep(0.5, 0.7, clusters);
          }
          vec3 nightCol = col * 0.02 + vec3(1.0, 0.8, 0.45) * cities * 1.6;

          gl_FragColor = vec4(mix(nightCol, dayCol, lit), 1.0);
        }
      `,
    });

    this.surface = new THREE.Mesh(new THREE.SphereGeometry(def.radius, 48, 48), surfMat);
    this.group.add(this.surface);

    // Atmosphere: fresnel rim, BackSide shell slightly larger
    const atmoMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(def.atmosphere) },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: /* glsl */`
        varying vec3 vNormalW;
        varying vec3 vPosW;
        void main() {
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vPosW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vNormalW;
        varying vec3 vPosW;
        uniform vec3 uColor;
        uniform vec3 uSunDir;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vPosW);
          // BackSide: normals face away; use -normal for rim math
          float rim = pow(1.0 - abs(dot(viewDir, normalize(-vNormalW))), 3.0);
          float sun = 0.35 + 0.65 * max(dot(normalize(-vNormalW), normalize(uSunDir)), 0.0);
          gl_FragColor = vec4(uColor * rim * sun * 1.4, rim);
        }
      `,
    });
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(def.radius * 1.035, 48, 48), atmoMat);
    this.group.add(this.atmo);

    this.surfMat = surfMat;
    this.atmoMat = atmoMat;

    this.moons = [];
    if (def.moons) {
      def.moons.forEach((mDef) => {
        const moonGroup = new THREE.Group();
        const moonMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(mDef.color ?? '#8a8d94'),
          roughness: 0.9,
          metalness: 0.05
        });
        const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(mDef.radius, 16, 16), moonMat);
        moonMesh.position.set(mDef.orbitRadius, 0, 0);
        moonGroup.add(moonMesh);
        moonGroup.rotation.y = Math.random() * Math.PI * 2;
        moonGroup.rotation.x = (Math.random() - 0.5) * 0.2;
        this.group.add(moonGroup);
        this.moons.push({
          group: moonGroup,
          mesh: moonMesh,
          orbitSpeed: mDef.orbitSpeed ?? 0.05,
          spinSpeed: mDef.spinSpeed ?? 0.1
        });
      });
    }
  }

  update(dt, sunPos) {
    this.surface.rotation.y += this.spinRate * dt;
    const dir = sunPos.clone().sub(this.group.position).normalize();
    this.surfMat.uniforms.uSunDir.value.copy(dir);
    this.atmoMat.uniforms.uSunDir.value.copy(dir);

    for (const m of this.moons) {
      m.group.rotation.y += m.orbitSpeed * dt;
      m.mesh.rotation.y += m.spinSpeed * dt;
    }
  }
}
