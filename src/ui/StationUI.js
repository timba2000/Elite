import { C } from '../constants.js';
import { COMMODITIES } from '../economy/commodities.js';
import { SaveSystem } from '../save/SaveSystem.js';
import { Missions } from '../missions/Missions.js';
import { Progression } from '../player/Progression.js';
import { RareGoods } from '../economy/RareGoods.js';
import { Crew } from '../crew/Crew.js';
import { SYSTEM } from '../world/SystemDef.js';

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
    this.rareBought = 0;
    this.barCandidates = Crew.generateCandidates(playerData);
    this.barMsg = null;
    this.missionMsg = null; // accept feedback line
    this.cartoMsg = null; // scan-data sale feedback line
    this.tab = missionNews.length ? 'missions' : 'market';
    this.lastTrade = null; // { msg, cls } report line for the market tab
    this.selectedGoodId = null;
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
        <button data-tab="bar">Bar</button>
        <button data-tab="carto">Cartographics</button>
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
    let txt = `${stats.shipName.toUpperCase()}   ·   GALAXY ${this.player.galaxy} — ${SYSTEM.name}   ·   LVL ${this.player.level}   ·   ${this.player.credits.toLocaleString()} CR   ·   CARGO ${this.player.cargoUsed()}/${stats.cargoMax}   ·   HULL ${Math.round(this.player.hull)}/${stats.hullMax}`;
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
    else if (this.tab === 'bar') this.renderBar();
    else if (this.tab === 'carto') this.renderCarto();
    else if (this.tab === 'pilot') this.renderPilot();
    else if (this.tab === 'shipyard') this.renderShipyard();
    else if (this.tab === 'repair') this.renderRepair();
  }

  // ---------- BAR (crew hiring) ----------
  renderBar() {
    const p = this.player;
    const stats = p.getDerivedStats();

    const aboard = p.crew.map((c) => `
      <div class="mission-row">
        <div class="m-name">${c.name}<div class="m-sub">${Crew.ROLES[c.role].name} · Tier ${c.tier}</div></div>
        <div class="m-detail">${Crew.ROLES[c.role].desc(c.tier)}</div>
        <div class="m-reward">${c.wage} CR/h</div>
        <button data-fire="${c.name}">Dismiss</button>
      </div>`).join('');

    const candidates = this.barCandidates.map((c, i) => `
      <div class="mission-row">
        <div class="m-name">${c.name}${c.rescued ? ' ♥' : ''}<div class="m-sub">${Crew.ROLES[c.role].name} · Tier ${c.tier}${c.rescued ? ' · the pilot you rescued — half fee' : ''}</div></div>
        <div class="m-detail">${Crew.ROLES[c.role].desc(c.tier)} · wage ${c.wage} CR per game-hour, settled on dock</div>
        <div class="m-reward">${c.fee.toLocaleString()} CR</div>
        <button data-hire="${i}">Hire</button>
      </div>`).join('');

    const msg = this.barMsg
      ? `<div class="trade-report ${this.barMsg.cls}">${this.barMsg.msg}</div>` : '';

    this.body.innerHTML = `
      <div class="m-section">YOUR CREW — ${p.crew.length}/${stats.crewSlots} SEAT${stats.crewSlots === 1 ? '' : 'S'} (${stats.shipName.toUpperCase()})</div>
      ${aboard || '<div class="m-detail" style="padding:6px 8px">Nobody aboard but you and the hum of the reactor.</div>'}
      <div class="m-section" style="margin-top:16px">AT THE BAR TONIGHT</div>
      ${candidates || '<div class="m-detail" style="padding:6px 8px">The bar is empty.</div>'}
      ${msg}
    `;

    this.body.querySelectorAll('button[data-hire]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cand = this.barCandidates[+btn.dataset.hire];
        if (!cand) return;
        const res = Crew.hire(cand, this.player);
        if (res.ok) {
          this.barCandidates = this.barCandidates.filter((c) => c !== cand);
          this.barMsg = { msg: `${cand.name} SIGNED ON AS ${Crew.ROLES[cand.role].name.toUpperCase()}`, cls: 'profit' };
          this.cb.onSkill?.();
        } else {
          this.barMsg = { msg: res.reason, cls: 'loss' };
        }
        this.renderTab();
      });
    });
    this.body.querySelectorAll('button[data-fire]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Crew.fire(btn.dataset.fire, this.player);
        this.barMsg = { msg: `${btn.dataset.fire} PAID OFF AND DISMISSED`, cls: '' };
        this.cb.onSkill?.();
        this.renderTab();
      });
    });
  }

  // ---------- CARTOGRAPHICS (exploration scan data) ----------
  renderCarto() {
    const p = this.player;

    const rows = p.scans.map((s, i) => `
      <div class="mission-row">
        <div class="m-name">${s.name}<div class="m-sub">${s.type} · ${s.system}</div></div>
        <div class="m-detail">First-surveyor data — one buyer, one payout</div>
        <div class="m-reward">${s.value.toLocaleString()} CR</div>
        <button data-scan-sell="${i}">Sell</button>
      </div>`).join('');

    const total = p.scans.reduce((a, s) => a + s.value, 0);
    const sellAll = p.scans.length > 1 ? `
      <div class="mission-row">
        <div class="m-name">Sell entire archive</div>
        <div class="m-detail">${p.scans.length} surveys aboard</div>
        <div class="m-reward">${total.toLocaleString()} CR</div>
        <button data-scan-sell-all="1">Sell All</button>
      </div>` : '';

    const msg = this.cartoMsg
      ? `<div class="trade-report ${this.cartoMsg.cls}">${this.cartoMsg.msg}</div>` : '';

    this.body.innerHTML = `
      <div class="m-section">UNIVERSAL CARTOGRAPHICS — UNSOLD SURVEY DATA</div>
      ${rows || '<div class="m-detail" style="padding:6px 8px">No survey data aboard. Target a planet in flight (T) and press C to run a surface scan.</div>'}
      ${sellAll}
      ${msg}
      <div class="m-section" style="margin-top:16px">SURVEY RECORD</div>
      <div class="pilot-stats">
        <div>BODIES SURVEYED</div><div>${p.scannedBodies.length}</div>
        <div>SURVEY DATA SOLD</div><div>${Math.round(p.career.scanEarnings || 0).toLocaleString()} CR</div>
      </div>
    `;

    const sell = (list) => {
      if (!list.length) return;
      const sum = list.reduce((a, s) => a + s.value, 0);
      p.credits += sum;
      p.career.creditsEarned += sum;
      p.career.scanEarnings = (p.career.scanEarnings || 0) + sum;
      p.scans = p.scans.filter((s) => !list.includes(s));
      this.cartoMsg = { msg: `SURVEY DATA SOLD — +${sum.toLocaleString()} CR`, cls: 'profit' };
      this.renderTab();
    };
    this.body.querySelectorAll('button[data-scan-sell]').forEach((btn) => {
      btn.addEventListener('click', () => sell([p.scans[+btn.dataset.scanSell]].filter(Boolean)));
    });
    this.body.querySelector('button[data-scan-sell-all]')
      ?.addEventListener('click', () => sell([...p.scans]));
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
    const spent = p.skills.piloting + p.skills.gunnery + p.skills.trade;
    const respecCost = 400 * p.level;

    this.body.innerHTML = `
      <div class="pilot-head">
        <div class="u-name">LEVEL ${p.level} · ${p.skillPoints} SKILL POINT${p.skillPoints === 1 ? '' : 'S'}</div>
        <div class="bar xp"><label>XP ${Math.floor(p.xp)} / ${need}</label><div class="fill" style="transform:scaleX(${pct})"></div></div>
      </div>
      ${trees}
      <div class="mission-row">
        <div class="m-name">Neural Respec</div>
        <div class="m-detail">Refund all ${spent} spent skill point${spent === 1 ? '' : 's'} for retraining · fee scales with level</div>
        <div class="m-reward">${respecCost.toLocaleString()} CR</div>
        <button data-respec="1" ${spent > 0 && p.credits >= respecCost ? '' : 'disabled'}>Respec</button>
      </div>
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
    this.body.querySelector('button[data-respec]')?.addEventListener('click', () => {
      const pl = this.player;
      const spentNow = pl.skills.piloting + pl.skills.gunnery + pl.skills.trade;
      const cost = 400 * pl.level;
      if (spentNow <= 0 || pl.credits < cost) return;
      pl.credits -= cost;
      pl.skillPoints += spentNow;
      pl.skills = { piloting: 0, gunnery: 0, trade: 0 };
      this.cb.onSkill?.();
      this.renderTab();
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
        status = m.named
          ? 'The target hunts YOU — cruise the spacelanes and it will find you'
          : `${m.killsDone}/${m.kills} pirates destroyed · no time limit`;
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
          status = `<span style="color: #ffd27a; font-weight: bold;">DELIVER TO ${m.targetName.toUpperCase()}</span> (${held}/${m.qty} in hold)`;
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
        detail = `Cargo supplied on accept (${o.qty} units) · <span style="color: #7dff9a; font-weight: bold;">TAKE TO: ${o.targetName.toUpperCase()}</span> · ${Missions.fmtTime(o.timeLeft)} limit · ${o.penalty.toLocaleString()} CR penalty`;
      } else if (o.type === 'smuggle') {
        detail = `Unmarked narcotics supplied · <span style="color: #ff8a7a; font-weight: bold;">SMUGGLE TO: ${o.targetName.toUpperCase()}</span> · dodge scans · ${Missions.fmtTime(o.timeLeft)} limit`;
      } else if (o.type === 'supply') {
        detail = `Source anywhere · <span style="color: #ffd27a; font-weight: bold;">DELIVER HERE: ${o.targetName.toUpperCase()}</span> · ${Missions.fmtTime(o.timeLeft)} limit · no penalty`;
      } else if (o.named) {
        detail = `A ${o.shipType} that will come hunting YOU · fights to the death · no time limit`;
      } else {
        detail = 'Destroy them anywhere in the system · no time limit';
      }
      const locked = Missions.lockedReason(o, p);
      if (locked) detail += ` · <span class="dear">${locked}</span>`;
      return `
        <div class="mission-row${o.urgent ? ' urgent' : ''}">
          <div class="m-name">${o.urgent ? '⚠ URGENT: ' : ''}${this.missionTitle(o)}</div>
          <div class="m-detail">${detail}</div>
          <div class="m-reward">${o.reward.toLocaleString()} CR</div>
          <button data-accept="${o.id}" ${locked ? 'disabled' : ''}>${locked ? 'Locked' : 'Accept'}</button>
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
    if (m.type === 'smuggle') return `Smuggle — ${m.qty}x ${m.goodName} to ${m.targetName}`;
    if (m.type === 'supply') return `Supply — ${m.qty}x ${m.goodName} wanted`;
    if (m.named) return `Wanted — ${m.named}`;
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

      const isSelected = this.selectedGoodId === g.id;
      const arrow = isSelected ? '▼' : '▶';

      // Find active contracts for this good to show as badges in the market list
      const activeContracts = this.player.missions.filter((m) => m.good === g.id);
      let contractBadge = '';
      if (activeContracts.length > 0) {
        contractBadge = activeContracts.map((m) => {
          if (m.type === 'supply') {
            return `<div class="contract-badge" style="font-size: 10px; color: #ffd27a; margin-top: 3px; letter-spacing: 0.5px; font-weight: bold;">⚑ SUPPLY TO: ${m.targetName.toUpperCase()} (${m.qty} units)</div>`;
          } else if (m.type === 'smuggle') {
            return `<div class="contract-badge" style="font-size: 10px; color: #ff8a7a; margin-top: 3px; letter-spacing: 0.5px; font-weight: bold;">⚑ SMUGGLE TO: ${m.targetName.toUpperCase()} (${m.qty} units)</div>`;
          } else {
            return `<div class="contract-badge" style="font-size: 10px; color: #7dff9a; margin-top: 3px; letter-spacing: 0.5px; font-weight: bold;">⚑ COURIER TO: ${m.targetName.toUpperCase()} (${m.qty} units)</div>`;
          }
        }).join('');
      }

      const mainRow = `
        <tr data-good="${g.id}" style="cursor: pointer;" class="${isSelected ? 'selected-row' : ''}">
          <td>
            <span class="expand-arrow" style="font-size: 10px; margin-right: 6px; color: rgba(80, 220, 255, 0.7);">${arrow}</span><b>${g.name}</b>
            ${contractBadge}
          </td>
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

      if (!isSelected) return mainRow;

      const p = this.planetDef;
      const ev = this.market.eventFor(p.id, g.id);
      let statusText = 'NORMAL';
      let statusClass = 'dim';
      if (ev) {
        statusText = 'CRISIS SPIKE';
        statusClass = 'dear';
      } else if (p.exports.includes(g.id)) {
        statusText = 'EXPORT (CHEAP)';
        statusClass = 'cheap';
      } else if (p.imports.includes(g.id)) {
        statusText = 'IMPORT (PREMIUM)';
        statusClass = 'dear';
      }

      let contractSection = '';
      if (activeContracts.length > 0) {
        const items = activeContracts.map((m) => {
          const held = this.player.cargo[m.good] || 0;
          let statusStr = '';
          if (m.type === 'supply') {
            statusStr = `Deliver here · ${held}/${m.qty} acquired`;
          } else {
            statusStr = `Deliver to ${m.targetName} · ${held}/${m.qty} in cargo hold`;
          }
          return `<div style="font-size: 11px; margin-top: 2px; color: #ffd27a;">• ${m.type.toUpperCase()}: ${statusStr} (Time left: ${Missions.fmtTime(m.timeLeft)})</div>`;
        }).join('');
        contractSection = `<div style="margin-top: 8px; border-top: 1px dashed rgba(80, 220, 255, 0.2); padding-top: 6px;">
          <div style="font-size: 11px; color: #ffd27a; font-weight: bold; letter-spacing: 1px;">ACTIVE CONTRACTS FOR THIS GOOD:</div>
          ${items}
        </div>`;
      }

      const detailRow = `
        <tr class="market-detail-row" style="background: rgba(0, 15, 25, 0.45);">
          <td colspan="7" style="padding: 0;">
            <div class="market-detail-container" style="display: flex; gap: 20px; padding: 12px 16px; align-items: center; border-left: 3px solid #37d0ff;">
              <div class="chart-container">
                ${this.renderGraph(g.id)}
              </div>
              <div class="info-container" style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                <div class="info-title" style="font-size: 13px; color: #ffd27a; letter-spacing: 1px;">
                  ${g.name.toUpperCase()} MARKET TREND & PROFILE
                </div>
                <div class="info-desc" style="font-size: 11px; line-height: 1.4; color: rgba(159, 232, 255, 0.85); min-height: 32px;">
                  ${this.getMarketPerspective(g.id)}
                  ${contractSection}
                </div>
                <div class="info-stats" style="display: flex; gap: 16px; font-size: 10px; margin-top: 4px; border-top: 1px solid rgba(80, 220, 255, 0.15); padding-top: 6px;">
                  <div>VOLATILITY: <span style="color: ${g.volatility > 0.025 ? '#ff8a7a' : '#7dff9a'}; font-weight: bold;">${g.volatility > 0.03 ? 'HIGH' : g.volatility > 0.015 ? 'MED' : 'LOW'}</span></div>
                  <div>GALACTIC AVG: <span style="color: #ffd27a; font-weight: bold;">${Math.round(this.market.galacticAverage(g.id))} CR</span></div>
                  <div>STATUS: <span class="${statusClass}" style="font-weight: bold;">${statusText}</span></div>
                </div>
              </div>
            </div>
          </td>
        </tr>`;

      return mainRow + detailRow;
    }).join('');

    const report = this.lastTrade
      ? `<div class="trade-report ${this.lastTrade.cls}">${this.lastTrade.msg}</div>`
      : '<div class="trade-report dim">PAID = avg you paid per unit · P/L = profit per unit if sold here · CLICK A COMMODITY TO VIEW PRICE TRENDS</div>';

    this.body.innerHTML = `
      <table class="market">
        <tr><th>COMMODITY</th><th style="text-align:right">BUY</th><th style="text-align:right">SELL</th><th style="text-align:right">HELD</th><th style="text-align:right">PAID</th><th style="text-align:right">P/L</th><th></th></tr>
        ${rows}
      </table>
      ${report}
      <div style="margin-top:6px;font-size:11px;color:rgba(159,232,255,0.55)">
        <span class="cheap">GREEN</span> = good price here · <span class="dear">RED</span> = bad price here
      </div>
      ${this.renderRares()}
    `;

    this.body.querySelectorAll('button[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tr = btn.closest('tr');
        this.trade(tr.dataset.good, btn.dataset.act, btn.dataset.qty);
      });
    });
    // Add row click listener for expanding detail row:
    this.body.querySelectorAll('tr[data-good]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const goodId = row.dataset.good;
        this.selectedGoodId = this.selectedGoodId === goodId ? null : goodId;
        this.renderTab();
      });
    });
    this.body.querySelector('button[data-rare-buy]')?.addEventListener('click', () => {
      const offer = RareGoods.offerFor(this.planetDef, this.player);
      if (RareGoods.buy(offer, 1, this.player)) {
        this.rareBought = (this.rareBought || 0) + 1;
        this.lastTrade = { msg: `BOUGHT 1x ${offer.name.toUpperCase()} — WORTH MORE THE FURTHER YOU CARRY IT`, cls: '' };
        this.renderTab();
      }
    });
    this.body.querySelectorAll('button[data-rare-sell]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = RareGoods.sell(btn.dataset.rareSell, this.planetDef, this.player);
        if (!res) return;
        let xpText = '';
        if (res.profit > 0) {
          const xp = Progression.XP.tradeProfit(res.profit);
          const levels = Progression.award(this.player, xp);
          xpText = ` · +${xp} XP${levels > 0 ? ' · LEVEL UP!' : ''}`;
        }
        this.lastTrade = {
          msg: `SOLD ${res.name.toUpperCase()} FOR ${res.proceeds.toLocaleString()} CR — PROFIT ${res.profit >= 0 ? '+' : ''}${res.profit.toLocaleString()} CR${xpText}`,
          cls: res.profit >= 0 ? 'profit' : 'loss',
        };
        this.renderTab();
      });
    });
  }

  // ---------- RARE GOODS ----------
  renderRares() {
    const p = this.player;
    const offer = RareGoods.offerFor(this.planetDef, p);
    const canBuyMore = (this.rareBought || 0) < 2;

    const heldRows = p.rares.map((r) => {
      const unit = RareGoods.sellValue(r, this.planetDef, p);
      const atOrigin = r.originId === this.planetDef.id;
      return `
        <div class="mission-row">
          <div class="m-name">${r.name} ×${r.qty}</div>
          <div class="m-detail">From ${r.originName} · paid ~${Math.round(r.paid)} CR each${atOrigin ? ' · carry it further for profit' : ''}</div>
          <div class="m-reward">${unit.toLocaleString()} CR/u</div>
          <button data-rare-sell="${r.id}">Sell All</button>
        </div>`;
    }).join('');

    return `
      <div class="m-section" style="margin-top:14px">RARE GOODS — LOCAL SPECIALTY</div>
      <div class="mission-row">
        <div class="m-name">${offer.name}</div>
        <div class="m-detail">Sold only here. Value rises with distance carried · uses 1 cargo unit · max 2 per visit</div>
        <div class="m-reward">${offer.price.toLocaleString()} CR</div>
        <button data-rare-buy="1" ${canBuyMore && p.credits >= offer.price && p.cargoSpace() >= 1 ? '' : 'disabled'}>Buy 1</button>
      </div>
      ${heldRows}`;
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
        else if (p.crew.length > s.crew) block = 'DISMISS CREW FIRST';
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
        if (p.cargoUsed() > newCargoMax || p.modules.length > s.slots || p.crew.length > s.crew) return;
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
    const mslMax = stats.missilesMaxAmmo;
    const mslAmmo = this.player.missilesAmmo == null ? mslMax : Math.min(this.player.missilesAmmo, mslMax);
    const mslMissing = mslMax - mslAmmo;
    const mslCost = mslMissing * C.MISSILE_RESTOCK_COST;
    this.body.innerHTML = `
      <div class="repair-box">
        <div>HULL INTEGRITY</div>
        <div class="bar hull"><div class="fill" style="transform:scaleX(${this.player.hull / stats.hullMax})"></div></div>
        <div style="margin:8px 0 16px 0">${Math.round(this.player.hull)} / ${stats.hullMax}</div>
        <button id="repair-btn" ${missing > 0 && this.player.credits >= cost ? '' : 'disabled'}>
          ${missing > 0 ? `Repair All — ${cost.toLocaleString()} CR` : 'Hull at full integrity'}
        </button>
        ${mslMax > 0 ? `
          <div style="margin-top:28px">MISSILE STORES</div>
          <div class="bar missiles"><div class="fill" style="transform:scaleX(${mslAmmo / mslMax})"></div></div>
          <div style="margin:8px 0 16px 0">${mslAmmo} / ${mslMax}</div>
          <button id="restock-btn" ${mslMissing > 0 && this.player.credits >= mslCost ? '' : 'disabled'}>
            ${mslMissing > 0 ? `Restock ${mslMissing} Missile${mslMissing > 1 ? 's' : ''} — ${mslCost.toLocaleString()} CR` : 'Missile racks full'}
          </button>
        ` : ''}
      </div>
    `;
    const btn = this.body.querySelector('#repair-btn');
    btn?.addEventListener('click', () => {
      if (this.player.credits < cost) return;
      this.player.credits -= cost;
      this.player.hull = stats.hullMax;
      this.renderTab();
    });
    const restock = this.body.querySelector('#restock-btn');
    restock?.addEventListener('click', () => {
      if (this.player.credits < mslCost) return;
      this.player.credits -= mslCost;
      this.player.missilesAmmo = mslMax;
      this.renderTab();
    });
  }

  // ---------- MARKET DETAIL HELPERS ----------
  renderGraph(goodId) {
    const pts = this.market.history[this.planetDef.id]?.[goodId] || [];
    if (!pts.length) return '<div class="m-detail">No history available yet.</div>';

    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min;

    const w = 260;
    const h = 80;
    const paddingX = 10;
    const paddingY = 12;
    const chartW = w - paddingX * 2;
    const chartH = h - paddingY * 2;

    const points = pts.map((val, idx) => {
      const x = paddingX + (idx / (pts.length - 1)) * chartW;
      const y = paddingY + chartH - (range > 0 ? ((val - min) / range) * chartH : chartH / 2);
      return { x, y, val };
    });

    const pathD = 'M ' + points.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ');
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(h - paddingY).toFixed(1)} L ${points[0].x.toFixed(1)} ${(h - paddingY).toFixed(1)} Z`;

    const lastPt = points[points.length - 1];
    const gridY = [paddingY, paddingY + chartH / 2, paddingY + chartH];

    return `
      <svg class="history-chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <defs>
          <linearGradient id="chart-grad-${goodId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#37d0ff" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#37d0ff" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <!-- Horizontal Grid Lines -->
        ${gridY.map(y => `<line x1="${paddingX}" y1="${y}" x2="${w - paddingX}" y2="${y}" stroke="rgba(80, 220, 255, 0.08)" stroke-dasharray="2,2" />`).join('')}
        
        <!-- Area under line -->
        <path d="${areaD}" fill="url(#chart-grad-${goodId})" />
        
        <!-- The line itself -->
        <path d="${pathD}" fill="none" stroke="#37d0ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        
        <!-- Latest point dot with SVG animation -->
        <circle cx="${lastPt.x}" cy="${lastPt.y}" r="3" fill="#fff" stroke="#37d0ff" stroke-width="1.5" />
        <circle cx="${lastPt.x}" cy="${lastPt.y}" r="3" fill="none" stroke="#37d0ff" stroke-width="1">
          <animate attributeName="r" values="3;9" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite" />
        </circle>
        
        <!-- Price labels on left and right -->
        <text class="chart-text" x="${paddingX}" y="${paddingY - 3}" text-anchor="start">${Math.round(max)} CR</text>
        <text class="chart-text" x="${paddingX}" y="${h - paddingY + 9}" text-anchor="start">${Math.round(min)} CR</text>
        <text class="chart-text" x="${w - paddingX}" y="${h - paddingY + 9}" text-anchor="end">Now</text>
      </svg>
    `;
  }

  getMarketPerspective(goodId) {
    const p = this.planetDef;
    const g = COMMODITIES.find((c) => c.id === goodId);
    const ev = this.market.eventFor(p.id, goodId);
    if (ev) {
      return `CRITICAL: ${ev.headline}. Relief supplies of ${g.name} are urgently needed. Fulfill supply contracts or sell directly to the market for massive returns.`;
    }
    if (p.exports.includes(goodId)) {
      return `Export Commodity: ${p.name} is a major producer of ${g.name}. Local supplies are abundant, keeping prices low. Excellent opportunity for export trade routes.`;
    }
    if (p.imports.includes(goodId)) {
      return `Import Commodity: ${p.name} has a high consumption of ${g.name} but zero local production. Local merchants pay a premium to import it. Sell here to maximize profit.`;
    }
    return `Neutral Trade: Standard supply and demand. Prices are stable but subject to random galactic drift and local trade volumes.`;
  }
}
