'use strict';

const TERMS = {
  _defaultText: 'Al usar MiSwap aceptas que esta plataforma opera de forma 100% descentralizada en BNB Smart Chain. Los contratos inteligentes son inmutables una vez desplegados. Las operaciones son irreversibles. No somos responsables de pérdidas derivadas del uso de la plataforma ni de la volatilidad del mercado. Usa la plataforma bajo tu propia responsabilidad.',

  show() {
    const overlay = document.getElementById('termsOverlay');
    if (!overlay) return;
    this._loadText();
    overlay.classList.add('open');
  },

  close() {
    const overlay = document.getElementById('termsOverlay');
    if (overlay) overlay.classList.remove('open');
  },

  async _loadText() {
    const bodyEl = document.getElementById('termsBody');
    if (!bodyEl) return;
    let text = this._defaultText;
    if (CONFIG.ADMIN_CONFIG_ADDRESS) {
      try {
        const cfg = CHAIN.getAdminConfigReadContract();
        const res = await cfg.getContentConfig();
        if (res.termsText) text = res.termsText;
      } catch (_) {}
    }
    bodyEl.textContent = text;
  },

  init() {
    const overlay = document.getElementById('termsOverlay');
    if (!overlay) return;
    const closeBtn = document.getElementById('termsCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
  },
};
