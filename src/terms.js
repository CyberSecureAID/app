'use strict';

const TERMS = {
  _defaultText: 'By using MiSwap you accept that this platform operates in a 100% decentralized manner on BNB Smart Chain. Smart contracts are immutable once deployed. Operations are irreversible. We are not responsible for losses arising from the use of the platform or market volatility. Use the platform at your own risk.',

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
