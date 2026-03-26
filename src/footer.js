'use strict';

const FOOTER = {
  _fallback: null,

  async load() {
    if (!CONFIG.ADMIN_CONFIG_ADDRESS) { this._renderFallback(); return; }
    try {
      const cfg = CHAIN.getAdminConfigReadContract();
      const res = await cfg.getFooterConfig();
      if (!res.footerText && !res.socialLinks) { this._renderFallback(); return; }
      this._renderDynamic(res);
    } catch (_) {
      this._renderFallback();
    }
  },

  /*
   * FIX: Footer profesional con sección Nosotros, Descargo, y estructura
   * basada en los textos especificados en el AdminConfig (texto por defecto).
   */
  _renderFallback() {
    const foot = document.getElementById('dynamicFooter');
    if (!foot) return;

    const lang = (typeof STATE !== 'undefined' && STATE.lang) ? STATE.lang : 'es';
    const nosotrosText = `MiSwap es una plataforma 100% descentralizada y opensource, construida sobre BNB Smart Chain que brinda oportunidades únicas de adquirir tokens exclusivos a precios flexibles. Nuestra misión es democratizar el acceso a proyectos emergentes sin barreras de entrada. No requerimos registro ni KYC, respetando tu privacidad y autonomía. El sistema es intuitivo y está diseñado para usuarios de todos los niveles.`;
    const disclaimerText = `El equipo de MiSwap actúa como proveedor de infraestructura tecnológica descentralizada. No nos responsabilizamos por el uso indebido de tokens listados, pérdidas derivadas de volatilidad del mercado, proyectos fraudulentos ni decisiones de inversión de los usuarios. Cada usuario es responsable de investigar antes de operar. Las transacciones en blockchain son irreversibles. Opera bajo tu propio riesgo.`;

    foot.innerHTML = `
      <div class="foot-nosotros">
        <div class="foot-col">
          <div class="foot-col-title">Nosotros</div>
          <p class="foot-nosotros-text" id="footNosotrosText">${nosotrosText}</p>
        </div>
        <div class="foot-col">
          <div class="foot-col-title">Descargo de Responsabilidad</div>
          <p class="foot-disclaimer" id="footDisclaimerText">${disclaimerText}</p>
        </div>
      </div>
      <div class="foot-bottom">
        <div class="foot-links">
          <span class="foot-copyright" id="footPlatformName">MiSwap</span>
          <span class="foot-sep" style="color:var(--t4)">·</span>
          <span class="foot-copyright">BSC Mainnet</span>
          <span class="foot-sep" style="color:var(--t4)">·</span>
          <span class="foot-copyright" data-i18n="all_rights">All rights reserved</span>
          <span class="foot-sep" style="color:var(--t4)">·</span>
          <button class="foot-link-btn" id="footTermsBtn">Términos</button>
        </div>
        <div style="font-size:.65rem;color:var(--t4);font-family:var(--mono)">v8.0 · BNB Chain</div>
      </div>
      <button class="adm-trigger" id="admTrigger">⚙</button>`;

    if (typeof LANG !== 'undefined') LANG.apply();

    const admTrigger = document.getElementById('admTrigger');
    if (admTrigger) admTrigger.addEventListener('click', () => ADMIN.open());

    const termsBtn = document.getElementById('footTermsBtn');
    if (termsBtn) termsBtn.addEventListener('click', () => {
      if (typeof TERMS !== 'undefined') TERMS.show();
    });
  },

  _renderDynamic(res) {
    const foot = document.getElementById('dynamicFooter');
    if (!foot) return;

    // Escape para prevenir XSS desde datos on-chain
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const safeUrl = u => /^https?:\/\/./.test(u) ? u : '#';

    let socialHtml = '';
    if (res.socialLinks) {
      try {
        const links = JSON.parse(res.socialLinks);
        socialHtml = Object.entries(links).map(([name, url]) =>
          `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer" class="foot-social-link">${esc(name)}</a>`
        ).join('');
      } catch (_) {}
    }

    const nosotrosText = `MiSwap es una plataforma 100% descentralizada y opensource, construida sobre BNB Smart Chain que brinda oportunidades únicas de adquirir tokens exclusivos a precios flexibles. Nuestra misión es democratizar el acceso a proyectos emergentes sin barreras de entrada. No requerimos registro ni KYC, respetando tu privacidad y autonomía. El sistema es intuitivo y está diseñado para usuarios de todos los niveles.`;
    const disclaimerText = `El equipo de MiSwap actúa como proveedor de infraestructura tecnológica descentralizada. No nos responsabilizamos por el uso indebido de tokens listados, pérdidas derivadas de volatilidad del mercado, proyectos fraudulentos ni decisiones de inversión de los usuarios. Cada usuario es responsable de investigar antes de operar. Las transacciones en blockchain son irreversibles. Opera bajo tu propio riesgo.`;

    foot.innerHTML = `
      <div class="foot-nosotros">
        <div class="foot-col">
          <div class="foot-col-title">Nosotros</div>
          <p class="foot-nosotros-text">${nosotrosText}</p>
        </div>
        <div class="foot-col">
          <div class="foot-col-title">Descargo de Responsabilidad</div>
          <p class="foot-disclaimer">${disclaimerText}</p>
        </div>
      </div>
      <div class="foot-bottom">
        <div class="foot-links">
          <span class="foot-copyright">${esc(res.footerText || 'MiSwap')}</span>
          ${socialHtml ? `<span class="foot-sep">·</span>${socialHtml}` : ''}
          <span class="foot-sep">·</span>
          <button class="foot-link-btn" id="footTermsBtn">Términos</button>
        </div>
        <div style="font-size:.65rem;color:var(--t4);font-family:var(--mono)">v8.0 · BNB Chain</div>
      </div>
      <button class="adm-trigger" id="admTrigger">⚙</button>`;

    const admTrigger = document.getElementById('admTrigger');
    if (admTrigger) admTrigger.addEventListener('click', () => ADMIN.open());

    const termsBtn = document.getElementById('footTermsBtn');
    if (termsBtn) termsBtn.addEventListener('click', () => {
      if (typeof TERMS !== 'undefined') TERMS.show();
    });
  },

  init() {
    this.load().catch(() => this._renderFallback());
  },
};
