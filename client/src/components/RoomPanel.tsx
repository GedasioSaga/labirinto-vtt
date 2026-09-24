import { useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { partyPresenceLabel, type PartyMember } from '../lib/party'
import { VISION_RADIUS_MAX, VISION_RADIUS_MIN, VISION_RADIUS_STEP, type HostWorld, type PlayerInfo } from '../net/hostSession'
import type { RoomInfo, TunnelState } from '../net/hostBridge'
import { PartyActions, PartyBackpack, PartyGiveForm, PartySendForm, usePartySend, type PartySectionProps } from './PartySection'

export interface RoomPanelToken {
  id: string
  name: string
  /** Cena de FUNDO onde a ficha está; ausente = a cena aberta no editor. */
  sceneName?: string
  /** Ficha de NPC: fica fora dos botões de um clique (continua na lista). */
  npc?: boolean
}

export interface RoomPanelProps {
  room: RoomInfo | null
  players: PlayerInfo[]
  /**
   * Fichas de TODAS as cenas da aventura (`roomPanelTokensOf`): é daqui que
   * saem os botões de atribuir, a lista e o nome do "Remover …" — o jogador
   * que viajou tem a ficha numa cena de fundo.
   */
  tokens: RoomPanelToken[]
  /**
   * O que o Grupo sabe de cada jogador (cor da ficha, cena) e as ações de
   * mesa ("Ir lá", "Seguir", "Mandar para…"). Ausente = as linhas só com o
   * que é da sala (fichas, raio, planta, Expulsar).
   */
  party?: PartySectionProps
  tunnel: TunnelState
  onStart(): void
  onStop(): void
  onStartTunnel(): void
  onStopTunnel(): void
  onAssign(playerId: string, tokenId: string): void
  onUnassign(playerId: string, tokenId: string): void
  onKick(clientId: string): void
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
export const EMPTY_GROUP_HINT = 'Nenhum jogador ainda. Mostre o código da sala ou o QR, mais abaixo.'
export const NO_TOKENS_HINT = 'Nenhuma ficha no mapa para dar. Crie uma com "Adicionar token", na aba Mapa.'

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

/**
 * As fichas do painel, de todas as cenas: a cena aberta primeiro (sem nome de
 * cena, é a que o mestre está vendo), depois as de fundo na ordem da aventura.
 */
export function roomPanelTokensOf(world: HostWorld): RoomPanelToken[] {
  return [world.open, ...world.background].flatMap((scene) =>
    scene.map.tokens.map((token) => ({
      id: token.id,
      name: token.name,
      ...(scene === world.open ? {} : { sceneName: scene.name }),
      ...(token.npc === true ? { npc: true } : {}),
    })),
  )
}

/** Tokens que ainda não pertencem a este jogador (candidatos a atribuir). */
export function assignableTokens(tokens: RoomPanelToken[], player: PlayerInfo): RoomPanelToken[] {
  return tokens.filter((token) => !player.tokenIds.includes(token.id))
}

/** Dono de cada ficha que já tem dono: id da ficha → nome do jogador. */
export function tokenOwners(players: PlayerInfo[]): Map<string, string> {
  const owners = new Map<string, string>()
  for (const player of players) for (const tokenId of player.tokenIds) owners.set(tokenId, player.name)
  return owners
}

/** 0 = cena aberta, 1 = outra cena: a ficha que o mestre está vendo vem antes. */
function sceneRank(token: RoomPanelToken): number {
  return token.sceneName === undefined ? 0 : 1
}

/**
 * Botões de um clique: só ficha SEM dono e que não é NPC, de qualquer cena.
 * Ficha de outro jogador nunca vira um clique — o clique errado derrubaria
 * quem está jogando; ela fica na lista, marcada, com confirmação.
 */
export function quickAssignTokens(tokens: RoomPanelToken[], owners: ReadonlyMap<string, string>): RoomPanelToken[] {
  return tokens
    .filter((token) => !owners.has(token.id) && token.npc !== true)
    .sort((a, b) => sceneRank(a) - sceneRank(b))
    .slice(0, QUICK_ASSIGN_MAX)
}

/** 0 = livre, 1 = NPC livre, 2 = de outro jogador. */
function listRank(token: RoomPanelToken, owners: ReadonlyMap<string, string>): number {
  if (owners.has(token.id)) return 2
  return token.npc === true ? 1 : 0
}

/** Lista "Atribuir token": livres primeiro, depois NPC, por último as de outros jogadores. */
export function assignListTokens(tokens: RoomPanelToken[], player: PlayerInfo, owners: ReadonlyMap<string, string>): RoomPanelToken[] {
  return assignableTokens(tokens, player).sort((a, b) => listRank(a, owners) - listRank(b, owners) || sceneRank(a) - sceneRank(b))
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

/** "Biblioteca · " para ficha de outra cena; nada para a da cena aberta. */
function scenePrefix(token: RoomPanelToken): string {
  return token.sceneName === undefined ? '' : `${token.sceneName} · `
}

/**
 * Texto da opção: `<option>` nativo não aceita elemento filho, então a bolinha
 * é um caractere. `owner`: quem joga com ela hoje ("Machado — de Bruno").
 */
export function assignOptionLabel(token: RoomPanelToken, owner?: string): string {
  const npc = token.npc === true ? ' (NPC)' : ''
  const ownedBy = owner === undefined ? '' : ` — de ${owner}`
  return `● ${scenePrefix(token)}${token.name}${npc}${ownedBy}`
}

/**
 * Quantos tokens viram botão de um clique no card de quem está esperando. O
 * resto continua na lista suspensa abaixo — com 20 tokens a fileira de botões
 * viraria um paredão e o mestre leria mais devagar que no `<select>`.
 */
export const QUICK_ASSIGN_MAX = 6

/** Nome acessível do botão de um clique; é por ele que o mestre e o teste acham o token. */
export function quickAssignLabel(token: RoomPanelToken): string {
  return `${scenePrefix(token)}Atribuir ${token.name}`
}

/** Nome da ficha para o botão "Remover …"; o id só quando ela não existe em cena nenhuma. */
export function tokenName(tokens: RoomPanelToken[], tokenId: string): string {
  return tokens.find((token) => token.id === tokenId)?.name ?? tokenId
}

/**
 * Quem está sem personagem AGORA, do outro lado, olhando uma tela parada: é o
 * cartão aberto no topo do Grupo, com o que dá personagem à vista.
 *
 * Desconectado não conta: fechou a aba e não espera nada. Fica na lista, na
 * ordem de chegada, sem empurrar para baixo quem de fato espera.
 */
export function waitingNow(player: PlayerInfo): boolean {
  return player.status === 'waiting' && player.connected
}

/**
 * O toast de "Ana entrou" dura 10 s e o mestre costuma estar desenhando. Esta
 * linha é o que sobra depois dele: aberta a aba Jogo, diz de cara que alguém
 * continua parado esperando, sem o mestre ter de ler card por card.
 */
export function waitingLabel(count: number): string {
  return count === 1 ? '1 jogador esperando personagem' : `${count} jogadores esperando personagem`
}

/** A contagem ao lado do título "Grupo": quem espera, se alguém espera; senão, quantos são. */
export function groupCountLabel(total: number, waiting: number): string {
  if (waiting > 0) return waitingLabel(waiting)
  return total === 1 ? '1 jogador' : `${total} jogadores`
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

interface AssignControlsProps {
  player: PlayerInfo
  tokens: RoomPanelToken[]
  owners: ReadonlyMap<string, string>
  onAssign(playerId: string, tokenId: string): void
}

/**
 * Dar ficha a um jogador: botões de um clique (só fichas livres, de qualquer
 * cena) para quem espera e a lista com todas. Escolher a ficha de OUTRO
 * jogador não atribui na hora: abre a confirmação no próprio card, com o
 * foco em Cancelar — o engano não derruba quem está jogando.
 */
function AssignControls({ player, tokens, owners, onAssign }: AssignControlsProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const selectId = `lb-room-assign-${player.playerId}`
  const confirmTextId = `lb-room-confirm-${player.playerId}`
  const waiting = player.status === 'waiting'
  const quick = waiting ? quickAssignTokens(tokens, owners) : []
  const list = assignListTokens(tokens, player, owners)
  const pending = pendingId === null ? undefined : list.find((token) => token.id === pendingId)
  // A ficha pode ter mudado de mãos enquanto o mestre lia: sem dono agora, não há o que confirmar.
  const pendingOwner = pending === undefined ? undefined : owners.get(pending.id)

  const closeConfirm = () => {
    setPendingId(null)
    selectRef.current?.focus()
  }
  const pick = (tokenId: string) => {
    if (owners.has(tokenId)) setPendingId(tokenId)
    else onAssign(player.playerId, tokenId)
  }

  // Sem ficha nenhuma para dar, a lista seria um controle que não faz nada: quem espera lê o porquê.
  if (list.length === 0) return waiting ? <p className="lb-player__note">{NO_TOKENS_HINT}</p> : null

  return (
    <>
      {quick.length > 0 && (
        // Quem aguarda está numa tela parada: dar personagem é UM clique, sem abrir lista.
        <div className="lb-player__quick">
          {quick.map((token) => (
            <button key={token.id} type="button" className="lb-btn lb-btn--primary lb-btn--compact" onClick={() => onAssign(player.playerId, token.id)}>
              <span aria-hidden="true" style={{ color: tokenDotColor(token.id) }}>
                ●{' '}
              </span>
              {quickAssignLabel(token)}
            </button>
          ))}
        </div>
      )}
      {waiting && quick.length === 0 && <span className="lb-player__note">Nenhuma ficha livre — escolha na lista abaixo.</span>}
      <div className="lb-player__pick">
        <label className="lb-label" htmlFor={selectId}>
          Atribuir token
        </label>
        <select
          ref={selectRef}
          id={selectId}
          className="lb-input"
          value=""
          onChange={(event) => {
            if (event.target.value !== '') pick(event.target.value)
          }}
        >
          <option value="">Escolher…</option>
          {list.map((token) => (
            <option key={token.id} value={token.id} style={{ color: tokenDotColor(token.id) }}>
              {assignOptionLabel(token, owners.get(token.id))}
            </option>
          ))}
        </select>
      </div>
      {pending !== undefined && pendingOwner !== undefined && (
        <div
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={confirmTextId}
          className="lb-room__confirm"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            // Esc é desta confirmação: não chega aos atalhos do editor.
            event.stopPropagation()
            closeConfirm()
          }}
        >
          <p id={confirmTextId}>
            {pending.name} é de {pendingOwner}. Dar a {player.name} tira a ficha de {pendingOwner}.
          </p>
          <button
            type="button"
            className="lb-btn lb-btn--danger"
            onClick={() => {
              onAssign(player.playerId, pending.id)
              closeConfirm()
            }}
          >
            Dar a {player.name}
          </button>
          {/* Foco começa no botão seguro (convenção de confirmação destrutiva). */}
          <button type="button" className="lb-btn lb-btn--ghost" autoFocus onClick={closeConfirm}>
            Cancelar
          </button>
        </div>
      )}
    </>
  )
}

/** O que um cartão de jogador precisa da sala para agir nele. */
interface PlayerAdminProps {
  tokens: RoomPanelToken[]
  owners: ReadonlyMap<string, string>
  onAssign(playerId: string, tokenId: string): void
  onUnassign(playerId: string, tokenId: string): void
  onKick(clientId: string): void
  onVisionRadiusChange(playerId: string, radius: number): void
  onRevealPlan(playerId: string): void
  onHidePlan(playerId: string): void
}

/** Esc fecha o "Mais" e para aqui: no editor ele cancelaria a ferramenta. */
function closeOnEscape(event: KeyboardEvent, close: () => void): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  close()
}

/**
 * O nome à vista e, para o leitor de tela, o status inteiro ("Ana — jogando
 * · conectado"). A vista mostra só o que foge do normal ("aguardando",
 * "fora"), com `aria-hidden` para o leitor não ouvir duas vezes. É também
 * por "<nome> —" que as jornadas acham o cartão.
 */
function PlayerName({ player }: { player: PlayerInfo }) {
  return (
    <>
      <strong className="lb-player__name" title={player.name}>
        {player.name}
      </strong>
      <span className="lb-sr-only">{` — ${playerStatusLabel(player)}`}</span>{' '}
    </>
  )
}

/** As fichas do jogador, cada uma com o × que a tira dele (o "Remover …" de sempre, do tamanho da linha). */
function TokenChips({ player, tokens, onUnassign }: { player: PlayerInfo } & Pick<PlayerAdminProps, 'tokens' | 'onUnassign'>) {
  if (player.tokenIds.length === 0) return null
  return (
    <span className="lb-player__tokens">
      {player.tokenIds.map((tokenId) => {
        const name = tokenName(tokens, tokenId)
        return (
          <span key={tokenId} className="lb-chip">
            <span className="lb-chip__label" title={name}>
              {name}
            </span>
            <button
              type="button"
              className="lb-chip__remove"
              aria-label={`Remover ${name}`}
              title={`Remover ${name} de ${player.name}`}
              onClick={() => onUnassign(player.playerId, tokenId)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </span>
        )
      })}
    </span>
  )
}

function VisionRadiusField({ player, onVisionRadiusChange }: { player: PlayerInfo } & Pick<PlayerAdminProps, 'onVisionRadiusChange'>) {
  const radiusId = `lb-room-vision-${player.playerId}`
  return (
    <div className="lb-player__radius">
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
    </div>
  )
}

interface MoreToggleProps {
  player: PlayerInfo
  open: boolean
  panelId: string
  /** O que tem dentro, para quem para o ponteiro no "…". */
  title: string
  buttonRef: RefObject<HTMLButtonElement | null>
  onToggle(): void
  onClose(): void
}

/** O "…" da linha: o mesmo glifo e o mesmo peso do menu da lista Cenas. */
function MoreToggle({ player, open, panelId, title, buttonRef, onToggle, onClose }: MoreToggleProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="lb-player__mais"
      aria-label={`Mais de ${player.name}`}
      title={title}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (open) closeOnEscape(event, onClose)
      }}
    >
      <span aria-hidden="true">…</span>
    </button>
  )
}

interface MorePanelProps extends PlayerAdminProps {
  player: PlayerInfo
  id: string
  /** Outra ficha e raio de visão. Quem aguarda já tem os dois à vista no cartão: lá o "Mais" é só o resto. */
  withSetup: boolean
  onClose(): void
}

/**
 * O "Mais": o que o mestre usa pouco — outra ficha, raio de visão, planta e
 * Expulsar. Um aberto por vez, então a dica da planta aparece uma vez só.
 */
function MorePanel({ player, id, withSetup, onClose, ...admin }: MorePanelProps) {
  const hintId = `${id}-dica`
  const clientId = player.clientId
  return (
    <div id={id} className="lb-player__panel" role="group" aria-label={`Mais de ${player.name}`} onKeyDown={(event) => closeOnEscape(event, onClose)}>
      {withSetup && <AssignControls player={player} tokens={admin.tokens} owners={admin.owners} onAssign={admin.onAssign} />}
      {withSetup && <VisionRadiusField player={player} onVisionRadiusChange={admin.onVisionRadiusChange} />}
      <div className="lb-player__plan">
        <button type="button" className="lb-btn lb-btn--compact" aria-describedby={hintId} onClick={() => admin.onRevealPlan(player.playerId)}>
          Revelar planta
        </button>
        <button type="button" className="lb-btn lb-btn--compact" onClick={() => admin.onHidePlan(player.playerId)}>
          Esconder de novo
        </button>
      </div>
      <p id={hintId} className="lb-field__hint">
        {PLAN_HINT}
      </p>
      {/* Desconectado não tem Expulsar: não há conexão para derrubar. */}
      {clientId !== null && (
        <button type="button" className="lb-btn lb-btn--danger lb-btn--compact lb-player__kick" onClick={() => admin.onKick(clientId)}>
          Expulsar
        </button>
      )}
    </div>
  )
}

interface PlayerCardProps extends PlayerAdminProps {
  player: PlayerInfo
  moreOpen: boolean
  onToggleMore(): void
  onCloseMore(): void
}

/** Estado do "…" de um cartão: fechar pelo Esc devolve o foco ao botão que abriu. */
function useMore(player: PlayerInfo, onCloseMore: () => void) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = `lb-room-more-${player.playerId}`
  const close = () => {
    onCloseMore()
    buttonRef.current?.focus()
  }
  return { buttonRef, panelId, close }
}

/**
 * Quem espera personagem: no topo do Grupo e aberto — atribuir em um clique,
 * a lista e o raio de visão à vista (o mestre acerta a lanterna antes de dar
 * a ficha). Planta e Expulsar ficam no "Mais".
 */
function WaitingCard({ player, moreOpen, onToggleMore, onCloseMore, ...admin }: PlayerCardProps) {
  const more = useMore(player, onCloseMore)
  return (
    <div className="lb-field lb-player lb-player--waiting">
      <div className="lb-player__line">
        <span className="lb-party__dot" aria-hidden="true" />
        <PlayerName player={player} />
        <span className="lb-player__status" aria-hidden="true">
          aguardando
        </span>{' '}
        <TokenChips player={player} tokens={admin.tokens} onUnassign={admin.onUnassign} />
        <MoreToggle
          player={player}
          open={moreOpen}
          panelId={more.panelId}
          title="Planta e Expulsar"
          buttonRef={more.buttonRef}
          onToggle={onToggleMore}
          onClose={more.close}
        />
      </div>
      <AssignControls player={player} tokens={admin.tokens} owners={admin.owners} onAssign={admin.onAssign} />
      <VisionRadiusField player={player} onVisionRadiusChange={admin.onVisionRadiusChange} />
      {moreOpen && <MorePanel {...admin} player={player} id={more.panelId} withSetup={false} onClose={more.close} />}
    </div>
  )
}

interface PlayerRowProps extends PlayerCardProps {
  /** A linha do Grupo deste jogador; ausente sem o `party` (painel montado sem aventura nem câmera). */
  member: PartyMember | undefined
  party: PartySectionProps | undefined
  sendOpen: boolean
  sendFormId: string
  onToggleSend(opener: HTMLElement): void
  giveOpen: boolean
  giveFormId: string
  onToggleGive(opener: HTMLElement): void
}

/**
 * Uma linha por jogador em jogo, todas da mesma altura: bolinha na cor da
 * ficha, nome, status e cena, as fichas e as ações de mesa. O raro (outra
 * ficha, raio, planta, Expulsar) fica no "Mais".
 */
function PlayerRow({ player, member, party, sendOpen, sendFormId, onToggleSend, giveOpen, giveFormId, onToggleGive, moreOpen, onToggleMore, onCloseMore, ...admin }: PlayerRowProps) {
  const more = useMore(player, onCloseMore)
  const token = member?.token ?? null
  const where = member?.sceneName ?? null
  const presence = partyPresenceLabel(player)
  // A presença só aparece na exceção ("fora"): em 212 px, "online" em seis linhas
  // cortaria a cena, que é o que o mestre procura aqui. "online" fica para o leitor.
  const presenceView = player.connected ? (
    <span className="lb-sr-only">{`${presence} `}</span>
  ) : (
    <span className="lb-player__away" aria-hidden="true">
      {where === null ? presence : `${presence} · `}
    </span>
  )
  return (
    <li className={player.connected ? 'lb-party__item' : 'lb-party__item lb-party__item--away'}>
      <div className="lb-field lb-player">
        <div className="lb-player__line">
          {/* Sem ficha, sem cor: a bolinha vazia diz "não está no mapa". */}
          <span className="lb-party__dot" aria-hidden="true" style={token === null ? undefined : { background: token.color }} />
          <PlayerName player={player} />
          <span className="lb-player__meta" title={where ?? undefined}>
            {presenceView}
            {where}
          </span>{' '}
          <TokenChips player={player} tokens={admin.tokens} onUnassign={admin.onUnassign} />
        </div>
        {member !== undefined && <PartyBackpack member={member} onItem={party?.onItem} />}
        <div className="lb-player__line lb-player__line--acoes">
          {member !== undefined && party !== undefined && token !== null && (
            <PartyActions
              member={member}
              party={party}
              sendOpen={sendOpen}
              sendFormId={sendFormId}
              onToggleSend={onToggleSend}
              giveOpen={giveOpen}
              giveFormId={giveFormId}
              onToggleGive={onToggleGive}
            />
          )}
          {member !== undefined && token === null && <span className="lb-player__note">sem ficha no mapa</span>}
          <MoreToggle
            player={player}
            open={moreOpen}
            panelId={more.panelId}
            title="Outra ficha, raio de visão, planta e Expulsar"
            buttonRef={more.buttonRef}
            onToggle={onToggleMore}
            onClose={more.close}
          />
        </div>
        {moreOpen && <MorePanel {...admin} player={player} id={more.panelId} withSetup onClose={more.close} />}
      </div>
    </li>
  )
}

interface GroupRosterProps extends Omit<PlayerAdminProps, 'owners'> {
  players: PlayerInfo[]
  party: PartySectionProps | undefined
}

/**
 * O Grupo: UMA lista com a mesa inteira, uma linha por jogador. Antes eram
 * duas (Grupo e Jogadores) com as mesmas pessoas, e cada card de Jogadores
 * empilhava atribuir, lista, raio, planta, dica e Expulsar: com 7 jogadores,
 * ~50 controles e o Grupo com 4 linhas à vista. Quem espera personagem vem
 * primeiro, aberto; o resto na ordem de chegada.
 */
function GroupRoster({ players, party, ...rest }: GroupRosterProps) {
  const headingId = useId()
  const sendFormId = useId()
  const giveFormId = useId()
  const [moreId, setMoreId] = useState<string | null>(null)
  const send = usePartySend()
  const admin: PlayerAdminProps = { ...rest, owners: tokenOwners(players) }
  const members = new Map((party?.members ?? []).map((member) => [member.playerId, member]))
  const waiting = players.filter(waitingNow)
  const inPlay = players.filter((player) => !waitingNow(player))
  const sending = send.sendingId === null ? undefined : members.get(send.sendingId)
  const giving = send.givingId === null ? undefined : members.get(send.givingId)
  const cardProps = (player: PlayerInfo): PlayerCardProps => ({
    ...admin,
    player,
    moreOpen: moreId === player.playerId,
    onToggleMore: () => setMoreId((current) => (current === player.playerId ? null : player.playerId)),
    onCloseMore: () => setMoreId(null),
  })

  return (
    <section className="lb-party" aria-labelledby={headingId}>
      <div className="lb-party__head">
        <h3 id={headingId} className="lb-eyebrow">
          Grupo
        </h3>
        {players.length > 0 && (
          <span className={waiting.length > 0 ? 'lb-party__count lb-party__count--waiting' : 'lb-party__count'}>{groupCountLabel(players.length, waiting.length)}</span>
        )}
      </div>
      {players.length === 0 && <p className="lb-player__note">{EMPTY_GROUP_HINT}</p>}
      {waiting.map((player) => (
        <WaitingCard key={player.playerId} {...cardProps(player)} />
      ))}
      {inPlay.length > 0 && (
        <ul className="lb-party__list">
          {inPlay.map((player) => (
            <PlayerRow
              key={player.playerId}
              {...cardProps(player)}
              member={members.get(player.playerId)}
              party={party}
              sendOpen={send.sendingId === player.playerId}
              sendFormId={sendFormId}
              onToggleSend={(opener) => send.toggle(player.playerId, opener)}
              giveOpen={send.givingId === player.playerId}
              giveFormId={giveFormId}
              onToggleGive={(opener) => send.toggle(player.playerId, opener, 'give')}
            />
          ))}
        </ul>
      )}
      {sending !== undefined && sending.token !== null && party !== undefined && <PartySendForm member={sending} party={party} formId={sendFormId} onClose={send.close} />}
      {giving !== undefined && giving.token !== null && party !== undefined && <PartyGiveForm member={giving} party={party} formId={giveFormId} onClose={send.close} />}
    </section>
  )
}

export function RoomPanel({
  room,
  players,
  tokens,
  party,
  tunnel,
  onStart,
  onStop,
  onStartTunnel,
  onStopTunnel,
  onAssign,
  onUnassign,
  onKick,
  onVisionRadiusChange,
  onRevealPlan,
  onHidePlan,
  laserOn = false,
  onToggleLaser,
}: RoomPanelProps) {
  const inviteId = useId()
  if (room === null) {
    return (
      <section className="lb-panel lb-section lb-room lb-scroll">
        <h2 className="lb-eyebrow">Sala</h2>
        <button type="button" className="lb-btn lb-btn--primary lb-btn--block" onClick={onStart}>
          Abrir sala
        </button>
        <FirewallHint />
      </section>
    )
  }
  return (
    <section className="lb-panel lb-section lb-room lb-scroll">
      {/* Uma linha: o código (o que o jogador digita para entrar) e o Laser, que se usa a cena toda. */}
      <div className="lb-room__head">
        <h2 className="lb-eyebrow">Sala</h2>
        <strong className="lb-room__code" title="Código da sala">
          {room.code}
        </strong>
        {onToggleLaser !== undefined && (
          <button
            type="button"
            className={laserOn ? 'lb-btn lb-btn--compact lb-btn--primary' : 'lb-btn lb-btn--compact'}
            aria-pressed={laserOn}
            title={LASER_HINT}
            onClick={onToggleLaser}
          >
            Laser
          </button>
        )}
      </div>

      {/* O Grupo logo abaixo: é o que o mestre consulta a cada cena. Convite e Fechar sala são de montar e desmontar a mesa. */}
      <GroupRoster
        players={players}
        party={party}
        tokens={tokens}
        onAssign={onAssign}
        onUnassign={onUnassign}
        onKick={onKick}
        onVisionRadiusChange={onVisionRadiusChange}
        onRevealPlan={onRevealPlan}
        onHidePlan={onHidePlan}
      />

      <section className="lb-room__invite" aria-labelledby={inviteId}>
        <h3 id={inviteId} className="lb-eyebrow">
          Convidar jogadores
        </h3>
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
      </section>

      <button type="button" className="lb-btn lb-btn--danger lb-btn--block" onClick={onStop}>
        Fechar sala
      </button>
    </section>
  )
}
