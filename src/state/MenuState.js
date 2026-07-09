import * as THREE from 'three';
import { SaveSystem } from '../save/SaveSystem.js';
import { Net } from '../net/Net.js';

// Title screen with the live system drifting behind it.
export class MenuState {
  constructor(game) {
    this.game = game;
    this.angle = 0;
  }

  enter() {
    const g = this.game;
    g.ui.hud.hide();
    g.ui.stationUI.hide();
    g.ui.menuUI.hidePause();
    g.input.exitPointerLock();
    const refreshHasSave = () => {
      g.ui.menuUI.setHasSave(SaveSystem.exists());
      // a signed-in commander may have a cloud save this device has never seen
      if (Net.loggedIn && !SaveSystem.exists()) {
        Net.cloudLoad().then((blob) => {
          if (blob && g.sm.current === this) g.ui.menuUI.setHasSave(true);
        });
      }
    };
    g.ui.menuUI.show({
      hasSave: SaveSystem.exists(),
      onNew: () => g.newGame(),
      onNewCheat: () => g.newGame(true),
      onContinue: () => g.loadGame(),
      onContinueCheat: () => g.loadGame(true),
      onSessionChange: refreshHasSave,
    });
    refreshHasSave();
  }

  exit() {
    this.game.ui.menuUI.hide();
  }

  update(dt) {
    const g = this.game;
    this.angle += dt * 0.02;
    // slow scenic drift around the first planet, biased to its sunlit side
    const p = g.world.planets[0].group.position;
    const sunward = p.clone().negate().normalize();
    const perp = new THREE.Vector3(-sunward.z, 0, sunward.x);
    g.camera.position.copy(p)
      .addScaledVector(sunward, 330)
      .addScaledVector(perp, 240 + Math.sin(this.angle) * 90)
      .add(new THREE.Vector3(0, 90 + Math.sin(this.angle * 0.6) * 30, 0));
    g.camera.lookAt(p.x, p.y, p.z);
    
    // Noticeably spin the world and its moons on the loading/title screen
    const firstPlanet = g.world.planets[0];
    if (firstPlanet) {
      firstPlanet.surface.rotation.y += dt * 0.12;
      for (const m of firstPlanet.moons) {
        m.group.rotation.y += dt * 0.18;
        m.mesh.rotation.y += dt * 0.22;
      }
    }

    g.world.update(dt, g.camera.position);
    g.particles.update(dt);
  }
}
