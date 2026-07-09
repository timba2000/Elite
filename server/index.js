// Elite game server: serves the built client, the shared-universe API
// (commander accounts, cloud saves, leaderboard, shared galaxy markets) and
// the realtime presence layer (live ships, chat, GALNET pushes) over /ws.
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createStorage } from './storage.js';
import { createApi } from './routes.js';
import { SharedMarkets } from './sharedMarket.js';
import { attachPresence } from './presence.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const storage = await createStorage();
console.log(`Storage backend: ${storage.kind}`);

const app = express();
app.use(express.json({ limit: '1mb' }));
const markets = new SharedMarkets(storage);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), storage: storage.kind, online: presence.onlineCount() });
});

app.use('/api', createApi(storage, markets));

// API errors respond as JSON, never as the SPA fallback page.
app.use('/api', (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('dist/index.html not found. Run "npm run build" before "npm start".');
  process.exit(1);
}

app.use(express.static(distDir));
// SPA fallback: anything that isn't a file or /api route gets the game shell.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

const httpServer = http.createServer(app);
const presence = attachPresence(httpServer, storage);

// GALNET: tick every cached market once a minute and push fresh headlines to
// the commanders flying in that system right now (everyone else reconciles
// shared events on their next dock).
setInterval(async () => {
  for (const [key, entry] of markets.entries) {
    markets.tick(entry);
    const lines = entry.market.consumeNews();
    presence.pushNews(key, lines);
    if (lines.length) await markets.persist(key, entry);
  }
}, 60000);

const port = Number(process.env.PORT) || 5000;
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Elite server listening on http://0.0.0.0:${port}`);
});
