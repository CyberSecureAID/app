'use strict';

const POOL_CREATOR = {

  render() {
    const sec = document.getElementById('section-create-pool');
    if (!sec) return;
    sec.innerHTML = `
      <div class="mi-section-card">
        <div class="mi-section-header">
          <span class="mi-section-icon">💧</span>
          <div style="flex:1">
            <div class="mi-section-title" data-i18n="create_pool_title">Crear Pool de Liquidez</div>
            <div class="mi-section-sub" data-i18n="create_pool_sub">Agrega liquidez en PancakeSwap para tu token</div>
          </div>
          <button class="info-btn" data-info="create-pool">ℹ Info</button>
        </div>
        <div id="poolCreatorNotConfigured" class="mi-notice mi-notice-warn" style="display:none">
          ⚠️ <span data-i18n="contract_not_configured">El contrato aún no ha sido deployado. Funcionalidad disponible próximamente.</span>
        </div>
        <div id="poolCreatorForm">
          <div class="mi-fee-banner">
            <span>💰</span>
            <span data-i18n="pool_fee_label">Fee de creación de pool:</span>
            <strong>${CONFIG.POOL_CREATION_FEE_BNB} BNB</strong>
            <span class="mi-fee-note" data-i18n="plus_gas">+ gas estimado</span>
          </div>
          <div class="mi-notice mi-notice-info">
            ℹ️ <span data-i18n="pool_pancake_note">Los LP tokens irán directamente a tu wallet. Pool creado en PancakeSwap v2.</span>
          </div>
          <div class="mi-field">
            <label class="mi-label" data-i18n="pool_token_addr">Dirección del Token</label>
            <input type="text" id="pcTokenAddr" class="mi-input" placeholder="0x..." maxlength="42">
            <div id="pcTokenInfo" class="mi-token-info" style="display:none"></div>
          </div>
          <div class="mi-field">
            <label class="mi-label" data-i18n="pool_token_amount">Cantidad de Tokens</label>
            <input type="number" id="pcTokenAmt" class="mi-input" placeholder="Ej: 1000000" min="0" step="any">
            <div id="pcTokenBal" class="mi-hint"></div>
          </div>
          <div class="mi-field">
            <label class="mi-label" data-i18n="pool_bnb_amount">Cantidad de BNB</label>
            <input type="number" id="pcBnbAmt" class="mi-input" placeholder="Ej: 1" min="0" step="any">
            <div id="pcBnbBal" class="mi-hint"></div>
          </div>
          <div id="pcValidationMsg" class="mi-notice mi-notice-err" style="display:none"></div>
          <button id="pcCreateBtn" class="btn btn-iris btn-full btn-lg mt10" data-i18n="create_pool_btn">
            💧 Crear Pool
          </button>
          <div id="pcStatusMsg" class="mi-status" style="display:none"></div>
        </div>
      </div>`;
    this._bindEvents();
    LANG.apply();
  },

  _bindEvents() {
    const addrInp = document.getElementById('pcTokenAddr');
    if (addrInp) addrInp.addEventListener('input', () => this._onTokenAddrChange());
    const btn = document.getElementById('pcCreateBtn');
    if (btn) btn.addEventListener('click', () => this.create());
  },

  async _onTokenAddrChange() {
    const addr = (document.getElementById('pcTokenAddr') || {}).value || '';
    const infoEl = document.getElementById('pcTokenInfo');
    const balEl  = document.getElementById('pcTokenBal');
    if (!infoEl || !balEl) return;
    if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      infoEl.style.display = 'none';
      balEl.textContent = '';
      return;
    }
    try {
      const token = new ethers.Contract(addr, CONFIG.TOKEN_ABI, CHAIN._getReadProvider());
      const [name, symbol, bal] = await Promise.all([
        token.name ? token.name() : Promise.resolve('—'),
        token.symbol ? token.symbol() : Promise.resolve('?'),
        STATE.walletConnected ? token.balanceOf(STATE.account) : Promise.resolve(0n),
      ]).catch(() => ['—', '?', 0n]);
      infoEl.innerHTML = `<span class="mi-token-name">${name || '—'}</span> <span class="mi-token-sym">${symbol || '?'}</span>`;
      infoEl.style.display = 'flex';
      const balFmt = bal ? Number(ethers.formatUnits(bal, 18)).toLocaleString() : '0';
      balEl.textContent = `Balance: ${balFmt} ${symbol}`;
    } catch (_) {
      infoEl.style.display = 'none';
      balEl.textContent = '';
    }
  },

  _validate() {
    const addr  = (document.getElementById('pcTokenAddr') || {}).value || '';
    const tokAmt = Number((document.getElementById('pcTokenAmt') || {}).value || 0);
    const bnbAmt = Number((document.getElementById('pcBnbAmt')   || {}).value || 0);
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      return 'Dirección de contrato inválida. Verifica la dirección del token.';
    }
    if (!Number.isFinite(tokAmt) || tokAmt <= 0) {
      return 'Ingresa una cantidad válida de tokens.';
    }
    if (!Number.isFinite(bnbAmt) || bnbAmt <= 0) {
      return 'Ingresa una cantidad válida de BNB.';
    }
    return null;
  },

  _setStatus(msg, type) {
    const el = document.getElementById('pcStatusMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mi-status mi-status-' + (type || 'info');
    el.style.display = msg ? 'block' : 'none';
  },

  _setValidation(msg) {
    const el = document.getElementById('pcValidationMsg');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'flex' : 'none';
  },

  async create() {
    if (!STATE.walletConnected) { this._setStatus('Conecta tu wallet para continuar.', 'warn'); return; }
    if (typeof RISK !== 'undefined' && !RISK.isAccepted()) { RISK.show(() => this.create()); return; }
    const errMsg = this._validate();
    if (errMsg) { this._setValidation(errMsg); return; }
    this._setValidation('');

    const tokenAddr = document.getElementById('pcTokenAddr').value.trim();
    const tokenAmt  = document.getElementById('pcTokenAmt').value;
    const bnbAmt    = document.getElementById('pcBnbAmt').value;

    const btn = document.getElementById('pcCreateBtn');
    if (btn) btn.disabled = true;
    this._setStatus('Esperando confirmación en wallet…', 'info');

    try {
      const provider  = CHAIN._getWriteProvider();
      const signer    = await provider.getSigner();

      const tokenAmtWei = ethers.parseUnits(tokenAmt, 18);
      const bnbAmtWei   = ethers.parseEther(bnbAmt);
      const feeWei      = ethers.parseEther(CONFIG.POOL_CREATION_FEE_BNB);
      const totalBnb    = bnbAmtWei + feeWei;

      // Paso 1: Approve tokens al router
      const tokenContract = new ethers.Contract(tokenAddr, CONFIG.TOKEN_ABI, signer);
      this._setStatus('Paso 1/2: Aprobando tokens al Router…', 'info');
      const approveTx = await tokenContract.approve(CONFIG.PANCAKE_ROUTER, tokenAmtWei);
      await approveTx.wait();

      // Paso 2: Enviar fee al admin + addLiquidityETH
      // Primero fee al DEPOSIT_WALLET si está configurado
      if (CONFIG.DEPOSIT_WALLET) {
        const feeTx = await signer.sendTransaction({ to: CONFIG.DEPOSIT_WALLET, value: feeWei });
        await feeTx.wait();
      }

      // addLiquidityETH
      const router = new ethers.Contract(CONFIG.PANCAKE_ROUTER, CONFIG.PANCAKE_ROUTER_ABI, signer);
      const deadline = Math.floor(Date.now() / 1000) + 1200;
      // Use pure BigInt arithmetic with configurable slippage to avoid floating-point precision loss
      const slipPct  = BigInt(Math.round((CONFIG.SLIPPAGE_DEFAULT_PERCENT || 1) * 100));
      const SLIP_NUM = 10000n - slipPct;
      const SLIP_DEN = 10000n;
      this._setStatus('Paso 2/2: Agregando liquidez en PancakeSwap…', 'info');
      const tx = await router.addLiquidityETH(
        tokenAddr,
        tokenAmtWei,
        tokenAmtWei * SLIP_NUM / SLIP_DEN,
        bnbAmtWei   * SLIP_NUM / SLIP_DEN,
        await signer.getAddress(),
        deadline,
        { value: bnbAmtWei }
      );
      await tx.wait();
      this._setStatus('✅ Pool creado exitosamente en PancakeSwap!', 'ok');
    } catch (err) {
      const msg = err?.reason || err?.message || 'Error desconocido';
      if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED')) {
        this._setStatus('Rechazado por el usuario.', 'warn');
      } else if (msg.includes('insufficient funds')) {
        this._setStatus(`BNB insuficiente. Necesitas al menos ${CONFIG.POOL_CREATION_FEE_BNB} BNB de fee + liquidez + gas.`, 'err');
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
