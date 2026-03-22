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
});
