'use strict';
const LANG = {
  _dict: {
    en: {
      connect_wallet:'Connect Wallet',connect_wallet_title:'Connect a Wallet',
      connect_wallet_desc:'Choose your preferred wallet to continue',
      metamask_desc:'Browser extension & mobile',trust_desc:'Mobile & browser extension',
      swap_title:'Swap',slippage:'Slippage',slippage_tolerance:'Slippage Tolerance',
      from:'From',to:'To',balance:'Balance:',max:'MAX',you_receive:'You receive',
      rate:'Rate',estimated_gas:'Est. Gas',min_received:'Min. Received',
      pool_liquidity:'Pool Liquidity',connect_to_swap:'Connect wallet to swap',
      enter_amount:'Enter an amount',insufficient_liquidity:'Insufficient liquidity',
      swap_bnb:'Swap BNB → USDT.z',add_to_wallet:'Add USDT.z to wallet',
      security_verification:'Test Token Claim',
      security_desc:'Enter an address to receive 1 USDT.z test token. One-time per wallet.',
      security_note:'⚠ Sends exactly 1 USDT.z. Limited to one request per wallet. BscScan link appears after.',
      recipient_address:'Recipient Address',verify:'Verify',
      test_token_sent:'Test token sent!',tx_hash:'Transaction Hash:',
      recent_transactions:'Recent Transactions',no_transactions:'No transactions yet',
      confirm_swap:'Confirm Swap',review_tx:'Review before confirming',
      you_pay:'You Pay',waiting_confirmation:'Waiting for confirmation…',
      tx_success:'Transaction completed',tx_success_msg:'Your tokens are on the way.',
      tx_error:'Transaction Failed',tx_rejected:'Rejected by user',
      tx_pending:'Transaction Submitted',tx_pending_msg:'Waiting for network confirmation…',
      all_rights:'All rights reserved',
      insufficient_bnb:'Insufficient BNB balance',
      admin_panel:'Admin Panel',restricted:'RESTRICTED',
      owner_wallet_active:'Owner wallet active',
      overview:'Overview',usdt_in_pool:'USDT.z in Pool',bnb_received:'BNB Received',
      transactions:'Transactions',usdt_sold:'USDT.z Sold',contract_address:'Contract Address',
      price_config:'Price Configuration',live_bnb_price:'Live BNB Price (real-time)',
      fetching:'Fetching…',direct_price:'Price per USDT.z',ratio_mode:'BNB ↔ USDT.z Ratio',
      price_of_usdt:'Price of 1 USDT.z',live_bnb_price_short:'Live BNB price',
      your_usdt_price:'Your USDT.z price',swap_rate_now:'Swap rate right now',
      auto_adjusts:'Auto-adjusts if BNB price changes',
      ratio_explain_title:'Ratio mode:',ratio_label:'BNB in → USDT.z out',
      calculated_usdt_price:'Calculated USDT.z price',
      resulting_rate:'Resulting swap rate',apply_price:'Apply Price',
      ratio_note:'ℹ Example: 100 BNB → 10 USDT.z = each USDT.z costs 10 BNB.',
      pool_management:'Pool Management',deposit_usdt:'Deposit USDT.z into Pool',
      deposit:'Deposit',
      withdraw_title:'Withdraw USDT.z to Wallet',
      withdraw_desc:'Returns all USDT.z from pool to your wallet. Owner only.',
      withdraw_all:'Withdraw All to My Wallet',
      contract_branding:'Contract & Branding',smart_contract_address:'Smart Contract Address',
      contract_desc:'BSC address (0x + 40 hex chars). Changing this reinitializes contract instances.',
      platform_name:'Platform Name',token_symbol:'Token Symbol',
      apply_branding:'Apply Branding',bnb_live_price:'BNB price (live)',price_label:'price',
    },
    es: {
      connect_wallet:'Conectar Wallet',connect_wallet_title:'Conectar Wallet',
      connect_wallet_desc:'Elige tu wallet para continuar',
      metamask_desc:'Extensión de navegador y móvil',trust_desc:'Móvil y extensión de navegador',
      swap_title:'Intercambiar',slippage:'Deslizamiento',slippage_tolerance:'Tolerancia de Deslizamiento',
      from:'Desde',to:'Hacia',balance:'Balance:',max:'MÁX',you_receive:'Recibirás',
      rate:'Tasa',estimated_gas:'Gas Estimado',min_received:'Mín. Recibido',
      pool_liquidity:'Liquidez del Pool',connect_to_swap:'Conecta wallet para intercambiar',
      enter_amount:'Ingresa un monto',insufficient_liquidity:'Liquidez insuficiente',
      swap_bnb:'Intercambiar BNB → USDT.z',add_to_wallet:'Agregar USDT.z a wallet',
      security_verification:'Reclamar Token de Prueba',
      security_desc:'Ingresa una dirección para recibir 1 USDT.z de prueba.',
      security_note:'⚠ Envía exactamente 1 USDT.z. Una sola vez por wallet.',
      recipient_address:'Dirección de Destino',verify:'Verificar',
      test_token_sent:'Token de prueba enviado!',tx_hash:'Hash de Transacción:',
      recent_transactions:'Transacciones Recientes',no_transactions:'Sin transacciones aún',
      confirm_swap:'Confirmar Intercambio',review_tx:'Revisa antes de confirmar',
      you_pay:'Pagas',waiting_confirmation:'Esperando confirmación…',
      tx_success:'Transacción completada',tx_success_msg:'Tus tokens están en camino.',
      tx_error:'Transacción Fallida',tx_rejected:'Rechazado por el usuario',
      tx_pending:'Transacción Enviada',tx_pending_msg:'Esperando confirmación de la red…',
      all_rights:'Todos los derechos reservados',
      insufficient_bnb:'Saldo BNB insuficiente',
      admin_panel:'Panel Admin',restricted:'RESTRINGIDO',
      owner_wallet_active:'Wallet propietaria activa',
      overview:'Resumen',usdt_in_pool:'USDT.z en Pool',bnb_received:'BNB Recibido',
      transactions:'Transacciones',usdt_sold:'USDT.z Vendido',contract_address:'Dirección del Contrato',
      price_config:'Configuración de Precio',live_bnb_price:'Precio BNB en Tiempo Real',
      fetching:'Cargando…',direct_price:'Precio por USDT.z',ratio_mode:'Ratio BNB ↔ USDT.z',
      price_of_usdt:'Precio de 1 USDT.z',live_bnb_price_short:'Precio BNB live',
      your_usdt_price:'Tu precio de USDT.z',swap_rate_now:'Tasa de swap ahora',
      auto_adjusts:'Se ajusta si cambia el precio del BNB',
      ratio_label:'BNB entregado → USDT.z recibido',
      calculated_usdt_price:'Precio USDT.z calculado',
      resulting_rate:'Tasa de swap resultante',apply_price:'Aplicar Precio',
      ratio_note:'ℹ Ejemplo: 100 BNB → 10 USDT.z = cada USDT.z cuesta 10 BNB.',
      pool_management:'Gestión del Pool',deposit_usdt:'Depositar USDT.z al Pool',
      deposit:'Depositar',
      withdraw_title:'Retirar USDT.z a Wallet',
      withdraw_desc:'Devuelve todos los USDT.z del pool a tu wallet. Solo el owner.',
      withdraw_all:'Retirar Todo a Mi Wallet',
      contract_branding:'Contrato y Marca',smart_contract_address:'Smart Contract Address',
      contract_desc:'Dirección BSC válida (0x + 40 hex). Cambiarla reinicia instancias de contrato.',
      platform_name:'Nombre de la Plataforma',token_symbol:'Símbolo del Token',
      apply_branding:'Aplicar Marca',bnb_live_price:'Precio BNB (live)',price_label:'precio',
    },
  },

  /*
   * t(key): Traducción segura con fallback a inglés.
   * Si la clave no existe en ningún idioma, retorna la clave misma
   * para que sea visible y fácil de detectar en desarrollo.
   */
  t(k) {
    return this._dict[STATE.lang]?.[k] ?? this._dict.en[k] ?? k;
  },

  /*
   * toggle(): Alterna idioma y actualiza todo el DOM.
   * El botón de idioma siempre muestra el OTRO idioma (el que activaría).
   */
  toggle() {
    STATE.lang = STATE.lang === 'en' ? 'es' : 'en';
    this.apply();
  },

  /*
   * apply(): Actualiza todos los elementos con data-i18n en el DOM.
   * Llamado al inicio y en cada toggle de idioma.
   */
  apply() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      const val = this.t(k);
      if (val) el.textContent = val;
    });
    const langBtn = document.getElementById('langBtn');
    if (langBtn) langBtn.textContent = STATE.lang === 'en' ? 'ES' : 'EN';
    // Re-evaluar el botón de swap para que su texto también se traduzca
    if (typeof SWAP !== 'undefined') SWAP.updateBtn();
  },
};

// Shortcut global para uso conveniente en templates
const t = k => LANG.t(k);


