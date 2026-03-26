'use strict';

/* ══════════════════════════════════════════════════════════════
   MÓDULO: MY_TOKENS  v2.0
   FIX #6: Los tokens creados persisten permanentemente onchain.
   FIX #6: Los admins pueden ocultar/mostrar tokens desde el panel.
   FIX #7: Infraestructura real — datos desde TokenFactory onchain.
══════════════════════════════════════════════════════════════ */

const MY_TOKENS = {
  _tokens: [],
  // LS key para visibilidad controlada por admin
  _LS_VIS_KEY: 'miswap_token_visibility',

  // ── Leer visibilidad guardada por admin ───────────────────────────────────
  _getVisibility() {
    try {
      const raw = localStorage.getItem(this._LS_VIS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  },

  _setVisibility(addr, visible) {
    const vis = this._getVisibility();
    vis[addr.toLowerCase()] = visible;
    try { localStorage.setItem(this._LS_VIS_KEY, JSON.stringify(vis)); } catch (_) {}
  },

  _isVisible(addr) {
    const vis = this._getVisibility();
    const key = addr.toLowerCase();
    // Por defecto visible (true), a menos que admin lo oculte explícitamente
    return vis[key] !== false;
  },

  render() {
    const sec = document.getElementById('section-my-tokens');
    if (!sec) return;
    sec.innerHTML = `
      <div class="mi-section-card">
        <div class="mi-section-header">
          <span class="mi-section-icon">👜</span>
          <div style="flex:1">
            <div class="mi-section-title" data-i18n="my_tokens_title">My Tokens</div>
            <div class="mi-section-sub" data-i18n="my_tokens_sub">Tokens created with your wallet</div>
          </div>
          <button class="info-btn" data-info="my-tokens">ℹ Info</button>
        </div>
        <div id="myTokensGrid" class="my-tokens-grid">
          <div class="mi-empty" data-i18n="my_tokens_empty">Connect your wallet to see your tokens.</div>
        </div>
        <button id="myTokensRefresh" class="btn btn-gl btn-sm mt10" data-i18n="refresh">
          🔄 Refresh
        </button>
      </div>

      <!-- Sección admin: control de visibilidad de tokens -->
      <div class="mi-section-card" id="myTokensAdminCard" style="display:none">
        <div class="mi-section-header">
          <span class="mi-section-icon">🛡</span>
          <div>
            <div class="mi-section-title">Admin: Visibility Control</div>
            <div class="mi-section-sub">Show or hide tokens from the public listing</div>
          </div>
        </div>
        <div id="myTokensVisibilityList">
          <div class="mi-empty">Load tokens first.</div>
        </div>
      </div>`;

    LANG.apply();
    const btn = document.getElementById('myTokensRefresh');
    if (btn) btn.addEventListener('click', () => this.load());
  },

  async load() {
    const grid = document.getElementById('myTokensGrid');
    if (!grid) return;
    if (!STATE.walletConnected) {
      grid.innerHTML = `<div class="mi-empty" data-i18n="my_tokens_connect">${LANG.t('my_tokens_connect')}</div>`;
      return;
    }
    grid.innerHTML = '<div class="mi-loading">⏳ Loading tokens…</div>';

    // Mostrar panel admin de visibilidad si es admin
    const adminCard = document.getElementById('myTokensAdminCard');
    if (adminCard) adminCard.style.display = WALLET.isAdmin() ? 'block' : 'none';

    if (!CONFIG.TOKEN_FACTORY_ADDRESS) {
      // FIX #7: Sin contrato — mostrar aviso pero estructura lista
      grid.innerHTML = `
        <div class="mi-notice mi-notice-warn" style="flex-direction:column;gap:8px">
          <strong>Token Factory not yet deployed</strong>
          <span style="font-size:.78rem;color:var(--t3)">Once the TokenFactory contract is deployed at <code style="color:var(--ac)">${GUARDS.esc(CONFIG.TOKEN_FACTORY_ADDRESS || '(address pending)')}</code>, all tokens you create will appear here permanently.</span>
        </div>`;
      return;
    }

    try {
      const factory = CHAIN.getTokenFactoryReadContract();
      const addrs   = await CHAIN.callWithFallback(() => factory.getTokensByCreator(STATE.walletAddress));
      this._tokens  = [];

      if (!addrs || addrs.length === 0) {
        grid.innerHTML = `<div class="mi-empty" data-i18n="my_tokens_none">${LANG.t('my_tokens_none')}</div>`;
        this._renderAdminVisibility([]);
        return;
      }

      for (const addr of addrs) {
        try {
          const infoRes = await CHAIN.callWithFallback(() => factory.getTokenInfo(addr)).catch(() => null);
          const tokenContract = new ethers.Contract(addr, CONFIG.TOKEN_ABI, CHAIN._getReadProvider());
          const balWei  = await CHAIN.callWithFallback(() => tokenContract.balanceOf(STATE.walletAddress)).catch(() => 0n);
          const bal     = Number(ethers.formatUnits(balWei, 18));
          const name    = infoRes ? infoRes.name   : addr.slice(0,6) + '…' + addr.slice(-4);
          const symbol  = infoRes ? infoRes.symbol : '???';
          const iconData= infoRes ? infoRes.iconData : '';
          const supply  = infoRes ? Number(infoRes.supply) : 0;
          if (iconData) TOKEN_ICONS.setTokenIcon(addr, iconData);
          this._tokens.push({
            address: addr, name, symbol, bal, iconData, supply,
            visible: this._isVisible(addr),
          });
        } catch (_) {
          // Token todavía aparece aunque falle la carga de info
          this._tokens.push({ address: addr, name: 'Unknown', symbol: '???', bal: 0, iconData: '', supply: 0, visible: true });
        }
      }

      this._renderGrid(grid);
      this._renderAdminVisibility(this._tokens);
    } catch (err) {
      grid.innerHTML = `<div class="mi-notice mi-notice-err">Error loading tokens: ${GUARDS.esc(err.message || String(err))}</div>`;
    }
  },

  _renderGrid(grid) {
    const visibleTokens = this._tokens.filter(tok => tok.visible);
    if (!visibleTokens.length) {
      grid.innerHTML = `<div class="mi-empty">No visible tokens. ${WALLET.isAdmin() ? 'Use the admin section below to show tokens.' : ''}</div>`;
      return;
    }
    grid.innerHTML = '';
    visibleTokens.forEach(tok => {
      const card = document.createElement('div');
      card.className = 'my-tok-card';
      const iconEl = tok.iconData
        ? (() => { const img = document.createElement('img'); img.src = tok.iconData; img.alt = tok.symbol; img.className = 'my-tok-icon'; return img; })()
        : (() => { const d = document.createElement('div'); d.className = 'my-tok-icon-placeholder'; d.textContent = (tok.symbol || '?')[0]; return d; })();
      const shortAddr = tok.address.slice(0, 6) + '…' + tok.address.slice(-4);
      const head = document.createElement('div'); head.className = 'my-tok-head';
      const info = document.createElement('div'); info.className = 'my-tok-info';
      const nameEl = document.createElement('div'); nameEl.className = 'my-tok-name'; nameEl.textContent = tok.name;
      const symEl  = document.createElement('div'); symEl.className  = 'my-tok-sym';  symEl.textContent  = tok.symbol;
      info.append(nameEl, symEl);
      head.append(iconEl, info);
      const balEl  = document.createElement('div'); balEl.className  = 'my-tok-bal';  balEl.textContent  = tok.bal.toLocaleString() + ' ' + tok.symbol;
      const addrEl = document.createElement('div'); addrEl.className = 'my-tok-addr'; addrEl.title = tok.address; addrEl.textContent = shortAddr;
      // BscScan link
      const bscLink = document.createElement('a');
      bscLink.href = 'https://bscscan.com/token/' + tok.address;
      bscLink.target = '_blank';
      bscLink.rel = 'noopener noreferrer';
      bscLink.style.cssText = 'font-size:.62rem;color:var(--ac);text-decoration:none;';
      bscLink.textContent = '🔗 BscScan';
      const actions = document.createElement('div'); actions.className = 'my-tok-actions';
      const bridgeBtn = document.createElement('button'); bridgeBtn.className = 'btn btn-gl btn-sm'; bridgeBtn.textContent = '🌉 Bridge';
      bridgeBtn.addEventListener('click', () => typeof MENU !== 'undefined' && MENU.show('bridge-usdt'));
      const poolBtn = document.createElement('button'); poolBtn.className = 'btn btn-gl btn-sm'; poolBtn.textContent = '💧 Pool';
      poolBtn.addEventListener('click', () => typeof MENU !== 'undefined' && MENU.show('create-pool'));
      actions.append(bridgeBtn, poolBtn);
      card.append(head, balEl, addrEl, bscLink, actions);
      grid.appendChild(card);
    });
  },

  // ── Panel admin: control de visibilidad ──────────────────────────────────
  _renderAdminVisibility(tokens) {
    const list = document.getElementById('myTokensVisibilityList');
    if (!list || !WALLET.isAdmin()) return;

    if (!tokens.length) {
      list.innerHTML = '<div class="mi-empty">No tokens to manage.</div>';
      return;
    }

    list.innerHTML = '';
    tokens.forEach(tok => {
      const row = document.createElement('div');
      row.className = 'tok-visibility-row';
      const shortAddr = tok.address.slice(0, 6) + '…' + tok.address.slice(-4);
      row.innerHTML = `
        <div class="tok-vis-info">
          <div class="tok-vis-name">${GUARDS.esc(tok.symbol)} — ${GUARDS.esc(tok.name)}</div>
          <div class="tok-vis-addr">${GUARDS.esc(shortAddr)}</div>
        </div>
        <div class="tok-vis-toggle">
          <span class="tok-vis-label">${tok.visible ? 'Visible' : 'Hidden'}</span>
          <label class="mi-toggle">
            <input type="checkbox" ${tok.visible ? 'checked' : ''} data-addr="${GUARDS.esc(tok.address)}">
            <span class="mi-toggle-slider"></span>
          </label>
        </div>`;

      const input = row.querySelector('input[type=checkbox]');
      const label = row.querySelector('.tok-vis-label');
      if (input && label) {
        input.addEventListener('change', () => {
          const addr = input.dataset.addr;
          const vis  = input.checked;
          this._setVisibility(addr, vis);
          label.textContent = vis ? 'Visible' : 'Hidden';
          // Update in _tokens array
          const t = this._tokens.find(x => x.address.toLowerCase() === addr.toLowerCase());
          if (t) t.visible = vis;
          // Re-render grid
          const grid = document.getElementById('myTokensGrid');
          if (grid) this._renderGrid(grid);
          UI.notif('ok', vis ? 'Token shown' : 'Token hidden', GUARDS.esc(tok.symbol));
        });
      }
      list.appendChild(row);
    });
  },

  init() {
    this.render();
  },
};
