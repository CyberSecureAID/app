'use strict';

const RISK = {
  _LS_KEY: 'miswap_risk_accepted',
  _defaultText: '⚠️ AVISO DE RIESGO: El trading de criptomonedas conlleva riesgos significativos. Puedes perder parte o la totalidad de tu inversión. MiSwap es una plataforma descentralizada y no garantiza rendimientos. Las transacciones en blockchain son irreversibles. Invierte solo lo que puedas permitirte perder.',
  _callback: null,

  isAccepted() {
    try { return localStorage.getItem(this._LS_KEY) === 'true'; } catch (_) { return false; }
  },

  _accept() {
    try { localStorage.setItem(this._LS_KEY, 'true'); } catch (_) {}
    this.close();
    if (typeof this._callback === 'function') {
      const cb = this._callback;
      this._callback = null;
      cb();
    }
  },

  show(callback) {
    this._callback = callback || null;
    const overlay = document.getElementById('riskOverlay');
    if (!overlay) {
      // Overlay missing — do NOT auto-accept, log error and block action
      console.error('[RISK] riskOverlay element not found. Cannot show risk disclaimer.');
      return;
    }
    this._loadText();
    const chk = document.getElementById('riskCheckbox');
    if (chk) chk.checked = false;
    const btn = document.getElementById('riskAcceptBtn');
    if (btn) btn.disabled = true;
    overlay.classList.add('open');
  },

  close() {
    const overlay = document.getElementById('riskOverlay');
    if (overlay) overlay.classList.remove('open');
  },

  async _loadText() {
    const bodyEl = document.getElementById('riskBody');
    if (!bodyEl) return;
    let text = this._defaultText;
    if (CONFIG.ADMIN_CONFIG_ADDRESS) {
      try {
        const cfg = CHAIN.getAdminConfigReadContract();
        const res = await cfg.getContentConfig();
        if (res.riskText) text = res.riskText;
      } catch (_) {}
    }
    bodyEl.textContent = text;
  },

  init() {
    const overlay = document.getElementById('riskOverlay');
    if (!overlay) return;
    const chk    = document.getElementById('riskCheckbox');
    const btn    = document.getElementById('riskAcceptBtn');
    const closeX = document.getElementById('riskCloseBtn');
    if (chk && btn) {
      chk.addEventListener('change', () => { btn.disabled = !chk.checked; });
    }
    if (btn) btn.addEventListener('click', () => this._accept());
    if (closeX) closeX.addEventListener('click', () => this.close());
    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    // Mostrar al inicio si no ha sido aceptado
    if (!this.isAccepted()) {
      this.show(null);
    }
  },
};
