import type { AreaTriggerKind, DoorState, HazardKind, MapData, Pin, PinPassage, RegionPoint, Token, Wall } from '../types/map'
import { hazardPresence, newHazardEntries, type HazardEntry } from '../lib/hazards'
import { areaTriggerPresence, newAreaTriggerEntries, regionAreaName, type AreaTriggerPresence } from '../lib/areaTriggers'
import { createExploration, decodeExploration, encodeExploration, forgetBlocked, forgetInside, isPointExplored, markAll, markRings, mergeExploration, mergeExplored, resizeExploration, type Exploration } from '../lib/exploration'
import { pointInRing } from '../lib/floorContour'
import { alarmForPlayer, allPlayerTokens, claimableTokensForPlayer, clockForPlayer, diceRollForPlayer, emptyPlanMemory, filterFloorMemory, filterMapForGroup, filterMapForPlayer, memoryBlockedRings, noiseCueForPlayer, pinClueForPlayer, planOfWholeMap, playerBlockedRings, roomClueForPlayer, sceneNameForPlayer, turnForPlayer, type GroupViewer, type PlanMemory, type PlayerClueContent, type PlayerMapView, type SceneAlarm } from '../lib/fogFilter'
import { MASTER_ROLLER_NAME, rollDice, secureRollDie, type DiceRequest, type HostDiceRoll, type RollDie } from '../lib/dice'
import { CLUEBOOK_MAX_CLUES } from '../lib/clues'
import { visionRadiusAtHour } from '../lib/campaignClock'
import { sameBuilding, sortFloorLabels } from '../lib/buildingFloors'
import { turnTokenIdOn, type TurnRef } from '../lib/initiative'
import { clampNoiseRangeCells } from '../lib/noise'
import { validateTokenMove } from '../lib/moveValidation'
import { tokensOccupy } from '../lib/movementRules'
import { doorOpensFrom, tokenInDoorway, tokenReachesDoor } from '../lib/doorReach'
import { keyForDoor, keyForPin } from '../lib/doorKey'
import { DESTINATION_MIN_INTERVAL_MS, SIGNAL_MIN_INTERVAL_MS, signalColor, type DestinationMark } from '../lib/signals'
import { acceptsLockedRequest, passageOf, pinSummary } from '../lib/pins'
import { carriedItemsOf, itemOfPin, tokenReachesPin, tokensTouch, type ItemChange } from '../lib/items'
import { selectedTokenColor } from '../lib/tokenColor'
import { arrivalSpot, arrivalSpotWithoutPin, exitLabelsOf, freeSeatNear, isArrivalOnly, resolvePinTravel, SAIDA_PRINCIPAL, travelExitOf, type TravelScene } from '../lib/pinTravel'
import { pinClearance, type KeepClear } from '../lib/gatherParty'
import { visibleTokens } from '../lib/layers'
import type { SavedSceneMemory, SavedSeat, SavedSeatExploration } from '../lib/savedTable'
import { companionSpots, companionsNear, entourageNear, entourageSeats, type Companion, type Seat } from '../lib/travelTogether'
import {
  MAX_PENDING_POINT_ACTIONS_PER_PLAYER,
  POINT_ACTION_MIN_INTERVAL_MS,
  isPointInsideMap,
  roomNameAt,
  type PointActionAnswer,
  type PointActionKind,
} from '../lib/pointActions'
import { linkedDoorOf } from '../lib/lever'
import { carriedBy, carrierIdOf } from '../lib/carry'
import { companionArrivals, type CarriedArrival } from '../lib/carryArrival'
import { VISION_FACTOR_DEFAULT, clampVisionFactor, playerVisionRadius, readSceneVisionCells } from '../lib/sceneVision'
import {
  parsePlayerMessage,
  type ClueEntry,
  type ClueReadMessage,
  type ClueShowMessage,
  type CallRaiseMessage,
  type CallReason,
  type DoorPeekMessage,
  type DoorRequestHow,
  type DoorRequestMessage,
  type DoorRequestRejection,
  type DestinationMessage,
  type DiceRollMessage,
  type DoorToggleMessage,
  type DoorToggleRejection,
  type DoorUseKeyMessage,
  type FloorMemoryWire,
  type FloorsWire,
  type HostMessage,
  type ItemGiveMessage,
  type ItemGiveRejection,
  type JoinMessage,
  type LaserMessage,
  type PinLeverMessage,
  type PinLeverRejection,
  type PinReadMessage,
  type PinTakeMessage,
  type PinTakeRejection,
  type PartyMember,
  type PartyWhere,
  type PinTravelRejection,
  type PinTravelRequestMessage,
  type PlayerLaserMessage,
  type PointActionMessage,
  type SeatClaimMessage,
  type SeatClaimState,
  type SeatOption,
  type SecretCheckAnswerMessage,
  type SignalMessage,
  type TokenEditMessage,
  type TokenMoveMessage,
} from './protocol'
import {
  clampAlarmText,
  clampNoteText,
  clampSeatOptionName,
  clampSecretCheckLabel,
  clampTravelDenyText,
  NOTEBOOK_MAX_NOTES,
  REQ_ID_MAX_LENGTH,
  SEAT_OPTIONS_MAX,
  TRAVEL_REQUEST_MIN_INTERVAL_MS,
  TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS,
  VIEW_RESYNC_MIN_INTERVAL_MS,
  type NoteEntry,
} from './protocol'
import { diffView, isEmptyViewPatch, type PlayerViewContent } from './viewPatch'
import { readArrivalText } from '../lib/arrivalText'
import { caravanCity, caravanMembers, caravanRegroup, caravanSize, caravanStep, isWorldMap, landingSpots, type CaravanMemory } from '../lib/caravan'

/** Como a ficha livre de nome em branco aparece na lista de quem chega. */
const SEAT_OPTION_UNNAMED = 'Ficha sem nome'
/** A chave da lista vazia: é o que a conexão tem antes do primeiro `seat.options` (e logo depois de um `welcome`, que a apaga no jogador). */
const NO_SEAT_OPTIONS_KEY = '[]'

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
 * `publicName` é o NOME PARA OS JOGADORES, opcional: vai só a quem está nesta
 * cena, pelo `sceneNameForPlayer` (`lib/fogFilter.ts`).
 */
export interface HostScene {
  sceneId: string | null
  name: string
  publicName?: string
  map: MapData
  /**
   * "Planta conhecida por todos": quem está nesta cena recebe a planta inteira
   * como explorada (fora de zona oculta, sala secreta e teto), igual ao
   * "Revelar planta". Ausente = não. Fica no mestre: nunca vai ao jogador.
   */
  planKnownByAll?: boolean
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

/**
 * O `scene.changed` de quem CHEGA à cena de mapa `to`. Leva o TEXTO DE CHEGADA
 * dela (`lib/arrivalText.ts`) quando há: é o único caminho do texto até o
 * jogador — o recorte nunca o manda — e só quem chega recebe este aviso.
 */
function sceneChangedFor(to: MapData, by?: 'master' | 'gather'): HostMessage {
  const chegada = readArrivalText(to.textoChegada)
  return { type: 'scene.changed', ...(by === undefined ? {} : { by }), ...(chegada === undefined ? {} : { chegada }) }
}

/** As cenas como a ligação de um pino de viagem as enxerga (`resolvePinTravel`). */
function travelLookup(scenes: readonly HostScene[]): (sceneId: string) => TravelScene | null {
  return (sceneId) => {
    const scene = scenes.find((s) => s.sceneId === sceneId)
    return scene === undefined ? null : { name: scene.name, map: scene.map }
  }
}

/**
 * TELA DA MESA — como o mestre aponta a cena que a TV mostra: o id da cena na
 * aventura ou, no mapa solto (que não tem id de cena), o id do mapa. É o valor
 * que o seletor da aba Jogo guarda e que `setTableScene` recebe.
 */
export function tableSceneKey(scene: HostScene): string {
  return scene.sceneId ?? scene.map.id
}

/**
 * Quantas telas da mesa uma sala aceita. Cada uma custa um recorte a mais por
 * broadcast (o mesmo para todas, calculado uma vez), e a mesa real tem uma TV
 * e talvez um projetor: o teto segura quem abre a página em loop na LAN.
 */
export const MAX_TABLE_SCREENS = 4

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

/**
 * Porta que o jogador abriu/fechou: o integrador aplica no mapa do mestre e
 * mostra no aviso dele quem mexeu. Nada disto vai ao jogador.
 */
export interface AppliedDoor {
  wallId: string
  open: boolean
  sceneId?: string
  /** Nome da cena de FUNDO (junto com `sceneId`), para o aviso dizer onde. */
  sceneName?: string
  playerId: string
  playerName: string
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
 * CHAVE ABRE PORTA, no pino de viagem trancado: o jogador passou com a chave
 * da mochila. É o aviso do mestre; nada disto vai ao jogador.
 */
export interface PinKeyUse {
  playerId: string
  playerName: string
  itemName: string
  /** Como o mestre chama o pino: a descrição dele, ou o resumo (`pinSummary`). */
  pinLabel: string
  /** Nome da cena do pino, só quando ela é de FUNDO (o mestre olha outra). */
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
  /**
   * O pedido veio de um pino TRANCADO que aceita tentativas: o mestre responde
   * "Liberar uma vez", "Passar para pede" ou "Não", e não "Deixar ir".
   */
  trancada?: true
}

/**
 * "Passar para pede" do pedido pelo pino trancado: o integrador troca o modo
 * do pino `pinId` (na cena de FUNDO `sceneId`; ausente = a cena aberta).
 */
export interface AppliedPinPassage {
  pinId: string
  passagem: PinPassage
  sceneId?: string
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
  /**
   * LEVAR FICHA JUNTO: as fichas que `tokenId` leva (`lib/carry.ts`) e onde
   * cada uma assenta na cena de destino. O integrador as move DEPOIS da ficha
   * de quem leva, e só se ela passou. Ausente = ninguém levado. Nada disto vai
   * ao jogador.
   */
  junto?: CarriedArrival[]
  /**
   * MONTARIA E FAMILIAR: as outras fichas do MESMO dono que estavam a até 2
   * casas desta vão junto, cada uma na casa livre em volta de (`x`, `y`). O
   * integrador as move pela mesma store, depois desta. Ausente = só ela.
   */
  entourage?: EntourageSeat[]
}

/**
 * CARAVANA: a caravana de um mapa-mundi está em cima de uma cidade (pino de
 * viagem ligado). É a oferta "Desembarcar" do mestre; nada disto vai ao jogador.
 */
export interface CaravanStop {
  /** A cena de mapa-mundi (id na aventura) e o nome que o mestre lê. */
  sceneId: string
  sceneName: string
  pinId: string
  toSceneId: string
  toSceneName: string
}

/**
 * Por que o mapa da cena aberta mudou: edição do mestre (ou jogada aplicada) ou
 * desfazer/refazer, que só volta a um retrato antigo (`stores/mapStore.ts` → `mapChangeCause`).
 */
export type MapChangeCause = 'edit' | 'history'

/** O que `followCaravans` pede ao integrador: fichas que acompanham a caravana, e onde ela parou. */
export interface CaravanFollow {
  moves: AppliedMove[]
  stops: CaravanStop[]
}

/** Uma ficha da caravana que desembarca: a travessia e, na primeira ficha de cada jogador, o `scene.changed` dele. */
export interface CaravanArrival {
  transfer: AppliedTransfer
  outbound: Outbound[]
}

/** Uma ficha do séquito e a casa onde ela chega, na mesma cena de destino da principal. */
export interface EntourageSeat {
  tokenId: string
  x: number
  y: number
}

/**
 * Onde o "Reunir o grupo aqui" põe a ficha do jogador, com as casas que o
 * plano (`lib/gatherParty.ts`) já deu à montaria e ao familiar dele. Ausente
 * `entourage` = só a ficha dele.
 */
export interface GatherArrival {
  x: number
  y: number
  entourage?: readonly EntourageSeat[]
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
 * LASER DO JOGADOR aceito, para a tela do mestre desenhar. O mestre vê o lote
 * inteiro (ele vê o mapa todo); cada jogador recebeu só o recorte dele.
 */
export interface HostPlayerLaser {
  playerId: string
  name: string
  /** A cor da ficha dele (`#rrggbb`) ou, ficha sem cor, a da paleta de sinais. */
  color: string
  /** Lote do rastro em px de mundo DA CENA DO JOGADOR, ou o fim do gesto. */
  update: { points: RegionPoint[] } | { off: true }
  /**
   * O jogador aponta na cena aberta no editor. Fora dela os pontos são de
   * outro mapa: desenhados aqui, cairiam num lugar que não existe.
   */
  onOpenScene: boolean
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

/**
 * "Espiar" aceito: quem espiou e por qual porta. É o aviso do mestre; a porta
 * NÃO muda. O cone vale `PEEK_DURATION_MS` e o integrador manda o snapshot na
 * hora e de novo quando o prazo acaba (é aí que o cone fecha na tela).
 */
export interface HostPeek {
  playerId: string
  playerName: string
  wallId: string
}

/** Quanto dura o olhar pela porta espiada, em ms. */
export const PEEK_DURATION_MS = 5_000

/** O aviso do mestre, em uma linha. */
export function peekNoticeText(peek: HostPeek): string {
  return `${peek.playerName} espiou`
}

export interface HostResult {
  outbound: Outbound[]
  /** Chamado NOVO na fila: o integrador mostra a linha e toca o bipe. Repetição do mesmo chamado não vem. */
  call?: MasterCall
  applyMove?: AppliedMove
  applyDoor?: AppliedDoor
  /** Espiar aceito: o integrador avisa o mestre e reenvia o snapshot agora e no fim do prazo. */
  peek?: HostPeek
  applyTokenEdit?: AppliedTokenEdit
  signal?: HostSignal
  playerLaser?: HostPlayerLaser
  /** Ação no ponto aceita: o integrador põe a linha na Caixa do mestre. */
  pointAction?: PointActionRequest
  /** Pedido de ficha de quem chegou sem personagem: o integrador pergunta ao mestre. */
  seatClaim?: SeatClaim
  /** Pedido de passagem válido: o integrador pergunta ao mestre. */
  travelRequest?: TravelRequest
  /** Pedido da porta trancada válido: o integrador pergunta ao mestre. */
  doorRequest?: DoorRequest
  /** A chave da mochila abriu a porta (o `applyDoor` vem junto, com `unlock`): o integrador avisa o mestre. */
  doorKeyUsed?: DoorKeyUse
  /** A chave da mochila abriu o pino trancado (o `applyTransfer` vem junto): o integrador avisa o mestre. */
  pinKeyUsed?: PinKeyUse
  /** "Pegar" válido de pino que pede ao mestre: o integrador pergunta. */
  itemRequest?: ItemRequest
  /** Item pego (pino livre ou "Deixar") ou dado: o integrador grava na cena. */
  applyItems?: AppliedItems
  /**
   * O mestre deixou ir, ou o pino é livre (aí vem de `handleMessage`): o
   * integrador move o token entre as cenas ANTES de despachar `outbound`.
   */
  applyTransfer?: AppliedTransfer
  /** `secretCheck` criou o teste: é o id dele (o mesmo que foi aos jogadores). */
  secretCheckId?: string
  /** Um jogador respondeu ao teste secreto: o integrador mostra ao MESTRE. Nada disto vai a jogador. */
  secretCheckAnswer?: SecretCheckAnswer
  /** "Passar para pede": o integrador muda o modo do pino trancado por onde o jogador passou. */
  applyPinPassage?: AppliedPinPassage
  /**
   * LEVAR FICHA JUNTO: a recusa a quem tinha pedido de passagem esperando o
   * mestre e perdeu o pedido por ser levado junto. O integrador só despacha
   * se a ficha de quem leva NÃO passou; se passou, o `scene.changed` com
   * `by` já é a resposta que ele lê.
   */
  lostTravels?: Outbound[]
  /** ZONA DE PERIGO: fichas de jogador que entraram num perigo neste broadcast. O integrador avisa o mestre. */
  hazardEntries?: HazardEntryNotice[]
  /** GATILHO DE ÁREA: fichas de jogador que entraram numa área marcada neste broadcast. O integrador avisa o mestre. */
  triggerEntries?: AreaTriggerEntryNotice[]
  /**
   * Alguém entrou SEM resume com o nome de quem está fora: o integrador
   * pergunta ao mestre "Ana voltou?". Dado do mestre — nunca vai pela rede.
   */
  returnCandidate?: ReturnCandidate
  /**
   * A conexão antiga de quem voltou pelo resume (aba nova do mesmo aparelho):
   * já recebeu `session.replaced` no `outbound`; o integrador a derruba depois
   * do envio.
   */
  replacedClientId?: string
  /** Quem entrou reencontrou a ficha da mesa guardada: o integrador avisa o mestre, com "Desfazer". */
  reclaimed?: ReclaimedSeat
  /** DADO ROLADO NA SALA: a rolagem que a tela do mestre mostra (a escondida dele, marcada). */
  diceRoll?: HostDiceRoll
  /**
   * Empréstimos encerrados (o dono voltou, ou o mestre tomou de volta): a
   * ficha saiu de quem a jogava. O integrador manda o mapa novo a todos — quem
   * a jogava deixa de vê-la como dele. Dado do mestre — nunca vai pela rede.
   */
  loansReturned?: LoanReturn[]
}

/**
 * QUEM CHEGA ESCOLHE A FICHA: o pedido, já validado, à espera do mestre. É o
 * que a linha da caixa de Pedidos mostra ("Hugo quer jogar com Kael"); nada
 * disto vai a outro jogador.
 */
export interface SeatClaim {
  requestId: string
  playerId: string
  playerName: string
  tokenId: string
  tokenName: string
}

/** Uma ficha emprestada que voltou ao dono: de quem, com quem estava, qual. */
export interface LoanReturn {
  ownerId: string
  borrowerId: string
  tokenId: string
}

/**
 * "Ana voltou?": `playerId` é quem acabou de entrar (a "Ana (2)"),
 * `previousId` é a Ana que está fora e `name` é o nome dela, como o mestre o lê.
 */
export interface ReturnCandidate {
  playerId: string
  previousId: string
  name: string
}

/** Fichas devolvidas pelo nome ao entrar (retomar a mesa). Só do mestre: nunca vai pela rede. */
export interface ReclaimedSeat {
  playerId: string
  name: string
  tokenIds: string[]
}

/** GATILHO DE ÁREA: a linha que o mestre lê — quem entrou em qual área, e onde. Nada disto vai ao jogador. */
export interface AreaTriggerEntryNotice {
  playerName: string
  tokenName: string
  kind: AreaTriggerKind
  /** Nome da área (Sala ou Região) — `regionAreaName`. */
  areaName: string
  /** Nome da cena (o que o mestre lê), só quando ela não é a aberta no editor. */
  sceneName?: string
}

/** ZONA DE PERIGO: a linha que o mestre lê — quem entrou em quê, e onde. Nada disto vai ao jogador. */
export interface HazardEntryNotice {
  playerName: string
  tokenName: string
  kind: HazardKind
  /** Nome da cena (o que o mestre lê), só quando ela não é a aberta no editor. */
  sceneName?: string
}

/**
 * Um TESTE SECRETO como o mestre o vê: o nome, quem foi pedido (ids, na
 * ordem da sala) e o que cada um respondeu. `open` = o mestre ainda não
 * encerrou. Nada disto sai inteiro para jogador: cada escolhido recebe só o
 * id e o nome.
 */
export interface SecretCheckState {
  id: string
  label: string
  asked: string[]
  answers: Record<string, number>
  open: boolean
}

/** A resposta que acabou de chegar, para o aviso do mestre. */
export interface SecretCheckAnswer {
  checkId: string
  playerId: string
  playerName: string
  label: string
  result: number
}

/** Por playerId, fichas fora do mapa que continuam sendo dele (o "Guardar ficha" da ponte). */
export type HeldTokens = ReadonlyMap<string, readonly string[]>
export type { HostDiceRoll }

/**
 * Quantos testes secretos o mestre guarda na lista. Passou, sai o encerrado ou
 * já respondido por todos mais antigo; sem nenhum, o mais antigo, encerrado.
 */
export const MAX_SECRET_CHECKS = 20

export interface PlayerInfo {
  clientId: string | null
  playerId: string
  name: string
  status: PlayerStatus
  connected: boolean
  tokenIds: string[]
  /**
   * Raio em px para cena SEM "Visão nesta cena": o do mestre para este jogador
   * ou, sem ajuste, o global. O corte de verdade ainda multiplica pelo fator.
   */
  visionRadius: number
  /** "Fator de visão" deste jogador, em toda cena (x1,0 de fábrica). */
  visionFactor: number
  /**
   * "Visão nesta cena" da cena onde ele está, em quadrados. Ausente = a cena
   * não tem valor (ou ele não está em cena): vale o `visionRadius`.
   */
  sceneVisionCells?: number
  /** Cena em que o jogador está, para o painel do mestre. Só com aventura aberta e jogador jogando. */
  sceneName?: string
  /** Id da mesma cena de `sceneName`: é por ele que o "Ir lá" do painel Grupo abre a cena. */
  sceneId?: string
  /**
   * `true` enquanto um pedido de passagem dele espera o mestre. Ausente no
   * resto do tempo: é o que põe o selo "pedido" na cena dele, na lista Cenas.
   */
  travelPending?: true
  /**
   * Quando a conexão dele caiu (relógio do mestre). Só enquanto está fora: é o
   * "fora há 0:10" do Grupo. Dado do painel do mestre — nunca vai pela rede.
   */
  disconnectedAt?: number
  /**
   * Nomes das fichas que o mestre guardou ("Guardar ficha") enquanto ele está
   * fora. Quem preenche é a ponte, que guarda as fichas; a sessão não sabe
   * delas. Dado do painel do mestre — nunca vai pela rede.
   */
  storedTokenNames?: string[]
  /**
   * MARCA "VAMOS PARA CÁ" dele, em px de mundo da cena `sceneId` (a dele), na
   * cor da ficha. Ausente = não marcou, tirou, ou saiu da cena onde marcou.
   * Só vem com `source` no `listPlayers`.
   */
  destination?: { x: number; y: number; color: string }
  /**
   * Nomes de quem joga agora as fichas DELE, emprestadas pelo mestre enquanto
   * ele está fora. Ausente = nada emprestado. Dado do painel do mestre — nunca
   * vai pela rede.
   */
  lentTo?: string[]
  /** Nomes dos donos das fichas que ele joga emprestadas. Ausente = nenhuma. Só do mestre. */
  borrowedFrom?: string[]
  /**
   * Ids das fichas que ele joga emprestadas (estão em `tokenIds`, mas são do
   * dono). "Guardar ficha" não as leva: tirá-las do mapa tiraria a ficha do
   * dono. Ausente = nenhuma. Só do mestre.
   */
  borrowedTokenIds?: string[]
}

/** As fichas do próprio jogador: as dele no mapa, sem as que ele joga emprestadas. */
export function ownTokenIdsOf(player: Pick<PlayerInfo, 'tokenIds' | 'borrowedTokenIds'>): string[] {
  const borrowed = player.borrowedTokenIds ?? []
  return player.tokenIds.filter((tokenId) => !borrowed.includes(tokenId))
}

/** O que foi feito do recado para um jogador: saiu agora, ficou guardado para a volta dele, ou nada (`null`). */
export type PlayerNoteDelivery = 'sent' | 'queued' | null

/**
 * Uma linha do painel PISTAS do mestre: quem RECEBEU o pino (ele saiu, com o
 * texto, no pacote do jogador) e quem o LEU (abriu o cartão, `pin.read`). Ids
 * de jogador, na ordem da sala. `read` está sempre contido em `received`.
 */
export interface PinClueState {
  received: string[]
  read: string[]
}

/** Faixa do "Raio de visão" por jogador, em px de mundo. */
export const VISION_RADIUS_MIN = 50
export const VISION_RADIUS_MAX = 2000
export const VISION_RADIUS_STEP = 50

/**
 * Teto de lotes de laser por jogador a cada `PLAYER_LASER_WINDOW_MS`; o
 * excesso morre em silêncio. O cliente manda um a cada
 * `LASER_SEND_INTERVAL_MS` (50 ms), 20 por segundo: o dobro dá folga para a
 * rede que atrasa uns e entrega vários juntos (um intervalo mínimo entre dois
 * lotes jogaria fora justamente esses), e ainda segura quem inunda.
 */
export const PLAYER_LASER_MAX_PER_WINDOW = 40
export const PLAYER_LASER_WINDOW_MS = 1000

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
 * "Mostrar para…": uma pista mostrada por jogador nesta janela. Só conta o que
 * CHEGOU a alguém — é isso que abre um cartão na tela do colega, e um jogador
 * hostil em laço não pode enterrar a tela dele em cartões.
 */
export const CLUE_SHOW_MIN_INTERVAL_MS = 1000

// Os dois limites do pedido de passagem moram em `protocol.ts`: o cliente do
// jogador lê os mesmos números para esperar sozinho em vez de esbarrar neles.
export { TRAVEL_REQUEST_MIN_INTERVAL_MS, TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS }

/**
 * Quantas cenas cada jogador lembra (exploração e portas vistas). Passou do
 * teto, esquece a cena visitada há mais tempo — menos a cena onde ele ainda
 * tem ficha, que nunca é esquecida: memória de host não pode crescer sem
 * limite numa aventura longa, mas 8 cenas era pouco (uma viagem de ida e
 * volta pela vila já apagava o começo).
 */
export const MAX_SCENE_MEMORIES_PER_PLAYER = 32

/**
 * Um chamado NOVO por jogador nesta janela. Com a mão levantada ele já não
 * empilha (um chamado aberto por jogador); o intervalo segura quem baixa e
 * levanta a mão em série — cada chamado novo é um bipe na mesa do mestre.
 */
export const CALL_MIN_INTERVAL_MS = 3000

/**
 * Quantas cenas guardam o "último recado". O `sceneId` vem da tela do mestre
 * (confiável), mas memória de host não cresce sem limite: passou, esquece a
 * cena que recebeu recado há mais tempo.
 */
export const MAX_SCENE_NOTES = 100

/**
 * Uma rolagem de dado por jogador nesta janela; o excesso morre em silêncio
 * (igual ao sinal). Cada rolagem acende uma linha na tela de TODA a mesa: um
 * jogador em laço não pode enterrar a lista dos outros.
 */
export const DICE_ROLL_MIN_INTERVAL_MS = 400

/**
 * Depois de um "Não" do mestre, quem pediu a ficha espera isto antes de pedir
 * de novo: cada pedido é uma linha nova na caixa do mestre.
 */
export const SEAT_CLAIM_MIN_INTERVAL_MS = 3000

/**
 * Tamanho (caracteres do JSON) da tela INTEIRA a partir do qual a conexão
 * passa a receber `patch`. Abaixo disso a tela inteira é barata (uma sala com
 * duas fichas sem foto fica em ~5 mil) e o snapshot não tem o risco do patch
 * que não encaixa; o que pesa de verdade é a foto das fichas e a planta de uma
 * cena grande, e isso passa daqui folgado. Medida na última tela inteira que a
 * conexão recebeu: o patch não mede nada, então o passo não custa um
 * `JSON.stringify` do mapa.
 */
export const PATCH_MIN_SNAPSHOT_LENGTH = 16_384

export interface HostSessionOptions {
  code: string
  visionRadius: number
  now?: () => number
  randomId?: () => string
  /**
   * INICIATIVA: de quem é a vez no mestre, lida a cada snapshot. Ausente =
   * ninguém. O jogador só recebe o recorte disto (`turnForPlayer`).
   */
  getTurn?: () => TurnRef | null
  /**
   * RELÓGIO DA CAMPANHA: a hora do dia no mestre (0 a 23), lida a cada
   * snapshot. Ausente ou `null` = sem relógio. O jogador só recebe o recorte
   * disto (`clockForPlayer`); a cena externa à noite encolhe a visão dele.
   */
  getClock?: () => number | null
  /** Chave da tela da mesa (teste). Ausente = um UUID novo por sala, fora de `randomId`. */
  tableKey?: string
  /**
   * Retomar a mesa: os assentos guardados. Quem entra (sem resume) com o nome
   * de um deles — sem maiúsculas nem espaços — reencontra as fichas, o raio e
   * a cena; cada assento vale uma vez. Ausente = a sala de hoje.
   */
  restoreSeats?: readonly SavedSeat[]
  /**
   * Retomar a mesa: o mapa explorado de cada assento guardado (por nome). Só
   * quem REENCONTRA o assento recebe a memória dele; ela chega ao jogador pelo
   * recorte de sempre, cena a cena. Ausente = todos começam do zero.
   */
  restoreExploration?: readonly SavedSeatExploration[]
  /** O dado do host. Ausente = o gerador do sistema (`secureRollDie`); o teste injeta faces fixas. */
  rollDie?: RollDie
  /** Só para teste: troca `PATCH_MIN_SNAPSHOT_LENGTH` (0 = todo mapa recebe patch). */
  patchMinSnapshotLength?: number
}

export interface HostSession {
  handleMessage(clientId: string, raw: unknown, source: HostMapSource): HostResult
  /** Devolve `lobby.waiting` para quem perdeu o último token (dono anterior). */
  assignToken(playerId: string, tokenId: string): HostResult
  /** Devolve `lobby.waiting` se o jogador ficou sem token. */
  unassignToken(playerId: string, tokenId: string): HostResult
  /**
   * EMPRESTAR A FICHA de quem saiu: as fichas de `ownerId` (fora) passam a ser
   * movidas também por `borrowerId` (conectado), até o dono voltar. O dono não
   * muda: a mesa grava a ficha no assento dele, e o que ela vê entra no
   * explorado dele. Só fichas de UMA cena — a de quem recebe, se ele já está
   * numa; senão, a do dono —: ninguém passa a ver duas cenas. Quem joga
   * emprestado não troca o nome nem a foto da ficha. `lent`: as fichas
   * emprestadas agora; vazio = nada mudou (dono conectado ou desconhecido,
   * quem recebe fora, o mesmo jogador, ficha já emprestada ou de outra cena).
   * Não envia: o integrador faz o broadcast.
   */
  lendTokens(ownerId: string, borrowerId: string, source: HostMapSource): HostResult & { lent: string[] }
  /**
   * "Tomar de volta": encerra os empréstimos das fichas de `ownerId`. Quem as
   * jogava e ficou sem ficha volta à espera. A volta do dono (resume ou "É
   * ela") faz o mesmo sozinha.
   */
  endLoans(ownerId: string): HostResult
  /**
   * A conexão caiu. `at` = quando se ouviu dela por último (a varredura de
   * conexão muda sabe que ela sumiu ANTES de notar); ausente, agora.
   */
  disconnect(clientId: string, at?: number): void
  kick(clientId: string): HostResult
  /**
   * "É ela" da pergunta "Ana voltou?": a conexão de `playerId` (quem entrou
   * agora) passa a ser a Ana `previousId` — fichas, memórias e raio dela, e o
   * resume dela. `playerId` some da lista; o que ele tinha (ficha que o mestre
   * deu nesse meio-tempo, cena que ele viu) passa à Ana. Devolve o `welcome`
   * da Ana e o que ela vê agora, só para essa conexão. Pergunta que já não
   * vale (respondida, a Ana voltou pelo resume, um dos dois saiu): nada.
   */
  confirmReturn(playerId: string, previousId: string, source: HostMapSource): HostResult
  /** "Outra pessoa": a pergunta sai e nada muda. */
  denyReturn(playerId: string): void
  /** A pergunta "voltou?" sobre quem entrou como `playerId` ainda espera o mestre? */
  isReturnPending(playerId: string): boolean
  /**
   * "Dispensar": esquece quem está FORA (o card sai e o resume dele deixa de
   * valer). `false` para quem está conectado — esse é o "Expulsar" — ou
   * desconhecido.
   */
  dismissPlayer(playerId: string): boolean
  /**
   * `room.closed` para todo jogador conectado (jogando ou aguardando) e toda tela da mesa. O
   * integrador envia isto ANTES de derrubar a sala, para o jogador ler "O
   * mestre encerrou a sala" e não "A conexão caiu". Não mexe no estado.
   */
  closeRoom(): HostResult
  /**
   * Snapshot para todo jogador conectado e jogando, cada um da cena ONDE ELE
   * ESTÁ — mas só para quem a tela mudou desde o último que recebeu, e a quem
   * sabe aplicar só o que mudou nela (`patch`). `rev` sobe a cada chamada,
   * mande ou não.
   */
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
   * vazio não sai. `outbound.length` é quantos receberam AGORA.
   *
   * CADERNO: o recado vira o último da cena e entra no caderno de cada um que
   * recebeu. Quem entra ou volta à sala recebe o caderno dele (`notes.book`)
   * e o último recado da cena onde está; quem chega à cena depois (viagem,
   * ficha nova) recebe o último recado dela no broadcast, se ainda não o tem.
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
   * ALARME PARA VÁRIAS CENAS: `scene.alarm` a quem joga e está AGORA numa das
   * `sceneIds` (`sceneFor`), com o texto cortado no teto (`ALARM_MAX_LENGTH`).
   * Diferente do recado, o alarme FICA: substitui o que estiver soando, segue
   * quem entra numa dessas cenas depois (viagem, reconexão) e sai de quem
   * deixa todas elas, até `endAlarm`. Texto vazio ou nenhuma cena existente:
   * nada muda e nada sai.
   */
  sceneAlarm(sceneIds: readonly string[], text: string, source: HostMapSource): HostResult
  /** Encerra o alarme: `scene.alarm.end` só a quem o mostra agora. Sem alarme, nada sai. */
  endAlarm(source: HostMapSource): HostResult
  /** O alarme soando, para o painel do mestre; `null` = nenhum. */
  activeAlarm(): { id: string; text: string; sceneIds: string[] } | null
  /**
   * DADO ROLADO NA SALA pelo mestre: o host rola e devolve a rolagem em
   * `diceRoll`. Aberta, `dice.rolled` vai a todo jogador conectado, como
   * "Mestre"; `hidden`, não sai para ninguém — só a tela do mestre a mostra.
   */
  masterRoll(request: DiceRequest, hidden: boolean): HostResult
  /**
   * RUÍDO NO MAPA: o mestre fez um ruído em (`x`, `y`) da cena ABERTA no
   * editor (é o mapa em que ele clicou). Quem joga nessa cena e tem ficha a
   * até `rangeCells` casas (preso na faixa de `lib/noise.ts`) recebe `noise`
   * só com a DIREÇÃO, pelo recorte de `noiseCueForPlayer`. Nada fica guardado:
   * quem entra depois não ouve. `outbound.length` é quantos ouviram.
   */
  noise(x: number, y: number, rangeCells: number, source: HostMapSource): HostResult
  /**
   * TESTE SECRETO: `secret.check` (só id e nome do teste, aparado e cortado
   * no teto) para os escolhidos que estão na sala e jogando, estejam em que
   * cena estiverem. Quem não foi escolhido não recebe nada. Escolhido que
   * caiu recebe o pedido ao voltar, enquanto não responder e o mestre não
   * encerrar. Nome vazio ou ninguém válido: nada, e nenhum teste é criado.
   * `secretCheckId` no resultado é o id do teste criado.
   */
  secretCheck(label: string, playerIds: readonly string[]): HostResult
  /** Encerra o teste: `secret.check.closed` a quem foi pedido, está conectado e não respondeu. Resposta depois disso não conta. */
  closeSecretCheck(checkId: string): HostResult
  /** Os testes secretos, do mais antigo ao mais novo, para o painel do MESTRE. */
  secretChecks(): SecretCheckState[]
  /**
   * "Deixar ir": revalida o pedido contra o mundo de AGORA (o token pode ter
   * andado, o pino sumido) e devolve `applyTransfer` + `scene.changed` ao
   * dono. Pedido que já não existe (jogador saiu, já decidido) não faz nada.
   */
  approveTravel(requestId: string, source: HostMapSource): HostResult
  /**
   * "Passar para pede" do pedido pelo pino trancado: a mesma aprovação do
   * `approveTravel` e, só se o jogador passou, `applyPinPassage` com o pino
   * em "pede" — daí em diante cada passagem pergunta ao mestre. Pedido que não
   * veio de pino trancado: só a aprovação, sem mudar modo nenhum.
   */
  approveLockedTravelAsAsk(requestId: string, source: HostMapSource): HostResult
  /**
   * "Não": `pin.travel.denied` ao jogador. Pedido que já não existe não faz nada.
   * `text` ("Não, porque…"): o motivo vai junto, aparado e cortado no teto
   * (`TRAVEL_DENY_TEXT_MAX_LENGTH`), só para quem pediu; em branco = sem motivo.
   */
  denyTravel(requestId: string, text?: string): HostResult
  /**
   * "Ver" do pedido: a cena e a ficha de quem pediu, AGORA (a ficha pode ter
   * andado desde o aviso). Não responde nada. `null` sem pedido esperando ou
   * sem ficha em cena.
   */
  travelTarget(requestId: string, source: HostMapSource): CallTarget | null
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
   * "Nada aqui" (`nothing`) ou "Feito" (`seen`) da ação no ponto: a resposta
   * vai SÓ à conexão atual de quem pediu. Pedido já respondido, de jogador
   * expulso, ou jogador sem conexão agora: nada sai.
   */
  answerPointAction(requestId: string, answer: PointActionAnswer): HostResult
  /** A ação no ponto ainda espera o mestre? `false` depois de respondida ou com o jogador expulso. */
  isPointActionPending(requestId: string): boolean
  /**
   * QUEM CHEGA ESCOLHE A FICHA: `seat.options` para cada jogador conectado e
   * sem personagem cuja lista de fichas livres MUDOU desde o último envio
   * àquela conexão (o `join` já manda a primeira). Seguro chamar a cada
   * evento: sem mudança, `outbound` sai vazio.
   */
  seatOptionsUpdates(source: HostMapSource): HostResult
  /**
   * "Aceitar" do pedido de ficha: revalida contra o mundo de AGORA (a ficha
   * continua livre e marcada, quem pediu continua sem personagem) e dá a
   * ficha (`assignToken`). Não valendo mais: `seat.claim.state unavailable` a
   * quem pediu. Pedido que já não existe: nada.
   */
  approveSeatClaim(requestId: string, source: HostMapSource): HostResult
  /** "Não": `seat.claim.state denied` a quem pediu. Pedido que já não existe: nada. */
  denySeatClaim(requestId: string): HostResult
  /** O pedido de ficha ainda espera o mestre? `false` depois de respondido, ou quando quem pediu caiu ou ganhou ficha. */
  isSeatClaimPending(requestId: string): boolean
  /**
   * "Mandar para…" do painel Grupo: o MESTRE leva o jogador, sem pedido, para
   * `toSceneId` — no pino de viagem `pinId` daquela cena ou, com `null`, no
   * centro dela. Devolve o mesmo par da aprovação (`applyTransfer` +
   * `scene.changed`, este marcado `by: 'master'`). Destino inválido, jogador
   * sem ficha em cena ou já na cena de destino: nada.
   *
   * `gatherAt` é o "Reunir o grupo aqui": a ficha chega nessa casa (já
   * escolhida livre por `lib/gatherParty.ts`), `pinId` é ignorado e o aviso
   * sai como `by: 'gather'`. O séquito vem nas casas de `gatherAt.entourage`,
   * mas só a ficha que é séquito de verdade (dele, no tabuleiro, a até 2 casas).
   */
  sendPlayer(playerId: string, toSceneId: string, pinId: string | null, source: HostMapSource, gatherAt?: GatherArrival): HostResult
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
   * CARAVANA NO MAPA-MUNDI: em cada cena marcada como mapa-mundi, as fichas do
   * grupo seguem a que o mestre arrastou (`caravanStep`) e ficam empilhadas no
   * ponto da caravana. Devolve os movimentos a aplicar e as cidades onde uma
   * caravana está parada agora. Não envia nada: o integrador aplica e faz o broadcast.
   *
   * `cause: 'history'` = a cena aberta acabou de voltar por desfazer/refazer:
   * lá nada foi arrastado, e a caravana só se reconhece no retrato
   * (`caravanRegroup`) em vez de seguir quem "saiu" do ponto dela.
   */
  followCaravans(source: HostMapSource, cause?: MapChangeCause): CaravanFollow
  /**
   * "Desembarcar": cada ficha da caravana da cena `sceneId` vai para a cidade
   * sob ela, numa casa livre em volta do pino par. Cada jogador recebe um
   * `scene.changed` (`by: 'master'`) e passa a ver a cidade com a própria
   * ficha de volta. Sem caravana, sem cidade ou cena que não é mapa-mundi: `[]`.
   */
  disembarkCaravan(sceneId: string, source: HostMapSource): CaravanArrival[]
  /**
   * "Trazer" do painel Grupo: a ficha `tokenId` do jogador, esquecida em
   * OUTRA cena (a Faísca que ficou na Vila), vem para a casa livre colada à
   * ficha dele, na cena em que ele está. Só `applyTransfer`, sem
   * `scene.changed`: o jogador não trocou de cena, e a ficha aparece no
   * próximo broadcast. Nada: jogador desconhecido ou esperando, ficha que não
   * é dele, que já está na cena dele ou que não existe, ou sem casa livre.
   */
  bringToken(playerId: string, tokenId: string, source: HostMapSource): HostResult
  /**
   * Raio de visão só deste jogador (limitado à faixa); `null` volta ao global.
   * Não envia: o integrador faz o broadcast. Jogador desconhecido ou raio não finito é ignorado.
   */
  setVisionRadius(playerId: string, radius: number | null): void
  /**
   * "Fator de visão" deste jogador (limitado à faixa de `lib/sceneVision.ts`),
   * que multiplica o alcance de toda cena; `null` volta a x1,0. Não envia: o
   * integrador faz o broadcast. Jogador desconhecido ou fator não finito é ignorado.
   */
  setVisionFactor(playerId: string, factor: number | null): void
  /**
   * "Quem vê" do pino `pinId`: só estes jogadores o recebem (`lib/fogFilter.ts`).
   * `null` = Todos (apaga a lista). Id que não é de jogador da sala é ignorado;
   * lista vazia vale ("Só estes" sem ninguém: ninguém recebe). Não envia: o
   * integrador faz o broadcast. A lista vive só nesta sessão.
   */
  setPinAudience(pinId: string, playerIds: readonly string[] | null): void
  /** A lista de `setPinAudience`, na ordem de entrada na sala; `null` = Todos. */
  pinAudience(pinId: string): string[] | null
  /** Todas as listas, por pino, para o painel do mestre. Pino de "Todos" não aparece. */
  pinAudiences(): Record<string, string[]>
  /**
   * PAINEL PISTAS: por pino, quem recebeu e quem leu. Recebeu é para sempre
   * nesta sessão — esconder o pino depois não desfaz o que o jogador já leu
   * na tela; só o kick apaga. Pino que ninguém recebeu não aparece.
   */
  pinClues(): Record<string, PinClueState>
  /**
   * "Revelar para…" da ficha secreta, da escada secreta ou da zona oculta
   * `itemId`: só estes jogadores a recebem (`lib/fogFilter.ts`; a ficha ainda
   * exige visão). `null` ou lista vazia = segredo de todos de novo. Id que não é
   * de jogador da sala é ignorado. Não envia: o integrador faz o broadcast. A
   * lista vive só nesta sessão.
   */
  setSecretReveal(itemId: string, playerIds: readonly string[] | null): void
  /** A lista de `setSecretReveal`, na ordem de entrada na sala; `[]` = ninguém. */
  secretReveal(itemId: string): string[]
  /** Todas as listas, por item, para o painel do mestre. Item sem ninguém não aparece. */
  secretReveals(): Record<string, string[]>
  /** Marca a planta inteira da cena onde o jogador está como explorada, fora de zona oculta ativa. Tokens seguem exigindo visão. */
  revealPlan(playerId: string, source: HostMapSource): void
  /**
   * "Revelar planta para…": a planta da cena `sceneId` fica revelada para estes
   * jogadores, estejam onde estiverem — quem está em outra cena não recebe nada
   * agora; a planta aparece quando ele chega lá. Id que não é de jogador da
   * sala é ignorado. Devolve quantos jogadores ganharam a planta (0 = cena que
   * não existe ou ninguém válido). Não envia: o integrador faz o broadcast.
   */
  revealPlanFor(sceneId: string, playerIds: readonly string[], source: HostMapSource): number
  /**
   * "Dar o que o grupo viu": soma à memória do jogador, na cena ONDE ELE ESTÁ,
   * o que cada colega VIU lá (a visão deles, não a planta que o mestre revelou
   * a algum deles), fora do que zona oculta, sala secreta e teto escondem
   * agora. Devolve quantos colegas tinham memória da cena (0 = nada a dar).
   * Não envia: o integrador faz o broadcast.
   */
  giveGroupView(playerId: string, source: HostMapSource): number
  /**
   * Zera exploração e portas lembradas do jogador; a visão atual volta a
   * marcar no próximo broadcast. Com `source`, só da cena onde ele está; sem,
   * de todas.
   */
  hidePlan(playerId: string, source?: HostMapSource): void
  /**
   * O envio para esta conexão falhou (fila cheia, socket caindo): ela não tem
   * a tela que o host acha que tem. O próximo broadcast manda a inteira.
   */
  forgetView(clientId: string): void
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
  /**
   * TELA DA MESA: a cena que a TV mostra (`tableSceneKey`), ou `null` = a tela
   * espera. Não envia: o integrador faz o broadcast. Cena que não está aberta
   * (nem na aventura, nem no cache) também deixa a tela esperando.
   */
  setTableScene(key: string | null): void
  /** A cena escolhida para a tela da mesa, como `setTableScene` a recebeu. */
  tableScene(): string | null
  /** Quantas telas da mesa estão conectadas agora. */
  tableScreens(): number
  /** A conexão é de uma tela da mesa (e não de jogador). */
  isTable(clientId: string): boolean
  /** TELA DA MESA: a chave que o `join` da TV precisa trazer, além do código. Vai só no link da aba Jogo. */
  tableKey(): string
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
  /**
   * "Desfazer" do aviso de ficha devolvida: tira as fichas que o assento deu
   * (as que o mestre deu depois ficam), volta o raio ao padrão e devolve o
   * assento para quem chegar depois com o nome. Sem devolução em aberto, nada.
   */
  undoReclaim(playerId: string): HostResult
  /**
   * A mesa a gravar: quem está com ficha agora e os assentos de quem ainda não
   * voltou (menos as fichas que já têm outro dono). Só do mestre.
   *
   * `held`: por playerId, as fichas fora do mapa que continuam sendo dele (o
   * "Guardar ficha" da ponte, que a sessão não conhece). Contam como dele: a
   * ficha guardada volta a ele na retomada, e o assento não some da mesa.
   */
  savedSeats(held?: HeldTokens): SavedSeat[]
  /**
   * O mapa explorado a gravar, com os mesmos nomes de `savedSeats`: a memória
   * de agora de quem está com ficha, e a guardada de quem ainda não voltou.
   * Só do mestre. `held` como em `savedSeats`.
   */
  savedExploration(held?: HeldTokens): SavedSeatExploration[]
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

/** Um teste secreto no host: quem foi pedido, o que cada um respondeu e se ainda aceita resposta. */
interface SecretCheckRecord {
  label: string
  asked: Set<string>
  answers: Map<string, number>
  open: boolean
}

/** Não espera mais ninguém: encerrado, ou todo pedido já respondeu. Apagar não deixa cartão órfão. */
function isSecretCheckSettled(check: SecretCheckRecord): boolean {
  return !check.open || [...check.asked].every((playerId) => check.answers.has(playerId))
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
  /** Veio de um pino trancado que aceita tentativas: a aprovação do mestre passa pelo cadeado. */
  trancada?: true
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
  /** CHAVE ABRE PORTA: o pino é trancado e `token` passa com este item da mochila. */
  key?: string
}

/** O que um jogador lembra de um mapa: células exploradas, último estado visto de cada porta e a planta como ele a viu. */
interface PlayerMemory {
  key: string
  /**
   * O mapa a que o explorado corresponde: é o que a mesa grava para retomar.
   * Com a mesma grade, redimensionar o mapa leva o explorado junto e troca isto.
   */
  dims: MemoryDims
  exp: Exploration
  /**
   * Só o que a VISÃO dele marcou (sem "Revelar planta" nem planta conhecida).
   * É o que "Dar o que o grupo viu" repassa: a planta que o mestre revelou a
   * um jogador não pode vazar para o colega por esse caminho.
   */
  seen: Exploration
  /** A planta revelada (da cena ou por "Revelar planta para…") já foi marcada nesta memória. */
  planMarked: boolean
  doors: Map<string, DoorState>
  /** Por id da parede: quando (`doorSeenSeq`) a porta foi vista por último. Só a tela da mesa usa. */
  doorsSeenAt: Map<string, number>
  /** Visão enviada no último snapshot: é o que o jogador está vendo agora na tela. */
  vision: RegionPoint[][]
  /**
   * Veio da mesa guardada e ainda não foi conferida contra o mapa de hoje: no
   * primeiro uso, o que o mestre escondeu desde então sai da memória.
   */
  restored: boolean
  /**
   * CÔMODO LEMBRADO — ids dos cômodos (`RoomMeta.comodo`) que o jogador já viu
   * neste mapa. Mora junto do explorado de propósito: "Esconder planta" e o
   * mapa redimensionado esquecem os dois de uma vez.
   */
  seenRooms: Set<string>
  /**
   * LUGARES: o id desta memória que vai ao jogador (`snapshot.place`). Nasce
   * com a memória e morre com ela ("Esconder planta", teto de cenas, kick):
   * memória nova é lugar novo. É um contador DO JOGADOR, nunca o id nem o nome
   * da cena: o mesmo id em dois jogadores não diz que eles estão no mesmo lugar.
   */
  place: string
  /**
   * A última versão VISTA de cada item da planta (`lib/fogFilter.ts`). Fora da
   * visão, o explorado mostra esta — o que o mestre mudou longe do jogador só
   * chega quando ele volta a ver o lugar. Só o snapshot a atualiza.
   */
  plan: PlanMemory
}

type MemoryDims = Pick<MapData, 'id' | 'width' | 'height' | 'grid'>

/** Põe `member` no conjunto de `key`, criando o conjunto na primeira vez. */
function addToSet(sets: Map<string, Set<string>>, key: string, member: string): void {
  const found = sets.get(key)
  if (found === undefined) sets.set(key, new Set([member]))
  else found.add(member)
}

/** Chave de comparação do nome: sem maiúsculas e sem espaços. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '')
}

function memoryKey(map: MemoryDims): string {
  return `${map.id}|${map.width}|${map.height}|${map.grid}`
}

/** MapData.width/height estão em células; o explorado mede px de mundo (mesma unidade da visão). */
function worldSizeOf(map: MemoryDims): { width: number; height: number; grid: number } {
  return { width: map.width * map.grid, height: map.height * map.grid, grid: map.grid }
}

function dimsOf(map: MapData): MemoryDims {
  return { id: map.id, width: map.width, height: map.height, grid: map.grid }
}

/** Explorado vazio do tamanho do mapa. */
function blankExploration(map: MemoryDims): Exploration {
  return createExploration(worldSizeOf(map))
}

/** A memória como a mesa a grava: o fio do explorado e as portas vistas. */
function savedSceneOf(memory: PlayerMemory): SavedSceneMemory {
  const { id, width, height, grid } = memory.dims
  return {
    mapId: id,
    width,
    height,
    grid,
    explored: encodeExploration(memory.exp),
    doors: [...memory.doors].map(([wallId, door]) => ({ wallId, open: door.open, locked: door.locked, kind: door.kind })),
  }
}

/**
 * A memória guardada de volta, ou `null` quando o fio está torto ou não tem o
 * tamanho que o mapa gravado daria hoje (bitset de outro tamanho leria células erradas).
 */
function restoredMemoryOf(scene: SavedSceneMemory): Omit<PlayerMemory, 'place'> | null {
  const dims: MemoryDims = { id: scene.mapId, width: scene.width, height: scene.height, grid: scene.grid }
  const exp = decodeExploration(scene.explored)
  const blank = blankExploration(dims)
  if (exp === null || exp.cell !== blank.cell || exp.cols !== blank.cols || exp.rows !== blank.rows) return null
  const doors = new Map<string, DoorState>(scene.doors.map((door) => [door.wallId, { open: door.open, locked: door.locked, kind: door.kind }]))
  // Cômodo lembrado não é gravado na mesa: volta a ser lembrado quando for visto de novo.
  return {
    key: memoryKey(dims),
    dims,
    exp,
    seen: blankExploration(dims),
    planMarked: false,
    doors,
    doorsSeenAt: new Map(),
    vision: [],
    restored: true,
    seenRooms: new Set(),
  }
}

interface PlayerRecord {
  playerId: string
  name: string
  resumeToken: string
  clientId: string | null
  joinedAt: number
  /** Quando caiu; `null` enquanto conectado. */
  disconnectedAt: number | null
}

/**
 * A última tela que uma CONEXÃO recebeu, e de quais entradas ela saiu. É o que
 * deixa o broadcast mandar só o que mudou: o mapa da cena (referência — o
 * `mapStore` e o cache da aventura trocam o objeto a cada edição, nunca o
 * alteram no lugar), o raio, a posse e a memória do jogador.
 */
interface SentView {
  playerId: string
  /** Mapa da cena de onde a tela saiu; `null` = a espera (sem cena). */
  map: MapData | null
  radius: number
  ownershipRev: number
  memory: PlayerMemory | undefined
  /** O que a conexão tem na tela; `null` = a espera. É de onde sai o próximo `patch`. */
  view: PlayerViewContent | null
  /** `rev` da última tela que a conexão recebeu: a `base` do próximo `patch`. */
  rev: number
  /**
   * Caracteres do JSON da última tela INTEIRA que a conexão recebeu (0 = não
   * medida: espera, ou conexão que não aplica `patch`). Decide se vale
   * mandar `patch` (`PATCH_MIN_SNAPSHOT_LENGTH`).
   */
  snapshotLength: number
  /**
   * O último recálculo, com estas MESMAS entradas, repetiu a tela e deixou a
   * memória como estava: recalcular de novo daria o mesmo, e o recorte pode
   * ser pulado. O primeiro recálculo depois de uma mudança nunca é estável — a
   * marcação do explorado pode mostrar mais no seguinte.
   */
  stable: boolean
}

type SnapshotMessage = Extract<HostMessage, { type: 'snapshot' }>

/** O que sai na tela do jogador, sem o `rev` (que muda a cada broadcast). */
function contentOf(msg: SnapshotMessage): PlayerViewContent {
  return { map: msg.map, vision: msg.vision, explored: msg.explored, ownTokens: msg.ownTokens, concealed: msg.concealed }
}

/** Mesmas entradas, item a item (a planta lembrada guarda o objeto do mapa, não cópia). */
function samePlan(a: PlanMemory, b: PlanMemory): boolean {
  const keys = ['walls', 'floor', 'regions', 'drawings', 'markers', 'lines', 'stairs', 'pins'] as const // chaves de PlanMemory, conferidas pelo tsc
  return keys.every((key) => {
    const left: ReadonlyMap<string, unknown> = a[key]
    const right: ReadonlyMap<string, unknown> = b[key]
    if (left.size !== right.size) return false
    for (const [id, item] of left) if (right.get(id) !== item) return false
    return true
  })
}

function doorsKey(doors: ReadonlyMap<string, DoorState>): string {
  return JSON.stringify([...doors])
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
  // LUGARES — por playerId: quantas memórias de cena ele já teve. Dá o id da
  // próxima (`PlayerMemory.place`) sem nunca repetir um que ele já viu. Um
  // contador e não `randomId`: o id só precisa não dizer nada da cena, e o
  // contador de UM jogador só conta o que ele mesmo visitou. Só o kick apaga.
  const placeCounters = new Map<string, number>()
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
  // Por playerId: a última rolagem de dado (DICE_ROLL_MIN_INTERVAL_MS). Reconectar não zera.
  const lastDiceRollAt = new Map<string, number>()
  const rollDie = options.rollDie ?? secureRollDie
  // Por playerId: janela corrente do teto de lotes de laser (PLAYER_LASER_MAX_PER_WINDOW).
  const laserWindows = new Map<string, { start: number; count: number }>()
  // Por playerId: conexões que receberam algum ponto do gesto em curso, e a
  // cena (`sceneKey`) onde o gesto acontece. O `off` vai só a elas — a quem
  // nada viu, nem o aviso de que o gesto acabou. Lote vindo de outra cena
  // (off perdido na viagem) recomeça a lista: ela nunca atravessa cena.
  const laserRecipients = new Map<string, { scene: string; clients: Set<string> }>()
  // Por playerId: o pedido da porta trancada que espera o mestre (no máximo um).
  const pendingDoors = new Map<string, PendingDoor>()
  // Por playerId: o mesmo limite do toque, para o pedido da porta trancada.
  const lastDoorRequestAt = new Map<string, number>()
  // Por playerId: o pedido de item que espera o mestre (no máximo um).
  const pendingItems = new Map<string, PendingItem>()
  // Por playerId: o mesmo limite do toque na porta, para "Pegar" e para "Dar a…".
  const lastItemTakeAt = new Map<string, number>()
  const lastItemGiveAt = new Map<string, number>()
  // Por playerId: o mesmo limite do toque na porta, para puxar a alavanca.
  const lastLeverAt = new Map<string, number>()
  // Por playerId: a porta que ele espia agora (uma só), na cena em que espiou,
  // até quando. Vencida, some na próxima leitura; o kick apaga.
  const peeks = new Map<string, { sceneKey: string; wallId: string; until: number }>()
  // Por playerId: limite da foto nova do próprio token (só da foto, ver TOKEN_PHOTO_MIN_INTERVAL_MS).
  const lastTokenPhotoAt = new Map<string, number>()
  // Por playerId: ajuste do mestre sobre `options.visionRadius`; só o kick apaga.
  const visionOverrides = new Map<string, number>()
  // TEXTO DA SALA — por playerId, por mapa (`MapData.id`): as Salas com texto
  // em que ele já entrou. Sobrevive a reconexão e a "Esconder planta" (o cartão
  // não repete); só o kick apaga.
  const enteredRooms = new Map<string, Map<string, Set<string>>>()
  // Por sceneId da aventura: o último recado mandado para a cena. É o que
  // quem chega ou volta recebe. Na ordem do último recado (a primeira sai no teto).
  const lastNoteByScene = new Map<string, NoteEntry>()
  // Por playerId: o caderno, só com recados que ESTE jogador recebeu, do mais
  // antigo ao mais novo. Sobrevive a disconnect/resume; só o kick apaga.
  const notebooks = new Map<string, NoteEntry[]>()
  // Por playerId: a cena (sceneId, ou `null` sem cena) em que o último recado
  // de chegada já foi avaliado. Mudou, é chegada: vale o último recado de lá.
  const noteSceneOf = new Map<string, string | null>()
  // MINHAS PISTAS — por playerId: o caderno de pistas, da mais antiga à mais
  // nova. `source` (pino ou Sala + mapa) é a chave de "já tenho esta" e NUNCA
  // sai pela rede: o jogador só vê o `id` que o host inventou. Sobrevive a
  // disconnect/resume; só o kick apaga.
  const cluebooks = new Map<string, { source: string; entry: ClueEntry }[]>()
  // Por playerId: os pinos do ÚLTIMO recorte mandado (já passados pelo
  // `pinForPlayer`) e o mapa de onde vieram. É o que o jogador está vendo: só
  // pino daqui vira pista.
  const seenPins = new Map<string, { mapId: string; pins: Pin[] }>()
  // Por playerId: quando a última pista mostrada chegou a um colega.
  const lastClueShowAt = new Map<string, number>()
  // Por playerId: "Fator de visão" (vale em toda cena); ausente = x1,0. Só o kick apaga.
  const visionFactors = new Map<string, number>()
  // Por pinId: quem vê o pino ("Só estes"). Ausente = Todos. O kick tira o
  // jogador de toda lista; o registro de quem só caiu fica (resume).
  const pinAudiences = new Map<string, Set<string>>()
  // TELA DA MESA: conexões de espectador. Nunca entram em `byClient` nem em
  // `players` — não têm ficha, memória nem nome na lista do mestre.
  const tableClients = new Set<string>()
  // A cena que a tela mostra (`tableSceneKey`); `null` = a tela espera.
  let tableSceneChoice: string | null = null
  // Separada do código da sala (que todo jogador tem) e de `randomId` (ids de
  // jogador): só quem tem o link da TV entra como tela.
  const tableKey = options.tableKey ?? crypto.randomUUID()
  // Relógio das portas lembradas: cresce a cada porta vista, de qualquer
  // jogador. A tela junta a memória do grupo pela vista mais recente.
  let doorSeenSeq = 0
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
  const pendingNotes = new Map<string, NoteEntry>()
  // Por playerId: o chamado aberto dele (no máximo um).
  const openCalls = new Map<string, OpenCall>()
  // Por playerId: quando o último chamado NOVO dele entrou. Sobrevive ao disconnect; só o kick apaga.
  const lastCallAt = new Map<string, number>()
  // Por playerId de quem entrou agora: a Ana (fora) que ele talvez seja, até o
  // mestre responder "voltou?". Só do mestre; nada disto vai pela rede.
  const pendingReturns = new Map<string, string>()
  // Por tokenId: a ficha de quem está fora que outro jogador joga agora. A
  // ficha fica em `ownership` dos DOIS (o dono continua dono; quem a joga a
  // move e vê por ela); a volta do dono a tira de quem a jogava.
  const loans = new Map<string, { ownerId: string; borrowerId: string }>()
  let callSeq = 0
  // Por requestId: ações no ponto à espera do mestre. Sobrevivem à queda da
  // conexão (o mestre ainda quer ler "procuro armadilha aqui"); só a resposta
  // e o kick apagam.
  const pendingPointActions = new Map<string, { playerId: string; action: PointActionKind }>()
  // Por playerId: último pedido de ação no ponto aceito pelo intervalo mínimo.
  const lastPointActionAt = new Map<string, number>()
  // Retomar a mesa: assentos guardados que ninguém reclamou ainda, e o assento
  // que cada jogador reclamou (por playerId), para o "Desfazer" do mestre.
  const pendingSeats: SavedSeat[] = (options.restoreSeats ?? []).map((seat) => ({ ...seat, tokenIds: [...seat.tokenIds] }))
  // O mapa explorado de cada assento que ainda não voltou, pelo nome normalizado.
  // O primeiro com o nome vale (é o que a mesa gravou para ele).
  const pendingExploration = new Map<string, SavedSeatExploration>()
  for (const seat of options.restoreExploration ?? []) {
    const key = normalizeName(seat.name)
    if (!pendingExploration.has(key)) pendingExploration.set(key, seat)
  }
  // `exploration`: o que o assento trouxe, para o "Desfazer" devolvê-lo intacto;
  // `restoredMapIds`: as cenas cuja memória veio dele.
  const claimedSeats = new Map<string, { seat: SavedSeat; given: string[]; exploration: SavedSeatExploration | undefined; restoredMapIds: string[] }>()
  // MARCA "VAMOS PARA CÁ" — por playerId: a marca dele e a cena (`sceneKey`)
  // onde a pôs. Uma por jogador; fica até ele tirar, perder a ficha ou sair
  // daquela cena (`pruneDestinations`). Sobrevive a disconnect; só o kick apaga.
  const destinations = new Map<string, { scene: string; x: number; y: number }>()
  // Por playerId: quando pôs a última marca (DESTINATION_MIN_INTERVAL_MS).
  const lastDestinationAt = new Map<string, number>()
  // Por playerId: a última lista de marcas mandada a ele (JSON). Só sai lista
  // nova quando muda; ausente = nada mandado nesta conexão (vale lista vazia).
  const sentDestinations = new Map<string, string>()
  // Por playerId: o pedido de ficha de quem chegou sem personagem, à espera do
  // mestre (no máximo um). Morre com a queda, a resposta, ou a ficha que chega.
  const pendingSeatClaims = new Map<string, { requestId: string; tokenId: string }>()
  // Por playerId: quando o mestre disse "Não" ao último pedido de ficha dele.
  const lastSeatClaimDeniedAt = new Map<string, number>()
  // Por clientId: a última lista de fichas livres enviada àquela conexão (JSON).
  // Por conexão, e não por jogador: quem reconecta tem tela nova.
  const lastSeatOptionsSent = new Map<string, string>()
  // Por id de ficha secreta, escada secreta ou zona oculta: a quem o mestre
  // revelou ("Revelar para…"). Ausente = ninguém. O kick tira o jogador.
  const secretReveals = new Map<string, Set<string>>()
  // Por id de CENA da aventura: quem ganhou a planta pelo "Revelar planta
  // para…". Vale até o jogador chegar lá (e depois); "Esconder de novo" e o
  // kick tiram. Vive só nesta sessão, como o "Quem vê" dos pinos.
  const planGrants = new Map<string, Set<string>>()
  // Por pinId: quem recebeu o pino COM o texto (painel Pistas). Só entra pino
  // que saiu de verdade num recorte: o tamanho fica preso aos pinos reais, e o
  // `pin.read` de um id inventado nunca vira chave aqui. O kick tira o jogador.
  const pinReceived = new Map<string, Set<string>>()
  // Por pinId: quem abriu o cartão. Subconjunto de `pinReceived`.
  const pinRead = new Map<string, Set<string>>()
  // Por id de teste secreto, na ordem em que o mestre pediu (a do Map). Até
  // `MAX_SECRET_CHECKS`: sai primeiro o encerrado ou já respondido por todos,
  // e só sem nenhum desses o mais antigo (encerrado, com aviso). O kick tira o jogador.
  const secretChecks = new Map<string, SecretCheckRecord>()
  // Quem recebeu `lobby.waiting` depois do último mapa: o cliente apagou o
  // cartão do teste secreto, então o próximo snapshot leva os pedidos de novo.
  const lostSecretCheckCard = new Set<string>()
  // Por clientId: a última tela que a conexão recebeu (ver `SentView`).
  const sentViews = new Map<string, SentView>()
  // Por clientId: conexões que disseram (`view.patches`) que sabem aplicar `patch`.
  const patchClients = new Set<string>()
  const patchMinSnapshotLength = options.patchMinSnapshotLength ?? PATCH_MIN_SNAPSHOT_LENGTH
  // Por playerId: limite do `view.resync` (VIEW_RESYNC_MIN_INTERVAL_MS).
  const lastResyncAt = new Map<string, number>()
  // Sobe a cada troca de posse: ela entra no recorte de todo jogador.
  let ownershipRev = 0
  let rev = 0
  // ZONA DE PERIGO: em que zona estava cada ficha de JOGADOR no último
  // broadcast, por cena (chave `sceneKey`). É daqui que sai "entrou agora".
  // Uma entrada por cena da aventura: não cresce além do número de cenas.
  const hazardSeen = new Map<string, Map<string, HazardEntry>>()
  // GATILHO DE ÁREA: a leitura anterior de cada cena (chave `sceneKey`) — quem
  // estava dentro de qual gatilho. Mesmo tamanho de `hazardSeen`.
  const triggerSeen = new Map<string, AreaTriggerPresence>()
  // ALARME PARA VÁRIAS CENAS: o alarme soando (no máximo um) e, por conexão,
  // o id do alarme que aquela tela mostra agora. É por clientId de propósito:
  // quem reconecta chega com tela limpa e precisa receber de novo.
  let alarm: SceneAlarm | null = null
  const alarmShown = new Map<string, string>()
  // CARAVANA: onde estava a caravana de cada mapa-mundi no último passo (chave
  // `sceneKey`). É por ele que se sabe QUAL ficha o mestre arrastou. Uma
  // entrada por cena com caravana: sai quando o grupo deixa a cena.
  const caravanAt = new Map<string, CaravanMemory>()

  /** Raio em px do jogador para cena SEM "Visão nesta cena": o do mestre ou o global (o de sempre). */
  const baseRadiusFor = (playerId: string): number => visionOverrides.get(playerId) ?? options.visionRadius
  const factorFor = (playerId: string): number => visionFactors.get(playerId) ?? VISION_FACTOR_DEFAULT
  /**
   * Raio do jogador: o de sempre (ou override do mestre), vezes o fator de
   * visão da cena quando há mapa para calcular ("Visão nesta cena"). Sem
   * `map` (usado pelo relógio da campanha, que aplica o próprio ajuste de
   * hora), sai só o raio de base.
   */
  const radiusFor = (playerId: string, map?: MapData): number =>
    map === undefined ? baseRadiusFor(playerId) : playerVisionRadius(map, baseRadiusFor(playerId), factorFor(playerId))

  /** Jogadores do conjunto, na ordem da sala (a do painel Grupo), não na ordem em que o mestre marcou. */
  const inRoomOrder = (chosen: ReadonlySet<string>): string[] =>
    [...players.values()].sort((a, b) => a.joinedAt - b.joinedAt).flatMap((p) => (chosen.has(p.playerId) ? [p.playerId] : []))

  /** "Quem vê" do pino na ordem da sala. `null` = Todos. */
  const audienceOf = (pinId: string): string[] | null => {
    const chosen = pinAudiences.get(pinId)
    if (chosen === undefined) return null
    return inRoomOrder(chosen)
  }

  /** "Revelar para…" do item, na ordem da sala; `[]` = ninguém. */
  const secretRevealOf = (itemId: string): string[] => {
    const chosen = secretReveals.get(itemId)
    return chosen === undefined ? [] : inRoomOrder(chosen)
  }

  /** A hora do relógio da campanha agora; `null` = o mestre não tem relógio. */
  const clockHour = (): number | null => options.getClock?.() ?? null

  /**
   * RELÓGIO DA CAMPANHA: o raio do jogador NESTA cena, agora. À noite, numa
   * cena externa, cai — e é este raio que todo recorte usa (snapshot, porta,
   * item, alavanca, tela da mesa), então o que ficou no escuro não viaja nem
   * pode ser tocado. O painel do mestre continua mostrando o raio de base.
   */
  const radiusIn = (playerId: string, map: MapData): number => {
    const hour = clockHour()
    return hour === null ? radiusFor(playerId) : visionRadiusAtHour(radiusFor(playerId), hour, map)
  }
  /**
   * RAIO POR FICHA: o raio de cada ficha que `playerId` vê. A emprestada
   * enxerga com o raio do DONO (personagem sem visão no escuro continua sem
   * ela nas mãos de outro), senão a névoa em volta dela mudaria conforme quem
   * a joga e o explorado do dono gravaria um recorte que ninguém viu. O
   * relógio da campanha vale para as duas (`radiusIn`).
   */
  const tokenRadiusIn = (playerId: string, map: MapData) => (tokenId: string): number => radiusIn(loans.get(tokenId)?.ownerId ?? playerId, map)

  /** Polígonos das zonas ocultas ativas (`?? []`: mapa montado fora do deserializeMap pode vir sem o campo). */
  const statusOf = (playerId: string): PlayerStatus => ((ownership[playerId]?.length ?? 0) > 0 ? 'playing' : 'waiting')

  /**
   * Memória que o jogador já tem deste mapa, sem criar. O mesmo id com outro
   * tamanho e a MESMA grade é o mapa que o mestre aumentou (ou diminuiu): a
   * memória acompanha, no mesmo lugar do mundo (`resizeExploration`), e fica
   * na mesma posição da ordem de uso. Outra grade é outro mapa: não conta.
   */
  const existingMemory = (playerId: string, map: MapData): PlayerMemory | undefined => {
    const byScene = memories.get(playerId)
    const stored = byScene?.get(map.id)
    if (byScene === undefined || stored === undefined) return undefined
    const dims = dimsOf(map)
    const key = memoryKey(dims)
    let memory = stored
    if (stored.key !== key) {
      if (stored.dims.grid !== map.grid) return undefined
      // `dims` do mapa de agora: é com elas que a mesa grava e confere o fio na retomada.
      // `restored` passa adiante: a memória da mesa retomada ainda precisa da conferência abaixo.
      // A visão da planta velha não vale na nova: o próximo snapshot manda a de agora.
      memory = { ...stored, key, dims, exp: resizeExploration(stored.exp, worldSizeOf(dims)), vision: [] }
      byScene.set(map.id, memory)
    }
    // Memória da mesa retomada: toda leitura passa por aqui, então é aqui que
    // o que o mestre escondeu desde a gravação (zona oculta, sala secreta) sai
    // dela — antes de qualquer recorte ou teste de ponto usá-la.
    if (memory.restored) {
      forgetBlocked(memory.exp, memoryBlockedRings(map))
      memory.restored = false
    }
    return memory
  }

  const nextPlaceId = (playerId: string): string => {
    const n = (placeCounters.get(playerId) ?? 0) + 1
    placeCounters.set(playerId, n)
    return `l${n}`
  }

  /** LUGARES: os ids das memórias que o jogador ainda tem, da usada há mais tempo à de agora. */
  const rememberedPlaces = (playerId: string): string[] => [...(memories.get(playerId)?.values() ?? [])].map((memory) => memory.place)

  /**
   * Memória do jogador para este mapa. Cada cena tem a sua: ir à Cripta e
   * voltar ao Salão devolve o Salão como ele o deixou. Mapa novo (ou mesmo id
   * com outra grade) começa do zero; acima de `MAX_SCENE_MEMORIES_PER_PLAYER`
   * cenas, a usada há mais tempo é esquecida — menos a cena onde o jogador
   * tem ficha em `world`, que nunca sai (é para lá que ele volta).
   */
  const memoryFor = (playerId: string, map: MapData, world: HostWorld): PlayerMemory => {
    let byScene = memories.get(playerId)
    if (byScene === undefined) {
      byScene = new Map()
      memories.set(playerId, byScene)
    }
    const found = existingMemory(playerId, map)
    const dims = dimsOf(map)
    const memory: PlayerMemory = found ?? {
      key: memoryKey(dims),
      dims,
      exp: blankExploration(dims),
      seen: blankExploration(dims),
      planMarked: false,
      doors: new Map(),
      doorsSeenAt: new Map(),
      vision: [],
      restored: false,
      seenRooms: new Set(),
      place: nextPlaceId(playerId),
      plan: emptyPlanMemory(),
    }
    // Apagar e regravar põe a cena no fim da ordem: é a mais recente agora.
    byScene.delete(map.id)
    byScene.set(map.id, memory)
    if (byScene.size <= MAX_SCENE_MEMORIES_PER_PLAYER) return memory
    const withOwnToken = new Set(allScenes(world).filter((scene) => ownsTokenIn(playerId, scene)).map(sceneKey))
    for (const oldest of byScene.keys()) {
      if (byScene.size <= MAX_SCENE_MEMORIES_PER_PLAYER) break
      if (oldest === map.id || withOwnToken.has(oldest)) continue
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

  /**
   * O que o jogador vê agora: o recorte da cena dele (ou a espera quando ele
   * não está em cena nenhuma), os cartões de texto de Sala que vêm com ele e,
   * no fim, o último recado da cena quando isto é uma CHEGADA a ela.
   * `arrived: 'always'` é a entrada/volta à sala: o recado vem mesmo que ele
   * já o tenha (o cartão reaparece).
   */
  const viewFor = (playerId: string, world: HostWorld, arrived: 'on_change' | 'always'): HostMessage[] => {
    const scene = sceneFor(playerId, world)
    if (scene === null) {
      noteSceneOf.set(playerId, null)
      // Sem cena, sem mapa na tela: nenhum pino dele vale como "visto agora".
      seenPins.delete(playerId)
      return [{ type: 'lobby.waiting' }]
    }
    const view = snapshotFor(playerId, scene.map, world, sceneNameForPlayer(scene), floorsFor(playerId, scene, world))
    const note = arrivalNote(playerId, scene.sceneId, arrived)
    return note === null ? view : [...view, noteMessage(note)]
  }

  /**
   * TEXTO DA SALA: o cartão de cada Sala em que o jogador entrou AGORA pela
   * primeira vez (`occupiedRooms` do recorte menos as já visitadas), e marca
   * como visitada. Lê a Sala do RECORTE, nunca do mapa do mestre: o título é o
   * nome que o jogador pode ver e o texto já vem cortado no teto.
   */
  const roomTextCardsFor = (playerId: string, mapId: string, view: PlayerMapView): HostMessage[] => {
    if (view.occupiedRooms.length === 0) return []
    let byMap = enteredRooms.get(playerId)
    if (byMap === undefined) {
      byMap = new Map()
      enteredRooms.set(playerId, byMap)
    }
    let entered = byMap.get(mapId)
    if (entered === undefined) {
      entered = new Set()
      byMap.set(mapId, entered)
    }
    const cards: HostMessage[] = []
    for (const id of view.occupiedRooms) {
      if (entered.has(id)) continue
      entered.add(id)
      const room = view.map.regions.find((r) => r.id === id)?.room
      if (room?.textoAoEntrar === undefined) continue
      cards.push({ type: 'room.text', id, title: room.name, text: room.textoAoEntrar })
      // MINHAS PISTAS: o texto lido entra no caderno — do RECORTE, como o cartão.
      const clue = roomClueForPlayer(room.name, room.textoAoEntrar)
      if (clue !== null) cards.push({ type: 'clue.added', clue: rememberClue(playerId, `sala|${mapId}|${id}`, clue) })
    }
    return cards
  }

  /**
   * Guarda a pista no caderno do jogador e devolve a entrada que vai para a
   * rede. A mesma `source` de novo (releu o pino, entrou de novo na Sala)
   * atualiza o texto, mantém o id e sobe para o fim; passou do teto, sai a
   * mais antiga. `from`: o colega que mostrou.
   */
  const rememberClue = (playerId: string, source: string, content: PlayerClueContent, from?: string): ClueEntry => {
    const book = cluebooks.get(playerId) ?? []
    const previous = book.find((item) => item.source === source)
    const base: ClueEntry = { id: previous?.entry.id ?? randomId(), title: content.title, text: content.text, image: content.image, at: now() }
    const entry: ClueEntry = from === undefined ? base : { ...base, from }
    cluebooks.set(playerId, [...book.filter((item) => item.source !== source), { source, entry }].slice(-CLUEBOOK_MAX_CLUES))
    return { ...entry }
  }

  const noteMessage = (note: NoteEntry): HostMessage => ({ type: 'scene.note', id: note.id, text: note.text, at: note.at })

  /** Põe o recado no caderno do jogador (sem repetir id); passou do teto, sai o mais antigo. */
  const rememberNote = (playerId: string, note: NoteEntry): void => {
    const book = notebooks.get(playerId) ?? []
    if (book.some((entry) => entry.id === note.id)) return
    notebooks.set(playerId, [...book, note].slice(-NOTEBOOK_MAX_NOTES))
  }

  /**
   * O último recado da cena `sceneId` para quem acaba de chegar a ela, já
   * anotado no caderno dele. Só a cena ONDE ELE ESTÁ (quem chama já passou por
   * `sceneFor`): recado de outra cena nunca sai daqui. Na mesma cena de antes,
   * ou com o recado já no caderno (voltou a uma cena que já leu), `null` —
   * salvo `'always'`, a entrada na sala.
   */
  const arrivalNote = (playerId: string, sceneId: string | null, arrived: 'on_change' | 'always'): NoteEntry | null => {
    const changed = !noteSceneOf.has(playerId) || noteSceneOf.get(playerId) !== sceneId
    noteSceneOf.set(playerId, sceneId)
    if (sceneId === null) return null
    const note = lastNoteByScene.get(sceneId)
    if (note === undefined) return null
    if (arrived === 'on_change') {
      if (!changed) return null
      if ((notebooks.get(playerId) ?? []).some((entry) => entry.id === note.id)) return null
    }
    rememberNote(playerId, note)
    return note
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
   * O recado só para ele guardado, logo atrás de `view` — só quando `view` é
   * mapa: o jogador só mostra recado com o mapa na tela. Entregue, sai da fila
   * e entra no caderno dele, como todo recado que ele leu.
   */
  const pendingNoteFor = (clientId: string, playerId: string, view: HostMessage | undefined): Outbound[] => {
    const note = pendingNotes.get(playerId)
    if (note === undefined || view?.type !== 'snapshot') return []
    pendingNotes.delete(playerId)
    rememberNote(playerId, note)
    return [{ clientId, msg: onlyYouMessage(note) }]
  }

  /** O recado só para ele: o mesmo `scene.note` do caderno, com a marca "Só para você". */
  const onlyYouMessage = (note: NoteEntry): HostMessage => ({ type: 'scene.note', id: note.id, text: note.text, at: note.at, onlyYou: true })

  /**
   * MAPA POR ANDARES — o que vai em `snapshot.andares`: o rótulo do andar onde
   * o jogador está e, de cada OUTRO andar do mesmo prédio que ele JÁ conhece
   * (tem memória lá; `existingMemory` não cria nem mexe na ordem), a planta
   * recortada pela memória dele, sem visão (`filterFloorMemory`). Andar onde ele
   * nunca pisou não sai nem pelo rótulo. `undefined` = sem abas: cena comum, ou
   * nenhum outro andar conhecido.
   */
  const floorsFor = (playerId: string, scene: HostScene, world: HostWorld): FloorsWire | undefined => {
    const here = scene.map.andar
    if (here === undefined) return undefined
    const outros: FloorMemoryWire[] = []
    for (const other of allScenes(world)) {
      const floor = other.map.andar
      if (floor === undefined || other.map.id === scene.map.id || !sameBuilding(here, floor)) continue
      // Dois andares com o mesmo rótulo seriam duas abas iguais: vale o primeiro, e nunca o do andar dele.
      if (floor.rotulo === here.rotulo || outros.some((o) => o.rotulo === floor.rotulo)) continue
      const memory = existingMemory(playerId, other.map)
      if (memory === undefined) continue
      // "QUEM VÊ": pino escolhido só para outro jogador não sai nem pela memória do andar.
      const view = filterFloorMemory(other.map, memory.exp, memory.doors, { pinAudiences, playerId, seenRooms: memory.seenRooms })
      outros.push({ rotulo: floor.rotulo, map: view.map, explored: encodeExploration(memory.exp), concealed: view.concealed })
    }
    if (outros.length === 0) return undefined
    const order = sortFloorLabels(outros.map((o) => o.rotulo))
    outros.sort((a, b) => order.indexOf(a.rotulo) - order.indexOf(b.rotulo))
    return { atual: here.rotulo, outros }
  }

  /** A planta desta cena está revelada para o jogador: pela cena inteira ou pelo "Revelar planta para…". */
  const planRevealedFor = (playerId: string, scene: HostScene): boolean =>
    scene.planKnownByAll === true || (scene.sceneId !== null && planGrants.get(scene.sceneId)?.has(playerId) === true)

  /** Tira do jogador as revelações guardadas: de uma cena, ou de todas (`null`). */
  const dropPlanGrants = (playerId: string, sceneId: string | null): void => {
    for (const [grantScene, chosen] of planGrants) {
      if (sceneId !== null && grantScene !== sceneId) continue
      chosen.delete(playerId)
      if (chosen.size === 0) planGrants.delete(grantScene)
    }
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
   *
   * Devolve o snapshot e, DEPOIS dele, o cartão de texto de cada Sala em que o
   * jogador acabou de entrar pela primeira vez: o mapa dele já tem a Sala
   * quando o cartão abre.
   *
   * `sceneName`: o nome público da cena DELE, já recortado por
   * `sceneNameForPlayer`; `undefined` = o snapshot sai sem o campo.
   */
  const snapshotFor = (playerId: string, map: MapData, world: HostWorld, sceneName: string | undefined, andares: FloorsWire | undefined): HostMessage[] => {
    // A cena dona deste mapa (para "Revelar planta para…" e o espiar de porta);
    // sem cena correspondente no mundo (não deveria acontecer), uma sem segredos.
    const scene = allScenes(world).find((s) => s.map.id === map.id) ?? { sceneId: null, name: map.name, map }
    const memory = memoryFor(playerId, map, world)
    const exp = memory.exp
    // Planta revelada (cena conhecida por todos, ou "Revelar planta para…"):
    // marcada ANTES do recorte, para a planta sair já neste snapshot. Uma vez
    // por memória: `markAll` varre o mapa inteiro e o snapshot sai a cada passo.
    if (!memory.planMarked && planRevealedFor(playerId, scene)) {
      markAll(exp, playerBlockedRings(map))
      memory.planMarked = true
    }
    const entered = enteredRooms.get(playerId)?.get(map.id)
    const view = filterMapForPlayer(map, playerId, ownership, tokenRadiusIn(playerId, map), exp, memory.doors, pinAudiences, entered, memory.seenRooms, secretReveals, peekingFor(playerId, scene))
    // Zona oculta ativa e sala secreta: célula que toca nelas não vira explorada
    // (senão o jogador guardaria a planta escondida e o formato dela).
    markRings(exp, view.vision, view.blocked)
    // CÔMODO LEMBRADO: o cômodo conhecido levanta a névoa INTEIRO (é o que o
    // jogador vê mais apagado depois de sair), menos o que toca cômodo ainda
    // não visto — a despensa dentro da sala lembrada continua escura. Remarca
    // a cada snapshot, antes do `forgetInside` abaixo: o prédio de teto que
    // fecha apaga o de dentro, e quem volta a entrar recebe os cômodos de volta.
    // Sala dentro do cômodo também bloqueia (`roomsInside`): o prédio de teto
    // (aberto ou fechado) — o contorno do pátio guardado cobriria a casa no
    // meio dele, e o `forgetInside` abaixo só apaga célula — e a Sala comum
    // aninhada (o quarto de porta trancada), que só vira explorada pela visão.
    for (const room of view.rememberedRooms) {
      memory.seenRooms.add(room.id)
      markRings(exp, [room.points], [...view.blocked, ...view.unseenInsideRemembered, ...room.roomsInside])
    }
    // O que ele VIU, à parte: é o que "Dar o que o grupo viu" repassa.
    markRings(memory.seen, view.vision, view.blocked)
    forgetInside(memory.seen, view.roofs)
    // TETO DE CONSTRUÇÃO: o teto não entra em `view.blocked` (o contorno do
    // prédio não é segredo, e o veto de lá joga fora o anel de visão inteiro,
    // apagando a memória do jogador longe do prédio). O veto do teto é só a
    // grade de células, e é aqui: apaga o que está DENTRO do prédio, inclusive
    // o que o jogador percorreu enquanto o teto estava aberto. Sem esta linha o
    // `explored` que viaja abaixo continuaria desenhando o caminho dele lá
    // dentro depois que ele sai.
    forgetInside(exp, view.roofs)
    memory.vision = view.vision
    seenPins.set(playerId, { mapId: map.id, pins: view.map.pins })
    const seenNow = new Set(view.visibleDoorIds)
    for (const w of view.map.walls) {
      if (w.door === null || !seenNow.has(w.id)) continue
      memory.doors.set(w.id, { ...w.door })
      memory.doorsSeenAt.set(w.id, (doorSeenSeq += 1))
    }
    // PAINEL PISTAS: o pino que sai aqui com o texto foi RECEBIDO. O "só de
    // perto" visto de longe (`longe`) chega vazio: ainda não conta.
    for (const pin of view.map.pins) {
      if (pin.longe !== true) addToSet(pinReceived, pin.id, playerId)
    }
    const sent = new Set(view.map.tokens.map((t) => t.id))
    const ownTokens = (ownership[playerId] ?? []).filter((id) => sent.has(id))
    // Só fichas que ele JÁ recebe: a lista não conta quem está no escuro.
    const partyTokens = view.map.tokens.filter((t) => isOtherPlayersToken(playerId, t.id)).map((t) => t.id)
    // Sem nome público o campo nem existe: `sceneName: undefined` no JSON sumiria, mas no objeto não.
    const where = sceneName === undefined ? {} : { sceneName }
    // LUGARES: o id desta memória e a lista das que ele ainda tem. Nada da cena
    // vai junto — nem id, nem nome —, só o contador dele.
    const snapshot: HostMessage = {
      type: 'snapshot',
      rev,
      map: view.map,
      vision: view.vision,
      explored: encodeExploration(exp),
      ownTokens,
      concealed: view.concealed,
      partyTokens,
      ...where,
      place: memory.place,
      places: rememberedPlaces(playerId),
    }
    // A vez sai pelo MESMO recorte do mapa: ficha que não foi ao jogador não vira vez nele.
    const turn = turnForPlayer(view.map, options.getTurn?.() ?? null)
    if (turn !== null) snapshot.turn = turn
    // ZONA DE PERIGO: só o que ele enxerga, e o campo só existe quando há algum.
    if (view.hazards.length > 0) snapshot.hazards = view.hazards
    // GATILHO DE ÁREA: só o que o mestre revelou, mesma regra do campo.
    if (view.gatilhos.length > 0) snapshot.gatilhos = view.gatilhos
    // MAPA POR ANDARES: o campo só existe quando há outro andar conhecido.
    if (andares !== undefined) snapshot.andares = andares
    // RELÓGIO DA CAMPANHA: o período e, desta cena, se está escuro. Sem relógio, o campo nem sai.
    const relogio = clockForPlayer(clockHour(), map)
    if (relogio !== null) snapshot.relogio = relogio
    // CONE PELO VÃO: campo aditivo, só vai quando há cone.
    if (view.glimpses.length > 0) snapshot.glimpses = view.glimpses
    return [snapshot, ...roomTextCardsFor(playerId, map.id, view)]
  }

  /** A porta que o jogador espia AGORA nesta cena, ou nada. Prazo vencido apaga o registro. */
  const peekingFor = (playerId: string, scene: HostScene): ReadonlySet<string> | undefined => {
    const peek = peeks.get(playerId)
    if (peek === undefined) return undefined
    if (now() >= peek.until) {
      peeks.delete(playerId)
      return undefined
    }
    return peek.sceneKey === sceneKey(scene) ? new Set([peek.wallId]) : undefined
  }

  /**
   * A tela deste jogador para esta conexão, lembrando o que foi. `null` = a
   * conexão já tem exatamente esta tela: nada a mandar. Entradas iguais às do
   * último recálculo estável nem recortam de novo — é o jogador parado numa
   * cena onde nada mudou enquanto o mestre arrasta um NPC em outra.
   *
   * O que NÃO sai também protege a névoa: um snapshot de `rev` novo e tela
   * igual diria ao jogador que algo se mexeu onde ele não vê.
   *
   * Quem sabe aplicar (`patchClients`) e já tem uma tela grande
   * (`PATCH_MIN_SNAPSHOT_LENGTH`) recebe só o que mudou nela (`patch`): o
   * passo de um jogador vira as coordenadas de uma ficha, e não o mapa com a
   * foto de todas. Quem não sabe, está saindo da espera ou tem tela pequena
   * recebe o snapshot inteiro.
   *
   * `force`: manda mesmo com a tela igual — a do jogador pode não ser a que o
   * host mandou (ele aplicou algo otimista que o host recusou calado). O
   * `patch` vazio basta: o jogador volta para a última tela recebida.
   */
  const viewIfChanged = (clientId: string, playerId: string, world: HostWorld, force = false): HostMessage | null => {
    const scene = sceneFor(playerId, world)
    const map = scene === null ? null : scene.map
    const radius = radiusFor(playerId)
    const before = map === null ? undefined : existingMemory(playerId, map)
    const last = sentViews.get(clientId)
    const sameInputs =
      last !== undefined &&
      last.playerId === playerId &&
      last.map === map &&
      last.radius === radius &&
      last.ownershipRev === ownershipRev &&
      last.memory === before
    if (!force && sameInputs && last.stable) return null
    const planBefore = before === undefined ? null : before.plan
    const doorsBefore = before === undefined ? null : doorsKey(before.doors)
    const snapshot = map === null ? null : snapshotFor(playerId, map)
    const after = map === null ? undefined : existingMemory(playerId, map)
    const view = snapshot === null ? null : contentOf(snapshot)
    const out = messageFor(clientId, last, snapshot, view, force)
    const memorySettled =
      after === before && (after === undefined || (planBefore !== null && samePlan(planBefore, after.plan) && doorsKey(after.doors) === doorsBefore))
    // Nada saiu: a conexão continua com a tela (e o `rev`) de antes.
    const sentRev = out === null && last !== undefined ? last.rev : rev
    const snapshotLength = snapshotLengthAfter(clientId, last, out)
    sentViews.set(clientId, {
      playerId,
      map,
      radius,
      ownershipRev,
      memory: after,
      view,
      rev: sentRev,
      snapshotLength,
      stable: sameInputs && out === null && memorySettled,
    })
    return out
  }

  /**
   * Tamanho da tela inteira que a conexão tem depois de `out`. Só o snapshot
   * mede (e só para quem aplica `patch`, o único que usa a medida); patch e
   * nada mantêm a medida da tela inteira de onde partiram.
   */
  const snapshotLengthAfter = (clientId: string, last: SentView | undefined, out: HostMessage | null): number => {
    if (out === null || out.type === 'patch') return last === undefined ? 0 : last.snapshotLength
    if (out.type !== 'snapshot' || !patchClients.has(clientId)) return 0
    return JSON.stringify(out).length
  }

  /** O que sai para a conexão, dada a última tela dela (`last`) e a de agora. `null` = nada. */
  const messageFor = (
    clientId: string,
    last: SentView | undefined,
    snapshot: SnapshotMessage | null,
    view: PlayerViewContent | null,
    force: boolean,
  ): HostMessage | null => {
    const had = last === undefined ? undefined : last.view
    if (snapshot === null || view === null) return had === null ? null : { type: 'lobby.waiting' }
    // Sem tela anterior (primeira vez, ou saindo da espera): só o snapshot serve.
    if (last === undefined || had === undefined || had === null) return snapshot
    const patch = diffView(had, view)
    // Campo que sumiu do mapa não cabe num patch: vai inteiro.
    if (patch === null) return snapshot
    if (isEmptyViewPatch(patch) && !force) return null
    // Tela pequena vai inteira mesmo para quem aplica patch (PATCH_MIN_SNAPSHOT_LENGTH).
    const wantsPatch = patchClients.has(clientId) && last.snapshotLength >= patchMinSnapshotLength
    return wantsPatch ? { type: 'patch', rev, base: last.rev, ...patch } : snapshot
  }

  /**
   * Manda de novo a tela desta conexão, com `rev` novo: a do jogador não é a
   * que o host acha que ela é. Sem tela guardada sai o snapshot inteiro.
   */
  const resendView = (clientId: string, playerId: string, world: HostWorld): HostResult => {
    rev += 1
    const msg = viewIfChanged(clientId, playerId, world, true)
    return msg === null ? { outbound: [] } : reply(clientId, msg)
  }

  /**
   * A conexão deste jogador recebeu (ou vai receber) algo que muda a tela fora
   * do broadcast — espera, troca de cena, planta apagada — ou a memória dele
   * mudou por fora do recorte. O próximo broadcast manda a tela inteira.
   */
  const forgetSentView = (playerId: string): void => {
    for (const [clientId, sent] of sentViews) if (sent.playerId === playerId) sentViews.delete(clientId)
  }

  const reply = (clientId: string, msg: HostMessage): HostResult => ({ outbound: [{ clientId, msg }] })

  /** Jogador que jogava e ficou sem token volta ao lobby; desconectado recebe o estado no resume. */
  const waitingIfLostLast = (playerId: string, wasPlaying: boolean): Outbound[] => {
    if (statusOf(playerId) === 'playing') return []
    // Sem ficha, ele sai da cena: a ficha devolvida (mesmo na cena de antes) é
    // CHEGADA, e o recado mandado enquanto ele aguardava vem no broadcast seguinte.
    noteSceneOf.delete(playerId)
    const clientId = players.get(playerId)?.clientId ?? null // registro ausente = jogador expulso: não há a quem avisar
    if (!wasPlaying || clientId === null) return []
    lostSecretCheckCard.add(playerId)
    // A tela dele vira a espera: quando a ficha voltar, a cena sai inteira de novo.
    forgetSentView(playerId)
    return [{ clientId, msg: { type: 'lobby.waiting' } }]
  }

  /** Os testes secretos abertos que ainda esperam a resposta DELE, para mandar logo depois de um mapa. */
  const pendingSecretChecksFor = (playerId: string, clientId: string): Outbound[] => {
    const outbound: Outbound[] = []
    for (const [id, check] of secretChecks) {
      if (check.open && check.asked.has(playerId) && !check.answers.has(playerId)) {
        outbound.push({ clientId, msg: { type: 'secret.check', id, label: check.label } })
      }
    }
    return outbound
  }

  /**
   * O que vai ao jogador junto com a vista dele. Espera apaga o cartão no
   * cliente (marca); o primeiro mapa depois dela traz os pedidos pendentes de
   * volta, sempre DEPOIS do mapa — sem mapa o cartão não tem onde aparecer.
   */
  const withPendingSecretChecks = (playerId: string, clientId: string, view: HostMessage): Outbound[] => {
    if (view.type !== 'snapshot') {
      if (view.type === 'lobby.waiting') lostSecretCheckCard.add(playerId)
      return [{ clientId, msg: view }]
    }
    if (!lostSecretCheckCard.delete(playerId)) return [{ clientId, msg: view }]
    return [{ clientId, msg: view }, ...pendingSecretChecksFor(playerId, clientId)]
  }

  /** Fecha o teste: `secret.check.closed` a quem foi pedido, está conectado e ainda não respondeu. */
  const closeSecretCheckFor = (checkId: string, check: SecretCheckRecord): Outbound[] => {
    check.open = false
    const outbound: Outbound[] = []
    for (const playerId of inRoomOrder(check.asked)) {
      if (check.answers.has(playerId)) continue
      const clientId = players.get(playerId)?.clientId ?? null
      if (clientId !== null) outbound.push({ clientId, msg: { type: 'secret.check.closed', id: checkId } })
    }
    return outbound
  }

  /**
   * Acima do teto: sai o encerrado ou já respondido por todos mais antigo.
   * Sem nenhum, o mais antigo é encerrado antes de sair — quem ainda devia a
   * resposta recebe o fechamento, e não um cartão que responde para o nada.
   */
  const trimSecretChecks = (): Outbound[] => {
    const outbound: Outbound[] = []
    while (secretChecks.size > MAX_SECRET_CHECKS) {
      const all = [...secretChecks]
      const victim = all.find(([, check]) => isSecretCheckSettled(check)) ?? all[0]
      if (victim === undefined) break
      const [id, check] = victim
      if (check.open) outbound.push(...closeSecretCheckFor(id, check))
      secretChecks.delete(id)
    }
    return outbound
  }

  /**
   * ALARME: leva cada tela ao alarme que ela deve mostrar AGORA. O que ela
   * deve mostrar sai do recorte (`alarmForPlayer`, pela cena da ficha dele);
   * só a diferença viaja — alarme novo para quem não o tem, fim para quem o
   * tem e não deve mais. Quem nunca recebeu não recebe nem o fim: saber que
   * houve um alarme já contaria o que se passa em outra cena. Tela da mesa
   * fica de fora (não é jogador). Chamado depois do snapshot: o aviso chega
   * com o mapa já na tela.
   */
  const syncAlarms = (world: HostWorld): Outbound[] => {
    // Conexão que caiu ou foi trocada no resume não recebe mais nada.
    for (const clientId of [...alarmShown.keys()]) if (!byClient.has(clientId)) alarmShown.delete(clientId)
    const outbound: Outbound[] = []
    for (const [clientId, playerId] of byClient) {
      const scene = statusOf(playerId) === 'playing' ? sceneFor(playerId, world) : null
      const wanted = alarmForPlayer(alarm, scene?.sceneId ?? null)
      const shown = alarmShown.get(clientId)
      if (wanted !== null) {
        if (wanted.id === shown) continue
        alarmShown.set(clientId, wanted.id)
        outbound.push({ clientId, msg: { type: 'scene.alarm', id: wanted.id, text: wanted.text } })
      } else if (shown !== undefined) {
        alarmShown.delete(clientId)
        outbound.push({ clientId, msg: { type: 'scene.alarm.end', id: shown } })
      }
    }
    return outbound
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

  /**
   * TELA DA MESA — o que a TV recebe: a cena escolhida pelo mestre com só o que
   * o GRUPO já viu. Visão = a união da visão de quem está nessa cena agora, cada
   * um com o próprio raio. Memória = a união da memória de todo jogador que já
   * passou por ela (quem viajou deixa o que viu). A memória é juntada numa CÓPIA:
   * a tela nunca escreve na memória de ninguém. Sem cena escolhida, ou com a
   * cena fora do que está aberto, a tela espera.
   */
  const tableView = (world: HostWorld): HostMessage => {
    const choice = tableSceneChoice
    const scene = choice === null ? undefined : allScenes(world).find((s) => tableSceneKey(s) === choice)
    if (scene === undefined) return { type: 'lobby.waiting' }
    const map = scene.map
    const merged = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
    const doors = new Map<string, DoorState>()
    // Porta que ninguém vê agora aparece como o grupo a viu POR ÚLTIMO, não
    // como a viu quem entrou na sala por último (a ordem de `players`).
    const doorsSeenAt = new Map<string, number>()
    const viewers: GroupViewer[] = []
    for (const playerId of players.keys()) {
      const memory = existingMemory(playerId, map)
      if (memory !== undefined) {
        mergeExploration(merged, memory.exp)
        for (const [wallId, door] of memory.doors) {
          const seenAt = memory.doorsSeenAt.get(wallId) ?? 0
          if (seenAt < (doorsSeenAt.get(wallId) ?? -1)) continue
          doors.set(wallId, door)
          doorsSeenAt.set(wallId, seenAt)
        }
      }
      // Só quem está NESTA cena enxerga por ela; a ficha dele em outra cena não conta.
      if (statusOf(playerId) === 'playing' && sceneFor(playerId, world) === scene) {
        viewers.push({ tokenIds: ownership[playerId] ?? [], visionRadius: tokenRadiusIn(playerId, map) })
      }
    }
    // A marca do guarda (?, !) conta a ficha de qualquer jogador, não só a de quem está no grupo da TV —
    // desde que a própria TV a receba (o recorte descarta a da névoa, secreta, em zona oculta ou sob teto).
    const view = filterMapForGroup(map, viewers, merged, doors, allPlayerTokens(ownership), { pinAudiences })
    // Mesmas regras de `snapshotFor`: a visão de agora entra na memória que
    // viaja, fora de zona oculta e sala secreta, e o interior de prédio de teto
    // fechado para o grupo sai dela.
    markRings(merged, view.vision, view.blocked)
    forgetInside(merged, view.roofs)
    const snapshot: HostMessage = { type: 'snapshot', rev, map: view.map, vision: view.vision, explored: encodeExploration(merged), ownTokens: [], concealed: view.concealed }
    // ZONA DE PERIGO: o que o GRUPO enxerga agora, mesma regra do jogador.
    if (view.hazards.length > 0) snapshot.hazards = view.hazards
    // GATILHO DE ÁREA: o revelado, mesma regra do jogador.
    if (view.gatilhos.length > 0) snapshot.gatilhos = view.gatilhos
    return snapshot
  }

  /**
   * GATILHO DE ÁREA — quem ENTROU numa área marcada desde o último broadcast
   * (`newAreaTriggerEntries`). Só ficha de JOGADOR conta. O aviso é SÓ do
   * mestre: o jogador não recebe mensagem nenhuma — ele só vê a área depois
   * que o mestre revela, e isso viaja no snapshot (`view.gatilhos`).
   */
  const triggerEntriesIn = (world: HostWorld): AreaTriggerEntryNotice[] => {
    const entries: AreaTriggerEntryNotice[] = []
    const ownerOf = new Map<string, string>()
    for (const [playerId, ids] of Object.entries(ownership)) for (const id of ids) ownerOf.set(id, playerId)
    const playerTokens = [...ownerOf.keys()]
    for (const scene of allScenes(world)) {
      const key = sceneKey(scene)
      const presence = areaTriggerPresence(scene.map, playerTokens)
      const before = triggerSeen.get(key)
      triggerSeen.set(key, presence)
      for (const entry of newAreaTriggerEntries(before, presence)) {
        const playerId = ownerOf.get(entry.tokenId)
        const record = playerId === undefined ? undefined : players.get(playerId)
        const token = scene.map.tokens.find((t) => t.id === entry.tokenId)
        const region = scene.map.regions.find((r) => r.id === entry.regionId)
        if (record === undefined || token === undefined || region === undefined) continue
        entries.push({
          playerName: record.name,
          tokenName: token.name,
          kind: entry.kind,
          areaName: regionAreaName(region),
          ...(scene === world.open ? {} : { sceneName: scene.name }),
        })
      }
    }
    return entries
  }

  /**
   * ZONA DE PERIGO — quem ENTROU num perigo desde o último broadcast: a ficha
   * andou para dentro, ou o perigo avançou sobre ela. Só ficha de JOGADOR
   * conta (NPC no fogo não avisa ninguém). O dono recebe `hazard.entered`,
   * e só ele, e só se está jogando nessa cena; o mestre recebe a linha em
   * `hazardEntries`, com o nome da cena quando ela não é a aberta no editor.
   */
  /**
   * O recorte deste jogador admite que a ficha está neste perigo: a sala não é
   * escondida pelo mestre (`PlayerMapView.hazardsHere`). Usa a memória que já
   * existe, sem criar.
   */
  const seesHazardAround = (playerId: string, map: MapData, token: Token, kind: HazardKind): boolean => {
    const memory = existingMemory(playerId, map)
    const view = filterMapForPlayer(map, playerId, ownership, tokenRadiusIn(playerId, map), memory?.exp, memory?.doors)
    return view.hazardsHere.some((h) => h.tokenId === token.id && h.kind === kind)
  }

  const hazardEntriesIn = (world: HostWorld): { outbound: Outbound[]; entries: HazardEntryNotice[] } => {
    const outbound: Outbound[] = []
    const entries: HazardEntryNotice[] = []
    const ownerOf = new Map<string, string>()
    for (const [playerId, ids] of Object.entries(ownership)) for (const id of ids) ownerOf.set(id, playerId)
    const playerTokens = [...ownerOf.keys()]
    for (const scene of allScenes(world)) {
      const key = sceneKey(scene)
      const presence = hazardPresence(scene.map, playerTokens)
      const before = hazardSeen.get(key)
      hazardSeen.set(key, presence)
      for (const entry of newHazardEntries(before, presence)) {
        const playerId = ownerOf.get(entry.tokenId)
        const record = playerId === undefined ? undefined : players.get(playerId)
        const token = scene.map.tokens.find((t) => t.id === entry.tokenId)
        if (playerId === undefined || record === undefined || token === undefined) continue
        entries.push({ playerName: record.name, tokenName: token.name, kind: entry.kind, ...(scene === world.open ? {} : { sceneName: scene.name }) })
        if (record.clientId === null || statusOf(playerId) !== 'playing' || sceneFor(playerId, world) !== scene) continue
        // O aviso diz o TIPO do perigo: só sai se o recorte dele já mostra esse
        // perigo em volta da ficha. Fogo pintado em sala secreta ou sob zona
        // oculta continua escondido — o mestre lê, o jogador não.
        if (!seesHazardAround(playerId, scene.map, token, entry.kind)) continue
        outbound.push({ clientId: record.clientId, msg: { type: 'hazard.entered', kind: entry.kind } })
      }
    }
    return { outbound, entries }
  }

  function handleTableJoin(clientId: string, msg: JoinMessage, world: HostWorld): HostResult {
    if (msg.code !== options.code) return reply(clientId, { type: 'error', reason: 'bad_code' })
    // O código todo jogador tem; a chave só vai no link da TV. Sem ela, um
    // jogador viraria tela e veria a cena escolhida (e quem está nela) mesmo
    // estando em outra.
    if (msg.tableKey !== tableKey) return reply(clientId, { type: 'error', reason: 'bad_table_key' })
    if (tableClients.size >= MAX_TABLE_SCREENS) return reply(clientId, { type: 'error', reason: 'table_full' })
    tableClients.add(clientId)
    return reply(clientId, tableView(world))
  }

  const clampRadius = (radius: number): number => Math.min(VISION_RADIUS_MAX, Math.max(VISION_RADIUS_MIN, radius))

  /** Fichas que já têm dono, fora `playerId`. */
  const tokensOwnedByOthers = (playerId: string): Set<string> => {
    const taken = new Set<string>()
    for (const [owner, tokens] of Object.entries(ownership)) {
      if (owner !== playerId) for (const tokenId of tokens) taken.add(tokenId)
    }
    return taken
  }

  /**
   * QUEM CHEGA ESCOLHE A FICHA: as fichas livres, iguais para todo jogador sem
   * personagem. Entram as que o mestre marcou "Ficha de jogador" em qualquer
   * cena servida; saem as que já são de alguém — conectado ou fora — e as do
   * assento guardado de quem ainda não voltou. O que pode ir pela rede é o
   * recorte de `claimableTokensForPlayer`: id e nome, nada mais.
   */
  const seatOptionsFor = (world: HostWorld): SeatOption[] => {
    const taken = new Set<string>()
    for (const tokens of Object.values(ownership)) for (const tokenId of tokens) taken.add(tokenId)
    for (const seat of pendingSeats) for (const tokenId of seat.tokenIds) taken.add(tokenId)
    return claimableTokensForPlayer(
      allScenes(world).map((scene) => scene.map),
      taken,
    )
      // Id que o pedido não conseguiria devolver (`seat.claim` tem o teto de id) não é oferecido.
      .filter(({ tokenId }) => tokenId.length <= REQ_ID_MAX_LENGTH)
      .slice(0, SEAT_OPTIONS_MAX)
      // Nome em branco derrubaria a lista inteira no jogador (`parseSeatOptions`).
      .map(({ tokenId, name }) => ({ tokenId, name: name.trim() === '' ? SEAT_OPTION_UNNAMED : clampSeatOptionName(name) }))
  }

  /**
   * `seat.options` para esta conexão, só se a lista mudou desde o último envio
   * a ela. Nada enviado vale lista vazia (o jogador sem lista vê a espera de
   * sempre): mesa sem ficha de jogador marcada não manda nada a ninguém.
   */
  const seatOptionsIfChanged = (clientId: string, world: HostWorld): Outbound[] => {
    const tokens = seatOptionsFor(world)
    const key = JSON.stringify(tokens)
    if ((lastSeatOptionsSent.get(clientId) ?? NO_SEAT_OPTIONS_KEY) === key) return []
    lastSeatOptionsSent.set(clientId, key)
    return [{ clientId, msg: { type: 'seat.options', tokens } }]
  }

  const seatClaimReply = (clientId: string, state: SeatClaimState): HostResult => reply(clientId, { type: 'seat.claim.state', state })

  const findSeatClaim = (requestId: string): { playerId: string; tokenId: string } | undefined => {
    for (const [playerId, claim] of pendingSeatClaims) {
      if (claim.requestId === requestId) return { playerId, tokenId: claim.tokenId }
    }
    return undefined
  }

  /**
   * As fichas do assento de `playerId`: as do mapa e as que a ponte guardou
   * para ele. A emprestada não entra: é do assento do dono.
   */
  const seatTokensOf = (playerId: string, held: HeldTokens | undefined): string[] => [
    ...new Set([...(ownership[playerId] ?? []).filter((tokenId) => loans.get(tokenId)?.borrowerId !== playerId), ...(held?.get(playerId) ?? [])]),
  ]

  /**
   * Encerra os empréstimos das fichas de `ownerId`: cada uma sai de quem a
   * jogava e fica só com o dono. Quem ficou sem ficha nenhuma volta à espera.
   */
  const endLoansOf = (ownerId: string): { outbound: Outbound[]; returned: LoanReturn[] } => {
    const returned: LoanReturn[] = []
    // Por quem jogava: se jogava antes de perder a ficha (para o "volta à espera").
    const wasPlaying = new Map<string, boolean>()
    for (const [tokenId, loan] of loans) {
      if (loan.ownerId !== ownerId) continue
      loans.delete(tokenId)
      const held = ownership[loan.borrowerId]
      if (held === undefined) continue
      if (!wasPlaying.has(loan.borrowerId)) wasPlaying.set(loan.borrowerId, held.length > 0)
      ownership[loan.borrowerId] = held.filter((t) => t !== tokenId)
      returned.push({ ownerId, borrowerId: loan.borrowerId, tokenId })
    }
    const outbound = [...wasPlaying].flatMap(([borrowerId, playing]) => waitingIfLostLast(borrowerId, playing))
    return { outbound, returned }
  }

  /** `loansReturned` só quando algo voltou: o integrador só refaz o mapa de todos quando precisa. */
  const loansReturnedField = (returned: LoanReturn[]): { loansReturned?: LoanReturn[] } => (returned.length === 0 ? {} : { loansReturned: returned })

  /** Nomes (sem repetir) de `playerIds`, na ordem; quem já saiu da lista não conta. */
  const namesOf = (playerIds: readonly string[]): string[] => [
    ...new Set(playerIds.flatMap((playerId) => {
      const name = players.get(playerId)?.name
      return name === undefined ? [] : [name]
    })),
  ]

  /** Quem ocupa assento na mesa gravada: os jogadores com ficha, na ordem em que entraram. */
  const seatedPlayers = (held: HeldTokens | undefined): PlayerRecord[] =>
    [...players.values()].sort((a, b) => a.joinedAt - b.joinedAt).filter((p) => seatTokensOf(p.playerId, held).length > 0)

  /**
   * O nome com que o jogador é gravado. Quem retomou grava com o nome do
   * assento, não com o "Ana (2)" que a sala lhe deu: na próxima retomada,
   * digitar "Ana" ainda o reencontra.
   */
  const seatNameOf = (p: PlayerRecord): string => claimedSeats.get(p.playerId)?.seat.name ?? p.name

  const buildSavedSeats = (held: HeldTokens | undefined): SavedSeat[] => {
    const seats: SavedSeat[] = []
    const owned = new Set<string>()
    const seated = new Set<string>()
    for (const p of seatedPlayers(held)) {
      const tokenIds = seatTokensOf(p.playerId, held)
      for (const tokenId of tokenIds) owned.add(tokenId)
      const name = seatNameOf(p)
      seated.add(normalizeName(name))
      seats.push({ name, tokenIds: [...tokenIds], visionRadius: visionOverrides.get(p.playerId) ?? null, sceneKey: currentScene.get(p.playerId) ?? null })
    }
    // Quem ainda não voltou continua na mesa, menos as fichas que o mestre já deu a outro.
    for (const seat of pendingSeats) {
      if (seated.has(normalizeName(seat.name))) continue
      const tokenIds = seat.tokenIds.filter((tokenId) => !owned.has(tokenId))
      if (tokenIds.length > 0) seats.push({ ...seat, tokenIds })
    }
    return seats
  }

  /**
   * Retomar a mesa: devolve a `playerId` o mapa explorado de cada cena do
   * assento, na ordem gravada (da usada há mais tempo à mais recente), até o
   * teto de cenas — mais as cenas de `withSeatTokens` (onde estão as fichas
   * devolvidas), que nunca ficam de fora, como em `memoryFor`. Cena com fio
   * torto fica de fora; as outras voltam. Devolve os ids das cenas restauradas.
   */
  const restoreMemories = (playerId: string, exploration: SavedSeatExploration, withSeatTokens: ReadonlySet<string>): string[] => {
    const byScene = memories.get(playerId) ?? new Map<string, PlayerMemory>()
    const restored: string[] = []
    const firstNewest = exploration.scenes.length - MAX_SCENE_MEMORIES_PER_PLAYER
    const kept = exploration.scenes.filter((scene, index) => index >= firstNewest || withSeatTokens.has(scene.mapId))
    for (const scene of kept) {
      const memory = restoredMemoryOf(scene)
      if (memory === null) continue
      byScene.delete(scene.mapId)
      byScene.set(scene.mapId, { ...memory, place: nextPlaceId(playerId) })
      restored.push(scene.mapId)
    }
    if (byScene.size > 0) memories.set(playerId, byScene)
    return restored
  }

  /**
   * Retomar a mesa: quem entra (sem resume) com o nome de um assento guardado
   * reencontra as fichas dele — só as que ainda existem em alguma cena e não
   * têm outro dono —, o raio, a cena e o mapa explorado. Sem nenhuma ficha que sobre, o assento
   * continua esperando e a pessoa entra sem personagem, como hoje.
   *
   * `typedName` é o nome DIGITADO, antes do `uniqueName`: depois de um
   * "Desfazer", quem pegou o assento por engano continua na sala com o nome,
   * e a Ana de verdade entra "Ana (2)" — o assento continua sendo dela.
   */
  const reclaimSeat = (record: PlayerRecord, typedName: string, world: HostWorld): ReclaimedSeat | undefined => {
    const wanted = normalizeName(typedName)
    const index = pendingSeats.findIndex((seat) => normalizeName(seat.name) === wanted)
    if (index < 0) return undefined
    const seat = pendingSeats[index]
    const inWorld = new Set(allScenes(world).flatMap((scene) => scene.map.tokens.map((token) => token.id)))
    const taken = tokensOwnedByOthers(record.playerId)
    const given = seat.tokenIds.filter((tokenId) => inWorld.has(tokenId) && !taken.has(tokenId))
    if (given.length === 0) return undefined
    pendingSeats.splice(index, 1)
    const exploration = pendingExploration.get(wanted)
    pendingExploration.delete(wanted)
    const withSeatTokens = new Set(allScenes(world).filter((scene) => scene.map.tokens.some((token) => given.includes(token.id))).map(sceneKey))
    const restoredMapIds = exploration === undefined ? [] : restoreMemories(record.playerId, exploration, withSeatTokens)
    claimedSeats.set(record.playerId, { seat, given, exploration, restoredMapIds })
    ownership[record.playerId] = [...new Set([...(ownership[record.playerId] ?? []), ...given])]
    if (seat.visionRadius !== null) visionOverrides.set(record.playerId, clampRadius(seat.visionRadius))
    // Só desempate: `sceneFor` ignora a chave se ele não tiver ficha naquela cena.
    if (seat.sceneKey !== null) currentScene.set(record.playerId, seat.sceneKey)
    // O nome GUARDADO: o mestre lê "Ana voltou", não o "ana" que ela digitou agora.
    return { playerId: record.playerId, name: seat.name, tokenIds: given }
  }

  /**
   * O que a conexão de quem entra, volta (resume) ou passa a ser outra pessoa
   * ("É ela") recebe logo depois do `welcome`: o mapa (ou a espera), o caderno
   * e as pistas dele, os cartões que vêm com o mapa, o recado só para ele que
   * ficou guardado, a pausa da cena e o alarme.
   */
  const entryOutbound = (clientId: string, playerId: string, world: HostWorld): Outbound[] => {
    const waiting: HostMessage[] = [{ type: 'lobby.waiting' }]
    // `next`: o snapshot (ou a espera); `cards`: os cartões que vêm atrás dele (texto da Sala, recado da cena).
    const [next, ...cards] = statusOf(playerId) === 'playing' ? viewFor(playerId, world, 'always') : waiting
    const outbound: Outbound[] = []
    if (next !== undefined) outbound.push({ clientId, msg: next })
    // O caderno vem antes do cartão: o cliente já tem o recado guardado quando o cartão reabre.
    const book = notebooks.get(playerId) ?? []
    if (book.length > 0) outbound.push({ clientId, msg: { type: 'notes.book', notes: book.map((entry) => ({ ...entry })) } })
    // MINHAS PISTAS: é o que faz a pista sobreviver a recarregar a página. Só a entrada, nunca a `source`.
    const clues = cluebooks.get(playerId) ?? []
    if (clues.length > 0) outbound.push({ clientId, msg: { type: 'clues.book', clues: clues.map((item) => ({ ...item.entry })) } })
    for (const msg of cards) outbound.push({ clientId, msg })
    // Conexão nova começa sem marca nenhuma na tela: a lista dele sai de novo, depois do mapa.
    sentDestinations.delete(playerId)
    pruneDestinations(world)
    outbound.push(...destinationUpdateFor(clientId, playerId, world))
    // Quem volta de uma queda recebe o recado só para ele que o mestre mandou enquanto ele estava fora.
    outbound.push(...pendingNoteFor(clientId, playerId, next))
    // Sem personagem: as fichas livres logo atrás da espera, para escolher uma.
    if (statusOf(playerId) !== 'playing') outbound.push(...seatOptionsIfChanged(clientId, world))
    // Depois do mapa: quem entra (ou volta) numa cena pausada já chega lendo o aviso.
    outbound.push(...pausedUpdate(clientId, playerId, world))
    // Quem volta (resume) para uma cena com alarme o recebe de novo, depois do mapa.
    outbound.push(...syncAlarms(world))
    return outbound
  }

  function handleJoin(clientId: string, msg: JoinMessage, world: HostWorld): HostResult {
    // Uma conexão é jogador OU tela da mesa, nunca as duas: a tela que mandasse
    // um `join` de jogador ganharia ficha e memória.
    if (byClient.has(clientId) || tableClients.has(clientId)) return reply(clientId, { type: 'error', reason: 'already_joined' })
    if (msg.role === 'table') return handleTableJoin(clientId, msg, world)
    if (msg.code !== options.code) return reply(clientId, { type: 'error', reason: 'bad_code' })

    const resumed = msg.resume === undefined ? undefined : [...players.values()].find((p) => p.resumeToken === msg.resume)
    // Quem está FORA com o mesmo nome (sem maiúsculas nem espaços): talvez
    // seja a mesma pessoa, noutro aparelho. Só o mestre decide; até lá entra
    // como pessoa nova ("Ana (2)"), sem nada da Ana.
    const lookalike = resumed === undefined ? [...players.values()].find((p) => p.clientId === null && normalizeName(p.name) === normalizeName(msg.name)) : undefined
    const record: PlayerRecord = resumed ?? {
      playerId: randomId(),
      name: msg.name,
      resumeToken: randomId(),
      clientId: null,
      joinedAt: now(),
      disconnectedAt: null,
    }
    // Reassumir derruba o vínculo com a conexão antiga, se ainda existir: é a
    // aba velha do mesmo aparelho. Ela fica sabendo e para, em vez de voltar
    // pelo resume e tomar a sessão de volta (cabo de guerra entre as abas).
    const replaced = record.clientId
    const replacedOut: Outbound[] = []
    if (replaced !== null) {
      byClient.delete(replaced)
      pausedSent.delete(replaced)
      lastPartySent.delete(replaced)
      lastSeatOptionsSent.delete(replaced)
      replacedOut.push({ clientId: replaced, msg: { type: 'session.replaced' } })
    }
    // Conexão antiga não fica com estado de patch de uma sessão que não é mais dela.
    if (replaced !== null) patchClients.delete(replaced)
    record.clientId = clientId
    record.disconnectedAt = null
    record.name = uniqueName(msg.name, record.playerId)
    players.set(record.playerId, record)
    byClient.set(clientId, record.playerId)
    // Voltou pelo resume: a pergunta "voltou?" que alguém provocou com o nome dele já não vale.
    for (const [candidate, previous] of pendingReturns) {
      if (previous === record.playerId) pendingReturns.delete(candidate)
    }
    // Voltou pelo resume: a ficha que o mestre emprestou enquanto ele estava fora volta para ele.
    const loanBack = resumed === undefined ? { outbound: [], returned: [] } : endLoansOf(record.playerId)
    // Antes do `next`: quem reencontra a ficha já entra jogando, sem passar pela espera.
    const reclaimed = resumed === undefined ? reclaimSeat(record, msg.name, world) : undefined
    // Quem reencontrou o assento da mesa guardada já é a Ana daquela mesa: a
    // "Ana" que está fora nesta sessão é outra pessoa (o mestre desfez a
    // retomada dela), e juntar as duas pelo "Ana voltou?" daria a ficha da Ana
    // a quem o mestre acabou de dizer que não é ela.
    const returnOf = reclaimed === undefined ? lookalike : undefined
    if (returnOf !== undefined) pendingReturns.set(record.playerId, returnOf.playerId)

    // `name` é o nome já passado por `uniqueName`: é assim que o jogador
    // descobre que entrou como "Ana (2)" em vez da "Ana" que digitou.
    const welcome: HostMessage = { type: 'welcome', playerId: record.playerId, resumeToken: record.resumeToken, name: record.name }
    // Conexão nova começa sem tela: o que a antiga recebeu não vale para ela.
    forgetSentView(record.playerId)
    // A aba que (re)entra não tem cartão nenhum: com mapa na tela, o teste
    // secreto que ainda espera a resposta DELE chega de novo, depois do mapa.
    lostSecretCheckCard.add(record.playerId)
    return {
      outbound: [{ clientId, msg: welcome }, ...entryOutbound(clientId, record.playerId, world), ...replacedOut, ...loanBack.outbound],
      ...loansReturnedField(loanBack.returned),
      ...(replaced === null ? {} : { replacedClientId: replaced }),
      ...(returnOf === undefined ? {} : { returnCandidate: { playerId: record.playerId, previousId: returnOf.playerId, name: returnOf.name } }),
      ...(reclaimed === undefined ? {} : { reclaimed }),
    }
  }

  /** Esquece tudo do jogador (kick, Dispensar, a "Ana (2)" que virou Ana). Não mexe em conexão: quem chama cuida de `byClient`. */
  function forgetPlayer(playerId: string): void {
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
    laserWindows.delete(playerId)
    laserRecipients.delete(playerId)
    pendingItems.delete(playerId)
    lastItemTakeAt.delete(playerId)
    lastItemGiveAt.delete(playerId)
    lastLeverAt.delete(playerId)
    enteredRooms.delete(playerId)
    notebooks.delete(playerId)
    noteSceneOf.delete(playerId)
    cluebooks.delete(playerId)
    seenPins.delete(playerId)
    lastClueShowAt.delete(playerId)
    placeCounters.delete(playerId)
    lastDiceRollAt.delete(playerId)
    destinations.delete(playerId)
    lastDestinationAt.delete(playerId)
    sentDestinations.delete(playerId)
    peeks.delete(playerId)
    visionFactors.delete(playerId)
    for (const chosen of pinAudiences.values()) chosen.delete(playerId)
    for (const sets of [pinReceived, pinRead]) {
      for (const [pinId, who] of sets) {
        who.delete(playerId)
        if (who.size === 0) sets.delete(pinId)
      }
    }
    for (const [itemId, chosen] of secretReveals) {
      chosen.delete(playerId)
      if (chosen.size === 0) secretReveals.delete(itemId)
    }
    for (const check of secretChecks.values()) {
      check.asked.delete(playerId)
      check.answers.delete(playerId)
    }
    lostSecretCheckCard.delete(playerId)
    dropPlanGrants(playerId, null)
    pendingSeatClaims.delete(playerId)
    lastSeatClaimDeniedAt.delete(playerId)
    // Esquecido não tem mais o que desfazer. O assento não volta: quem foi
    // expulso entraria de novo com o mesmo nome e levaria a ficha.
    claimedSeats.delete(playerId)
    pendingReturns.delete(playerId)
    for (const [candidate, previous] of pendingReturns) {
      if (previous === playerId) pendingReturns.delete(candidate)
    }
    // Dono esquecido: a ficha fica com quem a joga, sem empréstimo. Quem a
    // jogava esquecido: a posse dele já saiu acima, e a ficha fica com o dono.
    for (const [tokenId, loan] of loans) {
      if (loan.ownerId === playerId || loan.borrowerId === playerId) loans.delete(tokenId)
    }
  }

  /** A pergunta "voltou?" ainda faz sentido: os dois existem, quem entrou está conectado e a Ana continua fora. */
  function returnStillValid(playerId: string, previousId: string): boolean {
    if (pendingReturns.get(playerId) !== previousId) return false
    const current = players.get(playerId)
    const previous = players.get(previousId)
    return current !== undefined && current.clientId !== null && previous !== undefined && previous.clientId === null
  }

  /**
   * Junta `from` (quem entrou agora) na Ana `into`: a Ana fica com as fichas
   * dos dois, as cenas que só `from` tinha visto e, sem raio próprio, o dele.
   */
  function mergeInto(into: string, from: string): void {
    const owned = ownership[into] ?? []
    ownership[into] = [...owned, ...(ownership[from] ?? []).filter((id) => !owned.includes(id))]
    // A ficha que `from` jogava emprestada passa a ser jogada pela Ana; se era da própria Ana, deixa de ser empréstimo.
    for (const [tokenId, loan] of loans) {
      if (loan.borrowerId !== from) continue
      if (loan.ownerId === into) loans.delete(tokenId)
      else loan.borrowerId = into
    }
    const target = memories.get(into) ?? new Map<string, PlayerMemory>()
    for (const [key, memory] of memories.get(from) ?? []) {
      if (!target.has(key)) target.set(key, memory)
    }
    if (target.size > 0) memories.set(into, target)
    const radius = visionOverrides.get(from)
    if (!visionOverrides.has(into) && radius !== undefined) visionOverrides.set(into, radius)
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
    return filterMapForPlayer(map, playerId, ownership, tokenRadiusIn(playerId, map), memory?.exp, memory?.doors).map.tokens
  }

  /**
   * RESPOSTA AO TESTE SECRETO: só conta de quem foi pedido, com o teste
   * aberto e na primeira vez. Id inventado, pedido de outro, repetida ou
   * depois de encerrar morrem em silêncio — responder "recusado" só ensinaria
   * que o teste existe. Nada volta a jogador nenhum: o resultado é do mestre.
   */
  function handleSecretCheckAnswer(clientId: string, msg: SecretCheckAnswerMessage): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const check = secretChecks.get(msg.id)
    const record = players.get(playerId)
    if (check === undefined || record === undefined || !check.open) return { outbound: [] }
    if (!check.asked.has(playerId) || check.answers.has(playerId)) return { outbound: [] }
    check.answers.set(playerId, msg.result)
    return { outbound: [], secretCheckAnswer: { checkId: msg.id, playerId, playerName: record.name, label: check.label, result: msg.result } }
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
    // MAPA-MUNDI: a caravana é do mestre. O jogador nem recebe a própria ficha
    // aqui; um pedido com o id dela (guardado da cena de antes) é travado.
    if (isWorldMap(scene.map)) return reply(clientId, { type: 'token.move.rejected', reqId: msg.reqId, reason: 'locked' })
    // INICIATIVA: vez nesta cena prende quem não é da vez, inclusive na vez de
    // ficha que o jogador não vê. A recusa só diz "não é a sua vez", nunca de quem é.
    // Vez de ficha que saiu da cena (apagada, viajou) não prende ninguém (`turnTokenIdOn`).
    const turnTokenId = turnTokenIdOn(options.getTurn?.() ?? null, scene.map)
    // LEVAR FICHA JUNTO: o ferido que ela leva sai do caminho junto com ela, então
    // não ocupa a casa para onde ela vai. O vínculo vem do mapa do MESTRE: o
    // recorte do jogador não o carrega.
    const carriedIds = new Set(carriedBy(scene.map, msg.tokenId).map((t) => t.id))
    const occupants = occupantsSeenBy(playerId, scene.map)?.filter((t) => !carriedIds.has(t.id))
    const result = validateTokenMove(scene.map, { playerId, tokenId: msg.tokenId, x: msg.x, y: msg.y }, ownership, {
      occupants,
      turnTokenId,
    })
    if (!result.ok) return reply(clientId, { type: 'token.move.rejected', reqId: msg.reqId, reason: result.reason })
    // `landing` só leva o motivo; o ponto já passou pelo recorte em `validateTokenMove`
    // (chão em zona oculta ou sala secreta nunca vira destino; sala com teto vira,
    // como no movimento normal, e o teto abre porque a ficha entrou).
    const landing = result.landing === undefined ? {} : { landing: result.landing }
    const accepted: HostMessage = { type: 'token.move.accepted', reqId: msg.reqId, x: result.x, y: result.y, ...landing }
    return {
      outbound: [{ clientId, msg: accepted }],
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
    // A cor da FICHA (a do laser): é a peça que os outros procuram no mapa.
    const color = laserColorOf(playerId, map)
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
   * DADO ROLADO NA SALA: quem recebe a rolagem é a MESA INTEIRA — todo jogador
   * conectado, em qualquer cena, jogando ou aguardando a ficha. A rolagem não
   * diz nada de onde ninguém está (`diceRollForPlayer` só deixa passar quem
   * rolou, o dado e o resultado), então não há o que recortar por cena. A
   * escondida do mestre o recorte devolve `null`, e ela não sai para ninguém.
   */
  const diceOutbound = (roll: HostDiceRoll): Outbound[] => {
    const forPlayers = diceRollForPlayer(roll)
    if (forPlayers === null) return []
    // Um objeto por destinatário: quem despacha pode mexer num sem tocar o dos outros.
    return [...byClient.keys()].map((clientId): Outbound => ({ clientId, msg: { type: 'dice.rolled', roll: { ...forPlayers, results: [...forPlayers.results] } } }))
  }

  /**
   * "Espiar" pela porta FECHADA encostada no token do jogador. Mesma autoridade
   * do `door.toggle` (e o mesmo limite por jogador): porta visível para ele
   * agora e token perto. Trancada NÃO recusa — espiar pela fechadura é
   * justamente o que se faz numa porta trancada. Porta aberta não tem o que
   * espiar e não faz nada. Aceito, a visão DELE atravessa a porta por
   * `PEEK_DURATION_MS` (`peekingFor`); a porta do mestre não muda.
   */
  function handleDoorPeek(clientId: string, msg: DoorPeekMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const record = players.get(playerId)
    if (record === undefined || statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    if (scene === null) return { outbound: [] }
    const map = scene.map
    const at = now()
    const last = lastDoorToggleAt.get(playerId)
    if (last !== undefined && at - last < DOOR_TOGGLE_MIN_INTERVAL_MS) return { outbound: [] }
    lastDoorToggleAt.set(playerId, at)

    const reject = (reason: 'far' | 'not_visible'): HostResult => reply(clientId, { type: 'door.toggle.rejected', wallId: msg.wallId, reason })
    const wall = map.walls.find((w) => w.id === msg.wallId)
    if (wall === undefined || wall.door === null) return reject('not_visible')
    const memory = memoryFor(playerId, map, world)
    // Sem o espiar de antes: a porta tem de estar à vista pela visão de sempre.
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId, map), memory.exp, memory.doors, pinAudiences, undefined, undefined, secretReveals)
    // Porta secreta nunca entra aqui: para o jogador ela é parede (`lib/fogFilter.ts`).
    if (!view.visibleDoorIds.includes(wall.id)) return reject('not_visible')
    if (wall.door.open && !wall.door.locked) return { outbound: [] }
    const owned = new Set(ownership[playerId] ?? [])
    const near = view.map.tokens.some((t) => owned.has(t.id) && tokenReachesDoor(t, wall, map.grid))
    if (!near) return reject('far')
    peeks.set(playerId, { sceneKey: sceneKey(scene), wallId: wall.id, until: at + PEEK_DURATION_MS })
    return { outbound: [], peek: { playerId, playerName: record.name, wallId: wall.id } }
  }

  const newDiceRoll = (request: DiceRequest, from: string): HostDiceRoll => {
    const { results, total } = rollDice(request, rollDie)
    return { id: randomId(), from, count: request.count, sides: request.sides, modifier: request.modifier, results, total, at: now() }
  }

  /**
   * O jogador PEDE a rolagem; quem rola é o host. Rolagem de quem não entrou
   * recusa; a de dentro do intervalo mínimo morre em silêncio (não é mensagem
   * malformada, é dedo apressado ou laço).
   */
  function handleDiceRoll(clientId: string, msg: DiceRollMessage): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const record = players.get(playerId)
    if (record === undefined) return { outbound: [] }
    const at = now()
    const last = lastDiceRollAt.get(playerId)
    if (last !== undefined && at - last < DICE_ROLL_MIN_INTERVAL_MS) return { outbound: [] }
    lastDiceRollAt.set(playerId, at)
    const roll = newDiceRoll(msg, record.name)
    return { outbound: diceOutbound(roll), diceRoll: roll }
  }

  /** A cor do laser do jogador: a da ficha DELE nesta cena; ficha sem cor, a da paleta de sinais. */
  const laserColorOf = (playerId: string, map: MapData): string => {
    const owned = ownership[playerId] ?? []
    for (const t of map.tokens) {
      if (!owned.includes(t.id)) continue
      const chosen = selectedTokenColor(t)
      if (chosen !== null) return chosen
    }
    return signalColor(playerId)
  }

  /**
   * Tira a marca de quem não está mais onde a pôs: perdeu a última ficha, ou
   * a ficha dele está em outra cena. Uma marca "vamos para cá" de quem já foi
   * embora mandaria o grupo a lugar nenhum — e diria onde ele esteve.
   */
  const pruneDestinations = (world: HostWorld): void => {
    for (const [ownerId, mark] of destinations) {
      const scene = statusOf(ownerId) === 'playing' ? sceneFor(ownerId, world) : null
      if (scene === null || sceneKey(scene) !== mark.scene) destinations.delete(ownerId)
    }
  }

  /**
   * As marcas que `playerId` pode ver agora: só as da cena DELE; a própria
   * sempre; a dos outros só em ponto que ele já conhece (visão do último
   * snapshot ou explorado) e fora de zona oculta ativa e de sala secreta — a
   * mesma regra do sinal, porque a marca diria que ali existe algo. Quem
   * aguarda, ou não está em cena nenhuma, vê lista vazia.
   */
  const destinationsFor = (playerId: string, world: HostWorld): DestinationMark[] => {
    if (statusOf(playerId) !== 'playing') return []
    const scene = sceneFor(playerId, world)
    if (scene === null) return []
    const key = sceneKey(scene)
    const blocked = playerBlockedRings(scene.map)
    const marks: DestinationMark[] = []
    for (const [ownerId, mark] of destinations) {
      if (mark.scene !== key) continue
      const owner = players.get(ownerId)
      if (owner === undefined) continue
      const mine = ownerId === playerId
      if (!mine) {
        const point = { x: mark.x, y: mark.y }
        if (blocked.some((ring) => ring.length >= 3 && pointInRing(point, ring))) continue
        if (!knowsPoint(playerId, scene.map, point)) continue
      }
      marks.push({ x: mark.x, y: mark.y, from: owner.name, color: laserColorOf(ownerId, scene.map), mine })
    }
    return marks
  }

  /**
   * A lista de marcas de cada jogador conectado, SÓ para quem a lista mudou
   * desde a última mandada. Chamada depois dos snapshots: é a visão nova que
   * decide o que cada um já conhece.
   */
  const destinationUpdates = (world: HostWorld): Outbound[] => {
    pruneDestinations(world)
    return [...byClient].flatMap(([clientId, playerId]) => destinationUpdateFor(clientId, playerId, world))
  }

  /** A lista de um jogador só, se mudou. Quem chama já passou por `pruneDestinations`. */
  const destinationUpdateFor = (clientId: string, playerId: string, world: HostWorld): Outbound[] => {
    const marks = destinationsFor(playerId, world)
    const key = JSON.stringify(marks)
    if (key === (sentDestinations.get(playerId) ?? '[]')) return []
    sentDestinations.set(playerId, key)
    return [{ clientId, msg: { type: 'destinations', marks } }]
  }

  /**
   * MARCA "VAMOS PARA CÁ": põe, move ou tira a marca de quem manda, e devolve
   * a lista nova a cada um cuja lista mudou. O mestre lê pelo `listPlayers`.
   * Ponto fora do mapa, de quem não joga ou antes do intervalo mínimo morre
   * em silêncio, como o sinal.
   */
  function handleDestination(clientId: string, msg: DestinationMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    if ('clear' in msg) {
      if (!destinations.delete(playerId)) return { outbound: [] }
      return { outbound: destinationUpdates(world) }
    }
    if (statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    if (scene === null) return { outbound: [] }
    const map = scene.map
    if (msg.x < 0 || msg.y < 0 || msg.x > map.width * map.grid || msg.y > map.height * map.grid) return { outbound: [] }
    const at = now()
    const last = lastDestinationAt.get(playerId)
    if (last !== undefined && at - last < DESTINATION_MIN_INTERVAL_MS) return { outbound: [] }
    lastDestinationAt.set(playerId, at)
    destinations.set(playerId, { scene: sceneKey(scene), x: msg.x, y: msg.y })
    return { outbound: destinationUpdates(world) }
  }

  /**
   * Fim do gesto: `off` só a quem recebeu algum ponto dele E ainda joga na
   * mesma cena de quem aponta, e o mestre sempre. Quem trocou de cena no meio
   * do gesto (ou quem aponta viajou) não recebe: o `off` leva nome e cor, e
   * quem está em outra cena não recebe nada pelo socket. A ponta que ficou na
   * tela dele se apaga sozinha (REMOTE_LASER_IDLE_MS).
   */
  function endPlayerLaser(playerId: string, record: PlayerRecord, world: HostWorld): HostResult {
    const scene = sceneFor(playerId, world)
    const color = scene === null ? signalColor(playerId) : laserColorOf(playerId, scene.map)
    const outbound: Outbound[] = []
    const gesture = laserRecipients.get(playerId)
    if (scene !== null && gesture !== undefined && gesture.scene === sceneKey(scene)) {
      for (const otherClient of gesture.clients) {
        // Quem caiu no meio do gesto não tem mais socket para o aviso.
        const otherId = byClient.get(otherClient)
        if (otherId === undefined || statusOf(otherId) !== 'playing') continue
        if (sceneFor(otherId, world) !== scene) continue
        outbound.push({ clientId: otherClient, msg: { type: 'laser', off: true, from: record.name, color } })
      }
    }
    laserRecipients.delete(playerId)
    return { outbound, playerLaser: { playerId, name: record.name, color, update: { off: true }, onOpenScene: scene === world.open } }
  }

  /**
   * LASER DO JOGADOR. Vai ao mestre (inteiro) e a quem joga NA MESMA CENA — e,
   * de cada lote, cada um recebe só os pontos que já conhece (visão do último
   * snapshot ou explorado) e que estão fora de zona oculta ativa e de sala
   * secreta: a mesma regra do sinal, ponto a ponto, porque o rastro que
   * atravessa o escuro desenharia o formato do que o outro nunca viu. Lote de
   * quem aguarda, fora do mapa ou acima do teto por segundo morre em silêncio.
   * Quem aponta não recebe eco: a tela dele desenha o próprio rastro na hora.
   */
  function handlePlayerLaser(clientId: string, msg: PlayerLaserMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const record = players.get(playerId)
    if (record === undefined) return { outbound: [] }
    if ('off' in msg) return endPlayerLaser(playerId, record, world)
    if (statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    if (scene === null) return { outbound: [] }
    const map = scene.map
    const inside = msg.points.filter((p) => p.x >= 0 && p.y >= 0 && p.x <= map.width * map.grid && p.y <= map.grid * map.height)
    if (inside.length === 0) return { outbound: [] }
    const at = now()
    const quota = laserWindows.get(playerId)
    if (quota === undefined || at - quota.start >= PLAYER_LASER_WINDOW_MS) laserWindows.set(playerId, { start: at, count: 1 })
    else if (quota.count >= PLAYER_LASER_MAX_PER_WINDOW) return { outbound: [] }
    else quota.count += 1

    const color = laserColorOf(playerId, map)
    const blocked = playerBlockedRings(map)
    const shareable = inside.filter((p) => !blocked.some((ring) => ring.length >= 3 && pointInRing(p, ring)))
    const outbound: Outbound[] = []
    const here = sceneKey(scene)
    let recipients = laserRecipients.get(playerId)
    // Lista de outra cena = gesto antigo cujo `off` se perdeu: não vale aqui.
    if (recipients !== undefined && recipients.scene !== here) {
      laserRecipients.delete(playerId)
      recipients = undefined
    }
    for (const [otherClient, otherId] of byClient) {
      if (otherId === playerId || statusOf(otherId) !== 'playing') continue
      // Outra cena: o ponto é deste mapa, e nem o nome de quem aponta vai para lá.
      if (sceneFor(otherId, world) !== scene) continue
      const visible = shareable.filter((p) => knowsPoint(otherId, map, p))
      if (visible.length === 0) continue
      outbound.push({ clientId: otherClient, msg: { type: 'laser', points: visible, from: record.name, color } })
      if (recipients === undefined) {
        recipients = { scene: here, clients: new Set() }
        laserRecipients.set(playerId, recipients)
      }
      recipients.clients.add(otherClient)
    }
    return { outbound, playerLaser: { playerId, name: record.name, color, update: { points: inside }, onOpenScene: scene === world.open } }
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
   * A porta `wallId` do mapa do MESTRE (com o cadeado real), só se o jogador a
   * vê AGORA — lembrada não conta, senão abriria porta do outro lado do mapa.
   * `near`: algum token dele, no recorte dele (respeita camada oculta e token
   * escondido pelo mestre), encosta nela. `nearTokens`: os mesmos tokens, para
   * quem precisa saber de que LADO encostou (`doorOpensFrom`). `null` =
   * inexistente ou no escuro.
   */
  const doorSeenBy = (
    playerId: string,
    map: MapData,
    wallId: string,
    world: HostWorld,
  ): { wall: Wall; door: DoorState; near: boolean; nearTokens: Token[]; key: string | null; inDoorway: boolean } | null => {
    const wall = map.walls.find((w) => w.id === wallId)
    if (wall === undefined || wall.door === null) return null
    const memory = memoryFor(playerId, map, world)
    const view = filterMapForPlayer(map, playerId, ownership, tokenRadiusIn(playerId, map), memory.exp, memory.doors, pinAudiences, undefined, memory.seenRooms)
    if (!view.visibleDoorIds.includes(wall.id)) return null
    const owned = new Set(ownership[playerId] ?? [])
    const nearIds = new Set(view.map.tokens.filter((t) => owned.has(t.id) && tokenReachesDoor(t, wall, map.grid)).map((t) => t.id))
    const nearTokens = map.tokens.filter((t) => nearIds.has(t.id))
    // CHAVE ABRE PORTA: a mochila é a das fichas do MAPA DO MESTRE encostadas
    // na porta — a chave precisa estar na mão de quem está ali, não na de uma
    // ficha dele do outro lado da cena.
    const found = keyForDoor(wall.door, nearTokens)
    // FECHAR com uma ficha no vão é `blocked` (a porta desceria em cima dela).
    // Só conta ficha do recorte do jogador — uma que o mestre esconde não
    // pode denunciar que há alguém ali; essa, a porta fecha como se o vão
    // estivesse livre.
    const inDoorway = view.map.tokens.some((t) => tokenInDoorway(t, wall, map.grid))
    return { wall, door: wall.door, near: nearIds.size > 0, nearTokens, key: found === null ? null : found.item.nome, inDoorway }
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
    const record = players.get(playerId)
    if (record === undefined || statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    // Cena pausada morre em silêncio: o aviso fixo da pausa já diz por quê, e
    // não gasta o intervalo da porta de quem vai tentar de novo depois.
    if (scene === null || inPausedScene(scene)) return { outbound: [] }
    if (!withinDoorLimit(lastDoorToggleAt, playerId)) return { outbound: [] }

    const reject = (reason: DoorToggleRejection): HostResult => reply(clientId, { type: 'door.toggle.rejected', wallId: msg.wallId, reason })

    const seen = doorSeenBy(playerId, scene.map, msg.wallId, world)
    if (seen === null) return reject('not_visible')
    // Trancada antes de longe: "Trancada" é a informação útil, e é dela que sai o pedido ao mestre.
    // Quem encosta com a chave lê o nome dela: é o item que ele já carrega, não o que a porta pede.
    if (seen.door.locked) {
      return seen.key === null ? reject('locked') : reply(clientId, { type: 'door.toggle.rejected', wallId: msg.wallId, reason: 'locked', key: seen.key })
    }
    if (!seen.near) return reject('far')
    // PORTA DE UM LADO: para ABRIR, uma ficha dele encostada precisa estar do
    // lado que abre (`DoorState.opensFrom`; a parede é a do mestre, o lado
    // nunca sai no recorte). Fechar vale dos dois lados.
    if (!seen.door.open && !seen.nearTokens.some((t) => doorOpensFrom(seen.wall, t))) return reject('wrong_side')
    // FECHAR com uma ficha no vão é blocked: a porta desceria em cima dela.
    if (seen.door.open && seen.inDoorway) return reject('blocked')

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

    const seen = doorSeenBy(playerId, scene.map, msg.wallId, world)
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
    // Cena pausada: o pedido morre em silêncio, como o toque na porta.
    if (scene === null || inPausedScene(scene)) return { outbound: [] }
    if (!withinDoorLimit(lastDoorRequestAt, playerId)) return { outbound: [] }

    const reject = (reason: DoorRequestRejection): HostResult => reply(clientId, { type: 'door.request.rejected', wallId: msg.wallId, reason })

    if (pendingDoors.has(playerId)) return reject('pending')
    const seen = doorSeenBy(playerId, scene.map, msg.wallId, world)
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
  const takeCheck = (playerId: string, map: MapData, pinId: string, world: HostWorld): { pin: Pin; nome: string; livre: boolean; token: Token } | PinTakeRejection => {
    const pin = map.pins.find((p) => p.id === pinId)
    const item = pin === undefined ? null : itemOfPin(pin)
    if (pin === undefined || item === null) return 'unavailable'
    const memory = memoryFor(playerId, map, world)
    // "Quem vê" entra no recorte: pino que não chega a este jogador não se pega.
    const view = filterMapForPlayer(map, playerId, ownership, tokenRadiusIn(playerId, map), memory.exp, memory.doors, pinAudiences, undefined, memory.seenRooms)
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
    const found = takeCheck(playerId, scene.map, msg.pinId, world)
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
   * ALAVANCA. Autoridade no molde do "Pegar": o pino existe na cena dele, é
   * alavanca, está no recorte dele (oculto, no escuro ou sob teto não vale) e
   * uma ficha dele, no recorte dele, está ao alcance. A porta ligada NÃO
   * precisa estar à vista — a alavanca existe justamente para mover a porta de
   * outra sala. Ela só não move porta trancada (`stuck`), e a resposta nunca
   * diz qual porta nem o estado dela: quem enxerga a porta vê pelo recorte.
   */
  function handlePinLever(clientId: string, msg: PinLeverMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    if (statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    // Cena pausada: a alavanca mexe numa porta, então morre em silêncio como o toque na porta.
    if (scene === null || inPausedScene(scene)) return { outbound: [] }
    if (!withinDoorLimit(lastLeverAt, playerId)) return { outbound: [] }

    const reject = (reason: PinLeverRejection): HostResult => reply(clientId, { type: 'pin.lever.rejected', reason })
    const map = scene.map
    const pin = map.pins.find((p) => p.id === msg.pinId)
    if (pin === undefined || pin.kind !== 'alavanca') return reject('unavailable')
    const memory = memoryFor(playerId, map, world)
    // "Quem vê" entra no recorte: alavanca que não chega a este jogador não se puxa.
    const view = filterMapForPlayer(map, playerId, ownership, tokenRadiusIn(playerId, map), memory.exp, memory.doors, pinAudiences, undefined, memory.seenRooms)
    if (!view.map.pins.some((p) => p.id === pin.id)) return reject('unavailable')
    const owned = new Set(ownership[playerId] ?? [])
    if (!view.map.tokens.some((t) => owned.has(t.id) && tokenReachesPin(t, pin, map.grid))) return reject('far')
    const door = linkedDoorOf(map, pin)
    if (door === null || door.door.locked) return reject('stuck')

    return {
      outbound: [{ clientId, msg: { type: 'pin.lever.answer', answer: 'pulled' } }],
      applyDoor: { wallId: door.id, open: !door.door.open, ...backgroundSceneId(scene, world) },
    }
  }

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
    const memory = memoryFor(playerId, map, world)
    const view = filterMapForPlayer(map, playerId, ownership, tokenRadiusIn(playerId, map), memory.exp, memory.doors)
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
    // Ficha emprestada: quem a joga move, mas o nome e a cara são do dono.
    if (loans.get(msg.tokenId)?.borrowerId === playerId) return { outbound: [] }
    // O token pode estar em qualquer cena: a ficha é do jogador, não do mapa aberto.
    const scene = allScenes(world).find((s) => s.map.tokens.some((t) => t.id === msg.tokenId))
    if (scene === undefined) return { outbound: [] }
    if (msg.image !== undefined) {
      const at = now()
      const last = lastTokenPhotoAt.get(playerId)
      // Descartada: a tela do jogador já mostra a foto nova (edição otimista) e
      // nenhum broadcast a desfaria — para o host a tela dele não mudou. Volta
      // a tela recebida por último, com a foto que vale.
      if (last !== undefined && at - last < TOKEN_PHOTO_MIN_INTERVAL_MS) return resendView(clientId, playerId, world)
      lastTokenPhotoAt.set(playerId, at)
    }
    return { outbound: [], applyTokenEdit: { tokenId: msg.tokenId, name: msg.name, image: msg.image, ...backgroundSceneId(scene, world) } }
  }

  /**
   * LEITURA DA PISTA: só conta pino que o host já mandou COM o texto a este
   * jogador (`pinReceived`). Id inventado, pino no escuro ou "só de perto"
   * visto de longe morrem em silêncio — responder "recusado" só ensinaria
   * quais ids existem. Nada volta ao jogador.
   */
  function handlePinRead(clientId: string, msg: PinReadMessage): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const receivedBy = pinReceived.get(msg.pinId)
    if (receivedBy === undefined || !receivedBy.has(playerId)) return { outbound: [] }
    addToSet(pinRead, msg.pinId, playerId)
    return { outbound: [] }
  }

  /**
   * O jogador descartou um `patch` cuja `base` não era a tela dele (mensagem
   * perdida na fila do transporte) e pede a inteira. Mais de um pedido por
   * `VIEW_RESYNC_MIN_INTERVAL_MS` morre em silêncio: a tela inteira é o
   * recorte mais caro do host.
   */
  function handleResync(clientId: string, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    if (statusOf(playerId) !== 'playing') return { outbound: [] }
    const at = now()
    const last = lastResyncAt.get(playerId)
    if (last !== undefined && at - last < VIEW_RESYNC_MIN_INTERVAL_MS) return { outbound: [] }
    lastResyncAt.set(playerId, at)
    sentViews.delete(clientId)
    return resendView(clientId, playerId, world)
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
  function validTravel(playerId: string, pinId: string, exitId: string, world: HostWorld, withKey = false, passaCadeado = false): ValidTravel | null {
    const from = sceneFor(playerId, world)
    if (from === null || from.sceneId === null) return null
    const fromSceneId = from.sceneId
    // MAPA-MUNDI: a caravana viaja inteira, e quem a leva é o mestre
    // (`disembarkCaravan`). Um jogador sozinho não sai dela por um pino.
    if (isWorldMap(from.map)) return null
    const pin = from.map.pins.find((p) => p.id === pinId)
    if (pin === undefined) return null
    const memory = memoryFor(playerId, from.map, world)
    const view = filterMapForPlayer(
      from.map,
      playerId,
      ownership,
      tokenRadiusIn(playerId, from.map),
      memory.exp,
      memory.doors,
      pinAudiences,
      undefined,
      memory.seenRooms,
      secretReveals,
      undefined,
      memory.plan,
    )
    const seen = view.map.pins.find((p) => p.id === pinId)
    if (seen === undefined) return null
    // MARCO visto de longe: o pino chega ao jogador na névoa, mas ele nunca
    // esteve lá. Sem isto, marco + viagem seria teletransporte de qualquer
    // ponto do mapa (e, "livre", sem o mestre saber).
    if (seen.soMarco === true) return null
    const owned = new Set(ownership[playerId] ?? [])
    // Trancada: ninguém passa sozinho. Cai no mesmo `null` de todo o resto,
    // então o jogador lê o motivo genérico de sempre e nada chega ao mestre.
    // Estar aqui, e não só no pedido, faz o "Deixar ir" de um pedido feito
    // antes de trancar recusar também (ele chama sem `withKey`).
    // CHAVE ABRE PORTA: a exceção é o pedido do próprio jogador (`withKey`)
    // com uma ficha DELE encostada no pino carregando o "Abre com" — a
    // mochila é a do MAPA DO MESTRE, e é essa ficha que passa.
    // `passaCadeado`: o pedido É pelo pino trancado que aceita tentativas (ou
    // a resposta do mestre a ele) — o cadeado é justamente o que o mestre vai
    // decidir. Com a chave na mochila, a chave vence: passa sem pedir.
    let keyHolder: { token: Token; nome: string } | null = null
    if (passageOf(pin) === 'trancada') {
      if (withKey) {
        const nearIds = new Set(view.map.tokens.filter((t) => owned.has(t.id) && tokenReachesPin(t, pin, from.map.grid)).map((t) => t.id))
        const found = keyForPin(pin, from.map.tokens.filter((t) => nearIds.has(t.id)))
        if (found !== null) keyHolder = { token: found.token, nome: found.item.nome }
      }
      if (keyHolder === null && !passaCadeado) return null
    }
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
    const base = { from: { ...from, sceneId: fromSceneId }, to: { ...to, sceneId: to.sceneId }, pin, partner: travel.partner }
    if (keyHolder !== null) return { ...base, token: keyHolder.token, key: keyHolder.nome }
    // Tokens do recorte do jogador: respeita camada oculta e token escondido pelo mestre.
    const mine = view.map.tokens.filter((t) => owned.has(t.id))
    let token: Token | null = null
    for (const t of mine) {
      if (token === null || Math.hypot(t.x - pin.x, t.y - pin.y) < Math.hypot(token.x - pin.x, token.y - pin.y)) token = t
    }
    if (token === null) return null
    return { ...base, token }
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
    const pinHere = scene?.map.pins.find((p) => p.id === msg.pinId) // undefined = pino que não existe na cena dele
    if (scene === null || pinHere === undefined) return reject('unavailable')
    const limitKey = `${playerId}|${sceneKey(scene)}|${msg.pinId}`
    const last = lastTravelRequestAt.get(limitKey)
    if (last !== undefined && at - last < TRAVEL_REQUEST_MIN_INTERVAL_MS) return reject('too_soon')
    lastTravelRequestAt.set(limitKey, at)

    const exitId = msg.exitId ?? SAIDA_PRINCIPAL
    // Pino trancado que aceita tentativas: o pedido passa por todas as outras
    // regras (névoa, ligação, ficha na cena) e vai ao mestre marcado. Trancado
    // MUDO segue recusado no `validTravel`, com o motivo genérico — salvo com
    // a chave na mochila (`withKey`), que passa sem pedir.
    const trancada = acceptsLockedRequest(pinHere)
    const travel = validTravel(playerId, msg.pinId, exitId, world, true, trancada)
    if (travel === null) return reject('unavailable')
    // Livre: passou em tudo que o pedido passaria (névoa, token na cena, pino
    // ligado, limites, nenhum pendente) e vai direto, sem esperar o mestre —
    // ele só lê o aviso de chegada que o integrador mostra com a transferência.
    if (passageOf(travel.pin) === 'livre') return transferResult(playerId, clientId, record.name, travel, world)
    // Encruzilhada: o mestre lê a SAÍDA ("Escada da torre → Torre Alta"), o
    // mesmo rótulo que a jogadora tocou; pino de uma saída continua nomeado
    // pela descrição, como sempre.
    const description = travel.pin.description.trim()
    const saidas = exitLabelsOf(travel.pin)
    const saida = saidas.length > 1 ? saidas.find((s) => s.id === exitId) : undefined
    const pinLabel = saida !== undefined ? saida.rotulo : description === '' ? pinSummary(travel.pin) : description
    // CHAVE ABRE PORTA: trancado, mas a ficha encostada carrega o "Abre com".
    // Passa como no livre, e o mestre recebe o aviso de quem abriu e com quê.
    if (travel.key !== undefined) {
      const used: PinKeyUse = { playerId, playerName: record.name, itemName: travel.key, pinLabel }
      // `travel.from` é cópia (sceneId garantido): a cena de fundo se reconhece pelo id, não pela identidade.
      if (travel.from.sceneId !== world.open.sceneId) used.sceneName = travel.from.name
      return { ...transferResult(playerId, clientId, record.name, travel, world), pinKeyUsed: used }
    }
    const requestId = randomId()
    // O destino que o mestre LEU vai junto: é com ele que o "Deixar ir" confere.
    const pending: PendingTravel = { requestId, playerId, pinId: msg.pinId, exitId, toSceneId: travel.to.sceneId, partnerId: travel.partner.id }
    if (trancada) pending.trancada = true
    pendingTravels.set(playerId, pending)
    // Pedido do mestre: nada disto vai ao jogador (`outbound` vazio).
    const travelRequest: TravelRequest = {
      requestId,
      playerId,
      playerName: record.name,
      pinLabel,
      toSceneId: travel.to.sceneId,
      toSceneName: travel.to.name,
    }
    if (trancada) travelRequest.trancada = true
    return { outbound: [], travelRequest }
  }

  /**
   * LEVAR FICHA JUNTO na travessia: as fichas que `carrierId` leva na cena de
   * origem vão junto, assentadas em volta de `spot` (`companionArrivals`). O
   * vínculo é lido do mapa do MESTRE (`from.map`), nunca do recorte do jogador,
   * que não o carrega. Ficha levada que é de OUTRO jogador leva a cena dele
   * junto: ele recebe o mesmo aviso de quem leva foi movido pelo mestre (`by`:
   * 'master' no pino e no "Mandar para…", 'gather' na reunião), porque não
   * foi ele quem pediu — e o pedido de passagem que ele tinha perde o pino.
   * Só quando ele ESTAVA na cena de origem e não deixa ficha lá: dono de duas
   * fichas que fica com a principal para trás continua onde está, mandando
   * nela, com o pedido que tinha. Um aviso por dono, mesmo levando duas dele.
   * Ninguém levado: `transfer` vazio, e o `applyTransfer` fica como sempre foi.
   */
  function carriedAlong(
    carrierPlayerId: string,
    carrierId: string,
    from: HostScene,
    to: HostScene,
    spot: { x: number; y: number },
    world: HostWorld,
    by: 'master' | 'gather',
  ): { transfer: Pick<AppliedTransfer, 'junto'>; outbound: Outbound[]; lost: Pick<HostResult, 'lostTravels'> } {
    const carrier = from.map.tokens.find((t) => t.id === carrierId)
    const carried = carriedBy(from.map, carrierId)
    if (carrier === undefined || carried.length === 0) return { transfer: {}, outbound: [], lost: {} }
    const carriedIds = new Set(carried.map((t) => t.id))
    const moved = new Set<string>()
    const outbound: Outbound[] = []
    const lostTravels: Outbound[] = []
    for (const token of carried) {
      const owner = Object.entries(ownership).find(([, ids]) => ids.includes(token.id))?.[0]
      if (owner === undefined || owner === carrierPlayerId || moved.has(owner) || statusOf(owner) !== 'playing') continue
      if (!leavesWithCarried(owner, from, carriedIds, world)) continue
      moved.add(owner)
      currentScene.set(owner, sceneKey(to))
      const hadPending = pendingTravels.delete(owner)
      const clientId = players.get(owner)?.clientId ?? null // null = caiu: reconecta já na cena nova
      if (clientId === null) continue
      outbound.push({ clientId, msg: sceneChangedFor(to.map, by) })
      // Se a ficha de quem leva não passar, o `scene.changed` não sai e o
      // pedido que ele esperava já morreu: sem esta recusa ficaria
      // "Aguardando o mestre" para sempre.
      if (hadPending) lostTravels.push({ clientId, msg: { type: 'pin.travel.rejected', reason: 'unavailable' } })
    }
    return {
      transfer: { junto: companionArrivals(to.map, carrier, spot, carried) },
      outbound,
      lost: lostTravels.length === 0 ? {} : { lostTravels },
    }
  }

  /**
   * O dono de uma ficha levada sai da cena junto? Só se é nela que ele está
   * AGORA (`sceneFor`, a mesma regra do broadcast) e se todas as fichas dele
   * ali estão entre as levadas. Senão a cena dele não muda.
   */
  function leavesWithCarried(owner: string, from: HostScene, carriedIds: ReadonlySet<string>, world: HostWorld): boolean {
    const here = sceneFor(owner, world)
    if (here === null || sceneKey(here) !== sceneKey(from)) return false
    const owned = ownership[owner] ?? []
    return !from.map.tokens.some((t) => owned.includes(t.id) && !carriedIds.has(t.id))
  }

  /**
   * A passagem acontece: `scene.changed` ao dono e `applyTransfer` para o
   * integrador mover a ficha. Vale para o "Deixar ir" e para o pino livre.
   */
  function transferResult(playerId: string, clientId: string, playerName: string, travel: ValidTravel, world: HostWorld): HostResult {
    // Casa livre junto do par: quem passou antes pelo mesmo pino já está no
    // mapa (o integrador aplica cada passagem antes da próxima), então o
    // "Deixar todos" e o pino livre põem cada um numa casa.
    const spot = arrivalSpot(travel.to.map, travel.partner, travel.token.size, travel.token.id)
    // A cena dele passa a ser a de destino a partir daqui: é ela que o
    // próximo broadcast manda, com a memória que ele tem DELA.
    currentScene.set(playerId, sceneKey(travel.to))
    forgetSentView(playerId)
    const along = carriedAlong(playerId, travel.token.id, travel.from, travel.to, spot, world, 'master')
    const applyTransfer: AppliedTransfer = {
      ...along.transfer,
      tokenId: travel.token.id,
      playerId,
      playerName,
      fromSceneId: travel.from.sceneId,
      toSceneId: travel.to.sceneId,
      toSceneName: travel.to.name,
      x: spot.x,
      y: spot.y,
    }
    withEntourage(applyTransfer, travel.from.map, travel.token, travel.to.map, carriedSeats(applyTransfer, travel.from.map), travel.partner)
    withoutCarriedInEntourage(applyTransfer)
    return { outbound: [{ clientId, msg: sceneChangedFor(travel.to.map) }, ...along.outbound], ...along.lost, applyTransfer }
  }

  /**
   * Os círculos que a ficha trazida pelo "Trazer" não cobre: casa e cabeça de
   * cada pino de viagem que o jogador pode tocar — quem acabou de chegar pela
   * ponte está colado ao pino par, e o anel em volta dele passa pela casa do
   * pino. Pino secreto, oculto no editor ou só de chegada fica de fora: o
   * lugar onde a ficha senta não pode entregar um pino que o jogador não vê.
   */
  const travelPinsClearance = (map: MapData): KeepClear[] =>
    map.pins.filter((p) => p.kind === 'viagem' && p.secret !== true && p.hidden !== true && !isArrivalOnly(p)).flatMap(pinClearance)

  /** As fichas do mapa que estão no tabuleiro para os jogadores: fora camada oculta e o que o mestre escondeu. */
  const onBoardTokens = (map: MapData): Token[] => visibleTokens(map.tokens, map.hiddenLayers).filter((t) => t.hidden !== true)

  /**
   * MONTARIA E FAMILIAR: põe em `transfer.entourage` as outras fichas do dono
   * a até 2 casas de `lead` no mapa de partida, cada uma numa casa livre em
   * volta da chegada. A regra de quem conta é a do "viajar junto": ficha que
   * o mestre escondeu não está no tabuleiro e fica. `taken` são as casas já
   * dadas nesta viagem a outros. `pin` é o pino por onde chegam (`null` =
   * sem pino): o séquito não senta nele nem cobre a cabeça, que o jogador
   * precisa tocar para voltar. Ficha que não coube fica onde estava.
   * Devolve as casas que o séquito ocupou.
   */
  function withEntourage(transfer: AppliedTransfer, from: MapData, lead: Token, to: MapData, taken: readonly Seat[], pin: Pin | null): Seat[] {
    const owned = new Set(ownership[transfer.playerId] ?? [])
    const near = entourageNear(lead, onBoardTokens(from).filter((t) => owned.has(t.id)), from.grid)
    const keepClear = pin === null ? [] : pinClearance(pin)
    const seats = entourageSeats(to, transfer, [{ x: transfer.x, y: transfer.y, size: lead.size }, ...taken], near.map((t) => t.size), keepClear)
    const entourage: EntourageSeat[] = []
    const used: Seat[] = []
    near.forEach((token, index) => {
      const seat = seats[index] ?? null
      if (seat === null) return
      entourage.push({ tokenId: token.id, x: seat.x, y: seat.y })
      used.push({ x: seat.x, y: seat.y, size: token.size })
    })
    if (entourage.length > 0) transfer.entourage = entourage
    return used
  }

  /**
   * O séquito da reunião, nas casas que o plano já escolheu. O plano vem do
   * painel do mestre, montado antes: só passa a ficha que AINDA é séquito pela
   * mesma regra do `withEntourage` — do dono, no tabuleiro, a até 2 casas de
   * `lead` no mapa de partida. Ficha de outro jogador ou escondida não vai de carona.
   */
  function withPlannedEntourage(transfer: AppliedTransfer, from: MapData, lead: Token, planned: readonly EntourageSeat[]): void {
    const owned = new Set(ownership[transfer.playerId] ?? [])
    const near = new Set(entourageNear(lead, onBoardTokens(from).filter((t) => owned.has(t.id)), from.grid).map((t) => t.id))
    const entourage = planned.filter((seat) => near.delete(seat.tokenId)).map((seat) => ({ tokenId: seat.tokenId, x: seat.x, y: seat.y }))
    if (entourage.length > 0) transfer.entourage = entourage
  }

  /**
   * LEVAR FICHA JUNTO + MONTARIA: as casas que a travessia já deu às fichas
   * levadas (`transfer.junto`). O séquito senta em volta sem cobri-las.
   */
  function carriedSeats(transfer: AppliedTransfer, from: MapData): Seat[] {
    return (transfer.junto ?? []).map((carried) => ({ x: carried.x, y: carried.y, size: from.tokens.find((t) => t.id === carried.tokenId)?.size ?? 1 }))
  }

  /**
   * A ficha levada já vai em `transfer.junto`, na casa dela: se ela também é
   * do dono e estava perto, no séquito ela iria duas vezes (e a segunda casa
   * venceria). Fica só no `junto`.
   */
  function withoutCarriedInEntourage(transfer: AppliedTransfer): void {
    if (transfer.entourage === undefined || transfer.junto === undefined) return
    const carried = new Set(transfer.junto.map((c) => c.tokenId))
    const rest = transfer.entourage.filter((seat) => !carried.has(seat.tokenId))
    if (rest.length > 0) transfer.entourage = rest
    else delete transfer.entourage
  }

  /**
   * MINHAS PISTAS — o jogador abriu o cartão do pino. Só vale pino do ÚLTIMO
   * recorte mandado a ele, da cena onde ele está AGORA, e que o mestre não
   * escondeu desde então: pino secreto, oculto, no escuro, em zona oculta ou de
   * outra cena não está nesse recorte e morre em silêncio (responder "não
   * existe" diria que o id existe em algum lugar). A pista sai do recorte,
   * nunca do mapa do mestre.
   */
  function handleClueRead(clientId: string, msg: ClueReadMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    if (statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    const seen = seenPins.get(playerId)
    if (scene === null || seen === undefined || seen.mapId !== scene.map.id) return { outbound: [] }
    const pin = seen.pins.find((p) => p.id === msg.pinId)
    const stillThere = scene.map.pins.some((p) => p.id === msg.pinId && p.hidden !== true && p.secret !== true)
    if (pin === undefined || !stillThere) return { outbound: [] }
    const content = pinClueForPlayer(pin)
    if (content === null) return { outbound: [] }
    return reply(clientId, { type: 'clue.added', clue: rememberClue(playerId, `pino|${scene.map.id}|${pin.id}`, content) })
  }

  /** Quem joga, está conectado e na MESMA cena que `playerId` agora. Ele mesmo fica de fora. */
  const peersOf = (playerId: string, world: HostWorld): PlayerRecord[] => {
    const scene = sceneFor(playerId, world)
    if (scene === null) return []
    return [...players.values()].filter(
      (other) => other.playerId !== playerId && other.clientId !== null && statusOf(other.playerId) === 'playing' && sceneFor(other.playerId, world) === scene,
    )
  }

  /** "Mostrar para…": os nomes de quem está na cena com ele. Quem está em outra cena não entra, nem pelo nome. */
  function handleCluePeers(clientId: string, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const names = statusOf(playerId) === 'playing' ? peersOf(playerId, world).map((other) => other.name) : []
    return reply(clientId, { type: 'clue.peers', names: names.sort((a, b) => a.localeCompare(b)) })
  }

  /**
   * Mostra a pista `clueId` (do caderno de quem pede) ao colega `to`, que tem de
   * estar na mesma cena agora. A pista entra no caderno dele com `from`, pela
   * mesma `source` (se ele mesmo ler o pino depois, não duplica). Qualquer
   * recusa volta como `ok: false`, sem dizer onde o colega está.
   */
  function handleClueShow(clientId: string, msg: ClueShowMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const refused = reply(clientId, { type: 'clue.show.result', to: msg.to, ok: false })
    const sender = players.get(playerId)
    const shown = (cluebooks.get(playerId) ?? []).find((item) => item.entry.id === msg.clueId)
    if (sender === undefined || shown === undefined || statusOf(playerId) !== 'playing') return refused
    const target = peersOf(playerId, world).find((other) => other.name === msg.to)
    if (target === undefined || target.clientId === null) return refused
    const at = now()
    const last = lastClueShowAt.get(playerId)
    // Só chega aqui quem está na cena: o "espere" não conta nada que a lista de colegas já não conte.
    if (last !== undefined && at - last < CLUE_SHOW_MIN_INTERVAL_MS) {
      return reply(clientId, { type: 'clue.show.result', to: msg.to, ok: false, reason: 'too_soon' })
    }
    lastClueShowAt.set(playerId, at)
    const { title, text, image } = shown.entry
    const clue = rememberClue(target.playerId, shown.source, { title, text, image }, sender.name)
    return {
      outbound: [
        { clientId: target.clientId, msg: { type: 'clue.shown', from: sender.name, clue } },
        { clientId, msg: { type: 'clue.show.result', to: msg.to, ok: true } },
      ],
    }
  }

  const findPendingTravel = (requestId: string): PendingTravel | undefined =>
    [...pendingTravels.values()].find((pending) => pending.requestId === requestId)

  /** A cena e a ficha de `playerId` agora: aonde o "Ir lá" do chamado e o "Ver" do pedido levam o editor. */
  const tokenTargetOf = (playerId: string, world: HostWorld): CallTarget | null => {
    const scene = sceneFor(playerId, world)
    if (scene === null) return null
    const owned = new Set(ownership[playerId] ?? [])
    const token = scene.map.tokens.find((t) => owned.has(t.id))
    return token === undefined ? null : { sceneId: scene.sceneId, x: token.x, y: token.y }
  }

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
    const travel = validTravel(pending.playerId, pending.pinId, pending.exitId, world, false, pending.trancada === true)
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

  /**
   * QUEM CHEGA ESCOLHE A FICHA: o pedido vale só de quem está sem personagem e
   * só por ficha da lista de AGORA (`seatOptionsFor`) — ficha de outro, de
   * NPC, secreta ou inventada responde `unavailable`, igual para todas, sem
   * dizer qual é o caso. Um pedido por vez; depois de um "Não", um intervalo.
   */
  function handleSeatClaim(clientId: string, msg: SeatClaimMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const record = players.get(playerId)
    if (record === undefined || statusOf(playerId) !== 'waiting') return seatClaimReply(clientId, 'unavailable')
    if (pendingSeatClaims.has(playerId)) return seatClaimReply(clientId, 'pending')
    const deniedAt = lastSeatClaimDeniedAt.get(playerId)
    if (deniedAt !== undefined && now() - deniedAt < SEAT_CLAIM_MIN_INTERVAL_MS) return seatClaimReply(clientId, 'too_soon')
    const option = seatOptionsFor(world).find((candidate) => candidate.tokenId === msg.tokenId)
    if (option === undefined) return seatClaimReply(clientId, 'unavailable')
    const requestId = randomId()
    pendingSeatClaims.set(playerId, { requestId, tokenId: option.tokenId })
    return {
      ...seatClaimReply(clientId, 'pending'),
      seatClaim: { requestId, playerId, playerName: record.name, tokenId: option.tokenId, tokenName: option.name },
    }
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
          // Só quem está na sala ouve o pong: a conexão dada como caída fica
          // sem resposta, e o cliente dela nota o silêncio e volta pelo resume.
          return byClient.has(clientId) ? reply(clientId, { type: 'pong' }) : { outbound: [] }
        case 'view.resync':
          return handleResync(clientId, world)
        case 'view.patches':
          // Antes do join (ou depois de um join recusado) morre calado: um
          // `not_joined` aqui chegaria depois do `bad_code` e o apagaria na tela.
          if (byClient.has(clientId)) patchClients.add(clientId)
          return { outbound: [] }
        case 'signal':
          return handleSignal(clientId, msg, world)
        case 'destination':
          return handleDestination(clientId, msg, world)
        case 'door.toggle':
          return handleDoorToggle(clientId, msg, world)
        case 'door.request':
          return handleDoorRequest(clientId, msg, world)
        case 'door.useKey':
          return handleDoorUseKey(clientId, msg, world)
        case 'door.peek':
          return handleDoorPeek(clientId, msg, world)
        case 'token.edit':
          return handleTokenEdit(clientId, msg, world)
        case 'pin.travel.request':
          return handleTravelRequest(clientId, msg, world)
        case 'laser':
          return handlePlayerLaser(clientId, msg, world)
        case 'clue.read':
          return handleClueRead(clientId, msg, world)
        case 'clue.peers':
          return handleCluePeers(clientId, world)
        case 'clue.show':
          return handleClueShow(clientId, msg, world)
        case 'pin.take':
          return handlePinTake(clientId, msg, world)
        case 'item.give':
          return handleItemGive(clientId, msg, world)
        case 'call.raise':
          return handleCallRaise(clientId, msg)
        case 'call.lower':
          return handleCallLower(clientId)
        case 'point.action':
          return handlePointAction(clientId, msg, world)
        case 'dice.roll':
          return handleDiceRoll(clientId, msg)
        case 'pin.lever':
          return handlePinLever(clientId, msg, world)
        case 'seat.claim':
          return handleSeatClaim(clientId, msg, world)
        case 'pin.read':
          return handlePinRead(clientId, msg)
        case 'secret.check.answer':
          return handleSecretCheckAnswer(clientId, msg)
      }
    },

    seatOptionsUpdates(source) {
      const world = toWorld(source)
      // Conexão que já caiu não recebe mais nada: a chave dela só ocuparia memória.
      for (const clientId of lastSeatOptionsSent.keys()) {
        if (!byClient.has(clientId)) lastSeatOptionsSent.delete(clientId)
      }
      const outbound: Outbound[] = []
      // Jogando, a lista não vale, mas a chave FICA: o jogador guarda a última
      // lista, e é contra ela que a volta à espera compara. Esquecer a chave
      // valia "ele tem a vazia", e quem voltava com a lista vazia ficava com a
      // velha na tela, fichas já de outros inclusive.
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) === 'waiting') outbound.push(...seatOptionsIfChanged(clientId, world))
      }
      return { outbound }
    },

    approveSeatClaim(requestId, source) {
      const claim = findSeatClaim(requestId)
      if (claim === undefined) return { outbound: [] }
      pendingSeatClaims.delete(claim.playerId)
      const clientId = players.get(claim.playerId)?.clientId ?? null // null = saiu: não há a quem dar
      if (clientId === null) return { outbound: [] }
      // Revalida contra AGORA: o mestre pode ter desmarcado a ficha, dado a outro ou apagado.
      const stillFree = statusOf(claim.playerId) === 'waiting' && seatOptionsFor(toWorld(source)).some((option) => option.tokenId === claim.tokenId)
      if (!stillFree) return seatClaimReply(clientId, 'unavailable')
      return api.assignToken(claim.playerId, claim.tokenId)
    },

    denySeatClaim(requestId) {
      const claim = findSeatClaim(requestId)
      if (claim === undefined) return { outbound: [] }
      pendingSeatClaims.delete(claim.playerId)
      lastSeatClaimDeniedAt.set(claim.playerId, now())
      const clientId = players.get(claim.playerId)?.clientId ?? null // null = saiu: não há a quem avisar
      return clientId === null ? { outbound: [] } : seatClaimReply(clientId, 'denied')
    },

    isSeatClaimPending(requestId) {
      return findSeatClaim(requestId) !== undefined
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
      return tokenTargetOf(call.playerId, toWorld(source))
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

    masterRoll(request, hidden) {
      const rolled = newDiceRoll(request, MASTER_ROLLER_NAME)
      const roll: HostDiceRoll = hidden ? { ...rolled, master: true, hidden: true } : { ...rolled, master: true }
      return { outbound: diceOutbound(roll), diceRoll: roll }
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
      // Pedido pelo pino trancado: o "Liberar uma vez" do mestre passa pelo
      // cadeado; o pedido comum de um pino trancado depois continua recusado.
      const travel = validTravel(pending.playerId, pending.pinId, pending.exitId, world, false, pending.trancada === true)
      // O mestre deixou ir para o lugar que o aviso DIZIA. Se a saída foi
      // religada depois (Torre no lugar da Cripta), ou desligada e outra subiu
      // no lugar dela, o consentimento não cobre o destino novo: recusa, e o
      // jogador pede de novo.
      const sameDestination = travel !== null && travel.to.sceneId === pending.toSceneId && travel.partner.id === pending.partnerId
      if (travel === null || !sameDestination) return reply(record.clientId, { type: 'pin.travel.rejected', reason: 'unavailable' })
      return transferResult(pending.playerId, record.clientId, record.name, travel, world)
    },

    approveLockedTravelAsAsk(requestId, source) {
      const pending = findPendingTravel(requestId)
      if (pending === undefined) return { outbound: [] }
      // A cena do pino é a de quem pediu, lida ANTES da aprovação: passar
      // muda a cena dele para a de destino.
      const world = toWorld(source)
      const from = pending.trancada === true ? sceneFor(pending.playerId, world) : null
      const result = api.approveTravel(requestId, source)
      if (from === null || from.sceneId === null || result.applyTransfer === undefined) return result
      const passage: AppliedPinPassage = { pinId: pending.pinId, passagem: 'pede' }
      if (from.sceneId !== world.open.sceneId) passage.sceneId = from.sceneId
      return { ...result, applyPinPassage: passage }
    },

    denyTravel(requestId, text) {
      const pending = findPendingTravel(requestId)
      if (pending === undefined) return { outbound: [] }
      pendingTravels.delete(pending.playerId)
      const clientId = players.get(pending.playerId)?.clientId ?? null // null = saiu: não há a quem avisar
      if (clientId === null) return { outbound: [] }
      const motivo = clampTravelDenyText((text ?? '').trim()) // sem `text` = o "Não" de sempre, igual a motivo em branco
      return reply(clientId, motivo.length === 0 ? { type: 'pin.travel.denied' } : { type: 'pin.travel.denied', text: motivo })
    },

    travelTarget(requestId, source) {
      const pending = findPendingTravel(requestId)
      if (pending === undefined) return null
      return tokenTargetOf(pending.playerId, toWorld(source))
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
      // O séquito de quem pediu já tem casa: ninguém senta em cima do pônei dele.
      const leadEntourage: Seat[] = (arrival.entourage ?? []).flatMap((seat) => {
        const token = travel.from.map.tokens.find((t) => t.id === seat.tokenId)
        return token === undefined ? [] : [{ x: seat.x, y: seat.y, size: token.size }]
      })
      const spots = companionSpots(travel.to.map, travel.partner, leader, near.map((c) => c.token.size), leadEntourage)
      // Todas as casas já dadas nesta viagem: o séquito de cada companheiro desvia delas.
      const companionSeats = near.flatMap((companion, index) => {
        const spot = spots[index] ?? null
        return spot === null ? [] : [{ x: spot.x, y: spot.y, size: companion.token.size }]
      })
      const taken: Seat[] = [leader, ...leadEntourage, ...companionSeats]
      const results: HostResult[] = [lead]
      near.forEach((companion, index) => {
        const spot = spots[index] ?? null
        const record = players.get(companion.playerId)
        // Não coube em volta do pino: fica onde está, com o pedido dele se tinha.
        if (spot === null || record === undefined || record.clientId === null) return
        currentScene.set(companion.playerId, sceneKey(travel.to))
        // O pedido que ele tinha (para esta escada ou outra) se resolve aqui: ele já foi.
        pendingTravels.delete(companion.playerId)
        const applyTransfer: AppliedTransfer = {
          tokenId: companion.token.id,
          playerId: companion.playerId,
          playerName: record.name,
          fromSceneId: travel.from.sceneId,
          toSceneId: travel.to.sceneId,
          toSceneName: travel.to.name,
          x: spot.x,
          y: spot.y,
        }
        taken.push(...withEntourage(applyTransfer, travel.from.map, companion.token, travel.to.map, taken, travel.partner))
        // Sem `by`: para ele é a mesma chegada de quem pediu, "Você chegou".
        results.push({ outbound: [{ clientId: record.clientId, msg: { type: 'scene.changed' } }], applyTransfer })
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
      forgetSentView(playerId)
      // O pedido que ele tinha na cena de antes perde o sentido: o pino ficou lá.
      pendingTravels.delete(playerId)
      const by = gatherAt === undefined ? 'master' : 'gather'
      const along = carriedAlong(playerId, token.id, from, to, spot, world, by)
      const applyTransfer: AppliedTransfer = {
        ...along.transfer,
        tokenId: token.id,
        playerId,
        playerName: record.name,
        fromSceneId: from.sceneId,
        toSceneId: to.sceneId,
        toSceneName: to.name,
        x: spot.x,
        y: spot.y,
      }
      // "Reunir o grupo aqui" já escolheu a casa de cada ficha do grupo inteiro,
      // séquito incluído (`lib/gatherParty.ts`): sentar o séquito agora tomaria
      // a casa de quem vem depois, então as casas vêm do plano.
      if (gatherAt === undefined) withEntourage(applyTransfer, from.map, token, to.map, carriedSeats(applyTransfer, from.map), pin)
      else withPlannedEntourage(applyTransfer, from.map, token, gatherAt.entourage ?? [])
      withoutCarriedInEntourage(applyTransfer)
      return {
        outbound: [...(record.clientId === null ? [] : [{ clientId: record.clientId, msg: sceneChangedFor(to.map, by) } satisfies Outbound]), ...along.outbound],
        ...along.lost,
        applyTransfer,
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
      const applyTransfer: AppliedTransfer = {
        tokenId,
        playerId,
        playerName: record.name,
        fromSceneId: from.sceneId,
        toSceneId: to.sceneId,
        toSceneName: to.name,
        x: spot.x,
        y: spot.y,
      }
      // Quem foi junto volta junto: o "Desfazer" não deixa o pônei na cena errada.
      withEntourage(applyTransfer, from.map, token, to.map, [], null)
      return { outbound: record.clientId === null ? [] : [{ clientId: record.clientId, msg: { type: 'scene.changed', by: 'master' } }], applyTransfer }
    },

    bringToken(playerId, tokenId, source) {
      const record = players.get(playerId)
      if (record === undefined || statusOf(playerId) !== 'playing' || !(ownership[playerId] ?? []).includes(tokenId)) return { outbound: [] }
      const world = toWorld(source)
      const here = sceneFor(playerId, world)
      if (here === null || here.sceneId === null || here.map.tokens.some((t) => t.id === tokenId)) return { outbound: [] }
      const from = allScenes(world).find((scene) => scene.sceneId !== null && scene.map.tokens.some((t) => t.id === tokenId))
      const token = from?.map.tokens.find((t) => t.id === tokenId)
      if (from === undefined || from.sceneId === null || token === undefined) return { outbound: [] }
      // Ao lado da ficha dele nesta cena: a mesma que o "Ir lá" do Grupo procura.
      const owned = new Set(ownership[playerId] ?? [])
      const owner = here.map.tokens.find((t) => owned.has(t.id))
      if (owner === undefined) return { outbound: [] }
      const [seat] = entourageSeats(here.map, owner, [{ x: owner.x, y: owner.y, size: owner.size }], [token.size], travelPinsClearance(here.map))
      if (seat === undefined || seat === null) return { outbound: [] }
      return {
        outbound: [],
        applyTransfer: {
          tokenId,
          playerId,
          playerName: record.name,
          fromSceneId: from.sceneId,
          toSceneId: here.sceneId,
          toSceneName: here.name,
          x: seat.x,
          y: seat.y,
        },
      }
    },

    followCaravans(source, cause = 'edit') {
      const world = toWorld(source)
      const scenes = allScenes(world)
      const party = allPlayerTokens(ownership)
      const moves: AppliedMove[] = []
      const stops: CaravanStop[] = []
      const alive = new Set<string>()
      for (const scene of scenes) {
        if (!isWorldMap(scene.map)) continue
        const key = sceneKey(scene)
        const members = caravanMembers(scene.map, party)
        // O desfazer só mexe na cena aberta: as de fundo seguem a regra de sempre.
        const fromHistory = cause === 'history' && scene === world.open
        const step = fromHistory ? caravanRegroup(members) : caravanStep(members, caravanAt.get(key) ?? null)
        if (step === null) continue
        alive.add(key)
        caravanAt.set(key, step.memory)
        for (const move of step.moves) moves.push({ ...move, ...backgroundSceneId(scene, world) })
        // Mapa solto não tem cidade: pino de viagem só liga cenas de aventura.
        if (scene.sceneId === null) continue
        const city = caravanCity(scene.map, step.at, caravanSize(members), scene.sceneId, travelLookup(scenes))
        if (city !== null) stops.push({ sceneId: scene.sceneId, sceneName: scene.name, pinId: city.pinId, toSceneId: city.toSceneId, toSceneName: city.toSceneName })
      }
      for (const key of [...caravanAt.keys()]) if (!alive.has(key)) caravanAt.delete(key)
      return { moves, stops }
    },

    disembarkCaravan(sceneId, source) {
      const world = toWorld(source)
      const scenes = allScenes(world)
      const from = scenes.find((scene) => scene.sceneId === sceneId)
      if (from === undefined || from.sceneId === null || !isWorldMap(from.map)) return []
      const fromSceneId = from.sceneId
      const members = caravanMembers(from.map, allPlayerTokens(ownership))
      const step = caravanStep(members, caravanAt.get(sceneKey(from)) ?? null)
      if (step === null) return []
      // LEVAR FICHA JUNTO: quem é levado por outra ficha da caravana desce
      // DEPOIS dela — chegando antes, acharia a cidade sem quem o leva e a
      // travessia soltaria o vínculo (`adventureStore.transferToken`).
      const memberIds = new Set(members.map((t) => t.id))
      const carriedByMember = (t: Token): number => {
        const carrierId = carrierIdOf(t)
        return carrierId !== null && memberIds.has(carrierId) ? 1 : 0
      }
      const landing = [...members].sort((a, b) => carriedByMember(a) - carriedByMember(b))
      const city = caravanCity(from.map, step.at, caravanSize(members), fromSceneId, travelLookup(scenes))
      const to = city === null ? undefined : scenes.find((scene) => scene.sceneId === city.toSceneId)
      if (city === null || to === undefined || to.sceneId === null) return []
      const toSceneId = to.sceneId
      const ownerOf = new Map<string, string>()
      for (const [playerId, ids] of Object.entries(ownership)) for (const id of ids) ownerOf.set(id, playerId)
      const spots = landingSpots(to.map, city.partner, landing)
      const told = new Set<string>()
      const arrivals: CaravanArrival[] = []
      landing.forEach((token, i) => {
        const playerId = ownerOf.get(token.id)
        const record = playerId === undefined ? undefined : players.get(playerId)
        const spot = spots[i]
        if (playerId === undefined || record === undefined || spot === undefined) return
        // A cena dele passa a ser a cidade; o pedido que ele tinha ficou no mapa-mundi.
        currentScene.set(playerId, sceneKey(to))
        pendingTravels.delete(playerId)
        const first = !told.has(playerId)
        told.add(playerId)
        // O "Desembarcar" é uma travessia de pino como as outras: a ficha que
        // ela leva e que não é da caravana (o ferido, o NPC escoltado) desce
        // junto. Ficando no mapa-mundi com o vínculo gravado, voltaria a ser
        // puxada quando quem a leva voltasse para lá.
        const companions = carriedBy(from.map, token.id).filter((t) => !memberIds.has(t.id))
        const junto = companionArrivals(to.map, token, spot, companions)
        arrivals.push({
          transfer: {
            tokenId: token.id,
            playerId,
            playerName: record.name,
            fromSceneId,
            toSceneId,
            toSceneName: to.name,
            x: spot.x,
            y: spot.y,
            ...(junto.length === 0 ? {} : { junto }),
          },
          outbound: first && record.clientId !== null ? [{ clientId: record.clientId, msg: sceneChangedFor(to.map, 'master') }] : [],
        })
      })
      caravanAt.delete(sceneKey(from))
      return arrivals
    },

    assignToken(playerId, tokenId) {
      // Dono novo pelo mestre: o empréstimo daquela ficha acabou.
      loans.delete(tokenId)
      ownershipRev += 1
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
      // Pedidos de ficha: quem ganhou ficha já não pede; quem pedia ESTA ficha
      // lê que ela não está mais livre, e o pedido dele sai da caixa do mestre.
      for (const [claimant, claim] of pendingSeatClaims) {
        if (claimant !== playerId && claim.tokenId !== tokenId) continue
        pendingSeatClaims.delete(claimant)
        if (claimant === playerId) continue
        const claimantClient = players.get(claimant)?.clientId ?? null // null = caiu: o pedido morre calado
        if (claimantClient !== null) outbound.push({ clientId: claimantClient, msg: { type: 'seat.claim.state', state: 'unavailable' } })
      }
      return { outbound }
    },

    unassignToken(playerId, tokenId) {
      const current = ownership[playerId]
      if (current === undefined) return { outbound: [] }
      // Tirada do dono ou de quem a jogava: deixa de ser empréstimo, e fica com o outro.
      const loan = loans.get(tokenId)
      if (loan !== undefined && (loan.ownerId === playerId || loan.borrowerId === playerId)) loans.delete(tokenId)
      ownershipRev += 1
      ownership[playerId] = current.filter((t) => t !== tokenId)
      return { outbound: waitingIfLostLast(playerId, current.length > 0) }
    },

    lendTokens(ownerId, borrowerId, source) {
      const owner = players.get(ownerId)
      const borrower = players.get(borrowerId)
      // Só de quem está FORA (ficha de quem joga não se empresta), para quem
      // está na mesa agora (quem caiu não a moveria).
      if (owner === undefined || borrower === undefined || ownerId === borrowerId || owner.clientId !== null || borrower.clientId === null) {
        return { outbound: [], lent: [] }
      }
      const world = toWorld(source)
      // UMA cena: a de quem recebe, se ele já está numa (a ficha de outra cena
      // ficaria parada, e ele não pode ver duas); senão, a do dono.
      const scene = (statusOf(borrowerId) === 'playing' ? sceneFor(borrowerId, world) : null) ?? sceneFor(ownerId, world)
      if (scene === null) return { outbound: [], lent: [] }
      const inScene = new Set(scene.map.tokens.map((t) => t.id))
      const lent = (ownership[ownerId] ?? []).filter((tokenId) => inScene.has(tokenId) && !loans.has(tokenId))
      const held = ownership[borrowerId] ?? []
      ownership[borrowerId] = [...held, ...lent.filter((tokenId) => !held.includes(tokenId))]
      for (const tokenId of lent) loans.set(tokenId, { ownerId, borrowerId })
      return { outbound: [], lent }
    },

    endLoans(ownerId) {
      const { outbound, returned } = endLoansOf(ownerId)
      return { outbound, ...loansReturnedField(returned) }
    },

    disconnect(clientId, at) {
      tableClients.delete(clientId)
      const playerId = byClient.get(clientId)
      if (playerId === undefined) return
      byClient.delete(clientId)
      pausedSent.delete(clientId)
      sentViews.delete(clientId)
      patchClients.delete(clientId)
      const record = players.get(playerId)
      if (record !== undefined) {
        record.clientId = null // mantém o registro para permitir resume
        // Nunca no futuro: o "fora há" não pode começar negativo.
        record.disconnectedAt = at === undefined ? now() : Math.min(at, now())
      }
      // O pedido pendente morre com a conexão: quem voltar não tem mais o
      // "Aguardando o mestre…" na tela, e o aviso do mestre fica inofensivo.
      pendingTravels.delete(playerId)
      // O gesto morre com a conexão; quem o via apaga a ponta sozinho (REMOTE_LASER_IDLE_MS).
      laserRecipients.delete(playerId)
      // Mesmo para a porta: "Destrancar e abrir" depois da queda não abre nada.
      pendingDoors.delete(playerId)
      // E para o item: "Deixar" depois da queda não entrega nada.
      pendingItems.delete(playerId)
      // A mão também: quem volta chega com a tela zerada, sem mão acesa.
      openCalls.delete(playerId)
      // Quem provocou a pergunta "voltou?" e caiu antes da resposta: a pergunta morre.
      pendingReturns.delete(playerId)
      // A marca DELE fica; a lista que a tela dele tinha, não (a volta recebe de novo).
      sentDestinations.delete(playerId)
      // O pedido de ficha também: "Aceitar" daria ficha a quem não está olhando a tela.
      pendingSeatClaims.delete(playerId)
      lastSeatOptionsSent.delete(clientId)
    },

    kick(clientId) {
      const playerId = byClient.get(clientId)
      if (playerId === undefined) return { outbound: [] }
      byClient.delete(clientId)
      pausedSent.delete(clientId)
      lastSeatOptionsSent.delete(clientId)
      ownershipRev += 1
      forgetSentView(playerId)
      patchClients.delete(clientId)
      lastResyncAt.delete(playerId)
      forgetPlayer(playerId)
      return reply(clientId, { type: 'kicked' })
    },

    confirmReturn(playerId, previousId, source) {
      if (!returnStillValid(playerId, previousId)) {
        pendingReturns.delete(playerId)
        return { outbound: [] }
      }
      const current = players.get(playerId)
      const previous = players.get(previousId)
      // `returnStillValid` já garantiu os dois registros e a conexão de quem entrou.
      if (current === undefined || previous === undefined || current.clientId === null) return { outbound: [] }
      const clientId = current.clientId
      // A Ana voltou: a ficha dela que outro jogava volta antes de juntar as duas.
      const loanBack = endLoansOf(previousId)
      mergeInto(previousId, playerId)
      // A conexão passa para a Ana; quem entrou agora deixa de existir.
      byClient.set(clientId, previousId)
      current.clientId = null
      forgetPlayer(playerId)
      previous.clientId = clientId
      previous.disconnectedAt = null
      const world = toWorld(source)
      // O `welcome` de novo: é por ele que o aparelho passa a guardar o resume
      // da Ana e a mostrar o nome dela, sem o "(2)".
      const welcome: HostMessage = { type: 'welcome', playerId: previousId, resumeToken: previous.resumeToken, name: previous.name }
      // O `welcome` apaga a lista no jogador: a chave volta a "nada enviado", e quem segue na espera a recebe de novo.
      lastSeatOptionsSent.delete(clientId)
      return {
        outbound: [{ clientId, msg: welcome }, ...entryOutbound(clientId, previousId, world), ...loanBack.outbound],
        ...loansReturnedField(loanBack.returned),
      }
    },

    denyReturn(playerId) {
      pendingReturns.delete(playerId)
    },

    isReturnPending(playerId) {
      const previousId = pendingReturns.get(playerId)
      return previousId !== undefined && returnStillValid(playerId, previousId)
    },

    dismissPlayer(playerId) {
      const record = players.get(playerId)
      if (record === undefined || record.clientId !== null) return false
      forgetPlayer(playerId)
      return true
    },

    closeRoom() {
      const outbound: Outbound[] = []
      for (const clientId of [...byClient.keys(), ...tableClients]) {
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
      visionOverrides.set(playerId, clampRadius(radius))
    },

    undoReclaim(playerId) {
      const claim = claimedSeats.get(playerId)
      if (claim === undefined) return { outbound: [] }
      claimedSeats.delete(playerId)
      // O assento volta a esperar: a Ana de verdade, chegando depois, ainda o reencontra.
      pendingSeats.push(claim.seat)
      // A memória também: quem pegou por engano esquece as cenas que vieram do
      // assento, e a Ana de verdade recebe a de ontem, intacta.
      const byScene = memories.get(playerId)
      for (const mapId of claim.restoredMapIds) byScene?.delete(mapId)
      if (claim.exploration !== undefined) {
        const key = normalizeName(claim.seat.name)
        if (!pendingExploration.has(key)) pendingExploration.set(key, claim.exploration)
      }
      const current = ownership[playerId] ?? []
      ownership[playerId] = current.filter((tokenId) => !claim.given.includes(tokenId))
      visionOverrides.delete(playerId)
      return { outbound: waitingIfLostLast(playerId, current.length > 0) }
    },

    savedSeats(held) {
      return buildSavedSeats(held)
    },

    savedExploration(held) {
      const saved: SavedSeatExploration[] = []
      const written = new Set<string>()
      for (const p of seatedPlayers(held)) {
        const byScene = memories.get(p.playerId)
        if (byScene === undefined || byScene.size === 0) continue
        const name = seatNameOf(p)
        written.add(normalizeName(name))
        saved.push({ name, scenes: [...byScene.values()].map(savedSceneOf) })
      }
      // Quem ainda não voltou guarda a memória de ontem, se o assento dele continua na mesa.
      const seated = new Set(buildSavedSeats(held).map((seat) => normalizeName(seat.name)))
      for (const [key, exploration] of pendingExploration) {
        if (!written.has(key) && seated.has(key)) saved.push(exploration)
      }
      return saved
    },

    setVisionFactor(playerId, factor) {
      if (!players.has(playerId)) return
      if (factor === null) {
        visionFactors.delete(playerId)
        return
      }
      if (!Number.isFinite(factor)) return
      visionFactors.set(playerId, clampVisionFactor(factor))
    },

    setPinAudience(pinId, playerIds) {
      if (playerIds === null) {
        pinAudiences.delete(pinId)
        return
      }
      pinAudiences.set(pinId, new Set(playerIds.filter((id) => players.has(id))))
    },

    pinAudience: audienceOf,

    pinAudiences() {
      const all: Record<string, string[]> = {}
      for (const pinId of pinAudiences.keys()) all[pinId] = audienceOf(pinId) ?? []
      return all
    },

    pinClues() {
      const all: Record<string, PinClueState> = {}
      for (const [pinId, received] of pinReceived) {
        all[pinId] = { received: inRoomOrder(received), read: inRoomOrder(pinRead.get(pinId) ?? new Set()) }
      }
      return all
    },

    setSecretReveal(itemId, playerIds) {
      const chosen = new Set((playerIds ?? []).filter((id) => players.has(id)))
      // Sem ninguém é o segredo de sempre: a entrada some, e o painel não guarda lista vazia.
      if (chosen.size === 0) secretReveals.delete(itemId)
      else secretReveals.set(itemId, chosen)
    },

    secretReveal: secretRevealOf,

    secretReveals() {
      const all: Record<string, string[]> = {}
      for (const itemId of secretReveals.keys()) all[itemId] = secretRevealOf(itemId)
      return all
    },

    revealPlan(playerId, source) {
      if (!players.has(playerId)) return
      const world = toWorld(source)
      const scene = sceneFor(playerId, world)
      if (scene === null) return
      const map = scene.map
      const memory = memoryFor(playerId, map, world)
      markAll(memory.exp, playerBlockedRings(map))
      // A memória muda no lugar (mesmo objeto): sem isto, o broadcast a acharia igual.
      forgetSentView(playerId)
      // Revelar é mostrar a planta de AGORA: a memória passa a ser o presente,
      // menos o que está sob zona, sala secreta ou teto (lá o explorado também
      // não foi marcado): desfeito o esconderijo depois, nada disso volta como lembrado.
      memory.plan = planOfWholeMap(map)
    },

    revealPlanFor(sceneId, playerIds, source) {
      const scene = allScenes(toWorld(source)).find((s) => s.sceneId === sceneId)
      if (scene === undefined) return 0
      const valid = new Set(playerIds.filter((id) => players.has(id)))
      if (valid.size === 0) return 0
      const chosen = planGrants.get(sceneId) ?? new Set<string>()
      planGrants.set(sceneId, chosen)
      for (const id of valid) {
        chosen.add(id)
        // Memória que já existe desta cena volta a receber a planta no próximo
        // snapshot: a marcação pode ter sido gasta antes, e a planta mudou desde então.
        const memory = existingMemory(id, scene.map)
        if (memory !== undefined) memory.planMarked = false
      }
      return valid.size
    },

    giveGroupView(playerId, source) {
      if (!players.has(playerId)) return 0
      const world = toWorld(source)
      const scene = sceneFor(playerId, world)
      if (scene === null) return 0
      const blocked = playerBlockedRings(scene.map)
      const target = memoryFor(playerId, scene.map, world)
      let colleagues = 0
      for (const other of players.keys()) {
        if (other === playerId) continue
        const memory = existingMemory(other, scene.map)
        if (memory === undefined) continue
        colleagues += 1
        mergeExplored(target.exp, memory.seen, blocked)
      }
      return colleagues
    },

    forgetView(clientId) {
      sentViews.delete(clientId)
    },

    hidePlan(playerId, source) {
      // Apagar a memória: o próximo snapshot recria vazia (explorado, portas e visão).
      forgetSentView(playerId)
      if (source === undefined) {
        memories.delete(playerId)
        dropPlanGrants(playerId, null)
        return
      }
      const scene = sceneFor(playerId, toWorld(source))
      if (scene === null) return
      memories.get(playerId)?.delete(scene.map.id)
      if (scene.sceneId !== null) dropPlanGrants(playerId, scene.sceneId)
    },

    broadcast(source) {
      const world = toWorld(source)
      rev += 1
      const outbound: Outbound[] = []
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) !== 'playing') continue
        // Cada um a SUA cena: quem ficou no Salão nunca recebe nada da Cripta.
        // Quem não está em cena nenhuma recebe a espera, e não a cena do editor.
        // Só para quem a tela mudou: o passo de um não reenvia o mapa aos outros.
        const msg = viewIfChanged(clientId, playerId, world)
        if (msg !== null) {
          // Quem volta da espera recebe, depois do mapa, o teste secreto pendente.
          outbound.push(...withPendingSecretChecks(playerId, clientId, msg))
          // O recado só para ele guardado, logo atrás do mapa — quem ganhou ficha agora o lê.
          outbound.push(...pendingNoteFor(clientId, playerId, msg))
        }
        // O recado da CENA (compartilhado): chegou (ou voltou) a uma cena com
        // recado, mesmo sem o recorte em si ter mudado.
        const scene = sceneFor(playerId, world)
        const note = arrivalNote(playerId, scene === null ? null : scene.sceneId, 'on_change')
        if (note !== null) outbound.push({ clientId, msg: noteMessage(note) })
        // Trocou de cena (pedido, "Mandar para…", reunir): a pausa é a da cena NOVA.
        outbound.push(...pausedUpdate(clientId, playerId, world))
      }
      // A tela da mesa DEPOIS dos jogadores: a memória de cada um já inclui a
      // visão deste broadcast. Um recorte só, igual para todas as telas.
      if (tableClients.size > 0) {
        const msg = tableView(world)
        for (const clientId of tableClients) outbound.push({ clientId, msg })
      }
      // ALARME: quem chegou numa cena com alarme passa a ver; quem saiu de todas, o fim.
      outbound.push(...syncAlarms(world))
      // Depois dos mapas: a visão nova decide que marca cada um já conhece, e
      // quem mudou de cena perde as da cena de antes.
      outbound.push(...destinationUpdates(world))
      // Empréstimo: o dono está fora, mas a ficha dele anda. O que ela vê entra
      // no explorado DELE — para ele voltar sabendo onde a ficha esteve —, e o
      // recorte montado para isso não sai pela rede.
      for (const ownerId of new Set([...loans.values()].map((loan) => loan.ownerId))) {
        const scene = sceneFor(ownerId, world)
        if (scene !== null) snapshotFor(ownerId, scene.map, world, sceneNameForPlayer(scene), floorsFor(ownerId, scene, world))
      }
      // ZONA DE PERIGO: o aviso vai DEPOIS do snapshot — a tela já desenha o
      // perigo quando o texto aparece.
      const hazards = hazardEntriesIn(world)
      outbound.push(...hazards.outbound)
      // GATILHO DE ÁREA: nada vai para `outbound` — o aviso é só do mestre.
      const triggerEntries = triggerEntriesIn(world)
      return {
        outbound,
        ...(hazards.entries.length === 0 ? {} : { hazardEntries: hazards.entries }),
        ...(triggerEntries.length === 0 ? {} : { triggerEntries }),
      }
    },

    setTableScene(key) {
      tableSceneChoice = key
    },

    tableScene() {
      return tableSceneChoice
    },

    tableScreens() {
      return tableClients.size
    },

    isTable(clientId) {
      return tableClients.has(clientId)
    },

    tableKey() {
      return tableKey
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
      const note: NoteEntry = { id: randomId(), text: clamped, at: now() }
      // Guardado mesmo sem ninguém lá agora: quem chegar depois recebe. O
      // recado para ESCOLHIDOS não: ele não é da cena, e quem chegasse ou
      // voltasse depois leria o que o mestre mandou só a outros. Ele fica só
      // no caderno de quem recebeu.
      if (chosen === null) {
        lastNoteByScene.delete(sceneId)
        lastNoteByScene.set(sceneId, note)
        for (const oldest of lastNoteByScene.keys()) {
          if (lastNoteByScene.size <= MAX_SCENE_NOTES) break
          lastNoteByScene.delete(oldest)
        }
      }
      const outbound: Outbound[] = []
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) !== 'playing') continue
        if (chosen !== null && !chosen.has(playerId)) continue
        // A cena de CADA jogador, não a aberta no editor: o mestre pode estar
        // olhando a Cripta e mandar recado para o Salão.
        if (sceneFor(playerId, world)?.sceneId !== sceneId) continue
        rememberNote(playerId, note)
        // Já recebeu aqui: o broadcast seguinte não repete como "chegada".
        noteSceneOf.set(playerId, sceneId)
        outbound.push({ clientId, msg: noteMessage(note) })
      }
      return { outbound }
    },

    sceneAlarm(sceneIds, text, source) {
      const clamped = clampAlarmText(text)
      if (clamped.trim().length === 0) return { outbound: [] }
      const world = toWorld(source)
      // Só cenas que existem neste mundo, sem repetição, na ordem que o mestre deu.
      const known = new Set(allScenes(world).flatMap((scene) => (scene.sceneId === null ? [] : [scene.sceneId])))
      const chosen = [...new Set(sceneIds)].filter((sceneId) => known.has(sceneId))
      if (chosen.length === 0) return { outbound: [] }
      alarm = { id: randomId(), text: clamped, sceneIds: chosen }
      return { outbound: syncAlarms(world) }
    },

    endAlarm(source) {
      if (alarm === null) return { outbound: [] }
      alarm = null
      return { outbound: syncAlarms(toWorld(source)) }
    },

    activeAlarm() {
      return alarm === null ? null : { id: alarm.id, text: alarm.text, sceneIds: [...alarm.sceneIds] }
    },

    playerNote(playerId, text, source) {
      const record = players.get(playerId)
      const clamped = clampNoteText(text)
      if (record === undefined || clamped.trim().length === 0) return { outbound: [], delivery: null }
      const note: NoteEntry = { id: randomId(), text: clamped, at: now() }
      const clientId = record.clientId
      // Sai agora só com ele conectado E com mapa na tela (jogando, numa cena):
      // é a mesma regra do cliente, que fora disso descartaria o recado.
      if (clientId === null || statusOf(playerId) !== 'playing' || sceneFor(playerId, toWorld(source)) === null) {
        pendingNotes.set(playerId, note)
        return { outbound: [], delivery: 'queued' }
      }
      // Recado entregue agora substitui qualquer guardado: o cartão dele mostra um por vez.
      pendingNotes.delete(playerId)
      // CADERNO: lido agora, fica no caderno dele — a volta pelo resume o traz de novo no `notes.book`.
      rememberNote(playerId, note)
      return { outbound: [{ clientId, msg: onlyYouMessage(note) }], delivery: 'sent' }
    },

    noise(x, y, rangeCells, source) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { outbound: [] }
      const world = toWorld(source)
      const scene = world.open
      const rangePx = clampNoiseRangeCells(rangeCells) * scene.map.grid
      const id = randomId()
      const outbound: Outbound[] = []
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) !== 'playing') continue
        // A cena DELE, não a do editor: quem está na Cripta não ouve o Salão,
        // mesmo com a ficha na mesma coordenada.
        if (sceneFor(playerId, world) !== scene) continue
        const dir = noiseCueForPlayer(scene.map, playerId, ownership, { x, y }, rangePx)
        if (dir === null) continue
        outbound.push({ clientId, msg: { type: 'noise', id, dir } })
      }
      return { outbound }
    },

    secretCheck(label, playerIds) {
      const clamped = clampSecretCheckLabel(label)
      if (clamped.length === 0) return { outbound: [] }
      // Só quem está na sala e joga: quem aguarda não tem mapa onde o cartão apareça.
      const asked = new Set(playerIds.filter((playerId) => players.has(playerId) && statusOf(playerId) === 'playing'))
      if (asked.size === 0) return { outbound: [] }
      const id = randomId()
      secretChecks.set(id, { label: clamped, asked, answers: new Map(), open: true })
      // O fechamento de um teste apagado sai ANTES do pedido novo: o cliente
      // mostra um cartão por vez, e o novo não pode ser apagado pelo aviso velho.
      const outbound: Outbound[] = trimSecretChecks()
      // Um a um, pela lista do próprio teste: cada escolhido recebe só o id e
      // o nome — nunca quem mais foi escolhido. Quem caiu recebe ao voltar.
      for (const playerId of inRoomOrder(asked)) {
        const clientId = players.get(playerId)?.clientId ?? null
        if (clientId !== null) outbound.push({ clientId, msg: { type: 'secret.check', id, label: clamped } })
      }
      return { outbound, secretCheckId: id }
    },

    closeSecretCheck(checkId) {
      const check = secretChecks.get(checkId)
      if (check === undefined || !check.open) return { outbound: [] }
      return { outbound: closeSecretCheckFor(checkId, check) }
    },

    secretChecks() {
      return [...secretChecks].map(([id, check]) => ({
        id,
        label: check.label,
        asked: inRoomOrder(check.asked),
        answers: Object.fromEntries(check.answers),
        open: check.open,
      }))
    },

    listPlayers(source) {
      const world = source === undefined ? null : toWorld(source)
      // Nome de cena só faz sentido com aventura: no mapa solto todo mundo está no mesmo lugar.
      const withScenes = world !== null && world.open.sceneId !== null
      if (world !== null) pruneDestinations(world)
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
            visionRadius: baseRadiusFor(p.playerId),
            visionFactor: factorFor(p.playerId),
          }
          // No mapa solto todo mundo está (ou vai estar) no mapa aberto.
          let visionScene: HostScene | null = world !== null && !withScenes ? world.open : null
          // O selo da lista Cenas nasce e morre com o pedido: aprovar, recusar
          // e cair a conexão já tiram o jogador de `pendingTravels`.
          if (pendingTravels.has(p.playerId)) info.travelPending = true
          if (p.disconnectedAt !== null) info.disconnectedAt = p.disconnectedAt
          const lentTo = namesOf([...loans.values()].filter((loan) => loan.ownerId === p.playerId).map((loan) => loan.borrowerId))
          if (lentTo.length > 0) info.lentTo = lentTo
          const borrowedFrom = namesOf([...loans.values()].filter((loan) => loan.borrowerId === p.playerId).map((loan) => loan.ownerId))
          if (borrowedFrom.length > 0) info.borrowedFrom = borrowedFrom
          const borrowedTokenIds = info.tokenIds.filter((tokenId) => loans.get(tokenId)?.borrowerId === p.playerId)
          if (borrowedTokenIds.length > 0) info.borrowedTokenIds = borrowedTokenIds
          if (withScenes && info.status === 'playing') {
            const scene = sceneFor(p.playerId, world)
            // Sem cena, o painel o mostra aguardando: é o que a tela dele diz, e
            // é o que leva o mestre a dar outra ficha a ele.
            if (scene === null) info.status = 'waiting'
            else {
              info.sceneName = scene.name
              if (scene.sceneId !== null) info.sceneId = scene.sceneId
              visionScene = scene
            }
          }
          // O mestre vê toda marca: é ele quem conduz. Depois do prune, a marca está na cena do dono.
          const mark = destinations.get(p.playerId)
          const markScene = world === null || mark === undefined ? null : sceneFor(p.playerId, world)
          if (mark !== undefined && markScene !== null) info.destination = { x: mark.x, y: mark.y, color: laserColorOf(p.playerId, markScene.map) }
          const cells = visionScene === null ? undefined : readSceneVisionCells(visionScene.map.visionCells)
          if (cells !== undefined) info.sceneVisionCells = cells
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
