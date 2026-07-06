import { SaveSystem } from '../save/SaveSystem.js';
import { Missions } from '../missions/Missions.js';
import { Progression } from '../player/Progression.js';
import { Crew } from '../crew/Crew.js';

// Docked: station UI over a slow orbit shot of the station. Autosaves on entry.
export class StationState {
  constructor(game) {
    this.game = game;
    this.angle = 0;
  }

  enter({ station, respawned }) {
    const g = this.game;
    this.station = station;
    g.ship.group.visible = false;
    g.ship.velocity.set(0, 0, 0);
    g.sfx.play('clamp');
    g.input.exitPointerLock();
    g.ui.hud.hide();
    g.encounters.clearAll();
    g.laserPool.clear();
    if (g.missilePool) g.missilePool.clear();
    // missiles are NOT refilled on docking — restock them on the Repair tab
    g.ship.chaffAmmo = g.ship.stats.chaffMax;

    // resolve contracts before saving so payouts/failures land in the save
    const missionNews = [];
    if (respawned) {
      for (const m of Missions.onDeath(g.playerData)) {
        missionNews.push({ msg: `CONTRACT FAILED — ${m.qty}x ${m.goodName.toUpperCase()} LOST WITH SHIP`, cls: 'loss' });
      }
    }
    for (const m of Missions.onDock(station.planetDef.id, g.playerData)) {
      missionNews.push({ msg: `CONTRACT COMPLETE — ${m.qty}x ${m.goodName.toUpperCase()} DELIVERED · +${m.reward.toLocaleString()} CR · +${m.xp} XP`, cls: 'profit' });
    }

    const wages = Crew.chargeWages(g.playerData);
    if (wages.charged > 0) {
      missionNews.push({ msg: `CREW WAGES PAID — −${wages.charged.toLocaleString()} CR`, cls: 'loss' });
    } else if (wages.quit.length) {
      missionNews.push({ msg: `UNPAID CREW WALKED OUT: ${wages.quit.join(', ')}`, cls: 'loss' });
      g.ship.applyStats();
    }

    // outstanding police fines are collected the moment you're on the pad
    const fines = Math.round(g.playerData.fines || 0);
    if (fines > 0) {
      const paid = Math.min(g.playerData.credits, fines);
      g.playerData.credits -= paid;
      g.playerData.fines = fines - paid;
      missionNews.push({ msg: `POLICE FINES SETTLED — −${paid.toLocaleString()} CR`, cls: 'loss' });
      if (g.playerData.fines > 0) {
        missionNews.push({ msg: `UNPAID FINES OUTSTANDING — ${g.playerData.fines.toLocaleString()} CR`, cls: 'loss' });
      }
    }

    const pid = station.planetDef.id;
    if (!g.playerData.visitedStations.includes(pid)) {
      g.playerData.visitedStations.push(pid);
      Progression.award(g.playerData, Progression.XP.firstVisit);
      missionNews.push({ msg: `FIRST VISIT TO ${station.planetDef.name} — +${Progression.XP.firstVisit} XP`, cls: 'profit' });
    }

    g.playerData.lastStationId = station.id;
    SaveSystem.save(g.playerData, g.market);

    if (respawned) {
      // insurance already applied in FlightState.respawn
      setTimeout(() => g.ui.hud.toast('INSURANCE COVERED A REBUILD — CARGO LOST', 'warn'), 100);
    }

    g.ui.stationUI.show(station.planetDef, g.market, g.playerData, {
      undock: () => {
        g.ui.stationUI.hide();
        g.sm.change(g.states.flight, { spawnAtStation: station.id, pointerLock: true });
      },
      onUpgrade: (key) => {
        g.ship.rebuildMesh();
        g.ship.applyStats();
        g.rebuildEngineTrail();
        if (key === 'shield') g.ship.shield = g.ship.stats.shieldMax;
        if (key === 'missiles') g.ship.missilesAmmo = g.ship.stats.missilesMaxAmmo;
        if (key === 'module') g.ship.chaffAmmo = g.ship.stats.chaffMax;
      },
      onSkill: () => g.ship.applyStats(),
    }, missionNews);
  }

  exit() {
    this.game.ui.stationUI.hide();
    this.game.ship.group.visible = true;
  }

  update(dt) {
    const g = this.game;
    this.angle += dt * 0.06;
    const sp = this.station.group.position;
    g.camera.position.set(
      sp.x + Math.cos(this.angle) * 130,
      sp.y + 35,
      sp.z + Math.sin(this.angle) * 130
    );
    g.camera.lookAt(sp.x, sp.y, sp.z);
    g.world.update(dt, g.camera.position);
    g.particles.update(dt);
    g.explosions.update(dt);
  }
}
