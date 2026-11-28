/**
 * O PAINEL EM RELEVO COMO PUZZLE (28/11): o puzzle novo, as lacunas (os
 * encaixes, um por placa que falta) e o item de cada placa. Puro: o editor
 * (`components/puzzles/relevoNoEditor.ts`) põe os itens no acervo; a vitrine
 * e os testes montam o mesmo puzzle daqui.
 *
 * A regra é sempre `lugarCerto`: cada vão só aceita a placa dele, e a errada
 * nem entra (o motor recusa com "Não encaixa aqui."). O id do encaixe é o da
 * placa (`placa-5`), para o progresso de uma lacuna não mudar quando o mestre
 * troca outra.
 */
import { puzzleDoModelo } from '../padroes'
import { LACUNAS_DO_RELEVO_MAX, LACUNAS_DO_RELEVO_MIN, LACUNAS_DO_RELEVO_PADRAO, NOME_DA_PECA_MAX, PLACAS_DO_RELEVO } from '../tipos'
import type { CenaDoRelevo, EncaixeDoPuzzle, MetalDoRelevo, Puzzle, VisualDoPuzzle, VisualDoRelevo } from '../tipos'
import { DESCRICAO_DAS_PLACAS, NOME_DA_CENA, NOME_DO_METAL, ORDEM_DAS_PLACAS } from './arte'
import { ehPlaca, lugarDaPlaca } from './placas'

/** A ordem das placas da imagem do mestre: as do meio e espalhadas primeiro. */
const ORDEM_DA_IMAGEM_PROPRIA: readonly number[] = [5, 2, 8, 11, 0, 6, 9, 3, 1, 10, 4, 7]

export const TEXTO_DO_RELEVO_RESOLVIDO = 'A última placa assenta com um estalo seco. As costuras do metal se acendem, e algo destrava atrás da parede.'

export function ehRelevo(visual: VisualDoPuzzle): visual is VisualDoRelevo {
  return visual.tipo === 'relevo'
}

/** As 12 placas da cena, da que mais importa para a que menos. */
export function ordemDasPlacas(cena: CenaDoRelevo | null): number[] {
  const ordem = cena === null ? ORDEM_DA_IMAGEM_PROPRIA : ORDEM_DAS_PLACAS[cena]
  const validas = ordem.filter((placa, i) => ehPlaca(placa) && ordem.indexOf(placa) === i)
  // A ordem da arte pode vir curta: completa com as que faltam, na ordem.
  for (let placa = 0; validas.length < PLACAS_DO_RELEVO && placa < PLACAS_DO_RELEVO; placa += 1) if (!validas.includes(placa)) validas.push(placa)
  return validas
}

/** As placas que faltam por padrão: as N primeiras da ordem da cena (N de 3 a 6). */
export function placasPadrao(cena: CenaDoRelevo | null, quantas: number): number[] {
  const n = Math.min(LACUNAS_DO_RELEVO_MAX, Math.max(LACUNAS_DO_RELEVO_MIN, Math.round(quantas)))
  return ordemDasPlacas(cena).slice(0, n)
}

/** O pedaço do id de mídia que nomeia as placas da imagem do mestre (`midia:<sha256>`). */
function marcaDaImagem(imagem: string): string {
  return imagem.replace(/^midia:/, '').replace(/[^0-9a-z]/gi, '').slice(0, 12).toLowerCase()
}

/**
 * O id do item da placa: o mesmo para a mesma cena, metal e placa, em todos os
 * puzzles (a placa de bronze não serve no painel de ferro). Na imagem do mestre,
 * pela imagem. `null` = a imagem própria ainda não foi escolhida.
 */
export function idDoItemDaPlaca(visual: VisualDoRelevo, placa: number): string | null {
  if (visual.cena !== null) return `item_placa_${visual.cena}_${visual.metal}_${placa}`
  if (visual.imagem === null) return null
  return `item_placa_img${marcaDaImagem(visual.imagem)}_${placa}`
}

/** O artigo do começo da descrição ("a ponta da lança"), que no nome do item só atrasa a palavra que distingue. */
const ARTIGO_NO_COMECO = /^(?:o|a|os|as)\s+/i

/**
 * "Ponta da lança (placa)" (cena) ou "Placa 6 da imagem" (imagem do mestre). O
 * que distingue uma placa da outra vem primeiro: a mochila corta o nome comprido.
 */
export function nomeDaPlaca(visual: VisualDoRelevo, placa: number): string {
  const descricao = (visual.cena === null ? undefined : DESCRICAO_DAS_PLACAS[visual.cena][placa])?.trim().replace(ARTIGO_NO_COMECO, '') ?? ''
  const nome = descricao === '' ? `Placa ${placa + 1} da imagem` : `${descricao.charAt(0).toLocaleUpperCase('pt-BR')}${descricao.slice(1)} (placa)`
  return nome.slice(0, NOME_DA_PECA_MAX)
}

export function descricaoDaPlaca(visual: VisualDoRelevo): string {
  const de = visual.cena === null ? 'de metal com um pedaço de pintura' : `de ${NOME_DO_METAL[visual.metal].toLocaleLowerCase('pt-BR')} em relevo`
  return `Uma placa ${de}, de bordas tortas. Parece faltar num painel maior.`
}

/** "Painel em relevo: Dragão (bronze)" ou "Painel em relevo: imagem própria". */
export function nomeDoRelevo(visual: VisualDoRelevo): string {
  if (visual.cena === null) return visual.imagem === null ? 'Painel em relevo: imagem própria (ainda sem imagem)' : 'Painel em relevo: imagem própria'
  return `Painel em relevo: ${NOME_DA_CENA[visual.cena]} (${NOME_DO_METAL[visual.metal].toLocaleLowerCase('pt-BR')})`
}

/** O encaixe de uma placa que falta: no meio dela, com o item dela como a peça certa. */
export function encaixeDaPlaca(visual: VisualDoRelevo, placa: number): EncaixeDoPuzzle {
  return { id: `placa-${placa}`, ...lugarDaPlaca(visual.cena, placa), forma: 'quadrado', jeito: 'peca', itemId: idDoItemDaPlaca(visual, placa), placa }
}

/** As lacunas do painel, na ordem das placas (de cima para baixo, da esquerda para a direita). */
export function encaixesDoRelevo(visual: VisualDoRelevo, placas: readonly number[]): EncaixeDoPuzzle[] {
  const unicas = [...new Set(placas.filter(ehPlaca))].sort((a, b) => a - b)
  return unicas.map((placa) => encaixeDaPlaca(visual, placa))
}

/** As placas que faltam neste puzzle (as dos encaixes com placa). */
export function placasDoPuzzle(puzzle: Pick<Puzzle, 'encaixes'>): number[] {
  return puzzle.encaixes.flatMap((encaixe) => (ehPlaca(encaixe.placa) ? [encaixe.placa] : []))
}

export function visualDoRelevo(cena: CenaDoRelevo | null, metal: MetalDoRelevo = 'bronze', imagem: string | null = null): VisualDoRelevo {
  return { tipo: 'relevo', cena, imagem: cena === null ? imagem : null, metal }
}

/**
 * O puzzle novo do painel: a cena, as N placas da ordem dela faltando, a regra
 * do lugar certo e o desfecho em cena (as costuras acendem). O resto vem do
 * padrão dos modelos.
 */
export function puzzleDoRelevo(visual: VisualDoRelevo, quantas: number = LACUNAS_DO_RELEVO_PADRAO): Puzzle {
  const base = puzzleDoModelo('fonte')
  return {
    ...base,
    nome: 'Painel em relevo',
    nomePublico: visual.cena === null ? 'Painel de metal' : NOME_DA_CENA[visual.cena],
    regra: 'lugarCerto',
    visual,
    encaixes: encaixesDoRelevo(visual, placasPadrao(visual.cena, quantas)),
    troca: null,
    dica: { tipo: 'texto', texto: 'Faltam placas no painel. Cada uma tem o seu lugar.' },
    desfecho: { modo: 'cena', texto: TEXTO_DO_RELEVO_RESOLVIDO, itens: [], moedas: 0, documentos: [], abrePorta: false },
    castigo: { tipo: 'nada' },
  }
}

/**
 * O puzzle com outro visual de relevo (outra cena, outro metal, outra imagem),
 * mantendo as MESMAS placas faltando: os encaixes passam a pedir o item da
 * placa no visual novo. Sem placas ainda (vinha de outro modelo), as padrão.
 */
export function comVisualDoRelevo(puzzle: Puzzle, visual: VisualDoRelevo): Puzzle {
  const antes = placasDoPuzzle(puzzle)
  const placas = antes.length >= LACUNAS_DO_RELEVO_MIN && antes.length <= LACUNAS_DO_RELEVO_MAX ? antes : placasPadrao(visual.cena, LACUNAS_DO_RELEVO_PADRAO)
  // Vindo da combinação, o controle sai: o painel é de placas.
  const { futuro: _combinacao, ...semCombinacao } = puzzle
  return { ...semCombinacao, regra: 'lugarCerto', visual, encaixes: encaixesDoRelevo(visual, placas), troca: null }
}

/** As placas que faltam passam a ser estas (de 3 a 6; fora disso, nada muda). */
export function comPlacas(puzzle: Puzzle, placas: readonly number[]): Puzzle {
  if (!ehRelevo(puzzle.visual)) return puzzle
  const unicas = [...new Set(placas.filter(ehPlaca))]
  if (unicas.length < LACUNAS_DO_RELEVO_MIN || unicas.length > LACUNAS_DO_RELEVO_MAX) return puzzle
  return { ...puzzle, encaixes: encaixesDoRelevo(puzzle.visual, unicas) }
}

/** Liga ou desliga a placa como lacuna; `null` = passaria do mínimo ou do máximo. */
export function comPlacaTrocada(puzzle: Puzzle, placa: number): Puzzle | null {
  const atuais = placasDoPuzzle(puzzle)
  const proximas = atuais.includes(placa) ? atuais.filter((outra) => outra !== placa) : [...atuais, placa]
  const proximo = comPlacas(puzzle, proximas)
  return proximo === puzzle ? null : proximo
}

/** N placas faltando: mantém as que já faltam (na ordem da cena) e tira ou põe pela ordem dela. */
export function comQuantasPlacas(puzzle: Puzzle, quantas: number): Puzzle {
  if (!ehRelevo(puzzle.visual)) return puzzle
  const atuais = placasDoPuzzle(puzzle)
  const ordem = ordemDasPlacas(puzzle.visual.cena)
  const daOrdem = ordem.filter((placa) => atuais.includes(placa))
  const resto = ordem.filter((placa) => !atuais.includes(placa))
  return comPlacas(puzzle, [...daOrdem, ...resto].slice(0, quantas))
}
