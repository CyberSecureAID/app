'use strict';
const ADMIN = {
  _depositNotifTimeout: null,

  open() {
    if (!STATE.walletConnected) {
      const overlay = document.getElementById('accessDeniedOverlay');
      document.getElementById('accessDeniedTitle').textContent =
        STATE.lang === 'es' ? 'Wallet Requerida' : 'Wallet Required';
      document.getElementById('accessDeniedMsg').textContent = STATE.lang === 'es'
        ? 'Debes conectar tu wallet antes de acceder al panel administrativo.'
        : 'You must connect your wallet before accessing the admin panel.';
      overlay.classList.add('open');
      return;
    }
    if (!WALLET.isAdmin()) {
      const overlay = document.getElementById('accessDeniedOverlay');
      document.getElementById('accessDeniedTitle').textContent =
        STATE.lang === 'es' ? 'Acceso Denegado' : 'Access Denied';
      document.getElementById('accessDeniedMsg').textContent = STATE.lang === 'es'
        ? `La wallet ${UI.abbr(STATE.walletAddress)} no está autorizada.`
        : `Wallet ${UI.abbr(STATE.walletAddress)} is not authorized.`;
      overlay.classList.add('open');
      return;
    }

    document.getElementById('admPanel').classList.add('open');
    document.getElementById('admOverlay').classList.add('open');
    const ob = document.getElementById('ownBanner');
    if (ob) { ob.classList.add('show'); }
    const oa = document.getElementById('ownAddr');
    if (oa) oa.textContent = UI.abbr(STATE.walletAddress);

    STATS.load().catch(() => {});
    if (window.ethereum || WALLET._activeProvider) this._loadAdminTokenBalance().catch(() => {});
    this.updateStats();
    this.updatePriceCalc();
  },

  /*
   * FIX BUG 4: _switchView ahora es un no-op seguro.
   * El panel admin en index.html es un drawer estático, no un dashboard
   * con vistas. Los intentos de cambiar vistas fallaban silenciosamente.
   * Esta función se mantiene para compatibilidad pero no hace nada
   * perjudicial si se llama con una vista inexistente.
   */
  _switchView(view) {
    // El panel admin de index.html usa secciones fijas (no views dinámicas).
    // En admin.html (panel completo) sí existen las vistas — no aplica aquí.
    console.debug('[ADMIN._switchView] view:', view, '(static panel — no-op)');
  },

  close() {
    document.getElementById('admPanel').classList.remove('open');
    document.getElementById('admOverlay').classList.remove('open');
  },

  async _loadAdminTokenBalance() {
    if (!STATE.walletAddress) return;
    try {
      const tc  = CHAIN.getTokenReadContract();
      const bal = await tc.balanceOf(STATE.walletAddress);
      STATE.adminTokenBalance        = Number(ethers.formatUnits(bal, 18));
      STATE.adminTokenBalanceLoaded  = true;
      const el = document.getElementById('adminTokenBal');
      if (el) el.textContent =
        STATE.adminTokenBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })
        + ' ' + STATE.tokenSymbol;
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
    const a   = GUARDS.safePositive(document.getElementById('depositAmt')?.value);
    const btn = document.getElementById('depositBtn');
    if (!btn) return;
    if (a <= 0) { btn.disabled = true; return; }
    if (STATE.adminTokenBalanceLoaded && STATE.adminTokenBalance <= 0) {
      btn.disabled = true;
      clearTimeout(this._depositNotifTimeout);
      this._depositNotifTimeout = setTimeout(
        () => UI.notif('err', 'No balance', `You have no ${STATE.tokenSymbol} to deposit`), 300
      );
      return;
    }
    if (STATE.adminTokenBalanceLoaded && a > STATE.adminTokenBalance) {
      btn.disabled = true;
      clearTimeout(this._depositNotifTimeout);
      this._depositNotifTimeout = setTimeout(
        () => UI.notif('err', 'Exceeds balance', `You only have ${STATE.adminTokenBalance.toFixed(2)} ${STATE.tokenSymbol}`), 300
      );
      return;
    }
    btn.disabled = false;
  },

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
      if (e.code === 4001 || e.code === 'ACTION_REJECTED')
        UI.notif('err', 'Rejected', 'Transaction rejected by user');
      else
        UI.notif('err', 'Deposit Failed', e?.reason || e?.shortMessage || e?.message || '');
    }
  },

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
      if (e.code === 4001 || e.code === 'ACTION_REJECTED')
        UI.notif('err', 'Rejected', 'Transaction rejected by user');
      else
        UI.notif('err', 'Withdraw Failed', e?.reason || e?.shortMessage || e?.message || '');
    }
  },

  // ── Calculadora de precio ────────────────────────────────────────────────

  setPcMode(mode) {
    STATE.pcMode = mode;
    document.getElementById('pcPanelDirect').classList.toggle('on', mode === 'direct');
    document.getElementById('pcPanelRatio').classList.toggle('on',  mode === 'ratio');
    document.getElementById('pcTabDirect').classList.toggle('on',   mode === 'direct');
    document.getElementById('pcTabRatio').classList.toggle('on',    mode === 'ratio');
    this.updatePriceCalc();
  },

  onDirectPriceInput() { this.updatePriceCalc(); },
  onRatioInput()       { this.updatePriceCalc(); },

  updatePriceCalc() {
    const bnbRef = STATE.bnbPriceUSD;
    if (STATE.pcMode === 'direct') {
      const el = document.getElementById('dirBnbRef'); if (el) el.textContent = bnbRef ? bnbRef.toFixed(2) : '—';
      const v  = GUARDS.safePositive(document.getElementById('directPrice')?.value);
      const dp = document.getElementById('dirUsdtzPrice');
      const dr = document.getElementById('dirRate');
      if (v > 0) {
        if (dp) dp.textContent = v.toFixed(8);
        if (bnbRef > 0 && dr) dr.textContent = UI.fmtRate(bnbRef / v);
        else if (dr) dr.textContent = '—';
      } else {
        if (dp) dp.textContent = '—';
        if (dr) dr.textContent = '—';
      }
    } else {
      const el  = document.getElementById('ratBnbRef'); if (el) el.textContent = bnbRef ? bnbRef.toFixed(2) : '—';
      const bnbA = GUARDS.safePositive(document.getElementById('ratioBnb')?.value);
      const tokA = GUARDS.safePositive(document.getElementById('ratioUsdt')?.value);
      const ru   = document.getElementById('ratUsdtzCalc');
      const rr   = document.getElementById('ratRate');
      if (bnbA > 0 && tokA > 0) {
        const rate = tokA / bnbA;
        if (rr) rr.textContent = UI.fmtRate(rate);
        if (bnbRef > 0 && ru) ru.textContent = (bnbRef / rate).toFixed(8);
      } else {
        if (ru) ru.textContent = '—';
        if (rr) rr.textContent = '—';
      }
    }
  },

  async applyPrice() {
    if (!WALLET.isAdmin()) { UI.notif('err', 'Access Denied', 'Admin only'); return; }
    let newPrice = 0;
    if (STATE.pcMode === 'direct') {
      newPrice = GUARDS.safePositive(document.getElementById('directPrice')?.value);
    } else {
      const bnbAmt = GUARDS.safePositive(document.getElementById('ratioBnb')?.value);
      const tokAmt = GUARDS.safePositive(document.getElementById('ratioUsdt')?.value);
      if (bnbAmt > 0 && tokAmt > 0 && STATE.bnbPriceUSD > 0)
        newPrice = STATE.bnbPriceUSD / (tokAmt / bnbAmt);
    }
    const L = CONFIG.LIMITS;
    if (!newPrice || newPrice < L.TOKEN_PRICE_MIN || newPrice > L.TOKEN_PRICE_MAX) {
      UI.notif('err', 'Invalid Price', `Token price must be between ${L.TOKEN_PRICE_MIN} and ${L.TOKEN_PRICE_MAX} USD`);
      return;
    }
    try {
      const priceWei = ethers.parseUnits(newPrice.toFixed(8), 18);
      const cw       = await CHAIN.getWriteContract();
      UI.notif('info', 'Applying price…', 'Confirm in your wallet');
      const tx = await cw.setUSDTzPrice(priceWei);
      await tx.wait();
      STATE.usdtzPriceUSD = newPrice;
      PRICE.recalcRate();
      SWAP.updateBtn();
      UI.notif('ok', 'Price Updated', `1 ${STATE.tokenSymbol} = $${newPrice.toFixed(8)}`);
    } catch (e) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED')
        UI.notif('err', 'Rejected', 'Transaction rejected by user');
      else
        UI.notif('err', 'Price update failed', e?.reason || e?.shortMessage || e?.message || '');
    }
  },

  validateCtInput(el) {
    const val   = el.value.trim();
    const msgEl = document.getElementById('contractValidMsg');
    if (!msgEl) return;
    if (!val) { msgEl.textContent = ''; return; }
    msgEl.innerHTML = GUARDS.isValidAddr(val)
      ? '<span style="color:var(--ok);font-size:.70rem">✓ Valid BSC address</span>'
      : '<span style="color:var(--er);font-size:.70rem">✗ Invalid address format</span>';
  },

  liveBrand() {
    const name = document.getElementById('brandName')?.value || 'MiSwap';
    const ln = document.getElementById('logoName');         if (ln) ln.textContent = name;
    const fn = document.getElementById('footPlatformName'); if (fn) fn.textContent = name;
  },

  applyBranding() {
    const contractInput = document.getElementById('brandContract')?.value.trim();
    const nameInput     = document.getElementById('brandName')?.value.trim()  || 'MiSwap';
    const tokenInput    = document.getElementById('brandToken')?.value.trim() || 'USDT.z';

    if (contractInput && contractInput !== STATE.contractAddress) {
      if (!GUARDS.isValidAddr(contractInput)) {
        UI.notif('err', 'Invalid Contract', 'Address must be 0x + 40 hex chars');
        return;
      }
      STATE.contractAddress = contractInput;
      CHAIN.reset();
      CHAIN.invalidatePublicProvider();
    }

    STATE.platformName = nameInput;
    STATE.tokenSymbol  = tokenInput;

    const se = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    se('logoName', nameInput);
    se('footPlatformName', nameInput);
    se('tokenSymbolBadge', tokenInput);
    se('secTokenSym', tokenInput);
    se('depositUnit', tokenInput);
    se('ratioUsdtUnit', tokenInput);
    se('depositBalLabel', tokenInput);

    UI.notif('ok', 'Branding Applied', `Platform: ${nameInput} | Token: ${tokenInput}`);
    PRICE.recalcRate();
    SWAP.updateBtn();
    UI.renderLiqBar();
    UI.renderTxHist();
    STATS.load().catch(() => {});
  },

  updateStats() {
    const se = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    se('aPoolBal',      STATE.poolBalance.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + STATE.tokenSymbol);
    se('aBnbColl',      STATE.bnbCollected.toFixed(4) + ' BNB');
    se('aTxCount',      STATE.txCount.toString());
    se('aTokSold',      STATE.tokensSold.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + STATE.tokenSymbol);
    se('aContractAddr', STATE.contractAddress);
    se('wdAmtDisp',     STATE.poolBalance.toFixed(2) + ' ' + STATE.tokenSymbol + ' available');
    se('adminBnbPrice', STATE.bnbPriceUSD ? STATE.bnbPriceUSD.toFixed(2) : '—');
  },

  /*
   * FIX BUG 4 & 5: updateAnalytics() con null-checks completos.
   * Los elementos kpiPool, kpiBnb, chartTxHist, etc. solo existen en
   * admin.html (panel completo), no en index.html (panel drawer).
   * Todos los getElementById son null-safe ahora.
   */
  updateAnalytics() {
    const fmt = (n, dec = 2) =>
      Number.isFinite(n) && n > 0 ? n.toLocaleString('en-US', { maximumFractionDigits: dec }) : '0';
    const el = id => document.getElementById(id);

    // KPIs — solo existen en admin.html, null-safe en index.html
    if (el('kpiPool'))       el('kpiPool').textContent       = fmt(STATE.poolBalance) + ' ' + STATE.tokenSymbol;
    if (el('kpiBnb'))        el('kpiBnb').textContent        = fmt(STATE.bnbCollected, 4) + ' BNB';
    if (el('kpiSold'))       el('kpiSold').textContent       = fmt(STATE.tokensSold)  + ' ' + STATE.tokenSymbol;
    if (el('kpiTx'))         el('kpiTx').textContent         = fmt(STATE.txCount, 0);
    if (el('analyticsTime')) el('analyticsTime').textContent = new Date().toLocaleTimeString();

    const soldUsd = STATE.tokensSold * STATE.usdtzPriceUSD;
    if (el('kpiSoldUsd')) el('kpiSoldUsd').textContent = soldUsd > 0 ? `≈ $${fmt(soldUsd)} USD` : '—';

    const pct = STATE.poolMax > 0 ? Math.min(100, (STATE.poolBalance / STATE.poolMax) * 100) : 0;
    if (el('kpiPoolPct')) el('kpiPoolPct').textContent = pct.toFixed(1) + '% de capacidad';
    if (el('kpiPoolBar')) el('kpiPoolBar').style.width = pct.toFixed(1) + '%';
    if (el('wdAmtDisp'))  el('wdAmtDisp').textContent  = fmt(STATE.poolBalance) + ' ' + STATE.tokenSymbol + ' disponibles';

    // Recent txs list — solo en admin.html
    const txList = el('dashTxList');
    if (txList) {
      txList.innerHTML = !STATE.txHistory.length
        ? '<div class="dash-tx-empty">Sin transacciones aún</div>'
        : STATE.txHistory.slice(0, 6).map(tx => `
          <div class="dash-tx-item">
            <span class="dash-tx-tok">+${(tx.token||0).toFixed(2)} ${GUARDS.esc(STATE.tokenSymbol)}</span>
            <span class="dash-tx-bnb">-${(tx.bnb||0).toFixed(4)} BNB</span>
            <span class="dash-tx-time">${GUARDS.esc(tx.time||'')}</span>
          </div>`).join('');
    }

    // Charts — FIX BUG 5: Chart.js no está cargado en index.html
    // Solo renderizar si typeof Chart !== 'undefined' (admin.html lo tiene)
    if (typeof Chart === 'undefined') return;

    const acColor   = '#2de89a';
    const blueColor = '#4f8dff';
    const gridColor = 'rgba(255,255,255,0.05)';
    const textColor = 'rgba(255,255,255,0.4)';

    const txCanvas = el('chartTxHist');
    if (txCanvas) {
      if (txCanvas._chartInstance) txCanvas._chartInstance.destroy();
      const txData = [...STATE.txHistory].reverse();
      txCanvas._chartInstance = new Chart(txCanvas, {
        type: 'bar',
        data: {
          labels: txData.map((t, i) => t.time || `#${i+1}`),
          datasets: [{ label: STATE.tokenSymbol, data: txData.map(t => t.token || 0),
            backgroundColor: acColor + '55', borderColor: acColor, borderWidth: 1.5,
            borderRadius: 5, hoverBackgroundColor: acColor + 'AA' }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false },
            tooltip: { backgroundColor: '#1a1d26', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1,
              callbacks: { label: ctx => `${ctx.parsed.y.toFixed(2)} ${STATE.tokenSymbol}` } } },
          scales: {
            x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
            y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
          },
        },
      });
    }

    const poolCanvas = el('chartPool');
    if (poolCanvas) {
      if (poolCanvas._chartInstance) poolCanvas._chartInstance.destroy();
      poolCanvas._chartInstance = new Chart(poolCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Disponible', 'Vendido'],
          datasets: [{ data: [Math.max(0.001, STATE.poolBalance), Math.max(0.001, STATE.tokensSold)],
            backgroundColor: [acColor + 'BB', blueColor + 'BB'],
            borderColor: ['#13161e','#13161e'], borderWidth: 3, hoverOffset: 6 }],
        },
        options: {
          responsive: true, cutout: '68%',
          plugins: { legend: { display: false },
            tooltip: { backgroundColor: '#1a1d26', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1,
              callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${STATE.tokenSymbol}` } } },
        },
      });
    }
  },

  // ── Info modales ───────────────────────────────────────────────────────────
  _infoContent: {
    price: {
      en: { title: '💱 Price Configuration', body: `<ul><li><strong>Direct mode:</strong> Set the price of 1 {sym} in USD.</li><li><strong>Ratio mode:</strong> Specify BNB in → {sym} out.</li><li>Formula: <code>Rate = BNB Price ÷ Token Price</code></li></ul>` },
      es: { title: '💱 Configuración de Precio', body: `<ul><li><strong>Modo directo:</strong> Define el precio de 1 {sym} en USD.</li><li><strong>Modo ratio:</strong> BNB entregado → {sym} recibido.</li><li>Fórmula: <code>Tasa = Precio BNB ÷ Precio Token</code></li></ul>` },
    },
    pool: {
      en: { title: '💧 Pool Management', body: `<ul><li><strong>Deposit:</strong> Calls <code>approve()</code> then <code>depositTokens()</code>. Two confirmations.</li><li><strong>Withdraw:</strong> Returns all unsold tokens. Owner only.</li></ul>` },
      es: { title: '💧 Gestión del Pool', body: `<ul><li><strong>Depositar:</strong> <code>approve()</code> luego <code>depositTokens()</code>. Dos confirmaciones.</li><li><strong>Retirar:</strong> Devuelve todos los tokens no vendidos. Solo el owner.</li></ul>` },
    },
    branding: {
      en: { title: '⚙ Contract & Branding', body: `<ul><li><strong>Contract:</strong> Changing reinitializes all connections.</li><li><strong>Platform name & Token symbol:</strong> Visual only.</li></ul>` },
      es: { title: '⚙ Contrato y Marca', body: `<ul><li><strong>Contrato:</strong> Cambiarla reinicia todas las conexiones.</li><li><strong>Nombre y símbolo:</strong> Solo visual.</li></ul>` },
    },
  },

  showInfo(key) {
    const lang = this._infoContent[key]?.[STATE.lang] ? STATE.lang : 'en';
    const c = this._infoContent[key]?.[lang];
    if (!c) return;
    const title = document.getElementById('infoModalTitle');
    const body  = document.getElementById('infoModalBody');
    if (title) title.textContent = c.title;
    if (body)  body.innerHTML   = c.body.replace(/\{sym\}/g, GUARDS.esc(STATE.tokenSymbol));
    document.getElementById('infoModalOverlay').classList.add('open');
  },

  closeInfoModal(e) {
    if (!e || e.target === e.currentTarget)
      document.getElementById('infoModalOverlay').classList.remove('open');
  },

  showAdminTrigger(show) {
    const btn = document.getElementById('admTrigger');
    if (!btn) return;
    btn.style.display = show ? '' : 'none';
  },

  setupAdminTrigger() {
    const footer  = document.querySelector('footer');
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
