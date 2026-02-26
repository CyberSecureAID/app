'use strict';
const CHAIN = {
  _provider: null,
  _signer: null,
  _contract: null,      // Instancia read-only del contrato principal
  _contractRW: null,    // Instancia read-write del contrato principal
  _tokenR: null,        // Instancia read-only del ERC20
  _tokenRW: null,       // Instancia read-write del ERC20
  _publicProvider: null,

  /*
   * reset(): Invalida instancias de contrato y signer.
   * Llamado al desconectar wallet, cambiar cuenta, cambiar red, o cambiar dirección de contrato.
   * NO invalida _publicProvider — es stateless y puede reutilizarse.
   * Para invalidar el publicProvider, llamar invalidatePublicProvider() explícitamente.
   */
  reset() {
    this._provider = this._signer = this._contract = this._contractRW = this._tokenR = this._tokenRW = null;
  },

  /*
   * _getReadProvider(): Retorna provider para operaciones de solo lectura.
   * Prioridad: public JsonRpcProvider para stats (evita depender de la red del usuario)
   * BrowserProvider solo si el usuario está conectado y en BSC.
   * Por qué este cambio: Si el user está en otra red, leer via BrowserProvider
   *   puede dar errores o datos de la red equivocada.
   */
  _getReadProvider() {
    if (!this._publicProvider) this._publicProvider = new ethers.JsonRpcProvider(CONFIG.PUBLIC_RPC);
    return this._publicProvider;
  },

  /*
   * _getWriteProvider(): Retorna provider con signer (wallet requerida).
   * Lanza excepción si no hay wallet — el caller debe manejarla.
   */
  _getWriteProvider() {
    if (!window.ethereum) throw new Error('No wallet provider available');
    if (!this._provider) this._provider = new ethers.BrowserProvider(window.ethereum);
    return this._provider;
  },

  /*
   * getReadContract(): Instancia read-only del contrato principal.
   * No requiere wallet — usa public RPC si es necesario.
   */
  getReadContract() {
    if (!this._contract) {
      const p = this._getReadProvider();
      this._contract = new ethers.Contract(STATE.contractAddress, CONFIG.CONTRACT_ABI, p);
    }
    return this._contract;
  },

  /*
   * getWriteContract(): Instancia read-write del contrato.
   * Requiere wallet conectada. El signer firma las transacciones.
   */
  async getWriteContract() {
    if (!this._contractRW) {
      const p = this._getWriteProvider();
      this._signer = await p.getSigner();
      this._contractRW = new ethers.Contract(STATE.contractAddress, CONFIG.CONTRACT_ABI, this._signer);
    }
    return this._contractRW;
  },

  /*
   * getTokenReadContract(): ERC20 read-only (balances, allowances).
   */
  getTokenReadContract() {
    if (!this._tokenR) {
      const p = this._getReadProvider();
      this._tokenR = new ethers.Contract(CONFIG.TOKEN_ADDRESS, CONFIG.TOKEN_ABI, p);
    }
    return this._tokenR;
  },

  /*
   * getTokenWriteContract(): ERC20 read-write (approve antes de deposit).
   */
  async getTokenWriteContract() {
    if (!this._tokenRW) {
      const p = this._getWriteProvider();
      const s = await p.getSigner();
      this._tokenRW = new ethers.Contract(CONFIG.TOKEN_ADDRESS, CONFIG.TOKEN_ABI, s);
    }
    return this._tokenRW;
  },

  /*
   * switchToBSC(): Solicita cambio a BSC Mainnet.
   * CRÍTICO: Siempre se llama ANTES de leer balances.
   * Previene [T12]: Si la wallet está en otra red, el balance
   *   que leería sería el de esa red, no el BNB real.
   * Si el usuario rechaza o la red ya está añadida, falla silenciosamente.
   */
  async switchToBSC() {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CONFIG.BSC_CHAIN_ID }],
      });
    } catch (e) {
      if (e.code === 4902) {
        // Red no añadida — intentamos añadirla
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [CONFIG.BSC_CHAIN_PARAMS],
          });
        } catch (_) { /* usuario rechazó añadir la red */ }
      }
      // Otros errores: usuario ya está en BSC o rechazó el switch
    }
  },

  /*
   * invalidatePublicProvider(): Resetea el provider público.
   * Llamado al cambiar de red para evitar que el provider viejo
   *   apunte a la red incorrecta.
   */
  invalidatePublicProvider() {
    this._publicProvider = null;
  },
};


/* ══════════════════════════════════════════════════════════════
   MÓDULO: PRICE
   Propósito: Obtención del precio BNB/USD desde APIs externas
     y cálculo de la tasa de intercambio BNB→Token.
   Invariante:
     - Usa 3 APIs en cascada (fallback si una falla)
     - El precio se valida dentro de LIMITS antes de guardarse
     - Si las 3 APIs fallan, mantiene el último precio conocido
   Seguridad: El precio del frontend es solo informativo.
     La VALIDACIÓN REAL ocurre onchain con isBnbPriceValid().
   Dependencias: STATE, CONFIG.LIMITS, UI.
══════════════════════════════════════════════════════════════ */
