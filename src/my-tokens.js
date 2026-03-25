'use strict';

const MY_TOKENS = {
  _tokens: [],

  render() {
    const sec = document.getElementById('section-my-tokens');
    if (!sec) return;
    sec.innerHTML = `
      <div class="mi-section-card">
        <div class="mi-section-header">
          <span class="mi-section-icon">👜</span>
          <div style="flex:1">
            <div class="mi-section-title" data-i18n="my_tokens_title">Mis Tokens</div>
            <div class="mi-section-sub" data-i18n="my_tokens_sub">Tokens creados con tu wallet</div>
          </div>
          <button class="info-btn" data-info="my-tokens">ℹ Info</button>
        </div>
        <div id="myTokensGrid" class="my-tokens-grid">
          <div class="mi-empty" data-i18n="my_tokens_empty">Conecta tu wallet para ver tus tokens.</div>
        </div>
        <button id="myTokensRefresh" class="btn btn-gl btn-sm mt10" data-i18n="refresh">
          🔄 Actualizar
        </button>
      </div>`;
    LANG.apply();
    const btn = document.getElementById('myTokensRefresh');
    if (btn) btn.addEventListener('click', () => this.load());
  },

  async load() {
    const grid = document.getElementById('myTokensGrid');
    if (!grid) return;
    if (!STATE.walletConnected) {
      grid.innerHTML = '<div class="mi-empty" data-i18n="my_tokens_connect">Conecta tu wallet para ver tus tokens.</div>';
      LANG.apply();
      return;
    }
    grid.innerHTML = '<div class="mi-loading">⏳ Cargando tokens…</div>';

    if (!CONFIG.TOKEN_FACTORY_ADDRESS) {
      grid.innerHTML = '<div class="mi-empty">El contrato aún no ha sido deployado. Funcionalidad disponible próximamente.</div>';
      return;
    }

    try {
      const factory = CHAIN.getTokenFactoryReadContract();
      const addrs   = await factory.getTokensByCreator(STATE.account);
      this._tokens  = [];

      if (!addrs || addrs.length === 0) {
        grid.innerHTML = '<div class="mi-empty" data-i18n="my_tokens_none">No has creado tokens aún. ¡Crea tu primer token!</div>';
        LANG.apply();
        return;
      }

      for (const addr of addrs) {
        try {
          const infoRes = await factory.getTokenInfo(addr).catch(() => null);
          const tokenContract = new ethers.Contract(addr, CONFIG.TOKEN_ABI, CHAIN._getReadProvider());
          const balWei  = await tokenContract.balanceOf(STATE.account).catch(() => 0n);
          const bal     = Number(ethers.formatUnits(balWei, 18));
          const name    = infoRes ? infoRes.name   : '—';
          const symbol  = infoRes ? infoRes.symbol : '?';
          const iconData= infoRes ? infoRes.iconData : '';
          if (iconData) TOKEN_ICONS.setTokenIcon(addr, iconData);
          this._tokens.push({ address: addr, name, symbol, bal, iconData });
        } catch (_) {}
      }

      this._renderGrid(grid);
    } catch (err) {
      grid.innerHTML = `<div class="mi-empty mi-notice-err">Error al cargar tokens: ${err.message || err}</div>`;
    }
  },

  _renderGrid(grid) {
    if (!this._tokens.length) {
      grid.innerHTML = '<div class="mi-empty">No has creado tokens aún.</div>';
      return;
    }
    grid.innerHTML = '';
    this._tokens.forEach((tok, idx) => {
      const card = document.createElement('div');
      card.className = 'my-tok-card';
      const iconEl = tok.iconData
        ? Object.assign(document.createElement('img'), { src: tok.iconData, alt: tok.symbol, className: 'my-tok-icon' })
        : (() => { const d = document.createElement('div'); d.className = 'my-tok-icon-placeholder'; d.textContent = tok.symbol[0] || '?'; return d; })();
      const shortAddr = tok.address.slice(0, 6) + '…' + tok.address.slice(-4);
      const head = document.createElement('div');
      head.className = 'my-tok-head';
      const info = document.createElement('div');
      info.className = 'my-tok-info';
      const nameEl = document.createElement('div');
      nameEl.className = 'my-tok-name';
      nameEl.textContent = tok.name;
      const symEl = document.createElement('div');
      symEl.className = 'my-tok-sym';
      symEl.textContent = tok.symbol;
      info.append(nameEl, symEl);
      head.append(iconEl, info);
      const balEl = document.createElement('div');
      balEl.className = 'my-tok-bal';
      balEl.textContent = tok.bal.toLocaleString() + ' ' + tok.symbol;
      const addrEl = document.createElement('div');
      addrEl.className = 'my-tok-addr';
      addrEl.title = tok.address;
      addrEl.textContent = shortAddr;
      const actions = document.createElement('div');
      actions.className = 'my-tok-actions';
      const bridgeBtn = document.createElement('button');
      bridgeBtn.className = 'btn btn-gl btn-sm';
      bridgeBtn.textContent = '🌉 Bridge';
      bridgeBtn.addEventListener('click', () => MENU.show('bridge-usdt'));
      const poolBtn = document.createElement('button');
      poolBtn.className = 'btn btn-gl btn-sm';
      poolBtn.textContent = '💧 Pool';
      poolBtn.addEventListener('click', () => MENU.show('create-pool'));
      const iconBtn = document.createElement('button');
      iconBtn.className = 'btn btn-gl btn-sm';
      iconBtn.textContent = '🖼️ Ícono';
      iconBtn.addEventListener('click', () => this._editIcon(tok.address));
      actions.append(bridgeBtn, poolBtn, iconBtn);
      card.append(head, balEl, addrEl, actions);
      grid.appendChild(card);
    });
  },

  _editIcon(tokenAddr) {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = 'image/png,image/svg+xml,image/jpeg,image/webp';
    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const b64 = await TOKEN_ICONS.loadIcon(file);
        TOKEN_ICONS.setTokenIcon(tokenAddr, b64);
        // Re-render
        const tok = this._tokens.find(t => t.address === tokenAddr);
        if (tok) { tok.iconData = b64; }
        this._renderGrid(document.getElementById('myTokensGrid'));
      } catch (err) {
        alert(err.message);
      }
    });
    input.click();
  },

  init() {
    this.render();
  },
};
