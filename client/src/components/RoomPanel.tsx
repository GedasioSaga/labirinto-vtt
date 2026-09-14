import type { PlayerInfo } from '../net/hostSession'
import type { RoomInfo } from '../net/hostBridge'

export interface RoomPanelToken {
  id: string
  name: string
}

export interface RoomPanelProps {
  room: RoomInfo | null
  players: PlayerInfo[]
  tokens: RoomPanelToken[]
  onStart(): void
  onStop(): void
  onAssign(playerId: string, tokenId: string): void
  onUnassign(playerId: string, tokenId: string): void
  onKick(clientId: string): void
}

export const FIREWALL_HINT = 'Se o celular não abrir o link, libere o app no Firewall do Windows (rede Privada)'

/** SVG vindo do Rust vira data URL: `<img>` não executa script do SVG. */
export function qrDataUrl(qrSvg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`
}

export function playerStatusLabel(player: PlayerInfo): string {
  const status = player.status === 'playing' ? 'jogando' : 'aguardando'
  return `${status} · ${player.connected ? 'conectado' : 'desconectado'}`
}

/** Tokens que ainda não pertencem a este jogador (candidatos a atribuir). */
export function assignableTokens(tokens: RoomPanelToken[], player: PlayerInfo): RoomPanelToken[] {
  return tokens.filter((token) => !player.tokenIds.includes(token.id))
}

function tokenName(tokens: RoomPanelToken[], tokenId: string): string {
  return tokens.find((token) => token.id === tokenId)?.name ?? tokenId
}

export function RoomPanel({ room, players, tokens, onStart, onStop, onAssign, onUnassign, onKick }: RoomPanelProps) {
  return (
    <section className="lb-panel lb-section lb-room lb-scroll">
      <h2 className="lb-eyebrow">Sala</h2>

      {room === null ? (
        <button type="button" className="lb-btn lb-btn--primary lb-btn--block" onClick={onStart}>
          Abrir sala
        </button>
      ) : (
        <>
          <button type="button" className="lb-btn lb-btn--danger lb-btn--block" onClick={onStop}>
            Fechar sala
          </button>

          <div className="lb-field">
            <span className="lb-label">Código</span>
            <strong style={{ fontSize: '2rem', letterSpacing: '0.2em' }}>{room.code}</strong>
          </div>

          <div className="lb-field">
            <span className="lb-label">Endereços</span>
            <ul className="lb-room__urls">
              {room.urls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
          </div>

          <img className="lb-room__qr" src={qrDataUrl(room.qrSvg)} alt="QR da sala" />

          <h3 className="lb-eyebrow">Jogadores</h3>
          {players.length === 0 && <p className="lb-label">Nenhum jogador ainda.</p>}
          {players.map((player) => {
            const selectId = `lb-room-assign-${player.playerId}`
            const clientId = player.clientId
            return (
              <div key={player.playerId} className="lb-field">
                <span className="lb-label">
                  {player.name} — {playerStatusLabel(player)}
                </span>
                {player.tokenIds.map((tokenId) => (
                  <button key={tokenId} type="button" className="lb-btn lb-btn--ghost" onClick={() => onUnassign(player.playerId, tokenId)}>
                    Remover {tokenName(tokens, tokenId)}
                  </button>
                ))}
                <label className="lb-label" htmlFor={selectId}>
                  Atribuir token
                </label>
                <select
                  id={selectId}
                  className="lb-input"
                  value=""
                  onChange={(event) => {
                    if (event.target.value !== '') onAssign(player.playerId, event.target.value)
                  }}
                >
                  <option value="">Escolher…</option>
                  {assignableTokens(tokens, player).map((token) => (
                    <option key={token.id} value={token.id}>
                      {token.name}
                    </option>
                  ))}
                </select>
                {clientId !== null && (
                  <button type="button" className="lb-btn lb-btn--danger" onClick={() => onKick(clientId)}>
                    Expulsar
                  </button>
                )}
              </div>
            )
          })}
        </>
      )}

      <p className="lb-label">{FIREWALL_HINT}</p>
    </section>
  )
}
