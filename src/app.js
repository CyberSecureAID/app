'use strict';

function bindEvents() {
  const on  = (id, ev, fn) => { const e = document.getElementById(id); if (e) e.addEventListener(ev, fn); };
  const onQ = (sel, ev, fn) => document.querySelectorAll(sel).forEach(e => e.addEventListener(ev, fn));

  // ── Header hamburger ──
  on('hdrHamburger', 'click', function() {
    const right  = document.getElementById('hdrRight');
    if (!right) return;
    const isOpen = right.classList.toggle('mobile-open');
    this.classList.toggle('open', isOpen);
    this.setAttribute('aria-expanded', String(isOpen));
  });
  document.addEventListener('click', e => {
    const hamburger = document.getElementById('hdrHamburger');
    const right     = document.getElementById('hdrRight');
    if (hamburger && right && !hamburger.contains(e.target) && !right.contains(e.target)) {
      right.classList.remove('mobile-open');
      hamburger.classList.remove('open');
    }
  });

  // ── Language dropdown — FIX #5: Delegación de eventos corregida ──────────
  on('langBtn', 'click', (e) => {
    e.stopPropagation();
    LANG.toggleDropdown();
  });

  // FIX #5: Event delegation para opciones de idioma
  document.addEventListener('click', e => {
    const opt = e.target.closest('.lang-opt');
    if (opt && opt.dataset.lang) {
      e.stopPropagation();
      LANG.setLang(opt.dataset.lang);
    }
  });

  // Cerrar dropdown al click fuera
  document.addEventListener('click', e => {
    const dd = document.getElementById('langDropdown');
    if (dd && !dd.contains(e.target)) {
      LANG._closeDropdown();
    }
  });

  // ── Wallet ──
  on('connectBtn', 'click', () => WALLET.openOverlay());

  // ── Swap / Sell tabs ──
  on('tabSwap', 'click', () => {
    document.getElementById('tabSwap').classList.add('active');
    document.getElementById('tabSell').classList.remove('active');
    document.getElementById('panelSwap').style.display = 'block';
    const ps = document.getElementById('panelSell'); if (ps) ps.style.display = 'none';
  });
  on('tabSell', 'click', () => SELL.activateTab());

  // ── Slippage ──
  on('slipToggle', 'click', () => SWAP.toggleSlip());
  on('sopt01', 'click', function() { SWAP.setSlip(0.1, this); });
  on('sopt05', 'click', function() { SWAP.setSlip(0.5, this); });
  on('sopt1',  'click', function() { SWAP.setSlip(1,   this); });
  const scust = document.querySelector('.scust');
  if (scust) scust.addEventListener('input', function() { SWAP.setCustomSlip(this.value); });

  // ── Swap inputs ──
  on('bnbAmt', 'input', function() { SWAP.onBnbIn(this.value); });
  const maxBtn = document.querySelector('#panelSwap .max-btn');
  if (maxBtn) maxBtn.addEventListener('click', () => SWAP.setMax());
  on('detailsToggle', 'click', () => SWAP.toggleDetails());
  on('swapBtn',   'click', () => SWAP.init());
  on('addTokBtn', 'click', () => WALLET.addToken());
  on('secBtn',    'click', () => TESTTOK.openOverlay());

  // ── Sell panel ──
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

  // ── Admin ──
  on('admTrigger', 'click', () => ADMIN.open());

  // ── Wallet overlay ──
  on('walOverlay', 'click', function(e) { if (e.target === this) WALLET.closeOverlay(); });
  const walX = document.querySelector('#walOverlay .modal-x');
  if (walX) walX.addEventListener('click', () => WALLET.closeOverlay());
  on('walOptMetamask', 'click', () => WALLET.connect('metamask'));
  on('walOptTrust',    'click', () => WALLET.connect('trust'));
  on('walOptWC',       'click', () => WALLET.connect('walletconnect'));
  on('walOptCoinbase', 'click', () => WALLET.connect('coinbase'));
  on('walOptOKX',      'click', () => WALLET.connect('okx'));

  // ── Swap overlay ──
  on('swapOverlay', 'click', function(e) { if (e.target === this) SWAP.closeModal(); });
  const swapX = document.querySelector('#swapOverlay .modal-x');
  if (swapX) swapX.addEventListener('click', () => SWAP.closeModal());
  on('cfmBtn', 'click', () => SWAP.execute());

  // ── Security overlay ──
  on('secOverlay', 'click', function(e) { if (e.target === this) TESTTOK.closeOverlay(); });
  const secX = document.querySelector('#secOverlay .modal-x');
  if (secX) secX.addEventListener('click', () => TESTTOK.closeOverlay());
  on('verifyBtn', 'click', () => TESTTOK.send());

  // ── Access denied overlay ──
  on('accessDeniedOverlay', 'click', function(e) { if (e.target === this) this.classList.remove('open'); });
  on('accessCloseBtn', 'click', () => { document.getElementById('accessDeniedOverlay').classList.remove('open'); });

  // ── Admin panel ──
  on('admOverlay', 'click', () => ADMIN.close());
  on('admX',       'click', () => ADMIN.close());

  // ── Info buttons — FIX #1: event delegation para capturar todos ──────────
  document.addEventListener('click', e => {
    const btn = e.target.closest('.info-btn');
    if (!btn) return;
    const key = btn.dataset.info;
    if (key) ADMIN.showInfo(key);
  });

  // ── Price config ──
  on('pcTabDirect', 'click', () => ADMIN.setPcMode('direct'));
  on('pcTabRatio',  'click', () => ADMIN.setPcMode('ratio'));
  on('directPrice', 'input', () => ADMIN.onDirectPriceInput());
  on('ratioBnb',    'input', () => ADMIN.onRatioInput());
  on('ratioUsdt',   'input', () => ADMIN.onRatioInput());

  // ── Admin actions ──
  on('adminApplyPriceBtn', 'click', () => ADMIN.applyPrice());
  on('adminWithdrawBtn',   'click', () => ADMIN.withdraw());
  on('adminBrandingBtn',   'click', () => ADMIN.applyBranding());
  on('adminSaveCostsBtn',  'click', () => ADMIN.saveCosts());
  on('adminSaveTaxesBtn',  'click', () => ADMIN.saveTaxes());

  // ── Deposit ──
  on('depositMaxBtn', 'click', () => ADMIN.setDepositMax());
  on('depositAmt',    'input', () => ADMIN.validateDepositAmt());
  on('depositBtn',    'click', () => ADMIN.deposit());

  // ── Branding ──
  on('brandContract', 'input', function() { ADMIN.validateCtInput(this); });
  on('brandName',     'input', () => ADMIN.liveBrand());

  // ── Info modal overlay ──
  on('infoModalOverlay', 'click', e => ADMIN.closeInfoModal(e));
  on('infoModalX',       'click', () => ADMIN.closeInfoModal());

  // ── Terms & Risk ──
  on('termsCloseBtn', 'click', () => { if (typeof TERMS !== 'undefined') TERMS.close(); });
  on('termsOverlay',  'click', function(e) { if (e.target === this && typeof TERMS !== 'undefined') TERMS.close(); });
  on('riskCloseBtn',  'click', () => { if (typeof RISK !== 'undefined') RISK.close(); });
  on('riskAcceptBtn', 'click', () => { if (typeof RISK !== 'undefined') RISK._accept(); });
  const riskChk = document.getElementById('riskCheckbox');
  if (riskChk) {
    const riskBtn = document.getElementById('riskAcceptBtn');
    riskChk.addEventListener('change', () => { if (riskBtn) riskBtn.disabled = !riskChk.checked; });
  }

  // ── FIX #2: Footer modal buttons — se renderizan dinámicamente ───────────
  // Se manejan en FOOTER._bindFooterEvents() tras cada render
}

function _sanitizeTxEntry(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const bnb   = Number(obj.bnb);
  if (!Number.isFinite(bnb) || bnb < 0 || bnb > 1_000_000) return null;
  const token = Number(obj.token);
  if (!Number.isFinite(token) || token < 0 || token > 1e15) return null;
  const hash  = typeof obj.hash === 'string' ? obj.hash : '';
  if (hash && !/^0x[0-9a-fA-F]{64}$/.test(hash)) return null;
  const rawTime = typeof obj.time === 'string' ? obj.time : '';
  const time    = rawTime.replace(/[^0-9:apmAPM\s]/g, '').slice(0, 20);
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

    console.log('%c🏦 MiSwap v8.1 — BSC Mainnet', 'color:#2de89a;font-size:1.1rem;font-weight:bold');

    if (typeof FLASH_TOKEN    !== 'undefined') FLASH_TOKEN.init();
    if (typeof MENU           !== 'undefined') MENU.init();
    if (typeof TOKEN_CREATOR  !== 'undefined') TOKEN_CREATOR.init();
    if (typeof POOL_CREATOR   !== 'undefined') POOL_CREATOR.init();
    if (typeof BRIDGE_USDT    !== 'undefined') BRIDGE_USDT.init();
    if (typeof MY_TOKENS      !== 'undefined') MY_TOKENS.init();
    if (typeof ABOUT          !== 'undefined') ABOUT.init();
    if (typeof ADMIN_STYLES   !== 'undefined') ADMIN_STYLES.init();
    if (typeof ADMIN_CONTENT  !== 'undefined') ADMIN_CONTENT.init();
    if (typeof TERMS          !== 'undefined') TERMS.init();
    if (typeof RISK           !== 'undefined') RISK.init();
    if (typeof FOOTER         !== 'undefined') FOOTER.init();

    if (typeof ADMIN_STYLES !== 'undefined') ADMIN_STYLES.loadFromChain().catch(() => {});
  },
};

window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  APP.init();
});
