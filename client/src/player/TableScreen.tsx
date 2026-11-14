import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { JOIN_CODE_LENGTH } from '../net/protocol'
import { pedeGzip } from '../net/pacoteComprimido'
import { tableCodeFromSearch } from '../lib/tableScreen'
import { createPlayerConnection, TABLE_SCREEN_NAME, type PlayerConnection, type PlayerState } from './playerConnection'
import { PlayerView } from './PlayerView'
import { loadPlayerSettings } from './PlayerPanel'
import type { PlayerViewSettings } from './PlayerPanel'
import { PlayerErrorBoundary } from './ErrorBoundary'
import { tableScreenText } from './tableScreenText'
import { instalarSonsAoVivo, type SonsAoVivo } from './sonsAoVivoDoJogador'
import { FaixaTocarParaOuvir } from './FaixaTocarParaOuvir'
import { AberturaDeBatalhaOverlay } from '../transicoes/AberturaDeBatalhaOverlay'
import { aquecerAbertura, aquecerMotorDasCutscenes } from '../transicoes/aquecimento'
import { carregarPacoteDaPagina } from '../lib/pacoteDeAnimacoes'
import { PREFERENCIA_DE_SOM_PADRAO } from '../stores/somStore'
import { formasDoRecorte, fotosComAFormaVisivel, useFotosEstaveis } from '../components/batalha/marcasNoMapa'
import { useImagemDaMesa } from '../components/ImagemDaMesa'

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
      <p className="pe-lead">Esta tela mostra o mapa para a mesa inteira, sem ficha. O código da mesa online vem do mestre.</p>
      <form onSubmit={submit} className="pe-form">
        <div className="pe-field">
          <label className="pe-label" htmlFor="lb-table-code">
            Código da mesa online
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
  // MUDAR FICHA: a TV mostra a imagem de forma que o recorte pendurou em cada token (`Token.fotoDaForma`).
  const resolverDaMesa = useImagemDaMesa()
  const tokensDoRecorte = state.map?.tokens
  const fotoDaForma = useFotosEstaveis(useMemo(() => fotosComAFormaVisivel(null, formasDoRecorte(tokensDoRecorte), resolverDaMesa), [tokensDoRecorte, resolverDaMesa]))

  // PACOTE DE ANIMAÇÕES do mestre, pelo servidor da sala, como na página do jogador: toda abertura
  // de batalha vem dele, e sem ele a TV pulava a abertura (a cena "que este app não tem").
  // CUTSCENES CARREGADAS ANTES DE TOCAR: o motor delas começa a baixar junto, antes da primeira batalha.
  useEffect(() => {
    void carregarPacoteDaPagina()
    aquecerMotorDasCutscenes()
  }, [])
  // AQUECER PELA INTENÇÃO: a abertura que o mestre marcou é pré-compilada aqui antes de ele confirmar.
  const aberturaParaAquecer = state.aberturaParaAquecer
  useEffect(() => {
    if (aberturaParaAquecer !== undefined) aquecerAbertura(aberturaParaAquecer)
  }, [aberturaParaAquecer])

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
          porAtravessar={state.porAtravessar}
          ownTokens={NO_TOKENS}
          batalha={state.batalha === true}
          fotoDaForma={fotoDaForma}
          settings={settings}
          focusTokenId={null}
          focusSeq={0}
          onMove={IGNORE_MOVE}
        />
        {/* MODO BATALHA (B5): a TV toca a abertura também, no volume fixo dela (o mesmo dos sons ao vivo). */}
        <AberturaDeBatalhaOverlay
          abertura={state.batalhaIniciada}
          volume={PREFERENCIA_DE_SOM_PADRAO.volume}
          aoFicarPronta={(preparo) => connection.informarCutscenePronta(preparo)}
          aoCarregar={(preparo) => connection.informarCutsceneCarregando(preparo)}
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
  const [sonsAoVivo, setSonsAoVivo] = useState<SonsAoVivo | null>(null)
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
      aceitaGzip: pedeGzip(window.location.hostname),
    })
    setConnection(created)
    return () => {
      created.close()
      setConnection(null)
    }
  }, [code, tableKey])

  // SONS AO VIVO (F5): a TV também toca (decisão de 23/10); os sons nascem e morrem com a conexão dela.
  useEffect(() => {
    if (connection === null) return undefined
    // Sem controle de som na TV: o Mudo guardado neste navegador (por outra página) não a cala.
    const sons = instalarSonsAoVivo(connection, { ignorarPreferenciaGuardada: true })
    setSonsAoVivo(sons)
    return () => {
      sons.desinstalar()
      setSonsAoVivo(null)
    }
  }, [connection])

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
  return (
    <>
      <TableSession connection={connection} code={code} onChangeCode={() => setCode('')} />
      <FaixaTocarParaOuvir sons={sonsAoVivo} />
    </>
  )
}
