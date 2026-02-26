# MiSwap v8.0 — Refactor Paso 1

## Qué cambió

El monolito `index_v8.html` (~2861 líneas) fue separado en módulos independientes manteniendo **100% de compatibilidad funcional**.

```
miswap/
├── index.html          ← HTML limpio (sin JS inline)
├── package.json
├── vite.config.js
└── src/
    ├── styles.css      ← Todo el CSS extraído
    ├── config.js       ← Constantes, ABIs, direcciones
    ├── guards.js       ← Validaciones y sanitización (esc, safePositive...)
    ├── state.js        ← Estado global (S) — única fuente de verdad
    ├── lang.js         ← Sistema i18n (ES/EN)
    ├── chain.js        ← Providers, signer, instancias de contrato
    ├── price.js        ← Precio BNB/USD desde APIs externas
    ├── stats.js        ← Estadísticas del pool
    ├── wallet.js       ← Conexión/desconexión MetaMask / Trust Wallet
    ├── swap.js         ← UI y ejecución del swap
    ├── testtok.js      ← Flujo de test token (one-time per wallet)
    ├── admin.js        ← Panel administrativo
    ├── ui.js           ← Helpers: notif, render, formato
    └── app.js          ← Inicialización y orquestación
```

## Orden de carga (grafo de dependencias)

```
CONFIG → GUARDS → STATE → LANG → CHAIN → PRICE
→ STATS → WALLET → SWAP → TESTTOK → ADMIN → UI → APP
```

## Cómo correr

### Sin build (abrir directo en browser)
Abre `index.html` en un servidor local. Funciona sin Vite.

### Con Vite (desarrollo)
```bash
npm install
npm run dev
```

### Build de producción
```bash
npm run build
# Output en /dist
```

## Lo que NO cambió

- **Zero cambios en lógica**: todos los módulos son el mismo código, solo en archivos separados
- **El contrato no se toca**: `CONTRACT_ADDRESS` y `TOKEN_ADDRESS` sin cambios
- **Misma seguridad**: todos los guards, mutexes y validaciones intactos
- **Misma UI**: el HTML y CSS son idénticos al original

## Próximos pasos (Paso 2+)

- [ ] Mover `CONTRACT_ADDRESS` y wallets admin a `.env`
- [ ] Pool de RPCs con fallback automático
- [ ] Cache de precios via WebSocket
- [ ] Lazy-load del bundle `admin.js` (solo si wallet es admin)
- [ ] Archivos `en.json` / `es.json` para i18n
- [ ] Error tracking centralizado (Sentry)
