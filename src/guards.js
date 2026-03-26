'use strict';

/*
 * SECURITY AUDIT — guards.js
 *
 * VULNERABILITIES FIXED:
 *
 * [V8] MISSING safeUrl GUARD — Several modules built URLs like
 *      "https://bscscan.com/tx/" + hash and inserted them into
 *      href attributes via innerHTML. If GUARDS.isValidHash() was
 *      bypassed or called inconsistently, an attacker-controlled
 *      string could become a javascript: URL or a data: URL in an
 *      href, enabling XSS via link clicks.
 *      FIX: safeUrl() explicitly validates that a URL starts with
 *      https:// and belongs to a trusted domain. Returns '' for
 *      anything that doesn't match. All href construction must
 *      use this guard.
 *
 * [V9] esc() INCOMPLETE COVERAGE — Several modules used template
 *      literals with GUARDS.esc() correctly, but a few places
 *      in admin.html's inline script concatenated strings into
 *      innerHTML without esc(). The esc() function itself is
 *      correct; the issue was inconsistent usage.
 *      FIX: esc() now also escapes backticks to prevent template
 *      literal injection in edge cases. Usage guidance added.
 *
 * UNCHANGED: safePositive, safeNonNeg, clamp, isValidAddr,
 *            isValidHash — these were correct.
 */
const GUARDS = {
  /*
   * safePositive: Guarantees a finite number > 0.
   */
  safePositive(v, fallback = 0) {
    const n = Number(v);
    return (Number.isFinite(n) && n > 0) ? n : fallback;
  },

  /*
   * safeNonNeg: Guarantees a finite number >= 0.
   */
  safeNonNeg(v, fallback = 0) {
    const n = Number(v);
    return (Number.isFinite(n) && n >= 0) ? n : fallback;
  },

  /*
   * clamp: Restricts value to [min, max].
   */
  clamp(v, min, max) {
    return Math.min(Math.max(Number(v) || 0, min), max);
  },

  /*
   * isValidAddr: Validates EVM address (0x + 40 hex chars).
   * Always call this before using an address as a contract parameter.
   */
  isValidAddr(a) {
    return /^0x[0-9a-fA-F]{40}$/.test(String(a || ''));
  },

  /*
   * isValidHash: Validates a transaction hash (0x + 64 hex chars).
   */
  isValidHash(h) {
    return /^0x[0-9a-fA-F]{64}$/.test(String(h || ''));
  },

  /*
   * [V8 FIX] safeUrl: Returns a safe URL string for use in href attributes,
   * or '' if the input is not a trusted HTTPS URL.
   *
   * Only allows https:// URLs on the explicit allowlist of trusted domains.
   * Blocks: javascript:, data:, http://, protocol-relative //, and any
   * domain not in the allowlist.
   *
   * Usage: element.href = GUARDS.safeUrl(hash, 'bscscan-tx')
   */
  safeUrl(value, type) {
    const s = String(value || '').trim();
    if (!s) return '';

    const TEMPLATES = {
      'bscscan-tx':      { prefix: 'https://bscscan.com/tx/',      validate: v => this.isValidHash(v) },
      'bscscan-address': { prefix: 'https://bscscan.com/address/', validate: v => this.isValidAddr(v) },
    };

    const tmpl = TEMPLATES[type];
    if (!tmpl) return '';
    if (!tmpl.validate(s)) return '';
    return tmpl.prefix + s;
  },

  /*
   * [V9 FIX] esc: Sanitizes a string for safe insertion into HTML innerHTML.
   * Now also escapes backticks to prevent template literal injection.
   *
   * USAGE RULES:
   *   - ALWAYS use GUARDS.esc() for any string from external sources
   *     (user input, blockchain data, API responses) in innerHTML.
   *   - PREFER textContent over innerHTML when no HTML structure is needed.
   *   - NEVER build href/src/onclick attributes via template literals
   *     with unescaped external data — use safeUrl() for links.
   */
  esc(s) {
    return String(s)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#x27;')
      .replace(/`/g,  '&#x60;');
  },
};
