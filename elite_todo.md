# Elite — Feature Todo / Roadmap

Scope document for future gameplay features. The core loop is **trade → earn credits →
upgrade → trade bigger** — every feature below should feed that loop or give players a
new way to earn.

## Already in the game (baseline)

- 6DOF flight with boost and supercruise, docking at 6 stations in the Achenar system
- 8 commodities with per-station import/export bias and drifting prices that react to trades
- Tiered upgrades: engine, laser cannon, shield, hull plating, cargo hold
- Pirate encounters via interdiction, bounties, cargo pod scooping, death credit tax

---

## 1. Trading depth (core loop)

- [ ] **Trade routes UI** — a galactic/system map screen showing known prices at each
      station (last-seen data only, so information itself has value)
- [ ] **Price history graphs** at market screens so players can learn a station's rhythm
- [ ] **Supply/demand events** — famine on Veridia, mining strike on Ferrox, plague at
      Keller's Drift; announced via news ticker, prices spike accordingly
- [ ] **Bulk contracts** — station offers "deliver 40 machinery within 10 minutes" for a
      premium over market rate; adds time pressure to plain trading
- [ ] **Rare goods** — one-off commodities only sold at a specific station (Thalassan
      storm-silk, Veridian whisky) that appreciate with distance carried
- [ ] **Illegal goods & smuggling** — narcotics/weapons with fat margins; random cargo
      scans near stations, fines, confiscation, and reputation damage when caught
- [ ] **Trade rank progression** — Harmless → Mostly Penniless → ... → Elite; unlocks
      titles, station discounts, and access to restricted markets

## 2. Ship upgrades & progression (retention driver)

- [ ] **More upgrade categories**: fuel scoop, cargo scoop range, shield cell banks,
      point-defense turret, ECM (breaks pirate missile lock), afterburner capacity
- [ ] **New weapon types** — beam laser (sustained), burst cannon, mining laser,
      seeker missiles (ammo-limited, bought at stations)
- [ ] **Utility modules with slots** — limited module slots so players make build
      choices instead of buying everything (trader build vs fighter build vs miner build)
- [ ] **Buyable ship hulls** — 3–5 distinct ships (light courier, mid trader, heavy
      freighter, combat interceptor) with different slot counts, base stats, and price
      tags from ~10k to ~500k credits; trade-in value for the old ship
- [ ] **Ship paint jobs / decals** — pure cosmetic credit sink
- [ ] **Insurance** — rebuy cost on death instead of flat credit tax once ships are buyable

## 3. Ways to earn beyond trading

- [ ] **Mission board at stations** — courier runs, timed deliveries, "hunt this named
      pirate", escort a freighter, rescue an escape pod
- [ ] **Bounty hunting as a career** — wanted boards, named pirates with bigger bounties
      and better AI, combat rank separate from trade rank
- [ ] **Mining** — mineable asteroids in a belt region; mining laser chips off ore
      fragments to scoop; ties into existing ore commodity
- [ ] **Passenger runs** — take tourists to Thalassa; luxury cabin module required
- [ ] **Salvage** — derelict ships and debris fields with scoopable cargo, sometimes guarded

## 4. Combat & danger

- [ ] **Pirate variety** — light/heavy/leader variants, small wings of 2–3, faction skins
- [ ] **Police / system authority** — respond to fights near stations, attack players
      with a criminal status, fines for friendly fire
- [ ] **Escalating interdictions** — cargo value raises interdiction odds (already have
      a base chance); rich traders attract deadlier pirates
- [ ] **Missile lock + countermeasures** — chaff/ECM for a new defensive layer
- [ ] **Boss encounter** — a pirate dreadnought event once combat rank is high enough

## 5. World & exploration

- [ ] **Second star system + hyperspace jump** — fuel-gated jumps make the fuel
      commodity strategic; each system gets its own economy character
- [ ] **Procedural systems** — generate systems from seeds (SystemDef already
      seed-driven per planet) for effectively unlimited exploration
- [ ] **Points of interest** — asteroid belts, derelicts, distress beacons (ambush or
      rescue), abandoned stations
- [ ] **Exploration income** — sell scan data for undiscovered bodies at stations

## 6. Reputation & factions

- [ ] **Per-station reputation** — trading and missions raise it; smuggling busts and
      crimes lower it; high rep = discounts, low rep = docking denied
- [ ] **2–3 factions** with territory in the system(s); mission choices shift standing;
      hostile factions send hunters after the player

## 7. Quality of life / meta

- [ ] **Save/load** (localStorage) — required before long-term progression matters
- [ ] **Stats screen** — credits earned, profit per commodity, pirates killed, distance flown
- [ ] **Tutorial / first-launch hints** — guided first trade run
- [ ] **Settings** — volume, graphics quality (bloom toggle), key rebinding
- [ ] **Gamepad support**
- [ ] **Audio** — engine hum, laser sfx, dock ambience, dynamic music (calm ↔ combat)

---

## Suggested build order

1. **Save/load** — everything else is pointless if progress evaporates (§7)
2. **Mission board + trade contracts** — cheap content multiplier on existing systems (§1, §3)
3. **Buyable ships + module slots** — the big retention hook; makes credits aspirational (§2)
4. **Smuggling + police + reputation** — risk/reward texture on the trade loop (§1, §4, §6)
5. **Second system + hyperspace** — doubles the map and makes fuel matter (§5)
6. **Mining & salvage** — alternate careers (§3)
7. **Procedural systems** — endgame scale (§5)
