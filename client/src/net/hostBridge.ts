import type { InvokeArgs } from '@tauri-apps/api/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { useToastStore, type ToastAction, type ToastResposta } from '../stores/toastStore'
import type { MapData, PinPassage, RegionPoint, Token } from '../types/map'
import { LASER_MAX_POINTS_PER_MESSAGE, LASER_SEND_INTERVAL_MS } from '../lib/laser'
import { pointActionMasterText, type PointActionAnswer } from '../lib/pointActions'
import type { StoredToken } from '../lib/storedTokens'
import { addTravel, travelLogEntry, undoableTravelIds, withoutTravel, type TravelLogEntry } from '../lib/travelLog'
import { createArrivalAnnouncer } from './avisoDeChegada'
import {
  preferredRoomCode,
  reclaimText,
  roomCodeChangedText,
  SAVED_EXPLORATION_VERSION,
  SAVED_TABLE_VERSION,
  type SavedExploration,
  type SavedTable,
} from '../lib/savedTable'
import {
  createHostSession,
  singleSceneWorld,
  type AppliedTokenEdit,
  type DoorRequest,
  type AppliedTransfer,
  type GatherArrival,
  type HeldTokens,
  type HostResult,
  type HostSession,
  type HostSignal,
  type HostWorld,
  type MasterCall,
  type PlayerInfo,
  type PlayerNoteDelivery,
  type PointActionRequest,
  type ReclaimedSeat,
  type ReturnCandidate,
  type TravelRequest,
} from './hostSession'
import {
  CALL_REASON_LABELS,
  clampTravelDenyText,
  NOTE_MAX_LENGTH,
  parsePlayerMessage,
  TRAVEL_DENY_TEXT_MAX_LENGTH,
  type DoorRequestHow,
  type LaserMessage,
} from './protocol'

/**
 * Costura entre a sessão pura (`hostSession`) e o transporte Rust (comandos
 * `net_*` e eventos `net:*`). `invoke`/`listen` entram por injeção para os
 * testes rodarem sem Tauri.
 *
 * Contrato com o Rust: `clientId` é string em `net:message` {clientId, msg},
 * `net:peer` {clientId, event, name?}, `net_send({clientId, msg})` e
 * `net_kick({clientId})`.
 */

export interface RoomInfo {
  code: string
  urls: string[]
  qrSvg: string
}

/** Estado do link público (Cloudflare Quick Tunnel) visto pelo painel. */
export type TunnelState =
  | { kind: 'idle' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'connecting' }
  | { kind: 'ready'; url: string; qrSvg: string }
  | { kind: 'error'; message: string }

const TUNNEL_IDLE: TunnelState = { kind: 'idle' }

/** Formas mínimas que `invoke`/`listen` reais de `@tauri-apps/api` satisfazem. */
export type InvokeFn = (cmd: string, args?: InvokeArgs) => Promise<unknown>
export type ListenFn = (event: string, handler: (event: { payload: unknown }) => void) => Promise<UnlistenFn>

export interface HostBridgeDeps {
  invoke: InvokeFn
  listen: ListenFn
  getMap: () => MapData
  /**
   * A aventura inteira: cena aberta e cenas de fundo. Ausente = só o mapa de
   * `getMap` (mapa solto), e todo jogador vê a cena aberta, como antes.
   */
  getWorld?: () => HostWorld
  /** `sceneId`: cena de FUNDO onde o token está; ausente = a cena aberta no editor. */
  applyMove: (tokenId: string, x: number, y: number, sceneId?: string) => void
  /** Porta que o jogador abriu/fechou, já validada pela sessão (visível, destrancada, token perto). `sceneId` como em `applyMove`. */
  applyDoor: (wallId: string, open: boolean, sceneId?: string) => void
  /**
   * "Destrancar e abrir" do pedido da porta trancada: tirar o cadeado e abrir
   * a porta `wallId` (na cena de fundo `sceneId`, quando vier). Sem este
   * retorno, o pedido nem chega ao mestre — ninguém saberia atender — e o
   * jogador lê "O mestre disse não".
   */
  unlockAndOpenDoor?: (wallId: string, sceneId?: string) => void
  /**
   * Nome/foto novos do token do jogador, já validados pela sessão (o token é
   * dele e a foto é auto-contida). Opcional como `onSignal`: quem monta a
   * ponte sem este retorno simplesmente não oferece a edição ao jogador.
   */
  applyTokenEdit?: (edit: AppliedTokenEdit) => void
  /**
   * O mestre deixou o jogador passar: mover o token entre as cenas. `false`
   * quando não deu (cena sumiu, token sumiu) — o jogador recebe a recusa em
   * vez de "Você chegou". Sem este retorno, pedido de passagem nem chega ao
   * mestre: ninguém saberia atender.
   */
  applyTransfer?: (transfer: AppliedTransfer) => boolean
  /**
   * "Passar para pede" do pedido pelo pino trancado: trocar o modo do pino
   * `pinId` (na cena de fundo `sceneId`, quando vier; ausente = a aberta).
   * Sem este retorno a linha do pedido trancado não oferece "Passar para pede".
   */
  setPinPassage?: (pinId: string, passagem: PinPassage, sceneId?: string) => void
  /** "Ir lá" do aviso de chegada: abrir `sceneId` no editor com (`x`, `y`) no centro. */
  onGoToScene?: (sceneId: string, x: number, y: number) => void
  visionRadius?: number
  onPlayersChange?: (players: PlayerInfo[]) => void
  /**
   * Diário de viagens (G15), a mais nova em cima: muda a cada ficha que troca
   * de cena, a cada "Desfazer" e ao abrir/fechar a sala. Só do mestre.
   */
  onTravelLogChange?: (log: TravelLogEntry[]) => void
  onTunnelChange?: (state: TunnelState) => void
  /** Sinal aceito de um jogador (já validado e dentro do limite por segundo). */
  onSignal?: (signal: HostSignal) => void
  /** Chamado NOVO de um jogador: o bipe. A linha na caixa "Chamados" a ponte já põe. */
  onCall?: (call: MasterCall) => void
  /**
   * "Ir lá" do chamado e "Ver" do pedido de passagem: o editor vai à cena de
   * quem chamou ou pediu (`null` = mapa solto, a cena aberta) com a ficha dele
   * no centro. Ausente = sem "Ir lá" nem "Ver".
   */
  onGoToPoint?: (sceneId: string | null, x: number, y: number) => void
  /**
   * "Ir lá" de uma AÇÃO NO PONTO: abrir a cena do pedido centrada no ponto e
   * marcá-lo. Sem este retorno a linha da Caixa vem sem o "Ir lá" (o pedido
   * continua chegando, e "Nada aqui"/"Feito" respondem igual).
   */
  onPointActionGo?: (request: PointActionRequest) => void
  /**
   * "Guardar ficha": tirar a ficha `tokenId` do mapa (da cena de fundo
   * `sceneId`, quando vier; ausente = a cena aberta). Sem este retorno e o
   * `restoreToken`, o mestre não tem "Guardar ficha".
   */
  removeToken?: (tokenId: string, sceneId?: string) => void
  /** A ficha guardada volta ao mapa, igual ao que era, na cena `sceneId` (ausente = a aberta). */
  restoreToken?: (token: Token, sceneId?: string) => void
  /** Retomar a mesa: a mesa guardada desta aventura (`null` = nenhuma). Ausente = a ponte não retoma. */
  loadTable?: () => SavedTable | null
  /** Grava a mesa a cada mudança de dono, raio ou cena. Ausente = nada é gravado. */
  saveTable?: (table: SavedTable) => void
  /** Retomar a mesa: o mapa explorado guardado de cada jogador (`null` = nenhum). Só é lido ao retomar. */
  loadExploration?: () => SavedExploration | null
  /** Grava o mapa explorado pouco depois de mudar e ao fechar a sala. Ausente = nada é gravado. */
  saveExploration?: (exploration: SavedExploration) => void
  now?: () => number
}

export interface StartOptions {
  /** `true` = "Retomar a mesa": quem entrar com o nome de um assento guardado reencontra as fichas. */
  resume?: boolean
}

export interface HostBridge {
  start(options?: StartOptions): Promise<RoomInfo>
  stop(): Promise<void>
  notifyMapChanged(): void
  assignToken(playerId: string, tokenId: string): void
  unassignToken(playerId: string, tokenId: string): void
  kick(clientId: string): Promise<void>
  players(): PlayerInfo[]
  room(): RoomInfo | null
  /** Nunca rejeita: falha vira estado `error` + toast. */
  startTunnel(): Promise<void>
  stopTunnel(): Promise<void>
  tunnel(): TunnelState
  /** Ponteiro do laser em px de mundo; sai em lotes de no máximo 1 envio a cada `LASER_SEND_INTERVAL_MS`. */
  laserMove(x: number, y: number): void
  /** Soltou o laser: `laser {off}` para todos, só se algo foi enviado desde o último off. */
  laserOff(): void
  /** Raio de visão só deste jogador (`null` = global). Vem de um slider: o snapshot sai pelo throttle do mapa. */
  setVisionRadius(playerId: string, radius: number | null): void
  /** "Revelar planta": snapshot imediato com a planta inteira explorada (fora de zona oculta ativa). */
  revealPlan(playerId: string): void
  /** "Esconder de novo": snapshot imediato com exploração e portas lembradas zeradas. */
  hidePlan(playerId: string): void
  /**
   * "Mandar para…" do painel Grupo: leva a ficha do jogador para `toSceneId`,
   * no pino `pinId` ou no centro (`null`), sem pedido. `false` quando não deu
   * (sala fechada, destino ou ficha sumiram): o painel avisa e fica aberto.
   * `gatherAt`: "Reunir o grupo aqui" — chega nessa casa, com o aviso de
   * reunião; a montaria e o familiar, nas casas que o plano deu a eles.
   */
  sendPlayer(playerId: string, toSceneId: string, pinId: string | null, gatherAt?: GatherArrival): boolean
  /**
   * "Trazer" do painel Grupo: a ficha `tokenId` do jogador, que ficou em
   * outra cena, vem para o lado dele. Não é viagem: sem "Você chegou" e fora
   * do diário. `false` quando não deu (sala fechada, ficha já na cena dele).
   */
  bringToken(playerId: string, tokenId: string): boolean
  /**
   * Recado do mestre a quem está na cena `sceneId`. Devolve quantos jogadores
   * receberam (0 = ninguém lá), ou `null` com a sala fechada. `playerIds`:
   * só esses, entre os que estão na cena; ausente = a cena inteira.
   */
  sceneNote(sceneId: string, text: string, playerIds?: readonly string[]): number | null
  /**
   * "Pausar" da lista Cenas: pausa ou solta a cena `sceneId` e avisa quem
   * está lá. `false` com a sala fechada (não há pausa sem sala).
   */
  setScenePaused(sceneId: string, paused: boolean): boolean
  /**
   * "Recado" da linha do jogador no Grupo: só ele recebe. `sent` = saiu agora;
   * `queued` = ele está fora e recebe ao voltar; `null` = sala fechada, texto
   * vazio ou jogador que já não existe.
   */
  playerNote(playerId: string, text: string): PlayerNoteDelivery
  /**
   * "Desfazer" do diário: devolve a ficha da viagem `entryId` à cena e à casa
   * de onde saiu, e tira a linha do diário. Só vale para a ÚLTIMA viagem do
   * jogador; `false` quando não deu (sala fechada, viagem velha, a ficha já
   * saiu da cena de destino, a cena de volta sumiu) — nada muda.
   */
  undoTravel(entryId: string): boolean
  /**
   * "Guardar ficha" do card de quem foi embora: as fichas dele saem do mapa
   * (param de ocupar o corredor) e voltam sozinhas, no mesmo lugar e de novo
   * dele, quando ele voltar. Dispensar ou fechar a sala também as devolve ao
   * mapa, sem dono; e Salvar as grava no arquivo (ver `storedTokens`): guardar
   * nunca apaga ficha. `false` com a sala fechada, jogador conectado ou
   * desconhecido, ou nada a guardar.
   */
  storeTokens(playerId: string): boolean
  /**
   * Cópia das fichas guardadas agora, com a cena de onde cada uma saiu. Quem
   * grava o mapa as põe de volta no arquivo (`withStoredTokens`): senão
   * Guardar + Salvar + fechar a janela apagava a ficha, que só existia aqui.
   */
  storedTokens(): StoredToken[]
  /**
   * "Dispensar" do card de quem foi embora: o card sai. `false` com a sala
   * fechada, jogador conectado (esse é o Expulsar) ou desconhecido.
   */
  dismissPlayer(playerId: string): boolean
}

export const BROADCAST_THROTTLE_MS = 50
/**
 * O mapa explorado muda a cada passo de cada jogador, e gravá-lo é codificar
 * todas as memórias da mesa: grava uma vez, este tempo depois da primeira
 * mudança, e não a cada snapshot. Fechar a sala grava o que estiver pendente.
 */
export const EXPLORATION_SAVE_DELAY_MS = 1500
/**
 * O aviso de jogador novo fica mais tempo que um info comum (4 s): o mestre
 * costuma estar desenhando no mapa, de olho no canvas e não no rail, e perder
 * este aviso é o jogador esperando sozinho numa tela parada.
 */
export const PLAYER_JOINED_TOAST_MS = 10_000
/**
 * Tentativa com código errado só avisa o mestre uma vez por minuto. O amigo que
 * erra tenta três, quatro vezes seguidas, e o mestre não precisa de quatro
 * avisos: precisa de um, com o código para reenviar no grupo. A janela também
 * segura quem varre a porta de fora sem transformar o rail num paredão.
 */
export const BAD_CODE_TOAST_INTERVAL_MS = 60_000
/** A linha do pedido da porta na caixa do mestre: o que o jogador tenta, depois do nome dele. */
const DOOR_REQUEST_VERB: Record<DoorRequestHow, string> = {
  knock: 'bate na porta',
  force: 'tenta forçar a porta',
  key: 'tenta usar uma chave na porta',
}

/** "Ana tenta forçar a porta", mais " em Mansão" quando a porta está numa cena de fundo. */
export function doorRequestLine(request: DoorRequest): string {
  const where = request.sceneName === undefined ? '' : ` em ${request.sceneName}`
  return `${request.playerName} ${DOOR_REQUEST_VERB[request.how]}${where}`
}

/**
 * "Gina caiu" espera isto antes de sair. Wi-Fi que pisca volta antes (o
 * celular reconecta sozinho em ~1 s) e não vira aviso nenhum; quedas dentro
 * da mesma janela — o roteador que reinicia leva a mesa inteira — viram UM
 * aviso só.
 */
export const DROP_ANNOUNCE_DELAY_MS = 3_000
/**
 * Conexão sem NENHUMA mensagem há isto conta como caída. O Wi-Fi do celular
 * que some sem FIN deixa o socket "aberto" para o Rust por minutos; o cliente
 * manda `ping` a cada 2 s (`PING_INTERVAL_MS` do jogador), então seis segundos
 * são três pings perdidos — Wi-Fi ruim não vira queda falsa. Somado à
 * varredura e a `DROP_ANNOUNCE_DELAY_MS`, "Gina caiu" sai em até 10 s.
 */
export const HOST_STALE_AFTER_MS = 6_000
/**
 * O mesmo prazo para a conexão cuja aba avisou que está em segundo plano
 * (`ping` com `away: true`). Com a aba oculta há mais de 5 min o Chrome e o
 * Edge alinham os timers a 1 minuto: o ping de 2 s vira um por minuto, e com
 * 6 s de prazo o jogador que foi ler a ficha num PDF cairia e voltaria em
 * ciclo. Dois minutos e meio cobrem um despertar de minuto perdido; a aba
 * congelada de vez (economia de energia) ainda é dada como caída, uma vez só.
 */
export const HOST_AWAY_STALE_AFTER_MS = 150_000
/** De quanto em quanto tempo o host confere quem ficou mudo. */
export const LIVENESS_SWEEP_MS = 1_000
const DEFAULT_VISION_RADIUS = 700
/** Quantos motivos do "Não, porque…" voltam prontos no próximo pedido. */
export const TRAVEL_DENY_RECENTS_MAX = 3
/** Id de conexão do Rust (hoje um contador decimal); o padrão aceita folga sem abrir para lixo. */
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseClientId(value: unknown): string | null {
  return typeof value === 'string' && CLIENT_ID_PATTERN.test(value) ? value : null
}

function parseRoomInfo(value: unknown): RoomInfo | null {
  if (!isRecord(value)) return null
  const { code, urls, qrSvg } = value
  if (typeof code !== 'string' || typeof qrSvg !== 'string') return null
  if (!Array.isArray(urls) || !urls.every((u): u is string => typeof u === 'string')) return null
  return { code, urls, qrSvg }
}

/** Só `https://`: o link vai para a tela e para o QR; qualquer outra coisa é lixo. */
function parseTunnelLink(value: unknown): { url: string; qrSvg: string } | null {
  if (!isRecord(value)) return null
  const { url, qrSvg } = value
  if (typeof url !== 'string' || !url.startsWith('https://') || typeof qrSvg !== 'string') return null
  return { url, qrSvg }
}

type TunnelEvent =
  | { state: 'downloading'; progress: number }
  | { state: 'connecting' }
  | { state: 'ready'; url: string; qrSvg: string }
  | { state: 'closed'; reason: 'stopped' | 'exited' }
  | { state: 'error'; message: string }

function parseTunnelEvent(value: unknown): TunnelEvent | null {
  if (!isRecord(value)) return null
  switch (value.state) {
    case 'downloading': {
      const { progress } = value
      if (typeof progress !== 'number' || !Number.isFinite(progress)) return null
      return { state: 'downloading', progress: Math.min(1, Math.max(0, progress)) }
    }
    case 'connecting':
      return { state: 'connecting' }
    case 'ready': {
      const link = parseTunnelLink(value)
      return link === null ? null : { state: 'ready', ...link }
    }
    case 'closed':
      return value.reason === 'stopped' || value.reason === 'exited' ? { state: 'closed', reason: value.reason } : null
    case 'error':
      return typeof value.message === 'string' ? { state: 'error', message: value.message } : null
    default:
      return null
  }
}

/** "Gina caiu" / "Gina e Bruno caíram" / "Gina, Bruno e Ana caíram". */
function dropText(names: string[]): string {
  const last = names.at(-1)
  if (last === undefined) return ''
  if (names.length === 1) return `${last} caiu`
  return `${names.slice(0, -1).join(', ')} e ${last} caíram`
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function reportError(context: string, error: unknown): void {
  useToastStore.getState().push('error', `${context}: ${errorText(error)}`)
}

export function createHostBridge(deps: HostBridgeDeps): HostBridge {
  const now = deps.now ?? Date.now
  let session: HostSession | null = null
  let currentRoom: RoomInfo | null = null
  /** Último aviso de código errado mostrado ao mestre; `null` = nenhum nesta sala. */
  let lastBadCodeToastAt: number | null = null
  let unlisteners: UnlistenFn[] = []
  let pendingBroadcast: ReturnType<typeof setTimeout> | null = null
  let pendingExplorationSave: ReturnType<typeof setTimeout> | null = null
  let pendingStart: Promise<RoomInfo> | null = null
  let lastPlayersKey = '[]'
  let tunnelState: TunnelState = TUNNEL_IDLE
  let lastTunnelKey = JSON.stringify(TUNNEL_IDLE)
  let pendingTunnel: Promise<void> | null = null
  let tunnelAttemptSeq = 0
  /** Tentativa de `startTunnel` em curso; `null` depois de encerrar, fechar a sala ou terminar. */
  let activeTunnelAttempt: number | null = null
  /** Pontos do laser à espera da janela de envio. */
  let laserBuffer: RegionPoint[] = []
  let laserTimer: ReturnType<typeof setTimeout> | null = null
  /** Houve envio desde o último `off`: sem isso cada tecla solta viraria um `off` à toa. */
  let laserSent = false
  /** Aviso do mestre de cada pedido de passagem ainda na tela: `requestId` -> id do toast. */
  const travelToasts = new Map<string, string>()
  /**
   * Os últimos motivos do "Não, porque…", o mais novo primeiro, sem repetir.
   * Vivem só na ponte (fechar o app esquece): é atalho de digitação do mestre.
   */
  let travelDenyRecents: string[] = []
  /** Linha de cada pedido de porta trancada ainda na tela: `requestId` -> id do toast. */
  const doorToasts = new Map<string, string>()
  /** "Fulano entrou em X": um cartão por cena de destino (`net/avisoDeChegada.ts`). */
  const announceArrival = createArrivalAnnouncer(deps.onGoToScene)
  /** Linha de cada chamado aberto na caixa "Chamados": `callId` -> id do toast. */
  const callToasts = new Map<string, string>()
  /** Linha da Caixa de cada ação no ponto ainda sem resposta: `requestId` -> id do toast. */
  const pointActionToasts = new Map<string, string>()
  /** Diário de viagens desta sala, a mais nova em cima. Nunca sai pelo `net_send`. */
  let travelLog: TravelLogEntry[] = []
  let travelSeq = 0
  /** Quedas ainda não avisadas, na ordem em que aconteceram: `playerId` -> nome. */
  const pendingDrops = new Map<string, string>()
  let dropTimer: ReturnType<typeof setTimeout> | null = null
  /** Aviso "caiu" na tela de cada jogador já avisado: `playerId` -> id do toast. */
  const dropToasts = new Map<string, string>()
  /** Hora (relógio do mestre) da última mensagem de cada conexão: `clientId` -> ms. Nunca sai pela rede. */
  const lastHeard = new Map<string, number>()
  /** Conexões cuja aba está em segundo plano (último ping com `away: true`). Nunca sai pela rede. */
  const awayClients = new Set<string>()
  let livenessTimer: ReturnType<typeof setInterval> | null = null
  /** Pergunta "Ana voltou?" de quem entrou agora: `playerId` dele -> id do toast. */
  const returnToasts = new Map<string, string>()
  /**
   * Fichas guardadas ("Guardar ficha") de quem foi embora, cópia inteira e a
   * cena de onde saíram (`null` = mapa solto): `playerId` -> fichas. Só do
   * mestre; nunca sai pelo `net_send`.
   */
  const storedTokens = new Map<string, StoredToken[]>()

  /** Os ids das fichas guardadas, por dono: na mesa gravada continuam dele. */
  const heldTokenIds = (): HeldTokens => new Map([...storedTokens].map(([playerId, stored]) => [playerId, stored.map(({ token }) => token.id)]))

  /** O mundo que a sessão serve agora: a aventura, ou só o mapa aberto. */
  const world = (): HostWorld => deps.getWorld?.() ?? singleSceneWorld(deps.getMap())

  const setTravelLog = (next: TravelLogEntry[]) => {
    if (next === travelLog || (next.length === 0 && travelLog.length === 0)) return
    travelLog = next
    deps.onTravelLogChange?.(travelLog)
  }

  /**
   * Move a ficha pela store e, se moveu, anota a viagem. A linha é lida do
   * mundo ANTES de mover: depois, a casa de partida já não está lá.
   */
  const moveAndLog = (transfer: AppliedTransfer): boolean => {
    travelSeq += 1
    const entry = travelLogEntry(transfer, world(), now(), `viagem-${travelSeq}`)
    const moved = moveWithEntourage(transfer)
    if (moved && entry !== null) setTravelLog(addTravel(travelLog, entry))
    return moved
  }

  /**
   * Move a ficha pela store e, se ela moveu, o séquito dela (montaria e
   * familiar) pelo mesmo caminho, cada um na casa que a sessão escolheu. O
   * diário e o "Você chegou" são da ficha principal: o pônei não é viagem à parte.
   */
  const moveWithEntourage = (transfer: AppliedTransfer): boolean => {
    const moved = deps.applyTransfer?.(transfer) ?? false
    if (!moved) return false
    for (const seat of transfer.entourage ?? []) {
      deps.applyTransfer?.({ ...transfer, tokenId: seat.tokenId, x: seat.x, y: seat.y, entourage: undefined })
    }
    return true
  }

  const sendLaser = (message: LaserMessage) => {
    if (session === null) return
    // Só quem está na cena aberta: o mestre aponta no mapa que ele está vendo.
    void dispatch(session.laser(message, world()))
  }

  /** Throttle com borda de entrada: o primeiro ponto sai na hora, os seguintes esperam a janela e vão juntos. */
  const armLaserTimer = () => {
    laserTimer = setTimeout(() => {
      laserTimer = null
      if (laserBuffer.length === 0) return
      const points = laserBuffer
      laserBuffer = []
      sendLaser({ type: 'laser', points })
      armLaserTimer()
    }, LASER_SEND_INTERVAL_MS)
  }

  const resetLaser = () => {
    if (laserTimer !== null) clearTimeout(laserTimer)
    laserTimer = null
    laserBuffer = []
    laserSent = false
  }

  const setTunnel = (next: TunnelState) => {
    tunnelState = next
    const key = JSON.stringify(next)
    if (key === lastTunnelKey) return
    lastTunnelKey = key
    deps.onTunnelChange?.(next)
  }

  const onTunnel = (event: { payload: unknown }) => {
    if (session === null) return
    const parsed = parseTunnelEvent(event.payload)
    if (parsed === null) return
    const starting = activeTunnelAttempt !== null
    const wasReady = tunnelState.kind === 'ready'
    switch (parsed.state) {
      case 'downloading':
        // Progresso atrasado depois de "Encerrar" não pode ressuscitar o estado.
        if (starting) setTunnel({ kind: 'downloading', progress: parsed.progress })
        return
      case 'connecting':
        if (starting) setTunnel({ kind: 'connecting' })
        return
      case 'ready':
        if (starting || wasReady) setTunnel({ kind: 'ready', url: parsed.url, qrSvg: parsed.qrSvg })
        return
      case 'error':
        if (!starting && !wasReady) return
        setTunnel({ kind: 'error', message: parsed.message })
        // Durante o start o toast sai da rejeição do invoke; aqui só o túnel que caiu depois de pronto.
        if (!starting) reportError('O link público caiu', parsed.message)
        return
      case 'closed':
        setTunnel(TUNNEL_IDLE)
        if (parsed.reason === 'exited' && wasReady) useToastStore.getState().push('error', 'O link público caiu: o cloudflared encerrou')
        return
    }
  }

  const runTunnel = async (attempt: number): Promise<void> => {
    try {
      const link = parseTunnelLink(await deps.invoke('net_start_tunnel'))
      if (attempt !== activeTunnelAttempt) return
      if (link === null) throw new Error('resposta inválida de net_start_tunnel')
      setTunnel({ kind: 'ready', ...link })
    } catch (error) {
      // Rejeição de tentativa já encerrada (ou sala fechada) é esperada, não é falha.
      if (attempt !== activeTunnelAttempt) return
      setTunnel({ kind: 'error', message: errorText(error) })
      reportError('Não foi possível tornar a sala pública', error)
    } finally {
      if (attempt === activeTunnelAttempt) activeTunnelAttempt = null
    }
  }

  const resetTunnel = () => {
    activeTunnelAttempt = null
    pendingTunnel = null
    setTunnel(TUNNEL_IDLE)
  }

  /**
   * Companheiros na tela de cada jogador. Chamado a cada evento que pode mudar
   * quem está onde (entrar, cair, viajar, ser levado, ganhar ficha, mapa novo):
   * a sessão só devolve quem teve a lista mudada, então chamar a mais não
   * inunda o socket.
   */
  const sendPartyIfChanged = () => {
    if (session === null) return
    void dispatch(session.partyUpdates(world()))
  }

  /** A lista da sessão com o que só a ponte sabe: as fichas guardadas de cada um. */
  const playerList = (): PlayerInfo[] => {
    if (session === null) return []
    return session.listPlayers(world()).map((player) => {
      const stored = storedTokens.get(player.playerId)
      return stored === undefined ? player : { ...player, storedTokenNames: stored.map(({ token }) => token.name) }
    })
  }

  const notifyPlayersIfChanged = () => {
    sendPartyIfChanged()
    const list = playerList()
    const key = JSON.stringify(list)
    if (key === lastPlayersKey) return
    lastPlayersKey = key
    deps.onPlayersChange?.(list)
    saveTableNow()
    // Ganhar ou perder assento muda quem vai no explorado gravado.
    scheduleExplorationSave()
  }

  const saveExplorationNow = () => {
    if (session === null || currentRoom === null || deps.saveExploration === undefined) return
    // Mesa sem assento nenhum (sala recém-aberta, "Mesa nova" antes de alguém
    // ganhar ficha): não há de quem gravar, e gravar vazio apagaria o explorado
    // que a mesa guardada ainda pode retomar.
    const held = heldTokenIds()
    if (session.savedSeats(held).length === 0) return
    deps.saveExploration({ version: SAVED_EXPLORATION_VERSION, seats: session.savedExploration(held) })
  }

  /** Grava o explorado uma vez, `EXPLORATION_SAVE_DELAY_MS` depois da primeira mudança pendente. */
  const scheduleExplorationSave = () => {
    if (session === null || deps.saveExploration === undefined || pendingExplorationSave !== null) return
    pendingExplorationSave = setTimeout(() => {
      pendingExplorationSave = null
      saveExplorationNow()
    }, EXPLORATION_SAVE_DELAY_MS)
  }

  /** Fechar a sala: o último passo de cada um não pode se perder no timer. */
  const flushExplorationSave = () => {
    if (pendingExplorationSave === null) return
    clearTimeout(pendingExplorationSave)
    pendingExplorationSave = null
    saveExplorationNow()
  }

  /**
   * O arquivo da mesa acompanha cada mudança de dono, raio ou cena (as mesmas
   * que mudam a lista de jogadores). Com a sala fechada não grava: fechar não
   * pode apagar a mesa que o mestre quer retomar.
   */
  const saveTableNow = () => {
    if (session === null || currentRoom === null || deps.saveTable === undefined) return
    deps.saveTable({ version: SAVED_TABLE_VERSION, code: currentRoom.code, seats: session.savedSeats(heldTokenIds()) })
  }

  /** Envia tudo; a promise nunca rejeita — falha vira toast, nunca silêncio. */
  const dispatch = (result: HostResult): Promise<void> =>
    Promise.all(
      result.outbound.map(({ clientId, msg }) =>
        deps.invoke('net_send', { clientId, msg }).catch((error: unknown) => reportError('Falha ao enviar para jogador', error)),
      ),
    ).then(() => undefined)

  /** Espera o envio (ex.: `kicked`, `error`) sair antes de derrubar a conexão. */
  const sendThenKick = async (result: HostResult, clientId: string): Promise<void> => {
    await dispatch(result)
    try {
      await deps.invoke('net_kick', { clientId })
    } catch (error) {
      reportError('Não foi possível expulsar o jogador', error)
    }
  }

  const broadcastNow = () => {
    if (session === null) return
    void dispatch(session.broadcast(world()))
    // O mestre pode ter apagado ou trocado uma ficha de cena pelo editor: é
    // mudança de mapa, que só passa por aqui.
    sendPartyIfChanged()
    // Cada snapshot marca o que cada jogador viu: o explorado da mesa muda.
    scheduleExplorationSave()
  }

  const scheduleBroadcast = () => {
    if (session === null || pendingBroadcast !== null) return
    pendingBroadcast = setTimeout(() => {
      pendingBroadcast = null
      broadcastNow()
    }, BROADCAST_THROTTLE_MS)
  }

  const cancelPendingBroadcast = () => {
    if (pendingBroadcast === null) return
    clearTimeout(pendingBroadcast)
    pendingBroadcast = null
  }

  /**
   * Alguém chegou: o mestre precisa saber SEM ir conferir o painel Jogo, que
   * costuma estar na aba inativa enquanto ele desenha. Só para conexão que
   * acabou de entrar — join recusado (código errado) não cria jogador e não
   * acha registro aqui.
   */
  /**
   * Alguém bateu na porta com o código errado. Sem isto o mestre não faz ideia:
   * o amigo lê "Código de sala incorreto", acha que o mestre passou errado e
   * desiste calado — foi assim que um passeio cego ficou 15 minutos parado. O
   * aviso traz o código de novo, que é justamente o que o mestre precisa
   * reenviar. Estrangulado por `BAD_CODE_TOAST_INTERVAL_MS`.
   */
  const announceBadCode = () => {
    const code = currentRoom?.code
    if (code === undefined) return
    const at = now()
    if (lastBadCodeToastAt !== null && at - lastBadCodeToastAt < BAD_CODE_TOAST_INTERVAL_MS) return
    lastBadCodeToastAt = at
    useToastStore.getState().push('info', `Alguém tentou entrar com o código errado. O código desta sala é ${code}.`, PLAYER_JOINED_TOAST_MS)
  }

  const announceJoin = (clientId: string, offlineBefore: ReadonlySet<string>) => {
    const player = session?.listPlayers().find((p) => p.clientId === clientId)
    if (player === undefined) return
    if (offlineBefore.has(player.playerId)) {
      announceReturn(player.playerId, player.name)
      return
    }
    const text =
      player.status === 'waiting'
        ? `${player.name} entrou e está sem personagem. Abra a aba Jogo para atribuir um.`
        : `${player.name} voltou para a sala.`
    useToastStore.getState().push('info', text, PLAYER_JOINED_TOAST_MS)
  }

  /**
   * Retomar a mesa: "Ana voltou: Lírio devolvida", com "Desfazer" — quem
   * digitou o nome de outro não leva a ficha sem o mestre ver. Os avisos de
   * uma mesa inteira voltando se juntam numa caixa só.
   */
  const announceReclaim = (reclaimed: ReclaimedSeat) => {
    const w = world()
    const names = reclaimed.tokenIds.map((tokenId) => [w.open, ...w.background].flatMap((scene) => scene.map.tokens).find((t) => t.id === tokenId)?.name ?? tokenId)
    useToastStore.getState().push('info', reclaimText(reclaimed.name, names), PLAYER_JOINED_TOAST_MS, {
      grupo: 'Mesa retomada',
      actions: [{ label: 'Desfazer', run: () => undoReclaim(reclaimed.playerId) }],
    })
  }

  const undoReclaim = (playerId: string) => {
    if (session === null) return
    void dispatch(session.undoReclaim(playerId))
    broadcastNow()
    notifyPlayersIfChanged()
  }

  const cancelDropTimer = () => {
    if (dropTimer !== null) clearTimeout(dropTimer)
    dropTimer = null
  }

  /**
   * A conexão de alguém caiu: o mestre fica sabendo sem ir conferir o Grupo,
   * mas só depois de `DROP_ANNOUNCE_DELAY_MS` — o Wi-Fi que pisca volta antes
   * e não vira aviso, e quem cai junto sai num aviso só.
   */
  const scheduleDropAnnounce = (playerId: string, name: string) => {
    pendingDrops.set(playerId, name)
    if (dropTimer === null) dropTimer = setTimeout(flushDrops, DROP_ANNOUNCE_DELAY_MS)
  }

  const flushDrops = () => {
    dropTimer = null
    const dropped = [...pendingDrops]
    pendingDrops.clear()
    if (session === null || dropped.length === 0) return
    const toastId = useToastStore.getState().push('info', dropText(dropped.map(([, name]) => name)), PLAYER_JOINED_TOAST_MS)
    for (const [playerId] of dropped) dropToasts.set(playerId, toastId)
  }

  /**
   * Voltou pelo resume. Antes do aviso de queda: silêncio, o mestre nem soube.
   * Depois: "Gina voltou", e o "Gina caiu" dela sai da tela (o de um grupo
   * fica enquanto alguém dele ainda está fora).
   */
  const announceReturn = (playerId: string, name: string) => {
    if (pendingDrops.delete(playerId)) {
      if (pendingDrops.size === 0) cancelDropTimer()
      return
    }
    const dropToast = dropToasts.get(playerId)
    if (dropToast !== undefined) {
      dropToasts.delete(playerId)
      if (![...dropToasts.values()].includes(dropToast)) useToastStore.getState().dismiss(dropToast)
    }
    useToastStore.getState().push('info', `${name} voltou`, PLAYER_JOINED_TOAST_MS)
  }

  const resetDrops = () => {
    cancelDropTimer()
    pendingDrops.clear()
    dropToasts.clear()
  }

  /**
   * Tira da tela o aviso de todo pedido que já não espera o mestre: o
   * jogador saiu, foi expulso, a sala fechou. O aviso que sobrasse seria um
   * "Deixar ir" que não leva ninguém a lugar nenhum.
   */
  const pruneTravelToasts = () => {
    for (const [requestId, toastId] of travelToasts) {
      if (session !== null && session.isTravelPending(requestId)) continue
      travelToasts.delete(requestId)
      useToastStore.getState().dismiss(toastId)
    }
    // Mesma regra para a porta: "Destrancar e abrir" de quem saiu não abre nada.
    for (const [requestId, toastId] of doorToasts) {
      if (session !== null && session.isDoorRequestPending(requestId)) continue
      doorToasts.delete(requestId)
      useToastStore.getState().dismiss(toastId)
    }
    // Mesma regra para a ação no ponto: jogador expulso ou sala fechada não
    // deixa um "Nada aqui" que não chega a ninguém.
    for (const [requestId, toastId] of pointActionToasts) {
      if (session !== null && session.isPointActionPending(requestId)) continue
      pointActionToasts.delete(requestId)
      useToastStore.getState().dismiss(toastId)
    }
  }

  /**
   * Resposta ao pedido da porta trancada. "Destrancar e abrir" tira o cadeado
   * e abre pela store (a cena de fundo quando a porta está lá), manda "O
   * mestre abriu" e o snapshot na hora: a porta abre para quem a vê.
   */
  const answerDoor = (requestId: string, allow: boolean) => {
    const toastId = doorToasts.get(requestId)
    doorToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    if (!allow) {
      void dispatch(session.denyDoorRequest(requestId))
      return
    }
    const result = session.approveDoorRequest(requestId, world())
    if (result.applyDoor !== undefined) deps.unlockAndOpenDoor?.(result.applyDoor.wallId, result.applyDoor.sceneId)
    void dispatch(result)
    broadcastNow()
  }

  /**
   * Pedido da porta trancada: uma linha no grupo "Pedidos", a mesma caixa dos
   * pedidos de passagem. Espera o mestre como eles (o × vale "Não"), e o
   * "Deixar todos" da caixa responde "Destrancar e abrir" (`emLote`).
   */
  const askDoor = (request: DoorRequest) => {
    const toastId = useToastStore.getState().push('instrucao', doorRequestLine(request), null, {
      actions: [
        { label: 'Destrancar e abrir', run: () => answerDoor(request.requestId, true), emLote: true },
        { label: 'Não', run: () => answerDoor(request.requestId, false) },
      ],
      onDismiss: () => answerDoor(request.requestId, false),
      grupo: 'Pedidos',
      // Sozinho já abre a caixa "Pedidos (1)": o mestre, noutra cena, lê que
      // alguém espera — o pedido de passagem sozinho segue o aviso de hoje.
      sempreEmCaixa: true,
    })
    doorToasts.set(request.requestId, toastId)
  }

  /** Mesma faxina de `pruneTravelToasts`, para os chamados: baixou a mão, caiu, foi expulso, a sala fechou. */
  const pruneCallToasts = () => {
    for (const [callId, toastId] of callToasts) {
      if (session !== null && session.isCallOpen(callId)) continue
      callToasts.delete(callId)
      useToastStore.getState().dismiss(toastId)
    }
  }

  /** "Visto" ou "Responder": a linha sai e a resposta vai só a quem chamou. */
  const answerCall = (callId: string, answer: (s: HostSession) => HostResult) => {
    const toastId = callToasts.get(callId)
    callToasts.delete(callId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session !== null) void dispatch(answer(session))
  }

  /**
   * Chamado novo: uma linha no grupo "Chamados", em ordem de chegada (o
   * Urgente sobe ao topo da caixa). Espera o mestre, como o pedido de
   * passagem: o × vale "Visto" — a mão do jogador não pode ficar acesa para
   * sempre por um aviso fechado sem resposta.
   */
  const announceCall = (call: MasterCall) => {
    const label = CALL_REASON_LABELS[call.reason]
    const text = call.text === undefined ? `${call.playerName}: ${label}` : `${call.playerName}: ${label} — ${call.text}`
    const goTo = deps.onGoToPoint
    const irLa =
      goTo === undefined
        ? []
        : [
            {
              label: 'Ir lá',
              mantem: true,
              run: () => {
                const target = session?.callTarget(call.callId, world()) ?? null // null = sala fechada ou ficha fora de cena
                if (target !== null) goTo(target.sceneId, target.x, target.y)
              },
            },
          ]
    const see = () => answerCall(call.callId, (s) => s.seeCall(call.callId))
    const toastId = useToastStore.getState().push('instrucao', text, null, {
      actions: [...irLa, { label: 'Visto', run: see }],
      onDismiss: see,
      grupo: 'Chamados',
      urgente: call.reason === 'urgente',
      resposta: {
        rotulo: 'Responder',
        maxLength: NOTE_MAX_LENGTH,
        enviar: (texto) => answerCall(call.callId, (s) => s.replyCall(call.callId, texto)),
      },
    })
    callToasts.set(call.callId, toastId)
    deps.onCall?.(call)
  }

  /** "Nada aqui" ou "Feito": a linha sai e a resposta vai só a quem pediu. */
  const answerPointAction = (requestId: string, answer: PointActionAnswer) => {
    const toastId = pointActionToasts.get(requestId)
    pointActionToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    void dispatch(session.answerPointAction(requestId, answer))
  }

  /**
   * AÇÃO NO PONTO: "Fabi quer Procurar — Ferreiro" na Caixa (grupo
   * "Pedidos"), esperando o mestre. "Ir lá" leva ao ponto e deixa a linha;
   * "Nada aqui" e "Feito" respondem só a quem pediu. O × vale "Feito": a
   * pergunta nunca some sem resposta. Sem `emLote`: o "Deixar todos" é dos
   * pedidos de passagem e passa por esta linha sem tocar nela.
   */
  const askPointAction = (request: PointActionRequest) => {
    const goTo = deps.onPointActionGo
    const irLa = goTo === undefined ? [] : [{ label: 'Ir lá', mantem: true, run: () => goTo(request) }]
    const toastId = useToastStore.getState().push('instrucao', pointActionMasterText(request), null, {
      actions: [
        ...irLa,
        { label: 'Nada aqui', run: () => answerPointAction(request.requestId, 'nothing') },
        { label: 'Feito', run: () => answerPointAction(request.requestId, 'seen') },
      ],
      onDismiss: () => answerPointAction(request.requestId, 'seen'),
      grupo: 'Pedidos',
    })
    pointActionToasts.set(request.requestId, toastId)
  }

  /** Guarda o motivo no topo dos recentes: repetido sobe, e só os `TRAVEL_DENY_RECENTS_MAX` mais novos ficam. */
  const rememberDenyReason = (motivo: string) => {
    travelDenyRecents = [motivo, ...travelDenyRecents.filter((texto) => texto !== motivo)].slice(0, TRAVEL_DENY_RECENTS_MAX)
  }

  /**
   * Resposta ao pedido de passagem. `allow`: "Deixar ir" (ou "Liberar uma
   * vez", no pino trancado); `'pede'`: "Passar para pede" — o jogador passa e
   * o pino trancado vira "pede" na cena dele. `motivo`: o texto do "Não,
   * porque…" (só com `allow` falso).
   */
  const answerTravel = (requestId: string, allow: boolean | 'pede', motivo?: string) => {
    const toastId = travelToasts.get(requestId)
    travelToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    if (allow === false) {
      const pendente = session.isTravelPending(requestId)
      void dispatch(session.denyTravel(requestId, motivo))
      // Só o motivo que chegou a ser dito entra nos recentes: pedido que já tinha morrido não conta.
      if (pendente && motivo !== undefined && motivo.trim().length > 0) rememberDenyReason(clampTravelDenyText(motivo.trim()))
      // O pedido saiu da sessão: o selo "pedido" da lista Cenas sai junto.
      notifyPlayersIfChanged()
      return
    }
    const result = allow === 'pede' ? session.approveLockedTravelAsAsk(requestId, world()) : session.approveTravel(requestId, world())
    if (result.applyPinPassage !== undefined) {
      const { pinId, passagem, sceneId } = result.applyPinPassage
      deps.setPinPassage?.(pinId, passagem, sceneId)
    }
    if (result.applyTransfer === undefined) {
      // Recusa da revalidação (o token andou, o pino sumiu, a porta foi
      // trancada) ou pedido que já morreu.
      void dispatch(result)
      notifyPlayersIfChanged()
      return
    }
    completeTransfer(result, result.applyTransfer)
  }

  /**
   * "Deixar ir com quem está perto": a sessão revalida tudo no clique (quem
   * pediu e quem ainda está perto) e devolve quem pediu primeiro. Cada um
   * passa pela mesma conclusão do "Deixar ir" — a ficha muda de cena pela
   * store (`transferToken`, fora do desfazer), depois o "Você chegou".
   */
  const answerTravelTogether = (requestId: string) => {
    const toastId = travelToasts.get(requestId)
    travelToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    const [lead, ...companions] = session.approveTravelTogether(requestId, world())
    if (lead === undefined || lead.applyTransfer === undefined) {
      // Pedido que já morreu, ou recusa da revalidação: ninguém foi.
      if (lead !== undefined) void dispatch(lead)
      notifyPlayersIfChanged()
      return
    }
    completeTransfer(lead, lead.applyTransfer)
    for (const companion of companions) {
      if (companion.applyTransfer !== undefined) completeTransfer(companion, companion.applyTransfer)
    }
    // Quem foi junto e também tinha pedido: o aviso dele não pergunta mais nada.
    pruneTravelToasts()
  }

  /**
   * A ficha troca de cena: "Deixar ir" do mestre ou pino livre. Move pela
   * store ANTES de mandar o `scene.changed`, e só avisa a chegada se moveu.
   */
  const completeTransfer = (result: HostResult, transfer: AppliedTransfer) => {
    const moved = moveAndLog(transfer)
    if (!moved) {
      // O "Você chegou" não pode sair: a ficha não saiu do lugar.
      void dispatch({ outbound: result.outbound.map(({ clientId }) => ({ clientId, msg: { type: 'pin.travel.rejected', reason: 'unavailable' } })) })
      // O pedido já saiu da sessão ao ser aprovado: o selo da lista Cenas não pode ficar.
      notifyPlayersIfChanged()
      return
    }
    // Primeiro `scene.changed`, depois o snapshot da cena nova: a ordem dos
    // `net_send` é a ordem em que o jogador recebe.
    void dispatch(result)
    broadcastNow()
    notifyPlayersIfChanged()
    announceArrival(transfer)
  }

  /**
   * Pedido de passagem válido: vira um aviso que ESPERA o mestre (não some
   * sozinho — o jogador está parado olhando "Aguardando o mestre…"). O × vale
   * "Não": a pergunta nunca some sem resposta. Grupo "Pedidos": com dois ou
   * mais esperando, viram uma caixa só, e o "Deixar todos" dela roda o
   * "Deixar ir" (`emLote`) de cada um — a mesma revalidação, pedido a pedido.
   */
  const askTravel = (request: TravelRequest) => {
    if (request.trancada === true) {
      askLockedTravel(request)
      return
    }
    // Quem está perto AGORA, só para oferecer o botão e dizer quantos; o
    // clique conta de novo (`answerTravelTogether`), porque o grupo anda.
    const nearby = session === null ? 0 : session.travelCompanions(request.requestId, world()).length
    const together = nearby === 0 ? [] : [{ label: `Deixar ir com quem está perto (${nearby})`, run: () => answerTravelTogether(request.requestId) }]
    const toastId = useToastStore.getState().push('instrucao', `${request.playerName} quer passar por ${request.pinLabel} → ${request.toSceneName}`, null, {
      actions: [
        { label: 'Deixar ir', run: () => answerTravel(request.requestId, true), emLote: true },
        ...together,
        ...travelVerAction(request.requestId),
        { label: 'Não', run: () => answerTravel(request.requestId, false) },
      ],
      onDismiss: () => answerTravel(request.requestId, false),
      grupo: 'Pedidos',
      resposta: travelDenyResposta(request.requestId),
    })
    travelToasts.set(request.requestId, toastId)
  }

  /**
   * "Ver" de uma linha de pedido de passagem (comum ou pelo pino trancado): o
   * editor vai à ficha de quem pediu, e a linha fica (`mantem`) — olhar não
   * responde. A ficha é lida no clique: ela pode ter andado. Sem quem leve o
   * editor, nenhum "Ver".
   */
  const travelVerAction = (requestId: string): ToastAction[] => {
    const goTo = deps.onGoToPoint
    if (goTo === undefined) return []
    return [
      {
        label: 'Ver',
        mantem: true,
        run: () => {
          const target = session?.travelTarget(requestId, world()) ?? null // null = sala fechada, pedido decidido ou ficha fora de cena
          if (target !== null) goTo(target.sceneId, target.x, target.y)
        },
      },
    ]
  }

  /** "Não, porque…" de uma linha de pedido de passagem: o motivo curto chega só a quem pediu. */
  const travelDenyResposta = (requestId: string): ToastResposta => ({
    rotulo: 'Não, porque…',
    maxLength: TRAVEL_DENY_TEXT_MAX_LENGTH,
    enviar: (texto) => answerTravel(requestId, false, texto),
    recentes: () => travelDenyRecents,
  })

  /**
   * Pedido pelo pino TRANCADO que aceita tentativas: a mesma linha em
   * "Pedidos", com as respostas do cadeado. "Liberar uma vez" leva o jogador e
   * deixa o pino trancado (é ela que o "Deixar todos" roda, `emLote`); "Passar
   * para pede" leva e troca o modo, para a próxima passagem perguntar; "Não"
   * (e o ×) recusa, e "Não, porque…" recusa com o motivo, como na linha comum.
   * "Ver" leva o editor à ficha de quem pediu sem responder. Sem quem troque o
   * modo, a linha fica sem "Passar para pede".
   */
  const askLockedTravel = (request: TravelRequest) => {
    const paraPede = deps.setPinPassage === undefined ? [] : [{ label: 'Passar para pede', run: () => answerTravel(request.requestId, 'pede') }]
    const toastId = useToastStore.getState().push('instrucao', `${request.playerName} quer passar por ${request.pinLabel} (trancada) → ${request.toSceneName}`, null, {
      actions: [
        { label: 'Liberar uma vez', run: () => answerTravel(request.requestId, true), emLote: true },
        ...paraPede,
        ...travelVerAction(request.requestId),
        { label: 'Não', run: () => answerTravel(request.requestId, false) },
      ],
      onDismiss: () => answerTravel(request.requestId, false),
      grupo: 'Pedidos',
      resposta: travelDenyResposta(request.requestId),
    })
    travelToasts.set(request.requestId, toastId)
  }

  /** A pergunta "voltou?" que já não espera o mestre (a Ana voltou pelo resume, quem entrou caiu, a sala fechou) sai da Caixa. */
  const pruneReturnToasts = () => {
    for (const [playerId, toastId] of returnToasts) {
      if (session !== null && session.isReturnPending(playerId)) continue
      returnToasts.delete(playerId)
      useToastStore.getState().dismiss(toastId)
    }
  }

  /**
   * Devolve ao mapa as fichas que o mestre guardou de `playerId`, cada uma na
   * cena de onde saiu (sumida a cena, na aberta). `reassign`: de novo dele —
   * ele voltou; senão ficam sem dono (Dispensar, sala fechando). Devolve os
   * nomes, para o aviso.
   */
  const restoreStoredOf = (playerId: string, reassign: boolean): string[] => {
    const stored = storedTokens.get(playerId)
    if (stored === undefined) return []
    storedTokens.delete(playerId)
    const current = world()
    const backgroundIds = new Set(current.background.map((scene) => scene.sceneId))
    for (const { token, sceneId } of stored) {
      // Ausente = a cena aberta: a de onde saiu, se é ela agora, ou a cena que sumiu.
      const where = sceneId !== null && sceneId !== current.open.sceneId && backgroundIds.has(sceneId) ? sceneId : undefined
      deps.restoreToken?.(token, where)
      if (reassign && session !== null) void dispatch(session.assignToken(playerId, token.id))
    }
    return stored.map(({ token }) => token.name)
  }

  /** "É ela" ou "Outra pessoa". Só o "É ela" muda algo: a conexão nova vira a Ana, e a ficha guardada dela volta. */
  const answerReturn = (candidate: ReturnCandidate, same: boolean) => {
    const toastId = returnToasts.get(candidate.playerId)
    returnToasts.delete(candidate.playerId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    if (!same) {
      session.denyReturn(candidate.playerId)
      return
    }
    const result = session.confirmReturn(candidate.playerId, candidate.previousId, world())
    if (result.outbound.length === 0) {
      // A pergunta já não valia: nada mudou.
      notifyPlayersIfChanged()
      return
    }
    void dispatch(result)
    restoreStoredOf(candidate.previousId, true)
    // Voltou: o "Ana caiu" dela sai da tela, como na volta pelo resume.
    announceReturn(candidate.previousId, candidate.name)
    // Uma segunda "ana" que esperava a mesma pergunta: a Ana já voltou, e a pergunta dela sai.
    pruneReturnToasts()
    // A "Ana (2)" deixou de existir, e a sessão esqueceu os pedidos dela (pino,
    // porta, ação no ponto, mão): o "Deixar ir" ou o "Visto" que sobrasse na
    // Caixa não chegaria a ninguém.
    pruneTravelToasts()
    pruneCallToasts()
    broadcastNow()
    notifyPlayersIfChanged()
  }

  /**
   * Alguém entrou com o nome de quem está fora: "Ana voltou?" na Caixa. O ×
   * vale "Outra pessoa" — juntar duas pessoas é o que não pode acontecer sem
   * o mestre dizer. Fica até a resposta: quem entrou está esperando personagem.
   */
  const askReturn = (candidate: ReturnCandidate) => {
    const toastId = useToastStore.getState().push('instrucao', `${candidate.name} voltou?`, null, {
      actions: [
        { label: 'É ela', run: () => answerReturn(candidate, true) },
        { label: 'Outra pessoa', run: () => answerReturn(candidate, false) },
      ],
      onDismiss: () => answerReturn(candidate, false),
      grupo: 'Pedidos',
      sempreEmCaixa: true,
    })
    returnToasts.set(candidate.playerId, toastId)
  }

  /** A aba velha de quem voltou por outra aba já leu `session.replaced`: derruba a conexão dela. */
  const dropReplaced = (clientId: string) => {
    lastHeard.delete(clientId)
    awayClients.delete(clientId)
    deps.invoke('net_kick', { clientId }).catch(() => {
      // Já fechada no Rust (a aba foi fechada antes): era o que se queria.
    })
  }

  const onMessage = (event: { payload: unknown }) => {
    if (session === null || !isRecord(event.payload)) return
    const clientId = parseClientId(event.payload.clientId)
    if (clientId === null) return
    // Qualquer mensagem é prova de vida, não só o ping.
    lastHeard.set(clientId, now())
    // Só o ping diz em que plano está a aba; qualquer outra mensagem vem de quem está olhando.
    const parsed = parsePlayerMessage(event.payload.msg)
    if (parsed?.type === 'ping' && parsed.away === true) awayClients.add(clientId)
    else awayClients.delete(clientId)
    const before = session.listPlayers()
    const wasJoined = before.some((p) => p.clientId === clientId)
    const result = session.handleMessage(clientId, event.payload.msg, world())
    const rejectedJoin = !wasJoined && result.outbound.some((o) => o.msg.type === 'error' && o.msg.reason === 'invalid_message')
    if (rejectedJoin) {
      // Conexão que nem entrou manda lixo: responde e libera a vaga no Rust.
      void sendThenKick(result, clientId)
      return
    }
    // Pino livre: a passagem já vem decidida. O `scene.changed` do resultado
    // só pode sair DEPOIS de a ficha mudar de cena, então quem despacha é a
    // mesma conclusão do "Deixar ir".
    if (result.applyTransfer !== undefined) completeTransfer(result, result.applyTransfer)
    else {
      const sent = dispatch(result)
      // Aba nova da mesma pessoa: a velha lê "session.replaced" e só depois cai.
      const replaced = result.replacedClientId
      if (replaced !== undefined) void sent.then(() => dropReplaced(replaced))
    }
    if (result.returnCandidate !== undefined) askReturn(result.returnCandidate)
    if (!wasJoined) {
      // Voltou (resume) quem teve a ficha guardada: ela volta ao mapa, de novo dele.
      const joined = session.listPlayers().find((p) => p.clientId === clientId)
      if (joined !== undefined && restoreStoredOf(joined.playerId, true).length > 0) broadcastNow()
    }
    // A Ana voltou pelo resume: a pergunta "Ana voltou?" que outro aparelho provocou já não vale.
    pruneReturnToasts()
    if (result.signal !== undefined) deps.onSignal?.(result.signal)
    if (result.call !== undefined) announceCall(result.call)
    // Mão baixada: a linha do chamado sai da caixa.
    pruneCallToasts()
    if (result.pointAction !== undefined) askPointAction(result.pointAction)
    if (result.applyMove !== undefined) {
      const { tokenId, x, y, sceneId } = result.applyMove
      // Cena aberta: a mesma chamada de sempre, sem o quarto argumento.
      if (sceneId === undefined) deps.applyMove(tokenId, x, y)
      else deps.applyMove(tokenId, x, y, sceneId)
      broadcastNow()
    }
    if (result.applyDoor !== undefined) {
      // Todos veem a porta nova: o mestre pela store, os jogadores pelo snapshot imediato.
      const { wallId, open, sceneId } = result.applyDoor
      if (sceneId === undefined) deps.applyDoor(wallId, open)
      else deps.applyDoor(wallId, open, sceneId)
      broadcastNow()
    }
    if (result.travelRequest !== undefined) {
      if (deps.applyTransfer === undefined) {
        // Integrador sem transferência: ninguém do lado do mestre saberia atender.
        void dispatch(session.denyTravel(result.travelRequest.requestId))
      } else askTravel(result.travelRequest)
    }
    if (result.doorRequest !== undefined) {
      // Integrador sem quem destranque: a pergunta não teria resposta que abrisse a porta.
      if (deps.unlockAndOpenDoor === undefined) void dispatch(session.denyDoorRequest(result.doorRequest.requestId))
      else askDoor(result.doorRequest)
    }
    if (result.applyTokenEdit !== undefined && deps.applyTokenEdit !== undefined) {
      // Mesma regra da porta: o mestre vê pela store, os outros jogadores pelo snapshot imediato.
      deps.applyTokenEdit(result.applyTokenEdit)
      broadcastNow()
    }
    notifyPlayersIfChanged()
    if (wasJoined) return
    if (result.outbound.some((o) => o.msg.type === 'error' && o.msg.reason === 'bad_code')) announceBadCode()
    else if (result.reclaimed !== undefined) announceReclaim(result.reclaimed)
    // Troca de aba da mesma pessoa não é chegada; e quem provocou "Ana voltou?" já tem o aviso dele na Caixa.
    else if (result.replacedClientId === undefined && result.returnCandidate === undefined) {
      announceJoin(clientId, new Set(before.filter((p) => !p.connected).map((p) => p.playerId)))
    }
  }

  /**
   * A conexão `clientId` caiu — pelo `close` do Rust ou pela varredura de quem
   * ficou mudo. `at`: quando se ouviu dela por último (ausente = agora).
   */
  const dropClient = (clientId: string, at?: number) => {
    if (session === null) return
    lastHeard.delete(clientId)
    awayClients.delete(clientId)
    // Conexão que nunca entrou (código errado) — ou que a varredura já deu
    // como caída — não acha jogador: não há quem avisar de novo.
    const dropped = session.listPlayers().find((p) => p.clientId === clientId)
    session.disconnect(clientId, at)
    if (dropped !== undefined) scheduleDropAnnounce(dropped.playerId, dropped.name)
    pruneTravelToasts()
    pruneCallToasts()
    pruneReturnToasts()
    notifyPlayersIfChanged()
  }

  const onPeer = (event: { payload: unknown }) => {
    if (session === null || !isRecord(event.payload)) return
    const clientId = parseClientId(event.payload.clientId)
    if (clientId === null || event.payload.event !== 'disconnected') return
    dropClient(clientId)
  }

  /**
   * Quem está na sala e passou de `HOST_STALE_AFTER_MS` sem mandar nada caiu,
   * mesmo sem o `close` chegar (Wi-Fi que some sem FIN); a aba em segundo
   * plano tem `HOST_AWAY_STALE_AFTER_MS`. O socket zumbi é
   * derrubado no Rust: se ele ressuscitar, o cliente vê o `close` e volta pelo
   * resume, em vez de falar com uma sala que já não o conhece.
   */
  const sweepSilent = () => {
    if (session === null) return
    const at = now()
    for (const player of session.listPlayers()) {
      const clientId = player.clientId
      if (clientId === null) continue
      const heard = lastHeard.get(clientId)
      if (heard === undefined) {
        // Entrou por um caminho que não passou por `onMessage`: o prazo começa agora.
        lastHeard.set(clientId, at)
        continue
      }
      const deadline = awayClients.has(clientId) ? HOST_AWAY_STALE_AFTER_MS : HOST_STALE_AFTER_MS
      if (at - heard < deadline) continue
      dropClient(clientId, heard)
      deps.invoke('net_kick', { clientId }).catch(() => {
        // Já fechada no Rust (o `close` chegou junto): era o que se queria.
      })
    }
  }

  const stopLivenessSweep = () => {
    if (livenessTimer !== null) clearInterval(livenessTimer)
    livenessTimer = null
    lastHeard.clear()
    awayClients.clear()
  }

  const removeListeners = () => {
    for (const unlisten of unlisteners) unlisten()
    unlisteners = []
  }

  const openRoom = async (options: StartOptions): Promise<RoomInfo> => {
    try {
      // Lida antes de abrir: a sala nova regrava o arquivo assim que alguém muda de dono.
      const saved = options.resume === true ? (deps.loadTable?.() ?? null) : null
      const restoreSeats = saved?.seats ?? []
      // O explorado só vale com a mesa: sem assento, não há de quem ele seja.
      const restoreExploration = saved === null ? [] : (deps.loadExploration?.()?.seats ?? [])
      // Retomar pede o MESMO código: o link e a reconexão automática dos jogadores continuam valendo.
      // O Rust decide se dá (a porta pode ter mudado de dono); o que vale é o código que ele devolver.
      const preferredCode = preferredRoomCode(saved)
      const startReply = preferredCode === null ? await deps.invoke('net_start_room') : await deps.invoke('net_start_room', { preferredCode })
      const room = parseRoomInfo(startReply)
      if (room === null) throw new Error('resposta inválida de net_start_room')
      if (saved !== null && room.code !== saved.code) {
        // Sem prazo: o mestre precisa do texto na tela enquanto repassa o código novo à mesa.
        useToastStore.getState().push('instrucao', roomCodeChangedText(saved.code, room.code))
      }
      session = createHostSession({ code: room.code, visionRadius: deps.visionRadius ?? DEFAULT_VISION_RADIUS, now: deps.now, restoreSeats, restoreExploration })
      // Sala nova, código novo: o aviso da sala anterior não pode segurar o primeiro desta.
      lastBadCodeToastAt = null
      // O diário é desta sala: os jogadores da anterior já não estão aqui para desfazer.
      setTravelLog([])
      unlisteners = [
        await deps.listen('net:message', onMessage),
        await deps.listen('net:peer', onPeer),
        await deps.listen('net:tunnel', onTunnel),
      ]
      stopLivenessSweep()
      livenessTimer = setInterval(sweepSilent, LIVENESS_SWEEP_MS)
      currentRoom = room
      notifyPlayersIfChanged()
      return room
    } catch (error) {
      removeListeners()
      stopLivenessSweep()
      session = null
      reportError('Não foi possível abrir a sala', error)
      throw error
    }
  }

  return {
    start(options = {}) {
      if (currentRoom !== null) return Promise.resolve(currentRoom)
      // Duplo clique: o segundo start recebe a mesma promise, sem segunda sala.
      if (pendingStart !== null) return pendingStart
      const started = openRoom(options)
      pendingStart = started
      const clear = () => {
        if (pendingStart === started) pendingStart = null
      }
      started.then(clear, clear)
      return started
    },

    async stop() {
      if (pendingStart !== null) {
        try {
          await pendingStart
        } catch {
          // A falha do start já virou toast lá; aqui só importa que ele terminou.
        }
      }
      // Snapshot pendente sai antes: não pode chegar ao jogador depois do aviso.
      cancelPendingBroadcast()
      // Com a sessão ainda viva: depois dela não há de onde ler o explorado.
      flushExplorationSave()
      resetLaser()
      // Avisa antes de derrubar: sem `room.closed` o jogador veria queda de rede,
      // não "O mestre encerrou a sala".
      if (session) await dispatch(session.closeRoom())
      removeListeners()
      stopLivenessSweep()
      // Guardar nunca apaga ficha: fechar a sala devolve ao mapa, sem dono, o que estava guardado.
      for (const playerId of [...storedTokens.keys()]) restoreStoredOf(playerId, false)
      session = null
      pruneTravelToasts()
      pruneCallToasts()
      pruneReturnToasts()
      setTravelLog([])
      // Sala fechada: quem "caiu" agora é o fim da sala, não uma queda.
      resetDrops()
      currentRoom = null
      // O Rust derruba o túnel junto com a sala.
      resetTunnel()
      notifyPlayersIfChanged()
      try {
        await deps.invoke('net_stop_room')
      } catch (error) {
        reportError('Não foi possível fechar a sala', error)
      }
    },

    notifyMapChanged() {
      scheduleBroadcast()
    },

    setVisionRadius(playerId, radius) {
      if (session === null) return
      session.setVisionRadius(playerId, radius)
      // Arrastar o slider dispara dezenas de onChange: um snapshot por janela basta.
      scheduleBroadcast()
      notifyPlayersIfChanged()
    },

    revealPlan(playerId) {
      if (session === null) return
      session.revealPlan(playerId, world())
      broadcastNow()
    },

    hidePlan(playerId) {
      if (session === null) return
      session.hidePlan(playerId, world())
      broadcastNow()
    },

    sendPlayer(playerId, toSceneId, pinId, gatherAt) {
      if (session === null) return false
      const result = session.sendPlayer(playerId, toSceneId, pinId, world(), gatherAt)
      const transfer = result.applyTransfer
      // Mesmo caminho do "Deixar ir" (`answerTravel`): a ficha muda de cena
      // antes do `scene.changed` sair, e o snapshot da cena nova vem atrás.
      const moved = transfer !== undefined && moveAndLog(transfer)
      // O pedido de passagem que ele tinha morreu na sessão: o aviso do mestre sai junto.
      pruneTravelToasts()
      if (!moved) {
        // Mesmo sem mover, o pedido que ele tinha pode ter morrido: o selo acompanha.
        notifyPlayersIfChanged()
        return false
      }
      void dispatch(result)
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    bringToken(playerId, tokenId) {
      if (session === null) return false
      const transfer = session.bringToken(playerId, tokenId, world()).applyTransfer
      // Não é viagem: nem diário nem "Você chegou". A ficha muda de cena pela
      // store, e o próximo snapshot a mostra ao dono.
      const moved = transfer !== undefined && (deps.applyTransfer?.(transfer) ?? false)
      if (!moved) return false
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    undoTravel(entryId) {
      if (session === null) return false
      const entry = travelLog.find((e) => e.id === entryId)
      if (entry === undefined || !undoableTravelIds(travelLog).has(entryId)) return false
      const back = { sceneId: entry.fromSceneId, x: entry.fromX, y: entry.fromY }
      const result = session.returnPlayer(entry.playerId, entry.tokenId, back, world())
      const transfer = result.applyTransfer
      // A volta é a correção de um engano, não viagem nova: não entra no diário.
      const moved = transfer !== undefined && moveWithEntourage(transfer)
      // O pedido de passagem que ele tinha morreu na sessão: o aviso do mestre sai junto.
      pruneTravelToasts()
      if (!moved) {
        notifyPlayersIfChanged()
        return false
      }
      setTravelLog(withoutTravel(travelLog, entryId))
      // Mesma ordem do "Mandar para…": ficha movida, `scene.changed`, e o snapshot da cena de volta.
      void dispatch(result)
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    sceneNote(sceneId, text, playerIds) {
      if (session === null) return null
      const result = session.sceneNote(sceneId, text, world(), playerIds)
      void dispatch(result)
      return result.outbound.length
    },

    setScenePaused(sceneId, paused) {
      if (session === null) return false
      void dispatch(session.setScenePaused(sceneId, paused, world()))
      return true
    },

    playerNote(playerId, text) {
      if (session === null) return null
      const result = session.playerNote(playerId, text, world())
      void dispatch(result)
      return result.delivery
    },

    assignToken(playerId, tokenId) {
      if (session === null) return
      void dispatch(session.assignToken(playerId, tokenId))
      broadcastNow()
      notifyPlayersIfChanged()
    },

    unassignToken(playerId, tokenId) {
      if (session === null) return
      void dispatch(session.unassignToken(playerId, tokenId))
      broadcastNow()
      notifyPlayersIfChanged()
    },

    async kick(clientId) {
      if (session === null) return
      const result = session.kick(clientId)
      pruneTravelToasts()
      pruneCallToasts()
      pruneReturnToasts()
      notifyPlayersIfChanged()
      await sendThenKick(result, clientId)
    },

    storeTokens(playerId) {
      if (session === null || deps.removeToken === undefined || deps.restoreToken === undefined) return false
      const player = session.listPlayers().find((p) => p.playerId === playerId)
      if (player === undefined || player.connected || player.tokenIds.length === 0) return false
      const current = world()
      const stored = [...(storedTokens.get(playerId) ?? [])]
      for (const scene of [current.open, ...current.background]) {
        // Ausente = a cena aberta (convenção de `applyMove`); cena de fundo sempre tem id.
        const where = scene === current.open ? undefined : scene.sceneId
        if (where === null) continue
        for (const token of scene.map.tokens) {
          if (!player.tokenIds.includes(token.id)) continue
          stored.push({ token, sceneId: scene.sceneId })
          // Sem dono enquanto guardada: a ficha não está em mapa nenhum. Ele está fora: não há a quem avisar.
          session.unassignToken(playerId, token.id)
          deps.removeToken(token.id, where)
        }
      }
      if (stored.length === 0) return false
      storedTokens.set(playerId, stored)
      const names = stored.map(({ token }) => token.name).join(', ')
      useToastStore.getState().push('info', `Ficha guardada: ${names}. Volta ao mapa quando ${player.name} voltar.`)
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    storedTokens() {
      return [...storedTokens.values()].flatMap((stored) => stored.map((entry) => ({ ...entry })))
    },

    dismissPlayer(playerId) {
      if (session === null) return false
      const player = session.listPlayers().find((p) => p.playerId === playerId)
      if (player === undefined || player.connected) return false
      // Guardar nunca apaga ficha: quem é dispensado deixa a ficha no mapa, sem dono.
      const restored = restoreStoredOf(playerId, false)
      session.dismissPlayer(playerId)
      if (restored.length > 0) useToastStore.getState().push('info', `De volta ao mapa, sem dono: ${restored.join(', ')}.`)
      // A sessão esqueceu tudo dele, pedidos incluídos (a ação no ponto sobrevive à
      // queda): a linha que sobrasse na Caixa seria um "Nada aqui" que não chega a ninguém.
      pruneTravelToasts()
      pruneCallToasts()
      pruneReturnToasts()
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    players() {
      return playerList()
    },

    room() {
      return currentRoom
    },

    startTunnel() {
      // Duplo clique: mesma promise, um túnel só.
      if (pendingTunnel !== null) return pendingTunnel
      if (currentRoom === null) {
        useToastStore.getState().push('error', 'Abra a sala antes de torná-la pública')
        return Promise.resolve()
      }
      if (tunnelState.kind === 'ready') return Promise.resolve()
      tunnelAttemptSeq += 1
      const attempt = tunnelAttemptSeq
      activeTunnelAttempt = attempt
      // Retorno imediato ao clique; o Rust troca para "downloading" se precisar baixar.
      setTunnel({ kind: 'connecting' })
      const running = runTunnel(attempt)
      pendingTunnel = running
      void running.then(() => {
        if (pendingTunnel === running) pendingTunnel = null
      })
      return running
    },

    async stopTunnel() {
      resetTunnel()
      try {
        await deps.invoke('net_stop_tunnel')
      } catch (error) {
        reportError('Não foi possível encerrar o link público', error)
      }
    },

    tunnel() {
      return tunnelState
    },

    laserMove(x, y) {
      if (session === null || !Number.isFinite(x) || !Number.isFinite(y)) return
      // Inteiro basta para o rastro e encurta o payload que sai 20 vezes por segundo.
      const point = { x: Math.round(x), y: Math.round(y) }
      if (laserTimer === null) {
        laserSent = true
        sendLaser({ type: 'laser', points: [point] })
        armLaserTimer()
        return
      }
      // Acima do teto sai o ponto mais antigo: o jogador descartaria o lote inteiro.
      if (laserBuffer.length >= LASER_MAX_POINTS_PER_MESSAGE) laserBuffer.shift()
      laserBuffer.push(point)
      laserSent = true
    },

    laserOff() {
      if (session === null || !laserSent) return
      // O que ainda esperava a janela fica para trás: são menos de 50 ms de rastro que sumiria em 1 s.
      resetLaser()
      sendLaser({ type: 'laser', off: true })
    },
  }
}
