// Elite game server: serves the built client and the shared-universe API
// (commander accounts, cloud saves, leaderboard, shared galaxy markets).
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createStorage } from './storage.js';
import { createApi } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const storage = await createStorage();
console.log(`Storage backend: ${storage.kind}`);

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), storage: storage.kind });
});

app.use('/api', createApi(storage));

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

const port = Number(process.env.PORT) || 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Elite server listening on http://0.0.0.0:${port}`);
});
