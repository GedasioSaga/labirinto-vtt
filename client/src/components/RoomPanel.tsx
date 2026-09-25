import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import { partyPresenceLabel, type PartyMember } from '../lib/party'
import {
  MAX_SCENE_MEMORIES_PER_PLAYER,
  ownTokenIdsOf,
  VISION_RADIUS_MAX,
  VISION_RADIUS_MIN,
  VISION_RADIUS_STEP,
  type GiveMapOutcome,
  type HostWorld,
  type PlayerInfo,
} from '../net/hostSession'
import { giftableRoomsOf } from '../lib/fogFilter'
import { normalizeForSearch } from '../lib/mapObjects'
import { VISION_FACTOR_MAX, VISION_FACTOR_MIN, VISION_FACTOR_STEP, formatVisionFactor } from '../lib/sceneVision'
import { NOISE_RANGE_OPTIONS } from '../lib/noise'
import type { RoomInfo, TunnelState } from '../net/hostBridge'
import { CluesSection, type CluesSectionProps } from './CluesSection'
import { SecretCheckSection, type SecretCheckSectionProps } from './SecretCheckSection'
import {
  PartyActions,
  PartyAwayTokens,
  PartyBackpack,
  PartyDestinationMark,
  PartyGiveForm,
  PartyNoteForm,
  PartySendForm,
  playerNoteFeedbackText,
  useNoteFeedback,
  useOfflineClock,
  usePartySend,
  type PartySectionProps,
} from './PartySection'
import { InitiativeSection, type InitiativeSectionProps } from './InitiativeSection'
import { CampaignClockSection, type CampaignClockSectionProps } from './CampaignClockSection'
import { TableScreenSection, type TableScreenSectionProps } from './TableScreenSection'
import { TravelLogSection, type TravelLogSectionProps } from './TravelLogSection'
import { textoDaEsperaParaOMestre } from '../lib/encontroMarcado'

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
  /**
   * Seção "Pistas" (quem recebeu e quem leu cada pino "!"/"?"), com a sala aberta
   * e alguém nela. Obrigatória de propósito: esquecer de ligá-la no App vira erro
   * de tipo, e não um painel que some da tela em silêncio.
   */
  clues: CluesSectionProps
  /** Seção "Teste secreto" (pedir a escolhidos e ler as respostas). Ausente = sem a seção. */
  secretCheck?: SecretCheckSectionProps
  /** Seção "Iniciativa" (ordem e vez). Ausente = sem a seção. Aparece com a sala aberta ou fechada. */
  initiative?: InitiativeSectionProps
  /** Seção "Relógio da campanha" (hora do dia e cena externa). Ausente = sem a seção. Aparece com a sala aberta ou fechada. */
  clock?: CampaignClockSectionProps
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
  /** "Fator de visão" do jogador, que multiplica o alcance de toda cena. */
  onVisionFactorChange(playerId: string, factor: number): void
  onRevealPlan(playerId: string): void
  onHidePlan(playerId: string): void
  /**
   * "Dar o que o grupo viu": o jogador ganha o que os colegas viram na cena
   * onde ele está. Devolve quantos colegas (0 = ninguém mais explorou), ou
   * `null` se não deu. Ausente = o card fica sem o botão.
   */
  onGiveGroupView?(playerId: string): number | null
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
  /** "Ruído": arma o ruído (o próximo clique no mapa o dispara) e escolhe o alcance. Ausente = sem o controle. */
  noise?: NoiseControlProps
  /** Seção "Tela da mesa" (link da TV e a cena que ela mostra). Ausente = sem a seção. */
  table?: TableScreenSectionProps
}

export interface NoiseControlProps {
  armed: boolean
  /** Alcance em casas (um de `NOISE_RANGE_OPTIONS`). */
  rangeCells: number
  onToggle(): void
  onRangeChange(cells: number): void
}

export const NOISE_BUTTON_LABEL = 'Ruído'
export const NOISE_HINT = 'Ligado, clique no mapa onde algo fez barulho. Quem estiver perto ouve só a direção, nunca o lugar nem o que foi.'

export const PLAN_HINT = 'Revelar planta mostra paredes, salas e portas, sem os tokens. Zonas ocultas continuam escondidas.'
export const GROUP_VIEW_LABEL = 'Dar o que o grupo viu'
/** Quanto tempo o aviso do "Dar o que o grupo viu" fica no card. */
export const GROUP_VIEW_FEEDBACK_MS = 4000

/** O aviso depois de "Dar o que o grupo viu": de quantos colegas veio, ou por que não veio nada. */
export function groupViewFeedbackText(name: string, colleagues: number | null): string {
  if (colleagues === null) return 'Não deu: a sala não está aberta.'
  if (colleagues === 0) return `Ninguém mais explorou a cena de ${name}`
  return colleagues === 1 ? `${name} recebeu o que 1 colega viu` : `${name} recebeu o que ${colleagues} colegas viram`
}
export const SHARE_MAP_HINT = 'Passa o que ele já explorou na cena onde está. Só quem recebe passa a conhecer; zonas ocultas continuam escondidas.'
export const GIVE_MAP_HINT = 'Só quem recebe passa a conhecer essas salas, de qualquer cena, como um mapa achado. Salas ocultas, com teto ou em zona oculta ficam de fora.'
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
  // Volto já: o mestre lê que ele saiu de propósito, conectado ou não.
  if (player.away === true) return `${status} · volto já`
  return `${status} · ${player.connected ? 'conectado' : 'desconectado'}`
}

/** "9 quadrados", "7,8 quadrados": quanto este jogador enxerga na cena dele (cena x fator). */
export function sceneCellsLabel(cells: number, factor: number): string {
  const seen = Math.round(cells * factor * 10) / 10
  return `${String(seen).replace('.', ',')} ${seen === 1 ? 'quadrado' : 'quadrados'}`
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

/** Botão "Ruído" (arma o próximo clique no mapa) e a lista do alcance. */
function NoiseControl({ armed, rangeCells, onToggle, onRangeChange }: NoiseControlProps) {
  const rangeId = 'lb-room-noise-range'
  return (
    <div className="lb-field">
      <button type="button" className={armed ? 'lb-btn lb-btn--primary lb-btn--block' : 'lb-btn lb-btn--block'} aria-pressed={armed} onClick={onToggle}>
        {NOISE_BUTTON_LABEL}
      </button>
      <label className="lb-label" htmlFor={rangeId}>
        Alcance do ruído
      </label>
      <select id={rangeId} className="lb-input" value={String(rangeCells)} onChange={(event) => onRangeChange(Number(event.target.value))}>
        {NOISE_RANGE_OPTIONS.map((option) => (
          <option key={option.cells} value={String(option.cells)}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="lb-label">{NOISE_HINT}</p>
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

/** O que um cartão de jogador precisa da sala para agir nele. */
interface PlayerAdminProps {
  tokens: RoomPanelToken[]
  owners: ReadonlyMap<string, string>
  onAssign(playerId: string, tokenId: string): void
  onUnassign(playerId: string, tokenId: string): void
  onKick(clientId: string): void
  onVisionRadiusChange(playerId: string, radius: number): void
  /** "Fator de visão" do jogador, que multiplica o alcance de toda cena. */
  onVisionFactorChange(playerId: string, factor: number): void
  onRevealPlan(playerId: string): void
  onHidePlan(playerId: string): void
  /** "Guardar ficha" de quem está fora. Ausente = sem o botão. */
  onStoreTokens?(playerId: string): void
  /** "Dispensar" quem está fora. Ausente = sem o botão. */
  onDismiss?(playerId: string): void
  /** "Emprestar ficha a" de quem está fora. Ausente (ou sem `onEndLoans`) = sem a lista. */
  onLendTokens?(ownerId: string, borrowerId: string): void
  /** "Tomar de volta" da ficha emprestada. */
  onEndLoans?(ownerId: string): void
  /** A mesa inteira: o "Passar o mapa de … a" oferece quem joga na mesma cena. */
  roster: PlayerInfo[]
  /** "Passar o mapa de … a". Ausente = sem a lista. */
  onShareMap?(fromPlayerId: string, toPlayerId: string): boolean
  /** MAPA DE PAPEL: as cenas que podem ir num mapa. Vazio ou ausente = sem o "Dar um mapa a". */
  giftScenes?: GiftScene[]
  /** "Dar um mapa a…". Ausente = sem o botão. */
  onGiveMap?(playerId: string, sceneId: string | null, roomIds: string[]): GiveMapOutcome
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
        <p className="lb-player__note">
          Ficha emprestada a {player.lentTo.join(', ')}. Volta sozinha quando {player.name} voltar.
        </p>
        <button type="button" className="lb-btn lb-btn--compact" onClick={() => onEndLoans(player.playerId)}>
          Tomar de volta
        </button>
      </>
    )
  }
  const borrowers = players.filter((other) => other.connected && other.playerId !== player.playerId)
  // Só a ficha DELE se empresta: a que ele joga emprestada é do dono, e a sessão recusaria reemprestá-la.
  if (ownTokenIdsOf(player).length === 0 || borrowers.length === 0) return null
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

/**
 * Quem foi embora: a ficha dele não pode ficar no corredor para sempre, nem a
 * linha na lista. "Ficha guardada" diz o que volta com ele; "Guardar ficha"
 * tira a ficha do mapa até ele voltar; "Emprestar ficha a" põe outro jogador
 * para jogá-la até ele voltar; "Dispensar" tira a linha. Conectado não tem
 * nada disso: o "Expulsar" dele fica no "Mais".
 */
function AwayControls({
  player,
  players,
  onStoreTokens,
  onDismiss,
  onLendTokens,
  onEndLoans,
}: { player: PlayerInfo; players: PlayerInfo[] } & Pick<PlayerAdminProps, 'onStoreTokens' | 'onDismiss' | 'onLendTokens' | 'onEndLoans'>) {
  if (player.clientId !== null) return null
  const stored = player.storedTokenNames ?? []
  // Emprestada, a ficha está em jogo com outro: guardar a tiraria do mapa debaixo dele.
  // E a que ele joga emprestada é do dono: só conta a dele.
  const canStore = onStoreTokens !== undefined && ownTokenIdsOf(player).length > 0 && player.lentTo === undefined
  const canLend = onLendTokens !== undefined && onEndLoans !== undefined
  if (stored.length === 0 && !canStore && !canLend && onDismiss === undefined) return null
  return (
    <div className="lb-player__line lb-player__line--acoes">
      {stored.length > 0 && (
        <p className="lb-player__note">
          Ficha guardada: {stored.join(', ')}. Volta ao mapa quando {player.name} voltar.
        </p>
      )}
      {canLend && <LoanControls player={player} players={players} onLendTokens={onLendTokens} onEndLoans={onEndLoans} />}
      {canStore && (
        <button type="button" className="lb-btn lb-btn--compact" onClick={() => onStoreTokens(player.playerId)}>
          Guardar ficha
        </button>
      )}
      {onDismiss !== undefined && (
        <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={() => onDismiss(player.playerId)}>
          Dispensar
        </button>
      )}
    </div>
  )
}

/**
 * A presença que a linha lê: quem caiu leva a hora da queda, para o "fora há
 * 0:10" (`partyPresenceLabel`). Conectado ou sem hora, só o estado.
 */
function presenceOf(player: PlayerInfo): Pick<PartyMember, 'connected' | 'offlineSince'> {
  if (player.connected || player.disconnectedAt === undefined) return { connected: player.connected }
  return { connected: false, offlineSince: player.disconnectedAt }
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

/**
 * "Fator de visão" (vale em toda cena) e, embaixo, o que depende da cena: com
 * "Visão nesta cena" ativa, quantos quadrados este jogador enxerga ali (o raio
 * em px não conta nessa cena); sem valor, o raio de sempre continua.
 */
function VisionFields({
  player,
  onVisionRadiusChange,
  onVisionFactorChange,
}: { player: PlayerInfo } & Pick<PlayerAdminProps, 'onVisionRadiusChange' | 'onVisionFactorChange'>) {
  const factorId = `lb-room-vision-factor-${player.playerId}`
  return (
    <div className="lb-player__radius">
      <div className="lb-section__row">
        <label className="lb-label" htmlFor={factorId}>
          Fator de visão
        </label>
        <span className="lb-num">{formatVisionFactor(player.visionFactor)}</span>
      </div>
      <input
        id={factorId}
        className="lb-range"
        type="range"
        min={VISION_FACTOR_MIN}
        max={VISION_FACTOR_MAX}
        step={VISION_FACTOR_STEP}
        value={player.visionFactor}
        onChange={(event) => onVisionFactorChange(player.playerId, Number(event.target.value))}
      />
      {player.sceneVisionCells !== undefined ? (
        // A cena diz o alcance: o raio em px não conta aqui, e sai da frente.
        <p className="lb-field__hint">Nesta cena: {sceneCellsLabel(player.sceneVisionCells, player.visionFactor)}</p>
      ) : (
        <VisionRadiusField player={player} onVisionRadiusChange={onVisionRadiusChange} />
      )}
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
      {withSetup && <VisionFields player={player} onVisionRadiusChange={admin.onVisionRadiusChange} onVisionFactorChange={admin.onVisionFactorChange} />}
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
      {admin.onShareMap !== undefined && <ShareMapControls player={player} players={admin.roster} onShareMap={admin.onShareMap} />}
      {admin.onGiveMap !== undefined && admin.giftScenes !== undefined && admin.giftScenes.length > 0 && (
        <GiveMapControls player={player} scenes={admin.giftScenes} onGiveMap={admin.onGiveMap} />
      )}
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
      <VisionFields player={player} onVisionRadiusChange={admin.onVisionRadiusChange} onVisionFactorChange={admin.onVisionFactorChange} />
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
  /** "Recado" aberto nesta linha: o campo mora dentro dela. */
  noteOpen: boolean
  noteFormId: string
  onToggleNote(opener: HTMLElement): void
  onSendNote(text: string): void
  onCancelNote(): void
  /** O aviso do último recado a este jogador; `null` = nenhum. */
  noteFeedback: string | null
  /** "Dar o que o grupo viu" já ligado a ESTE jogador. Ausente = sem o botão. */
  onGiveGroupView?(): void
  /** O aviso do último "Dar o que o grupo viu" a este jogador; `null` = nenhum. */
  groupViewFeedback: string | null
  /** Relógio do "fora há…" (`useOfflineClock`). */
  now: number
  /** A mesa inteira: "Emprestar ficha a" oferece quem está conectado. */
  players: PlayerInfo[]
}

/**
 * Uma linha por jogador em jogo, todas da mesma altura: bolinha na cor da
 * ficha, nome, status e cena, as fichas e as ações de mesa. O raro (outra
 * ficha, raio, planta, Expulsar) fica no "Mais".
 */
function PlayerRow({
  player,
  member,
  party,
  sendOpen,
  sendFormId,
  onToggleSend,
  giveOpen,
  giveFormId,
  onToggleGive,
  noteOpen,
  noteFormId,
  onToggleNote,
  onSendNote,
  onCancelNote,
  noteFeedback,
  onGiveGroupView,
  groupViewFeedback,
  now,
  players,
  moreOpen,
  onToggleMore,
  onCloseMore,
  ...admin
}: PlayerRowProps) {
  const more = useMore(player, onCloseMore)
  const token = member?.token ?? null
  const where = member?.sceneName ?? null
  const presence = partyPresenceLabel(presenceOf(player), now)
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
        {member !== undefined && <PartyDestinationMark member={member} onViewDestination={party?.onViewDestination} />}
        {member !== undefined && <PartyAwayTokens member={member} onBring={party?.onBring} />}
        <div className="lb-player__line lb-player__line--acoes">
          {member !== undefined && party !== undefined && (
            <PartyActions
              member={member}
              party={party}
              sendOpen={sendOpen}
              sendFormId={sendFormId}
              onToggleSend={onToggleSend}
              giveOpen={giveOpen}
              giveFormId={giveFormId}
              onToggleGive={onToggleGive}
              noteOpen={noteOpen}
              noteFormId={noteFormId}
              onToggleNote={onToggleNote}
            />
          )}
          {member !== undefined && token === null && <span className="lb-player__note">sem ficha no mapa</span>}
          {/* Só quem joga tem cena: quem aguarda não tem onde receber o que o grupo viu. */}
          {onGiveGroupView !== undefined && player.status === 'playing' && (
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onGiveGroupView}>
              {GROUP_VIEW_LABEL}
            </button>
          )}
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
        {member !== undefined && party?.onNote !== undefined && noteOpen && (
          <PartyNoteForm member={member} formId={noteFormId} onSend={onSendNote} onCancel={onCancelNote} />
        )}
        {noteFeedback !== null && (
          <p className="lb-party__recado-aviso" role="status">
            {noteFeedback}
          </p>
        )}
        {groupViewFeedback !== null && (
          <p className="lb-player__note" role="status">
            {groupViewFeedback}
          </p>
        )}
        {player.borrowedFrom !== undefined && <p className="lb-player__note">Jogando também a ficha de {player.borrowedFrom.join(', ')}.</p>}
        {/* ENCONTRO MARCADO: o mestre não guarda de cabeça quem espera quem, onde e até quando. */}
        {player.waiting !== undefined && <p className="lb-player__note">{textoDaEsperaParaOMestre(player.waiting)}</p>}
        <AwayControls
          player={player}
          players={players}
          onStoreTokens={admin.onStoreTokens}
          onDismiss={admin.onDismiss}
          onLendTokens={admin.onLendTokens}
          onEndLoans={admin.onEndLoans}
        />
        {moreOpen && <MorePanel {...admin} player={player} id={more.panelId} withSetup onClose={more.close} />}
      </div>
    </li>
  )
}

interface GroupRosterProps extends Omit<PlayerAdminProps, 'owners' | 'roster'> {
  players: PlayerInfo[]
  party: PartySectionProps | undefined
  /**
   * "Dar o que o grupo viu": o jogador ganha o que os colegas viram na cena
   * onde ele está. Devolve quantos colegas (0 = ninguém mais explorou), ou
   * `null` se não deu. Ausente = o card fica sem o botão.
   */
  onGiveGroupView?(playerId: string): number | null
}

/** Aviso do último "Dar o que o grupo viu", com o mesmo formato do recado (`useNoteFeedback`). */
function useGroupViewFeedback() {
  const [feedback, setFeedback] = useState<{ playerId: string; text: string } | null>(null)
  useEffect(() => {
    if (feedback === null) return
    const timer = setTimeout(() => setFeedback(null), GROUP_VIEW_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [feedback])
  return { feedback, show: (playerId: string, text: string) => setFeedback({ playerId, text }) }
}

/**
 * O Grupo: UMA lista com a mesa inteira, uma linha por jogador. Antes eram
 * duas (Grupo e Jogadores) com as mesmas pessoas, e cada card de Jogadores
 * empilhava atribuir, lista, raio, planta, dica e Expulsar: com 7 jogadores,
 * ~50 controles e o Grupo com 4 linhas à vista. Quem espera personagem vem
 * primeiro, aberto; o resto na ordem de chegada.
 */
function GroupRoster({ players, party, onGiveGroupView, ...rest }: GroupRosterProps) {
  const headingId = useId()
  const sendFormId = useId()
  const giveFormId = useId()
  const noteFormId = useId()
  const [moreId, setMoreId] = useState<string | null>(null)
  const send = usePartySend()
  const note = useNoteFeedback()
  const groupView = useGroupViewFeedback()
  const now = useOfflineClock(players.some((player) => !player.connected && player.disconnectedAt !== undefined))
  const admin: PlayerAdminProps = { ...rest, owners: tokenOwners(players), roster: players }
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
              noteOpen={send.notingId === player.playerId}
              noteFormId={noteFormId}
              onToggleNote={(opener) => {
                note.clear()
                send.toggle(player.playerId, opener, 'note')
              }}
              onSendNote={(text) => {
                const delivery = party?.onNote?.(player.playerId, text) ?? null
                note.show(player.playerId, playerNoteFeedbackText(player.name, delivery))
                send.close()
              }}
              onCancelNote={send.close}
              noteFeedback={note.feedback?.playerId === player.playerId ? note.feedback.text : null}
              onGiveGroupView={
                onGiveGroupView === undefined
                  ? undefined
                  : () => groupView.show(player.playerId, groupViewFeedbackText(player.name, onGiveGroupView(player.playerId) ?? null))
              }
              groupViewFeedback={groupView.feedback?.playerId === player.playerId ? groupView.feedback.text : null}
              now={now}
              players={players}
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
  initiative,
  clock,
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
  onVisionFactorChange,
  onRevealPlan,
  onHidePlan,
  onGiveGroupView,
  onShareMap,
  giftScenes = [],
  onGiveMap,
  laserOn = false,
  onToggleLaser,
  table,
  clues,
  secretCheck,
  noise,
}: RoomPanelProps) {
  const inviteId = useId()
  if (room === null) {
    return (
      <section className="lb-panel lb-section lb-room lb-scroll">
        <h2 className="lb-eyebrow">Sala</h2>
        <OpenRoom savedTableNames={savedTableNames} onStart={onStart} />
        <FirewallHint />
        {/* Combate sem jogador na rede também tem ordem: a seção não espera a sala. */}
        {initiative !== undefined && <InitiativeSection {...initiative} />}
        {clock !== undefined && <CampaignClockSection {...clock} />}
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

      {noise !== undefined && <NoiseControl {...noise} />}

      {/* O Grupo logo abaixo: é o que o mestre consulta a cada cena. Convite e Fechar sala são de montar e desmontar a mesa. */}
      <GroupRoster
        players={players}
        party={party}
        tokens={tokens}
        onAssign={onAssign}
        onUnassign={onUnassign}
        onKick={onKick}
        onVisionRadiusChange={onVisionRadiusChange}
        onVisionFactorChange={onVisionFactorChange}
        onRevealPlan={onRevealPlan}
        onHidePlan={onHidePlan}
        onStoreTokens={onStoreTokens}
        onDismiss={onDismiss}
        onLendTokens={onLendTokens}
        onEndLoans={onEndLoans}
        onGiveGroupView={onGiveGroupView}
        onShareMap={onShareMap}
        giftScenes={giftScenes}
        onGiveMap={onGiveMap}
      />

      {/* Pistas logo depois do Grupo: as bolinhas são as mesmas pessoas, na mesma ordem e cor. */}
      {players.length > 0 && <CluesSection {...clues} />}

      {/* O teste secreto é de cena, como as pistas: fica perto do Grupo, não no fim da aba. */}
      {players.length > 0 && secretCheck !== undefined && <SecretCheckSection {...secretCheck} />}

      {/* Iniciativa logo depois do Grupo: no combate é o que o mestre toca a cada vez. */}
      {initiative !== undefined && <InitiativeSection {...initiative} />}

      {/* O relógio depois da iniciativa: anda entre as cenas, não a cada vez. */}
      {clock !== undefined && <CampaignClockSection {...clock} />}

      {travelLog !== undefined && <TravelLogSection {...travelLog} />}

      {table !== undefined && <TableScreenSection {...table} />}

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

