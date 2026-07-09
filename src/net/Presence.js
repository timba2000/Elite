import { Net } from './Net.js';

// Realtime link to the shared universe: streams our flight state ~10x/sec,
// receives other commanders' ships, universe chat, and GALNET pushes.
// Fails soft everywhere — no socket, no problem, the game plays on.
const SEND_INTERVAL = 0.1;   // seconds between state updates
const PEER_TIMEOUT = 5000;   // ms without an update before a peer despawns

export class Presence {
  constructor({ onChat, onToast, onPeerGone } = {}) {
    this.onChat = onChat;
    this.onToast = onToast;
    this.onPeerGone = onPeerGone;
    this.ws = null;
    this.id = null;
    this.peers = new Map(); // id -> { name, ship, sc, snaps: [{t, p, q, v}] }
    this.sendAccum = 0;
    this.sentRoom = null;   // "g1s0" we last told the server about
    this.retryDelay = 1000;
    this.closed = false;
  }

  connect(galaxy, system) {
    if (!Net.loggedIn || this.ws) return;
    this.closed = false;
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    let ws;
    try {
      ws = new WebSocket(`${proto}${location.host}/ws`);
    } catch {
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retryDelay = 1000;
      this.send({ t: 'hello', token: Net.session.token, galaxy, system });
      this.sentRoom = `g${galaxy}s${system}`;
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.handle(msg);
    };
    ws.onclose = () => {
      this.ws = null;
      this.id = null;
      this.clearPeers();
      if (!this.closed) {
        // reconnect with backoff while a session is running
        setTimeout(() => this.connect(galaxy, system), this.retryDelay);
        this.retryDelay = Math.min(15000, this.retryDelay * 2);
      }
    };
    ws.onerror = () => {}; // onclose handles retry
  }

  disconnect() {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
    this.clearPeers();
  }

  clearPeers() {
    for (const id of this.peers.keys()) this.onPeerGone?.(id);
    this.peers.clear();
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  handle(msg) {
    switch (msg.t) {
      case 'welcome':
        this.id = msg.id;
        break;
      case 'peer': {
        let peer = this.peers.get(msg.id);
        if (!peer) {
          peer = { name: msg.name, ship: msg.ship, sc: false, snaps: [] };
          this.peers.set(msg.id, peer);
        }
        peer.ship = msg.ship;
        peer.sc = msg.sc;
        peer.snaps.push({ t: msg.ts, p: msg.p, q: msg.q, v: msg.v, rx: performance.now() });
        if (peer.snaps.length > 6) peer.snaps.shift();
        break;
      }
      case 'gone':
        this.peers.delete(msg.id);
        this.onPeerGone?.(msg.id);
        break;
      case 'join':
        this.onToast?.(`CMDR ${msg.name.toUpperCase()} ENTERED THE SYSTEM`, '');
        break;
      case 'leave':
        this.onToast?.(`CMDR ${msg.name.toUpperCase()} LEFT THE SYSTEM`, '');
        break;
      case 'chat':
        this.onChat?.(msg.from, msg.text);
        break;
      case 'galnet':
        for (const line of msg.lines) this.onToast?.(`GALNET — ${line}`, 'gold');
        break;
    }
  }

  // called every frame from FlightState while flying
  flightTick(dt, game, supercruise) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const pd = game.playerData;
    const room = `g${pd.galaxy}s${pd.system}`;
    if (room !== this.sentRoom) {
      this.sentRoom = room;
      this.clearPeers(); // jumped systems: everyone here is stale
      this.send({ t: 'where', galaxy: pd.galaxy, system: pd.system });
    }
    this.sendAccum += dt;
    if (this.sendAccum < SEND_INTERVAL) return;
    this.sendAccum = 0;
    const pos = game.ship.group.position, q = game.ship.group.quaternion, v = game.ship.velocity;
    this.send({
      t: 'state',
      p: [rnd(pos.x), rnd(pos.y), rnd(pos.z)],
      q: [rnd3(q.x), rnd3(q.y), rnd3(q.z), rnd3(q.w)],
      v: [rnd(v.x), rnd(v.y), rnd(v.z)],
      ship: pd.shipId,
      sc: !!supercruise,
    });
    // prune silent peers
    const now = performance.now();
    for (const [id, peer] of this.peers) {
      const last = peer.snaps[peer.snaps.length - 1];
      if (last && now - last.rx > PEER_TIMEOUT) {
        this.peers.delete(id);
        this.onPeerGone?.(id);
      }
    }
  }

  sendDock() { this.send({ t: 'dock' }); }
  sendChat(text) { this.send({ t: 'chat', text }); }
}

function rnd(x) { return Math.round(x * 10) / 10; }
function rnd3(x) { return Math.round(x * 1000) / 1000; }
