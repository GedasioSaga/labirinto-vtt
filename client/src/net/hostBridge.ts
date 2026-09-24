import type { InvokeArgs } from '@tauri-apps/api/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { useToastStore } from '../stores/toastStore'
import type { MapData, RegionPoint } from '../types/map'
import { LASER_MAX_POINTS_PER_MESSAGE, LASER_SEND_INTERVAL_MS } from '../lib/laser'
import {
  createHostSession,
  singleSceneWorld,
  type AppliedTokenEdit,
  type AppliedTransfer,
  type HostResult,
  type HostPlayerLaser,
  type HostSession,
  type HostSignal,
  type HostWorld,
  type LetterRequest,
  type LoanTerms,
  type PlayerInfo,
  type TravelRequest,
} from './hostSession'
import type { LaserMessage } from './protocol'
import { letterViaPhrase } from '../lib/correio'
import { createPlayerScreens, type PlayerScreen } from './playerScreens'

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
  /** "Quem vê" de cada pino com lista (`pinId` -> jogadores); pino de "Todos" não aparece. Sala fechada = `{}`. */
  onPinAudiencesChange?: (audiences: Record<string, string[]>) => void
  onTunnelChange?: (state: TunnelState) => void
  /** Sinal aceito de um jogador (já validado e dentro do limite por segundo). */
  onSignal?: (signal: HostSignal) => void
  /** Laser de um jogador (lote ou fim do gesto), já validado e dentro do limite. */
  onPlayerLaser?: (laser: HostPlayerLaser) => void
  now?: () => number
}

export interface HostBridge {
  start(): Promise<RoomInfo>
  stop(): Promise<void>
  notifyMapChanged(): void
  assignToken(playerId: string, tokenId: string): void
  unassignToken(playerId: string, tokenId: string): void
  /** AJUDANTE CONTRATADO: empresta e arma o despertador do prazo (a ficha volta sozinha). */
  lendToken(playerId: string, tokenId: string, terms: LoanTerms): void
  kick(clientId: string): Promise<void>
  players(): PlayerInfo[]
  /** Jogadores com conexão viva agora (0 com a sala fechada): quem cai se o mestre fechar o app. */
  connectedPlayerCount(): number
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
  /**
   * "Quem vê" do pino: só `playerIds` o recebem; `null` = Todos. Snapshot na
   * hora — o jogador marcado vê o pino sem recarregar, e o desmarcado o perde.
   */
  setPinAudience(pinId: string, playerIds: readonly string[] | null): void
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
   * receberam (0 = ninguém lá), ou `null` com a sala fechada.
   */
  sceneNote(sceneId: string, text: string): number | null
  /**
   * "Ver tela" do painel Grupo: o último recorte que SAIU pelo fio para este
   * jogador (a cena dele, com a névoa e a zona oculta já aplicadas), a espera
   * (`waiting`) ou `null` quando ele não tem tela (caiu, saiu, sala fechada).
   * Mesma referência enquanto nada novo sai: serve de `getSnapshot`.
   */
  playerScreen(playerId: string): PlayerScreen | null
  /** Chama `listener` a cada tela de jogador que muda. Devolve o desligar. */
  watchPlayerScreens(listener: () => void): () => void
}

export const BROADCAST_THROTTLE_MS = 50
/**
 * O aviso de jogador novo fica mais tempo que um info comum (4 s): o mestre
 * costuma estar desenhando no mapa, de olho no canvas e não no rail, e perder
 * este aviso é o jogador esperando sozinho numa tela parada.
 */
export const PLAYER_JOINED_TOAST_MS = 10_000
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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function reportError(context: string, error: unknown): void {
  useToastStore.getState().push('error', `${context}: ${errorText(error)}`)
}

export function createHostBridge(deps: HostBridgeDeps): HostBridge {
  let session: HostSession | null = null
  let currentRoom: RoomInfo | null = null
  let unlisteners: UnlistenFn[] = []
  let pendingBroadcast: ReturnType<typeof setTimeout> | null = null
  /** Despertador do prazo do ajudante contratado mais próximo (`armLoanTimer`). */
  let loanTimer: ReturnType<typeof setTimeout> | null = null
  let pendingStart: Promise<RoomInfo> | null = null
  let lastPlayersKey = '[]'
  let lastPinAudiencesKey = '{}'
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
  /** CORREIO: aviso do mestre de cada bilhete que ainda espera: `letterId` -> id do toast. */
  const letterToasts = new Map<string, string>()
  /** Último aviso de chegada de cada jogador: `playerId` -> id do toast. */
  const arrivalToasts = new Map<string, string>()
  /** O que cada conexão está vendo, anotado do que sai em `dispatch` (espelho do "Ver tela"). */
  const screens = createPlayerScreens()
  const screenWatchers = new Set<() => void>()
  const notifyScreens = () => {
    for (const watcher of screenWatchers) watcher()
  }

  /** O mundo que a sessão serve agora: a aventura, ou só o mapa aberto. */
  const world = (): HostWorld => deps.getWorld?.() ?? singleSceneWorld(deps.getMap())

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

  const notifyPlayersIfChanged = () => {
    const list = session?.listPlayers(world()) ?? []
    const key = JSON.stringify(list)
    if (key === lastPlayersKey) return
    lastPlayersKey = key
    deps.onPlayersChange?.(list)
  }

  const notifyPinAudiencesIfChanged = () => {
    const audiences = session?.pinAudiences() ?? {}
    const key = JSON.stringify(audiences)
    if (key === lastPinAudiencesKey) return
    lastPinAudiencesKey = key
    deps.onPinAudiencesChange?.(audiences)
  }

  /** Envia tudo; a promise nunca rejeita — falha vira toast, nunca silêncio. */
  const dispatch = (result: HostResult): Promise<void> => {
    // O espelho anota o que SAI, na ordem em que sai: é o que o jogador recebe.
    let screensChanged = false
    for (const { clientId, msg } of result.outbound) {
      if (screens.record(clientId, msg)) screensChanged = true
    }
    if (screensChanged) notifyScreens()
    return Promise.all(
      result.outbound.map(({ clientId, msg }) =>
        deps.invoke('net_send', { clientId, msg }).catch((error: unknown) => reportError('Falha ao enviar para jogador', error)),
      ),
    ).then(() => undefined)
  }

  /** A conexão acabou (caiu ou foi expulsa): a tela dela sai do espelho. */
  const forgetScreen = (clientId: string) => {
    if (screens.forget(clientId)) notifyScreens()
  }

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

  const clearLoanTimer = () => {
    if (loanTimer === null) return
    clearTimeout(loanTimer)
    loanTimer = null
  }

  /**
   * AJUDANTE CONTRATADO: despertador no fim de acordo mais próximo. O
   * broadcast devolve ao mestre o que venceu (`expireDue` da sessão) e manda
   * o recado; sem isto a ficha só voltaria quando alguém mexesse na mesa.
   */
  const armLoanTimer = () => {
    clearLoanTimer()
    const next = session?.nextLoanDeadline() ?? null
    if (next === null) return
    const clock = deps.now ?? Date.now
    loanTimer = setTimeout(() => {
      loanTimer = null
      broadcastNow()
      notifyPlayersIfChanged()
      armLoanTimer()
    }, Math.max(0, next - clock()))
  }

  /**
   * Alguém chegou: o mestre precisa saber SEM ir conferir o painel Jogo, que
   * costuma estar na aba inativa enquanto ele desenha. Só para conexão que
   * acabou de entrar — join recusado não cria jogador e não acha registro aqui.
   *
   * Não há aviso de código errado: o servidor Rust confere o código e recusa o
   * errado antes de repassar qualquer coisa ao TS (server.rs, `await_join`),
   * então um aviso disparado daqui nunca apareceria no app real. Avisar o
   * mestre exige o Rust emitir um evento próprio nessa recusa.
   */
  const announceJoin = (clientId: string) => {
    const player = session?.listPlayers().find((p) => p.clientId === clientId)
    if (player === undefined) return
    const text =
      player.status === 'waiting'
        ? `${player.name} entrou e está sem personagem. Abra a aba Jogo para atribuir um.`
        : `${player.name} voltou para a sala.`
    useToastStore.getState().push('info', text, PLAYER_JOINED_TOAST_MS)
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
    // CORREIO: mesma regra para o bilhete cujo destinatário foi expulso, ou com a sala fechada.
    for (const [letterId, toastId] of letterToasts) {
      if (session !== null && session.isLetterPending(letterId)) continue
      letterToasts.delete(letterId)
      useToastStore.getState().dismiss(toastId)
    }
  }

  /** CORREIO: "Entregar" leva o bilhete a quem ia receber; "Interceptar" (e o ×) some com ele. */
  const answerLetter = (letterId: string, deliver: boolean) => {
    const toastId = letterToasts.get(letterId)
    letterToasts.delete(letterId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    void dispatch(deliver ? session.deliverLetter(letterId) : session.interceptLetter(letterId))
  }

  /**
   * CORREIO: o bilhete vira um aviso que ESPERA o mestre, com o texto inteiro
   * (ler é só olhar). Atrasar é não responder ainda: o aviso fica. O × vale
   * "Interceptar", como o "Não" do pedido de passagem: o aviso nunca some
   * deixando o bilhete preso no correio. Grupo próprio, fora de "Pedidos": o
   * "Deixar todos" de lá não pode entregar bilhete. O da caixa "Bilhetes (N)"
   * entrega todos: "Entregar" é a resposta em lote (sem ela o botão não fazia nada).
   */
  const askLetter = (letter: LetterRequest) => {
    const text = `${letter.fromName} → ${letter.toName}, ${letterViaPhrase(letter.via)}: "${letter.text}"`
    const toastId = useToastStore.getState().push('instrucao', text, null, {
      actions: [
        { label: 'Entregar', run: () => answerLetter(letter.letterId, true), emLote: true },
        { label: 'Interceptar', run: () => answerLetter(letter.letterId, false) },
      ],
      onDismiss: () => answerLetter(letter.letterId, false),
      grupo: 'Bilhetes',
    })
    letterToasts.set(letter.letterId, toastId)
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
   * Move a ficha de quem viaja e, SÓ se ela foi, cada ajudante emprestado que
   * atravessa junto (`companions`), pela mesma travessia da store. O ajudante
   * que não der para mover (sumiu da cena) fica onde estava: a viagem do dono
   * não desanda por causa dele. Devolve se a ficha PRINCIPAL mudou de cena.
   */
  const moveAcross = (transfer: AppliedTransfer): boolean => {
    const apply = deps.applyTransfer
    if (apply === undefined || !apply(transfer)) return false
    const { companions = [], ...trip } = transfer
    for (const companion of companions) apply({ ...trip, tokenId: companion.tokenId, x: companion.x, y: companion.y })
    return true
  }

  /**
   * A ficha troca de cena: "Deixar ir" do mestre ou pino livre. Move pela
   * store ANTES de mandar o `scene.changed`, e só avisa a chegada se moveu.
   */
  const completeTransfer = (result: HostResult, transfer: AppliedTransfer) => {
    const moved = moveAcross(transfer)
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
    const toastId = useToastStore.getState().push('instrucao', `${request.playerName} quer passar por ${request.pinLabel} → ${request.toSceneName}`, null, {
      actions: [
        { label: 'Deixar ir', run: () => answerTravel(request.requestId, true), emLote: true },
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
    const wasJoined = session.listPlayers().some((p) => p.clientId === clientId)
    const result = session.handleMessage(clientId, event.payload.msg, world())
    const rejectedJoin =
      !wasJoined && result.outbound.some((o) => o.msg.type === 'error' && (o.msg.reason === 'invalid_message' || o.msg.reason === 'bad_code'))
    if (rejectedJoin) {
      // Conexão que nem entrou manda lixo ou código que a sessão recusa: responde
      // e libera a vaga no Rust. O código errado de verdade o Rust já barra antes
      // de chegar aqui; esta recusa é a defesa da sessão, não o caminho comum.
      void sendThenKick(result, clientId)
      return
    }
    // Pino livre: a passagem já vem decidida. O `scene.changed` do resultado
    // só pode sair DEPOIS de a ficha mudar de cena, então quem despacha é a
    // mesma conclusão do "Deixar ir".
    if (result.applyTransfer !== undefined) completeTransfer(result, result.applyTransfer)
    else void dispatch(result)
    if (result.signal !== undefined) deps.onSignal?.(result.signal)
    if (result.playerLaser !== undefined) deps.onPlayerLaser?.(result.playerLaser)
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
    if (result.letter !== undefined) askLetter(result.letter)
    if (result.applyTokenEdit !== undefined && deps.applyTokenEdit !== undefined) {
      // Mesma regra da porta: o mestre vê pela store, os outros jogadores pelo snapshot imediato.
      deps.applyTokenEdit(result.applyTokenEdit)
      broadcastNow()
    }
    notifyPlayersIfChanged()
    if (!wasJoined) announceJoin(clientId)
  }

  const onPeer = (event: { payload: unknown }) => {
    if (session === null || !isRecord(event.payload)) return
    const clientId = parseClientId(event.payload.clientId)
    if (clientId === null || event.payload.event !== 'disconnected') return
    session.disconnect(clientId)
    forgetScreen(clientId)
    pruneTravelToasts()
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
      // Sala fechada leva os empréstimos junto (a sessão morre): nada de despertador órfão.
      clearLoanTimer()
      resetLaser()
      // Avisa antes de derrubar: sem `room.closed` o jogador veria queda de rede,
      // não "O mestre encerrou a sala".
      if (session) await dispatch(session.closeRoom())
      removeListeners()
      session = null
      // Quem aguardava sem tela não recebe `room.closed` com mapa: some junto.
      if (screens.clear()) notifyScreens()
      pruneTravelToasts()
      currentRoom = null
      // O Rust derruba o túnel junto com a sala.
      resetTunnel()
      notifyPlayersIfChanged()
      notifyPinAudiencesIfChanged()
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

    setPinAudience(pinId, playerIds) {
      if (session === null) return
      session.setPinAudience(pinId, playerIds)
      broadcastNow()
      notifyPinAudiencesIfChanged()
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
      const moved = transfer !== undefined && moveAcross(transfer)
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

    sceneNote(sceneId, text) {
      if (session === null) return null
      const result = session.sceneNote(sceneId, text, world())
      void dispatch(result)
      return result.outbound.length
    },

    assignToken(playerId, tokenId) {
      if (session === null) return
      void dispatch(session.assignToken(playerId, tokenId))
      broadcastNow()
      notifyPlayersIfChanged()
      // Atribuir por cima de um empréstimo desfaz o acordo: o despertador muda junto.
      armLoanTimer()
    },

    unassignToken(playerId, tokenId) {
      if (session === null) return
      void dispatch(session.unassignToken(playerId, tokenId))
      broadcastNow()
      notifyPlayersIfChanged()
      armLoanTimer()
    },

    lendToken(playerId, tokenId, terms) {
      if (session === null) return
      void dispatch(session.lendToken(playerId, tokenId, terms))
      broadcastNow()
      notifyPlayersIfChanged()
      armLoanTimer()
    },

    async kick(clientId) {
      if (session === null) return
      const result = session.kick(clientId)
      // O expulso devolve o ajudante: o prazo dele não acorda mais ninguém.
      armLoanTimer()
      pruneTravelToasts()
      notifyPlayersIfChanged()
      notifyPinAudiencesIfChanged()
      await sendThenKick(result, clientId)
      // O `kicked` já apagou a tela; sem ele (jogador já fora da sessão) apaga aqui.
      forgetScreen(clientId)
    },

    players() {
      return session?.listPlayers(world()) ?? []
    },

    connectedPlayerCount() {
      if (session === null) return 0
      return session.listPlayers(world()).filter((player) => player.connected).length
    },

    playerScreen(playerId) {
      if (session === null) return null
      // Sem mundo: só o `clientId` interessa, e isto roda a cada render do espelho.
      const clientId = session.listPlayers().find((player) => player.playerId === playerId)?.clientId ?? null
      return clientId === null ? null : screens.get(clientId)
    },

    watchPlayerScreens(listener) {
      screenWatchers.add(listener)
      return () => {
        screenWatchers.delete(listener)
      }
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
