/// <reference types="vitest/config" />
import { createReadStream, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath, searchForWorkspaceRoot, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// Porta por árvore de trabalho: 1420 na principal, própria em cada worktree.
// Sem isso, dois portões em paralelo testam o mesmo servidor (client/porta.js).
import { portaDoProjeto } from './porta.js'
// Teste em níveis (docs/planos/teste-em-niveis.md): a lista de quem é lento e
// de quem é sensível a tempo mora em client/vitest.projetos.json.
import { globsDosProjetos } from './projetosDoVitest.js'

const host = process.env.TAURI_DEV_HOST
const porta = portaDoProjeto()
const projetos = globsDosProjetos()
// desempenho/ = harness Playwright do mapa grande (scripts/medir-desempenho.cjs), não é vitest
const EXCLUIDOS_DO_TESTE = ['**/node_modules/**', '**/dist/**', 'e2e/**', 'recreate/**', 'desempenho/**']

// DESENHADO (src/texturas/desenhado/arquivos.ts): as imagens moram fora do
// `root` (client/), em godot/desenhado/exportado/, e entram no app sem cópia.
const PASTA_DO_CLIENT = fileURLToPath(new URL('.', import.meta.url))
const PASTA_DO_DESENHADO = fileURLToPath(new URL('../godot/desenhado/exportado/', import.meta.url))
const PREFIXO_DO_DESENHADO = normalizePath(PASTA_DO_DESENHADO)

/**
 * PNG do Desenhado nunca vira base64 no JS: 228 dos ~540 têm menos de 4 KiB e
 * seriam embutidos pelo padrão. Arquivo próprio em `assets/` entra no cache do
 * navegador do jogador (nome com hash) e só é baixado pela cena que o usa.
 * `undefined` = o padrão do Vite para todo o resto.
 */
function embutirAsset(arquivo: string): boolean | undefined {
  return normalizePath(arquivo).startsWith(PREFIXO_DO_DESENHADO) ? false : undefined
}

/**
 * FOGO NA FLORESTA (minigames/fogo/): o jogo é um export web do Godot que
 * mora FORA do repositório (40 MB, quase tudo o motor). Em dev, o Vite serve a
 * pasta do build em `/minigames/fogo/`, a mesma rota que a página do jogador
 * usa (`ROTA_DO_FOGO` de `FogoOverlay.tsx`). Pasta: `FOGO_WEB_DIR`, ou o build
 * do projeto do jogo em `~/jogos/fogo-na-floresta/build/web`. No app instalado
 * quem serve é o mestre, pelo pacote baixado na primeira vez (fora daqui).
 */
const ROTA_DO_FOGO = '/minigames/fogo/'
const PASTA_DO_FOGO = process.env.FOGO_WEB_DIR ?? join(homedir(), 'jogos', 'fogo-na-floresta', 'build', 'web')
const TIPO_DO_ARQUIVO_DO_FOGO: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.pck': 'application/octet-stream',
  '.png': 'image/png',
}
/** Só um nome de arquivo do build, sem pasta nem ponto na frente: nada sai da pasta do jogo. */
const NOME_DO_ARQUIVO_DO_FOGO = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/

function jogoDoFogoEmDev(): Plugin {
  return {
    name: 'labirinto-jogo-do-fogo',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(ROTA_DO_FOGO, (req, res, next) => {
        // O `use` com rota já tira o prefixo: sobra `/index.wasm?v=1`.
        const nome = (req.url ?? '').split('?')[0].slice(1) || 'index.html'
        const tipo = TIPO_DO_ARQUIVO_DO_FOGO[extname(nome)]
        if (!NOME_DO_ARQUIVO_DO_FOGO.test(nome) || tipo === undefined) return next()
        const caminho = join(PASTA_DO_FOGO, nome)
        let tamanho: number
        try {
          tamanho = statSync(caminho).size
        } catch {
          res.statusCode = 404
          res.end('O build do Fogo na Floresta não está nesta máquina (FOGO_WEB_DIR).')
          return
        }
        res.setHeader('Content-Type', tipo)
        res.setHeader('Content-Length', String(tamanho))
        res.setHeader('Cache-Control', 'no-cache')
        createReadStream(caminho).pipe(res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), jogoDoFogoEmDev()],
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
    // Dar `allow` desliga a descoberta automática da raiz: ela volta pela
    // primeira linha, e a pasta do Desenhado entra explícita (não depende de o
    // repo continuar sendo workspace npm).
    fs: { allow: [searchForWorkspaceRoot(PASTA_DO_CLIENT), PASTA_DO_DESENHADO] },
  },
  // Três páginas no mesmo build: o editor (index.html), a página do jogador
  // (player.html), servida pelo servidor axum do app em /player, e a janela da
  // Visão de jogador (visao-jogador.html), aberta pelo Rust dentro do app.
  build: {
    assetsInlineLimit: embutirAsset,
    rollupOptions: {
      input: {
        main: 'index.html',
        player: 'player.html',
        visaoJogador: 'visao-jogador.html',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: EXCLUIDOS_DO_TESTE,
    // Três projetos que, somados, são EXATAMENTE a suíte de antes (a guarda
    // vitest.projetos.test.mjs e a paridade por nome provam). `vitest run` sem
    // --project roda os três: rapido e lento juntos, desempenho depois
    // (groupOrder 1), sozinho e em série, porque teste de tempo sob carga mente.
    projects: [
      { extends: true, test: { name: 'rapido', exclude: [...EXCLUIDOS_DO_TESTE, ...projetos.lento, ...projetos.desempenho] } },
      { extends: true, test: { name: 'lento', include: projetos.lento } },
      {
        extends: true,
        test: { name: 'desempenho', include: projetos.desempenho, fileParallelism: false, maxWorkers: 1, sequence: { groupOrder: 1 } },
      },
    ],
  },
})
