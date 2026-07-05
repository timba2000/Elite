import * as THREE from 'three';
import { C } from '../constants.js';
import { Pirate } from '../ships/Pirate.js';
import { Police } from '../ships/Police.js';
import { buildCargoPod } from '../ships/ShipFactory.js';
import { COMMODITIES } from '../economy/commodities.js';

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
        if (notoriety > 5 && Math.random() < policeChance) {
          this.spawnPoliceAmbush(player);
          this.events.onInterdiction();
          break;
        } else if (Math.random() < C.INTERDICTION_CHANCE * cargoFactor) {
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
      if (pod.mesh.position.distanceTo(player.position) < C.POD_SCOOP_DIST) {
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

  spawnAmbush(player) {
    const upgradeLevel = this.playerData.totalUpgradeTiers();
    const count = Math.min(3, 1 + Math.floor(upgradeLevel / 5) + (Math.random() < 0.4 ? 1 : 0));
    const scale = 1 + this.playerData.netWorthFactor() * 0.6;
    const fwd = player.forward;
    for (let i = 0; i < count; i++) {
      _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(500);
      _spawnPos.copy(player.position)
        .addScaledVector(fwd, 600 + Math.random() * 300)
        .add(_rand);
      this.pirates.push(new Pirate(this.scene, _spawnPos, scale));
    }
    this.cooldown = C.ENCOUNTER_COOLDOWN;
  }

  spawnPoliceAmbush(player) {
    const scale = 1 + this.playerData.netWorthFactor() * 0.8;
    const notoriety = this.playerData.notoriety || 0;
    const count = Math.min(3, 1 + Math.floor(notoriety / 35) + (Math.random() < 0.3 ? 1 : 0));
    const fwd = player.forward;
    for (let i = 0; i < count; i++) {
      _rand.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(400);
      _spawnPos.copy(player.position)
        .addScaledVector(fwd, 500 + Math.random() * 200)
        .add(_rand);
      this.police.push(new Police(this.scene, _spawnPos, scale));
    }
    this.events.toast('POLICE INTERDICTON — CONTRA-BAND SCANNED!', 'warn');
    this.cooldown = C.ENCOUNTER_COOLDOWN;
  }

  onPirateKilled(pirate, explosions) {
    explosions.spawn(pirate.position, 1.4);
    const bounty = Math.floor(C.PIRATE_BOUNTY_MIN + Math.random() * (C.PIRATE_BOUNTY_MAX - C.PIRATE_BOUNTY_MIN));
    this.playerData.credits += bounty;
    this.events.toast(`BOUNTY +${bounty} CR`, 'gold');
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
