import { SaveSystem } from '../save/SaveSystem.js';

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
    g.input.exitPointerLock();
    g.ui.hud.hide();
    g.encounters.clearAll();
    g.laserPool.clear();

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
      },
    });
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
