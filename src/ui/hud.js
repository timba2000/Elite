import * as THREE from 'three';

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
      </div>
      <div class="hud-speed">
        <div class="big">0</div>
        <div>M/S · THR <span class="thr">0</span>%</div>
        <div class="mode"></div>
      </div>
      <div class="hud-status">
        <div class="credits">0 CR</div>
        <div class="cargo">CARGO 0/20</div>
        <div class="loc"></div>
      </div>
      <canvas id="radar" width="128" height="128"></canvas>
      <div class="hud-target">
        <div class="tname">NO TARGET</div>
        <div class="tdist"></div>
        <div class="thint">T — CYCLE TARGET</div>
      </div>
      <div class="crosshair"><div class="dot"></div></div>
      <div class="hud-prompt"></div>
      <div id="toasts"></div>
      <div class="offscreen-arrow" style="display:none"></div>
      <div id="damage-flash"></div>
      <div id="fade-overlay"></div>
    `;
    uiRoot.appendChild(this.root);

    this.$ = (sel) => this.root.querySelector(sel);
    this.bars = {
      hull: this.$('.bar.hull .fill'),
      shield: this.$('.bar.shield .fill'),
      energy: this.$('.bar.energy .fill'),
    };
    this.speedEl = this.$('.hud-speed .big');
    this.thrEl = this.$('.hud-speed .thr');
    this.modeEl = this.$('.hud-speed .mode');
    this.creditsEl = this.$('.hud-status .credits');
    this.cargoEl = this.$('.hud-status .cargo');
    this.locEl = this.$('.hud-status .loc');
    this.radar = this.$('#radar');
    this.rctx = this.radar.getContext('2d');
    this.tname = this.$('.tname');
    this.tdist = this.$('.tdist');
    this.promptEl = this.$('.hud-prompt');
    this.toasts = this.$('#toasts');
    this.arrow = this.$('.offscreen-arrow');
    this.flashEl = this.$('#damage-flash');
    this.fadeEl = this.$('#fade-overlay');
    this.flashT = 0;
  }

  show() { this.root.classList.add('visible'); }
  hide() { this.root.classList.remove('visible'); }

  setPrompt(text) {
    if (this.promptEl.textContent !== text) this.promptEl.textContent = text;
  }

  toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  damageFlash() { this.flashT = 0.25; }

  fade(on) { this.fadeEl.classList.toggle('on', on); }

  update(dt, { ship, playerData, stats, target, mode, camera, pirates, pods }) {
    // bars
    this.bars.hull.style.transform = `scaleX(${Math.max(0, playerData.hull / stats.hullMax)})`;
    this.bars.shield.style.transform = `scaleX(${stats.shieldMax > 0 ? ship.shield / stats.shieldMax : 0})`;
    this.bars.energy.style.transform = `scaleX(${ship.energy / 100})`;

    // speed / mode
    this.speedEl.textContent = Math.round(ship.velocity.length());
    this.thrEl.textContent = Math.round(ship.throttle * 100);
    this.modeEl.textContent =
      mode === 'super' ? 'SUPERCRUISE' : ship.boosting ? 'BOOST' : '';

    // status
    this.creditsEl.textContent = `${playerData.credits.toLocaleString()} CR`;
    this.cargoEl.textContent = `CARGO ${playerData.cargoUsed()}/${stats.cargoMax}`;

    // target
    if (target) {
      this.tname.textContent = target.name;
      const d = target.object.position.distanceTo(ship.position);
      this.tdist.textContent = d > 1000 ? `${(d / 1000).toFixed(1)} KM` : `${Math.round(d)} M`;
    } else {
      this.tname.textContent = 'NO TARGET';
      this.tdist.textContent = '';
    }

    this.drawRadar(ship, target, pirates, pods);
    this.updateArrow(ship, target, camera);

    // damage flash decay
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flashEl.style.opacity = Math.max(0, this.flashT / 0.25);
    }
  }

  drawRadar(ship, target, pirates = [], pods = []) {
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
    for (const pod of pods) blip(pod.mesh.position, '#ffd27a', 2);

    // player marker
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4); ctx.lineTo(cx - 3, cy + 3); ctx.lineTo(cx + 3, cy + 3);
    ctx.closePath(); ctx.fill();
  }

  updateArrow(ship, target, camera) {
    if (!target || !camera) { this.arrow.style.display = 'none'; return; }
    _ndc.copy(target.object.position).project(camera);
    const onScreen = _ndc.z < 1 && Math.abs(_ndc.x) < 0.95 && Math.abs(_ndc.y) < 0.92;
    if (onScreen) { this.arrow.style.display = 'none'; return; }

    let dx = _ndc.x, dy = -_ndc.y;
    if (_ndc.z > 1) { dx = -dx; dy = -dy; }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const margin = 0.86;
    const sx = (dx * margin * 0.5 + 0.5) * window.innerWidth;
    const sy = (dy * margin * 0.5 + 0.5) * window.innerHeight;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    this.arrow.style.display = 'block';
    this.arrow.style.transform = `translate(${sx}px, ${sy}px) rotate(${ang}deg)`;
  }
}
