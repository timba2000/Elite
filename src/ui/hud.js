import * as THREE from 'three';
import { SYSTEM } from '../world/SystemDef.js';
import { Missions } from '../missions/Missions.js';
import { Progression } from '../player/Progression.js';

const _ndc = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _invQ = new THREE.Quaternion();

// Flight HUD: bars, speed, credits, radar, target info, prompts, toasts.
export class Hud {
  constructor(uiRoot) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="hud-bars">
        <div class="bar hull"><label>HULL</label><div class="fill"></div></div>
        <div class="bar shield"><label>SHLD</label><div class="fill"></div></div>
        <div class="bar energy"><label>ENRG</label><div class="fill"></div></div>
        <div class="hud-missiles" style="display:none; font-size:10px; margin-top:2px; letter-spacing:1px; color:rgba(159,232,255,0.85)">MSL: <span class="msl-ammo">0</span> / <span class="msl-max">0</span></div>
        <div class="hud-chaff" style="display:none; font-size:10px; margin-top:2px; letter-spacing:1px; color:rgba(255,210,122,0.85)">CHF: <span class="chf-ammo">0</span> / <span class="chf-max">0</span></div>
      </div>
      <div class="hud-speed">
        <canvas id="speedo" width="180" height="104"></canvas>
        <div class="big">0</div>
        <div><span class="speed-unit">M/S</span> · THR <span class="thr">0</span>%</div>
        <div class="mode"></div>
      </div>
      <div class="hud-status">
        <div class="credits">0 CR</div>
        <div class="level">LVL 1</div>
        <div class="cargo">CARGO 0/20</div>
        <div class="notoriety" style="display:none">NOTORIETY 0</div>
        <div class="empire-heat" style="display:none">EMPIRE ATTENTION 0</div>
        <div class="loc"></div>
        <div class="missions" style="display:none"></div>
      </div>
      <canvas id="radar" width="128" height="128"></canvas>
      <div class="hud-target">
        <div class="tname">NO TARGET</div>
        <div class="tdist"></div>
        <div class="thint">T — CYCLE TARGET</div>
      </div>
      <div class="crosshair"><div class="dot"></div><div class="lock-label"></div></div>
      <div class="hud-prompt"></div>
      <div id="toasts"></div>
      <div id="combat-indicators"></div>
      <div id="damage-flash"></div>
      <div id="warp-flash"></div>
      <div id="fade-overlay"></div>
    `;
    uiRoot.appendChild(this.root);

    this.$ = (sel) => this.root.querySelector(sel);
    this.bars = {
      hull: this.$('.bar.hull .fill'),
      shield: this.$('.bar.shield .fill'),
      energy: this.$('.bar.energy .fill'),
    };
    this.mslEl = this.$('.hud-missiles');
    this.mslAmmoEl = this.$('.msl-ammo');
    this.mslMaxEl = this.$('.msl-max');
    this.chfEl = this.$('.hud-chaff');
    this.chfAmmoEl = this.$('.chf-ammo');
    this.chfMaxEl = this.$('.chf-max');
    this.speedo = this.$('#speedo');
    this.sctx = this.speedo.getContext('2d');
    this.speedEl = this.$('.hud-speed .big');
    this.speedUnitEl = this.$('.hud-speed .speed-unit');
    this.thrEl = this.$('.hud-speed .thr');
    this.modeEl = this.$('.hud-speed .mode');
    this.creditsEl = this.$('.hud-status .credits');
    this.levelEl = this.$('.hud-status .level');
    this.lastLevel = null;
    this.cargoEl = this.$('.hud-status .cargo');
    this.notorietyEl = this.$('.hud-status .notoriety');
    this.empireHeatEl = this.$('.hud-status .empire-heat');
    this.locEl = this.$('.hud-status .loc');
    this.missionsEl = this.$('.hud-status .missions');
    this.missionsText = '';
    this.radar = this.$('#radar');
    this.rctx = this.radar.getContext('2d');
    this.tname = this.$('.tname');
    this.tdist = this.$('.tdist');
    this.promptEl = this.$('.hud-prompt');
    this.toasts = this.$('#toasts');
    this.flashEl = this.$('#damage-flash');
    this.warpFlashEl = this.$('#warp-flash');
    this.fadeEl = this.$('#fade-overlay');
    this.combatEl = this.$('#combat-indicators');
    this.flashT = 0;
    this.warpFlashT = 0;
  }

  show() { this.root.classList.add('visible'); this.lastLevel = null; }
  hide() { this.root.classList.remove('visible'); }

  setPrompt(text) {
    if (this.promptEl.textContent !== text) this.promptEl.textContent = text;
  }

  toast(msg, kind = '') {
    this.sfx?.play(kind === 'gold' ? 'cash' : kind === 'warn' ? 'alarm' : 'toastInfo');
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  damageFlash() { this.flashT = 0.25; }
  warpFlash() { this.warpFlashT = 1.0; }

  fade(on, fast = false) {
    this.fadeEl.classList.toggle('fast', fast);
    this.fadeEl.classList.toggle('on', on);
  }

  update(dt, { ship, playerData, stats, target, mode, camera, pirates, police = [], empire = [], deathStar = null, pods, lockState = 'none', lockTarget = null }) {
    // bars
    this.bars.hull.style.transform = `scaleX(${Math.max(0, playerData.hull / stats.hullMax)})`;
    this.bars.shield.style.transform = `scaleX(${stats.shieldMax > 0 ? ship.shield / stats.shieldMax : 0})`;
    this.bars.energy.style.transform = `scaleX(${ship.energy / 100})`;

    // missiles display
    if (stats.missilesMaxAmmo > 0) {
      this.mslEl.style.display = 'block';
      this.mslAmmoEl.textContent = ship.missilesAmmo;
      this.mslMaxEl.textContent = stats.missilesMaxAmmo;
    } else {
      this.mslEl.style.display = 'none';
    }

    // chaff display
    if (stats.chaffMax > 0) {
      this.chfEl.style.display = 'block';
      this.chfAmmoEl.textContent = ship.chaffAmmo;
      this.chfMaxEl.textContent = stats.chaffMax;
    } else {
      this.chfEl.style.display = 'none';
    }

    // crosshair lock state
    this.updateCrosshair(lockState);

    // speed / mode
    // speed / mode
    const speed = ship.velocity.length();
    const isSuper = mode === 'super';
    this.speedEl.textContent = isSuper ? (speed / 100).toFixed(1) : Math.round(speed * 10).toLocaleString();
    this.thrEl.textContent = Math.round(ship.throttle * 100);
    this.modeEl.textContent =
      isSuper ? 'SUPERCRUISE' : ship.boosting ? 'BOOST' : '';
    this.speedUnitEl.textContent = isSuper ? 'C' : 'M/S';
    this.drawSpeedo(speed, stats, ship.boosting, mode);

    // status
    this.creditsEl.textContent = `${playerData.credits.toLocaleString()} CR`;
    const lvl = playerData.level ?? 1;
    if (this.lastLevel !== null && lvl > this.lastLevel) {
      const pts = Progression.skillPointsFor(lvl);
      this.toast(`LEVEL UP — LEVEL ${lvl}${pts > 0 ? ' · +1 SKILL POINT' : ''}`, 'gold');
    }
    this.lastLevel = lvl;
    this.levelEl.textContent = `LVL ${lvl}${playerData.skillPoints > 0 ? ` · ${playerData.skillPoints} SP` : ''} · ${Progression.combatRank(playerData).name}`;
    this.cargoEl.textContent = `CARGO ${playerData.cargoUsed()}/${stats.cargoMax}`;
    this.locEl.textContent = `${SYSTEM.name} · GALAXY ${playerData.galaxy ?? 1}`;

    const notoriety = playerData.notoriety || 0;
    if (notoriety > 0) {
      this.notorietyEl.style.display = 'block';
      this.notorietyEl.textContent = `NOTORIETY ${Math.round(notoriety)}`;
      this.notorietyEl.className = 'notoriety ' + (notoriety > 50 ? 'warn' : 'gold');
    } else {
      this.notorietyEl.style.display = 'none';
    }

    const empireHeat = playerData.empireHeat || 0;
    if (empireHeat >= 10) {
      this.empireHeatEl.style.display = 'block';
      this.empireHeatEl.textContent = `EMPIRE ATTENTION ${Math.round(empireHeat)}`;
      this.empireHeatEl.className = 'empire-heat ' + (empireHeat > 60 ? 'warn' : 'gold');
    } else {
      this.empireHeatEl.style.display = 'none';
    }

    // active contracts (up to 3 lines)
    const missions = playerData.missions || [];
    const mText = missions.slice(0, 3).map((m) => `▸ ${Missions.hudLine(m)}`).join('\n');
    if (mText !== this.missionsText) {
      this.missionsText = mText;
      this.missionsEl.style.display = mText ? 'block' : 'none';
      this.missionsEl.textContent = mText;
    }

    // target
    if (target) {
      this.tname.textContent = target.name;
      const d = target.object.position.distanceTo(ship.position);
      const isPlanetOrFar = target.type === 'planet' || d >= 200;
      if (isPlanetOrFar) {
        this.tdist.textContent = `${(d / 100).toFixed(1)} LS`;
      } else {
        const meters = d * 10;
        this.tdist.textContent = meters >= 1000 ? `${(meters / 1000).toFixed(1)} KM` : `${Math.round(meters)} M`;
      }
    } else {
      this.tname.textContent = 'NO TARGET';
      this.tdist.textContent = '';
    }

    this.drawRadar(ship, target, pirates, police, empire, pods, deathStar);
    this.updateCombatIndicators(ship, camera, pirates, police, empire, lockState, lockTarget);

    // damage flash decay
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flashEl.style.opacity = Math.max(0, this.flashT / 0.25);
    }

    // warp flash decay
    if (this.warpFlashT > 0) {
      this.warpFlashT -= dt * 1.5;
      this.warpFlashEl.style.opacity = Math.max(0, this.warpFlashT);
      this.warpFlashEl.style.display = 'block';
    } else {
      this.warpFlashEl.style.opacity = 0;
      this.warpFlashEl.style.display = 'none';
    }
  }

  // Analog arc speedometer. Manual flight scales 0..boost with an amber boost
  // zone past normal max; supercruise rescales to 0..2500 in purple.
  drawSpeedo(speed, stats, boosting, mode) {
    const ctx = this.sctx;
    const W = 180, cx = W / 2, cy = 96, R = 74;
    ctx.clearRect(0, 0, W, 104);

    const superMode = mode === 'super';
    const maxScale = superMode ? 2500 : stats.boost;
    const t = Math.min(1, speed / maxScale);
    const a0 = Math.PI, a1 = 2 * Math.PI; // upper semicircle, left -> right

    // background track
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(80,220,255,0.16)';
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();

    // boost zone marker (between cruise max and boost max), manual mode only
    if (!superMode && stats.boost > stats.maxSpeed) {
      const z0 = a0 + (stats.maxSpeed / maxScale) * Math.PI;
      ctx.strokeStyle = 'rgba(255,190,90,0.22)';
      ctx.beginPath(); ctx.arc(cx, cy, R, z0, a1); ctx.stroke();
    }

    // progress arc
    const color = superMode ? '#b06bff' : boosting ? '#ffd27a' : '#37d0ff';
    if (t > 0.005) {
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + t * Math.PI); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ticks every quarter
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(159,232,255,0.5)';
    for (let i = 0; i <= 4; i++) {
      const a = a0 + (i / 4) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R - 9), cy + Math.sin(a) * (R - 9));
      ctx.lineTo(cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16));
      ctx.stroke();
    }

    // scale labels
    ctx.fillStyle = 'rgba(159,232,255,0.55)';
    ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0', cx - R - 2, cy + 2 - 12);
    ctx.textAlign = 'right';
    ctx.fillText(superMode ? '25 C' : String(Math.round(maxScale * 10)), cx + R + 3, cy + 2 - 12);

    // needle
    const na = a0 + t * Math.PI;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(na) * (R - 30), cy + Math.sin(na) * (R - 30));
    ctx.lineTo(cx + Math.cos(na) * (R - 6), cy + Math.sin(na) * (R - 6));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  drawRadar(ship, target, pirates = [], police = [], empire = [], pods = [], deathStar = null) {
    const ctx = this.rctx;
    const S = 128, cx = S / 2, cy = S / 2, R = 58;
    ctx.clearRect(0, 0, S, S);

    // rings
    ctx.strokeStyle = 'rgba(80,220,255,0.25)';
    ctx.lineWidth = 1;
    for (const r of [R, R * 0.5]) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();

    _invQ.copy(ship.quaternion).invert();
    const range = 3000;

    const blip = (worldPos, color, size, ring = false) => {
      _rel.copy(worldPos).sub(ship.position).applyQuaternion(_invQ);
      const dist = _rel.length();
      const f = Math.min(1, dist / range);
      const len = Math.hypot(_rel.x, _rel.z) || 1;
      const bx = cx + (_rel.x / len) * f * R;
      const by = cy - (_rel.z / len) * f * R;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      if (ring || _rel.y < -60) {
        ctx.beginPath(); ctx.arc(bx, by, size, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(bx, by, size, 0, Math.PI * 2); ctx.fill();
      }
    };

    if (this.navTargets) {
      for (const t of this.navTargets) {
        const isTarget = target && t.id === target.id;
        const color = t.type === 'station' ? 'rgba(120,255,150,0.9)' : 'rgba(80,200,255,0.9)';
        blip(t.object.position, isTarget ? '#ffd27a' : color, isTarget ? 3.5 : 2.5);
      }
    }
    for (const p of pirates) blip(p.position, '#ff5040', 3);
    for (const p of police) blip(p.position, '#00aaff', 3);
    for (const p of empire) blip(p.position, '#d8e0ff', p.type === 'stardestroyer' ? 4.5 : 3);
    if (deathStar?.alive) blip(deathStar.position, '#d8e0ff', 6.5, true);
    for (const pod of pods) blip(pod.mesh.position, '#ffd27a', 2);

    // player marker
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4); ctx.lineTo(cx - 3, cy + 3); ctx.lineTo(cx + 3, cy + 3);
    ctx.closePath(); ctx.fill();
  }

  updateCombatIndicators(ship, camera, pirates = [], police = [], empire = [], lockState = 'none', lockTarget = null) {
    const hostiles = [...pirates, ...police, ...empire];
    // Build or reuse indicator DOM elements
    while (this.combatEl.children.length < hostiles.length) {
      const el = document.createElement('div');
      el.className = 'combat-marker';
      el.innerHTML = '<div class="cm-bracket"></div><div class="cm-label"></div>';
      this.combatEl.appendChild(el);
    }
    // Hide excess
    for (let i = 0; i < this.combatEl.children.length; i++) {
      this.combatEl.children[i].style.display = i < hostiles.length ? 'block' : 'none';
    }
    if (!camera || hostiles.length === 0) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    for (let i = 0; i < hostiles.length; i++) {
      const h = hostiles[i];
      const el = this.combatEl.children[i];
      const bracket = el.querySelector('.cm-bracket');
      const label = el.querySelector('.cm-label');
      // missile lock paints the target: amber while locking, red when locked
      const isLockTarget = lockTarget && h === lockTarget;
      const hardLock = isLockTarget && lockState === 'locked';
      let color = h.faction === 'police' ? '#00aaff' : h.faction === 'empire' ? '#d8e0ff' : '#44ff66';
      if (hardLock) color = '#ff3030';
      else if (isLockTarget && lockState === 'locking') color = '#ffd27a';

      const dist = h.position.distanceTo(ship.position);
      const meters = dist * 10;
      let distText = meters >= 1000 ? `${(meters / 1000).toFixed(1)}KM` : `${Math.round(meters)}M`;
      if (h.empireName) distText = `${h.empireName} · ${distText}`;

      _ndc.copy(h.position).project(camera);
      const onScreen = _ndc.z < 1 && Math.abs(_ndc.x) < 0.92 && Math.abs(_ndc.y) < 0.88;

      if (onScreen) {
        // On-screen: show targeting bracket at projected position
        const sx = (_ndc.x * 0.5 + 0.5) * W;
        const sy = (-_ndc.y * 0.5 + 0.5) * H;
        el.style.transform = `translate(${sx}px, ${sy}px)`;
        el.className = `combat-marker on-screen${hardLock ? ' lock-hard' : ''}`;
        bracket.style.borderColor = color;
        bracket.style.boxShadow = `0 0 8px ${hardLock ? 'rgba(255,48,48,0.7)' : 'rgba(68,255,102,0.5)'}`;
        bracket.style.display = 'block';
        label.textContent = hardLock ? `LOCKED ${distText}` : distText;
        label.style.color = color;
      } else {
        // Off-screen: show directional arrow at screen edge
        let dx = _ndc.x, dy = -_ndc.y;
        if (_ndc.z > 1) { dx = -dx; dy = -dy; }
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
        const margin = 0.82;
        const sx = (dx * margin * 0.5 + 0.5) * W;
        const sy = (dy * margin * 0.5 + 0.5) * H;
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        el.style.transform = `translate(${sx}px, ${sy}px)`;
        el.className = 'combat-marker off-screen';
        bracket.style.display = 'none';
        label.textContent = `▲ ${distText}`;
        label.style.color = color;
        label.style.transform = `rotate(${ang}deg)`;
      }
    }
  }

  updateCrosshair(lockState) {
    const ch = this.$('.crosshair');
    const label = this.$('.crosshair .lock-label');
    if (ch) {
      ch.classList.toggle('locking', lockState === 'locking');
      ch.classList.toggle('locked', lockState === 'locked');
      if (label) {
        if (lockState === 'locked') {
          label.textContent = 'LOCKED — FIRE [E]';
        } else if (lockState === 'locking') {
          label.textContent = 'LOCKING';
        } else {
          label.textContent = '';
        }
      }
    }
  }
}
