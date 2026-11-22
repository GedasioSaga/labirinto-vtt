import { createContext } from 'react'
import type { ItemDoCatalogo } from '../lib/livros/catalogo'

/**
 * DE ONDE VEM O QUE A ARMA FAZ, para o cartão da ficha (docs/design/habilidades/
 * ARMAS-FONTE-UNICA.md §3 e §6). Sem store aqui de propósito: a ficha também é
 * desenhada no app do jogador e no site, que não têm o livro; só a janela do
 * mestre dá o valor (`useFonteDasArmas`, em `EfeitoDaArmaCampos`).
 */
export type FonteDaArma =
  /** Ligada à entrada do livro aberto: a regra é a de lá, e `fichas` são as cópias na pasta. */
  | { tipo: 'livro'; entrada: ItemDoCatalogo; fichas: number }
  /** Sem ligação (ou ligada a uma coisa sem regra neste livro): o cartão é a fonte dele mesmo. */
  | { tipo: 'soNestaFicha' }
  /** Ligada a uma coisa, mas o livro deste sistema não está aberto: não dá para saber a regra daqui. */
  | { tipo: 'semLivro' }

/** `null` = quem desenha a ficha não sabe do livro (jogador, site): o cartão fica como antes. */
export const FonteDaArmaContexto = createContext<((itemId: string | undefined) => FonteDaArma) | null>(null)

/** O selo do cartão: "Do livro · muda em N fichas" ou "Só nesta ficha". */
export function SeloDaFonteDaArma({ fonte }: { fonte: FonteDaArma }) {
  if (fonte.tipo === 'semLivro') return null
  if (fonte.tipo === 'soNestaFicha') return <span className="lb-ficha__chip lb-ficha__chip--so-nesta">Só nesta ficha</span>
  return (
    <span className="lb-ficha__chip lb-ficha__chip--do-livro" title="O que ela faz vem do livro: mudar aqui muda o livro, o Acervo e as outras fichas ligadas.">
      Do livro · muda em {fonte.fichas} {fonte.fichas === 1 ? 'ficha' : 'fichas'}
    </span>
  )
}
