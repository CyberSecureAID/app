'use strict';

/* FIX: Menú sin emojis (solo texto limpio), bien distribuido y con hamburger móvil */
const MENU_ITEMS = [
  { id: 'swap',         label: 'Swap',         labelEs: 'Swap',           labelHi: 'स्वैप',         labelAr: 'تبادل',           fee: null },
  { id: 'create-token', label: 'Create Token',  labelEs: 'Crear Token',    labelHi: 'टोकन बनाएं',    labelAr: 'إنشاء رمز',       fee: '0.1 BNB' },
  { id: 'create-pool',  label: 'Create Pool',   labelEs: 'Crear Pool',     labelHi: 'पूल बनाएं',     labelAr: 'إنشاء مجمع',      fee: '0.5 BNB' },
  { id: 'flash-token',  label: 'Flash Tokens',  labelEs: 'Flash Tokens',   labelHi: 'फ्लैश टोकन',    labelAr: 'رموز فلاشية',     fee: '0.2 BNB' },
  { id: 'my-tokens',    label: 'My Tokens',     labelEs: 'Mis Tokens',     labelHi: 'मेरे टोकन',     labelAr: 'رموزي',           fee: null },
  { id: 'bridge-usdt',  label: 'Bridge USDT',   labelEs: 'Bridge USDT',    labelHi: 'USDT ब्रिज',    labelAr: 'جسر USDT',        fee: '2%' },
  { id: 'wallet',       label: 'Wallet',        labelEs: 'Wallet',         labelHi: 'वॉलेट',         labelAr: 'المحفظة',         fee: null },
];

const MENU = {
  _active: 'swap',
  _hamburgerInNav: null,

  render() {
    const nav = document.getElementById('miNav');
    if (!nav) return;
    const lang = (typeof STATE !== 'undefined' && STATE.lang) ? STATE.lang : 'en';

    // Hamburger button
    const hamburger = document.createElement('button');
    hamburger.className = 'mi-nav-hamburger';
    hamburger.id = 'miNavHamburger';
    hamburger.setAttribute('aria-label', 'Menu');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.innerHTML = '☰ <span style="font-size:.76rem;font-weight:600">Menu</span>';
    hamburger.addEventListener('click', () => this._toggleMobile());
    this._hamburgerInNav = hamburger;

    nav.innerHTML = '';
    nav.appendChild(hamburger);

    MENU_ITEMS.forEach(item => {
      let label;
      if (lang === 'es') label = item.labelEs;
      else if (lang === 'hi') label = item.labelHi;
      else if (lang === 'ar') label = item.labelAr;
      else label = item.label;

      const btn = document.createElement('button');
      btn.className = 'mi-nav-item' + (item.id === this._active ? ' mi-nav-active' : '');
      btn.dataset.section = item.id;
      btn.title = label;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'mi-nav-label';
      labelSpan.textContent = label;
      btn.appendChild(labelSpan);

      if (item.fee) {
        const feeSpan = document.createElement('span');
        feeSpan.className = 'mi-nav-fee';
        feeSpan.textContent = item.fee;
        btn.appendChild(feeSpan);
      }

      btn.addEventListener('click', () => {
        this.show(item.id);
        // Cerrar menú móvil al seleccionar
        nav.classList.remove('mobile-open');
        if (this._hamburgerInNav) this._hamburgerInNav.setAttribute('aria-expanded', 'false');
      });

      nav.appendChild(btn);
    });
  },

  _toggleMobile() {
    const nav = document.getElementById('miNav');
    if (!nav) return;
    const isOpen = nav.classList.toggle('mobile-open');
    if (this._hamburgerInNav) {
      this._hamburgerInNav.setAttribute('aria-expanded', String(isOpen));
      this._hamburgerInNav.innerHTML = (isOpen ? '✕' : '☰') + ' <span style="font-size:.76rem;font-weight:600">Menu</span>';
    }
  },

  show(sectionId) {
    this._active = sectionId;
    MENU_ITEMS.forEach(item => {
      const el = document.getElementById('section-' + item.id);
      if (el) el.style.display = item.id === sectionId ? 'block' : 'none';
    });
    document.querySelectorAll('.mi-nav-item').forEach(btn => {
      btn.classList.toggle('mi-nav-active', btn.dataset.section === sectionId);
    });
    if (sectionId === 'my-tokens' && typeof MY_TOKENS !== 'undefined') {
      MY_TOKENS.load().catch(() => {});
    }
    if (sectionId === 'wallet' && typeof WALLET !== 'undefined') {
      WALLET.renderWalletSection();
    }
    if (sectionId === 'flash-token' && typeof FLASH_TOKEN !== 'undefined') {
      FLASH_TOKEN.loadMyTokens().catch(() => {});
    }
    if (sectionId === 'bridge-usdt' && typeof BRIDGE_USDT !== 'undefined') {
      BRIDGE_USDT.loadUserTokens().catch(() => {});
    }
  },

  applyLang() {
    this.render();
    // Re-activate current section after re-render
    const currentActive = this._active;
    document.querySelectorAll('.mi-nav-item').forEach(btn => {
      btn.classList.toggle('mi-nav-active', btn.dataset.section === currentActive);
    });
  },

  init() {
    this.render();
    this.show('swap');
  },
};
