'use strict';
const PRICE = {
  _APIS: [
    () => fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BNBUSDT').then(r => r.json()).then(d => ({ price: parseFloat(d.lastPrice), change: parseFloat(d.priceChangePercent) })),
    () => fetch('https://min-api.cryptocompare.com/data/price?fsym=BNB&tsyms=USD').then(r => r.json()).then(d => ({ price: d.USD, change: 0 })),
    () => fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd&include_24hr_change=true').then(r => r.json()).then(d => ({ price: d.binancecoin.usd, change: d.binancecoin.usd_24h_change || 0 })),
  ],

  /*
   * refresh(): Obtiene el precio BNB actual de APIs externas.
   * Flujo:
   *   1. Intenta cada API en orden hasta que una tenga éxito
   *   2. Valida que el precio esté en rango razonable
   *   3. Actualiza STATE y recalcula la tasa
   *   4. Actualiza la UI del ticker y la calculadora admin
   * Si todas fallan: mantiene precio anterior (no quiebra la UI).
   */
  async refresh() {
    let price = 0, change = 0;
    for (const apiFn of this._APIS) {
      try {
        const res = await apiFn();
        if (Number.isFinite(res.price) && res.price > CONFIG.LIMITS.BNB_PRICE_MIN) {
          price = res.price;
          change = res.change || 0;
          break;
        }
      } catch (_) { /* Continuar al siguiente */ }
    }

    // Validar dentro de rango razonable
    const L = CONFIG.LIMITS;
    if (price >= L.BNB_PRICE_MIN && price <= L.BNB_PRICE_MAX) {
      STATE.bnbPricePrev = STATE.bnbPriceUSD;
      STATE.bnbPriceUSD = price;
      this.recalcRate();
      UI.renderTicker(price, change);
      ADMIN.updatePriceCalc(); // Actualiza calculadora del admin
    }
    // Si precio inválido: no actualizar (mantener último conocido)
  },

  /*
   * recalcRate(): Calcula la tasa de intercambio BNB→Token.
   * Fórmula: rate = BNBprice / TokenPrice
   * Ejemplo: BNB=$600, Token=$0.012 → rate=50,000 tokens/BNB
   * Invariante: Si cualquier valor es 0 o inválido, rate=0
   *   (lo que deshabilita el botón de swap).
   * Dependencias: STATE.bnbPriceUSD, STATE.usdtzPriceUSD
   */
  recalcRate() {
    const { bnbPriceUSD, usdtzPriceUSD } = STATE;
    if (!Number.isFinite(bnbPriceUSD) || bnbPriceUSD <= 0) { STATE.currentRate = 0; return; }
    if (!Number.isFinite(usdtzPriceUSD) || usdtzPriceUSD <= 0) { STATE.currentRate = 0; return; }
    STATE.currentRate = bnbPriceUSD / usdtzPriceUSD;
    // Actualizar el display de tasa en la UI
    const rateDisp = document.getElementById('rateDisp');
    if (rateDisp) rateDisp.textContent = `1 BNB = ${UI.fmtRate(STATE.currentRate)} ${STATE.tokenSymbol}`;
    const detRate = document.getElementById('detRate');
    if (detRate) detRate.textContent = `1 BNB = ${UI.fmtRate(STATE.currentRate)} ${STATE.tokenSymbol}`;
  },
};


/* ══════════════════════════════════════════════════════════════
   MÓDULO: STATS
   Propósito: Lectura de estadísticas del contrato (pool balance,
     BNB recibido, txs, etc.) y actualización de STATE.
   Invariante:
     - Mutex _inProgress previene calls concurrentes [T11]
     - Funciona sin wallet (usa public RPC)
     - Fallback en cascada si getDashboardStats1() no existe
   Seguridad [T11]: Race condition prevenida con flag.
   Dependencias: CHAIN, STATE, UI.
══════════════════════════════════════════════════════════════ */
