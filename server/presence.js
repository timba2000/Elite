// Realtime presence over WebSockets: commanders see each other's ships in the
// same (galaxy, system), share a universe-wide chat, and get GALNET pushes.
// Positions are client-authoritative and relayed, not simulated — right-sized
// for playing with friends.
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const MAX_CHAT_LEN = 200;
const CHAT_COOLDOWN_MS = 800;

export function attachPresence(httpServer, storage) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map(); // ws -> { id, name, room, lastChatAt, alive }

  const roomOf = (galaxy, system) => `g${galaxy}s${system}`;

  function send(ws, msg) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  function broadcastRoom(room, msg, exceptWs = null) {
    for (const [ws, c] of clients) {
      if (c.room === room && ws !== exceptWs) send(ws, msg);
    }
  }

  function broadcastAll(msg, exceptWs = null) {
    for (const [ws] of clients) {
      if (ws !== exceptWs) send(ws, msg);
    }
  }

  function joinRoom(ws, c, galaxy, system) {
    const next = roomOf(galaxy, system);
    if (c.room === next) return;
    if (c.room) broadcastRoom(c.room, { t: 'gone', id: c.id }, ws);
    if (c.room) broadcastRoom(c.room, { t: 'leave', name: c.name }, ws);
    c.room = next;
    broadcastRoom(next, { t: 'join', name: c.name }, ws);
  }

  wss.on('connection', (ws) => {
    let c = null;

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString().slice(0, 4096)); } catch { return; }

      if (!c) {
        // first message must authenticate
        if (msg.t !== 'hello' || typeof msg.token !== 'string') return ws.close();
        const session = await storage.getSession(msg.token);
        if (!session) { send(ws, { t: 'denied' }); return ws.close(); }
        c = { id: crypto.randomUUID().slice(0, 8), name: session.name, room: null, lastChatAt: 0, alive: true };
        clients.set(ws, c);
        send(ws, { t: 'welcome', id: c.id, name: c.name });
        joinRoom(ws, c, Number(msg.galaxy) || 1, Number(msg.system) || 0);
        return;
      }

      switch (msg.t) {
        case 'where':
          joinRoom(ws, c, Number(msg.galaxy) || 1, Number(msg.system) || 0);
          break;
        case 'state': {
          // relay flight state to everyone else in the system
          const { p, q, v, ship, sc } = msg;
          if (!Array.isArray(p) || p.length !== 3 || !Array.isArray(q) || q.length !== 4) break;
          broadcastRoom(c.room, {
            t: 'peer', id: c.id, name: c.name,
            ship: typeof ship === 'string' ? ship.slice(0, 24) : 'trader',
            p, q, v: Array.isArray(v) && v.length === 3 ? v : [0, 0, 0],
            sc: !!sc, ts: Date.now(),
          }, ws);
          break;
        }
        case 'dock':
          // ship vanished into a station; peers despawn it but chat continues
          broadcastRoom(c.room, { t: 'gone', id: c.id }, ws);
          break;
        case 'chat': {
          const now = Date.now();
          if (now - c.lastChatAt < CHAT_COOLDOWN_MS) break;
          const text = String(msg.text ?? '').trim().slice(0, MAX_CHAT_LEN);
          if (!text) break;
          c.lastChatAt = now;
          // sender excluded: their client echoes the message locally
          broadcastAll({ t: 'chat', from: c.name, room: c.room, text }, ws);
          break;
        }
      }
    });

    ws.on('pong', () => { if (c) c.alive = true; });

    ws.on('close', () => {
      if (!c) return;
      broadcastRoom(c.room, { t: 'gone', id: c.id }, ws);
      broadcastRoom(c.room, { t: 'leave', name: c.name }, ws);
      clients.delete(ws);
    });
  });

  // drop dead connections
  const heartbeat = setInterval(() => {
    for (const [ws, c] of clients) {
      if (!c.alive) { ws.terminate(); continue; }
      c.alive = false;
      ws.ping();
    }
  }, 30000);
  wss.on('close', () => clearInterval(heartbeat));

  return {
    // push GALNET headlines to everyone currently in that system
    pushNews(room, lines) {
      if (lines.length) broadcastRoom(room, { t: 'galnet', lines });
    },
    onlineCount() { return clients.size; },
  };
}
