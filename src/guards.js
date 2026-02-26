'use strict';
const GUARDS = {
  /*
   * safePositive: Garantiza número finito > 0.
   * Uso: Montos BNB, montos de tokens, precios.
   * Si falla: retorna el fallback (default 0).
   */
  safePositive(v, fallback = 0) {
    const n = Number(v);
    return (Number.isFinite(n) && n > 0) ? n : fallback;
  },

  /*
   * safeNonNeg: Garantiza número finito >= 0.
   * Uso: Balances que pueden ser cero.
   */
  safeNonNeg(v, fallback = 0) {
    const n = Number(v);
    return (Number.isFinite(n) && n >= 0) ? n : fallback;
  },

  /*
   * clamp: Restringe valor a un rango [min, max].
   * Uso: Slippage, precios, montos antes de cálculos.
   */
  clamp(v, min, max) {
    return Math.min(Math.max(Number(v) || 0, min), max);
  },

  /*
   * isValidAddr: Valida dirección EVM (0x + 40 hex chars).
   * Uso: SIEMPRE antes de usar una dirección como parámetro.
   * Previene: Envíos a dirección cero, XSS en addresses.
   */
  isValidAddr(a) {
    return /^0x[0-9a-fA-F]{40}$/.test(String(a || ''));
  },

  /*
   * isValidHash: Valida hash de transacción (0x + 64 hex chars).
   * Uso: Antes de mostrar links a BscScan.
   */
  isValidHash(h) {
    return /^0x[0-9a-fA-F]{64}$/.test(String(h || ''));
  },

  /*
   * esc: Sanitiza string para uso seguro en innerHTML.
   * Uso: SIEMPRE que se inserte texto externo/usuario en el DOM.
   * Previene: [T7] XSS via innerHTML.
   * IMPORTANTE: No usar textContent cuando esc() es suficiente,
   *   pero esc() es OBLIGATORIO para todo string en innerHTML.
   */
  esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },
};


/* ══════════════════════════════════════════════════════════════
   MÓDULO: STATE
   Propósito: Estado global reactivo. Es la ÚNICA fuente de
     verdad para el estado de la aplicación.
   Invariante: Ningún módulo escribe directamente al DOM sin
     pasar primero por STATE. Los renders leen de STATE.
   Diseño: Objeto plano (no proxy) por simplicidad y debugging.
     Mutaciones deben ser intencionadas y documentadas.
   Nota: Los valores iniciales son seguros y no operacionales
     (wallet no conectada, rate 0, etc.) — el sistema no puede
     ejecutar swaps con valores por defecto.
══════════════════════════════════════════════════════════════ */
