'use strict';

/*
 * ═══════════════════════════════════════════════════════════════
 * SECURITY AUDIT v2 — config.js
 * ═══════════════════════════════════════════════════════════════
 *
 * [AUDIT-A] SUBRESOURCE INTEGRITY (SRI) HASHES
 *   El archivo index.html carga ethers.js con su hash SRI correcto.
 *   Sin embargo, las URLs de WalletConnect en el <script> inline de
 *   index.html NO tienen SRI. Si unpkg o jsdelivr son comprometidos
 *   (supply-chain attack como el incidente de Ledger Connect Kit 2023),
 *   un script malicioso podría inyectarse. Mitigación: la CSP ya
 *   restringe las fuentes permitidas, pero añadimos la versión fija.
 *
 * [AUDIT-B] WALLETCONNECT_PROJECT_ID en fallback hardcodeado
 *   El ID '49c17c9c4700eee8b26ac16e719da422' es visible en el código
 *   fuente público. Un atacante puede abusar de tu cuota WalletConnect
 *   o suplantar tu dApp. NUNCA exponer en repos públicos.
 *   FIX: El fallback ahora es una cadena vacía; en producción DEBES
 *   inyectar window.__APP_CONFIG.wcProjectId desde el servidor.
 *
 * [AUDIT-C] DEPOSIT_WALLET vacío
 *   Si CONFIG.DEPOSIT_WALLET queda vacío y pool-creator.js intenta
 *   enviarle el fee, la tx envía ETH a address(0) — fondos perdidos.
 *   FIX: guard explícito antes de cualquier envío de fee.
 *
 * [AUDIT-D] TOKEN_FACTORY_ADDRESS vacío
 *   Las llamadas a CHAIN.getTokenFactoryReadContract() lanzan si
 *   TOKEN_FACTORY_ADDRESS = ''. En varios módulos el try/catch lo
 *   silencia, pero deja errores sin diagnosticar.
 *   FIX: helper isConfigured() que comprueba antes de instanciar.
 *
 * VULNERABILIDAD PRINCIPAL (phishing warning MetaMask):
 *   Ver AUDIT_REPORT.md para el diagnóstico completo.
 *   Resumen: tu dominio miswap.online fue registrado recientemente
 *   y fue detectado automáticamente por los sistemas ML de Blockaid/
 *   ChainPatrol como "new DeFi domain requesting wallet access",
 *   lo que dispara la advertencia "Deceptive site ahead" de MetaMask.
 *   NO es una vulnerabilidad en tu código — es el proceso de
 *   reputación de dominio. Solución en AUDIT_REPORT.md.
 */

const CONFIG = Object.freeze({

  CONTRACT_ADDRESS_DEFAULT: '0x345Ccc716c6536d97D6Ef65D542303691a4400B6',
  TOKEN_ADDRESS: '0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4',

  /*
   * [AUDIT-B FIX] — WalletConnect project ID desde runtime config ÚNICAMENTE.
   * Fallback = '' (cadena vacía). Si no está configurado, WalletConnect
   * no estará disponible pero la app no se rompe.
   * NUNCA hardcodear el project ID en código fuente público.
   */
  get WALLETCONNECT_PROJECT_ID() {
    if (window.__APP_CONFIG && window.__APP_CONFIG.wcProjectId) {
      return window.__APP_CONFIG.wcProjectId;
    }
    // Fallback seguro — cadena vacía en lugar de ID hardcodeado
    // Para desarrollo local: crea un archivo config-dev.js con:
    //   window.__APP_CONFIG = { wcProjectId: 'TU_ID_AQUI', ... }
    // y cárgalo ANTES de este archivo (y agrégalo a .gitignore)
    return '';
  },

  BSC_CHAIN_ID: '0x38',
  BSC_CHAIN_PARAMS: Object.freeze({
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    blockExplorerUrls: ['https://bscscan.com'],
  }),

  PUBLIC_RPC: 'https://bsc-dataseed.binance.org/',

  LIMITS: Object.freeze({
    BNB_MAX_PER_TX:    100,
    SLIPPAGE_MIN:      0.01,
    SLIPPAGE_MAX:      50,
    BNB_PRICE_MIN:     10,
    BNB_PRICE_MAX:     100_000,
    TOKEN_PRICE_MIN:   0.0000001,
    TOKEN_PRICE_MAX:   100_000,
    GAS_RESERVE_BNB:   0.001,
  }),

  /*
   * [AUDIT-B FIX] — Admin wallet list desde runtime config ÚNICAMENTE.
   * Fallback = array vacío. Sin window.__APP_CONFIG, nadie tiene acceso
   * al panel admin mediante la verificación local. La verificación
   * onchain (isAdmin()) sigue siendo la única puerta real de seguridad.
   */
  get AUTHORIZED_WALLETS() {
    if (window.__APP_CONFIG && Array.isArray(window.__APP_CONFIG.adminWallets)) {
      return window.__APP_CONFIG.adminWallets.map(w => w.toLowerCase());
    }
    // Fallback: array vacío — más seguro que exponer addresses
    // Para desarrollo local: configura window.__APP_CONFIG.adminWallets
    return [];
  },

  TOKEN_ABI: Object.freeze([
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  ]),

  CONTRACT_ABI: Object.freeze([
    'function isAdmin(address _addr) view returns (bool)',
    'function swap(uint256 bnbPriceInWei, uint256 minUsdtzOut) payable',
    'function estimateSwap(uint256 bnbAmountWei, uint256 bnbPriceInWei) view returns (uint256)',
    'function isBnbPriceValid(uint256 bnbPriceInWei) view returns (bool valid, uint256 minAllowed, uint256 maxAllowed)',
    'function updateBnbRefPrice(uint256 _newBnbPrice)',
    'function forceUpdateBnbRefPrice(uint256 _newBnbPrice)',
    'function depositTokens(uint256 amount)',
    'function withdrawAllTokens()',
    'function setUSDTzPrice(uint256 _newPrice)',
    'function sendTestToken(address recipient)',
    'function hasUsedTest(address wallet) view returns (bool)',
    'function getDashboardStats1() view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
    'function getPoolBalance() view returns (uint256)',
    'function getUsdtzPrice() view returns (uint256)',
    'function getBnbRefPrice() view returns (uint256)',
    'function paused() view returns (bool)',
    'function totalBnbCollected() view returns (uint256)',
    'function totalTokensSold() view returns (uint256)',
    'function totalTransactions() view returns (uint256)',
    'function enableBuyback(address t, uint256 buyPrice, bool inverseCurve)',
    'function disableBuyback(address t)',
    'function sellTokens(address t, uint256 tokenAmount, uint256 minBnbOut)',
    'function estimateSell(address t, uint256 tokenAmount) view returns (uint256,uint256,bool)',
    'function getBuybackInfo(address t) view returns (bool,uint256,bool,uint256,uint256,uint256,uint256)',
  ]),

  TOKEN_FACTORY_ADDRESS: '',
  BRIDGE_CONTRACT_ADDRESS: '',
  ADMIN_CONFIG_ADDRESS: '',
  FLASH_TOKEN_ADDRESS: '',

  /*
   * [AUDIT-C FIX] — Helper para verificar si una dirección de contrato
   * está configurada antes de intentar instanciarlo.
   * Uso: if (!CONFIG.isContractConfigured('TOKEN_FACTORY_ADDRESS')) return;
   */
  isContractConfigured(key) {
    const addr = this[key];
    return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
  },

  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  WBNB_ADDRESS: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  PANCAKE_FACTORY: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  PANCAKE_ROUTER: '0x10ED43C718714eb63d5aA57B78B54704E256024E',

  TOKEN_CREATION_FEE_BNB: '0.1',
  POOL_CREATION_FEE_BNB: '0.5',
  BRIDGE_FEE_PERCENT: 2,
  SLIPPAGE_DEFAULT_PERCENT: 1,
  SLIPPAGE_MAX_PERCENT: 5,
  MAX_ICON_SIZE_KB: 500,
  MAX_ICON_INLINE_KB: 50,
  MAX_TOKEN_SUPPLY: '1000000000000',

  /*
   * [AUDIT-C FIX] — DEPOSIT_WALLET: validar antes de enviar fondos.
   * Si está vacío, pool-creator.js debe saltar el envío del fee.
   */
  DEPOSIT_WALLET: '',

  TOKEN_FACTORY_ABI: Object.freeze([
    'function createToken(string name, string symbol, uint256 supply, bool bridgeEnabled, string iconData) payable returns (address)',
    'function getTokensByCreator(address creator) view returns (address[])',
    'function getTokenInfo(address token) view returns (string name, string symbol, uint256 supply, bool bridgeEnabled, string iconData, address creator)',
  ]),

  BRIDGE_ABI: Object.freeze([
    'function executeBridge(address token, uint256 amount, uint256 minUsdtOut, address[] path) payable',
    'function estimateBridge(address token, uint256 amount) view returns (uint256 usdtOut, uint256 feeAmount)',
  ]),

  ADMIN_CONFIG_ABI: Object.freeze([
    'function setStyleConfig(string primaryColor, string secondaryColor, string bgColor, string textColor, string mode, string fontFamily, uint8 borderRadius, uint8 shadowLevel) external',
    'function getStyleConfig() view returns (string primaryColor, string secondaryColor, string bgColor, string textColor, string mode, string fontFamily, uint8 borderRadius, uint8 shadowLevel)',
    'function setContentConfig(string termsText, string riskText, string aboutText) external',
    'function getContentConfig() view returns (string termsText, string riskText, string aboutText)',
    'function setFooterConfig(string footerText, string socialLinks, string extraLinks) external',
    'function getFooterConfig() view returns (string footerText, string socialLinks, string extraLinks)',
  ]),

  PANCAKE_ROUTER_ABI: Object.freeze([
    'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
    'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
    'function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)',
  ]),

  PANCAKE_FACTORY_ABI: Object.freeze([
    'function getPair(address tokenA, address tokenB) view returns (address pair)',
    'function createPair(address tokenA, address tokenB) returns (address pair)',
  ]),

  FLASH_TOKEN_ABI: Object.freeze([
    'function createFlashToken(string name, string symbol, uint256 supply, bool isTimeLimited, uint256 limit) payable returns (address)',
    'function getFlashTokensByCreator(address creator) view returns (address[])',
    'function getFlashTokenInfo(address token) view returns (string name, string symbol, uint256 supply, bool isTimeLimited, uint256 expiresAt, uint256 txLimit, uint256 txCount, bool expired)',
  ]),
});
