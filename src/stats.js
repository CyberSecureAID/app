'use strict';
const STATS = {
  _inProgress: false,

  /*
   * load(): Lee estadísticas del contrato y actualiza STATE.
   * Flujo:
   *   1. Guard: si ya hay una carga en progreso, ignorar
   *   2. Intentar getDashboardStats1() (función agregada del contrato)
   *   3. Si falla: fallback a getPoolBalance() individual
   *   4. Si falla: fallback a leer balanceOf del ERC20 directamente
   *   5. Actualizar STATE.poolMax si el nuevo valor es mayor
   *   6. Renderizar UI
   * Por qué cascade: El contrato puede estar en versiones distintas.
   *   No rompemos la UI si getDashboardStats1 no existe.
   */
  async load() {
    if (this._inProgress) return;
    this._inProgress = true;
    try {
      const c = CHAIN.getReadContract();
      let poolBal = 0, bnbColl = 0, txCount = 0, tokSold = 0, usdtzPrice = 0;

      try {
        // Intento 1: getDashboardStats1 con fallback automático de RPC
        const s1 = await CHAIN.callWithFallback(() => c.getDashboardStats1());
        poolBal   = Number(ethers.formatUnits(s1[0], 18));
        bnbColl   = Number(ethers.formatUnits(s1[2], 18));
        txCount   = Number(s1[3]);
        tokSold   = Number(ethers.formatUnits(s1[4], 18));
        usdtzPrice = Number(ethers.formatUnits(s1[5], 18));
      } catch (_) {
        // Fallback 1: getPoolBalance individual con fallback de RPC
        try {
          const pb = await CHAIN.callWithFallback(() => CHAIN.getReadContract().getPoolBalance());
          poolBal = Number(ethers.formatUnits(pb, 18));
        } catch (_2) {
          // Fallback 2: balanceOf del token con fallback de RPC
          try {
            const tb = await CHAIN.callWithFallback(() =>
              CHAIN.getTokenReadContract().balanceOf(STATE.contractAddress)
            );
            poolBal = Number(ethers.formatUnits(tb, 18));
          } catch (_3) { /* Sin datos de pool — mantener último valor conocido */ }
        }
      }

      // Actualizar STATE
      STATE.poolBalance = GUARDS.safeNonNeg(poolBal);
      if (!STATE.poolMax || STATE.poolBalance > STATE.poolMax) STATE.poolMax = STATE.poolBalance;
      STATE.bnbCollected = GUARDS.safeNonNeg(bnbColl);
      STATE.txCount = GUARDS.safeNonNeg(txCount);
      STATE.tokensSold = GUARDS.safeNonNeg(tokSold);
      if (usdtzPrice > 0) {
        STATE.usdtzPriceUSD = usdtzPrice;
        PRICE.recalcRate(); // El precio del token cambió → recalcular tasa
      }
      STATE.contractAddress = STATE.contractAddress; // Mantener dirección activa

      // Renderizar
      UI.renderLiqBar();
      const admPanel = document.getElementById('admPanel');
      if (admPanel && admPanel.classList.contains('open')) ADMIN.updateStats();
    } catch (e) {
      console.warn('[STATS.load]', e?.message);
    } finally {
      this._inProgress = false; // SIEMPRE liberar el lock
    }
  },
};


/* ══════════════════════════════════════════════════════════════
   MÓDULO: WALLET
   Propósito: Gestión del ciclo de vida de la wallet del usuario.
   Flujo:
     openOverlay → user elije tipo → connect(type)
       → switchToBSC() → leer balance → verificar admin
       → loadStats() → renderUI() → updateSwapBtn()
   Invariante:
     - switchToBSC() SIEMPRE antes de leer balance
     - Admin verificado con isAdmin() que llama al contrato
     - En desconexión: STATE se resetea completamente
   Seguridad [T12]: red correcta antes de leer balance.
   Dependencias: CHAIN, STATE, STATS, UI, ADMIN.
══════════════════════════════════════════════════════════════ */
