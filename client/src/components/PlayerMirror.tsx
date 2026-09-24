import { useEffect, useId, useMemo, useRef, useSyncExternalStore, type KeyboardEvent } from 'react'
import { decodeExploration } from '../lib/exploration'
import type { PlayerScreen } from '../net/playerScreens'
import { DEFAULT_PLAYER_SETTINGS } from '../player/PlayerPanel'
import { PlayerView } from '../player/PlayerView'

/**
 * ESPELHO DA TELA DO JOGADOR ("Ver tela" na linha do Grupo): o mestre confere
 * o que aquele jogador vê antes de mostrar algo à mesa. Desenha com o MESMO
 * `PlayerView` do `player.html`, alimentado pelo último recorte que saiu para
 * ele (`net/playerScreens.ts`) — nunca pelo mapa do editor. Por isso segue a
 * cena do jogador e esconde o que a névoa e a zona oculta escondem dele.
 *
 * Não-modal: o mestre continua mexendo no mapa com o espelho aberto (é a
 * comparação que ele quer). Esc fecha e o foco volta a quem abriu.
 *
 * Nenhum nome de cena ou de mapa aparece aqui: o jogador também não lê.
 */

export interface PlayerMirrorProps {
  playerName: string
  screen: PlayerScreen | null
  onClose(): void
}

/** Nome acessível do espelho: o nome do jogador e a palavra "Tela". */
export function mirrorTitle(name: string): string {
  return `Tela de ${name}`
}

const NO_OWN_TOKENS: string[] = []
/** O espelho só olha: o jogador anda pela tela DELE. */
const IGNORE_MOVE = () => undefined

function MirrorScreen({ screen }: { screen: Extract<PlayerScreen, { kind: 'map' }> }) {
  // Decodifica só aqui, com o espelho aberto: anotar o fio não custa nada à ponte.
  const explored = useMemo(() => decodeExploration(screen.explored) ?? undefined, [screen.explored])
  return (
    <div className="lb-mirror__screen">
      <PlayerView
        mirror
        map={screen.map}
        vision={screen.vision}
        explored={explored}
        concealed={screen.concealed}
        glimpses={screen.glimpses}
        ownTokens={screen.ownTokens.length === 0 ? NO_OWN_TOKENS : screen.ownTokens}
        settings={DEFAULT_PLAYER_SETTINGS}
        focusTokenId={null}
        focusSeq={0}
        onMove={IGNORE_MOVE}
      />
    </div>
  )
}

export function PlayerMirror({ playerName, screen, onClose }: PlayerMirrorProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    // Quem abriu (o "Ver tela" da linha) recebe o foco de volta ao fechar.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => {
      requestAnimationFrame(() => {
        if (opener?.isConnected) opener.focus()
      })
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha o espelho e não chega ao canvas (lá ele troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  return (
    <div className="lb-mirror" role="dialog" aria-modal="false" aria-labelledby={titleId} onKeyDown={onKeyDown}>
      <div className="lb-mirror__head">
        <h2 id={titleId} className="lb-mirror__title">
          {mirrorTitle(playerName)}
        </h2>
        <button ref={closeRef} type="button" className="lb-btn lb-btn--ghost" aria-label={`Fechar a tela de ${playerName}`} onClick={onClose}>
          Fechar
        </button>
      </div>
      {screen?.kind === 'map' ? (
        <MirrorScreen screen={screen} />
      ) : (
        <p className="lb-mirror__empty" role="status">
          {screen?.kind === 'waiting' ? `${playerName} está aguardando o mestre: sem ficha em cena.` : `${playerName} está sem tela agora.`}
        </p>
      )}
      <p className="lb-label">Só olhar: é o que {playerName} vê agora. Nada aqui mexe na tela dele.</p>
    </div>
  )
}

export interface LivePlayerMirrorProps {
  playerName: string
  playerId: string
  /** `HostBridge.watchPlayerScreens` e `HostBridge.playerScreen`. */
  watch(listener: () => void): () => void
  read(playerId: string): PlayerScreen | null
  onClose(): void
}

/** O espelho ligado à ponte: redesenha a cada recorte novo que sai para o jogador, sem re-renderizar o app. */
export function LivePlayerMirror({ playerName, playerId, watch, read, onClose }: LivePlayerMirrorProps) {
  const screen = useSyncExternalStore(watch, () => read(playerId))
  return <PlayerMirror playerName={playerName} screen={screen} onClose={onClose} />
}
