// Universe chat: message feed bottom-left, ENTER to talk while flying.
// Captures keys while the input is open so game bindings don't fire.
const MAX_MESSAGES = 7;
const MESSAGE_TTL = 20000;

export class ChatUI {
  constructor(uiRoot, game) {
    this.game = game;
    this.onSend = null; // set by main.js when a session starts

    this.root = document.createElement('div');
    this.root.id = 'chat';
    this.root.innerHTML = `
      <div id="chat-feed"></div>
      <div id="chat-inputrow" style="display:none">
        <span>SAY:</span><input id="chat-input" maxlength="200" spellcheck="false">
      </div>
    `;
    uiRoot.appendChild(this.root);
    this.feed = this.root.querySelector('#chat-feed');
    this.inputRow = this.root.querySelector('#chat-inputrow');
    this.input = this.root.querySelector('#chat-input');
    this.open = false;

    window.addEventListener('keydown', (e) => this.onKey(e), true);
  }

  inFlight() {
    const g = this.game;
    return g.sm.current === g.states.flight && !g.states.flight.paused;
  }

  onKey(e) {
    if (this.open) {
      e.stopPropagation(); // keep W/S/T/etc. from steering the ship while typing
      if (e.key === 'Enter') {
        const text = this.input.value.trim();
        if (text && this.onSend) this.onSend(text);
        this.close();
      } else if (e.key === 'Escape') {
        this.close();
      }
      return;
    }
    if (e.key === 'Enter' && this.inFlight() && this.onSend) {
      e.stopPropagation();
      this.open = true;
      this.inputRow.style.display = '';
      this.input.value = '';
      // pointer lock swallows focus without a tick's delay
      setTimeout(() => this.input.focus(), 0);
    }
  }

  close() {
    this.open = false;
    this.inputRow.style.display = 'none';
    this.input.blur();
  }

  addMessage(from, text) {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    const name = document.createElement('b');
    name.textContent = `CMDR ${from.toUpperCase()}`;
    el.appendChild(name);
    el.appendChild(document.createTextNode(` ${text}`));
    this.feed.appendChild(el);
    while (this.feed.children.length > MAX_MESSAGES) this.feed.firstChild.remove();
    setTimeout(() => { el.classList.add('chat-fade'); }, MESSAGE_TTL);
  }
}
