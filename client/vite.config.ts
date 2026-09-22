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
  // Cache de dependências por porta, e não o `node_modules/.vite` padrão: os
  // worktrees de teste ligam o `node_modules` da árvore principal por junction,
  // então todos dividiam a MESMA pasta, e um vite reotimizando no meio do teste
  // do outro dava tela branca ("Failed to fetch dynamically imported module",
  // medido em 22/09). Cada porta é uma árvore de trabalho (client/porta.js).
  cacheDir: `node_modules/.vite-${porta}`,
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
