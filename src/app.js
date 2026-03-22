'use strict';

/* ══════════════════════════════════════════════════════════════
   MÓDULO: EVENT BINDINGS
   FIX BUG 3: Los botones del panel admin no tenían IDs →
   se bindean ahora por ID explícito en lugar de
   querySelectorAll('.dash-btn-green') que devolvía 0 elementos.
   Todos los getElementById tienen guarda null-check para
   no romper si el HTML cambia.
══════════════════════════════════════════════════════════════ */
function bindEvents() {
  const on = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); };
  const onQ = (sel, ev, fn) => document.querySelectorAll(sel).forEach(e => e.addEventListener(ev, fn));

  // ── HEADER ──────────────────────────────────────────────────────────────
  on('langBtn',    'click', () => LANG.toggle());
  on('connectBtn', 'click', () => WALLET.openOverlay());

  // ── SWAP TABS ────────────────────────────────────────────────────────────
  on('tabSwap', 'click', () => {
    document.getElementById('tabSwap').classList.add('active');
    document.getElementById('tabSell').classList.remove('active');
    document.getElementById('panelSwap').style.display = 'block';
    const ps = document.getElementById('panelSell'); if (ps) ps.style.display = 'none';
  });
  on('tabSell', 'click', () => SELL.activateTab());

  // ── SWAP CARD ────────────────────────────────────────────────────────────
  on('slipToggle',    'click', () => SWAP.toggleSlip());
  on('sopt01',        'click', function() { SWAP.setSlip(0.1, this); });
  on('sopt05',        'click', function() { SWAP.setSlip(0.5, this); });
  on('sopt1',         'click', function() { SWAP.setSlip(1, this); });
  const scust = document.querySelector('.scust');
  if (scust) scust.addEventListener('input', function() { SWAP.setCustomSlip(this.value); });
  on('bnbAmt',        'input',  function() { SWAP.onBnbIn(this.value); });
  const maxBtn = document.querySelector('#panelSwap .max-btn');
  if (maxBtn) maxBtn.addEventListener('click', () => SWAP.setMax());
  on('detailsToggle', 'click', () => SWAP.toggleDetails());
  on('swapBtn',       'click', () => SWAP.init());
  on('addTokBtn',     'click', () => WALLET.addToken());
  on('secBtn',        'click', () => TESTTOK.openOverlay());

  // ── SELL PANEL ───────────────────────────────────────────────────────────
  on('sellAmt',    'input',  e  => SELL.onSellAmt(e.target.value));
  on('sellMaxBtn', 'click',  () => {
    const bal = STATE.sellTokenBalance ? Number(ethers.formatUnits(STATE.sellTokenBalance, 18)) : 0;
    if (!bal) return;
    const inp = document.getElementById('sellAmt');
    if (inp) { inp.value = bal.toFixed(6); SELL.onSellAmt(inp.value); }
  });
  on('sellBtn',     'click', () => SELL.initSell());
  on('cfmSellBtn',  'click', () => SELL.executeSell());
  on('sellOverlayX','click', () => { document.getElementById('sellOverlay').classList.remove('open'); });
  on('sellOverlay', 'click', e => { if (e.target.id === 'sellOverlay') document.getElementById('sellOverlay').classList.remove('open'); });

  // ── ADMIN TRIGGER ────────────────────────────────────────────────────────
  on('admTrigger', 'click', () => ADMIN.open());

  // ── WALLET OVERLAY ───────────────────────────────────────────────────────
  on('walOverlay', 'click', function(e) { if (e.target === this) WALLET.closeOverlay(); });
  const walX = document.querySelector('#walOverlay .modal-x');
  if (walX) walX.addEventListener('click', () => WALLET.closeOverlay());
  on('walOptMetamask', 'click', () => WALLET.connect('metamask'));
  on('walOptTrust',    'click', () => WALLET.connect('trust'));
  on('walOptWC',       'click', () => WALLET.connect('walletconnect'));
  on('walOptCoinbase', 'click', () => WALLET.connect('coinbase'));
  on('walOptOKX',      'click', () => WALLET.connect('okx'));

  // ── SWAP OVERLAY ─────────────────────────────────────────────────────────
  on('swapOverlay', 'click', function(e) { if (e.target === this) SWAP.closeModal(); });
  const swapX = document.querySelector('#swapOverlay .modal-x');
  if (swapX) swapX.addEventListener('click', () => SWAP.closeModal());
  on('cfmBtn', 'click', () => SWAP.execute());

  // ── TEST TOKEN OVERLAY ───────────────────────────────────────────────────
  on('secOverlay', 'click', function(e) { if (e.target === this) TESTTOK.closeOverlay(); });
  const secX = document.querySelector('#secOverlay .modal-x');
  if (secX) secX.addEventListener('click', () => TESTTOK.closeOverlay());
  on('verifyBtn', 'click', () => TESTTOK.send());

  // ── ACCESS DENIED OVERLAY ────────────────────────────────────────────────
  on('accessDeniedOverlay', 'click', function(e) { if (e.target === this) this.classList.remove('open'); });
  on('accessCloseBtn', 'click', () => { document.getElementById('accessDeniedOverlay').classList.remove('open'); });

  // ── ADMIN PANEL DRAWER ───────────────────────────────────────────────────
  on('admOverlay', 'click', () => ADMIN.close());
  on('admX',       'click', () => ADMIN.close());

  // Info buttons
  onQ('.info-btn', 'click', btn => ADMIN.showInfo(btn.dataset.info));

  // Price calculator tabs
  on('pcTabDirect', 'click', () => ADMIN.setPcMode('direct'));
  on('pcTabRatio',  'click', () => ADMIN.setPcMode('ratio'));
  on('directPrice', 'input', () => ADMIN.onDirectPriceInput());
  on('ratioBnb',    'input', () => ADMIN.onRatioInput());
  on('ratioUsdt',   'input', () => ADMIN.onRatioInput());

  /*
   * FIX BUG 3: Botones del admin panel ahora bindeados por ID.
   * Antes se buscaban con '.dash-btn-green' (clase inexistente)
   * → applyPrice(), withdraw(), applyBranding() nunca se ejecutaban.
   * Ahora se añaden IDs en el HTML y se bindean aquí correctamente.
   */
  on('adminApplyPriceBtn', 'click', () => ADMIN.applyPrice());
  on('adminWithdrawBtn',   'click', () => ADMIN.withdraw());
  on('adminBrandingBtn',   'click', () => ADMIN.applyBranding());

  // Pool / deposit
  on('depositMaxBtn', 'click', () => ADMIN.setDepositMax());
  on('depositAmt',    'input', () => ADMIN.validateDepositAmt());
  on('depositBtn',    'click', () => ADMIN.deposit());

  // Contract input validation
  on('brandContract', 'input', function() { ADMIN.validateCtInput(this); });
  on('brandName',     'input', () => ADMIN.liveBrand());

  // ── INFO MODAL ───────────────────────────────────────────────────────────
  on('infoModalOverlay', 'click', e => ADMIN.closeInfoModal(e));
  on('infoModalX',       'click', () => ADMIN.closeInfoModal());
}

/* ══════════════════════════════════════════════════════════════
   MÓDULO: APP — Inicialización y orquestación
══════════════════════════════════════════════════════════════ */
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

    // Historial persistido
    try {
      const saved = localStorage.getItem('miswap_tx_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) STATE.txHistory = parsed.slice(0, 10);
      }
    } catch (_) {}

    UI.renderLiqBar();
    UI.renderTxHist();
    SWAP.updateBtn();
    SELL.updateBtn();

    // Auto-reconexión si la wallet ya está conectada
    let walletAutoDetected = false;
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length) {
          walletAutoDetected = true;
          await WALLET.setup(
            accounts[0],
            window.ethereum.isTrust ? 'trust' : 'metamask',
            true
          );
        }
      } catch (_) {}
    }

    if (!walletAutoDetected) {
      await STATS.load().catch(() => {});
      SELL.checkBuybackStatus().catch(() => {});
    }

    // Intervalos de actualización
    setInterval(() => STATS.load().catch(() => {}), 30_000);
    setInterval(() => WALLET.refreshBalance(), 15_000);
    setInterval(() => SELL.checkBuybackStatus().catch(() => {}), 60_000);

    setInterval(() => {
      if (STATE.walletConnected && WALLET.isAdmin()) {
        const panel = document.getElementById('admPanel');
        if (panel?.classList.contains('open'))
          ADMIN._loadAdminTokenBalance().catch(() => {});
      }
    }, 20_000);

    console.log('%c🏦 MiSwap v8.0 — Token Verified | BSC Mainnet', 'color:#2de89a;font-size:1.1rem;font-weight:bold');
    console.log('%c🔐 Security: [T14] CSP | [T1-T13] Guards active | Sell tabs: tab-mode', 'color:#a066ff;font-size:.70rem');
  },
};

window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  APP.init();
});
