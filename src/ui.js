'use strict';
const UI = {
  /*
   * notif(type, title, msg, hash): Muestra una notificación toast.
   * type: 'ok' | 'err' | 'info'
   * hash: opcional — si se provee, muestra link a BscScan
   * Auto-descarta después de 5s (errores: 7s)
   * Máximo 4 notificaciones simultáneas
   */
  notif(type, title, msg, hash) {
    const stack = document.getElementById('notifStack');
    if (!stack) return;

    // Limitar stack a 4 notificaciones
    while (stack.children.length >= 4) stack.lastChild?.remove();

    const div = document.createElement('div');
    div.className = `notif notif-${type}`;

    const safeTitle = GUARDS.esc(String(title || ''));
    const safeMsg = GUARDS.esc(String(msg || ''));
    const safeHash = GUARDS.isValidHash(hash) ? hash : '';

    div.innerHTML = `
      <button class="notif-close" onclick="this.parentElement.remove()">✕</button>
      ${safeTitle ? `<div class="notif-title">${safeTitle}</div>` : ''}
      ${safeMsg ? `<div>${safeMsg}</div>` : ''}
      ${safeHash ? `<div class="notif-link" onclick="window.open('https://bscscan.com/tx/${GUARDS.esc(safeHash)}','_blank')">🔗 ${this.abbr(safeHash)}</div>` : ''}
    `;

    stack.prepend(div);
    const delay = type === 'err' ? 7000 : 5000;
    setTimeout(() => div.remove(), delay);
  },

  /*
   * renderTicker(price, change): Actualiza el ticker de precio BNB en el header.
   */
  renderTicker(price, change) {
    const tick = document.getElementById('bnbTick');
    const btPrice = document.getElementById('btPrice');
    const btChg = document.getElementById('btChg');
    if (!tick || !btPrice || !btChg) return;
    btPrice.textContent = '$' + price.toFixed(2);
    const chgNum = Number(change) || 0;
    btChg.textContent = (chgNum >= 0 ? '+' : '') + chgNum.toFixed(2) + '%';
    btChg.className = 'btchg ' + (chgNum >= 0 ? 'pos' : 'neg');
    tick.classList.add('tick-ready');
  },

  /*
   * renderLiqBar(): Actualiza la barra de liquidez del pool.
   * Porcentaje = poolBalance / poolMax
   * Si poolMax es 0 (nunca hubo balance), muestra 0%.
   */
  renderLiqBar() {
    const fill = document.getElementById('liqFill');
    const poolDisp = document.getElementById('poolDisp');
    if (!fill || !poolDisp) return;
    const pct = STATE.poolMax > 0 ? Math.min(100, (STATE.poolBalance / STATE.poolMax) * 100) : 0;
    fill.style.width = pct.toFixed(1) + '%';
    poolDisp.textContent = STATE.poolBalance.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + STATE.tokenSymbol;
  },

  /*
   * renderTxHist(): Renderiza el historial de transacciones.
   * Usa GUARDS.esc() para todos los valores dinámicos.
   * Links a BscScan solo si el hash es válido.
   */
  renderTxHist() {
    const list = document.getElementById('txHistList');
    if (!list) return;
    if (!STATE.txHistory.length) {
      list.innerHTML = `<div class="tx-empty" data-i18n="no_transactions">${t('no_transactions')}</div>`;
      return;
    }
    list.innerHTML = STATE.txHistory.map(tx => {
      const safeHash = GUARDS.isValidHash(tx.hash) ? tx.hash : '';
      const safeBnb = GUARDS.safePositive(tx.bnb, 0).toFixed(4);
      const safeTok = GUARDS.safePositive(tx.token, 0).toFixed(2);
      const safeTime = GUARDS.esc(tx.time || '');
      return `<div class="tx-item">
        <span class="tx-amt">+${GUARDS.esc(safeTok)} ${GUARDS.esc(STATE.tokenSymbol)}</span>
        <span style="color:var(--t3);font-family:var(--mono);font-size:.70rem">-${GUARDS.esc(safeBnb)} BNB</span>
        <span class="tx-time">${safeTime}</span>
        ${safeHash ? `<a href="https://bscscan.com/tx/${GUARDS.esc(safeHash)}" target="_blank" rel="noopener noreferrer">${this.abbr(safeHash)}</a>` : ''}
      </div>`;
    }).join('');
  },

  /*
   * abbr(addr): Abrevia una dirección o hash para mostrar.
   * Ejemplo: 0x1234...5678
   */
  abbr(addr) {
    const s = String(addr || '');
    if (s.length < 10) return GUARDS.esc(s);
    return GUARDS.esc(s.slice(0, 6) + '…' + s.slice(-4));
  },

  /*
   * fmtRate(r): Formatea la tasa de intercambio con precisión adaptativa.
   * Tasas altas (>100): 0 decimales
   * Tasas bajas (<0.01): 8 decimales
   */
  fmtRate(r) {
    const n = Number(r);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n >= 100) return n.toFixed(0);
    if (n >= 1) return n.toFixed(2);
    if (n >= 0.01) return n.toFixed(4);
    return n.toFixed(8);
  },
};


/* ══════════════════════════════════════════════════════════════
   MÓDULO: APP
   Propósito: Inicialización y orquestación de todos los módulos.
   Invariante: init() se llama UNA vez cuando el DOM está listo.
   Dependencias: Todos los módulos.
══════════════════════════════════════════════════════════════ */
