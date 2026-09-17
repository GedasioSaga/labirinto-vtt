/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Porta por árvore de trabalho: 1420 na principal, própria em cada worktree.
// Sem isso, dois portões em paralelo testam o mesmo servidor (client/porta.js).
import { portaDoProjeto } from './porta.js'

const host = process.env.TAURI_DEV_HOST
const porta = portaDoProjeto()

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: porta,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: porta + 1 } : undefined,
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
