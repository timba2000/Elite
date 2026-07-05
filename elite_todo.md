# Elite — Feature Todo / Roadmap

Scope document for future gameplay features. The core loop is **trade → earn credits →
upgrade → trade bigger** — every feature below should feed that loop or give players a
new way to earn.

## Already in the game (baseline)

- 6DOF flight with boost and supercruise, docking at 6 stations in the Achenar system
- 9 commodities with per-station import/export bias and drifting prices that react to trades
- Tiered upgrades: engine, laser cannon, shield, hull plating, cargo hold, docking
  computer, missile launcher, galactic hyperdrive
- Pirate encounters via interdiction, bounties, cargo pod scooping, death credit tax
- Pirate variants (raider / marauder / dreadnought) in multi-ship ambushes; dreadnoughts
  fire homing missiles, player missiles with lock-on
- Notoriety system: narcotics trading and police kills raise it, police interdictions
  hunt criminal players
- Procedural galaxies via single-use Galactic Hyperdrive; prices and enemies scale up
  per galaxy
- Save/load via localStorage (F5 in flight, station save button, autosave on dock)
- Procedural Web Audio sound: engine hum, lasers, alarms, docking, UI blips
- Station mission board: courier deliveries (cargo provided, failure penalty), supply
  contracts at premium rates, and pirate-hunt bounties, with flight-time deadlines,
  HUD contract tracker, and auto-redemption on dock

---

## 1. Trading depth (core loop)

- [ ] **Trade routes UI** — a galactic/system map screen showing known prices at each
      station (last-seen data only, so information itself has value)
- [ ] **Price history graphs** at market screens so players can learn a station's rhythm
- [x] **Supply/demand events** — famine on Veridia, mining strike on Ferrox, plague at
      Keller's Drift; announced via news ticker, prices spike accordingly — *six event
      types shipped with GALNET toasts, station ticker, and urgent relief contracts*
- [x] **Bulk contracts** — station offers "deliver 40 machinery within 10 minutes" for a
      premium over market rate; adds time pressure to plain trading — *shipped as
      supply contracts on the station mission board*
- [x] **Rare goods** — one-off commodities only sold at a specific station (Thalassan
      storm-silk, Veridian whisky) that appreciate with distance carried
- [x] **Illegal goods & smuggling** — narcotics/weapons with fat margins; random cargo
      scans near stations, fines, confiscation, and reputation damage when caught
      — *station-approach scans, fines, confiscation, notoriety, and smuggling
      contracts (Trade 2) shipped*
- [ ] **Trade rank progression** — Harmless → Mostly Penniless → ... → Elite; unlocks
      titles, station discounts, and access to restricted markets

## 2. Ship upgrades & progression (retention driver)

- [x] **More upgrade categories**: fuel scoop, cargo scoop range, shield cell banks,
      point-defense turret, ECM (breaks pirate missile lock), afterburner capacity
      — *shield cell, salvage scoop, ECM, and afterburner shipped as utility modules;
      point-defense turret still open*
- [ ] **New weapon types** — beam laser (sustained), burst cannon, mining laser,
      seeker missiles (ammo-limited, bought at stations)
- [x] **Utility modules with slots** — limited module slots so players make build
      choices instead of buying everything (trader build vs fighter build vs miner build)
- [x] **Buyable ship hulls** — 3–5 distinct ships (light courier, mid trader, heavy
      freighter, combat interceptor) with different slot counts, base stats, and price
      tags from ~10k to ~500k credits; trade-in value for the old ship — *4 hulls
      shipped: Swift Courier, Cobra Trader, Bulk Freighter, Fer-de-Lance*
- [ ] **Ship paint jobs / decals** — pure cosmetic credit sink
- [x] **Insurance** — rebuy cost on death instead of flat credit tax once ships are buyable
      — *6% of hull + modules value, halved by the Underwriter skill*

## 3. Ways to earn beyond trading

- [x] **Mission board at stations** — courier runs, timed deliveries, "hunt this named
      pirate", escort a freighter, rescue an escape pod — *courier, supply, and
      hunt-N-pirates contracts shipped; named pirates, escorts, and rescues still open*
- [x] **Bounty hunting as a career** — wanted boards, named pirates with bigger bounties
      and better AI, combat rank separate from trade rank — *wanted contracts shipped:
      named marauders/dreadnoughts that hunt the player and fight to the death
      (Gunnery 2); a separate combat rank still open*
- [ ] **Mining** — mineable asteroids in a belt region; mining laser chips off ore
      fragments to scoop; ties into existing ore commodity
- [ ] **Passenger runs** — take tourists to Thalassa; luxury cabin module required
- [ ] **Salvage** — derelict ships and debris fields with scoopable cargo, sometimes guarded

## 4. Combat & danger

- [x] **Pirate variety** — light/heavy/leader variants, small wings of 2–3, faction skins
      — *raider/marauder/dreadnought variants and multi-ship ambushes shipped; faction
      skins still open*
- [x] **Police / system authority** — respond to fights near stations, attack players
      with a criminal status, fines for friendly fire — *notoriety-driven police
      interdictions shipped; station response and friendly-fire fines still open*
- [x] **Escalating interdictions** — cargo value raises interdiction odds (already have
      a base chance); rich traders attract deadlier pirates
- [ ] **Missile lock + countermeasures** — chaff/ECM for a new defensive layer
- [ ] **Boss encounter** — a pirate dreadnought event once combat rank is high enough
- [ ] **High-stakes docking** — raise the docking skill ceiling: the station projects a
      lit runway/approach corridor showing the correct glide path and orientation;
      hitting the station above a safe approach speed is instantly fatal, though
      shields (§2) soak slower or glancing impacts at heavy charge cost — makes the
      docking computer a genuine safety upgrade, not just a convenience

## 5. World & exploration

- [x] **Second star system + hyperspace jump** — fuel-gated jumps make the fuel
      commodity strategic; each system gets its own economy character — *shipped as
      one-way procedural galaxy jumps via the Galactic Hyperdrive; fuel-gated jumps
      between systems within a galaxy could still add strategy*
- [x] **Procedural systems** — generate systems from seeds (SystemDef already
      seed-driven per planet) for effectively unlimited exploration
- [x] **Points of interest** — asteroid belts, derelicts, distress beacons (ambush or
      rescue), abandoned stations — *supercruise signal sources shipped: derelict
      cargo fields, distress beacons (rescue or trap), smuggler dead drops; asteroid
      belts and abandoned stations still open*
- [ ] **Exploration income** — sell scan data for undiscovered bodies at stations

## 6. Reputation & factions

- [ ] **Per-station reputation** — trading and missions raise it; smuggling busts and
      crimes lower it; high rep = discounts, low rep = docking denied
- [ ] **2–3 factions** with territory in the system(s); mission choices shift standing;
      hostile factions send hunters after the player

## 7. Character progression — levels & skills

The ship gets better with credits; the *pilot* should get better with experience. This
gives a second progression axis that persists across ship swaps and deaths.

- [x] **Experience & levels** — earn XP from profitable trades (scaled by margin, not
      just volume), pirate kills, missions completed, new stations/systems visited, and
      near-miss escapes. Level curve ~1.4× per level, soft cap around level 30 —
      *shipped: all five XP sources live, 1.35× curve*
- [x] **Level-up rewards** — each level grants 1 skill point plus a small flat perk
      (e.g. +1% shield recharge) so even unspent levels feel good
- [x] **Skill trees (spend points, pick a build)** — *Piloting, Gunnery, and Trade
      shipped with 4 tiers each (see Pilot tab); Engineering and Leadership await the
      crew/company systems they buff*:
      - *Piloting* — tighter turn rate, faster supercruise charge, boost efficiency,
        interdiction evasion bonus, reduced docking tractor time
      - *Gunnery* — laser heat management, +damage, faster missile lock, point-defense
        accuracy, critical hit chance on pirate power plants
      - *Trade* — better buy/sell spreads (haggling), see price trends without visiting,
        bulk contract premium bonus, cheaper station services
      - *Engineering* — cheaper upgrades, field repairs without docking, +cargo scoop
        range, fuel efficiency, salvage yield bonus
      - *Leadership* — unlocks and buffs the crew/company systems below: +crew morale,
        cheaper wages, extra crew slot, company ship AI bonuses
- [ ] **Skill synergies / capstones** — deep investment in one tree unlocks a signature
      ability (Piloting: short emergency FSD hop; Trade: one guaranteed premium contract
      per station; Gunnery: overcharge volley on a cooldown)
- [x] **Respec** — buyable at high-tech stations for a credit fee that scales with level,
      so experimenting is possible but not free — *shipped at any station, 400 CR × level*
- [x] **Skill checks in the world** — locked content that reads the sheet: restricted
      markets need Trade 5, salvage-guard fields need Gunnery 4, plotting a jump through
      an unscouted system needs Piloting 6 — makes the numbers visible in play —
      *smuggling contracts need Trade 2, wanted contracts need Gunnery 2; more gates
      welcome as content grows*
- [x] **XP on the stats screen** — current level, XP bar, and per-source XP breakdown
      — *shipped as the station Pilot tab (level, XP bar, service record)*

## 8. Friends, crew & the player's company

NPCs the player meets should be persistent people, not vending machines. Befriend them,
recruit the best ones, and grow from a lone pilot into a small trading company.

### Meeting people & friendship

- [ ] **Named NPCs at station bars** — each station has a rotating cast of 3–5 named
      characters (pilots, traders, engineers, drifters) with portraits, personalities,
      and a specialty stat; talk to them to build rapport
- [ ] **Friendship via play, not menus** — rapport rises from doing things together or
      for them: completing their personal missions, trading goods they ask for, rescuing
      them from a distress beacon, buying a round at the bar (small credit sink)
- [ ] **Affinity tiers** — Stranger → Acquaintance → Friend → Trusted; each tier unlocks
      something concrete (rumors about price spikes, discounted repairs, a personal
      mission chain, finally: the option to recruit them)
- [ ] **Personal mission chains** — 2–3 step storylines per character (smuggle their
      brother off Ferrox, recover a stolen ship, clear their bounty) that establish who
      they are before they ever join you
- [ ] **Rivals & bad blood** — helping one NPC can sour another (competing smugglers,
      an ex-partner); not everyone can be your friend on one playthrough

### Crew aboard the player's ship

- [x] **Crew slots by hull** — light courier 0, mid trader 1, heavy freighter 2, combat
      interceptor 1; ties crew directly into the buyable-ships feature (§2)
- [x] **Crew roles with passive + active effects** — *all five roles shipped as
      passives hired at the station Bar (two tiers each); the gunner's aimed turret
      is still open*:
      - *Gunner* — mans a turret the player doesn't have to aim
      - *Navigator* — faster supercruise, shows interdiction warnings earlier
      - *Quartermaster* — +cargo capacity via smart packing, faster pod scooping
      - *Engineer* — slow hull/module repair in flight, boost recharge bonus
      - *Negotiator* — better market spreads while aboard, unlocks haggle dialog
- [x] **Wages & morale** — crew take a weekly credit wage or a small profit cut; morale
      drops from deaths, crimes they disapprove of, and unpaid wages; low morale means
      worse performance, then quitting (and gossiping — station rep hit) — *per-game-hour
      wages settled on dock shipped; unpaid crew walks out; morale still open*
- [ ] **Crew XP & loyalty** — crew level up alongside the player; at max loyalty they
      gain a unique trait (a gunner who never overheats, a navigator who breaks one
      interdiction per trip for free)
- [ ] **Crew permadeath choice** — on ship destruction, crew survive if an escape-pod
      module is fitted, otherwise they're gone; makes the module a real decision

### The player's company

- [ ] **Found a company** — at ~100k credits and Leadership 3, register a named company
      at any station; company name shows on hull decals and in station comms
- [ ] **Hire friend NPCs as captains** — Trusted friends can be given a ship the player
      owns and run as AI pilots: assign them a trade route ("buy machinery at Ferrox,
      sell at Veridia, repeat") and they generate passive income with per-run reports
- [ ] **Captain risk model** — AI-run ships can be interdicted too; captain skill (their
      specialty + loyalty) sets success odds; losses cost the ship, the cargo, and
      possibly the friend — protect key routes yourself or hire escorts
- [ ] **Company upgrades** — office at a home station (cheaper storage, mission
      priority), warehouse (stockpile goods to ride out price swings), broker desk
      (see live prices at stations where a company ship is docked)
- [ ] **Company reputation & contracts** — stations offer bulk contracts to the company
      (bigger than solo contracts); fulfilling them raises company rep and unlocks
      exclusive freight deals; ties into per-station reputation (§6)
- [ ] **Wing missions** — invite a friend captain to fly alongside you for a dangerous
      mission; they fight/haul with you and take a cut
- [ ] **Company ledger screen** — income per route, wages paid, net worth over time;
      the endgame dashboard that makes the empire feel real

## 9. Quality of life / meta

- [x] **Save/load** (localStorage) — required before long-term progression matters
- [x] **Stats screen** — credits earned, profit per commodity, pirates killed, distance flown
      — *shipped in the Pilot tab; per-commodity profit breakdown still open*
- [ ] **Tutorial / first-launch hints** — guided first trade run
- [ ] **Settings** — volume, graphics quality (bloom toggle), key rebinding
- [ ] **Gamepad support**
- [x] **Audio** — engine hum, laser sfx, dock ambience, dynamic music (calm ↔ combat)
      — *procedural sfx shipped; dynamic music still open*

## 10. Visual fidelity

- [ ] **Photoreal rendering pass** — push the Three.js scene toward cinematic realism:
      PBR hull materials with normal/roughness maps on ships and stations, an HDR
      nebula skybox with believable star colour temperatures, planet shaders with
      atmospheric scattering, rolling cloud layers, and night-side city lights, plus
      soft shadows, SSAO, sun god-rays, and subtle lens flare/film grain in the post
      stack (PostFX already runs ACES + bloom, so the pipeline is ready). Gate the
      heavy passes behind the graphics-quality setting (§9) so low-end machines keep
      the current look — a world this convincing makes every trade run, docking
      approach, and dogfight more compelling to sit in.

---

## Suggested build order

1. **Save/load** — everything else is pointless if progress evaporates (§9)
2. **Mission board + trade contracts** — cheap content multiplier on existing systems (§1, §3)
3. **XP, levels & skill trees** — a progression spine the rest can hang skill checks
   and Leadership gates on; cheap to add early, expensive to retrofit (§7)
4. **Buyable ships + module slots** — the big retention hook; makes credits aspirational (§2)
5. **Named NPCs + friendship + crew** — needs ships with crew slots first; turns
   stations into places you return to for people, not just prices (§8)
6. **Smuggling + police + reputation** — risk/reward texture on the trade loop (§1, §4, §6)
7. **Player company + AI captains** — the passive-income endgame; needs friends, crew,
   multiple ships, and save/load all in place (§8)
8. **Second system + hyperspace** — doubles the map and makes fuel matter (§5)
9. **Mining & salvage** — alternate careers (§3)
10. **Procedural systems** — endgame scale (§5)
