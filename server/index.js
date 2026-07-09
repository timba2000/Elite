// Elite game server. Phase 1: serves the built client. Later phases add
// accounts, the shared galaxy economy, and the realtime presence layer.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
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
