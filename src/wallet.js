'use strict';
const WALLET = {
  openOverlay()  { document.getElementById('walOverlay').classList.add('open'); },
  closeOverlay() { document.getElementById('walOverlay').classList.remove('open'); },

  /*
   * connect(type): Solicita permisos de wallet al usuario.
   * type: 'metamask' | 'trust'
   * Falla silenciosamente si el usuario rechaza (código 4001).
   */
  async connect(type) {
    this.closeOverlay();
    if (!window.ethereum) {
      UI.notif('err', 'No Wallet', type === 'metamask'
        ? 'MetaMask not detected. Install at metamask.io'
        : 'Trust Wallet not detected. Open in Trust Wallet browser');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length) await this.setup(accounts[0], type);
    } catch (e) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED') UI.notif('err', 'Rejected', 'Connection request rejected');
      else UI.notif('err', 'Connection Error', e.message || '');
    }
  },

  /*
   * setup(addr, type, silent): Configura el estado de wallet conectada.
   * Llamado tanto en conexión inicial como en cambio de cuenta.
   * silent=true: suprime la notificación "Wallet Connected" (para accountsChanged).
   *
   * Orden crítico de operaciones:
   *   1. Actualizar STATE básico
   *   2. Reset de instancias de contrato (para la nueva cuenta)
   *   3. switchToBSC() ANTES de leer balance [T12]
   *   4. Leer balance (ahora en la red correcta)
   *   5. Verificar si es admin (onchain)
   *   6. Cargar stats del contrato
   *   7. Renderizar UI
   */
  async setup(addr, type, silent = false) {
    STATE.walletConnected = true;
    STATE.walletType = type;
    STATE.walletAddress = addr;
    CHAIN.reset();

    // [T12] Cambiar a BSC ANTES de leer balance
    await CHAIN.switchToBSC();

    // Leer balance BNB
    try {
      const hexBal = await window.ethereum.request({
        method: 'eth_getBalance', params: [addr, 'latest'],
      });
      // Usar BigInt para precisión completa (evita pérdida de decimales)
      STATE.bnbBalance = Number(ethers.formatEther(BigInt(hexBal)));
    } catch (_) { STATE.bnbBalance = 0; }

    // Verificar permisos admin
    await this._checkAdmin(addr);

    // Mostrar/ocultar botón admin según permisos
    ADMIN.showAdminTrigger(this.isAdmin());

    // Cargar stats y renderizar
    await STATS.load();
    this._renderConnected(addr, type);
    SWAP.updateBtn();

    if (!silent) {
      UI.notif('ok', 'Wallet Connected', UI.abbr(addr));
      if (this.isAdmin()) UI.notif('info', 'Admin Detectado', 'Tienes acceso al panel administrativo');
    }
  },

  /*
   * _checkAdmin(addr): Verifica permisos de admin en dos capas.
   * Capa 1: Lista hardcoded (AUTHORIZED_WALLETS) — verificación local rápida
   * Capa 2: Contrato onchain isAdmin() — fuente de verdad real
   * Por qué dos capas: La lista hardcoded es solo UX (respuesta inmediata).
   *   El contrato es quien tiene la autoridad real.
   * Resultado: Actualiza STATE.ownerAddress si es admin.
   */
  async _checkAdmin(addr) {
    STATE.ownerAddress = null;

    // Capa 1: lista local
    const isLocalAdmin = CONFIG.AUTHORIZED_WALLETS.some(w => w.toLowerCase() === addr.toLowerCase());
    if (isLocalAdmin) { STATE.ownerAddress = addr; return; }

    // Capa 2: contrato onchain
    try {
      const c = CHAIN.getReadContract();
      const onchainAdmin = await c.isAdmin(addr);
      if (onchainAdmin) STATE.ownerAddress = addr;
    } catch (e) {
      console.warn('[WALLET._checkAdmin] isAdmin() failed:', e?.message);
    }
  },

  /*
   * isAdmin(): Verifica si la wallet actual tiene permisos admin.
   * Basado en STATE.ownerAddress (seteado en _checkAdmin).
   * Invariante: No hace llamadas al contrato — usa STATE.
   */
  isAdmin() {
    if (!STATE.ownerAddress || !STATE.walletAddress) return false;
    return STATE.ownerAddress.toLowerCase() === STATE.walletAddress.toLowerCase();
  },

  /*
   * _renderConnected(addr, type): Actualiza la UI del header post-conexión.
   */
  _renderConnected(addr, type) {
    document.getElementById('connectBtn').style.display = 'none';
    const chip = document.getElementById('walChip');
    if (chip) chip.style.display = 'flex';
    const wa = document.getElementById('walAddr'); if (wa) wa.textContent = UI.abbr(addr);
    const wb = document.getElementById('walBal'); if (wb) wb.textContent = `${STATE.bnbBalance.toFixed(4)} BNB`;
    const we = document.getElementById('walEmoji'); if (we) we.textContent = type === 'trust' ? '🛡️' : '🦊';
    const bd = document.getElementById('bnbBalDisp'); if (bd) bd.textContent = STATE.bnbBalance.toFixed(4);
    const np = document.getElementById('netPill'); if (np) np.style.display = 'flex';
  },

  /*
   * _disconnect(): Limpia el estado al desconectar.
   */
  _disconnect() {
    STATE.walletConnected = false;
    STATE.walletAddress = null;
    STATE.ownerAddress = null;
    STATE.bnbBalance = 0;
    // Ocultar botón admin al desconectar
    ADMIN.showAdminTrigger(false);
    STATE.adminTokenBalance = 0;
    STATE.adminTokenBalanceLoaded = false;
    CHAIN.reset();

    document.getElementById('connectBtn').style.display = 'inline-flex';
    const chip = document.getElementById('walChip'); if (chip) chip.style.display = 'none';
    const np = document.getElementById('netPill'); if (np) np.style.display = 'none';
    SWAP.updateBtn();
    ADMIN.close();
    UI.notif('info', 'Wallet Disconnected', 'Connect your wallet to continue');
  },

  /*
   * addToken(): Sugiere añadir el token a MetaMask/Trust.
   * No es crítico — falla silenciosamente.
   */
  addToken() {
    if (!window.ethereum) return;
    window.ethereum.request({
      method: 'wallet_watchAsset',
      params: { type: 'ERC20', options: {
        address: CONFIG.TOKEN_ADDRESS,
        symbol: STATE.tokenSymbol,
        decimals: 18,
      }},
    }).catch(() => {});
  },

  /*
   * setupListeners(): Registra listeners de eventos de la wallet.
   * accountsChanged: usuario cambia cuenta o desconecta
   * chainChanged: usuario cambia de red
   * Solo se llama UNA vez al inicio (APP.init).
   */
  setupListeners() {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', async (accounts) => {
      if (accounts.length === 0) {
        this._disconnect();
      } else {
        CHAIN.reset();
        // Silent=true para no mostrar "Wallet Connected" duplicado
        await this.setup(accounts[0], STATE.walletType || 'metamask', true);
        UI.notif('info', 'Account Changed', UI.abbr(accounts[0]));
      }
    });

    window.ethereum.on('chainChanged', (chainId) => {
      CHAIN.reset();
      CHAIN.invalidatePublicProvider();
      if (chainId !== CONFIG.BSC_CHAIN_ID) {
        UI.notif('err', 'Wrong Network', 'Switch to BNB Smart Chain (BSC Mainnet)');
      } else {
        UI.notif('info', 'Network OK', 'Connected to BSC Mainnet');
        if (STATE.walletAddress) STATS.load().catch(() => {});
      }
    });
  },

  /*
   * refreshBalance(): Actualiza el balance BNB desde la chain.
   * Llamado periódicamente (cada 15s) y post-swap.
   */
  async refreshBalance() {
    if (!STATE.walletConnected || !window.ethereum) return;
    try {
      const h = await window.ethereum.request({
        method: 'eth_getBalance', params: [STATE.walletAddress, 'latest'],
      });
      STATE.bnbBalance = Number(ethers.formatEther(BigInt(h)));
      const wb = document.getElementById('walBal'); if (wb) wb.textContent = `${STATE.bnbBalance.toFixed(4)} BNB`;
      const bd = document.getElementById('bnbBalDisp'); if (bd) bd.textContent = STATE.bnbBalance.toFixed(4);
      SWAP.updateBtn(); // Re-evaluar botón con balance actualizado
    } catch (_) {}
  },
};


/* ══════════════════════════════════════════════════════════════
   MÓDULO: SWAP
   Propósito: Toda la lógica de UI y ejecución del intercambio
     BNB → Token.
   Flujo:
     onBnbIn() → calcula tokens → updateBtn()
     → init() → modal de confirmación
     → execute() → validaciones → onchain isBnbPriceValid()
     → tx.swap() → receipt → finishSwap()
   
   Seguridad:
     [T2] minUsdtzOut previene front-running
     [T3] isBnbPriceValid() onchain antes de tx
     [T4] valueWei es el BNB real que el contrato recibe
     [T8] Validación completa de inputs antes de cada paso
     [T9] _inProgress mutex + 3s cooldown
   
   Invariantes:
     - El contrato valida TODO — el frontend es solo pre-chequeo
     - minUsdtzOut NUNCA se calcula desde input del usuario
     - bnbVal SIEMPRE se re-lee del DOM en execute() (no del state)
══════════════════════════════════════════════════════════════ */
