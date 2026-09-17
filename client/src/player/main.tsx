import { StrictMode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { JOIN_CODE_LENGTH, NAME_MAX_LENGTH, type DoorToggleRejection } from '../net/protocol'
import { themeCss } from '../theme'
import { createPlayerConnection, RESUME_STORAGE_KEY } from './playerConnection'
import type { PlayerConnection, PlayerState, SocketLike, StorageLike } from './playerConnection'
import { OWN_TOKEN_COLOR, PlayerView } from './PlayerView'
import { PlayerPanel, loadPlayerSettings, savePlayerSettings } from './PlayerPanel'
import type { PlayerViewSettings } from './PlayerPanel'
import { PlayerErrorBoundary } from './ErrorBoundary'
import type { SignalMark } from '../lib/signals'
import './player.css'

// Página do jogador: entra com código + nome, espera o mestre e mostra o mapa.

// Mesmas custom properties `--lb-*` do editor (ver main.tsx da raiz), antes do primeiro render.
const themeStyle = document.createElement('style')
themeStyle.id = 'lb-theme'
themeStyle.textContent = themeCss()
document.head.prepend(themeStyle)

/**
 * CSS das telas de TEXTO do jogador: entrar, esperar, aviso. Mora aqui, e não
 * em `player.css`, porque aquele arquivo declara no topo que é só do painel
 * sobre o canvas (`.pp-*`) e que não mexe no formulário de entrada. Tudo em
 * `.pe-*`, sem colisão.
 *
 * Antes destas regras a página era a branca de fábrica do navegador — o resto
 * do app é pedra escura com um acento de latão, e o amigo que abre o QR no
 * celular via primeiro uma tela que não parecia do mesmo programa.
 *
 * Medidas vindas do celular, que é onde este fluxo acontece: cartão de 360px
 * centrado, alvo de toque de 48px (o dedo, de pé, com uma mão só) e campo em
 * 18px — abaixo de 16px o iOS dá zoom sozinho ao focar e joga o resto da tela
 * para fora. `env(safe-area-inset-bottom)` mantém o último botão acima da
 * barra de gestos.
 */
const entryCss = `
:root { color-scheme: dark; }
body { margin: 0; background: var(--lb-color-ink, #121214); }

.pe-page {
  box-sizing: border-box;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px calc(24px + env(safe-area-inset-bottom, 0px));
  color: var(--lb-color-parchment, #eceae4);
  font-family: var(--lb-font-sans, system-ui, sans-serif);
  line-height: 1.45;
}

.pe-card {
  box-sizing: border-box;
  width: 100%;
  max-width: 360px;
  display: grid;
  gap: 16px;
  padding: 24px 20px;
  background: var(--lb-color-stone-solid, #1a1a1e);
  border: 1px solid var(--lb-color-line-strong, rgba(255, 255, 255, 0.16));
  border-radius: var(--lb-radius-lg, 14px);
  box-shadow: var(--lb-shadow-float, 0 18px 44px rgba(0, 0, 0, 0.5));
}

.pe-title {
  margin: 0;
  font-family: var(--lb-font-display, Georgia, serif);
  font-size: 26px;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--lb-color-brass, #e0a44a);
}

.pe-form { display: grid; gap: 16px; margin: 0; }
.pe-field { display: grid; gap: 6px; }
.pe-label { font-size: 14px; color: var(--lb-color-parchment-dim, #a2a09a); }

.pe-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 18px;
  color: var(--lb-color-parchment, #eceae4);
  background: var(--lb-color-stone-raised, #232328);
  border: 1px solid var(--lb-color-line-strong, rgba(255, 255, 255, 0.16));
  border-radius: var(--lb-radius-md, 9px);
}

.pe-input--code { font-size: 22px; letter-spacing: 6px; }

.pe-input:focus-visible,
.pe-btn:focus-visible {
  outline: 2px solid var(--lb-color-brass, #e0a44a);
  outline-offset: 2px;
}

.pe-hint { margin: 0; font-size: 13px; color: var(--lb-color-parchment-faint, #858480); }
.pe-notice { margin: 0; font-size: 14px; }
.pe-notice--error { color: var(--lb-color-ember, #e2645a); }

.pe-btn {
  box-sizing: border-box;
  min-height: 48px;
  padding: 12px 16px;
  font-family: inherit;
  font-size: 17px;
  color: var(--lb-color-parchment, #eceae4);
  background: var(--lb-color-stone-raised, #232328);
  border: 1px solid var(--lb-color-line-strong, rgba(255, 255, 255, 0.16));
  border-radius: var(--lb-radius-md, 9px);
  cursor: pointer;
  transition: background var(--lb-motion-fast, 110ms) var(--lb-motion-ease, ease);
}

.pe-btn--primary {
  font-weight: 600;
  color: var(--lb-color-brass-contrast, #1c1608);
  background: var(--lb-color-brass, #e0a44a);
  border-color: transparent;
}

.pe-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.pe-btn:not(:disabled):active { background: var(--lb-color-stone-hover, #2c2c33); }
.pe-btn--primary:not(:disabled):active { background: var(--lb-color-brass-bright, #f3ba66); }

.pe-actions { display: grid; gap: 8px; }

.pe-id { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; align-items: baseline; }
.pe-id dt { font-size: 13px; color: var(--lb-color-parchment-dim, #a2a09a); }
.pe-id dd { margin: 0; font-size: 18px; font-weight: 600; }
.pe-code { font-family: var(--lb-font-utility, monospace); letter-spacing: 4px; }

.pe-live { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 14px; color: var(--lb-color-parchment-dim, #a2a09a); }

/* A frase que responde "e agora?" é a maior da tela; o resto é apoio. */
.pe-waiting { margin: 0; font-size: 18px; }

.pe-dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--lb-color-brass, #e0a44a);
  animation: pe-pulse 1.8s ease-in-out infinite;
}

@keyframes pe-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

@media (prefers-reduced-motion: reduce) {
  .pe-dot { animation: none; }
  .pe-btn { transition: none; }
}
`

const entryStyle = document.createElement('style')
entryStyle.id = 'lb-player-entry'
entryStyle.textContent = entryCss
document.head.append(entryStyle)

/** Referência estável: um `[]` novo a cada render redesenharia o canvas sem motivo. */
const NO_TOKENS: string[] = []
const NO_SIGNALS: SignalMark[] = []
const OWN_TOKEN_CSS = `#${OWN_TOKEN_COLOR.toString(16).padStart(6, '0')}`

/** Recusa do mestre ao toque na porta, em uma linha curta. */
const DOOR_NOTICE_TEXT: Record<DoorToggleRejection, string> = {
  locked: 'Trancada',
  far: 'Chegue mais perto da porta',
  not_visible: 'Você não vê essa porta daqui',
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

const JOIN_NOTICE: Notice = { text: 'Informe o código da sala e seu nome.', tone: 'info' }

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

function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="pe-page">
      <div className="pe-card">
        <h1 className="pe-title">Labirinto</h1>
        {children}
      </div>
    </main>
  )
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
      <p className={notice.tone === 'error' ? 'pe-notice pe-notice--error' : 'pe-hint'} role="status" aria-live="polite">
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
            {JOIN_CODE_LENGTH} letras e números. Pode colar do chat com espaços — eles são ignorados.
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

function Session({ connection, code, typedName, hostName, onLeave, onQuit }: SessionProps) {
  const state: PlayerState = useSyncExternalStore(connection.subscribe, connection.getState)
  const [settings, setSettings] = useState<PlayerViewSettings>(() => loadPlayerSettings(localStorageOrNull()))
  const [focus, setFocus] = useState<{ tokenId: string | null; seq: number }>({ tokenId: null, seq: 0 })
  const [signalArmed, setSignalArmed] = useState(false)
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

  function changeSettings(next: PlayerViewSettings) {
    setSettings(next)
    savePlayerSettings(localStorageOrNull(), next)
  }

  if (state.status === 'playing' && state.map && state.vision) {
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
          onDoorToggle={(wallId) => connection.toggleDoor(wallId)}
        />
        <PlayerPanel
          characters={characters}
          characterColor={OWN_TOKEN_CSS}
          settings={settings}
          onSettingsChange={changeSettings}
          onFocusToken={(tokenId) => setFocus((current) => ({ tokenId, seq: current.seq + 1 }))}
          signalArmed={signalArmed}
          onToggleSignal={() => setSignalArmed((armed) => !armed)}
        />
        {state.doorNotice && (
          // `key` no id: o mesmo aviso repetido reinicia a animação de entrada.
          <p key={state.doorNotice.id} className="pp-notice" role="status" aria-live="polite">
            {DOOR_NOTICE_TEXT[state.doorNotice.reason]}
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
  /** Primeiro da lista é o botão de destaque; a ordem é a que o dedo encontra de baixo para cima no celular. */
  const actions: { label: string; run: () => void }[] = []
  switch (state.status) {
    case 'connecting':
      message = 'Conectando…'
      break
    case 'kicked':
      message = 'Você foi removido da sala pelo mestre.'
      actions.push({ label: 'Voltar', run: () => onLeave() })
      break
    case 'closed':
      // Sem Reconectar: a sala não existe mais.
      message = 'O mestre encerrou a sala.'
      actions.push({ label: 'Voltar', run: () => onLeave() })
      break
    case 'error': {
      const reason = state.error ?? 'unknown'
      message = REASON_TEXT[reason] ?? `Erro: ${reason}`
      if (reason === 'connection_lost') {
        actions.push({ label: 'Reconectar', run: () => connection.reconnect() })
        // Beco sem saída até aqui: o único botão tentava a MESMA sala, e quando
        // ela não existe mais (o mestre fechou o app, o Wi-Fi do celular mudou)
        // o jogador ficava preso na mensagem, sem caminho de volta. Esquece o
        // resume: retomar aquela sessão é justamente o que não funciona mais.
        actions.push({ label: 'Entrar em outra sala', run: () => onQuit() })
      } else {
        // Código errado volta ao formulário COM o que ele digitou: o nome estava certo.
        actions.push({ label: 'Corrigir e entrar de novo', run: () => onLeave({ text: message, tone: 'error' }) })
      }
      break
    }
  }

  return (
    <Screen>
      <p role="status" aria-live="polite" className="pe-notice">
        {message}
      </p>
      {actions.length > 0 && (
        <div className="pe-actions">
          {actions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              className={index === 0 ? 'pe-btn pe-btn--primary' : 'pe-btn'}
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
