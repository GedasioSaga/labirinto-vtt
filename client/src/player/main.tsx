import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { JOIN_CODE_LENGTH, NAME_MAX_LENGTH, type ClueEntry, type NoteEntry } from '../net/protocol'
import { latestActionNotice } from './moveNotice'
import { themeCss } from '../theme'
import { createPlayerConnection, hasUnreadNotes, RESUME_STORAGE_KEY } from './playerConnection'
import type { PlayerConnection, PlayerState, SeatClaimNotice, SocketLike, StorageLike } from './playerConnection'
import type { SeatOption } from '../net/protocol'
import { SeatPicker } from './SeatPicker'
import { travelNoticeText } from './travelNoticeText'
import { OWN_TOKEN_CSS, PlayerView } from './PlayerView'
import { PlayerPanel, loadPlayerSettings, savePlayerSettings } from './PlayerPanel'
import { PlayerPinCard } from './PlayerPinCard'
import { ARRIVAL_CARD_TITLE, PlayerNoteCard } from './PlayerNoteCard'
import { formatNoteTime } from './PlayerNotebook'
import { PlayerMarkCard } from './PlayerMarkCard'
import { PlayerTokenCard } from './PlayerTokenCard'
import { tokenActionNoticeText, tokenActionReply } from './tokenCard'
import { PlayerClueCard } from './PlayerClues'
import { mapSharedNoticeText } from './PlayerMapShare'
import { coverBounds } from './playerCamera'
import { PlayerZoomControls } from './PlayerZoomControls'
import { PlayerSceneName } from './PlayerSceneName'
import { PlayerScreenAwake } from './PlayerScreenAwake'
import { useScreenWakeLock } from './screenWakeLock'
import { PlayerWhereAmI } from './PlayerWhereAmI'
import { whereAmI } from './whereAmI'
import { NO_ZOOM_STEP, type ZoomDirection, type ZoomLimits, type ZoomStepRequest } from './playerZoom'
import { PlayerAlarmBanner } from './PlayerAlarmBanner'
import { PlayerTurnBanner, TurnWaitNotice } from './PlayerTurnBanner'
import { PlayerClockBadge } from './PlayerClockBadge'
import { PlayerDoorNotice, doorRequestText } from './PlayerDoorNotice'
import { PlayerCallButton } from './PlayerCallButton'
import { ReconnectingOverlay } from './ReconnectingOverlay'
import { PointActionMenu } from './PointActionMenu'
import { isPointInsideMap, pointNoticeText } from '../lib/pointActions'
import { PlayerSecretCheckCard, SECRET_CHECK_NOTICE_TEXT } from './PlayerSecretCheckCard'
import { PlayerNoiseCue } from './PlayerNoiseCue'
import { PeekDoorButton } from './PeekDoorButton'
import { escapeDisarmsMeasure } from './playerMeasure'
import type { PlayerViewSettings } from './PlayerPanel'
import { PlayerErrorBoundary } from './ErrorBoundary'
import { LabyrinthMark } from '../components/icons'
import { DiceFeed } from '../components/DiceControls'
import type { DiceRollEntry } from '../lib/dice'
import type { DestinationMark, SignalMark } from '../lib/signals'
import type { RemoteLaser } from '../lib/laser'
import { selectedTokenColor } from '../lib/tokenColor'
import { buildTokenPhotoData } from '../lib/tokenPhoto'
import { carriedItemsOf, giveTargets } from '../lib/items'
import { itemNoticeText } from './itemNotice'
import { leverNoticeText } from './leverNotice'
import { hazardNoticeText } from '../lib/hazards'
import { tableCodeFromSearch, tableKeyFromSearch } from '../lib/tableScreen'
import { TableApp } from './TableScreen'
import { findKnownPath } from '../lib/knownPath'
import type { Pin } from '../types/map'
import { loadPlaceNames, savePlaceName, withPlaceName, type VisitedPlace } from './playerPlaces'
import { PersonalNoteDraft } from './PlayerPersonalNotes'
import {
  addPersonalNote,
  loadPersonalNotes,
  newPersonalNoteId,
  notesOnMap,
  removePersonalNote,
  savePersonalNotes,
  type PersonalNote,
} from './personalNotes'
import type { FocusPointRequest } from './PlayerView'
import { floorShown, PlayerFloorTabs } from './PlayerFloorTabs'
import type { RegionPoint } from '../types/map'
import { textoDoFimDaEspera } from '../lib/encontroMarcado'
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
const NO_DESTINATIONS: DestinationMark[] = []
const NO_PLAYER_LASERS: RemoteLaser[] = []
const NO_NOTES: NoteEntry[] = []
const NO_CLUES: ClueEntry[] = []
const NO_DICE_ROLLS: DiceRollEntry[] = []
const NO_PINS: Pin[] = []
const NO_PLACES: VisitedPlace[] = []
/** Fechar o recado não perde nada: quem fecha sabe onde reler. */
const NOTE_KEPT_HINT = 'Fica guardado no Caderno do Painel.'
/** MAPA POR ANDARES: outro andar não tem visão agora — só a memória. */
const NO_VISION: RegionPoint[][] = []
/** Outro andar é só para olhar: arrastar ficha lá não pede nada ao mestre. */
const IGNORE_MOVE = (): void => {}
const AWAY_KEPT_HINT = 'Ficam guardados no Caderno do Painel.'

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

/**
 * Onde mora o resume do mestre: no APARELHO (`localStorage`), e não na aba.
 * Na aba, reabrir o QR numa aba nova (o celular descartou a velha, o link veio
 * de novo pelo grupo) não achava o resume e a Ana virava "Ana (2)", sem ficha
 * e sem o explorado. Lê também o da aba (`sessionStorage`), onde a versão
 * anterior guardava: quem atualiza o app no meio da mesa não perde a volta.
 * Gravar leva para o aparelho; apagar apaga dos dois. Qualquer acesso pode
 * lançar (site bloqueado) — quem chama já trata.
 */
function resumeStorageOrNull(): StorageLike | null {
  const device = localStorageOrNull()
  const tab = sessionStorageOrNull()
  if (device === null) return tab
  return {
    // Aba sem storage de sessão é caso legítimo (bloqueado): só não há o que ler lá.
    getItem: (key) => device.getItem(key) ?? tab?.getItem(key) ?? null,
    setItem: (key, value) => {
      device.setItem(key, value)
      tab?.removeItem(key)
    },
    removeItem: (key) => {
      device.removeItem(key)
      tab?.removeItem(key)
    },
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
 * Este APARELHO tem uma sessão viva nesta sala para retomar?
 *
 * O `playerConnection` guarda o resume do mestre ao entrar
 * (`RESUME_STORAGE_KEY`, em `resumeStorageOrNull`) e o apaga sozinho quando a
 * sala acaba (expulso, sala encerrada, código recusado). Ele sobrevive a
 * recarregar a página e a abrir o QR numa aba nova — que é exatamente o caso
 * desta volta: o celular descarta a aba ao trocar de app, o dedo esbarra em
 * Atualizar, e o amigo caía no formulário para digitar código e nome outra
 * vez no meio da mesa (e, pior, entrava como "Ana (2)").
 *
 * Só lê o formato que `playerConnection.writeResume` escreve; qualquer outra
 * coisa (storage bloqueado, JSON de outra versão, sala diferente) vale como
 * "não dá para retomar" e o formulário aparece como antes.
 */
function hasResumeFor(code: string): boolean {
  if (code.length !== JOIN_CODE_LENGTH) return false
  const storage = resumeStorageOrNull()
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
 * abertura voltaria sozinha para a sala de onde ele acabou de sair.
 * Sair não desfaz o `lastJoin` — o formulário continua preenchido para entrar
 * de novo com um toque.
 */
function forgetResume(): void {
  const storage = resumeStorageOrNull()
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
  /** Fichas livres que o mestre oferece (vazio = nenhuma) e o pedido de uma delas. */
  seatOptions: readonly SeatOption[]
  seatClaim: SeatClaimNotice | undefined
  onClaimSeat: (tokenId: string) => void
  onRename: () => void
  onLeave: () => void
}

const NO_SEAT_OPTIONS: readonly SeatOption[] = []

/**
 * Tela de espera. Dois passeios cegos travaram aqui por 2 min 45 s e 15 min
 * diante de uma frase solta: nada dizia quem ele era, em que sala estava, se a
 * conexão vivia, nem dava o que fazer. Agora diz as três coisas e tem saída.
 */
function WaitingScreen({ code, typedName, hostName, seatOptions, seatClaim, onClaimSeat, onRename, onLeave }: WaitingScreenProps) {
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
      <SeatPicker options={seatOptions} claim={seatClaim} onClaim={onClaimSeat} />
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
 * Menu do toque longo aberto (AÇÕES NO PONTO, com o ANDAR ATÉ AQUI dentro):
 * o ponto (`x`/`y`, px de mundo), onde o dedo estava (`screenX`/`screenY`,
 * px da janela), a época da cena em que abriu (`sceneEpoch`) e quem anda
 * (`tokenId`, a primeira ficha dele na cena; `null` = nenhuma, e o menu vem
 * sem "Andar até aqui"). O caminho NÃO fica guardado aqui: sai de onde a
 * ficha está a cada momento (`pointMenuLegs`).
 */
interface PointMenuState {
  x: number
  y: number
  screenX: number
  screenY: number
  sceneEpoch: number
  tokenId: string | null
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

// Exportada só para o teste montar a sessão sem o formulário de entrada.
export function Session({ connection, code, typedName, hostName, onLeave, onQuit }: SessionProps) {
  const state: PlayerState = useSyncExternalStore(connection.subscribe, connection.getState)
  const [settings, setSettings] = useState<PlayerViewSettings>(() => loadPlayerSettings(localStorageOrNull()))
  const [focus, setFocus] = useState<{ tokenId: string | null; seq: number }>({ tokenId: null, seq: 0 })
  /** LUGARES: os nomes que o jogador deu, por lugar. Só nesta tela (nunca vão ao mestre). */
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({})
  const playerId = state.playerId
  useEffect(() => {
    // Por jogador: o id de lugar é um contador do host, e outra sala recomeçaria do "l1".
    setPlaceNames(playerId === undefined ? {} : loadPlaceNames(localStorageOrNull(), playerId))
  }, [playerId])
  const renamePlace = useCallback(
    (placeId: string, name: string) => {
      if (playerId === undefined) return
      // O estado manda na tela; o armazenamento é só persistência. Reler dele
      // perderia o nome quando ele está cheio ou bloqueado.
      setPlaceNames((names) => withPlaceName(names, placeId, name))
      savePlaceName(localStorageOrNull(), playerId, placeId, name)
    },
    [playerId],
  )
  const [signalArmed, setSignalArmed] = useState(false)
  /** "Marcar destino" ligado: o próximo toque no mapa põe a marca "vamos para cá". */
  const [destinationArmed, setDestinationArmed] = useState(false)
  /** Régua do jogador ligada. Só o liga/desliga mora aqui; a medida em si é do PlayerView (local ao gesto). */
  const [measureArmed, setMeasureArmed] = useState(false)
  /** Laser do jogador ligado. O rastro em si é do PlayerView (local ao gesto) e do socket. */
  const [laserArmed, setLaserArmed] = useState(false)
  /** Pino aberto no cartão; `null` = cartão fechado. */
  const [openPinId, setOpenPinId] = useState<string | null>(null)
  /** Pista do Caderno aberta no cartão (MINHAS PISTAS); `null` = fechado. */
  const [openClueId, setOpenClueId] = useState<string | null>(null)
  /** BILHETE NO LUGAR: bilhete aberto no cartão; `null` = fechado. */
  const [openMarkId, setOpenMarkId] = useState<string | null>(null)
  /** Menu do toque longo (ações no ponto e "Andar até aqui"); `null` = fechado. */
  const [pointMenu, setPointMenu] = useState<PointMenuState | null>(null)
  const closePointMenu = useCallback(() => setPointMenu(null), [])
  /**
   * ANOTAÇÕES PESSOAIS de todas as cenas, lidas do aparelho ao entrar. Nunca
   * vão pelo socket: nem o mestre nem os colegas sabem delas.
   */
  const [personalNotes, setPersonalNotes] = useState<readonly PersonalNote[]>(() => loadPersonalNotes(localStorageOrNull()))
  /** "Anotar" ligado: o próximo toque no mapa marca onde vai a nota. */
  const [noteArmed, setNoteArmed] = useState(false)
  /** Ponto já tocado, esperando o texto no cartão; `null` = cartão fechado. */
  const [noteDraft, setNoteDraft] = useState<{ mapId: string; x: number; y: number } | null>(null)
  /**
   * Pedido de câmera para um PONTO: uma nota de "Minhas notas" ou um ponto conhecido da aba Lugares.
   * Um só estado para os dois: a PlayerView tem um `focusPoint` só, e o `seq` que cresce junto garante
   * que o toque mais novo, de qualquer um dos dois, é o que move a câmera.
   */
  const [pointFocus, setPointFocus] = useState<FocusPointRequest | null>(null)
  const focusOnPoint = useCallback((x: number, y: number) => {
    setPointFocus((current) => ({ x, y, seq: (current?.seq ?? 0) + 1 }))
  }, [])
  const changePersonalNotes = useCallback((change: (notes: readonly PersonalNote[]) => readonly PersonalNote[]) => {
    setPersonalNotes((current) => {
      const next = change(current)
      if (next !== current) savePersonalNotes(localStorageOrNull(), next)
      return next
    })
  }, [])
  const removeNote = useCallback((noteId: string) => changePersonalNotes((notes) => removePersonalNote(notes, noteId)), [changePersonalNotes])
  const cancelNoteDraft = useCallback(() => setNoteDraft(null), [])
  // Outra cena: o ponto e o caminho do menu eram do mapa de antes (e o ponto da nota por escrever também).
  const sceneMapId = state.map?.id
  useEffect(() => {
    setPointMenu(null)
    setNoteDraft(null)
  }, [sceneMapId])
  // Referência estável por cena: a camada do mapa não recebe lista nova a cada snapshot.
  const sceneNotes = useMemo(() => (sceneMapId === undefined ? [] : notesOnMap(personalNotes, sceneMapId)), [personalNotes, sceneMapId])
  /**
   * Trechos até o ponto do menu a partir de onde a ficha ESTÁ agora, só com o
   * que esta tela conhece; `null` = não conhece o caminho. Recalculados a cada
   * mudança do mapa: a caminhada anterior segue com o menu aberto, e um
   * caminho gravado na abertura sairia da esquina de antes — o host recusaria
   * o primeiro trecho com 'wall'.
   */
  const pointMenuLegs = useMemo(() => {
    const map = state.map
    if (pointMenu === null || pointMenu.tokenId === null || map === undefined || state.vision === undefined) return null
    const walker = map.tokens.find((t) => t.id === pointMenu.tokenId)
    if (walker === undefined) return null
    return findKnownPath(map, walker, { x: pointMenu.x, y: pointMenu.y }, { explored: state.explored, vision: state.vision, concealed: state.concealed ?? [] })
  }, [pointMenu, state.map, state.explored, state.vision, state.concealed])
  /** Ficha ALHEIA aberta no cartão de ações; `null` = fechado. */
  const [openTokenId, setOpenTokenId] = useState<string | null>(null)
  /** Último toque nos botões + e − (o `PlayerView` aplica o degrau) e o que eles ainda podem fazer. */
  const [zoomStep, setZoomStep] = useState<ZoomStepRequest>(NO_ZOOM_STEP)
  const [zoomLimits, setZoomLimits] = useState<ZoomLimits>({ canZoomIn: true, canZoomOut: true })
  const requestZoomStep = useCallback((direction: ZoomDirection, animate: boolean) => {
    setZoomStep((current) => ({ direction, animate, seq: current.seq + 1 }))
  }, [])
  /** MAPA POR ANDARES: a aba escolhida; `null` = o andar onde ele está (o mapa ao vivo). */
  const [floorTab, setFloorTab] = useState<string | null>(null)
  const currentFloor = state.andares?.atual
  // Mudou de andar (ou saiu do prédio): a tela volta ao mapa ao vivo, onde a ficha dele está.
  useEffect(() => setFloorTab(null), [currentFloor])
  /** Cada "Reconectar" conta uma tentativa nova e reinicia o prazo do aperto de mão. */
  const [attempt, setAttempt] = useState(0)
  const [handshakeOverdue, setHandshakeOverdue] = useState(false)
  const connecting = state.status === 'connecting'
  // TELA NÃO APAGA: dentro da sala (esperando o mestre ou jogando) o celular
  // não apaga a tela; expulso, sala encerrada, erro ou fora da sessão, solta.
  const screenAwake = useScreenWakeLock(state.status === 'waiting' || state.status === 'playing')

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

  // A rede voltou ou a tela acendeu (celular desbloqueado): se a conexão
  // caiu, tenta já — sem esperar a espera crescente da reconexão automática.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') connection.wake()
    }
    const onOnline = () => connection.wake()
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [connection])

  // Escape apaga a medida e desliga o modo. Só escuta com o modo ligado, e
  // nunca dentro de campo de texto (lá o Escape é da edição).
  useEffect(() => {
    if (!measureArmed && !laserArmed && !destinationArmed && !noteArmed) return
    const onKey = (event: KeyboardEvent) => {
      if (!escapeDisarmsMeasure(event.key, event.target)) return
      // Os modos não ficam ligados juntos: o Escape desliga o que estiver.
      setMeasureArmed(false)
      setLaserArmed(false)
      setDestinationArmed(false)
      setNoteArmed(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [measureArmed, laserArmed, destinationArmed, noteArmed])

  const ownTokens = state.ownTokens ?? NO_TOKENS
  // ENCONTRO MARCADO: a marca "esperando". Mesma referência estável dos tokens: sem ninguém esperando, nada a redesenhar.
  const waitingTokens = state.waitingTokens ?? NO_TOKENS
  const map = state.map

  // ATALHO NA MESMA CENA: o mapa não mudou, então a câmera não reenquadra
  // sozinha. Cada chegada assim centra a ficha que atravessou (não a primeira
  // dele: com duas fichas, o host diz qual foi), pelo mesmo caminho do
  // "Minha ficha" (o pulso mostra onde ela foi parar). Um objeto novo por
  // chegada: a ficha andando depois não move a câmera.
  const arrivalFocus = state.arrivalFocus
  useEffect(() => {
    const arrivedTokenId = arrivalFocus?.tokenId ?? null
    if (arrivedTokenId === null) return
    setFocus((current) => ({ tokenId: arrivedTokenId, seq: current.seq + 1 }))
  }, [arrivalFocus])

  const characters = useMemo(() => {
    if (!map) return []
    const byId = new Map(map.tokens.map((t) => [t.id, t]))
    return ownTokens.flatMap((id) => {
      const token = byId.get(id)
      return token ? [{ id, name: token.name }] : []
    })
  }, [map, ownTokens])
  const partyTokens = state.partyTokens ?? NO_TOKENS
  // ITEM PEGÁVEL: "Comigo" é a mochila das fichas dele; "Dar a…" oferece só
  // fichas de COLEGAS encostadas numa delas — NPC do mestre o host recusaria.
  const backpack = useMemo(() => {
    if (!map) return { items: [], colleagues: [] }
    return {
      items: map.tokens.filter((t) => ownTokens.includes(t.id)).flatMap(carriedItemsOf),
      colleagues: giveTargets(map, ownTokens, partyTokens),
    }
  }, [map, ownTokens, partyTokens])

  // A cor do próprio laser: a da ficha (a mesma que os outros veem, escolhida
  // pelo host); ficha sem cor, o azul "este é o seu" da tela do jogador.
  const ownLaserColor = useMemo(() => {
    const owned = new Set(ownTokens)
    const token = map?.tokens.find((t) => owned.has(t.id) && selectedTokenColor(t) !== null)
    return (token === undefined ? null : selectedTokenColor(token)) ?? OWN_TOKEN_CSS
  }, [map, ownTokens])

  // FAIXA "ONDE ESTOU": o caminho da Sala da ficha em foco, lido do mapa que
  // já chegou (o recorte decide o que ela pode dizer). Recalcula a cada
  // snapshot, não a cada quadro do arrasto: o arrasto é local ao `PlayerView`.
  const where = useMemo(() => (map ? whereAmI(map, ownTokens, focus.tokenId) : null), [map, ownTokens, focus.tokenId])
  const focusToken = useCallback((tokenId: string) => setFocus((current) => ({ tokenId, seq: current.seq + 1 })), [])

  function changeSettings(next: PlayerViewSettings) {
    setSettings(next)
    savePlayerSettings(localStorageOrNull(), next)
  }

  const openPin = openPinId === null ? null : (map?.pins ?? []).find((p) => p.id === openPinId) ?? null
  // Estável: o cartão devolve o foco ao "Fechar" sempre que `onClose` muda, e
  // um snapshot novo a cada passo do mapa tiraria o foco do "Pedir" no meio da pergunta.
  // Fechar o cartão esquece a resposta da fechadura: reabrir começa limpo.
  const closePin = useCallback(() => {
    setOpenPinId(null)
    connection.resetLockAnswer()
  }, [connection])
  // Estável pelo mesmo motivo: o cartão do recado religa o Escape quando `onClose` muda.
  const closeNote = useCallback(() => connection.dismissNote(), [connection])
  const closeRoomText = useCallback(() => connection.dismissRoomText(), [connection])
  const closeAwayNotes = useCallback(() => connection.dismissAwayNotes(), [connection])
  const awayNotes = state.awayNotes ?? NO_NOTES
  const closeActionReply = useCallback(() => connection.dismissTokenAction(), [connection])
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
  const closeMark = useCallback(() => setOpenMarkId(null), [])
  const askCluePeers = useCallback(() => connection.askCluePeers(), [connection])
  const startWait = useCallback((minutes: number, who: string, where: string) => connection.startWait(minutes, who, where), [connection])
  const stopWait = useCallback(() => connection.stopWait(), [connection])
  const closeWaitEnded = useCallback(() => connection.dismissWaitEnded(), [connection])
  /** Painel e barra do jogador: a câmera lê, na hora, o que eles cobrem do mapa. */
  const panelRef = useRef<HTMLElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const mapObstacles = useCallback(() => coverBounds(panelRef.current, barRef.current), [])
  // Trocou a cena ou saiu do jogo desde o toque longo: o ponto do menu é de
  // outro mapa, e o menu fecha em vez de pedir no lugar errado.
  const openPointMenu = pointMenu !== null && pointMenu.sceneEpoch === state.sceneEpoch ? pointMenu : null

  // Queda com volta automática: a tela de baixo fica (esmaecida), o véu por cima.
  const reconnecting = state.reconnecting && <ReconnectingOverlay info={state.reconnecting} onRetry={() => connection.retryNow()} />
  const closeArrival = useCallback(() => connection.dismissArrival(), [connection])

  if (state.status === 'playing' && state.map && state.vision) {
    const actionNotice = latestActionNotice(state.doorNotice, state.moveNotice)
    // O aviso mais novo é o do movimento (o `id` dos dois sai do mesmo contador).
    const moveNoticeShown = actionNotice !== null && state.moveNotice?.id === actionNotice.id
    // ANDAR ATÉ AQUI: quem anda é a primeira ficha dele nesta cena. Sem nenhuma,
    // não há quem ande, e o menu do toque longo vem sem o item.
    const playingMap = state.map
    const walkerId = ownTokens.flatMap((id) => playingMap.tokens.filter((t) => t.id === id)).at(0)?.id ?? null
    // Cartão de pista na tela: o Escape é dele, e um toque não pode fechar também o recado.
    const clueCardOpen = openClue !== null || (state.shownClue !== undefined && openPin === null)
    // Cartão do pino ou da ficha aberto: o Escape é dele, e não fecha junto os cartões de baixo.
    const noCardOnTop = openPin === null && openToken === null
    // Resposta do mestre com texto: vira cartão, no lugar do aviso curto.
    const actionReply = state.tokenAction === undefined ? null : tokenActionReply(state.tokenAction)
    // Outro andar: a memória dele de lá, sem visão, sem ficha e sem toque que peça algo ao mestre.
    const otherFloor = floorTab === null ? null : floorShown(state.andares, floorTab)
    return (
      <PlayerErrorBoundary onReconnect={() => connection.reconnect()}>
        {otherFloor !== null ? (
          <PlayerView
            map={otherFloor.map}
            vision={NO_VISION}
            explored={otherFloor.explored}
            concealed={otherFloor.concealed}
            ownTokens={NO_TOKENS}
            settings={settings}
            focusTokenId={null}
            focusSeq={focus.seq}
            onMove={IGNORE_MOVE}
            measureArmed={measureArmed}
          />
        ) : (
          <PlayerView
            map={state.map}
            vision={state.vision}
            explored={state.explored}
            concealed={state.concealed}
            peek={state.peek}
            glimpses={state.glimpses}
            hazards={state.hazards}
            gatilhos={state.gatilhos}
            ownTokens={ownTokens}
            waitingTokens={waitingTokens}
            turnTokenId={state.turn ?? null}
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
            onLongPress={(x, y, screenX, screenY) => {
              // O mestre vê o ponto já no gesto (e o jogador, o eco). Os colegas
              // só se ele escolher Sinalizar: Espiar e Revistar ficam discretos.
              connection.sendSignal(x, y, 'master')
              // A câmera arrasta além da borda: fora do mapa não há o que procurar.
              if (map !== undefined && isPointInsideMap(map, x, y)) setPointMenu({ x, y, screenX, screenY, sceneEpoch: state.sceneEpoch, tokenId: walkerId })
            }}
            onMapPointerDown={closePointMenu}
            destinations={state.destinations ?? NO_DESTINATIONS}
            destinationArmed={destinationArmed}
            onDestination={(x, y) => {
              connection.markDestination(x, y)
              // Modo de um toque, como o Sinalizar: marcou, desliga.
              setDestinationArmed(false)
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
            onMarkOpen={setOpenMarkId}
            focusObstacles={mapObstacles}
            personalNotes={sceneNotes}
            onNoteLongPress={removeNote}
            noteArmed={noteArmed}
            onNotePlace={(x, y) => {
              // Modo de um toque, como o Marcar destino: marcou o ponto, desliga e pede o texto. Nada vai ao mestre.
              setNoteArmed(false)
              setNoteDraft({ mapId: playingMap.id, x, y })
            }}
            focusPoint={pointFocus}
            zoomStep={zoomStep}
            onZoomLimitsChange={setZoomLimits}
          />
        )}
        {state.andares && <PlayerFloorTabs andares={state.andares} selected={floorTab ?? state.andares.atual} onSelect={setFloorTab} />}
        <PlayerPanel
          panelRef={panelRef}
          barRef={barRef}
          characters={characters}
          characterColor={OWN_TOKEN_CSS}
          settings={settings}
          onSettingsChange={changeSettings}
          onFocusToken={focusToken}
          onFocusPoint={(point) => focusOnPoint(point.x, point.y)}
          pins={state.map.pins ?? NO_PINS}
          places={state.places ?? NO_PLACES}
          currentPlace={state.place}
          placeNames={placeNames}
          onRenamePlace={renamePlace}
          signalArmed={signalArmed}
          onToggleSignal={() => {
            // Sinalizar, Medir e Laser disputam o mesmo toque no mapa: ligar um desliga os outros.
            setSignalArmed((armed) => !armed)
            setMeasureArmed(false)
            setLaserArmed(false)
            setDestinationArmed(false)
            setNoteArmed(false)
          }}
          measureArmed={measureArmed}
          onToggleMeasure={() => {
            setMeasureArmed((armed) => !armed)
            setSignalArmed(false)
            setLaserArmed(false)
            setDestinationArmed(false)
            setNoteArmed(false)
          }}
          laserArmed={laserArmed}
          onToggleLaser={() => {
            setLaserArmed((armed) => !armed)
            setSignalArmed(false)
            setMeasureArmed(false)
            setDestinationArmed(false)
            setNoteArmed(false)
          }}
          destinationArmed={destinationArmed}
          onToggleDestination={() => {
            setDestinationArmed((armed) => !armed)
            setSignalArmed(false)
            setMeasureArmed(false)
            setLaserArmed(false)
            setNoteArmed(false)
          }}
          party={state.party}
          noteArmed={noteArmed}
          onToggleNote={() => {
            setNoteArmed((armed) => !armed)
            setSignalArmed(false)
            setMeasureArmed(false)
            setLaserArmed(false)
            setDestinationArmed(false)
          }}
          personalNotes={sceneNotes}
          onFocusNote={(noteId) => {
            const note = sceneNotes.find((n) => n.id === noteId)
            if (note !== undefined) focusOnPoint(note.x, note.y)
          }}
          onRemoveNote={removeNote}
          hasDestination={(state.destinations ?? NO_DESTINATIONS).some((mark) => mark.mine)}
          onClearDestination={() => connection.clearDestination()}
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
          backpack={{ ...backpack, onGive: (itemId, toTokenId) => void connection.giveItem(itemId, toTokenId) }}
          onRollDice={(request) => connection.rollDice(request)}
          elsewhere={state.elsewhere}
          // A câmera da cena nova é a da chegada (`PlayerView`, mapa novo): a mesma da viagem.
          onSwitchView={(tokenId) => connection.switchView(tokenId)}
          mapShare={{
            peers: state.mapPeers,
            result: state.mapShare,
            onAskPeers: () => connection.askMapPeers(),
            onShare: (name) => connection.shareMap(name),
            onClose: () => connection.resetMapShare(),
          }}
          markForm={{
            result: state.markPlace,
            onPlace: (intent) => connection.placeMark(intent),
            onClose: () => connection.resetMarkPlace(),
          }}
          wait={state.wait}
          onStartWait={startWait}
          onStopWait={stopWait}
        />
        {/* DADO ROLADO NA SALA: as últimas rolagens da mesa, sobre o mapa, acima do zoom. Não é controle: fora da ordem do Tab. */}
        <DiceFeed rolls={state.diceRolls ?? NO_DICE_ROLLS} className="pp-dice-feed" />
        {/* "Onde estou": só com nome público na cena; não é controle, fica fora da ordem do Tab. */}
        <PlayerSceneName name={state.sceneName} />
        <PlayerScreenAwake active={screenAwake} />
        {/* Depois do painel no DOM: o Tab segue a leitura (painel no alto à esquerda, faixa no alto à direita, zoom embaixo à direita). */}
        <PlayerWhereAmI where={where} showTokenName={ownTokens.length > 1} onFocus={focusToken} />
        <PlayerZoomControls canZoomIn={zoomLimits.canZoomIn} canZoomOut={zoomLimits.canZoomOut} onZoom={requestZoomStep} />
        <PlayerTurnBanner turn={state.turn} ownTokens={ownTokens} tokens={state.map.tokens} />
        {noteDraft && (
          <PersonalNoteDraft
            onSave={(text) => {
              const { mapId, x, y } = noteDraft
              changePersonalNotes((notes) => addPersonalNote(notes, { id: newPersonalNoteId(), mapId, x, y, text }))
              setNoteDraft(null)
            }}
            onCancel={cancelNoteDraft}
          />
        )}
        <PlayerClockBadge relogio={state.relogio} />
        {/* O pino pode sumir do recorte enquanto o cartão está aberto (o token
            andou, o mestre escondeu): sem pino no mapa novo, o cartão fecha
            sozinho em vez de mostrar um texto que o jogador não pode mais ver. */}
        {openPin && (
          <PlayerPinCard
            pin={openPin}
            stairs={state.map.stairs}
            onClose={closePin}
            onRead={(pinId) => connection.markPinRead(pinId)}
            travelWaiting={state.travel?.phase === 'waiting'}
            onRequestTravel={(exitId) => {
              // Pedido enviado, o cartão sai: a espera fica no aviso de baixo,
              // e o mapa volta inteiro à vista enquanto o mestre decide.
              if (connection.requestTravel(openPin.id, exitId)) setOpenPinId(null)
            }}
            takeWaiting={state.item?.phase === 'sent' && !state.item.direct}
            onTakeItem={() => {
              // Mesma regra do pedido de passagem: enviado, o cartão sai e a espera fica no aviso.
              if (connection.takePin(openPin.id)) setOpenPinId(null)
            }}
            onPullLever={() => {
              // Puxou, o cartão sai: o mapa volta inteiro à vista para o jogador ver a porta mexer.
              if (connection.pullLever(openPin.id)) setOpenPinId(null)
            }}
            // FECHADURA COM SEGREDO: o cartão fica aberto; a resposta do host aparece nele.
            onTryLock={(tentativa) => connection.answerLock(openPin.id, tentativa)}
            lockPhase={state.lockAnswer?.pinId === openPin.id ? state.lockAnswer.phase : undefined}
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
        {state.lever && (
          <p key={state.lever.id} className="pp-notice" role="status" aria-live="polite">
            {leverNoticeText(state.lever.phase)}
          </p>
        )}
        {state.item && (
          <p key={state.item.id} className="pp-notice" role="status" aria-live="polite">
            {itemNoticeText(state.item)}
          </p>
        )}
        {state.alarm && (
          // `key` no id: alarme novo remonta a faixa (anima, anuncia e vibra de novo).
          <PlayerAlarmBanner key={state.alarm.id} text={state.alarm.text} vibrationTarget={typeof navigator === 'undefined' ? undefined : navigator} />
        )}
        {state.arrival ? (
          // TEXTO DE CHEGADA: o mesmo cartão, no mesmo lugar do recado. Os
          // outros esperam, guardados, até este fechar.
          <PlayerNoteCard
            key={`chegada-${state.arrival.id}`}
            title={ARRIVAL_CARD_TITLE}
            text={state.arrival.text}
            onClose={closeArrival}
            escapeCloses={noCardOnTop && !clueCardOpen}
          />
        ) : awayNotes.length > 0 ? (
          // ENQUANTO VOCÊ ESTEVE FORA: os recados que chegaram com ele fora do
          // ar, em ordem. O recado e o texto da Sala esperam ele fechar, um
          // cartão de cada vez no mesmo lugar.
          <PlayerNoteCard
            title={`Enquanto você esteve fora (${awayNotes.length})`}
            hint={AWAY_KEPT_HINT}
            onClose={closeAwayNotes}
            escapeCloses={noCardOnTop && !clueCardOpen}
          >
            <ol className="pp-notebook">
              {awayNotes.map((note) => (
                <li key={note.id} className="pp-notebook__item">
                  <span className="pp-notebook__meta">{formatNoteTime(note.at)} · Mestre:</span> {note.text}
                </li>
              ))}
            </ol>
          </PlayerNoteCard>
        ) : (
          state.note && (
            // `key` no id: recado novo com outro aberto remonta o cartão (e a entrada anima de novo).
            // ABALO: o mesmo cartão, com a seta e a vibração de quem está na cena da origem.
            <PlayerNoteCard
              key={state.note.id}
              text={state.note.text}
              hint={NOTE_KEPT_HINT}
              onClose={closeNote}
              escapeCloses={noCardOnTop && !clueCardOpen}
              onlyYou={state.note.onlyYou === true}
              seta={state.note.seta}
              forte={state.note.forte === true}
            />
          )
        )}
        {/* AGIR SOBRE UMA FICHA: a resposta do mestre em TEXTO (o que o NPC
            responde), só a quem pediu. O mesmo cartão do recado, e a mesma
            fila: espera a chegada, os recados de fora e o recado fecharem, e o
            texto da sala espera por ela. */}
        {actionReply !== null && state.tokenAction && !state.note && !state.arrival && awayNotes.length === 0 && (
          <PlayerNoteCard
            key={state.tokenAction.id}
            title={tokenActionNoticeText(state.tokenAction)}
            text={actionReply}
            onClose={closeActionReply}
            escapeCloses={noCardOnTop && !clueCardOpen}
          />
        )}
        {/* TEXTO DA SALA: o mesmo cartão, com o nome da Sala no alto. Um
            cartão de cada vez no mesmo lugar: com recado aberto, o texto da
            sala espera o recado fechar em vez de ficar por baixo dele. */}
        {state.roomText && !state.note && !state.arrival && awayNotes.length === 0 && actionReply === null && (
          <PlayerNoteCard
            key={state.roomText.id}
            title={state.roomText.title || 'Ao entrar'}
            text={state.roomText.text}
            onClose={closeRoomText}
            escapeCloses={noCardOnTop && !clueCardOpen}
          />
        )}
        {state.paused && (
          // Fixo enquanto durar a pausa: é o que explica por que a ficha volta ao lugar.
          <p className="pp-notice pp-notice--pause" role="status" aria-live="polite">
            O mestre está com o outro grupo
          </p>
        )}
        <PlayerCallButton call={state.call} onRaise={(reason, text) => connection.raiseHand(reason, text)} onLower={() => connection.lowerHand()} />
        {state.secretCheck && (
          // `key` no id: pedido novo com outro aberto começa com o campo vazio.
          <PlayerSecretCheckCard key={state.secretCheck.id} label={state.secretCheck.label} onAnswer={(result) => connection.answerSecretCheck(result)} />
        )}
        {state.secretCheckNotice && !state.secretCheck && (
          // No lugar do cartão que acabou de fechar; um pedido novo toma o lugar do aviso.
          <p key={state.secretCheckNotice.id} className="pp-notice pp-notice--secret" role="status" aria-live="polite">
            {SECRET_CHECK_NOTICE_TEXT[state.secretCheckNotice.kind]}
          </p>
        )}
        {state.noise && (
          // `key` no id: ruído novo remonta o aviso, e a entrada e o prazo da saída recomeçam.
          <PlayerNoiseCue key={state.noise.id} dir={state.noise.dir} />
        )}
        {/* BILHETE NO LUGAR: o bilhete tocado no mapa, no mesmo cartão do recado.
            Espera chegada, recados de fora, recado e texto de Sala fecharem: um cartão de cada vez no mesmo lugar. */}
        <PlayerMarkCard
          marcas={state.map.marcas}
          openMarkId={openMarkId}
          aguardando={Boolean(state.arrival) || awayNotes.length > 0 || Boolean(state.note) || actionReply !== null || Boolean(state.roomText)}
          onClose={closeMark}
          escapeCloses={noCardOnTop && !clueCardOpen}
        />
        {state.travel && (
          <p key={state.travel.id} className="pp-notice pp-notice--travel" role="status" aria-live="polite">
            {travelNoticeText(state.travel)}
            {/* DESISTIR: só quem espera o MESTRE (o pino livre não espera ninguém). */}
            {state.travel.phase === 'waiting' && !state.travel.direct && (
              <button type="button" className="pp-notice__action" disabled={state.travel.cancelling === true} onClick={() => connection.cancelTravel()}>
                {state.travel.cancelling === true ? 'Desistindo…' : 'Desistir'}
              </button>
            )}
          </p>
        )}
        {openPointMenu && (
          <PointActionMenu
            screenX={openPointMenu.screenX}
            screenY={openPointMenu.screenY}
            onSignal={() => {
              // O mesmo ponto do gesto: o host estende aos colegas o sinal que só o mestre viu.
              connection.sendSignal(openPointMenu.x, openPointMenu.y)
              setPointMenu(null)
            }}
            onChoose={(action) => {
              connection.sendPointAction(action, openPointMenu.x, openPointMenu.y)
              setPointMenu(null)
            }}
            walk={
              openPointMenu.tokenId === null
                ? undefined
                : {
                    canWalk: pointMenuLegs !== null,
                    onWalk: () => {
                      // Cada trecho vai ao mestre como um movimento comum, validado lá; a recusa aparece no aviso de baixo.
                      if (pointMenuLegs !== null && openPointMenu.tokenId !== null) connection.requestWalk(openPointMenu.tokenId, pointMenuLegs)
                      setPointMenu(null)
                    },
                  }
            }
            onClose={closePointMenu}
          />
        )}
        {state.pointNotice && (
          <p key={state.pointNotice.id} className="pp-notice pp-notice--point" role="status" aria-live="polite">
            {pointNoticeText(state.pointNotice)}
          </p>
        )}
        {/* Porta e movimento avisam no mesmo lugar: vale o mais novo (`latestActionNotice`).
            A porta "Trancada" traz os botões do pedido (Bater, Forçar, Usar chave). */}
        {state.doorNotice && !moveNoticeShown && (
          <PlayerDoorNotice
            key={state.doorNotice.id}
            notice={state.doorNotice}
            onRequest={(wallId, how) => connection.requestDoor(wallId, how)}
            onUseKey={(wallId) => connection.useDoorKey(wallId)}
            onClose={() => connection.dismissDoorNotice()}
          />
        )}
        {state.doorRequest && (
          <p key={state.doorRequest.id} className="pp-notice" role="status" aria-live="polite">
            {doorRequestText(state.doorRequest.phase)}
          </p>
        )}
        <PeekDoorButton map={state.map} ownTokens={ownTokens} onPeek={(wallId) => connection.peekDoor(wallId)} />
        {state.tokenAction && actionReply === null && (
          <p key={state.tokenAction.id} className="pp-notice pp-notice--action" role="status" aria-live="polite">
            {tokenActionNoticeText(state.tokenAction)}
          </p>
        )}
        {actionNotice && moveNoticeShown && (
          // `key` no id: o mesmo aviso repetido reinicia a animação de entrada.
          <p key={actionNotice.id} className="pp-notice" role="status" aria-live="polite">
            {actionNotice.text}
          </p>
        )}
        {/* Mesmo lugar do aviso de ação: com uma recusa na tela, ela vale mais (é do gesto de agora). */}
        {state.mapShared && !actionNotice && (
          <p key={state.mapShared.id} className="pp-notice" role="status" aria-live="polite">
            {mapSharedNoticeText(state.mapShared.from)}
          </p>
        )}
        <TurnWaitNotice notice={state.turnNotice} />
        {state.hazardNotice && (
          // ZONA DE PERIGO: "Você entrou no fogo!". `key` no id reanuncia a cada entrada.
          <p key={state.hazardNotice.id} className="pp-notice" role="alert">
            {hazardNoticeText(state.hazardNotice.kind)}
          </p>
        )}
        {/* ENCONTRO MARCADO: "Bia chegou" / "O prazo acabou". Quem espera costuma olhar a mesa: fica até fechar ou 1 min. */}
        {state.waitEnded && (
          <div key={state.waitEnded.id} className="pp-notice pp-notice--wait" role="status" aria-live="polite">
            <span>{textoDoFimDaEspera(state.waitEnded.end)}</span>
            <button type="button" className="pp-notice__close" onClick={closeWaitEnded}>
              Fechar
            </button>
          </div>
        )}
        {reconnecting}
      </PlayerErrorBoundary>
    )
  }

  // `playing` sem mapa é o intervalo entre o resume e o primeiro snapshot: mesma espera.
  if (state.status === 'waiting' || state.status === 'playing') {
    return (
      <>
        {reconnecting}
        <WaitingScreen
          code={code}
          typedName={typedName}
          hostName={hostName}
          seatOptions={state.seatOptions ?? NO_SEAT_OPTIONS}
          seatClaim={state.seatClaim}
          onClaimSeat={(tokenId) => connection.claimSeat(tokenId)}
          // Trocar de nome NÃO esquece o resume: o mestre reaproveita o mesmo
          // registro e só troca o nome, sem virar um segundo jogador na lista.
          onRename={() => onLeave({ text: 'Escolha outro nome e entre de novo.', tone: 'info' })}
          onLeave={onQuit}
        />
        <PlayerScreenAwake active={screenAwake} />
      </>
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
    case 'replaced':
      // A mesma pessoa, noutra aba: a mesa segue lá. "Usar aqui" traz a
      // sessão para esta aba (e a outra recebe este mesmo aviso). Sair não
      // esquece o resume: ele é o da outra aba também.
      message = 'Você abriu a sala em outra aba ou aparelho.'
      detail = <p className="pe-hint">Sua ficha e o que você já explorou continuam lá. Para jogar por esta tela, toque em Usar aqui.</p>
      actions.push({ label: 'Usar aqui', primary: true, run: () => connection.reconnect() })
      actions.push({ label: 'Sair', run: () => onLeave() })
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

  // Recarregou a página (ou abriu o QR numa aba nova) com a sessão deste
  // aparelho ainda viva: volta direto para a sala, sem passar pelo formulário
  // e como a mesma pessoa. `join` é declaração de função (içada).
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
      storage: resumeStorageOrNull(),
      isHidden: () => document.visibilityState === 'hidden',
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
// `?mesa` no endereço = TELA DA MESA (TV, projetor): espectador sem ficha, ver `TableScreen.tsx`.
const tableCode = tableCodeFromSearch(location.search)
createRoot(root).render(<StrictMode>{tableCode === null ? <PlayerApp /> : <TableApp initialCode={tableCode} tableKey={tableKeyFromSearch(location.search)} />}</StrictMode>)
