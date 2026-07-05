import * as THREE from 'three';
import { C } from '../constants.js';
import { Pirate } from '../ships/Pirate.js';
import { Police } from '../ships/Police.js';
import { buildCargoPod } from '../ships/ShipFactory.js';
import { COMMODITIES } from '../economy/commodities.js';
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

  // called each frame; rolls interdiction only while in supercruise
  update(dt, player, laserPool, inSupercruise) {
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (inSupercruise && this.cooldown <= 0) {
      this.rollAccum += dt;
      while (this.rollAccum >= 1) {
        this.rollAccum -= 1;
        const cargoFactor = 1 + 1.5 * Math.min(1, this.playerData.cargoValue() / 3000);
        const notoriety = this.playerData.notoriety || 0;
        const policeChance = notoriety * 0.0035;
        // a wanted target is actively hunting the player
        const namedFactor = this.playerData.missions.some((m) => m.named) ? 2 : 1;
        if (notoriety > 5 && Math.random() < policeChance) {
          this.spawnPoliceAmbush(player);
          this.events.onInterdiction();
          break;
        } else if (Math.random() < C.INTERDICTION_CHANCE * cargoFactor * namedFactor * this.playerData.getDerivedStats().interdictionMult) {
          this.spawnAmbush(player);
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
    }
  }

  spawnAmbush(player) {
    const galaxy = this.playerData.galaxy ?? 1;
    const scale = (1 + this.playerData.netWorthFactor() * 0.8) * (1.0 + (galaxy - 1) * 0.35);
    const count = 1 + (Math.random() < 0.25 + (galaxy - 1) * 0.2 ? 1 : 0) + Math.floor((galaxy - 1) / 2);
    const fwd = player.forward;
    const netWorth = this.playerData.netWorthFactor();

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

      this.pirates.push(new Pirate(this.scene, _spawnPos, scale, type));
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
    explosions.spawn(pirate.position, 1.4);
    const bounty = Math.floor(C.PIRATE_BOUNTY_MIN + Math.random() * (C.PIRATE_BOUNTY_MAX - C.PIRATE_BOUNTY_MIN));
    this.playerData.credits += bounty;
    this.playerData.career.creditsEarned += bounty;
    this.playerData.career.piratesKilled++;
    const xp = Progression.XP.kill(pirate.type);
    Progression.award(this.playerData, xp);
    this.events.toast(`BOUNTY +${bounty} CR · +${xp} XP`, 'gold');

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

  onPoliceKilled(police, explosions) {
    explosions.spawn(police.position, 1.6);
    police.dispose();
    this.playerData.notoriety = Math.min(100, (this.playerData.notoriety || 0) + 15);
    this.events.toast('WARNING — POLICE SHIP DESTROYED! NOTORIETY +15', 'warn');

    if (Math.random() < 0.5) {
      const mesh = buildCargoPod();
      mesh.position.copy(police.position);
      this.scene.add(mesh);
      this.pods.push({ mesh, good: 'narcotics', qty: 1 + Math.floor(Math.random() * 2), life: 75, dead: false });
    }
  }

  clearAll() {
    for (const p of this.pirates) p.dispose();
    this.pirates = [];
    for (const p of this.police) p.dispose();
    this.police = [];
    for (const pod of this.pods) this.scene.remove(pod.mesh);
    this.pods = [];
    this.cooldown = 0;
  }
}
