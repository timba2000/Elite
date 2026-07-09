// Persistence layer. Postgres when DATABASE_URL is set (Replit production),
// otherwise a JSON file under server/data/ so local dev needs no database.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saves (
  player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  blob JSONB NOT NULL,
  credits BIGINT DEFAULT 0,
  level INTEGER DEFAULT 1,
  combat_score INTEGER DEFAULT 0,
  galaxy INTEGER DEFAULT 1,
  ship_id TEXT DEFAULT 'trader',
  cheated BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS markets (
  key TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
`;

class PgStorage {
  constructor(url) {
    this.url = url;
    this.pool = null;
  }

  async init() {
    const pg = (await import('pg')).default;
    const local = /localhost|127\.0\.0\.1/.test(this.url);
    this.pool = new pg.Pool({
      connectionString: this.url,
      ssl: local ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
    await this.pool.query(BOOTSTRAP_SQL);
  }

  async getPlayerByName(name) {
    const r = await this.pool.query(
      'SELECT id, name, pin_hash FROM players WHERE lower(name) = lower($1)', [name]);
    return r.rows[0] || null;
  }

  async createPlayer(name, pinHash) {
    const r = await this.pool.query(
      'INSERT INTO players (name, pin_hash) VALUES ($1, $2) RETURNING id, name', [name, pinHash]);
    return r.rows[0];
  }

  async createSession(token, playerId) {
    await this.pool.query('INSERT INTO sessions (token, player_id) VALUES ($1, $2)', [token, playerId]);
  }

  async getSession(token) {
    const r = await this.pool.query(
      `SELECT s.player_id, p.name FROM sessions s JOIN players p ON p.id = s.player_id
       WHERE s.token = $1`, [token]);
    return r.rows[0] ? { playerId: r.rows[0].player_id, name: r.rows[0].name } : null;
  }

  async deleteSession(token) {
    await this.pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  }

  async putSave(playerId, blob, s) {
    await this.pool.query(
      `INSERT INTO saves (player_id, blob, credits, level, combat_score, galaxy, ship_id, cheated, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (player_id) DO UPDATE SET blob = $2, credits = $3, level = $4,
         combat_score = $5, galaxy = $6, ship_id = $7, cheated = $8, updated_at = now()`,
      [playerId, blob, s.credits, s.level, s.combatScore, s.galaxy, s.shipId, s.cheated]);
  }

  async getSave(playerId) {
    const r = await this.pool.query('SELECT blob FROM saves WHERE player_id = $1', [playerId]);
    return r.rows[0] ? r.rows[0].blob : null;
  }

  async leaderboard(limit = 20) {
    const r = await this.pool.query(
      `SELECT p.name, s.credits, s.level, s.combat_score, s.galaxy, s.ship_id, s.updated_at
       FROM saves s JOIN players p ON p.id = s.player_id
       WHERE NOT s.cheated ORDER BY s.credits DESC LIMIT $1`, [limit]);
    return r.rows.map((x) => ({
      name: x.name, credits: Number(x.credits), level: x.level,
      combatScore: x.combat_score, galaxy: x.galaxy, shipId: x.ship_id,
      updatedAt: x.updated_at,
    }));
  }

  async getMarket(key) {
    const r = await this.pool.query('SELECT state FROM markets WHERE key = $1', [key]);
    return r.rows[0] ? r.rows[0].state : null;
  }

  async putMarket(key, state) {
    await this.pool.query(
      `INSERT INTO markets (key, state, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET state = $2, updated_at = now()`, [key, state]);
  }
}

class FileStorage {
  constructor() {
    this.file = path.join(__dirname, 'data', 'db.json');
    this.db = { players: [], nextId: 1, sessions: {}, saves: {}, markets: {} };
    this.writeTimer = null;
  }

  async init() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    try {
      this.db = { ...this.db, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    } catch { /* fresh database */ }
  }

  flush() {
    clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      fs.writeFile(this.file, JSON.stringify(this.db), () => {});
    }, 250);
  }

  async getPlayerByName(name) {
    return this.db.players.find((p) => p.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async createPlayer(name, pinHash) {
    const p = { id: this.db.nextId++, name, pin_hash: pinHash };
    this.db.players.push(p);
    this.flush();
    return { id: p.id, name: p.name };
  }

  async createSession(token, playerId) {
    this.db.sessions[token] = playerId;
    this.flush();
  }

  async getSession(token) {
    const playerId = this.db.sessions[token];
    if (!playerId) return null;
    const p = this.db.players.find((x) => x.id === playerId);
    return p ? { playerId, name: p.name } : null;
  }

  async deleteSession(token) {
    delete this.db.sessions[token];
    this.flush();
  }

  async putSave(playerId, blob, summary) {
    this.db.saves[playerId] = { blob, ...summary, updatedAt: new Date().toISOString() };
    this.flush();
  }

  async getSave(playerId) {
    return this.db.saves[playerId]?.blob ?? null;
  }

  async leaderboard(limit = 20) {
    return Object.entries(this.db.saves)
      .filter(([, s]) => !s.cheated)
      .map(([pid, s]) => ({
        name: this.db.players.find((p) => p.id === Number(pid))?.name || '?',
        credits: s.credits, level: s.level, combatScore: s.combatScore,
        galaxy: s.galaxy, shipId: s.shipId, updatedAt: s.updatedAt,
      }))
      .sort((a, b) => b.credits - a.credits)
      .slice(0, limit);
  }

  async getMarket(key) {
    return this.db.markets[key] ?? null;
  }

  async putMarket(key, state) {
    this.db.markets[key] = state;
    this.flush();
  }
}

export async function createStorage() {
  const url = process.env.DATABASE_URL;
  const storage = url ? new PgStorage(url) : new FileStorage();
  await storage.init();
  storage.kind = url ? 'postgres' : 'file';
  return storage;
}
