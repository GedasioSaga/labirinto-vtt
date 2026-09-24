import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  MAX_SCENE_MEMORIES_PER_PLAYER,
  VISION_RADIUS_MAX,
  VISION_RADIUS_MIN,
  VISION_RADIUS_STEP,
  type GiveMapOutcome,
  type HostWorld,
  type PlayerInfo,
} from '../net/hostSession'
import type { RoomInfo, TunnelState } from '../net/hostBridge'
import { giftableRoomsOf } from '../lib/fogFilter'
import { normalizeForSearch } from '../lib/mapObjects'
import { PartySection, type PartySectionProps } from './PartySection'

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
  /** Seção "Grupo" (uma linha por jogador, "Ir lá" e "Mandar para…"). Ausente = sem a seção. */
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
  /**
   * "Passar o mapa de Ana a…": o que `fromPlayerId` explorou na cena onde está
   * passa a `toPlayerId`, e só a ele. `false` = nada passou (ele ainda não
   * explorou a cena, ou a sala fechou). Ausente = o painel não oferece.
   */
  onShareMap?(fromPlayerId: string, toPlayerId: string): boolean
  /** MAPA DE PAPEL: as cenas com Salas que podem ir num mapa (`giftScenesOf`). Vazio ou ausente = o card não oferece. */
  giftScenes?: GiftScene[]
  /**
   * "Dar um mapa a…": grava as Salas `roomIds` da cena `sceneId` na memória de
   * `playerId`. Devolve quantas entraram (0 = nada foi) ou `memoria-cheia`.
   */
  onGiveMap?(playerId: string, sceneId: string | null, roomIds: string[]): GiveMapOutcome
  /** Botão "Laser" ligado: arma o laser (independe de segurar L); o traço sai clicando no mapa. */
  laserOn?: boolean
  onToggleLaser?(): void
}

export const PLAN_HINT = 'Revelar planta mostra paredes, salas e portas, sem os tokens. Zonas ocultas continuam escondidas.'
export const SHARE_MAP_HINT = 'Passa o que ele já explorou na cena onde está. Só quem recebe passa a conhecer; zonas ocultas continuam escondidas.'
export const GIVE_MAP_HINT = 'Só quem recebe passa a conhecer essas salas, de qualquer cena, como um mapa achado. Salas ocultas, com teto ou em zona oculta ficam de fora.'
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

/** Uma cena no "Dar um mapa a…": o nome que o MESTRE lê e as Salas que podem ir no papel. */
export interface GiftScene {
  sceneId: string | null
  name: string
  rooms: { id: string; name: string }[]
}

const UNNAMED_ROOM = 'Sala sem nome'

/**
 * MAPA DE PAPEL: cada cena do mundo com as Salas que o jogador pode ver
 * (`giftableRoomsOf`), a aberta primeiro. Cena sem nenhuma fica de fora.
 */
export function giftScenesOf(world: HostWorld): GiftScene[] {
  return [world.open, ...world.background].flatMap((scene) => {
    const rooms = giftableRoomsOf(scene.map).map((region) => ({ id: region.id, name: region.room?.name.trim() || UNNAMED_ROOM }))
    return rooms.length === 0 ? [] : [{ sceneId: scene.sceneId, name: scene.name, rooms }]
  })
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

  return (
    <>
      {waiting && quick.length > 0 && (
        <>
          {/* Quem aguarda está numa tela parada: dar personagem é UM clique, sem abrir lista. */}
          <span className="lb-label">Sem personagem — atribua em um clique</span>
          {quick.map((token) => (
            <button key={token.id} type="button" className="lb-btn lb-btn--primary" onClick={() => onAssign(player.playerId, token.id)}>
              <span aria-hidden="true" style={{ color: tokenDotColor(token.id) }}>
                ●{' '}
              </span>
              {quickAssignLabel(token)}
            </button>
          ))}
        </>
      )}
      {waiting && quick.length === 0 && list.length > 0 && <span className="lb-label">Nenhuma ficha livre — escolha na lista abaixo.</span>}
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

interface ShareMapControlsProps {
  player: PlayerInfo
  players: PlayerInfo[]
  onShareMap(fromPlayerId: string, toPlayerId: string): boolean
}

/**
 * PASSAR O MAPA pelo mestre: lista com quem joga NA MESMA cena de quem doa,
 * no card dele (`sceneId` igual; sem aventura, os dois sem cena = o mesmo
 * mapa). Quem está noutra cena não entra: o trecho não apareceria para ele
 * agora. Escolher passa na hora (não tira nada de ninguém, então não pede
 * confirmação) e a lista volta ao "Escolher…"; a linha de status diz se passou.
 */
function ShareMapControls({ player, players, onShareMap }: ShareMapControlsProps) {
  const [status, setStatus] = useState<string | null>(null)
  const selectId = `lb-room-share-${player.playerId}`
  const others = players.filter(
    (other) => other.playerId !== player.playerId && other.status === 'playing' && other.sceneId === player.sceneId,
  )
  if (player.status !== 'playing' || others.length === 0) return null

  const share = (toPlayerId: string) => {
    const target = others.find((other) => other.playerId === toPlayerId)
    if (target === undefined) return
    setStatus(
      onShareMap(player.playerId, toPlayerId)
        ? `Mapa de ${player.name} passado a ${target.name}.`
        : `Nada passou: ${player.name} ainda não explorou a cena onde está, ou ${target.name} saiu dela.`,
    )
  }

  return (
    <>
      <label className="lb-label" htmlFor={selectId}>
        Passar o mapa de {player.name} a
      </label>
      <select
        id={selectId}
        className="lb-input"
        value=""
        onChange={(event) => {
          if (event.target.value !== '') share(event.target.value)
        }}
      >
        <option value="">Escolher…</option>
        {others.map((other) => (
          <option key={other.playerId} value={other.playerId}>
            {other.name}
          </option>
        ))}
      </select>
      {status !== null && (
        <p className="lb-label" role="status">
          {status}
        </p>
      )}
      <p className="lb-label">{SHARE_MAP_HINT}</p>
    </>
  )
}

interface GiveMapControlsProps {
  player: PlayerInfo
  scenes: GiftScene[]
  onGiveMap(playerId: string, sceneId: string | null, roomIds: string[]): GiveMapOutcome
}

/** `<select>` só leva texto: a cena do mapa solto (`null`) vira ''. */
const sceneValue = (sceneId: string | null): string => sceneId ?? ''

const roomsLabel = (count: number): string => (count === 1 ? '1 sala' : `${count} salas`)

/** Linha de status do "Entregar": o que entrou, ou por que nada entrou. */
function giveMapStatus(playerName: string, outcome: GiveMapOutcome): string {
  if (outcome === 'memoria-cheia') {
    return `Nada foi: a memória de ${playerName} já guarda ${MAX_SCENE_MEMORIES_PER_PLAYER} cenas, e o mapa de uma cena nova apagaria a mais antiga explorada.`
  }
  return outcome > 0
    ? `Mapa entregue a ${playerName}: ${roomsLabel(outcome)}.`
    : 'Nada foi: essas salas estão ocultas para jogadores agora, ou a sala da mesa fechou.'
}

/**
 * MAPA DE PAPEL — "Dar um mapa a…" no card do jogador: o mestre escolhe a
 * cena (a do jogador vem escolhida), marca as Salas — com filtro por nome,
 * sem acento nem maiúscula, porque uma cena grande tem centenas — e entrega.
 * Só quem recebe passa a conhecer; a linha de status conta quantas foram.
 * Esc fecha e devolve o foco ao botão que abre.
 */
function GiveMapControls({ player, scenes, onGiveMap }: GiveMapControlsProps) {
  const [open, setOpen] = useState(false)
  const [chosenScene, setChosenScene] = useState<string | null>(null)
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const openButtonRef = useRef<HTMLButtonElement | null>(null)
  const baseId = `lb-room-give-${player.playerId}`

  // A cena escolhida, a do jogador ou a primeira; cena que sumiu do mundo cai na primeira.
  const wanted = chosenScene ?? sceneValue(player.sceneId ?? null)
  const scene = scenes.find((s) => sceneValue(s.sceneId) === wanted) ?? scenes[0]
  if (scene === undefined) return null
  const needle = normalizeForSearch(filter.trim())
  const shown = needle === '' ? scene.rooms : scene.rooms.filter((room) => normalizeForSearch(room.name).includes(needle))
  // Só conta o que é desta cena: marcado noutra não vai junto.
  const picked = scene.rooms.filter((room) => checked.has(room.id)).map((room) => room.id)

  const close = () => {
    setOpen(false)
    openButtonRef.current?.focus()
  }

  const toggle = (roomId: string, on: boolean) => {
    setChecked((current) => {
      const next = new Set(current)
      if (on) next.add(roomId)
      else next.delete(roomId)
      return next
    })
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (picked.length === 0) return
    const given = onGiveMap(player.playerId, scene.sceneId, picked)
    setStatus(giveMapStatus(player.name, given))
    if (typeof given === 'number' && given > 0) setChecked(new Set())
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha sem entregar; não pode chegar ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    close()
  }

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        className="lb-btn lb-btn--ghost"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-form` : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        Dar um mapa a {player.name}
      </button>
      {open && (
        <form id={`${baseId}-form`} className="lb-party__send" aria-label={`Mapa de papel para ${player.name}`} onSubmit={submit} onKeyDown={onKeyDown}>
          <label className="lb-label" htmlFor={`${baseId}-scene`}>
            Cena do mapa
          </label>
          <select
            id={`${baseId}-scene`}
            className="lb-input"
            value={sceneValue(scene.sceneId)}
            onChange={(event) => {
              setChosenScene(event.target.value)
              setChecked(new Set())
              setStatus(null)
            }}
          >
            {scenes.map((s) => (
              <option key={sceneValue(s.sceneId)} value={sceneValue(s.sceneId)}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="lb-label" htmlFor={`${baseId}-filter`}>
            Filtrar salas
          </label>
          <input id={`${baseId}-filter`} className="lb-input" type="search" value={filter} onChange={(event) => setFilter(event.target.value)} />
          {shown.length === 0 ? (
            <p className="lb-label">Nenhuma sala com esse nome.</p>
          ) : (
            <ul className="lb-gather__list lb-papel__list" aria-label="Salas do mapa">
              {shown.map((room) => {
                const checkId = `${baseId}-room-${room.id}`
                return (
                  <li key={room.id}>
                    <label className="lb-gather__item" htmlFor={checkId}>
                      <input
                        id={checkId}
                        type="checkbox"
                        className="lb-gather__check"
                        checked={checked.has(room.id)}
                        onChange={(event) => toggle(room.id, event.target.checked)}
                      />
                      <span className="lb-party__name">{room.name}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          <button type="submit" className="lb-btn lb-btn--primary" disabled={picked.length === 0} aria-describedby={picked.length === 0 ? `${baseId}-hint` : undefined}>
            {picked.length === 0 ? 'Entregar' : `Entregar ${roomsLabel(picked.length)}`}
          </button>
          {picked.length === 0 && (
            <p className="lb-label" id={`${baseId}-hint`}>
              Marque ao menos uma sala.
            </p>
          )}
          {status !== null && (
            <p className="lb-label" role="status">
              {status}
            </p>
          )}
          <p className="lb-label">{GIVE_MAP_HINT}</p>
        </form>
      )}
    </>
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
  onShareMap,
  giftScenes = [],
  onGiveMap,
  laserOn = false,
  onToggleLaser,
}: RoomPanelProps) {
  const waitingCount = players.filter((player) => player.status === 'waiting' && player.connected).length
  const owners = tokenOwners(players)
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

          {/* O grupo vem antes do resto: é o que o mestre consulta a cada cena, o resto é de montar a sala. */}
          {party !== undefined && party.members.length > 0 && <PartySection {...party} />}

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
            const radiusId = `lb-room-vision-${player.playerId}`
            const clientId = player.clientId
            return (
              <div key={player.playerId} className="lb-field">
                <span className="lb-label">
                  {player.name} — {playerStatusLabel(player)}
                  {/* Com aventura, o grupo pode estar espalhado: o mestre lê onde cada um está. */}
                  {player.sceneName !== undefined && ` · em ${player.sceneName}`}
                </span>
                {player.tokenIds.map((tokenId) => (
                  <button key={tokenId} type="button" className="lb-btn lb-btn--ghost" onClick={() => onUnassign(player.playerId, tokenId)}>
                    Remover {tokenName(tokens, tokenId)}
                  </button>
                ))}
                <AssignControls player={player} tokens={tokens} owners={owners} onAssign={onAssign} />
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
                {onShareMap !== undefined && <ShareMapControls player={player} players={players} onShareMap={onShareMap} />}
                {onGiveMap !== undefined && giftScenes.length > 0 && <GiveMapControls player={player} scenes={giftScenes} onGiveMap={onGiveMap} />}
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
