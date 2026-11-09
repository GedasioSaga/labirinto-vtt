import type { Verbete } from '../../lib/preparo/tipos'

/**
 * O verbete de um cartão, sem puxar o tldraw: o diálogo "Citar o quadro" (no
 * pedaço do editor de texto) usa o mesmo achado que o cartão desenhado.
 */

/** Id do Grimório → id no Prelúdio, para o cartão importado achar o verbete cujo id mudou na importação. */
const indicePorOrigem = new WeakMap<ReadonlyMap<string, Verbete>, Map<string, string>>()

/** O verbete do cartão: pelo id e, se não achar, pelo id que ele tinha no Grimório. */
export function verbeteDoCartao(verbetes: ReadonlyMap<string, Verbete>, id: string): Verbete | undefined {
  const direto = verbetes.get(id)
  if (direto !== undefined) return direto
  let indice = indicePorOrigem.get(verbetes)
  if (indice === undefined) {
    indice = new Map()
    for (const verbete of verbetes.values()) {
      const origem = verbete.origem?.grimorio?.id
      if (origem !== undefined) indice.set(origem, verbete.id)
    }
    indicePorOrigem.set(verbetes, indice)
  }
  const real = indice.get(id)
  return real === undefined ? undefined : verbetes.get(real)
}
