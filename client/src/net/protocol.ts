import type { MapData, RegionPoint } from '../types/map'
import type { ExploredWire } from '../lib/exploration'
import type { TokenMoveRejection } from '../lib/moveValidation'
import { LASER_MAX_POINTS_PER_MESSAGE } from '../lib/laser'
import { isTokenPhotoData } from '../lib/tokenPhoto'

/**
 * Protocolo mestre <-> jogador. Toda mensagem é um objeto discriminado por
 * `type`. O que chega do jogador é hostil: passa por `parsePlayerMessage`
 * antes de qualquer uso.
 *
 * Versão 1: `delta` carrega o snapshot completo já filtrado para o jogador,
 * só com `rev` maior que o anterior. O cliente trata `delta` igual a
 * `snapshot` e descarta qualquer `rev` menor ou igual ao último aplicado.
 * Delta incremental de verdade fica para uma versão futura do protocolo.
 *
 * `explored` (bitset do que o jogador já viu) e `ownTokens` (ids dos tokens
 * dele) entraram depois como campos aditivos: a versão continua 1. Idem
 * `concealed` (polígonos das zonas ocultas ativas, pintados de preto) e a
 * mensagem `signal` nos dois sentidos (sinal de mapa do jogador) e a `laser`
 * do mestre para o jogador.
 *
 * `door.toggle` (jogador -> mestre) e `door.toggle.rejected` (volta) são
 * aditivas pelo mesmo motivo: mestre antigo responde `error invalid_message`
 * (o jogador só não abre a porta) e jogador antigo ignora a recusa.
 *
 * `welcome.name` é aditivo pelo mesmo critério: o host já renomeia nome
 * repetido para "Ana (2)" (`uniqueName`) e sem este campo o jogador nunca
 * descobre com que nome entrou. Cliente antigo ignora o campo; mestre antigo
 * não o envia e o jogador cai no nome que digitou.
 *
 * `room.closed` (mestre -> jogador) também é aditiva: o mestre avisa que
 * encerrou a sala antes de derrubar a conexão, e o jogador mostra "O mestre
 * encerrou a sala" em vez de "A conexão caiu". Cliente antigo cai no
 * `default` do switch e ignora; mestre antigo não envia e o jogador novo
 * continua tratando a queda como hoje.
 *
 * O PEDIDO DE PASSAGEM do pino de viagem é aditivo pelo mesmo critério:
 * `pin.travel.request` (jogador -> mestre) e, na volta, `pin.travel.rejected`
 * (o host recusou antes de perguntar ao mestre), `pin.travel.denied` (o mestre
 * disse "Não") e `scene.changed` (o mestre deixou ir; o snapshot da cena nova
 * vem logo depois). Nenhuma delas carrega nome nem id de cena: o jogador só
 * descobre para onde foi pelo mapa que chega depois da aprovação. Mestre
 * antigo responde `error invalid_message`; jogador antigo ignora as três.
 */
export const PROTOCOL_VERSION = 1

export const JOIN_CODE_LENGTH = 6
export const NAME_MIN_LENGTH = 1
export const NAME_MAX_LENGTH = 32
export const REQ_ID_MAX_LENGTH = 64
export const RESUME_TOKEN_MAX_LENGTH = 128

const JOIN_CODE_PATTERN = /^[A-Z0-9]{6}$/

// Jogador -> mestre
export interface JoinMessage {
  type: 'join'
  code: string
  name: string
  resume?: string
}

export interface TokenMoveMessage {
  type: 'token.move'
  reqId: string
  tokenId: string
  x: number
  y: number
}

export interface PingMessage {
  type: 'ping'
}

/** Sinal (ping de mapa) do jogador. Não confundir com `ping`, que é o heartbeat. */
export interface SignalMessage {
  type: 'signal'
  x: number
  y: number
}

/**
 * Jogador pede para abrir/fechar uma porta encostada no token dele. O host
 * valida (porta existe, visível para ele agora, destrancada, token perto) e
 * aplica no mapa do mestre; recusa volta em `door.toggle.rejected`.
 */
export interface DoorToggleMessage {
  type: 'door.toggle'
  wallId: string
}

/**
 * Jogador troca o NOME e a FOTO do PRÓPRIO token, da tela dele. Campo ausente
 * = não mexe naquele dado; `image: null` remove a foto.
 *
 * `image` é sempre uma referência AUTO-CONTIDA (`data:image/...;base64,...`),
 * validada por `isTokenPhotoData`: o jogador não tem, e nunca terá, caminho
 * nenhum no disco do mestre, e o host não aceita outra forma.
 *
 * Aditiva pelo mesmo critério de `door.toggle`: mestre antigo responde
 * `error invalid_message` (o jogador só não troca nada) e jogador antigo nunca
 * a envia.
 */
export interface TokenEditMessage {
  type: 'token.edit'
  tokenId: string
  name?: string
  image?: string | null
}

/**
 * Jogador pede ao mestre para passar pelo pino de viagem `pinId` da cena em que
 * está. Só o id do pino: o destino o jogador nem conhece (`lib/fogFilter.ts`).
 * O host valida e, se valer, pergunta ao mestre.
 */
export interface PinTravelRequestMessage {
  type: 'pin.travel.request'
  pinId: string
}

export type PlayerMessage = JoinMessage | TokenMoveMessage | PingMessage | SignalMessage | DoorToggleMessage | TokenEditMessage | PinTravelRequestMessage

/** Por que o host recusou o pedido de porta do jogador. */
export type DoorToggleRejection = 'locked' | 'far' | 'not_visible'

/**
 * Por que o host recusou o pedido de passagem SEM levar ao mestre. Genérico de
 * propósito: pino inexistente, no escuro, sem destino ou cena sem token do
 * jogador respondem todos `unavailable` — um motivo por caso diria ao jogador
 * o que existe do outro lado. `pending`: ele já tem um pedido esperando;
 * `too_soon`: pediu de novo pelo mesmo pino antes do intervalo mínimo.
 */
export type PinTravelRejection = 'unavailable' | 'pending' | 'too_soon'

// Mestre -> jogador
/** Laser do mestre: lote de pontos (px de mundo) desde o último envio, ou `off` ao soltar. */
export type LaserMessage = { type: 'laser'; points: RegionPoint[] } | { type: 'laser'; off: true }

export type HostErrorReason = 'bad_code' | 'invalid_message' | 'not_joined' | 'already_joined'

export type HostMessage =
  // `name`: nome EFETIVO na sala, que pode não ser o que o jogador digitou.
  | { type: 'welcome'; playerId: string; resumeToken: string; name: string }
  | { type: 'lobby.waiting' }
  | { type: 'snapshot'; rev: number; map: MapData; vision: RegionPoint[][]; explored: ExploredWire; ownTokens: string[]; concealed: RegionPoint[][] }
  | { type: 'delta'; rev: number; map: MapData; vision: RegionPoint[][]; explored: ExploredWire; ownTokens: string[]; concealed: RegionPoint[][] }
  | { type: 'token.move.accepted'; reqId: string; x: number; y: number }
  | { type: 'token.move.rejected'; reqId: string; reason: TokenMoveRejection }
  | { type: 'signal'; x: number; y: number; from: string; color: string }
  | { type: 'door.toggle.rejected'; wallId: string; reason: DoorToggleRejection }
  | { type: 'pin.travel.rejected'; reason: PinTravelRejection }
  | { type: 'pin.travel.denied' }
  // `by: 'master'`: o mestre levou o jogador sem pedido ("Mandar para…" do
  // painel Grupo). Aditivo: jogador antigo ignora o campo e lê "Você chegou".
  // `by: 'gather'`: também sem pedido, mas pelo "Reunir o grupo aqui" de um
  // pino — o aviso diz que o GRUPO foi reunido, e continua sem dizer onde.
  | { type: 'scene.changed'; by?: 'master' | 'gather' }
  | LaserMessage
  | { type: 'kicked' }
  | { type: 'room.closed' }
  | { type: 'error'; reason: HostErrorReason }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseJoin(obj: Record<string, unknown>): JoinMessage | null {
  const { code, name, resume } = obj
  if (typeof code !== 'string' || !JOIN_CODE_PATTERN.test(code)) return null
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  // `length` conta unidades UTF-16 (emoji = 2): é o limite que o jogador vê no input.
  if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) return null
  if (resume === undefined) return { type: 'join', code, name: trimmed }
  if (!isBoundedString(resume, 1, RESUME_TOKEN_MAX_LENGTH)) return null
  return { type: 'join', code, name: trimmed, resume }
}

function parseTokenMove(obj: Record<string, unknown>): TokenMoveMessage | null {
  const { reqId, tokenId, x, y } = obj
  if (!isBoundedString(reqId, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(tokenId, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null
  return { type: 'token.move', reqId, tokenId, x, y }
}

/**
 * Edição do próprio token. Recusa a mensagem inteira quando qualquer campo
 * presente está malformado, e também quando ela não muda NADA — mensagem que
 * não pede nada não vale um broadcast.
 */
function parseTokenEdit(obj: Record<string, unknown>): TokenEditMessage | null {
  const { tokenId, name, image } = obj
  if (!isBoundedString(tokenId, 1, REQ_ID_MAX_LENGTH)) return null
  const parsed: TokenEditMessage = { type: 'token.edit', tokenId }
  if (name !== undefined) {
    if (typeof name !== 'string') return null
    const trimmed = name.trim()
    // Mesmo limite do nome do jogador: é texto que o mestre vê na tela dele.
    if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) return null
    parsed.name = trimmed
  }
  if (image !== undefined) {
    // Fronteira de segurança: só foto embutida. Caminho de disco, `http://` e
    // `javascript:` não casam com o padrão e a mensagem inteira cai.
    if (image !== null && !isTokenPhotoData(image)) return null
    parsed.image = image
  }
  if (parsed.name === undefined && parsed.image === undefined) return null
  return parsed
}

/**
 * Valida a mensagem `laser` que o jogador recebe (objeto já desserializado).
 * Aceita `off: true` ou 1 a `LASER_MAX_POINTS_PER_MESSAGE` pontos finitos; devolve
 * cópia só com `x`/`y`, e `null` para qualquer outra forma.
 */
export function parseLaserMessage(value: unknown): LaserMessage | null {
  if (!isRecord(value) || value.type !== 'laser') return null
  if (value.off === true) return { type: 'laser', off: true }
  const { points } = value
  if (!Array.isArray(points) || points.length === 0 || points.length > LASER_MAX_POINTS_PER_MESSAGE) return null
  const parsed: RegionPoint[] = []
  for (const point of points) {
    if (!isRecord(point) || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) return null
    parsed.push({ x: point.x, y: point.y })
  }
  return { type: 'laser', points: parsed }
}

/**
 * Valida mensagem vinda do jogador. Aceita o objeto já desserializado ou a
 * string JSON crua do transporte. Devolve um objeto novo só com os campos
 * conhecidos; qualquer campo faltando ou malformado resulta em `null`.
 */
export function parsePlayerMessage(raw: unknown): PlayerMessage | null {
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!isRecord(value)) return null
  switch (value.type) {
    case 'join':
      return parseJoin(value)
    case 'token.move':
      return parseTokenMove(value)
    case 'ping':
      return { type: 'ping' }
    case 'signal':
      return isFiniteNumber(value.x) && isFiniteNumber(value.y) ? { type: 'signal', x: value.x, y: value.y } : null
    case 'door.toggle':
      return isBoundedString(value.wallId, 1, REQ_ID_MAX_LENGTH) ? { type: 'door.toggle', wallId: value.wallId } : null
    case 'token.edit':
      return parseTokenEdit(value)
    case 'pin.travel.request':
      return isBoundedString(value.pinId, 1, REQ_ID_MAX_LENGTH) ? { type: 'pin.travel.request', pinId: value.pinId } : null
    default:
      return null
  }
}
