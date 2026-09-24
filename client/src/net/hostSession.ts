import type { DoorState, MapData, Pin, RegionPoint, Token } from '../types/map'
import { createExploration, encodeExploration, forgetInside, isPointExplored, markAll, markRings, mergeExploration, type Exploration } from '../lib/exploration'
import { pointInRing } from '../lib/floorContour'
import { abaloSetaForPlayer, filterMapForPlayer, giftableRoomsOf, pinClueForPlayer, playerBlockedRings, roomClueForPlayer, type PlayerClueContent, type PlayerMapView } from '../lib/fogFilter'
import { faixaDoAbalo, type AbaloContagem, type AbaloFaixa, type AbaloOrigem, type AbaloTextos } from '../lib/abalo'
import { CLUEBOOK_MAX_CLUES } from '../lib/clues'
import { validateTokenMove } from '../lib/moveValidation'
import { tokenReachesDoor } from '../lib/doorReach'
import { SIGNAL_MIN_INTERVAL_MS, signalColor } from '../lib/signals'
import { selectedTokenColor } from '../lib/tokenColor'
import { arrivalPoint, arrivalSpot, exitLabelsOf, isArrivalOnly, resolvePinTravel, SAIDA_PRINCIPAL, travelExitOf, type TravelScene } from '../lib/pinTravel'
import { passageOf, pinSummary } from '../lib/pins'
import {
  parsePlayerMessage,
  type ClueEntry,
  type ClueReadMessage,
  type ClueShowMessage,
  type DoorToggleMessage,
  type HostMessage,
  type JoinMessage,
  type LaserMessage,
  type MapShareMessage,
  type PinTravelRejection,
  type PinTravelRequestMessage,
  type PlayerLaserMessage,
  type SignalMessage,
  type TokenEditMessage,
  type TokenMoveMessage,
} from './protocol'
import { clampNoteText, NOTEBOOK_MAX_NOTES, type NoteEntry } from './protocol'

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

export interface HostResult {
  outbound: Outbound[]
  applyMove?: AppliedMove
  applyDoor?: AppliedDoor
  applyTokenEdit?: AppliedTokenEdit
  signal?: HostSignal
  playerLaser?: HostPlayerLaser
  /** Pedido de passagem válido: o integrador pergunta ao mestre. */
  travelRequest?: TravelRequest
  /**
   * O mestre deixou ir, ou o pino é livre (aí vem de `handleMessage`): o
   * integrador move o token entre as cenas ANTES de despachar `outbound`.
   */
  applyTransfer?: AppliedTransfer
  /**
   * PASSAR O MAPA: a memória de `toPlayerId` ganhou o que `fromPlayerId`
   * explorou. O integrador faz o broadcast: é o snapshot seguinte que leva o
   * trecho novo a quem recebeu.
   */
  mapShared?: { fromPlayerId: string; toPlayerId: string }
  /**
   * MAPA DE PAPEL: as Salas (ids, na ordem pedida) que entraram na memória de
   * `playerId`. O integrador faz o broadcast, como no `mapShared`.
   */
  mapGiven?: { playerId: string; roomIds: string[] }
  /**
   * MAPA DE PAPEL recusado por um motivo que o mestre precisa ler (o jogador
   * não é avisado): `memoria-cheia` = o mapa é de uma cena que ele ainda não
   * tem na memória e ela já guarda `MAX_SCENE_MEMORIES_PER_PLAYER` cenas.
   */
  mapRefused?: { playerId: string; reason: MapGiftRefusal }
}

/** Por que o mapa de papel não entrou, quando o motivo não é "nada a dar". */
export type MapGiftRefusal = 'memoria-cheia'

/** O que "Dar um mapa a…" devolve ao painel: quantas Salas entraram (0 = nada) ou o motivo da recusa. */
export type GiveMapOutcome = number | MapGiftRefusal

/** O que `abalo` devolve: as mensagens e quantos receberam em cada faixa. */
export interface AbaloResult extends HostResult {
  porFaixa: AbaloContagem
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

/**
 * "Mostrar meu mapa a…": um mapa mostrado por jogador nesta janela. Cada um
 * dispara um broadcast (o snapshot de quem recebe muda), e um jogador em laço
 * não pode fazer o host remontar o recorte de todos sem parar.
 */
export const MAP_SHARE_MIN_INTERVAL_MS = 3000

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
 * MAPA DE PAPEL — a Sala deixa marca na memória? Marca só ela, sob os mesmos
 * vetos, em `scratch` (exploração vazia da MESMA grade, reaproveitada entre as
 * Salas): sobrou célula ou contorno, entra. Sala toda sob zona oculta ativa não
 * deixa nada, e contá-la como entregue anunciaria um mapa que não existe.
 */
function roomLeavesMark(scratch: Exploration, points: readonly RegionPoint[], blocked: readonly RegionPoint[][]): boolean {
  scratch.bits.fill(0)
  scratch.rings = []
  scratch.ringVertices = 0
  markRings(scratch, [points], blocked)
  return scratch.rings.length > 0 || scratch.bits.some((byte) => byte !== 0)
}

/**
 * Quantas cenas guardam o "último recado". O `sceneId` vem da tela do mestre
 * (confiável), mas memória de host não cresce sem limite: passou, esquece a
 * cena que recebeu recado há mais tempo.
 */
export const MAX_SCENE_NOTES = 100

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
   * vazio não sai. `outbound.length` é quantos receberam AGORA.
   *
   * CADERNO: o recado vira o último da cena e entra no caderno de cada um que
   * recebeu. Quem entra ou volta à sala recebe o caderno dele (`notes.book`)
   * e o último recado da cena onde está; quem chega à cena depois (viagem,
   * ficha nova) recebe o último recado dela no broadcast, se ainda não o tem.
   */
  sceneNote(sceneId: string, text: string, source: HostMapSource): HostResult
  /**
   * ABALO POR DISTÂNCIA: a cada jogador que joga e está numa cena agora, o
   * texto da FAIXA dele (`lib/abalo.ts`): `perto` na cena da origem, `andar`
   * nas cenas de `vizinhas`, `longe` no resto. Faixa com texto vazio não manda
   * nada a quem está nela. Quem está `perto` recebe `forte` e, com ponto de
   * origem, a seta vista da própria ficha (`abaloSetaForPlayer`). O abalo entra
   * no caderno de quem recebeu; não fica guardado para quem chega depois (é um
   * instante, não um recado da cena). `porFaixa`: o aviso do mestre.
   */
  abalo(origem: AbaloOrigem, textos: AbaloTextos, vizinhas: readonly string[], source: HostMapSource): AbaloResult
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
  /** Marca a planta inteira da cena onde o jogador está como explorada, fora de zona oculta ativa. Tokens seguem exigindo visão. */
  revealPlan(playerId: string, source: HostMapSource): void
  /**
   * PASSAR O MAPA pelo mestre: o que `fromPlayerId` explorou na cena onde está
   * agora (células, contornos e portas no estado que ELE viu) entra na memória
   * de `toPlayerId` para aquela cena — e só na dele. Zona oculta ativa e sala
   * secreta de agora não passam. Quem recebe ganha `map.shared` com o nome de
   * quem passou; o trecho vem no broadcast que o integrador faz depois.
   * Nada a passar (mesmo jogador, desconhecido, doador sem cena ou que ainda
   * não explorou a dele, quem recebe fora da cena do doador ou aguardando):
   * `{ outbound: [] }` sem `mapShared`.
   */
  shareMap(fromPlayerId: string, toPlayerId: string, source: HostMapSource): HostResult
  /**
   * MAPA DE PAPEL: o mestre grava as Salas `roomIds` da cena `sceneId` (`null`
   * = o mapa solto) na memória de `playerId` — e só na dele —, como um mapa
   * achado. Vale para qualquer cena do mundo, não só a dele: o recorte só
   * entrega aquela memória quando ele estiver lá. Entra só Sala que o recorte
   * pode mostrar (`giftableRoomsOf`) e que deixa ao menos uma célula marcada:
   * Sala toda sob zona oculta ativa fica de fora (e fora de `mapGiven`). Quem
   * recebe ganha `map.given`, sem cena nem Sala. Nada a gravar (jogador, cena ou
   * Sala desconhecidos, só Salas proibidas ou escondidas): `{ outbound: [] }`
   * sem `mapGiven`. Cena que ele ainda não tem na memória com a memória no teto:
   * nada é gravado e volta `mapRefused` (`memoria-cheia`) — o mapa de papel
   * nunca empurra para fora uma cena que ele explorou.
   */
  giveRoomsMap(playerId: string, sceneId: string | null, roomIds: readonly string[], source: HostMapSource): HostResult
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
  // Por playerId: janela corrente do teto de lotes de laser (PLAYER_LASER_MAX_PER_WINDOW).
  const laserWindows = new Map<string, { start: number; count: number }>()
  // Por playerId: conexões que receberam algum ponto do gesto em curso, e a
  // cena (`sceneKey`) onde o gesto acontece. O `off` vai só a elas — a quem
  // nada viu, nem o aviso de que o gesto acabou. Lote vindo de outra cena
  // (off perdido na viagem) recomeça a lista: ela nunca atravessa cena.
  const laserRecipients = new Map<string, { scene: string; clients: Set<string> }>()
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
  // Por playerId: quando o último "Mostrar meu mapa a…" dele chegou a alguém.
  const lastMapShareAt = new Map<string, number>()
  // Por pinId: quem vê o pino ("Só estes"). Ausente = Todos. O kick tira o
  // jogador de toda lista; o registro de quem só caiu fica (resume).
  const pinAudiences = new Map<string, Set<string>>()
  let rev = 0

  const radiusFor = (playerId: string): number => visionOverrides.get(playerId) ?? options.visionRadius

  /** "Quem vê" do pino na ordem da sala (a do painel Grupo), não na ordem em que o mestre marcou. `null` = Todos. */
  const audienceOf = (pinId: string): string[] | null => {
    const chosen = pinAudiences.get(pinId)
    if (chosen === undefined) return null
    return [...players.values()].sort((a, b) => a.joinedAt - b.joinedAt).flatMap((p) => (chosen.has(p.playerId) ? [p.playerId] : []))
  }

  /** Polígonos das zonas ocultas ativas (`?? []`: mapa montado fora do deserializeMap pode vir sem o campo). */
  const statusOf = (playerId: string): PlayerStatus => ((ownership[playerId]?.length ?? 0) > 0 ? 'playing' : 'waiting')

  /** Memória que o jogador já tem deste mapa, sem criar. Mesmo id redimensionado não conta: é outro mapa. */
  const existingMemory = (playerId: string, map: MapData): PlayerMemory | undefined => {
    const memory = memories.get(playerId)?.get(map.id)
    return memory !== undefined && memory.key === memoryKey(map) ? memory : undefined
  }

  /** Memória vazia deste mapa. MapData.width/height estão em células; o explorado mede px de mundo (mesma unidade da visão). */
  const blankMemory = (map: MapData): PlayerMemory => ({
    key: memoryKey(map),
    exp: createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid }),
    doors: new Map(),
    vision: [],
  })

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
    const memory = existingMemory(playerId, map) ?? blankMemory(map)
    // Apagar e regravar põe a cena no fim da ordem: é a mais recente agora.
    byScene.delete(map.id)
    byScene.set(map.id, memory)
    for (const oldest of byScene.keys()) {
      if (byScene.size <= MAX_SCENE_MEMORIES_PER_PLAYER) break
      byScene.delete(oldest)
    }
    return memory
  }

  /**
   * MAPA DE PAPEL: a memória onde o presente é gravado, SEM mexer na ordem de
   * uso. A que ele já tem fica onde está (ganhar um mapa não é visitar a cena).
   * Cena nova entra como a MENOS recente — é a primeira a sair quando ele andar
   * por uma cena a mais — e nunca despeja outra: com a memória no teto, `null`.
   */
  const giftMemoryFor = (playerId: string, map: MapData): PlayerMemory | null => {
    const found = existingMemory(playerId, map)
    if (found !== undefined) return found
    const byScene = memories.get(playerId) ?? new Map<string, PlayerMemory>()
    // Memória do mesmo id com outra grade (mapa redimensionado) já não vale: é trocada, não soma.
    const others = [...byScene].filter(([mapId]) => mapId !== map.id)
    if (others.length >= MAX_SCENE_MEMORIES_PER_PLAYER) return null
    const memory = blankMemory(map)
    memories.set(playerId, new Map([[map.id, memory], ...others]))
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
    const view = snapshotFor(playerId, scene.map)
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
   */
  const snapshotFor = (playerId: string, map: MapData): HostMessage[] => {
    const memory = memoryFor(playerId, map)
    const exp = memory.exp
    const entered = enteredRooms.get(playerId)?.get(map.id)
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId), exp, memory.doors, pinAudiences, entered)
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
    seenPins.set(playerId, { mapId: map.id, pins: view.map.pins })
    const seenNow = new Set(view.visibleDoorIds)
    for (const w of view.map.walls) {
      if (w.door !== null && seenNow.has(w.id)) memory.doors.set(w.id, { ...w.door })
    }
    const sent = new Set(view.map.tokens.map((t) => t.id))
    const ownTokens = (ownership[playerId] ?? []).filter((id) => sent.has(id))
    const snapshot: HostMessage = { type: 'snapshot', rev, map: view.map, vision: view.vision, explored: encodeExploration(exp), ownTokens, concealed: view.concealed }
    return [snapshot, ...roomTextCardsFor(playerId, map.id, view)]
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
    const waiting: HostMessage[] = [{ type: 'lobby.waiting' }]
    // `next`: o snapshot (ou a espera); `cards`: os cartões que vêm atrás dele (texto da Sala, recado da cena).
    const [next, ...cards] = statusOf(record.playerId) === 'playing' ? viewFor(record.playerId, world, 'always') : waiting
    const outbound: Outbound[] = [{ clientId, msg: welcome }]
    if (next !== undefined) outbound.push({ clientId, msg: next })
    // O caderno vem antes do cartão: o cliente já tem o recado guardado quando o cartão reabre.
    const book = notebooks.get(record.playerId) ?? []
    if (book.length > 0) outbound.push({ clientId, msg: { type: 'notes.book', notes: book.map((entry) => ({ ...entry })) } })
    // MINHAS PISTAS: é o que faz a pista sobreviver a recarregar a página. Só a entrada, nunca a `source`.
    const clues = cluebooks.get(record.playerId) ?? []
    if (clues.length > 0) outbound.push({ clientId, msg: { type: 'clues.book', clues: clues.map((item) => ({ ...item.entry })) } })
    for (const msg of cards) outbound.push({ clientId, msg })
    return { outbound }
  }

  function handleMove(clientId: string, msg: TokenMoveMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    // O movimento vale na cena DELE: token de outra cena é `unknown_token` aqui.
    const scene = sceneFor(playerId, world)
    // Sem cena (aventura aberta, ficha em lugar nenhum): não há onde mover.
    if (scene === null) return reply(clientId, { type: 'token.move.rejected', reqId: msg.reqId, reason: 'unknown_token' })
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
   * Jogador abre ou fecha porta. Autoridade é aqui: a porta precisa existir,
   * estar VISÍVEL para ele agora (não só lembrada — senão abriria porta do
   * outro lado do mapa), estar DESTRANCADA (trancada é só do mestre) e ter um
   * token dele encostado (`tokenReachesDoor`). Recusa vira aviso curto na tela
   * do jogador; porta inexistente ou invisível responde o mesmo
   * `not_visible`, para não dizer o que existe no escuro.
   */
  function handleDoorToggle(clientId: string, msg: DoorToggleMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    if (statusOf(playerId) !== 'playing') return { outbound: [] }
    const scene = sceneFor(playerId, world)
    if (scene === null) return { outbound: [] }
    const map = scene.map
    const at = now()
    const last = lastDoorToggleAt.get(playerId)
    if (last !== undefined && at - last < DOOR_TOGGLE_MIN_INTERVAL_MS) return { outbound: [] }
    lastDoorToggleAt.set(playerId, at)

    const reject = (reason: 'locked' | 'far' | 'not_visible'): HostResult =>
      reply(clientId, { type: 'door.toggle.rejected', wallId: msg.wallId, reason })

    const wall = map.walls.find((w) => w.id === msg.wallId)
    if (wall === undefined || wall.door === null) return reject('not_visible')
    const memory = memoryFor(playerId, map)
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId), memory.exp, memory.doors, pinAudiences)
    if (!view.visibleDoorIds.includes(wall.id)) return reject('not_visible')
    // Trancada antes de longe: a cor da porta já diz que está trancada, e "Trancada" é a informação útil.
    if (wall.door.locked) return reject('locked')
    const owned = new Set(ownership[playerId] ?? [])
    // Tokens do recorte do jogador: respeita camada oculta e token escondido pelo mestre.
    const near = view.map.tokens.some((t) => owned.has(t.id) && tokenReachesDoor(t, wall, map.grid))
    if (!near) return reject('far')

    return { outbound: [], applyDoor: { wallId: wall.id, open: !wall.door.open, ...backgroundSceneId(scene, world) } }
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
    const view = filterMapForPlayer(from.map, playerId, ownership, radiusFor(playerId), memory.exp, memory.doors, pinAudiences)
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

  /**
   * PASSAR O MAPA: soma na memória de `toPlayerId` o que `fromPlayerId` guarda
   * de `map`. Zona oculta ativa e sala secreta de AGORA barram (a memória do
   * doador pode ser de antes de o mestre esconder). Portas: só as que quem
   * recebe ainda não viu, no estado que o doador viu — nunca o atual do mapa.
   * `false` quando o doador não guarda nada deste mapa.
   */
  const giveMap = (fromPlayerId: string, toPlayerId: string, map: MapData): boolean => {
    const given = existingMemory(fromPlayerId, map)
    if (given === undefined) return false
    const memory = memoryFor(toPlayerId, map)
    if (!mergeExploration(memory.exp, given.exp, playerBlockedRings(map))) return false
    for (const [wallId, door] of given.doors) {
      if (!memory.doors.has(wallId)) memory.doors.set(wallId, { ...door })
    }
    return true
  }

  /**
   * "Mostrar meu mapa a…": o que o jogador explorou na cena onde está passa ao
   * colega `to`, que tem de estar na MESMA cena agora. Qualquer recusa volta
   * como `ok: false`, sem dizer onde o colega está (mesma regra da pista).
   */
  function handleMapShare(clientId: string, msg: MapShareMessage, world: HostWorld): HostResult {
    const playerId = byClient.get(clientId)
    if (playerId === undefined) return reply(clientId, { type: 'error', reason: 'not_joined' })
    const refused = reply(clientId, { type: 'map.share.result', to: msg.to, ok: false })
    const sender = players.get(playerId)
    if (sender === undefined || statusOf(playerId) !== 'playing') return refused
    const scene = sceneFor(playerId, world)
    const target = peersOf(playerId, world).find((other) => other.name === msg.to)
    if (scene === null || target === undefined || target.clientId === null) return refused
    const at = now()
    const last = lastMapShareAt.get(playerId)
    if (last !== undefined && at - last < MAP_SHARE_MIN_INTERVAL_MS) {
      return reply(clientId, { type: 'map.share.result', to: msg.to, ok: false, reason: 'too_soon' })
    }
    if (!giveMap(playerId, target.playerId, scene.map)) return refused
    lastMapShareAt.set(playerId, at)
    return {
      outbound: [
        { clientId: target.clientId, msg: { type: 'map.shared', from: sender.name } },
        { clientId, msg: { type: 'map.share.result', to: msg.to, ok: true } },
      ],
      mapShared: { fromPlayerId: playerId, toPlayerId: target.playerId },
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
        case 'map.share':
          return handleMapShare(clientId, msg, world)
      }
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
      // O gesto morre com a conexão; quem o via apaga a ponta sozinho (REMOTE_LASER_IDLE_MS).
      laserRecipients.delete(playerId)
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
      laserWindows.delete(playerId)
      laserRecipients.delete(playerId)
      lastTokenPhotoAt.delete(playerId)
      visionOverrides.delete(playerId)
      enteredRooms.delete(playerId)
      notebooks.delete(playerId)
      noteSceneOf.delete(playerId)
      cluebooks.delete(playerId)
      seenPins.delete(playerId)
      lastClueShowAt.delete(playerId)
      lastMapShareAt.delete(playerId)
      for (const chosen of pinAudiences.values()) chosen.delete(playerId)
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

    revealPlan(playerId, source) {
      if (!players.has(playerId)) return
      const scene = sceneFor(playerId, toWorld(source))
      if (scene === null) return
      const map = scene.map
      markAll(memoryFor(playerId, map).exp, playerBlockedRings(map))
    },

    shareMap(fromPlayerId, toPlayerId, source) {
      const giver = players.get(fromPlayerId)
      const target = players.get(toPlayerId)
      if (giver === undefined || target === undefined || fromPlayerId === toPlayerId) return { outbound: [] }
      const world = toWorld(source)
      // A cena ONDE O DOADOR ESTÁ: é dela que ele tem o mapa na cabeça agora.
      const scene = sceneFor(fromPlayerId, world)
      if (scene === null) return { outbound: [] }
      // Só a quem joga NA MESMA cena: o aviso diz "já aparece no seu", e noutra
      // cena não apareceria; a memória de uma cena onde ele nunca esteve ainda
      // empurraria para fora a mais antiga que ele explorou (teto de memórias).
      if (statusOf(toPlayerId) !== 'playing' || sceneFor(toPlayerId, world) !== scene) return { outbound: [] }
      if (!giveMap(fromPlayerId, toPlayerId, scene.map)) return { outbound: [] }
      return {
        outbound: target.clientId === null ? [] : [{ clientId: target.clientId, msg: { type: 'map.shared', from: giver.name } }],
        mapShared: { fromPlayerId, toPlayerId },
      }
    },

    giveRoomsMap(playerId, sceneId, roomIds, source) {
      const player = players.get(playerId)
      if (player === undefined) return { outbound: [] }
      const scene = allScenes(toWorld(source)).find((s) => s.sceneId === sceneId)
      if (scene === undefined) return { outbound: [] }
      const map = scene.map
      const wanted = new Set(roomIds)
      // Mesmo veto do "Revelar planta": zona oculta ativa, sala secreta e teto não viram explorados.
      const blocked = playerBlockedRings(map)
      const scratch = blankMemory(map).exp
      const rooms = giftableRoomsOf(map).filter((r) => wanted.has(r.id) && roomLeavesMark(scratch, r.points, blocked))
      if (rooms.length === 0) return { outbound: [] }
      const memory = giftMemoryFor(playerId, map)
      if (memory === null) return { outbound: [], mapRefused: { playerId, reason: 'memoria-cheia' } }
      markRings(memory.exp, rooms.map((r) => r.points), blocked)
      const allowed = new Set(rooms.map((r) => r.id))
      const given = [...wanted].filter((id) => allowed.has(id))
      return {
        outbound: player.clientId === null ? [] : [{ clientId: player.clientId, msg: { type: 'map.given' } }],
        mapGiven: { playerId, roomIds: given },
      }
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
        // Chegou a uma cena com recado (viagem, ficha nova): o recado vem logo atrás do mapa.
        for (const msg of viewFor(playerId, world, 'on_change')) outbound.push({ clientId, msg })
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
      const note: NoteEntry = { id: randomId(), text: clamped, at: now() }
      // Guardado mesmo sem ninguém lá agora: quem chegar depois recebe.
      lastNoteByScene.delete(sceneId)
      lastNoteByScene.set(sceneId, note)
      for (const oldest of lastNoteByScene.keys()) {
        if (lastNoteByScene.size <= MAX_SCENE_NOTES) break
        lastNoteByScene.delete(oldest)
      }
      const outbound: Outbound[] = []
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) !== 'playing') continue
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

    abalo(origem, textos, vizinhas, source) {
      const world = toWorld(source)
      const vizinhasSet = new Set(vizinhas)
      const porFaixa: AbaloContagem = { perto: 0, andar: 0, longe: 0 }
      // Um recado por FAIXA, igual para todos dela: nasce na primeira entrega, e faixa vazia nem ganha id.
      const notas = new Map<AbaloFaixa, NoteEntry | null>()
      const notaDa = (faixa: AbaloFaixa): NoteEntry | null => {
        const pronta = notas.get(faixa)
        if (pronta !== undefined) return pronta
        const text = clampNoteText(textos[faixa])
        const nota = text.trim().length === 0 ? null : { id: randomId(), text, at: now() }
        notas.set(faixa, nota)
        return nota
      }
      const ponto = origem.x !== undefined && origem.y !== undefined && Number.isFinite(origem.x) && Number.isFinite(origem.y) ? { x: origem.x, y: origem.y } : null
      const outbound: Outbound[] = []
      for (const [clientId, playerId] of byClient) {
        if (statusOf(playerId) !== 'playing') continue
        // A cena de CADA jogador (a da ficha dele); sem cena, ele aguarda e não ouve nada.
        const scene = sceneFor(playerId, world)
        if (scene === null) continue
        const faixa = faixaDoAbalo(scene.sceneId, origem.sceneId, vizinhasSet)
        const nota = notaDa(faixa)
        if (nota === null) continue
        rememberNote(playerId, nota)
        porFaixa[faixa] += 1
        const forte = faixa === 'perto'
        // Só o rumo, visto da ficha que o recorte dele leva; o ponto nunca viaja.
        const seta = forte && ponto !== null ? abaloSetaForPlayer(scene.map, playerId, ownership, ponto) : null
        const msg: HostMessage = seta === null ? { type: 'abalo', id: nota.id, text: nota.text, at: nota.at, forte } : { type: 'abalo', id: nota.id, text: nota.text, at: nota.at, forte, seta }
        outbound.push({ clientId, msg })
      }
      return { outbound, porFaixa }
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
