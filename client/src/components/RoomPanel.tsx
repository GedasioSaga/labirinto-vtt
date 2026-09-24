import { useEffect, useId, useRef, useState } from 'react'
import { VISION_RADIUS_MAX, VISION_RADIUS_MIN, VISION_RADIUS_STEP, type PlayerInfo } from '../net/hostSession'
import type { RoomInfo, TunnelState } from '../net/hostBridge'
import { PartySection, type PartySectionProps } from './PartySection'
import { TravelLogSection, type TravelLogSectionProps } from './TravelLogSection'

export interface RoomPanelToken {
  id: string
  name: string
}

export interface RoomPanelProps {
  room: RoomInfo | null
  players: PlayerInfo[]
  tokens: RoomPanelToken[]
  /**
   * Fichas de TODAS as cenas da aventura, para dar nome ao "Remover …": o
   * jogador que viajou tem a ficha numa cena de fundo, fora de `tokens` (que é
   * só a cena aberta, a lista de atribuir). Ausente = `tokens`.
   */
  knownTokens?: RoomPanelToken[]
  /** Seção "Grupo" (uma linha por jogador, "Ir lá" e "Mandar para…"). Ausente = sem a seção. */
  party?: PartySectionProps
  /** "Diário de viagens" (G15), logo abaixo do Grupo. Ausente = sem a seção (mapa solto: não há viagem). */
  travelLog?: TravelLogSectionProps
  tunnel: TunnelState
  /**
   * Retomar a mesa: quem tem ficha guardada ("Ana e Bruno"). Com isto, "Abrir
   * sala" pergunta "Retomar a mesa?" antes de abrir. Ausente ou `null` = abre direto.
   */
  savedTableNames?: string | null
  /** `resume`: "Retomar a mesa" (`true`) ou a sala de hoje (`false`). */
  onStart(resume: boolean): void
  onStop(): void
  onStartTunnel(): void
  onStopTunnel(): void
  onAssign(playerId: string, tokenId: string): void
  onUnassign(playerId: string, tokenId: string): void
  onKick(clientId: string): void
  /** "Guardar ficha" de quem está fora: a ficha sai do mapa até ele voltar. Ausente = sem o botão. */
  onStoreTokens?(playerId: string): void
  /** "Dispensar" quem está fora: o card sai. Ausente = sem o botão. */
  onDismiss?(playerId: string): void
  /**
   * "Emprestar ficha a" de quem está fora: as fichas dele passam a ser jogadas
   * por `borrowerId` até ele voltar. Ausente (ou sem `onEndLoans`) = sem a lista.
   */
  onLendTokens?(ownerId: string, borrowerId: string): void
  /** "Tomar de volta" da ficha emprestada: ela sai de quem a jogava e fica só com o dono. */
  onEndLoans?(ownerId: string): void
  onVisionRadiusChange(playerId: string, radius: number): void
  onRevealPlan(playerId: string): void
  onHidePlan(playerId: string): void
  /** Botão "Laser" ligado: arma o laser (independe de segurar L); o traço sai clicando no mapa. */
  laserOn?: boolean
  onToggleLaser?(): void
}

export const PLAN_HINT = 'Revelar planta mostra paredes, salas e portas, sem os tokens. Zonas ocultas continuam escondidas.'
export const LASER_HINT ='Ligado (ou segurando L), clique e arraste com o botão esquerdo sobre o mapa. Todos os jogadores veem o laser.'
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

/** Paleta das bolinhas da lista de atribuir: tons distintos e legíveis no tema escuro. */
const TOKEN_DOT_COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffd54f', '#ba68c8', '#4dd0e1', '#ff8a65', '#a1887f']

/**
 * Cor estável por token (hash do id), para diferenciar de relance dois tokens
 * de nome parecido. Depende só do id: renomear não troca a cor.
 */
export function tokenDotColor(tokenId: string): string {
  let hash = 0
  for (let i = 0; i < tokenId.length; i += 1) hash = (hash * 31 + tokenId.charCodeAt(i)) >>> 0
  return TOKEN_DOT_COLORS[hash % TOKEN_DOT_COLORS.length]
}

/** Texto da opção: `<option>` nativo não aceita elemento filho, então a bolinha é um caractere. */
export function assignOptionLabel(token: RoomPanelToken): string {
  return `● ${token.name}`
}

/**
 * Quantos tokens viram botão de um clique no card de quem está esperando. O
 * resto continua na lista suspensa abaixo — com 20 tokens a fileira de botões
 * viraria um paredão e o mestre leria mais devagar que no `<select>`.
 */
export const QUICK_ASSIGN_MAX = 6

/** Nome acessível do botão de um clique; é por ele que o mestre e o teste acham o token. */
export function quickAssignLabel(token: RoomPanelToken): string {
  return `Atribuir ${token.name}`
}

/** Nome da ficha para o botão "Remover …"; o id só quando ela não existe em cena nenhuma. */
export function tokenName(tokens: RoomPanelToken[], tokenId: string): string {
  return tokens.find((token) => token.id === tokenId)?.name ?? tokenId
}

/**
 * Quem está sem personagem AGORA, do outro lado, olhando uma tela parada: 0.
 * O resto: 1. `sort` é estável (ES2019), então dentro de cada grupo a ordem de
 * chegada da `listPlayers` fica de pé.
 *
 * Desconectado não sobe: ele não está esperando nada, fechou a aba. Subir o
 * card dele empurraria para baixo justamente quem espera.
 */
function waitingRank(player: PlayerInfo): number {
  return player.status === 'waiting' && player.connected ? 0 : 1
}

/** Cards ordenados por urgência. Não muta a lista que veio da ponte. */
export function waitingFirst(players: PlayerInfo[]): PlayerInfo[] {
  return [...players].sort((a, b) => waitingRank(a) - waitingRank(b))
}

/**
 * O toast de "Ana entrou" dura 10 s e o mestre costuma estar desenhando. Esta
 * linha é o que sobra depois dele: aberta a aba Jogo, diz de cara que alguém
 * continua parado esperando, sem o mestre ter de ler card por card.
 */
export function waitingLabel(count: number): string {
  return count === 1 ? '1 jogador esperando personagem' : `${count} jogadores esperando personagem`
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

/**
 * "Abrir sala". Com mesa guardada, o botão vira a pergunta "Retomar a mesa?"
 * no próprio painel: Retomar devolve as fichas pelo nome, "Mesa nova" é a sala
 * de hoje, "Voltar" desiste sem abrir nada.
 */
function OpenRoom({ savedTableNames, onStart }: Pick<RoomPanelProps, 'savedTableNames' | 'onStart'>) {
  const [asking, setAsking] = useState(false)
  const resumeRef = useRef<HTMLButtonElement>(null)
  const openRef = useRef<HTMLButtonElement>(null)
  /** "Voltar" devolve o foco ao "Abrir sala"; a primeira montagem não rouba foco de ninguém. */
  const backRef = useRef(false)
  const titleId = useId()
  useEffect(() => {
    // O foco segue a pergunta: quem abriu pelo teclado responde sem caçar o botão.
    if (asking) resumeRef.current?.focus()
    else if (backRef.current) {
      backRef.current = false
      openRef.current?.focus()
    }
  }, [asking])

  if (!asking || savedTableNames === undefined || savedTableNames === null) {
    return (
      <button
        ref={openRef}
        type="button"
        className="lb-btn lb-btn--primary lb-btn--block"
        onClick={() => {
          if (savedTableNames === undefined || savedTableNames === null) onStart(false)
          else setAsking(true)
        }}
      >
        Abrir sala
      </button>
    )
  }
  const answer = (resume: boolean) => {
    setAsking(false)
    onStart(resume)
  }
  return (
    <div className="lb-field" role="group" aria-labelledby={titleId}>
      <strong id={titleId}>Retomar a mesa?</strong>
      <p className="lb-label">Quem voltar com o mesmo nome reencontra a própria ficha: {savedTableNames}.</p>
      <button ref={resumeRef} type="button" className="lb-btn lb-btn--primary lb-btn--block" onClick={() => answer(true)}>
        Retomar a mesa
      </button>
      <button type="button" className="lb-btn lb-btn--block" onClick={() => answer(false)}>
        Mesa nova
      </button>
      <button
        type="button"
        className="lb-btn lb-btn--ghost lb-btn--block"
        onClick={() => {
          backRef.current = true
          setAsking(false)
        }}
      >
        Voltar
      </button>
    </div>
  )
}

interface LoanControlsProps {
  /** Quem está fora: o dono da ficha. */
  player: PlayerInfo
  players: PlayerInfo[]
  onLendTokens(ownerId: string, borrowerId: string): void
  onEndLoans(ownerId: string): void
}

/**
 * EMPRESTAR A FICHA de quem saiu: a lista "Emprestar ficha a" (só quem está
 * conectado pode jogar por ele) ou, já emprestada, com quem ela está e o
 * "Tomar de volta".
 */
function LoanControls({ player, players, onLendTokens, onEndLoans }: LoanControlsProps) {
  if (player.lentTo !== undefined) {
    return (
      <>
        <p className="lb-label">
          Ficha emprestada a {player.lentTo.join(', ')}. Volta sozinha quando {player.name} voltar.
        </p>
        <button type="button" className="lb-btn lb-btn--ghost" onClick={() => onEndLoans(player.playerId)}>
          Tomar de volta
        </button>
      </>
    )
  }
  const borrowers = players.filter((other) => other.connected && other.playerId !== player.playerId)
  if (player.tokenIds.length === 0 || borrowers.length === 0) return null
  const selectId = `lb-room-lend-${player.playerId}`
  return (
    <>
      <label className="lb-label" htmlFor={selectId}>
        Emprestar ficha a
      </label>
      <select
        id={selectId}
        className="lb-input"
        value=""
        onChange={(event) => {
          if (event.target.value !== '') onLendTokens(player.playerId, event.target.value)
        }}
      >
        <option value="">Escolher…</option>
        {borrowers.map((borrower) => (
          <option key={borrower.playerId} value={borrower.playerId}>
            {borrower.name}
          </option>
        ))}
      </select>
    </>
  )
}

export function RoomPanel({
  room,
  players,
  tokens,
  knownTokens,
  party,
  travelLog,
  tunnel,
  savedTableNames,
  onStart,
  onStop,
  onStartTunnel,
  onStopTunnel,
  onAssign,
  onUnassign,
  onKick,
  onStoreTokens,
  onDismiss,
  onLendTokens,
  onEndLoans,
  onVisionRadiusChange,
  onRevealPlan,
  onHidePlan,
  laserOn = false,
  onToggleLaser,
}: RoomPanelProps) {
  const waitingCount = players.filter((player) => player.status === 'waiting' && player.connected).length
  return (
    <section className="lb-panel lb-section lb-room lb-scroll">
      <h2 className="lb-eyebrow">Sala</h2>

      {room === null ? (
        <>
          <OpenRoom savedTableNames={savedTableNames} onStart={onStart} />
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

          {/* O grupo vem antes do resto: é o que o mestre consulta a cada cena, o resto é de montar a sala. */}
          {party !== undefined && party.members.length > 0 && <PartySection {...party} />}

          {travelLog !== undefined && <TravelLogSection {...travelLog} />}

          {onToggleLaser !== undefined && (
            <div className="lb-field">
              <button type="button" className={laserOn ? 'lb-btn lb-btn--primary lb-btn--block' : 'lb-btn lb-btn--block'} aria-pressed={laserOn} onClick={onToggleLaser}>
                Laser
              </button>
              <p className="lb-label">{LASER_HINT}</p>
            </div>
          )}

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
          {waitingCount > 0 && <p className="lb-label">{waitingLabel(waitingCount)}</p>}
          {waitingFirst(players).map((player) => {
            const selectId = `lb-room-assign-${player.playerId}`
            const radiusId = `lb-room-vision-${player.playerId}`
            const clientId = player.clientId
            const assignable = assignableTokens(tokens, player)
            return (
              <div key={player.playerId} className="lb-field">
                <span className="lb-label">
                  {player.name} — {playerStatusLabel(player)}
                  {/* Com aventura, o grupo pode estar espalhado: o mestre lê onde cada um está. */}
                  {player.sceneName !== undefined && ` · em ${player.sceneName}`}
                </span>
                {player.tokenIds.map((tokenId) => (
                  <button key={tokenId} type="button" className="lb-btn lb-btn--ghost" onClick={() => onUnassign(player.playerId, tokenId)}>
                    Remover {tokenName(knownTokens ?? tokens, tokenId)}
                  </button>
                ))}
                {player.status === 'waiting' && assignable.length > 0 && (
                  <>
                    {/* Quem aguarda está numa tela parada: dar personagem é UM clique, sem abrir lista. */}
                    <span className="lb-label">Sem personagem — atribua em um clique</span>
                    {assignable.slice(0, QUICK_ASSIGN_MAX).map((token) => (
                      <button
                        key={token.id}
                        type="button"
                        className="lb-btn lb-btn--primary"
                        onClick={() => onAssign(player.playerId, token.id)}
                      >
                        <span aria-hidden="true" style={{ color: tokenDotColor(token.id) }}>
                          ●{' '}
                        </span>
                        {quickAssignLabel(token)}
                      </button>
                    ))}
                  </>
                )}
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
                  {assignable.map((token) => (
                    <option key={token.id} value={token.id} style={{ color: tokenDotColor(token.id) }}>
                      {assignOptionLabel(token)}
                    </option>
                  ))}
                </select>
                <div className="lb-section__row">
                  <label className="lb-label" htmlFor={radiusId}>
                    Raio de visão
                  </label>
                  <span className="lb-num">{player.visionRadius} px</span>
                </div>
                <input
                  id={radiusId}
                  className="lb-range"
                  type="range"
                  min={VISION_RADIUS_MIN}
                  max={VISION_RADIUS_MAX}
                  step={VISION_RADIUS_STEP}
                  value={player.visionRadius}
                  onChange={(event) => onVisionRadiusChange(player.playerId, Number(event.target.value))}
                />
                <button type="button" className="lb-btn lb-btn--ghost" onClick={() => onRevealPlan(player.playerId)}>
                  Revelar planta
                </button>
                <button type="button" className="lb-btn lb-btn--ghost" onClick={() => onHidePlan(player.playerId)}>
                  Esconder de novo
                </button>
                <p className="lb-label">{PLAN_HINT}</p>
                {clientId !== null && (
                  <button type="button" className="lb-btn lb-btn--danger" onClick={() => onKick(clientId)}>
                    Expulsar
                  </button>
                )}
                {/* Quem foi embora: a ficha dele não pode ficar no corredor para sempre, nem o card na lista. */}
                {clientId === null && player.storedTokenNames !== undefined && player.storedTokenNames.length > 0 && (
                  <p className="lb-label">Ficha guardada: {player.storedTokenNames.join(', ')}. Volta ao mapa quando {player.name} voltar.</p>
                )}
                {player.borrowedFrom !== undefined && <p className="lb-label">Jogando também a ficha de {player.borrowedFrom.join(', ')}.</p>}
                {clientId === null && onLendTokens !== undefined && onEndLoans !== undefined && (
                  <LoanControls player={player} players={players} onLendTokens={onLendTokens} onEndLoans={onEndLoans} />
                )}
                {/* Emprestada, a ficha está em jogo com outro: guardar a tiraria do mapa debaixo dele. */}
                {clientId === null && onStoreTokens !== undefined && player.tokenIds.length > 0 && player.lentTo === undefined && (
                  <button type="button" className="lb-btn lb-btn--ghost" onClick={() => onStoreTokens(player.playerId)}>
                    Guardar ficha
                  </button>
                )}
                {clientId === null && onDismiss !== undefined && (
                  <button type="button" className="lb-btn lb-btn--danger" onClick={() => onDismiss(player.playerId)}>
                    Dispensar
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
