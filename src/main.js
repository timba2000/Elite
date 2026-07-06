import * as THREE from 'three';
import { C } from './constants.js';
import { Input } from './input/Input.js';
import { PostFX } from './fx/PostFX.js';
import { ParticleSystem, EngineTrail } from './fx/EngineTrail.js';
import { WorldScene } from './world/WorldScene.js';
import { PlayerShip } from './ships/PlayerShip.js';
import { LaserPool } from './combat/LaserPool.js';
import { MissilePool } from './combat/MissilePool.js';
import { Explosions } from './combat/Explosions.js';
import { EncounterManager } from './combat/EncounterManager.js';
import { Market } from './economy/Market.js';
import { PlayerData } from './player/PlayerData.js';
import { SaveSystem } from './save/SaveSystem.js';
import { Hud } from './ui/hud.js';
import { generateGalaxy } from './world/SystemDef.js';
import { StationUI } from './ui/StationUI.js';
import { MenuUI } from './ui/MenuUI.js';
import { StateMachine } from './state/StateMachine.js';
import { MenuState } from './state/MenuState.js';
import { FlightState } from './state/FlightState.js';
import { DockingState } from './state/DockingState.js';
import { StationState } from './state/StationState.js';
import { Sfx } from './audio/Sfx.js';
import { Graphics } from './fx/Graphics.js';

class Game {
  constructor() {
    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // soft shadows only cost when the photo-tier shadow light is active
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      C.CAMERA_FOV, window.innerWidth / window.innerHeight, 0.5, C.CAMERA_FAR
    );
    this.camera.position.set(0, 200, 3200);

    this.postfx = new PostFX(this.renderer, this.scene, this.camera);
    this.input = new Input(this.renderer.domElement);

    // sound (procedural Web Audio; unlocks on first gesture)
    this.sfx = new Sfx();
    const unlock = () => this.sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    // world + shared FX
    this.world = new WorldScene(this.scene, this.renderer);
    // graphics-quality changes (menu/pause button) apply live
    Graphics.onChange(() => {
      this.postfx.setQuality(Graphics.quality);
      this.world.setQuality();
    });
    this.particles = new ParticleSystem(this.scene, 900);
    this.laserPool = new LaserPool(this.scene);
    this.laserPool.sfx = this.sfx;
    this.missilePool = new MissilePool(this.scene);
    this.missilePool.sfx = this.sfx;
    this.enemyMissilePool = new MissilePool(this.scene, 4);
    this.enemyMissilePool.sfx = this.sfx;
    this.explosions = new Explosions(this.scene, this.particles);
    this.explosions.sfx = this.sfx;

    // UI
    const uiRoot = document.getElementById('ui-root');
    this.ui = {
      hud: new Hud(uiRoot),
      stationUI: new StationUI(uiRoot),
      menuUI: new MenuUI(uiRoot),
    };
    this.ui.hud.sfx = this.sfx;
    // every UI button gets a click blip
    uiRoot.addEventListener('click', (e) => {
      if (e.target.closest('button')) this.sfx.play('click');
    }, true);

    // states
    this.sm = new StateMachine();
    this.states = {
      menu: new MenuState(this),
      flight: new FlightState(this),
      docking: new DockingState(this),
      station: new StationState(this),
    };

    // session objects created on new game / load
    this.playerData = null;
    this.market = null;
    this.ship = null;
    this.encounters = null;
    this.engineTrail = null;

    // pointer lock via canvas click while flying
    this.renderer.domElement.addEventListener('click', () => {
      if (this.sm.current === this.states.flight && !this.states.flight.paused) {
        this.input.requestPointerLock();
      }
    });

    window.addEventListener('resize', () => this.onResize());

    this.clock = new THREE.Clock();
    this.sm.change(this.states.menu);
    this.renderer.setAnimationLoop(() => this.tick());
  }

  createSession(playerData, market) {
    this.playerData = playerData;
    this.market = market;

    if (this.ship) this.scene.remove(this.ship.group);
    this.ship = new PlayerShip(this.scene, playerData);
    this.rebuildEngineTrail();
    if (this.missilePool) this.missilePool.clear();
    if (this.enemyMissilePool) this.enemyMissilePool.clear();

    this.encounters = new EncounterManager(this.scene, playerData, {
      toast: (msg, kind) => this.ui.hud.toast(msg, kind),
      onInterdiction: () => this.states.flight.onInterdiction(),
    });
    this.states.flight.target = null;
    this.states.flight.targetIndex = -1;
  }

  rebuildEngineTrail() {
    this.engineTrail = new EngineTrail(this.particles, this.ship.ship);
  }

  newGame(cheat = false) {
    const pd = new PlayerData();
    if (cheat) pd.credits = 1000000;
    generateGalaxy(0); // Reset to default Galaxy 1 (Achenar)
    this.createSession(pd, new Market());
    this.sm.change(this.states.flight, {
      spawnAtStation: this.playerData.lastStationId,
      pointerLock: true,
    });
  }

  loadGame(cheat = false) {
    const data = SaveSystem.load();
    if (!data) { this.newGame(cheat); return; }
    const pd = PlayerData.deserialize(data.player);
    if (cheat) pd.credits = 1000000;
    generateGalaxy((pd.galaxy ?? 1) - 1); // Setup correct galaxy system
    this.createSession(
      pd,
      Market.deserialize(data.marketDrift)
    );
    if (this.playerData.inSpace) {
      this.sm.change(this.states.flight, {
        loadFromSpace: true,
        pointerLock: true,
      });
    } else {
      const station = this.world.getStation(this.playerData.lastStationId);
      this.sm.change(this.states.station, { station });
    }
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.postfx.setSize(w, h);
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.sm.update(dt);
    this.input.consume();
    const sun = this.world.suns[0];
    if (sun) this.postfx.update(dt, sun.group.position, sun.light.color);
    this.postfx.render();
  }
}

window.game = new Game();
