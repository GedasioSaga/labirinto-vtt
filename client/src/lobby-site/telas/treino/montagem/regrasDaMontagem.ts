import { casasDoLado, EQUIPE_DO_LADO, type CasaDaArena } from '../../../../lib/arena/grade'
import type { Personagem } from '../../../../lib/personagem'
import { GRADE_DO_TREINO, VAGAS_POR_LADO_MAX, type LadoDoTreino } from '../../../../lib/treino/mesaEmMemoria'
import type { MontagemDaLuta } from '../lutaDeTreino'

/**
 * A MONTAGEM NA GRADE (fatia J, pedido de 06/11/2026 com o print do painel
 * Personagens do app: "quando eu puxar o jogador para o campo e para o token
 * dele aparecer"). Ao lado da grade fica a lista de quem pode lutar; puxar um
 * item para uma casa põe o token dele ali, e o LADO sai da metade da grade
 * onde ele caiu, como a Arena do app monta: as 6 colunas da esquerda são o
 * Lado A (você joga), as 6 da direita o Lado B (o robô joga). Casa ocupada
 * recusa; cada lado leva no máximo `VAGAS_POR_LADO_MAX`. O mesmo item pode
 * entrar mais de uma vez (as cópias ganham número, "Judge 2").
 *
 * Puro: sem DOM, sem React.
 */

export type SeloDaPeca = 'jogador' | 'npc'
/** De onde a peça vem: a sua ficha, a de um colega (cópia só para o treino), o Judge ou um inimigo que o mestre liberou. */
export type OrigemDaPeca = 'minha' | 'colega' | 'juiz' | 'inimigo'

export interface PecaDaMontagem {
  id: string
  nome: string
  /** Como a ficha guarda (`midia:`, `data:` ou o desenho do Judge); `null` = as iniciais. */
  retrato: string | null
  selo: SeloDaPeca
  origem: OrigemDaPeca
  /** A linha embaixo do nome ("de Gina", "inimigo do mestre"). */
  detalhe: string | null
}

export interface PecaNaGrade {
  /** Único na montagem: o mesmo item duas vezes são duas peças. */
  chave: string
  pecaId: string
  casa: CasaDaArena
}

export type RecusaDaMontagem = 'ocupada' | 'cheio' | 'fora' | 'outroLado' | 'repetida' | 'largada'

export type MudancaDaMontagem = { ok: true; lista: PecaNaGrade[] } | { ok: false; motivo: RecusaDaMontagem }

const COLUNAS = GRADE_DO_TREINO.colunas
const LINHAS = GRADE_DO_TREINO.linhas
/** A primeira coluna do Lado B. */
export const COLUNA_DO_MEIO = Math.floor(COLUNAS / 2)

export function ladoDaCasa(casa: CasaDaArena): LadoDoTreino {
  return casa.col < COLUNA_DO_MEIO ? 'a' : 'b'
}

export function dentroDaGradeDoTreino(casa: CasaDaArena): boolean {
  return Number.isInteger(casa.col) && Number.isInteger(casa.row) && casa.col >= 0 && casa.row >= 0 && casa.col < COLUNAS && casa.row < LINHAS
}

function mesma(a: CasaDaArena, b: CasaDaArena): boolean {
  return a.col === b.col && a.row === b.row
}

export function noLado(lista: readonly PecaNaGrade[], lado: LadoDoTreino, menos?: string): number {
  return lista.filter((peca) => peca.chave !== menos && ladoDaCasa(peca.casa) === lado).length
}

/** Quem está na casa (fora `menos`). */
export function quemEstaNaCasa(lista: readonly PecaNaGrade[], casa: CasaDaArena, menos?: string): PecaNaGrade | null {
  return lista.find((peca) => peca.chave !== menos && mesma(peca.casa, casa)) ?? null
}

/** A casa recebe esta peça? `null` = sim; senão, por que não. */
export function recusaDaCasa(lista: readonly PecaNaGrade[], casa: CasaDaArena, menos?: string): RecusaDaMontagem | null {
  if (!dentroDaGradeDoTreino(casa)) return 'fora'
  if (quemEstaNaCasa(lista, casa, menos) !== null) return 'ocupada'
  if (noLado(lista, ladoDaCasa(casa), menos) >= VAGAS_POR_LADO_MAX) return 'cheio'
  return null
}

function chaveNova(lista: readonly PecaNaGrade[], pecaId: string): string {
  let n = 1
  while (lista.some((peca) => peca.chave === `${pecaId}#${n}`)) n += 1
  return `${pecaId}#${n}`
}

/** Põe um item da lista na casa. */
export function porNaGrade(lista: readonly PecaNaGrade[], pecaId: string, casa: CasaDaArena): MudancaDaMontagem {
  const recusa = recusaDaCasa(lista, casa)
  if (recusa !== null) return { ok: false, motivo: recusa }
  return { ok: true, lista: [...lista, { chave: chaveNova(lista, pecaId), pecaId, casa }] }
}

/** Leva a peça a outra casa (pode trocar de lado: a metade decide). */
export function moverNaGrade(lista: readonly PecaNaGrade[], chave: string, casa: CasaDaArena): MudancaDaMontagem {
  const recusa = recusaDaCasa(lista, casa, chave)
  if (recusa !== null) return { ok: false, motivo: recusa }
  return { ok: true, lista: lista.map((peca) => (peca.chave === chave ? { ...peca, casa } : peca)) }
}

export function tirarDaGrade(lista: readonly PecaNaGrade[], chave: string): PecaNaGrade[] {
  return lista.filter((peca) => peca.chave !== chave)
}

/** A primeira casa livre do lado: as de largada da Arena primeiro (`casasDoLado`), depois da borda para o meio. */
export function casaLivreNoLado(lista: readonly PecaNaGrade[], lado: LadoDoTreino): CasaDaArena | null {
  if (noLado(lista, lado) >= VAGAS_POR_LADO_MAX) return null
  const preferidas = casasDoLado(VAGAS_POR_LADO_MAX, lado, GRADE_DO_TREINO)
  const colunas = Array.from({ length: COLUNA_DO_MEIO }, (_, i) => (lado === 'a' ? i : COLUNAS - 1 - i))
  const todas = [...preferidas, ...colunas.flatMap((col) => Array.from({ length: LINHAS }, (_, row) => ({ col, row })))]
  return todas.find((casa) => quemEstaNaCasa(lista, casa) === null) ?? null
}

/** O lado onde o item cai sem arrasto (Enter na lista): o seu e o dos colegas no A, o Judge e os inimigos no B. */
export function ladoDaPeca(peca: Pick<PecaDaMontagem, 'origem'>): LadoDoTreino {
  return peca.origem === 'minha' || peca.origem === 'colega' ? 'a' : 'b'
}

/** A montagem com que a tela abre: o seu primeiro personagem no Lado A e o primeiro adversário (o Judge) no B, nas casas de largada da Arena. */
export function montagemInicial(pecas: readonly PecaDaMontagem[]): PecaNaGrade[] {
  let lista: PecaNaGrade[] = []
  const minha = pecas.find((peca) => peca.origem === 'minha')
  const adversario = pecas.find((peca) => peca.origem === 'juiz') ?? pecas.find((peca) => peca.origem === 'inimigo')
  for (const peca of [minha, adversario]) {
    if (peca === undefined) continue
    const casa = casaLivreNoLado(lista, ladoDaPeca(peca))
    if (casa === null) continue
    const posta = porNaGrade(lista, peca.id, casa)
    if (posta.ok) lista = posta.lista
  }
  return lista
}

/** A montagem que a tela guardou, sem as peças cujo item saiu da lista (o mestre tirou o inimigo do treino). */
export function soAsQueExistem(lista: readonly PecaNaGrade[], pecas: readonly PecaDaMontagem[]): PecaNaGrade[] {
  const existe = new Set(pecas.map((peca) => peca.id))
  const filtrada = lista.filter((peca) => existe.has(peca.pecaId))
  return filtrada.length === lista.length ? (lista as PecaNaGrade[]) : filtrada
}

/**
 * A luta da montagem: o Lado A são as "minhas" (você joga), o B os inimigos
 * (o robô joga), cada lado na ordem em que as peças entraram, com a casa de
 * cada uma como largada. `ficha` dá a cópia de cada item como vai à luta (com
 * o rascunho, a Vida cheia, os ajustes do Judge).
 */
export function lutaDaMontagem(lista: readonly PecaNaGrade[], ficha: (pecaId: string) => Personagem | null): MontagemDaLuta {
  const minhas: Personagem[] = []
  const inimigos: Personagem[] = []
  const largada: { a: CasaDaArena[]; b: CasaDaArena[] } = { a: [], b: [] }
  for (const peca of lista) {
    const doc = ficha(peca.pecaId)
    if (doc === null) continue
    const lado = ladoDaCasa(peca.casa)
    ;(lado === 'a' ? minhas : inimigos).push(doc)
    largada[lado].push(peca.casa)
  }
  return { minhas, inimigos, largada }
}

export const TEXTO_DA_RECUSA: Readonly<Record<RecusaDaMontagem, string>> = {
  ocupada: 'a casa está ocupada',
  cheio: `cada lado leva no máximo ${VAGAS_POR_LADO_MAX}`,
  fora: 'a casa fica fora da grade',
  outroLado: 'a outra metade é do outro jogador',
  repetida: 'já está na grade',
  largada: 'no duelo cada um começa numa casa de largada da Arena, na ordem em que entrou',
}

/** A casa sob o item que vem da lista, como a grade desenha: onde ele cai e se pode. */
export interface RealceDaLista {
  casa: CasaDaArena
  situacao: 'livre' | 'ocupada' | 'cheio'
  /** Troca o rótulo padrão da grade ("Ocupada", "Lado cheio", o nome do lado). */
  texto?: string
}

/**
 * As regras de uma montagem: a do treino (qualquer casa livre, a metade decide
 * o lado) ou a do duelo (`regrasDoDuelo.ts`: só a sua metade, nas casas de
 * largada). A tela (`MontagemNaGrade.tsx`) só arrasta e pergunta.
 */
export interface RegrasDaMontagem {
  realce(lista: readonly PecaNaGrade[], peca: PecaDaMontagem, casa: CasaDaArena): RealceDaLista
  por(lista: readonly PecaNaGrade[], peca: PecaDaMontagem, casa: CasaDaArena): MudancaDaMontagem
  /** Enter ou clique no item, sem arrasto. */
  porSemArrasto(lista: readonly PecaNaGrade[], peca: PecaDaMontagem): MudancaDaMontagem
  /** A ficha arrastada (ou andada pelas setas) na grade. */
  mover(lista: readonly PecaNaGrade[], chave: string, casa: CasaDaArena): MudancaDaMontagem
  /** Delete na ficha, ou ela arrastada de volta para a lista. */
  tirar(lista: readonly PecaNaGrade[], chave: string): PecaNaGrade[]
  /** O rótulo da casa sob a ficha na mão, na grade. */
  rotuloDoAlvo(casa: CasaDaArena): string
  /** A linha sob o título da lista. */
  dicaDaLista: string
  /** A dica de leitor de tela das fichas na grade. */
  dicaDaGrade: string
  /** O nome de cada metade; ausente = o do treino. */
  nomesDasMetades?: Readonly<Record<LadoDoTreino, string>>
  /** O limite que a tela mostra embaixo da lista; ausente = nenhum. */
  aviso?: string
}

/** O treino solo: qualquer casa livre, a metade decide o lado, a mesma peça pode entrar mais de uma vez. */
export const REGRAS_DO_TREINO: RegrasDaMontagem = {
  realce(lista, _peca, casa) {
    const recusa = recusaDaCasa(lista, casa)
    return { casa, situacao: recusa === null ? 'livre' : recusa === 'cheio' ? 'cheio' : 'ocupada' }
  },
  por: (lista, peca, casa) => porNaGrade(lista, peca.id, casa),
  porSemArrasto(lista, peca) {
    const casa = casaLivreNoLado(lista, ladoDaPeca(peca))
    return casa === null ? { ok: false, motivo: 'cheio' } : porNaGrade(lista, peca.id, casa)
  },
  mover: moverNaGrade,
  tirar: tirarDaGrade,
  rotuloDoAlvo: (casa) => EQUIPE_DO_LADO[ladoDaCasa(casa)].nome,
  dicaDaLista: 'Puxe para a grade. A metade onde soltar decide o lado.',
  dicaDaGrade: 'Arraste para mudar de casa ou de lado (a metade da grade decide), ou use as setas. Delete tira da grade; arrastar de volta para a lista também.',
}
