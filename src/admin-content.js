'use strict';

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
            <div class="mi-section-sub">Edita los textos legales y de presentación</div>
          </div>
        </div>
        <div id="adminContentNotConfigured" class="mi-notice mi-notice-warn" style="display:none">
          ⚠️ El contrato AdminConfig aún no ha sido deployado.
        </div>
        <div class="mi-field">
          <label class="mi-label">Términos y Condiciones</label>
          <textarea id="acTermsText" class="mi-textarea" rows="6" placeholder="Escribe los términos y condiciones…"></textarea>
        </div>
        <div class="mi-field">
          <label class="mi-label">Aviso de Riesgo</label>
          <textarea id="acRiskText" class="mi-textarea" rows="4" placeholder="Escribe el aviso de riesgo…"></textarea>
        </div>
        <div class="mi-field">
          <label class="mi-label">Quiénes Somos</label>
          <textarea id="acAboutText" class="mi-textarea" rows="5" placeholder="Escribe la sección 'Quiénes Somos'…"></textarea>
        </div>
        <div id="acStatusMsg" class="mi-status" style="display:none"></div>
        <button id="acSaveBtn" class="btn btn-iris btn-full mt10">💾 Guardar On-Chain</button>
      </div>`;
    const btn = document.getElementById('acSaveBtn');
    if (btn) btn.addEventListener('click', () => this.saveOnChain());
    this.loadFromChain().catch(() => {});
  },

  async loadFromChain() {
    if (!CONFIG.ADMIN_CONFIG_ADDRESS) return;
    try {
      const cfg = CHAIN.getAdminConfigReadContract();
      const res = await cfg.getContentConfig();
      const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      setVal('acTermsText', res.termsText);
      setVal('acRiskText',  res.riskText);
      setVal('acAboutText', res.aboutText);
    } catch (_) {}
  },

  _setStatus(msg, type) {
    const el = document.getElementById('acStatusMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mi-status mi-status-' + (type || 'info');
    el.style.display = msg ? 'block' : 'none';
  },

  async saveOnChain() {
    if (!CONFIG.ADMIN_CONFIG_ADDRESS) {
      this._setStatus('El contrato AdminConfig aún no ha sido deployado.', 'warn');
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
      this._setStatus('✅ Contenidos guardados on-chain.', 'ok');
    } catch (err) {
      this._setStatus(`Error: ${err?.reason || err?.message || err}`, 'err');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  init() {
    this.render();
    if (!CONFIG.ADMIN_CONFIG_ADDRESS) {
      const notif = document.getElementById('adminContentNotConfigured');
      if (notif) notif.style.display = 'flex';
    }
  },
};
