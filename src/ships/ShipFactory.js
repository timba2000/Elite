import * as THREE from 'three';
import { grungeHullTexture } from '../fx/textures.js';
import { radialGlowTexture } from '../fx/textures.js';

// Procedural ship meshes. Convention: nose points +Z, engines at -Z, up +Y.

const engineGlowTex = radialGlowTexture(64, 'rgba(180,220,255,1)', 'rgba(80,140,255,0)');

// The player's trader. `wear` 1 = rust bucket, drops as hull upgrades are bought.
// cargoTier 1..4 adds/extends side cargo pods. engineTier scales nozzle glow.
export function buildTrader({ wear = 1, cargoTier = 1, engineTier = 1 } = {}) {
  const group = new THREE.Group();

  const { map, roughnessMap } = grungeHullTexture('#8a8d92', '#b3552e', wear, 7);
  const hullMat = new THREE.MeshStandardMaterial({
    map, roughnessMap, metalness: 0.45, roughness: 0.75,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x33363c, metalness: 0.6, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a1a2a, metalness: 0.2, roughness: 0.15,
    emissive: new THREE.Color(0x2a7a9a), emissiveIntensity: 0.9,
  });

  // Main hull: elongated box
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 6.5), hullMat);
  group.add(hull);

  // Tapered nose
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.15, 2.6, 6), hullMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 4.4;
  group.add(nose);

  // Cockpit canopy strip
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.4), glassMat);
  canopy.position.set(0, 0.85, 2.2);
  group.add(canopy);

  // Cargo pods on the flanks — more/longer pods with cargo upgrades
  const podCount = Math.min(cargoTier, 3);
  const podLen = 2.2 + cargoTier * 0.5;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < podCount; i++) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, podLen), hullMat);
      pod.position.set(side * 1.75, -0.25 + (i % 2) * 0.9 - (i > 1 ? 0.9 : 0), -0.6 - (i > 0 ? 0.3 : 0));
      group.add(pod);
    }
  }

  // Dorsal fin
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.5, 2.0), darkMat);
  fin.position.set(0, 1.4, -1.8);
  group.add(fin);

  // Engine block + nozzles
  const block = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 1.2), darkMat);
  block.position.z = -3.6;
  group.add(block);

  const nozzles = [];
  const glowSprites = [];
  const nozzleGeo = new THREE.CylinderGeometry(0.42, 0.55, 0.9, 10);
  for (let side = -1; side <= 1; side += 2) {
    const noz = new THREE.Mesh(nozzleGeo, darkMat);
    noz.rotation.x = Math.PI / 2;
    noz.position.set(side * 0.75, 0, -4.3);
    group.add(noz);

    const glowMat = new THREE.SpriteMaterial({
      map: engineGlowTex, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true,
      color: new THREE.Color(1.2 + engineTier * 0.3, 1.5 + engineTier * 0.4, 3.0),
    });
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(side * 0.75, 0, -4.8);
    glow.scale.setScalar(0.1);
    group.add(glow);

    const marker = new THREE.Object3D();
    marker.position.set(side * 0.75, 0, -4.8);
    group.add(marker);
    nozzles.push(marker);
    glowSprites.push(glow);
  }

  // Laser hardpoints under the nose
  const hardpoints = [];
  for (let side = -1; side <= 1; side += 2) {
    const hp = new THREE.Object3D();
    hp.position.set(side * 0.9, -0.5, 3.4);
    group.add(hp);
    hardpoints.push(hp);
  }

  return { group, nozzles, glowSprites, hardpoints, boundingRadius: 4.5 };
}

// Pirate raider: angular, aggressive, dark red/black.
export function buildPirate(seed = 1) {
  const group = new THREE.Group();

  const { map, roughnessMap } = grungeHullTexture('#3a3235', '#7a1f1f', 0.8, 40 + seed);
  const hullMat = new THREE.MeshStandardMaterial({ map, roughnessMap, metalness: 0.6, roughness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x1a1418, metalness: 0.7, roughness: 0.4,
    emissive: new THREE.Color(0x8a1010), emissiveIntensity: 0.4,
  });

  // Fuselage: flattened wedge
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 4.6), hullMat);
  group.add(body);

  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.8, 2.0, 4), hullMat);
  nose.rotation.x = Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.z = 3.2;
  group.add(nose);

  // Swept wings
  for (let side = -1; side <= 1; side += 2) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 1.7), accentMat);
    wing.position.set(side * 1.9, 0, -0.9);
    wing.rotation.y = side * 0.5;
    group.add(wing);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 1.2), hullMat);
    tip.position.set(side * 3.0, 0, -1.55);
    tip.rotation.y = side * 0.5;
    group.add(tip);
  }

  // Engine glow
  const glowMat = new THREE.SpriteMaterial({
    map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, color: new THREE.Color(3.0, 0.8, 0.5),
  });
  const glow = new THREE.Sprite(glowMat);
  glow.position.z = -2.6;
  glow.scale.setScalar(1.4);
  group.add(glow);

  const nozzle = new THREE.Object3D();
  nozzle.position.z = -2.6;
  group.add(nozzle);

  const hardpoint = new THREE.Object3D();
  hardpoint.position.set(0, -0.35, 2.8);
  group.add(hardpoint);

  return { group, nozzles: [nozzle], glowSprites: [glow], hardpoints: [hardpoint], boundingRadius: 3.5 };
}

// Glowing cargo pod dropped by destroyed pirates.
export function buildCargoPod() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a6a2a, metalness: 0.5, roughness: 0.5,
    emissive: new THREE.Color(0xffaa33), emissiveIntensity: 1.6,
  });
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), mat);
  return mesh;
}
