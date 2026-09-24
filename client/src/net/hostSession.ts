import type { DoorState, MapData, Pin, RegionPoint, Token, Wall } from '../types/map'
import { createExploration, encodeExploration, forgetInside, isPointExplored, markAll, markRings, type Exploration } from '../lib/exploration'
import { pointInRing } from '../lib/floorContour'
import { filterMapForPlayer, playerBlockedRings } from '../lib/fogFilter'
import { validateTokenMove } from '../lib/moveValidation'
import { tokensOccupy } from '../lib/movementRules'
import { tokenReachesDoor } from '../lib/doorReach'
import { keyForDoor } from '../lib/doorKey'
import { SIGNAL_MIN_INTERVAL_MS, signalColor } from '../lib/signals'
import { arrivalPoint, arrivalSpot, exitLabelsOf, isArrivalOnly, resolvePinTravel, SAIDA_PRINCIPAL, travelExitOf, type TravelScene } from '../lib/pinTravel'
import { passageOf, pinSummary } from '../lib/pins'
import { carriedItemsOf, itemOfPin, tokenReachesPin, tokensTouch, type ItemChange } from '../lib/items'
import {
  parsePlayerMessage,
  type DoorRequestHow,
  type DoorRequestMessage,
  type DoorRequestRejection,
  type DoorToggleMessage,
  type DoorToggleRejection,
  type DoorUseKeyMessage,
  type HostMessage,
  type ItemGiveMessage,
  type ItemGiveRejection,
  type JoinMessage,
  type LaserMessage,
  type PinTakeMessage,
  type PinTakeRejection,
  type PinTravelRejection,
  type PinTravelRequestMessage,
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
 * CHAVE ABRE PORTA: o jogador abriu a porta trancada com a chave da mochila.
 * É o aviso do mestre (quem, com que item, onde); nada disto vai ao jogador.
 */
export interface DoorKeyUse {
  playerId: string
  playerName: string
  itemName: string
  /** Nome da cena (o que o mestre lê), só quando a porta está numa cena de FUNDO. */
  sceneName?: string
}

/**
 * ITEM PEGÁVEL: "Pegar" já validado, à espera do mestre. É o que a linha da
 * caixa de Pedidos mostra; nada disto vai ao jogador.
 */
export interface ItemRequest {
  requestId: string
  playerId: string
  playerName: string
  itemName: string
  /** Nome da cena (o que o mestre lê), só quando o item está numa cena de FUNDO. */
  sceneName?: string
}

/**
 * Item que trocou de lugar (pego, ou dado a um colega): o integrador aplica
 * com `lib/items.ts` → `applyItemChange` na cena `sceneId` (ausente = a
 * aberta no editor), fora do desfazer — foi o jogador, não o mestre.
 */
export interface AppliedItems extends ItemChange {
  sceneId?: string
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

export interface HostResult {
  outbound: Outbound[]
  applyMove?: AppliedMove
  applyDoor?: AppliedDoor
  applyTokenEdit?: AppliedTokenEdit
  signal?: HostSignal
  /** Pedido de passagem válido: o integrador pergunta ao mestre. */
  travelRequest?: TravelRequest
  /** Pedido da porta trancada válido: o integrador pergunta ao mestre. */
  doorRequest?: DoorRequest
  /** A chave da mochila abriu a porta (o `applyDoor` vem junto, com `unlock`): o integrador avisa o mestre. */
  doorKeyUsed?: DoorKeyUse
  /** "Pegar" válido de pino que pede ao mestre: o integrador pergunta. */
  itemRequest?: ItemRequest
  /** Item pego (pino livre ou "Deixar") ou dado: o integrador grava na cena. */
  applyItems?: AppliedItems
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
   */
  sceneNote(sceneId: string, text: string, source: HostMapSource): HostResult
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
   * "Deixar" do pedido de item: revalida contra o mundo de AGORA (o pino pode
   * ter sido pego por outro, a ficha pode ter saído) e devolve `applyItems` +
   * `pin.take.answer taken` ao jogador. Não exige mais a ficha encostada: é
   * decisão do mestre. Pedido que já não existe não faz nada.
   */
  approveItemRequest(requestId: string, source: HostMapSource): HostResult
  /** "Não": `pin.take.answer denied` ao jogador. Pedido que já não existe não faz nada. */
  denyItemRequest(requestId: string): HostResult
  /** O pedido de item ainda espera o mestre? `false` depois de decidido, ou quando o jogador saiu. */
  isItemRequestPending(requestId: string): boolean
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
   * Quantas entradas os limites do pedido de passagem guardam agora (por
   * jogador + por jogador/cena/pino). Diagnóstico: é o número que um cliente
   * hostil tentaria inflar mandando ids de pino inventados.
   */
  travelLimitEntries(): number
  readonly rev: number
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

/** Pedido de item à espera do mestre. Um por jogador. `tokenId`: a ficha que pega; `mapId`: a `sceneKey` da cena. */
interface PendingItem {
  requestId: string
  playerId: string
  pinId: string
  tokenId: string
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
  // Por playerId: reconectar não zera o limite de 1 sinal por segundo.
  const lastSignalAt = new Map<string, number>()
  // Por playerId: mesmo limite para o pedido de abrir/fechar porta.
  const lastDoorToggleAt = new Map<string, number>()
  // Por playerId: o pedido da porta trancada que espera o mestre (no máximo um).
  const pendingDoors = new Map<string, PendingDoor>()
  // Por playerId: o mesmo limite do toque, para o pedido da porta trancada.
  const lastDoorRequestAt = new Map<string, number>()
  // Por playerId: o pedido de item que espera o mestre (no máximo um).
  const pendingItems = new Map<string, PendingItem>()
  // Por playerId: o mesmo limite do toque na porta, para "Pegar" e para "Dar a…".
  const lastItemTakeAt = new Map<string, number>()
  const lastItemGiveAt = new Map<string, number>()
  // Por playerId: limite da foto nova do próprio token (só da foto, ver TOKEN_PHOTO_MIN_INTERVAL_MS).
  const lastTokenPhotoAt = new Map<string, number>()
  // Por playerId: ajuste do mestre sobre `options.visionRadius`; só o kick apaga.
  const visionOverrides = new Map<string, number>()
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

  /** A ficha é de OUTRO jogador (não do mestre, não dele): colega a quem se pode dar um item. */
  const isOtherPlayersToken = (playerId: string, tokenId: string): boolean =>
    Object.entries(ownership).some(([owner, ids]) => owner !== playerId && ids.includes(tokenId))

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
    // Só fichas que ele JÁ recebe: a lista não conta quem está no escuro.
    const partyTokens = view.map.tokens.filter((t) => isOtherPlayersToken(playerId, t.id)).map((t) => t.id)
    return { type: 'snapshot', rev, map: view.map, vision: view.vision, explored: encodeExploration(exp), ownTokens, concealed: view.concealed, partyTokens }
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
    return { outbound: [{ clientId, msg: welcome }, { clientId, msg: next }] }
  }

  /**
   * "Fichas ocupam espaço" só conta ficha que o jogador ENXERGA agora: o
   * recorte dele (`filterMapForPlayer`), o mesmo que o snapshot manda. Ficha
   * oculta, secreta, em zona oculta ou na névoa não recusa — "Lugar ocupado"
   * ali contaria que existe alguém onde ele não vê. Sem a regra ligada, nem
   * calcula o recorte. Usa a memória que já existe, sem criar nem reordenar.
   */
  const occupantsSeenBy = (playerId: string, map: MapData): readonly Token[] | undefined => {
    if (!tokensOccupy(map)) return undefined
    const memory = existingMemory(playerId, map)
    return filterMapForPlayer(map, playerId, ownership, radiusFor(playerId), memory?.exp, memory?.doors).map.tokens
  }

  function handleMove(clientId: string, msg: TokenMoveMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    // O movimento vale na cena DELE: token de outra cena é `unknown_token` aqui.
    const scene = sceneFor(playerId, world)
    // Sem cena (aventura aberta, ficha em lugar nenhum): não há onde mover.
    if (scene === null) return reply(clientId, { type: 'token.move.rejected', reqId: msg.reqId, reason: 'unknown_token' })
    const result = validateTokenMove(scene.map, { playerId, tokenId: msg.tokenId, x: msg.x, y: msg.y }, ownership, {
      occupants: occupantsSeenBy(playerId, scene.map),
    })
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
   * O mestre sempre recebe o sinal (campo `signal`) e quem sinalizou recebe o
   * eco. Outro jogador só recebe se já conhece o ponto e o ponto está fora de
   * zona oculta ativa: senão o sinal diria que existe algo naquele lugar.
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
    const at = now()
    const last = lastSignalAt.get(playerId)
    if (last !== undefined && at - last < SIGNAL_MIN_INTERVAL_MS) return { outbound: [] }
    lastSignalAt.set(playerId, at)

    const point = { x: msg.x, y: msg.y }
    const color = signalColor(playerId)
    const message: HostMessage = { type: 'signal', x: msg.x, y: msg.y, from: record.name, color }
    const outbound: Outbound[] = [{ clientId, msg: message }]
    // Sala secreta vale como zona oculta: repassar o sinal diria aos outros que ali existe algo.
    const inBlockedArea = playerBlockedRings(map).some((ring) => ring.length >= 3 && pointInRing(point, ring))
    if (!inBlockedArea) {
      for (const [otherClient, otherId] of byClient) {
        if (otherId === playerId || statusOf(otherId) !== 'playing') continue
        // Quem está em outra cena não recebe: o ponto é deste mapa, e a
        // memória antiga dele desta cena diria que o sinal é para lá.
        if (sceneFor(otherId, world) !== scene) continue
        if (knowsPoint(otherId, map, point)) outbound.push({ clientId: otherClient, msg: message })
      }
    }
    const signal: HostSignal = { playerId, name: record.name, color, x: msg.x, y: msg.y }
    // Mesma regra de `backgroundSceneId`: a cena aberta e o mapa solto não levam o campo.
    if (scene !== world.open && scene.sceneId !== null) signal.background = { sceneId: scene.sceneId, name: scene.name }
    return { outbound, signal }
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
  const doorSeenBy = (playerId: string, map: MapData, wallId: string): { wall: Wall; door: DoorState; near: boolean; key: string | null } | null => {
    const wall = map.walls.find((w) => w.id === wallId)
    if (wall === undefined || wall.door === null) return null
    const memory = memoryFor(playerId, map)
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId), memory.exp, memory.doors)
    if (!view.visibleDoorIds.includes(wall.id)) return null
    const owned = new Set(ownership[playerId] ?? [])
    const nearIds = new Set(view.map.tokens.filter((t) => owned.has(t.id) && tokenReachesDoor(t, wall, map.grid)).map((t) => t.id))
    // CHAVE ABRE PORTA: a mochila é a das fichas do MAPA DO MESTRE encostadas
    // na porta — a chave precisa estar na mão de quem está ali, não na de uma
    // ficha dele do outro lado da cena.
    const found = keyForDoor(wall.door, map.tokens.filter((t) => nearIds.has(t.id)))
    return { wall, door: wall.door, near: nearIds.size > 0, key: found === null ? null : found.item.nome }
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
    if (scene === null) return { outbound: [] }
    if (!withinDoorLimit(lastDoorToggleAt, playerId)) return { outbound: [] }

    const reject = (reason: DoorToggleRejection): HostResult => reply(clientId, { type: 'door.toggle.rejected', wallId: msg.wallId, reason })

    const seen = doorSeenBy(playerId, scene.map, msg.wallId)
    if (seen === null) return reject('not_visible')
    // Trancada antes de longe: "Trancada" é a informação útil, e é dela que sai o pedido ao mestre.
    // Quem encosta com a chave lê o nome dela: é o item que ele já carrega, não o que a porta pede.
    if (seen.door.locked) {
      return seen.key === null ? reject('locked') : reply(clientId, { type: 'door.toggle.rejected', wallId: msg.wallId, reason: 'locked', key: seen.key })
    }
    if (!seen.near) return reject('far')

    return { outbound: [], applyDoor: { wallId: seen.wall.id, open: !seen.door.open, ...backgroundSceneId(scene, world) } }
  }

  /**
   * CHAVE ABRE PORTA: "Usar <chave>". Autoridade no molde de
   * `handleDoorToggle` (porta visível agora, ficha encostada) e mais: uma
   * ficha DELE encostada carrega o item que a porta pede. Vale, destranca e
   * abre para todos na hora — sem pedido —, e o mestre recebe o aviso. Sem a
   * chave, a mesma recusa "Trancada" do toque (dela sai o pedido ao mestre).
   */
  function handleDoorUseKey(clientId: string, msg: DoorUseKeyMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const record = players.get(playerId)
    if (record === undefined || statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    if (scene === null) return { outbound: [] }
    if (!withinDoorLimit(lastDoorToggleAt, playerId)) return { outbound: [] }

    const reject = (reason: DoorToggleRejection): HostResult => reply(clientId, { type: 'door.toggle.rejected', wallId: msg.wallId, reason })

    const seen = doorSeenBy(playerId, scene.map, msg.wallId)
    if (seen === null) return reject('not_visible')
    if (!seen.near) return reject('far')
    // Destrancada (o mestre ou um colega chegou antes): abre como o toque abriria.
    if (!seen.door.locked) return { outbound: [], applyDoor: { wallId: seen.wall.id, open: true, ...backgroundSceneId(scene, world) } }
    if (seen.key === null) return reject('locked')

    const used: DoorKeyUse = { playerId, playerName: record.name, itemName: seen.key }
    // Cena de fundo: o mestre lê onde foi, porque está olhando outra.
    if (backgroundSceneId(scene, world).sceneId !== undefined) used.sceneName = scene.name
    return { outbound: [], applyDoor: { wallId: seen.wall.id, open: true, unlock: true, ...backgroundSceneId(scene, world) }, doorKeyUsed: used }
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
    if (scene === null) return { outbound: [] }
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
   * ITEM PEGÁVEL: o que o jogador pode pegar AGORA. Autoridade no molde da
   * porta: o pino existe na cena dele, é pegável, está no recorte dele (a
   * mesma névoa que decide mandar o pino — oculto, no escuro ou sob teto não
   * vale) e uma ficha dele, no recorte dele, está ao alcance. Inexistente,
   * invisível e não-item respondem o mesmo `unavailable`.
   */
  const takeCheck = (playerId: string, map: MapData, pinId: string): { pin: Pin; nome: string; livre: boolean; token: Token } | PinTakeRejection => {
    const pin = map.pins.find((p) => p.id === pinId)
    const item = pin === undefined ? null : itemOfPin(pin)
    if (pin === undefined || item === null) return 'unavailable'
    const memory = memoryFor(playerId, map)
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId), memory.exp, memory.doors)
    if (!view.map.pins.some((p) => p.id === pinId)) return 'unavailable'
    const owned = new Set(ownership[playerId] ?? [])
    const reaching = view.map.tokens.filter((t) => owned.has(t.id) && tokenReachesPin(t, pin, map.grid))
    // A ficha do MAPA DO MESTRE, não a do recorte: é a mochila dela que cresce.
    const token = reaching.map((t) => map.tokens.find((m) => m.id === t.id)).find((t): t is Token => t !== undefined)
    if (token === undefined) return 'far'
    return { pin, nome: item.nome, livre: item.livre === true, token }
  }

  /** O item vai à mochila da ficha e o pino sai do mapa; `clientId` (quando há) lê "está com você". */
  const takeResult = (clientId: string | null, scene: HostScene, world: HostWorld, pin: Pin, nome: string, token: Token): HostResult => ({
    outbound: clientId === null ? [] : [{ clientId, msg: { type: 'pin.take.answer', answer: 'taken', nome } }],
    applyItems: {
      ...backgroundSceneId(scene, world),
      removePinId: pin.id,
      mochilas: [{ tokenId: token.id, mochila: [...carriedItemsOf(token), { id: pin.id, nome }] }],
    },
  })

  function handlePinTake(clientId: string, msg: PinTakeMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const record = players.get(playerId)
    if (record === undefined || statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    if (scene === null) return { outbound: [] }
    if (!withinDoorLimit(lastItemTakeAt, playerId)) return { outbound: [] }

    const reject = (reason: PinTakeRejection): HostResult => reply(clientId, { type: 'pin.take.rejected', reason })
    if (pendingItems.has(playerId)) return reject('pending')
    const found = takeCheck(playerId, scene.map, msg.pinId)
    if (typeof found === 'string') return reject(found)
    // Livre: passou em tudo que o pedido passaria e vai direto, sem esperar o mestre.
    if (found.livre) return takeResult(clientId, scene, world, found.pin, found.nome, found.token)

    const requestId = randomId()
    pendingItems.set(playerId, { requestId, playerId, pinId: found.pin.id, tokenId: found.token.id, mapId: sceneKey(scene) })
    const request: ItemRequest = { requestId, playerId, playerName: record.name, itemName: found.nome }
    // Cena de fundo: o mestre lê onde é, porque está olhando outra.
    if (backgroundSceneId(scene, world).sceneId !== undefined) request.sceneName = scene.name
    return { outbound: [], itemRequest: request }
  }

  const findPendingItem = (requestId: string): PendingItem | undefined => [...pendingItems.values()].find((pending) => pending.requestId === requestId)

  /**
   * "Dar a…": o item sai da mochila de uma ficha DELE e entra na de um COLEGA
   * (ficha de outro jogador) que ele vê agora e que está encostada. Ficha do
   * mestre (NPC), a própria, a que ele não vê e item que ele não tem
   * respondem o mesmo `unavailable`.
   */
  function handleItemGive(clientId: string, msg: ItemGiveMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    if (statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    if (scene === null) return { outbound: [] }
    if (!withinDoorLimit(lastItemGiveAt, playerId)) return { outbound: [] }

    const reject = (reason: ItemGiveRejection): HostResult => reply(clientId, { type: 'item.give.rejected', reason })
    const map = scene.map
    const owned = new Set(ownership[playerId] ?? [])
    const memory = memoryFor(playerId, map)
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId), memory.exp, memory.doors)
    const masterToken = (id: string): Token | undefined => map.tokens.find((t) => t.id === id)
    const giverSeen = view.map.tokens.find((t) => owned.has(t.id) && carriedItemsOf(masterToken(t.id) ?? t).some((item) => item.id === msg.itemId))
    const targetSeen = view.map.tokens.find((t) => t.id === msg.toTokenId && !owned.has(t.id))
    const targetIsPlayer = isOtherPlayersToken(playerId, msg.toTokenId)
    const giver = giverSeen === undefined ? undefined : masterToken(giverSeen.id)
    const target = targetSeen === undefined ? undefined : masterToken(targetSeen.id)
    const item = giver === undefined ? undefined : carriedItemsOf(giver).find((i) => i.id === msg.itemId)
    if (giverSeen === undefined || targetSeen === undefined || !targetIsPlayer || giver === undefined || target === undefined || item === undefined) {
      return reject('unavailable')
    }
    if (!tokensTouch(giverSeen, targetSeen, map.grid)) return reject('far')
    return {
      outbound: [],
      applyItems: {
        ...backgroundSceneId(scene, world),
        mochilas: [
          { tokenId: giver.id, mochila: carriedItemsOf(giver).filter((i) => i.id !== item.id) },
          { tokenId: target.id, mochila: [...carriedItemsOf(target), item] },
        ],
      },
    }
  }

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
    const spot = arrivalSpot(travel.to.map, travel.partner, travel.token.size)
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

  return {
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
        case 'door.useKey':
          return handleDoorUseKey(clientId, msg, world)
        case 'token.edit':
          return handleTokenEdit(clientId, msg, world)
        case 'pin.travel.request':
          return handleTravelRequest(clientId, msg, world)
        case 'pin.take':
          return handlePinTake(clientId, msg, world)
        case 'item.give':
          return handleItemGive(clientId, msg, world)
      }
    },

    approveItemRequest(requestId, source) {
      const pending = findPendingItem(requestId)
      if (pending === undefined) return { outbound: [] }
      pendingItems.delete(pending.playerId)
      const record = players.get(pending.playerId)
      // Saiu da sala enquanto o mestre decidia: a chave fica no chão.
      if (record === undefined || record.clientId === null) return { outbound: [] }
      const world = toWorld(source)
      const scene = allScenes(world).find((s) => sceneKey(s) === pending.mapId)
      const pin = scene?.map.pins.find((p) => p.id === pending.pinId)
      const item = pin === undefined ? null : itemOfPin(pin)
      const token = scene?.map.tokens.find((t) => t.id === pending.tokenId)
      // A ficha tem de continuar sendo dele: o mestre pode tê-la dado a outro.
      const stillHis = (ownership[pending.playerId] ?? []).includes(pending.tokenId)
      if (scene === undefined || pin === undefined || item === null || token === undefined || !stillHis) {
        return reply(record.clientId, { type: 'pin.take.rejected', reason: 'unavailable' })
      }
      return takeResult(record.clientId, scene, world, pin, item.nome, token)
    },

    denyItemRequest(requestId) {
      const pending = findPendingItem(requestId)
      if (pending === undefined) return { outbound: [] }
      pendingItems.delete(pending.playerId)
      const clientId = players.get(pending.playerId)?.clientId ?? null // null = saiu: não há a quem avisar
      return clientId === null ? { outbound: [] } : reply(clientId, { type: 'pin.take.answer', answer: 'denied' })
    },

    isItemRequestPending(requestId) {
      return findPendingItem(requestId) !== undefined
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
      const spot = gatherAt ?? (pin === null ? arrivalPoint(to.map) : arrivalSpot(to.map, pin, token.size))
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
      const record = players.get(playerId)
      if (record !== undefined) record.clientId = null // mantém o registro para permitir resume
      // O pedido pendente morre com a conexão: quem voltar não tem mais o
      // "Aguardando o mestre…" na tela, e o aviso do mestre fica inofensivo.
      pendingTravels.delete(playerId)
      // Mesmo para a porta: "Destrancar e abrir" depois da queda não abre nada.
      pendingDoors.delete(playerId)
      // E para o item: "Deixar" depois da queda não entrega nada.
      pendingItems.delete(playerId)
    },

    kick(clientId) {
      const playerId = byClient.get(clientId)
      if (playerId === undefined) return { outbound: [] }
      byClient.delete(clientId)
      players.delete(playerId) // invalida o resumeToken
      delete ownership[playerId]
      memories.delete(playerId)
      currentScene.delete(playerId)
      forgetTravelsOf(playerId)
      lastSignalAt.delete(playerId)
      lastDoorToggleAt.delete(playerId)
      pendingDoors.delete(playerId)
      lastDoorRequestAt.delete(playerId)
      pendingItems.delete(playerId)
      lastItemTakeAt.delete(playerId)
      lastItemGiveAt.delete(playerId)
      lastTokenPhotoAt.delete(playerId)
      visionOverrides.delete(playerId)
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
        outbound.push({ clientId, msg: viewFor(playerId, world) })
      }
      return { outbound }
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

    sceneNote(sceneId, text, source) {
      const clamped = clampNoteText(text)
      if (clamped.trim().length === 0) return { outbound: [] }
      const world = toWorld(source)
      // Um id por recado, igual para todos da cena: o jogador troca o cartão
      // aberto pelo recado novo, e o mesmo recado não duplica.
      const id = randomId()
      const outbound: Outbound[] = []
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) !== 'playing') continue
        // A cena de CADA jogador, não a aberta no editor: o mestre pode estar
        // olhando a Cripta e mandar recado para o Salão.
        if (sceneFor(playerId, world)?.sceneId !== sceneId) continue
        outbound.push({ clientId, msg: { type: 'scene.note', id, text: clamped } })
      }
      return { outbound }
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
  }
}
