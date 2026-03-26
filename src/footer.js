'use strict';

const FOOTER = {
  async load() {
    this._renderFooter();
  },

  _renderFooter() {
    const foot = document.getElementById('dynamicFooter');
    if (!foot) return;

    const lang = (typeof STATE !== 'undefined' && STATE.lang) ? STATE.lang : 'en';

    const labels = {
      about:      { en: 'About Us',    es: 'Quiénes Somos',                hi: 'हमारे बारे में', ar: 'من نحن' },
      disclaimer: { en: 'Disclaimer',  es: 'Descargo',                     hi: 'अस्वीकरण',       ar: 'إخلاء المسؤولية' },
      terms:      { en: 'Terms',       es: 'Términos',                     hi: 'नियम',            ar: 'الشروط' },
      rights:     { en: 'All rights reserved', es: 'Todos los derechos reservados', hi: 'सर्वाधिकार सुरक्षित', ar: 'جميع الحقوق محفوظة' },
    };

    const lbl = (key) => labels[key]?.[lang] || labels[key]?.en || key;

    foot.innerHTML = `
      <div class="foot-compact">
        <div class="foot-compact-left">
          <span class="foot-brand" id="footPlatformName">MiSwap</span>
          <span class="foot-sep-dot">·</span>
          <span class="foot-network">BSC Mainnet</span>
          <span class="foot-sep-dot">·</span>
          <span class="foot-copy">${GUARDS.esc(lbl('rights'))}</span>
        </div>
        <div class="foot-compact-links">
          <button class="foot-modal-btn" id="footAboutBtn">${GUARDS.esc(lbl('about'))}</button>
          <span class="foot-sep-dot">·</span>
          <button class="foot-modal-btn" id="footDisclaimerBtn">${GUARDS.esc(lbl('disclaimer'))}</button>
          <span class="foot-sep-dot">·</span>
          <button class="foot-modal-btn" id="footTermsBtn">${GUARDS.esc(lbl('terms'))}</button>
        </div>
      </div>
      <button class="adm-trigger" id="admTrigger" aria-label="Admin Panel">⚙</button>
    `;

    this._bindFooterEvents();

    // Update platform name if branding changed
    const nameEl = document.getElementById('footPlatformName');
    if (nameEl && typeof STATE !== 'undefined' && STATE.platformName) {
      nameEl.textContent = STATE.platformName;
    }
  },

  _bindFooterEvents() {
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

    on('footAboutBtn',      () => ADMIN.showFooterModal('about'));
    on('footDisclaimerBtn', () => ADMIN.showFooterModal('disclaimer'));
    on('footTermsBtn',      () => {
      if (typeof TERMS !== 'undefined') TERMS.show();
      else ADMIN.showFooterModal('terms');
    });
    on('admTrigger', () => { if (typeof ADMIN !== 'undefined') ADMIN.open(); });
  },

  // Called when language changes so labels update
  applyLang() {
    this._renderFooter();
  },

  init() {
    this.load().catch(() => this._renderFooter());
  },
};
