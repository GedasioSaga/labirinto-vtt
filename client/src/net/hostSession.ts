import type { DoorState, MapData, Pin, RegionPoint, Token } from '../types/map'
import { createExploration, encodeExploration, forgetInside, isPointExplored, markAll, markRings, mergeExplored, type Exploration } from '../lib/exploration'
import { pointInRing } from '../lib/floorContour'
import { filterMapForPlayer, noiseCueForPlayer, playerBlockedRings } from '../lib/fogFilter'
import { clampNoiseRangeCells } from '../lib/noise'
import { validateTokenMove } from '../lib/moveValidation'
import { doorOpensFrom, tokenReachesDoor } from '../lib/doorReach'
import { SIGNAL_MIN_INTERVAL_MS, signalColor } from '../lib/signals'
import { arrivalPoint, arrivalSpot, exitLabelsOf, isArrivalOnly, resolvePinTravel, SAIDA_PRINCIPAL, travelExitOf, type TravelScene } from '../lib/pinTravel'
import { passageOf, pinSummary } from '../lib/pins'
import { VISION_FACTOR_DEFAULT, clampVisionFactor, playerVisionRadius, readSceneVisionCells } from '../lib/sceneVision'
import {
  parsePlayerMessage,
  type DoorPeekMessage,
  type DoorToggleMessage,
  type DoorToggleRejection,
  type HostMessage,
  type JoinMessage,
  type LaserMessage,
  type PinReadMessage,
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
  applyMove?: AppliedMove
  applyDoor?: AppliedDoor
  /** Espiar aceito: o integrador avisa o mestre e reenvia o snapshot agora e no fim do prazo. */
  peek?: HostPeek
  applyTokenEdit?: AppliedTokenEdit
  signal?: HostSignal
  /** Pedido de passagem válido: o integrador pergunta ao mestre. */
  travelRequest?: TravelRequest
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
}

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
   * RUÍDO NO MAPA: o mestre fez um ruído em (`x`, `y`) da cena ABERTA no
   * editor (é o mapa em que ele clicou). Quem joga nessa cena e tem ficha a
   * até `rangeCells` casas (preso na faixa de `lib/noise.ts`) recebe `noise`
   * só com a DIREÇÃO, pelo recorte de `noiseCueForPlayer`. Nada fica guardado:
   * quem entra depois não ouve. `outbound.length` é quantos ouviram.
   */
  noise(x: number, y: number, rangeCells: number, source: HostMapSource): HostResult
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
  /**
   * Só o que a VISÃO dele marcou (sem "Revelar planta" nem planta conhecida).
   * É o que "Dar o que o grupo viu" repassa: a planta que o mestre revelou a
   * um jogador não pode vazar para o colega por esse caminho.
   */
  seen: Exploration
  /** A planta revelada (da cena ou por "Revelar planta para…") já foi marcada nesta memória. */
  planMarked: boolean
  doors: Map<string, DoorState>
  /** Visão enviada no último snapshot: é o que o jogador está vendo agora na tela. */
  vision: RegionPoint[][]
}

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
  // Por playerId: a porta que ele espia agora (uma só), na cena em que espiou,
  // até quando. Vencida, some na próxima leitura; o kick apaga.
  const peeks = new Map<string, { sceneKey: string; wallId: string; until: number }>()
  // Por playerId: limite da foto nova do próprio token (só da foto, ver TOKEN_PHOTO_MIN_INTERVAL_MS).
  const lastTokenPhotoAt = new Map<string, number>()
  // Por playerId: ajuste do mestre sobre `options.visionRadius`; só o kick apaga.
  const visionOverrides = new Map<string, number>()
  // Por playerId: "Fator de visão" (vale em toda cena); ausente = x1,0. Só o kick apaga.
  const visionFactors = new Map<string, number>()
  // Por pinId: quem vê o pino ("Só estes"). Ausente = Todos. O kick tira o
  // jogador de toda lista; o registro de quem só caiu fica (resume).
  const pinAudiences = new Map<string, Set<string>>()
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
  let rev = 0

  /** Raio em px do jogador para cena SEM "Visão nesta cena": o do mestre ou o global (o de sempre). */
  const baseRadiusFor = (playerId: string): number => visionOverrides.get(playerId) ?? options.visionRadius
  const factorFor = (playerId: string): number => visionFactors.get(playerId) ?? VISION_FACTOR_DEFAULT
  /** Raio que corta a visão do jogador NESTE mapa: o alcance da cena (ou o de sempre) vezes o fator dele. */
  const radiusFor = (playerId: string, map: MapData): number => playerVisionRadius(map, baseRadiusFor(playerId), factorFor(playerId))

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
    const size = { width: map.width * map.grid, height: map.height * map.grid, grid: map.grid }
    const memory: PlayerMemory = found ?? {
      key: memoryKey(map),
      exp: createExploration(size),
      seen: createExploration(size),
      planMarked: false,
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
    return scene === null ? { type: 'lobby.waiting' } : snapshotFor(playerId, scene)
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

  /** `sceneId` para os "Applied": só quando a cena é de fundo (a aberta é o `mapStore`). */
  const backgroundSceneId = (scene: HostScene, world: HostWorld): { sceneId?: string } =>
    scene === world.open || scene.sceneId === null ? {} : { sceneId: scene.sceneId }

  /**
   * Nunca manda o mapa do host: sempre o recorte de `filterMapForPlayer`. O
   * filtro usa o explorado e as portas lembradas de antes desta visão (a visão
   * atual já entra por si); a marcação vem depois e segue junto para o jogador
   * desenhar a névoa.
   */
  const snapshotFor = (playerId: string, scene: HostScene): HostMessage => {
    const map = scene.map
    const memory = memoryFor(playerId, map)
    const exp = memory.exp
    // Planta revelada (cena conhecida por todos, ou "Revelar planta para…"):
    // marcada ANTES do recorte, para a planta sair já neste snapshot. Uma vez
    // por memória: `markAll` varre o mapa inteiro e o snapshot sai a cada passo.
    if (!memory.planMarked && planRevealedFor(playerId, scene)) {
      markAll(exp, playerBlockedRings(map))
      memory.planMarked = true
    }
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId, map), exp, memory.doors, pinAudiences, secretReveals, peekingFor(playerId, scene))
    // Zona oculta ativa e sala secreta: célula que toca nelas não vira explorada
    // (senão o jogador guardaria a planta escondida e o formato dela).
    markRings(exp, view.vision, view.blocked)
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
    const seenNow = new Set(view.visibleDoorIds)
    for (const w of view.map.walls) {
      if (w.door !== null && seenNow.has(w.id)) memory.doors.set(w.id, { ...w.door })
    }
    // PAINEL PISTAS: o pino que sai aqui com o texto foi RECEBIDO. O "só de
    // perto" visto de longe (`longe`) chega vazio: ainda não conta.
    for (const pin of view.map.pins) {
      if (pin.longe !== true) addToSet(pinReceived, pin.id, playerId)
    }
    const sent = new Set(view.map.tokens.map((t) => t.id))
    const ownTokens = (ownership[playerId] ?? []).filter((id) => sent.has(id))
    const snapshot: Extract<HostMessage, { type: 'snapshot' }> = { type: 'snapshot', rev, map: view.map, vision: view.vision, explored: encodeExploration(exp), ownTokens, concealed: view.concealed }
    // Campo aditivo: só vai quando há cone, e o snapshot de sempre sai idêntico.
    return view.glimpses.length > 0 ? { ...snapshot, glimpses: view.glimpses } : snapshot
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

  /**
   * Jogador abre ou fecha porta. Autoridade é aqui: a porta precisa existir,
   * estar VISÍVEL para ele agora (não só lembrada — senão abriria porta do
   * outro lado do mapa), estar DESTRANCADA (trancada é só do mestre) e ter um
   * token dele encostado (`tokenReachesDoor`) — e, para ABRIR porta de um lado
   * (`DoorState.opensFrom`), encostado do lado certo. Recusa vira aviso curto na tela
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

    const reject = (reason: DoorToggleRejection): HostResult =>
      reply(clientId, { type: 'door.toggle.rejected', wallId: msg.wallId, reason })

    const wall = map.walls.find((w) => w.id === msg.wallId)
    if (wall === undefined || wall.door === null) return reject('not_visible')
    const memory = memoryFor(playerId, map)
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId, map), memory.exp, memory.doors, pinAudiences, secretReveals)
    if (!view.visibleDoorIds.includes(wall.id)) return reject('not_visible')
    // Trancada antes de longe: a cor da porta já diz que está trancada, e "Trancada" é a informação útil.
    if (wall.door.locked) return reject('locked')
    const owned = new Set(ownership[playerId] ?? [])
    // Tokens do recorte do jogador: respeita camada oculta e token escondido pelo mestre.
    const near = view.map.tokens.filter((t) => owned.has(t.id) && tokenReachesDoor(t, wall, map.grid))
    if (near.length === 0) return reject('far')
    // PORTA DE UM LADO: para ABRIR, uma ficha dele encostada precisa estar do
    // lado que abre (`wall` é a do mestre: o lado nunca sai no recorte). Fechar vale dos dois.
    if (!wall.door.open && !near.some((t) => doorOpensFrom(wall, t))) return reject('wrong_side')

    return { outbound: [], applyDoor: { wallId: wall.id, open: !wall.door.open, ...backgroundSceneId(scene, world) } }
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
    const memory = memoryFor(playerId, map)
    // Sem o espiar de antes: a porta tem de estar à vista pela visão de sempre.
    const view = filterMapForPlayer(map, playerId, ownership, radiusFor(playerId, map), memory.exp, memory.doors, pinAudiences, secretReveals)
    // Porta secreta nunca entra aqui: para o jogador ela é parede (`lib/fogFilter.ts`).
    if (!view.visibleDoorIds.includes(wall.id)) return reject('not_visible')
    if (wall.door.open && !wall.door.locked) return { outbound: [] }
    const owned = new Set(ownership[playerId] ?? [])
    const near = view.map.tokens.some((t) => owned.has(t.id) && tokenReachesDoor(t, wall, map.grid))
    if (!near) return reject('far')

    peeks.set(playerId, { sceneKey: sceneKey(scene), wallId: wall.id, until: at + PEEK_DURATION_MS })
    return { outbound: [], peek: { playerId, playerName: record.name, wallId: wall.id } }
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
    const view = filterMapForPlayer(from.map, playerId, ownership, radiusFor(playerId, from.map), memory.exp, memory.doors, pinAudiences, secretReveals)
    const seen = view.map.pins.find((p) => p.id === pinId)
    if (seen === undefined) return null
    // MARCO visto de longe: o pino chega ao jogador na névoa, mas ele nunca
    // esteve lá. Sem isto, marco + viagem seria teletransporte de qualquer
    // ponto do mapa (e, "livre", sem o mestre saber).
    if (seen.soMarco === true) return null
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
        case 'door.peek':
          return handleDoorPeek(clientId, msg, world)
        case 'token.edit':
          return handleTokenEdit(clientId, msg, world)
        case 'pin.travel.request':
          return handleTravelRequest(clientId, msg, world)
        case 'pin.read':
          return handlePinRead(clientId, msg)
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
      peeks.delete(playerId)
      lastTokenPhotoAt.delete(playerId)
      visionOverrides.delete(playerId)
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
      dropPlanGrants(playerId, null)
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
      const scene = sceneFor(playerId, toWorld(source))
      if (scene === null) return
      const map = scene.map
      markAll(memoryFor(playerId, map).exp, playerBlockedRings(map))
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
      const scene = sceneFor(playerId, toWorld(source))
      if (scene === null) return 0
      const blocked = playerBlockedRings(scene.map)
      const target = memoryFor(playerId, scene.map)
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

    hidePlan(playerId, source) {
      // Apagar a memória: o próximo snapshot recria vazia (explorado, portas e visão).
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
            visionRadius: baseRadiusFor(p.playerId),
            visionFactor: factorFor(p.playerId),
          }
          // No mapa solto todo mundo está (ou vai estar) no mapa aberto.
          let visionScene: HostScene | null = world !== null && !withScenes ? world.open : null
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
              visionScene = scene
            }
          }
          const cells = visionScene === null ? undefined : readSceneVisionCells(visionScene.map.visionCells)
          if (cells !== undefined) info.sceneVisionCells = cells
          return info
        })
    },
  }
}
