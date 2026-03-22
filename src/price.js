'use strict';
const PRICE = {
  /*
   * APIs de precio BNB/USD — en orden de prioridad.
   *
   * FIX: Binance devuelve 451 (bloqueado por región) desde GitHub Pages
   * y cualquier hosting estático que no esté en la allowlist de Binance.
   * Eliminada de la lista. CoinGecko y CryptoCompare no tienen esa restricción.
   *
   * Orden actual:
   *   1. CryptoCompare — rápida, sin restricciones de origen
   *   2. CoinGecko      — confiable, sin restricciones de origen
   *   3. Binance simple — como último recurso (falla silenciosamente si 451)
   */
  _APIS: [
    () => fetch('https://min-api.cryptocompare.com/data/price?fsym=BNB&tsyms=USD')
            .then(r => r.json())
            .then(d => ({ price: d.USD, change: 0 })),

    () => fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd&include_24hr_change=true')
            .then(r => r.json())
            .then(d => ({ price: d.binancecoin.usd, change: d.binancecoin.usd_24h_change || 0 })),

    () => fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
            .then(r => r.json())
            .then(d => ({ price: parseFloat(d.price), change: 0 })),
  ],

  /*
   * refresh(): Obtiene el precio BNB actual de APIs externas.
   * Si todas fallan: mantiene precio anterior (no quiebra la UI).
   */
  async refresh() {
    let price = 0, change = 0;
    for (const apiFn of this._APIS) {
      try {
        const res = await apiFn();
        if (Number.isFinite(res.price) && res.price > CONFIG.LIMITS.BNB_PRICE_MIN) {
          price  = res.price;
          change = res.change || 0;
          break;
        }
      } catch (_) { /* Continuar al siguiente */ }
    }

    const L = CONFIG.LIMITS;
    if (price >= L.BNB_PRICE_MIN && price <= L.BNB_PRICE_MAX) {
      STATE.bnbPricePrev = STATE.bnbPriceUSD;
      STATE.bnbPriceUSD  = price;
      this.recalcRate();
      UI.renderTicker(price, change);
      ADMIN.updatePriceCalc();
    }
  },

  /*
   * recalcRate(): Calcula la tasa de intercambio BNB→Token.
   * Fórmula: rate = BNBprice / TokenPrice
   */
  recalcRate() {
    const { bnbPriceUSD, usdtzPriceUSD } = STATE;
    if (!Number.isFinite(bnbPriceUSD) || bnbPriceUSD <= 0)  { STATE.currentRate = 0; return; }
    if (!Number.isFinite(usdtzPriceUSD) || usdtzPriceUSD <= 0) { STATE.currentRate = 0; return; }
    STATE.currentRate = bnbPriceUSD / usdtzPriceUSD;
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
