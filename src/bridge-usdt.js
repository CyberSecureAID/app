'use strict';

const BRIDGE_USDT = {
  _tokens: [],
  _selectedToken: null,
  _quoteTimer: null,

  render() {
    const sec = document.getElementById('section-bridge-usdt');
    if (!sec) return;
    sec.innerHTML = `
      <div class="mi-section-card">
        <div class="mi-section-header">
          <span class="mi-section-icon">🌉</span>
          <div>
            <div class="mi-section-title" data-i18n="bridge_title">Bridge a USDT</div>
            <div class="mi-section-sub" data-i18n="bridge_sub">Convierte tus tokens a USDT vía PancakeSwap</div>
          </div>
        </div>
        <div class="mi-fee-banner">
          <span>💰</span>
          <span data-i18n="bridge_fee_label">Fee del bridge:</span>
          <strong>${CONFIG.BRIDGE_FEE_PERCENT}%</strong>
          <span class="mi-fee-note" data-i18n="bridge_fee_note">aplicado al monto enviado</span>
        </div>
        <div class="mi-field">
          <label class="mi-label" data-i18n="bridge_select_token">Seleccionar Token</label>
          <select id="bridgeTokenSelect" class="mi-select">
            <option value="">— Elige un token —</option>
          </select>
          <div id="bridgeTokenBal" class="mi-hint"></div>
        </div>
        <div class="mi-field">
          <label class="mi-label" data-i18n="bridge_amount">Cantidad a bridgear</label>
          <div class="bridge-pct-wrap">
            <input type="range" id="bridgePctSlider" class="bridge-slider" min="0" max="100" value="0" step="1">
            <div class="bridge-pct-row">
              <span id="bridgePctLabel" class="bridge-pct-label">0%</span>
              <input type="number" id="bridgeAmt" class="mi-input bridge-amt-inp" placeholder="0.0" min="0" step="any">
            </div>
          </div>
        </div>
        <div class="mi-field">
          <label class="mi-label" data-i18n="slippage_tolerance">Tolerancia de Slippage</label>
          <div class="bridge-slip-row">
            ${[0.5,1,2,3,5].map(v=>`<button class="bridge-slip-btn${v===CONFIG.SLIPPAGE_DEFAULT_PERCENT?' active':''}" data-slip="${v}">${v}%</button>`).join('')}
          </div>
        </div>
        <div id="bridgeQuoteBox" class="bridge-quote-box" style="display:none">
          <div class="bridge-quote-row">
            <span data-i18n="bridge_you_receive">Recibirás (est.):</span>
            <span id="bridgeQuoteUsdt" class="bridge-quote-val">—</span>
          </div>
          <div class="bridge-quote-row">
            <span data-i18n="bridge_fee_amount">Fee (${CONFIG.BRIDGE_FEE_PERCENT}%):</span>
            <span id="bridgeQuoteFee" class="bridge-quote-fee">—</span>
          </div>
          <div class="bridge-quote-row">
            <span data-i18n="bridge_route">Ruta:</span>
            <span class="bridge-quote-route">Token → WBNB → USDT</span>
          </div>
        </div>
        <div id="bridgeValidationMsg" class="mi-notice mi-notice-err" style="display:none"></div>
        <button id="bridgeBtn" class="btn btn-iris btn-full btn-lg mt10" disabled data-i18n="bridge_btn">
          🌉 Bridge a USDT
        </button>
        <div id="bridgeStatusMsg" class="mi-status" style="display:none"></div>
      </div>`;
    this._bindEvents();
    LANG.apply();
  },

  _bindEvents() {
    const sel = document.getElementById('bridgeTokenSelect');
    if (sel) sel.addEventListener('change', () => this._onTokenSelect());
    const slider = document.getElementById('bridgePctSlider');
    const amtInp = document.getElementById('bridgeAmt');
    if (slider) slider.addEventListener('input', () => {
      const pct = parseInt(slider.value, 10);
      document.getElementById('bridgePctLabel').textContent = pct + '%';
      const maxBal = this._getMaxBalance();
      if (amtInp && maxBal > 0) {
        amtInp.value = (maxBal * pct / 100).toFixed(6);
        this._scheduleQuote();
      }
    });
    if (amtInp) amtInp.addEventListener('input', () => {
      const maxBal = this._getMaxBalance();
      if (maxBal > 0 && slider) {
        const pct = Math.min(100, Math.round((parseFloat(amtInp.value) || 0) / maxBal * 100));
        slider.value = pct;
        document.getElementById('bridgePctLabel').textContent = pct + '%';
      }
      this._scheduleQuote();
    });
    document.querySelectorAll('.bridge-slip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bridge-slip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._scheduleQuote();
      });
    });
    const bridgeBtn = document.getElementById('bridgeBtn');
    if (bridgeBtn) bridgeBtn.addEventListener('click', () => this.execute());
  },

  _getSlippage() {
    const active = document.querySelector('.bridge-slip-btn.active');
    return active ? parseFloat(active.dataset.slip) : CONFIG.SLIPPAGE_DEFAULT_PERCENT;
  },

  _getMaxBalance() {
    if (!this._selectedToken) return 0;
    return this._selectedToken._balance || 0;
  },

  _onTokenSelect() {
    const sel = document.getElementById('bridgeTokenSelect');
    if (!sel) return;
    const addr = sel.value;
    this._selectedToken = addr ? this._tokens.find(t => t.address === addr) : null;
    const balEl = document.getElementById('bridgeTokenBal');
    if (balEl) {
      balEl.textContent = this._selectedToken
        ? `Balance: ${this._selectedToken._balance.toFixed(6)} ${this._selectedToken.symbol}`
        : '';
    }
    this._scheduleQuote();
  },

  _scheduleQuote() {
    if (this._quoteTimer) clearTimeout(this._quoteTimer);
    this._quoteTimer = setTimeout(() => this._fetchQuote(), 600);
  },

  async _fetchQuote() {
    const amtEl = document.getElementById('bridgeAmt');
    const quoteBox = document.getElementById('bridgeQuoteBox');
    const btn = document.getElementById('bridgeBtn');
    if (!amtEl || !this._selectedToken) {
      if (quoteBox) quoteBox.style.display = 'none';
      return;
    }
    const amt = parseFloat(amtEl.value);
    if (!Number.isFinite(amt) || amt <= 0) {
      if (quoteBox) quoteBox.style.display = 'none';
      return;
    }
    try {
      const router  = new ethers.Contract(CONFIG.PANCAKE_ROUTER, CONFIG.PANCAKE_ROUTER_ABI, CHAIN._getReadProvider());
      const amtWei  = ethers.parseUnits(String(amt), this._selectedToken.decimals || 18);
      const path    = [this._selectedToken.address, CONFIG.WBNB_ADDRESS, CONFIG.USDT_ADDRESS];
      const amounts = await router.getAmountsOut(amtWei, path);
      const rawUsdt = Number(ethers.formatUnits(amounts[amounts.length - 1], 18));
      const fee     = rawUsdt * CONFIG.BRIDGE_FEE_PERCENT / 100;
      const netUsdt = rawUsdt - fee;
      document.getElementById('bridgeQuoteUsdt').textContent = netUsdt.toFixed(4) + ' USDT';
      document.getElementById('bridgeQuoteFee').textContent  = fee.toFixed(4) + ' USDT';
      if (quoteBox) quoteBox.style.display = 'flex';
      if (btn) btn.disabled = false;
    } catch (_) {
      if (quoteBox) quoteBox.style.display = 'none';
      if (btn) btn.disabled = true;
    }
  },

  async loadUserTokens() {
    if (!STATE.walletConnected) return;
    const sel = document.getElementById('bridgeTokenSelect');
    if (!sel) return;
    // Cargar tokens del usuario desde TokenFactory si está configurado
    this._tokens = [];
    if (CONFIG.TOKEN_FACTORY_ADDRESS) {
      try {
        const factory = CHAIN.getTokenFactoryReadContract();
        const addrs   = await factory.getTokensByCreator(STATE.account);
        for (const addr of addrs) {
          try {
            const token  = new ethers.Contract(addr, CONFIG.TOKEN_ABI, CHAIN._getReadProvider());
            const symRes = await Promise.all([
              token.symbol ? token.symbol() : Promise.resolve('?'),
              token.balanceOf(STATE.account),
            ]).catch(() => ['?', 0n]);
            const [sym, balWei] = symRes;
            const bal = Number(ethers.formatUnits(balWei, 18));
            if (bal > 0) {
              this._tokens.push({ address: addr, symbol: sym, decimals: 18, _balance: bal });
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
    sel.innerHTML = '<option value="">— Elige un token —</option>' +
      this._tokens.map(t => `<option value="${t.address}">${t.symbol} (${t._balance.toFixed(4)})</option>`).join('');
  },

  _setStatus(msg, type) {
    const el = document.getElementById('bridgeStatusMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mi-status mi-status-' + (type || 'info');
    el.style.display = msg ? 'block' : 'none';
  },

  _setValidation(msg) {
    const el = document.getElementById('bridgeValidationMsg');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'flex' : 'none';
  },

  async execute() {
    if (!STATE.walletConnected) { this._setStatus('Conecta tu wallet para continuar.', 'warn'); return; }
    if (typeof RISK !== 'undefined' && !RISK.isAccepted()) { RISK.show(() => this.execute()); return; }
    if (!this._selectedToken) { this._setValidation('Selecciona un token.'); return; }

    const amt = parseFloat((document.getElementById('bridgeAmt') || {}).value || 0);
    if (!Number.isFinite(amt) || amt <= 0) { this._setValidation('Ingresa una cantidad válida.'); return; }
    if (amt > this._selectedToken._balance) { this._setValidation('Saldo insuficiente.'); return; }
    this._setValidation('');

    const btn = document.getElementById('bridgeBtn');
    if (btn) btn.disabled = true;
    this._setStatus('Esperando confirmación en wallet…', 'info');

    try {
      const provider = CHAIN._getWriteProvider();
      const signer   = await provider.getSigner();
      const amtWei   = ethers.parseUnits(String(amt), this._selectedToken.decimals || 18);
      const slip     = this._getSlippage();

      // Paso 1: Approve
      const tokenContract = new ethers.Contract(this._selectedToken.address, CONFIG.TOKEN_ABI, signer);
      this._setStatus('Paso 1/2: Aprobando tokens al Router…', 'info');
      const approveTx = await tokenContract.approve(CONFIG.PANCAKE_ROUTER, amtWei);
      await approveTx.wait();

      // Paso 2: Execute bridge (swap to USDT)
      const router   = new ethers.Contract(CONFIG.PANCAKE_ROUTER, CONFIG.PANCAKE_ROUTER_ABI, signer);
      const path     = [this._selectedToken.address, CONFIG.WBNB_ADDRESS, CONFIG.USDT_ADDRESS];
      const amounts  = await router.getAmountsOut(amtWei, path);
      const rawUsdt  = amounts[amounts.length - 1];
      const feeAmt   = rawUsdt * BigInt(CONFIG.BRIDGE_FEE_PERCENT) / 100n;
      // Use pure BigInt arithmetic: slip is in %, e.g. 1% → multiply by (1000 - slip*10)/1000
      const slipBp   = BigInt(Math.round(slip * 10)); // slip=1 → 10, slip=0.5 → 5
      const minOut   = (rawUsdt - feeAmt) * (1000n - slipBp) / 1000n;
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      this._setStatus('Paso 2/2: Ejecutando bridge en PancakeSwap…', 'info');
      const tx = await router.swapExactTokensForTokens(amtWei, minOut, path, await signer.getAddress(), deadline);
      await tx.wait();
      this._setStatus('✅ Bridge completado exitosamente!', 'ok');
      // Recargar balances
      setTimeout(() => { WALLET.refreshBalance(); this.loadUserTokens(); }, 2000);
    } catch (err) {
      const msg = err?.reason || err?.message || 'Error desconocido';
      if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED')) {
        this._setStatus('Rechazado por el usuario.', 'warn');
      } else if (msg.includes('INSUFFICIENT_OUTPUT_AMOUNT') || msg.includes('slippage')) {
        this._setStatus('El precio cambió demasiado. Aumenta el slippage o intenta de nuevo.', 'err');
      } else if (msg.includes('no liquidity') || msg.includes('LIQUIDITY')) {
        this._setStatus('Este token no tiene liquidez en PancakeSwap. Crea un pool primero.', 'err');
      } else {
        this._setStatus(`Transacción fallida. ${msg}. Intenta de nuevo.`, 'err');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  init() {
    this.render();
  },
};
