import { defineConfig } from 'vite';

export default defineConfig({
  // Raíz del proyecto
  root: '.',

  build: {
    outDir: 'dist',
    // Un solo bundle para máxima compatibilidad con BSC dApps
    rollupOptions: {
      input: 'index.html',
    },
    // Target browsers modernos con soporte para ethers v6
    target: 'es2020',
    // Minificar en producción
    minify: 'esbuild',
    sourcemap: true,
  },

  server: {
    port: 3000,
    open: true,
  },

  preview: {
    port: 4173,
  },
});
