/**
 * O CONTRATO DA TELA DO JOGADOR NO PUZZLE (plano `docs/design/puzzles/PLANO.md`
 * §4, fase P8). A tela recebe a vista (o recorte por lista branca,
 * `puzzles/recorte.ts`) e os acontecimentos, e devolve as ações por props.
 * Quem liga é a conexão do jogador (onda 4, depois da P7) ou o jogo local
 * (`jogoLocal.ts`, a vitrine). Nada aqui conhece a rede.
 *
 * Os acontecimentos espelham as mensagens de `puzzle.recusado`,
 * `puzzle.castigo` e `puzzle.resolvido` do §2.2: chegam só a quem cabem, e só
 * depois de acontecer (o castigo e o desfecho nunca vão antes).
 */
import type { MotivoDaRecusa, TipoDeCastigo } from '../../puzzles/tipos'

/** O castigo como chega a quem errou: o tipo, o texto do mestre (vazio = o padrão) e os PV que saíram. */
export interface CastigoNaTela {
  tipo: Exclude<TipoDeCastigo, 'nada'>
  texto: string
  pv: number
}

/** Um item que ESTE jogador ganhou ao resolver. */
export interface GanhoNaTela {
  nome: string
  quantidade: number
  imagem: string | null
}

/** O desfecho como chega a quem está dentro: o texto é de todos; os ganhos, só de quem resolveu. */
export interface DesfechoNaTela {
  /** O nome de quem resolveu. */
  por: string
  /** `texto`: o cartão logo; `cena`: a arte se mexe e depois vem o texto (decisão 2 do plano). */
  modo: 'texto' | 'cena'
  texto: string
  itens: GanhoNaTela[]
  moedas: number
  /** `novo` = entrou agora na lista Documentos dele. */
  documentos: { titulo: string; novo: boolean }[]
  /** A porta ligada abriu no mapa. */
  abriuPorta: boolean
}

/** Os PV de quem joga, para o castigo ficar à vista. */
export interface PvNaTela {
  atual: number
  max: number
}

/** O acontecimento antes de ganhar o `id` (quem monta a lista é que numera). */
export type CorpoDoAcontecimento =
  | { tipo: 'recusado'; motivo: MotivoDaRecusa }
  /** `castigo: null` = o mestre não pôs castigo ("Nada acontece"). */
  | { tipo: 'errou'; em: 'ordem' | 'peso'; castigo: CastigoNaTela | null }
  /** As duas metades se juntaram neste encaixe. */
  | { tipo: 'juntou'; encaixeId: string }
  /** A peça guardada saiu do pedestal e foi para a mochila de quem trocou. */
  | { tipo: 'trocou'; nome: string }
  | { tipo: 'resolvido'; desfecho: DesfechoNaTela }

/**
 * Um acontecimento que pede reação na tela (tremer, piscar, o cartão). O `id`
 * só sobe: a tela trata cada um uma vez, mesmo que cheguem dois no mesmo quadro.
 */
export type AcontecimentoNoPuzzle = { id: number } & CorpoDoAcontecimento
