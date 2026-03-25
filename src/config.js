'use strict';

const CONFIG = Object.freeze({

  CONTRACT_ADDRESS_DEFAULT: '0x345Ccc716c6536d97D6Ef65D542303691a4400B6',

  TOKEN_ADDRESS: '0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4',

  WALLETCONNECT_PROJECT_ID: '49c17c9c4700eee8b26ac16e719da422',

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

  AUTHORIZED_WALLETS: [
    '0x5167b4d52ffa149daf81f6b7c22bb8e7e4749cda',
    '0x6f3928326f082029236321f033425dda881cfa4f',
  ],

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

  // ── Single Upgradeable Contract Architecture ───────────────────────────────
  // All features — swap, token creation, pool creation, bridge, Flash Tokens,
  // and admin configuration — are centralized under a single upgradeable smart
  // contract system. The addresses below are placeholders until deployment.
  // Future updates are made through ADMIN_CONFIG_ADDRESS without redeploying.

  // ── New v8 contracts (empty until deploy) ─────────────────────────────────
  TOKEN_FACTORY_ADDRESS: '',
  BRIDGE_CONTRACT_ADDRESS: '',
  ADMIN_CONFIG_ADDRESS: '',

  // ── Flash Token contract (part of the unified contract system above) ───────
  FLASH_TOKEN_ADDRESS: '',

  // ── Contratos externos BSC ─────────────────────────────────────────────────
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  WBNB_ADDRESS: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  PANCAKE_FACTORY: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  PANCAKE_ROUTER: '0x10ED43C718714eb63d5aA57B78B54704E256024E',

  // ── Parámetros de negocio ──────────────────────────────────────────────────
  TOKEN_CREATION_FEE_BNB: '0.1',
  POOL_CREATION_FEE_BNB: '0.5',
  BRIDGE_FEE_PERCENT: 2,
  SLIPPAGE_DEFAULT_PERCENT: 1,
  SLIPPAGE_MAX_PERCENT: 5,
  MAX_ICON_SIZE_KB: 500,
  MAX_ICON_INLINE_KB: 50,
  MAX_TOKEN_SUPPLY: '1000000000000',

  // ── Wallet admin/depósito ──────────────────────────────────────────────────
  DEPOSIT_WALLET: '',

  // ── ABIs nuevos contratos ──────────────────────────────────────────────────
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

  // ── Flash Token ABI ────────────────────────────────────────────────────────
  FLASH_TOKEN_ABI: Object.freeze([
    'function createFlashToken(string name, string symbol, uint256 supply, bool isTimeLimited, uint256 limit) payable returns (address)',
    'function getFlashTokensByCreator(address creator) view returns (address[])',
    'function getFlashTokenInfo(address token) view returns (string name, string symbol, uint256 supply, bool isTimeLimited, uint256 expiresAt, uint256 txLimit, uint256 txCount, bool expired)',
  ]),
});
