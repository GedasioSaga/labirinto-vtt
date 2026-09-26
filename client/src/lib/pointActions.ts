import type { MapData, Pin, Region, RegionPoint } from '../types/map'
import { pointInRing } from './floorContour'

/**
 * AÇÕES NO PONTO: depois do toque longo no mapa o jogador escolhe o que quer
 * fazer ALI ("procuro armadilha aqui"), e isso vira um pedido com o ponto na
 * Caixa do mestre. Aqui mora a regra pura, dividida por mestre e jogador:
 * quais ações existem, como cada lado lê o pedido e a resposta, e os limites.
 */

export const POINT_ACTION_KINDS = ['procurar', 'escutar', 'espiar', 'revistar'] as const
export type PointActionKind = (typeof POINT_ACTION_KINDS)[number]

/** Resposta do mestre: "Nada aqui" (`nothing`) ou "Feito" (`seen`). */
export type PointActionAnswer = 'nothing' | 'seen'

/**
 * Por que o host recusou sem levar ao mestre. `too_soon`: pediu de novo antes
 * do intervalo mínimo; `pending`: já tem pedidos demais esperando;
 * `out_of_map`: o ponto caiu fora do mapa (a câmera do jogador arrasta além
 * da borda).
 */
export type PointActionRejection = 'too_soon' | 'pending' | 'out_of_map'

const POINT_ACTION_REJECTIONS: readonly PointActionRejection[] = ['too_soon', 'pending', 'out_of_map']

export function isPointActionRejection(value: unknown): value is PointActionRejection {
  return POINT_ACTION_REJECTIONS.some((reason) => reason === value)
}

/**
 * O ponto (px de mundo) está dentro do mapa, bordas incluídas? A mesma régua
 * no host (que recusa) e no jogador (que nem abre o menu nem envia): fora
 * dela o pedido não tem sala nem sentido.
 */
export function isPointInsideMap(map: Pick<MapData, 'width' | 'height' | 'grid'>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x <= map.width * map.grid && y <= map.height * map.grid
}

/** Um pedido aceito por jogador nesta janela; o de dentro dela é recusado com `too_soon`. */
export const POINT_ACTION_MIN_INTERVAL_MS = 1000
/** Quantos pedidos de um jogador podem esperar o mestre ao mesmo tempo. */
export const MAX_PENDING_POINT_ACTIONS_PER_PLAYER = 3
/** Quanto tempo a resposta do mestre (ou a recusa do host) fica na tela do jogador. */
export const POINT_NOTICE_TTL_MS = 5000

const LABELS: Record<PointActionKind, string> = {
  procurar: 'Procurar',
  escutar: 'Escutar',
  espiar: 'Espiar',
  revistar: 'Revistar',
}

export function pointActionLabel(action: PointActionKind): string {
  return LABELS[action]
}

export function isPointActionKind(value: unknown): value is PointActionKind {
  return POINT_ACTION_KINDS.some((kind) => kind === value)
}

/** Área absoluta do polígono (fórmula do laço). */
function ringArea(ring: readonly RegionPoint[]): number {
  let twice = 0
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    twice += a.x * b.y - b.x * a.y
  }
  return Math.abs(twice) / 2
}

/**
 * Nome da Sala onde está o ponto, no mapa do MESTRE (nunca vai ao jogador).
 * Com salas uma dentro da outra (Ferreiro dentro da Praça) vale a menor: é a
 * que diz onde o jogador está de verdade. Sala sem nome não conta. `null` =
 * ponto fora de toda sala com nome.
 */
export function roomNameAt(map: MapData, point: RegionPoint): string | null {
  return roomAt(map, point)?.name ?? null
}

/** A menor Sala com nome que contém o ponto, com o nome aparado; `null` = nenhuma. */
function roomAt(map: MapData, point: RegionPoint): { name: string; region: Region } | null {
  let best: { name: string; region: Region; area: number } | null = null
  for (const region of map.regions) {
    const name = region.room?.name.trim() ?? ''
    if (name === '' || region.points.length < 3 || !pointInRing(point, region.points)) continue
    const area = ringArea(region.points)
    if (best === null || area < best.area) best = { name, region, area }
  }
  return best === null ? null : { name: best.name, region: best.region }
}

/** Uma pista oculta que o mestre pode entregar a quem revistou: o pino e como o mestre o reconhece. */
export interface PointActionClue {
  pinId: string
  /** O nome só do mestre ("Carta"), ou a primeira linha da descrição. Leitura do MESTRE. */
  label: string
}

/** Quantas pistas a linha do Revistar oferece: cada uma é um botão na Caixa. */
export const PISTAS_DO_REVISTAR_MAX = 4
/** Teto do rótulo do botão "Entregar: …" (a linha da Caixa é estreita). */
export const PISTA_ROTULO_MAX = 28
const PISTA_SEM_TEXTO = 'Pista sem texto'

/** Como o mestre reconhece o pino no botão: o nome dele, senão a primeira linha escrita. */
function clueLabelOf(pin: Pick<Pin, 'nome' | 'description'>): string {
  const nome = pin.nome?.trim() ?? ''
  const primeiraLinha = pin.description.split('\n').map((linha) => linha.trim()).find((linha) => linha !== '') ?? ''
  const label = nome !== '' ? nome : primeiraLinha !== '' ? primeiraLinha : PISTA_SEM_TEXTO
  return label.length > PISTA_ROTULO_MAX ? `${label.slice(0, PISTA_ROTULO_MAX - 1)}…` : label
}

/**
 * REVISTAR + "ENTREGAR PISTA…": os pinos OCULTOS PARA JOGADORES ("!"/"?") da
 * Sala onde o jogador tocou — a carta na gaveta, o diário sob o colchão. São
 * o que o mestre escondeu para ser achado revistando. Leitura do MESTRE: nada
 * disto vai ao jogador; o que sai é só o cartão que o mestre escolher entregar.
 * Fora de Sala com nome, nenhuma (não há "a sala" para revistar).
 */
export function hiddenCluesAt(map: MapData, point: RegionPoint): PointActionClue[] {
  const room = roomAt(map, point)
  if (room === null) return []
  return map.pins
    .filter((pin) => pin.secret === true && (pin.kind === 'exclamacao' || pin.kind === 'interrogacao') && pointInRing(pin, room.region.points))
    .slice(0, PISTAS_DO_REVISTAR_MAX)
    .map((pin) => ({ pinId: pin.id, label: clueLabelOf(pin) }))
}

/** O que o mestre precisa ler do pedido para escrever a linha da Caixa. */
export interface PointActionSummary {
  playerName: string
  action: PointActionKind
  roomName: string | null
  sceneName: string
  /** `true` quando o ponto é de uma cena que não está aberta no editor. */
  background: boolean
}

/**
 * A linha da Caixa: "Fabi quer Procurar — Ferreiro". De cena de fundo leva a
 * cena junto ("— Adega, em Porão"), porque o mestre está olhando outro mapa.
 */
export function pointActionMasterText(summary: PointActionSummary): string {
  const head = `${summary.playerName} quer ${pointActionLabel(summary.action)}`
  const where = summary.background ? (summary.roomName === null ? `em ${summary.sceneName}` : `${summary.roomName}, em ${summary.sceneName}`) : summary.roomName
  return where === null ? head : `${head} — ${where}`
}

/**
 * O aviso do pedido na tela do jogador. `waiting` fica até a resposta e lista
 * TODAS as ações que ainda esperam o mestre (até
 * `MAX_PENDING_POINT_ACTIONS_PER_PLAYER`), da mais antiga à mais nova; os
 * outros somem sozinhos (`POINT_NOTICE_TTL_MS`). `id` novo repete o aviso.
 */
export type PointNotice =
  | { id: number; phase: 'waiting'; actions: readonly [PointActionKind, ...PointActionKind[]] }
  | { id: number; phase: 'answered'; action: PointActionKind; answer: PointActionAnswer }
  | { id: number; phase: 'rejected'; reason: PointActionRejection }

const REJECTION_TEXT: Record<PointActionRejection, string> = {
  too_soon: 'Espere um instante para pedir de novo',
  pending: 'Espere o mestre responder seus pedidos',
  out_of_map: 'Esse ponto fica fora do mapa',
}

/** "Procurar", "Procurar e Escutar", "Procurar, Escutar e Espiar"; a mesma ação repetida conta uma vez. */
function joinActionLabels(actions: readonly PointActionKind[]): string {
  const labels = [...new Set(actions)].map(pointActionLabel)
  const last = labels.pop()
  return labels.length === 0 ? (last ?? '') : `${labels.join(', ')} e ${last}`
}

export function pointNoticeText(notice: PointNotice): string {
  switch (notice.phase) {
    case 'waiting':
      return `${joinActionLabels(notice.actions)}: esperando o mestre`
    case 'answered':
      // Com vários pedidos esperando, a resposta sem o nome da ação não diz de qual é.
      return `${pointActionLabel(notice.action)}: ${notice.answer === 'nothing' ? 'você não encontrou nada' : 'o mestre viu'}`
    case 'rejected':
      return REJECTION_TEXT[notice.reason]
  }
}
