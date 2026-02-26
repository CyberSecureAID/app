'use strict';
const ADMIN = {
  _depositNotifTimeout: null,

  open() {
    // Paso 1: Verificar wallet conectada
    if (!STATE.walletConnected) {
      const overlay = document.getElementById('accessDeniedOverlay');
      document.getElementById('accessDeniedTitle').textContent = STATE.lang === 'es' ? 'Wallet Requerida' : 'Wallet Required';
      document.getElementById('accessDeniedMsg').textContent = STATE.lang === 'es'
        ? 'Debes conectar tu wallet antes de acceder al panel administrativo.'
        : 'You must connect your wallet before accessing the admin panel.';
      overlay.classList.add('open');
      return;
    }
    // Paso 2: Verificar permisos admin
    if (!WALLET.isAdmin()) {
      const overlay = document.getElementById('accessDeniedOverlay');
      document.getElementById('accessDeniedTitle').textContent = STATE.lang === 'es' ? 'Acceso Denegado' : 'Access Denied';
      document.getElementById('accessDeniedMsg').textContent = STATE.lang === 'es'
        ? `La wallet ${UI.abbr(STATE.walletAddress)} no está autorizada.`
        : `Wallet ${UI.abbr(STATE.walletAddress)} is not authorized to access the admin panel.`;
      overlay.classList.add('open');
      return;
    }
    // Paso 3: Abrir panel
    document.getElementById('admPanel').classList.add('open');
    document.getElementById('admOverlay').classList.add('open');
    const ownBanner = document.getElementById('ownBanner'); if (ownBanner) ownBanner.classList.add('show');
    const ownAddr = document.getElementById('ownAddr'); if (ownAddr) ownAddr.textContent = UI.abbr(STATE.walletAddress);

    // Actualizar stats (usa public RPC si wallet no disponible)
    STATS.load().catch(() => {});
    if (window.ethereum) this._loadAdminTokenBalance().catch(() => {});
    this.updateStats();
    this.updatePriceCalc();
  },

  close() {
    document.getElementById('admPanel').classList.remove('open');
    document.getElementById('admOverlay').classList.remove('open');
  },

  /*
   * _loadAdminTokenBalance(): Lee el balance del token ERC20 del admin.
   * Necesario para mostrar cuántos tokens puede depositar.
   */
  async _loadAdminTokenBalance() {
    if (!STATE.walletAddress || !window.ethereum) return;
    try {
      const tc = CHAIN.getTokenReadContract();
      const bal = await tc.balanceOf(STATE.walletAddress);
      STATE.adminTokenBalance = Number(ethers.formatUnits(bal, 18));
      STATE.adminTokenBalanceLoaded = true;
      const el = document.getElementById('adminTokenBal');
      if (el) el.textContent = STATE.adminTokenBalance.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + STATE.tokenSymbol;
    } catch (e) {
      console.warn('[ADMIN._loadAdminTokenBalance]', e?.message);
      const el = document.getElementById('adminTokenBal');
      if (el) el.textContent = '—';
    }
  },

  setDepositMax() {
    if (STATE.adminTokenBalance > 0) {
      const inp = document.getElementById('depositAmt');
      if (inp) { inp.value = STATE.adminTokenBalance.toFixed(6); this.validateDepositAmt(); }
    }
  },

  validateDepositAmt() {
    const a = GUARDS.safePositive(document.getElementById('depositAmt')?.value);
    const btn = document.getElementById('depositBtn');
    if (!btn) return;
    // Solo bloquear por balance si el balance ya fue cargado desde chain
    if (a <= 0) {
      btn.disabled = true;
    } else if (STATE.adminTokenBalanceLoaded && STATE.adminTokenBalance <= 0) {
      btn.disabled = true;
      clearTimeout(this._depositNotifTimeout);
      this._depositNotifTimeout = setTimeout(() => UI.notif('err', 'No balance', `You have no ${STATE.tokenSymbol} to deposit`), 300);
    } else if (STATE.adminTokenBalanceLoaded && a > STATE.adminTokenBalance) {
      btn.disabled = true;
      clearTimeout(this._depositNotifTimeout);
      this._depositNotifTimeout = setTimeout(() => UI.notif('err', 'Exceeds balance', `You only have ${STATE.adminTokenBalance.toFixed(2)} ${STATE.tokenSymbol}`), 300);
    } else {
      btn.disabled = false;
    }
  },

  /*
   * deposit(): Deposita tokens al pool del contrato.
   * Flujo: approve(contractAddress, amount) → depositTokens(amount)
   * Por qué dos pasos: ERC20 requiere que el dueño "apruebe"
   *   al contrato para gastar en su nombre antes de transferir.
   * Invariante: El contrato verifica allowance antes de transferir.
   */
  async deposit() {
    if (!WALLET.isAdmin()) { UI.notif('err', 'Access Denied', 'Admin only'); return; }
    const amt = GUARDS.safePositive(document.getElementById('depositAmt')?.value);
    if (!amt) { UI.notif('err', 'Invalid Amount', 'Enter a valid amount to deposit'); return; }

    const amtWei = ethers.parseUnits(amt.toFixed(6), 18);
    try {
      const tc = await CHAIN.getTokenWriteContract();
      UI.notif('info', 'Step 1/2', 'Approving token transfer — confirm in wallet');
      const approveTx = await tc.approve(STATE.contractAddress, amtWei);
      await approveTx.wait();

      const cw = await CHAIN.getWriteContract();
      UI.notif('info', 'Step 2/2', 'Depositing tokens — confirm in wallet');
      const depositTx = await cw.depositTokens(amtWei);
      await depositTx.wait();

      UI.notif('ok', 'Deposit Successful', `${amt.toFixed(2)} ${STATE.tokenSymbol} added to pool`);
      await STATS.load();
      await this._loadAdminTokenBalance();
    } catch (e) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') UI.notif('err', 'Rejected', 'Transaction rejected by user');
      else UI.notif('err', 'Deposit Failed', e?.reason || e?.shortMessage || e?.message || '');
    }
  },

  /*
   * withdraw(): Retira todos los tokens del pool a la wallet del admin.
   * Solo el owner puede hacer esto (onlyOwner en el contrato).
   */
  async withdraw() {
    if (!WALLET.isAdmin()) { UI.notif('err', 'Access Denied', 'Admin only'); return; }
    if (STATE.poolBalance <= 0) { UI.notif('err', 'Empty Pool', 'No tokens to withdraw'); return; }
    try {
      const cw = await CHAIN.getWriteContract();
      UI.notif('info', 'Withdrawing…', 'Confirm in your wallet');
      const tx = await cw.withdrawAllTokens();
      await tx.wait();
      UI.notif('ok', 'Withdrawn', `All ${STATE.tokenSymbol} returned to your wallet`);
      await STATS.load();
      await this._loadAdminTokenBalance();
    } catch (e) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') UI.notif('err', 'Rejected', 'Transaction rejected by user');
      else UI.notif('err', 'Withdraw Failed', e?.reason || e?.shortMessage || e?.message || '');
    }
  },

  // ── Calculadora de precio ──

  setPcMode(mode) {
    STATE.pcMode = mode;
    document.getElementById('pcPanelDirect').classList.toggle('on', mode === 'direct');
    document.getElementById('pcPanelRatio').classList.toggle('on', mode === 'ratio');
    document.getElementById('pcTabDirect').classList.toggle('on', mode === 'direct');
    document.getElementById('pcTabRatio').classList.toggle('on', mode === 'ratio');
    this.updatePriceCalc();
  },

  onDirectPriceInput() { this.updatePriceCalc(); },
  onRatioInput() { this.updatePriceCalc(); },

  /*
   * updatePriceCalc(): Actualiza los displays de la calculadora de precio.
   * Modo direct: precio por token en USD → calcula tasa
   * Modo ratio: BNB/tokens → calcula precio y tasa
   */
  updatePriceCalc() {
    const bnbRef = STATE.bnbPriceUSD;

    if (STATE.pcMode === 'direct') {
      const el = document.getElementById('dirBnbRef'); if (el) el.textContent = bnbRef ? bnbRef.toFixed(2) : '—';
      const usdtzPriceInput = GUARDS.safePositive(document.getElementById('directPrice')?.value);
      const dp = document.getElementById('dirUsdtzPrice');
      const dr = document.getElementById('dirRate');
      if (usdtzPriceInput > 0) {
        if (dp) dp.textContent = usdtzPriceInput.toFixed(8);
        if (bnbRef > 0) {
          const rate = bnbRef / usdtzPriceInput;
          if (dr) dr.textContent = UI.fmtRate(rate);
        } else {
          if (dr) dr.textContent = '—';
        }
      } else {
        if (dp) dp.textContent = '—';
        if (dr) dr.textContent = '—';
      }
    } else {
      const el = document.getElementById('ratBnbRef'); if (el) el.textContent = bnbRef ? bnbRef.toFixed(2) : '—';
      const bnbAmt = GUARDS.safePositive(document.getElementById('ratioBnb')?.value);
      const tokAmt = GUARDS.safePositive(document.getElementById('ratioUsdt')?.value);
      const ru = document.getElementById('ratUsdtzCalc');
      const rr = document.getElementById('ratRate');
      if (bnbAmt > 0 && tokAmt > 0) {
        const rate = tokAmt / bnbAmt;
        if (rr) rr.textContent = UI.fmtRate(rate);
        if (bnbRef > 0 && ru) ru.textContent = (bnbRef / rate).toFixed(8);
      } else {
        if (ru) ru.textContent = '—';
        if (rr) rr.textContent = '—';
      }
    }
  },

  /*
   * applyPrice(): Calcula el nuevo precio y lo envía al contrato.
   * El precio se convierte a Wei (18 decimales) antes de enviar.
   * Onchain: setUSDTzPrice(newPriceWei) actualiza el precio de referencia.
   */
  async applyPrice() {
    if (!WALLET.isAdmin()) { UI.notif('err', 'Access Denied', 'Admin only'); return; }
    let newPrice = 0;

    if (STATE.pcMode === 'direct') {
      newPrice = GUARDS.safePositive(document.getElementById('directPrice')?.value);
    } else {
      const bnbAmt = GUARDS.safePositive(document.getElementById('ratioBnb')?.value);
      const tokAmt = GUARDS.safePositive(document.getElementById('ratioUsdt')?.value);
      if (bnbAmt > 0 && tokAmt > 0 && STATE.bnbPriceUSD > 0) {
        const rate = tokAmt / bnbAmt;
        newPrice = STATE.bnbPriceUSD / rate;
      }
    }

    const L = CONFIG.LIMITS;
    if (!newPrice || newPrice < L.TOKEN_PRICE_MIN || newPrice > L.TOKEN_PRICE_MAX) {
      UI.notif('err', 'Invalid Price', `Token price must be between ${L.TOKEN_PRICE_MIN} and ${L.TOKEN_PRICE_MAX} USD`);
      return;
    }

    try {
      const priceWei = ethers.parseUnits(newPrice.toFixed(8), 18);
      const cw = await CHAIN.getWriteContract();
      UI.notif('info', 'Applying price…', 'Confirm in your wallet');
      const tx = await cw.setUSDTzPrice(priceWei);
      await tx.wait();
      STATE.usdtzPriceUSD = newPrice;
      PRICE.recalcRate();
      SWAP.updateBtn();
      UI.notif('ok', 'Price Updated', `1 ${STATE.tokenSymbol} = $${newPrice.toFixed(8)}`);
    } catch (e) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') UI.notif('err', 'Rejected', 'Transaction rejected by user');
      else UI.notif('err', 'Price update failed', e?.reason || e?.shortMessage || e?.message || '');
    }
  },

  /*
   * validateCtInput(): Valida en tiempo real la dirección del contrato ingresada.
   */
  validateCtInput(el) {
    const val = el.value.trim();
    const msgEl = document.getElementById('contractValidMsg');
    if (!msgEl) return;
    if (!val) { msgEl.textContent = ''; return; }
    if (GUARDS.isValidAddr(val)) {
      msgEl.innerHTML = '<span style="color:var(--ok);font-size:.70rem">✓ Valid BSC address</span>';
    } else {
      msgEl.innerHTML = '<span style="color:var(--er);font-size:.70rem">✗ Invalid address format</span>';
    }
  },

  liveBrand() {
    const name = document.getElementById('brandName')?.value || 'MiSwap';
    const ln = document.getElementById('logoName'); if (ln) ln.textContent = name;
    const fn = document.getElementById('footPlatformName'); if (fn) fn.textContent = name;
  },

  /*
   * applyBranding(): Aplica cambios de nombre, símbolo y contrato.
   * IMPORTANTE: Cambiar la dirección del contrato resetea todas las
   *   instancias del contrato (CHAIN.reset()) para forzar reconexión
   *   con la nueva dirección.
   */
  applyBranding() {
    const contractInput = document.getElementById('brandContract')?.value.trim();
    const nameInput = document.getElementById('brandName')?.value.trim() || 'MiSwap';
    const tokenInput = document.getElementById('brandToken')?.value.trim() || 'USDT.z';

    // Validar nueva dirección de contrato si se cambió
    if (contractInput && contractInput !== STATE.contractAddress) {
      if (!GUARDS.isValidAddr(contractInput)) {
        UI.notif('err', 'Invalid Contract', 'Address must be 0x + 40 hex chars');
        return;
      }
      STATE.contractAddress = contractInput;
      CHAIN.reset(); // Forzar recreación de instancias con la nueva dirección
      CHAIN.invalidatePublicProvider(); // También el provider público tiene instancias cacheadas
    }

    STATE.platformName = nameInput;
    STATE.tokenSymbol = tokenInput;

    // Actualizar UI
    const ln = document.getElementById('logoName'); if (ln) ln.textContent = nameInput;
    const fn = document.getElementById('footPlatformName'); if (fn) fn.textContent = nameInput;
    const tb = document.getElementById('tokenSymbolBadge'); if (tb) tb.textContent = tokenInput;
    const secTokSym = document.getElementById('secTokenSym'); if (secTokSym) secTokSym.textContent = tokenInput;
    const du = document.getElementById('depositUnit'); if (du) du.textContent = tokenInput;
    const ru = document.getElementById('ratioUsdtUnit'); if (ru) ru.textContent = tokenInput;
    const dbl = document.getElementById('depositBalLabel'); if (dbl) dbl.textContent = tokenInput;

    UI.notif('ok', 'Branding Applied', `Platform: ${nameInput} | Token: ${tokenInput}`);

    // Actualizar displays que dependen del tokenSymbol
    PRICE.recalcRate();    // Actualiza rateDisp y detRate con el nuevo símbolo
    SWAP.updateBtn();      // Actualiza texto del botón swap
    UI.renderLiqBar();     // Actualiza poolDisp con el nuevo símbolo
    UI.renderTxHist();     // Actualiza historial con el nuevo símbolo

    // Recargar stats con la nueva dirección si cambió
    STATS.load().catch(() => {});
  },

  /*
   * updateStats(): Actualiza los valores de estadísticas en el panel admin.
   */
  updateStats() {
    const se = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    se('aPoolBal', STATE.poolBalance.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + STATE.tokenSymbol);
    se('aBnbColl', STATE.bnbCollected.toFixed(4) + ' BNB');
    se('aTxCount', STATE.txCount.toString());
    se('aTokSold', STATE.tokensSold.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + STATE.tokenSymbol);
    se('aContractAddr', STATE.contractAddress);
    se('wdAmtDisp', STATE.poolBalance.toFixed(2) + ' ' + STATE.tokenSymbol + ' available');
    se('adminBnbPrice', STATE.bnbPriceUSD ? STATE.bnbPriceUSD.toFixed(2) : '—');
  },

  // ── Info modales ──

  _infoContent: {
    price: {
      en: { title: '💱 Price Configuration', body: `<ul><li><strong>Direct mode:</strong> Set the price of 1 {sym} in USD. The rate auto-adjusts as BNB price changes.</li><li><strong>Ratio mode:</strong> Specify how many BNB go in and how many {sym} come out. Implied price is calculated.</li><li>Formula: <code>Rate = BNB Price ÷ Token Price</code></li><li>The contract stores the token price in Wei (18 decimals).</li></ul>` },
      es: { title: '💱 Configuración de Precio', body: `<ul><li><strong>Modo directo:</strong> Define el precio de 1 {sym} en USD. La tasa se ajusta automáticamente al cambiar el precio del BNB.</li><li><strong>Modo ratio:</strong> Especifica cuántos BNB entran y cuántos {sym} salen. El precio implícito se calcula.</li><li>Fórmula: <code>Tasa = Precio BNB ÷ Precio Token</code></li></ul>` },
    },
    pool: {
      en: { title: '💧 Pool Management', body: `<ul><li><strong>Deposit:</strong> Calls <code>approve()</code> then <code>depositTokens()</code>. Two wallet confirmations required.</li><li><strong>Withdraw:</strong> Returns all unsold tokens from the pool to your wallet. Only the owner can do this. The contract enforces <code>onlyOwner</code>.</li><li>The pool balance is the maximum amount available for swaps.</li></ul>` },
      es: { title: '💧 Gestión del Pool', body: `<ul><li><strong>Depositar:</strong> Llama <code>approve()</code> y luego <code>depositTokens()</code>. Requiere dos confirmaciones de wallet.</li><li><strong>Retirar:</strong> Devuelve todos los tokens no vendidos a tu wallet. Solo el owner puede hacerlo.</li><li>El balance del pool es el máximo disponible para swaps.</li></ul>` },
    },
    branding: {
      en: { title: '⚙ Contract & Branding', body: `<ul><li><strong>Contract address:</strong> Changing this reinitializes all contract connections. Ensure the new address is correct before applying.</li><li><strong>Platform name:</strong> Visual only — updates the logo and footer.</li><li><strong>Token symbol:</strong> Visual only — updates all token displays.</li></ul>` },
      es: { title: '⚙ Contrato y Marca', body: `<ul><li><strong>Dirección del contrato:</strong> Cambiarla reinicializa todas las conexiones. Verifica que la nueva dirección sea correcta.</li><li><strong>Nombre de la plataforma:</strong> Solo visual — actualiza el logo y el footer.</li><li><strong>Símbolo del token:</strong> Solo visual — actualiza todos los displays del token.</li></ul>` },
    },
  },

  showInfo(key) {
    const lang = STATE.lang in this._infoContent[key] ? STATE.lang : 'en';
    const c = this._infoContent[key][lang];
    if (!c) return;
    const title = document.getElementById('infoModalTitle');
    const body = document.getElementById('infoModalBody');
    if (title) title.textContent = c.title;
    if (body) body.innerHTML = c.body.replace(/\{sym\}/g, GUARDS.esc(STATE.tokenSymbol));
    document.getElementById('infoModalOverlay').classList.add('open');
  },

  closeInfoModal(e) {
    if (!e || e.target === e.currentTarget) {
      document.getElementById('infoModalOverlay').classList.remove('open');
    }
  },

  setupAdminTrigger() {
    const footer = document.querySelector('footer');
    const trigger = document.querySelector('.adm-trigger');
    if (!footer || !trigger) return;
    let _timeout = null;
    footer.addEventListener('touchstart', () => {
      trigger.style.opacity = '1';
      trigger.style.pointerEvents = 'auto';
      trigger.style.color = 'var(--t3)';
      trigger.style.borderColor = 'var(--glass-brd)';
      clearTimeout(_timeout);
      _timeout = setTimeout(() => {
        trigger.style.opacity = '';
        trigger.style.pointerEvents = '';
        trigger.style.color = '';
        trigger.style.borderColor = '';
      }, 3000);
    }, { passive: true });
    trigger.addEventListener('touchend', (e) => {
      e.preventDefault();
      ADMIN.open();
    }, { passive: false });
  },
};


/* ══════════════════════════════════════════════════════════════
   MÓDULO: UI
   Propósito: Helpers de interfaz de usuario — notificaciones,
     formateo de números, renderizado de historial y barra
     de liquidez.
   Invariante: Las funciones de UI solo LEEN STATE — nunca
     lo modifican. Renderizado es una función pura de STATE.
   Seguridad [T7]: Toda inserción en innerHTML usa GUARDS.esc().
   Dependencias: STATE, GUARDS.
══════════════════════════════════════════════════════════════ */
