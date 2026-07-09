// REST API: commander accounts, cloud saves, leaderboard, shared markets.
import crypto from 'node:crypto';
import express from 'express';
import { hashPin, verifyPin, validCredentials, requireAuth } from './auth.js';
import { SharedMarkets } from './sharedMarket.js';

// Leaderboard columns pulled out of the opaque save blob.
function summarize(blob) {
  const p = blob?.player ?? {};
  return {
    credits: Math.max(0, Math.floor(p.credits ?? 0)),
    level: p.level ?? 1,
    combatScore: p.career?.combatScore ?? 0,
    galaxy: p.galaxy ?? 1,
    shipId: typeof p.shipId === 'string' ? p.shipId.slice(0, 32) : 'trader',
    cheated: !!p.cheated,
  };
}

export function createApi(storage, markets = new SharedMarkets(storage)) {
  const api = express.Router();
  const auth = requireAuth(storage);

  const issueSession = async (player) => {
    const token = crypto.randomUUID();
    await storage.createSession(token, player.id);
    return { token, name: player.name };
  };

  api.post('/auth/register', async (req, res) => {
    const { name, pin } = req.body ?? {};
    const bad = validCredentials(name, pin);
    if (bad) return res.status(400).json({ error: bad });
    if (await storage.getPlayerByName(name.trim())) {
      return res.status(409).json({ error: 'That commander name is taken' });
    }
    const player = await storage.createPlayer(name.trim(), hashPin(pin));
    res.json(await issueSession(player));
  });

  api.post('/auth/login', async (req, res) => {
    const { name, pin } = req.body ?? {};
    const player = typeof name === 'string' ? await storage.getPlayerByName(name.trim()) : null;
    if (!player || typeof pin !== 'string' || !verifyPin(pin, player.pin_hash)) {
      return res.status(401).json({ error: 'Wrong name or PIN' });
    }
    res.json(await issueSession(player));
  });

  api.post('/auth/logout', auth, async (req, res) => {
    await storage.deleteSession(req.token);
    res.json({ ok: true });
  });

  api.get('/save', auth, async (req, res) => {
    const blob = await storage.getSave(req.player.playerId);
    if (!blob) return res.status(404).json({ error: 'No cloud save' });
    res.json({ blob });
  });

  api.put('/save', auth, async (req, res) => {
    const { blob } = req.body ?? {};
    if (!blob || blob.version !== 1 || !blob.player) {
      return res.status(400).json({ error: 'Bad save blob' });
    }
    await storage.putSave(req.player.playerId, blob, summarize(blob));
    res.json({ ok: true });
  });

  api.get('/leaderboard', async (_req, res) => {
    res.json({ entries: await storage.leaderboard(20) });
  });

  api.get('/market/:galaxy/:system', async (req, res) => {
    const galaxy = Number(req.params.galaxy), system = Number(req.params.system);
    if (!markets.validCoords(galaxy, system)) return res.status(400).json({ error: 'Bad coords' });
    const entry = await markets.get(galaxy, system);
    res.json({ state: entry.market.serialize() });
  });

  api.post('/market/:galaxy/:system/trade', auth, async (req, res) => {
    const galaxy = Number(req.params.galaxy), system = Number(req.params.system);
    if (!markets.validCoords(galaxy, system)) return res.status(400).json({ error: 'Bad coords' });
    const { planetId, goodId, qty, isBuy } = req.body ?? {};
    const result = await markets.trade(galaxy, system, planetId, goodId, qty, isBuy);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  });

  return api;
}
