'use strict';
const CONFIG = Object.freeze({
  /*
   * CONTRACT_ADDRESS: Dirección del smart contract principal.
   * Este es el contrato que administra el pool y el swap.
   * Puede ser actualizado desde el panel admin pero la nueva
   * dirección siempre es validada (formato 0x + 40 hex) antes
   * de aceptarse. El contrato es quien valida todo lo crítico.
   */
  CONTRACT_ADDRESS_DEFAULT: '0x345Ccc716c6536d97D6Ef65D542303691a4400B6',

  /*
   * TOKEN_ADDRESS: Dirección del ERC20 (USDT.z en BSC).
   * Immutable — solo el admin puede cambiar el símbolo visual,
   * pero la dirección del token es fija en el código.
   * Amenaza mitigada: Si alguien cambia el símbolo desde DevTools,
   * la dirección real del contrato ERC20 no cambia.
   */
  TOKEN_ADDRESS: '0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4',

  /*
   * BSC_CHAIN_ID: BNB Smart Chain Mainnet.
   * Usado para verificar que la wallet está en la red correcta.
   */
  BSC_CHAIN_ID: '0x38',
  BSC_CHAIN_PARAMS: Object.freeze({
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    blockExplorerUrls: ['https://bscscan.com'],
  }),

  /*
   * PUBLIC_RPC: Endpoint público de BSC para lectura sin wallet.
   * Permite que loadContractStats() funcione sin MetaMask conectado.
   * Sin dependencias externas de pago — solo BSC público.
   */
  PUBLIC_RPC: 'https://bsc-dataseed.binance.org/',

  /*
   * LIMITS: Límites financieros del sistema.
   * Propósito: Prevenir inputs absurdos que puedan causar
   * comportamientos inesperados en cálculos o en el contrato.
   * Invariante: BNB_MAX_PER_TX debe coincidir con el límite del contrato.
   */
  LIMITS: Object.freeze({
    BNB_MAX_PER_TX: 100,
    SLIPPAGE_MIN: 0.01,
    SLIPPAGE_MAX: 50,
    BNB_PRICE_MIN: 10,
    BNB_PRICE_MAX: 100_000,
    TOKEN_PRICE_MIN: 0.0000001,
    TOKEN_PRICE_MAX: 100_000,
    GAS_RESERVE_BNB: 0.001, // BNB que no se puede gastar (reserva para gas)
  }),

  /*
   * AUTHORIZED_WALLETS: Lista hardcoded de wallets admin.
   * IMPORTANTE: Esta es una capa de UX, no de seguridad real.
   * La seguridad real está en el contrato (onlyOwner modifier).
   * El frontend nunca confía solo en esta lista — siempre
   * verifica también con c.isAdmin() onchain.
   */
  AUTHORIZED_WALLETS: [
    // Agrega wallets en minúsculas: '0xtu_wallet_admin'
  ],

  /*
   * ABIs: Interfaces mínimas requeridas para interactuar con los contratos.
   * Solo se incluyen las funciones realmente usadas — surface mínima.
   */
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
  ]),
});


/* ══════════════════════════════════════════════════════════════
   MÓDULO: GUARDS
   Propósito: Funciones puras de validación y sanitización.
   Invariante: Ninguna función de este módulo tiene efectos
     secundarios. Son funciones matemáticas puras.
   Uso: Llamadas ANTES de cualquier operación crítica (cálculos,
     llamadas al contrato, escritura en DOM).
   Seguridad [T7, T8]: Previene XSS y inputs maliciosos.
══════════════════════════════════════════════════════════════ */
