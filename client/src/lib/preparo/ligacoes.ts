import { FEATURES, type FeatureFlags } from '../features'
import { LUGARES, gravarNoPreparo, lerDoPreparo, type DocumentoLido } from './disco'
import { idNovo } from './enciclopedia'
import { ARQUIVO_DAS_LIGACOES, type Ligacao, type Ligacoes, type Verbete } from './tipos'

/**
 * AS LIGAÇÕES ENTRE VERBETES (`preparo/ligacoes.json`) vistas do QUADRO (fatia
 * F3b). A Teia e o editor de ligações são da F6; aqui só o que o quadro usa:
 *
 * - as setas que o quadro deve ter entre os cartões que estão nele, uma por par
 *   de verbetes, como o Grimório (`ligacoesCanvas.ts`): a direção da primeira
 *   ligação, os tipos juntos no rótulo ("aliado de · deve favor a"), e a seta
 *   do lugar dentro de lugar (pai → filho, sem rótulo) quando o par não tem
 *   ligação;
 * - a ligação nova que nasce de uma seta desenhada entre dois cartões. Ela nasce
 *   sem `origem` (a reimportação do Grimório não toca) e não revelada: nenhuma
 *   ligação vai ao jogador sem o mestre revelar (`pacoteDoJogador.ts`).
 */

/** Os tipos que o Grimório sugeria (`lib/vinculos.ts`); o campo aceita qualquer texto. */
export const TIPOS_SUGERIDOS: readonly string[] = [
  'conhece',
  'aliado de',
  'inimigo de',
  'família de',
  'mentor de',
  'deve favor a',
  'mora em',
  'frequenta',
  'protege',
  'teme',
  'carrega',
  'guarda',
  'procura',
  'forjou',
]

/** Juntam os tipos de um mesmo par no rótulo da seta. */
const SEPARADOR_DOS_TIPOS = ' · '

export function lerLigacoes(flags: Readonly<FeatureFlags> = FEATURES): Promise<DocumentoLido<Ligacoes>> {
  return lerDoPreparo(ARQUIVO_DAS_LIGACOES, LUGARES.ligacoes(), flags)
}

export function gravarLigacoes(ligacoes: Ligacoes, flags: Readonly<FeatureFlags> = FEATURES): Promise<void> {
  return gravarNoPreparo(ARQUIVO_DAS_LIGACOES, LUGARES.ligacoes(), ligacoes, flags)
}

/** O arquivo que ainda não existe: nenhuma ligação. */
export function ligacoesVazias(): Ligacoes {
  return { formato: ARQUIVO_DAS_LIGACOES.formato, ligacoes: [] }
}

/** A ligação que nasce de uma seta: criada no Prelúdio, sem notas e sem segredo, ainda não revelada. */
export function ligacaoNova(de: string, para: string, tipo: string): Ligacao {
  return { id: idNovo('lg'), de, para, tipo: tipo.trim(), notas: '', segredo: false }
}

/** Já há ligação entre os dois verbetes, em qualquer direção? */
export function haLigacaoEntre(ligacoes: readonly Ligacao[], a: string, b: string): boolean {
  return ligacoes.some((ligacao) => (ligacao.de === a && ligacao.para === b) || (ligacao.de === b && ligacao.para === a))
}

/** Os tipos para o campo: os já usados (o mais usado primeiro) e depois os do Grimório, sem repetir. */
export function tiposParaSugerir(ligacoes: readonly Ligacao[]): string[] {
  const usos = new Map<string, number>()
  for (const { tipo } of ligacoes) {
    const limpo = tipo.trim()
    if (limpo !== '') usos.set(limpo, (usos.get(limpo) ?? 0) + 1)
  }
  const usados = [...usos].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).map(([tipo]) => tipo)
  return [...usados, ...TIPOS_SUGERIDOS.filter((tipo) => !usos.has(tipo))]
}

export interface SetaPlanejada {
  /** Verbete de onde a seta sai. */
  readonly de: string
  /** Verbete aonde ela chega. */
  readonly para: string
  /** Os tipos das ligações do par; vazio na seta do lugar dentro de lugar. */
  readonly rotulo: string
}

const chaveDoPar = (a: string, b: string): string => (a < b ? `${a}\n${b}` : `${b}\n${a}`)

/**
 * As setas que o quadro deve ter entre os verbetes que estão nele (`noQuadro`).
 * Com `so`, só os pares que tocam aquele verbete (o cartão que acabou de chegar).
 * A ligação vem antes do lugar dentro de lugar: o par que tem as duas fica com o
 * rótulo da ligação, como no Grimório.
 */
export function setasDasLigacoes(ligacoes: readonly Ligacao[], noQuadro: ReadonlySet<string>, verbetes: ReadonlyMap<string, Verbete>, so?: string): SetaPlanejada[] {
  const toca = (a: string, b: string) => a !== b && noQuadro.has(a) && noQuadro.has(b) && (so === undefined || a === so || b === so)
  const porPar = new Map<string, { de: string; para: string; tipos: string[] }>()
  for (const { de, para, tipo } of ligacoes) {
    if (!toca(de, para)) continue
    const chave = chaveDoPar(de, para)
    const limpo = tipo.trim()
    const par = porPar.get(chave)
    if (par === undefined) porPar.set(chave, { de, para, tipos: limpo === '' ? [] : [limpo] })
    else if (limpo !== '' && !par.tipos.includes(limpo)) par.tipos.push(limpo)
  }
  for (const id of noQuadro) {
    const paiId = verbetes.get(id)?.paiId
    if (paiId === undefined || !toca(paiId, id)) continue
    const pai = verbetes.get(paiId)
    // Só lugar dentro de lugar vira seta; página dentro de página é da Escrita.
    if (pai?.tipo !== 'lugar' || verbetes.get(id)?.tipo !== 'lugar') continue
    const chave = chaveDoPar(paiId, id)
    if (!porPar.has(chave)) porPar.set(chave, { de: paiId, para: id, tipos: [] })
  }
  return [...porPar.values()].map(({ de, para, tipos }) => ({ de, para, rotulo: tipos.join(SEPARADOR_DOS_TIPOS) }))
}
