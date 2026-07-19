import * as THREE from 'three';
import { SYSTEM } from './SystemDef.js';
import { Starfield } from './Starfield.js';
import { Nebula } from './Nebula.js';
import { Sun } from './Sun.js';
import { Planet } from './Planet.js';
import { Station } from './Station.js';
import { StationTraffic } from './StationTraffic.js';
import { Graphics } from '../fx/Graphics.js';

// Builds and owns everything in the star system.
export class WorldScene {
  constructor(scene, renderer) {
    this.scene = scene;

    this.nebula = new Nebula();
    scene.add(this.nebula.mesh);

    this.starfield = new Starfield();
    scene.add(this.starfield.points);

    scene.add(new THREE.AmbientLight(0x1a2030, 0.7));
    scene.add(new THREE.HemisphereLight(0x303a50, 0x14100c, 0.5));

    // Photo tier: a sun-tracking directional light whose only job is soft
    // shadows on ships and stations near the player (an orthographic shadow
    // box follows the camera — point-light shadows can't span a star system).
    this.shadowLight = new THREE.DirectionalLight(0xfff2e0, 0.7);
    this.shadowLight.castShadow = true;
    this.shadowLight.shadow.mapSize.set(2048, 2048);
    const sc = this.shadowLight.shadow.camera;
    sc.near = 1; sc.far = 1000;
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80;
    this.shadowLight.shadow.bias = -0.0003;
    this.shadowLight.shadow.normalBias = 1.5; // hulls are thick; kills acne
    this.shadowLight.visible = Graphics.photo;
    scene.add(this.shadowLight);
    scene.add(this.shadowLight.target);

    // One-time PMREM capture of the nebula sky: gives every PBR hull real
    // reflections (space, not a void) at zero per-frame cost.
    if (renderer) this.buildEnvironment(renderer);

    this.suns = [];
    this.planets = [];
    this.stations = [];
    this.traffic = new StationTraffic(scene);
    this.rebuild();
  }

  buildEnvironment(renderer) {
    const envScene = new THREE.Scene();
    const envNebula = new Nebula(100);
    // base-quality sky only: the photo tier's HDR hero stars would reflect
    // off smooth panel lines as a storm of specular glints
    envNebula.mat.uniforms.uQuality.value = 0.0;
    envScene.add(envNebula.mesh);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(envScene, 0.035, 1, 1000);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();
    envNebula.mesh.geometry.dispose();
    envNebula.mat.dispose();
  }

  setQuality() {
    this.nebula.setQuality();
    for (const p of this.planets) p.setQuality();
    this.shadowLight.visible = Graphics.photo;
  }

  rebuild() {
    if (this.suns) {
      for (const s of this.suns) this.scene.remove(s.group);
    }
    if (this.planets) {
      for (const p of this.planets) this.scene.remove(p.group);
    }
    if (this.stations) {
      for (const s of this.stations) this.scene.remove(s.group);
    }
    this.traffic?.clear();

    this.suns = [];
    if (SYSTEM.suns && SYSTEM.suns.length > 0) {
      SYSTEM.suns.forEach((sDef) => {
        const sun = new Sun(sDef.radius, sDef.color);
        sun.group.position.copy(sDef.position);
        this.scene.add(sun.group);
        this.suns.push(sun);
      });
    } else {
      const sun = new Sun(SYSTEM.sunRadius);
      this.scene.add(sun.group);
      this.suns.push(sun);
    }

    this.planets = [];
    this.stations = [];
    SYSTEM.planets.forEach((def, i) => {
      const planet = new Planet(def);
      this.scene.add(planet.group);
      this.planets.push(planet);

      const station = new Station(def, i);
      this.scene.add(station.group);
      this.stations.push(station);
    });
  }

  // Nav targets the player can cycle through (stations are the dockables).
  getNavTargets() {
    const targets = [];
    for (const p of this.planets) {
      targets.push({
        id: p.def.id, name: p.def.name, type: 'planet',
        object: p.group, radius: p.radius, dockable: false,
      });
    }
    for (const s of this.stations) {
      targets.push({
        id: s.id, name: s.name, type: 'station',
        object: s.group, radius: s.radius, dockable: true, station: s,
      });
    }
    return targets;
  }

  getStation(id) {
    return this.stations.find((s) => s.id === id) || this.stations[0];
  }

  update(dt, cameraPos, warpFactor = 0) {
    this.nebula.update(cameraPos);
    this.starfield.update(cameraPos, warpFactor);
    const sunPos = this.suns[0]?.group.position || new THREE.Vector3(0, 0, 0);
    for (const p of this.planets) p.update(dt, sunPos);
    this.traffic.update(dt, this.stations, cameraPos); // sets door requests
    for (const s of this.stations) s.update(dt);

    // keep the shadow box centred on the action, lit from the sun's bearing
    if (this.shadowLight.visible) {
      const sunDir = sunPos.clone().sub(cameraPos).normalize();
      this.shadowLight.position.copy(cameraPos).addScaledVector(sunDir, 500);
      this.shadowLight.target.position.copy(cameraPos);
      this.shadowLight.target.updateMatrixWorld();
    }
  }
}
