'use strict';
const APP = {
  async init() {
    // 1. Aplicar idioma inicial
    LANG.apply();

    // 2. Configurar listeners de admin (touch en footer)
    ADMIN.setupAdminTrigger();

    // 3. Configurar listeners de wallet (accountsChanged, chainChanged)
    WALLET.setupListeners();

    // 4. Cargar precio BNB inmediatamente y programar refresh cada 15s
    await PRICE.refresh().catch(() => {});
    setInterval(() => PRICE.refresh().catch(() => {}), 15_000);

    // 5. Refrescar precio cuando la pestaña recupera el foco
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') PRICE.refresh().catch(() => {});
    });

    // 6. Renderizar estado inicial de UI
    UI.renderLiqBar();
    UI.renderTxHist();
    SWAP.updateBtn();

    // 7. Auto-conectar wallet si ya tiene permisos (sin popup)
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

    // 8. Cargar stats del contrato (siempre — funciona con public RPC)
    // Si la wallet se auto-detectó, setup() ya llamó STATS.load()
    if (!walletAutoDetected) {
      await STATS.load().catch(() => {});
    }

    // 9. Programar refresh de stats cada 30s
    setInterval(() => STATS.load().catch(() => {}), 30_000);

    // 10. Programar refresh de balance BNB cada 15s
    setInterval(() => WALLET.refreshBalance(), 15_000);

    // 11. Refresh de balance de token del admin cuando el panel está abierto
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
    console.log('%c🔐 Security: [T1] Reentrancy mutex | [T2] minUsdtzOut slippage | [T3] isBnbPriceValid() onchain | [T4] msg.value validation | [T7] XSS esc() | [T9] swap cooldown | [T11] stats mutex | [T12] switchToBSC() first | [T13] Error sanitization (no tx data leak)', 'color:#a066ff;font-size:.70rem');
  },
};

// ── Arranque ──
window.addEventListener('DOMContentLoaded', () => APP.init());
