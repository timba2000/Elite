import { C } from '../constants.js';
import { COMMODITIES } from '../economy/commodities.js';
import { SaveSystem } from '../save/SaveSystem.js';
import { Missions } from '../missions/Missions.js';
import { Progression } from '../player/Progression.js';

// Docked panel: Market / Shipyard / Repair tabs + undock.
export class StationUI {
  constructor(uiRoot) {
    this.root = document.createElement('div');
    this.root.id = 'station-ui';
    this.root.className = 'panel';
    uiRoot.appendChild(this.root);
    this.tab = 'market';
  }

  show(planetDef, market, playerData, callbacks, missionNews = []) {
    this.planetDef = planetDef;
    this.market = market;
    this.player = playerData;
    this.cb = callbacks; // { undock, onUpgrade }
    this.missionNews = missionNews; // completions/failures resolved on dock
    this.offers = Missions.generateOffers(planetDef, playerData, market);
    this.missionMsg = null; // accept feedback line
    this.tab = missionNews.length ? 'missions' : 'market';
    this.lastTrade = null; // { msg, cls } report line for the market tab
    this.render();
    this.root.classList.add('visible');
  }

  hide() { this.root.classList.remove('visible'); }

  render() {
    const p = this.planetDef;
    this.root.innerHTML = `
      <div class="st-header">
        <h2>${p.name} STATION</h2>
        <div class="flavor">${p.type} — ${p.flavor}</div>
        <div class="st-status"></div>
        ${this.market.events.length ? `<div class="st-ticker">${this.market.events.map((e) => `⚠ ${e.headline}`).join('   ·   ')}</div>` : ''}
      </div>
      <div class="st-tabs">
        <button data-tab="market">Market</button>
        <button data-tab="missions">Missions</button>
        <button data-tab="pilot">Pilot</button>
        <button data-tab="shipyard">Shipyard</button>
        <button data-tab="repair">Repair</button>
        <button class="save-btn" data-tab="save">💾 Save Game</button>
        <button class="amber" data-tab="undock">Undock</button>
      </div>
      <div class="st-body"></div>
    `;
    this.statusEl = this.root.querySelector('.st-status');
    this.body = this.root.querySelector('.st-body');
    this.root.querySelectorAll('.st-tabs button').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.tab === 'undock') { this.cb.undock(); return; }
        if (b.dataset.tab === 'save') { this.saveGame(b); return; }
        this.tab = b.dataset.tab;
        this.renderTab();
      });
    });
    this.renderTab();
  }

  saveGame(btn) {
    const ok = SaveSystem.save(this.player, this.market);
    btn.textContent = ok ? '✔ Saved!' : '✘ Save Failed';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = '💾 Save Game'; btn.disabled = false; }, 2000);
  }

  renderStatus() {
    const stats = this.player.getDerivedStats();
    let txt = `${stats.shipName.toUpperCase()}   ·   GALAXY ${this.player.galaxy}   ·   LVL ${this.player.level}   ·   ${this.player.credits.toLocaleString()} CR   ·   CARGO ${this.player.cargoUsed()}/${stats.cargoMax}   ·   HULL ${Math.round(this.player.hull)}/${stats.hullMax}`;
    if (this.player.skillPoints > 0) {
      txt += `   ·   ${this.player.skillPoints} SKILL PT${this.player.skillPoints > 1 ? 'S' : ''}`;
    }
    if (this.player.notoriety > 0) {
      txt += `   ·   NOTORIETY ${Math.round(this.player.notoriety)}`;
    }
    this.statusEl.textContent = txt;
    this.root.querySelectorAll('.st-tabs button').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === this.tab);
    });
  }

  renderTab() {
    this.renderStatus();
    if (this.tab === 'market') this.renderMarket();
    else if (this.tab === 'missions') this.renderMissions();
    else if (this.tab === 'pilot') this.renderPilot();
    else if (this.tab === 'shipyard') this.renderShipyard();
    else if (this.tab === 'repair') this.renderRepair();
  }

  // market price with Haggler/Negotiator perks applied
  priceFor(goodId) {
    const { buy, sell } = this.market.price(this.planetDef.id, goodId);
    const stats = this.player.getDerivedStats();
    return {
      buy: Math.max(1, Math.round(buy * stats.buyMult)),
      sell: Math.max(1, Math.round(sell * stats.sellMult)),
    };
  }

  // ---------- PILOT ----------
  renderPilot() {
    const p = this.player;
    const need = Progression.xpToNext(p.level);
    const pct = Math.min(1, p.xp / need);

    const trees = Object.entries(Progression.SKILLS).map(([key, tree]) => {
      const cur = p.skills[key];
      const maxed = cur >= tree.tiers.length;
      const pips = tree.tiers.map((_, i) =>
        `<div class="pip ${i < cur ? 'on' : ''}"></div>`).join('');
      const tiers = tree.tiers.map((t, i) => `
        <div class="skill-tier ${i < cur ? 'on' : ''}">
          ${i + 1}. <b>${t.name}</b> — ${t.desc}
        </div>`).join('');
      return `
        <div class="skill-tree">
          <div class="skill-head">
            <div class="u-name">${tree.name.toUpperCase()}</div>
            <div class="u-pips">${pips}</div>
            <button data-train="${key}" ${!maxed && p.skillPoints > 0 ? '' : 'disabled'}>
              ${maxed ? 'Mastered' : 'Train — 1 SP'}
            </button>
          </div>
          ${tiers}
        </div>`;
    }).join('');

    const c = p.career;
    const hours = Math.floor(p.gameTime / 3600);
    const mins = Math.floor((p.gameTime % 3600) / 60);

    this.body.innerHTML = `
      <div class="pilot-head">
        <div class="u-name">LEVEL ${p.level} · ${p.skillPoints} SKILL POINT${p.skillPoints === 1 ? '' : 'S'}</div>
        <div class="bar xp"><label>XP ${Math.floor(p.xp)} / ${need}</label><div class="fill" style="transform:scaleX(${pct})"></div></div>
      </div>
      ${trees}
      <div class="m-section" style="margin-top:16px">SERVICE RECORD</div>
      <div class="pilot-stats">
        <div>CREDITS EARNED</div><div>${Math.round(c.creditsEarned).toLocaleString()} CR</div>
        <div>PIRATES DESTROYED</div><div>${c.piratesKilled}</div>
        <div>CONTRACTS COMPLETED</div><div>${c.contractsCompleted}</div>
        <div>STATIONS VISITED</div><div>${p.visitedStations.length}</div>
        <div>DISTANCE FLOWN</div><div>${(c.distanceFlown / 100).toFixed(1)} LS</div>
        <div>TIME IN SERVICE</div><div>${hours}H ${mins}M</div>
      </div>
    `;

    this.body.querySelectorAll('button[data-train]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.train;
        const tree = Progression.SKILLS[key];
        if (this.player.skillPoints <= 0 || this.player.skills[key] >= tree.tiers.length) return;
        this.player.skillPoints--;
        this.player.skills[key]++;
        this.cb.onSkill?.();
        this.renderTab();
      });
    });
  }

  // ---------- MISSIONS ----------
  renderMissions() {
    const p = this.player;

    const news = this.missionNews.map((n) =>
      `<div class="trade-report ${n.cls}">${n.msg}</div>`).join('');

    const activeRows = p.missions.map((m) => {
      let status;
      let action = '';
      if (m.type === 'hunt') {
        status = `${m.killsDone}/${m.kills} pirates destroyed · no time limit`;
      } else {
        const held = p.cargo[m.good] || 0;
        const atTarget = m.targetId === this.planetDef.id;
        if (atTarget && Missions.canComplete(m, this.planetDef.id, p)) {
          status = `${m.qty}x ${m.goodName} in hold — ready to hand over`;
          action = `<button data-complete="${m.id}">Deliver</button>`;
        } else if (atTarget && !m.armed) {
          status = 'Leave the station and return to redeem';
        } else if (atTarget) {
          status = `Need ${m.qty - held} more ${m.goodName} — deliver here`;
        } else {
          status = `${held}/${m.qty} ${m.goodName} in hold → ${m.targetName}`;
        }
        status += ` · ${Missions.fmtTime(m.timeLeft)} left (timer runs in flight)`;
      }
      return `
        <div class="mission-row">
          <div class="m-name">${this.missionTitle(m)}</div>
          <div class="m-detail">${status}</div>
          <div class="m-reward">${m.reward.toLocaleString()} CR</div>
          ${action}
        </div>`;
    }).join('');

    const offerRows = this.offers.map((o) => {
      let detail;
      if (o.type === 'deliver') {
        detail = `Cargo supplied on accept (${o.qty} units of hold space) · ${Missions.fmtTime(o.timeLeft)} limit · ${o.penalty.toLocaleString()} CR penalty on failure`;
      } else if (o.type === 'supply') {
        detail = `Source anywhere, deliver here · ${Missions.fmtTime(o.timeLeft)} limit · no penalty`;
      } else {
        detail = 'Destroy them anywhere in the system · no time limit';
      }
      return `
        <div class="mission-row${o.urgent ? ' urgent' : ''}">
          <div class="m-name">${o.urgent ? '⚠ URGENT: ' : ''}${this.missionTitle(o)}</div>
          <div class="m-detail">${detail}</div>
          <div class="m-reward">${o.reward.toLocaleString()} CR</div>
          <button data-accept="${o.id}">Accept</button>
        </div>`;
    }).join('');

    const msg = this.missionMsg
      ? `<div class="trade-report ${this.missionMsg.cls}">${this.missionMsg.msg}</div>` : '';

    this.body.innerHTML = `
      ${news}
      <div class="m-section">CONTRACTS IN PROGRESS (${p.missions.length}/${Missions.MAX_ACTIVE})</div>
      ${activeRows || '<div class="m-detail" style="padding:6px 8px">No active contracts.</div>'}
      <div class="m-section" style="margin-top:16px">AVAILABLE HERE</div>
      ${offerRows || '<div class="m-detail" style="padding:6px 8px">Nothing on the board right now.</div>'}
      ${msg}
    `;

    this.body.querySelectorAll('button[data-accept]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const offer = this.offers.find((o) => o.id === btn.dataset.accept);
        if (!offer) return;
        const res = Missions.accept(offer, this.player);
        if (res.ok) {
          this.offers = this.offers.filter((o) => o.id !== offer.id);
          this.missionMsg = { msg: `CONTRACT ACCEPTED — ${this.missionTitle(offer).toUpperCase()}`, cls: 'profit' };
        } else {
          this.missionMsg = { msg: res.reason, cls: 'loss' };
        }
        this.renderTab();
      });
    });
    this.body.querySelectorAll('button[data-complete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = this.player.missions.find((x) => x.id === btn.dataset.complete);
        if (!m || !Missions.canComplete(m, this.planetDef.id, this.player)) return;
        Missions.completeOne(m, this.player);
        this.missionMsg = { msg: `CONTRACT COMPLETE — +${m.reward.toLocaleString()} CR`, cls: 'profit' };
        this.renderTab();
      });
    });
  }

  missionTitle(m) {
    if (m.type === 'deliver') return `Courier — ${m.qty}x ${m.goodName} to ${m.targetName}`;
    if (m.type === 'supply') return `Supply — ${m.qty}x ${m.goodName} wanted`;
    return `Bounty — destroy ${m.kills} pirates`;
  }

  // ---------- MARKET ----------
  renderMarket() {
    const rows = COMMODITIES.map((g) => {
      const { buy, sell } = this.priceFor(g.id);
      const avg = this.market.galacticAverage(g.id);
      const held = this.player.cargo[g.id] || 0;
      const buyCls = buy < avg * 0.85 ? 'cheap' : buy > avg * 1.2 ? 'dear' : '';
      const sellCls = sell > avg * 1.1 ? 'cheap' : sell < avg * 0.8 ? 'dear' : '';

      // what you paid and what selling here would make, per unit
      let paidTd = '<td class="num dim">—</td>';
      let plTd = '<td class="num dim">—</td>';
      if (held > 0) {
        const basis = this.player.getCostBasis(g.id);
        const pl = sell - basis;
        const plCls = pl > 0 ? 'cheap' : pl < 0 ? 'dear' : '';
        paidTd = `<td class="num">${Math.round(basis)}</td>`;
        plTd = `<td class="num ${plCls}">${pl > 0 ? '+' : ''}${Math.round(pl)}</td>`;
      }

      return `
        <tr data-good="${g.id}">
          <td>${g.name}</td>
          <td class="num ${buyCls}">${buy}</td>
          <td class="num ${sellCls}">${sell}</td>
          <td class="num">${held}</td>
          ${paidTd}
          ${plTd}
          <td><div class="qty-btns">
            <button data-act="buy" data-qty="1">Buy 1</button>
            <button data-act="buy" data-qty="5">+5</button>
            <button data-act="buy" data-qty="max">Max</button>
            <button data-act="sell" data-qty="1" ${held ? '' : 'disabled'}>Sell 1</button>
            <button data-act="sell" data-qty="max" ${held ? '' : 'disabled'}>All</button>
          </div></td>
        </tr>`;
    }).join('');

    const report = this.lastTrade
      ? `<div class="trade-report ${this.lastTrade.cls}">${this.lastTrade.msg}</div>`
      : '<div class="trade-report dim">PAID = avg you paid per unit · P/L = profit per unit if sold here</div>';

    this.body.innerHTML = `
      <table class="market">
        <tr><th>COMMODITY</th><th style="text-align:right">BUY</th><th style="text-align:right">SELL</th><th style="text-align:right">HELD</th><th style="text-align:right">PAID</th><th style="text-align:right">P/L</th><th></th></tr>
        ${rows}
      </table>
      ${report}
      <div style="margin-top:6px;font-size:11px;color:rgba(159,232,255,0.55)">
        <span class="cheap">GREEN</span> = good price here · <span class="dear">RED</span> = bad price here
      </div>
    `;

    this.body.querySelectorAll('button[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tr = btn.closest('tr');
        this.trade(tr.dataset.good, btn.dataset.act, btn.dataset.qty);
      });
    });
  }

  trade(goodId, act, qtyStr) {
    const { buy, sell } = this.priceFor(goodId);
    const p = this.player;
    const name = COMMODITIES.find((c) => c.id === goodId).name.toUpperCase();
    let qty;
    if (act === 'buy') {
      const affordable = Math.floor(p.credits / buy);
      const space = p.cargoSpace();
      qty = qtyStr === 'max' ? Math.min(affordable, space) : Math.min(+qtyStr, affordable, space);
      if (qty <= 0) return;
      p.credits -= qty * buy;
      p.addCargo(goodId, qty, buy);
      this.market.recordTrade(this.planetDef.id, goodId, qty, true);
      this.lastTrade = { msg: `BOUGHT ${qty}x ${name} FOR ${(qty * buy).toLocaleString()} CR`, cls: '' };
      if (goodId === 'narcotics') {
        p.notoriety = Math.min(100, (p.notoriety || 0) + qty * 2.5);
      }
    } else {
      const held = p.cargo[goodId] || 0;
      qty = qtyStr === 'max' ? held : Math.min(+qtyStr, held);
      if (qty <= 0) return;
      const basis = p.getCostBasis(goodId);
      const profit = Math.round((sell - basis) * qty);
      p.credits += qty * sell;
      p.career.creditsEarned += qty * sell;
      p.removeCargo(goodId, qty);
      this.market.recordTrade(this.planetDef.id, goodId, qty, false);
      const plText = profit >= 0
        ? `PROFIT +${profit.toLocaleString()} CR`
        : `LOSS −${Math.abs(profit).toLocaleString()} CR`;
      // XP scales with margin, not volume — smart trades level you up
      let xpText = '';
      if (profit > 0) {
        const xpGain = Progression.XP.tradeProfit(profit);
        const levels = Progression.award(p, xpGain);
        xpText = ` · +${xpGain} XP${levels > 0 ? ' · LEVEL UP!' : ''}`;
      }
      this.lastTrade = {
        msg: `SOLD ${qty}x ${name} FOR ${(qty * sell).toLocaleString()} CR — ${plText}${xpText}`,
        cls: profit >= 0 ? 'profit' : 'loss',
      };
      if (goodId === 'narcotics') {
        p.notoriety = Math.min(100, (p.notoriety || 0) + qty * 1.5);
      }
    }
    this.renderTab();
  }

  // ---------- SHIPYARD ----------
  renderShips() {
    const p = this.player;
    const cur = C.SHIPS[p.shipId] ?? C.SHIPS.trader;
    const tradeIn = Math.round(cur.price * C.SHIP_TRADE_IN);

    return Object.entries(C.SHIPS).map(([id, s]) => {
      const owned = id === p.shipId;
      const net = s.price - tradeIn;
      const newCargoMax = Math.round(C.UPGRADES.cargo.tiers[p.upgrades.cargo].max * s.cargoMult)
        + (p.modules.includes('cargoRacks') ? 8 : 0);
      let block = '';
      if (!owned) {
        if (p.credits < net) block = 'INSUFFICIENT CREDITS';
        else if (p.cargoUsed() > newCargoMax) block = 'UNLOAD CARGO FIRST';
        else if (p.modules.length > s.slots) block = 'SELL MODULES FIRST';
      }
      const stats = `SPD ×${s.speedMult} · TURN ×${s.turnMult} · HULL ×${s.hullMult} · CARGO ×${s.cargoMult} · SHLD ×${s.shieldMult}${s.damageMult > 1 ? ` · DMG ×${s.damageMult}` : ''} · ${s.slots} SLOT${s.slots > 1 ? 'S' : ''} · ${s.crew} CREW`;
      return `
        <div class="mission-row">
          <div class="m-name">${s.name}${owned ? ' ★' : ''}<div class="m-sub">${s.desc}</div></div>
          <div class="m-detail">${stats}${block ? `<br><span class="dear">${block}</span>` : ''}</div>
          <div class="m-reward">${owned ? 'OWNED' : `${net.toLocaleString()} CR<div class="m-sub">after trade-in</div>`}</div>
          <button data-ship="${id}" ${owned || block ? 'disabled' : ''}>${owned ? 'Flying' : 'Buy'}</button>
        </div>`;
    }).join('');
  }

  renderModules() {
    const p = this.player;
    const stats = p.getDerivedStats();
    const rows = Object.entries(C.MODULES).map(([id, m]) => {
      const owned = p.modules.includes(id);
      const slotsFree = p.modules.length < stats.moduleSlots;
      const sellBack = Math.round(m.price * C.MODULE_SELL_RATE);
      return `
        <div class="mission-row">
          <div class="m-name">${m.name}</div>
          <div class="m-detail">${m.desc}</div>
          <div class="m-reward">${owned ? `+${sellBack.toLocaleString()} CR` : `${m.price.toLocaleString()} CR`}</div>
          <button data-module="${id}" data-owned="${owned}" ${owned || (slotsFree && p.credits >= m.price) ? '' : 'disabled'}>
            ${owned ? 'Sell' : 'Fit'}
          </button>
        </div>`;
    }).join('');
    return `
      <div class="m-section" style="margin-top:16px">UTILITY MODULES — ${p.modules.length}/${stats.moduleSlots} SLOTS USED</div>
      ${rows}`;
  }

  renderShipyard() {
    const effects = {
      engine: (t) => `Speed ${t.maxSpeed} · Boost ${t.boost} · Turn +${Math.round((t.turnMult - 1) * 100)}%`,
      weapons: (t) => `${t.damage} DMG · ${(1 / t.interval).toFixed(1)}/s${t.twin ? ' · TWIN-LINKED' : ''}`,
      shield: (t) => `${t.max} capacity · ${t.regen}/s regen`,
      hull: (t) => `${t.max} hull integrity`,
      cargo: (t) => `${t.max} cargo units`,
      dockingComputer: (t) => t.fitted ? 'Hands-free docking on request' : 'Manual approach only',
      missiles: (t) => t.maxAmmo > 0 ? `${t.maxAmmo} capacity · ${t.damage} DMG` : 'No launcher fitted',
      galacticHyperdrive: (t) => t.fitted ? 'Enables intergalactic jump (G key in space)' : 'Standard hyperdrive only',
    };

    const rows = Object.entries(C.UPGRADES).map(([key, def]) => {
      const cur = this.player.upgrades[key];
      const maxTier = def.tiers.length - 1;
      const next = cur < maxTier ? def.tiers[cur + 1] : null;
      const minTier = def.tiers[0] === null ? 1 : 0;
      const pips = Array.from({ length: maxTier - minTier + 1 }, (_, i) =>
        `<div class="pip ${i + minTier <= cur ? 'on' : ''}"></div>`).join('');
      return `
        <div class="shipyard-row">
          <div class="u-name">${def.name}</div>
          <div class="u-pips">${pips}</div>
          <div class="u-effect">${next ? 'NEXT: ' + effects[key](next) : effects[key](def.tiers[cur]) + ' (MAX)'}</div>
          <div class="u-price">${next ? next.price.toLocaleString() + ' CR' : '—'}</div>
          <button data-key="${key}" ${next && this.player.credits >= next.price ? '' : 'disabled'}>
            ${next ? 'Upgrade' : 'Maxed'}
          </button>
        </div>`;
    }).join('');

    this.body.innerHTML = `
      <div class="m-section">SHIPS FOR SALE — TRADE-IN PAYS ${Math.round(C.SHIP_TRADE_IN * 100)}%</div>
      ${this.renderShips()}
      <div class="m-section" style="margin-top:16px">SYSTEM UPGRADES</div>
      ${rows}
      ${this.renderModules()}
    `;
    this.body.querySelectorAll('button[data-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const cur = this.player.upgrades[key];
        const next = C.UPGRADES[key].tiers[cur + 1];
        if (!next || this.player.credits < next.price) return;
        this.player.credits -= next.price;
        this.player.upgrades[key]++;
        if (key === 'hull') this.player.hull = Math.min(this.player.hull + (next.max - C.UPGRADES.hull.tiers[cur].max), next.max);
        this.cb.onUpgrade(key);
        this.renderTab();
      });
    });
    this.body.querySelectorAll('button[data-ship]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.ship;
        const p = this.player;
        const s = C.SHIPS[id];
        const net = s.price - Math.round((C.SHIPS[p.shipId] ?? C.SHIPS.trader).price * C.SHIP_TRADE_IN);
        const newCargoMax = Math.round(C.UPGRADES.cargo.tiers[p.upgrades.cargo].max * s.cargoMult)
          + (p.modules.includes('cargoRacks') ? 8 : 0);
        if (id === p.shipId || p.credits < net) return;
        if (p.cargoUsed() > newCargoMax || p.modules.length > s.slots) return;
        p.credits -= net;
        p.shipId = id;
        p.hull = p.getDerivedStats().hullMax; // fresh hull with the new ship
        this.cb.onUpgrade('ship');
        this.renderTab();
      });
    });
    this.body.querySelectorAll('button[data-module]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.module;
        const p = this.player;
        const m = C.MODULES[id];
        if (btn.dataset.owned === 'true') {
          p.modules = p.modules.filter((x) => x !== id);
          p.credits += Math.round(m.price * C.MODULE_SELL_RATE);
        } else {
          const stats = p.getDerivedStats();
          if (p.modules.length >= stats.moduleSlots || p.credits < m.price) return;
          p.credits -= m.price;
          p.modules.push(id);
        }
        this.cb.onUpgrade('module');
        this.renderTab();
      });
    });
  }

  // ---------- REPAIR ----------
  renderRepair() {
    const stats = this.player.getDerivedStats();
    const missing = Math.max(0, Math.round(stats.hullMax - this.player.hull));
    const cost = Math.round(missing * C.REPAIR_COST_PER_POINT * stats.repairMult);
    this.body.innerHTML = `
      <div class="repair-box">
        <div>HULL INTEGRITY</div>
        <div class="bar hull"><div class="fill" style="transform:scaleX(${this.player.hull / stats.hullMax})"></div></div>
        <div style="margin:8px 0 16px 0">${Math.round(this.player.hull)} / ${stats.hullMax}</div>
        <button id="repair-btn" ${missing > 0 && this.player.credits >= cost ? '' : 'disabled'}>
          ${missing > 0 ? `Repair All — ${cost.toLocaleString()} CR` : 'Hull at full integrity'}
        </button>
      </div>
    `;
    const btn = this.body.querySelector('#repair-btn');
    btn?.addEventListener('click', () => {
      if (this.player.credits < cost) return;
      this.player.credits -= cost;
      this.player.hull = stats.hullMax;
      this.renderTab();
    });
  }
}
