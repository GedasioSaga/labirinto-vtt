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
 * Dois jeitos de pôr, os dois com intensidade (a opacidade) e densidade
 * (quanto da área a bruma cobre):
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

/**
 * Densidade (0 a 100) da chave do mapa inteiro: quanto da área a bruma cobre
 * (tufos esparsos com buracos embaixo, quase sem buraco em cima). 50 é o
 * visual de antes do controle (pedido de 06/11/2026): mapa sem o campo abre
 * igual a antes.
 */
export const DENSIDADE_PADRAO = 50
export const DENSIDADE_MIN = 0
export const DENSIDADE_MAX = 100

export type ModoDaNeblina = 'pincel' | 'borracha'

/** Força do pincel (0,1 a 1): o quanto de neblina a pincelada deixa (ou a borracha tira). */
export const FORCA_DA_NEBLINA_MIN = 0.1
export const FORCA_DA_NEBLINA_MAX = 1
export const FORCA_DA_NEBLINA_PADRAO = 0.6

/** Densidade do pincel (0 a 1), na mesma régua da chave: 0,5 = o visual de antes do controle. */
export const DENSIDADE_DO_PINCEL_PADRAO = DENSIDADE_PADRAO / DENSIDADE_MAX

/** Tamanho do pincel, na mesma régua do pincel de Texturas (`raioDoPincelDeTextura`). */
export const TAMANHO_DA_NEBLINA_PADRAO = 64

/**
 * Tetos que a LEITURA do arquivo aplica e a GRAVAÇÃO respeita (revisão de
 * 06/11/2026): pontos de uma pincelada e pinceladas no mapa (todos os pisos).
 * Sem a mesma régua dos dois lados, a neblina pintada sumia ao reabrir.
 */
export const PONTOS_MAX = 20_000
export const PINCELADAS_MAX = 5_000

/**
 * O que o gesto do pincel conta para a tela: `sem-neblina` = borracha onde não
 * há neblina pintada; `cheio` = o mapa já tem `PINCELADAS_MAX` pinceladas.
 */
export type ResultadoDaNeblina = 'ok' | 'sem-neblina' | 'cheio' | 'vazio'

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

/** A chave do mapa inteiro, já com os padrões: desligada, na intensidade e na densidade padrão quando o mapa não diz nada. */
export function neblinaDoMapa(map: Pick<MapData, 'neblina'>): Required<NeblinaDoMapa> {
  const neblina = map.neblina
  return {
    ligada: neblina?.ligada ?? false,
    intensidade: neblina?.intensidade ?? INTENSIDADE_PADRAO,
    densidade: neblina?.densidade ?? DENSIDADE_PADRAO,
  }
}

/** Quanto de neblina cobre o mapa inteiro, de 0 a 1 (0 = chave desligada). */
export function intensidadeDoMapaInteiro(map: Pick<MapData, 'neblina'>): number {
  const neblina = map.neblina
  if (neblina === undefined || !neblina.ligada) return 0
  return limitar(neblina.intensidade, INTENSIDADE_MIN, INTENSIDADE_MAX) / INTENSIDADE_MAX
}

/** A densidade da chave do mapa inteiro, de 0 a 1 (sem o campo = a de antes do controle). */
export function densidadeDoMapaInteiro(map: Pick<MapData, 'neblina'>): number {
  return limitar(map.neblina?.densidade ?? DENSIDADE_PADRAO, DENSIDADE_MIN, DENSIDADE_MAX) / DENSIDADE_MAX
}

/** A densidade de uma pincelada de pincel, de 0 a 1 (sem o campo = a de antes do controle). */
export function densidadeDaPincelada(passo: Pick<PinceladaDeNeblina, 'densidade'>): number {
  return limitar(passo.densidade ?? DENSIDADE_DO_PINCEL_PADRAO, 0, 1)
}

/** O mapa tem alguma neblina para desenhar (a chave ligada acima de 0 ou alguma pincelada de pincel)? */
export function temNeblina(map: Pick<MapData, 'neblina' | 'neblinaPintada'>): boolean {
  return intensidadeDoMapaInteiro(map) > 0 || (map.neblinaPintada ?? []).some((p) => p.tipo === 'pincel')
}

/**
 * O mapa com a chave do mapa inteiro trocada. Densidade ausente fica a que o
 * mapa já tinha. O mesmo valor devolve o MESMO mapa (sem passo vazio no desfazer).
 */
export function comNeblina(map: MapData, neblina: NeblinaDoMapa): MapData {
  const atual = map.neblina
  const intensidade = Math.round(limitar(neblina.intensidade, INTENSIDADE_MIN, INTENSIDADE_MAX))
  const densidade = Math.round(limitar(neblina.densidade ?? atual?.densidade ?? DENSIDADE_PADRAO, DENSIDADE_MIN, DENSIDADE_MAX))
  if (atual !== undefined && atual.ligada === neblina.ligada && atual.intensidade === intensidade && (atual.densidade ?? DENSIDADE_PADRAO) === densidade) {
    return map
  }
  return { ...map, neblina: { ligada: neblina.ligada, intensidade, densidade } }
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
 * A pincelada em pedaços de no máximo `PONTOS_MAX` pontos (o que a leitura
 * aceita). Cada pedaço começa no último ponto do anterior, para o traço não
 * abrir entre eles. Na borracha, o disco desse ponto comum tira um pouco mais
 * (passa duas vezes): só acontece num arrasto de mais de 20 mil pontos.
 */
export function dividirPincelada(passo: PinceladaDeNeblina): PinceladaDeNeblina[] {
  if (passo.pontos.length <= PONTOS_MAX) return [passo]
  const pedacos: PinceladaDeNeblina[] = []
  for (let inicio = 0; inicio < passo.pontos.length - 1; inicio += PONTOS_MAX - 1) {
    pedacos.push({ ...passo, id: `${passo.id}~${pedacos.length}`, pontos: passo.pontos.slice(inicio, inicio + PONTOS_MAX) })
  }
  return pedacos
}

/**
 * A lista do piso com o passo novo no fim (em pedaços, se passou de
 * `PONTOS_MAX` pontos). A borracha num piso sem neblina pintada não entra
 * (não tiraria nada, e seria um passo vazio no desfazer); com o mapa já em
 * `PINCELADAS_MAX` (`totalNoMapa`, todos os pisos), nada entra.
 */
export function somarPinceladaDeNeblina(
  doPiso: readonly PinceladaDeNeblina[],
  passo: PinceladaDeNeblina,
  totalNoMapa: number = doPiso.length,
): { lista: readonly PinceladaDeNeblina[]; resultado: ResultadoDaNeblina } {
  if (passo.pontos.length === 0) return { lista: doPiso, resultado: 'vazio' }
  if (passo.tipo === 'borracha' && !doPiso.some((p) => p.tipo === 'pincel')) return { lista: doPiso, resultado: 'sem-neblina' }
  const pedacos = dividirPincelada(passo)
  if (totalNoMapa + pedacos.length > PINCELADAS_MAX) return { lista: doPiso, resultado: 'cheio' }
  return { lista: [...doPiso, ...pedacos], resultado: 'ok' }
}

/**
 * O que o jogador recebe do pincel: só o pedaço de cada pincelada que encosta
 * no que ele conhece (o mesmo corte das Texturas e do penhasco). Sem isso, a
 * forma da neblina pintada sobre o que ele não explorou desenharia o lugar.
 * A densidade vai junto com cada pedaço.
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

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

/** A chave do arquivo, ou `undefined` (campo ausente ou quebrado = sem neblina). Densidade torta sai (vale a padrão). */
export function lerNeblina(valor: unknown): NeblinaDoMapa | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined
  const { ligada, intensidade, densidade } = valor as Record<string, unknown>
  if (typeof ligada !== 'boolean' || !numeroFinito(intensidade)) return undefined
  return {
    ligada,
    intensidade: Math.round(limitar(intensidade, INTENSIDADE_MIN, INTENSIDADE_MAX)),
    ...(numeroFinito(densidade) ? { densidade: Math.round(limitar(densidade, DENSIDADE_MIN, DENSIDADE_MAX)) } : {}),
  }
}

function lerPonto(valor: unknown): RegionPoint | null {
  if (typeof valor !== 'object' || valor === null) return null
  const { x, y } = valor as Record<string, unknown>
  return numeroFinito(x) && numeroFinito(y) ? { x, y } : null
}

/** Uma pincelada do arquivo; acima de `PONTOS_MAX` pontos, fica o começo do traço (o resto sai, não o traço todo). */
function lerPinceladaDeNeblina(valor: unknown): PinceladaDeNeblina | null {
  if (typeof valor !== 'object' || valor === null) return null
  const { id, tipo, forca, raio, pontos, piso, densidade } = valor as Record<string, unknown>
  if (typeof id !== 'string' || id.length === 0) return null
  if (tipo !== 'pincel' && tipo !== 'borracha') return null
  if (!numeroFinito(forca)) return null
  if (!numeroFinito(raio) || raio <= 0) return null
  if (!Array.isArray(pontos) || pontos.length === 0) return null
  const lidos: RegionPoint[] = []
  for (const p of pontos.slice(0, PONTOS_MAX)) {
    const ponto = lerPonto(p)
    if (ponto === null) return null
    lidos.push(ponto)
  }
  const passo: PinceladaDeNeblina = {
    id,
    tipo,
    forca: limitar(forca, FORCA_DA_NEBLINA_MIN, FORCA_DA_NEBLINA_MAX),
    raio,
    pontos: lidos,
    // A borracha só tira: densidade nela não muda nada, então não é lida.
    ...(tipo === 'pincel' && numeroFinito(densidade) ? { densidade: limitar(densidade, 0, 1) } : {}),
  }
  return comPiso(passo, ehPiso(piso) ? piso : undefined)
}

/**
 * As pinceladas do arquivo, ou `undefined`. A quebrada sai; a ordem fica.
 * Acima de `PINCELADAS_MAX`, ficam as MAIS NOVAS: a borracha recente vale, e a
 * neblina que o mestre apagou não volta.
 */
export function lerNeblinaPintada(valor: unknown): PinceladaDeNeblina[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: PinceladaDeNeblina[] = []
  for (const item of valor.slice(-PINCELADAS_MAX)) {
    const passo = lerPinceladaDeNeblina(item)
    if (passo !== null) lista.push(passo)
  }
  return lista.length > 0 ? lista : undefined
}
