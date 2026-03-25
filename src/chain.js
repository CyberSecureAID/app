'use strict';
const CHAIN = {
  _provider: null,
  _signer: null,
  _contract: null,
  _contractRW: null,
  _tokenR: null,
  _tokenRW: null,
  _publicProvider: null,
  _lastProv: null,

  // ── RPC fallback pool ─────────────────────────────────────────────────────
  _RPC_POOL: [
    'https://bsc-dataseed.binance.org/',
    'https://bsc-dataseed1.binance.org/',
    'https://bsc-dataseed2.binance.org/',
    'https://bsc-dataseed3.binance.org/',
    'https://bsc-dataseed4.binance.org/',
  ],
  _rpcIndex: 0,

  /*
   * reset(): Invalida instancias de contrato y signer.
   * Llamado al desconectar wallet, cambiar cuenta, cambiar red,
   * o cambiar dirección de contrato.
   * NO invalida _publicProvider (stateless, puede reutilizarse).
   */
  reset() {
    this._provider = this._signer = this._contract =
      this._contractRW = this._tokenR = this._tokenRW = null;
  },

  _getReadProvider() {
    if (!this._publicProvider) {
      this._publicProvider = new ethers.JsonRpcProvider(
        this._RPC_POOL[this._rpcIndex]
      );
    }
    return this._publicProvider;
  },

  _getWriteProvider() {
    const prov = (typeof WALLET !== 'undefined' && WALLET._activeProvider)
      ? WALLET._activeProvider
      : window.ethereum;
    if (!prov) throw new Error('No wallet provider available');
    if (!this._provider || this._lastProv !== prov) {
      this._provider = new ethers.BrowserProvider(prov);
      this._lastProv = prov;
    }
    return this._provider;
  },

  getReadContract() {
    if (!this._contract) {
      this._contract = new ethers.Contract(
        STATE.contractAddress, CONFIG.CONTRACT_ABI, this._getReadProvider()
      );
    }
    return this._contract;
  },

  async getWriteContract() {
    if (!this._contractRW) {
      const p = this._getWriteProvider();
      this._signer = await p.getSigner();
      this._contractRW = new ethers.Contract(
        STATE.contractAddress, CONFIG.CONTRACT_ABI, this._signer
      );
    }
    return this._contractRW;
  },

  getTokenReadContract() {
    if (!this._tokenR) {
      this._tokenR = new ethers.Contract(
        CONFIG.TOKEN_ADDRESS, CONFIG.TOKEN_ABI, this._getReadProvider()
      );
    }
    return this._tokenR;
  },

  async getTokenWriteContract() {
    if (!this._tokenRW) {
      const p = this._getWriteProvider();
      const s = await p.getSigner();
      this._tokenRW = new ethers.Contract(
        CONFIG.TOKEN_ADDRESS, CONFIG.TOKEN_ABI, s
      );
    }
    return this._tokenRW;
  },

  /*
   * callWithFallback(fn): Ejecuta fn() con reintentos automáticos.
   * FIX BUG 1: Este método faltaba — stats.js lo llama en múltiples lugares.
   * Si el RPC activo falla, rota al siguiente y reintenta una vez.
   * Si ambos fallan, propaga el error al caller.
   */
  async callWithFallback(fn) {
    try {
      return await fn();
    } catch (firstErr) {
      // Rotar al siguiente RPC e invalidar instancias
      this._rpcIndex = (this._rpcIndex + 1) % this._RPC_POOL.length;
      this.invalidatePublicProvider();
      console.warn('[CHAIN] RPC rotated →', this._RPC_POOL[this._rpcIndex]);
      try {
        return await fn();
      } catch (secondErr) {
        // Intentar un tercer RPC antes de rendirse
        this._rpcIndex = (this._rpcIndex + 1) % this._RPC_POOL.length;
        this.invalidatePublicProvider();
        return await fn();
      }
    }
  },

  /*
   * switchToBSC(): Solicita cambio a BSC Mainnet.
   * CRÍTICO: Siempre antes de leer balances [T12].
   */
  async switchToBSC() {
    const prov = (typeof WALLET !== 'undefined' && WALLET._activeProvider)
      ? WALLET._activeProvider
      : window.ethereum;
    if (!prov) return;
    try {
      await prov.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CONFIG.BSC_CHAIN_ID }],
      });
    } catch (e) {
      if (e.code === 4902) {
        try {
          await prov.request({
            method: 'wallet_addEthereumChain',
            params: [CONFIG.BSC_CHAIN_PARAMS],
          });
        } catch (_) {}
      }
    }
  },

  invalidatePublicProvider() {
    this._publicProvider = null;
    this._contract = null;   // también invalida contrato read-only
    this._tokenR   = null;
  },

  // ── Nuevos contratos v8 ────────────────────────────────────────────────────
  _tokenFactory: null,
  _tokenFactoryRW: null,
  _adminConfig: null,
  _adminConfigRW: null,

  getTokenFactoryReadContract() {
    if (!this._tokenFactory) {
      this._tokenFactory = new ethers.Contract(
        CONFIG.TOKEN_FACTORY_ADDRESS, CONFIG.TOKEN_FACTORY_ABI, this._getReadProvider()
      );
    }
    return this._tokenFactory;
  },

  async getTokenFactoryWriteContract() {
    if (!this._tokenFactoryRW) {
      const p = this._getWriteProvider();
      const s = await p.getSigner();
      this._tokenFactoryRW = new ethers.Contract(
        CONFIG.TOKEN_FACTORY_ADDRESS, CONFIG.TOKEN_FACTORY_ABI, s
      );
    }
    return this._tokenFactoryRW;
  },

  getAdminConfigReadContract() {
    if (!this._adminConfig) {
      this._adminConfig = new ethers.Contract(
        CONFIG.ADMIN_CONFIG_ADDRESS, CONFIG.ADMIN_CONFIG_ABI, this._getReadProvider()
      );
    }
    return this._adminConfig;
  },

  async getAdminConfigWriteContract() {
    if (!this._adminConfigRW) {
      const p = this._getWriteProvider();
      const s = await p.getSigner();
      this._adminConfigRW = new ethers.Contract(
        CONFIG.ADMIN_CONFIG_ADDRESS, CONFIG.ADMIN_CONFIG_ABI, s
      );
    }
    return this._adminConfigRW;
  },

  // ── Flash Token contract ───────────────────────────────────────────────────
  _flashToken: null,
  _flashTokenRW: null,

  getFlashTokenReadContract() {
    if (!this._flashToken) {
      this._flashToken = new ethers.Contract(
        CONFIG.FLASH_TOKEN_ADDRESS, CONFIG.FLASH_TOKEN_ABI, this._getReadProvider()
      );
    }
    return this._flashToken;
  },

  async getFlashTokenWriteContract() {
    if (!this._flashTokenRW) {
      const p = this._getWriteProvider();
      const s = await p.getSigner();
      this._flashTokenRW = new ethers.Contract(
        CONFIG.FLASH_TOKEN_ADDRESS, CONFIG.FLASH_TOKEN_ABI, s
      );
    }
    return this._flashTokenRW;
  },
};
