import * as THREE from 'three';
import { grungeHullTexture } from '../fx/textures.js';
import { radialGlowTexture } from '../fx/textures.js';

// Procedural ship meshes. Convention: nose points +Z, engines at -Z, up +Y.

const engineGlowTex = radialGlowTexture(64, 'rgba(180,220,255,1)', 'rgba(80,140,255,0)');

// PBR grunge hull: colour + roughness + baked normal relief (panel lines,
// rivets and scorch read as geometry under the key light).
function hullMaterial(baseColor, rustColor, wear, seed, metalness, roughness) {
  const { map, roughnessMap, normalMap } = grungeHullTexture(baseColor, rustColor, wear, seed);
  return new THREE.MeshStandardMaterial({
    map, roughnessMap, normalMap, normalScale: new THREE.Vector2(0.6, 0.6),
    metalness, roughness,
  });
}

// Every factory mesh takes part in the photo-tier sun shadows (sprites don't).
function enableShadows(group) {
  group.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
}

// Player hull dispatcher: one entry point per buyable ship.
export function buildPlayerShip(shipId, opts = {}) {
  switch (shipId) {
    case 'courier':
      return buildTrader({ ...opts, cargoTier: 1, baseColor: '#7aa0b8', rustColor: '#3a5a72', scale: 0.78, seed: 12 });
    case 'freighter':
      return buildTrader({ ...opts, cargoTier: Math.max(opts.cargoTier ?? 1, 3), baseColor: '#9a8f6a', rustColor: '#6a4a2a', scale: 1.38, seed: 21 });
    case 'interceptor':
      return buildInterceptor(opts);
    default:
      return buildTrader(opts);
  }
}

// The player's trader — a battered YT-series-style light freighter: saucer
// hull, twin forward mandibles, offset cockpit tube, wide rear engine bar.
// `wear` 1 = rust bucket, drops as hull upgrades are bought.
// cargoTier 1..4 adds/extends belly cargo pods. engineTier scales nozzle glow.
export function buildTrader({
  wear = 1, cargoTier = 1, engineTier = 1,
  baseColor = '#8a8d92', rustColor = '#b3552e', scale = 1, seed = 7,
} = {}) {
  const group = new THREE.Group();

  const hullMat = hullMaterial(baseColor, rustColor, wear, seed, 0.45, 0.75);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x33363c, metalness: 0.6, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a1a2a, metalness: 0.2, roughness: 0.15,
    emissive: new THREE.Color(0x2a7a9a), emissiveIntensity: 0.45,
  });

  // Saucer hull: flattened sphere
  const saucer = new THREE.Mesh(new THREE.SphereGeometry(2.9, 28, 18), hullMat);
  saucer.scale.set(1, 0.36, 1.05);
  group.add(saucer);

  // Equator rim band (tube squashed vertically — scale applies pre-rotation)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.78, 0.24, 8, 40), darkMat);
  rim.scale.set(1, 1.05, 0.5);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  // Raised central hub, top and belly
  const hubTop = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.35, 0.55, 20), hullMat);
  hubTop.position.y = 0.85;
  group.add(hubTop);
  const hubBottom = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.85, 0.45, 20), hullMat);
  hubBottom.position.y = -0.85;
  group.add(hubBottom);

  // Twin forward mandibles: tapered square prongs with a gap between them
  const prongGeo = new THREE.CylinderGeometry(0.3, 0.62, 3.0, 4, 1);
  prongGeo.rotateY(Math.PI / 4);
  prongGeo.rotateX(Math.PI / 2);
  const tipGeo = new THREE.CylinderGeometry(0.24, 0.34, 0.55, 4, 1);
  tipGeo.rotateY(Math.PI / 4);
  tipGeo.rotateX(Math.PI / 2);
  for (let side = -1; side <= 1; side += 2) {
    const prong = new THREE.Mesh(prongGeo, hullMat);
    prong.position.set(side * 0.85, -0.05, 3.3);
    group.add(prong);
    const tip = new THREE.Mesh(tipGeo, darkMat);
    tip.position.set(side * 0.85, -0.05, 4.95);
    group.add(tip);
  }

  // Offset cockpit tube on the starboard flank, glass cone at the tip
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 2.6, 12), hullMat);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(1.7, 0.18, 1.6);
  group.add(tube);
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.42, 0.22, 12), darkMat);
  frame.rotation.x = Math.PI / 2;
  frame.position.set(1.7, 0.18, 2.95);
  group.add(frame);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.38, 0.6, 12), glassMat);
  canopy.rotation.x = Math.PI / 2;
  canopy.position.set(1.7, 0.18, 3.32);
  group.add(canopy);

  // Radar dish on the port side of the hub
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 8), darkMat);
  mast.position.set(-1.1, 1.15, -0.4);
  group.add(mast);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.08, 0.22, 14), darkMat);
  dish.rotation.x = -Math.PI / 3;
  dish.position.set(-1.1, 1.4, -0.35);
  group.add(dish);

  // Surface greebles: vents and conduit boxes breaking up the disc
  const greebles = [
    [0.9, 0.72, 1.1, 0.5, 0.16, 0.7], [-1.5, 0.6, 0.9, 0.6, 0.14, 0.5],
    [0.2, 0.78, -1.5, 0.9, 0.18, 0.6], [-0.8, 0.66, -1.9, 0.45, 0.15, 0.8],
    [1.8, 0.5, -1.2, 0.5, 0.14, 0.9],
  ];
  for (const [x, y, z, w, h, d] of greebles) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkMat);
    g.position.set(x, y, z);
    group.add(g);
  }

  // Belly cargo pods — more/longer pods with cargo upgrades
  const podCount = Math.min(cargoTier + 1, 4);
  const podLen = 1.6 + cargoTier * 0.4;
  const podGeo = new THREE.CylinderGeometry(0.38, 0.38, podLen, 10);
  podGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < podCount; i++) {
    const pod = new THREE.Mesh(podGeo, hullMat);
    pod.position.set((i - (podCount - 1) / 2) * 0.85, -1.0, -0.4);
    group.add(pod);
  }

  // Rear engine housing + wide glow bar (row of sprites reads as one slit)
  const housing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.6, 0.9), darkMat);
  housing.position.set(0, 0, -2.8);
  group.add(housing);

  const nozzles = [];
  const glowSprites = [];
  for (const x of [-0.85, 0, 0.85]) {
    const glowMat = new THREE.SpriteMaterial({
      map: engineGlowTex, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true,
      color: new THREE.Color(1.2 + engineTier * 0.3, 1.5 + engineTier * 0.4, 3.0),
    });
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(x, 0, -3.3);
    glow.scale.setScalar(0.1);
    group.add(glow);

    const marker = new THREE.Object3D();
    marker.position.set(x, 0, -3.3);
    group.add(marker);
    nozzles.push(marker);
    glowSprites.push(glow);
  }

  // Laser hardpoints at the mandible tips
  const hardpoints = [];
  for (let side = -1; side <= 1; side += 2) {
    const hp = new THREE.Object3D();
    hp.position.set(side * 0.85, -0.15, 4.6);
    group.add(hp);
    hardpoints.push(hp);
  }

  group.scale.setScalar(scale);
  enableShadows(group);
  return { group, nozzles, glowSprites, hardpoints, boundingRadius: 4.6 * scale };
}

// The Fer-de-Lance: a civilian gun platform — sleek wedge, twin cannon.
export function buildInterceptor({ wear = 1, engineTier = 1 } = {}) {
  const group = new THREE.Group();

  const hullMat = hullMaterial('#5a626e', '#b3742e', wear * 0.6, 33, 0.7, 0.4);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14171c, metalness: 0.8, roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a1a2a, metalness: 0.2, roughness: 0.15,
    emissive: new THREE.Color(0xff8830), emissiveIntensity: 0.9,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 5.6), hullMat);
  group.add(body);

  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.9, 2.4, 5), hullMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 3.9;
  group.add(nose);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.5), glassMat);
  canopy.position.set(0, 0.62, 1.1);
  group.add(canopy);

  for (let side = -1; side <= 1; side += 2) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.12, 1.9), darkMat);
    wing.position.set(side * 2.0, -0.15, -0.9);
    wing.rotation.y = side * 0.35;
    group.add(wing);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 6), darkMat);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(side * 3.1, -0.15, 0.1);
    group.add(cannon);
  }

  const nozzles = [];
  const glowSprites = [];
  for (let side = -1; side <= 1; side += 2) {
    const glowMat = new THREE.SpriteMaterial({
      map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true,
      color: new THREE.Color(2.6, 1.2 + engineTier * 0.3, 0.4),
    });
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(side * 0.6, 0, -3.4);
    glow.scale.setScalar(0.1);
    group.add(glow);
    glowSprites.push(glow);

    const marker = new THREE.Object3D();
    marker.position.set(side * 0.6, 0, -3.4);
    group.add(marker);
    nozzles.push(marker);
  }

  const hardpoints = [];
  for (let side = -1; side <= 1; side += 2) {
    const hp = new THREE.Object3D();
    hp.position.set(side * 3.1, -0.15, 1.0);
    group.add(hp);
    hardpoints.push(hp);
  }

  enableShadows(group);
  return { group, nozzles, glowSprites, hardpoints, boundingRadius: 4.8 };
}

// Pirate raider: angular, aggressive, dark red/black.
// Scavenged pirate paint jobs — picked by hull seed so no two ships match.
const PIRATE_PAINT = [
  { base: '#3a3235', rust: '#7a1f1f', glow: [3.0, 0.8, 0.5] }, // ash & blood
  { base: '#2d3a2f', rust: '#6a8a1f', glow: [1.8, 2.6, 0.5] }, // swamp raider
  { base: '#3a2d40', rust: '#7a3a8a', glow: [2.4, 0.8, 2.8] }, // void purple
  { base: '#3f3a30', rust: '#b8861f', glow: [3.0, 1.8, 0.3] }, // rust & brass
  { base: '#2e343c', rust: '#1f6a8a', glow: [0.6, 1.8, 3.0] }, // cold steel
  { base: '#40302a', rust: '#c94f1f', glow: [3.2, 1.2, 0.2] }, // ember
];
const paintFor = (seed) => PIRATE_PAINT[Math.abs(seed) % PIRATE_PAINT.length];

export function buildPirate(seed = 1) {
  const group = new THREE.Group();

  const paint = paintFor(seed);
  const hullMat = hullMaterial(paint.base, paint.rust, 0.8, 40 + seed, 0.6, 0.6);
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x1a1418, metalness: 0.7, roughness: 0.4,
    emissive: new THREE.Color(paint.rust), emissiveIntensity: 0.35,
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

  // scavenged extras bolted on by seed so silhouettes differ within a wing
  if (seed % 3 === 0) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), accentMat);
    antenna.position.set(0.3, 0.9, -0.6);
    group.add(antenna);
  }
  if (seed % 4 === 1) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.8), accentMat);
    pod.position.set(0, -0.7, -0.2);
    group.add(pod);
  }
  if (seed % 5 === 2) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 2.0), accentMat);
    plate.position.set(-0.5, 0.55, 0.4);
    group.add(plate);
  }

  // Engine glow
  const glowMat = new THREE.SpriteMaterial({
    map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, color: new THREE.Color(...paint.glow),
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

  enableShadows(group);
  return { group, nozzles: [nozzle], glowSprites: [glow], hardpoints: [hardpoint], boundingRadius: 3.5 };
}

// Cutthroat interceptor: a forward-swept needle dart built for the kill run.
export function buildCutthroat(seed = 1) {
  const group = new THREE.Group();
  const paint = paintFor(seed);
  const hullMat = hullMaterial('#22242c', paint.rust, 0.7, 45 + seed, 0.7, 0.45);
  const finMat = new THREE.MeshStandardMaterial({
    color: 0x14161c, metalness: 0.8, roughness: 0.35,
    emissive: new THREE.Color(paint.rust), emissiveIntensity: 0.3,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 5.6), hullMat);
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 6), hullMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 3.9;
  group.add(nose);

  // blade fins swept FORWARD, opposite every other hull in the game
  for (let side = -1; side <= 1; side += 2) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 1.1), finMat);
    wing.position.set(side * 1.4, 0, 0.6);
    wing.rotation.y = -side * 0.55;
    group.add(wing);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1.3), finMat);
  tail.position.set(0, 0.55, -2.2);
  group.add(tail);

  // single overdriven engine, hot blue-white
  const glowMat = new THREE.SpriteMaterial({
    map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, color: new THREE.Color(1.6, 2.2, 3.2),
  });
  const glow = new THREE.Sprite(glowMat);
  glow.position.z = -3.1;
  glow.scale.setScalar(1.6);
  group.add(glow);
  const nozzle = new THREE.Object3D();
  nozzle.position.z = -3.1;
  group.add(nozzle);

  const hardpoint = new THREE.Object3D();
  hardpoint.position.set(0, -0.3, 3.4);
  group.add(hardpoint);

  const mslHp = new THREE.Object3D();
  mslHp.position.set(0, -0.45, 1.0);
  group.add(mslHp);
  group.userData = { mslHp };

  enableShadows(group);
  return { group, nozzles: [nozzle], glowSprites: [glow], hardpoints: [hardpoint], boundingRadius: 3.4 };
}

// Corsair ace: gull-winged black-and-gold duellist with its guns on show.
export function buildCorsair(seed = 1) {
  const group = new THREE.Group();
  const hullMat = hullMaterial('#1d1a16', '#c9a227', 0.5, 55 + seed, 0.75, 0.35);
  const goldMat = new THREE.MeshStandardMaterial({ color: 0x8a6a1f, metalness: 0.9, roughness: 0.25 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1a0505, metalness: 0.3, roughness: 0.12,
    emissive: new THREE.Color(0xff3322), emissiveIntensity: 1.0,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 5.0), hullMat);
  group.add(body);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.9, 1.8, 4), hullMat);
  nose.rotation.x = Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.z = 3.3;
  group.add(nose);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 1.3), glassMat);
  canopy.position.set(0, 0.65, 1.1);
  group.add(canopy);

  // gull wings: inner panel drops, gold outer blade levels out, barrels forward
  for (let side = -1; side <= 1; side += 2) {
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 1.8), hullMat);
    inner.position.set(side * 1.5, -0.35, -0.4);
    inner.rotation.z = side * 0.5;
    group.add(inner);
    const outer = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.4), goldMat);
    outer.position.set(side * 2.7, -0.72, -0.5);
    group.add(outer);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), goldMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(side * 2.2, -0.6, 1.4);
    group.add(barrel);
  }
  // twin canted tail fins
  for (let side = -1; side <= 1; side += 2) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 1.2), goldMat);
    fin.position.set(side * 0.8, 0.6, -2.1);
    fin.rotation.z = -side * 0.35;
    group.add(fin);
  }

  const nozzles = [];
  const glowSprites = [];
  for (let side = -1; side <= 1; side += 2) {
    const nozzle = new THREE.Object3D();
    nozzle.position.set(side * 0.55, 0, -2.7);
    group.add(nozzle);
    nozzles.push(nozzle);
    const glowM = new THREE.SpriteMaterial({
      map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, color: new THREE.Color(3.0, 2.2, 0.4),
    });
    const glow = new THREE.Sprite(glowM);
    glow.position.set(side * 0.55, 0, -2.7);
    glow.scale.setScalar(1.1);
    group.add(glow);
    glowSprites.push(glow);
  }

  const hardpoints = [];
  for (let side = -1; side <= 1; side += 2) {
    const hp = new THREE.Object3D();
    hp.position.set(side * 2.2, -0.6, 2.2);
    group.add(hp);
    hardpoints.push(hp);
  }

  enableShadows(group);
  return { group, nozzles, glowSprites, hardpoints, boundingRadius: 4.6 };
}

// Authority trim liveries: the hull stays police-white, accents vary by unit.
const POLICE_TRIM = ['#1f3a60', '#123a3a', '#2a2f38', '#4a1f2a'];

// Sleek police interceptor: white, blue, with alternating flashing strobes on wingtips
export function buildPolice(seed = 1) {
  const group = new THREE.Group();

  const trim = POLICE_TRIM[Math.abs(seed) % POLICE_TRIM.length];
  const hullMat = hullMaterial('#d0d3d4', trim, 0.15, 80 + seed, 0.65, 0.4); // cleaner white hull
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111116, metalness: 0.8, roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a1a2a, metalness: 0.2, roughness: 0.15,
    emissive: new THREE.Color(0x00aaff), emissiveIntensity: 0.9,
  });

  // Sleek interceptor wedge shape
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 4.2), hullMat);
  group.add(body);

  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.75, 1.8, 5), hullMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 2.8;
  group.add(nose);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.35, 1.2), glassMat);
  canopy.position.set(0, 0.5, 0.8);
  group.add(canopy);

  // per-unit kit: some cars run a roof lightbar, some a nose stripe
  if (seed % 2 === 0) {
    const lightbar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.3), new THREE.MeshStandardMaterial({
      color: 0x222228, metalness: 0.6, roughness: 0.3,
      emissive: new THREE.Color(0x66aaff), emissiveIntensity: 1.4,
    }));
    lightbar.position.set(0, 0.55, -0.4);
    group.add(lightbar);
  }
  if (seed % 3 === 0) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 2.4), darkMat);
    stripe.position.set(0, 0.46, 1.6);
    group.add(stripe);
  }

  // Wings
  for (let side = -1; side <= 1; side += 2) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.4), darkMat);
    wing.position.set(side * 1.7, -0.1, -0.6);
    wing.rotation.y = side * 0.25;
    wing.rotation.z = side * 0.1;
    group.add(wing);

    // Red/Blue police light sprites on wingtips!
    const strobeMat = new THREE.SpriteMaterial({
      map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, color: new THREE.Color(side === -1 ? 0xff0000 : 0x0000ff)
    });
    const strobe = new THREE.Sprite(strobeMat);
    strobe.position.set(side * 2.8, -0.1, -0.8);
    strobe.scale.setScalar(2.0);
    group.add(strobe);
    group.userData = group.userData || {};
    group.userData.strobes = group.userData.strobes || [];
    group.userData.strobes.push(strobe);
  }

  // Engine glow
  const glowMat = new THREE.SpriteMaterial({
    map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, color: new THREE.Color(0.2, 0.6, 2.0),
  });
  const glow = new THREE.Sprite(glowMat);
  glow.position.z = -2.3;
  glow.scale.setScalar(1.2);
  group.add(glow);

  const nozzle = new THREE.Object3D();
  nozzle.position.z = -2.3;
  group.add(nozzle);

  const hardpoint = new THREE.Object3D();
  hardpoint.position.set(0, -0.3, 2.2);
  group.add(hardpoint);

  enableShadows(group);
  return { group, nozzles: [nozzle], glowSprites: [glow], hardpoints: [hardpoint], boundingRadius: 3.5 };
}

// Heavy police enforcer: an armored riot gunship that leads big response wings.
export function buildHeavyPolice(seed = 1) {
  const group = new THREE.Group();

  const trim = POLICE_TRIM[Math.abs(seed) % POLICE_TRIM.length];
  const hullMat = hullMaterial('#c8ccd0', trim, 0.25, 85 + seed, 0.7, 0.4);
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x1c2c44, metalness: 0.85, roughness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a1a2a, metalness: 0.2, roughness: 0.15,
    emissive: new THREE.Color(0x00aaff), emissiveIntensity: 1.0,
  });

  // slab-sided riot hull
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.6, 6.2), hullMat);
  group.add(body);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.3, 1.6, 4), hullMat);
  nose.rotation.x = Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.z = 3.8;
  group.add(nose);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.5), glassMat);
  canopy.position.set(0, 1.0, 1.6);
  group.add(canopy);

  // navy armor cheeks
  for (let side = -1; side <= 1; side += 2) {
    const armor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 4.4), armorMat);
    armor.position.set(side * 1.85, 0, -0.4);
    group.add(armor);
  }

  // full-width roof lightbar with the red/blue strobes mounted on it
  const lightbar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 0.4), armorMat);
  lightbar.position.set(0, 0.95, -0.6);
  group.add(lightbar);
  group.userData = group.userData || {};
  group.userData.strobes = [];
  for (let side = -1; side <= 1; side += 2) {
    const strobeMat = new THREE.SpriteMaterial({
      map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, color: new THREE.Color(side === -1 ? 0xff0000 : 0x0000ff),
    });
    const strobe = new THREE.Sprite(strobeMat);
    strobe.position.set(side * 0.8, 0.95, -0.6);
    strobe.scale.setScalar(2.6);
    group.add(strobe);
    group.userData.strobes.push(strobe);
  }

  const nozzles = [];
  const glowSprites = [];
  for (let side = -1; side <= 1; side += 2) {
    const nozzle = new THREE.Object3D();
    nozzle.position.set(side * 0.9, 0, -3.3);
    group.add(nozzle);
    nozzles.push(nozzle);
    const glowM = new THREE.SpriteMaterial({
      map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, color: new THREE.Color(0.2, 0.6, 2.0),
    });
    const glow = new THREE.Sprite(glowM);
    glow.position.set(side * 0.9, 0, -3.3);
    glow.scale.setScalar(1.4);
    group.add(glow);
    glowSprites.push(glow);
  }

  const hardpoints = [];
  for (let side = -1; side <= 1; side += 2) {
    const hp = new THREE.Object3D();
    hp.position.set(side * 1.2, -0.6, 3.0);
    group.add(hp);
    hardpoints.push(hp);
  }

  enableShadows(group);
  return { group, nozzles, glowSprites, hardpoints, boundingRadius: 5.4 };
}

// ---------- The Empire ----------
// Imperial hulls stay parade-clean (low wear) in cold light greys, with
// near-black solar panels and the signature green-tinted viewports.

function empireHullMat(seed) {
  return hullMaterial('#8a8f9a', '#4a4f58', 0.25, 200 + seed, 0.7, 0.45);
}
const empirePanelMat = () => new THREE.MeshStandardMaterial({
  color: 0x14161c, metalness: 0.55, roughness: 0.55,
});
const empireGlassMat = () => new THREE.MeshStandardMaterial({
  color: 0x0a1208, metalness: 0.25, roughness: 0.15,
  emissive: new THREE.Color(0x2aff55), emissiveIntensity: 0.5,
});

// Twin-ion engine glow: the pale imperial white-green flare.
function empireEngineGlow(group, positions, scale = 1.1) {
  const nozzles = [];
  const glowSprites = [];
  for (const [x, y, z] of positions) {
    const glowMat = new THREE.SpriteMaterial({
      map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, color: new THREE.Color(1.6, 2.6, 1.8),
    });
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(x, y, z);
    glow.scale.setScalar(scale);
    group.add(glow);
    glowSprites.push(glow);
    const nozzle = new THREE.Object3D();
    nozzle.position.set(x, y, z);
    group.add(nozzle);
    nozzles.push(nozzle);
  }
  return { nozzles, glowSprites };
}

// TIE Fighter: ball cockpit between two flat hexagonal solar panels.
export function buildTieFighter(seed = 1) {
  const group = new THREE.Group();
  const hullMat = empireHullMat(seed);
  const panelMat = empirePanelMat();

  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 14), hullMat);
  group.add(ball);
  const viewport = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 8), empireGlassMat());
  viewport.rotation.x = Math.PI / 2;
  viewport.position.z = 1.02;
  group.add(viewport);

  // lateral pylons out to the wing panels
  const pylonGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.6, 8);
  pylonGeo.rotateZ(Math.PI / 2);
  for (let side = -1; side <= 1; side += 2) {
    const pylon = new THREE.Mesh(pylonGeo, hullMat);
    pylon.position.set(side * 1.6, 0, 0);
    group.add(pylon);
    // hex panel: flat face toward the cockpit
    const panel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.08, 6), panelMat);
    panel.rotation.z = Math.PI / 2;
    panel.position.set(side * 2.4, 0, 0);
    group.add(panel);
  }

  const { nozzles, glowSprites } = empireEngineGlow(group, [[0, 0, -1.0]]);

  const hardpoint = new THREE.Object3D();
  hardpoint.position.set(0, -0.5, 1.0);
  group.add(hardpoint);

  enableShadows(group);
  return { group, nozzles, glowSprites, hardpoints: [hardpoint], boundingRadius: 3.2 };
}

// TIE Interceptor: same ball, dagger wing panels swept to points, wingtip cannon.
export function buildTieInterceptor(seed = 1) {
  const group = new THREE.Group();
  const hullMat = empireHullMat(seed + 1);
  const panelMat = empirePanelMat();

  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 14), hullMat);
  group.add(ball);
  const viewport = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 8), empireGlassMat());
  viewport.rotation.x = Math.PI / 2;
  viewport.position.z = 0.94;
  group.add(viewport);

  const pylonGeo = new THREE.CylinderGeometry(0.13, 0.13, 1.5, 8);
  pylonGeo.rotateZ(Math.PI / 2);
  for (let side = -1; side <= 1; side += 2) {
    const pylon = new THREE.Mesh(pylonGeo, hullMat);
    pylon.position.set(side * 1.5, 0, 0);
    group.add(pylon);
    // two angled dagger blades per side form the notched arrow silhouette
    for (let v = -1; v <= 1; v += 2) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 2.4), panelMat);
      blade.position.set(side * 2.25, v * 0.75, 0.45);
      blade.rotation.x = -v * 0.5;
      group.add(blade);
    }
  }

  const { nozzles, glowSprites } = empireEngineGlow(group, [[0, 0, -0.95]], 1.2);

  // interceptor cannon ride the wingtips
  const hardpoints = [];
  for (let side = -1; side <= 1; side += 2) {
    const hp = new THREE.Object3D();
    hp.position.set(side * 2.25, -1.2, 1.4);
    group.add(hp);
    hardpoints.push(hp);
  }

  enableShadows(group);
  return { group, nozzles, glowSprites, hardpoints, boundingRadius: 3.4 };
}

// Vader's TIE Advanced x1: stretched cockpit pod, bent wing panels.
export function buildVaderTie(seed = 1) {
  const group = new THREE.Group();
  const hullMat = hullMaterial('#4a4e57', '#22252c', 0.2, 230 + seed, 0.75, 0.4); // darker than the line fighters
  const panelMat = empirePanelMat();

  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.05, 18, 14), hullMat);
  ball.scale.set(1, 0.9, 1.3);
  group.add(ball);
  const viewport = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 8), empireGlassMat());
  viewport.rotation.x = Math.PI / 2;
  viewport.position.z = 1.3;
  group.add(viewport);

  const pylonGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.3, 8);
  pylonGeo.rotateZ(Math.PI / 2);
  for (let side = -1; side <= 1; side += 2) {
    const pylon = new THREE.Mesh(pylonGeo, hullMat);
    pylon.position.set(side * 1.4, 0, 0);
    group.add(pylon);
    // bent panels: inner section angles outward-down, outer section vertical
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 2.6), panelMat);
    inner.position.set(side * 2.2, 0.45, 0);
    inner.rotation.z = -side * 0.6;
    group.add(inner);
    const outer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 2.6), panelMat);
    outer.position.set(side * 2.85, -0.75, 0);
    group.add(outer);
  }

  const { nozzles, glowSprites } = empireEngineGlow(group, [[0, 0, -1.35]], 1.4);

  // twin chin cannon
  const hardpoints = [];
  for (let side = -1; side <= 1; side += 2) {
    const hp = new THREE.Object3D();
    hp.position.set(side * 0.35, -0.6, 1.3);
    group.add(hp);
    hardpoints.push(hp);
  }

  const mslHp = new THREE.Object3D();
  mslHp.position.set(0, -0.7, 0.4);
  group.add(mslHp);
  group.userData = { mslHp };

  enableShadows(group);
  return { group, nozzles, glowSprites, hardpoints, boundingRadius: 3.6 };
}

// Imperial Star Destroyer: the kilometre wedge, terraced superstructure,
// bridge tower with twin deflector globes. All primitives, kept cheap.
export function buildStarDestroyer(seed = 1) {
  const group = new THREE.Group();
  const hullMat = empireHullMat(seed + 3);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x33363e, metalness: 0.7, roughness: 0.45 });

  // the dagger: a 4-sided cone pointed +Z, flattened vertically
  const wedgeGeo = new THREE.CylinderGeometry(0.2, 14, 90, 4, 1);
  wedgeGeo.rotateX(Math.PI / 2);
  const wedge = new THREE.Mesh(wedgeGeo, hullMat);
  wedge.scale.y = 0.22;
  group.add(wedge);

  // terraced superstructure amidships-aft
  const deck1 = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 26), hullMat);
  deck1.position.set(0, 2.4, -22);
  group.add(deck1);
  const deck2 = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 16), hullMat);
  deck2.position.set(0, 3.8, -26);
  group.add(deck2);

  // bridge tower on a neck, deflector globes on top
  const neck = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.4, 3), darkMat);
  neck.position.set(0, 5.6, -32);
  group.add(neck);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 4), hullMat);
  bridge.position.set(0, 7.6, -32);
  group.add(bridge);
  for (let side = -1; side <= 1; side += 2) {
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10), darkMat);
    globe.position.set(side * 3.4, 9.4, -32);
    group.add(globe);
  }

  const { nozzles, glowSprites } = empireEngineGlow(group,
    [[-6, 0, -46], [0, 0.6, -46], [6, 0, -46]], 4.2);

  // turret batteries spread along the dorsal edges
  const hardpoints = [];
  const turretSpots = [
    [-5, 1.8, 8], [5, 1.8, 8], [-7, 2.2, -8], [7, 2.2, -8], [-8, 2.6, -24], [8, 2.6, -24],
  ];
  for (const [x, y, z] of turretSpots) {
    const hp = new THREE.Object3D();
    hp.position.set(x, y, z);
    group.add(hp);
    hardpoints.push(hp);
  }

  enableShadows(group);
  return { group, nozzles, glowSprites, hardpoints, boundingRadius: 48 };
}

// The Death Star: a moon-sized sphere with the superlaser dish, an
// equatorial trench, and the thermal exhaust port that kills it.
export function buildDeathStar(seed = 1) {
  const group = new THREE.Group();
  const R = 260;
  const hullMat = hullMaterial('#9aa0a8', '#565b64', 0.35, 300 + seed, 0.6, 0.6);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c3038, metalness: 0.7, roughness: 0.5 });

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), hullMat);
  group.add(sphere);

  // superlaser dish: an inset darker bowl in the northern hemisphere (+Z-ish)
  const dishDir = new THREE.Vector3(0.55, 0.55, 0.63).normalize();
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(88, 62, 14, 28), darkMat);
  dish.position.copy(dishDir).multiplyScalar(R - 8);
  dish.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dishDir);
  group.add(dish);
  const emitter = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 10), new THREE.MeshStandardMaterial({
    color: 0x0a1a0a, emissive: new THREE.Color(0x2aff55), emissiveIntensity: 1.4,
  }));
  emitter.position.copy(dishDir).multiplyScalar(R + 2);
  group.add(emitter);
  // charge glow, scaled up by the DeathStar entity as the superlaser charges
  const dishGlowMat = new THREE.SpriteMaterial({
    map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, color: new THREE.Color(0.8, 3.0, 0.9),
  });
  const dishGlow = new THREE.Sprite(dishGlowMat);
  dishGlow.position.copy(dishDir).multiplyScalar(R + 6);
  dishGlow.scale.setScalar(0.01);
  group.add(dishGlow);

  // equatorial trench
  const trench = new THREE.Mesh(new THREE.TorusGeometry(R + 1, 6, 8, 96), darkMat);
  trench.rotation.x = Math.PI / 2;
  group.add(trench);

  // surface greebles — towers and blocks breaking up the sphere
  const turrets = [];
  for (let i = 0; i < 36; i++) {
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const g = new THREE.Mesh(new THREE.BoxGeometry(6 + Math.random() * 14, 4 + Math.random() * 8, 6 + Math.random() * 14), darkMat);
    g.position.copy(dir).multiplyScalar(R);
    g.lookAt(0, 0, 0);
    group.add(g);
    if (turrets.length < 10) {
      const t = new THREE.Object3D();
      t.position.copy(dir).multiplyScalar(R + 10);
      group.add(t);
      turrets.push(t);
    }
  }

  // thermal exhaust port: on the trench, marked by a small emissive ring
  const port = new THREE.Object3D();
  port.position.set(0, 0, R + 2);
  group.add(port);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 1.4, 6, 18), new THREE.MeshStandardMaterial({
    color: 0x1a1208, emissive: new THREE.Color(0xffaa33), emissiveIntensity: 1.6,
  }));
  ring.position.set(0, 0, R + 2);
  group.add(ring);

  enableShadows(group);
  return { group, port, dishGlow, turrets, boundingRadius: R + 8 };
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

export function buildMediumPirate(seed = 1) {
  const group = new THREE.Group();
  const paint = paintFor(seed + 2); // offset so a wing's hulls don't all match
  const hullMat = hullMaterial(paint.base, paint.rust, 0.85, 50 + seed, 0.6, 0.5);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a1a2a, metalness: 0.2, roughness: 0.15,
    emissive: new THREE.Color(0xdca12a), emissiveIntensity: 0.8,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 5.2), hullMat);
  group.add(body);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.4), glassMat);
  canopy.position.set(0, 0.8, 1.2);
  group.add(canopy);

  const nozzles = [];
  const glowSprites = [];
  for (let side = -1; side <= 1; side += 2) {
    const nozzle = new THREE.Object3D();
    nozzle.position.set(side * 0.7, 0, -2.8);
    group.add(nozzle);
    nozzles.push(nozzle);

    const glowM = new THREE.SpriteMaterial({
      map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, color: new THREE.Color(...paint.glow),
    });
    const glow = new THREE.Sprite(glowM);
    glow.position.set(side * 0.7, 0, -2.8);
    glow.scale.setScalar(1.2);
    group.add(glow);
    glowSprites.push(glow);
  }

  const hardpoints = [];
  for (let side = -1; side <= 1; side += 2) {
    const hp = new THREE.Object3D();
    hp.position.set(side * 1.1, -0.4, 2.7);
    group.add(hp);
    hardpoints.push(hp);
  }

  enableShadows(group);
  return { group, nozzles, glowSprites, hardpoints, boundingRadius: 4.8 };
}

export function buildHeavyPirate(seed = 1) {
  const group = new THREE.Group();
  // dreadnoughts keep their menacing dark hull and red engines; only the
  // rust streaking varies so each one still reads instantly as the big threat
  const paint = paintFor(seed + 4);
  const hullMat = hullMaterial('#2f363f', paint.rust, 0.9, 60 + seed, 0.75, 0.45);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x121519, metalness: 0.85, roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1f0505, metalness: 0.4, roughness: 0.1,
    emissive: new THREE.Color(0xff1111), emissiveIntensity: 1.2,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.0, 7.5), hullMat);
  group.add(body);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.8), glassMat);
  canopy.position.set(0, 1.3, 2.0);
  group.add(canopy);

  for (let side = -1; side <= 1; side += 2) {
    const armor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 5.0), darkMat);
    armor.position.set(side * 2.2, 0, -0.5);
    group.add(armor);
  }

  const nozzles = [];
  const glowSprites = [];
  const engineOffsets = [
    [-1.0, 0, -3.9],
    [0, 0.4, -3.9],
    [1.0, 0, -3.9]
  ];
  engineOffsets.forEach(([x, y, z]) => {
    const nozzle = new THREE.Object3D();
    nozzle.position.set(x, y, z);
    group.add(nozzle);
    nozzles.push(nozzle);

    const glowM = new THREE.SpriteMaterial({
      map: engineGlowTex, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, color: new THREE.Color(4.0, 0.2, 0.1),
    });
    const glow = new THREE.Sprite(glowM);
    glow.position.set(x, y, z);
    glow.scale.setScalar(1.5);
    group.add(glow);
    glowSprites.push(glow);
  });

  const hardpoints = [];
  for (let side = -1; side <= 1; side += 2) {
    const hp = new THREE.Object3D();
    hp.position.set(side * 1.5, -0.8, 3.8);
    group.add(hp);
    hardpoints.push(hp);
  }

  const mslHp = new THREE.Object3D();
  mslHp.position.set(0, 1.0, -1.0);
  group.add(mslHp);
  group.userData = { mslHp };

  enableShadows(group);
  return { group, nozzles, glowSprites, hardpoints, boundingRadius: 6.2 };
}
