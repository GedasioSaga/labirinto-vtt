import type { HazardKind, MapData, RegionPoint } from '../types/map'
import type { PlayerHazard } from '../lib/hazards'
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
 *
 * `scene.note` (mestre -> jogador) é o RECADO POR CENA, aditivo pelo mesmo
 * critério: jogador antigo cai no `default` e ignora. Leva só o texto e um id,
 * nunca o id nem o nome da cena — quem recebe já está lá.
 *
 * `scene.alarm` e `scene.alarm.end` (mestre -> jogador) são o ALARME PARA
 * VÁRIAS CENAS, aditivos pelo mesmo critério: jogador antigo ignora os dois.
 * Levam o texto e um id; nunca as cenas escolhidas.
 *
 * `turn` no snapshot (INICIATIVA) é aditivo pelo mesmo critério: o id da ficha
 * da vez, e só quando ela está no recorte do jogador. Jogador antigo ignora o
 * campo; mestre antigo não o envia e ninguém fica na vez.
 *
 * O PEDIDO DA PORTA TRANCADA também é aditivo: `door.request` (jogador ->
 * mestre) e, na volta, `door.request.rejected` e `door.request.answer`. Mestre
 * antigo responde `error invalid_message`; jogador antigo ignora as duas.
 *
 * ITEM PEGÁVEL, aditivo pelo mesmo critério: `pin.take` e `item.give`
 * (jogador -> mestre) e, na volta, `pin.take.rejected`, `pin.take.answer` e
 * `item.give.rejected`. A mochila viaja no token do PRÓPRIO jogador, no
 * snapshot (`Token.mochila`); a de outro nunca sai (`lib/fogFilter.ts`).
 * `snapshot.partyTokens` também é aditivo: quais das fichas que o jogador já
 * recebeu são de colegas. Jogador antigo ignora; host antigo não manda, e o
 * "Dar a…" fica sem colega (em vez de oferecer quem o host recusaria).
 *
 * ZONA DE PERIGO, aditiva pelo mesmo critério: `snapshot.hazards` (tipo e
 * polígono de cada sala tomada que o jogador enxerga) e `hazard.entered`
 * (mestre -> jogador: a ficha dele entrou no perigo). Jogador antigo ignora os
 * dois; mestre antigo não manda, e a tela fica sem perigo desenhado.
 */
export const PROTOCOL_VERSION = 1

export const JOIN_CODE_LENGTH = 6
export const NAME_MIN_LENGTH = 1
export const NAME_MAX_LENGTH = 32
export const REQ_ID_MAX_LENGTH = 64
export const RESUME_TOKEN_MAX_LENGTH = 128
/** Teto da chave da tela da mesa no `join` (a gerada pelo mestre é um UUID, 36). */
export const TABLE_KEY_MAX_LENGTH = 128
/** Teto do recado por cena, em unidades UTF-16 (o `maxLength` do campo do mestre conta igual). */
export const NOTE_MAX_LENGTH = 500
/** Teto do alarme, na mesma conta: é uma faixa urgente no alto da tela, não uma carta. */
export const ALARM_MAX_LENGTH = 140

const JOIN_CODE_PATTERN = /^[A-Z0-9]{6}$/

// Jogador -> mestre
export interface JoinMessage {
  type: 'join'
  code: string
  name: string
  resume?: string
  /**
   * TELA DA MESA: a página de espectador (TV, projetor) entra pelo MESMO
   * `join` — o servidor do app só aceita `join` como primeira mensagem — com
   * `role: 'table'`. Ela não é jogador: não tem ficha, não retoma sessão
   * (`resume` junto recusa a mensagem) e só recebe a cena que o mestre escolhe.
   * Aditivo: mestre antigo ignora o campo e a trata como jogador sem ficha.
   */
  role?: 'table'
  /**
   * TELA DA MESA: a chave que o mestre gera por sala e põe SÓ no link da TV
   * (aba Jogo). O código da sala todo jogador tem; sem esta chave, ninguém vira
   * tela e recebe a cena que o mestre escolheu (que pode ser outra que a dele).
   */
  tableKey?: string
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
  /**
   * ENCRUZILHADA: qual saída do pino (o id que veio em `Pin.escolhas`).
   * Aditivo: ausente vale a saída principal, e é o que o cliente antigo manda.
   */
  exitId?: string
}

/** Como o jogador tenta passar pela porta trancada: Bater, Forçar ou Usar chave. */
export type DoorRequestHow = 'knock' | 'force' | 'key'

const DOOR_REQUEST_HOWS: readonly DoorRequestHow[] = ['knock', 'force', 'key']

/**
 * PORTA TRANCADA VIRA PEDIDO: o jogador tocou a porta, leu "Trancada" e pede
 * ao mestre do jeito que escolheu. O host valida (porta visível, trancada,
 * token perto) e leva ao mestre; a resposta volta em `door.request.answer`.
 * Aditiva pelo mesmo critério de `door.toggle`.
 */
export interface DoorRequestMessage {
  type: 'door.request'
  wallId: string
  how: DoorRequestHow
}

/**
 * ITEM PEGÁVEL: o jogador pede para pegar o item do pino `pinId`. O host
 * valida (pino visível, pegável, ficha encostada) e leva ao mestre — ou, no
 * pino livre, entrega direto. A resposta volta em `pin.take.answer`.
 */
export interface PinTakeMessage {
  type: 'pin.take'
  pinId: string
}

/** O jogador dá o item `itemId` da própria mochila à ficha `toTokenId`, de um colega encostado. */
export interface ItemGiveMessage {
  type: 'item.give'
  itemId: string
  toTokenId: string
}

export type PlayerMessage =
  | JoinMessage
  | TokenMoveMessage
  | PingMessage
  | SignalMessage
  | DoorToggleMessage
  | DoorRequestMessage
  | TokenEditMessage
  | PinTravelRequestMessage
  | PinTakeMessage
  | ItemGiveMessage

/**
 * Por que o host não levou o "Pegar" ao mestre. `unavailable` junta pino
 * inexistente, no escuro, oculto e que não é item — um motivo por caso diria
 * o que existe no escuro. `pending`: um pedido de item dele já espera.
 */
export type PinTakeRejection = 'unavailable' | 'far' | 'pending'

export const PIN_TAKE_REJECTIONS: readonly PinTakeRejection[] = ['unavailable', 'far', 'pending']

/** Por que o "Dar a…" não valeu: colega longe, ou item/ficha que não servem. */
export type ItemGiveRejection = 'unavailable' | 'far'

export const ITEM_GIVE_REJECTIONS: readonly ItemGiveRejection[] = ['unavailable', 'far']

/** Por que o host recusou o pedido de porta do jogador. */
export type DoorToggleRejection = 'locked' | 'far' | 'not_visible'

/**
 * Por que o host não levou o pedido da porta trancada ao mestre. `pending`: um
 * pedido de porta dele já espera; `not_locked`: a porta abre com o toque.
 * Porta inexistente ou no escuro respondem o mesmo `not_visible` do toque.
 */
export type DoorRequestRejection = 'pending' | 'far' | 'not_visible' | 'not_locked'

export const DOOR_REQUEST_REJECTIONS: readonly DoorRequestRejection[] = ['pending', 'far', 'not_visible', 'not_locked']

/** A resposta do mestre ao pedido da porta. Sem id de porta nem de cena: quem pediu já sabe qual foi. */
export type DoorRequestAnswer = 'opened' | 'denied'

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

/** Recado do mestre a quem está numa cena. `id` novo = recado novo (substitui o que estiver aberto). */
export interface SceneNoteMessage {
  type: 'scene.note'
  id: string
  text: string
}

/**
 * ALARME PARA VÁRIAS CENAS: aviso urgente que fica na tela até o mestre
 * encerrar. `id` novo = alarme novo (substitui o aberto). Nunca leva as cenas
 * escolhidas: quem recebe já está numa delas, e a lista diria que as outras existem.
 */
export interface SceneAlarmMessage {
  type: 'scene.alarm'
  id: string
  text: string
}

/** Fim do alarme `id`: o jogador tira o aviso SÓ se ainda for este (um fim atrasado não apaga o novo). */
export interface SceneAlarmEndMessage {
  type: 'scene.alarm.end'
  id: string
}

/**
 * `table_full`: já há `MAX_TABLE_SCREENS` telas da mesa na sala (`hostSession.ts`).
 * `bad_table_key`: tela da mesa sem a chave do link da TV, ou com outra.
 */
export type HostErrorReason = 'bad_code' | 'invalid_message' | 'not_joined' | 'already_joined' | 'table_full' | 'bad_table_key'

export type HostMessage =
  // `name`: nome EFETIVO na sala, que pode não ser o que o jogador digitou.
  | { type: 'welcome'; playerId: string; resumeToken: string; name: string }
  | { type: 'lobby.waiting' }
  // `turn`: id da ficha da vez (iniciativa), só quando ela está em `map.tokens`
  // deste recorte (`turnForPlayer`). Ausente = ninguém que o jogador vê.
  // `partyTokens` (ITEM PEGÁVEL): das fichas que ele recebeu, as de OUTROS jogadores — o "Dar a…" não oferece NPC.
  // `hazards` (ZONA DE PERIGO): só o que o jogador enxerga agora, e só quando há algum (`PlayerMapView.hazards`).
  | { type: 'snapshot'; rev: number; map: MapData; vision: RegionPoint[][]; explored: ExploredWire; ownTokens: string[]; concealed: RegionPoint[][]; turn?: string; partyTokens?: string[]; hazards?: PlayerHazard[] }
  | { type: 'delta'; rev: number; map: MapData; vision: RegionPoint[][]; explored: ExploredWire; ownTokens: string[]; concealed: RegionPoint[][]; turn?: string; partyTokens?: string[]; hazards?: PlayerHazard[] }
  // ZONA DE PERIGO: a ficha DESTE jogador entrou num perigo. Só o tipo — nem a sala, nem a zona.
  | { type: 'hazard.entered'; kind: HazardKind }
  | { type: 'token.move.accepted'; reqId: string; x: number; y: number }
  | { type: 'token.move.rejected'; reqId: string; reason: TokenMoveRejection }
  | { type: 'signal'; x: number; y: number; from: string; color: string }
  | { type: 'door.toggle.rejected'; wallId: string; reason: DoorToggleRejection }
  | { type: 'door.request.rejected'; wallId: string; reason: DoorRequestRejection }
  | { type: 'door.request.answer'; answer: DoorRequestAnswer }
  | { type: 'pin.travel.rejected'; reason: PinTravelRejection }
  // ITEM PEGÁVEL. `nome` só no `taken`: o jogador lê o que agora carrega.
  | { type: 'pin.take.rejected'; reason: PinTakeRejection }
  | { type: 'pin.take.answer'; answer: 'taken'; nome: string }
  | { type: 'pin.take.answer'; answer: 'denied' }
  | { type: 'item.give.rejected'; reason: ItemGiveRejection }
  | { type: 'pin.travel.denied' }
  // `by: 'master'`: o mestre levou o jogador sem pedido ("Mandar para…" do
  // painel Grupo). Aditivo: jogador antigo ignora o campo e lê "Você chegou".
  // `by: 'gather'`: também sem pedido, mas pelo "Reunir o grupo aqui" de um
  // pino — o aviso diz que o GRUPO foi reunido, e continua sem dizer onde.
  | { type: 'scene.changed'; by?: 'master' | 'gather' }
  | LaserMessage
  | SceneNoteMessage
  | SceneAlarmMessage
  | SceneAlarmEndMessage
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
  const { code, name, resume, role, tableKey } = obj
  if (typeof code !== 'string' || !JOIN_CODE_PATTERN.test(code)) return null
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  // `length` conta unidades UTF-16 (emoji = 2): é o limite que o jogador vê no input.
  if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) return null
  if (role !== undefined) {
    // Tela da mesa nunca retoma sessão de jogador: com `resume` junto, a mensagem cai inteira.
    if (role !== 'table' || resume !== undefined) return null
    // Sem chave a mensagem passa: quem recusa é a sessão (`bad_table_key`), para a TV dizer o que falta.
    if (tableKey === undefined) return { type: 'join', code, name: trimmed, role }
    if (!isBoundedString(tableKey, 1, TABLE_KEY_MAX_LENGTH)) return null
    return { type: 'join', code, name: trimmed, role, tableKey }
  }
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
 * Pedido de passagem. `exitId` é opcional; presente, tem de ser texto curto —
 * qualquer outra coisa recusa a mensagem inteira, em vez de cair calada na
 * saída principal (o jogador escolheu uma porta e iria por outra).
 */
function parseTravelRequest(obj: Record<string, unknown>): PinTravelRequestMessage | null {
  const { pinId, exitId } = obj
  if (!isBoundedString(pinId, 1, REQ_ID_MAX_LENGTH)) return null
  if (exitId === undefined) return { type: 'pin.travel.request', pinId }
  if (!isBoundedString(exitId, 1, REQ_ID_MAX_LENGTH)) return null
  return { type: 'pin.travel.request', pinId, exitId }
}

export function isDoorRequestHow(value: unknown): value is DoorRequestHow {
  return DOOR_REQUEST_HOWS.some((how) => how === value)
}

/** Pedido da porta trancada: id de porta curto e um dos três jeitos; qualquer outra coisa recusa a mensagem. */
function parseDoorRequest(obj: Record<string, unknown>): DoorRequestMessage | null {
  const { wallId, how } = obj
  if (!isBoundedString(wallId, 1, REQ_ID_MAX_LENGTH) || !isDoorRequestHow(how)) return null
  return { type: 'door.request', wallId, how }
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
 * Corta o recado no teto. Não deixa meia letra no fim: um emoji partido ao
 * meio (surrogate alto sozinho) viraria um losango de erro na tela do jogador.
 */
export function clampNoteText(text: string): string {
  return clampTextTo(text, NOTE_MAX_LENGTH)
}

/** O mesmo corte do recado, no teto do alarme (`ALARM_MAX_LENGTH`). */
export function clampAlarmText(text: string): string {
  return clampTextTo(text, ALARM_MAX_LENGTH)
}

function clampTextTo(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
}

/**
 * Valida o `scene.alarm` que o jogador recebe, no molde do `scene.note`: forma
 * errada, texto vazio ou acima do teto recusam a mensagem inteira. Devolve
 * cópia só com os campos conhecidos.
 */
export function parseSceneAlarm(value: unknown): SceneAlarmMessage | null {
  if (!isRecord(value) || value.type !== 'scene.alarm') return null
  const { id, text } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(text, 1, ALARM_MAX_LENGTH)) return null
  return { type: 'scene.alarm', id, text }
}

/** Valida o `scene.alarm.end`; `null` para qualquer outra forma. */
export function parseSceneAlarmEnd(value: unknown): SceneAlarmEndMessage | null {
  if (!isRecord(value) || value.type !== 'scene.alarm.end') return null
  const { id } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  return { type: 'scene.alarm.end', id }
}

/**
 * Valida o `scene.note` que o jogador recebe. O mestre é confiável, mas o
 * texto vai para a tela: forma errada, texto vazio ou acima do teto recusam a
 * mensagem inteira em vez de mostrar um pedaço. Devolve cópia só com os campos
 * conhecidos.
 */
export function parseSceneNote(value: unknown): SceneNoteMessage | null {
  if (!isRecord(value) || value.type !== 'scene.note') return null
  const { id, text } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(text, 1, NOTE_MAX_LENGTH)) return null
  return { type: 'scene.note', id, text }
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
    case 'door.request':
      return parseDoorRequest(value)
    case 'token.edit':
      return parseTokenEdit(value)
    case 'pin.travel.request':
      return parseTravelRequest(value)
    case 'pin.take':
      return isBoundedString(value.pinId, 1, REQ_ID_MAX_LENGTH) ? { type: 'pin.take', pinId: value.pinId } : null
    case 'item.give':
      return isBoundedString(value.itemId, 1, REQ_ID_MAX_LENGTH) && isBoundedString(value.toTokenId, 1, REQ_ID_MAX_LENGTH)
        ? { type: 'item.give', itemId: value.itemId, toTokenId: value.toTokenId }
        : null
    default:
      return null
  }
}
