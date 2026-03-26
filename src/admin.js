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
    if (ob) ob.classList.add('show');
    const oa = document.getElementById('ownAddr');
    if (oa) oa.textContent = UI.abbr(STATE.walletAddress);

    STATS.load().catch(() => {});
    if (window.ethereum || WALLET._activeProvider) this._loadAdminTokenBalance().catch(() => {});
    this.updateStats();
    this.updatePriceCalc();
    this.loadCostsIntoForm();
  },

  _switchView(view) {
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

  updateAnalytics() {
    const fmt = (n, dec = 2) =>
      Number.isFinite(n) && n > 0 ? n.toLocaleString('en-US', { maximumFractionDigits: dec }) : '0';
    const el = id => document.getElementById(id);

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
          plugins: { legend: { display: false } },
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
          plugins: { legend: { display: false } },
        },
      });
    }
  },

  // ── Info modales — FIX #1: Contenido rico con "Qué es" y "Cómo usar" ─────
  _infoContent: {
    price: {
      en: {
        title: '💱 Price Configuration',
        what: 'This section lets you control the token price visible to users. The price you set determines how many tokens users receive per BNB they send.',
        how: [
          '1. Direct mode: Enter the price of 1 token in USD (e.g. $0.0112).',
          '2. Ratio mode: Enter BNB amount → Token amount (e.g. 100 BNB → 10 tokens).',
          '3. Review the live swap rate shown in the preview panel.',
          '4. Click "Apply Price" — confirm in your wallet.',
          '5. The new rate takes effect immediately onchain.',
        ],
      },
      es: {
        title: '💱 Configuración de Precio',
        what: 'Esta sección te permite controlar el precio del token visible para los usuarios. El precio que establezcas determina cuántos tokens recibirán por cada BNB que envíen.',
        how: [
          '1. Modo directo: Ingresa el precio de 1 token en USD (ej: $0.0112).',
          '2. Modo ratio: Ingresa monto BNB → monto Token (ej: 100 BNB → 10 tokens).',
          '3. Revisa la tasa de swap live en el panel de preview.',
          '4. Haz click en "Aplicar Precio" — confirma en tu wallet.',
          '5. La nueva tasa entra en efecto inmediatamente onchain.',
        ],
      },
    },
    pool: {
      en: {
        title: '💧 Pool Management',
        what: 'The pool is the reservoir of tokens available for users to buy. Depositing tokens makes them purchasable. Withdrawing recovers unsold tokens to your wallet.',
        how: [
          '1. To deposit: Enter the amount of tokens you want to add.',
          '2. Click "+ Deposit" — two wallet confirmations: approve + deposit.',
          '3. To withdraw: Click "Withdraw All to My Wallet".',
          '4. The withdrawal is subject to the daily limit set in Configuration.',
          '5. Monitor the pool level in the Overview section.',
        ],
      },
      es: {
        title: '💧 Gestión del Pool',
        what: 'El pool es el reservorio de tokens disponibles para que los usuarios compren. Depositar tokens los hace comprables. Retirar recupera los tokens no vendidos a tu wallet.',
        how: [
          '1. Para depositar: Ingresa la cantidad de tokens que quieres agregar.',
          '2. Haz click en "+ Depositar" — dos confirmaciones: approve + deposit.',
          '3. Para retirar: Haz click en "Retirar Todo a Mi Wallet".',
          '4. El retiro está sujeto al límite diario en Configuración.',
          '5. Monitorea el nivel del pool en la sección Resumen.',
        ],
      },
    },
    branding: {
      en: {
        title: '⚙ Contract & Branding',
        what: 'Configure the smart contract address and visual branding of your platform. The contract address points to where all swap logic runs onchain.',
        how: [
          '1. Contract: Paste the BSC address of your deployed contract.',
          '2. Platform name: Shown in the header and footer (visual only).',
          '3. Token symbol: Shown throughout the UI (visual only).',
          '4. Click "Apply Branding" to apply changes immediately.',
          '5. Changing the contract reinitializes all blockchain connections.',
        ],
      },
      es: {
        title: '⚙ Contrato y Marca',
        what: 'Configura la dirección del smart contract y el branding visual de tu plataforma. La dirección del contrato apunta donde corre toda la lógica de swap onchain.',
        how: [
          '1. Contrato: Pega la dirección BSC de tu contrato deployado.',
          '2. Nombre de plataforma: Se muestra en header y footer (solo visual).',
          '3. Símbolo del token: Se muestra en toda la UI (solo visual).',
          '4. Haz click en "Aplicar Marca" para aplicar cambios inmediatamente.',
          '5. Cambiar el contrato reinicia todas las conexiones blockchain.',
        ],
      },
    },
    swap: {
      en: {
        title: '🔄 Swap',
        what: 'The Swap section lets users exchange BNB for your platform token at the current rate set by administrators.',
        how: [
          '1. Enter the BNB amount you want to swap.',
          '2. The estimated token output updates live.',
          '3. Adjust slippage tolerance (default 0.1%) if needed.',
          '4. Click "Swap BNB → Token" to open the confirmation modal.',
          '5. Review the details and confirm in your wallet.',
        ],
      },
      es: {
        title: '🔄 Swap',
        what: 'La sección Swap permite a los usuarios intercambiar BNB por el token de tu plataforma a la tasa actual establecida por los administradores.',
        how: [
          '1. Ingresa la cantidad de BNB que quieres intercambiar.',
          '2. La estimación de tokens se actualiza en tiempo real.',
          '3. Ajusta la tolerancia de slippage (por defecto 0.1%) si es necesario.',
          '4. Haz click en "Swap BNB → Token" para abrir el modal de confirmación.',
          '5. Revisa los detalles y confirma en tu wallet.',
        ],
      },
    },
    'create-token': {
      en: {
        title: '🪙 Create BEP-20 Token',
        what: 'Deploy your own custom token on BNB Smart Chain in seconds. The token is fully owned by you and can be used, traded, or listed anywhere.',
        how: [
          '1. Enter the token name (e.g. "My Token").',
          '2. Enter the symbol (2–8 letters, e.g. "MTK").',
          '3. Set the total supply (max 1 trillion).',
          '4. Optionally enable USDT bridge and upload an icon.',
          '5. Pay the creation fee and confirm in your wallet.',
        ],
      },
      es: {
        title: '🪙 Crear Token BEP-20',
        what: 'Despliega tu propio token personalizado en BNB Smart Chain en segundos. El token es tuyo completamente y puede ser usado, comercializado o listado en cualquier lugar.',
        how: [
          '1. Ingresa el nombre del token (ej: "Mi Token").',
          '2. Ingresa el símbolo (2–8 letras, ej: "MTK").',
          '3. Establece el supply total (máx 1 billón).',
          '4. Opcionalmente habilita el bridge a USDT y sube un ícono.',
          '5. Paga el fee de creación y confirma en tu wallet.',
        ],
      },
    },
    'flash-token': {
      en: {
        title: '⚡ Flash Tokens',
        what: 'Flash tokens are temporary tokens that automatically expire after a set time or number of transfers. Perfect for promotions, limited airdrops, or controlled-supply events.',
        how: [
          '1. Choose expiration mode: Time-limited or Transaction-limited.',
          '2. Fill in name, symbol, and total supply.',
          '3. Set the duration (days) or transfer limit.',
          '4. Pay 0.2 BNB creation fee and confirm.',
          '5. The token deploys instantly and expires automatically.',
        ],
      },
      es: {
        title: '⚡ Flash Tokens',
        what: 'Los Flash Tokens son tokens temporales que expiran automáticamente tras un tiempo o número de transferencias. Perfectos para promociones, airdrops limitados o eventos de supply controlado.',
        how: [
          '1. Elige el modo de expiración: por Tiempo o por Transacciones.',
          '2. Completa nombre, símbolo y supply total.',
          '3. Establece la duración (días) o el límite de transferencias.',
          '4. Paga 0.2 BNB de fee y confirma.',
          '5. El token se despliega al instante y expira automáticamente.',
        ],
      },
    },
    'bridge-usdt': {
      en: {
        title: '🌉 Bridge to USDT',
        what: 'Convert any of your tokens into USDT using PancakeSwap routing. A small fee is charged on the output amount.',
        how: [
          '1. Select the token you want to convert.',
          '2. Use the slider or enter the amount manually.',
          '3. Choose your slippage tolerance.',
          '4. Review the estimated USDT output and fee.',
          '5. Click "Bridge to USDT" — two wallet steps: approve + swap.',
        ],
      },
      es: {
        title: '🌉 Bridge a USDT',
        what: 'Convierte cualquiera de tus tokens a USDT usando el enrutamiento de PancakeSwap. Se cobra una pequeña tarifa sobre el monto de salida.',
        how: [
          '1. Selecciona el token que quieres convertir.',
          '2. Usa el slider o ingresa el monto manualmente.',
          '3. Elige tu tolerancia de slippage.',
          '4. Revisa la estimación de USDT y la tarifa.',
          '5. Haz click en "Bridge a USDT" — dos pasos: approve + swap.',
        ],
      },
    },
    'create-pool': {
      en: {
        title: '💧 Create Liquidity Pool',
        what: 'Add a token/BNB liquidity pair on PancakeSwap v2. This enables decentralized trading of your token. LP tokens representing your share are sent to your wallet.',
        how: [
          '1. Enter the token contract address.',
          '2. Enter how many tokens to add as liquidity.',
          '3. Enter how much BNB to pair with those tokens.',
          '4. Pay the pool creation fee and confirm.',
          '5. LP tokens will appear in your wallet after confirmation.',
        ],
      },
      es: {
        title: '💧 Crear Pool de Liquidez',
        what: 'Agrega un par token/BNB de liquidez en PancakeSwap v2. Esto permite el trading descentralizado de tu token. Los LP tokens que representan tu participación se envían a tu wallet.',
        how: [
          '1. Ingresa la dirección del contrato del token.',
          '2. Ingresa cuántos tokens agregar como liquidez.',
          '3. Ingresa cuánto BNB emparejar con esos tokens.',
          '4. Paga el fee de creación del pool y confirma.',
          '5. Los LP tokens aparecerán en tu wallet tras la confirmación.',
        ],
      },
    },
    'my-tokens': {
      en: {
        title: '👜 My Tokens',
        what: 'View all BEP-20 tokens you have created using this platform. Each token is permanently recorded onchain and linked to your wallet address.',
        how: [
          '1. Connect your wallet to load your tokens.',
          '2. Each card shows name, symbol, supply, and your balance.',
          '3. Click "Bridge" to convert that token to USDT.',
          '4. Click "Pool" to add liquidity for that token on PancakeSwap.',
          '5. Click "Icon" to update the token\'s visual icon.',
        ],
      },
      es: {
        title: '👜 Mis Tokens',
        what: 'Visualiza todos los tokens BEP-20 que has creado usando esta plataforma. Cada token está registrado permanentemente onchain y vinculado a tu dirección de wallet.',
        how: [
          '1. Conecta tu wallet para cargar tus tokens.',
          '2. Cada tarjeta muestra nombre, símbolo, supply y tu balance.',
          '3. Haz click en "Bridge" para convertir ese token a USDT.',
          '4. Haz click en "Pool" para agregar liquidez en PancakeSwap.',
          '5. Haz click en "Ícono" para actualizar el ícono visual del token.',
        ],
      },
    },
  },

  showInfo(key) {
    const lang = this._infoContent[key]?.[STATE.lang] ? STATE.lang : 'en';
    const c = this._infoContent[key]?.[lang];
    if (!c) return;

    const overlay  = document.getElementById('infoModalOverlay');
    const titleEl  = document.getElementById('infoModalTitle');
    const bodyEl   = document.getElementById('infoModalBody');
    if (!overlay || !titleEl || !bodyEl) return;

    titleEl.textContent = c.title;

    // FIX #1: Rich content con dos secciones: Qué es + Cómo usar
    bodyEl.innerHTML = `
      <div style="margin-bottom:14px">
        <div style="font-size:.68rem;font-weight:800;color:var(--ac);text-transform:uppercase;letter-spacing:.10em;margin-bottom:7px">
          📌 What is this?
        </div>
        <div style="font-size:.82rem;color:var(--t2);line-height:1.65">${GUARDS.esc(c.what)}</div>
      </div>
      <div style="height:1px;background:var(--glass-brd);margin-bottom:14px"></div>
      <div>
        <div style="font-size:.68rem;font-weight:800;color:var(--ok);text-transform:uppercase;letter-spacing:.10em;margin-bottom:7px">
          🚀 How to use it
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${(c.how || []).map(step => `
            <div style="display:flex;align-items:flex-start;gap:8px;background:var(--glass);border-radius:var(--r-sm);padding:8px 11px;font-size:.80rem;color:var(--t2);line-height:1.55">
              ${GUARDS.esc(step)}
            </div>`).join('')}
        </div>
      </div>`;

    overlay.classList.add('open');
  },

  closeInfoModal(e) {
    if (!e || e.target === e.currentTarget)
      document.getElementById('infoModalOverlay').classList.remove('open');
  },

  // ── Footer modal helper (para botones del footer pre-FOOTER module) ────────
  showFooterModal(type) {
    if (typeof FOOTER !== 'undefined') {
      FOOTER.showModal(type);
    }
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

  // ── Costs & Taxes ──────────────────────────────────────────────────────────
  _costsStatus(msg, type) {
    const el = document.getElementById('adminCostsStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mi-status mi-status-' + (type || 'info');
    el.style.display = msg ? 'block' : 'none';
  },

  _taxesStatus(msg, type) {
    const el = document.getElementById('adminTaxesStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mi-status mi-status-' + (type || 'info');
    el.style.display = msg ? 'block' : 'none';
  },

  saveCosts() {
    const getVal = id => {
      const el = document.getElementById(id);
      return el ? (parseFloat(el.value) || 0) : 0;
    };
    STATE.tokenCreationFee = getVal('costTokenCreation') || parseFloat(CONFIG.TOKEN_CREATION_FEE_BNB);
    STATE.flashTokenFee    = getVal('costFlashToken')    || 0.2;
    STATE.imageUploadFee   = getVal('costImageUpload')   || 0.05;
    this._costsStatus('✅ ' + (STATE.lang === 'es' ? 'Costos guardados localmente.' : 'Costs saved locally.'), 'ok');
    setTimeout(() => this._costsStatus('', ''), 3000);
  },

  saveTaxes() {
    const getVal = id => {
      const el = document.getElementById(id);
      return el ? (parseFloat(el.value) || 0) : 0;
    };
    const wallet = (document.getElementById('taxReceiverWallet') || {}).value || '';
    if (wallet && !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      this._taxesStatus('⚠ ' + (STATE.lang === 'es' ? 'Dirección de wallet inválida.' : 'Invalid wallet address.'), 'warn');
      return;
    }
    STATE.taxConfig = {
      receiverWallet:  wallet,
      createToken:     getVal('taxCreateToken'),
      flashToken:      getVal('taxFlashToken'),
      swap:            getVal('taxSwap'),
      bridge:          getVal('taxBridge'),
      pool:            getVal('taxPool'),
      sell:            getVal('taxSell'),
      image:           getVal('taxImage'),
    };
    this._taxesStatus('✅ ' + (STATE.lang === 'es' ? 'Impuestos guardados localmente.' : 'Taxes saved locally.'), 'ok');
    setTimeout(() => this._taxesStatus('', ''), 3000);
  },

  loadCostsIntoForm() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('costTokenCreation', STATE.tokenCreationFee || CONFIG.TOKEN_CREATION_FEE_BNB);
    set('costFlashToken',    STATE.flashTokenFee    || '0.2');
    set('costImageUpload',   STATE.imageUploadFee   || '0.05');
    if (STATE.taxConfig) {
      set('taxReceiverWallet', STATE.taxConfig.receiverWallet || '');
      set('taxCreateToken',    STATE.taxConfig.createToken    || 0);
      set('taxFlashToken',     STATE.taxConfig.flashToken     || 0);
      set('taxSwap',           STATE.taxConfig.swap           || 0);
      set('taxBridge',         STATE.taxConfig.bridge         || 0);
      set('taxPool',           STATE.taxConfig.pool           || 0);
      set('taxSell',           STATE.taxConfig.sell           || 0);
      set('taxImage',          STATE.taxConfig.image          || 0);
    }
  },
};
