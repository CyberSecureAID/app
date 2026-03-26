'use strict';
const WALLET = {
  openOverlay()  { document.getElementById('walOverlay').classList.add('open'); },
  closeOverlay() { document.getElementById('walOverlay').classList.remove('open'); },

  _activeProvider: null,

  async connect(type) {
    this.closeOverlay();
    try {
      if (type === 'walletconnect') { await this._connectWalletConnect(); return; }
      if (type === 'coinbase')      { await this._connectCoinbase();       return; }
      if (type === 'okx')           { await this._connectOKX();            return; }

      if (!window.ethereum) {
        UI.notif('err', 'No Wallet',
          type === 'metamask'
            ? 'MetaMask not detected. Install at metamask.io'
            : 'Trust Wallet not detected. Open in Trust Wallet browser');
        return;
      }
      this._activeProvider = window.ethereum;
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length) await this.setup(accounts[0], type);
    } catch (e) {
      if (e.code === 4001 || e.code === 'ACTION_REJECTED')
        UI.notif('err', 'Rejected', 'Connection request rejected');
      else
        UI.notif('err', 'Connection Error', e.message || '');
    }
  },

  async _connectWalletConnect() {
    try {
      if (typeof window.EthereumProvider === 'undefined') {
        UI.notif('err', 'WalletConnect', 'WalletConnect library not loaded. Check your internet connection.');
        return;
      }
      UI.notif('info', 'WalletConnect', 'Opening connection modal…');

      const provider = await window.EthereumProvider.init({
        projectId: CONFIG.WALLETCONNECT_PROJECT_ID,
        chains: [56],
        optionalChains: [56],
        showQrModal: true,
        qrModalOptions: { themeMode: 'dark' },
        metadata: {
          name: 'MiSwap',
          description: 'Token Swap on BSC',
          url: window.location.origin,
          icons: [window.location.origin + '/favicon.ico'],
        },
      });

      await provider.connect();
      const accounts = provider.accounts;
      if (!accounts?.length) { UI.notif('err', 'WalletConnect', 'No accounts returned'); return; }

      this._activeProvider = provider;
      window._wcProvider   = provider;

      provider.on('accountsChanged', async (accs) => {
        if (!accs.length) { await this._disconnect(); return; }
        await this.setup(accs[0], 'walletconnect', true);
        UI.notif('info', 'Account Changed', UI.abbr(accs[0]));
      });
      provider.on('disconnect', () => this._disconnect());
      provider.on('chainChanged', (chainId) => {
        if (chainId !== 56 && chainId !== '0x38')
          UI.notif('err', 'Wrong Network', 'Switch to BNB Smart Chain (BSC Mainnet)');
      });

      await this.setup(accounts[0], 'walletconnect');
    } catch (e) {
      if (e?.message?.includes('User rejected') || e?.code === 4001)
        UI.notif('err', 'Rejected', 'WalletConnect connection rejected');
      else
        UI.notif('err', 'WalletConnect Error', e?.message || 'Could not connect');
    }
  },

  async _connectCoinbase() {
    const provider = window.coinbaseWalletExtension || window.ethereum;
    if (!provider) {
      UI.notif('err', 'Coinbase Wallet', 'Not detected. Install from coinbase.com/wallet');
      return;
    }
    this._activeProvider = provider;
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (accounts.length) await this.setup(accounts[0], 'coinbase');
  },

  async _connectOKX() {
    const provider = window.okxwallet || window.ethereum;
    if (!provider) {
      UI.notif('err', 'OKX Wallet', 'Not detected. Install from okx.com/web3');
      return;
    }
    this._activeProvider = provider;
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (accounts.length) await this.setup(accounts[0], 'okx');
  },

  async setup(addr, type, silent = false) {
    STATE.walletConnected = true;
    STATE.walletType      = type;
    STATE.walletAddress   = addr;
    CHAIN.reset();

    await CHAIN.switchToBSC();

    try {
      const prov   = this._activeProvider || window.ethereum;
      const hexBal = await prov.request({ method: 'eth_getBalance', params: [addr, 'latest'] });
      STATE.bnbBalance = Number(ethers.formatEther(BigInt(hexBal)));
    } catch (_) { STATE.bnbBalance = 0; }

    await this._checkAdmin(addr);
    ADMIN.showAdminTrigger(this.isAdmin());
    await STATS.load();
    this._renderConnected(addr, type);
    SWAP.updateBtn();

    SELL.checkBuybackStatus().catch(() => {});

    if (!silent) {
      UI.notif('ok', 'Wallet Connected', UI.abbr(addr));
      if (this.isAdmin()) UI.notif('info', 'Admin Detected', 'Tienes acceso al panel administrativo');
    }
  },

  async _checkAdmin(addr) {
    STATE.ownerAddress = null;
    const isLocalAdmin = CONFIG.AUTHORIZED_WALLETS.some(
      w => w.toLowerCase() === addr.toLowerCase()
    );
    if (isLocalAdmin) { STATE.ownerAddress = addr; return; }
    try {
      const onchainAdmin = await CHAIN.getReadContract().isAdmin(addr);
      if (onchainAdmin) STATE.ownerAddress = addr;
    } catch (e) {
      console.warn('[WALLET._checkAdmin] isAdmin() failed:', e?.message);
    }
  },

  isAdmin() {
    if (!STATE.ownerAddress || !STATE.walletAddress) return false;
    return STATE.ownerAddress.toLowerCase() === STATE.walletAddress.toLowerCase();
  },

  _renderConnected(addr, type) {
    document.getElementById('connectBtn').style.display = 'none';
    const chip = document.getElementById('walChip');
    if (chip) chip.style.display = 'flex';
    const wa = document.getElementById('walAddr'); if (wa) wa.textContent = UI.abbr(addr);
    const wb = document.getElementById('walBal');  if (wb) wb.textContent = `${STATE.bnbBalance.toFixed(4)} BNB`;
    // FIX: OKX icon changed to 🆗 as requested
    const emojiMap = { trust:'🛡️', metamask:'🦊', walletconnect:'🔗', coinbase:'🔵', okx:'🆗' };
    const we = document.getElementById('walEmoji'); if (we) we.textContent = emojiMap[type] || '👛';
    const bd = document.getElementById('bnbBalDisp'); if (bd) bd.textContent = STATE.bnbBalance.toFixed(4);
    const np = document.getElementById('netPill');    if (np) np.style.display = 'flex';
  },

  async _disconnect() {
    STATE.walletConnected = false;
    STATE.walletAddress   = null;
    STATE.ownerAddress    = null;
    STATE.bnbBalance      = 0;

    ADMIN.showAdminTrigger(false);
    STATE.adminTokenBalance       = 0;
    STATE.adminTokenBalanceLoaded = false;
    CHAIN.reset();

    document.getElementById('connectBtn').style.display = 'inline-flex';
    const chip = document.getElementById('walChip'); if (chip) chip.style.display = 'none';
    const np   = document.getElementById('netPill'); if (np)   np.style.display   = 'none';

    if (window._wcProvider) {
      try { await window._wcProvider.disconnect(); } catch (_) {}
      window._wcProvider = null;
    }
    this._activeProvider = null;

    SWAP.updateBtn();
    SELL._renderStatus(false, 0n);
    ADMIN.close();
    UI.notif('info', 'Wallet Disconnected', 'Connect your wallet to continue');
  },

  addToken() {
    const prov = this._activeProvider || window.ethereum;
    if (!prov) return;
    prov.request({
      method: 'wallet_watchAsset',
      params: { type: 'ERC20', options: {
        address: CONFIG.TOKEN_ADDRESS,
        symbol:  STATE.tokenSymbol,
        decimals: 18,
      }},
    }).catch(() => {});
  },

  setupListeners() {
    if (!window.ethereum) return;

    window.ethereum.on('accountsChanged', async (accounts) => {
      if (!accounts.length) { await this._disconnect(); return; }
      CHAIN.reset();
      await this.setup(accounts[0], STATE.walletType || 'metamask', true);
      UI.notif('info', 'Account Changed', UI.abbr(accounts[0]));
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

  async refreshBalance() {
    const prov = this._activeProvider || window.ethereum;
    if (!STATE.walletConnected || !prov) return;
    try {
      const h = await prov.request({
        method: 'eth_getBalance', params: [STATE.walletAddress, 'latest'],
      });
      STATE.bnbBalance = Number(ethers.formatEther(BigInt(h)));
      const wb = document.getElementById('walBal');     if (wb) wb.textContent = `${STATE.bnbBalance.toFixed(4)} BNB`;
      const bd = document.getElementById('bnbBalDisp'); if (bd) bd.textContent = STATE.bnbBalance.toFixed(4);
      SWAP.updateBtn();
    } catch (_) {}
  },

  renderWalletSection() {
    const sec = document.getElementById('section-wallet');
    if (!sec) return;
    if (!STATE.walletConnected) {
      sec.innerHTML = `
        <div class="mi-section-card">
          <div class="mi-section-header">
            <span class="mi-section-icon">🔗</span>
            <div><div class="mi-section-title" data-i18n="connect_wallet">Conectar Wallet</div></div>
          </div>
          <div class="mi-empty">Conecta tu wallet para ver la información.</div>
          <button id="walSectionConnectBtn" class="btn btn-ac btn-full mt10" data-i18n="connect_wallet">Conectar Wallet</button>
        </div>`;
      LANG.apply();
      const btn = document.getElementById('walSectionConnectBtn');
      if (btn) btn.addEventListener('click', () => WALLET.openOverlay());
      return;
    }
    const addr  = STATE.walletAddress || '';
    const safeAddr = /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr : '';
    const bnb   = STATE.bnbBalance ? STATE.bnbBalance.toFixed(4) : '—';
    // FIX: OKX icon 🆗
    const emojiMap = { trust:'🛡️', metamask:'🦊', walletconnect:'🔗', coinbase:'🔵', okx:'🆗' };
    const emoji = emojiMap[STATE.walletType] || '👛';

    sec.innerHTML = `
      <div class="mi-section-card">
        <div class="mi-section-header">
          <span class="mi-section-icon">${emoji}</span>
          <div>
            <div class="mi-section-title" data-i18n="wallet_section_title">Mi Wallet</div>
            <div class="mi-section-sub" id="walSecAddrSub"></div>
          </div>
        </div>
        <div class="wallet-info-grid">
          <div class="wallet-info-row">
            <span class="wallet-info-label">Dirección</span>
            <span class="wallet-info-val" id="walSecAddr"></span>
          </div>
          <div class="wallet-info-row">
            <span class="wallet-info-label">Balance BNB</span>
            <span class="wallet-info-val">${bnb} BNB</span>
          </div>
          <div class="wallet-info-row">
            <span class="wallet-info-label">Red</span>
            <span class="wallet-info-val">BNB Smart Chain</span>
          </div>
          <div class="wallet-info-row">
            <span class="wallet-info-label">Tipo</span>
            <span class="wallet-info-val" id="walSecType"></span>
          </div>
        </div>
        <div class="mi-btns-row mt10" id="walSecBtns"></div>
      </div>`;

    LANG.apply();

    const subEl = document.getElementById('walSecAddrSub');
    if (subEl) subEl.textContent = addr.slice(0, 6) + '…' + addr.slice(-4);
    const addrEl = document.getElementById('walSecAddr');
    if (addrEl) { addrEl.textContent = addr.slice(0, 10) + '…' + addr.slice(-6); addrEl.title = addr; }
    const typeEl = document.getElementById('walSecType');
    if (typeEl) typeEl.textContent = STATE.walletType || '—';

    const btnsEl = document.getElementById('walSecBtns');
    if (btnsEl) {
      if (safeAddr) {
        const bscLink   = document.createElement('a');
        bscLink.href    = 'https://bscscan.com/address/' + safeAddr;
        bscLink.target  = '_blank';
        bscLink.rel     = 'noopener noreferrer';
        bscLink.className = 'btn btn-gl btn-sm';
        bscLink.textContent = '🔍 BscScan';
        btnsEl.appendChild(bscLink);
      }
      const discBtn = document.createElement('button');
      discBtn.className = 'btn btn-er btn-sm';
      discBtn.textContent = 'Desconectar';
      discBtn.addEventListener('click', () => this._disconnect());
      btnsEl.appendChild(discBtn);
    }
  },
};
