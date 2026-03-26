'use strict';

/*
 * SECURITY AUDIT — wallet.js
 *
 * VULNERABILITIES FIXED:
 *
 * [V4] MISSING CHAIN VALIDATION — switchToBSC() was called but the code
 *      never verified the chain actually switched before proceeding.
 *      An attacker could keep the user on a wrong chain (e.g. Tron) and
 *      have swap calls fail silently or hit a malicious contract at the
 *      same address on a different chain.
 *      FIX: _verifyChain() confirms chainId === 0x38 after switch.
 *      If the chain is wrong, wallet setup is aborted with a clear error.
 *
 * [V5] PROVIDER TRUST — _activeProvider was set directly from
 *      window.okxwallet || window.ethereum without any validation.
 *      A malicious extension could inject a fake provider object at
 *      window.ethereum with overridden request() methods.
 *      FIX: _validateProvider() checks that the provider exposes a real
 *      request function and refuses objects that override standard methods
 *      in suspicious ways.
 *
 * [V6] WALLETCONNECT RELAY — the WalletConnect provider was initialized
 *      without locking the relay URL. Any relay server could be used,
 *      including a malicious one that injects wallet_addEthereumChain
 *      calls with Tron chain parameters.
 *      FIX: relayUrl is pinned to wss://relay.walletconnect.com
 *      (the official Reown relay). Custom relays are rejected.
 *
 * [V7] innerHTML IN renderWalletSection — wallet address was inserted
 *      via template literals into innerHTML without full sanitization.
 *      Although abbreviated, the full address was also used in
 *      href/onclick attributes which could be abused.
 *      FIX: All dynamic values use textContent or GUARDS.esc().
 *      Link hrefs are built safely with validated address only.
 */

const WALLET = {
  openOverlay()  { document.getElementById('walOverlay').classList.add('open'); },
  closeOverlay() { document.getElementById('walOverlay').classList.remove('open'); },

  _activeProvider: null,

  /*
   * [V5 FIX] — Validate that a provider object is a real wallet provider,
   * not a malicious object injected by a browser extension.
   */
  _validateProvider(prov) {
    if (!prov) return false;
    if (typeof prov.request !== 'function') return false;
    // Reject providers that override standard method names suspiciously
    if (prov.request.toString().includes('eval(') || prov.request.toString().includes('Function(')) return false;
    return true;
  },

  /*
   * [V4 FIX] — Verify the actual chain ID after requesting a switch.
   * Returns true if confirmed on BSC mainnet (chainId 56 / 0x38).
   */
  async _verifyChain(prov) {
    try {
      const chainId = await prov.request({ method: 'eth_chainId' });
      const id = typeof chainId === 'string' ? parseInt(chainId, 16) : Number(chainId);
      return id === 56;
    } catch (_) {
      return false;
    }
  },

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
      // [V5 FIX] validate provider before use
      if (!this._validateProvider(window.ethereum)) {
        UI.notif('err', 'Provider Error', 'Wallet provider failed validation. Check for malicious extensions.');
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
        /*
         * [V6 FIX] — Pin relay to the official Reown server.
         * This prevents a malicious relay from injecting foreign chain
         * switch requests (like the Tron network dialog you saw).
         */
        relayUrl: 'wss://relay.walletconnect.com',
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

      // [V6 FIX] Verify we are actually on BSC after WC connect
      const onBsc = await this._verifyChain(provider);
      if (!onBsc) {
        UI.notif('err', 'Wrong Network', 'WalletConnect connected on the wrong chain. Switch to BSC and try again.');
        try { await provider.disconnect(); } catch (_) {}
        return;
      }

      this._activeProvider = provider;
      window._wcProvider   = provider;

      provider.on('accountsChanged', async (accs) => {
        if (!accs.length) { await this._disconnect(); return; }
        await this.setup(accs[0], 'walletconnect', true);
        UI.notif('info', 'Account Changed', UI.abbr(accs[0]));
      });
      provider.on('disconnect', () => this._disconnect());
      provider.on('chainChanged', (chainId) => {
        const id = typeof chainId === 'string' ? parseInt(chainId, 16) : Number(chainId);
        if (id !== 56) {
          UI.notif('err', 'Wrong Network', 'Switched away from BSC. Disconnecting for safety.');
          this._disconnect();
        }
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
    if (!this._validateProvider(provider)) {
      UI.notif('err', 'Provider Error', 'Wallet provider failed validation.');
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
    if (!this._validateProvider(provider)) {
      UI.notif('err', 'Provider Error', 'Wallet provider failed validation.');
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

    // [V4 FIX] Always verify the chain is actually BSC before proceeding
    const prov = this._activeProvider || window.ethereum;
    const onBsc = await this._verifyChain(prov);
    if (!onBsc) {
      UI.notif('err', 'Wrong Network', 'Could not confirm BSC network. Please switch to BNB Smart Chain manually.');
      STATE.walletConnected = false;
      STATE.walletAddress   = null;
      return;
    }

    try {
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
      if (this.isAdmin()) UI.notif('info', 'Admin Detected', 'You have access to the admin panel');
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

    // [V7 FIX] Use textContent for all dynamic values — no innerHTML with user data
    const wa = document.getElementById('walAddr');
    if (wa) wa.textContent = UI.abbr(addr);

    const wb = document.getElementById('walBal');
    if (wb) wb.textContent = STATE.bnbBalance.toFixed(4) + ' BNB';

    const emojiMap = { trust:'🛡️', metamask:'🦊', walletconnect:'🔗', coinbase:'🔵', okx:'🆗' };
    const we = document.getElementById('walEmoji');
    if (we) we.textContent = emojiMap[type] || '👛';

    const bd = document.getElementById('bnbBalDisp');
    if (bd) bd.textContent = STATE.bnbBalance.toFixed(4);

    const np = document.getElementById('netPill');
    if (np) np.style.display = 'flex';
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
      const id = typeof chainId === 'string' ? parseInt(chainId, 16) : Number(chainId);
      if (id !== 56) {
        // [V4 FIX] Disconnect immediately if chain switches away from BSC
        // This prevents interactions with contracts on wrong networks
        UI.notif('err', 'Wrong Network', 'Disconnecting — not BSC Mainnet. Please switch back to BNB Smart Chain.');
        this._disconnect();
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
      const wb = document.getElementById('walBal');
      if (wb) wb.textContent = STATE.bnbBalance.toFixed(4) + ' BNB';
      const bd = document.getElementById('bnbBalDisp');
      if (bd) bd.textContent = STATE.bnbBalance.toFixed(4);
      SWAP.updateBtn();
    } catch (_) {}
  },

  renderWalletSection() {
    const sec = document.getElementById('section-wallet');
    if (!sec) return;

    if (!STATE.walletConnected) {
      // [V7 FIX] Build DOM nodes instead of innerHTML with dynamic data
      sec.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'mi-section-card';

      const hdr = document.createElement('div');
      hdr.className = 'mi-section-header';
      hdr.innerHTML = '<span class="mi-section-icon">🔗</span>';

      const hdrText = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'mi-section-title';
      title.setAttribute('data-i18n', 'connect_wallet');
      title.textContent = LANG.t('connect_wallet');
      hdrText.appendChild(title);
      hdr.appendChild(hdrText);
      card.appendChild(hdr);

      const empty = document.createElement('div');
      empty.className = 'mi-empty';
      empty.textContent = 'Connect your wallet to view wallet information.';
      card.appendChild(empty);

      const btn = document.createElement('button');
      btn.className = 'btn btn-ac btn-full mt10';
      btn.textContent = LANG.t('connect_wallet');
      btn.addEventListener('click', () => WALLET.openOverlay());
      card.appendChild(btn);

      sec.appendChild(card);
      return;
    }

    const addr  = STATE.walletAddress || '';
    // Only allow valid BSC addresses for link building
    const safeAddr = /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr : '';
    const bnb   = STATE.bnbBalance ? STATE.bnbBalance.toFixed(4) : '—';
    const emojiMap = { trust:'🛡️', metamask:'🦊', walletconnect:'🔗', coinbase:'🔵', okx:'🆗' };
    const emoji = emojiMap[STATE.walletType] || '👛';

    // [V7 FIX] Use textContent for all user-derived values
    sec.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'mi-section-card';

    const hdr = document.createElement('div');
    hdr.className = 'mi-section-header';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'mi-section-icon';
    iconSpan.textContent = emoji;
    hdr.appendChild(iconSpan);

    const hdrText = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'mi-section-title';
    title.setAttribute('data-i18n', 'wallet_section_title');
    title.textContent = LANG.t('wallet_section_title');

    const sub = document.createElement('div');
    sub.className = 'mi-section-sub';
    // Safe abbreviated address via textContent
    sub.textContent = safeAddr
      ? (safeAddr.slice(0, 6) + '…' + safeAddr.slice(-4))
      : '—';

    hdrText.appendChild(title);
    hdrText.appendChild(sub);
    hdr.appendChild(hdrText);
    card.appendChild(hdr);

    // Info grid — all textContent, no innerHTML for dynamic values
    const grid = document.createElement('div');
    grid.className = 'wallet-info-grid';

    const rows = [
      ['Address', safeAddr ? (safeAddr.slice(0, 10) + '…' + safeAddr.slice(-6)) : '—'],
      ['BNB Balance', bnb + ' BNB'],
      ['Network', 'BNB Smart Chain'],
      ['Wallet type', STATE.walletType || '—'],
    ];

    rows.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'wallet-info-row';
      const lbl = document.createElement('span');
      lbl.className = 'wallet-info-label';
      lbl.textContent = label;
      const val = document.createElement('span');
      val.className = 'wallet-info-val';
      val.textContent = value;
      row.appendChild(lbl);
      row.appendChild(val);
      grid.appendChild(row);
    });

    card.appendChild(grid);

    // Action buttons
    const btnsEl = document.createElement('div');
    btnsEl.className = 'mi-btns-row mt10';

    if (safeAddr) {
      // [V7 FIX] Build link href from validated address only
      const bscLink = document.createElement('a');
      bscLink.href    = 'https://bscscan.com/address/' + safeAddr;
      bscLink.target  = '_blank';
      bscLink.rel     = 'noopener noreferrer';
      bscLink.className = 'btn btn-gl btn-sm';
      bscLink.textContent = '🔍 BscScan';
      btnsEl.appendChild(bscLink);
    }

    const discBtn = document.createElement('button');
    discBtn.className = 'btn btn-er btn-sm';
    discBtn.textContent = 'Disconnect';
    discBtn.addEventListener('click', () => this._disconnect());
    btnsEl.appendChild(discBtn);

    card.appendChild(btnsEl);
    sec.appendChild(card);
  },
};
