'use strict';

const ADMIN_STYLES = {
  _defaults: {
    primaryColor:   '#4f8dff',
    secondaryColor: '#a066ff',
    bgColor:        '#060810',
    textColor:      '#eef0f8',
    mode:           'dark',
    fontFamily:     'Inter',
    borderRadius:   14,
    shadowLevel:    2,
  },

  render() {
    const sec = document.getElementById('section-admin-styles');
    if (!sec) return;
    sec.innerHTML = `
      <div class="mi-section-card">
        <div class="mi-section-header">
          <span class="mi-section-icon">🎨</span>
          <div>
            <div class="mi-section-title">Estilos On-Chain</div>
            <div class="mi-section-sub">Personaliza los colores y tipografía de la plataforma</div>
          </div>
        </div>
        <div id="adminStylesNotConfigured" class="mi-notice mi-notice-warn" style="display:none">
          ⚠️ El contrato AdminConfig aún no ha sido deployado.
        </div>
        <div id="adminStylesForm">
          <div class="mi-field-grid">
            <div class="mi-field">
              <label class="mi-label">Color Primario</label>
              <div class="mi-color-wrap">
                <input type="color" id="asColorPrimary" value="${this._defaults.primaryColor}">
                <input type="text"  id="asColorPrimaryText" class="mi-input" value="${this._defaults.primaryColor}" maxlength="7">
              </div>
            </div>
            <div class="mi-field">
              <label class="mi-label">Color Secundario</label>
              <div class="mi-color-wrap">
                <input type="color" id="asColorSecondary" value="${this._defaults.secondaryColor}">
                <input type="text"  id="asColorSecondaryText" class="mi-input" value="${this._defaults.secondaryColor}" maxlength="7">
              </div>
            </div>
            <div class="mi-field">
              <label class="mi-label">Color de Fondo</label>
              <div class="mi-color-wrap">
                <input type="color" id="asColorBg" value="${this._defaults.bgColor}">
                <input type="text"  id="asColorBgText" class="mi-input" value="${this._defaults.bgColor}" maxlength="7">
              </div>
            </div>
            <div class="mi-field">
              <label class="mi-label">Color de Texto</label>
              <div class="mi-color-wrap">
                <input type="color" id="asColorText" value="${this._defaults.textColor}">
                <input type="text"  id="asColorTextText" class="mi-input" value="${this._defaults.textColor}" maxlength="7">
              </div>
            </div>
          </div>
          <div class="mi-field">
            <label class="mi-label">Modo</label>
            <select id="asMode" class="mi-select">
              <option value="dark" selected>Dark</option>
              <option value="medium">Medium</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div class="mi-field">
            <label class="mi-label">Tipografía</label>
            <select id="asFontFamily" class="mi-select">
              <option value="Inter" selected>Inter</option>
              <option value="Syne">Syne</option>
              <option value="IBM Plex Mono">IBM Plex Mono</option>
              <option value="system-ui">System UI</option>
            </select>
          </div>
          <div class="mi-field">
            <label class="mi-label">Radio de Bordes: <span id="asBorderRadiusVal">${this._defaults.borderRadius}</span>px</label>
            <input type="range" id="asBorderRadius" class="bridge-slider" min="0" max="32" value="${this._defaults.borderRadius}">
          </div>
          <div class="mi-field">
            <label class="mi-label">Nivel de Sombra: <span id="asShadowLevelVal">${this._defaults.shadowLevel}</span></label>
            <input type="range" id="asShadowLevel" class="bridge-slider" min="0" max="3" value="${this._defaults.shadowLevel}">
          </div>
          <div id="asStatusMsg" class="mi-status" style="display:none"></div>
          <div class="mi-btns-row">
            <button id="asApplyLocalBtn" class="btn btn-gl btn-sm">👁️ Preview</button>
            <button id="asSaveBtn" class="btn btn-iris">💾 Guardar On-Chain</button>
          </div>
        </div>
      </div>`;
    this._bindEvents();
  },

  _bindEvents() {
    // Sync color picker ↔ text
    [
      ['asColorPrimary', 'asColorPrimaryText'],
      ['asColorSecondary', 'asColorSecondaryText'],
      ['asColorBg', 'asColorBgText'],
      ['asColorText', 'asColorTextText'],
    ].forEach(([pickId, textId]) => {
      const pick = document.getElementById(pickId);
      const text = document.getElementById(textId);
      if (pick && text) {
        pick.addEventListener('input', () => { text.value = pick.value; });
        text.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(text.value)) pick.value = text.value; });
      }
    });
    const brSlider = document.getElementById('asBorderRadius');
    if (brSlider) brSlider.addEventListener('input', () => {
      document.getElementById('asBorderRadiusVal').textContent = brSlider.value;
    });
    const shSlider = document.getElementById('asShadowLevel');
    if (shSlider) shSlider.addEventListener('input', () => {
      document.getElementById('asShadowLevelVal').textContent = shSlider.value;
    });
    const previewBtn = document.getElementById('asApplyLocalBtn');
    if (previewBtn) previewBtn.addEventListener('click', () => this.applyLocally());
    const saveBtn = document.getElementById('asSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveOnChain());
  },

  _getValues() {
    return {
      primaryColor:   (document.getElementById('asColorPrimaryText')   || {}).value || this._defaults.primaryColor,
      secondaryColor: (document.getElementById('asColorSecondaryText') || {}).value || this._defaults.secondaryColor,
      bgColor:        (document.getElementById('asColorBgText')        || {}).value || this._defaults.bgColor,
      textColor:      (document.getElementById('asColorTextText')      || {}).value || this._defaults.textColor,
      mode:           (document.getElementById('asMode')               || {}).value || this._defaults.mode,
      fontFamily:     (document.getElementById('asFontFamily')         || {}).value || this._defaults.fontFamily,
      borderRadius:   parseInt((document.getElementById('asBorderRadius') || {}).value || this._defaults.borderRadius),
      shadowLevel:    parseInt((document.getElementById('asShadowLevel')  || {}).value || this._defaults.shadowLevel),
    };
  },

  applyLocally(vals) {
    const v = vals || this._getValues();
    const root = document.documentElement;
    // Validate hex color format before applying to prevent CSS injection
    const safeColor = c => /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : null;
    const safePx = n => (Number.isInteger(n) && n >= 0 && n <= 64) ? n + 'px' : null;
    const safeFontFamily = f => {
      const allowed = ['Inter', 'Syne', 'IBM Plex Mono', 'system-ui'];
      return allowed.includes(f) ? `'${f}', system-ui, sans-serif` : null;
    };
    const primary   = safeColor(v.primaryColor);
    const secondary = safeColor(v.secondaryColor);
    const bg        = safeColor(v.bgColor);
    const text      = safeColor(v.textColor);
    const radius    = safePx(v.borderRadius);
    const font      = safeFontFamily(v.fontFamily);
    if (primary)   root.style.setProperty('--ac',  primary);
    if (secondary) root.style.setProperty('--iris-a', secondary);
    if (bg)        root.style.setProperty('--bg',  bg);
    if (text)      root.style.setProperty('--t1',  text);
    if (radius)    root.style.setProperty('--r',   radius);
    if (font)      root.style.setProperty('--sans', font);
    const shMap = ['none', '0 2px 8px rgba(0,0,0,.4)', '0 4px 20px rgba(0,0,0,.5)', '0 16px 72px rgba(0,0,0,.72)'];
    const shadowLevel = Number.isInteger(v.shadowLevel) && v.shadowLevel >= 0 && v.shadowLevel <= 3 ? v.shadowLevel : 2;
    root.style.setProperty('--sh', shMap[shadowLevel]);
  },

  async loadFromChain() {
    if (!CONFIG.ADMIN_CONFIG_ADDRESS) return;
    try {
      const cfg = CHAIN.getAdminConfigReadContract();
      const res = await cfg.getStyleConfig();
      const vals = {
        primaryColor:   res.primaryColor   || this._defaults.primaryColor,
        secondaryColor: res.secondaryColor || this._defaults.secondaryColor,
        bgColor:        res.bgColor        || this._defaults.bgColor,
        textColor:      res.textColor      || this._defaults.textColor,
        mode:           res.mode           || this._defaults.mode,
        fontFamily:     res.fontFamily     || this._defaults.fontFamily,
        borderRadius:   Number(res.borderRadius) || this._defaults.borderRadius,
        shadowLevel:    Number(res.shadowLevel)  || this._defaults.shadowLevel,
      };
      this.applyLocally(vals);
    } catch (_) {}
  },

  _setStatus(msg, type) {
    const el = document.getElementById('asStatusMsg');
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
    const v   = this._getValues();
    const btn = document.getElementById('asSaveBtn');
    if (btn) btn.disabled = true;
    this._setStatus('Guardando en blockchain…', 'info');
    try {
      const cfg = await CHAIN.getAdminConfigWriteContract();
      const tx  = await cfg.setStyleConfig(
        v.primaryColor, v.secondaryColor, v.bgColor, v.textColor,
        v.mode, v.fontFamily, v.borderRadius, v.shadowLevel
      );
      await tx.wait();
      this.applyLocally(v);
      this._setStatus('✅ Estilos guardados on-chain.', 'ok');
    } catch (err) {
      this._setStatus(`Error: ${err?.reason || err?.message || err}`, 'err');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  init() {
    this.render();
    if (!CONFIG.ADMIN_CONFIG_ADDRESS) {
      const notif = document.getElementById('adminStylesNotConfigured');
      if (notif) notif.style.display = 'flex';
    }
    this.loadFromChain().catch(() => {});
  },
};
