# ELITE — Interstellar Trader

A browser-based 3D space trading game. You own a run-down, beat-up trading ship.
Hop between the nine worlds of the Sol system buying low and selling high,
dock at rotating stations, upgrade your rust bucket into something respectable —
and fight off the pirates who want your cargo.

Built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).
All graphics are 100% procedural — every planet, nebula, ship and texture is
generated in code. No asset files.

## Run it

```bash
npm install
npm run dev        # opens at http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview
```

## How to play

| Control | Action |
|---|---|
| Mouse (click canvas first) | Steer — pointer-lock virtual stick |
| Arrow keys | Steer (keyboard alternative) |
| `W` / `S` | Throttle up / down |
| `Shift` | Boost (drains energy) |
| `Q` / `A` / `D` | Roll left / right |
| `Space` / Left click | Fire lasers |
| `E` | Fire missile (when target lock is active) |
| `X` | Deploy Chaff countermeasure (breaks enemy missile locks) |
| `T` | Cycle nav target |
| `J` | Supercruise to target / drop out |
| `F` | Request docking (when in range of a station) |
| `V` | Toggle cockpit / external view |
| `M` | Mute / unmute sound |
| `F5` | Quick save |
| `Esc` | Pause |

### The loop

1. **Trade** — every world exports some goods cheap (green) and pays a premium
   for imports (red). Food from the agri world sells well at the mining colony;
   ore flows back to the refinery; luxuries fetch a fortune at the tourist
   orbital. Prices drift over time and react to your own trading.
2. **Fight** — supercruising with a hold full of cargo attracts pirates.
   Interdictions drop you into real-time dogfights. Kills pay bounties and
   sometimes drop scoopable cargo pods. Taking hull hits below 50% can breach
   your cargo hatch. Fleeing is always an option.
3. **Upgrade** — engines, lasers, shields, hull plating and cargo pods, four
   tiers each. Your ship visibly sheds its rust as you invest in it.
4. **Don't die** — destruction costs you your cargo and 10% of your credits.
   The game autosaves every time you dock.

## Tech notes

- Three.js + UnrealBloomPass + ACES tone mapping — every emissive glows
- Planets: FBM noise shaders with day/night terminator, night-side city
  lights and fresnel atmosphere rims
- Ships: composed primitives with canvas-generated grunge/rust textures
- Economy: mean-reverting random-walk prices per (planet, good) with
  export/import bias and player price impact
- Saves: `localStorage` (`elite-save-v1`)

Fly safe, commander.
