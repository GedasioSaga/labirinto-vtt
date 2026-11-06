import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Build do site do Lobby (labirintolobby.pages.dev), separado do app.
 * Plano: docs/planos/lobby-jogadores-2026-11-05.md, fatia S1 e seção 6.7.
 *
 * - `root` é `client/lobby-site/`, para o `index.html` sair na raiz do
 *   `dist-lobby` (o Pages serve `/` dali; com o root em `client/` ele sairia em
 *   `dist-lobby/lobby-site/index.html`).
 * - `publicDir` é `client/public-lobby/` (o `_headers` com a CSP), e não o
 *   `public/` do app.
 * - O código do site mora em `client/src/lobby-site/`, coberto pelo `tsc` do
 *   client. O `index.html` aponta `/src/lobby-site/main.tsx`, e o alias abaixo
 *   leva `/src/` para `client/src/` (sem ele o caminho seria lido dentro do root).
 */

const PASTA_DO_SITE = fileURLToPath(new URL('./lobby-site/', import.meta.url))
const PASTA_DO_SRC = normalizePath(fileURLToPath(new URL('./src/', import.meta.url)))

// Porta própria: 1420/1421 são do app (porta.js) e 1422 do harness de recriação.
const PORTA_DO_LOBBY = 1430

// O site roda no navegador de qualquer jogador, fora do Tauri e sem o mapa:
// nada do Tauri (nem chega a existir lá) nem os motores de desenho do app
// (centenas de KB que o site não usa). Vale para o site e para tudo que ele
// importa, inclusive código de `client/src/lib/`.
const PACOTE_PROIBIDO = /^(?:@tauri-apps\/|pixi\.js(?:\/|$)|@pixi\/|three(?:\/|$))/
const CAMINHO_PROIBIDO = /\/node_modules\/(?:@tauri-apps|pixi\.js|@pixi|three)\//

/**
 * Guarda de import: o build (e o dev) falha quando um módulo do site importa
 * `@tauri-apps/*`, `pixi.js` ou `three`, direto ou por algum arquivo no meio.
 * `resolveId` pega o nome do pacote e diz quem importou; `load` pega o mesmo
 * pacote quando ele chega por caminho (relativo ou alias) em vez de pelo nome.
 */
function guardaDeImportDoSite(): Plugin {
  return {
    name: 'lobby:guarda-de-import',
    enforce: 'pre',
    resolveId(origem, quemImporta) {
      if (PACOTE_PROIBIDO.test(origem)) {
        this.error(`site do Lobby não pode importar "${origem}" (importado por ${quemImporta ?? 'entrada'}): o site roda fora do Tauri e sem o mapa`)
      }
      return null
    },
    load(id) {
      if (CAMINHO_PROIBIDO.test(normalizePath(id))) {
        this.error(`site do Lobby não pode carregar ${id}: o site roda fora do Tauri e sem o mapa`)
      }
      return null
    },
  }
}

export default defineConfig({
  root: PASTA_DO_SITE,
  publicDir: '../public-lobby',
  plugins: [guardaDeImportDoSite(), react()],
  clearScreen: false,
  // Cache de dependências só do Lobby: o dev do app usa `.vite-<porta>` e um
  // reotimizando no meio do outro dá tela branca (ver vite.config.ts).
  cacheDir: '../node_modules/.vite-lobby',
  resolve: {
    alias: [{ find: /^\/src\//, replacement: PASTA_DO_SRC }],
  },
  server: { port: PORTA_DO_LOBBY, strictPort: true },
  preview: { port: PORTA_DO_LOBBY, strictPort: true },
  build: {
    outDir: '../dist-lobby',
    // O outDir fica fora do root, e aí o Vite não esvazia sozinho: sem isto,
    // arquivo de um build velho iria junto no deploy.
    emptyOutDir: true,
  },
})
