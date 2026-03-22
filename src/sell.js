'use strict';

/* ══════════════════════════════════════════════════════════════
   MÓDULO: SELL
   Propósito: UI y ejecución de la venta de tokens al contrato.
   Solo funciona cuando el buyback está activo para el token.

   Flujo:
     checkBuybackStatus() → muestra/oculta sellCard
     onSellAmt() → estimateSell() → updateSellBtn()
     → initSell() → modal de confirmación
     → executeSell() → approve si necesario → sellTokens()
     → receipt → finishSell()

   Seguridad:
     [S1] Verifica buyback activo antes de cualquier acción
     [S2] Verifica liquidez BNB suficiente antes de confirmar
     [S3] minBnbOut previene slippage (mismo mecanismo que swap)
     [S4] approve() verificado antes de sellTokens()
     [S5] _inProgress mutex — solo una tx a la vez
     [S6] El contrato valida TODO — el frontend es solo pre-chequeo

   Invariantes:
     - Si buyback inactivo → sellBody oculto, sellLocked visible
     - sellBtn NUNCA activo sin monto válido y liquidez confirmada
     - minBnbOut SIEMPRE calculado desde estimación onchain
══════════════════════════════════════════════════════════════ */
const SELL = {
  _inProgress: false,
  _buybackActive: false,
  _buyPrice: 0n,        // precio efectivo en wei (BigInt)
  _bnbOut: 0n,          // BNB estimado a recibir (BigInt)
  _tokenAddr: null,     // dirección del token activo para venta
  _tokenSymbol: 'USDT.z',

  /*
   * checkBuybackStatus(): Consulta el contrato para saber si el
   * buyback está activo para el token principal (USDT.z).
   * Llamado al conectar wallet, al cargar stats, y cada 30s.
   * No falla si el contrato no soporta getBuybackInfo (v3 legacy).
   */
  async checkBuybackStatus() {
    this._tokenAddr   = CONFIG.TOKEN_ADDRESS;
    this._tokenSymbol = STATE.tokenSymbol || 'USDT.z';

    try {
      const c = CHAIN.getReadContract();
      const bb = await c.getBuybackInfo(this._tokenAddr);
      this._buybackActive = bb[0];           // enabled
      this._buyPrice      = bb[1];           // buyPriceScaled
      const bnbLiquidity  = bb[5];           // contractBnbBalance

      this._renderStatus(this._buybackActive, bnbLiquidity);
    } catch (_) {
      // Contrato sin buyback (v3 legacy) — mostrar bloqueado
      this._buybackActive = false;
      this._renderStatus(false, 0n);
    }
  },

  /*
   * _renderStatus(active, bnbLiq): Muestra u oculta el cuerpo
   * de la sell card según estado del buyback.
   */
  _renderStatus(active, bnbLiq) {
    const locked = document.getElementById('sellLocked');
    const body   = document.getElementById('sellBody');
    const badge  = document.getElementById('sellStatusBadge');

    if (active) {
      if (locked) locked.style.display = 'none';
      if (body)   body.classList.add('visible');
      if (badge) {
        badge.className = 'sell-badge-on';
        badge.textContent = '● Active';
      }
      // Actualizar símbolo del token en la UI
      ['sellTokSymDisp','sellTokBadge'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = this._tokenSymbol;
      });
      // Cargar balance del token si hay wallet conectada
      this._loadTokenBalance();
    } else {
      if (locked) locked.style.display = '';
      if (body)   body.classList.remove('visible');
      if (badge) {
        badge.className = 'sell-badge-off';
        badge.textContent = '🔒 Disabled';
      }
    }
    this.updateBtn();
  },

  /*
   * _loadTokenBalance(): Lee el balance del token del usuario
   * para mostrar en el campo "Balance:" de la sell card.
   */
  async _loadTokenBalance() {
    if (!STATE.walletConnected || !STATE.walletAddress) return;
    try {
      const tc = CHAIN.getTokenReadContract();
      const bal = await tc.balanceOf(STATE.walletAddress);
      const formatted = Number(ethers.formatUnits(bal, 18));
      const el = document.getElementById('sellTokBalDisp');
      if (el) el.textContent = formatted.toFixed(4);
      STATE.sellTokenBalance = bal; // BigInt
    } catch (_) { STATE.sellTokenBalance = 0n; }
  },

  /*
   * onSellAmt(val): Reacciona al input del usuario en el campo
   * de cantidad a vender. Llama estimateSell() onchain.
   */
  async onSellAmt(val) {
    if (!this._buybackActive) return;
    const el_out  = document.getElementById('sellBnbOut');
    const estRow  = document.getElementById('sellEstRow');

    if (!val || isNaN(val) || Number(val) <= 0) {
      if (el_out) el_out.value = '';
      if (estRow) estRow.style.display = 'none';
      this._bnbOut = 0n;
      this.updateBtn();
      return;
    }

    try {
      const amtWei = ethers.parseUnits(String(Number(val).toFixed(18)), 18);
      const c      = CHAIN.getReadContract();
      const result = await c.estimateSell(this._tokenAddr, amtWei);

      const bnbOut     = result[0]; // BigInt
      const effPrice   = result[1]; // BigInt
      const hasLiq     = result[2]; // bool

      this._bnbOut   = bnbOut;
      this._buyPrice = effPrice;

      // Mostrar BNB estimado
      if (el_out) el_out.value = Number(ethers.formatEther(bnbOut)).toFixed(6);

      // Detalles
      if (estRow) {
        estRow.style.display = 'flex';
        const price = Number(ethers.formatEther(effPrice));
        const liq   = Number(ethers.formatEther(result[0])); // reutiliza bnbOut
        const slip  = STATE.slippage || 0.5;
        const minBnb = Number(ethers.formatEther(bnbOut)) * (1 - slip / 100);

        const ep = document.getElementById('sellEstPrice');
        const el2 = document.getElementById('sellEstLiq');
        const em = document.getElementById('sellEstMin');
        if (ep) ep.textContent = price.toFixed(8) + ' BNB';
        if (el2) {
          el2.textContent = hasLiq ? '✓ Available' : '✗ Insufficient';
          el2.className   = 'val' + (hasLiq ? '' : ' warn');
        }
        if (em) em.textContent = minBnb.toFixed(6) + ' BNB';
      }

      // Nota de approve si no tiene allowance
      this._checkAllowance(amtWei);

    } catch (_) {
      this._bnbOut = 0n;
      if (el_out) el_out.value = '';
    }
    this.updateBtn();
  },

  /*
   * _checkAllowance(amtWei): Verifica si el usuario ya aprobó
   * al contrato gastar sus tokens.
   */
  async _checkAllowance(amtWei) {
    const note = document.getElementById('sellApproveNote');
    if (!note || !STATE.walletAddress) return;
    try {
      const tc  = CHAIN.getTokenReadContract();
      const all = await tc.allowance(STATE.walletAddress, STATE.contractAddress);
      note.style.display = all < amtWei ? 'block' : 'none';
    } catch (_) { note.style.display = 'none'; }
  },

  /*
   * updateBtn(): Actualiza el estado del botón de venta.
   * Deshabilitado si: no conectado, buyback inactivo,
   * monto 0, o sin liquidez confirmada.
   */
  updateBtn() {
    const btn = document.getElementById('sellBtn');
    if (!btn) return;

    if (!STATE.walletConnected) {
      btn.disabled = true;
      btn.textContent = 'Connect wallet to sell';
      return;
    }
    if (!this._buybackActive) {
      btn.disabled = true;
      btn.textContent = 'Buyback not active';
      return;
    }
    const amt = parseFloat(document.getElementById('sellAmt')?.value);
    if (!amt || amt <= 0 || this._bnbOut === 0n) {
      btn.disabled = true;
      btn.textContent = 'Enter amount';
      return;
    }
    if (this._inProgress) {
      btn.disabled = true;
      btn.textContent = '⏳ Processing…';
      return;
    }
    btn.disabled = false;
    btn.textContent = `Sell ${this._tokenSymbol}`;
  },

  /*
   * initSell(): Abre el modal de confirmación con los detalles
   * de la venta antes de ejecutarla.
   */
  initSell() {
    if (!STATE.walletConnected || !this._buybackActive || this._inProgress) return;
    const amt = parseFloat(document.getElementById('sellAmt')?.value);
    if (!amt || amt <= 0 || this._bnbOut === 0n) return;

    const slip    = STATE.slippage || 0.5;
    const bnbFmt  = Number(ethers.formatEther(this._bnbOut)).toFixed(6);
    const priceFmt= Number(ethers.formatEther(this._buyPrice)).toFixed(8);
    const minBnb  = (Number(bnbFmt) * (1 - slip / 100)).toFixed(6);

    const set = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
    set('cfmSellAmt',   `${amt} ${this._tokenSymbol}`);
    set('cfmSellBnb',   `${bnbFmt} BNB`);
    set('cfmSellPrice', `${priceFmt} BNB per token`);
    set('cfmSellMin',   `${minBnb} BNB (${slip}%)`);

    // Guardar para execute
    STATE._sellAmt    = amt;
    STATE._sellMinBnb = minBnb;

    document.getElementById('sellOverlay').classList.add('open');
  },

  /*
   * executeSell(): Ejecuta la venta onchain.
   * Orden:
   *   1. Re-verificar buyback activo
   *   2. approve() si necesario
   *   3. sellTokens()
   *   4. finishSell()
   *
   * [S3] minBnbOut calculado desde estimación onchain con slippage
   * [S4] approve verificado justo antes de la tx
   * [S5] _inProgress mutex activo durante toda la tx
   */
  async executeSell() {
    if (this._inProgress) return;
    const amt     = STATE._sellAmt;
    const minBnb  = STATE._sellMinBnb;
    if (!amt || !minBnb) return;

    document.getElementById('sellOverlay').classList.remove('open');
    this._inProgress = true;
    this.updateBtn();

    const loading = document.getElementById('sellLoading');

    try {
      const amtWei    = ethers.parseUnits(String(Number(amt).toFixed(18)), 18);
      const minBnbWei = ethers.parseEther(String(Number(minBnb).toFixed(18)));

      // [S4] Verificar allowance — approve si necesario
      const tc  = await CHAIN.getTokenWriteContract();
      const all = await CHAIN.getTokenReadContract().allowance(
        STATE.walletAddress, STATE.contractAddress
      );

      if (all < amtWei) {
        UI.notif('info', 'Approve Required', 'Approve the contract to spend your tokens first');
        if (loading) loading.style.display = 'flex';
        const appTx = await tc.approve(STATE.contractAddress, amtWei);
        await appTx.wait();
        UI.notif('ok', 'Approved', 'Now confirming the sale…');
      }

      // [S1] Re-verificar buyback activo justo antes
      const c  = CHAIN.getReadContract();
      const bb = await c.getBuybackInfo(this._tokenAddr);
      if (!bb[0]) {
        UI.notif('err', 'Buyback Disabled', 'The buyback was deactivated. Sale cancelled.');
        return;
      }

      // [S2] Verificar liquidez BNB suficiente
      const bnbNeeded = ethers.parseEther(String(Number(minBnb).toFixed(18)));
      if (bb[5] < bnbNeeded) {
        UI.notif('err', 'Insufficient Liquidity', 'The contract does not have enough BNB to buy your tokens right now.');
        return;
      }

      // Ejecutar venta
      if (loading) loading.style.display = 'flex';
      const cw = await CHAIN.getWriteContract();
      const tx = await cw.sellTokens(this._tokenAddr, amtWei, minBnbWei);
      UI.notif('info', 'Transaction Sent', 'Waiting for confirmation…');

      const receipt = await tx.wait();
      this._finishSell(receipt, amt, Number(ethers.formatEther(this._bnbOut)));

    } catch (e) {
      if (loading) loading.style.display = 'none';
      if (e?.code === 4001 || e?.code === 'ACTION_REJECTED') {
        UI.notif('err', 'Rejected', 'Sale rejected by user');
      } else {
        const msg = e?.reason || e?.message || 'Unknown error';
        UI.notif('err', 'Sale Failed', msg.length > 80 ? msg.slice(0, 80) + '…' : msg);
      }
    } finally {
      this._inProgress = false;
      if (loading) loading.style.display = 'none';
      this.updateBtn();
    }
  },

  /*
   * _finishSell(receipt, tokenAmt, bnbAmt): Post-venta exitosa.
   * Limpia inputs, refresca balance, notifica al usuario.
   */
  async _finishSell(receipt, tokenAmt, bnbAmt) {
    UI.notif('ok', 'Sale Complete! 🎉',
      `Sold ${tokenAmt} ${this._tokenSymbol} → ${bnbAmt.toFixed(6)} BNB`);

    // Limpiar inputs
    const ai = document.getElementById('sellAmt');
    const bo = document.getElementById('sellBnbOut');
    const er = document.getElementById('sellEstRow');
    if (ai) ai.value = '';
    if (bo) bo.value = '';
    if (er) er.style.display = 'none';
    this._bnbOut = 0n;

    // Refrescar balances
    await WALLET.refreshBalance();
    await this._loadTokenBalance();
    await this.checkBuybackStatus();
    this.updateBtn();
  },
};
