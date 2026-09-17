/*
 * Porta do vite por PASTA — uma por árvore de trabalho.
 *
 * POR QUE EXISTE. `vite.config.ts` fixava 1420 com `strictPort: true` e o
 * `playwright.config.ts` reaproveita servidor que já responde
 * (`reuseExistingServer`). Com duas árvores (worktrees) rodando o portão ao
 * mesmo tempo, o vite da segunda morre por porta ocupada e o Playwright dela
 * testa o app da PRIMEIRA: verde (ou vermelho) sobre código que não é o dela.
 *
 * A árvore principal continua na 1420: é a porta que o exe em dev aponta
 * (desktop/src-tauri/src/net/server.rs:42) e a que o usuário abre na mão.
 * Worktree ganha porta própria, derivada do caminho — determinística, sem
 * combinar nada com quem dispara o portão.
 *
 * POR QUE É ESM (e não .cjs). A primeira versão era CommonJS e derrubou o
 * projeto inteiro: o vite empacota o `vite.config.ts` com esbuild, e um
 * `require('node:crypto')` dentro de módulo CJS vira `__require` no bundle,
 * que lança "Dynamic require of node:crypto is not supported". Resultado
 * medido em 17/09/2026: `npm run dev` e `vitest` não subiam, e as jornadas só
 * passavam porque havia um vite antigo vivo na 1420. Com `import` estático de
 * ESM o esbuild mantém o import de verdade e nada disso acontece.
 */
import { createHash } from 'node:crypto'
import { statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORTA_PRINCIPAL = 1420
const PRIMEIRA_PORTA_WORKTREE = 1500
const QUANTAS_PORTAS = 40
// Par a par: o vite usa a porta e o HMR costuma usar a seguinte.
const PASSO = 2

// Worktree do git tem `.git` ARQUIVO (aponta para a árvore principal);
// a árvore principal tem `.git` diretório.
function ehWorktree(raizDoRepo) {
  try {
    return statSync(join(raizDoRepo, '.git')).isFile()
  } catch {
    return false
  }
}

export function portaDoProjeto() {
  const daEnv = Number(process.env.LAB_PORTA)
  if (Number.isFinite(daEnv) && daEnv > 0) return daEnv
  const raizDoRepo = dirname(dirname(fileURLToPath(import.meta.url)))
  if (!ehWorktree(raizDoRepo)) return PORTA_PRINCIPAL
  const digest = createHash('sha1').update(raizDoRepo.toLowerCase()).digest()
  return PRIMEIRA_PORTA_WORKTREE + (digest.readUInt16BE(0) % QUANTAS_PORTAS) * PASSO
}

export { PORTA_PRINCIPAL }
