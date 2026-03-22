'use strict';

/* ══════════════════════════════════════════════════════════════
   MÓDULO: SELL  v2.1
   FIX BUG 4: _renderStatus() ahora gestiona la visibilidad de
   #sellLocked y #sellBody. La versión anterior tenía la lógica
   de tabs correcta pero NUNCA ocultaba/mostraba estos elementos,
   lo que causaba que ambos se mostraran simultáneamente siempre.
══════════════════════════════════════════════════════════════ */
const SELL = {
  _inProgress:    false,
  _buybackActive: false,
  _buyPrice:      0n,
  _bnbOut:        0n,
  _tokenAddr:     null,
  _tokenSymbol:   'USDT.z',

  async checkBuybackStatus() {
    this._tokenAddr   = CONFIG.TOKEN_ADDRESS;
    this._tokenSymbol = STATE.tokenSymbol || 'USDT.z';
    try {
      const c  = CHAIN.getReadContract();
      const bb = await c.getBuybackInfo(this._tokenAddr);
      this._buybackActive = bb[0];
      this._buyPrice      = bb[1];
      const bnbLiquidity  = bb[5];
      this._renderStatus(this._buybackActive, bnbLiquidity);
    } catch (_) {
      this._buybackActive = false;
      this._renderStatus(false, 0n);
    }
  },

  /*
   * FIX BUG 4: _renderStatus() ahora controla la visibilidad de
   * sellLocked (mensaje cuando buyback inactivo) y sellBody (formulario).
   *
   * ANTES — solo tocaba la tab, nunca las secciones internas:
   *   → sellLocked Y sellBody siempre visibles al mismo tiempo
   *
   * AHORA:
   *   Buyback INACTIVO → sellLocked visible, sellBody oculto
   *   Buyback ACTIVO   → sellLocked oculto,  sellBody visible
   */
  _renderStatus(active, bnbLiq) {
    const sellTab    = document.getElementById('tabSell');
    const sellLocked = document.getElementById('sellLocked');
    const sellBody   = document.getElementById('sellBody');
    const badge      = document.getElementById('sellTabBadge');

    if (!sellTab) return;

    if (active) {
      sellTab.classList.remove('tab-disabled');
      sellTab.title = '';
      if (badge) { badge.textContent = ''; badge.className = 'sell-tab-badge-on'; }

      // Mostrar formulario, ocultar mensaje de bloqueado
      if (sellLocked) sellLocked.style.display = 'none';
      if (sellBody)   sellBody.style.display   = 'flex';

      ['sellTokSymDisp', 'sellTokBadge'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = this._tokenSymbol;
      });
      this._loadTokenBalance();
    } else {
      sellTab.classList.add('tab-disabled');
      sellTab.title = 'Buyback not active — administrators have not enabled token purchases';
      if (badge) { badge.textContent = 'Off'; badge.className = 'sell-tab-badge-off'; }

      // Mostrar mensaje de bloqueado, ocultar formulario
      if (sellLocked) sellLocked.style.display = 'flex';
      if (sellBody)   sellBody.style.display   = 'none';

      // Si el panel sell estaba abierto, volver a swap
      const panelSell = document.getElementById('panelSell');
      if (panelSell && panelSell.style.display !== 'none') {
        this._switchToSwap();
      }
    }
    this.updateBtn();
  },

  activateTab() {
    if (!this._buybackActive) {
      UI.notif('info', 'Buyback Inactive',
        'The contract is not currently buying tokens. Enabled by administrators.');
      return;
    }
    document.getElementById('tabSwap').classList.remove('active');
    document.getElementById('tabSell').classList.add('active');
    document.getElementById('panelSwap').style.display = 'none';
    const ps = document.getElementById('panelSell');
    if (ps) ps.style.display = 'block';
    this._loadTokenBalance();
  },

  _switchToSwap() {
    const tabSwap   = document.getElementById('tabSwap');
    const tabSell   = document.getElementById('tabSell');
    const panelSwap = document.getElementById('panelSwap');
    const panelSell = document.getElementById('panelSell');
    if (tabSwap)   tabSwap.classList.add('active');
    if (tabSell)   tabSell.classList.remove('active');
    if (panelSwap) panelSwap.style.display = 'block';
    if (panelSell) panelSell.style.display = 'none';
  },

  async _loadTokenBalance() {
    if (!STATE.walletConnected || !STATE.walletAddress) return;
    try {
      const tc  = CHAIN.getTokenReadContract();
      const bal = await tc.balanceOf(STATE.walletAddress);
      const fmt = Number(ethers.formatUnits(bal, 18));
      const el  = document.getElementById('sellTokBalDisp');
      if (el) el.textContent = fmt.toFixed(4);
      STATE.sellTokenBalance = bal;
    } catch (_) { STATE.sellTokenBalance = 0n; }
  },

  async onSellAmt(val) {
    if (!this._buybackActive) return;
    const el_out = document.getElementById('sellBnbOut');
    const estRow = document.getElementById('sellEstRow');

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

      const bnbOut   = result[0];
      const effPrice = result[1];
      const hasLiq   = result[2];

      this._bnbOut   = bnbOut;
      this._buyPrice = effPrice;

      if (el_out) el_out.value = Number(ethers.formatEther(bnbOut)).toFixed(6);

      if (estRow) {
        estRow.style.display = 'flex';
        const price  = Number(ethers.formatEther(effPrice));
        const slip   = STATE.slippage || 0.5;
        const minBnb = Number(ethers.formatEther(bnbOut)) * (1 - slip / 100);
        const ep  = document.getElementById('sellEstPrice');
        const el2 = document.getElementById('sellEstLiq');
        const em  = document.getElementById('sellEstMin');
        if (ep)  ep.textContent  = price.toFixed(8) + ' BNB';
        if (el2) {
          el2.textContent = hasLiq ? '✓ Available' : '✗ Insufficient';
          el2.className   = 'val' + (hasLiq ? '' : ' warn');
        }
        if (em)  em.textContent  = minBnb.toFixed(6) + ' BNB';
      }
      this._checkAllowance(amtWei);
    } catch (_) {
      this._bnbOut = 0n;
      if (el_out) el_out.value = '';
    }
    this.updateBtn();
  },

  async _checkAllowance(amtWei) {
    const note = document.getElementById('sellApproveNote');
    if (!note || !STATE.walletAddress) return;
    try {
      const tc  = CHAIN.getTokenReadContract();
      const all = await tc.allowance(STATE.walletAddress, STATE.contractAddress);
      note.style.display = all < amtWei ? 'block' : 'none';
    } catch (_) { note.style.display = 'none'; }
  },

  updateBtn() {
    const btn = document.getElementById('sellBtn');
    if (!btn) return;
    if (!STATE.walletConnected) {
      btn.disabled = true; btn.textContent = 'Connect wallet to sell'; return;
    }
    if (!this._buybackActive) {
      btn.disabled = true; btn.textContent = 'Buyback not active'; return;
    }
    const amt = parseFloat(document.getElementById('sellAmt')?.value);
    if (!amt || amt <= 0 || this._bnbOut === 0n) {
      btn.disabled = true; btn.textContent = 'Enter amount'; return;
    }
    if (this._inProgress) {
      btn.disabled = true; btn.textContent = '⏳ Processing…'; return;
    }
    btn.disabled    = false;
    btn.textContent = `Sell ${this._tokenSymbol}`;
  },

  initSell() {
    if (!STATE.walletConnected || !this._buybackActive || this._inProgress) return;
    const amt = parseFloat(document.getElementById('sellAmt')?.value);
    if (!amt || amt <= 0 || this._bnbOut === 0n) return;

    const slip     = STATE.slippage || 0.5;
    const bnbFmt   = Number(ethers.formatEther(this._bnbOut)).toFixed(6);
    const priceFmt = Number(ethers.formatEther(this._buyPrice)).toFixed(8);
    const minBnb   = (Number(bnbFmt) * (1 - slip / 100)).toFixed(6);

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('cfmSellAmt',   `${amt} ${this._tokenSymbol}`);
    set('cfmSellBnb',   `${bnbFmt} BNB`);
    set('cfmSellPrice', `${priceFmt} BNB per token`);
    set('cfmSellMin',   `${minBnb} BNB (${slip}%)`);

    STATE._sellAmt    = amt;
    STATE._sellMinBnb = minBnb;
    document.getElementById('sellOverlay').classList.add('open');
  },

  async executeSell() {
    if (this._inProgress) return;
    const amt    = STATE._sellAmt;
    const minBnb = STATE._sellMinBnb;
    if (!amt || !minBnb) return;

    document.getElementById('sellOverlay').classList.remove('open');
    this._inProgress = true;
    this.updateBtn();

    const loading = document.getElementById('sellLoading');

    try {
      const amtWei    = ethers.parseUnits(String(Number(amt).toFixed(18)), 18);
      const minBnbWei = ethers.parseEther(String(Number(minBnb).toFixed(18)));

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

      const c  = CHAIN.getReadContract();
      const bb = await c.getBuybackInfo(this._tokenAddr);
      if (!bb[0]) {
        UI.notif('err', 'Buyback Disabled', 'Buyback was deactivated. Sale cancelled.');
        return;
      }

      const bnbNeeded = ethers.parseEther(String(Number(minBnb).toFixed(18)));
      if (bb[5] < bnbNeeded) {
        UI.notif('err', 'Insufficient Liquidity',
          'The contract does not have enough BNB to buy your tokens right now.');
        return;
      }

      if (loading) loading.style.display = 'flex';
      const cw = await CHAIN.getWriteContract();
      const tx = await cw.sellTokens(this._tokenAddr, amtWei, minBnbWei);
      UI.notif('info', 'Transaction Sent', 'Waiting for confirmation…');

      const receipt = await tx.wait();
      await this._finishSell(receipt, amt, Number(ethers.formatEther(this._bnbOut)));

    } catch (e) {
      if (loading) loading.style.display = 'none';
      if (e?.code === 4001 || e?.code === 'ACTION_REJECTED')
        UI.notif('err', 'Rejected', 'Sale rejected by user');
      else {
        const msg = e?.reason || e?.message || 'Unknown error';
        UI.notif('err', 'Sale Failed', msg.length > 80 ? msg.slice(0, 80) + '…' : msg);
      }
    } finally {
      this._inProgress = false;
      if (loading) loading.style.display = 'none';
      this.updateBtn();
    }
  },

  async _finishSell(receipt, tokenAmt, bnbAmt) {
    UI.notif('ok', 'Sale Complete! 🎉',
      `Sold ${tokenAmt} ${this._tokenSymbol} → ${bnbAmt.toFixed(6)} BNB`);

    const ai = document.getElementById('sellAmt');
    const bo = document.getElementById('sellBnbOut');
    const er = document.getElementById('sellEstRow');
    if (ai) ai.value = '';
    if (bo) bo.value = '';
    if (er) er.style.display = 'none';
    this._bnbOut = 0n;

    await WALLET.refreshBalance();
    await this._loadTokenBalance();
    await this.checkBuybackStatus();
    this.updateBtn();
  },
};
'use strict';

/* ══════════════════════════════════════════════════════════════
   MÓDULO: SELL  v2.1
   FIX BUG 4: _renderStatus() ahora gestiona la visibilidad de
   #sellLocked y #sellBody. La versión anterior tenía la lógica
   de tabs correcta pero NUNCA ocultaba/mostraba estos elementos,
   lo que causaba que ambos se mostraran simultáneamente siempre.
══════════════════════════════════════════════════════════════ */
const SELL = {
  _inProgress:    false,
  _buybackActive: false,
  _buyPrice:      0n,
  _bnbOut:        0n,
  _tokenAddr:     null,
  _tokenSymbol:   'USDT.z',

  async checkBuybackStatus() {
    this._tokenAddr   = CONFIG.TOKEN_ADDRESS;
    this._tokenSymbol = STATE.tokenSymbol || 'USDT.z';
    try {
      const c  = CHAIN.getReadContract();
      const bb = await c.getBuybackInfo(this._tokenAddr);
      this._buybackActive = bb[0];
      this._buyPrice      = bb[1];
      const bnbLiquidity  = bb[5];
      this._renderStatus(this._buybackActive, bnbLiquidity);
    } catch (_) {
      this._buybackActive = false;
      this._renderStatus(false, 0n);
    }
  },

  /*
   * FIX BUG 4: _renderStatus() ahora controla la visibilidad de
   * sellLocked (mensaje cuando buyback inactivo) y sellBody (formulario).
   *
   * ANTES — solo tocaba la tab, nunca las secciones internas:
   *   → sellLocked Y sellBody siempre visibles al mismo tiempo
   *
   * AHORA:
   *   Buyback INACTIVO → sellLocked visible, sellBody oculto
   *   Buyback ACTIVO   → sellLocked oculto,  sellBody visible
   */
  _renderStatus(active, bnbLiq) {
    const sellTab    = document.getElementById('tabSell');
    const sellLocked = document.getElementById('sellLocked');
    const sellBody   = document.getElementById('sellBody');
    const badge      = document.getElementById('sellTabBadge');

    if (!sellTab) return;

    if (active) {
      sellTab.classList.remove('tab-disabled');
      sellTab.title = '';
      if (badge) { badge.textContent = ''; badge.className = 'sell-tab-badge-on'; }

      // Mostrar formulario, ocultar mensaje de bloqueado
      if (sellLocked) sellLocked.style.display = 'none';
      if (sellBody)   sellBody.style.display   = 'flex';

      ['sellTokSymDisp', 'sellTokBadge'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = this._tokenSymbol;
      });
      this._loadTokenBalance();
    } else {
      sellTab.classList.add('tab-disabled');
      sellTab.title = 'Buyback not active — administrators have not enabled token purchases';
      if (badge) { badge.textContent = 'Off'; badge.className = 'sell-tab-badge-off'; }

      // Mostrar mensaje de bloqueado, ocultar formulario
      if (sellLocked) sellLocked.style.display = 'flex';
      if (sellBody)   sellBody.style.display   = 'none';

      // Si el panel sell estaba abierto, volver a swap
      const panelSell = document.getElementById('panelSell');
      if (panelSell && panelSell.style.display !== 'none') {
        this._switchToSwap();
      }
    }
    this.updateBtn();
  },

  activateTab() {
    if (!this._buybackActive) {
      UI.notif('info', 'Buyback Inactive',
        'The contract is not currently buying tokens. Enabled by administrators.');
      return;
    }
    document.getElementById('tabSwap').classList.remove('active');
    document.getElementById('tabSell').classList.add('active');
    document.getElementById('panelSwap').style.display = 'none';
    const ps = document.getElementById('panelSell');
    if (ps) ps.style.display = 'block';
    this._loadTokenBalance();
  },

  _switchToSwap() {
    const tabSwap   = document.getElementById('tabSwap');
    const tabSell   = document.getElementById('tabSell');
    const panelSwap = document.getElementById('panelSwap');
    const panelSell = document.getElementById('panelSell');
    if (tabSwap)   tabSwap.classList.add('active');
    if (tabSell)   tabSell.classList.remove('active');
    if (panelSwap) panelSwap.style.display = 'block';
    if (panelSell) panelSell.style.display = 'none';
  },

  async _loadTokenBalance() {
    if (!STATE.walletConnected || !STATE.walletAddress) return;
    try {
      const tc  = CHAIN.getTokenReadContract();
      const bal = await tc.balanceOf(STATE.walletAddress);
      const fmt = Number(ethers.formatUnits(bal, 18));
      const el  = document.getElementById('sellTokBalDisp');
      if (el) el.textContent = fmt.toFixed(4);
      STATE.sellTokenBalance = bal;
    } catch (_) { STATE.sellTokenBalance = 0n; }
  },

  async onSellAmt(val) {
    if (!this._buybackActive) return;
    const el_out = document.getElementById('sellBnbOut');
    const estRow = document.getElementById('sellEstRow');

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

      const bnbOut   = result[0];
      const effPrice = result[1];
      const hasLiq   = result[2];

      this._bnbOut   = bnbOut;
      this._buyPrice = effPrice;

      if (el_out) el_out.value = Number(ethers.formatEther(bnbOut)).toFixed(6);

      if (estRow) {
        estRow.style.display = 'flex';
        const price  = Number(ethers.formatEther(effPrice));
        const slip   = STATE.slippage || 0.5;
        const minBnb = Number(ethers.formatEther(bnbOut)) * (1 - slip / 100);
        const ep  = document.getElementById('sellEstPrice');
        const el2 = document.getElementById('sellEstLiq');
        const em  = document.getElementById('sellEstMin');
        if (ep)  ep.textContent  = price.toFixed(8) + ' BNB';
        if (el2) {
          el2.textContent = hasLiq ? '✓ Available' : '✗ Insufficient';
          el2.className   = 'val' + (hasLiq ? '' : ' warn');
        }
        if (em)  em.textContent  = minBnb.toFixed(6) + ' BNB';
      }
      this._checkAllowance(amtWei);
    } catch (_) {
      this._bnbOut = 0n;
      if (el_out) el_out.value = '';
    }
    this.updateBtn();
  },

  async _checkAllowance(amtWei) {
    const note = document.getElementById('sellApproveNote');
    if (!note || !STATE.walletAddress) return;
    try {
      const tc  = CHAIN.getTokenReadContract();
      const all = await tc.allowance(STATE.walletAddress, STATE.contractAddress);
      note.style.display = all < amtWei ? 'block' : 'none';
    } catch (_) { note.style.display = 'none'; }
  },

  updateBtn() {
    const btn = document.getElementById('sellBtn');
    if (!btn) return;
    if (!STATE.walletConnected) {
      btn.disabled = true; btn.textContent = 'Connect wallet to sell'; return;
    }
    if (!this._buybackActive) {
      btn.disabled = true; btn.textContent = 'Buyback not active'; return;
    }
    const amt = parseFloat(document.getElementById('sellAmt')?.value);
    if (!amt || amt <= 0 || this._bnbOut === 0n) {
      btn.disabled = true; btn.textContent = 'Enter amount'; return;
    }
    if (this._inProgress) {
      btn.disabled = true; btn.textContent = '⏳ Processing…'; return;
    }
    btn.disabled    = false;
    btn.textContent = `Sell ${this._tokenSymbol}`;
  },

  initSell() {
    if (!STATE.walletConnected || !this._buybackActive || this._inProgress) return;
    const amt = parseFloat(document.getElementById('sellAmt')?.value);
    if (!amt || amt <= 0 || this._bnbOut === 0n) return;

    const slip     = STATE.slippage || 0.5;
    const bnbFmt   = Number(ethers.formatEther(this._bnbOut)).toFixed(6);
    const priceFmt = Number(ethers.formatEther(this._buyPrice)).toFixed(8);
    const minBnb   = (Number(bnbFmt) * (1 - slip / 100)).toFixed(6);

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('cfmSellAmt',   `${amt} ${this._tokenSymbol}`);
    set('cfmSellBnb',   `${bnbFmt} BNB`);
    set('cfmSellPrice', `${priceFmt} BNB per token`);
    set('cfmSellMin',   `${minBnb} BNB (${slip}%)`);

    STATE._sellAmt    = amt;
    STATE._sellMinBnb = minBnb;
    document.getElementById('sellOverlay').classList.add('open');
  },

  async executeSell() {
    if (this._inProgress) return;
    const amt    = STATE._sellAmt;
    const minBnb = STATE._sellMinBnb;
    if (!amt || !minBnb) return;

    document.getElementById('sellOverlay').classList.remove('open');
    this._inProgress = true;
    this.updateBtn();

    const loading = document.getElementById('sellLoading');

    try {
      const amtWei    = ethers.parseUnits(String(Number(amt).toFixed(18)), 18);
      const minBnbWei = ethers.parseEther(String(Number(minBnb).toFixed(18)));

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

      const c  = CHAIN.getReadContract();
      const bb = await c.getBuybackInfo(this._tokenAddr);
      if (!bb[0]) {
        UI.notif('err', 'Buyback Disabled', 'Buyback was deactivated. Sale cancelled.');
        return;
      }

      const bnbNeeded = ethers.parseEther(String(Number(minBnb).toFixed(18)));
      if (bb[5] < bnbNeeded) {
        UI.notif('err', 'Insufficient Liquidity',
          'The contract does not have enough BNB to buy your tokens right now.');
        return;
      }

      if (loading) loading.style.display = 'flex';
      const cw = await CHAIN.getWriteContract();
      const tx = await cw.sellTokens(this._tokenAddr, amtWei, minBnbWei);
      UI.notif('info', 'Transaction Sent', 'Waiting for confirmation…');

      const receipt = await tx.wait();
      await this._finishSell(receipt, amt, Number(ethers.formatEther(this._bnbOut)));

    } catch (e) {
      if (loading) loading.style.display = 'none';
      if (e?.code === 4001 || e?.code === 'ACTION_REJECTED')
        UI.notif('err', 'Rejected', 'Sale rejected by user');
      else {
        const msg = e?.reason || e?.message || 'Unknown error';
        UI.notif('err', 'Sale Failed', msg.length > 80 ? msg.slice(0, 80) + '…' : msg);
      }
    } finally {
      this._inProgress = false;
      if (loading) loading.style.display = 'none';
      this.updateBtn();
    }
  },

  async _finishSell(receipt, tokenAmt, bnbAmt) {
    UI.notif('ok', 'Sale Complete! 🎉',
      `Sold ${tokenAmt} ${this._tokenSymbol} → ${bnbAmt.toFixed(6)} BNB`);

    const ai = document.getElementById('sellAmt');
    const bo = document.getElementById('sellBnbOut');
    const er = document.getElementById('sellEstRow');
    if (ai) ai.value = '';
    if (bo) bo.value = '';
    if (er) er.style.display = 'none';
    this._bnbOut = 0n;

    await WALLET.refreshBalance();
    await this._loadTokenBalance();
    await this.checkBuybackStatus();
    this.updateBtn();
  },
};
