import { StrictMode, useEffect, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { JOIN_CODE_LENGTH, NAME_MAX_LENGTH } from '../net/protocol'
import { createPlayerConnection } from './playerConnection'
import type { PlayerConnection, PlayerState, StorageLike } from './playerConnection'
import { PlayerView } from './PlayerView'
import { PlayerErrorBoundary } from './ErrorBoundary'

// Página do jogador: entra com código + nome, espera o mestre e mostra o mapa.

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

  if (state.status === 'playing' && state.map && state.vision) {
    return (
      <PlayerErrorBoundary onReconnect={() => connection.reconnect()}>
        <PlayerView map={state.map} vision={state.vision} onMove={(id, x, y) => connection.requestMove(id, x, y)} />
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
