import { aceitaMolduraPorta, NOME_DO_MODELO, PADROES_DOS_MODELOS, PESO_DA_TROCA_PADRAO, POSICAO_DA_TROCA_PADRAO, puzzleDoModelo, visualEhPorta } from '../../puzzles/padroes'
import { combinacaoDoPuzzle, combinacaoPadrao } from '../../puzzles/combinacao'
import { ENCAIXES_MAX, ESCALA_DO_CONTROLE_MAX, ESCALA_DO_CONTROLE_MIN, TAMANHO_DO_ENCAIXE_MAX, TAMANHO_DO_ENCAIXE_MIN } from '../../puzzles/tipos'
import type { CombinacaoDoPuzzle, EncaixeDoPuzzle, FormaDaCombinacao, IdDaPecaDesenhada, ModeloDoPuzzle, Puzzle, VisualDoPuzzle } from '../../puzzles/tipos'

/**
 * AS CONTAS DO EDITOR DO PUZZLE, puras: cada uma recebe o puzzle do editor e
 * devolve um puzzle novo (nunca muda o de entrada), para o Desfazer guardar o
 * de antes. Os números são os do protótipo aprovado (`novoEncaixe`,
 * `teclaEditor`, `aplicarModeloEd`).
 */

/** Passo das setas no encaixe escolhido, em % do quadro; com Shift, o passo largo. */
export const PASSO_DA_SETA = 0.5
export const PASSO_LARGO_DA_SETA = 2
/** Passo do + e do − no tamanho do encaixe, em % da largura. */
export const PASSO_DO_TAMANHO = 0.5
/** O encaixe novo nasce deste tamanho (v2). */
const TAMANHO_DO_ENCAIXE_NOVO = 9
/** A margem do encaixe novo na imagem: ele nunca nasce cortado pela borda. */
const MARGEM_DO_NOVO = 8

export function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

/** Uma casa decimal: o arquivo não guarda 37,0400000001. */
export function umaCasa(valor: number): number {
  return Math.round(valor * 10) / 10
}

/** O visual mudou: o desfecho só abre porta se o visual ainda for de porta (como o leitor). */
function comPortaCoerente(puzzle: Puzzle): Puzzle {
  if (!puzzle.desfecho.abrePorta || visualEhPorta(puzzle.visual)) return puzzle
  return { ...puzzle, desfecho: { ...puzzle.desfecho, abrePorta: false } }
}

export function comVisual(puzzle: Puzzle, visual: VisualDoPuzzle): Puzzle {
  return comPortaCoerente({ ...puzzle, visual })
}

/**
 * "Começar de um modelo": a arte, as cores, a inscrição, a regra, os encaixes,
 * a mecânica e os controles do modelo; o nome, a dica, o desfecho e o castigo ficam. A
 * moldura Porta escolhida fica, se o modelo novo a aceita. O nome para o
 * jogador acompanha só se ainda era o nome do modelo de antes.
 */
export function comModelo(puzzle: Puzzle, modelo: ModeloDoPuzzle, pecas: Partial<Record<IdDaPecaDesenhada, string>>): Puzzle {
  const base = puzzleDoModelo(modelo, pecas)
  const molduraAntes = puzzle.visual.tipo === 'modelo' ? puzzle.visual.moldura : 'original'
  const moldura = aceitaMolduraPorta(modelo) ? molduraAntes : 'original'
  const nomeDoModeloAntes = puzzle.visual.tipo === 'modelo' ? NOME_DO_MODELO[puzzle.visual.modelo] : ''
  const nomePublico = puzzle.nomePublico === nomeDoModeloAntes ? NOME_DO_MODELO[modelo] : puzzle.nomePublico
  const visual: VisualDoPuzzle = base.visual.tipo === 'modelo' ? { ...base.visual, moldura } : base.visual
  // A mecânica vem junto: o Cofre traz as rodas; os outros tiram a combinação (e só ela: a de uma leva futura não chega ao editor).
  const { futuro: _mecanicaDeAntes, ...semMecanica } = puzzle
  const proximo: Puzzle = { ...semMecanica, nomePublico, regra: base.regra, visual, encaixes: base.encaixes, controle: base.controle }
  if (base.futuro !== undefined) proximo.futuro = base.futuro
  return comPortaCoerente(proximo)
}

/** A mecânica do seletor do editor (v2): Encaixe, Ordem certa, ou um dos 4 tipos de combinação. */
export type MecanicaDoEditor = 'encaixe' | 'ordem' | FormaDaCombinacao

export function mecanicaDoEditor(puzzle: Puzzle): MecanicaDoEditor {
  const combinacao = combinacaoDoPuzzle(puzzle)
  if (combinacao !== null) return combinacao.forma
  return puzzle.regra === 'ordem' ? 'ordem' : 'encaixe'
}

/**
 * Troca a mecânica. Os encaixes ficam guardados (voltar ao Encaixe os traz de
 * volta); a combinação nova nasce com a resposta do v2, e a mesma forma não muda.
 */
export function comMecanica(puzzle: Puzzle, mecanica: MecanicaDoEditor): Puzzle {
  if (mecanica === mecanicaDoEditor(puzzle)) return puzzle
  if (mecanica === 'encaixe' || mecanica === 'ordem') {
    const { futuro: _combinacao, ...semCombinacao } = puzzle
    return { ...semCombinacao, regra: mecanica === 'ordem' ? 'ordem' : puzzle.regra === 'ordem' ? 'lugarCerto' : puzzle.regra }
  }
  return { ...puzzle, futuro: combinacaoPadrao(mecanica) }
}

/** A combinação do editor trocada pela que `mudar` devolver (só quando o puzzle é de combinação). */
export function comCombinacao(puzzle: Puzzle, mudar: (combinacao: CombinacaoDoPuzzle) => CombinacaoDoPuzzle): Puzzle {
  const combinacao = combinacaoDoPuzzle(puzzle)
  return combinacao === null ? puzzle : { ...puzzle, futuro: mudar(combinacao) }
}

/** O controle movido ou de outro tamanho (o arrasto e as setas do quadro, a faixa "Tamanho"). */
export function comControle(puzzle: Puzzle, controle: Partial<Puzzle['controle']>): Puzzle {
  const proximo = { ...puzzle.controle, ...controle }
  return {
    ...puzzle,
    controle: { x: umaCasa(limitar(proximo.x, 0, 100)), y: umaCasa(limitar(proximo.y, 0, 100)), s: Math.round(limitar(proximo.s, ESCALA_DO_CONTROLE_MIN, ESCALA_DO_CONTROLE_MAX) * 100) / 100 },
  }
}

/** "Voltar às cores do modelo". */
export function comCoresDoModelo(puzzle: Puzzle): Puzzle {
  if (puzzle.visual.tipo !== 'modelo') return puzzle
  return { ...puzzle, visual: { ...puzzle.visual, cores: { ...PADROES_DOS_MODELOS[puzzle.visual.modelo].cores } } }
}

function novoIdDeEncaixe(encaixes: readonly EncaixeDoPuzzle[]): string {
  const usados = new Set(encaixes.map((encaixe) => encaixe.id))
  for (let n = encaixes.length + 1; ; n++) {
    const id = `e${n}`
    if (!usados.has(id)) return id
  }
}

/** "Adicionar encaixe": no meio da imagem, em fila (como o v2), com a forma do último. `null` = já há o teto. */
export function comEncaixeNovo(puzzle: Puzzle): { puzzle: Puzzle; id: string } | null {
  const n = puzzle.encaixes.length
  if (n >= ENCAIXES_MAX) return null
  const id = novoIdDeEncaixe(puzzle.encaixes)
  const forma = puzzle.encaixes.at(-1)?.forma ?? 'redondo'
  const encaixe: EncaixeDoPuzzle = {
    id,
    x: limitar(30 + (n % 5) * 10, MARGEM_DO_NOVO, 100 - MARGEM_DO_NOVO),
    y: limitar(35 + Math.floor(n / 5) * 14, MARGEM_DO_NOVO, 100 - MARGEM_DO_NOVO),
    t: TAMANHO_DO_ENCAIXE_NOVO,
    forma,
    jeito: 'peca',
    itemId: null,
  }
  return { puzzle: { ...puzzle, encaixes: [...puzzle.encaixes, encaixe] }, id }
}

export function semEncaixe(puzzle: Puzzle, id: string): Puzzle {
  return { ...puzzle, encaixes: puzzle.encaixes.filter((encaixe) => encaixe.id !== id) }
}

/** Troca o encaixe `id` pelo que `mudar` devolver. */
export function comEncaixe(puzzle: Puzzle, id: string, mudar: (encaixe: EncaixeDoPuzzle) => EncaixeDoPuzzle): Puzzle {
  return { ...puzzle, encaixes: puzzle.encaixes.map((encaixe) => (encaixe.id === id ? mudar(encaixe) : encaixe)) }
}

export function encaixeMovido(encaixe: EncaixeDoPuzzle, x: number, y: number): EncaixeDoPuzzle {
  return { ...encaixe, x: umaCasa(limitar(x, 0, 100)), y: umaCasa(limitar(y, 0, 100)) }
}

export function encaixeDoTamanho(encaixe: EncaixeDoPuzzle, t: number): EncaixeDoPuzzle {
  return { ...encaixe, t: umaCasa(limitar(t, TAMANHO_DO_ENCAIXE_MIN, TAMANHO_DO_ENCAIXE_MAX)) }
}

/**
 * "Peça certa": no encaixe de uma peça, a peça; no das metades, a primeira
 * metade vazia (as duas cheias: troca a segunda, a última que o mestre pôs).
 */
export function encaixeComPeca(encaixe: EncaixeDoPuzzle, itemId: string): EncaixeDoPuzzle {
  if (encaixe.jeito === 'peca') return { ...encaixe, itemId }
  const [a, b] = encaixe.metades
  return { ...encaixe, metades: a === null ? [itemId, b] : [a, itemId] }
}

/** Uma peça só ou duas metades: a peça certa vira a primeira metade, e volta dela. */
export function encaixeDoJeito(encaixe: EncaixeDoPuzzle, jeito: EncaixeDoPuzzle['jeito']): EncaixeDoPuzzle {
  if (encaixe.jeito === jeito) return encaixe
  const { id, x, y, t, forma } = encaixe
  if (jeito === 'metades') {
    const primeira = encaixe.jeito === 'peca' ? encaixe.itemId : null
    return { id, x, y, t, forma, jeito: 'metades', metades: [primeira, null], vira: { nome: 'Peça inteira', imagem: null } }
  }
  return { id, x, y, t, forma, jeito: 'peca', itemId: encaixe.jeito === 'metades' ? encaixe.metades[0] : null }
}

/** O encaixe já tem tudo o que o jogador precisa pôr? (o resumo e a lista mostram os que faltam) */
export function encaixeSemPecaCerta(encaixe: EncaixeDoPuzzle): boolean {
  return encaixe.jeito === 'peca' ? encaixe.itemId === null : encaixe.metades.some((metade) => metade === null)
}

/** A troca de peso ligada com a peça guardada `guarda` (a do v1: o pedestal pede 4, ao lado direito). */
export function comTroca(puzzle: Puzzle, guarda: string | null): Puzzle {
  if (guarda === null) return { ...puzzle, troca: null }
  if (puzzle.troca !== null) return { ...puzzle, troca: { ...puzzle.troca, guarda } }
  return { ...puzzle, troca: { guarda, peso: PESO_DA_TROCA_PADRAO, pesos: {}, x: POSICAO_DA_TROCA_PADRAO.x, y: POSICAO_DA_TROCA_PADRAO.y } }
}
