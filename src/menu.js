'use strict';

const MENU_ITEMS = [
  { id: 'swap',         label: 'Swap',        labelEs: 'Swap',          icon: '🔄' },
  { id: 'create-token', label: 'Create Token', labelEs: 'Crear Token',   icon: '🪙', fee: '0.1 BNB' },
  { id: 'create-pool',  label: 'Create Pool',  labelEs: 'Crear Pool',    icon: '💧', fee: '0.5 BNB' },
  { id: 'my-tokens',    label: 'My Tokens',    labelEs: 'Mis Tokens',    icon: '👜' },
  { id: 'bridge-usdt',  label: 'Bridge USDT',  labelEs: 'Bridge USDT',   icon: '🌉', fee: '2%' },
  { id: 'wallet',       label: 'Wallet',       labelEs: 'Wallet',        icon: '🔗' },
];

const MENU = {
  _active: 'swap',

  render() {
    const nav = document.getElementById('miNav');
    if (!nav) return;
    const lang = (typeof STATE !== 'undefined' && STATE.lang) ? STATE.lang : 'en';
    nav.innerHTML = MENU_ITEMS.map(item => {
      const label = lang === 'es' ? item.labelEs : item.label;
      const fee   = item.fee ? `<span class="mi-nav-fee">${item.fee}</span>` : '';
      const active = item.id === this._active ? ' mi-nav-active' : '';
      return `<button class="mi-nav-item${active}" data-section="${item.id}" title="${label}">
        <span class="mi-nav-icon">${item.icon}</span>
        <span class="mi-nav-label">${label}</span>${fee}
      </button>`;
    }).join('');

    nav.querySelectorAll('.mi-nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.show(btn.dataset.section));
    });
  },

  show(sectionId) {
    this._active = sectionId;
    // Toggle sections
    MENU_ITEMS.forEach(item => {
      const el = document.getElementById('section-' + item.id);
      if (el) el.style.display = item.id === sectionId ? 'block' : 'none';
    });
    // Update nav highlights
    document.querySelectorAll('.mi-nav-item').forEach(btn => {
      btn.classList.toggle('mi-nav-active', btn.dataset.section === sectionId);
    });
    // Lazy-load section content when first shown
    if (sectionId === 'my-tokens' && typeof MY_TOKENS !== 'undefined') {
      MY_TOKENS.load().catch(() => {});
    }
    if (sectionId === 'wallet' && typeof WALLET !== 'undefined') {
      WALLET.renderWalletSection();
    }
  },

  applyLang() {
    this.render();
  },

  init() {
    this.render();
    // Start with swap visible
    this.show('swap');
  },
};
