'use strict';

const MENU_ITEMS = [
  { id: 'swap',         label: 'Swap',         labelEs: 'Swap',           labelHi: 'स्वैप',          labelAr: 'تبادل',           icon: '' },
  { id: 'create-token', label: 'Create Token',  labelEs: 'Crear Token',    labelHi: 'टोकन बनाएं',     labelAr: 'إنشاء رمز',       icon: '', fee: '0.1 BNB' },
  { id: 'create-pool',  label: 'Create Pool',   labelEs: 'Crear Pool',     labelHi: 'पूल बनाएं',      labelAr: 'إنشاء مجمع',      icon: '', fee: '0.5 BNB' },
  { id: 'flash-token',  label: 'Flash Tokens',  labelEs: 'Flash Tokens',   labelHi: 'फ्लैश टोकन',     labelAr: 'الرموز الفلاشية', icon: '', fee: '0.2 BNB' },
  { id: 'my-tokens',    label: 'My Tokens',     labelEs: 'Mis Tokens',     labelHi: 'मेरे टोकन',      labelAr: 'رموزي',           icon: '' },
  { id: 'bridge-usdt',  label: 'Bridge USDT',   labelEs: 'Bridge USDT',    labelHi: 'USDT ब्रिज',     labelAr: 'جسر USDT',        icon: '', fee: '2%' },
  { id: 'wallet',       label: 'Wallet',        labelEs: 'Wallet',         labelHi: 'वॉलेट',          labelAr: 'المحفظة',         icon: '' },
];

const MENU = {
  _active: 'swap',

  render() {
    const nav = document.getElementById('miNav');
    if (!nav) return;
    const lang = (typeof STATE !== 'undefined' && STATE.lang) ? STATE.lang : 'en';
    nav.innerHTML = MENU_ITEMS.map(item => {
      let label;
      if (lang === 'es') label = item.labelEs;
      else if (lang === 'hi') label = item.labelHi;
      else if (lang === 'ar') label = item.labelAr;
      else label = item.label;
      const fee    = item.fee ? `<span class="mi-nav-fee">${item.fee}</span>` : '';
      const active = item.id === this._active ? ' mi-nav-active' : '';
      return `<button class="mi-nav-item${active}" data-section="${item.id}" title="${label}">
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
    if (sectionId === 'flash-token' && typeof FLASH_TOKEN !== 'undefined') {
      FLASH_TOKEN.loadMyTokens().catch(() => {});
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
