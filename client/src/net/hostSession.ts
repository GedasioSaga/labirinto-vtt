import type { DoorState, MapData, Pin, RegionPoint, Token, Wall } from '../types/map'
import { createExploration, encodeExploration, forgetInside, isPointExplored, markAll, markRings, type Exploration } from '../lib/exploration'
import { pointInRing } from '../lib/floorContour'
import { filterMapForPlayer, playerBlockedRings } from '../lib/fogFilter'
import { validateTokenMove } from '../lib/moveValidation'
import { tokenReachesDoor } from '../lib/doorReach'
import { SIGNAL_MIN_INTERVAL_MS, signalColor } from '../lib/signals'
import { arrivalSpot, arrivalSpotWithoutPin, exitLabelsOf, freeSeatNear, isArrivalOnly, resolvePinTravel, SAIDA_PRINCIPAL, travelExitOf, type TravelScene } from '../lib/pinTravel'
import { passageOf, pinSummary } from '../lib/pins'
import { visibleTokens } from '../lib/layers'
import { companionSpots, companionsNear, type Companion } from '../lib/travelTogether'
import {
  MAX_PENDING_POINT_ACTIONS_PER_PLAYER,
  POINT_ACTION_MIN_INTERVAL_MS,
  isPointInsideMap,
  roomNameAt,
  type PointActionAnswer,
  type PointActionKind,
} from '../lib/pointActions'
import {
  parsePlayerMessage,
  type CallRaiseMessage,
  type CallReason,
  type DoorRequestHow,
  type DoorRequestMessage,
  type DoorRequestRejection,
  type DoorToggleMessage,
  type DoorToggleRejection,
  type HostMessage,
  type JoinMessage,
  type LaserMessage,
  type PartyMember,
  type PartyWhere,
  type PinTravelRejection,
  type PinTravelRequestMessage,
  type PointActionMessage,
  type SignalMessage,
  type TokenEditMessage,
  type TokenMoveMessage,
} from './protocol'
import { clampNoteText } from './protocol'

/**
 * Sessão do mestre, lógica pura: não envia nada. Cada método devolve as
 * mensagens a enviar e o integrador (transporte + mapStore) as despacha.
 * Identidade: `clientId` é a conexão (troca a cada reconexão); `playerId` é o
 * jogador (estável, recuperável pelo `resumeToken`).
 *
 * CADA JOGADOR NO SEU MAPA. Com aventura aberta, o host serve a cada jogador a
 * cena onde está o token DELE (`sceneFor`), e não a cena aberta no editor: o
 * grupo pode se separar. Quem não tem token em cena nenhuma — e todo mundo
 * num mapa solto — continua vendo a cena aberta, como sempre.
 */

/**
 * Uma cena que o host serve. `sceneId` é o id da cena na aventura (`null` =
 * mapa solto). `name` é o nome que o MESTRE lê: nunca vai ao jogador.
 */
export interface HostScene {
  sceneId: string | null
  name: string
  map: MapData
}

/**
 * Tudo o que o host pode servir: a cena ABERTA no editor e as de FUNDO da
 * aventura que abriram (cache do `adventureStore`). Mapa solto = só a aberta.
 */
export interface HostWorld {
  open: HostScene
  background: HostScene[]
}

/** De onde a sessão lê o mapa: um `MapData` (mapa solto, o de sempre) ou o mundo da aventura. */
export type HostMapSource = MapData | HostWorld

/** O mapa solto como mundo: uma cena só, a aberta. */
export function singleSceneWorld(map: MapData): HostWorld {
  return { open: { sceneId: null, name: map.name, map }, background: [] }
}

// `open` e não `background`: `MapData` já tem um campo `background` (a imagem de fundo).
function toWorld(source: HostMapSource): HostWorld {
  return 'open' in source ? source : singleSceneWorld(source)
}

/**
 * CHAVE DE CENA = `MapData.id`, e não o id da cena na aventura. O id do mapa
 * mora no próprio arquivo da cena e não muda quando o mapa solto vira a
 * primeira cena de uma aventura (`createScene`) — com o id da cena, a memória
 * de exploração de quem já jogava ali se apagaria no meio da mesa.
 */
function sceneKey(scene: HostScene): string {
  return scene.map.id
}

function allScenes(world: HostWorld): HostScene[] {
  return [world.open, ...world.background]
}

export type PlayerStatus = 'waiting' | 'playing'

export interface Outbound {
  clientId: string
  msg: HostMessage
}

/*
 * `sceneId` nos três "Applied" abaixo: a cena de FUNDO onde aplicar, quando o
 * jogador está numa cena que não é a aberta no editor. Ausente = a cena
 * aberta (o `mapStore`), como sempre foi.
 */
export interface AppliedMove {
  tokenId: string
  x: number
  y: number
  sceneId?: string
}

/** Porta que o jogador abriu/fechou: o integrador aplica no mapa do mestre. */
export interface AppliedDoor {
  wallId: string
  open: boolean
  sceneId?: string
  /** O mestre disse "Destrancar e abrir" ao pedido da porta trancada: tira o cadeado antes de abrir. */
  unlock?: true
}

/**
 * Pedido da porta trancada, já validado, à espera do mestre. É o que a linha
 * da caixa de Pedidos mostra; nada disto vai ao jogador.
 */
export interface DoorRequest {
  requestId: string
  playerId: string
  playerName: string
  how: DoorRequestHow
  /** Nome da cena (o que o mestre lê), só quando a porta está numa cena de FUNDO. */
  sceneName?: string
}

/**
 * Nome/foto novos do token, já validados: o token existe e é DO jogador que
 * pediu. Campo ausente = não mexe naquele dado.
 */
export interface AppliedTokenEdit {
  tokenId: string
  name?: string
  image?: string | null
  sceneId?: string
}

/**
 * Pedido de passagem já validado, à espera do mestre. É o que o aviso dele
 * mostra: quem, por qual pino e para qual cena. Nada disto vai ao jogador.
 */
export interface TravelRequest {
  requestId: string
  playerId: string
  playerName: string
  /** Como o mestre chama o pino: a descrição dele ou, sem descrição, o resumo. */
  pinLabel: string
  toSceneId: string
  toSceneName: string
}

/**
 * O mestre deixou ir: tirar `tokenId` da cena `fromSceneId` e pô-lo em
 * (`x`, `y`) da cena `toSceneId`, no pino par. Quem aplica é o integrador
 * (`adventureStore.transferToken`), fora do desfazer das duas cenas.
 */
export interface AppliedTransfer {
  tokenId: string
  playerId: string
  playerName: string
  fromSceneId: string
  toSceneId: string
  toSceneName: string
  x: number
  y: number
}

/** Sinal aceito de um jogador, para a UI do mestre desenhar. */
export interface HostSignal {
  playerId: string
  name: string
  color: string
  x: number
  y: number
  /**
   * A cena de FUNDO de onde o sinal veio (`sceneId` e o nome que o mestre
   * lê). Ausente = a cena aberta no editor. O (`x`, `y`) é daquela cena:
   * desenhado no mapa aberto, viraria um ping falso no lugar errado — quem
   * recebe mostra o aviso "chamou em" no lugar do ping.
   */
  background?: { sceneId: string; name: string }
}

/**
 * Chamado de um jogador ("chamar o mestre"), como o MESTRE o lê. Nada disto
 * vai a outro jogador: quem chamou só recebe o estado da própria mão.
 */
export interface MasterCall {
  callId: string
  playerId: string
  playerName: string
  reason: CallReason
  /** Texto curto do jogador; ausente = só o motivo. */
  text?: string
}

/** Onde o "Ir lá" do chamado leva o editor: a cena de quem chamou (`null` = mapa solto) e a ficha dele. */
export interface CallTarget {
  sceneId: string | null
  x: number
  y: number
}

/**
 * AÇÃO NO PONTO aceita, à espera do mestre. É o que a linha da Caixa mostra
 * ("Fabi quer Procurar — Ferreiro") e o que o "Ir lá" usa. Nada disto vai ao
 * jogador: a sala é lida no mapa do MESTRE, secreta ou não.
 */
export interface PointActionRequest {
  requestId: string
  playerId: string
  playerName: string
  /** Mesma cor do sinal do jogador: o ponto marcado pelo "Ir lá" é dele. */
  color: string
  action: PointActionKind
  x: number
  y: number
  /** A sala mais de dentro que contém o ponto; `null` = fora de sala com nome. */
  roomName: string | null
  /** Cena do ponto (`null` = mapa solto) e o nome que o mestre lê. */
  sceneId: string | null
  sceneName: string
  /** `true` quando a cena do ponto não é a aberta no editor. */
  background: boolean
}

export interface HostResult {
  outbound: Outbound[]
  /** Chamado NOVO na fila: o integrador mostra a linha e toca o bipe. Repetição do mesmo chamado não vem. */
  call?: MasterCall
  applyMove?: AppliedMove
  applyDoor?: AppliedDoor
  applyTokenEdit?: AppliedTokenEdit
  signal?: HostSignal
  /** Ação no ponto aceita: o integrador põe a linha na Caixa do mestre. */
  pointAction?: PointActionRequest
  /** Pedido de passagem válido: o integrador pergunta ao mestre. */
  travelRequest?: TravelRequest
  /** Pedido da porta trancada válido: o integrador pergunta ao mestre. */
  doorRequest?: DoorRequest
  /**
   * O mestre deixou ir, ou o pino é livre (aí vem de `handleMessage`): o
   * integrador move o token entre as cenas ANTES de despachar `outbound`.
   */
  applyTransfer?: AppliedTransfer
}

export interface PlayerInfo {
  clientId: string | null
  playerId: string
  name: string
  status: PlayerStatus
  connected: boolean
  tokenIds: string[]
  /** Raio efetivo: o do mestre para este jogador ou, sem ajuste, o global. */
  visionRadius: number
  /** Cena em que o jogador está, para o painel do mestre. Só com aventura aberta e jogador jogando. */
  sceneName?: string
  /** Id da mesma cena de `sceneName`: é por ele que o "Ir lá" do painel Grupo abre a cena. */
  sceneId?: string
  /**
   * `true` enquanto um pedido de passagem dele espera o mestre. Ausente no
   * resto do tempo: é o que põe o selo "pedido" na cena dele, na lista Cenas.
   */
  travelPending?: true
}

/** O que foi feito do recado para um jogador: saiu agora, ficou guardado para a volta dele, ou nada (`null`). */
export type PlayerNoteDelivery = 'sent' | 'queued' | null

/** Faixa do "Raio de visão" por jogador, em px de mundo. */
export const VISION_RADIUS_MIN = 50
export const VISION_RADIUS_MAX = 2000
export const VISION_RADIUS_STEP = 50

/** Um pedido de porta por jogador nesta janela; o excesso morre em silêncio (igual ao sinal). */
export const DOOR_TOGGLE_MIN_INTERVAL_MS = 250

/**
 * Uma FOTO nova por jogador nesta janela. Só a foto: ela é o único campo caro
 * de `token.edit` (centenas de KB), e trocar o nome é texto de 32 caracteres —
 * estrangular os dois juntos faria o jogador que digita o nome e escolhe a
 * foto no mesmo gesto perder um dos dois em silêncio.
 */
export const TOKEN_PHOTO_MIN_INTERVAL_MS = 500

/**
 * Um pedido de passagem pelo MESMO pino, do mesmo jogador, nesta janela. O
 * mestre recusou e o jogador insiste no toque: sem o intervalo, cada toque
 * seria um aviso novo empilhado na tela do mestre. Por jogador e por pino, e
 * não por pino só: o grupo inteiro pedindo a mesma escada é jogo normal.
 */
export const TRAVEL_REQUEST_MIN_INTERVAL_MS = 3000

/**
 * Um pedido de passagem por jogador nesta janela, de QUALQUER pino. É o
 * limite que vem antes de tudo: barato, de tamanho fixo por jogador, e segura
 * quem troca de pino (ou de conexão) a cada toque.
 */
export const TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS = 1500

/**
 * Quantas cenas cada jogador lembra (exploração e portas vistas). Passou do
 * teto, esquece a cena visitada há mais tempo: memória de host não pode
 * crescer sem limite numa aventura longa.
 */
export const MAX_SCENE_MEMORIES_PER_PLAYER = 8

/**
 * Um chamado NOVO por jogador nesta janela. Com a mão levantada ele já não
 * empilha (um chamado aberto por jogador); o intervalo segura quem baixa e
 * levanta a mão em série — cada chamado novo é um bipe na mesa do mestre.
 */
export const CALL_MIN_INTERVAL_MS = 3000

export interface HostSessionOptions {
  code: string
  visionRadius: number
  now?: () => number
  randomId?: () => string
}

export interface HostSession {
  handleMessage(clientId: string, raw: unknown, source: HostMapSource): HostResult
  /** Devolve `lobby.waiting` para quem perdeu o último token (dono anterior). */
  assignToken(playerId: string, tokenId: string): HostResult
  /** Devolve `lobby.waiting` se o jogador ficou sem token. */
  unassignToken(playerId: string, tokenId: string): HostResult
  disconnect(clientId: string): void
  kick(clientId: string): HostResult
  /**
   * `room.closed` para todo jogador conectado (jogando ou aguardando). O
   * integrador envia isto ANTES de derrubar a sala, para o jogador ler "O
   * mestre encerrou a sala" e não "A conexão caiu". Não mexe no estado.
   */
  closeRoom(): HostResult
  /** Snapshot para todo jogador conectado e jogando, cada um da cena ONDE ELE ESTÁ. */
  broadcast(source: HostMapSource): HostResult
  /**
   * Laser do mestre para todo jogador conectado e jogando (quem aguarda não
   * tem mapa onde desenhar). Com `source`, só para quem está na cena aberta —
   * o mestre aponta no mapa que ele vê.
   */
  laser(message: LaserMessage, source?: HostMapSource): HostResult
  /**
   * RECADO POR CENA: `scene.note` só para quem joga e está AGORA na cena
   * `sceneId` (`sceneFor`). O texto sai cortado no teto (`NOTE_MAX_LENGTH`);
   * vazio não sai. Quem entra ou reconecta depois não recebe recado antigo:
   * nada fica guardado. `outbound.length` é quantos receberam.
   *
   * `recipients` (RECADO PARA ESCOLHIDOS): só esses jogadores, e só se ainda
   * estiverem na cena — a lista do mestre pode ter ficado velha. Lista vazia =
   * ninguém. O pacote de quem recebe é o mesmo: não diz quem mais leu.
   */
  sceneNote(sceneId: string, text: string, source: HostMapSource, recipients?: readonly string[]): HostResult
  /**
   * PAUSA POR CENA: o mestre atende um grupo de cada vez. Com `sceneId`
   * pausada, quem está nela não move a ficha, não pede porta nem passagem —
   * laser e sinal continuam, para o jogador poder chamar o mestre. As ações
   * do MESTRE ("Mandar para…", reunir, "Deixar ir") seguem valendo. Vive só
   * na sessão: fechar a sala esquece. Devolve `scene.paused` a quem mudou.
   */
  setScenePaused(sceneId: string, paused: boolean, source: HostMapSource): HostResult
  isScenePaused(sceneId: string): boolean
  /**
   * RECADO PARA UM JOGADOR SÓ ("Recado" da linha dele no Grupo): `scene.note`
   * com `onlyYou`, só para a conexão DELE — quem está na mesma sala não recebe
   * nem o frame. Está com o mapa na tela: sai agora (`sent`). Caiu, ou está sem
   * ficha: fica guardado (só o último) e sai logo depois do próximo mapa dele
   * (`queued`). Texto vazio ou jogador desconhecido: nada (`null`).
   */
  playerNote(playerId: string, text: string, source: HostMapSource): HostResult & { delivery: PlayerNoteDelivery }
  /**
   * "Deixar ir": revalida o pedido contra o mundo de AGORA (o token pode ter
   * andado, o pino sumido) e devolve `applyTransfer` + `scene.changed` ao
   * dono. Pedido que já não existe (jogador saiu, já decidido) não faz nada.
   */
  approveTravel(requestId: string, source: HostMapSource): HostResult
  /** "Não": `pin.travel.denied` ao jogador. Pedido que já não existe não faz nada. */
  denyTravel(requestId: string): HostResult
  /** O pedido ainda espera o mestre? `false` depois de decidido, ou quando o jogador saiu. */
  isTravelPending(requestId: string): boolean
  /**
   * Quem iria junto se o mestre deixasse AGORA (`playerId`s): jogadores
   * jogando e conectados, na mesma cena, com ficha a até `NEAR_SQUARES` casas
   * da ficha de quem pediu (`lib/travelTogether.ts`). Pedido que já não vale: nenhum.
   */
  travelCompanions(requestId: string, source: HostMapSource): string[]
  /**
   * "Deixar ir com quem está perto": aprova o pedido (a revalidação do
   * `approveTravel`, que vem primeiro no resultado) e, só se ele passou, leva
   * junto quem está perto NESTE instante — quem andou para longe desde o aviso
   * fica. Cada companheiro é um resultado à parte, com `applyTransfer` numa
   * casa livre em volta do pino par e o mesmo `scene.changed` de quem pediu
   * ("Você chegou"). O pedido pendente de um companheiro é resolvido junto.
   * Pedido que já não existe: lista vazia.
   */
  approveTravelTogether(requestId: string, source: HostMapSource): HostResult[]
  /**
   * "Destrancar e abrir" do pedido da porta trancada: `applyDoor` (com
   * `unlock`) na cena onde a porta está — mesmo de fundo — e
   * `door.request.answer opened` ao jogador. Não exige mais o token perto: é
   * decisão do mestre. Pedido que já não existe, ou porta que sumiu, não faz nada.
   */
  approveDoorRequest(requestId: string, source: HostMapSource): HostResult
  /** "Não": `door.request.answer denied` ao jogador. Pedido que já não existe não faz nada. */
  denyDoorRequest(requestId: string): HostResult
  /** O pedido da porta ainda espera o mestre? `false` depois de decidido, ou quando o jogador saiu. */
  isDoorRequestPending(requestId: string): boolean
  /**
   * "Nada aqui" (`nothing`) ou "Feito" (`seen`) da ação no ponto: a resposta
   * vai SÓ à conexão atual de quem pediu. Pedido já respondido, de jogador
   * expulso, ou jogador sem conexão agora: nada sai.
   */
  answerPointAction(requestId: string, answer: PointActionAnswer): HostResult
  /** A ação no ponto ainda espera o mestre? `false` depois de respondida ou com o jogador expulso. */
  isPointActionPending(requestId: string): boolean
  /**
   * "Mandar para…" do painel Grupo: o MESTRE leva o jogador, sem pedido, para
   * `toSceneId` — no pino de viagem `pinId` daquela cena ou, com `null`, no
   * centro dela. Devolve o mesmo par da aprovação (`applyTransfer` +
   * `scene.changed`, este marcado `by: 'master'`). Destino inválido, jogador
   * sem ficha em cena ou já na cena de destino: nada.
   *
   * `gatherAt` é o "Reunir o grupo aqui": a ficha chega nessa casa (já
   * escolhida livre por `lib/gatherParty.ts`), `pinId` é ignorado e o aviso
   * sai como `by: 'gather'`.
   */
  sendPlayer(playerId: string, toSceneId: string, pinId: string | null, source: HostMapSource, gatherAt?: { x: number; y: number }): HostResult
  /**
   * "Desfazer" do diário de viagens: devolve a ficha `tokenId` do jogador à
   * cena `back.sceneId`, na casa (`back.x`, `back.y`) de onde ela saiu. Mesmo
   * par do "Mandar para…" (`applyTransfer` + `scene.changed` `by: 'master'`,
   * só ao dono). Nada: jogador desconhecido ou esperando, ficha que não é
   * dele ou que não está na cena em que ele está, cena de volta sumida ou a
   * mesma cena.
   */
  returnPlayer(playerId: string, tokenId: string, back: { sceneId: string; x: number; y: number }, source: HostMapSource): HostResult
  /**
   * Raio de visão só deste jogador (limitado à faixa); `null` volta ao global.
   * Não envia: o integrador faz o broadcast. Jogador desconhecido ou raio não finito é ignorado.
   */
  setVisionRadius(playerId: string, radius: number | null): void
  /** Marca a planta inteira da cena onde o jogador está como explorada, fora de zona oculta ativa. Tokens seguem exigindo visão. */
  revealPlan(playerId: string, source: HostMapSource): void
  /**
   * Zera exploração e portas lembradas do jogador; a visão atual volta a
   * marcar no próximo broadcast. Com `source`, só da cena onde ele está; sem,
   * de todas.
   */
  hidePlan(playerId: string, source?: HostMapSource): void
  /** Com `source` de uma aventura, cada jogador que joga vem com o nome da cena onde está. */
  listPlayers(source?: HostMapSource): PlayerInfo[]
  /**
   * COMPANHEIROS: `party.update` para cada jogador conectado cuja lista MUDOU
   * desde o último envio àquela conexão. A lista é dele: os outros jogadores,
   * cada um 'aqui' (mesma cena), 'longe' (outra cena, ou ainda sem ficha) ou
   * 'fora' (desconectado). Nunca vai id nem nome de cena. Seguro chamar a cada
   * evento: sem mudança, `outbound` sai vazio.
   */
  partyUpdates(source: HostMapSource): HostResult
  /**
   * Quantas entradas os limites do pedido de passagem guardam agora (por
   * jogador + por jogador/cena/pino). Diagnóstico: é o número que um cliente
   * hostil tentaria inflar mandando ids de pino inventados.
   */
  travelLimitEntries(): number
  /** Chamados abertos: Urgente primeiro, o resto na ordem de chegada. */
  listCalls(): MasterCall[]
  /** O chamado ainda espera o mestre? `false` depois de Visto/Responder, de baixar a mão ou de o jogador sair. */
  isCallOpen(callId: string): boolean
  /** "Visto": fecha o chamado e apaga a mão SÓ de quem chamou. Chamado que já não existe: nada. */
  seeCall(callId: string): HostResult
  /**
   * "Responder": o recado vai SÓ a quem chamou (cortado no teto do recado) e
   * fecha o chamado. Texto em branco não sai, e o chamado continua aberto.
   */
  replyCall(callId: string, text: string): HostResult
  /** A cena e a ficha de quem chamou, para o "Ir lá". `null` sem chamado ou sem ficha em cena. */
  callTarget(callId: string, source: HostMapSource): CallTarget | null
  readonly rev: number
}

/** Chamado aberto. Um por jogador. */
interface OpenCall {
  callId: string
  playerId: string
  reason: CallReason
  text?: string
  /** Ordem de chegada: um contador, não o relógio (dois no mesmo milissegundo ficam na ordem certa). */
  seq: number
}

/** Pedido de passagem à espera do mestre. Um por jogador. */
interface PendingTravel {
  requestId: string
  playerId: string
  pinId: string
  /** A saída que o jogador escolheu (a principal quando o pedido não disse). */
  exitId: string
  /** O destino do aviso que o mestre leu. Religou a saída depois? A aprovação não vale. */
  toSceneId: string
  partnerId: string
}

/** Pedido da porta trancada à espera do mestre. Um por jogador. `mapId`: a `sceneKey` da cena da porta. */
interface PendingDoor {
  requestId: string
  playerId: string
  wallId: string
  mapId: string
}

/** Pedido que passou em tudo: de onde, para onde, por qual pino e com qual token. */
interface ValidTravel {
  from: HostScene & { sceneId: string }
  to: HostScene & { sceneId: string }
  pin: Pin
  partner: Pin
  token: Token
}

/** O que um jogador lembra de um mapa: células exploradas e último estado visto de cada porta. */
interface PlayerMemory {
  key: string
  exp: Exploration
  doors: Map<string, DoorState>
  /** Visão enviada no último snapshot: é o que o jogador está vendo agora na tela. */
  vision: RegionPoint[][]
}

/** Chave de comparação do nome: sem maiúsculas e sem espaços. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '')
}

function memoryKey(map: MapData): string {
  return `${map.id}|${map.width}|${map.height}|${map.grid}`
}

interface PlayerRecord {
  playerId: string
  name: string
  resumeToken: string
  clientId: string | null
  joinedAt: number
}

export function createHostSession(options: HostSessionOptions): HostSession {
  const now = options.now ?? Date.now
  const randomId = options.randomId ?? (() => crypto.randomUUID())
  const players = new Map<string, PlayerRecord>() // playerId -> registro
  const byClient = new Map<string, string>() // clientId conectado -> playerId
  const ownership: Record<string, string[]> = {}
  // Por playerId (não clientId): sobrevive a reconexão/resume; só o kick apaga.
  // Dentro, uma memória por CENA (chave `sceneKey`), na ordem do último uso:
  // a primeira é a menos recente, a que sai quando passa do teto.
  // `doors`: último estado de cada porta que o jogador VIU (por id da parede).
  const memories = new Map<string, Map<string, PlayerMemory>>()
  // Por playerId: a cena em que o jogador foi visto por último. Desempata
  // quando ele tem token em mais de uma cena — sem isto, o mestre trocar a
  // cena do editor mudaria a cena do jogador junto.
  const currentScene = new Map<string, string>()
  // Por playerId: o pedido de passagem que espera o mestre (no máximo um).
  const pendingTravels = new Map<string, PendingTravel>()
  // Por `playerId|cena|pino`: quando o jogador pediu por último aquele pino.
  // Só entra pino que existe na cena dele (ver `handleTravelRequest`).
  const lastTravelRequestAt = new Map<string, number>()
  // Por playerId: o último pedido de passagem, de qualquer pino. Sobrevive ao
  // disconnect; só o kick apaga.
  const lastTravelRequestByPlayer = new Map<string, number>()
  // Por playerId: reconectar não zera o limite de 1 sinal por segundo. Guarda
  // também o ponto e se os colegas já receberam, para o "Sinalizar" do menu
  // estender aos colegas o sinal que o toque longo mandou só ao mestre.
  const lastSignal = new Map<string, { at: number; x: number; y: number; relayed: boolean }>()
  // Por playerId: mesmo limite para o pedido de abrir/fechar porta.
  const lastDoorToggleAt = new Map<string, number>()
  // Por playerId: o pedido da porta trancada que espera o mestre (no máximo um).
  const pendingDoors = new Map<string, PendingDoor>()
  // Por playerId: o mesmo limite do toque, para o pedido da porta trancada.
  const lastDoorRequestAt = new Map<string, number>()
  // Por playerId: limite da foto nova do próprio token (só da foto, ver TOKEN_PHOTO_MIN_INTERVAL_MS).
  const lastTokenPhotoAt = new Map<string, number>()
  // Por playerId: ajuste do mestre sobre `options.visionRadius`; só o kick apaga.
  const visionOverrides = new Map<string, number>()
  // Ids das cenas pausadas pelo mestre. Não vai para o arquivo do mapa: é
  // estado da mesa de hoje, não da aventura.
  const pausedScenes = new Set<string>()
  // Por clientId: o último `scene.paused` mandado (ausente = nada, que o
  // jogador lê como "não pausada"). Por conexão, e não por jogador: quem
  // reconecta abre tela nova, sem o aviso, e precisa receber de novo.
  const pausedSent = new Map<string, boolean>()
  // Por clientId: a última lista de companheiros enviada àquela conexão (JSON).
  // Por conexão, e não por jogador: quem reconecta tem tela nova e precisa da
  // lista de novo, mesmo que nada tenha mudado para ele.
  const lastPartySent = new Map<string, string>()
  // Por playerId: o recado só para ele que ainda não chegou (estava fora). Só o
  // último: o cartão do jogador mostra um recado por vez. Sai com o próximo mapa dele.
  const pendingNotes = new Map<string, { id: string; text: string }>()
  // Por playerId: o chamado aberto dele (no máximo um).
  const openCalls = new Map<string, OpenCall>()
  // Por playerId: quando o último chamado NOVO dele entrou. Sobrevive ao disconnect; só o kick apaga.
  const lastCallAt = new Map<string, number>()
  let callSeq = 0
  // Por requestId: ações no ponto à espera do mestre. Sobrevivem à queda da
  // conexão (o mestre ainda quer ler "procuro armadilha aqui"); só a resposta
  // e o kick apagam.
  const pendingPointActions = new Map<string, { playerId: string; action: PointActionKind }>()
  // Por playerId: último pedido de ação no ponto aceito pelo intervalo mínimo.
  const lastPointActionAt = new Map<string, number>()
  let rev = 0

  const radiusFor = (playerId: string): number => visionOverrides.get(playerId) ?? options.visionRadius

  /** Polígonos das zonas ocultas ativas (`?? []`: mapa montado fora do deserializeMap pode vir sem o campo). */
  const statusOf = (playerId: string): PlayerStatus => ((ownership[playerId]?.length ?? 0) > 0 ? 'playing' : 'waiting')

  /** Memória que o jogador já tem deste mapa, sem criar. Mesmo id redimensionado não conta: é outro mapa. */
  const existingMemory = (playerId: string, map: MapData): PlayerMemory | undefined => {
    const memory = memories.get(playerId)?.get(map.id)
    return memory !== undefined && memory.key === memoryKey(map) ? memory : undefined
  }

  /**
   * Memória do jogador para este mapa. Cada cena tem a sua: ir à Cripta e
   * voltar ao Salão devolve o Salão como ele o deixou. Mapa novo (ou mesmo id
   * redimensionado) começa do zero; acima de `MAX_SCENE_MEMORIES_PER_PLAYER`
   * cenas, a usada há mais tempo é esquecida.
   */
  const memoryFor = (playerId: string, map: MapData): PlayerMemory => {
    let byScene = memories.get(playerId)
    if (byScene === undefined) {
      byScene = new Map()
      memories.set(playerId, byScene)
    }
    const found = existingMemory(playerId, map)
    // MapData.width/height estão em células; o explorado mede px de mundo (mesma unidade da visão).
    const memory: PlayerMemory = found ?? {
      key: memoryKey(map),
      exp: createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid }),
      doors: new Map(),
      vision: [],
    }
    // Apagar e regravar põe a cena no fim da ordem: é a mais recente agora.
    byScene.delete(map.id)
    byScene.set(map.id, memory)
    for (const oldest of byScene.keys()) {
      if (byScene.size <= MAX_SCENE_MEMORIES_PER_PLAYER) break
      byScene.delete(oldest)
    }
    return memory
  }

  const ownsTokenIn = (playerId: string, scene: HostScene): boolean => {
    const owned = ownership[playerId] ?? []
    return owned.length > 0 && scene.map.tokens.some((t) => owned.includes(t.id))
  }

  /**
   * A cena deste jogador: a que tem o token dele. Com token em mais de uma,
   * fica na última em que ele foi visto. No mapa solto, sem token, a cena
   * aberta — o que todo jogador sempre viu.
   *
   * `null` = COM AVENTURA, o jogador não tem token em cena nenhuma (o mestre
   * apagou a ficha dele, ou ela está numa cena que não abriu). Ele NÃO cai na
   * cena do editor: seria entregar a ele um lugar onde ele não está (nome,
   * planta, a memória dele de lá, o laser do mestre). Quem chama trata como
   * espera — o mesmo "Aguardando o mestre" do lobby.
   */
  const sceneFor = (playerId: string, world: HostWorld): HostScene | null => {
    const scenes = allScenes(world)
    const last = currentScene.get(playerId)
    const stay = last === undefined ? undefined : scenes.find((scene) => sceneKey(scene) === last && ownsTokenIn(playerId, scene))
    if (stay !== undefined) return stay
    const found = scenes.find((scene) => ownsTokenIn(playerId, scene))
    if (found === undefined) return world.open.sceneId === null ? world.open : null
    currentScene.set(playerId, sceneKey(found))
    return found
  }

  /** O que o jogador vê agora: o recorte da cena dele, ou a espera quando ele não está em cena nenhuma. */
  const viewFor = (playerId: string, world: HostWorld): HostMessage => {
    const scene = sceneFor(playerId, world)
    return scene === null ? { type: 'lobby.waiting' } : snapshotFor(playerId, scene.map)
  }

  /** A cena do jogador está pausada? Mapa solto (`sceneId` nulo) e jogador sem cena nunca estão. */
  const inPausedScene = (scene: HostScene | null): boolean => scene !== null && scene.sceneId !== null && pausedScenes.has(scene.sceneId)

  /**
   * `scene.paused` para esta conexão, só se mudou desde o último envio. É o
   * que cobre entrar, pausar, despausar e trocar de cena com uma regra só:
   * quem troca de cena recebe o snapshot da cena nova pelo broadcast, e o
   * broadcast passa por aqui.
   */
  const pausedUpdate = (clientId: string, playerId: string, world: HostWorld): Outbound[] => {
    const paused = statusOf(playerId) === 'playing' && inPausedScene(sceneFor(playerId, world))
    if ((pausedSent.get(clientId) ?? false) === paused) return []
    pausedSent.set(clientId, paused)
    return [{ clientId, msg: { type: 'scene.paused', paused } }]
  }

  /**
   * `view` e, logo atrás, o recado guardado para ele — só quando `view` é mapa:
   * o jogador só mostra recado com o mapa na tela. Entregue, sai da fila.
   */
  const viewWithPendingNote = (clientId: string, playerId: string, view: HostMessage): Outbound[] => {
    const out: Outbound[] = [{ clientId, msg: view }]
    const note = pendingNotes.get(playerId)
    if (note === undefined || view.type !== 'snapshot') return out
    pendingNotes.delete(playerId)
    out.push({ clientId, msg: { type: 'scene.note', id: note.id, text: note.text, onlyYou: true } })
    return out
  }

  /** `sceneId` para os "Applied": só quando a cena é de fundo (a aberta é o `mapStore`). */
  const backgroundSceneId = (scene: HostScene, world: HostWorld): { sceneId?: string } =>
    scene === world.open || scene.sceneId === null ? {} : { sceneId: scene.sceneId }

  /**
   * Nunca manda o mapa do host: sempre o recorte de `filterMapForPlayer`. O
   * filtro usa o explorado e as portas lembradas de antes desta visão (a visão
   * atual já entra por si); a marcação vem depois e segue junto para o jogador
   * desenhar a névoa.
   */
  const snapshotFor = (playerId: string, map: MapData): HostMessage => {
    const memory = memoryFor(playerId, map)
    const exp = memory.exp
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId), exp, memory.doors)
    // Zona oculta ativa e sala secreta: célula que toca nelas não vira explorada
    // (senão o jogador guardaria a planta escondida e o formato dela).
    markRings(exp, view.vision, view.blocked)
    // TETO DE CONSTRUÇÃO: o teto não entra em `view.blocked` (o contorno do
    // prédio não é segredo, e o veto de lá joga fora o anel de visão inteiro,
    // apagando a memória do jogador longe do prédio). O veto do teto é só a
    // grade de células, e é aqui: apaga o que está DENTRO do prédio, inclusive
    // o que o jogador percorreu enquanto o teto estava aberto. Sem esta linha o
    // `explored` que viaja abaixo continuaria desenhando o caminho dele lá
    // dentro depois que ele sai.
    forgetInside(exp, view.roofs)
    memory.vision = view.vision
    const seenNow = new Set(view.visibleDoorIds)
    for (const w of view.map.walls) {
      if (w.door !== null && seenNow.has(w.id)) memory.doors.set(w.id, { ...w.door })
    }
    const sent = new Set(view.map.tokens.map((t) => t.id))
    const ownTokens = (ownership[playerId] ?? []).filter((id) => sent.has(id))
    return { type: 'snapshot', rev, map: view.map, vision: view.vision, explored: encodeExploration(exp), ownTokens, concealed: view.concealed }
  }

  const reply = (clientId: string, msg: HostMessage): HostResult => ({ outbound: [{ clientId, msg }] })

  /** Jogador que jogava e ficou sem token volta ao lobby; desconectado recebe o estado no resume. */
  const waitingIfLostLast = (playerId: string, wasPlaying: boolean): Outbound[] => {
    const clientId = players.get(playerId)?.clientId ?? null // registro ausente = jogador expulso: não há a quem avisar
    if (!wasPlaying || statusOf(playerId) === 'playing' || clientId === null) return []
    return [{ clientId, msg: { type: 'lobby.waiting' } }]
  }

  /**
   * O nome vai no `from` do sinal: nome igual ao de OUTRO jogador (sem
   * maiúsculas nem espaços) ganha ' (2)', ' (3)'... O próprio jogador (resume)
   * não conflita consigo.
   */
  const uniqueName = (wanted: string, playerId: string): string => {
    const taken = new Set([...players.values()].filter((p) => p.playerId !== playerId).map((p) => normalizeName(p.name)))
    if (!taken.has(normalizeName(wanted))) return wanted
    let n = 2
    while (taken.has(normalizeName(`${wanted} (${n})`))) n += 1
    return `${wanted} (${n})`
  }

  function handleJoin(clientId: string, msg: JoinMessage, world: HostWorld): HostResult {
    if (byClient.has(clientId)) return reply(clientId, { type: 'error', reason: 'already_joined' })
    if (msg.code !== options.code) return reply(clientId, { type: 'error', reason: 'bad_code' })

    const resumed = msg.resume === undefined ? undefined : [...players.values()].find((p) => p.resumeToken === msg.resume)
    const record: PlayerRecord = resumed ?? {
      playerId: randomId(),
      name: msg.name,
      resumeToken: randomId(),
      clientId: null,
      joinedAt: now(),
    }
    // Reassumir derruba o vínculo com a conexão antiga, se ainda existir.
    if (record.clientId !== null) byClient.delete(record.clientId)
    record.clientId = clientId
    record.name = uniqueName(msg.name, record.playerId)
    players.set(record.playerId, record)
    byClient.set(clientId, record.playerId)

    // `name` é o nome já passado por `uniqueName`: é assim que o jogador
    // descobre que entrou como "Ana (2)" em vez da "Ana" que digitou.
    const welcome: HostMessage = { type: 'welcome', playerId: record.playerId, resumeToken: record.resumeToken, name: record.name }
    const next: HostMessage = statusOf(record.playerId) === 'playing' ? viewFor(record.playerId, world) : { type: 'lobby.waiting' }
    // Quem volta de uma queda recebe o recado que o mestre mandou enquanto ele estava fora.
    // Depois do mapa: quem entra (ou volta) numa cena pausada já chega lendo o aviso.
    return {
      outbound: [
        { clientId, msg: welcome },
        ...viewWithPendingNote(clientId, record.playerId, next),
        ...pausedUpdate(clientId, record.playerId, world),
      ],
    }
  }

  function handleMove(clientId: string, msg: TokenMoveMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    // O movimento vale na cena DELE: token de outra cena é `unknown_token` aqui.
    const scene = sceneFor(playerId, world)
    // Sem cena (aventura aberta, ficha em lugar nenhum): não há onde mover.
    if (scene === null) return reply(clientId, { type: 'token.move.rejected', reqId: msg.reqId, reason: 'unknown_token' })
    // Cena pausada: a mesma recusa de sempre, e a ficha volta ao lugar na tela dele.
    if (inPausedScene(scene)) return reply(clientId, { type: 'token.move.rejected', reqId: msg.reqId, reason: 'paused' })
    const result = validateTokenMove(scene.map, { playerId, tokenId: msg.tokenId, x: msg.x, y: msg.y }, ownership)
    if (!result.ok) return reply(clientId, { type: 'token.move.rejected', reqId: msg.reqId, reason: result.reason })
    return {
      outbound: [{ clientId, msg: { type: 'token.move.accepted', reqId: msg.reqId, x: result.x, y: result.y } }],
      applyMove: { tokenId: msg.tokenId, x: result.x, y: result.y, ...backgroundSceneId(scene, world) },
    }
  }

  /** O jogador já conhece o ponto: está na visão do último snapshot ou numa célula explorada deste mapa. */
  const knowsPoint = (playerId: string, map: MapData, point: RegionPoint): boolean => {
    const memory = existingMemory(playerId, map)
    if (memory === undefined) return false
    return memory.vision.some((ring) => ring.length >= 3 && pointInRing(point, ring)) || isPointExplored(memory.exp, point)
  }

  /**
   * O repasse do sinal aos colegas: só quem joga na mesma cena e já conhece o
   * ponto, e nunca ponto em zona oculta ativa ou sala secreta — senão o sinal
   * diria que existe algo naquele lugar.
   */
  function relaySignalToColleagues(playerId: string, scene: HostScene, message: HostMessage, point: RegionPoint, world: HostWorld): Outbound[] {
    const map = scene.map
    // Sala secreta vale como zona oculta: repassar o sinal diria aos outros que ali existe algo.
    if (playerBlockedRings(map).some((ring) => ring.length >= 3 && pointInRing(point, ring))) return []
    const outbound: Outbound[] = []
    for (const [otherClient, otherId] of byClient) {
      if (otherId === playerId || statusOf(otherId) !== 'playing') continue
      // Quem está em outra cena não recebe: o ponto é deste mapa, e a
      // memória antiga dele desta cena diria que o sinal é para lá.
      if (sceneFor(otherId, world) !== scene) continue
      if (knowsPoint(otherId, map, point)) outbound.push({ clientId: otherClient, msg: message })
    }
    return outbound
  }

  /**
   * O mestre sempre recebe o sinal (campo `signal`) e quem sinalizou recebe o
   * eco. Os colegas recebem pela regra de `relaySignalToColleagues`, menos no
   * sinal `audience: 'master'` (o do toque longo, antes do menu).
   *
   * "Sinalizar" no menu depois do toque longo repete o MESMO ponto: a qualquer
   * tempo (dentro ou fora do intervalo mínimo), estende o sinal discreto aos
   * colegas, uma vez, sem novo ping nem bipe no mestre (ele já recebeu).
   *
   * Sinal fora do mapa, de quem não joga ou antes do intervalo mínimo é
   * descartado em silêncio (não é mensagem malformada).
   */
  function handleSignal(clientId: string, msg: SignalMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const record = players.get(playerId)
    if (record === undefined || statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    if (scene === null) return { outbound: [] }
    const map = scene.map
    if (msg.x < 0 || msg.y < 0 || msg.x > map.width * map.grid || msg.y > map.height * map.grid) return { outbound: [] }
    const point = { x: msg.x, y: msg.y }
    const color = signalColor(playerId)
    const message: HostMessage = { type: 'signal', x: msg.x, y: msg.y, from: record.name, color }
    const toColleagues = msg.audience !== 'master'
    const at = now()
    const last = lastSignal.get(playerId)
    // Estender não depende do relógio: o menu fica aberto o quanto a pessoa
    // leva para ler, e o ponto idêntico ao do gesto (px de mundo exato) é o
    // Sinalizar desse menu. Fora da janela, virar sinal novo pingaria o
    // mestre de novo pelo mesmo ponto.
    if (last !== undefined && toColleagues && !last.relayed && last.x === msg.x && last.y === msg.y) {
      last.relayed = true
      // O repasse conta no limite de 1 por segundo, para os colegas não receberem em rajada.
      last.at = at
      return { outbound: relaySignalToColleagues(playerId, scene, message, point, world) }
    }
    if (last !== undefined && at - last.at < SIGNAL_MIN_INTERVAL_MS) return { outbound: [] }
    lastSignal.set(playerId, { at, x: msg.x, y: msg.y, relayed: toColleagues })

    const outbound: Outbound[] = [{ clientId, msg: message }]
    if (toColleagues) outbound.push(...relaySignalToColleagues(playerId, scene, message, point, world))
    const signal: HostSignal = { playerId, name: record.name, color, x: msg.x, y: msg.y }
    // Mesma regra de `backgroundSceneId`: a cena aberta e o mapa solto não levam o campo.
    if (scene !== world.open && scene.sceneId !== null) signal.background = { sceneId: scene.sceneId, name: scene.name }
    return { outbound, signal }
  }

  /**
   * AÇÃO NO PONTO: o pedido vai SÓ ao mestre (campo `pointAction`). Nenhum
   * jogador recebe nada — nem quem está na mesma cena, nem quem pediu: o ponto
   * pode estar numa sala secreta, e o nome dela é leitura do mestre. De quem
   * não joga ou sem cena: descartado em silêncio, como o sinal. Fora do mapa
   * e os dois limites respondem ao jogador, para a tela dele não ficar
   * esperando um pedido que nunca chegou ao mestre.
   */
  function handlePointAction(clientId: string, msg: PointActionMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const record = players.get(playerId)
    if (record === undefined || statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    if (scene === null) return { outbound: [] }
    const map = scene.map
    // Fora do mapa responde: calado, a tela do jogador ficaria "esperando o
    // mestre" para sempre (a câmera dele arrasta além da borda).
    if (!isPointInsideMap(map, msg.x, msg.y)) return reply(clientId, { type: 'point.action.rejected', reason: 'out_of_map' })
    const at = now()
    const last = lastPointActionAt.get(playerId)
    if (last !== undefined && at - last < POINT_ACTION_MIN_INTERVAL_MS) return reply(clientId, { type: 'point.action.rejected', reason: 'too_soon' })
    const waiting = [...pendingPointActions.values()].filter((pending) => pending.playerId === playerId).length
    if (waiting >= MAX_PENDING_POINT_ACTIONS_PER_PLAYER) return reply(clientId, { type: 'point.action.rejected', reason: 'pending' })
    lastPointActionAt.set(playerId, at)

    const requestId = randomId()
    pendingPointActions.set(requestId, { playerId, action: msg.action })
    const point = { x: msg.x, y: msg.y }
    return {
      outbound: [],
      pointAction: {
        requestId,
        playerId,
        playerName: record.name,
        color: signalColor(playerId),
        action: msg.action,
        x: point.x,
        y: point.y,
        roomName: roomNameAt(map, point),
        sceneId: scene.sceneId,
        sceneName: scene.name,
        background: scene !== world.open && scene.sceneId !== null,
      },
    }
  }

  const forgetPointActionsOf = (playerId: string): void => {
    lastPointActionAt.delete(playerId)
    for (const [requestId, pending] of [...pendingPointActions]) {
      if (pending.playerId === playerId) pendingPointActions.delete(requestId)
    }
  }

  /**
   * Jogador abre ou fecha porta. Autoridade é aqui: a porta precisa existir,
   * estar VISÍVEL para ele agora (não só lembrada — senão abriria porta do
   * outro lado do mapa), estar DESTRANCADA (trancada é só do mestre) e ter um
   * token dele encostado (`tokenReachesDoor`). Recusa vira aviso curto na tela
   * do jogador; porta inexistente ou invisível responde o mesmo
   * `not_visible`, para não dizer o que existe no escuro.
   */
  /**
   * A porta `wallId` do mapa do MESTRE (com o cadeado real), só se o jogador a
   * vê AGORA — lembrada não conta, senão abriria porta do outro lado do mapa.
   * `near`: algum token dele, no recorte dele (respeita camada oculta e token
   * escondido pelo mestre), encosta nela. `null` = inexistente ou no escuro.
   */
  const doorSeenBy = (playerId: string, map: MapData, wallId: string): { wall: Wall; door: DoorState; near: boolean } | null => {
    const wall = map.walls.find((w) => w.id === wallId)
    if (wall === undefined || wall.door === null) return null
    const memory = memoryFor(playerId, map)
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId), memory.exp, memory.doors)
    if (!view.visibleDoorIds.includes(wall.id)) return null
    const owned = new Set(ownership[playerId] ?? [])
    const near = view.map.tokens.some((t) => owned.has(t.id) && tokenReachesDoor(t, wall, map.grid))
    return { wall, door: wall.door, near }
  }

  /** Limite de 1 pedido de porta por `DOOR_TOGGLE_MIN_INTERVAL_MS`: `false` = o excesso morre em silêncio. */
  const withinDoorLimit = (limits: Map<string, number>, playerId: string): boolean => {
    const at = now()
    const last = limits.get(playerId)
    if (last !== undefined && at - last < DOOR_TOGGLE_MIN_INTERVAL_MS) return false
    limits.set(playerId, at)
    return true
  }

  function handleDoorToggle(clientId: string, msg: DoorToggleMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    if (statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    // Cena pausada morre em silêncio: o aviso fixo da pausa já diz por quê, e
    // não gasta o intervalo da porta de quem vai tentar de novo depois.
    if (scene === null || inPausedScene(scene)) return { outbound: [] }
    if (!withinDoorLimit(lastDoorToggleAt, playerId)) return { outbound: [] }

    const reject = (reason: DoorToggleRejection): HostResult => reply(clientId, { type: 'door.toggle.rejected', wallId: msg.wallId, reason })

    const seen = doorSeenBy(playerId, scene.map, msg.wallId)
    if (seen === null) return reject('not_visible')
    // Trancada antes de longe: "Trancada" é a informação útil, e é dela que sai o pedido ao mestre.
    if (seen.door.locked) return reject('locked')
    if (!seen.near) return reject('far')

    return { outbound: [], applyDoor: { wallId: seen.wall.id, open: !seen.door.open, ...backgroundSceneId(scene, world) } }
  }

  /**
   * PORTA TRANCADA VIRA PEDIDO. Autoridade no molde de `handleDoorToggle`: a
   * porta existe, está VISÍVEL para ele agora, está TRANCADA e um token dele
   * encosta nela. Um pedido de porta por jogador: enquanto um espera o
   * mestre, os toques seguintes respondem `pending` e não viram outra linha.
   * O nome da cena vai só no `doorRequest`, que o mestre lê.
   */
  function handleDoorRequest(clientId: string, msg: DoorRequestMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const record = players.get(playerId)
    if (record === undefined || statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    // Cena pausada: o pedido morre em silêncio, como o toque na porta.
    if (scene === null || inPausedScene(scene)) return { outbound: [] }
    if (!withinDoorLimit(lastDoorRequestAt, playerId)) return { outbound: [] }

    const reject = (reason: DoorRequestRejection): HostResult => reply(clientId, { type: 'door.request.rejected', wallId: msg.wallId, reason })

    if (pendingDoors.has(playerId)) return reject('pending')
    const seen = doorSeenBy(playerId, scene.map, msg.wallId)
    if (seen === null) return reject('not_visible')
    if (!seen.door.locked) return reject('not_locked')
    if (!seen.near) return reject('far')

    const requestId = randomId()
    pendingDoors.set(playerId, { requestId, playerId, wallId: seen.wall.id, mapId: sceneKey(scene) })
    const request: DoorRequest = { requestId, playerId, playerName: record.name, how: msg.how }
    // Cena de fundo: o mestre lê onde é, porque está olhando outra.
    if (backgroundSceneId(scene, world).sceneId !== undefined) request.sceneName = scene.name
    return { outbound: [], doorRequest: request }
  }

  const findPendingDoor = (requestId: string): PendingDoor | undefined => [...pendingDoors.values()].find((pending) => pending.requestId === requestId)

  /**
   * Jogador troca o nome e a foto do PRÓPRIO token. A autoridade é aqui: o
   * token precisa existir no mapa do mestre E estar na posse DELE
   * (`ownership`) — sem essa checagem qualquer jogador renomearia o dragão do
   * mestre ou trocaria a cara do personagem do colega.
   *
   * Pedido de quem não é dono morre em silêncio, como o sinal fora do
   * intervalo: não é mensagem malformada (a forma é válida), é pedido que não
   * vale — responder "recusado" só ensinaria quais ids existem no mapa.
   */
  function handleTokenEdit(clientId: string, msg: TokenEditMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    if (statusOf(playerId) !== 'playing') return { outbound: [] }
    if (!(ownership[playerId] ?? []).includes(msg.tokenId)) return { outbound: [] }
    // O token pode estar em qualquer cena: a ficha é do jogador, não do mapa aberto.
    const scene = allScenes(world).find((s) => s.map.tokens.some((t) => t.id === msg.tokenId))
    if (scene === undefined) return { outbound: [] }
    if (msg.image !== undefined) {
      const at = now()
      const last = lastTokenPhotoAt.get(playerId)
      if (last !== undefined && at - last < TOKEN_PHOTO_MIN_INTERVAL_MS) return { outbound: [] }
      lastTokenPhotoAt.set(playerId, at)
    }
    return { outbound: [], applyTokenEdit: { tokenId: msg.tokenId, name: msg.name, image: msg.image, ...backgroundSceneId(scene, world) } }
  }

  /**
   * O pedido de passagem vale? Autoridade é aqui, no molde da porta
   * (`handleDoorToggle`): o pino existe NA CENA DO JOGADOR, está VISÍVEL para
   * ele agora (a mesma regra da névoa que decide mandar o pino no recorte —
   * sem isto, um id de pino adivinhado atravessaria o escuro), é de viagem e
   * está ligado em mão dupla a um par que existe numa cena aberta, e o
   * jogador tem token nesta cena. O token que viaja é o dele mais perto do
   * pino. Qualquer falha é `null`: quem chama responde o mesmo motivo
   * genérico para todas — inclusive `exitId` que não é saída DESTE pino
   * (inventado, ou de outro pino): o jogador não descobre que ela existe.
   */
  function validTravel(playerId: string, pinId: string, exitId: string, world: HostWorld): ValidTravel | null {
    const from = sceneFor(playerId, world)
    if (from === null || from.sceneId === null) return null
    const fromSceneId = from.sceneId
    const pin = from.map.pins.find((p) => p.id === pinId)
    if (pin === undefined) return null
    const memory = memoryFor(playerId, from.map)
    const view = filterMapForPlayer(from.map, playerId, ownership, radiusFor(playerId), memory.exp, memory.doors)
    if (!view.map.pins.some((p) => p.id === pinId)) return null
    // Trancada: ninguém passa. Cai no mesmo `null` de todo o resto, então o
    // jogador lê o motivo genérico de sempre e nada chega ao mestre. Estar aqui,
    // e não só no pedido, faz o "Deixar ir" de um pedido feito antes de trancar
    // recusar também.
    if (passageOf(pin) === 'trancada') return null
    // Chegada oculta (mão única) não leva de volta. O recorte já não a manda,
    // mas a recusa não depende da névoa: mesmo `null`, mesmo motivo genérico.
    if (isArrivalOnly(pin)) return null
    const scenes = allScenes(world)
    const lookup = (sceneId: string): TravelScene | null => {
      const scene = scenes.find((s) => s.sceneId === sceneId)
      return scene === undefined ? null : { name: scene.name, map: scene.map }
    }
    if (travelExitOf(pin, exitId) === null) return null
    const travel = resolvePinTravel(pin, fromSceneId, lookup, exitId)
    if (travel.status !== 'ligado') return null
    const to = scenes.find((s) => s.sceneId === travel.sceneId)
    if (to === undefined || to.sceneId === null) return null
    const owned = new Set(ownership[playerId] ?? [])
    // Tokens do recorte do jogador: respeita camada oculta e token escondido pelo mestre.
    const mine = view.map.tokens.filter((t) => owned.has(t.id))
    let token: Token | null = null
    for (const t of mine) {
      if (token === null || Math.hypot(t.x - pin.x, t.y - pin.y) < Math.hypot(token.x - pin.x, token.y - pin.y)) token = t
    }
    if (token === null) return null
    return { from: { ...from, sceneId: fromSceneId }, to: { ...to, sceneId: to.sceneId }, pin, partner: travel.partner, token }
  }

  function handleTravelRequest(clientId: string, msg: PinTravelRequestMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const record = players.get(playerId)
    const reject = (reason: PinTravelRejection): HostResult => reply(clientId, { type: 'pin.travel.rejected', reason })
    if (record === undefined || statusOf(playerId) !== 'playing') return reject('unavailable')
    if (pendingTravels.has(playerId)) return reject('pending')
    // Cena pausada: o motivo genérico de sempre, antes dos limites (tentar de
    // novo depois de despausar não pode esbarrar num "cedo demais").
    if (inPausedScene(sceneFor(playerId, world))) return reject('unavailable')
    // PRIMEIRO LIMITE, por jogador e para qualquer pino, ANTES de validar: o
    // recorte da névoa é a parte cara, e o mapa fica do tamanho do número de
    // jogadores — o id do pino vem do cliente e nunca vira chave aqui. Não
    // apaga no disconnect (como o sinal): reconectar não zera o limite.
    const at = now()
    const lastByPlayer = lastTravelRequestByPlayer.get(playerId)
    if (lastByPlayer !== undefined && at - lastByPlayer < TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS) return reject('too_soon')
    lastTravelRequestByPlayer.set(playerId, at)
    // SEGUNDO LIMITE, por pino, só para pino que EXISTE na cena do jogador:
    // o tamanho fica preso aos pinos de verdade, não ao que o cliente inventa.
    const scene = sceneFor(playerId, world)
    if (scene === null || !scene.map.pins.some((p) => p.id === msg.pinId)) return reject('unavailable')
    const limitKey = `${playerId}|${sceneKey(scene)}|${msg.pinId}`
    const last = lastTravelRequestAt.get(limitKey)
    if (last !== undefined && at - last < TRAVEL_REQUEST_MIN_INTERVAL_MS) return reject('too_soon')
    lastTravelRequestAt.set(limitKey, at)

    const exitId = msg.exitId ?? SAIDA_PRINCIPAL
    const travel = validTravel(playerId, msg.pinId, exitId, world)
    if (travel === null) return reject('unavailable')
    // Livre: passou em tudo que o pedido passaria (névoa, token na cena, pino
    // ligado, limites, nenhum pendente) e vai direto, sem esperar o mestre —
    // ele só lê o aviso de chegada que o integrador mostra com a transferência.
    if (passageOf(travel.pin) === 'livre') return transferResult(playerId, clientId, record.name, travel)
    const requestId = randomId()
    // O destino que o mestre LEU vai junto: é com ele que o "Deixar ir" confere.
    pendingTravels.set(playerId, { requestId, playerId, pinId: msg.pinId, exitId, toSceneId: travel.to.sceneId, partnerId: travel.partner.id })
    const description = travel.pin.description.trim()
    // Encruzilhada: o mestre lê a SAÍDA ("Escada da torre → Torre Alta"), o
    // mesmo rótulo que a jogadora tocou; pino de uma saída continua nomeado
    // pela descrição, como sempre.
    const saidas = exitLabelsOf(travel.pin)
    const saida = saidas.length > 1 ? saidas.find((s) => s.id === exitId) : undefined
    return {
      outbound: [],
      travelRequest: {
        requestId,
        playerId,
        playerName: record.name,
        pinLabel: saida !== undefined ? saida.rotulo : description === '' ? pinSummary(travel.pin) : description,
        toSceneId: travel.to.sceneId,
        toSceneName: travel.to.name,
      },
    }
  }

  /**
   * A passagem acontece: `scene.changed` ao dono e `applyTransfer` para o
   * integrador mover a ficha. Vale para o "Deixar ir" e para o pino livre.
   */
  function transferResult(playerId: string, clientId: string, playerName: string, travel: ValidTravel): HostResult {
    // Casa livre junto do par: quem passou antes pelo mesmo pino já está no
    // mapa (o integrador aplica cada passagem antes da próxima), então o
    // "Deixar todos" e o pino livre põem cada um numa casa.
    const spot = arrivalSpot(travel.to.map, travel.partner, travel.token.size, travel.token.id)
    // A cena dele passa a ser a de destino a partir daqui: é ela que o
    // próximo broadcast manda, com a memória que ele tem DELA.
    currentScene.set(playerId, sceneKey(travel.to))
    return {
      outbound: [{ clientId, msg: { type: 'scene.changed' } }],
      applyTransfer: {
        tokenId: travel.token.id,
        playerId,
        playerName,
        fromSceneId: travel.from.sceneId,
        toSceneId: travel.to.sceneId,
        toSceneName: travel.to.name,
        x: spot.x,
        y: spot.y,
      },
    }
  }

  const findPendingTravel = (requestId: string): PendingTravel | undefined =>
    [...pendingTravels.values()].find((pending) => pending.requestId === requestId)

  /** Apaga o que só vale enquanto o jogador está na sala: pedido pendente e limites do pedido. */
  const forgetTravelsOf = (playerId: string): void => {
    pendingTravels.delete(playerId)
    lastTravelRequestByPlayer.delete(playerId)
    for (const key of [...lastTravelRequestAt.keys()]) {
      if (key.startsWith(`${playerId}|`)) lastTravelRequestAt.delete(key)
    }
  }

  /**
   * Quem está perto da ficha que viajaria no pedido `pending`, contra o mundo
   * de agora. `null` quando o pedido em si não passa mais.
   */
  const companionsOf = (pending: PendingTravel, world: HostWorld): { travel: ValidTravel; near: Companion[] } | null => {
    const travel = validTravel(pending.playerId, pending.pinId, pending.exitId, world)
    if (travel === null) return null
    const fromMap = travel.from.map
    // A mesma regra da ficha de quem pediu (`validTravel`, pelo recorte): ficha
    // que o mestre escondeu, ou de camada oculta, não está no tabuleiro para
    // ninguém — não conta no "(N)" e não é levada para a outra cena.
    const onBoard = visibleTokens(fromMap.tokens, fromMap.hiddenLayers).filter((t) => t.hidden !== true)
    const candidates = [...players.values()].flatMap((record) => {
      if (record.playerId === pending.playerId || record.clientId === null || statusOf(record.playerId) !== 'playing') return []
      // A cena DELE, pela mesma regra do broadcast: ficha esquecida no Salão
      // de quem já está na Cripta não o faz viajar.
      if (sceneFor(record.playerId, world)?.sceneId !== travel.from.sceneId) return []
      const owned = new Set(ownership[record.playerId] ?? [])
      return [{ playerId: record.playerId, tokens: onBoard.filter((t) => owned.has(t.id)) }]
    })
    return { travel, near: companionsNear(travel.token, fromMap.grid, candidates) }
  }

  /** O chamado como o mestre lê: com o nome ATUAL do jogador. Registro ausente = já saiu. */
  const masterCallOf = (call: OpenCall): MasterCall | null => {
    const record = players.get(call.playerId)
    if (record === undefined) return null
    const result: MasterCall = { callId: call.callId, playerId: call.playerId, playerName: record.name, reason: call.reason }
    if (call.text !== undefined) result.text = call.text
    return result
  }

  const findOpenCall = (callId: string): OpenCall | undefined => [...openCalls.values()].find((call) => call.callId === callId)

  /**
   * Mão levantada. A resposta vai SÓ a quem chamou — é o estado da mão dele,
   * nada da fila. Com um chamado aberto, levantar de novo só confirma o que
   * já está na fila (mesmo motivo, mesma posição, sem bipe): cinco toques
   * não viram cinco linhas. Chamado novo antes de `CALL_MIN_INTERVAL_MS`
   * não entra, e o jogador lê que precisa esperar.
   */
  function handleCallRaise(clientId: string, msg: CallRaiseMessage): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const open = openCalls.get(playerId)
    if (open !== undefined) return reply(clientId, { type: 'call.state', state: 'waiting', reason: open.reason })
    const at = now()
    const last = lastCallAt.get(playerId)
    if (last !== undefined && at - last < CALL_MIN_INTERVAL_MS) return reply(clientId, { type: 'call.state', state: 'too_soon' })
    lastCallAt.set(playerId, at)
    callSeq += 1
    const call: OpenCall = { callId: randomId(), playerId, reason: msg.reason, seq: callSeq }
    if (msg.text !== undefined) call.text = msg.text
    openCalls.set(playerId, call)
    const master = masterCallOf(call)
    const result = reply(clientId, { type: 'call.state', state: 'waiting', reason: call.reason })
    return master === null ? result : { ...result, call: master }
  }

  /** Mão baixada: sai da fila. Nada volta ao jogador — a tela dele já apagou a mão. */
  function handleCallLower(clientId: string): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    openCalls.delete(playerId)
    return { outbound: [] }
  }

  const api: HostSession = {
    get rev() {
      return rev
    },

    handleMessage(clientId, raw, source) {
      const msg = parsePlayerMessage(raw)
      if (msg === null) return reply(clientId, { type: 'error', reason: 'invalid_message' })
      const world = toWorld(source)
      switch (msg.type) {
        case 'join':
          return handleJoin(clientId, msg, world)
        case 'token.move':
          return handleMove(clientId, msg, world)
        case 'ping':
          return { outbound: [] }
        case 'signal':
          return handleSignal(clientId, msg, world)
        case 'door.toggle':
          return handleDoorToggle(clientId, msg, world)
        case 'door.request':
          return handleDoorRequest(clientId, msg, world)
        case 'token.edit':
          return handleTokenEdit(clientId, msg, world)
        case 'pin.travel.request':
          return handleTravelRequest(clientId, msg, world)
        case 'call.raise':
          return handleCallRaise(clientId, msg)
        case 'call.lower':
          return handleCallLower(clientId)
        case 'point.action':
          return handlePointAction(clientId, msg, world)
      }
    },

    listCalls() {
      // Urgente no topo; dentro de cada faixa, quem chamou primeiro vem primeiro.
      const ordered = [...openCalls.values()].sort((a, b) => Number(b.reason === 'urgente') - Number(a.reason === 'urgente') || a.seq - b.seq)
      return ordered.map(masterCallOf).filter((call): call is MasterCall => call !== null)
    },

    isCallOpen(callId) {
      return findOpenCall(callId) !== undefined
    },

    seeCall(callId) {
      const call = findOpenCall(callId)
      if (call === undefined) return { outbound: [] }
      openCalls.delete(call.playerId)
      const clientId = players.get(call.playerId)?.clientId ?? null // null = caiu: não há a quem avisar
      return clientId === null ? { outbound: [] } : reply(clientId, { type: 'call.state', state: 'seen' })
    },

    replyCall(callId, text) {
      const call = findOpenCall(callId)
      if (call === undefined) return { outbound: [] }
      const clamped = clampNoteText(text.trim())
      if (clamped.length === 0) return { outbound: [] }
      openCalls.delete(call.playerId)
      const clientId = players.get(call.playerId)?.clientId ?? null // null = caiu: a resposta não tem para onde ir
      return clientId === null ? { outbound: [] } : reply(clientId, { type: 'call.reply', id: randomId(), text: clamped })
    },

    callTarget(callId, source) {
      const call = findOpenCall(callId)
      if (call === undefined) return null
      const scene = sceneFor(call.playerId, toWorld(source))
      if (scene === null) return null
      const owned = new Set(ownership[call.playerId] ?? [])
      const token = scene.map.tokens.find((t) => owned.has(t.id))
      return token === undefined ? null : { sceneId: scene.sceneId, x: token.x, y: token.y }
    },

    answerPointAction(requestId, answer) {
      const pending = pendingPointActions.get(requestId)
      if (pending === undefined) return { outbound: [] }
      pendingPointActions.delete(requestId)
      const clientId = players.get(pending.playerId)?.clientId ?? null // null = sem conexão agora: não há a quem avisar
      return clientId === null ? { outbound: [] } : reply(clientId, { type: 'point.action.answer', action: pending.action, answer })
    },

    isPointActionPending(requestId) {
      return pendingPointActions.has(requestId)
    },

    approveTravel(requestId, source) {
      const pending = findPendingTravel(requestId)
      if (pending === undefined) return { outbound: [] }
      pendingTravels.delete(pending.playerId)
      const record = players.get(pending.playerId)
      // Saiu da sala enquanto o mestre decidia: não há a quem mandar, e mover
      // o token de quem não está olhando seria uma surpresa na volta.
      if (record === undefined || record.clientId === null || statusOf(pending.playerId) !== 'playing') return { outbound: [] }
      const world = toWorld(source)
      const travel = validTravel(pending.playerId, pending.pinId, pending.exitId, world)
      // O mestre deixou ir para o lugar que o aviso DIZIA. Se a saída foi
      // religada depois (Torre no lugar da Cripta), ou desligada e outra subiu
      // no lugar dela, o consentimento não cobre o destino novo: recusa, e o
      // jogador pede de novo.
      const sameDestination = travel !== null && travel.to.sceneId === pending.toSceneId && travel.partner.id === pending.partnerId
      if (travel === null || !sameDestination) return reply(record.clientId, { type: 'pin.travel.rejected', reason: 'unavailable' })
      return transferResult(pending.playerId, record.clientId, record.name, travel)
    },

    denyTravel(requestId) {
      const pending = findPendingTravel(requestId)
      if (pending === undefined) return { outbound: [] }
      pendingTravels.delete(pending.playerId)
      const clientId = players.get(pending.playerId)?.clientId ?? null // null = saiu: não há a quem avisar
      return clientId === null ? { outbound: [] } : reply(clientId, { type: 'pin.travel.denied' })
    },

    travelLimitEntries() {
      return lastTravelRequestByPlayer.size + lastTravelRequestAt.size
    },

    isTravelPending(requestId) {
      return findPendingTravel(requestId) !== undefined
    },

    travelCompanions(requestId, source) {
      const pending = findPendingTravel(requestId)
      if (pending === undefined) return []
      return companionsOf(pending, toWorld(source))?.near.map((c) => c.playerId) ?? []
    },

    approveTravelTogether(requestId, source) {
      const pending = findPendingTravel(requestId)
      if (pending === undefined) return []
      // Conta ANTES de aprovar, com o mundo do clique: a aprovação muda a cena
      // de quem pediu, e a ficha dele é o centro da conta.
      const group = companionsOf(pending, toWorld(source))
      const lead = api.approveTravel(requestId, source)
      const arrival = lead.applyTransfer
      // Quem pediu não passou: ninguém vai "junto" de quem ficou.
      if (group === null || arrival === undefined) return [lead]
      const { travel, near } = group
      const leader = { x: arrival.x, y: arrival.y, size: travel.token.size }
      const spots = companionSpots(travel.to.map, travel.partner, leader, near.map((c) => c.token.size))
      const results: HostResult[] = [lead]
      near.forEach((companion, index) => {
        const spot = spots[index] ?? null
        const record = players.get(companion.playerId)
        // Não coube em volta do pino: fica onde está, com o pedido dele se tinha.
        if (spot === null || record === undefined || record.clientId === null) return
        currentScene.set(companion.playerId, sceneKey(travel.to))
        // O pedido que ele tinha (para esta escada ou outra) se resolve aqui: ele já foi.
        pendingTravels.delete(companion.playerId)
        results.push({
          // Sem `by`: para ele é a mesma chegada de quem pediu, "Você chegou".
          outbound: [{ clientId: record.clientId, msg: { type: 'scene.changed' } }],
          applyTransfer: {
            tokenId: companion.token.id,
            playerId: companion.playerId,
            playerName: record.name,
            fromSceneId: travel.from.sceneId,
            toSceneId: travel.to.sceneId,
            toSceneName: travel.to.name,
            x: spot.x,
            y: spot.y,
          },
        })
      })
      return results
    },

    approveDoorRequest(requestId, source) {
      const pending = findPendingDoor(requestId)
      if (pending === undefined) return { outbound: [] }
      pendingDoors.delete(pending.playerId)
      const clientId = players.get(pending.playerId)?.clientId ?? null
      const world = toWorld(source)
      // A cena da PORTA, não a do jogador agora nem a aberta no editor.
      const scene = allScenes(world).find((s) => sceneKey(s) === pending.mapId)
      const door = scene?.map.walls.find((w) => w.id === pending.wallId)?.door ?? null
      if (scene === undefined || door === null) return { outbound: [] }
      return {
        outbound: clientId === null ? [] : [{ clientId, msg: { type: 'door.request.answer', answer: 'opened' } }],
        applyDoor: { wallId: pending.wallId, open: true, unlock: true, ...backgroundSceneId(scene, world) },
      }
    },

    denyDoorRequest(requestId) {
      const pending = findPendingDoor(requestId)
      if (pending === undefined) return { outbound: [] }
      pendingDoors.delete(pending.playerId)
      const clientId = players.get(pending.playerId)?.clientId ?? null // null = saiu: não há a quem avisar
      return clientId === null ? { outbound: [] } : reply(clientId, { type: 'door.request.answer', answer: 'denied' })
    },

    isDoorRequestPending(requestId) {
      return findPendingDoor(requestId) !== undefined
    },

    sendPlayer(playerId, toSceneId, pinId, source, gatherAt) {
      const record = players.get(playerId)
      if (record === undefined || statusOf(playerId) !== 'playing') return { outbound: [] }
      const world = toWorld(source)
      const from = sceneFor(playerId, world)
      if (from === null || from.sceneId === null || from.sceneId === toSceneId) return { outbound: [] }
      const to = allScenes(world).find((scene) => scene.sceneId === toSceneId)
      if (to === undefined || to.sceneId === null) return { outbound: [] }
      // A primeira ficha dele NESTA cena, na ordem em que o mestre as deu:
      // quem tem duas fichas espalhadas não arrasta a outra cena junto.
      const owned = ownership[playerId] ?? []
      const token = owned.map((id) => from.map.tokens.find((t) => t.id === id)).find((t): t is Token => t !== undefined)
      if (token === undefined) return { outbound: [] }
      const pin = gatherAt !== undefined || pinId === null ? null : to.map.pins.find((p) => p.id === pinId && p.kind === 'viagem')
      // Pino que sumiu entre abrir o painel e confirmar: não chega em outro lugar calado.
      if (pin === undefined) return { outbound: [] }
      const spot = gatherAt ?? (pin === null ? arrivalSpotWithoutPin(to.map, token.size, token.id) : arrivalSpot(to.map, pin, token.size, token.id))
      currentScene.set(playerId, sceneKey(to))
      // O pedido que ele tinha na cena de antes perde o sentido: o pino ficou lá.
      pendingTravels.delete(playerId)
      const by = gatherAt === undefined ? 'master' : 'gather'
      return {
        outbound: record.clientId === null ? [] : [{ clientId: record.clientId, msg: { type: 'scene.changed', by } }],
        applyTransfer: {
          tokenId: token.id,
          playerId,
          playerName: record.name,
          fromSceneId: from.sceneId,
          toSceneId: to.sceneId,
          toSceneName: to.name,
          x: spot.x,
          y: spot.y,
        },
      }
    },

    returnPlayer(playerId, tokenId, back, source) {
      const record = players.get(playerId)
      if (record === undefined || statusOf(playerId) !== 'playing' || !(ownership[playerId] ?? []).includes(tokenId)) return { outbound: [] }
      const world = toWorld(source)
      const from = sceneFor(playerId, world)
      if (from === null || from.sceneId === null || from.sceneId === back.sceneId) return { outbound: [] }
      // A ficha tem de estar AGORA na cena dele: se saiu por outro caminho, o "Desfazer" é de uma viagem velha.
      const token = from.map.tokens.find((t) => t.id === tokenId)
      if (token === undefined) return { outbound: [] }
      const to = allScenes(world).find((scene) => scene.sceneId === back.sceneId)
      if (to === undefined || to.sceneId === null) return { outbound: [] }
      // Alguém parou na casa dela enquanto isso: volta ao lado, sem empilhar (a de baixo sumia).
      const spot = freeSeatNear(to.map, { x: back.x, y: back.y }, token.size, tokenId)
      currentScene.set(playerId, sceneKey(to))
      // O pedido que ele tinha na cena de antes perde o sentido: o pino ficou lá.
      pendingTravels.delete(playerId)
      return {
        outbound: record.clientId === null ? [] : [{ clientId: record.clientId, msg: { type: 'scene.changed', by: 'master' } }],
        applyTransfer: {
          tokenId,
          playerId,
          playerName: record.name,
          fromSceneId: from.sceneId,
          toSceneId: to.sceneId,
          toSceneName: to.name,
          x: spot.x,
          y: spot.y,
        },
      }
    },

    assignToken(playerId, tokenId) {
      const outbound: Outbound[] = []
      // Um token tem no máximo um dono: tira de quem tinha antes.
      for (const [owner, tokens] of Object.entries(ownership)) {
        if (owner === playerId) continue
        const wasPlaying = tokens.length > 0
        ownership[owner] = tokens.filter((t) => t !== tokenId)
        outbound.push(...waitingIfLostLast(owner, wasPlaying))
      }
      const current = ownership[playerId] ?? []
      if (!current.includes(tokenId)) ownership[playerId] = [...current, tokenId]
      return { outbound }
    },

    unassignToken(playerId, tokenId) {
      const current = ownership[playerId]
      if (current === undefined) return { outbound: [] }
      ownership[playerId] = current.filter((t) => t !== tokenId)
      return { outbound: waitingIfLostLast(playerId, current.length > 0) }
    },

    disconnect(clientId) {
      const playerId = byClient.get(clientId)
      if (playerId === undefined) return
      byClient.delete(clientId)
      pausedSent.delete(clientId)
      const record = players.get(playerId)
      if (record !== undefined) record.clientId = null // mantém o registro para permitir resume
      // O pedido pendente morre com a conexão: quem voltar não tem mais o
      // "Aguardando o mestre…" na tela, e o aviso do mestre fica inofensivo.
      pendingTravels.delete(playerId)
      // Mesmo para a porta: "Destrancar e abrir" depois da queda não abre nada.
      pendingDoors.delete(playerId)
      // A mão também: quem volta chega com a tela zerada, sem mão acesa.
      openCalls.delete(playerId)
    },

    kick(clientId) {
      const playerId = byClient.get(clientId)
      if (playerId === undefined) return { outbound: [] }
      byClient.delete(clientId)
      pausedSent.delete(clientId)
      players.delete(playerId) // invalida o resumeToken
      delete ownership[playerId]
      memories.delete(playerId)
      currentScene.delete(playerId)
      forgetTravelsOf(playerId)
      forgetPointActionsOf(playerId)
      lastSignal.delete(playerId)
      lastDoorToggleAt.delete(playerId)
      pendingDoors.delete(playerId)
      lastDoorRequestAt.delete(playerId)
      lastTokenPhotoAt.delete(playerId)
      visionOverrides.delete(playerId)
      pendingNotes.delete(playerId)
      openCalls.delete(playerId)
      lastCallAt.delete(playerId)
      return reply(clientId, { type: 'kicked' })
    },

    closeRoom() {
      const outbound: Outbound[] = []
      for (const clientId of byClient.keys()) {
        outbound.push({ clientId, msg: { type: 'room.closed' } })
      }
      return { outbound }
    },

    setVisionRadius(playerId, radius) {
      if (!players.has(playerId)) return
      if (radius === null) {
        visionOverrides.delete(playerId)
        return
      }
      if (!Number.isFinite(radius)) return
      visionOverrides.set(playerId, Math.min(VISION_RADIUS_MAX, Math.max(VISION_RADIUS_MIN, radius)))
    },

    revealPlan(playerId, source) {
      if (!players.has(playerId)) return
      const scene = sceneFor(playerId, toWorld(source))
      if (scene === null) return
      const map = scene.map
      markAll(memoryFor(playerId, map).exp, playerBlockedRings(map))
    },

    hidePlan(playerId, source) {
      // Apagar a memória: o próximo snapshot recria vazia (explorado, portas e visão).
      if (source === undefined) {
        memories.delete(playerId)
        return
      }
      const scene = sceneFor(playerId, toWorld(source))
      if (scene !== null) memories.get(playerId)?.delete(scene.map.id)
    },

    broadcast(source) {
      const world = toWorld(source)
      rev += 1
      const outbound: Outbound[] = []
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) !== 'playing') continue
        // Cada um a SUA cena: quem ficou no Salão nunca recebe nada da Cripta.
        // Quem não está em cena nenhuma recebe a espera, e não a cena do editor.
        // O recado guardado vai atrás do mapa: quem ganhou ficha agora o lê.
        outbound.push(...viewWithPendingNote(clientId, playerId, viewFor(playerId, world)))
        // Trocou de cena (pedido, "Mandar para…", reunir): a pausa é a da cena NOVA.
        outbound.push(...pausedUpdate(clientId, playerId, world))
      }
      return { outbound }
    },

    setScenePaused(sceneId, paused, source) {
      if (paused) pausedScenes.add(sceneId)
      else pausedScenes.delete(sceneId)
      const world = toWorld(source)
      const outbound: Outbound[] = []
      // Só quem está na cena muda; os outros saem sem mensagem pelo "mudou?".
      for (const [clientId, playerId] of byClient) outbound.push(...pausedUpdate(clientId, playerId, world))
      return { outbound }
    },

    isScenePaused(sceneId) {
      return pausedScenes.has(sceneId)
    },

    laser(message, source) {
      const world = source === undefined ? null : toWorld(source)
      const outbound: Outbound[] = []
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) !== 'playing') continue
        // Sem cena (`null`) também fica de fora: não está no mapa em que o mestre aponta.
        if (world !== null && sceneFor(playerId, world) !== world.open) continue
        outbound.push({ clientId, msg: message })
      }
      return { outbound }
    },

    sceneNote(sceneId, text, source, recipients) {
      const clamped = clampNoteText(text)
      if (clamped.trim().length === 0) return { outbound: [] }
      const chosen = recipients === undefined ? null : new Set(recipients)
      const world = toWorld(source)
      // Um id por recado, igual para todos da cena: o jogador troca o cartão
      // aberto pelo recado novo, e o mesmo recado não duplica.
      const id = randomId()
      const outbound: Outbound[] = []
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) !== 'playing') continue
        if (chosen !== null && !chosen.has(playerId)) continue
        // A cena de CADA jogador, não a aberta no editor: o mestre pode estar
        // olhando a Cripta e mandar recado para o Salão.
        if (sceneFor(playerId, world)?.sceneId !== sceneId) continue
        outbound.push({ clientId, msg: { type: 'scene.note', id, text: clamped } })
      }
      return { outbound }
    },

    playerNote(playerId, text, source) {
      const record = players.get(playerId)
      const clamped = clampNoteText(text)
      if (record === undefined || clamped.trim().length === 0) return { outbound: [], delivery: null }
      const note = { id: randomId(), text: clamped }
      const clientId = record.clientId
      // Sai agora só com ele conectado E com mapa na tela (jogando, numa cena):
      // é a mesma regra do cliente, que fora disso descartaria o recado.
      if (clientId === null || statusOf(playerId) !== 'playing' || sceneFor(playerId, toWorld(source)) === null) {
        pendingNotes.set(playerId, note)
        return { outbound: [], delivery: 'queued' }
      }
      // Recado entregue agora substitui qualquer guardado: o cartão dele mostra um por vez.
      pendingNotes.delete(playerId)
      return { outbound: [{ clientId, msg: { type: 'scene.note', id: note.id, text: note.text, onlyYou: true } }], delivery: 'sent' }
    },

    listPlayers(source) {
      const world = source === undefined ? null : toWorld(source)
      // Nome de cena só faz sentido com aventura: no mapa solto todo mundo está no mesmo lugar.
      const withScenes = world !== null && world.open.sceneId !== null
      return [...players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => {
          const info: PlayerInfo = {
            clientId: p.clientId,
            playerId: p.playerId,
            name: p.name,
            status: statusOf(p.playerId),
            connected: p.clientId !== null,
            tokenIds: [...(ownership[p.playerId] ?? [])],
            visionRadius: radiusFor(p.playerId),
          }
          // O selo da lista Cenas nasce e morre com o pedido: aprovar, recusar
          // e cair a conexão já tiram o jogador de `pendingTravels`.
          if (pendingTravels.has(p.playerId)) info.travelPending = true
          if (withScenes && info.status === 'playing') {
            const scene = sceneFor(p.playerId, world)
            // Sem cena, o painel o mostra aguardando: é o que a tela dele diz, e
            // é o que leva o mestre a dar outra ficha a ele.
            if (scene === null) info.status = 'waiting'
            else {
              info.sceneName = scene.name
              if (scene.sceneId !== null) info.sceneId = scene.sceneId
            }
          }
          return info
        })
    },

    partyUpdates(source) {
      const world = toWorld(source)
      const ordered = [...players.values()].sort((a, b) => a.joinedAt - b.joinedAt)
      // A cena de cada um, uma vez só (chave `sceneKey`). `null` = não está em
      // cena: ainda sem ficha, ou com a ficha fora de toda cena aberta. Esse
      // jogador fica 'longe' para todos — está na mesa, mas não ao lado de
      // ninguém. Sumir da lista seria justamente o "caiu, saiu ou está longe?"
      // que a lista existe para responder.
      const sceneOf = new Map<string, string | null>()
      for (const p of ordered) {
        const scene = statusOf(p.playerId) === 'playing' ? sceneFor(p.playerId, world) : null
        sceneOf.set(p.playerId, scene === null ? null : sceneKey(scene))
      }
      // Conexão que já caiu não recebe mais nada: a chave dela só ocuparia memória.
      for (const clientId of lastPartySent.keys()) {
        if (!byClient.has(clientId)) lastPartySent.delete(clientId)
      }
      const outbound: Outbound[] = []
      for (const [clientId, viewerId] of byClient) {
        const mine = sceneOf.get(viewerId) ?? null
        const members: PartyMember[] = ordered
          .filter((p) => p.playerId !== viewerId)
          .map((p) => ({ playerId: p.playerId, name: p.name, where: partyWhere(p, mine, sceneOf.get(p.playerId) ?? null) }))
        const key = JSON.stringify(members)
        if (lastPartySent.get(clientId) === key) continue
        lastPartySent.set(clientId, key)
        outbound.push({ clientId, msg: { type: 'party.update', members } })
      }
      return { outbound }
    },
  }
  return api
}

/**
 * Onde `other` está para quem vê da cena `viewerScene`. Desconectado vence
 * tudo: a ficha dele pode estar na mesma cena, mas ninguém a move. Sem cena
 * própria (`null`), ninguém está "aqui" com ele.
 */
function partyWhere(other: PlayerRecord, viewerScene: string | null, otherScene: string | null): PartyWhere {
  if (other.clientId === null) return 'fora'
  return viewerScene !== null && otherScene === viewerScene ? 'aqui' : 'longe'
}
