'use strict';

const TOKEN_CREATOR = {
  _iconBase64: '',

  /*
   * render(): Inyecta el formulario HTML en #section-create-token.
   */
  render() {
    const sec = document.getElementById('section-create-token');
    if (!sec) return;
    sec.innerHTML = `
      <div class="mi-section-card">
        <div class="mi-section-header">
          <div>
            <div class="mi-section-title" data-i18n="create_token_title">Crear Token BEP20</div>
            <div class="mi-section-sub" data-i18n="create_token_sub">Despliega tu propio token en BNB Smart Chain</div>
          </div>
        </div>
        <div id="tokenCreatorNotConfigured" class="mi-notice mi-notice-warn" style="display:none">
          <span data-i18n="contract_not_configured">El contrato aún no ha sido deployado. Funcionalidad disponible próximamente.</span>
        </div>
        <div id="tokenCreatorForm">
          <div class="mi-fee-banner">
            <span data-i18n="creation_fee">Fee de creación:</span>
            <strong>${CONFIG.TOKEN_CREATION_FEE_BNB} BNB</strong>
            <span class="mi-fee-note" data-i18n="plus_gas">+ gas estimado</span>
          </div>
          <div class="mi-field">
            <label class="mi-label" data-i18n="token_name_label">Nombre del Token</label>
            <input type="text" id="tcName" class="mi-input" placeholder="Ej: Mi Token" maxlength="50">
            <div class="mi-hint" data-i18n="token_name_hint">2–50 caracteres</div>
          </div>
          <div class="mi-field">
            <label class="mi-label" data-i18n="token_symbol_label">Símbolo</label>
            <input type="text" id="tcSymbol" class="mi-input" placeholder="Ej: MTK" maxlength="8" style="text-transform:uppercase">
            <div class="mi-hint" data-i18n="token_symbol_hint">2–8 caracteres, solo letras</div>
          </div>
          <div class="mi-field">
            <label class="mi-label" data-i18n="token_supply_label">Supply Total</label>
            <input type="number" id="tcSupply" class="mi-input" placeholder="Ej: 1000000" min="1" max="1000000000000">
            <div class="mi-hint" data-i18n="token_supply_hint">1 – 1,000,000,000,000</div>
          </div>
          <div class="mi-field mi-field-row">
            <label class="mi-checkbox-wrap">
              <input type="checkbox" id="tcBridge">
              <span class="mi-checkbox-label" data-i18n="enable_bridge">Habilitar Bridge a USDT</span>
            </label>
          </div>
          <div class="mi-field">
            <label class="mi-label" data-i18n="token_icon_label">Ícono del Token</label>
            <div class="mi-file-wrap">
              <label class="mi-file-btn" for="tcIconFile">
                <span data-i18n="choose_file">Elegir imagen</span>
              </label>
              <input type="file" id="tcIconFile" accept="image/png,image/svg+xml,image/jpeg,image/webp" style="display:none">
              <span id="tcIconFileName" class="mi-file-name">—</span>
            </div>
            <div id="tcIconWarn" class="mi-notice mi-notice-warn" style="display:none">
              <span data-i18n="icon_gas_warning">La imagen supera 50KB. El gas será más alto.</span>
            </div>
            <div id="tcIconPreview" class="mi-icon-preview"></div>
          </div>
          <div id="tcValidationMsg" class="mi-notice mi-notice-err" style="display:none"></div>
          <button id="tcCreateBtn" class="btn btn-iris btn-full btn-lg mt10" data-i18n="create_token_btn">
            Crear Token
          </button>
          <div id="tcStatusMsg" class="mi-status" style="display:none"></div>
        </div>
      </div>`;
    this._bindEvents();
    LANG.apply();
  },

  _bindEvents() {
    const iconFile = document.getElementById('tcIconFile');
    if (iconFile) {
      iconFile.addEventListener('change', e => this._onIconChange(e.target.files[0]));
    }
    const nameInp = document.getElementById('tcName');
    if (nameInp) nameInp.addEventListener('input', () => this._symbolSuggest());
    const symInp = document.getElementById('tcSymbol');
    if (symInp) symInp.addEventListener('input', function() { this.value = this.value.toUpperCase(); });
    const btn = document.getElementById('tcCreateBtn');
    if (btn) btn.addEventListener('click', () => this.create());
  },

  _symbolSuggest() {
    const nameEl = document.getElementById('tcName');
    const symEl  = document.getElementById('tcSymbol');
    if (!nameEl || !symEl || symEl.value) return;
    const words = nameEl.value.trim().split(/\s+/);
    const auto  = words.map(w => w[0] || '').join('').toUpperCase().slice(0, 5);
    if (auto.length >= 2) symEl.value = auto;
  },

  async _onIconChange(file) {
    const nameEl = document.getElementById('tcIconFileName');
    const warnEl = document.getElementById('tcIconWarn');
    const prevEl = document.getElementById('tcIconPreview');
    if (!file) { this._iconBase64 = ''; return; }
    try {
      const b64 = await TOKEN_ICONS.loadIcon(file);
      this._iconBase64 = b64;
      if (nameEl) nameEl.textContent = file.name;
      if (warnEl) warnEl.style.display = TOKEN_ICONS.isLargeIcon(b64) ? 'flex' : 'none';
      TOKEN_ICONS.renderPreview(b64, prevEl);
    } catch (err) {
      this._iconBase64 = '';
      if (nameEl) nameEl.textContent = '—';
      this._setStatus(err.message, 'err');
    }
  },

  _validate() {
    const name   = (document.getElementById('tcName')   || {}).value || '';
    const symbol = (document.getElementById('tcSymbol') || {}).value || '';
    const supply = (document.getElementById('tcSupply') || {}).value || '';
    if (name.trim().length < 2 || name.trim().length > 50) {
      return 'El nombre debe tener entre 2 y 50 caracteres.';
    }
    if (!/^[A-Za-z]{2,8}$/.test(symbol)) {
      return 'El símbolo debe tener 2–8 letras (sin números ni símbolos).';
    }
    const supplyNum = Number(supply);
    if (!Number.isFinite(supplyNum) || supplyNum < 1 || supplyNum > 1_000_000_000_000) {
      return 'El supply debe estar entre 1 y 1,000,000,000,000.';
    }
    return null;
  },

  _setStatus(msg, type) {
    const el = document.getElementById('tcStatusMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mi-status mi-status-' + (type || 'info');
    el.style.display = msg ? 'block' : 'none';
  },

  _setValidation(msg) {
    const el = document.getElementById('tcValidationMsg');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'flex' : 'none';
  },

  async create() {
    // Verificar contrato configurado
    if (!CONFIG.TOKEN_FACTORY_ADDRESS) {
      this._setStatus('El contrato aún no ha sido deployado. Funcionalidad disponible próximamente.', 'warn');
      return;
    }
    // Verificar wallet conectada
    if (typeof STATE === 'undefined' || !STATE.walletConnected) {
      this._setStatus('Conecta tu wallet para continuar.', 'warn');
      return;
    }
    // Verificar risk aceptado
    if (typeof RISK !== 'undefined' && !RISK.isAccepted()) {
      RISK.show(() => this.create());
      return;
    }
    const errMsg = this._validate();
    if (errMsg) { this._setValidation(errMsg); return; }
    this._setValidation('');

    const name   = document.getElementById('tcName').value.trim();
    const symbol = document.getElementById('tcSymbol').value.toUpperCase();
    const supply = document.getElementById('tcSupply').value;
    const bridge = !!(document.getElementById('tcBridge') || {}).checked;
    const icon   = this._iconBase64 || '';

    const btn = document.getElementById('tcCreateBtn');
    if (btn) btn.disabled = true;
    this._setStatus('Esperando confirmación en wallet…', 'info');

    try {
      const contract = await CHAIN.getTokenFactoryWriteContract();
      const fee = ethers.parseEther(CONFIG.TOKEN_CREATION_FEE_BNB);
      const tx  = await contract.createToken(name, symbol, supply, bridge, icon, { value: fee });
      this._setStatus('Transacción enviada. Esperando confirmación…', 'info');
      const receipt = await tx.wait();
      const tokenAddr = receipt?.logs?.[0]?.address || '';
      if (tokenAddr && icon) TOKEN_ICONS.setTokenIcon(tokenAddr, icon);
      this._setStatus(`✅ Token ${symbol} creado exitosamente!`, 'ok');
      // Limpiar formulario
      ['tcName', 'tcSymbol', 'tcSupply'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      const chk = document.getElementById('tcBridge'); if (chk) chk.checked = false;
      this._iconBase64 = '';
      TOKEN_ICONS.renderPreview('', document.getElementById('tcIconPreview'));
    } catch (err) {
      const msg = err?.reason || err?.message || 'Error desconocido';
      if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED')) {
        this._setStatus('Rechazado por el usuario.', 'warn');
      } else if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) {
        this._setStatus(`BNB insuficiente. Necesitas al menos ${CONFIG.TOKEN_CREATION_FEE_BNB} BNB para cubrir el fee y el gas.`, 'err');
      } else {
        this._setStatus(`Transacción fallida. ${msg}. Intenta de nuevo.`, 'err');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  init() {
    this.render();
    if (!CONFIG.TOKEN_FACTORY_ADDRESS) {
      const notif = document.getElementById('tokenCreatorNotConfigured');
      if (notif) notif.style.display = 'flex';
    }
  },
};
