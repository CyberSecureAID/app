'use strict';

const ABOUT = {
  _defaultText: 'MiSwap es una plataforma 100% descentralizada construida sobre BNB Smart Chain que brinda oportunidades únicas de adquirir tokens exclusivos a precios flexibles. Nuestra misión es democratizar el acceso a proyectos emergentes sin barreras de entrada. No requerimos registro ni KYC, respetando tu privacidad y autonomía. El sistema es intuitivo y está diseñado para usuarios de todos los niveles.',

  render() {
    const sec = document.getElementById('section-about');
    if (!sec) return;
    sec.innerHTML = `
      <div class="mi-section-card">
        <div class="mi-section-header">
          <span class="mi-section-icon">🏦</span>
          <div>
            <div class="mi-section-title">Quiénes Somos</div>
          </div>
        </div>
        <div id="aboutText" class="about-text"></div>
      </div>`;
    // Use textContent for safe insertion of default text
    const aboutEl = document.getElementById('aboutText');
    if (aboutEl) aboutEl.textContent = this._defaultText;
    this._loadText();
  },

  async _loadText() {
    const el = document.getElementById('aboutText');
    if (!el) return;
    if (!CONFIG.ADMIN_CONFIG_ADDRESS) return;
    try {
      const cfg = CHAIN.getAdminConfigReadContract();
      const res = await cfg.getContentConfig();
      if (res.aboutText) el.textContent = res.aboutText;
    } catch (_) {}
  },

  init() {
    this.render();
  },
};
