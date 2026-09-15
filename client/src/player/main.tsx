import { StrictMode, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { JOIN_CODE_LENGTH, NAME_MAX_LENGTH, type DoorToggleRejection } from '../net/protocol'
import { themeCss } from '../theme'
import { createPlayerConnection } from './playerConnection'
import type { PlayerConnection, PlayerState, StorageLike } from './playerConnection'
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

const pageStyle = { fontFamily: 'system-ui, sans-serif', maxWidth: 360, margin: '0 auto', padding: '32px 16px' }

function JoinForm({ onJoin, message }: { onJoin: (code: string, name: string) => void; message: string }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    onJoin(code.trim().toUpperCase(), name.trim())
  }

  return (
    <main style={pageStyle}>
      <h1 style={{ fontSize: 22 }}>Labirinto</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          Código da sala
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={JOIN_CODE_LENGTH}
            autoCapitalize="characters"
            autoComplete="off"
            required
            style={{ fontSize: 20, letterSpacing: 4, padding: 8 }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          Seu nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            required
            style={{ fontSize: 18, padding: 8 }}
          />
        </label>
        <button type="submit" disabled={code.trim().length !== JOIN_CODE_LENGTH || !name.trim()} style={{ fontSize: 18, padding: 10 }}>
          Entrar
        </button>
      </form>
      <p role="status" aria-live="polite">{message}</p>
    </main>
  )
}

function Session({ connection, onLeave }: { connection: PlayerConnection; onLeave: () => void }) {
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

  let message: string
  let action: { label: string; run: () => void } | null = null
  switch (state.status) {
    case 'connecting':
      message = 'Conectando…'
      break
    case 'waiting':
    case 'playing':
      message = 'Aguardando o mestre atribuir um personagem.'
      break
    case 'kicked':
      message = 'Você foi removido da sala pelo mestre.'
      action = { label: 'Voltar', run: onLeave }
      break
    case 'closed':
      // Sem Reconectar: a sala não existe mais.
      message = 'O mestre encerrou a sala.'
      action = { label: 'Voltar', run: onLeave }
      break
    case 'error': {
      const reason = state.error ?? 'unknown'
      message = REASON_TEXT[reason] ?? `Erro: ${reason}`
      action = reason === 'connection_lost' ? { label: 'Reconectar', run: () => connection.reconnect() } : { label: 'Voltar', run: onLeave }
      break
    }
  }

  return (
    <main style={pageStyle}>
      <h1 style={{ fontSize: 22 }}>Labirinto</h1>
      <p role="status" aria-live="polite">{message}</p>
      {action && (
        <button type="button" onClick={action.run} style={{ fontSize: 18, padding: 10 }}>
          {action.label}
        </button>
      )}
    </main>
  )
}

function PlayerApp() {
  const [connection, setConnection] = useState<PlayerConnection | null>(null)
  const [leaveMessage, setLeaveMessage] = useState('Informe o código da sala e seu nome.')

  useEffect(() => () => connection?.close(), [connection])

  function join(code: string, name: string) {
    setConnection(createPlayerConnection({ url: socketUrl(), code, name, createSocket: (url) => new WebSocket(url), storage: sessionStorageOrNull() }))
  }

  function leave() {
    setLeaveMessage('Informe o código da sala e seu nome.')
    setConnection(null)
  }

  if (!connection) return <JoinForm onJoin={join} message={leaveMessage} />
  return <Session connection={connection} onLeave={leave} />
}

const root = document.getElementById('root')
if (!root) throw new Error('player.html sem #root')
createRoot(root).render(
  <StrictMode>
    <PlayerApp />
  </StrictMode>,
)
