import * as THREE from 'three';
import { C } from '../constants.js';
import { Pirate } from '../ships/Pirate.js';
import { Police } from '../ships/Police.js';
import { buildCargoPod } from '../ships/ShipFactory.js';
import { COMMODITIES } from '../economy/commodities.js';
import { Station } from '../world/Station.js';
import { grungeHullTexture } from '../fx/textures.js';
import { Missions } from '../missions/Missions.js';
import { Progression } from '../player/Progression.js';

const _spawnPos = new THREE.Vector3();
const _rand = new THREE.Vector3();

// Rolls interdictions during supercruise, owns live pirates and cargo pods.
export class EncounterManager {
  constructor(scene, playerData, events) {
    this.scene = scene;
    this.playerData = playerData;
    this.events = events; // { toast(msg, kind), onInterdiction() }
    this.pirates = [];
    this.police = [];
    this.pods = [];
    this.debris = []; // transient POI scenery (asteroid belts, dead stations)
    this.cooldown = 0;
    this.rollAccum = 0;
  }

  get inCombat() {
    return this.pirates.some((p) => p.alive) || this.police.some((p) => p.alive);
  }

  nearestPirateDist(pos) {
    let d = Infinity;
    for (const p of this.pirates) {
      if (!p.alive) continue;
      d = Math.min(d, p.position.distanceTo(pos));
    }
    for (const p of this.police) {
      if (!p.alive) continue;
      d = Math.min(d, p.position.distanceTo(pos));
    }
    return d;
  }

  // called each frame; rolls interdiction in supercruise, ambushes in normal
  // space at a lower rate (never inside a station's safe radius)
  update(dt, player, laserPool, inSupercruise, nearStation = false) {
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (this.cooldown <= 0 && !nearStation) {
      this.rollAccum += dt;
      while (this.rollAccum >= 1) {
        this.rollAccum -= 1;
        const cargoFactor = 1 + 1.5 * Math.min(1, this.playerData.cargoValue() / 3000);
        const notoriety = this.playerData.notoriety || 0;
        // a wanted target is actively hunting the player
        const namedFactor = this.playerData.missions.some((m) => m.named) ? 2 : 1;
        // pirates roll first so police pressure at high notoriety can never
        // starve pirate encounters (kill contracts stay completable)
        const base = inSupercruise ? C.INTERDICTION_CHANCE : C.INTERDICTION_CHANCE_NORMAL;
        if (Math.random() < base * cargoFactor * namedFactor * this.playerData.getDerivedStats().interdictionMult) {
          this.spawnAmbush(player);
          this.events.onInterdiction();
          break;
        }
        // police cargo scans only happen at supercruise checkpoints, capped
        // so max notoriety doesn't monopolise every encounter slot
        const policeChance = Math.min(notoriety * 0.0035, C.POLICE_AMBUSH_CAP);
        if (inSupercruise && notoriety > 5 && Math.random() < policeChance) {
          this.spawnPoliceAmbush(player);
          this.events.onInterdiction();
          break;
        }
      }
    }

    // pirates
    for (const p of this.pirates) {
      p.update(dt, player, laserPool);
      if (p.alive && p.state === 'FLEE' && p.position.distanceTo(player.position) > C.PIRATE.DESPAWN_DIST) {
        p.alive = false;
        p.dispose();
      }
    }
    this.pirates = this.pirates.filter((p) => p.alive);

    // police
    for (const p of this.police) {
      p.update(dt, player, laserPool);
      if (p.alive && p.state === 'FLEE' && p.position.distanceTo(player.position) > C.PIRATE.DESPAWN_DIST) {
        p.alive = false;
        p.dispose();
      }
    }
    this.police = this.police.filter((p) => p.alive);

    // cargo pods: bob, spin, scoop
    for (const pod of this.pods) {
      pod.mesh.rotation.y += 1.2 * dt;
      pod.mesh.rotation.x += 0.7 * dt;
      pod.life -= dt;
      if (pod.life <= 0) {
        this.scene.remove(pod.mesh);
        pod.dead = true;
        continue;
      }
      if (pod.mesh.position.distanceTo(player.position) < C.POD_SCOOP_DIST * (player.stats?.scoopMult ?? 1)) {
        if (pod.rescue) {
          const reward = 400 + Math.floor(Math.random() * 500);
          this.playerData.credits += reward;
          this.playerData.career.creditsEarned += reward;
          this.playerData.rescuedPilots = (this.playerData.rescuedPilots || 0) + 1;
          Progression.award(this.playerData, 100);
          this.events.toast(`PILOT RESCUED — +${reward} CR · +100 XP`, 'gold');
          this.scene.remove(pod.mesh);
          pod.dead = true;
          continue;
        }
        const space = this.playerData.cargoSpace();
        const take = Math.min(pod.qty, space);
        if (take > 0) {
          this.playerData.addCargo(pod.good, take);
          const name = COMMODITIES.find((c) => c.id === pod.good).name;
          this.events.toast(`SCOOPED ${take}x ${name.toUpperCase()}`, 'gold');
          this.scene.remove(pod.mesh);
          pod.dead = true;
        } else if (!pod.warned) {
          pod.warned = true;
          this.events.toast('CARGO HOLD FULL', 'warn');
        }
      }
    }
    this.pods = this.pods.filter((p) => !p.dead);

    // POI scenery drifts slowly and despawns once the player leaves it behind
    for (const d of this.debris) {
      d.group.rotation.y += d.spin * dt;
      if (d.group.position.distanceTo(player.position) > C.POI_DESPAWN_DIST) {
        this.scene.remove(d.group);
        d.dead = true;
      }
    }
    this.debris = this.debris.filter((d) => !d.dead);
  }

  dropPod(position, good, qty, opts = {}) {
    const mesh = buildCargoPod();
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.pods.push({ mesh, good, qty, life: opts.life ?? 90, dead: false, rescue: opts.rescue ?? false });
  }

  // Points of interest found via supercruise signals. Contents spawn around
  // the player right after the drop-out.
  spawnPOI(type, player) {
    const around = (spread, ahead) => _spawnPos.copy(player.position)
      .addScaledVector(player.forward, ahead)
      .add(_rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(spread))
      .clone();

    if (type === 'derelict') {
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const good = COMMODITIES[Math.floor(Math.random() * COMMODITIES.length)];
        this.dropPod(around(140, 90), good.id, 1 + Math.floor(Math.random() * 2));
      }
      if (Math.random() < 0.2) {
        this.pirates.push(new Pirate(this.scene, around(200, 160), 1, 'raider'));
        this.events.toast('DERELICT FREIGHTER — CARGO ADRIFT, SCAVENGER ON SITE', 'warn');
      } else {
        this.events.toast('DERELICT FREIGHTER — CARGO ADRIFT', 'gold');
      }
    } else if (type === 'distress') {
      if (Math.random() < 0.4) {
        const galaxy = this.playerData.galaxy ?? 1;
        const scale = (1 + this.playerData.netWorthFactor() * 0.8) * (1.0 + (galaxy - 1) * 0.35);
        for (let i = 0; i < 2; i++) {
          this.pirates.push(new Pirate(this.scene, around(240, 220), scale, 'raider'));
        }
        this.events.toast('THE DISTRESS SIGNAL WAS A TRAP — PIRATES INBOUND!', 'warn');
      } else {
        this.dropPod(around(80, 70), 'rescue', 1, { rescue: true, life: 120 });
        this.events.toast('ESCAPE POD BEACON — SCOOP IT UP', 'gold');
      }
    } else if (type === 'cache') {
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        this.dropPod(around(100, 80), 'narcotics', 1 + Math.floor(Math.random() * 2));
      }
      this.events.toast('SMUGGLER DEAD DROP — UNMARKED CARGO ADRIFT', 'gold');
    } else if (type === 'belt') {
      const centre = around(60, 420);
      const group = this.buildAsteroidBelt();
      group.position.copy(centre);
      this.scene.add(group);
      this.debris.push({ group, spin: 0.02, dead: false });
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        _rand.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.3, Math.random() - 0.5).multiplyScalar(320);
        this.dropPod(centre.clone().add(_rand), 'ore', 1 + Math.floor(Math.random() * 2), { life: 180 });
      }
      if (Math.random() < 0.3) {
        this.pirates.push(new Pirate(this.scene, around(300, 340), 1, 'raider'));
        this.events.toast('ASTEROID BELT — ORE ADRIFT AMONG THE ROCKS, CLAIM JUMPER ON SITE', 'warn');
      } else {
        this.events.toast('ASTEROID BELT — ORE FRAGMENTS ADRIFT AMONG THE ROCKS', 'gold');
      }
    } else if (type === 'ghost') {
      const centre = around(40, 400);
      const wreck = this.buildGhostStation();
      wreck.group.position.copy(centre);
      this.scene.add(wreck.group);
      this.debris.push({ group: wreck.group, spin: 0.008, dead: false });
      const goods = ['machinery', 'electronics', 'luxuries', 'medicine'];
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(200);
        this.dropPod(centre.clone().add(_rand), goods[Math.floor(Math.random() * goods.length)], 1 + Math.floor(Math.random() * 2), { life: 180 });
      }
      if (Math.random() < 0.4) {
        const galaxy = this.playerData.galaxy ?? 1;
        const scale = (1 + this.playerData.netWorthFactor() * 0.8) * (1.0 + (galaxy - 1) * 0.35);
        for (let i = 0; i < 2; i++) {
          this.pirates.push(new Pirate(this.scene, around(280, 320), scale, 'raider'));
        }
        this.events.toast('ABANDONED STATION — SALVAGE ADRIFT, SQUATTERS OPENING FIRE!', 'warn');
      } else {
        this.events.toast('ABANDONED STATION — DEAD HULK, SALVAGE ADRIFT', 'gold');
      }
    }
  }

  // A tumbling field of two dozen rocks. Vertex displacement keys off world
  // position so duplicated seam vertices deform together (no cracks).
  buildAsteroidBelt() {
    const group = new THREE.Group();
    const { map, roughnessMap, normalMap } = grungeHullTexture('#5a5148', '#3a332c', 0.9, Math.floor(Math.random() * 900));
    const mat = new THREE.MeshStandardMaterial({
      map, roughnessMap, normalMap, normalScale: new THREE.Vector2(1, 1),
      metalness: 0.1, roughness: 0.95,
    });
    for (let i = 0; i < 24; i++) {
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const posAttr = geo.attributes.position;
      const phase = Math.random() * 100;
      for (let v = 0; v < posAttr.count; v++) {
        const x = posAttr.getX(v), y = posAttr.getY(v), z = posAttr.getZ(v);
        const s = 0.75 + 0.3 * Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + phase));
        posAttr.setXYZ(v, x * s, y * s, z * s);
      }
      geo.computeVertexNormals();
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set((Math.random() - 0.5) * 640, (Math.random() - 0.5) * 160, (Math.random() - 0.5) * 640);
      rock.scale.setScalar(3 + Math.random() * 11);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      group.add(rock);
    }
    return group;
  }

  // A Station built from a throwaway def, then gutted: lights out, doors
  // shut, tumbling. Not registered with the world, so it can't be docked.
  buildGhostStation() {
    const def = { id: 'ghost', name: 'DERELICT', position: new THREE.Vector3(1, 0, 0), radius: 1 };
    const st = new Station(def, Math.floor(Math.random() * 900));
    st.group.rotation.set(Math.random(), Math.random(), Math.random());
    st.apertureMat.color.setRGB(0.35, 0.06, 0.04); // dead red emergency glow
    for (const { mesh } of st.navLights) mesh.visible = false;
    st.group.traverse((o) => { if (o.isPointLight) o.intensity = 0.25; });
    return st;
  }

  spawnAmbush(player) {
    // once the pilot is DEADLY, the warlord may come looking for them instead
    if (!this.playerData.career.warlordDefeated
        && Progression.combatRank(this.playerData).index >= Progression.WARLORD_RANK
        && Math.random() < C.WARLORD_CHANCE) {
      this.spawnWarlord(player);
      return;
    }

    const galaxy = this.playerData.galaxy ?? 1;
    const scale = (1 + this.playerData.netWorthFactor() * 0.8) * (1.0 + (galaxy - 1) * 0.35);
    const count = 1 + (Math.random() < 0.25 + (galaxy - 1) * 0.2 ? 1 : 0) + Math.floor((galaxy - 1) / 2);
    const fwd = player.forward;
    const netWorth = this.playerData.netWorthFactor();
    const spawned = [];

    for (let i = 0; i < count; i++) {
      _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(500);
      _spawnPos.copy(player.position)
        .addScaledVector(fwd, 600 + Math.random() * 300)
        .add(_rand);

      let type = 'raider';
      const roll = Math.random();
      if (galaxy >= 3) {
        if (roll < 0.3) type = 'dreadnought';
        else if (roll < 0.75) type = 'marauder';
      } else if (galaxy === 2) {
        if (roll < 0.15) type = 'dreadnought';
        else if (roll < 0.5) type = 'marauder';
      } else {
        if (netWorth > 0.6 && roll < 0.05) type = 'dreadnought';
        else if (netWorth > 0.3 && roll < 0.25) type = 'marauder';
      }

      const pirate = new Pirate(this.scene, _spawnPos, scale, type);
      this.pirates.push(pirate);
      spawned.push(pirate);
    }

    // two or more pirates fly as a coordinated wing: the heaviest ship leads,
    // wingmen aim tighter while it lives and break off once it dies
    if (spawned.length >= 2) {
      const tier = (p) => (p.type === 'dreadnought' ? 3 : p.type === 'marauder' ? 2 : 1);
      const leader = spawned.reduce((a, b) => (tier(b) > tier(a) ? b : a));
      leader.isWingLeader = true;
      for (const p of spawned) {
        if (p !== leader) p.wingLeader = leader;
      }
      this.events.toast(`PIRATE WING ON SCANNER — ${spawned.length} SHIPS IN FORMATION`, 'warn');
    }

    // a wanted contract's target muscles into the ambush
    const liveNamed = new Set(this.pirates.map((p) => p.namedMissionId).filter(Boolean));
    const wanted = this.playerData.missions.find((m) => m.named && !liveNamed.has(m.id));
    if (wanted) {
      _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(400);
      _spawnPos.copy(player.position).addScaledVector(fwd, 700).add(_rand);
      const boss = new Pirate(this.scene, _spawnPos, scale * 1.25, wanted.shipType);
      boss.namedMissionId = wanted.id;
      boss.pirateName = wanted.named;
      boss.noFlee = true;
      this.pirates.push(boss);
      this.events.toast(`${wanted.named} HAS FOUND YOU — CONTRACT TARGET ON SCANNER`, 'warn');
    }

    this.cooldown = C.ENCOUNTER_COOLDOWN;
  }

  // The one-off boss: an oversized dreadnought with a marauder escort wing,
  // reserved for pilots who have earned a DEADLY combat rank.
  spawnWarlord(player) {
    const galaxy = this.playerData.galaxy ?? 1;
    const scale = (1 + this.playerData.netWorthFactor() * 0.8) * (1.0 + (galaxy - 1) * 0.35);
    const fwd = player.forward;

    _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(300);
    _spawnPos.copy(player.position).addScaledVector(fwd, 750).add(_rand);
    const boss = new Pirate(this.scene, _spawnPos, scale * 1.9, 'dreadnought');
    boss.isWarlord = true;
    boss.isWingLeader = true;
    boss.noFlee = true;
    boss.pirateName = 'THE HARROW';
    this.pirates.push(boss);

    for (let i = 0; i < 2; i++) {
      _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(350);
      _spawnPos.copy(player.position).addScaledVector(fwd, 650).add(_rand);
      const escort = new Pirate(this.scene, _spawnPos, scale, 'marauder');
      escort.wingLeader = boss;
      this.pirates.push(escort);
    }

    this.events.toast('MASSIVE SIGNATURE — THE HARROW, PIRATE WARLORD, HAS FOUND YOU', 'warn');
    this.cooldown = C.ENCOUNTER_COOLDOWN * 2;
  }

  spawnPoliceAmbush(player) {
    const galaxy = this.playerData.galaxy ?? 1;
    const scale = (1 + this.playerData.netWorthFactor() * 0.8) * (1.0 + (galaxy - 1) * 0.35);
    const notoriety = this.playerData.notoriety || 0;
    const count = Math.min(4, 1 + Math.floor(notoriety / 35) + (Math.random() < 0.3 ? 1 : 0) + Math.floor((galaxy - 1) / 2));
    const fwd = player.forward;
    for (let i = 0; i < count; i++) {
      _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(400);
      _spawnPos.copy(player.position)
        .addScaledVector(fwd, 500 + Math.random() * 200)
        .add(_rand);
      this.police.push(new Police(this.scene, _spawnPos, scale));
    }
    this.events.toast('POLICE INTERDICTION — CONTRA-BAND SCANNED!', 'warn');
    this.cooldown = C.ENCOUNTER_COOLDOWN;
  }

  onPirateKilled(pirate, explosions) {
    explosions.spawn(pirate.position, pirate.isWarlord ? 2.6 : 1.4);
    const bounty = pirate.isWarlord
      ? C.WARLORD_BOUNTY
      : Math.floor(C.PIRATE_BOUNTY_MIN + Math.random() * (C.PIRATE_BOUNTY_MAX - C.PIRATE_BOUNTY_MIN));
    this.playerData.credits += bounty;
    this.playerData.career.creditsEarned += bounty;
    this.playerData.career.piratesKilled++;
    const xp = Progression.XP.kill(pirate.type) + (pirate.isWarlord ? C.WARLORD_XP_BONUS : 0);
    Progression.award(this.playerData, xp);
    this.events.toast(`BOUNTY +${bounty.toLocaleString()} CR · +${xp} XP`, 'gold');

    // combat rank climbs on weighted kills
    const prevRank = Progression.combatRank(this.playerData).index;
    this.playerData.career.combatScore += Progression.combatScoreFor(pirate.type);
    const rank = Progression.combatRank(this.playerData);
    if (rank.index > prevRank) {
      setTimeout(() => this.events.toast(`COMBAT RANK ADVANCED — ${rank.name}`, 'gold'), 900);
    }

    if (pirate.isWarlord) {
      this.playerData.career.warlordDefeated = true;
      setTimeout(() => this.events.toast('THE HARROW IS DEAD — THE SYSTEM BREATHES EASIER', 'gold'), 400);
    } else if (pirate.isWingLeader
        && this.pirates.some((p) => p.alive && p.wingLeader === pirate)) {
      this.events.toast('WING LEADER DOWN — SURVIVORS LOSING THEIR NERVE', 'gold');
    }

    if (pirate.namedMissionId) {
      const m = Missions.onNamedKill(pirate.namedMissionId, this.playerData);
      if (m) {
        setTimeout(() => this.events.toast(
          `${pirate.pirateName} DESTROYED — CONTRACT COMPLETE +${m.reward.toLocaleString()} CR · +${m.xp} XP`, 'gold'), 600);
      }
    }

    const hunts = Missions.onPirateKill(this.playerData);
    for (const m of hunts.completed) {
      this.events.toast(`CONTRACT COMPLETE — +${m.reward.toLocaleString()} CR · +${m.xp} XP`, 'gold');
    }
    for (const m of hunts.progress) {
      this.events.toast(`HUNT CONTRACT — ${m.killsDone}/${m.kills} PIRATES`, '');
    }

    if (this.playerData.notoriety > 0) {
      const prev = this.playerData.notoriety;
      this.playerData.notoriety = Math.max(0, this.playerData.notoriety - 8);
      const diff = prev - this.playerData.notoriety;
      if (diff > 0) {
        setTimeout(() => this.events.toast(`PIRATE DESTROYED — NOTORIETY -${diff}`, 'gold'), 1200);
      }
    }

    pirate.dispose();

    if (Math.random() < C.POD_DROP_CHANCE) {
      const good = COMMODITIES[Math.floor(Math.random() * COMMODITIES.length)];
      const mesh = buildCargoPod();
      mesh.position.copy(pirate.position);
      this.scene.add(mesh);
      this.pods.push({ mesh, good: good.id, qty: 1 + Math.floor(Math.random() * 3), life: 60, dead: false });
    }
  }

  // Friendly fire on system authority: one fine per police ship provoked,
  // billed at the next docking.
  onPoliceHit(police) {
    if (police.finedPlayer) return;
    police.finedPlayer = true;
    this.playerData.fines = (this.playerData.fines || 0) + C.FINE_FRIENDLY_FIRE;
    this.playerData.notoriety = Math.min(100, (this.playerData.notoriety || 0) + 3);
    this.events.toast(`FRIENDLY FIRE ON POLICE — ${C.FINE_FRIENDLY_FIRE} CR FINE ISSUED`, 'warn');
  }

  onPoliceKilled(police, explosions) {
    explosions.spawn(police.position, 1.6);
    police.dispose();
    this.playerData.notoriety = Math.min(100, (this.playerData.notoriety || 0) + 15);
    this.playerData.fines = (this.playerData.fines || 0) + C.FINE_POLICE_KILL;
    this.events.toast(`WARNING — POLICE SHIP DESTROYED! NOTORIETY +15 · ${C.FINE_POLICE_KILL} CR FINE`, 'warn');

    if (Math.random() < 0.5) {
      const mesh = buildCargoPod();
      mesh.position.copy(police.position);
      this.scene.add(mesh);
      this.pods.push({ mesh, good: 'narcotics', qty: 1 + Math.floor(Math.random() * 2), life: 75, dead: false });
    }
  }

  // A dirty cargo scan scrambles interceptors from the station. No remote
  // confiscation — they only get the goods if they blow you apart first.
  spawnContrabandBust(station, player) {
    const galaxy = this.playerData.galaxy ?? 1;
    const scale = (1 + this.playerData.netWorthFactor() * 0.8) * (1.0 + (galaxy - 1) * 0.35);
    const notoriety = this.playerData.notoriety || 0;
    const count = Math.min(4 - this.police.length, 2 + Math.floor(notoriety / 50));

    const stationNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(station.group.quaternion).normalize();
    for (let i = 0; i < count; i++) {
      const spawnPos = station.group.position.clone().addScaledVector(stationNormal, 70);
      _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(40);
      spawnPos.add(_rand);
      this.police.push(new Police(this.scene, spawnPos, scale));
    }
  }

  spawnStationSecurity(station, player) {
    const galaxy = this.playerData.galaxy ?? 1;
    const scale = (1 + this.playerData.netWorthFactor() * 0.8) * (1.0 + (galaxy - 1) * 0.35);
    
    // Spawn security ship slightly out of the station aperture
    const stationNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(station.group.quaternion).normalize();
    const spawnPos = station.group.position.clone().addScaledVector(stationNormal, 70);
    
    _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(25);
    spawnPos.add(_rand);
    
    const sec = new Police(this.scene, spawnPos, scale * 1.15);
    this.police.push(sec);
    
    this.playerData.notoriety = Math.min(100, (this.playerData.notoriety || 0) + 12);
    this.events.toast('WARNING — STATION DEFENSES ENGAGED! SECURITY DISPATCHED', 'warn');
  }

  clearAll() {
    for (const p of this.pirates) p.dispose();
    this.pirates = [];
    for (const p of this.police) p.dispose();
    this.police = [];
    for (const pod of this.pods) this.scene.remove(pod.mesh);
    this.pods = [];
    for (const d of this.debris) this.scene.remove(d.group);
    this.debris = [];
    this.cooldown = 0;
  }
}
