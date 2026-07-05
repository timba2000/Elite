import * as THREE from 'three';
import { SYSTEM } from './SystemDef.js';
import { Starfield } from './Starfield.js';
import { Nebula } from './Nebula.js';
import { Sun } from './Sun.js';
import { Planet } from './Planet.js';
import { Station } from './Station.js';

// Builds and owns everything in the star system.
export class WorldScene {
  constructor(scene) {
    this.scene = scene;

    this.nebula = new Nebula();
    scene.add(this.nebula.mesh);

    this.starfield = new Starfield();
    scene.add(this.starfield.points);

    this.sun = new Sun(SYSTEM.sunRadius);
    scene.add(this.sun.group);
    this.sunPos = new THREE.Vector3(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x1a2030, 0.7));
    scene.add(new THREE.HemisphereLight(0x303a50, 0x14100c, 0.5));

    this.planets = [];
    this.stations = [];
    SYSTEM.planets.forEach((def, i) => {
      const planet = new Planet(def);
      scene.add(planet.group);
      this.planets.push(planet);

      const station = new Station(def, i);
      scene.add(station.group);
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
    for (const p of this.planets) p.update(dt, this.sunPos);
    for (const s of this.stations) s.update(dt);
  }
}
