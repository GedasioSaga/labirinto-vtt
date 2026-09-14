import type { PlayerInfo } from '../net/hostSession'
import type { RoomInfo, TunnelState } from '../net/hostBridge'

export interface RoomPanelToken {
  id: string
  name: string
}

export interface RoomPanelProps {
  room: RoomInfo | null
  players: PlayerInfo[]
  tokens: RoomPanelToken[]
  tunnel: TunnelState
  onStart(): void
  onStop(): void
  onStartTunnel(): void
  onStopTunnel(): void
  onAssign(playerId: string, tokenId: string): void
  onUnassign(playerId: string, tokenId: string): void
  onKick(clientId: string): void
}

export const FIREWALL_HINT = 'Se o celular não abrir o link, libere o app no Firewall do Windows (rede Privada)'
export const TUNNEL_WARNING = 'Quem tiver o link e o código entra na sala. Encerre ao terminar o jogo.'

/** SVG vindo do Rust vira data URL: `<img>` não executa script do SVG. */
export function qrDataUrl(qrSvg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`
}

export function downloadLabel(progress: number): string {
  return `Baixando cloudflared ${Math.round(progress * 100)}%`
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

function FirewallHint() {
  return (
    <p className="lb-room__hint">
      <span className="lb-eyebrow">Rede local</span>
      {FIREWALL_HINT}
    </p>
  )
}

function TunnelSection({ tunnel, onStartTunnel, onStopTunnel }: Pick<RoomPanelProps, 'tunnel' | 'onStartTunnel' | 'onStopTunnel'>) {
  if (tunnel.kind === 'ready') {
    return (
      <div className="lb-field lb-room__public">
        <span className="lb-label">Link público</span>
        <strong className="lb-room__link">{tunnel.url}</strong>
        <img className="lb-room__qr" src={qrDataUrl(tunnel.qrSvg)} alt="QR do link público" />
        <p className="lb-room__warning">{TUNNEL_WARNING}</p>
        <button type="button" className="lb-btn lb-btn--block" onClick={onStopTunnel}>
          Encerrar link público
        </button>
      </div>
    )
  }
  const busy = tunnel.kind === 'downloading' || tunnel.kind === 'connecting'
  return (
    <div className="lb-field">
      {tunnel.kind === 'error' && (
        <p className="lb-room__error" role="alert">
          {tunnel.message}
        </p>
      )}
      {tunnel.kind === 'downloading' && (
        <p className="lb-label" role="status">
          {downloadLabel(tunnel.progress)}
        </p>
      )}
      {tunnel.kind === 'connecting' && (
        <p className="lb-label" role="status">
          Conectando ao túnel…
        </p>
      )}
      <button type="button" className="lb-btn lb-btn--block" onClick={onStartTunnel} disabled={busy}>
        Tornar pública
      </button>
      {/* Download (55 MB) e conexão podem levar dezenas de segundos: o mestre precisa poder desistir. */}
      {busy && (
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={onStopTunnel}>
          Cancelar
        </button>
      )}
    </div>
  )
}

export function RoomPanel({ room, players, tokens, tunnel, onStart, onStop, onStartTunnel, onStopTunnel, onAssign, onUnassign, onKick }: RoomPanelProps) {
  return (
    <section className="lb-panel lb-section lb-room lb-scroll">
      <h2 className="lb-eyebrow">Sala</h2>

      {room === null ? (
        <>
          <button type="button" className="lb-btn lb-btn--primary lb-btn--block" onClick={onStart}>
            Abrir sala
          </button>
          <FirewallHint />
        </>
      ) : (
        <>
          <button type="button" className="lb-btn lb-btn--danger lb-btn--block" onClick={onStop}>
            Fechar sala
          </button>

          <div className="lb-field">
            <span className="lb-label">Código</span>
            <strong className="lb-room__code">{room.code}</strong>
          </div>

          <TunnelSection tunnel={tunnel} onStartTunnel={onStartTunnel} onStopTunnel={onStopTunnel} />

          <div className="lb-field">
            <span className="lb-label">Endereços na rede local</span>
            <ul className="lb-room__urls">
              {room.urls.map((url) => (
                <li key={url}>{url}</li>
              ))}
            </ul>
            {tunnel.kind !== 'ready' && <img className="lb-room__qr" src={qrDataUrl(room.qrSvg)} alt="QR da sala" />}
            <FirewallHint />
          </div>

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
    </section>
  )
}
