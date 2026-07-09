# ELITE — Interstellar Trader

A browser-based 3D space trading game built with Three.js + Vite. Trade cargo between worlds, fight pirates, upgrade your ship, and compete on the leaderboard.

## Stack

- **Frontend**: Three.js + Vite (bundled to `dist/`)
- **Backend**: Express.js serving the built client + shared-universe API
- **Database**: PostgreSQL (Replit managed) — players, sessions, cloud saves, markets

## How to run

The workflow **"Start application"** runs `node server/index.js` on port 5000.

The Express server:
1. Bootstraps the database schema on startup (idempotent `CREATE TABLE IF NOT EXISTS`)
2. Serves `dist/` as static files (SPA with fallback)
3. Exposes `/api/*` routes for auth, saves, leaderboard, and shared markets

### After code changes

**Frontend changes** — rebuild and restart:
```bash
npm run build
# then restart the "Start application" workflow
```

**Backend-only changes** — just restart the workflow (no rebuild needed).

### Development mode (hot reload)

To run Vite dev server with hot reload alongside the API server:
```bash
# Terminal 1 — backend
node server/index.js

# Terminal 2 — frontend dev (proxies /api to port 5000)
npm run dev   # http://localhost:5173
```

## Environment secrets

| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | Signs session tokens (already set) |
| `DATABASE_URL` | PostgreSQL connection string (auto-provided by Replit) |

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server health + storage backend |
| POST | `/api/auth/register` | Create commander account |
| POST | `/api/auth/login` | Login, returns session token |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/save` | Download cloud save |
| PUT | `/api/save` | Upload cloud save |
| GET | `/api/leaderboard` | Top 20 commanders by credits |
| GET | `/api/market/:galaxy/:system` | Shared market state |
| POST | `/api/market/:galaxy/:system/trade` | Execute a trade |

## User preferences

_No preferences recorded yet._
