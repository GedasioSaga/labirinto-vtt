import type { HazardKind, MapData, RegionPoint } from '../types/map'
import type { PlayerHazard } from '../lib/hazards'
import type { ExploredWire } from '../lib/exploration'
import type { TokenMoveRejection } from '../lib/moveValidation'
import { LASER_MAX_POINTS_PER_MESSAGE } from '../lib/laser'
import { isTokenPhotoData } from '../lib/tokenPhoto'
import { ROOM_TEXT_MAX_LENGTH } from '../lib/roomText'
import { isPlayerSafePinImage } from '../lib/pins'
import { CLUEBOOK_MAX_CLUES, CLUE_TEXT_MAX_LENGTH, CLUE_TITLE_MAX_LENGTH } from '../lib/clues'

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
 * O LASER DO JOGADOR também é aditivo: `laser` (jogador -> mestre, mesma forma
 * do laser do mestre) e, na volta a quem está na mesma cena, `laser` com
 * `from` + `color`. Mestre antigo responde `error invalid_message`, que o
 * jogador ignora durante o jogo.
 *
 * `room.text` (mestre -> jogador) é o TEXTO DA SALA, aditivo pelo mesmo
 * critério: na primeira vez que a ficha do jogador entra numa Sala com texto,
 * só ele recebe o id da Sala, o nome como ele pode ver ('' quando oculto) e o
 * texto. A nota do mestre nunca viaja.
 *
 * O CADERNO DE RECADOS é aditivo pelo mesmo critério: `scene.note.at` (a hora
 * do mestre, em ms) e `notes.book` (mestre -> jogador), a lista dos recados
 * que AQUELE jogador já recebeu, mandada quando ele entra ou volta. Jogador
 * antigo ignora os dois; mestre antigo não manda `at` e o jogador anota a hora
 * da chegada.
 *
 * MINHAS PISTAS é aditivo pelo mesmo critério. Do jogador: `clue.read` (abriu o
 * cartão de um pino), `clue.peers` (quem está na cena comigo?) e `clue.show`
 * (mostrar uma pista a um colega pelo nome). Do mestre: `clue.added`,
 * `clues.book` (o caderno inteiro, na entrada), `clue.shown` (um colega
 * mostrou), `clue.peers` (os nomes) e `clue.show.result`. A pista leva título,
 * texto, foto `data:image/` e hora, com um id que o HOST inventa: nunca a
 * posição, o id do pino ou o nome/id da cena. Mestre antigo responde
 * `error invalid_message` (que o jogador ignora durante o jogo); jogador
 * antigo ignora as cinco.
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
/**
 * Maior mensagem, em BYTES, que o servidor da mesa aceita de um jogador —
 * espelho de `MAX_MESSAGE_BYTES` em desktop/src-tauri/src/net/server.rs. Acima
 * disso o servidor fecha o socket: o jogador cai da mesa. O cliente do jogador
 * nunca envia nada maior (player/playerConnection.ts).
 */
export const PLAYER_MESSAGE_MAX_BYTES = 64 * 1024
/** Quantos recados o caderno de cada jogador guarda (no host e na tela dele). Passou, sai o mais antigo. */
export const NOTEBOOK_MAX_NOTES = 50
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

/**
 * LASER DO JOGADOR: a mesma forma do laser do mestre (lote de pontos em px de
 * mundo, ou `off` ao soltar). Nada de nome nem cor: quem é o host sabe pela
 * conexão, e a cor é a da ficha — o jogador não pode se passar por outro.
 */
export type PlayerLaserMessage = LaserMessage

/**
 * O jogador abriu o cartão do pino `pinId`: guarde a pista no caderno dele. O
 * host só aceita pino que saiu no último recorte da cena onde ele está, e
 * monta a pista a partir DESSE recorte — nunca do texto que o jogador mandasse.
 */
export interface ClueReadMessage {
  type: 'clue.read'
  pinId: string
}

/** "Mostrar para…": quem joga na mesma cena agora? A resposta é `clue.peers` com os nomes. */
export interface CluePeersRequestMessage {
  type: 'clue.peers'
}

/** Mostrar a pista `clueId` (do caderno de quem pede) ao colega de nome `to`. */
export interface ClueShowMessage {
  type: 'clue.show'
  clueId: string
  to: string
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
  | PlayerLaserMessage
  | ClueReadMessage
  | CluePeersRequestMessage
  | ClueShowMessage

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

/**
 * Laser de um JOGADOR repassado pelo host a quem está na mesma cena: `from` é
 * o nome dele na sala (único, igual ao `from` do sinal) e `color` a cor da
 * ficha dele. Aditivo: jogador antigo ignora os dois campos e desenha o rastro
 * como se fosse o do mestre.
 */
export type RelayedLaserMessage = LaserMessage & { from: string; color: string }

/** Recado do mestre a quem está numa cena. `id` novo = recado novo (substitui o que estiver aberto). */
export interface SceneNoteMessage {
  type: 'scene.note'
  id: string
  text: string
  /** Hora em que o mestre mandou (ms desde 1970, relógio do mestre). Ausente em mestre antigo. */
  at?: number
}

/** Um recado guardado no caderno do jogador. Nada da cena: só o que ele leu e quando. */
export interface NoteEntry {
  id: string
  text: string
  at: number
}

/** O caderno inteiro do jogador, do mais antigo ao mais novo, mandado quando ele entra ou volta. */
export interface NotebookMessage {
  type: 'notes.book'
  notes: NoteEntry[]
}

/** Texto da Sala na primeira entrada: `id` é o da `Region` (já vai no snapshot), `title` o nome que o jogador pode ver. */
export interface RoomTextMessage {
  type: 'room.text'
  id: string
  title: string
  text: string
}

/**
 * Uma pista no caderno do jogador. `id` é do HOST (não é o do pino nem o da
 * Sala). `from`: o colega que mostrou; ausente = o próprio jogador leu.
 */
export interface ClueEntry {
  id: string
  title: string
  /** Pode vir vazio: cartão só com foto. */
  text: string
  /** Só `data:image/...`; `null` = sem foto. */
  image: string | null
  at: number
  from?: string
}

/** A pista que o host acabou de guardar para este jogador (nova, ou lida de novo). */
export interface ClueAddedMessage {
  type: 'clue.added'
  clue: ClueEntry
}

/** O caderno de pistas inteiro, da mais antiga à mais nova, mandado quando o jogador entra ou volta. */
export interface CluebookMessage {
  type: 'clues.book'
  clues: ClueEntry[]
}

/** Um colega da mesma cena mostrou uma pista. Ela já está no caderno de quem recebe. */
export interface ClueShownMessage {
  type: 'clue.shown'
  from: string
  clue: ClueEntry
}

/** Os colegas que jogam na mesma cena agora, pelo nome na sala. */
export interface CluePeersMessage {
  type: 'clue.peers'
  names: string[]
}

/**
 * Por que a pista não saiu, quando o motivo não conta nada sobre onde o colega
 * está: `too_soon` = outra pista saiu há menos de 1 s (o colega está na cena;
 * é só tocar de novo). Ausente = "não chegou", sem dizer por quê.
 */
export type ClueShowRefusal = 'too_soon'

/** A pista chegou (`ok`) ou não ao colega `to` — ele saiu da cena, da sala, ou a pista não era de quem pediu. */
export interface ClueShowResultMessage {
  type: 'clue.show.result'
  to: string
  ok: boolean
  /** Só em `ok: false`, e só com motivo que não revela a cena. Mestre antigo não manda. */
  reason?: ClueShowRefusal
}

export type ClueHostMessage = ClueAddedMessage | CluebookMessage | ClueShownMessage | CluePeersMessage | ClueShowResultMessage

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
  // `unheard`: só no eco de quem sinalizou, e só quando nenhum outro jogador recebeu (o eco sai tracejado).
  | { type: 'signal'; x: number; y: number; from: string; color: string; unheard?: true }
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
  | RelayedLaserMessage
  | SceneNoteMessage
  | RoomTextMessage
  | NotebookMessage
  | ClueHostMessage
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
  const { id, text, at } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(text, 1, NOTE_MAX_LENGTH)) return null
  if (at === undefined) return { type: 'scene.note', id, text }
  // Presente e fora da forma recusa inteiro, como o resto: hora torta no caderno é pior que recado nenhum.
  if (!isNoteTime(at)) return null
  return { type: 'scene.note', id, text, at }
}

function isNoteTime(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function parseNoteEntry(value: unknown): NoteEntry | null {
  if (!isRecord(value)) return null
  const { id, text, at } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH) || !isBoundedString(text, 1, NOTE_MAX_LENGTH) || !isNoteTime(at)) return null
  return { id, text, at }
}

/**
 * Valida o caderno que o jogador recebe. Até `NOTEBOOK_MAX_NOTES` itens, cada
 * um com id, texto dentro do teto e hora; um item ruim recusa a mensagem
 * inteira (não mostra caderno pela metade). Devolve cópia só com os campos
 * conhecidos.
 */
export function parseNotebook(value: unknown): NotebookMessage | null {
  if (!isRecord(value) || value.type !== 'notes.book') return null
  const { notes } = value
  if (!Array.isArray(notes) || notes.length > NOTEBOOK_MAX_NOTES) return null
  const parsed: NoteEntry[] = []
  for (const item of notes) {
    const entry = parseNoteEntry(item)
    if (entry === null) return null
    parsed.push(entry)
  }
  return { type: 'notes.book', notes: parsed }
}

/** Folga para o sufixo que o host põe em nome repetido ("Ana (2)", ver `uniqueName`). */
const NAME_SUFFIX_ROOM = 8

/** Nome de jogador como o host o manda (com o sufixo de nome repetido). */
function isRoomName(value: unknown): value is string {
  return isBoundedString(value, NAME_MIN_LENGTH, NAME_MAX_LENGTH + NAME_SUFFIX_ROOM)
}

/** Teto da lista de colegas: bem acima de uma mesa real, abaixo de um host hostil inflando a tela. */
const CLUE_PEERS_MAX = 64

function parseClueEntry(value: unknown): ClueEntry | null {
  if (!isRecord(value)) return null
  const { id, title, text, image, at, from } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(title, 1, CLUE_TITLE_MAX_LENGTH)) return null
  if (!isBoundedString(text, 0, CLUE_TEXT_MAX_LENGTH)) return null
  // Fronteira de segurança: só foto embutida. Caminho de disco, `http://` e
  // `file://` recusam a pista inteira — o `<img>` do jogador não abre nada disso.
  let photo: string | null = null
  if (image !== null) {
    if (typeof image !== 'string' || !isPlayerSafePinImage(image)) return null
    photo = image
  }
  if (!isNoteTime(at)) return null
  const entry: ClueEntry = { id, title, text, image: photo, at }
  if (from === undefined) return entry
  if (!isRoomName(from)) return null
  return { ...entry, from }
}

/**
 * Valida as mensagens de MINHAS PISTAS que o jogador recebe. Mesma regra do
 * caderno de recados: forma errada, pista ruim ou lista acima do teto recusam
 * a mensagem inteira. Devolve cópia só com os campos conhecidos — posição, id
 * de pino ou de cena que viessem juntos ficam para trás.
 */
export function parseClueMessage(value: unknown): ClueHostMessage | null {
  if (!isRecord(value)) return null
  switch (value.type) {
    case 'clue.added': {
      const clue = parseClueEntry(value.clue)
      return clue === null ? null : { type: 'clue.added', clue }
    }
    case 'clues.book': {
      const { clues } = value
      if (!Array.isArray(clues) || clues.length > CLUEBOOK_MAX_CLUES) return null
      const parsed: ClueEntry[] = []
      for (const item of clues) {
        const clue = parseClueEntry(item)
        if (clue === null) return null
        parsed.push(clue)
      }
      return { type: 'clues.book', clues: parsed }
    }
    case 'clue.shown': {
      const { from } = value
      const clue = parseClueEntry(value.clue)
      if (clue === null || !isRoomName(from)) return null
      return { type: 'clue.shown', from, clue }
    }
    case 'clue.peers': {
      const { names } = value
      if (!Array.isArray(names) || names.length > CLUE_PEERS_MAX) return null
      const parsed: string[] = []
      for (const name of names) {
        if (!isRoomName(name)) return null
        parsed.push(name)
      }
      return { type: 'clue.peers', names: parsed }
    }
    case 'clue.show.result': {
      const { to, ok, reason } = value
      if (!isRoomName(to) || typeof ok !== 'boolean' || (reason !== undefined && typeof reason !== 'string')) return null
      // Motivo que este jogador não conhece (mestre mais novo) vira a recusa comum.
      return !ok && reason === 'too_soon' ? { type: 'clue.show.result', to, ok, reason } : { type: 'clue.show.result', to, ok }
    }
    default:
      return null
  }
}

/** Cor do laser repassado: `#rrggbb`, a forma que `Token.color` grava. */
const LASER_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

/**
 * Valida o `room.text` que o jogador recebe. Mesma regra do recado: forma
 * errada, texto vazio ou acima do teto recusam a mensagem inteira. O título
 * pode vir vazio (nome da Sala oculto do jogador).
 */
export function parseRoomText(value: unknown): RoomTextMessage | null {
  if (!isRecord(value) || value.type !== 'room.text') return null
  const { id, title, text } = value
  if (!isBoundedString(id, 1, REQ_ID_MAX_LENGTH)) return null
  if (!isBoundedString(title, 0, ROOM_TEXT_MAX_LENGTH)) return null
  if (!isBoundedString(text, 1, ROOM_TEXT_MAX_LENGTH)) return null
  return { type: 'room.text', id, title, text }
}

/**
 * O corpo do laser, nos dois sentidos: `off: true` ou 1 a
 * `LASER_MAX_POINTS_PER_MESSAGE` pontos finitos. Devolve cópia só com `x`/`y`.
 */
function parseLaserBody(value: Record<string, unknown>): LaserMessage | null {
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
 * Valida a mensagem `laser` que o jogador recebe (objeto já desserializado).
 * Sem `from` nem `color` é o laser do mestre; com os dois, o de outro jogador
 * (`RelayedLaserMessage`). Um só dos dois, nome fora do teto ou cor fora de
 * `#rrggbb` recusam a mensagem inteira — a cor vai direto para o desenho.
 */
export function parseLaserMessage(value: unknown): LaserMessage | RelayedLaserMessage | null {
  if (!isRecord(value) || value.type !== 'laser') return null
  const body = parseLaserBody(value)
  if (body === null) return null
  const { from, color } = value
  if (from === undefined && color === undefined) return body
  if (!isBoundedString(from, NAME_MIN_LENGTH, NAME_MAX_LENGTH + NAME_SUFFIX_ROOM)) return null
  if (typeof color !== 'string' || !LASER_COLOR_PATTERN.test(color)) return null
  return { ...body, from, color }
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
    case 'laser':
      // Só o corpo: `from`/`color` mandados pelo jogador são jogados fora — o
      // nome e a cor quem põe é o host, pela conexão e pela ficha dele.
      return parseLaserBody(value)
    case 'clue.read':
      return isBoundedString(value.pinId, 1, REQ_ID_MAX_LENGTH) ? { type: 'clue.read', pinId: value.pinId } : null
    case 'clue.peers':
      return { type: 'clue.peers' }
    case 'clue.show':
      return isBoundedString(value.clueId, 1, REQ_ID_MAX_LENGTH) && isRoomName(value.to) ? { type: 'clue.show', clueId: value.clueId, to: value.to } : null
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
