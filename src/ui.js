'use strict';

/*
 * SECURITY AUDIT — ui.js
 *
 * VULNERABILITIES FIXED:
 *
 * All BscScan link hrefs now use GUARDS.safeUrl() instead of
 * direct string concatenation. Previously:
 *   href="https://bscscan.com/tx/${hash}"
 * was safe only if GUARDS.isValidHash() was called first.
 * Using safeUrl() makes the validation inseparable from the URL.
 *
 * onclick handlers in notif() that constructed BscScan URLs
 * from hashes via template literals in innerHTML have been
 * replaced with DOM-constructed elements and addEventListener.
 */
const UI = {
  /*
   * notif(type, title, msg, hash): Shows a toast notification.
   * type: 'ok' | 'err' | 'info'
   * hash: optional — if valid, shows a BscScan link
   */
  notif(type, title, msg, hash) {
    const stack = document.getElementById('notifStack');
    if (!stack) return;

    while (stack.children.length >= 4) stack.lastChild?.remove();

    const div = document.createElement('div');
    div.className = 'notif notif-' + type;

    // Close button — DOM, not innerHTML
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notif-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => div.remove());
    div.appendChild(closeBtn);

    // Title — textContent only
    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'notif-title';
      titleEl.textContent = String(title);
      div.appendChild(titleEl);
    }

    // Message — textContent only
    if (msg) {
      const msgEl = document.createElement('div');
      msgEl.textContent = String(msg);
      div.appendChild(msgEl);
    }

    // BscScan link — safeUrl() validates hash before building href
    const txUrl = GUARDS.safeUrl(hash, 'bscscan-tx');
    if (txUrl) {
      const link = document.createElement('div');
      link.className = 'notif-link';
      link.textContent = '🔗 ' + this.abbr(hash);
      link.style.cursor = 'pointer';
      link.addEventListener('click', () => window.open(txUrl, '_blank', 'noopener,noreferrer'));
      div.appendChild(link);
    }

    stack.prepend(div);
    const delay = type === 'err' ? 7000 : 5000;
    setTimeout(() => div.remove(), delay);
  },

  /*
   * renderTicker: Updates the BNB price ticker in the header.
   */
  renderTicker(price, change) {
    const tick    = document.getElementById('bnbTick');
    const btPrice = document.getElementById('btPrice');
    const btChg   = document.getElementById('btChg');
    if (!tick || !btPrice || !btChg) return;
    btPrice.textContent = '$' + price.toFixed(2);
    const chgNum = Number(change) || 0;
    btChg.textContent = (chgNum >= 0 ? '+' : '') + chgNum.toFixed(2) + '%';
    btChg.className = 'btchg ' + (chgNum >= 0 ? 'pos' : 'neg');
    tick.classList.add('tick-ready');
  },

  /*
   * renderLiqBar: Updates the pool liquidity bar.
   */
  renderLiqBar() {
    const fill    = document.getElementById('liqFill');
    const poolDisp = document.getElementById('poolDisp');
    if (!fill || !poolDisp) return;
    const pct = STATE.poolMax > 0
      ? Math.min(100, (STATE.poolBalance / STATE.poolMax) * 100)
      : 0;
    fill.style.width = pct.toFixed(1) + '%';
    // textContent — no user data
    poolDisp.textContent = STATE.poolBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })
      + ' ' + STATE.tokenSymbol;
  },

  /*
   * renderTxHist: Renders the transaction history list.
   * Uses DOM construction for all dynamic values.
   */
  renderTxHist() {
    const list = document.getElementById('txHistList');
    if (!list) return;

    if (!STATE.txHistory.length) {
      list.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'tx-empty';
      empty.setAttribute('data-i18n', 'no_transactions');
      empty.textContent = typeof t === 'function' ? t('no_transactions') : 'No transactions yet';
      list.appendChild(empty);
      return;
    }

    list.innerHTML = '';

    STATE.txHistory.forEach(tx => {
      const safeBnb  = GUARDS.safePositive(tx.bnb,   0).toFixed(4);
      const safeTok  = GUARDS.safePositive(tx.token, 0).toFixed(2);
      const safeTime = String(tx.time || '').replace(/[^0-9:apmAPM\s]/g, '').slice(0, 20);

      const item = document.createElement('div');
      item.className = 'tx-item';

      const amt = document.createElement('span');
      amt.className = 'tx-amt';
      amt.textContent = '+' + safeTok + ' ' + STATE.tokenSymbol;

      const bnbSpan = document.createElement('span');
      bnbSpan.style.cssText = 'color:var(--t3);font-family:var(--mono);font-size:.70rem';
      bnbSpan.textContent = '-' + safeBnb + ' BNB';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'tx-time';
      timeSpan.textContent = safeTime;

      item.appendChild(amt);
      item.appendChild(bnbSpan);
      item.appendChild(timeSpan);

      // Link — only if hash validates
      const txUrl = GUARDS.safeUrl(tx.hash, 'bscscan-tx');
      if (txUrl) {
        const link = document.createElement('a');
        link.href   = txUrl;
        link.target = '_blank';
        link.rel    = 'noopener noreferrer';
        link.textContent = this.abbr(tx.hash);
        item.appendChild(link);
      }

      list.appendChild(item);
    });
  },

  /*
   * abbr: Abbreviates an address or hash for display.
   */
  abbr(addr) {
    const s = String(addr || '');
    if (s.length < 10) return s;
    return s.slice(0, 6) + '…' + s.slice(-4);
  },

  /*
   * fmtRate: Formats an exchange rate with adaptive precision.
   */
  fmtRate(r) {
    const n = Number(r);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n >= 100) return n.toFixed(0);
    if (n >= 1)   return n.toFixed(2);
    if (n >= 0.01) return n.toFixed(4);
    return n.toFixed(8);
  },
};
