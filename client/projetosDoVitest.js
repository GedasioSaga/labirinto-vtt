/*
 * Globs dos projetos 'lento' e 'desempenho' do vitest, lidos de
 * client/vitest.projetos.json (docs/planos/teste-em-niveis.md). O 'rapido' é
 * todo o resto: teste novo cai nele sem ninguém precisar lembrar de listar.
 *
 * ESM com `import` estático, como o porta.js: o vite empacota o vite.config.ts
 * com esbuild e um `require` dentro de CJS quebraria o config inteiro.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ARQUIVO = join(dirname(fileURLToPath(import.meta.url)), 'vitest.projetos.json')

export function globsDosProjetos() {
  const bruto = JSON.parse(readFileSync(ARQUIVO, 'utf8'))
  const globs = (lista) => (lista ?? []).map((item) => item.glob)
  return { lento: globs(bruto.lento), desempenho: globs(bruto.desempenho) }
}
