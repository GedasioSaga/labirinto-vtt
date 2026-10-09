import type { MapData, Token } from '../types/map'
import { AREA_DE_TOQUE } from '../pixi/drawMarcadorDeContinente'
import { SIGNAL_NEUTRAL_COLOR, signalColor } from './signals'
import { parseHexColor } from './tokenColor'

/**
 * MAPA DE CONTINENTE (pedido de 09/10/2026): numa cena marcada como Continente
 * (`MapData.continente`), a ficha de cada JOGADOR é desenhada como o pino do
 * mapa (`pixi/drawMarcadorDeContinente.ts`), no editor do mestre e na tela do
 * jogador; NPC continua ficha. O pino tem tamanho fixo na TELA: mora dentro do
 * mundo (névoa, máscara e ordem de camadas continuam valendo) com escala
 * inversa ao zoom, como o pino de ponto de interesse (`lib/pins.ts`). Puro: sem
 * DOM, sem Pixi, sem store.
 */

/**
 * A cena é Continente? Mapa-mundi de antes do "Tipo de mapa" (`worldMap` sem
 * `continente`) também é: a caravana virou chave dentro do Continente, e o
 * arquivo antigo já abre assim (`lib/mapFile.ts`).
 */
export function isContinente(map: Pick<MapData, 'continente' | 'worldMap'>): boolean {
  return map.continente === true || map.worldMap === true
}

/**
 * Cor do pino: a "Cor" da ficha, quando o mestre escolheu uma; sem ela, a cor
 * automática do dono (`signalColor`). `donoId` `null` = quem vê não pode saber
 * de quem é (a tela da mesa, onde a cor por jogador denunciaria o disfarce —
 * `SIGNAL_NEUTRAL_COLOR`): sai a cor neutra da mesa. Sempre `#rrggbb` minúsculo.
 */
export function corDoPino(token: Pick<Token, 'color'>, donoId: string | null): string {
  const escolhida = parseHexColor(token.color)
  if (escolhida !== null) return `#${escolhida.toString(16).padStart(6, '0')}`
  return donoId === null ? SIGNAL_NEUTRAL_COLOR : signalColor(donoId)
}

/** Dono de cada ficha, pela posse da sala (id do jogador → fichas). Posse é exclusiva; repetida, vale o primeiro. */
export function donosDasFichas(ownership: Readonly<Record<string, readonly string[]>>): Map<string, string> {
  const dono = new Map<string, string>()
  for (const [playerId, tokenIds] of Object.entries(ownership)) {
    for (const id of tokenIds) if (!dono.has(id)) dono.set(id, playerId)
  }
  return dono
}

/**
 * Por id de ficha, a cor do pino de cada ficha de JOGADOR da cena (a que tem
 * dono na sala). Cena Normal → mapa vazio, sem varrer nada. `corDoDono: false`
 * troca a cor automática do dono pela neutra (tela da mesa, ver `corDoPino`).
 */
export function coresDosPinos(
  map: Pick<MapData, 'continente' | 'worldMap' | 'tokens'>,
  ownership: Readonly<Record<string, readonly string[]>>,
  { corDoDono = true }: { corDoDono?: boolean } = {},
): Map<string, string> {
  const cores = new Map<string, string>()
  if (!isContinente(map)) return cores
  const dono = donosDasFichas(ownership)
  if (dono.size === 0) return cores
  for (const token of map.tokens) {
    const donoId = dono.get(token.id)
    if (donoId !== undefined) cores.set(token.id, corDoPino(token, corDoDono ? donoId : null))
  }
  return cores
}

/**
 * Escala do pino dentro do mundo: o inverso do zoom, para ele ficar do mesmo
 * tamanho na tela em qualquer zoom. Zoom inválido (zero, negativo, não finito)
 * devolve 1 — desenho e toque seguem em px de mundo em vez de estourar.
 */
export function escalaDoMarcador(cameraScale: number): number {
  if (!Number.isFinite(cameraScale) || cameraScale <= 0) return 1
  return 1 / cameraScale
}

/** Retângulo em px de MUNDO. */
export interface AreaNoMundo {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** A área de toque do pino (`AREA_DE_TOQUE`, cabeça e nome incluídos) em px de mundo, neste zoom. */
export function areaDoPino(token: Pick<Token, 'x' | 'y'>, cameraScale: number): AreaNoMundo {
  const k = escalaDoMarcador(cameraScale)
  return {
    minX: token.x + AREA_DE_TOQUE.x * k,
    minY: token.y + AREA_DE_TOQUE.y * k,
    maxX: token.x + (AREA_DE_TOQUE.x + AREA_DE_TOQUE.largura) * k,
    maxY: token.y + (AREA_DE_TOQUE.y + AREA_DE_TOQUE.altura) * k,
  }
}

/**
 * O que o clique do mestre precisa saber para acertar o pino inteiro: quais
 * fichas da cena estão desenhadas como pino e o zoom. Ausente = nenhuma
 * (cena Normal, sala fechada): vale o disco de sempre.
 */
export interface PinosNoToque {
  /** As fichas que são pino: um conjunto, ou o próprio mapa de cores (`coresDosPinos`). */
  ids: Pick<ReadonlySet<string>, 'has'>
  cameraScale: number
}

/** O ponto (mundo) cai no pino desta ficha? */
export function tocaNoPino(token: Pick<Token, 'x' | 'y'>, point: { x: number; y: number }, cameraScale: number): boolean {
  const area = areaDoPino(token, cameraScale)
  return point.x >= area.minX && point.x <= area.maxX && point.y >= area.minY && point.y <= area.maxY
}
