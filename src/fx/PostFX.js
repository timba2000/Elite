import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CinematicShader } from './CinematicPass.js';
import { Graphics } from './Graphics.js';
import { C } from '../constants.js';

const _sunView = new THREE.Vector3();
const _sunNdc = new THREE.Vector3();

// Post chain: Render → SSAO (photo) → Bloom (standard+) → Cinematic god-rays/
// flare/grain (photo) → Output. Quality tiers just flip pass.enabled, so
// switching in the menu is instant and low keeps the raw forward render.
export class PostFX {
  constructor(renderer, scene, camera) {
    this.camera = camera;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    this.ssao.kernelRadius = C.SSAO_KERNEL_RADIUS;
    this.ssao.minDistance = C.SSAO_MIN_DISTANCE;
    this.ssao.maxDistance = C.SSAO_MAX_DISTANCE;
    this.composer.addPass(this.ssao);

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      C.BLOOM_STRENGTH, C.BLOOM_RADIUS, C.BLOOM_THRESHOLD
    );
    this.composer.addPass(this.bloom);

    this.cine = new ShaderPass(CinematicShader);
    this.cine.uniforms.uAspect.value = window.innerWidth / window.innerHeight;
    this.composer.addPass(this.cine);

    this.composer.addPass(new OutputPass());

    this.time = 0;
    this.setQuality(Graphics.quality);
  }

  setQuality(q) {
    this.ssao.enabled = q === 'photo';
    this.bloom.enabled = q !== 'low';
    this.cine.enabled = q === 'photo';
  }

  // Feed the cinematic pass the sun's screen position each frame; rays and
  // flare fade out as the sun leaves the view or slips behind the camera.
  update(dt, sunWorldPos, sunColor) {
    if (!this.cine.enabled) return;
    this.time += dt;
    const u = this.cine.uniforms;
    u.uTime.value = this.time;

    _sunView.copy(sunWorldPos).applyMatrix4(this.camera.matrixWorldInverse);
    if (_sunView.z >= 0) { // behind the camera (view looks down -Z)
      u.uSunVis.value = 0;
      return;
    }
    _sunNdc.copy(sunWorldPos).project(this.camera);
    u.uSunScreen.value.x = _sunNdc.x * 0.5 + 0.5;
    u.uSunScreen.value.y = _sunNdc.y * 0.5 + 0.5;
    const edge = Math.max(Math.abs(_sunNdc.x), Math.abs(_sunNdc.y));
    u.uSunVis.value = THREE.MathUtils.clamp(1.6 - edge, 0, 1);
    if (sunColor) {
      u.uSunColor.value.x = sunColor.r;
      u.uSunColor.value.y = sunColor.g;
      u.uSunColor.value.z = sunColor.b;
    }
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.ssao.setSize(w, h);
    this.cine.uniforms.uAspect.value = w / h;
  }

  render() {
    this.composer.render();
  }
}
