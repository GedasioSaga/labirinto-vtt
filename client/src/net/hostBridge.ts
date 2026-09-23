import type { InvokeArgs } from '@tauri-apps/api/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { useToastStore } from '../stores/toastStore'
import type { MapData, RegionPoint } from '../types/map'
import { LASER_MAX_POINTS_PER_MESSAGE, LASER_SEND_INTERVAL_MS } from '../lib/laser'
import { addTravel, travelLogEntry, undoableTravelIds, withoutTravel, type TravelLogEntry } from '../lib/travelLog'
import {
  createHostSession,
  singleSceneWorld,
  type AppliedTokenEdit,
  type DoorRequest,
  type AppliedTransfer,
  type HostResult,
  type HostSession,
  type HostSignal,
  type HostWorld,
  type MasterCall,
  type PlayerInfo,
  type PlayerNoteDelivery,
  type TravelRequest,
} from './hostSession'
import { CALL_REASON_LABELS, NOTE_MAX_LENGTH, type DoorRequestHow, type LaserMessage } from './protocol'

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
   * "Ir lá" do chamado: o editor vai à cena de quem chamou (`null` = mapa
   * solto, a cena aberta) com a ficha dele no centro. Ausente = sem "Ir lá".
   */
  onGoToPoint?: (sceneId: string | null, x: number, y: number) => void
  now?: () => number
}

export interface HostBridge {
  start(): Promise<RoomInfo>
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
   * `gatherAt`: "Reunir o grupo aqui" — chega nessa casa, com o aviso de reunião.
   */
  sendPlayer(playerId: string, toSceneId: string, pinId: string | null, gatherAt?: { x: number; y: number }): boolean
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
}

export const BROADCAST_THROTTLE_MS = 50
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
const DEFAULT_VISION_RADIUS = 700
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
  /** Linha de cada pedido de porta trancada ainda na tela: `requestId` -> id do toast. */
  const doorToasts = new Map<string, string>()
  /** Último aviso de chegada de cada jogador: `playerId` -> id do toast. */
  const arrivalToasts = new Map<string, string>()
  /** Linha de cada chamado aberto na caixa "Chamados": `callId` -> id do toast. */
  const callToasts = new Map<string, string>()
  /** Diário de viagens desta sala, a mais nova em cima. Nunca sai pelo `net_send`. */
  let travelLog: TravelLogEntry[] = []
  let travelSeq = 0
  /** Quedas ainda não avisadas, na ordem em que aconteceram: `playerId` -> nome. */
  const pendingDrops = new Map<string, string>()
  let dropTimer: ReturnType<typeof setTimeout> | null = null
  /** Aviso "caiu" na tela de cada jogador já avisado: `playerId` -> id do toast. */
  const dropToasts = new Map<string, string>()

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
    const moved = deps.applyTransfer?.(transfer) ?? false
    if (moved && entry !== null) setTravelLog(addTravel(travelLog, entry))
    return moved
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

  const notifyPlayersIfChanged = () => {
    sendPartyIfChanged()
    const list = session?.listPlayers(world()) ?? []
    const key = JSON.stringify(list)
    if (key === lastPlayersKey) return
    lastPlayersKey = key
    deps.onPlayersChange?.(list)
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

  const answerTravel = (requestId: string, allow: boolean) => {
    const toastId = travelToasts.get(requestId)
    travelToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    if (!allow) {
      void dispatch(session.denyTravel(requestId))
      // O pedido saiu da sessão: o selo "pedido" da lista Cenas sai junto.
      notifyPlayersIfChanged()
      return
    }
    const result = session.approveTravel(requestId, world())
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
   * "Fulano entrou em X", com "Ir lá". Fica até o mestre dispensar ou ir: é
   * uma oferta de ação, e o mestre está de olho no canvas — um aviso que some
   * sozinho em segundos se perdia no meio da cena (medido na jornada da
   * viagem: o mestre ainda olhava os jogadores quando ele sumiu). Para não
   * empilhar, a chegada nova de um jogador substitui a anterior DELE.
   */
  const announceArrival = (transfer: AppliedTransfer) => {
    const previous = arrivalToasts.get(transfer.playerId)
    if (previous !== undefined) useToastStore.getState().dismiss(previous)
    const goTo = deps.onGoToScene
    const toastId = useToastStore.getState().push(
      'info',
      `${transfer.playerName} entrou em ${transfer.toSceneName}`,
      null,
      goTo === undefined ? {} : { actions: [{ label: 'Ir lá', run: () => goTo(transfer.toSceneId, transfer.x, transfer.y) }] },
    )
    arrivalToasts.set(transfer.playerId, toastId)
  }

  /**
   * Pedido de passagem válido: vira um aviso que ESPERA o mestre (não some
   * sozinho — o jogador está parado olhando "Aguardando o mestre…"). O × vale
   * "Não": a pergunta nunca some sem resposta. Grupo "Pedidos": com dois ou
   * mais esperando, viram uma caixa só, e o "Deixar todos" dela roda o
   * "Deixar ir" (`emLote`) de cada um — a mesma revalidação, pedido a pedido.
   */
  const askTravel = (request: TravelRequest) => {
    // Quem está perto AGORA, só para oferecer o botão e dizer quantos; o
    // clique conta de novo (`answerTravelTogether`), porque o grupo anda.
    const nearby = session === null ? 0 : session.travelCompanions(request.requestId, world()).length
    const together = nearby === 0 ? [] : [{ label: `Deixar ir com quem está perto (${nearby})`, run: () => answerTravelTogether(request.requestId) }]
    const toastId = useToastStore.getState().push('instrucao', `${request.playerName} quer passar por ${request.pinLabel} → ${request.toSceneName}`, null, {
      actions: [
        { label: 'Deixar ir', run: () => answerTravel(request.requestId, true), emLote: true },
        ...together,
        { label: 'Não', run: () => answerTravel(request.requestId, false) },
      ],
      onDismiss: () => answerTravel(request.requestId, false),
      grupo: 'Pedidos',
    })
    travelToasts.set(request.requestId, toastId)
  }

  const onMessage = (event: { payload: unknown }) => {
    if (session === null || !isRecord(event.payload)) return
    const clientId = parseClientId(event.payload.clientId)
    if (clientId === null) return
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
    else void dispatch(result)
    if (result.signal !== undefined) deps.onSignal?.(result.signal)
    if (result.call !== undefined) announceCall(result.call)
    // Mão baixada: a linha do chamado sai da caixa.
    pruneCallToasts()
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
    else announceJoin(clientId, new Set(before.filter((p) => !p.connected).map((p) => p.playerId)))
  }

  const onPeer = (event: { payload: unknown }) => {
    if (session === null || !isRecord(event.payload)) return
    const clientId = parseClientId(event.payload.clientId)
    if (clientId === null || event.payload.event !== 'disconnected') return
    // Conexão que nunca entrou (código errado) não acha jogador: não há quem avisar.
    const dropped = session.listPlayers().find((p) => p.clientId === clientId)
    session.disconnect(clientId)
    if (dropped !== undefined) scheduleDropAnnounce(dropped.playerId, dropped.name)
    pruneTravelToasts()
    pruneCallToasts()
    notifyPlayersIfChanged()
  }

  const removeListeners = () => {
    for (const unlisten of unlisteners) unlisten()
    unlisteners = []
  }

  const openRoom = async (): Promise<RoomInfo> => {
    try {
      const room = parseRoomInfo(await deps.invoke('net_start_room'))
      if (room === null) throw new Error('resposta inválida de net_start_room')
      session = createHostSession({ code: room.code, visionRadius: deps.visionRadius ?? DEFAULT_VISION_RADIUS, now: deps.now })
      // Sala nova, código novo: o aviso da sala anterior não pode segurar o primeiro desta.
      lastBadCodeToastAt = null
      // O diário é desta sala: os jogadores da anterior já não estão aqui para desfazer.
      setTravelLog([])
      unlisteners = [
        await deps.listen('net:message', onMessage),
        await deps.listen('net:peer', onPeer),
        await deps.listen('net:tunnel', onTunnel),
      ]
      currentRoom = room
      notifyPlayersIfChanged()
      return room
    } catch (error) {
      removeListeners()
      session = null
      reportError('Não foi possível abrir a sala', error)
      throw error
    }
  }

  return {
    start() {
      if (currentRoom !== null) return Promise.resolve(currentRoom)
      // Duplo clique: o segundo start recebe a mesma promise, sem segunda sala.
      if (pendingStart !== null) return pendingStart
      const started = openRoom()
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
      resetLaser()
      // Avisa antes de derrubar: sem `room.closed` o jogador veria queda de rede,
      // não "O mestre encerrou a sala".
      if (session) await dispatch(session.closeRoom())
      removeListeners()
      session = null
      pruneTravelToasts()
      pruneCallToasts()
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

    undoTravel(entryId) {
      if (session === null) return false
      const entry = travelLog.find((e) => e.id === entryId)
      if (entry === undefined || !undoableTravelIds(travelLog).has(entryId)) return false
      const back = { sceneId: entry.fromSceneId, x: entry.fromX, y: entry.fromY }
      const result = session.returnPlayer(entry.playerId, entry.tokenId, back, world())
      const transfer = result.applyTransfer
      // A volta é a correção de um engano, não viagem nova: não entra no diário.
      const moved = transfer !== undefined && (deps.applyTransfer?.(transfer) ?? false)
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
      notifyPlayersIfChanged()
      await sendThenKick(result, clientId)
    },

    players() {
      return session?.listPlayers(world()) ?? []
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
