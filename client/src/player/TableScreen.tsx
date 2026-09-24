import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { JOIN_CODE_LENGTH } from '../net/protocol'
import { tableCodeFromSearch } from '../lib/tableScreen'
import { createPlayerConnection, TABLE_SCREEN_NAME, type PlayerConnection, type PlayerState } from './playerConnection'
import { PlayerView } from './PlayerView'
import { loadPlayerSettings } from './PlayerPanel'
import type { PlayerViewSettings } from './PlayerPanel'
import { PlayerErrorBoundary } from './ErrorBoundary'
import { tableScreenText } from './tableScreenText'

/**
 * TELA DA MESA — a página de espectador para a TV ou o projetor. Mesmo
 * endereço do jogador (`/player`), com `?mesa=CÓDIGO`. Sem ficha e sem painel:
 * só o mapa da cena que o mestre escolheu, com o que o grupo já viu. Pan e
 * zoom continuam (é o próprio `PlayerView`); nada sai daqui para o mestre além
 * do `join` e do `ping` (`playerConnection` em modo `table`).
 */

/** Referências estáveis: um `[]` ou função nova a cada render redesenharia o canvas sem motivo. */
const NO_TOKENS: string[] = []
const IGNORE_MOVE = (): void => undefined
/** Queda de rede: a TV tenta de novo sozinha a cada tanto — ninguém vai até ela apertar botão. */
export const TABLE_RETRY_MS = 5_000

function socketUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${location.host}/ws`
}

function TableCard({ children }: { children: ReactNode }) {
  return (
    <main className="pe-page">
      <div className="pe-card">
        <h1 className="pe-title">Tela da mesa</h1>
        {children}
      </div>
    </main>
  )
}

function CodeForm({ initial, onSubmit }: { initial: string; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState(initial)
  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit(code)
  }
  return (
    <TableCard>
      <p className="pe-lead">Esta tela mostra o mapa para a mesa inteira, sem ficha. O código da sala vem do mestre.</p>
      <form onSubmit={submit} className="pe-form">
        <div className="pe-field">
          <label className="pe-label" htmlFor="lb-table-code">
            Código da sala
          </label>
          <input
            id="lb-table-code"
            className="pe-input pe-input--code"
            value={code}
            onChange={(e) => setCode(tableCodeFromSearch(`?mesa=${encodeURIComponent(e.target.value)}`) ?? '')}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
          />
        </div>
        <button type="submit" className="pe-btn pe-btn--primary" disabled={code.length !== JOIN_CODE_LENGTH}>
          Mostrar a mesa
        </button>
      </form>
    </TableCard>
  )
}

function TableSession({ connection, code, onChangeCode }: { connection: PlayerConnection; code: string; onChangeCode: () => void }) {
  const state: PlayerState = useSyncExternalStore(connection.subscribe, connection.getState)
  const [settings] = useState<PlayerViewSettings>(() => loadPlayerSettings(null))
  const copy = tableScreenText(state, code)

  // Queda de rede: tenta de novo sozinha enquanto a tela estiver neste estado.
  useEffect(() => {
    if (!copy.retry) return
    const timer = setTimeout(() => connection.reconnect(), TABLE_RETRY_MS)
    return () => clearTimeout(timer)
  }, [copy.retry, connection, state.status])

  if (state.status === 'playing' && state.map && state.vision) {
    return (
      <PlayerErrorBoundary onReconnect={() => connection.reconnect()}>
        <PlayerView
          map={state.map}
          vision={state.vision}
          explored={state.explored}
          concealed={state.concealed}
          hazards={state.hazards}
          gatilhos={state.gatilhos}
          ownTokens={NO_TOKENS}
          settings={settings}
          focusTokenId={null}
          focusSeq={0}
          onMove={IGNORE_MOVE}
        />
      </PlayerErrorBoundary>
    )
  }

  return (
    <TableCard>
      <p role="status" aria-live="polite" className={copy.tone === 'error' ? 'pe-notice pe-notice--error' : 'pe-notice'}>
        {copy.text}
      </p>
      {copy.action !== null && (
        <div className="pe-actions">
          <button
            type="button"
            className="pe-btn pe-btn--primary"
            onClick={copy.action === 'reconnect' ? () => connection.reconnect() : onChangeCode}
          >
            {copy.action === 'reconnect' ? 'Tentar agora' : 'Trocar o código'}
          </button>
        </div>
      )}
    </TableCard>
  )
}

/**
 * A página inteira da tela da mesa. `initialCode` vem do `?mesa=` (vazio = pede
 * o código); `tableKey` do `?chave=` (vazio = a sala recusa e a tela manda abrir
 * o link da aba Jogo).
 */
export function TableApp({ initialCode, tableKey }: { initialCode: string; tableKey: string }) {
  const [code, setCode] = useState(initialCode.length === JOIN_CODE_LENGTH ? initialCode : '')
  const [connection, setConnection] = useState<PlayerConnection | null>(null)
  const booted = useRef(false)

  // Mesma saída da tela de abertura de `player.html` que a página do jogador faz.
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    document.getElementById('lb-boot')?.remove()
  }, [])

  useEffect(() => {
    if (code.length !== JOIN_CODE_LENGTH) return
    const created = createPlayerConnection({
      url: socketUrl(),
      code,
      name: TABLE_SCREEN_NAME,
      role: 'table',
      tableKey,
      createSocket: (url) => new WebSocket(url),
      storage: null,
    })
    setConnection(created)
    return () => {
      created.close()
      setConnection(null)
    }
  }, [code, tableKey])

  if (code.length !== JOIN_CODE_LENGTH) return <CodeForm initial={initialCode} onSubmit={setCode} />
  // O instante entre escolher o código e o efeito criar a conexão.
  if (connection === null) {
    return (
      <TableCard>
        <p role="status" aria-live="polite" className="pe-notice">
          {tableScreenText({ status: 'connecting' }, code).text}
        </p>
      </TableCard>
    )
  }
  return <TableSession connection={connection} code={code} onChangeCode={() => setCode('')} />
}
