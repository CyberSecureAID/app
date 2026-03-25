'use strict';

function bindEvents() {
  const on  = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); };
  const onQ = (sel, ev, fn) => document.querySelectorAll(sel).forEach(e => e.addEventListener(ev, fn));

  on('langBtn', 'click', () => LANG.toggle());
  on('connectBtn', 'click', () => WALLET.openOverlay());

  on('tabSwap', 'click', () => {
    document.getElementById('tabSwap').classList.add('active');
    document.getElementById('tabSell').classList.remove('active');
    document.getElementById('panelSwap').style.display = 'block';
    const ps = document.getElementById('panelSell'); if (ps) ps.style.display = 'none';
  });
  on('tabSell', 'click', () => SELL.activateTab());

  on('slipToggle', 'click', () => SWAP.toggleSlip());
  on('sopt01', 'click', function() { SWAP.setSlip(0.1, this); });
  on('sopt05', 'click', function() { SWAP.setSlip(0.5, this); });
  on('sopt1',  'click', function() { SWAP.setSlip(1, this); });
  const scust = document.querySelector('.scust');
  if (scust) scust.addEventListener('input', function() { SWAP.setCustomSlip(this.value); });
  on('bnbAmt',        'input', function() { SWAP.onBnbIn(this.value); });
  const maxBtn = document.querySelector('#panelSwap .max-btn');
  if (maxBtn) maxBtn.addEventListener('click', () => SWAP.setMax());
  on('detailsToggle', 'click', () => SWAP.toggleDetails());
  on('swapBtn',  'click', () => SWAP.init());
  on('addTokBtn','click', () => WALLET.addToken());
  on('secBtn',   'click', () => TESTTOK.openOverlay());

  on('sellAmt', 'input', e => SELL.onSellAmt(e.target.value));
  on('sellMaxBtn', 'click', () => {
    const bal = STATE.sellTokenBalance ? Number(ethers.formatUnits(STATE.sellTokenBalance, 18)) : 0;
    if (!bal) return;
    const inp = document.getElementById('sellAmt');
    if (inp) { inp.value = bal.toFixed(6); SELL.onSellAmt(inp.value); }
  });
  on('sellBtn',      'click', () => SELL.initSell());
  on('cfmSellBtn',   'click', () => SELL.executeSell());
  on('sellOverlayX', 'click', () => { document.getElementById('sellOverlay').classList.remove('open'); });
  on('sellOverlay',  'click', e => { if (e.target.id === 'sellOverlay') document.getElementById('sellOverlay').classList.remove('open'); });

  on('admTrigger', 'click', () => ADMIN.open());

  on('walOverlay', 'click', function(e) { if (e.target === this) WALLET.closeOverlay(); });
  const walX = document.querySelector('#walOverlay .modal-x');
  if (walX) walX.addEventListener('click', () => WALLET.closeOverlay());
  on('walOptMetamask', 'click', () => WALLET.connect('metamask'));
  on('walOptTrust',    'click', () => WALLET.connect('trust'));
  on('walOptWC',       'click', () => WALLET.connect('walletconnect'));
  on('walOptCoinbase', 'click', () => WALLET.connect('coinbase'));
  on('walOptOKX',      'click', () => WALLET.connect('okx'));

  on('swapOverlay', 'click', function(e) { if (e.target === this) SWAP.closeModal(); });
  const swapX = document.querySelector('#swapOverlay .modal-x');
  if (swapX) swapX.addEventListener('click', () => SWAP.closeModal());
  on('cfmBtn', 'click', () => SWAP.execute());

  on('secOverlay', 'click', function(e) { if (e.target === this) TESTTOK.closeOverlay(); });
  const secX = document.querySelector('#secOverlay .modal-x');
  if (secX) secX.addEventListener('click', () => TESTTOK.closeOverlay());
  on('verifyBtn', 'click', () => TESTTOK.send());

  on('accessDeniedOverlay', 'click', function(e) { if (e.target === this) this.classList.remove('open'); });
  on('accessCloseBtn', 'click', () => { document.getElementById('accessDeniedOverlay').classList.remove('open'); });

  on('admOverlay', 'click', () => ADMIN.close());
  on('admX',       'click', () => ADMIN.close());

  onQ('.info-btn', 'click', btn => ADMIN.showInfo(btn.dataset.info));

  on('pcTabDirect', 'click', () => ADMIN.setPcMode('direct'));
  on('pcTabRatio',  'click', () => ADMIN.setPcMode('ratio'));
  on('directPrice', 'input', () => ADMIN.onDirectPriceInput());
  on('ratioBnb',    'input', () => ADMIN.onRatioInput());
  on('ratioUsdt',   'input', () => ADMIN.onRatioInput());

  on('adminApplyPriceBtn', 'click', () => ADMIN.applyPrice());
  on('adminWithdrawBtn',   'click', () => ADMIN.withdraw());
  on('adminBrandingBtn',   'click', () => ADMIN.applyBranding());

  on('depositMaxBtn', 'click', () => ADMIN.setDepositMax());
  on('depositAmt',    'input', () => ADMIN.validateDepositAmt());
  on('depositBtn',    'click', () => ADMIN.deposit());

  on('brandContract', 'input', function() { ADMIN.validateCtInput(this); });
  on('brandName',     'input', () => ADMIN.liveBrand());

  on('infoModalOverlay', 'click', e => ADMIN.closeInfoModal(e));
  on('infoModalX',       'click', () => ADMIN.closeInfoModal());

  // ── Nuevos módulos v8 ──────────────────────────────────────────────────────
  on('termsCloseBtn', 'click', () => { if (typeof TERMS !== 'undefined') TERMS.close(); });
  on('termsOverlay',  'click', function(e) { if (e.target === this && typeof TERMS !== 'undefined') TERMS.close(); });
  on('riskCloseBtn',  'click', () => { if (typeof RISK !== 'undefined') RISK.close(); });
  on('riskAcceptBtn', 'click', () => { if (typeof RISK !== 'undefined') RISK._accept(); });
  const riskChk = document.getElementById('riskCheckbox');
  if (riskChk) {
    const riskBtn = document.getElementById('riskAcceptBtn');
    riskChk.addEventListener('change', () => { if (riskBtn) riskBtn.disabled = !riskChk.checked; });
  }
}

/*
 * FIX SECURITY 6: Sanitizador de entradas del historial de transacciones.
 *
 * El localStorage puede ser manipulado por scripts maliciosos que corran
 * en la misma origin (XSS, extensiones del browser). Sin validación,
 * un atacante podría:
 *   - Inyectar HTML en renderTxHist() via tx.time (campo de texto libre)
 *   - Contaminar STATE con tipos incorrectos
 *   - Insertar strings que rompan los cálculos numéricos
 *
 * Solución: reconstruir cada entrada con tipos y rangos estrictos.
 * Entradas inválidas se descartan silenciosamente.
 */
function _sanitizeTxEntry(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const bnb = Number(obj.bnb);
  if (!Number.isFinite(bnb) || bnb < 0 || bnb > 1_000_000) return null;
  const token = Number(obj.token);
  if (!Number.isFinite(token) || token < 0 || token > 1e15) return null;
  const hash = typeof obj.hash === 'string' ? obj.hash : '';
  if (hash && !/^0x[0-9a-fA-F]{64}$/.test(hash)) return null;
  // time: solo dígitos, ':', am/pm y espacios — sin HTML posible
  const rawTime = typeof obj.time === 'string' ? obj.time : '';
  const time = rawTime.replace(/[^0-9:apmAPM\s]/g, '').slice(0, 20);
  return { bnb, token, hash, time };
}

const APP = {
  async init() {
    LANG.apply();
    ADMIN.setupAdminTrigger();
    WALLET.setupListeners();

    await PRICE.refresh().catch(() => {});
    setInterval(() => PRICE.refresh().catch(() => {}), 15_000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') PRICE.refresh().catch(() => {});
    });

    // FIX SECURITY 6: historial sanitizado antes de cargar en STATE
    try {
      const saved = localStorage.getItem('miswap_tx_history');
      if (saved) {
        const raw = JSON.parse(saved);
        if (Array.isArray(raw)) {
          STATE.txHistory = raw.slice(0, 10).map(_sanitizeTxEntry).filter(Boolean);
        }
      }
    } catch (_) {}

    UI.renderLiqBar();
    UI.renderTxHist();
    SWAP.updateBtn();
    SELL.updateBtn();

    let walletAutoDetected = false;
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length) {
          walletAutoDetected = true;
          await WALLET.setup(accounts[0], window.ethereum.isTrust ? 'trust' : 'metamask', true);
        }
      } catch (_) {}
    }

    if (!walletAutoDetected) {
      await STATS.load().catch(() => {});
      SELL.checkBuybackStatus().catch(() => {});
    }

    setInterval(() => STATS.load().catch(() => {}), 30_000);
    setInterval(() => WALLET.refreshBalance(), 15_000);
    setInterval(() => SELL.checkBuybackStatus().catch(() => {}), 60_000);

    setInterval(() => {
      if (STATE.walletConnected && WALLET.isAdmin()) {
        const panel = document.getElementById('admPanel');
        if (panel?.classList.contains('open')) ADMIN._loadAdminTokenBalance().catch(() => {});
      }
    }, 20_000);

    console.log('%c MiSwap v8.1 — BSC Mainnet | Audited v2', 'color:#2de89a;font-size:1.1rem;font-weight:bold');
    console.log('%c Fixes: WC swap+balance, stale RPC closure, sell visibility, localStorage sanitization, HSTS', 'color:#a066ff;font-size:.70rem');

    if (typeof FLASH_TOKEN    !== 'undefined') FLASH_TOKEN.init();
    // ── Initialize v8 modules ──────────────────────────────────────────────
    if (typeof MENU          !== 'undefined') MENU.init();
    if (typeof TOKEN_CREATOR !== 'undefined') TOKEN_CREATOR.init();
    if (typeof POOL_CREATOR  !== 'undefined') POOL_CREATOR.init();
    if (typeof BRIDGE_USDT   !== 'undefined') BRIDGE_USDT.init();
    if (typeof MY_TOKENS     !== 'undefined') MY_TOKENS.init();
    if (typeof ABOUT         !== 'undefined') ABOUT.init();
    if (typeof ADMIN_STYLES  !== 'undefined') ADMIN_STYLES.init();
    if (typeof ADMIN_CONTENT !== 'undefined') ADMIN_CONTENT.init();
    if (typeof TERMS         !== 'undefined') TERMS.init();
    if (typeof RISK          !== 'undefined') RISK.init();
    if (typeof FOOTER        !== 'undefined') FOOTER.init();

    // Cargar estilos on-chain al inicio
    if (typeof ADMIN_STYLES !== 'undefined') ADMIN_STYLES.loadFromChain().catch(() => {});
  },
};

window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  APP.init();
});
