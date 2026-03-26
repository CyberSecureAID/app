'use strict';

/* ══════════════════════════════════════════════════════════════
   MÓDULO: FOOTER  v2.0
   FIX #2: Footer compacto con modales emergentes para About,
   Disclaimer y Terms. Nada queda expuesto en el pie de página.
   FIX #3: Todo editable desde panel admin (STATE.footerConfig).
   FIX #7: Infraestructura real — carga desde AdminConfig onchain.
══════════════════════════════════════════════════════════════ */

const FOOTER = {

  // ── Textos por defecto (usados si AdminConfig no responde) ────────────────
  _defaults: {
    platformName: 'MiSwap',
    aboutTitle: 'About Us',
    aboutText: 'MiSwap is a 100% decentralized platform built on BNB Smart Chain that offers unique opportunities to acquire exclusive tokens at flexible prices. Our mission is to democratize access to emerging projects without entry barriers. No registration or KYC required — respecting your privacy and autonomy. The system is intuitive and designed for users of all levels.',
    disclaimerTitle: 'Disclaimer',
    disclaimerText: 'The MiSwap team acts as a provider of decentralized technology infrastructure. We are not responsible for misuse of listed tokens, losses due to market volatility, fraudulent projects, or users\' investment decisions. Each user is responsible for doing their own research before operating. Blockchain transactions are irreversible. Operate at your own risk.',
    termsTitle: 'Terms & Conditions',
    termsText: 'By using MiSwap you accept that this platform operates in a 100% decentralized manner on BNB Smart Chain. Smart contracts are immutable once deployed. Operations are irreversible. We are not responsible for losses arising from the use of the platform or market volatility. Use the platform at your own risk.',
  },

  // ── Estado de contenido (cargado desde chain o defaults) ──────────────────
  _content: null,

  async _loadContent() {
    // Usar cache si ya cargamos
    if (this._content) return this._content;

    // Aplicar defaults primero
    this._content = { ...this._defaults };

    // Intentar cargar desde AdminConfig si está deployado
    if (CONFIG.ADMIN_CONFIG_ADDRESS) {
      try {
        const cfg = CHAIN.getAdminConfigReadContract();
        const res = await cfg.getContentConfig();
        if (res.aboutText)       this._content.aboutText       = res.aboutText;
        if (res.riskText)        this._content.disclaimerText  = res.riskText;
        if (res.termsText)       this._content.termsText       = res.termsText;
      } catch (_) { /* usar defaults */ }
    }

    // Aplicar overrides de STATE si el admin los cambió localmente
    if (typeof STATE !== 'undefined' && STATE.footerConfig) {
      const fc = STATE.footerConfig;
      if (fc.aboutTitle)       this._content.aboutTitle       = fc.aboutTitle;
      if (fc.aboutText)        this._content.aboutText        = fc.aboutText;
      if (fc.disclaimerTitle)  this._content.disclaimerTitle  = fc.disclaimerTitle;
      if (fc.disclaimerText)   this._content.disclaimerText   = fc.disclaimerText;
      if (fc.termsTitle)       this._content.termsTitle       = fc.termsTitle;
      if (fc.termsText)        this._content.termsText        = fc.termsText;
    }

    return this._content;
  },

  // ── Invalidar cache (llamar cuando admin actualiza contenido) ─────────────
  invalidateCache() {
    this._content = null;
  },

  // ── Render del footer compacto ────────────────────────────────────────────
  _renderFooter() {
    const foot = document.getElementById('dynamicFooter');
    if (!foot) return;

    const lang = (typeof STATE !== 'undefined' && STATE.lang) ? STATE.lang : 'en';
    const platformName = (typeof STATE !== 'undefined' && STATE.platformName) ? STATE.platformName : 'MiSwap';

    const labels = {
      about:      { en: 'About Us',   es: 'Quiénes Somos',   hi: 'हमारे बारे में', ar: 'من نحن' },
      disclaimer: { en: 'Disclaimer', es: 'Descargo',         hi: 'अस्वीकरण',       ar: 'إخلاء المسؤولية' },
      terms:      { en: 'Terms',      es: 'Términos',         hi: 'नियम',            ar: 'الشروط' },
      rights:     { en: 'All rights reserved', es: 'Todos los derechos reservados', hi: 'सर्वाधिकार सुरक्षित', ar: 'جميع الحقوق محفوظة' },
    };
    const lbl = (key) => labels[key]?.[lang] || labels[key]?.en || key;

    foot.innerHTML = `
      <div class="foot-compact">
        <div class="foot-compact-left">
          <span class="foot-brand" id="footPlatformName">${GUARDS.esc(platformName)}</span>
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
  },

  _bindFooterEvents() {
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('footAboutBtn',      () => this.showModal('about'));
    on('footDisclaimerBtn', () => this.showModal('disclaimer'));
    on('footTermsBtn',      () => this.showModal('terms'));
    on('admTrigger',        () => { if (typeof ADMIN !== 'undefined') ADMIN.open(); });
  },

  // ── Modal emergente genérico ──────────────────────────────────────────────
  async showModal(type) {
    const content = await this._loadContent();

    let title = '', body = '';
    if (type === 'about') {
      title = content.aboutTitle || this._defaults.aboutTitle;
      body  = content.aboutText  || this._defaults.aboutText;
    } else if (type === 'disclaimer') {
      title = content.disclaimerTitle || this._defaults.disclaimerTitle;
      body  = content.disclaimerText  || this._defaults.disclaimerText;
    } else if (type === 'terms') {
      title = content.termsTitle || this._defaults.termsTitle;
      body  = content.termsText  || this._defaults.termsText;
    }

    // Crear/reutilizar el overlay de footer
    let overlay = document.getElementById('footerModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'footerModalOverlay';
      overlay.className = 'overlay';
      overlay.innerHTML = `
        <div class="modal">
          <button class="modal-x" id="footerModalX">✕</button>
          <div class="modal-title" id="footerModalTitle"></div>
          <div class="mi-modal-body" id="footerModalBody"></div>
        </div>`;
      document.body.appendChild(overlay);

      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
      document.getElementById('footerModalX').addEventListener('click', () => overlay.classList.remove('open'));
    }

    const titleEl = document.getElementById('footerModalTitle');
    const bodyEl  = document.getElementById('footerModalBody');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl)  bodyEl.textContent  = body;
    overlay.classList.add('open');
  },

  // ── Método llamado desde admin para refrescar después de editar ───────────
  applyLang() {
    this._renderFooter();
  },

  async load() {
    this._renderFooter();
    // Precargar contenido en background
    this._loadContent().catch(() => {});
  },

  init() {
    this.load().catch(() => this._renderFooter());
  },
};
