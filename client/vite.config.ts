/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
  },
  // Duas páginas no mesmo build: o editor (index.html) e a página do jogador
  // (player.html), servida pelo servidor axum do app em /player.
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        player: 'player.html',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'recreate/**'],
  },
})
