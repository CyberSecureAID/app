'use strict';
const SWAP = {
  _inProgress: false,
  _lastSwapTime: 0,

  toggleSlip() { document.getElementById('slipPanel').classList.toggle('open'); },
  toggleDetails() {
    STATE.detailsOpen = !STATE.detailsOpen;
    document.getElementById('detailsBody').classList.toggle('open', STATE.detailsOpen);
    document.getElementById('detailsArrow').classList.toggle('open', STATE.detailsOpen);
  },

  /*
   * setSlip(v, btn): Establece el slippage con validación.
   * Clampea al rango permitido antes de guardar.
   */
  setSlip(v, btn) {
    const safe = GUARDS.clamp(v, CONFIG.LIMITS.SLIPPAGE_MIN, CONFIG.LIMITS.SLIPPAGE_MAX);
    STATE.slippage = safe;
    const sd = document.getElementById('slipDisp'); if (sd) sd.textContent = safe + '%';
    const si = document.getElementById('slipInfo'); if (si) si.textContent = safe + '%';
    document.querySelectorAll('.sopt').forEach(b => b.classList.remove('on'));
    if (btn) btn.classList.add('on');
    this.onBnbIn(document.getElementById('bnbAmt')?.value);
  },

  /*
   * setCustomSlip(v): Slippage personalizado desde input de texto.
   * Muestra error visible si el valor está fuera de rango.
   */
  setCustomSlip(v) {
    const f = parseFloat(v);
    if (!Number.isFinite(f) || isNaN(f)) return;
    const L = CONFIG.LIMITS;
    if (f < L.SLIPPAGE_MIN) { UI.notif('err', 'Slippage too low', `Minimum is ${L.SLIPPAGE_MIN}%`); return; }
    if (f > L.SLIPPAGE_MAX) { UI.notif('err', 'Slippage too high', `Maximum is ${L.SLIPPAGE_MAX}%`); return; }
    STATE.slippage = f;
    const sd = document.getElementById('slipDisp'); if (sd) sd.textContent = f + '%';
    const si = document.getElementById('slipInfo'); if (si) si.textContent = f + '%';
    document.querySelectorAll('.sopt').forEach(b => b.classList.remove('on'));
    this.onBnbIn(document.getElementById('bnbAmt')?.value);
  },

  /*
   * setMax(): Establece el monto máximo de BNB que se puede intercambiar.
   * Máximo = balance - GAS_RESERVE (para cubrir el gas de la tx)
   * También limita al MAX_PER_TX del sistema.
   */
  setMax() {
    const inp = document.getElementById('bnbAmt');
    if (STATE.bnbBalance <= 0) return;
    const L = CONFIG.LIMITS;
    const safe = Math.max(0, STATE.bnbBalance - L.GAS_RESERVE_BNB);
    if (safe <= 0) { UI.notif('err', 'Insufficient BNB', `Balance is too low to cover ${L.GAS_RESERVE_BNB} BNB gas reserve`); return; }
    const capped = Math.min(safe, L.BNB_MAX_PER_TX);
    inp.value = capped.toFixed(4);
    this.onBnbIn(inp.value);
  },

  /*
   * onBnbIn(val): Callback cuando el usuario escribe en el campo BNB.
   * Calcula tokens a recibir y actualiza el display.
   * Validaciones:
   *   - Valor numérico positivo
   *   - No excede MAX_PER_TX
   *   - No excede balance de wallet
   *   - Rate disponible
   *   - Pool tiene liquidez suficiente
   * Por qué no bloqueamos aquí: Solo mostramos warnings visuales.
   *   El bloqueo real está en updateBtn() y execute().
   */
  onBnbIn(val) {
    const u = document.getElementById('usdtzAmt');
    const mr = document.getElementById('minReceived');
    const bu = document.getElementById('bnbUsd');
    const uu = document.getElementById('usdtzUsd');

    const v = GUARDS.safePositive(val);

    // Limpiar campos si no hay valor válido
    if (!v) {
      if (u) u.value = '';
      if (mr) mr.textContent = '—';
      if (bu) { bu.textContent = ''; bu.style.color = ''; }
      this.updateBtn();
      return;
    }

    // Validar límites
    if (v > CONFIG.LIMITS.BNB_MAX_PER_TX) {
      UI.notif('err', 'Amount too large', `Maximum ${CONFIG.LIMITS.BNB_MAX_PER_TX} BNB per transaction`);
      document.getElementById('bnbAmt').value = CONFIG.LIMITS.BNB_MAX_PER_TX;
      this.onBnbIn(CONFIG.LIMITS.BNB_MAX_PER_TX);
      return;
    }

    // Rate no disponible
    if (STATE.currentRate <= 0 || !Number.isFinite(STATE.currentRate)) {
      if (u) u.value = '';
      if (mr) mr.textContent = '—';
      this.updateBtn();
      return;
    }

    // Balance check visual (no bloqueo — solo warning)
    if (STATE.bnbBalance > 0 && v > (STATE.bnbBalance - CONFIG.LIMITS.GAS_RESERVE_BNB)) {
      if (u) u.value = '';
      if (mr) mr.textContent = '—';
      if (bu) { bu.textContent = '⚠ Exceeds wallet balance'; bu.style.color = 'var(--er)'; }
      if (uu) uu.textContent = '';
      this.updateBtn();
      return;
    }

    // Calcular tokens a recibir
    const marketOut = v * STATE.currentRate;
    if (!Number.isFinite(marketOut) || marketOut <= 0) {
      if (u) u.value = '';
      this.updateBtn();
      return;
    }

    // Actualizar campos
    if (u) u.value = marketOut.toFixed(6);
    if (bu) { bu.style.color = ''; if (STATE.bnbPriceUSD) bu.textContent = `≈ $${(v * STATE.bnbPriceUSD).toFixed(2)} USD`; }
    if (uu && STATE.bnbPriceUSD) uu.textContent = `≈ $${(marketOut * STATE.usdtzPriceUSD).toFixed(2)} USD`;
    if (mr) {
      const minOut = marketOut * (1 - STATE.slippage / 100);
      mr.textContent = minOut > 0 ? `${minOut.toFixed(4)} ${STATE.tokenSymbol}` : '—';
    }
    this.updateBtn();
  },

  /*
   * updateBtn(): Determina el estado y texto del botón de swap.
   * Orden de validaciones (de más prioritaria a menos):
   *   1. ¿Wallet conectada?
   *   2. ¿Rate disponible?
   *   3. ¿Hay monto válido?
   *   4. ¿El monto supera el balance? [T4 pre-check]
   *   5. ¿El pool tiene liquidez suficiente?
   *   → Si pasa todo: habilitado
   */
  updateBtn() {
    const btn = document.getElementById('swapBtn');
    if (!btn) return;
    const span = btn.firstElementChild || btn;
    const v = GUARDS.safePositive(document.getElementById('bnbAmt')?.value);
    const marketOut = (v && STATE.currentRate > 0) ? v * STATE.currentRate : 0;

    if (!STATE.walletConnected) {
      btn.disabled = true; span.textContent = t('connect_to_swap');
    } else if (STATE.currentRate <= 0) {
      btn.disabled = true; span.textContent = t('fetching') || 'Loading price…';
    } else if (!v || v <= 0) {
      btn.disabled = true; span.textContent = t('enter_amount');
    } else if (STATE.bnbBalance > 0 && v > (STATE.bnbBalance - CONFIG.LIMITS.GAS_RESERVE_BNB)) {
      btn.disabled = true; span.textContent = t('insufficient_bnb') || 'Insufficient BNB balance';
    } else if (marketOut > STATE.poolBalance) {
      btn.disabled = true; span.textContent = t('insufficient_liquidity');
    } else {
      const prefix = STATE.lang === 'es' ? 'Intercambiar BNB →' : 'Swap BNB →';
      btn.disabled = false; span.textContent = `${prefix} ${STATE.tokenSymbol}`;
    }
  },

  /*
   * init(): Abre el modal de confirmación del swap.
   * Pre-validaciones adicionales antes de mostrar el modal.
   * Si algo está mal, bloquea aquí con un mensaje claro.
   */
  init() {
    const v = GUARDS.safePositive(document.getElementById('bnbAmt')?.value);
    if (!v || v <= 0) return;

    // Última validación pre-modal
    if (STATE.bnbBalance > 0 && v > (STATE.bnbBalance - CONFIG.LIMITS.GAS_RESERVE_BNB)) {
      UI.notif('err', 'Insufficient BNB', 'Your wallet does not have enough BNB for this amount');
      return;
    }
    const marketOut = v * STATE.currentRate;
    if (marketOut > STATE.poolBalance) {
      UI.notif('err', 'Insufficient Liquidity', 'Not enough tokens in pool');
      return;
    }

    // Poblar el modal con los datos de la tx
    const sym = STATE.tokenSymbol;
    const cfmBnb = document.getElementById('cfmBnb'); if (cfmBnb) cfmBnb.textContent = `${v.toFixed(4)} BNB`;
    const cfmUsdt = document.getElementById('cfmUsdt'); if (cfmUsdt) cfmUsdt.textContent = `${marketOut.toFixed(4)} ${sym}`;
    const cfmRate = document.getElementById('cfmRate'); if (cfmRate) cfmRate.textContent = `1 BNB = ${UI.fmtRate(STATE.currentRate)} ${sym}`;
    const cfmMkt = document.getElementById('cfmMkt'); if (cfmMkt) cfmMkt.textContent = STATE.bnbPriceUSD ? `$${STATE.bnbPriceUSD.toFixed(2)}` : '—';
    const cfmUsdtz = document.getElementById('cfmUsdtz'); if (cfmUsdtz) cfmUsdtz.textContent = `$${STATE.usdtzPriceUSD.toFixed(8)}`;
    const cfmSym = document.getElementById('cfmTokenSym'); if (cfmSym) cfmSym.textContent = sym;

    document.getElementById('swapOverlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('swapOverlay').classList.remove('open');
    document.getElementById('swapLoading').style.display = 'none';
    const cfmBtn = document.getElementById('cfmBtn'); if (cfmBtn) cfmBtn.disabled = false;
    // Recalcular display con market rate
    const bnbVal = GUARDS.safePositive(document.getElementById('bnbAmt')?.value);
    if (bnbVal && STATE.currentRate > 0) {
      const ua = document.getElementById('usdtzAmt');
      if (ua) ua.value = (bnbVal * STATE.currentRate).toFixed(6);
    }
    this.updateBtn();
  },

  /*
   * execute(): Ejecuta el swap en la blockchain.
   *
   * Flujo defensivo (Checks-Effects-Interactions):
   *   CHECKS:
   *     1. Mutex: no hay swap en progreso [T9]
   *     2. Cooldown: mínimo 3s entre swaps [T9]
   *     3. Re-leer bnbVal del DOM (no confiar en STATE)
   *     4. Validar bnbVal: finito, positivo, ≤ MAX_PER_TX
   *     5. Validar balance en wallet [T4]
   *     6. Validar STATE.bnbPriceUSD en rango [T3]
   *     7. Validar STATE.currentRate > 0
   *     8. Calcular marketOut y validar pool
   *     9. Validar onchain isBnbPriceValid() [T3]
   *   EFFECTS:
   *     10. Activar mutex _inProgress
   *     11. Deshabilitar botón de confirmar
   *   INTERACTIONS:
   *     12. Enviar tx swap() con value=bnbWei y minUsdtzOut [T2]
   *     13. Esperar receipt
   *   POST:
   *     14. finishSwap() actualiza STATE y UI
   *     15. Liberar mutex (en finally)
   *
   * Por qué re-leemos del DOM y no del STATE:
   *   El usuario podría haber modificado STATE externamente.
   *   El DOM es más difícil de falsificar que variables JS.
   *   De todos modos, el contrato valida msg.value real.
   */
  async execute() {
    // [T9] Mutex
    if (this._inProgress) { UI.notif('err', 'In Progress', 'A swap is already in progress'); return; }
    const now = Date.now();
    if (now - this._lastSwapTime < 3000) { UI.notif('err', 'Too Fast', 'Wait a moment before swapping again'); return; }

    // Re-leer del DOM — fuente más confiable que STATE para el monto
    const bnbInput = document.getElementById('bnbAmt');
    const bnbVal = GUARDS.safePositive(bnbInput?.value);
    const L = CONFIG.LIMITS;

    // Validaciones ANTES de activar mutex (si fallan, no hay que liberar nada)
    if (!bnbVal) { UI.notif('err', 'Invalid Amount', 'Enter a valid BNB amount'); return; }
    if (bnbVal > L.BNB_MAX_PER_TX) {
      UI.notif('err', 'Amount too large', `Maximum ${L.BNB_MAX_PER_TX} BNB per transaction`);
      return;
    }
    if (STATE.walletConnected && STATE.bnbBalance > 0 && bnbVal > (STATE.bnbBalance - L.GAS_RESERVE_BNB)) {
      UI.notif('err', 'Insufficient BNB', `Max available: ${(STATE.bnbBalance - L.GAS_RESERVE_BNB).toFixed(4)} BNB`);
      return;
    }
    if (!Number.isFinite(STATE.bnbPriceUSD) || STATE.bnbPriceUSD < L.BNB_PRICE_MIN || STATE.bnbPriceUSD > L.BNB_PRICE_MAX) {
      UI.notif('err', 'Price unavailable', 'BNB price not in valid range. Refreshing…');
      await PRICE.refresh();
      return;
    }
    if (!Number.isFinite(STATE.currentRate) || STATE.currentRate <= 0) {
      UI.notif('err', 'Rate unavailable', 'Swap rate not ready');
      return;
    }
    const marketOut = bnbVal * STATE.currentRate;
    if (!Number.isFinite(marketOut) || marketOut <= 0) { return; }
    if (marketOut > STATE.poolBalance) {
      UI.notif('err', 'Insufficient Liquidity', 'Pool balance changed. Refreshing…');
      await STATS.load().catch(() => {});
      SWAP.updateBtn();
      return;
    }

    // Activar mutex SOLO cuando todas las validaciones previas pasaron
    this._inProgress = true;

    try {
      // UI: mostrar estado de espera
      const cfmBtn = document.getElementById('cfmBtn');
      if (cfmBtn) cfmBtn.disabled = true;
      const swapLoading = document.getElementById('swapLoading');
      if (swapLoading) swapLoading.style.display = 'block';

      if (!window.ethereum || !STATE.walletAddress) throw new Error('No wallet connected');

      // Preparar parámetros de la tx
      const safeBnbPrice = GUARDS.clamp(STATE.bnbPriceUSD, L.BNB_PRICE_MIN, L.BNB_PRICE_MAX);
      const bnbPriceWei = ethers.parseUnits(safeBnbPrice.toFixed(8), 18);

      // [T2] minUsdtzOut = tokens esperados × (1 - slippage)
      const safeSlippage = GUARDS.clamp(STATE.slippage, L.SLIPPAGE_MIN, L.SLIPPAGE_MAX);
      const estimatedWei = ethers.parseUnits(marketOut.toFixed(6), 18);
      const slippageFactor = BigInt(Math.floor((1 - safeSlippage / 100) * 10_000));
      const minUsdtzOut = (estimatedWei * slippageFactor) / 10_000n;

      if (minUsdtzOut <= 0n) throw new Error('Invalid minUsdtzOut: would be zero');

      const bnbStr = bnbVal.toPrecision(15).replace(/\.?0+$/, '');
      const valueWei = ethers.parseEther(bnbStr);

      // [T3] Validar precio onchain
      let priceValid = false;
      try {
        const [valid] = await CHAIN.getReadContract().isBnbPriceValid(bnbPriceWei);
        priceValid = valid;
      } catch (_) {
        throw new Error('price_check_failed');
      }
      if (!priceValid) {
        UI.notif('err', 'Price Out of Range', 'BNB price moved too fast. Refreshing…');
        await PRICE.refresh();
        throw new Error('price_invalid');
      }

      this._lastSwapTime = Date.now();

      const cw = await CHAIN.getWriteContract();
      UI.notif('info', t('tx_pending'), t('tx_pending_msg'));

      const tx = await cw.swap(bnbPriceWei, minUsdtzOut, { value: valueWei });
      const receipt = await tx.wait();

      this._finishSwap(bnbVal, marketOut, receipt.hash);

    } catch (e) {
      // Manejo de errores tipificado (compatible con ethers v6)
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') UI.notif('err', t('tx_rejected'), '');
      else if (e.message === 'price_check_failed') UI.notif('err', 'Price Check Failed', 'Could not verify price on-chain. Try again.');
      else if (e.message !== 'price_invalid') {
        const reason = (e?.reason && typeof e.reason === 'string') ? e.reason.trim()
          : (e?.shortMessage && typeof e.shortMessage === 'string') ? e.shortMessage.trim()
          : e?.code === 'CALL_EXCEPTION' ? 'Transaction reverted by contract.'
          : e?.code === 'INSUFFICIENT_FUNDS' ? 'Insufficient funds for gas.'
          : (e?.message && e.message.length < 120 && !e.message.includes('0x') && !e.message.includes('"from"') && !e.message.includes('transaction=')) ? e.message
          : 'Transaction failed. Please try again.';
        UI.notif('err', t('tx_error'), reason);
      }
    } finally {
      // SIEMPRE liberar mutex y restaurar UI
      this._inProgress = false;
      const swapLoading = document.getElementById('swapLoading');
      if (swapLoading) swapLoading.style.display = 'none';
      const cfmBtn = document.getElementById('cfmBtn');
      if (cfmBtn) cfmBtn.disabled = false;
    }
  },

  /*
   * _finishSwap(bnbVal, out, hash): Actualiza el estado post-swap exitoso.
   * Estrategia 2-pass para balance BNB:
   *   Pass 1: Restar localmente (respuesta inmediata de UI)
   *   Pass 2: Leer balance real de chain (corrige gas y slippage real)
   * Por qué este orden: El balance real solo está disponible asíncronamente.
   *   Restar localmente primero evita que el display quede stale.
   */
  _finishSwap(bnbVal, out, hash) {
    const safeBnb = GUARDS.safePositive(bnbVal);
    const safeOut = GUARDS.safePositive(out);
    const safeHash = GUARDS.isValidHash(hash) ? hash : '';

    // Actualizar STATE
    if (safeOut > 0) STATE.poolBalance = Math.max(0, STATE.poolBalance - safeOut);
    if (safeBnb > 0) STATE.bnbCollected += safeBnb;
    STATE.txCount += 1;
    if (safeOut > 0) STATE.tokensSold += safeOut;

    // Historial
    STATE.txHistory.unshift({ bnb: safeBnb, token: safeOut, hash: safeHash, time: new Date().toLocaleTimeString() });
    if (STATE.txHistory.length > 10) STATE.txHistory.pop();

    // Limpiar inputs
    const bnbInp = document.getElementById('bnbAmt'); if (bnbInp) bnbInp.value = '';
    const usdtzInp = document.getElementById('usdtzAmt'); if (usdtzInp) usdtzInp.value = '';
    const bnbUsd = document.getElementById('bnbUsd'); if (bnbUsd) bnbUsd.textContent = '';
    const usdtzUsd = document.getElementById('usdtzUsd'); if (usdtzUsd) usdtzUsd.textContent = '';

    // Cerrar modal y actualizar UI
    this.closeModal();
    this.updateBtn();
    UI.renderLiqBar();
    UI.renderTxHist();
    ADMIN.updateStats();
    UI.notif('ok', t('tx_success'), `${out.toFixed(2)} ${STATE.tokenSymbol} — ${t('tx_success_msg')}`, safeHash);

    const addTokBtn = document.getElementById('addTokBtn');
    if (addTokBtn) addTokBtn.style.display = 'block';

    // Pass 1: restar localmente (respuesta inmediata)
    if (STATE.bnbBalance >= safeBnb) STATE.bnbBalance -= safeBnb;
    const wb = document.getElementById('walBal'); if (wb) wb.textContent = `${STATE.bnbBalance.toFixed(4)} BNB`;
    const bd = document.getElementById('bnbBalDisp'); if (bd) bd.textContent = STATE.bnbBalance.toFixed(4);

    // Pass 2: corregir con valor real de chain (asíncrono, no bloqueante)
    if (STATE.walletAddress && window.ethereum) {
      window.ethereum.request({ method: 'eth_getBalance', params: [STATE.walletAddress, 'latest'] })
        .then(h => {
          STATE.bnbBalance = Number(ethers.formatEther(BigInt(h)));
          if (wb) wb.textContent = `${STATE.bnbBalance.toFixed(4)} BNB`;
          if (bd) bd.textContent = STATE.bnbBalance.toFixed(4);
          this.updateBtn();
        }).catch(() => { /* Pass 1 ya mostró un valor razonable */ });
    }
  },
};


/* ══════════════════════════════════════════════════════════════
   MÓDULO: TESTTOK
   Propósito: Flujo de reclamación del token de prueba.
     Envía 1 token a la dirección especificada, registrado onchain.
   
   Invariante:
     - hasUsedTest() en el contrato es la FUENTE DE VERDAD
     - El cache local (_checkedCache, STATE.securityUsed) es
       solo una optimización — nunca reemplaza la verificación onchain
     - Si el contrato rechaza, se interpreta el mensaje de revert
   
   Seguridad:
     - Rate limit de sesión (5 por sesión) — capa extra de protección
     - Verificación onchain antes de enviar
     - El contrato previene double-claim permanentemente
   
   Dependencias: CHAIN, STATE, UI, GUARDS.
══════════════════════════════════════════════════════════════ */
