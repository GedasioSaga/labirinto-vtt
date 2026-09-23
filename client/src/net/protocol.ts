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
 *
 * `scene.note` (mestre -> jogador) é o RECADO POR CENA, aditivo pelo mesmo
 * critério: jogador antigo cai no `default` e ignora. Leva só o texto e um id,
 * nunca o id nem o nome da cena — quem recebe já está lá.
 *
 * `scene.paused` (mestre -> jogador) é a PAUSA POR CENA, aditiva pelo mesmo
 * critério: só `paused`, sem nome da cena. Com a cena pausada, o host recusa o
 * `token.move` com o motivo `paused` — jogador antigo ignora o motivo e desfaz
 * o movimento como em qualquer recusa.
 *
 * `party.update` (mestre -> jogador) é a lista de COMPANHEIROS, aditiva pelo
 * mesmo critério. É calculada por destinatário: diz só se cada outro jogador
 * está na mesma cena que ele ('aqui'), em outra ('longe') ou desconectado
 * ('fora') — nunca o id nem o nome da cena de ninguém.
 *
 * `scene.note.onlyYou` é o RECADO PARA UM JOGADOR SÓ (linha dele no Grupo):
 * a mesma mensagem, que o host manda a uma conexão só, com a marca para a
 * tela dizer "Só para você". Aditivo: jogador antigo mostra como recado comum.
 *
 * O PEDIDO DA PORTA TRANCADA também é aditivo: `door.request` (jogador ->
 * mestre) e, na volta, `door.request.rejected` e `door.request.answer`. Mestre
 * antigo responde `error invalid_message`; jogador antigo ignora as duas.
 *
 * CHAMAR O MESTRE é aditivo pelo mesmo critério: `call.raise` / `call.lower`
 * (jogador -> mestre) e, na volta, `call.state` (esperando, visto, cedo
 * demais) e `call.reply` (a resposta, só para quem chamou). Mestre antigo
 * responde `error invalid_message` (a mão não acende); jogador antigo ignora.
 */
export const PROTOCOL_VERSION = 1

export const JOIN_CODE_LENGTH = 6
export const NAME_MIN_LENGTH = 1
export const NAME_MAX_LENGTH = 32
export const REQ_ID_MAX_LENGTH = 64
export const RESUME_TOKEN_MAX_LENGTH = 128
/** Teto do recado por cena, em unidades UTF-16 (o `maxLength` do campo do mestre conta igual). */
export const NOTE_MAX_LENGTH = 500

/** Por que o jogador chama o mestre. Ordem = ordem na tela do jogador. */
export const CALL_REASONS = ['ajuda', 'agir', 'pergunta', 'sair', 'urgente'] as const
export type CallReason = (typeof CALL_REASONS)[number]
/** Como cada motivo aparece, para o jogador e para o mestre. */
export const CALL_REASON_LABELS: Record<CallReason, string> = {
  ajuda: 'Ajuda',
  agir: 'Quero agir',
  pergunta: 'Pergunta',
  sair: 'Vou sair',
  urgente: 'Urgente',
}
/** Teto do texto curto do chamado, em unidades UTF-16 (o `maxLength` do campo conta igual). */
export const CALL_TEXT_MAX_LENGTH = 140

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

/** O jogador levanta a mão. `text` ausente = só o motivo. */
export interface CallRaiseMessage {
  type: 'call.raise'
  reason: CallReason
  text?: string
}

/** O jogador baixa a mão antes de o mestre ver. */
export interface CallLowerMessage {
  type: 'call.lower'
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
  | CallRaiseMessage
  | CallLowerMessage

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
  /** Recado só para este jogador (ninguém mais na sala recebeu). Ausente = recado da cena. */
  onlyYou?: true
}

/**
 * Por que o host recusou o movimento: as recusas da validação do mapa, mais
 * `paused` — a cena do jogador está pausada (o mestre está com outro grupo).
 */
export type TokenMoveRejectionReason = TokenMoveRejection | 'paused'

/** A cena do jogador está (ou deixou de estar) pausada pelo mestre. */
export interface ScenePausedMessage {
  type: 'scene.paused'
  paused: boolean
}

/** Onde um companheiro está, visto por quem recebe: mesma cena, outra cena, ou desconectado. */
export type PartyWhere = 'aqui' | 'longe' | 'fora'

export interface PartyMember {
  playerId: string
  name: string
  where: PartyWhere
}

/** Os OUTROS jogadores da mesa, na ordem de chegada. Quem recebe nunca está na lista. */
export interface PartyUpdateMessage {
  type: 'party.update'
  members: PartyMember[]
}

/** Teto da lista: a mesa tem de 4 a 7 jogadores; acima disto a mensagem é lixo, não mesa. */
export const PARTY_MAX_MEMBERS = 32
/** Folga para o " (n)" que o `uniqueName` do host soma a nome repetido. */
const PARTY_NAME_SUFFIX_MAX = 8

/**
 * Onde está a mão do jogador, do lado do mestre: `waiting` (na fila, com o
 * motivo que vale), `seen` (o mestre marcou Visto) ou `too_soon` (baixou e
 * levantou antes do intervalo: nada entrou na fila).
 */
export type CallStateMessage = { type: 'call.state'; state: 'waiting'; reason: CallReason } | { type: 'call.state'; state: 'seen' } | { type: 'call.state'; state: 'too_soon' }

/** Resposta do mestre ao chamado: um recado SÓ para quem chamou. */
export interface CallReplyMessage {
  type: 'call.reply'
  id: string
  text: string
}

export type HostErrorReason = 'bad_code' | 'invalid_message' | 'not_joined' | 'already_joined'

export type HostMessage =
  // `name`: nome EFETIVO na sala, que pode não ser o que o jogador digitou.
  | { type: 'welcome'; playerId: string; resumeToken: string; name: string }
  | { type: 'lobby.waiting' }
  | { type: 'snapshot'; rev: number; map: MapData; vision: RegionPoint[][]; explored: ExploredWire; ownTokens: string[]; concealed: RegionPoint[][] }
  | { type: 'delta'; rev: number; map: MapData; vision: RegionPoint[][]; explored: ExploredWire; ownTokens: string[]; concealed: RegionPoint[][] }
  | { type: 'token.move.accepted'; reqId: string; x: number; y: number }
  | { type: 'token.move.rejected'; reqId: string; reason: TokenMoveRejectionReason }
  | { type: 'signal'; x: number; y: number; from: string; color: string }
  | { type: 'door.toggle.rejected'; wallId: string; reason: DoorToggleRejection }
  | { type: 'door.request.rejected'; wallId: string; reason: DoorRequestRejection }
  | { type: 'door.request.answer'; answer: DoorRequestAnswer }
  | { type: 'pin.travel.rejected'; reason: PinTravelRejection }
  | { type: 'pin.travel.denied' }
  // `by: 'master'`: o mestre levou o jogador sem pedido ("Mandar para…" do
  // painel Grupo). Aditivo: jogador antigo ignora o campo e lê "Você chegou".
  // `by: 'gather'`: também sem pedido, mas pelo "Reunir o grupo aqui" de um
  // pino — o aviso diz que o GRUPO foi reunido, e continua sem dizer onde.
  | { type: 'scene.changed'; by?: 'master' | 'gather' }
  | LaserMessage
  | SceneNoteMessage
  | ScenePausedMessage
  | PartyUpdateMessage
  | CallStateMessage
  | CallReplyMessage
  | { type: 'kicked' }
  | { type: 'room.closed' }
  | { type: 'error'; reason: HostErrorReason }
  // Resposta ao `ping` de quem está na sala: só "estou aqui", sem nada dentro.
  // É o que deixa o jogador notar a conexão morta que nunca fecha.
  | { type: 'pong' }

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
  if (text.length <= NOTE_MAX_LENGTH) return text
  const cut = text.slice(0, NOTE_MAX_LENGTH)
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
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
  // Só `true` marca: qualquer outro valor é recado comum, sem faixa.
  return value.onlyYou === true ? { type: 'scene.note', id, text, onlyYou: true } : { type: 'scene.note', id, text }
}

/**
 * Valida o `party.update` que o jogador recebe. Os nomes vão para a tela:
 * qualquer membro malformado (nome vazio ou acima do teto, `where` fora dos
 * três) recusa a lista inteira em vez de mostrar metade do grupo. Devolve
 * cópia só com os campos conhecidos: um `sceneId` que viesse junto não passa.
 */
export function parsePartyUpdate(value: unknown): PartyUpdateMessage | null {
  if (!isRecord(value) || value.type !== 'party.update') return null
  const { members } = value
  if (!Array.isArray(members) || members.length > PARTY_MAX_MEMBERS) return null
  const parsed: PartyMember[] = []
  for (const member of members) {
    if (!isRecord(member)) return null
    const { playerId, name, where } = member
    if (!isBoundedString(playerId, 1, REQ_ID_MAX_LENGTH)) return null
    if (!isBoundedString(name, NAME_MIN_LENGTH, NAME_MAX_LENGTH + PARTY_NAME_SUFFIX_MAX)) return null
    if (where !== 'aqui' && where !== 'longe' && where !== 'fora') return null
    parsed.push({ playerId, name, where })
  }
  return { type: 'party.update', members: parsed }
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
    case 'call.raise':
      return parseCallRaise(value)
    case 'call.lower':
      return { type: 'call.lower' }
    default:
      return null
  }
}

export function isCallReason(value: unknown): value is CallReason {
  return typeof value === 'string' && CALL_REASONS.some((reason) => reason === value)
}

/**
 * Chamado do jogador. O texto é opcional e sai aparado; em branco vale "sem
 * texto". Acima do teto recusa a mensagem inteira: cortar mudaria o que o
 * jogador escreveu sem ele saber.
 */
function parseCallRaise(obj: Record<string, unknown>): CallRaiseMessage | null {
  const { reason, text } = obj
  if (!isCallReason(reason)) return null
  if (text === undefined) return { type: 'call.raise', reason }
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (trimmed.length > CALL_TEXT_MAX_LENGTH) return null
  return trimmed.length === 0 ? { type: 'call.raise', reason } : { type: 'call.raise', reason, text: trimmed }
}

/** Valida o `call.reply` que o jogador recebe: mesma regra do recado por cena. */
export function parseCallReply(value: unknown): CallReplyMessage | null {
  if (!isRecord(value) || value.type !== 'call.reply') return null
  const { id, text } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(text, 1, NOTE_MAX_LENGTH)) return null
  return { type: 'call.reply', id, text }
}
