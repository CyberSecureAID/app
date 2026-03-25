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

  _renderFallback() {
    const foot = document.getElementById('dynamicFooter');
    if (!foot) return;
    if (this._fallback) { foot.innerHTML = this._fallback; return; }
    foot.innerHTML = `
      <div class="foot-main">
        <span id="footPlatformName">MiSwap</span>
        <span class="foot-sep">·</span>
        <span>BSC Mainnet</span>
        <span class="foot-sep">·</span>
        <span data-i18n="all_rights">All rights reserved</span>
        <span class="foot-sep">·</span>
        <button class="foot-link-btn" id="footTermsBtn" data-i18n="terms_link">Términos</button>
      </div>
      <button class="adm-trigger" id="admTrigger">⚙</button>`;
    LANG.apply();
    // Re-bind admin trigger
    const admTrigger = document.getElementById('admTrigger');
    if (admTrigger) admTrigger.addEventListener('click', () => ADMIN.open());
    const termsBtn = document.getElementById('footTermsBtn');
    if (termsBtn) termsBtn.addEventListener('click', () => TERMS.show());
  },

  _renderDynamic(res) {
    const foot = document.getElementById('dynamicFooter');
    if (!foot) return;

    // HTML-escape helper to prevent XSS from on-chain data
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    // URL validator — allow only http/https links
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
    let extraHtml = '';
    if (res.extraLinks) {
      try {
        const links = JSON.parse(res.extraLinks);
        extraHtml = Object.entries(links).map(([name, url]) =>
          `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer" class="foot-link">${esc(name)}</a>`
        ).join('');
      } catch (_) {}
    }
    const footerText = esc(res.footerText || 'MiSwap');
    foot.innerHTML = `
      <div class="foot-main">
        <span>${footerText}</span>
        ${socialHtml ? `<span class="foot-sep">·</span>${socialHtml}` : ''}
        ${extraHtml  ? `<span class="foot-sep">·</span>${extraHtml}` : ''}
        <span class="foot-sep">·</span>
        <button class="foot-link-btn" id="footTermsBtn" data-i18n="terms_link">Terms</button>
      </div>
      <button class="adm-trigger" id="admTrigger">⚙</button>`;
    const admTrigger = document.getElementById('admTrigger');
    if (admTrigger) admTrigger.addEventListener('click', () => ADMIN.open());
    const termsBtn = document.getElementById('footTermsBtn');
    if (termsBtn) termsBtn.addEventListener('click', () => TERMS.show());
  },

  init() {
    this.load().catch(() => this._renderFallback());
  },
};
