'use strict';

/* ══════════════════════════════════════════════════════════════
   MÓDULO: ADMIN_CONTENT  v2.0
   FIX #3: Todo editable desde panel administrativo.
   Agrega gestión de contenido del footer (About, Disclaimer, Terms).
   FIX #7: Infraestructura real — guarda onchain en AdminConfig.
══════════════════════════════════════════════════════════════ */

const ADMIN_CONTENT = {

  render() {
    const sec = document.getElementById('section-admin-content');
    if (!sec) return;
    sec.innerHTML = `
      <div class="mi-section-card">
        <div class="mi-section-header">
          <span class="mi-section-icon">📝</span>
          <div>
            <div class="mi-section-title">Contenidos On-Chain</div>
            <div class="mi-section-sub">Edita los textos legales, de presentación y del pie de página</div>
          </div>
        </div>
        <div id="adminContentNotConfigured" class="mi-notice mi-notice-warn" style="display:none">
          ⚠️ El contrato AdminConfig aún no ha sido deployado. Los cambios se guardan localmente hasta el deploy.
        </div>

        <!-- Sección: Términos y Condiciones -->
        <div class="ac-section-block">
          <div class="ac-block-title">📜 Términos y Condiciones</div>
          <div class="mi-field">
            <label class="mi-label">Título</label>
            <input type="text" id="acTermsTitle" class="mi-input" placeholder="Terms &amp; Conditions" value="Terms &amp; Conditions">
          </div>
          <div class="mi-field">
            <label class="mi-label">Contenido</label>
            <textarea id="acTermsText" class="mi-textarea" rows="5" placeholder="Escribe los términos y condiciones…"></textarea>
          </div>
        </div>

        <!-- Sección: Aviso de Riesgo / Descargo -->
        <div class="ac-section-block">
          <div class="ac-block-title">⚠️ Descargo de Responsabilidad</div>
          <div class="mi-field">
            <label class="mi-label">Título</label>
            <input type="text" id="acRiskTitle" class="mi-input" placeholder="Disclaimer" value="Disclaimer">
          </div>
          <div class="mi-field">
            <label class="mi-label">Contenido</label>
            <textarea id="acRiskText" class="mi-textarea" rows="4" placeholder="Escribe el aviso de riesgo…"></textarea>
          </div>
        </div>

        <!-- Sección: Quiénes Somos / About -->
        <div class="ac-section-block">
          <div class="ac-block-title">🏦 Quiénes Somos / About Us</div>
          <div class="mi-field">
            <label class="mi-label">Título</label>
            <input type="text" id="acAboutTitle" class="mi-input" placeholder="About Us" value="About Us">
          </div>
          <div class="mi-field">
            <label class="mi-label">Contenido</label>
            <textarea id="acAboutText" class="mi-textarea" rows="5" placeholder="Escribe la sección 'Quiénes Somos'…"></textarea>
          </div>
        </div>

        <!-- Previsualización -->
        <div style="background:var(--inset);border:1px solid var(--glass-brd);border-radius:var(--r-sm);padding:12px;margin-bottom:14px">
          <div style="font-size:.72rem;color:var(--t3);margin-bottom:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">
            👁️ Vista previa del footer
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button class="btn btn-gl btn-sm" onclick="ADMIN_CONTENT._previewModal('about')">About Us</button>
            <button class="btn btn-gl btn-sm" onclick="ADMIN_CONTENT._previewModal('disclaimer')">Disclaimer</button>
            <button class="btn btn-gl btn-sm" onclick="ADMIN_CONTENT._previewModal('terms')">Terms</button>
          </div>
        </div>

        <div id="acStatusMsg" class="mi-status" style="display:none"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="acSaveLocalBtn" class="btn btn-gl" onclick="ADMIN_CONTENT.saveLocally()">💾 Guardar Localmente</button>
          <button id="acSaveBtn" class="btn btn-iris" onclick="ADMIN_CONTENT.saveOnChain()">⛓ Guardar On-Chain</button>
        </div>
      </div>`;

    this.loadFromChain().catch(() => {});
    this._loadLocalDefaults();
  },

  // ── Cargar defaults locales del módulo FOOTER ─────────────────────────────
  _loadLocalDefaults() {
    if (typeof FOOTER === 'undefined') return;
    const defaults = FOOTER._defaults;
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && !el.value && val) el.value = val;
    };
    setVal('acAboutTitle',  defaults.aboutTitle);
    setVal('acAboutText',   defaults.aboutText);
    setVal('acRiskTitle',   defaults.disclaimerTitle);
    setVal('acRiskText',    defaults.disclaimerText);
    setVal('acTermsTitle',  defaults.termsTitle);
    setVal('acTermsText',   defaults.termsText);
  },

  // ── Previsualizar modal ───────────────────────────────────────────────────
  _previewModal(type) {
    let title = '', body = '';
    if (type === 'about') {
      title = document.getElementById('acAboutTitle')?.value || 'About Us';
      body  = document.getElementById('acAboutText')?.value  || '';
    } else if (type === 'disclaimer') {
      title = document.getElementById('acRiskTitle')?.value || 'Disclaimer';
      body  = document.getElementById('acRiskText')?.value  || '';
    } else if (type === 'terms') {
      title = document.getElementById('acTermsTitle')?.value || 'Terms & Conditions';
      body  = document.getElementById('acTermsText')?.value  || '';
    }

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
    document.getElementById('footerModalTitle').textContent = title;
    document.getElementById('footerModalBody').textContent  = body;
    overlay.classList.add('open');
  },

  async loadFromChain() {
    const hasContract = !!(CONFIG.ADMIN_CONFIG_ADDRESS);
    const notif = document.getElementById('adminContentNotConfigured');

    if (!hasContract) {
      if (notif) notif.style.display = 'flex';
      return;
    }

    try {
      const cfg = CHAIN.getAdminConfigReadContract();
      const res = await cfg.getContentConfig();
      const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      setVal('acTermsText',  res.termsText);
      setVal('acRiskText',   res.riskText);
      setVal('acAboutText',  res.aboutText);
      // Invalidar cache de FOOTER para que recargue
      if (typeof FOOTER !== 'undefined') FOOTER.invalidateCache();
    } catch (_) {}
  },

  _setStatus(msg, type) {
    const el = document.getElementById('acStatusMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mi-status mi-status-' + (type || 'info');
    el.style.display = msg ? 'block' : 'none';
  },

  // ── Guardar localmente en STATE (sin tx) ──────────────────────────────────
  saveLocally() {
    const getVal = id => (document.getElementById(id) || {}).value || '';
    STATE.footerConfig = {
      aboutTitle:      getVal('acAboutTitle'),
      aboutText:       getVal('acAboutText'),
      disclaimerTitle: getVal('acRiskTitle'),
      disclaimerText:  getVal('acRiskText'),
      termsTitle:      getVal('acTermsTitle'),
      termsText:       getVal('acTermsText'),
    };
    // Invalidar cache de FOOTER
    if (typeof FOOTER !== 'undefined') FOOTER.invalidateCache();
    this._setStatus('✅ Contenidos guardados localmente. Se aplicarán en el footer.', 'ok');
    setTimeout(() => this._setStatus('', ''), 4000);
  },

  async saveOnChain() {
    if (!CONFIG.ADMIN_CONFIG_ADDRESS) {
      // Guardar localmente si no hay contrato
      this.saveLocally();
      this._setStatus('ℹ El contrato AdminConfig no está deployado. Contenido guardado localmente.', 'warn');
      return;
    }
    if (!STATE.walletConnected) { this._setStatus('Conecta tu wallet.', 'warn'); return; }

    const terms = (document.getElementById('acTermsText') || {}).value || '';
    const risk  = (document.getElementById('acRiskText')  || {}).value || '';
    const about = (document.getElementById('acAboutText') || {}).value || '';
    const btn   = document.getElementById('acSaveBtn');
    if (btn) btn.disabled = true;
    this._setStatus('Guardando en blockchain…', 'info');
    try {
      const cfg = await CHAIN.getAdminConfigWriteContract();
      const tx  = await cfg.setContentConfig(terms, risk, about);
      await tx.wait();
      // Guardar también localmente
      this.saveLocally();
      // Invalidar cache
      if (typeof FOOTER !== 'undefined') FOOTER.invalidateCache();
      this._setStatus('✅ Contenidos guardados on-chain y localmente.', 'ok');
    } catch (err) {
      this._setStatus(`Error: ${err?.reason || err?.message || err}`, 'err');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  init() {
    this.render();
  },
};
