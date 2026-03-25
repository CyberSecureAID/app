'use strict';

/*
 * FLASH_TOKEN module — Temporary tokens on BNB Smart Chain.
 *
 * Supports two expiration modes:
 *   Mode A — Time-Limited:        token becomes invalid after N days.
 *   Mode B — Transaction-Limited: token is destroyed after N transfers.
 *
 * All functionality is handled by the single centralized smart contract
 * at CONFIG.FLASH_TOKEN_ADDRESS (part of the unified upgradeable contract
 * architecture — see config.js for details).
 *
 * NOTE: Content configuration (fees, limits, text) can be managed from the
 * admin panel (ADMIN_CONFIG_ADDRESS) and updated in future versions without
 * redeploying.
 */

const FLASH_TOKEN = {
  _mode: 'time', // 'time' | 'tx'

  render() {
    const sec = document.getElementById('section-flash-token');
    if (!sec) return;

    sec.innerHTML = `
      <div class="mi-section-card">
        <div class="mi-section-header">
          <div>
            <div class="mi-section-title" data-i18n="flash_token_title">Flash Tokens</div>
            <div class="mi-section-sub" data-i18n="flash_token_sub">Create temporary tokens with automatic expiration</div>
          </div>
        </div>

        <!-- ── How it works ── -->
        <div class="mi-info-box" style="margin-bottom:16px">
          <div class="mi-info-title" data-i18n="flash_how_title">How Flash Tokens Work</div>
          <ol class="mi-steps">
            <li data-i18n="flash_step1">Choose an expiration mode: time-limited or transaction-limited.</li>
            <li data-i18n="flash_step2">Fill in the token details and set the expiration limit.</li>
            <li data-i18n="flash_step3">Pay the creation fee and confirm the transaction in your wallet.</li>
            <li data-i18n="flash_step4">The token is deployed instantly. Once the limit is reached, the token is automatically invalidated.</li>
          </ol>
        </div>

        <!-- ── Not configured notice ── -->
        <div id="flashTokenNotConfigured" class="mi-notice mi-notice-warn" style="display:none">
          <span data-i18n="contract_not_configured">Contract not yet deployed. Feature coming soon.</span>
        </div>

        <!-- ── Creation form ── -->
        <div id="flashTokenForm">

          <!-- Fee banner -->
          <div class="mi-fee-banner">
            <span data-i18n="creation_fee">Creation fee:</span>
            <strong>0.2 BNB</strong>
            <span class="mi-fee-note" data-i18n="plus_gas">+ estimated gas</span>
          </div>

          <!-- Token Name -->
          <div class="mi-field">
            <label class="mi-label" data-i18n="token_name_label">Token Name</label>
            <input type="text" id="ftName" class="mi-input" placeholder="e.g. Flash USD" maxlength="50">
            <div class="mi-hint" data-i18n="token_name_hint">2–50 characters</div>
          </div>

          <!-- Symbol -->
          <div class="mi-field">
            <label class="mi-label" data-i18n="token_symbol_label">Symbol</label>
            <input type="text" id="ftSymbol" class="mi-input" placeholder="e.g. FUSD" maxlength="8" style="text-transform:uppercase">
            <div class="mi-hint" data-i18n="token_symbol_hint">2–8 letters only</div>
          </div>

          <!-- Total Supply -->
          <div class="mi-field">
            <label class="mi-label" data-i18n="token_supply_label">Total Supply</label>
            <input type="number" id="ftSupply" class="mi-input" placeholder="e.g. 1000000" min="1" max="1000000000000">
            <div class="mi-hint" data-i18n="token_supply_hint">1 – 1,000,000,000,000</div>
          </div>

          <!-- Expiration Mode -->
          <div class="mi-field">
            <label class="mi-label" data-i18n="flash_mode_label">Expiration Mode</label>
            <div class="mi-seg-ctrl" id="ftModeCtrl">
              <button class="mi-seg-btn mi-seg-active" id="ftModeTime" data-i18n="flash_mode_time">Time-Limited</button>
              <button class="mi-seg-btn" id="ftModeTx" data-i18n="flash_mode_tx">Transaction-Limited</button>
            </div>
          </div>

          <!-- Time limit (shown when mode = time) -->
          <div class="mi-field" id="ftTimeLimitWrap">
            <label class="mi-label" data-i18n="flash_time_label">Duration (days)</label>
            <div class="mi-seg-ctrl">
              <button class="mi-seg-btn mi-seg-active" data-days="3">3</button>
              <button class="mi-seg-btn" data-days="8">8</button>
              <button class="mi-seg-btn" data-days="15">15</button>
              <button class="mi-seg-btn" data-days="30">30</button>
            </div>
            <input type="number" id="ftDays" class="mi-input mt8" placeholder="or enter custom days" min="1" max="365">
            <div class="mi-hint" data-i18n="flash_time_hint">1–365 days. Token becomes invalid after this period.</div>
          </div>

          <!-- Transaction limit (shown when mode = tx) -->
          <div class="mi-field" id="ftTxLimitWrap" style="display:none">
            <label class="mi-label" data-i18n="flash_tx_label">Transfer Limit</label>
            <div class="mi-seg-ctrl">
              <button class="mi-seg-btn mi-seg-active" data-txs="3">3</button>
              <button class="mi-seg-btn" data-txs="5">5</button>
              <button class="mi-seg-btn" data-txs="10">10</button>
              <button class="mi-seg-btn" data-txs="25">25</button>
            </div>
            <input type="number" id="ftTxs" class="mi-input mt8" placeholder="or enter custom number" min="1" max="1000">
            <div class="mi-hint" data-i18n="flash_tx_hint">1–1000 transfers. Token is destroyed once the limit is reached.</div>
          </div>

          <!-- Validation message -->
          <div id="ftValidationMsg" class="mi-notice mi-notice-err" style="display:none"></div>

          <!-- Create button -->
          <button id="ftCreateBtn" class="btn btn-iris btn-full btn-lg mt10" data-i18n="flash_create_btn">
            Create Flash Token
          </button>
          <div id="ftStatusMsg" class="mi-status" style="display:none"></div>
        </div>
      </div>

      <!-- ── My Flash Tokens ── -->
      <div class="mi-section-card" style="margin-top:16px">
        <div class="mi-section-header">
          <div>
            <div class="mi-section-title" data-i18n="flash_my_title">My Flash Tokens</div>
            <div class="mi-section-sub" data-i18n="flash_my_sub">Tokens created with your wallet</div>
          </div>
        </div>
        <div id="ftList">
          <div class="tx-empty" data-i18n="flash_my_empty">Connect your wallet to see your Flash Tokens.</div>
        </div>
        <button id="ftRefreshBtn" class="btn btn-gl btn-full mt10" data-i18n="refresh">Refresh</button>
      </div>`;

    this._bindEvents();
    LANG.apply();
  },

  _bindEvents() {
    // Mode toggle
    const modeTime = document.getElementById('ftModeTime');
    const modeTx   = document.getElementById('ftModeTx');
    if (modeTime) modeTime.addEventListener('click', () => this._setMode('time'));
    if (modeTx)   modeTx.addEventListener('click',   () => this._setMode('tx'));

    // Preset day buttons
    document.querySelectorAll('#ftTimeLimitWrap .mi-seg-btn[data-days]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#ftTimeLimitWrap .mi-seg-btn').forEach(b => b.classList.remove('mi-seg-active'));
        btn.classList.add('mi-seg-active');
        const daysEl = document.getElementById('ftDays');
        if (daysEl) daysEl.value = btn.dataset.days;
      });
    });

    // Preset tx buttons
    document.querySelectorAll('#ftTxLimitWrap .mi-seg-btn[data-txs]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#ftTxLimitWrap .mi-seg-btn').forEach(b => b.classList.remove('mi-seg-active'));
        btn.classList.add('mi-seg-active');
        const txsEl = document.getElementById('ftTxs');
        if (txsEl) txsEl.value = btn.dataset.txs;
      });
    });

    // Auto-uppercase symbol
    const symEl = document.getElementById('ftSymbol');
    if (symEl) symEl.addEventListener('input', function() { this.value = this.value.toUpperCase(); });

    // Create button
    const createBtn = document.getElementById('ftCreateBtn');
    if (createBtn) createBtn.addEventListener('click', () => this.create());

    // Refresh button
    const refreshBtn = document.getElementById('ftRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadMyTokens());
  },

  _setMode(mode) {
    this._mode = mode;
    const timeWrap = document.getElementById('ftTimeLimitWrap');
    const txWrap   = document.getElementById('ftTxLimitWrap');
    const btnTime  = document.getElementById('ftModeTime');
    const btnTx    = document.getElementById('ftModeTx');
    if (timeWrap) timeWrap.style.display = mode === 'time' ? 'block' : 'none';
    if (txWrap)   txWrap.style.display   = mode === 'tx'   ? 'block' : 'none';
    if (btnTime) btnTime.classList.toggle('mi-seg-active', mode === 'time');
    if (btnTx)   btnTx.classList.toggle('mi-seg-active',   mode === 'tx');
  },

  _validate() {
    const name   = (document.getElementById('ftName')   || {}).value || '';
    const symbol = (document.getElementById('ftSymbol') || {}).value || '';
    const supply = (document.getElementById('ftSupply') || {}).value || '';
    if (name.trim().length < 2 || name.trim().length > 50) {
      return LANG.t('token_name_hint');
    }
    if (!/^[A-Za-z]{2,8}$/.test(symbol)) {
      return LANG.t('token_symbol_hint');
    }
    const supplyNum = Number(supply);
    if (!Number.isFinite(supplyNum) || supplyNum < 1 || supplyNum > 1_000_000_000_000) {
      return LANG.t('token_supply_hint');
    }
    if (this._mode === 'time') {
      const days = Number((document.getElementById('ftDays') || {}).value || 0);
      if (!Number.isFinite(days) || days < 1 || days > 365) {
        return LANG.t('flash_time_hint');
      }
    } else {
      const txs = Number((document.getElementById('ftTxs') || {}).value || 0);
      if (!Number.isFinite(txs) || txs < 1 || txs > 1000) {
        return LANG.t('flash_tx_hint');
      }
    }
    return null;
  },

  _setStatus(msg, type) {
    const el = document.getElementById('ftStatusMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mi-status mi-status-' + (type || 'info');
    el.style.display = msg ? 'block' : 'none';
  },

  _setValidation(msg) {
    const el = document.getElementById('ftValidationMsg');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'flex' : 'none';
  },

  async create() {
    if (!CONFIG.FLASH_TOKEN_ADDRESS) {
      this._setStatus(LANG.t('contract_not_configured'), 'warn');
      return;
    }
    if (typeof STATE === 'undefined' || !STATE.walletConnected) {
      this._setStatus(LANG.t('my_tokens_connect'), 'warn');
      return;
    }
    if (typeof RISK !== 'undefined' && !RISK.isAccepted()) {
      RISK.show(() => this.create());
      return;
    }

    const errMsg = this._validate();
    if (errMsg) { this._setValidation(errMsg); return; }
    this._setValidation('');

    const name   = document.getElementById('ftName').value.trim();
    const symbol = document.getElementById('ftSymbol').value.toUpperCase();
    const supply = document.getElementById('ftSupply').value;
    const isTime = this._mode === 'time';
    const limit  = isTime
      ? Number(document.getElementById('ftDays').value)
      : Number(document.getElementById('ftTxs').value);

    const btn = document.getElementById('ftCreateBtn');
    if (btn) btn.disabled = true;
    this._setStatus(LANG.t('waiting_confirmation') || 'Waiting for wallet confirmation…', 'info');

    try {
      const contract = await CHAIN.getFlashTokenWriteContract();
      const fee = ethers.parseEther('0.2');
      const tx  = await contract.createFlashToken(
        name, symbol, supply, isTime, limit, { value: fee }
      );
      this._setStatus('Transaction submitted. Waiting for confirmation…', 'info');
      await tx.wait();
      this._setStatus(`Flash token ${symbol} created successfully!`, 'ok');
      // Clear form
      ['ftName', 'ftSymbol', 'ftSupply', 'ftDays', 'ftTxs'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      await this.loadMyTokens();
    } catch (err) {
      const msg = err?.reason || err?.message || 'Unknown error';
      if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED')) {
        this._setStatus(LANG.t('tx_rejected') || 'Rejected by user.', 'warn');
      } else if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) {
        this._setStatus('Insufficient BNB. You need at least 0.2 BNB to cover the fee and gas.', 'err');
      } else {
        this._setStatus(`Transaction failed: ${msg}`, 'err');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async loadMyTokens() {
    const listEl = document.getElementById('ftList');
    if (!listEl) return;

    if (!STATE.walletConnected || !STATE.walletAddr) {
      listEl.innerHTML = `<div class="tx-empty" data-i18n="flash_my_empty">${LANG.t('flash_my_empty')}</div>`;
      return;
    }
    if (!CONFIG.FLASH_TOKEN_ADDRESS) {
      listEl.innerHTML = `<div class="tx-empty">${LANG.t('contract_not_configured')}</div>`;
      return;
    }

    listEl.innerHTML = '<div class="tx-empty">Loading…</div>';
    try {
      const contract = CHAIN.getFlashTokenReadContract();
      const tokens   = await contract.getFlashTokensByCreator(STATE.walletAddr);
      if (!tokens || tokens.length === 0) {
        listEl.innerHTML = `<div class="tx-empty" data-i18n="flash_my_none">${LANG.t('flash_my_none')}</div>`;
        return;
      }
      const items = await Promise.all(tokens.map(addr => this._fetchTokenInfo(contract, addr)));
      listEl.innerHTML = items.map(info => this._renderTokenRow(info)).join('');
    } catch (_) {
      listEl.innerHTML = `<div class="tx-empty">${LANG.t('contract_not_configured')}</div>`;
    }
  },

  async _fetchTokenInfo(contract, addr) {
    try {
      const info = await contract.getFlashTokenInfo(addr);
      return { addr, ...info };
    } catch (_) {
      return { addr, name: addr, symbol: '?', expired: false };
    }
  },

  _renderTokenRow(info) {
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const statusClass = info.expired ? 'mi-badge-err' : 'mi-badge-ok';
    const statusLabel = info.expired ? (LANG.t('flash_status_expired') || 'Expired') : (LANG.t('flash_status_active') || 'Active');
    const remaining   = info.expired ? '' : this._formatRemaining(info);
    return `
      <div class="mi-token-row">
        <div class="mi-token-info">
          <span class="mi-token-name">${esc(info.name || '')} <span class="mi-token-sym">${esc(info.symbol || '')}</span></span>
          <span class="mi-token-addr">${esc(info.addr)}</span>
        </div>
        <div class="mi-token-status">
          <span class="mi-badge ${statusClass}">${statusLabel}</span>
          ${remaining ? `<span class="mi-token-rem">${esc(remaining)}</span>` : ''}
        </div>
      </div>`;
  },

  _formatRemaining(info) {
    if (info.isTimeLimited) {
      const secs = Number(info.expiresAt || 0) - Math.floor(Date.now() / 1000);
      if (secs <= 0) return '';
      const days = Math.floor(secs / 86400);
      return days > 0 ? `${days}d remaining` : `<1d remaining`;
    }
    const rem = Number(info.txLimit || 0) - Number(info.txCount || 0);
    return rem > 0 ? `${rem} transfers left` : '';
  },

  init() {
    this.render();
    if (!CONFIG.FLASH_TOKEN_ADDRESS) {
      const notif = document.getElementById('flashTokenNotConfigured');
      if (notif) notif.style.display = 'flex';
    }
  },
};
