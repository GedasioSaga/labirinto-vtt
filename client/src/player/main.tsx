import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { JOIN_CODE_LENGTH, NAME_MAX_LENGTH, type ClueEntry, type NoteEntry } from '../net/protocol'
import { latestActionNotice } from './moveNotice'
import { themeCss } from '../theme'
import { createPlayerConnection, hasUnreadNotes, RESUME_STORAGE_KEY } from './playerConnection'
import type { PlayerConnection, PlayerState, SocketLike, StorageLike, TravelNotice } from './playerConnection'
import { OWN_TOKEN_CSS, PlayerView } from './PlayerView'
import { PlayerPanel, loadPlayerSettings, savePlayerSettings } from './PlayerPanel'
import { PlayerPinCard } from './PlayerPinCard'
import { PlayerTokenCard } from './PlayerTokenCard'
import { tokenActionNoticeText } from './tokenCard'
import { PlayerNoteCard } from './PlayerNoteCard'
import { PlayerClueCard } from './PlayerClues'
import { coverBounds } from './playerCamera'
import { PlayerZoomControls } from './PlayerZoomControls'
import { NO_ZOOM_STEP, type ZoomDirection, type ZoomLimits, type ZoomStepRequest } from './playerZoom'
import { escapeDisarmsMeasure } from './playerMeasure'
import type { PlayerViewSettings } from './PlayerPanel'
import { PlayerErrorBoundary } from './ErrorBoundary'
import { LabyrinthMark } from '../components/icons'
import type { SignalMark } from '../lib/signals'
import type { RemoteLaser } from '../lib/laser'
import { selectedTokenColor } from '../lib/tokenColor'
import { buildTokenPhotoData } from '../lib/tokenPhoto'
import './player.css'

// Página do jogador: entra com código + nome, espera o mestre e mostra o mapa.

// Mesmas custom properties `--lb-*` do editor (ver main.tsx da raiz), antes do primeiro render.
const themeStyle = document.createElement('style')
themeStyle.id = 'lb-theme'
themeStyle.textContent = themeCss()
document.head.prepend(themeStyle)

/** Referência estável: um `[]` novo a cada render redesenharia o canvas sem motivo. */
const NO_TOKENS: string[] = []
const NO_SIGNALS: SignalMark[] = []
const NO_PLAYER_LASERS: RemoteLaser[] = []
const NO_NOTES: NoteEntry[] = []
const NO_CLUES: ClueEntry[] = []
/** Fechar o recado não perde nada: quem fecha sabe onde reler. */
const NOTE_KEPT_HINT = 'Fica guardado no Caderno do Painel.'

/**
 * O pedido de passagem, em uma linha. Nunca diz para onde o pino leva: o
 * jogador só descobre ao chegar. As recusas do host são genéricas de
 * propósito (`PinTravelRejection`), e a frase também.
 */
function travelNoticeText(notice: TravelNotice): string {
  switch (notice.phase) {
    case 'waiting':
      return notice.direct ? 'Passando…' : 'Aguardando o mestre…'
    case 'arrived':
      return 'Você chegou'
    case 'moved':
      // Nunca diz para onde: o nome da cena é do mestre.
      return 'O mestre levou você para outro lugar'
    case 'gathered':
      // Também sem o nome da cena: só que o grupo está junto de novo.
      return 'O mestre reuniu o grupo'
    case 'denied':
      return 'O mestre não deixou passar agora'
    case 'rejected':
      if (notice.reason === 'pending') return 'Seu pedido anterior ainda espera o mestre'
      if (notice.reason === 'too_soon') return 'Espere um pouco antes de pedir de novo'
      return 'Não dá para passar por aqui agora'
  }
}

const REASON_TEXT: Record<string, string> = {
  bad_code: 'Código de sala incorreto. Confira com o mestre e tente de novo.',
  not_joined: 'O mestre não reconheceu a entrada. Tente entrar de novo.',
  already_joined: 'Esta conexão já entrou na sala.',
  invalid_message: 'O mestre recusou uma mensagem inválida.',
  connection_lost: 'A conexão com o mestre caiu.',
}

/**
 * Recado no alto do formulário. `error` é o que o mestre (ou a rede) recusou e
 * pinta de ember; `info` é instrução, e fica no tom de dica — errar o código
 * não pode ter a mesma cara que "escolha outro nome".
 */
interface Notice {
  text: string
  tone: 'info' | 'error'
}

const JOIN_NOTICE: Notice = { text: 'O código da sala vem do mestre.', tone: 'info' }

function sessionStorageOrNull(): StorageLike | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Ajustes do painel sobrevivem a fechar a aba; o acesso pode lançar (site bloqueado). */
function localStorageOrNull(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function socketUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${location.host}/ws`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * O código chega colado do chat: com espaço na frente, quebra de linha no fim,
 * minúsculo ou partido no meio (" GATDFB", "gat dfb"). Só sobrevive [A-Z0-9],
 * no comprimento do código — sem isto o campo parava em 6 caracteres CONTANDO
 * o espaço e engolia a última letra, e a culpa caía no mestre.
 */
function normalizeJoinCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, JOIN_CODE_LENGTH)
}

/** Nome do host = o que o jogador digitou + sufixo de desempate (" (12)"). */
const HOST_NAME_MAX_LENGTH = NAME_MAX_LENGTH + 8

/**
 * Nome EFETIVO na sala, lido do `welcome`. O mestre renomeia nome repetido
 * ("Ana" -> "Ana (2)") e é o único que sabe disso; sem ler aqui, o jogador
 * acharia a vida toda que os outros o veem como "Ana".
 */
function welcomeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(data) || data.type !== 'welcome') return null
  const { name } = data
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  return trimmed.length > 0 && trimmed.length <= HOST_NAME_MAX_LENGTH ? trimmed : null
}

/**
 * Espelha o WebSocket real para o `playerConnection` e entrega uma cópia de
 * cada mensagem recebida ao observador. Usa o ponto de injeção que o próprio
 * cliente expõe (`createSocket`): a página precisa do nome com que o mestre
 * registrou o jogador, e o estado do cliente não guarda esse campo.
 */
function observeSocket(real: WebSocket, observe: (data: unknown) => void): SocketLike {
  const mirror: SocketLike = {
    get readyState() {
      return real.readyState
    },
    send: (data) => real.send(data),
    close: () => real.close(),
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  }
  real.onopen = (event) => mirror.onopen?.(event)
  real.onmessage = (event) => {
    observe(event.data)
    mirror.onmessage?.(event)
  }
  real.onclose = (event) => mirror.onclose?.(event)
  real.onerror = (event) => mirror.onerror?.(event)
  return mirror
}

interface LastJoin {
  code: string
  name: string
}

const LAST_JOIN_KEY = 'labirinto.ultima-entrada'
const EMPTY_JOIN: LastJoin = { code: '', name: '' }

/** Recarregar a página no meio da mesa não pode apagar código e nome já digitados. */
function readLastJoin(): LastJoin {
  const storage = localStorageOrNull()
  if (!storage) return EMPTY_JOIN
  try {
    const raw = storage.getItem(LAST_JOIN_KEY)
    if (!raw) return EMPTY_JOIN
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return EMPTY_JOIN
    const { code, name } = parsed
    return {
      code: typeof code === 'string' ? normalizeJoinCode(code) : '',
      name: typeof name === 'string' ? name.slice(0, NAME_MAX_LENGTH) : '',
    }
  } catch {
    // Storage bloqueado ou conteúdo corrompido: o formulário só começa vazio.
    return EMPTY_JOIN
  }
}

function rememberLastJoin(value: LastJoin): void {
  const storage = localStorageOrNull()
  if (!storage) return
  try {
    storage.setItem(LAST_JOIN_KEY, JSON.stringify(value))
  } catch {
    // Storage indisponível: só não lembra na próxima abertura.
  }
}

/**
 * Esta ABA tem uma sessão viva nesta sala para retomar?
 *
 * O `playerConnection` guarda o resume do mestre em `sessionStorage` ao entrar
 * (`RESUME_STORAGE_KEY`) e o apaga sozinho quando a sala acaba (expulso, sala
 * encerrada, código recusado). Ele sobrevive a recarregar a página e morre com
 * a aba — que é exatamente o caso desta volta: o celular descarta a aba ao
 * trocar de app, o dedo esbarra em Atualizar, e o amigo caía no formulário
 * para digitar código e nome outra vez no meio da mesa.
 *
 * Só lê o formato que `playerConnection.writeResume` escreve; qualquer outra
 * coisa (storage bloqueado, JSON de outra versão, sala diferente) vale como
 * "não dá para retomar" e o formulário aparece como antes.
 */
function hasResumeFor(code: string): boolean {
  if (code.length !== JOIN_CODE_LENGTH) return false
  const storage = sessionStorageOrNull()
  if (!storage) return false
  try {
    const raw = storage.getItem(RESUME_STORAGE_KEY)
    if (!raw) return false
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) && parsed.code === code && typeof parsed.token === 'string' && parsed.token.length > 0
  } catch {
    return false
  }
}

/**
 * "Sair da sala" é decisão, não acidente: sem apagar o resume, a próxima
 * abertura desta aba voltaria sozinha para a sala de onde ele acabou de sair.
 * Sair não desfaz o `lastJoin` — o formulário continua preenchido para entrar
 * de novo com um toque.
 */
function forgetResume(): void {
  const storage = sessionStorageOrNull()
  if (!storage) return
  try {
    storage.removeItem(RESUME_STORAGE_KEY)
  } catch {
    // Storage indisponível: não havia resume guardado para esquecer.
  }
}

/**
 * Casca de toda tela de texto do jogador. O fundo — pedra, halo de lampião,
 * grade do mapa e a ficha acesa — é inteiro do CSS de `.pe-page`, sem markup
 * nenhum. É isso que deixa `ErrorBoundary.tsx` ter a MESMA tela sem importar
 * nada daqui: importar criaria ciclo, porque é este módulo que importa a
 * boundary.
 */
function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="pe-page">
      <div className="pe-card">
        <header className="pe-brand">
          <span className="pe-brand__mark" aria-hidden="true">
            <LabyrinthMark size={20} />
          </span>
          <h1 className="pe-title">Labirinto</h1>
        </header>
        {children}
      </div>
    </main>
  )
}

/**
 * Dica do campo de código. Campo vazio é convite (diz o formato e que dá para
 * colar); campo pela metade é contagem, porque o botão Entrar só acende com o
 * código fechado e sem dizer quanto falta a desabilitação vira mistério.
 * Não é região viva de propósito: o leitor de tela lê esta frase pelo
 * `aria-describedby` quando o campo recebe foco, e reler a cada tecla seria
 * tagarelice.
 */
function codeHint(typed: number): string {
  if (typed === 0) return `${JOIN_CODE_LENGTH} letras e números. Pode colar do chat: espaço e minúscula são ajustados.`
  if (typed < JOIN_CODE_LENGTH) return `Faltam ${JOIN_CODE_LENGTH - typed} de ${JOIN_CODE_LENGTH} caracteres.`
  return `Código completo, ${JOIN_CODE_LENGTH} de ${JOIN_CODE_LENGTH} caracteres.`
}

interface JoinFormProps {
  initial: LastJoin
  notice: Notice
  onJoin: (code: string, name: string) => void
}

function JoinForm({ initial, notice, onJoin }: JoinFormProps) {
  const [code, setCode] = useState(initial.code)
  const [name, setName] = useState(initial.name)
  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Só na montagem (deps vazias de propósito): quem voltou de um erro cai com o
  // cursor no código, já selecionado, e troca a letra errada sem apagar nada;
  // quem chega com a sala lembrada do último jogo pula direto para o nome.
  useEffect(() => {
    const target = notice.tone === 'error' || initial.code.length !== JOIN_CODE_LENGTH ? codeRef.current : nameRef.current
    target?.focus()
    target?.select()
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    onJoin(normalizeJoinCode(code), name.trim())
  }

  const nameAtLimit = name.length >= NAME_MAX_LENGTH

  return (
    <Screen>
      <p className={notice.tone === 'error' ? 'pe-notice pe-notice--error' : 'pe-lead'} role="status" aria-live="polite">
        {notice.text}
      </p>
      <form onSubmit={submit} className="pe-form">
        <div className="pe-field">
          <label className="pe-label" htmlFor="lb-join-code">
            Código da sala
          </label>
          <input
            id="lb-join-code"
            className="pe-input pe-input--code"
            ref={codeRef}
            value={code}
            // Sem `maxLength`: o corte é da normalização, que tira o espaço ANTES de contar.
            onChange={(e) => setCode(normalizeJoinCode(e.target.value))}
            aria-describedby="lb-join-code-hint"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            required
          />
          <p id="lb-join-code-hint" className="pe-hint">
            {codeHint(code.length)}
          </p>
        </div>
        <div className="pe-field">
          <label className="pe-label" htmlFor="lb-join-name">
            Seu nome
          </label>
          <input
            id="lb-join-name"
            className="pe-input"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            aria-describedby="lb-join-name-hint"
            autoComplete="nickname"
            enterKeyHint="go"
            required
          />
          <p id="lb-join-name-hint" className="pe-hint">
            {nameAtLimit ? `Limite de ${NAME_MAX_LENGTH} caracteres: o resto não entra.` : 'É assim que o mestre e os outros jogadores vão te ver.'}
          </p>
        </div>
        <button type="submit" className="pe-btn pe-btn--primary" disabled={code.length !== JOIN_CODE_LENGTH || !name.trim()}>
          Entrar
        </button>
      </form>
    </Screen>
  )
}

/** Quanto tempo esta tela está no ar, em segundos. Tela parada sem contador parece travada. */
function useElapsedSeconds(): number {
  const [startedAt] = useState(() => Date.now())
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  return seconds
}

function elapsedLabel(seconds: number): string {
  if (seconds < 60) return `Esperando há ${seconds} s.`
  const minutes = Math.floor(seconds / 60)
  return `Esperando há ${minutes} min.`
}

/**
 * Depois disto a tela diz o que pedir ao mestre. Meio minuto é o ponto em que
 * "já vai abrir" vira "será que esqueceram de mim?" — os dois passeios cegos
 * ficaram 2 min 45 s e mais de 15 min sem nunca saber o que faltava.
 */
const NUDGE_AFTER_SECONDS = 30

interface WaitingScreenProps {
  code: string
  typedName: string
  hostName: string | null
  onRename: () => void
  onLeave: () => void
}

/**
 * Tela de espera. Dois passeios cegos travaram aqui por 2 min 45 s e 15 min
 * diante de uma frase solta: nada dizia quem ele era, em que sala estava, se a
 * conexão vivia, nem dava o que fazer. Agora diz as três coisas e tem saída.
 */
function WaitingScreen({ code, typedName, hostName, onRename, onLeave }: WaitingScreenProps) {
  const shownName = hostName ?? typedName
  const renamed = hostName !== null && hostName !== typedName
  const seconds = useElapsedSeconds()

  return (
    <Screen>
      <dl className="pe-id">
        <dt>Você é</dt>
        <dd>{shownName}</dd>
        <dt>Sala</dt>
        <dd className="pe-code">{code}</dd>
      </dl>
      {renamed && (
        <p role="alert" className="pe-notice">
          Já havia um “{typedName}” nesta sala. Para o mestre e os outros jogadores você é <strong>{shownName}</strong>.
        </p>
      )}
      {/* O ponto que pulsa é a única prova de vida numa tela que não muda: sem
          ele, "aguardando" e "travado" têm exatamente a mesma aparência. */}
      <p className="pe-live">
        <span className="pe-dot" aria-hidden="true" />
        <span>Conectado à sala do mestre.</span>
      </p>
      <p role="status" aria-live="polite" className="pe-waiting">
        Aguardando o mestre atribuir um personagem.
      </p>
      <p className="pe-hint">O mapa abre sozinho aqui assim que ele atribuir. {elapsedLabel(seconds)}</p>
      {seconds >= NUDGE_AFTER_SECONDS && (
        // Frase pronta para mandar no grupo: diz ONDE o mestre clica, porque
        // "avisa lá" sem endereço devolve o jogador para a mesma espera.
        <p className="pe-hint">Demorou? Peça ao mestre para abrir a aba Jogo e escolher um personagem para {shownName}.</p>
      )}
      <div className="pe-actions">
        <button type="button" className="pe-btn" onClick={onRename}>
          Trocar de nome
        </button>
        <button type="button" className="pe-btn" onClick={onLeave}>
          Sair da sala
        </button>
      </div>
    </Screen>
  )
}

interface SessionProps {
  connection: PlayerConnection
  code: string
  typedName: string
  hostName: string | null
  onLeave: (notice?: Notice) => void
  /** Sair de vez: volta ao formulário E esquece o resume, para a página não retomar sozinha. */
  onQuit: () => void
}

/** Ação de uma tela de texto. `primary` é o botão de latão, no máximo um por tela. */
interface ScreenAction {
  label: string
  primary?: boolean
  run: () => void
}

/**
 * Prazo do aperto de mão. Passado ele, "Conectando…" vira explicação.
 *
 * Oito segundos: o handshake de uma sala na mesma rede fecha em milissegundos,
 * e perto de dez a atenção da pessoa já foi embora (Nielsen, limites de tempo
 * de resposta). Generoso o bastante para um Wi-Fi ruim, curto o bastante para
 * a tela não parecer travada.
 */
const HANDSHAKE_DEADLINE_MS = 8_000

function Session({ connection, code, typedName, hostName, onLeave, onQuit }: SessionProps) {
  const state: PlayerState = useSyncExternalStore(connection.subscribe, connection.getState)
  const [settings, setSettings] = useState<PlayerViewSettings>(() => loadPlayerSettings(localStorageOrNull()))
  const [focus, setFocus] = useState<{ tokenId: string | null; seq: number }>({ tokenId: null, seq: 0 })
  const [signalArmed, setSignalArmed] = useState(false)
  /** Régua do jogador ligada. Só o liga/desliga mora aqui; a medida em si é do PlayerView (local ao gesto). */
  const [measureArmed, setMeasureArmed] = useState(false)
  /** Laser do jogador ligado. O rastro em si é do PlayerView (local ao gesto) e do socket. */
  const [laserArmed, setLaserArmed] = useState(false)
  /** Pino aberto no cartão; `null` = cartão fechado. */
  const [openPinId, setOpenPinId] = useState<string | null>(null)
  /** Pista do Caderno aberta no cartão (MINHAS PISTAS); `null` = fechado. */
  const [openClueId, setOpenClueId] = useState<string | null>(null)
  /** Ficha ALHEIA aberta no cartão de ações; `null` = fechado. */
  const [openTokenId, setOpenTokenId] = useState<string | null>(null)
  /** Último toque nos botões + e − (o `PlayerView` aplica o degrau) e o que eles ainda podem fazer. */
  const [zoomStep, setZoomStep] = useState<ZoomStepRequest>(NO_ZOOM_STEP)
  const [zoomLimits, setZoomLimits] = useState<ZoomLimits>({ canZoomIn: true, canZoomOut: true })
  const requestZoomStep = useCallback((direction: ZoomDirection, animate: boolean) => {
    setZoomStep((current) => ({ direction, animate, seq: current.seq + 1 }))
  }, [])
  /** Cada "Reconectar" conta uma tentativa nova e reinicia o prazo do aperto de mão. */
  const [attempt, setAttempt] = useState(0)
  const [handshakeOverdue, setHandshakeOverdue] = useState(false)
  const connecting = state.status === 'connecting'

  /**
   * "Conectando…" não tinha prazo, e essa era a tela mais cruel do app: o
   * socket ABRE e o mestre pode nunca responder — app travado, porta certa com
   * outro servidor atrás, portal cativo de hotel que aceita o upgrade e engole
   * o resto. Nada disso fecha a conexão, então `playerConnection` fica em
   * `connecting` para sempre e o jogador olha uma frase parada sem erro, sem
   * prazo e sem caminho de volta. O relógio mora aqui, e não no cliente de
   * rede, porque é decisão de tela: quando desistir de esperar e o que
   * oferecer no lugar.
   */
  useEffect(() => {
    setHandshakeOverdue(false)
    if (!connecting) return
    const timer = setTimeout(() => setHandshakeOverdue(true), HANDSHAKE_DEADLINE_MS)
    return () => clearTimeout(timer)
  }, [connecting, attempt])

  // Escape apaga a medida e desliga o modo. Só escuta com o modo ligado, e
  // nunca dentro de campo de texto (lá o Escape é da edição).
  useEffect(() => {
    if (!measureArmed && !laserArmed) return
    const onKey = (event: KeyboardEvent) => {
      if (!escapeDisarmsMeasure(event.key, event.target)) return
      // Os dois modos não ficam ligados juntos: o Escape desliga o que estiver.
      setMeasureArmed(false)
      setLaserArmed(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [measureArmed, laserArmed])

  const ownTokens = state.ownTokens ?? NO_TOKENS
  const map = state.map
  const characters = useMemo(() => {
    if (!map) return []
    const byId = new Map(map.tokens.map((t) => [t.id, t]))
    return ownTokens.flatMap((id) => {
      const token = byId.get(id)
      return token ? [{ id, name: token.name }] : []
    })
  }, [map, ownTokens])

  // A cor do próprio laser: a da ficha (a mesma que os outros veem, escolhida
  // pelo host); ficha sem cor, o azul "este é o seu" da tela do jogador.
  const ownLaserColor = useMemo(() => {
    const owned = new Set(ownTokens)
    const token = map?.tokens.find((t) => owned.has(t.id) && selectedTokenColor(t) !== null)
    return (token === undefined ? null : selectedTokenColor(token)) ?? OWN_TOKEN_CSS
  }, [map, ownTokens])

  function changeSettings(next: PlayerViewSettings) {
    setSettings(next)
    savePlayerSettings(localStorageOrNull(), next)
  }

  const openPin = openPinId === null ? null : (map?.pins ?? []).find((p) => p.id === openPinId) ?? null
  // Estável: o cartão devolve o foco ao "Fechar" sempre que `onClose` muda, e
  // um snapshot novo a cada passo do mapa tiraria o foco do "Pedir" no meio da pergunta.
  const closePin = useCallback(() => setOpenPinId(null), [])
  // Estável pelo mesmo motivo: o cartão do recado religa o Escape quando `onClose` muda.
  const closeNote = useCallback(() => connection.dismissNote(), [connection])
  const closeRoomText = useCallback(() => connection.dismissRoomText(), [connection])
  // Estável: o painel marca o Caderno como lido num efeito que depende dela.
  const readNotebook = useCallback(() => connection.markNotebookRead(), [connection])
  // MINHAS PISTAS: abrir o cartão do pino é ler — o host guarda a pista no Caderno.
  const openPinCard = useCallback(
    (pinId: string) => {
      setOpenTokenId(null)
      setOpenPinId(pinId)
      connection.readClue(pinId)
    },
    [connection],
  )
  // A ficha pode sumir do recorte (andou para o escuro, o mestre a escondeu)
  // ou virar do jogador com o cartão aberto: aí o cartão fecha sozinho.
  const openToken =
    openTokenId === null || ownTokens.includes(openTokenId) ? null : (map?.tokens ?? []).find((t) => t.id === openTokenId) ?? null
  // Estável pelo mesmo motivo do cartão do pino: o Escape e o "tocar fora" religam quando `onClose` muda.
  const closeTokenCard = useCallback(() => setOpenTokenId(null), [])
  const openTokenCard = useCallback((tokenId: string) => {
    // Um cartão por vez no mesmo lugar: a ficha toma o lugar do pino aberto.
    setOpenPinId(null)
    setOpenTokenId(tokenId)
  }, [])
  const openClue = openClueId === null ? null : (state.clues ?? []).find((clue) => clue.id === openClueId) ?? null
  // Estável pelo mesmo motivo dos outros cartões: o Escape e o "tocar fora" religam quando `onClose` muda.
  const closeClue = useCallback(() => {
    setOpenClueId(null)
    connection.resetClueShare()
  }, [connection])
  const closeShownClue = useCallback(() => connection.dismissShownClue(), [connection])
  const askCluePeers = useCallback(() => connection.askCluePeers(), [connection])
  /** Painel e barra do jogador: a câmera lê, na hora, o que eles cobrem do mapa. */
  const panelRef = useRef<HTMLElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const mapObstacles = useCallback(() => coverBounds(panelRef.current, barRef.current), [])

  if (state.status === 'playing' && state.map && state.vision) {
    const actionNotice = latestActionNotice(state.doorNotice, state.moveNotice)
    // Cartão de pista na tela: o Escape é dele, e um toque não pode fechar também o recado.
    const clueCardOpen = openClue !== null || (state.shownClue !== undefined && openPin === null)
    // Cartão do pino ou da ficha aberto: o Escape é dele, e não fecha junto os cartões de baixo.
    const noCardOnTop = openPin === null && openToken === null
    return (
      <PlayerErrorBoundary onReconnect={() => connection.reconnect()}>
        <PlayerView
          map={state.map}
          vision={state.vision}
          explored={state.explored}
          concealed={state.concealed}
          ownTokens={ownTokens}
          settings={settings}
          focusTokenId={focus.tokenId}
          focusSeq={focus.seq}
          onMove={(id, x, y) => connection.requestMove(id, x, y)}
          signals={state.signals ?? NO_SIGNALS}
          laser={state.laser}
          signalArmed={signalArmed}
          onSignal={(x, y) => {
            connection.sendSignal(x, y)
            // Modo de um toque: sinalizou, desliga.
            setSignalArmed(false)
          }}
          measureArmed={measureArmed}
          laserArmed={laserArmed}
          ownLaserColor={ownLaserColor}
          onLaserMove={(x, y) => connection.laserMove(x, y)}
          onLaserEnd={() => connection.laserOff()}
          playerLasers={state.playerLasers ?? NO_PLAYER_LASERS}
          onDoorToggle={(wallId) => connection.toggleDoor(wallId)}
          onPinOpen={openPinCard}
          onTokenOpen={openTokenCard}
          onRoomOpen={(regionId) => connection.openRoomText(regionId)}
          focusObstacles={mapObstacles}
          zoomStep={zoomStep}
          onZoomLimitsChange={setZoomLimits}
        />
        <PlayerPanel
          panelRef={panelRef}
          barRef={barRef}
          characters={characters}
          characterColor={OWN_TOKEN_CSS}
          settings={settings}
          onSettingsChange={changeSettings}
          onFocusToken={(tokenId) => setFocus((current) => ({ tokenId, seq: current.seq + 1 }))}
          signalArmed={signalArmed}
          onToggleSignal={() => {
            // Sinalizar, Medir e Laser disputam o mesmo toque no mapa: ligar um desliga os outros.
            setSignalArmed((armed) => !armed)
            setMeasureArmed(false)
            setLaserArmed(false)
          }}
          measureArmed={measureArmed}
          onToggleMeasure={() => {
            setMeasureArmed((armed) => !armed)
            setSignalArmed(false)
            setLaserArmed(false)
          }}
          laserArmed={laserArmed}
          onToggleLaser={() => {
            setLaserArmed((armed) => !armed)
            setSignalArmed(false)
            setMeasureArmed(false)
          }}
          onRenameToken={(tokenId, name) => connection.setOwnTokenName(tokenId, name)}
          onChangeTokenPhoto={async (tokenId, file) => {
            // A foto é reduzida AQUI, antes de sair da máquina do jogador: é
            // quem escolhe que paga o custo, e o que viaja já cabe no teto.
            connection.setOwnTokenPhoto(tokenId, await buildTokenPhotoData(file))
          }}
          notebook={state.notebook ?? NO_NOTES}
          notebookUnread={hasUnreadNotes(state)}
          onReadNotebook={readNotebook}
          clues={state.clues ?? NO_CLUES}
          onOpenClue={(clueId) => {
            // Outra pista aberta: a lista de colegas e o resultado eram dela.
            connection.resetClueShare()
            setOpenClueId(clueId)
          }}
        />
        {/* Depois do painel no DOM: o Tab segue a leitura (painel no alto à esquerda, zoom embaixo à direita). */}
        <PlayerZoomControls canZoomIn={zoomLimits.canZoomIn} canZoomOut={zoomLimits.canZoomOut} onZoom={requestZoomStep} />
        {/* O pino pode sumir do recorte enquanto o cartão está aberto (o token
            andou, o mestre escondeu): sem pino no mapa novo, o cartão fecha
            sozinho em vez de mostrar um texto que o jogador não pode mais ver. */}
        {openPin && (
          <PlayerPinCard
            pin={openPin}
            onClose={closePin}
            travelWaiting={state.travel?.phase === 'waiting'}
            onRequestTravel={(exitId) => {
              // Pedido enviado, o cartão sai: a espera fica no aviso de baixo,
              // e o mapa volta inteiro à vista enquanto o mestre decide.
              if (connection.requestTravel(openPin.id, exitId)) setOpenPinId(null)
            }}
          />
        )}
        {/* AGIR SOBRE UMA FICHA: o cartão da ficha alheia. Enviado, ele sai: a
            espera e a resposta ficam no aviso de baixo, e o mapa volta à vista. */}
        {openToken && (
          <PlayerTokenCard
            key={openToken.id}
            token={openToken}
            onClose={closeTokenCard}
            waiting={state.tokenAction?.phase === 'waiting'}
            onSend={(action, text) => {
              if (connection.requestTokenAction(openToken.id, action, text)) setOpenTokenId(null)
            }}
          />
        )}
        {/* MINHAS PISTAS: a pista reaberta do Caderno, com "Mostrar para…".
            Some sozinha se sair do caderno (o `clues.book` da volta não a tem). */}
        {openClue && (
          <PlayerClueCard
            key={openClue.id}
            clue={openClue}
            title={openClue.title}
            onClose={closeClue}
            escapeCloses={noCardOnTop}
            share={{
              peers: state.cluePeers,
              result: state.clueShow,
              onAskPeers: askCluePeers,
              onShow: (name) => connection.showClue(openClue.id, name),
            }}
          />
        )}
        {/* O que um colega mostrou: espera a pista aberta fechar, um cartão por vez no mesmo lugar. */}
        {state.shownClue && !openClue && openPin === null && (
          <PlayerClueCard
            key={state.shownClue.id}
            clue={state.shownClue.clue}
            title={`${state.shownClue.from} mostrou: ${state.shownClue.clue.title}`}
            onClose={closeShownClue}
            escapeCloses={noCardOnTop}
            arrivedUnasked
          />
        )}
        {state.note && (
          // `key` no id: recado novo com outro aberto remonta o cartão (e a entrada anima de novo).
          <PlayerNoteCard key={state.note.id} text={state.note.text} hint={NOTE_KEPT_HINT} onClose={closeNote} escapeCloses={noCardOnTop && !clueCardOpen} />
        )}
        {/* TEXTO DA SALA: o mesmo cartão, com o nome da Sala no alto. Um
            cartão de cada vez no mesmo lugar: com recado aberto, o texto da
            sala espera o recado fechar em vez de ficar por baixo dele. */}
        {state.roomText && !state.note && (
          <PlayerNoteCard
            key={state.roomText.id}
            title={state.roomText.title || 'Ao entrar'}
            text={state.roomText.text}
            onClose={closeRoomText}
            escapeCloses={noCardOnTop && !clueCardOpen}
          />
        )}
        {state.travel && (
          <p key={state.travel.id} className="pp-notice pp-notice--travel" role="status" aria-live="polite">
            {travelNoticeText(state.travel)}
          </p>
        )}
        {state.tokenAction && (
          <p key={state.tokenAction.id} className="pp-notice pp-notice--action" role="status" aria-live="polite">
            {tokenActionNoticeText(state.tokenAction)}
          </p>
        )}
        {actionNotice && (
          // `key` no id: o mesmo aviso repetido reinicia a animação de entrada.
          <p key={actionNotice.id} className="pp-notice" role="status" aria-live="polite">
            {actionNotice.text}
          </p>
        )}
      </PlayerErrorBoundary>
    )
  }

  // `playing` sem mapa é o intervalo entre o resume e o primeiro snapshot: mesma espera.
  if (state.status === 'waiting' || state.status === 'playing') {
    return (
      <WaitingScreen
        code={code}
        typedName={typedName}
        hostName={hostName}
        // Trocar de nome NÃO esquece o resume: o mestre reaproveita o mesmo
        // registro e só troca o nome, sem virar um segundo jogador na lista.
        onRename={() => onLeave({ text: 'Escolha outro nome e entre de novo.', tone: 'info' })}
        onLeave={onQuit}
      />
    )
  }

  let message: string
  let tone: Notice['tone'] = 'info'
  /** O que a frase não cabe: explicação, prova de vida, lista do que conferir. */
  let detail: ReactNode = null
  const actions: ScreenAction[] = []
  switch (state.status) {
    case 'connecting':
      if (handshakeOverdue) {
        // Sem `bad_code` nem `close`: o mestre simplesmente não respondeu. A
        // tela não tem como saber QUAL das causas é, então lista as três e
        // deixa o jogador conferir — chutar uma delas seria mentir.
        tone = 'error'
        message = `A sala ${code} não respondeu.`
        detail = (
          <div className="pe-explain">
            <p className="pe-hint">
              A conexão com o computador do mestre abriu, mas ninguém respondeu em{' '}
              {Math.round(HANDSHAKE_DEADLINE_MS / 1000)} segundos.
            </p>
            <ul className="pe-checklist">
              <li>O Labirinto precisa estar aberto no computador do mestre, com a sala no ar.</li>
              <li>Você e ele precisam estar na mesma rede — o mesmo Wi-Fi da casa.</li>
              <li>Confira o código com ele: você entrou com {code}.</li>
            </ul>
          </div>
        )
        actions.push({
          label: 'Reconectar',
          primary: true,
          // Reinicia o prazo: sem isto a tela voltaria a "Conectando…" e ficaria
          // lá para sempre, porque o estado já era `connecting` antes do clique.
          run: () => {
            setAttempt((n) => n + 1)
            connection.reconnect()
          },
        })
        actions.push({ label: 'Entrar em outra sala', run: () => onQuit() })
      } else {
        message = 'Conectando…'
        detail = (
          <p className="pe-live">
            <span className="pe-dot" aria-hidden="true" />
            <span>Procurando a sala {code} na rede.</span>
          </p>
        )
        // Desistir no meio da espera é direito dele, e volta ao formulário com
        // código e nome preenchidos. Discreto de propósito: a ação esperada é esperar.
        actions.push({ label: 'Cancelar', run: () => onLeave() })
      }
      break
    case 'kicked':
      message = 'Você foi removido da sala pelo mestre.'
      actions.push({ label: 'Voltar', primary: true, run: () => onLeave() })
      break
    case 'closed':
      // Sem Reconectar: a sala não existe mais.
      message = 'O mestre encerrou a sala.'
      actions.push({ label: 'Voltar', primary: true, run: () => onLeave() })
      break
    case 'error': {
      const reason = state.error ?? 'unknown'
      tone = 'error'
      message = REASON_TEXT[reason] ?? `Erro: ${reason}`
      if (reason === 'connection_lost') {
        actions.push({ label: 'Reconectar', primary: true, run: () => connection.reconnect() })
        // Beco sem saída até aqui: o único botão tentava a MESMA sala, e quando
        // ela não existe mais (o mestre fechou o app, o Wi-Fi do celular mudou)
        // o jogador ficava preso na mensagem, sem caminho de volta. Esquece o
        // resume: retomar aquela sessão é justamente o que não funciona mais.
        actions.push({ label: 'Entrar em outra sala', run: () => onQuit() })
      } else {
        // Código errado volta ao formulário COM o que ele digitou: o nome estava certo.
        actions.push({
          label: 'Corrigir e entrar de novo',
          primary: true,
          run: () => onLeave({ text: message, tone: 'error' }),
        })
      }
      break
    }
  }

  return (
    <Screen>
      <p role="status" aria-live="polite" className={tone === 'error' ? 'pe-notice pe-notice--error' : 'pe-notice'}>
        {message}
      </p>
      {detail}
      {actions.length > 0 && (
        <div className="pe-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.primary === true ? 'pe-btn pe-btn--primary' : 'pe-btn'}
              onClick={action.run}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </Screen>
  )
}

interface ActiveSession {
  connection: PlayerConnection
  code: string
  typedName: string
}

function PlayerApp() {
  const [lastJoin, setLastJoin] = useState<LastJoin>(readLastJoin)
  const [session, setSession] = useState<ActiveSession | null>(null)
  /** Nome com que o mestre registrou o jogador; `null` até o `welcome` chegar. */
  const [hostName, setHostName] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(JOIN_NOTICE)
  /**
   * A retomada é UMA por abertura de página. O ref (e não um estado) porque o
   * StrictMode monta o efeito duas vezes no desenvolvimento: sem ele seriam
   * dois WebSocket e o mestre veria o mesmo amigo entrar como "Ana" e "Ana (2)".
   */
  const rejoined = useRef(false)

  /**
   * Tira a tela de abertura de `player.html` assim que o app existe. Ela é
   * fixa e opaca, e sai depois da primeira pintura — por isso nunca aparecem
   * as duas juntas nem pisca preto entre uma e outra. Se este efeito nunca
   * rodar (módulo que não chega, render que explode no primeiro quadro), a
   * tela de abertura FICA, e ela mesma diz o que fazer: é a rede de segurança
   * mais rasteira do produto.
   */
  useEffect(() => {
    document.getElementById('lb-boot')?.remove()
  }, [])

  useEffect(() => () => session?.connection.close(), [session])

  // Recarregou a página com a sessão desta aba ainda viva: volta direto para a
  // sala, sem passar pelo formulário. `join` é declaração de função (içada).
  useEffect(() => {
    if (rejoined.current) return
    rejoined.current = true
    const { code, name } = lastJoin
    if (name.trim().length === 0 || !hasResumeFor(code)) return
    join(code, name)
  }, [])

  function join(code: string, name: string) {
    setHostName(null)
    setLastJoin({ code, name })
    rememberLastJoin({ code, name })
    const connection = createPlayerConnection({
      url: socketUrl(),
      code,
      name,
      createSocket: (url) =>
        observeSocket(new WebSocket(url), (data) => {
          const registered = welcomeName(data)
          if (registered !== null) setHostName(registered)
        }),
      storage: sessionStorageOrNull(),
    })
    setSession({ connection, code, typedName: name })
  }

  function leave(next?: Notice) {
    setNotice(next ?? JOIN_NOTICE)
    setHostName(null)
    setSession(null)
  }

  function quit() {
    forgetResume()
    leave()
  }

  if (!session) return <JoinForm initial={lastJoin} notice={notice} onJoin={join} />
  return (
    <Session
      connection={session.connection}
      code={session.code}
      typedName={session.typedName}
      hostName={hostName}
      onLeave={leave}
      onQuit={quit}
    />
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('player.html sem #root')
createRoot(root).render(
  <StrictMode>
    <PlayerApp />
  </StrictMode>,
)
