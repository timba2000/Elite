import * as THREE from 'three';

// Pooled additive particle system used for engine trails (and reused by
// Explosions for burst particles). World-space THREE.Points with per-particle
// life, colour and size.
export class ParticleSystem {
  constructor(scene, max = 600) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    this.sizes = new Float32Array(max);
    this.velocities = new Float32Array(max * 3);
    this.life = new Float32Array(max);      // remaining
    this.lifeMax = new Float32Array(max);
    this.head = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));

    const mat = new THREE.ShaderMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: /* glsl */`
        attribute float aSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (240.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.05, d);
          gl_FragColor = vec4(vColor * a, a);
        }
      `,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(pos, vel, color, size, life) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    this.positions[i * 3] = pos.x;
    this.positions[i * 3 + 1] = pos.y;
    this.positions[i * 3 + 2] = pos.z;
    this.velocities[i * 3] = vel.x;
    this.velocities[i * 3 + 1] = vel.y;
    this.velocities[i * 3 + 2] = vel.z;
    this.colors[i * 3] = color.r;
    this.colors[i * 3 + 1] = color.g;
    this.colors[i * 3 + 2] = color.b;
    this.sizes[i] = size;
    this.life[i] = life;
    this.lifeMax[i] = life;
  }

  update(dt) {
    const geo = this.points.geometry;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.sizes[i] = 0; continue; }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.lifeMax[i]);
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      // fade + shrink handled via colour/size decay
      this.colors[i * 3] *= (0.86 + t * 0.14);
      this.colors[i * 3 + 1] *= (0.86 + t * 0.14);
      this.colors[i * 3 + 2] *= (0.86 + t * 0.14);
      this.sizes[i] *= (0.94 + t * 0.05);
      if (this.life[i] <= 0) this.sizes[i] = 0;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }
}

const _pos = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _back = new THREE.Vector3();
const _col = new THREE.Color();

// Engine exhaust for one ship: emits from each nozzle scaled by throttle.
export class EngineTrail {
  constructor(particles, ship) {
    this.particles = particles;
    this.ship = ship; // { nozzles, glowSprites, group }
    this.accum = 0;
  }

  update(dt, throttle, boosting, shipVelocity) {
    // throb the nozzle glows
    const glowScale = 0.3 + throttle * 1.3 + (boosting ? 1.0 : 0);
    for (const g of this.ship.glowSprites) {
      g.scale.setScalar(glowScale * (0.92 + Math.random() * 0.16));
    }
    if (throttle <= 0.02 && !boosting) return;

    const rate = 30 * throttle + (boosting ? 60 : 0);
    this.accum += rate * dt;
    _back.set(0, 0, -1).applyQuaternion(this.ship.group.quaternion);

    while (this.accum >= 1) {
      this.accum -= 1;
      for (const noz of this.ship.nozzles) {
        noz.getWorldPosition(_pos);
        _pos.x += (Math.random() - 0.5) * 0.3;
        _pos.y += (Math.random() - 0.5) * 0.3;
        _pos.z += (Math.random() - 0.5) * 0.3;
        _vel.copy(_back).multiplyScalar(14 + Math.random() * 8);
        _vel.x += (Math.random() - 0.5) * 3;
        _vel.y += (Math.random() - 0.5) * 3;
        _vel.z += (Math.random() - 0.5) * 3;
        if (shipVelocity) _vel.addScaledVector(shipVelocity, 0.4);
        if (boosting) _col.setRGB(0.5, 1.2, 2.6);
        else _col.setRGB(2.2, 1.2 + Math.random() * 0.5, 0.5);
        this.particles.spawn(_pos, _vel, _col, boosting ? 2.4 : 1.7, 0.4 + Math.random() * 0.25);
      }
    }
  }
}
