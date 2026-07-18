import * as THREE from 'three';
import { grungeHullTexture } from '../fx/textures.js';
import { buildPlayerShip, buildTrader, buildInterceptor, buildPolice, buildMediumPirate } from '../ships/ShipFactory.js';

// Interior hangar shown while docked: the player's ship parked on the centre
// pad, a couple of visiting ships on the side pads, dock crew wandering about,
// and a force-field opening onto the stars. Parked far below the system plane
// so it never collides with the flight world; the starfield follows the
// camera, so space still reads through the opening.
const BAY_POS = new THREE.Vector3(0, -30000, 0);
const FLOOR_W = 116; // x span
const FLOOR_D = 74;  // z span
const CEIL_H = 26;
const BACK_X = -52;  // solid rear wall
const OPEN_X = 56;   // force-field opening onto space
const PADS = [
  { x: 2, z: 0 },     // centre — the player's ship
  { x: -4, z: -24 },  // visitors
  { x: -4, z: 24 },
];

// deterministic per-station variety without Math.random
function lcg(seed) {
  let s = (seed * 2654435761) % 2147483647 || 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

function signTexture(text) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0a1218';
  ctx.fillRect(0, 0, cv.width, cv.height);
  // shrink the font until long station names fit the canvas
  let size = 64;
  do {
    ctx.font = `${size}px "Courier New", monospace`;
    size -= 2;
  } while (ctx.measureText(text).width > cv.width - 60 && size > 28);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(80,220,255,0.9)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#9fe8ff';
  ctx.fillText(text, cv.width / 2, cv.height / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A little dock worker: boots, hi-vis torso, helmet. ~0.8 units tall so the
// parked ships read as big machines next to them.
function buildWorker(rnd) {
  const g = new THREE.Group();
  const vestColors = [0xff7a1a, 0xffd21a, 0x2ad0ff, 0x8aff5a];
  const vest = vestColors[Math.floor(rnd() * vestColors.length)];
  const legMat = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.9 });
  const vestMat = new THREE.MeshStandardMaterial({
    color: vest, roughness: 0.7,
    emissive: new THREE.Color(vest), emissiveIntensity: 0.6,
  });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.5 });

  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.3, 6), legMat);
  legs.position.y = 0.15;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.3, 6), vestMat);
  torso.position.y = 0.45;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), headMat);
  head.position.y = 0.68;
  g.add(legs); g.add(torso); g.add(head);
  g.scale.setScalar(1.35); // ~1 unit tall — readable from the pad camera
  return g;
}

export class DockingBay {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.copy(BAY_POS);
    this.group.visible = false;
    scene.add(this.group);

    this.time = 0;
    this.playerShip = null;   // rebuilt each time we show / after upgrades
    this.npcShips = [];       // rebuilt per station
    this.sign = null;
    this.stationId = null;

    this.buildRoom();
    this.buildProps();
    this.buildCrew();
  }

  // ---------- static shell: floor, walls, pads, lights, force field ----------
  buildRoom() {
    const { map, roughnessMap, normalMap } = grungeHullTexture('#565b64', '#3a3f48', 0.5, 77);
    for (const t of [map, roughnessMap, normalMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 3);
      t.needsUpdate = true;
    }
    const wallTex = grungeHullTexture('#4a505a', '#31363e', 0.55, 78);
    const floorMat = new THREE.MeshStandardMaterial({
      map, roughnessMap, normalMap, normalScale: new THREE.Vector2(0.5, 0.5),
      metalness: 0.4, roughness: 0.8,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex.map, roughnessMap: wallTex.roughnessMap, normalMap: wallTex.normalMap,
      metalness: 0.45, roughness: 0.75,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x22252b, metalness: 0.6, roughness: 0.6 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, 2, FLOOR_D), floorMat);
    floor.position.set(2, -1, 0);
    this.group.add(floor);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, 2, FLOOR_D), wallMat);
    ceiling.position.set(2, CEIL_H + 1, 0);
    this.group.add(ceiling);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(2, CEIL_H, FLOOR_D), wallMat);
    backWall.position.set(BACK_X - 1, CEIL_H / 2, 0);
    this.group.add(backWall);

    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, CEIL_H, 2), wallMat);
      wall.position.set(2, CEIL_H / 2, side * (FLOOR_D / 2 + 1));
      this.group.add(wall);
      // structural ribs so the walls don't read as flat slabs
      for (let x = BACK_X + 10; x < OPEN_X; x += 14) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(1.4, CEIL_H, 1.2), darkMat);
        rib.position.set(x, CEIL_H / 2, side * (FLOOR_D / 2 - 0.4));
        this.group.add(rib);
      }
    }

    // landing pads: raised disc, glowing ring, painted centre
    const padMat = new THREE.MeshStandardMaterial({ color: 0x454a54, metalness: 0.5, roughness: 0.6 });
    this.padRings = [];
    for (const [i, p] of PADS.entries()) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10.2, 0.5, 36), padMat);
      disc.position.set(p.x, 0.25, p.z);
      this.group.add(disc);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? new THREE.Color(0.2, 1.6, 2.0) : new THREE.Color(1.5, 1.05, 0.2),
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(9.2, 0.14, 8, 48), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p.x, 0.52, p.z);
      this.group.add(ring);
      this.padRings.push({ mesh: ring, mat: ringMat, phase: i * 2.1 });
    }

    // ceiling light panels + the point lights that actually do the work
    const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 1.8) });
    for (const p of PADS) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 4), panelMat);
      panel.position.set(p.x, CEIL_H - 0.2, p.z);
      this.group.add(panel);
      const light = new THREE.PointLight(0xfff0d8, 2.4, 95, 1.1);
      light.position.set(p.x, CEIL_H - 3, p.z);
      this.group.add(light);
    }
    // cool fill from the opening side so hulls get a rim
    const fill = new THREE.PointLight(0x7ab0ff, 0.9, 100, 1.2);
    fill.position.set(OPEN_X - 8, 12, 0);
    this.group.add(fill);
    // warm spill over the crate stacks so the back wall isn't a black void
    const backGlow = new THREE.PointLight(0xffd9a0, 1.3, 75, 1.2);
    backGlow.position.set(BACK_X + 12, 12, 0);
    this.group.add(backGlow);
    // broad soft fill so the room reads without the sun's help indoors
    const roomFill = new THREE.PointLight(0xaab4c8, 1.1, 170, 0.7);
    roomFill.position.set(2, 17, 0);
    this.group.add(roomFill);

    // hazard stripes along the opening edge
    const stripeY = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.1, 0.1) });
    for (let z = -FLOOR_D / 2 + 3; z < FLOOR_D / 2 - 1; z += 4) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 2), stripeY);
      s.position.set(OPEN_X - 3, 0.04, z + 1);
      s.rotation.y = 0.5;
      this.group.add(s);
    }

    // force field: faint additive sheet across the opening, plus a glowing frame
    this.fieldMat = new THREE.MeshBasicMaterial({
      color: 0x3fb8ff, transparent: true, opacity: 0.04,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const field = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_D + 2, CEIL_H), this.fieldMat);
    field.rotation.y = Math.PI / 2;
    field.position.set(OPEN_X, CEIL_H / 2, 0);
    this.group.add(field);
    const frameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.0, 2.6) });
    for (const y of [0.3, CEIL_H - 0.3]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, FLOOR_D + 2), frameMat);
      bar.position.set(OPEN_X, y, 0);
      this.group.add(bar);
    }
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, CEIL_H, 0.5), frameMat);
      post.position.set(OPEN_X, CEIL_H / 2, side * (FLOOR_D / 2 + 1));
      this.group.add(post);
    }

    // rotating amber beacons flanking the opening
    this.beacons = [];
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 10, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.9, 0.1) })
      );
      b.position.set(OPEN_X - 1.5, CEIL_H - 2, side * (FLOOR_D / 2 - 2));
      this.group.add(b);
      this.beacons.push({ mesh: b, phase: side });
    }

    this.group.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  // ---------- dressing: crates, drums, gantry crane, back-wall office ----------
  buildProps() {
    const rnd = lcg(99);
    const crateTex = grungeHullTexture('#6a5a3a', '#4a3a22', 0.7, 80);
    const crateMat = new THREE.MeshStandardMaterial({
      map: crateTex.map, roughnessMap: crateTex.roughnessMap, normalMap: crateTex.normalMap,
      metalness: 0.3, roughness: 0.8,
    });
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x8a3020, metalness: 0.5, roughness: 0.6 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x22252b, metalness: 0.6, roughness: 0.6 });

    // crate stacks along the back wall
    for (let i = 0; i < 9; i++) {
      const size = 1.6 + rnd() * 1.6;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crateMat);
      crate.position.set(BACK_X + 4 + rnd() * 6, size / 2, -30 + i * 7 + (rnd() - 0.5) * 3);
      crate.rotation.y = rnd() * 0.6;
      this.group.add(crate);
      if (rnd() > 0.5) {
        const top = new THREE.Mesh(new THREE.BoxGeometry(size * 0.7, size * 0.7, size * 0.7), crateMat);
        top.position.copy(crate.position);
        top.position.y = size + size * 0.35;
        top.rotation.y = rnd() * 1.2;
        this.group.add(top);
      }
    }
    for (let i = 0; i < 5; i++) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 10), drumMat);
      drum.position.set(BACK_X + 6 + rnd() * 3, 0.7, 8 + i * 1.6 + rnd());
      this.group.add(drum);
    }

    // glowing control-room window strip high on the back wall
    const officeGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 3, 26),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.68, 0.34) })
    );
    officeGlow.position.set(BACK_X + 0.3, CEIL_H - 6, 0);
    this.group.add(officeGlow);

    // gantry crane: rail across the bay with a slowly patrolling trolley + hook
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, FLOOR_D - 4), darkMat);
    rail.position.set(-22, CEIL_H - 1.6, 0);
    this.group.add(rail);
    this.trolley = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.6), drumMat);
    this.trolley.add(cab);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 6), darkMat);
    cable.position.y = -3.2;
    this.trolley.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), crateMat);
    hook.position.y = -6.2;
    this.trolley.add(hook);
    this.trolley.position.set(-22, CEIL_H - 2.8, 0);
    this.group.add(this.trolley);

    // service cart that trundles a loop between the pads (front is +Z)
    this.cart = new THREE.Group();
    const cartBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 2.2), drumMat);
    cartBody.position.y = 0.6;
    this.cart.add(cartBody);
    const cartCargo = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 1.2), crateMat);
    cartCargo.position.set(0, 1.3, -0.4);
    this.cart.add(cartCargo);
    const headlight = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.2, 0.1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.7, 1.4) })
    );
    headlight.position.set(0, 0.6, 1.15);
    this.cart.add(headlight);
    for (const [wx, wz] of [[-0.7, -0.7], [-0.7, 0.7], [0.7, -0.7], [0.7, 0.7]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 10), darkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.28, wz);
      this.cart.add(wheel);
    }
    this.group.add(this.cart);

    this.group.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  // ---------- dock crew ----------
  buildCrew() {
    const rnd = lcg(7);
    this.workers = [];
    for (let i = 0; i < 8; i++) {
      const w = buildWorker(rnd);
      const spot = this.pickFloorSpot(rnd);
      w.position.set(spot.x, 0, spot.z);
      this.group.add(w);
      this.workers.push({
        group: w,
        target: this.pickFloorSpot(rnd),
        speed: 1.0 + rnd() * 0.8,
        idle: rnd() * 3,
        phase: rnd() * 10,
        rnd,
      });
    }
  }

  // somewhere on the floor that isn't under a parked ship
  pickFloorSpot(rnd) {
    for (let tries = 0; tries < 12; tries++) {
      const x = BACK_X + 6 + rnd() * (OPEN_X - BACK_X - 18);
      const z = (rnd() - 0.5) * (FLOOR_D - 12);
      if (PADS.every((p) => (x - p.x) ** 2 + (z - p.z) ** 2 > 11 ** 2)) return { x, z };
    }
    return { x: -30, z: 0 };
  }

  // ---------- ships ----------
  refreshPlayerShip(playerData) {
    if (this.playerShip) this.group.remove(this.playerShip.group);
    const u = playerData.upgrades;
    const wear = Math.max(0.15, 1 - (u.hull - 1) * 0.45); // matches PlayerShip.rebuildMesh
    this.playerShip = buildPlayerShip(playerData.shipId, {
      wear, cargoTier: u.cargo, engineTier: u.engine,
    });
    this.playerShip.group.position.set(PADS[0].x, 1.15, PADS[0].z);
    this.playerShip.group.rotation.y = Math.PI / 2 + 0.25; // nose toward the opening
    this.group.add(this.playerShip.group);
  }

  refreshVisitors(stationSeed) {
    for (const s of this.npcShips) this.group.remove(s.group);
    this.npcShips = [];
    const rnd = lcg(stationSeed + 13);
    const builders = [
      () => buildTrader({ wear: 0.4 + rnd() * 0.6, cargoTier: 1 + Math.floor(rnd() * 3), baseColor: '#7a8d6a', rustColor: '#5a4a2a', seed: Math.floor(rnd() * 90), scale: 0.9 }),
      () => buildTrader({ wear: 0.3 + rnd() * 0.5, baseColor: '#8a6a8d', rustColor: '#4a3a5a', seed: Math.floor(rnd() * 90), scale: 0.8 }),
      () => buildInterceptor({ wear: 0.5, engineTier: 1 }),
      () => buildPolice(Math.floor(rnd() * 50)),
      () => buildMediumPirate(Math.floor(rnd() * 50)),
    ];
    for (let i = 1; i < PADS.length; i++) {
      if (rnd() < 0.2) continue; // sometimes a pad sits empty
      const ship = builders[Math.floor(rnd() * builders.length)]();
      ship.group.position.set(PADS[i].x, 1.15, PADS[i].z);
      ship.group.rotation.y = rnd() * Math.PI * 2;
      this.group.add(ship.group);
      this.npcShips.push(ship);
    }
  }

  // ---------- show / hide ----------
  show(station, playerData) {
    if (this.stationId !== station.id) {
      this.stationId = station.id;
      if (this.sign) this.group.remove(this.sign);
      const tex = signTexture(`${station.planetDef.name.toUpperCase()} STATION  ·  DOCKING BAY`);
      this.sign = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 4.25),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      this.sign.rotation.y = Math.PI / 2;
      this.sign.position.set(BACK_X + 0.6, CEIL_H - 11.5, 0);
      this.group.add(this.sign);
      // hash the station id so each station gets its own visitors
      let seed = 0;
      for (const ch of station.id) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
      this.refreshVisitors(seed);
    }
    this.refreshPlayerShip(playerData);
    this.group.visible = true;
  }

  hide() { this.group.visible = false; }

  // world-space point the docked camera should orbit
  get focus() {
    return new THREE.Vector3(PADS[0].x, 3, PADS[0].z).add(BAY_POS);
  }

  update(dt) {
    if (!this.group.visible) return;
    this.time += dt;

    // force field shimmer + player pad pulse + beacons
    this.fieldMat.opacity = 0.035 + 0.015 * Math.sin(this.time * 2.3) + 0.008 * Math.sin(this.time * 7.7);
    const p = 0.75 + 0.25 * Math.sin(this.time * 1.6);
    this.padRings[0].mat.color.setRGB(0.2 * p + 0.05, 1.6 * p, 2.0 * p);
    for (const { mesh, phase } of this.beacons) {
      mesh.material.color.setRGB(1.2 + Math.sin(this.time * 4 + phase * 3) * 1.0, 0.7, 0.1);
    }

    // gantry trolley patrols its rail; cart laps a wide ellipse around all
    // three pads, heading set from the path derivative
    this.trolley.position.z = Math.sin(this.time * 0.12) * (FLOOR_D / 2 - 8);
    const ct = this.time * 0.09;
    this.cart.position.set(2 + Math.cos(ct) * 42, 0, Math.sin(ct) * 32);
    this.cart.rotation.y = Math.atan2(-42 * Math.sin(ct), 32 * Math.cos(ct));

    // crew wander between idle stops
    for (const w of this.workers) {
      if (w.idle > 0) { w.idle -= dt; continue; }
      const dx = w.target.x - w.group.position.x;
      const dz = w.target.z - w.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) {
        w.idle = 1.5 + w.rnd() * 5;
        w.target = this.pickFloorSpot(w.rnd);
        continue;
      }
      const step = Math.min(dist, w.speed * dt);
      w.group.position.x += (dx / dist) * step;
      w.group.position.z += (dz / dist) * step;
      w.group.position.y = Math.abs(Math.sin(this.time * 9 + w.phase)) * 0.03;
      w.group.rotation.y = Math.atan2(dx, dz);
    }
  }
}
