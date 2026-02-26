'use strict';
const STATE = {
  // ── Idioma ──
  lang: 'en',

  // ── Wallet ──
  walletConnected: false,
  walletType: null,       // 'metamask' | 'trust'
  walletAddress: null,    // string 0x... | null
  bnbBalance: 0,

  // ── Dirección activa del contrato (puede cambiar desde admin) ──
  contractAddress: CONFIG.CONTRACT_ADDRESS_DEFAULT,

  // ── Precio y tasa ──
  bnbPriceUSD: 0,         // Precio BNB en USD (obtenido de APIs)
  bnbPricePrev: 0,        // Precio anterior (para mostrar cambio %)
  usdtzPriceUSD: 0.0112,  // Precio del token en USD (configurable por admin)
  currentRate: 0,         // Tasa: cuántos tokens por 1 BNB

  // ── Pool ──
  poolBalance: 0,         // Tokens disponibles en el pool
  poolMax: 0,             // Máximo histórico (para barra de liquidez)
  bnbCollected: 0,        // Total BNB recibido
  txCount: 0,             // Total transacciones
  tokensSold: 0,          // Total tokens vendidos

  // ── Admin ──
  ownerAddress: null,           // Dirección verificada como admin
  adminTokenBalance: 0,         // Balance de tokens del admin
  adminTokenBalanceLoaded: false,

  // ── Branding ──
  platformName: 'MiSwap',
  tokenSymbol: 'USDT.z',

  // ── Configuración de swap ──
  slippage: 0.1,          // Porcentaje de slippage (default 0.1%)
  detailsOpen: false,

  // ── Historial y seguridad ──
  txHistory: [],          // Array de {bnb, token, hash, time}
  securityUsed: new Set(), // Wallets que ya usaron el test token (cache local)

  // ── Modo de calculadora de precio admin ──
  pcMode: 'direct',       // 'direct' | 'ratio'
};


/* ══════════════════════════════════════════════════════════════
   MÓDULO: LANG
   Propósito: Internacionalización (i18n) — EN / ES.
   Invariante: Las claves en 'en' deben estar siempre completas.
     'es' puede tener claves faltantes (fallback a 'en').
   Dependencias: STATE.lang.
   Seguridad: Los valores son literales del código — no vienen
     de usuario — por lo tanto no requieren esc().
══════════════════════════════════════════════════════════════ */
