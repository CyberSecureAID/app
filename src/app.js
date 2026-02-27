'use strict';

/* ══════════════════════════════════════════════════════════════
   MÓDULO: EVENT BINDINGS
   Propósito: Centralizar todos los event listeners que antes
     estaban como onclick/oninput en el HTML.
   Seguridad [T14]: Elimina unsafe-inline del CSP.
══════════════════════════════════════════════════════════════ */
function bindEvents() {

  // ── HEADER ──
  document.getElementById('langBtn')
    .addEventListener('click', () => LANG.toggle());
  document.getElementById('connectBtn')
    .addEventListener('click', () => WALLET.openOverlay());

  // ── SWAP CARD ──
  document.getElementById('slipToggle')
    .addEventListener('click', () => SWAP.toggleSlip());
  document.getElementById('sopt01')
    .addEventListener('click', function() { SWAP.setSlip(0.1, this); });
  document.getElementById('sopt05')
    .addEventListener('click', function() { SWAP.setSlip(0.5, this); });
  document.getElementById('sopt1')
    .addEventListener('click', function() { SWAP.setSlip(1, this); });
  document.querySelector('.scust')
    .addEventListener('input', function() { SWAP.setCustomSlip(this.value); });
  document.getElementById('bnbAmt')
    .addEventListener('input', function() { SWAP.onBnbIn(this.value); });
  document.querySelector('.max-btn')
    .addEventListener('click', () => SWAP.setMax());
  document.getElementById('detailsToggle')
    .addEventListener('click', () => SWAP.toggleDetails());
  document.getElementById('swapBtn')
    .addEventListener('click', () => SWAP.init());
  document.getElementById('addTokBtn')
    .addEventListener('click', () => WALLET.addToken());
  document.getElementById('secBtn')
    .addEventListener('click', () => TESTTOK.openOverlay());

  // ── ADMIN TRIGGER ──
  document.getElementById('admTrigger')
    .addEventListener('click', () => ADMIN.open());

  // ── WALLET OVERLAY ──
  document.getElementById('walOverlay')
    .addEventListener('click', function(e) {
      if (e.target === this) WALLET.closeOverlay();
    });
  document.querySelector('#walOverlay .modal-x')
    .addEventListener('click', () => WALLET.closeOverlay());
  document.getElementById('walOptMetamask')
    .addEventListener('click', () => WALLET.connect('metamask'));
  document.getElementById('walOptTrust')
    .addEventListener('click', () => WALLET.connect('trust'));

  // ── SWAP OVERLAY ──
  document.getElementById('swapOverlay')
    .addEventListener('click', function(e) {
      if (e.target === this) SWAP.closeModal();
    });
  document.querySelector('#swapOverlay .modal-x')
    .addEventListener('click', () => SWAP.closeModal());
  document.getElementById('cfmBtn')
    .addEventListener('click', () => SWAP.execute());

  // ── TEST TOKEN OVERLAY ──
  document.getElementById('secOverlay')
    .addEventListener('click', function(e) {
      if (e.target === this) TESTTOK.closeOverlay();
    });
  document.querySelector('#secOverlay .modal-x')
    .addEventListener('click', () => TESTTOK.closeOverlay());
  document.getElementById('verifyBtn')
    .addEventListener('click', () => TESTTOK.send());

  // ── ACCESS DENIED OVERLAY ──
  document.getElementById('accessDeniedOverlay')
    .addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  document.getElementById('accessCloseBtn')
    .addEventListener('click', () => {
      document.getElementById('accessDeniedOverlay').classList.remove('open');
    });

  // ── ADMIN PANEL ──
  document.getElementById('admOverlay')
    .addEventListener('click', () => ADMIN.close());
  document.getElementById('admX')
    .addEventListener('click', () => ADMIN.close());
  document.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('click', () => ADMIN.showInfo(btn.dataset.info));
  });
  document.getElementById('pcTabDirect')
    .addEventListener('click', () => ADMIN.setPcMode('direct'));
  document.getElementById('pcTabRatio')
    .addEventListener('click', () => ADMIN.setPcMode('ratio'));
  document.getElementById('directPrice')
    .addEventListener('input', () => ADMIN.onDirectPriceInput());
  document.getElementById('ratioBnb')
    .addEventListener('input', () => ADMIN.onRatioInput());
  document.getElementById('ratioUsdt')
    .addEventListener('input', () => ADMIN.onRatioInput());
  document.querySelector('.btn-ac.btn-full.mt12')
    .addEventListener('click', () => ADMIN.applyPrice());
  document.getElementById('depositMaxBtn')
    .addEventListener('click', () => ADMIN.setDepositMax());
  document.getElementById('depositAmt')
    .addEventListener('input', () => ADMIN.validateDepositAmt());
  document.getElementById('depositBtn')
    .addEventListener('click', () => ADMIN.deposit());
  document.querySelector('.btn-er.btn-full')
    .addEventListener('click', () => ADMIN.withdraw());
  document.getElementById('brandContract')
    .addEventListener('input', function() { ADMIN.validateCtInput(this); });
  document.getElementById('brandName')
    .addEventListener('input', () => ADMIN.liveBrand());
  document.querySelector('.btn-gl.btn-full.btn-sm.mt8')
    .addEventListener('click', () => ADMIN.applyBranding());

  // ── INFO MODAL ──
  document.getElementById('infoModalOverlay')
    .addEventListener('click', (e) => ADMIN.closeInfoModal(e));
  document.getElementById('infoModalX')
    .addEventListener('click', () => ADMIN.closeInfoModal());
}

/* ══════════════════════════════════════════════════════════════
   MÓDULO: APP
   Propósito: Inicialización y orquestación de todos los módulos.
   Invariante: init() se llama UNA vez cuando el DOM está listo.
   Dependencias: Todos los módulos.
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

    // Cargar historial persistido desde localStorage (sobrevive recargas)
    try {
      const saved = localStorage.getItem('miswap_tx_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) STATE.txHistory = parsed.slice(0, 10);
      }
    } catch (_) { /* localStorage no disponible — historial vacío */ }

    UI.renderLiqBar();
    UI.renderTxHist();
    SWAP.updateBtn();

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
    }

    setInterval(() => STATS.load().catch(() => {}), 30_000);
    setInterval(() => WALLET.refreshBalance(), 15_000);

    setInterval(() => {
      if (STATE.walletConnected && WALLET.isAdmin()) {
        const panel = document.getElementById('admPanel');
        if (panel && panel.classList.contains('open')) {
          ADMIN._loadAdminTokenBalance().catch(() => {});
        }
      }
    }, 20_000);

    console.log('%c🏦 MiSwap v8.0 — Token Verified | BSC Mainnet', 'color:#2de89a;font-size:1.1rem;font-weight:bold');
    console.log('%c📐 Modular architecture: CONFIG | GUARDS | STATE | LANG | CHAIN | PRICE | STATS | WALLET | SWAP | TESTTOK | ADMIN | UI | APP', 'color:#4f8dff;font-size:.75rem');
    console.log('%c🔐 Security: [T14] No unsafe-inline CSP | [T1-T13] Contract + frontend guards active', 'color:#a066ff;font-size:.70rem');
  },
};

// ── Arranque ──
window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  APP.init();
});
