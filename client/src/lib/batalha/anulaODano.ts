import type { ComoPagaAMarca } from './comoMarca'
import { chaveDaCondicao, NOMES_DOS_TIPOS_DE_DANO, TIPOS_DE_DANO, type TipoDoGolpe } from '../condicoes/modelo'

/**
 * O DANO ANULADO, o "toma 0" (pedidos do dono de 27/11/2026: "tem como fazer o inimigo ser intangível / não
 * tomar dano?" e "é tipo uma passiva reação, ele toma 0 de dano"). Uma coisa, um lugar: a regra que as três
 * fontes dividem mora aqui, e o motor decide por `anulacaoNoGolpe` (anulacaoNoGolpe.ts):
 *  - a peça "Dispara sozinha" com o gatilho "Ao ser atingido (antes do dano)" e o efeito "Anula o dano";
 *  - a condição Intangível (a de fábrica e a criada com a peça Intangível), pelos turnos dela;
 *  - a Passiva de raça que corta 100% (e qualquer corte de 100% do dano que o alvo recebe).
 *
 * Folha pura: só o modelo das condições e o tipo do "e/ou" (sem store, sem motor). A peça da habilidade
 * (`mecanica/pecas.ts`), a peça da condição (`condicoes/modelo.ts`), as frases e o motor leem daqui.
 */

/** O nome que o registro dá a quem não tomou o dano: "Intangível: Hector tomou 0 de dano". */
export const NOME_DO_INTANGIVEL = 'Intangível'
/** O corte que zera o dano: 100%. */
export const PORCENTO_QUE_ANULA = 100
/** O nome da exceção ("Haki"): o mesmo teto dos nomes curtos das peças. */
export const NOME_DA_EXCECAO_MAX = 24
/** Quantas vezes o Anula o dano vale por rodada ou por batalha: de 1 a 10. */
export const VEZES_DO_ANULA_MAX = 10
/** A CD do teste do Anula o dano: a mesma faixa dos testes de saída das condições. */
export const CD_DO_ANULA_MIN = 5
export const CD_DO_ANULA_MAX = 30
/** O SP que o Anula o dano cobra: o mesmo teto do SP da Marca. */
export const SP_DO_ANULA_MAX = 200

/**
 * "a não ser que o golpe tenha X": um tipo de dano ou elemento (Fogo, Impacto) ou um nome (Haki), que vale
 * quando está no nome da técnica do golpe, numa condição de quem bate ou numa forma ligada dele.
 */
export type ExcecaoDoAnula = { tipo: TipoDoGolpe } | { nome: string }

/** Por quanto o limite conta: sem limite, por rodada ou pela batalha inteira. */
export type PorDoAnula = 'sempre' | 'rodada' | 'batalha'

/**
 * A regra do "Anula o dano" da peça Dispara sozinha, como a peça guarda e o motor lê: o limite (`vezes` por
 * `por`; no 'sempre' o número fica guardado para voltar), o que paga e/ou testa (o SP, o atributo do teste
 * contra a `cd` e o "e/ou" de `comoMarca.ts`) e a exceção. `paga` 0 e `teste` '' = de graça.
 */
export interface RegraDoAnula {
  por: PorDoAnula
  vezes: number
  paga: number
  /** O atributo do teste (o id das peças, "agilidade"); '' = sem teste. */
  teste: string
  cd: number
  /** Com o SP e o teste: 'e' (os dois) ou 'ou' (um dos dois). Ausente = 'e', como na Marca. */
  como?: ComoPagaAMarca
  exceto?: ExcecaoDoAnula
}

/** O Anula o dano como nasce no editor: uma vez por rodada, de graça, sem exceção. */
export const ANULA_DE_PARTIDA: RegraDoAnula = { por: 'rodada', vezes: 1, paga: 0, teste: '', cd: 12 }

/** O que o golpe leva para a exceção: os tipos dele e os nomes (a técnica, as condições e as formas ligadas de quem bate). */
export interface OQueOGolpeTem {
  tipos: readonly TipoDoGolpe[]
  nomes: readonly string[]
}

/** Os tipos que a exceção aceita: todos menos o "qualquer" (golpe sem tipo nunca atravessa por tipo). */
export const TIPOS_DA_EXCECAO: readonly TipoDoGolpe[] = TIPOS_DE_DANO.filter((tipo): tipo is TipoDoGolpe => tipo !== 'qualquer')

/** A exceção lida do disco ou do fio, só com uma chave (`tipo` ou `nome`). `null` = torta: chave a mais, tipo fora da lista, nome vazio ou longo. */
export function excecaoLida(cru: unknown): ExcecaoDoAnula | null {
  if (typeof cru !== 'object' || cru === null || Array.isArray(cru) || Object.keys(cru).length !== 1) return null
  const tipo: unknown = Reflect.get(cru, 'tipo')
  if (tipo !== undefined) {
    const achado = TIPOS_DA_EXCECAO.find((candidato) => candidato === tipo)
    return achado === undefined ? null : { tipo: achado }
  }
  const nome: unknown = Reflect.get(cru, 'nome')
  return typeof nome === 'string' && nome.trim() !== '' && nome.length <= NOME_DA_EXCECAO_MAX ? { nome } : null
}

/** O golpe passa pelo "toma 0"? Só com a exceção: o tipo está no golpe, ou o nome (sem acento nem caixa) está num dos nomes. */
export function golpeAtravessa(exceto: ExcecaoDoAnula | undefined, golpe: OQueOGolpeTem): boolean {
  if (exceto === undefined) return false
  if ('tipo' in exceto) return golpe.tipos.includes(exceto.tipo)
  const chave = chaveDaCondicao(exceto.nome)
  return chave !== '' && golpe.nomes.some((nome) => chaveDaCondicao(nome).includes(chave))
}

/** "Fogo", "Haki": o X da exceção. */
export function nomeDaExcecao(exceto: ExcecaoDoAnula): string {
  return 'tipo' in exceto ? NOMES_DOS_TIPOS_DE_DANO[exceto.tipo] : exceto.nome.trim()
}

/** "a não ser que o golpe tenha Haki"; sem exceção, ''. */
export function textoDaExcecao(exceto: ExcecaoDoAnula | undefined): string {
  return exceto === undefined ? '' : `a não ser que o golpe tenha ${nomeDaExcecao(exceto)}`
}

/** "até 1 vez por rodada", "até 2 vezes por batalha"; sem limite, ''. */
export function textoDoLimiteDoAnula(regra: Pick<RegraDoAnula, 'por' | 'vezes'>): string {
  if (regra.por === 'sempre') return ''
  return `até ${regra.vezes} ${regra.vezes === 1 ? 'vez' : 'vezes'} por ${regra.por === 'rodada' ? 'rodada' : 'batalha'}`
}

/** A linha do registro: "Intangível: Hector tomou 0 de dano (Corpo de Fumaça)". */
export function textoDoAnulado(nomeDoAlvo: string, de: string): string {
  const fonte = de.trim()
  return `${NOME_DO_INTANGIVEL}: ${nomeDoAlvo} tomou 0 de dano${fonte === '' || fonte === NOME_DO_INTANGIVEL ? '' : ` (${fonte})`}`
}

// ─── O limite, contado em `CombateDoPersonagem.lembradas` ──────────────────
// Cada anulação com limite deixa uma chave única ("<gatilho>#anulou@r3#1"): o Desfazer da linha tira a
// dela (a lista volta por diferença) e as rodadas velhas do mesmo gatilho saem quando entra uma nova.

const MARCA_DO_USO = '#anulou@'

function prefixoDoUso(chaveDoGatilho: string, por: Exclude<PorDoAnula, 'sempre'>, rodada: number): string {
  return `${chaveDoGatilho}${MARCA_DO_USO}${por === 'rodada' ? `r${rodada}` : 'b'}#`
}

/** Quantas vezes o gatilho já anulou no período do limite (sem limite: 0). */
export function usosDoAnula(lembradas: readonly string[], chaveDoGatilho: string, regra: Pick<RegraDoAnula, 'por'>, rodada: number): number {
  if (regra.por === 'sempre') return 0
  const prefixo = prefixoDoUso(chaveDoGatilho, regra.por, rodada)
  return lembradas.filter((chave) => chave.startsWith(prefixo)).length
}

/** Ainda pode anular: sem limite, ou abaixo das vezes do período. */
export function anulaAindaVale(lembradas: readonly string[], chaveDoGatilho: string, regra: Pick<RegraDoAnula, 'por' | 'vezes'>, rodada: number): boolean {
  return regra.por === 'sempre' || usosDoAnula(lembradas, chaveDoGatilho, regra, rodada) < regra.vezes
}

/** As lembradas com mais um uso do gatilho no período (as rodadas velhas dele saem); sem limite, a MESMA lista. */
export function lembradasComOUso(lembradas: readonly string[], chaveDoGatilho: string, regra: Pick<RegraDoAnula, 'por'>, rodada: number): readonly string[] {
  if (regra.por === 'sempre') return lembradas
  const prefixo = prefixoDoUso(chaveDoGatilho, regra.por, rodada)
  const daRodada = `${chaveDoGatilho}${MARCA_DO_USO}r`
  const ficam = lembradas.filter((chave) => !(chave.startsWith(daRodada) && !chave.startsWith(prefixo)))
  const usados = ficam.filter((chave) => chave.startsWith(prefixo)).length
  return [...ficam, `${prefixo}${usados + 1}`]
}
