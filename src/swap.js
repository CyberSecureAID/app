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

  setSlip(v, btn) {
    const safe = GUARDS.clamp(v, CONFIG.LIMITS.SLIPPAGE_MIN, CONFIG.LIMITS.SLIPPAGE_MAX);
    STATE.slippage = safe;
    const sd = document.getElementById('slipDisp'); if (sd) sd.textContent = safe + '%';
    const si = document.getElementById('slipInfo'); if (si) si.textContent = safe + '%';
    document.querySelectorAll('.sopt').forEach(b => b.classList.remove('on'));
    if (btn) btn.classList.add('on');
    this.onBnbIn(document.getElementById('bnbAmt')?.value);
  },

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

  setMax() {
    const inp = document.getElementById('bnbAmt');
    if (STATE.bnbBalance <= 0) return;
    const L = CONFIG.LIMITS;
    const safe = Math.max(0, STATE.bnbBalance - L.GAS_RESERVE_BNB);
    if (safe <= 0) { UI.notif('err', 'Insufficient BNB', `Balance is too low to cover ${L.GAS_RESERVE_BNB} BNB gas reserve`); return; }
    inp.value = Math.min(safe, L.BNB_MAX_PER_TX).toFixed(4);
    this.onBnbIn(inp.value);
  },

  onBnbIn(val) {
    const u  = document.getElementById('usdtzAmt');
    const mr = document.getElementById('minReceived');
    const bu = document.getElementById('bnbUsd');
    const uu = document.getElementById('usdtzUsd');
    const v  = GUARDS.safePositive(val);

    if (!v) {
      if (u)  u.value = ''; if (mr) mr.textContent = '—';
      if (bu) { bu.textContent = ''; bu.style.color = ''; }
      this.updateBtn(); return;
    }
    if (v > CONFIG.LIMITS.BNB_MAX_PER_TX) {
      UI.notif('err', 'Amount too large', `Maximum ${CONFIG.LIMITS.BNB_MAX_PER_TX} BNB per transaction`);
      document.getElementById('bnbAmt').value = CONFIG.LIMITS.BNB_MAX_PER_TX;
      this.onBnbIn(CONFIG.LIMITS.BNB_MAX_PER_TX); return;
    }
    if (STATE.currentRate <= 0 || !Number.isFinite(STATE.currentRate)) {
      if (u) u.value = ''; if (mr) mr.textContent = '—';
      this.updateBtn(); return;
    }
    if (STATE.bnbBalance > 0 && v > (STATE.bnbBalance - CONFIG.LIMITS.GAS_RESERVE_BNB)) {
      if (u) u.value = ''; if (mr) mr.textContent = '—';
      if (bu) { bu.textContent = '⚠ Exceeds wallet balance'; bu.style.color = 'var(--er)'; }
      if (uu) uu.textContent = '';
      this.updateBtn(); return;
    }
    const marketOut = v * STATE.currentRate;
    if (!Number.isFinite(marketOut) || marketOut <= 0) { if (u) u.value = ''; this.updateBtn(); return; }
    if (u) u.value = marketOut.toFixed(6);
    if (bu) { bu.style.color = ''; if (STATE.bnbPriceUSD) bu.textContent = `≈ $${(v * STATE.bnbPriceUSD).toFixed(2)} USD`; }
    if (uu && STATE.bnbPriceUSD) uu.textContent = `≈ $${(marketOut * STATE.usdtzPriceUSD).toFixed(2)} USD`;
    if (mr) { const minOut = marketOut * (1 - STATE.slippage / 100); mr.textContent = minOut > 0 ? `${minOut.toFixed(4)} ${STATE.tokenSymbol}` : '—'; }
    this.updateBtn();
  },

  updateBtn() {
    const btn = document.getElementById('swapBtn');
    if (!btn) return;
    const span = btn.firstElementChild || btn;
    const v = GUARDS.safePositive(document.getElementById('bnbAmt')?.value);
    const marketOut = (v && STATE.currentRate > 0) ? v * STATE.currentRate : 0;
    if (!STATE.walletConnected) { btn.disabled = true; span.textContent = t('connect_to_swap'); }
    else if (STATE.currentRate <= 0) { btn.disabled = true; span.textContent = t('fetching') || 'Loading price…'; }
    else if (!v || v <= 0) { btn.disabled = true; span.textContent = t('enter_amount'); }
    else if (STATE.bnbBalance > 0 && v > (STATE.bnbBalance - CONFIG.LIMITS.GAS_RESERVE_BNB)) { btn.disabled = true; span.textContent = t('insufficient_bnb') || 'Insufficient BNB balance'; }
    else if (marketOut > STATE.poolBalance) { btn.disabled = true; span.textContent = t('insufficient_liquidity'); }
    else { const prefix = STATE.lang === 'es' ? 'Intercambiar BNB →' : 'Swap BNB →'; btn.disabled = false; span.textContent = `${prefix} ${STATE.tokenSymbol}`; }
  },

  init() {
    const v = GUARDS.safePositive(document.getElementById('bnbAmt')?.value);
    if (!v || v <= 0) return;
    if (STATE.bnbBalance > 0 && v > (STATE.bnbBalance - CONFIG.LIMITS.GAS_RESERVE_BNB)) { UI.notif('err', 'Insufficient BNB', 'Your wallet does not have enough BNB for this amount'); return; }
    const marketOut = v * STATE.currentRate;
    if (marketOut > STATE.poolBalance) { UI.notif('err', 'Insufficient Liquidity', 'Not enough tokens in pool'); return; }
    const sym = STATE.tokenSymbol;
    const el = id => document.getElementById(id);
    if (el('cfmBnb'))   el('cfmBnb').textContent   = `${v.toFixed(4)} BNB`;
    if (el('cfmUsdt'))  el('cfmUsdt').textContent  = `${marketOut.toFixed(4)} ${sym}`;
    if (el('cfmRate'))  el('cfmRate').textContent  = `1 BNB = ${UI.fmtRate(STATE.currentRate)} ${sym}`;
    if (el('cfmMkt'))   el('cfmMkt').textContent   = STATE.bnbPriceUSD ? `$${STATE.bnbPriceUSD.toFixed(2)}` : '—';
    if (el('cfmUsdtz')) el('cfmUsdtz').textContent = `$${STATE.usdtzPriceUSD.toFixed(8)}`;
    if (el('cfmTokenSym')) el('cfmTokenSym').textContent = sym;
    document.getElementById('swapOverlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('swapOverlay').classList.remove('open');
    document.getElementById('swapLoading').style.display = 'none';
    const cfmBtn = document.getElementById('cfmBtn'); if (cfmBtn) cfmBtn.disabled = false;
    const bnbVal = GUARDS.safePositive(document.getElementById('bnbAmt')?.value);
    if (bnbVal && STATE.currentRate > 0) { const ua = document.getElementById('usdtzAmt'); if (ua) ua.value = (bnbVal * STATE.currentRate).toFixed(6); }
    this.updateBtn();
  },

  async execute() {
    if (this._inProgress) { UI.notif('err', 'In Progress', 'A swap is already in progress'); return; }
    const now = Date.now();
    if (now - this._lastSwapTime < 3000) { UI.notif('err', 'Too Fast', 'Wait a moment before swapping again'); return; }

    const bnbVal = GUARDS.safePositive(document.getElementById('bnbAmt')?.value);
    const L      = CONFIG.LIMITS;

    if (!bnbVal) { UI.notif('err', 'Invalid Amount', 'Enter a valid BNB amount'); return; }
    if (bnbVal > L.BNB_MAX_PER_TX) { UI.notif('err', 'Amount too large', `Maximum ${L.BNB_MAX_PER_TX} BNB per transaction`); return; }
    if (STATE.walletConnected && STATE.bnbBalance > 0 && bnbVal > (STATE.bnbBalance - L.GAS_RESERVE_BNB)) { UI.notif('err', 'Insufficient BNB', `Max available: ${(STATE.bnbBalance - L.GAS_RESERVE_BNB).toFixed(4)} BNB`); return; }
    if (!Number.isFinite(STATE.bnbPriceUSD) || STATE.bnbPriceUSD < L.BNB_PRICE_MIN || STATE.bnbPriceUSD > L.BNB_PRICE_MAX) { UI.notif('err', 'Price unavailable', 'BNB price not in valid range. Refreshing…'); await PRICE.refresh(); return; }
    if (!Number.isFinite(STATE.currentRate) || STATE.currentRate <= 0) { UI.notif('err', 'Rate unavailable', 'Swap rate not ready'); return; }
    const marketOut = bnbVal * STATE.currentRate;
    if (!Number.isFinite(marketOut) || marketOut <= 0) return;
    if (marketOut > STATE.poolBalance) { UI.notif('err', 'Insufficient Liquidity', 'Pool balance changed. Refreshing…'); await STATS.load().catch(() => {}); SWAP.updateBtn(); return; }

    /*
     * FIX BUG 1: Verificación de wallet compatible con WalletConnect/OKX/Coinbase.
     * La versión anterior usaba `window.ethereum` directamente, bloqueando
     * completamente a usuarios de WalletConnect, Coinbase y OKX Wallet.
     */
    const activeProv = WALLET._activeProvider || window.ethereum;
    if (!activeProv || !STATE.walletAddress) { UI.notif('err', 'No Wallet', 'Connect your wallet to swap'); return; }

    this._inProgress = true;

    try {
      const cfmBtn = document.getElementById('cfmBtn'); if (cfmBtn) cfmBtn.disabled = true;
      const swapLoading = document.getElementById('swapLoading'); if (swapLoading) swapLoading.style.display = 'block';

      const safeBnbPrice   = GUARDS.clamp(STATE.bnbPriceUSD, L.BNB_PRICE_MIN, L.BNB_PRICE_MAX);
      const bnbPriceWei    = ethers.parseUnits(safeBnbPrice.toFixed(8), 18);
      const safeSlippage   = GUARDS.clamp(STATE.slippage, L.SLIPPAGE_MIN, L.SLIPPAGE_MAX);
      const estimatedWei   = ethers.parseUnits(marketOut.toFixed(6), 18);
      const slippageFactor = BigInt(Math.floor((1 - safeSlippage / 100) * 10_000));
      const minUsdtzOut    = (estimatedWei * slippageFactor) / 10_000n;
      if (minUsdtzOut <= 0n) throw new Error('Invalid minUsdtzOut: would be zero');

      const bnbStr   = bnbVal.toPrecision(15).replace(/\.?0+$/, '');
      const valueWei = ethers.parseEther(bnbStr);

      let priceValid = false;
      try { const [valid] = await CHAIN.getReadContract().isBnbPriceValid(bnbPriceWei); priceValid = valid; } catch (_) { throw new Error('price_check_failed'); }
      if (!priceValid) { UI.notif('err', 'Price Out of Range', 'BNB price moved too fast. Refreshing…'); await PRICE.refresh(); throw new Error('price_invalid'); }

      this._lastSwapTime = Date.now();
      const cw = await CHAIN.getWriteContract();
      UI.notif('info', t('tx_pending'), t('tx_pending_msg'));
      const tx = await cw.swap(bnbPriceWei, minUsdtzOut, { value: valueWei });
      const receipt = await tx.wait();
      this._finishSwap(bnbVal, marketOut, receipt.hash);

    } catch (e) {
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
      this._inProgress = false;
      const sl = document.getElementById('swapLoading'); if (sl) sl.style.display = 'none';
      const cb = document.getElementById('cfmBtn'); if (cb) cb.disabled = false;
    }
  },

  _finishSwap(bnbVal, out, hash) {
    const safeBnb  = GUARDS.safePositive(bnbVal);
    const safeOut  = GUARDS.safePositive(out);
    const safeHash = GUARDS.isValidHash(hash) ? hash : '';

    if (safeOut > 0) STATE.poolBalance  = Math.max(0, STATE.poolBalance - safeOut);
    if (safeBnb > 0) STATE.bnbCollected += safeBnb;
    STATE.txCount += 1;
    if (safeOut > 0) STATE.tokensSold   += safeOut;

    STATE.txHistory.unshift({ bnb: safeBnb, token: safeOut, hash: safeHash, time: new Date().toLocaleTimeString() });
    if (STATE.txHistory.length > 10) STATE.txHistory.pop();
    try { localStorage.setItem('miswap_tx_history', JSON.stringify(STATE.txHistory)); } catch (_) {}

    const el = id => document.getElementById(id);
    if (el('bnbAmt'))   el('bnbAmt').value       = '';
    if (el('usdtzAmt')) el('usdtzAmt').value      = '';
    if (el('bnbUsd'))   el('bnbUsd').textContent  = '';
    if (el('usdtzUsd')) el('usdtzUsd').textContent = '';

    this.closeModal();
    this.updateBtn();
    UI.renderLiqBar();
    UI.renderTxHist();
    ADMIN.updateStats();
    UI.notif('ok', t('tx_success'), `${out.toFixed(2)} ${STATE.tokenSymbol} — ${t('tx_success_msg')}`, safeHash);

    const addTokBtn = document.getElementById('addTokBtn');
    if (addTokBtn) addTokBtn.style.display = 'block';

    // Pass 1: restar localmente
    if (STATE.bnbBalance >= safeBnb) STATE.bnbBalance -= safeBnb;
    if (el('walBal'))    el('walBal').textContent    = `${STATE.bnbBalance.toFixed(4)} BNB`;
    if (el('bnbBalDisp')) el('bnbBalDisp').textContent = STATE.bnbBalance.toFixed(4);

    /*
     * FIX BUG 2: Balance real desde chain usando el proveedor activo.
     * La versión anterior usaba window.ethereum directamente — no actualizaba
     * el balance para WalletConnect, Coinbase ni OKX después del swap.
     */
    const activeProv = WALLET._activeProvider || window.ethereum;
    if (STATE.walletAddress && activeProv) {
      activeProv.request({ method: 'eth_getBalance', params: [STATE.walletAddress, 'latest'] })
        .then(h => {
          STATE.bnbBalance = Number(ethers.formatEther(BigInt(h)));
          if (el('walBal'))    el('walBal').textContent    = `${STATE.bnbBalance.toFixed(4)} BNB`;
          if (el('bnbBalDisp')) el('bnbBalDisp').textContent = STATE.bnbBalance.toFixed(4);
          this.updateBtn();
        }).catch(() => {});
    }
  },
};
