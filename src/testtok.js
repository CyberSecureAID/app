'use strict';
const TESTTOK = {
  _count: 0,          // Rate limit de sesión
  _checkedCache: {},  // Cache de hasUsedTest() positivos

  /*
   * _sanitizeError(e): Extrae solo el mensaje de error legible y seguro.
   * Nunca expone datos crudos de la tx (addresses, calldata, stack traces).
   * Compatible con ethers v6: CALL_EXCEPTION incluye datos de tx completos
   * en e.message — se filtra explícitamente para no exponerlos.
   */
  _sanitizeError(e) {
    // 1. e.reason — revert string del contrato, siempre seguro
    if (e?.reason && typeof e.reason === 'string' && e.reason.trim()) return e.reason.trim();
    // 2. e.shortMessage — mensaje corto de ethers v6, sin datos de tx
    if (e?.shortMessage && typeof e.shortMessage === 'string' && e.shortMessage.trim()) return e.shortMessage.trim();
    // 3. e.data?.message — algunos proveedores lo incluyen sin datos crudos
    if (e?.data?.message && typeof e.data.message === 'string') return e.data.message.trim();
    // 4. e.code conocido sin mensaje seguro
    if (e?.code === 'CALL_EXCEPTION') return 'Transaction reverted. The contract rejected this operation.';
    if (e?.code === 'NETWORK_ERROR' || e?.code === 'SERVER_ERROR') return 'Network error. Check your connection and try again.';
    if (e?.code === 'INSUFFICIENT_FUNDS') return 'Insufficient funds for gas.';
    if (e?.code === 'UNPREDICTABLE_GAS_LIMIT') return 'Could not estimate gas. The contract may have rejected this operation.';
    // 5. e.message — solo si es corto y no contiene "0x" (datos crudos de tx)
    const raw = e?.message || '';
    if (raw && raw.length < 120 && !raw.includes('0x') && !raw.includes('"from"') && !raw.includes('"to"') && !raw.includes('transaction=')) {
      return raw;
    }
    // 6. Fallback genérico — nunca exponer datos de la tx
    return 'Transaction failed. Please try again.';
  },

  openOverlay() { document.getElementById('secOverlay').classList.add('open'); },
  closeOverlay() {
    document.getElementById('secOverlay').classList.remove('open');
    const res = document.getElementById('secResult');
    if (res) { res.classList.remove('show'); res.style.background = ''; res.style.borderColor = ''; res.innerHTML = ''; }
    const inp = document.getElementById('secAddr'); if (inp) inp.value = '';
    const btn = document.getElementById('verifyBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = `<span data-i18n="verify">${t('verify')}</span>`; }
  },

  async _hasUsed(addr) {
    const key = addr.toLowerCase();
    if (this._checkedCache[key] === true) return true;
    try {
      const c = CHAIN.getReadContract();
      const used = await c.hasUsedTest(addr);
      if (used) this._checkedCache[key] = true;
      return used;
    } catch (_) {
      // Si el contrato no tiene la función, fallback al cache local
      return STATE.securityUsed.has(key);
    }
  },

  async send() {
    const addr = document.getElementById('secAddr')?.value.trim();

    // Validaciones pre-envío
    if (!addr || !GUARDS.isValidAddr(addr)) {
      UI.notif('err', 'Invalid Address', 'Enter a valid BSC address (0x + 40 hex chars)');
      return;
    }
    if (!STATE.walletConnected) {
      UI.notif('err', 'No Wallet', 'Connect your wallet first to send the test token');
      return;
    }
    if (STATE.poolBalance < 1) {
      UI.notif('err', 'Empty Pool', 'No tokens available in pool');
      return;
    }
    if (this._count >= 5) {
      UI.notif('err', 'Rate Limited', 'Too many requests this session');
      return;
    }

    const btn = document.getElementById('verifyBtn');
    if (btn) btn.disabled = true;
    const _setBtnText = txt => { if (!btn) return; const sp = btn.querySelector('span'); if (sp) sp.textContent = txt; else btn.textContent = txt; };
    _setBtnText('Checking…');

    // Verificar onchain si ya usó el test token
    const alreadyUsed = await this._hasUsed(addr);
    if (alreadyUsed) {
      if (btn) { btn.disabled = false; btn.innerHTML = `<span data-i18n="verify">${t('verify')}</span>`; }
      STATE.securityUsed.add(addr.toLowerCase());
      UI.notif('err', 'Already Claimed', `Wallet ${UI.abbr(addr)} already received a test token. Registered on-chain.`);
      const res = document.getElementById('secResult');
      if (res) {
        res.style.background = 'var(--er-dim)';
        res.style.borderColor = 'rgba(247,108,108,.25)';
        res.innerHTML = `<p>🚫 <strong>This wallet already claimed its test token.</strong></p>
          <p style="margin-top:6px;font-size:.75rem;color:var(--t3)">The contract permanently records each claim. Wallet <code style="color:var(--ac)">${GUARDS.esc(addr)}</code> cannot receive another free test token.</p>`;
        res.classList.add('show');
      }
      return;
    }

    this._count++;
    _setBtnText('Sending…');

    try {
      const cw = await CHAIN.getWriteContract();
      UI.notif('info', 'Sending test token…', 'Confirm in your wallet');
      const tx = await cw.sendTestToken(addr);
      const receipt = await tx.wait();

      // Marcar en ambos caches
      STATE.securityUsed.add(addr.toLowerCase());
      this._checkedCache[addr.toLowerCase()] = true;

      await STATS.load();

      const safeHash = GUARDS.isValidHash(receipt.hash) ? receipt.hash : '';
      const res = document.getElementById('secResult');
      if (res) {
        res.style.background = '';
        res.style.borderColor = '';
        res.innerHTML = `<p>✅ <strong>${t('test_token_sent')}</strong></p>
          <p style="margin-top:6px;font-size:.75rem;color:var(--t3)">1 ${GUARDS.esc(STATE.tokenSymbol)} → <code style="color:var(--ac)">${GUARDS.esc(addr)}</code><br>This wallet is now registered on-chain.</p>
          <span style="font-size:.73rem;color:var(--t3)">${t('tx_hash')}</span><br>
          ${safeHash ? `<a href="https://bscscan.com/tx/${GUARDS.esc(safeHash)}" target="_blank" rel="noopener noreferrer">${UI.abbr(safeHash)}</a>` : '<span style="color:var(--er)">hash unavailable</span>'}`;
        res.classList.add('show');
      }
      UI.notif('ok', t('test_token_sent'), `1 ${STATE.tokenSymbol} → ${UI.abbr(addr)}`, safeHash);

    } catch (e) {
      if (btn) btn.disabled = false;
      this._count = Math.max(0, this._count - 1);
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') {
        UI.notif('err', t('tx_rejected'), '');
      } else {
        // Extraer solo el motivo legible — NUNCA exponer datos de tx crudos
        // e.reason y e.shortMessage son seguros; e.message puede contener
        // datos sensibles de la transacción (addresses, tx data) — se filtra.
        const safeReason = TESTTOK._sanitizeError(e);
        if (safeReason.toLowerCase().includes('already') || safeReason.toLowerCase().includes('used')) {
          this._checkedCache[addr.toLowerCase()] = true;
          STATE.securityUsed.add(addr.toLowerCase());
          UI.notif('err', 'Already Claimed', `Wallet ${UI.abbr(addr)} already received a test token.`);
        } else {
          UI.notif('err', 'Test token failed', safeReason);
        }
      }
    } finally {
      const finalBtn = document.getElementById('verifyBtn');
      if (finalBtn) {
        finalBtn.disabled = false;
        finalBtn.innerHTML = `<span data-i18n="verify">${t('verify')}</span>`;
      }
    }
  },
};


/* ══════════════════════════════════════════════════════════════
   MÓDULO: ADMIN
   Propósito: Panel administrativo para gestión del contrato.
   Funcionalidades: Actualizar precio, depositar/retirar tokens,
     cambiar branding y dirección de contrato.
   
   Invariante:
     - TODA acción admin verifica isAdmin() antes de ejecutar
     - El contrato tiene onlyOwner — el panel admin solo es UX
     - Las operaciones de depósito siguen el patrón approve → deposit
   
   Seguridad:
     - isAdmin() se verifica en cada acción (no solo al abrir)
     - La dirección del contrato se valida antes de usarse
     - Los montos se validan antes de convertir a Wei
   
   Dependencias: CHAIN, STATE, STATS, UI, GUARDS, WALLET.
══════════════════════════════════════════════════════════════ */
