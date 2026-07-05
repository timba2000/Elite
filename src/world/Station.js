import * as THREE from 'three';
import { grungeHullTexture } from '../fx/textures.js';

// Rotating torus-ring station with hub, spokes, antenna and blinking nav lights.
export class Station {
  constructor(planetDef, index) {
    this.planetDef = planetDef;
    this.id = planetDef.id + '-station';
    this.name = planetDef.name + ' STATION';

    this.group = new THREE.Group();
    // park the station beside its planet, sunward-ish so it's lit
    const offset = planetDef.position.clone().normalize().multiplyScalar(-(planetDef.radius * 2.8 + 120));
    offset.y += 40;
    this.group.position.copy(planetDef.position).add(offset);

    const { map, roughnessMap } = grungeHullTexture('#7a7d85', '#8a5a3a', 0.6, 100 + index);
    const hullMat = new THREE.MeshStandardMaterial({ map, roughnessMap, metalness: 0.55, roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.6, roughness: 0.6 });

    // Ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 3.2, 12, 48), hullMat);
    this.group.add(ring);

    // Spokes
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 13), darkMat);
      const a = (i / 4) * Math.PI * 2;
      spoke.position.set(Math.cos(a) * 7, Math.sin(a) * 7, 0);
      spoke.lookAt(this.group.position.clone().add(new THREE.Vector3(Math.cos(a) * 14, Math.sin(a) * 14, 0)));
      spoke.rotation.set(0, 0, a + Math.PI / 2, 'XYZ');
      spoke.rotateX(Math.PI / 2);
      this.group.add(spoke);
    }

    // Hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 6, 16), hullMat);
    hub.rotation.x = Math.PI / 2;
    this.group.add(hub);

    // Docking aperture glow on hub face
    const apertureMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 2.8) });
    const aperture = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.6, 24), apertureMat);
    aperture.position.z = 3.05;
    this.group.add(aperture);

    // Antenna
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 10, 6), darkMat);
    antenna.position.z = -7;
    antenna.rotation.x = Math.PI / 2;
    this.group.add(antenna);

    // Blinking nav lights around the ring
    this.navLights = [];
    const lightGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.3) });
      const l = new THREE.Mesh(lightGeo, mat);
      const a = (i / 8) * Math.PI * 2;
      l.position.set(Math.cos(a) * 17.2, Math.sin(a) * 17.2, 0);
      this.group.add(l);
      this.navLights.push({ mesh: l, phase: i * 0.7 });
    }

    // Local work-lights so the station reads even far from the sun
    const workLight = new THREE.PointLight(0xffe0b0, 2.0, 320, 0);
    workLight.position.set(0, 0, 25);
    this.group.add(workLight);

    // Docking point marker (in front of hub face)
    this.dockingPoint = new THREE.Object3D();
    this.dockingPoint.position.set(0, 0, 10);
    this.group.add(this.dockingPoint);

    this.group.scale.setScalar(2.2); // stations read better a bit bigger
    this.time = 0;
    this.radius = 45; // approach/collision radius in world units
  }

  update(dt) {
    this.time += dt;
    this.group.rotation.z += 0.06 * dt;
    for (const { mesh, phase } of this.navLights) {
      const on = Math.sin(this.time * 3 + phase) > 0.4;
      mesh.visible = on;
    }
  }
}
