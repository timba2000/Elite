import { Graphics } from '../fx/Graphics.js';
import { Net } from '../net/Net.js';
import { Progression } from '../player/Progression.js';

// Title screen + pause overlay + commander sign-in + galactic rankings.
export class MenuUI {
  constructor(uiRoot) {
    this.menu = document.createElement('div');
    this.menu.id = 'menu';
    this.menu.innerHTML = `
      <h1>ELITE</h1>
      <div class="subtitle">INTERSTELLAR TRADER</div>
      <button id="btn-new" class="clickable">New Game</button>
      <button id="btn-continue" class="clickable" style="display:none">Continue</button>
      <button id="btn-gfx" class="clickable">Graphics: ${Graphics.label()}</button>
      <button id="btn-board" class="clickable">Galactic Rankings</button>
      <div id="cmdr-box">
        <div id="cmdr-forms">
          <input id="cmdr-name" maxlength="16" placeholder="COMMANDER NAME" autocomplete="username">
          <input id="cmdr-pin" type="password" maxlength="64" placeholder="PIN" autocomplete="current-password">
          <button id="btn-signin" class="clickable">Sign In</button>
          <button id="btn-register" class="clickable">Register</button>
        </div>
        <div id="cmdr-signed" style="display:none">
          <span id="cmdr-label"></span>
          <button id="btn-signout" class="clickable">Sign Out</button>
        </div>
        <div id="cmdr-status"></div>
      </div>
      <div class="controls">
        <b>MOUSE</b> steer &nbsp; <b>W/S</b> throttle &nbsp; <b>SHIFT</b> boost &nbsp; <b>Q/A</b> roll left &nbsp; <b>D</b> roll right &nbsp; <b>E</b> fire missile when locked<br>
        <b>SPACE / CLICK</b> fire laser &nbsp; <b>T</b> cycle target &nbsp; <b>X</b> deploy chaff &nbsp; <b>J</b> supercruise &nbsp; <b>F</b> request docking &nbsp; <b>V</b> view &nbsp; <b>M</b> mute &nbsp; <b>ESC</b> pause<br>
        <b>C</b> surface scan &nbsp; <b>N</b> nav computer &nbsp; <b>H</b> hyperspace jump (8 fuel) &nbsp; <b>G</b> galactic jump<br>
        Buy low, sell high. Watch for pirates. Fly into the aperture slowly — or save up for a docking computer.
      </div>
    `;
    uiRoot.appendChild(this.menu);

    this.board = document.createElement('div');
    this.board.id = 'board';
    this.board.className = 'panel';
    this.board.innerHTML = `
      <h2>GALACTIC RANKINGS</h2>
      <div id="board-body">Contacting GALNET...</div>
      <button id="btn-board-close" class="clickable">Close</button>
    `;
    uiRoot.appendChild(this.board);
    this.board.querySelector('#btn-board-close').onclick = () => this.hideBoard();

    this.pause = document.createElement('div');
    this.pause.id = 'pause';
    this.pause.className = 'panel';
    this.pause.innerHTML = `
      <h2>PAUSED</h2>
      <button id="btn-resume" class="clickable">Resume</button>
      <button id="btn-save" class="clickable">Save</button>
      <button id="btn-gfx-pause" class="clickable">Graphics: ${Graphics.label()}</button>
      <button id="btn-quit" class="clickable">Quit to Menu</button>
    `;
    uiRoot.appendChild(this.pause);

    // Graphics-quality cycler lives on both screens; the setting itself
    // persists in localStorage and applies instantly via Graphics listeners.
    const syncGfxLabels = () => {
      const label = `Graphics: ${Graphics.label()}`;
      this.menu.querySelector('#btn-gfx').textContent = label;
      this.pause.querySelector('#btn-gfx-pause').textContent = label;
    };
    this.menu.querySelector('#btn-gfx').onclick = () => Graphics.cycle();
    this.pause.querySelector('#btn-gfx-pause').onclick = () => Graphics.cycle();
    Graphics.onChange(syncGfxLabels);

    this.menu.querySelector('#btn-board').onclick = () => this.showBoard();
    this.wireCommanderBox();
  }

  wireCommanderBox() {
    const q = (sel) => this.menu.querySelector(sel);
    const status = q('#cmdr-status');
    const submit = async (kind) => {
      const name = q('#cmdr-name').value.trim();
      const pin = q('#cmdr-pin').value;
      if (!name || !pin) { status.textContent = 'ENTER NAME AND PIN'; return; }
      status.textContent = 'CONTACTING GALNET...';
      const r = kind === 'register' ? await Net.register(name, pin) : await Net.login(name, pin);
      status.textContent = r.error ? r.error.toUpperCase() : '';
      this.refreshCommander();
      if (!r.error) this.onSessionChange?.();
    };
    q('#btn-signin').onclick = () => submit('login');
    q('#btn-register').onclick = () => submit('register');
    q('#cmdr-pin').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit('login'); });
    q('#btn-signout').onclick = async () => {
      await Net.logout();
      status.textContent = '';
      this.refreshCommander();
      this.onSessionChange?.();
    };
    this.refreshCommander();
  }

  refreshCommander() {
    const q = (sel) => this.menu.querySelector(sel);
    q('#cmdr-forms').style.display = Net.loggedIn ? 'none' : '';
    q('#cmdr-signed').style.display = Net.loggedIn ? '' : 'none';
    if (Net.loggedIn) {
      q('#cmdr-label').textContent = `CMDR ${Net.name.toUpperCase()} · SHARED UNIVERSE ONLINE`;
    }
  }

  async showBoard() {
    this.board.classList.add('visible');
    const body = this.board.querySelector('#board-body');
    body.textContent = 'Contacting GALNET...';
    const entries = await Net.leaderboard();
    if (!entries) { body.textContent = 'GALNET UNREACHABLE'; return; }
    if (!entries.length) { body.textContent = 'NO COMMANDERS REGISTERED YET'; return; }
    const rows = entries.map((e, i) => {
      const rank = Progression.combatRank({ career: { combatScore: e.combatScore } }).name;
      const self = Net.loggedIn && e.name.toLowerCase() === Net.name.toLowerCase();
      return `<tr class="${self ? 'board-self' : ''}">
        <td>${i + 1}</td><td>${escapeHtml(e.name.toUpperCase())}</td>
        <td class="num">${Number(e.credits).toLocaleString()} CR</td>
        <td class="num">LV ${e.level}</td><td>${rank}</td><td class="num">G${e.galaxy}</td>
      </tr>`;
    }).join('');
    body.innerHTML = `<table id="board-table">
      <tr><th>#</th><th>COMMANDER</th><th>CREDITS</th><th>LEVEL</th><th>COMBAT</th><th>GALAXY</th></tr>
      ${rows}</table>`;
  }

  hideBoard() { this.board.classList.remove('visible'); }

  show({ hasSave, onNew, onContinue, onSessionChange }) {
    this.menu.classList.add('visible');
    this.onSessionChange = onSessionChange;
    this.setHasSave(hasSave);
    this.menu.querySelector('#btn-new').onclick = onNew;
    this.menu.querySelector('#btn-continue').onclick = onContinue;
    this.refreshCommander();
  }

  setHasSave(hasSave) {
    this.menu.querySelector('#btn-continue').style.display = hasSave ? '' : 'none';
  }

  hide() {
    this.menu.classList.remove('visible');
    this.hideBoard();
  }

  showPause({ onResume, onSave, onQuit }) {
    this.pause.classList.add('visible');
    this.pause.querySelector('#btn-resume').onclick = onResume;
    this.pause.querySelector('#btn-save').onclick = onSave;
    this.pause.querySelector('#btn-quit').onclick = onQuit;
  }

  hidePause() { this.pause.classList.remove('visible'); }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
