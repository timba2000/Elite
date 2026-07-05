// Title screen + pause overlay.
export class MenuUI {
  constructor(uiRoot) {
    this.menu = document.createElement('div');
    this.menu.id = 'menu';
    this.menu.innerHTML = `
      <h1>ELITE</h1>
      <div class="subtitle">INTERSTELLAR TRADER</div>
      <button id="btn-new" class="clickable">New Game</button>
      <button id="btn-new-cheat" class="clickable amber">New Game (Cheat)</button>
      <button id="btn-continue" class="clickable" style="display:none">Continue</button>
      <button id="btn-continue-cheat" class="clickable amber" style="display:none">Continue (Cheat)</button>
      <div class="controls">
        <b>MOUSE</b> steer &nbsp; <b>W/S</b> throttle &nbsp; <b>SHIFT</b> boost &nbsp; <b>Q/A</b> roll left &nbsp; <b>D</b> roll right &nbsp; <b>E</b> fire missile when locked (rolls right until a launcher is fitted)<br>
        <b>SPACE / CLICK</b> fire laser &nbsp; <b>T</b> cycle target &nbsp; <b>J</b> supercruise &nbsp; <b>F</b> request docking &nbsp; <b>G</b> galactic jump &nbsp; <b>V</b> view &nbsp; <b>M</b> mute &nbsp; <b>ESC</b> pause<br>
        Buy low, sell high. Watch for pirates. Fly into the aperture slowly — or save up for a docking computer.
      </div>
    `;
    uiRoot.appendChild(this.menu);

    this.pause = document.createElement('div');
    this.pause.id = 'pause';
    this.pause.className = 'panel';
    this.pause.innerHTML = `
      <h2>PAUSED</h2>
      <button id="btn-resume" class="clickable">Resume</button>
      <button id="btn-save" class="clickable">Save</button>
      <button id="btn-quit" class="clickable">Quit to Menu</button>
    `;
    uiRoot.appendChild(this.pause);
  }

  show({ hasSave, onNew, onNewCheat, onContinue, onContinueCheat }) {
    this.menu.classList.add('visible');
    const cont = this.menu.querySelector('#btn-continue');
    const contCheat = this.menu.querySelector('#btn-continue-cheat');
    const nCheat = this.menu.querySelector('#btn-new-cheat');
    
    cont.style.display = hasSave ? '' : 'none';
    contCheat.style.display = hasSave ? '' : 'none';
    
    this.menu.querySelector('#btn-new').onclick = onNew;
    nCheat.onclick = onNewCheat;
    cont.onclick = onContinue;
    contCheat.onclick = onContinueCheat;
  }

  hide() { this.menu.classList.remove('visible'); }

  showPause({ onResume, onSave, onQuit }) {
    this.pause.classList.add('visible');
    this.pause.querySelector('#btn-resume').onclick = onResume;
    this.pause.querySelector('#btn-save').onclick = onSave;
    this.pause.querySelector('#btn-quit').onclick = onQuit;
  }

  hidePause() { this.pause.classList.remove('visible'); }
}
