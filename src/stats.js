'use strict';
const STATS = {
  _inProgress: false,

  /*
   * FIX BUG 3: El bug era que `c` se capturaba por closure antes del
   * callWithFallback. Tras rotar el RPC, `fn()` usaba el contrato viejo.
   * Fix: llamar CHAIN.getReadContract() DENTRO de cada lambda para que
   * se obtenga el contrato con el provider actualizado post-rotación.
   */
  async load() {
    if (this._inProgress) return;
    this._inProgress = true;
    try {
      let poolBal = 0, bnbColl = 0, txCount = 0, tokSold = 0, usdtzPrice = 0;

      try {
        const s1 = await CHAIN.callWithFallback(
          () => CHAIN.getReadContract().getDashboardStats1()
        );
        poolBal    = Number(ethers.formatUnits(s1[0], 18));
        bnbColl    = Number(ethers.formatUnits(s1[2], 18));
        txCount    = Number(s1[3]);
        tokSold    = Number(ethers.formatUnits(s1[4], 18));
        usdtzPrice = Number(ethers.formatUnits(s1[5], 18));
      } catch (_) {
        try {
          const pb = await CHAIN.callWithFallback(
            () => CHAIN.getReadContract().getPoolBalance()
          );
          poolBal = Number(ethers.formatUnits(pb, 18));
        } catch (_2) {
          try {
            const tb = await CHAIN.callWithFallback(
              () => CHAIN.getTokenReadContract().balanceOf(STATE.contractAddress)
            );
            poolBal = Number(ethers.formatUnits(tb, 18));
          } catch (_3) { /* mantener último valor conocido */ }
        }
      }

      STATE.poolBalance  = GUARDS.safeNonNeg(poolBal);
      if (!STATE.poolMax || STATE.poolBalance > STATE.poolMax) STATE.poolMax = STATE.poolBalance;
      STATE.bnbCollected = GUARDS.safeNonNeg(bnbColl);
      STATE.txCount      = GUARDS.safeNonNeg(txCount);
      STATE.tokensSold   = GUARDS.safeNonNeg(tokSold);
      if (usdtzPrice > 0) { STATE.usdtzPriceUSD = usdtzPrice; PRICE.recalcRate(); }

      UI.renderLiqBar();
      const admPanel = document.getElementById('admPanel');
      if (admPanel && admPanel.classList.contains('open')) ADMIN.updateStats();
    } catch (e) {
      console.warn('[STATS.load]', e?.message);
    } finally {
      this._inProgress = false;
    }
  },
};
