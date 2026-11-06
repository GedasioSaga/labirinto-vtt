import type { MapData, NeblinaDoMapa, PinceladaDeNeblina, RegionPoint } from '../types/map'
import { caminhosParaJogador } from './penhasco'
import { comPiso, ehPiso } from './pisos'

/**
 * NEBLINA (pedido de 06/11/2026): uma bruma lenta e translúcida que o mestre
 * põe por cima do mapa. Não é a névoa de guerra (a que esconde o que o jogador
 * não explorou): é clima. Ela fica ACIMA da noite e da névoa, então continua à
 * vista no escuro e na sombra das paredes, e só cobre — nunca mostra o que
 * está embaixo.
 *
 * Dois jeitos de pôr, os dois com intensidade:
 * - a chave do MAPA INTEIRO (`MapData.neblina`): sem forma, atravessa inteira
 *   no recorte do jogador;
 * - o PINCEL (`MapData.neblinaPintada`): pinceladas por área, cortadas no
 *   recorte ao que o jogador conhece (`neblinaParaJogador`).
 *
 * O desenho mora em `pixi/drawNeblina.ts`; aqui só os dados, puros.
 */

/** Intensidade (0 a 100) com que a chave do mapa inteiro liga da primeira vez. */
export const INTENSIDADE_PADRAO = 40
export const INTENSIDADE_MIN = 0
export const INTENSIDADE_MAX = 100

export type ModoDaNeblina = 'pincel' | 'borracha'

/** Força do pincel (0,1 a 1): o quanto de neblina a pincelada deixa (ou a borracha tira). */
export const FORCA_DA_NEBLINA_MIN = 0.1
export const FORCA_DA_NEBLINA_MAX = 1
export const FORCA_DA_NEBLINA_PADRAO = 0.6

/** Tamanho do pincel, na mesma régua do pincel de Texturas (`raioDoPincelDeTextura`). */
export const TAMANHO_DA_NEBLINA_PADRAO = 64

/** O que o gesto do pincel conta para a tela: `sem-neblina` = borracha onde não há neblina pintada. */
export type ResultadoDaNeblina = 'ok' | 'sem-neblina' | 'vazio'

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

/** A chave do mapa inteiro, já com o padrão: desligada e na intensidade padrão quando o mapa não diz nada. */
export function neblinaDoMapa(map: Pick<MapData, 'neblina'>): NeblinaDoMapa {
  return map.neblina ?? { ligada: false, intensidade: INTENSIDADE_PADRAO }
}

/** Quanto de neblina cobre o mapa inteiro, de 0 a 1 (0 = chave desligada). */
export function intensidadeDoMapaInteiro(map: Pick<MapData, 'neblina'>): number {
  const neblina = map.neblina
  if (neblina === undefined || !neblina.ligada) return 0
  return limitar(neblina.intensidade, INTENSIDADE_MIN, INTENSIDADE_MAX) / INTENSIDADE_MAX
}

/** O mapa tem alguma neblina para desenhar (a chave ligada acima de 0 ou alguma pincelada de pincel)? */
export function temNeblina(map: Pick<MapData, 'neblina' | 'neblinaPintada'>): boolean {
  return intensidadeDoMapaInteiro(map) > 0 || (map.neblinaPintada ?? []).some((p) => p.tipo === 'pincel')
}

/** O mapa com a chave do mapa inteiro trocada. O mesmo valor devolve o MESMO mapa (sem passo vazio no desfazer). */
export function comNeblina(map: MapData, neblina: NeblinaDoMapa): MapData {
  const intensidade = Math.round(limitar(neblina.intensidade, INTENSIDADE_MIN, INTENSIDADE_MAX))
  const atual = map.neblina
  if (atual !== undefined && atual.ligada === neblina.ligada && atual.intensidade === intensidade) return map
  return { ...map, neblina: { ligada: neblina.ligada, intensidade } }
}

/** O mapa com a lista de pinceladas trocada; lista vazia tira o campo (o mapa volta a salvar como antes). */
export function comNeblinaPintada(map: MapData, lista: readonly PinceladaDeNeblina[]): MapData {
  if (lista.length === 0) {
    if (map.neblinaPintada === undefined) return map
    const copia = { ...map }
    delete copia.neblinaPintada
    return copia
  }
  return { ...map, neblinaPintada: [...lista] }
}

/** Borracha antes de qualquer pincel não tira nada: sai, e a lista só de borrachas some. */
export function soComNeblina(lista: readonly PinceladaDeNeblina[]): PinceladaDeNeblina[] {
  const primeiro = lista.findIndex((p) => p.tipo === 'pincel')
  return primeiro < 0 ? [] : lista.slice(primeiro)
}

/**
 * A lista do piso com o passo novo no fim. A borracha num piso sem neblina
 * pintada não entra (não tiraria nada, e seria um passo vazio no desfazer).
 */
export function somarPinceladaDeNeblina(
  doPiso: readonly PinceladaDeNeblina[],
  passo: PinceladaDeNeblina,
): { lista: readonly PinceladaDeNeblina[]; resultado: ResultadoDaNeblina } {
  if (passo.pontos.length === 0) return { lista: doPiso, resultado: 'vazio' }
  if (passo.tipo === 'borracha' && !doPiso.some((p) => p.tipo === 'pincel')) return { lista: doPiso, resultado: 'sem-neblina' }
  return { lista: [...doPiso, passo], resultado: 'ok' }
}

/**
 * O que o jogador recebe do pincel: só o pedaço de cada pincelada que encosta
 * no que ele conhece (o mesmo corte das Texturas e do penhasco). Sem isso, a
 * forma da neblina pintada sobre o que ele não explorou desenharia o lugar.
 */
export function neblinaParaJogador(
  lista: readonly PinceladaDeNeblina[] | undefined,
  conhece: (p: RegionPoint) => boolean,
  escondido: (p: RegionPoint) => boolean,
): PinceladaDeNeblina[] | undefined {
  if (lista === undefined || lista.length === 0) return undefined
  const saida = soComNeblina(caminhosParaJogador(lista, conhece, escondido))
  return saida.length > 0 ? saida : undefined
}

/** A caixa (px de mundo) que as pinceladas de pincel cobrem, já com o raio; `null` = nenhuma. */
export function caixaDaNeblinaPintada(lista: readonly PinceladaDeNeblina[]): { x: number; y: number; largura: number; altura: number } | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const passo of lista) {
    if (passo.tipo !== 'pincel') continue
    for (const p of passo.pontos) {
      x0 = Math.min(x0, p.x - passo.raio)
      y0 = Math.min(y0, p.y - passo.raio)
      x1 = Math.max(x1, p.x + passo.raio)
      y1 = Math.max(y1, p.y + passo.raio)
    }
  }
  if (!Number.isFinite(x0)) return null
  return { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 }
}

// ---------- leitura do arquivo ----------

const PONTOS_MAX = 20_000
const PINCELADAS_MAX = 5_000

/** A chave do arquivo, ou `undefined` (campo ausente ou quebrado = sem neblina). */
export function lerNeblina(valor: unknown): NeblinaDoMapa | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined
  const { ligada, intensidade } = valor as Record<string, unknown>
  if (typeof ligada !== 'boolean' || typeof intensidade !== 'number' || !Number.isFinite(intensidade)) return undefined
  return { ligada, intensidade: Math.round(limitar(intensidade, INTENSIDADE_MIN, INTENSIDADE_MAX)) }
}

function lerPonto(valor: unknown): RegionPoint | null {
  if (typeof valor !== 'object' || valor === null) return null
  const { x, y } = valor as Record<string, unknown>
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

function lerPinceladaDeNeblina(valor: unknown): PinceladaDeNeblina | null {
  if (typeof valor !== 'object' || valor === null) return null
  const { id, tipo, forca, raio, pontos, piso } = valor as Record<string, unknown>
  if (typeof id !== 'string' || id.length === 0) return null
  if (tipo !== 'pincel' && tipo !== 'borracha') return null
  if (typeof forca !== 'number' || !Number.isFinite(forca)) return null
  if (typeof raio !== 'number' || !Number.isFinite(raio) || raio <= 0) return null
  if (!Array.isArray(pontos) || pontos.length === 0 || pontos.length > PONTOS_MAX) return null
  const lidos: RegionPoint[] = []
  for (const p of pontos) {
    const ponto = lerPonto(p)
    if (ponto === null) return null
    lidos.push(ponto)
  }
  const passo: PinceladaDeNeblina = { id, tipo, forca: limitar(forca, FORCA_DA_NEBLINA_MIN, FORCA_DA_NEBLINA_MAX), raio, pontos: lidos }
  return comPiso(passo, ehPiso(piso) ? piso : undefined)
}

/** As pinceladas do arquivo, ou `undefined`. A quebrada sai; a ordem fica. */
export function lerNeblinaPintada(valor: unknown): PinceladaDeNeblina[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: PinceladaDeNeblina[] = []
  for (const item of valor.slice(0, PINCELADAS_MAX)) {
    const passo = lerPinceladaDeNeblina(item)
    if (passo !== null) lista.push(passo)
  }
  return lista.length > 0 ? lista : undefined
}
