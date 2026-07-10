import * as THREE from 'three';
import { grungeHullTexture } from '../fx/textures.js';

// Rotating torus-ring station with hub, spokes, antenna and blinking nav lights.
export class Station {
  constructor(planetDef, index) {
    this.planetDef = planetDef;
    this.id = planetDef.id + '-station';
    this.name = planetDef.name + ' STATION';

    this.group = new THREE.Group();
    // park the station beside its planet, sunward-ish so it's lit. The
    // standoff is capped for giant planets — 2.8 radii flung gas-giant
    // stations thousands of units out where nobody could spot them —
    // then nudged clear of ring annuli and moon orbit paths.
    let standoff = Math.min(planetDef.radius * 2.8, planetDef.radius + 350) + 120;
    const clear = 150;
    const bands = [];
    if (planetDef.rings) {
      bands.push([planetDef.radius * planetDef.rings.inner - clear,
                  planetDef.radius * planetDef.rings.outer + clear]);
    }
    for (const m of planetDef.moons || []) {
      bands.push([m.orbitRadius - m.radius - clear, m.orbitRadius + m.radius + clear]);
    }
    bands.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const b of bands) {
      if (merged.length && b[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], b[1]);
      } else merged.push([...b]);
    }
    for (const [lo, hi] of merged) {
      if (standoff > lo && standoff < hi) {
        // drop below the band when that still clears the surface, else go above
        standoff = lo >= planetDef.radius + 100 ? lo : hi;
      }
    }
    const offset = planetDef.position.clone().normalize().multiplyScalar(-standoff);
    offset.y += 40;
    this.group.position.copy(planetDef.position).add(offset);

    const { map, roughnessMap, normalMap } = grungeHullTexture('#7a7d85', '#8a5a3a', 0.6, 100 + index);
    const hullMat = new THREE.MeshStandardMaterial({
      map, roughnessMap, normalMap, normalScale: new THREE.Vector2(0.7, 0.7),
      metalness: 0.55, roughness: 0.7,
    });
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

    // Hollow Rectangular Hub: composed of 4 thick walls and a rear wall to make a docking tunnel
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.5, 6.0), hullMat);
    leftWall.position.set(-2.65, 0, 0);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.5, 6.0), hullMat);
    rightWall.position.set(2.65, 0, 0);
    const topWall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.8, 6.0), hullMat);
    topWall.position.set(0, 1.85, 0);
    const bottomWall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.8, 6.0), hullMat);
    bottomWall.position.set(0, -1.85, 0);
    const rearWall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.9, 0.4), hullMat);
    rearWall.position.set(0, 0, -2.8);

    this.group.add(leftWall);
    this.group.add(rightWall);
    this.group.add(topWall);
    this.group.add(bottomWall);
    this.group.add(rearWall);

    // Glowing rectangular border outlining the docking bay opening
    this.apertureMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 2.8) });
    this.apertureLocalZ = 3.05;

    const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.9, 0.1), this.apertureMat);
    rimL.position.set(-2.25, 0, 3.01);
    const rimR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.9, 0.1), this.apertureMat);
    rimR.position.set(2.25, 0, 3.01);
    const rimT = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.12, 0.1), this.apertureMat);
    rimT.position.set(0, 1.45, 3.01);
    const rimB = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.12, 0.1), this.apertureMat);
    rimB.position.set(0, -1.45, 3.01);

    this.group.add(rimL);
    this.group.add(rimR);
    this.group.add(rimT);
    this.group.add(rimB);

    // Two rectangular metal doors blocking the aperture (slide behind left/right walls)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a3d45, metalness: 0.7, roughness: 0.4 });
    this.leftDoor = new THREE.Mesh(new THREE.BoxGeometry(2.35, 2.9, 0.25), doorMat);
    this.rightDoor = new THREE.Mesh(new THREE.BoxGeometry(2.35, 2.9, 0.25), doorMat);
    this.leftDoor.position.set(-1.175, 0, 3.1);
    this.rightDoor.position.set(1.175, 0, 3.1);
    this.group.add(this.leftDoor);
    this.group.add(this.rightDoor);
    this.doorOpenFactor = 0;

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

    // Cast/receive the photo-tier sun shadows (spokes across the ring, the
    // doors shading the docking tunnel).
    this.group.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });

    this.group.scale.setScalar(2.2); // stations read better a bit bigger
    this.time = 0;
    this.radius = 45; // approach/collision radius in world units
    this.dockingActive = false;
  }

  // World-space aperture centre and outward normal for the manual approach.
  // The station spins about its own z, so the frame is stable frame-to-frame.
  getDockingFrame(outPos, outNormal) {
    outNormal.set(0, 0, 1).applyQuaternion(this.group.quaternion).normalize();
    outPos.copy(this.group.position).addScaledVector(outNormal, this.apertureLocalZ * this.group.scale.x);
  }

  setDockingActive(on) {
    if (this.dockingActive === on) return;
    this.dockingActive = on;
    if (!on) this.apertureMat.color.setRGB(0.2, 2.2, 2.8);
  }

  update(dt) {
    this.time += dt;
    this.group.rotation.z += 0.06 * dt;
    for (const { mesh, phase } of this.navLights) {
      const on = Math.sin(this.time * 3 + phase) > 0.4;
      mesh.visible = on;
    }
    if (this.dockingActive) {
      const p = 2.0 + Math.sin(this.time * 6) * 1.3;
      this.apertureMat.color.setRGB(0.3, p, 0.9);
    }

    // Animate sliding doors
    const targetOpen = this.dockingActive ? 1.0 : 0.0;
    this.doorOpenFactor = THREE.MathUtils.lerp(this.doorOpenFactor, targetOpen, 3.5 * dt);
    this.leftDoor.position.x = -1.175 - (2.25 * this.doorOpenFactor);
    this.rightDoor.position.x = 1.175 + (2.25 * this.doorOpenFactor);
  }
}
