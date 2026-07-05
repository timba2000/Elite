import { C } from '../constants.js';
import { COMMODITIES } from '../economy/commodities.js';

// Docked panel: Market / Shipyard / Repair tabs + undock.
export class StationUI {
  constructor(uiRoot) {
    this.root = document.createElement('div');
    this.root.id = 'station-ui';
    this.root.className = 'panel';
    uiRoot.appendChild(this.root);
    this.tab = 'market';
  }

  show(planetDef, market, playerData, callbacks) {
    this.planetDef = planetDef;
    this.market = market;
    this.player = playerData;
    this.cb = callbacks; // { undock, onUpgrade }
    this.tab = 'market';
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
      </div>
      <div class="st-tabs">
        <button data-tab="market">Market</button>
        <button data-tab="shipyard">Shipyard</button>
        <button data-tab="repair">Repair</button>
        <button class="amber" data-tab="undock">Undock</button>
      </div>
      <div class="st-body"></div>
    `;
    this.statusEl = this.root.querySelector('.st-status');
    this.body = this.root.querySelector('.st-body');
    this.root.querySelectorAll('.st-tabs button').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.tab === 'undock') { this.cb.undock(); return; }
        this.tab = b.dataset.tab;
        this.renderTab();
      });
    });
    this.renderTab();
  }

  renderStatus() {
    const stats = this.player.getDerivedStats();
    let txt = `${this.player.credits.toLocaleString()} CR   ·   CARGO ${this.player.cargoUsed()}/${stats.cargoMax}   ·   HULL ${Math.round(this.player.hull)}/${stats.hullMax}`;
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
    else if (this.tab === 'shipyard') this.renderShipyard();
    else if (this.tab === 'repair') this.renderRepair();
  }

  // ---------- MARKET ----------
  renderMarket() {
    const rows = COMMODITIES.map((g) => {
      const { buy, sell } = this.market.price(this.planetDef.id, g.id);
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
    const { buy, sell } = this.market.price(this.planetDef.id, goodId);
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
      p.removeCargo(goodId, qty);
      this.market.recordTrade(this.planetDef.id, goodId, qty, false);
      const plText = profit >= 0
        ? `PROFIT +${profit.toLocaleString()} CR`
        : `LOSS −${Math.abs(profit).toLocaleString()} CR`;
      this.lastTrade = {
        msg: `SOLD ${qty}x ${name} FOR ${(qty * sell).toLocaleString()} CR — ${plText}`,
        cls: profit >= 0 ? 'profit' : 'loss',
      };
      if (goodId === 'narcotics') {
        p.notoriety = Math.min(100, (p.notoriety || 0) + qty * 1.5);
      }
    }
    this.renderTab();
  }

  // ---------- SHIPYARD ----------
  renderShipyard() {
    const effects = {
      engine: (t) => `Speed ${t.maxSpeed} · Boost ${t.boost} · Turn +${Math.round((t.turnMult - 1) * 100)}%`,
      weapons: (t) => `${t.damage} DMG · ${(1 / t.interval).toFixed(1)}/s${t.twin ? ' · TWIN-LINKED' : ''}`,
      shield: (t) => `${t.max} capacity · ${t.regen}/s regen`,
      hull: (t) => `${t.max} hull integrity`,
      cargo: (t) => `${t.max} cargo units`,
      dockingComputer: (t) => t.fitted ? 'Hands-free docking on request' : 'Manual approach only',
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

    this.body.innerHTML = rows;
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
  }

  // ---------- REPAIR ----------
  renderRepair() {
    const stats = this.player.getDerivedStats();
    const missing = Math.max(0, Math.round(stats.hullMax - this.player.hull));
    const cost = missing * C.REPAIR_COST_PER_POINT;
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
