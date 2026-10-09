import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent, ComponentProps, FormEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent, RefObject } from 'react'
import type { StorageLike } from './playerConnection'
import { PlayerBackpack } from './PlayerBackpack'
import { NAME_MAX_LENGTH, type ClueEntry, type PartyMember, type PartyWhere, type OwnTokenElsewhere } from '../net/protocol'
import type { Pin, RegionPoint, TokenContract } from '../types/map'
import { loanLabel } from '../lib/tokenLoan'
import { formatNoteTime } from './PlayerNotebook'
import type { ColecaoProgresso } from '../lib/colecao'
import { PlayerChat, type PlayerChatProps } from './PlayerChat'
// `PlayerPlacesTab` e não `PlayerPlaces`: no Windows o nome colidiria com `playerPlaces.ts` (a parte pura).
import { PlayerPlacesTab } from './PlayerPlacesTab'
import { placeLabel, type VisitedPlace } from './playerPlaces'
import { PlayerCluesByPlace } from './PlayerCluesByPlace'
import { PersonalNoteList } from './PlayerPersonalNotes'
import type { PersonalNote } from './personalNotes'
import { DiceFeed, DiceForm, type DiceFeedRoll } from '../components/DiceControls'
import type { DiceRequest } from '../lib/dice'
import { PlayerMapShare, type PlayerMapShareProps } from './PlayerMapShare'
import type { PlayerMarkFormProps } from './PlayerMarkForm'
import { PlayerMarcacoes } from './PlayerMarcacoes'

/** Caderno sem pistas passadas (tela antiga, teste): a mesma lista vazia, sem objeto novo a cada render. */
const NO_CLUES: readonly ClueEntry[] = []
const IGNORE_CLUE = (): void => {}
const NO_COLECOES: readonly ColecaoProgresso[] = []
const NO_PERSONAL_NOTES: readonly PersonalNote[] = []
const IGNORE_NOTE = (): void => {}
/** Sem fichas em outra cena (mestre antigo, teste): a mesma lista vazia a cada render. */
const NO_ELSEWHERE: readonly OwnTokenElsewhere[] = []
/** Sem rolagens (ninguém rolou, tela antiga): a mesma lista vazia a cada render. */
const NO_DICE_ROLLS: readonly DiceFeedRoll[] = []
const IGNORE_SWITCH = (): void => {}

// Painel do jogador: meus personagens, ajustes de visão e centralizar a câmera.
// Fica sobre o canvas (não ao lado) para o enquadramento do mapa não depender
// da largura do painel. Em QUALQUER largura ele recolhe pelo botão "Painel",
// que mora numa barra fora do painel junto com "Minha ficha": no notebook o
// painel começa aberto, como coluna; abaixo de 700 px é gaveta e começa fechado.

/**
 * Os mesmos cortes de player.css: abaixo de 700 px de largura OU de 481 de
 * altura o painel é gaveta sobre o mapa, e não coluna. O celular deitado
 * (844 x 390) é largo, mas a coluna aberta comia 40% de um mapa de 390 px de
 * altura e passava por baixo da coluna de ações da porta: lá ele também nasce
 * fechado. Duas consultas, e não uma com vírgula: quem simula a janela nos
 * testes responde a cada corte pelo texto exato.
 */
const DRAWER_QUERIES = ['(max-width: 699px)', '(max-height: 480px)'] as const

function subscribeDrawerScreen(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const queries = DRAWER_QUERIES.map((text) => window.matchMedia(text))
  for (const query of queries) query.addEventListener('change', onChange)
  return () => {
    for (const query of queries) query.removeEventListener('change', onChange)
  }
}

/** Sem `matchMedia` (jsdom, navegador muito velho) vale a coluna: é o caso que nunca esconde nada. */
function isDrawerScreen(): boolean {
  return typeof window.matchMedia === 'function' && DRAWER_QUERIES.some((text) => window.matchMedia(text).matches)
}

export interface PlayerViewSettings {
  /** Quanto do explorado fora da visão continua visível: 1 − alpha da camada escurecida. */
  exploredBrightness: number
  showGrid: boolean
  /** Nomes das salas, textos da ferramenta Texto e rótulos dos tokens. */
  showNames: boolean
  /**
   * "Câmera segue minha ficha": soltar a própria ficha perto da borda recentra
   * a câmera nela. Ausente = o jogador nunca escolheu, e vale o padrão do
   * aparelho (`followsOwnToken`). Ausente também não vai para o armazenamento:
   * quem troca de aparelho leva o padrão do aparelho novo.
   */
  followOwnToken?: boolean
}

/** Tela de toque: o dedo é quem arrasta a ficha até a borda, e ali a câmera seguir é o padrão. */
const TOUCH_QUERY = '(pointer: coarse)'

/**
 * A câmera segue a própria ficha? A escolha do jogador, quando há; sem ela,
 * ligado no celular (dedo) e desligado no notebook (mouse), como no relato da
 * Fabi (torre, lote 1, n. 47). Sem `matchMedia` (jsdom), vale o notebook.
 */
export function followsOwnToken(settings: PlayerViewSettings): boolean {
  if (settings.followOwnToken !== undefined) return settings.followOwnToken
  return typeof window.matchMedia === 'function' && window.matchMedia(TOUCH_QUERY).matches
}

export const EXPLORED_BRIGHTNESS_MIN = 0.3
export const EXPLORED_BRIGHTNESS_MAX = 0.8
const EXPLORED_BRIGHTNESS_STEP = 0.05
// Grade desligada por padrão: o mapa do jogador segue o minimapa limpo do editor.
export const DEFAULT_PLAYER_SETTINGS: PlayerViewSettings = { exploredBrightness: 0.55, showGrid: false, showNames: true }
export const PLAYER_SETTINGS_KEY = 'labirinto.jogador.ajustes'
/** Variável CSS (no painel) com a largura da barra de cima: `player.css` não deixa o cartão mais estreito que o cabeçalho dele. */
export const BAR_WIDTH_VAR = '--pp-bar-w'
/**
 * Variável CSS (na raiz da página) com o que a COLUNA aberta tira da esquerda
 * do mapa: a largura dela mais o vão do tema. Fechada, ou gaveta, vale 0. A
 * coluna das ações do lugar e a faixa "Sua vez" começam depois dela, e não por
 * baixo dela.
 */
export const PANEL_SPACE_VAR = '--pp-painel-ocupa'
/** O vão entre a coluna aberta e o que mora à direita dela (`--lb-control-gap` do tema). */
const PANEL_SPACE_GAP_PX = 8

/** Como cada estado do companheiro aparece escrito: é o texto que o jogador lê. */
const PARTY_WHERE_LABEL: Record<PartyWhere, string> = { aqui: 'aqui', longe: 'em outro lugar', fora: 'fora' }

export interface PlayerCharacter {
  id: string
  name: string
  /** AJUDANTE CONTRATADO: o acordo da ficha emprestada pelo mestre. Ausente = personagem do jogador. */
  contrato?: TokenContract
  /** NPC EMPRESTADO: NPC do mestre dado a este jogador sem acordo. Anda com ele, mas nome e foto não são dele. */
  emprestada?: boolean
}

/** O que o jogador lê embaixo do NPC que o mestre lhe deu, no lugar do formulário de nome e foto. */
const LENT_NPC_LABEL = 'Emprestado pelo mestre'

type PanelTab = 'jogo' | 'caderno' | 'lugares' | 'dados' | 'chat'

const PANEL_TABS: { id: PanelTab; label: string }[] = [
  { id: 'jogo', label: 'Jogo' },
  { id: 'caderno', label: 'Caderno' },
  { id: 'lugares', label: 'Lugares' },
  { id: 'dados', label: 'Dados' },
]
/** Tela sem quem role (teste, integrador antigo): as abas de antes. */
const PANEL_TABS_NO_DICE = PANEL_TABS.filter((item) => item.id !== 'dados')
/** CHAT: a última aba, que só existe depois que o mestre dá as boas-vindas (`welcome`). */
const CHAT_TAB: { id: PanelTab; label: string } = { id: 'chat', label: 'Chat' }

/** O que o Painel repassa à aba Chat: o Grupo vem de `party`, e "à vista" sai da aba escolhida com o painel aberto. */
export type PlayerPanelChat = Omit<PlayerChatProps, 'party' | 'visible'>

/** Tela antiga ou teste sem Lugares: listas vazias estáveis, sem objeto novo a cada render. */
const NO_PINS: readonly Pin[] = []
const NO_PLACES: readonly VisitedPlace[] = []
const NO_PLACE_NAMES: Readonly<Record<string, string>> = {}
const NO_PLACE_OF_MAP: Readonly<Record<string, string>> = {}
const IGNORE_POINT = (): void => {}
const IGNORE_RENAME = (): void => {}

function clampBrightness(value: number): number {
  return Math.min(EXPLORED_BRIGHTNESS_MAX, Math.max(EXPLORED_BRIGHTNESS_MIN, value))
}

/** Ajuste salvo vem de fora do código: campo ausente ou fora do formato cai no padrão, nunca lança. */
export function loadPlayerSettings(storage: StorageLike | null): PlayerViewSettings {
  let raw: string | null = null
  try {
    raw = storage?.getItem(PLAYER_SETTINGS_KEY) ?? null
  } catch {
    return { ...DEFAULT_PLAYER_SETTINGS }
  }
  if (raw === null) return { ...DEFAULT_PLAYER_SETTINGS }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_PLAYER_SETTINGS }
  }
  if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PLAYER_SETTINGS }
  const { exploredBrightness, showGrid, showNames, followOwnToken } = parsed as Record<string, unknown>
  const settings: PlayerViewSettings = {
    exploredBrightness:
      typeof exploredBrightness === 'number' && Number.isFinite(exploredBrightness)
        ? clampBrightness(exploredBrightness)
        : DEFAULT_PLAYER_SETTINGS.exploredBrightness,
    showGrid: typeof showGrid === 'boolean' ? showGrid : DEFAULT_PLAYER_SETTINGS.showGrid,
    showNames: typeof showNames === 'boolean' ? showNames : DEFAULT_PLAYER_SETTINGS.showNames,
  }
  // Só a escolha feita entra: sem ela o padrão continua sendo o do aparelho.
  if (typeof followOwnToken === 'boolean') settings.followOwnToken = followOwnToken
  return settings
}

/** Armazenamento cheio ou bloqueado (aba anônima) não pode derrubar a partida. */
export function savePlayerSettings(storage: StorageLike | null, settings: PlayerViewSettings): void {
  try {
    storage?.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Sem persistência: o ajuste vale só nesta aba.
  }
}

/** ESCONDER-SE: o "Esconder" do personagem próprio. Quem decide é o mestre. */
export interface PlayerHideControls {
  /** A ficha dele está oculta para os outros jogadores (o mestre deixou). */
  hidden: boolean
  /** O pedido espera o mestre. */
  waiting: boolean
  /** "Esconder": pede ao mestre, pelo socket, que a ficha suma dos outros. */
  onRequest: (tokenId: string) => void
}

interface PlayerPanelProps {
  characters: PlayerCharacter[]
  /** Cor CSS da bolinha: a mesma do token do jogador no canvas. */
  characterColor: string
  settings: PlayerViewSettings
  onSettingsChange: (settings: PlayerViewSettings) => void
  /**
   * Centralizar a ficha. `animate`: o pedido veio do dedo ou do mouse, e a câmera
   * desliza até ela. Sem ele (o teclado), é o pedido de sempre: a câmera salta.
   */
  onFocusToken: (tokenId: string, animate?: boolean) => void
  /** Modo "Sinalizar" ligado: o próximo toque no mapa vira sinal. */
  signalArmed: boolean
  onToggleSignal: () => void
  /** Modo "Medir" ligado: arrastar no mapa mede a distância (só nesta tela). */
  measureArmed: boolean
  onToggleMeasure: () => void
  /** Modo "Laser" ligado: segurar e arrastar no mapa aponta, e quem está na mesma cena vê. */
  laserArmed: boolean
  onToggleLaser: () => void
  /** Modo "Marcar destino" ligado: o próximo toque no mapa põe a marca "vamos para cá". Sem o callback, não há botão. */
  destinationArmed?: boolean
  onToggleDestination?: () => void
  /** A marca dele está no mapa: aparece o "Tirar marca". */
  hasDestination?: boolean
  onClearDestination?: () => void
  /** Nome novo do próprio token (já aparado); o mestre recebe pelo socket. */
  onRenameToken: (tokenId: string, name: string) => void
  /** Foto nova do próprio token. Rejeita (lança) quando a imagem não serve, e o aviso vai para a tela. */
  onChangeTokenPhoto: (tokenId: string, file: File) => Promise<void>
  /** ESCONDER-SE. Ausente (tela antiga, teste) = sem o botão. */
  hide?: PlayerHideControls
  /** O painel e a barra de cima: a câmera mede o que eles cobrem para centrar a ficha no que sobra. */
  panelRef?: RefObject<HTMLElement | null>
  barRef?: RefObject<HTMLDivElement | null>
  /** MINHAS PISTAS, da mais antiga à mais nova: a aba Lugares as mostra por lugar, a mais nova em cima. */
  clues?: readonly ClueEntry[]
  /** Tocou numa pista da aba Lugares: reabre o cartão dela. */
  onOpenClue?: (clueId: string) => void
  /** COLEÇÃO DE PISTAS: "Letreiro 5 de 12", acima da lista. Tocar numa peça reabre a pista dela (`onOpenClue`). */
  colecoes?: readonly ColecaoProgresso[]
  /** ITEM PEGÁVEL: a seção "Comigo". Ausente = o painel de sempre. */
  backpack?: ComponentProps<typeof PlayerBackpack>
  /**
   * Os outros jogadores da mesa e onde estão para ele. `undefined` = o mestre
   * ainda não mandou (ou é antigo e nunca manda): a seção não aparece, em vez
   * de afirmar que ele está sozinho.
   */
  party?: PartyMember[]
  /** CHAT: a aba "Chat". Ausente (antes do `welcome` do mestre, tela antiga, teste) = a aba não aparece. */
  chat?: PlayerPanelChat
  /** LUGARES: os pinos do recorte da cena (o que a névoa esconde nem chega aqui). */
  pins?: readonly Pin[]
  /** LUGARES: por onde ele já passou, na ordem da primeira visita. */
  places?: readonly VisitedPlace[]
  /** Id do lugar onde ele está agora. */
  currentPlace?: string
  /** Nomes que o jogador deu, por id de lugar. */
  placeNames?: Readonly<Record<string, string>>
  /** Tocou num ponto conhecido: a câmera centra nele. */
  onFocusPoint?: (point: RegionPoint) => void
  /** Renomeou um lugar (vazio = volta ao "Lugar N"). */
  onRenamePlace?: (placeId: string, name: string) => void
  /** Modo "Anotar" ligado: o próximo toque no mapa marca onde vai a anotação pessoal. Sem o callback, não há botão. */
  noteArmed?: boolean
  onToggleNote?: () => void
  /** MINHAS NOTAS de TODOS os mapas (o host as guarda para ele). Sem `onFocusNote`, a seção não aparece no Caderno. */
  personalNotes?: readonly PersonalNote[]
  /** O mapa da tela: as notas dele vêm primeiro no Caderno, e só delas a câmera vai até o ponto. */
  currentMapId?: string
  /** Por id de mapa, o lugar (`VisitedPlace.id`) que esta tela viu nele: é o nome que o Caderno dá às notas de lá. */
  placeOfMap?: Readonly<Record<string, string>>
  onFocusNote?: (noteId: string) => void
  onRemoveNote?: (noteId: string) => void
  /** DADO ROLADO NA SALA: pede a rolagem ao host. Sem o callback, não há aba Dados. */
  onRollDice?: (request: DiceRequest) => void
  /**
   * As rolagens da mesa, como chegam do host. Na GAVETA a aba Dados as mostra
   * embaixo do formulário: aberta, a gaveta tira de cena a lista que flutua
   * sobre o mapa, e quem rola por ela vê o resultado sem fechá-la.
   */
  diceRolls?: readonly DiceFeedRoll[]
  /** MINHAS FICHAS EM OUTRAS CENAS: as fichas dele fora da cena na tela, com a Sala ('' = sem nome que ele leia). */
  elsewhere?: readonly OwnTokenElsewhere[]
  /** "Olhar por…": tocou numa ficha de fora; a cena da tela passa a ser a dela. */
  onSwitchView?: (tokenId: string) => void
  /** "Mostrar meu mapa a…": ausente = a tela não oferece (teste, tela antiga). */
  mapShare?: PlayerMapShareProps
  /** BILHETE NO LUGAR — "Deixar marca aqui…": ausente = a tela não oferece (teste, tela antiga). */
  markForm?: PlayerMarkFormProps
  /** VOLTO JÁ: sair da mesa por um instante. Sem ele, o botão não aparece. */
  onStepAway?: () => void
  /**
   * "Baixar meu caderno": gera o arquivo no aparelho e devolve o nome dele.
   * Lança quando não deu (o aviso vai para a aba). Ausente = sem o botão.
   */
  onDownloadNotebook?: () => string
  /**
   * INVENTÁRIO (tecla I): o botão "Inventário" na barra de cima, ao lado de
   * "Minha ficha". `byKeyboard` = acionado por Enter/Espaço (entra sem
   * animação). Ausente (tela antiga, teste, nenhuma ficha dele no mapa) = sem o botão.
   */
  onOpenInventory?: (byKeyboard: boolean) => void
  /**
   * FICHA DE PERSONAGEM: o botão "Ficha" na barra de cima, depois do
   * Inventário. `byKeyboard` como no Inventário. Ausente (mapa solto, mestre
   * antigo: o host não serve ficha) = sem o botão.
   */
  onOpenFicha?: (byKeyboard: boolean) => void
}

/** Resultado do último "Baixar meu caderno", para a aba dizer o que houve. */
type DownloadResult = { ok: true; fileName: string } | { ok: false; reason: string }

export function PlayerPanel({
  characters,
  characterColor,
  settings,
  onSettingsChange,
  onFocusToken,
  signalArmed,
  onToggleSignal,
  measureArmed,
  onToggleMeasure,
  laserArmed,
  onToggleLaser,
  destinationArmed = false,
  onToggleDestination,
  hasDestination = false,
  onClearDestination,
  onRenameToken,
  onChangeTokenPhoto,
  hide,
  panelRef,
  barRef,
  clues = NO_CLUES,
  onOpenClue = IGNORE_CLUE,
  colecoes = NO_COLECOES,
  backpack,
  party,
  chat,
  pins = NO_PINS,
  places = NO_PLACES,
  currentPlace,
  placeNames = NO_PLACE_NAMES,
  onFocusPoint = IGNORE_POINT,
  onRenamePlace = IGNORE_RENAME,
  noteArmed = false,
  onToggleNote,
  personalNotes = NO_PERSONAL_NOTES,
  currentMapId,
  placeOfMap = NO_PLACE_OF_MAP,
  onFocusNote,
  onRemoveNote = IGNORE_NOTE,
  onRollDice,
  diceRolls = NO_DICE_ROLLS,
  elsewhere = NO_ELSEWHERE,
  onSwitchView = IGNORE_SWITCH,
  mapShare,
  markForm,
  onStepAway,
  onDownloadNotebook,
  onOpenInventory,
  onOpenFicha,
}: PlayerPanelProps) {
  const baseTabs = onRollDice === undefined ? PANEL_TABS_NO_DICE : PANEL_TABS
  const tabs = chat === undefined ? baseTabs : [...baseTabs, CHAT_TAB]
  const drawerScreen = useSyncExternalStore(subscribeDrawerScreen, isDrawerScreen, () => false)
  // Um estado por forma: a coluna do notebook nasce aberta e a gaveta do
  // celular nasce fechada. Atravessar o corte (girar o celular, estreitar a
  // janela) mostra cada forma como ela estava, sem a gaveta abrir sozinha por
  // cima do mapa.
  const [columnOpen, setColumnOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const open = drawerScreen ? drawerOpen : columnOpen
  const [chosenTab, setTab] = useState<PanelTab>('jogo')
  // O chat some quando o mestre reinicia a sessão: quem estava na aba dele volta ao Jogo.
  const tab: PanelTab = chosenTab === 'chat' && chat === undefined ? 'jogo' : chosenTab
  const chatUnread = chat?.unread
  const chatMention = chatUnread !== undefined && (chatUnread.cena.length > 0 || chatUnread.global.length > 0)
  const tabButtons = useRef<Partial<Record<PanelTab, HTMLButtonElement | null>>>({})
  const panelId = useId()
  const brightnessId = useId()
  const nameFieldId = useId()
  const photoFieldId = useId()
  const ownPanelRef = useRef<HTMLElement | null>(null)
  const asideRef = panelRef ?? ownPanelRef
  const ownBarRef = useRef<HTMLDivElement | null>(null)
  const barElRef = barRef ?? ownBarRef
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  /** Gaveta aberta pelo teclado: o foco entra nela quando ela aparece (não antes, escondida ela não recebe foco). */
  const focusIntoDrawer = useRef(false)

  /**
   * Fecha a GAVETA (celular), que cobre o mapa. A coluna do notebook não fecha
   * sozinha: ela deixa o mapa à vista e só o botão "Painel" a recolhe. Com o
   * foco lá dentro, ele volta ao botão — sumir junto com a gaveta deixaria o
   * teclado sem lugar.
   */
  function closeDrawer() {
    if (!drawerScreen || !drawerOpen) return
    const panel = asideRef.current
    const focusWasInside = panel !== null && panel.contains(document.activeElement)
    setDrawerOpen(false)
    if (focusWasInside) toggleRef.current?.focus()
  }

  function togglePanel(event: MouseEvent<HTMLButtonElement>) {
    if (!drawerScreen) {
      setColumnOpen((value) => !value)
      return
    }
    if (drawerOpen) {
      closeDrawer()
      return
    }
    // `detail` 0 = acionado por Enter/Espaço: quem veio pelo teclado continua dentro da gaveta.
    focusIntoDrawer.current = event.detail === 0
    setDrawerOpen(true)
  }

  useEffect(() => {
    if (!open || !focusIntoDrawer.current) return
    focusIntoDrawer.current = false
    asideRef.current?.querySelector<HTMLElement>('button:not(:disabled), input')?.focus()
  }, [open, asideRef])

  // A barra é o cabeçalho do cartão, mas é `fixed`, fora dele: a largura dela
  // vai para `--pp-bar-w`, e o cartão nunca fica mais estreito que ela. O
  // observador acompanha o ponto de recado, a fonte que chega e o "Minha ficha"
  // que aparece com a primeira ficha.
  useLayoutEffect(() => {
    const bar = barElRef.current
    const panel = asideRef.current
    if (bar === null || panel === null) return
    const apply = () => panel.style.setProperty(BAR_WIDTH_VAR, `${bar.offsetWidth}px`)
    apply()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply)
    observer?.observe(bar)
    return () => {
      observer?.disconnect()
      panel.style.removeProperty(BAR_WIDTH_VAR)
    }
  }, [barElRef, asideRef])

  // O espaço da coluna aberta vai para a raiz (`--pp-painel-ocupa`): é o que os
  // flutuantes do mapa somam à margem da esquerda. Abrir, recolher, girar o
  // celular e a fileira de abas que alarga mudam a largura: o observador e o
  // estado acompanham. Gaveta não conta: aberta, ela tira o HUD do mapa de cena.
  useLayoutEffect(() => {
    const panel = asideRef.current
    if (panel === null) return
    const root = document.documentElement
    const apply = () => {
      const width = !drawerScreen && open ? panel.offsetWidth : 0
      root.style.setProperty(PANEL_SPACE_VAR, width > 0 ? `${width + PANEL_SPACE_GAP_PX}px` : '0px')
    }
    apply()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply)
    observer?.observe(panel)
    return () => {
      observer?.disconnect()
      root.style.removeProperty(PANEL_SPACE_VAR)
    }
  }, [asideRef, drawerScreen, open])

  // Escape é da gaveta, que cobre o mapa. Na coluna do notebook ele fica para
  // a régua e os cartões: fechar o painel de brinde ao sair do "Medir" seria surpresa.
  useEffect(() => {
    if (!drawerScreen || !drawerOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // `closeDrawer` só lê estes dois estados e refs estáveis.
  }, [drawerScreen, drawerOpen])

  function selectTab(next: PanelTab) {
    setTab(next)
    tabButtons.current[next]?.focus()
  }

  // Setas trocam de aba (e o foco vai junto); Home e End vão às pontas. A fileira é uma parada só do Tab.
  function onTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((item) => item.id === tab)
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    const target = next === null ? undefined : tabs[next]
    if (target === undefined) return
    event.preventDefault()
    selectTab(target.id)
  }

  /**
   * `detail` conta os cliques do dedo ou do mouse, e esses pedem o deslize. Enter
   * e Espaço sintetizam o clique com 0 e fazem o pedido de sempre, só com a
   * ficha: o deslize é o acréscimo, e o pedido sem ele continua sendo o salto.
   */
  function focusToken(tokenId: string, event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) onFocusToken(tokenId)
    else onFocusToken(tokenId, true)
    // Na gaveta o painel cobre o mapa: fecha para mostrar onde a câmera foi.
    closeDrawer()
  }

  function focusPin(pin: Pin) {
    onFocusPoint({ x: pin.x, y: pin.y })
    // Mesma razão do "Centralizar": no celular a gaveta cobre o ponto.
    closeDrawer()
  }

  function lookThrough(tokenId: string) {
    onSwitchView(tokenId)
    // Mesma razão do centralizar: a cena nova aparece no mapa que a gaveta cobre.
    closeDrawer()
  }

  function changeBrightness(event: ChangeEvent<HTMLInputElement>) {
    const value = Number(event.target.value)
    if (Number.isFinite(value)) onSettingsChange({ ...settings, exploredBrightness: clampBrightness(value) })
  }

  function toggleSignal() {
    // Ao ligar, a gaveta fecha para o toque cair no mapa (no celular ela cobre a tela).
    if (!signalArmed) closeDrawer()
    onToggleSignal()
  }

  function toggleDestination() {
    // Mesma razão do Sinalizar: no celular a gaveta cobre o mapa onde o dedo vai marcar.
    if (!destinationArmed) closeDrawer()
    onToggleDestination?.()
  }

  function toggleNote() {
    // Mesma razão do Sinalizar: no celular a gaveta cobre o mapa onde o dedo vai anotar.
    if (!noteArmed) closeDrawer()
    onToggleNote?.()
  }

  function focusNote(noteId: string) {
    onFocusNote?.(noteId)
    // Como "Minha ficha": na gaveta o painel cobre o mapa, e a nota está lá.
    closeDrawer()
  }

  function toggleMeasure() {
    // Mesma razão do Sinalizar: no celular a gaveta cobre o mapa onde o dedo vai medir.
    if (!measureArmed) closeDrawer()
    onToggleMeasure()
  }

  function toggleLaser() {
    // Mesma razão: no celular a gaveta cobre o mapa onde o dedo vai apontar.
    if (!laserArmed) closeDrawer()
    onToggleLaser()
  }

  // O personagem editável é o primeiro PRÓPRIO da lista: é quase sempre o
  // único, e "qual dos meus" só faria sentido com uma escolha na tela que
  // ninguém pediu. Ajudante e NPC emprestados nunca são editáveis (o NPC é do mestre).
  const mine = characters.find((character) => character.contrato === undefined && character.emprestada !== true)
  // Centralizar e "Minha ficha": o personagem próprio; só com o ajudante, ele.
  const first = mine ?? characters[0]
  const myTokenId = mine?.id ?? null
  const myTokenName = mine?.name ?? ''
  const [nameDraft, setNameDraft] = useState(myTokenName)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [download, setDownload] = useState<DownloadResult | null>(null)

  /** O nome do lugar de outro mapa, nas Minhas notas: o que ELE deu na aba Lugares, se esta tela viu aquele mapa. */
  function notePlaceLabel(mapId: string): string {
    const placeId = placeOfMap[mapId]
    const place = placeId === undefined ? undefined : places.find((candidate) => candidate.id === placeId)
    return place === undefined ? 'Outro lugar' : placeLabel(place, placeNames)
  }

  function downloadNotebook() {
    if (onDownloadNotebook === undefined) return
    try {
      setDownload({ ok: true, fileName: onDownloadNotebook() })
    } catch (erro) {
      setDownload({ ok: false, reason: erro instanceof Error ? erro.message : 'erro desconhecido' })
    }
  }

  // O nome mandado pelo mestre manda: trocar de personagem, ou o mestre
  // renomear o seu, recarrega o rascunho. Enquanto a pessoa digita nada muda
  // de fora, então não há como o campo ser limpo no meio da frase.
  useEffect(() => {
    setNameDraft(myTokenName)
  }, [myTokenId, myTokenName])

  function applyName() {
    const limpo = nameDraft.trim()
    if (myTokenId === null || limpo === '' || limpo === myTokenName) return
    onRenameToken(myTokenId, limpo)
  }

  function submitName(event: FormEvent<HTMLFormElement>) {
    // Enter num formulário de um campo só recarregaria a página.
    event.preventDefault()
    applyName()
  }

  async function chooseTokenPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Zera o campo ANTES de usar o arquivo: escolher a MESMA foto de novo
    // (depois de um erro, por exemplo) precisa disparar `change` outra vez.
    event.target.value = ''
    if (file === undefined || myTokenId === null) return
    setPhotoError(null)
    setPhotoBusy(true)
    try {
      await onChangeTokenPhoto(myTokenId, file)
    } catch (erro) {
      setPhotoError(erro instanceof Error ? erro.message : 'não deu para usar essa foto')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <>
      {/* A barra fica FORA do painel: recolhido, ele some e ela continua no
          mesmo lugar (aberto, ela é o cabeçalho dele). Primeiro no DOM: o Tab
          passa por ela antes do conteúdo do painel, na ordem da leitura. */}
      <div ref={barElRef} className={open ? 'pp-bar' : 'pp-bar pp-bar--alone'}>
        <button
          ref={toggleRef}
          type="button"
          className="pp-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          // O texto visível é "Painel" nos dois estados, para a barra não
          // pular; aberto, o nome diz o que o clique faz (e contém o texto).
          aria-label={open ? 'Fechar painel' : undefined}
          onClick={togglePanel}
        >
          <svg className="pp-toggle__chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
            <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Painel
          {chatMention && <UnreadDot />}
        </button>
        {first !== undefined && (
          <button type="button" className="pp-mine" onClick={(event) => focusToken(first.id, event)}>
            <svg className="pp-mine__icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="7" cy="7" r="1.4" fill="currentColor" />
              <path d="M7 0.75v2M7 11.25v2M0.75 7h2M11.25 7h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {/* Abaixo de 380 px só a mira fica à vista: com a "Ficha" de personagem, a barra passava da tela de 320 (player.css). */}
            <span className="pp-mine__rotulo">Minha ficha</span>
          </button>
        )}
        {onOpenInventory !== undefined && (
          <button
            type="button"
            className="pp-bag"
            aria-haspopup="dialog"
            aria-keyshortcuts="I"
            // `detail` 0 = Enter/Espaço: quem veio pelo teclado não espera animação.
            onClick={(event) => onOpenInventory(event.detail === 0)}
          >
            <svg className="pp-bag__icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <path d="M4.75 4.5V3.6a2.25 2.25 0 0 1 4.5 0v.9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M2.4 4.5h9.2l-.75 7.25a.9.9 0 0 1-.9.8H4.05a.9.9 0 0 1-.9-.8Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            {/* Em tela de menos de 380 px a barra não cabia: só a bolsa fica à vista, e o nome continua para o leitor de tela (player.css). */}
            <span className="pp-bag__rotulo">Inventário</span>
            <kbd className="pp-bag__key" aria-hidden="true">
              I
            </kbd>
          </button>
        )}
        {onOpenFicha !== undefined && (
          <button
            type="button"
            className="pp-ficha-btn"
            aria-haspopup="dialog"
            // "Minha ficha", ao lado, centra a câmera no token: o nome diz que esta é a ficha de PERSONAGEM.
            aria-label="Ficha de personagem"
            onClick={(event) => onOpenFicha(event.detail === 0)}
          >
            <svg className="pp-ficha-btn__icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <rect x="2.25" y="1.25" width="9.5" height="11.5" rx="1.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4.75 4.75h4.5M4.75 7.25h4.5M4.75 9.75h2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {/* Abaixo de 380 px só o ícone fica à vista, como a bolsa do Inventário (player.css). */}
            <span className="pp-ficha-btn__rotulo">Ficha</span>
          </button>
        )}
      </div>
      <aside id={panelId} ref={asideRef} className="pp-panel" hidden={!open} aria-label="Painel do jogador">
        <div className="pp-panel__body">
          <div className="pp-tabs" role="tablist" aria-label="Painel do jogador" onKeyDown={onTabKeyDown}>
            {tabs.map((item) => (
              <button
                key={item.id}
                ref={(el) => {
                  tabButtons.current[item.id] = el
                }}
                type="button"
                role="tab"
                id={`${panelId}-tab-${item.id}`}
                className="pp-tab"
                aria-selected={tab === item.id}
                aria-controls={`${panelId}-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => setTab(item.id)}
              >
                {item.label}
                {item.id === 'chat' && chatMention && <UnreadDot />}
              </button>
            ))}
          </div>

          {/* A aba de jogo fica montada mesmo escondida: o rascunho do nome não se perde ao trocar de aba. */}
          <div role="tabpanel" id={`${panelId}-panel-jogo`} aria-labelledby={`${panelId}-tab-jogo`} className="pp-tabpanel" hidden={tab !== 'jogo'}>
            <section className="pp-section" aria-labelledby={`${panelId}-chars`}>
              <h2 id={`${panelId}-chars`} className="pp-heading">
                Meus personagens
              </h2>
              {characters.length === 0 && elsewhere.length === 0 ? (
                <p className="pp-empty">Nenhum personagem seu no mapa.</p>
              ) : (
                <ul className="pp-list">
                  {characters.map((character) => (
                    <li key={character.id}>
                      <button
                        type="button"
                        className="pp-character"
                        aria-label={`Centralizar em ${character.name}`}
                        onClick={(event) => focusToken(character.id, event)}
                      >
                        <span className="pp-dot" style={{ background: characterColor }} aria-hidden="true" />
                        <span className="pp-character__name">{character.name}</span>
                      </button>
                      {/* Fora do botão: o aria-label dele cobriria o texto do acordo. */}
                      {character.contrato !== undefined && <p className="pp-character__deal">{loanLabel(character.contrato, formatNoteTime)}</p>}
                      {character.emprestada === true && <p className="pp-character__deal">{LENT_NPC_LABEL}</p>}
                    </li>
                  ))}
                  {/* Fichas dele em outra cena: tocar troca a cena da tela. Só a
                      Sala, nunca a cena — o nome da cena é do mestre. */}
                  {elsewhere.map((item) => (
                    <li key={item.tokenId}>
                      <button
                        type="button"
                        className="pp-character pp-character--away"
                        aria-label={`Olhar por ${item.name}`}
                        onClick={() => lookThrough(item.tokenId)}
                      >
                        <span className="pp-dot pp-dot--away" style={{ color: characterColor }} aria-hidden="true" />
                        <span className="pp-character__text">
                          <span className="pp-character__name">{item.name}</span>{' '}
                          <span className="pp-character__where">{item.room === '' ? 'Em outro lugar' : `Em outro lugar · ${item.room}`}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="pp-button" aria-pressed={signalArmed} onClick={toggleSignal}>
                {signalArmed ? 'Toque no mapa…' : 'Sinalizar'}
              </button>
              <p className="pp-empty">No PC: Alt+clique ou segure o clique parado.</p>
              {/* MARCAÇÕES: Marcar destino, Anotar e Deixar marca aqui… num menu só. */}
              <PlayerMarcacoes
                destination={
                  onToggleDestination === undefined
                    ? undefined
                    : { armed: destinationArmed, has: hasDestination, onToggle: toggleDestination, onClear: onClearDestination }
                }
                note={onToggleNote === undefined ? undefined : { armed: noteArmed, onToggle: toggleNote }}
                markForm={markForm}
              />
              <button type="button" className="pp-button pp-button--toggle" aria-pressed={measureArmed} onClick={toggleMeasure}>
                Medir
              </button>
              {measureArmed && <p className="pp-empty">Arraste no mapa para medir. Esc sai.</p>}
              <button type="button" className="pp-button pp-button--toggle" aria-pressed={laserArmed} onClick={toggleLaser}>
                Laser
              </button>
              {laserArmed && <p className="pp-empty">Segure e arraste no mapa para apontar. Quem está na sua cena vê. Esc sai.</p>}
              {mapShare !== undefined && <PlayerMapShare {...mapShare} />}
              {onStepAway !== undefined && (
                <>
                  <button type="button" className="pp-button" onClick={onStepAway}>
                    Volto já
                  </button>
                  <p className="pp-empty">Sua ficha fica parada e o mestre sabe que você saiu por um instante.</p>
                </>
              )}
            </section>

            {backpack !== undefined && <PlayerBackpack {...backpack} />}

            {party !== undefined && (
              <section className="pp-section" aria-labelledby={`${panelId}-party`}>
                <h2 id={`${panelId}-party`} className="pp-heading">
                  Grupo
                </h2>
                {party.length === 0 ? (
                  <p className="pp-empty">Só você na mesa.</p>
                ) : (
                  <ul className="pp-list">
                    {party.map((member) => (
                      <li key={member.playerId} className={`pp-member pp-member--${member.where}`}>
                        <span className="pp-member__dot" aria-hidden="true" />
                        <span className="pp-member__name">{member.name}</span>
                        {/* Espaço de texto entre nome e estado: o flex o ignora no
                            desenho (o `gap` separa), mas quem lê o texto — leitor
                            de tela, busca, cópia — recebe "Bruno aqui", não "Brunoaqui". */}{' '}
                        <span className="pp-member__where">{PARTY_WHERE_LABEL[member.where]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {mine !== undefined && (
              <section className="pp-section" aria-labelledby={`${panelId}-me`}>
                <h2 id={`${panelId}-me`} className="pp-heading">
                  Meu personagem
                </h2>
                <form className="pp-field" onSubmit={submitName}>
                  <label className="pp-label" htmlFor={nameFieldId}>
                    Nome
                  </label>
                  {/* Enter aplica; sair do campo também, para quem clica fora sem apertar nada. */}
                  <input
                    id={nameFieldId}
                    className="pp-input"
                    type="text"
                    value={nameDraft}
                    maxLength={NAME_MAX_LENGTH}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onBlur={applyName}
                  />
                </form>
                <div className="pp-field">
                  <label className="pp-label" htmlFor={photoFieldId}>
                    Foto
                  </label>
                  <input id={photoFieldId} className="pp-file" type="file" accept="image/*" onChange={chooseTokenPhoto} />
                </div>
                {photoBusy && <p className="pp-empty">Preparando a foto…</p>}
                {photoError !== null && (
                  <p className="pp-error" role="alert">
                    {photoError}
                  </p>
                )}
                {/* Esconder é pedido: quem decide é o mestre, e só ele revela de novo. */}
                {hide !== undefined &&
                  (hide.hidden ? (
                    <p className="pp-empty">Escondida: os outros jogadores não veem sua ficha. Só o mestre revela.</p>
                  ) : (
                    <button type="button" className="pp-button" disabled={hide.waiting} onClick={() => hide.onRequest(mine.id)}>
                      {hide.waiting ? 'Aguardando o mestre…' : 'Esconder'}
                    </button>
                  ))}
              </section>
            )}

            <section className="pp-section" aria-labelledby={`${panelId}-vision`}>
              <h2 id={`${panelId}-vision`} className="pp-heading">
                Visão
              </h2>
              <div className="pp-field">
                <label htmlFor={brightnessId} className="pp-field__row">
                  <span>Brilho do explorado</span>
                  {/* span, não <output>: <output> tem papel implícito "status" e se confundiria com as mensagens de conexão da página. */}
                  <span className="pp-value">{Math.round(settings.exploredBrightness * 100)}%</span>
                </label>
                <input
                  id={brightnessId}
                  className="pp-range"
                  type="range"
                  min={EXPLORED_BRIGHTNESS_MIN}
                  max={EXPLORED_BRIGHTNESS_MAX}
                  step={EXPLORED_BRIGHTNESS_STEP}
                  value={settings.exploredBrightness}
                  onChange={changeBrightness}
                />
              </div>
              <label className="pp-check">
                <input type="checkbox" checked={settings.showGrid} onChange={(e) => onSettingsChange({ ...settings, showGrid: e.target.checked })} />
                <span>Grade</span>
              </label>
              <label className="pp-check">
                <input type="checkbox" checked={settings.showNames} onChange={(e) => onSettingsChange({ ...settings, showNames: e.target.checked })} />
                <span>Nomes</span>
              </label>
              <label className="pp-check">
                <input
                  type="checkbox"
                  checked={followsOwnToken(settings)}
                  onChange={(e) => onSettingsChange({ ...settings, followOwnToken: e.target.checked })}
                />
                <span>Câmera segue minha ficha</span>
              </label>
            </section>
          </div>

          <div
            role="tabpanel"
            id={`${panelId}-panel-caderno`}
            aria-labelledby={`${panelId}-tab-caderno`}
            className="pp-tabpanel"
            hidden={tab !== 'caderno'}
          >
            {/* Só montado à vista: fora da aba, o texto das notas não fica no documento. */}
            {tab === 'caderno' && (
              <>
                {onFocusNote !== undefined && (
                  <section className="pp-section" aria-labelledby={`${panelId}-personal`}>
                    <h2 id={`${panelId}-personal`} className="pp-heading">
                      Minhas notas
                    </h2>
                    <PersonalNoteList
                      notes={personalNotes}
                      currentMapId={currentMapId}
                      placeLabelOf={notePlaceLabel}
                      onFocus={focusNote}
                      onRemove={onRemoveNote}
                    />
                  </section>
                )}
                {onDownloadNotebook !== undefined && (
                  <section className="pp-section" aria-labelledby={`${panelId}-home`}>
                    <h2 id={`${panelId}-home`} className="pp-heading">
                      Levar para casa
                    </h2>
                    <p className="pp-empty">Um arquivo com os mapas que você conhece, suas pistas e suas notas. Abre sem internet e sem o mestre.</p>
                    <button type="button" className="pp-button" onClick={downloadNotebook}>
                      Baixar meu caderno
                    </button>
                    {download?.ok === true && (
                      <p className="pp-empty" role="status">
                        Baixado: {download.fileName}
                      </p>
                    )}
                    {download?.ok === false && (
                      <p className="pp-error" role="alert">
                        Não deu para baixar: {download.reason}
                      </p>
                    )}
                  </section>
                )}
              </>
            )}
          </div>

          <div
            role="tabpanel"
            id={`${panelId}-panel-lugares`}
            aria-labelledby={`${panelId}-tab-lugares`}
            className="pp-tabpanel"
            hidden={tab !== 'lugares'}
          >
            {/* Só montado à vista: as miniaturas não se redesenham a cada passo da ficha com a aba fechada. */}
            {tab === 'lugares' && (
              <>
                <PlayerPlacesTab pins={pins} places={places} currentPlace={currentPlace} names={placeNames} onFocusPin={focusPin} onRename={onRenamePlace} />
                {/* MINHAS PISTAS, por lugar: o que ele leu em cada mapa, junto dos lugares. */}
                <section className="pp-section" aria-labelledby={`${panelId}-clues`}>
                  <h2 id={`${panelId}-clues`} className="pp-heading">
                    Minhas pistas
                  </h2>
                  <PlayerCluesByPlace clues={clues} colecoes={colecoes} places={places} currentPlace={currentPlace} names={placeNames} onOpen={onOpenClue} />
                </section>
              </>
            )}
          </div>

          {/* Montada mesmo escondida, como a aba Jogo: o dado e a quantidade escolhidos ficam para a próxima rolagem.
              O resultado vem do host, na lista de rolagens sobre o mapa, igual para a mesa inteira. Na GAVETA essa
              lista sai de cena junto com o resto do mapa, e a mesma lista aparece aqui embaixo (player.css,
              `.pp-dados-rolagens`): na coluna do notebook ela fica escondida, porque a do mapa continua à vista. */}
          {onRollDice !== undefined && (
            <div role="tabpanel" id={`${panelId}-panel-dados`} aria-labelledby={`${panelId}-tab-dados`} className="pp-tabpanel" hidden={tab !== 'dados'}>
              <section className="pp-section">
                <DiceForm onRoll={(request) => onRollDice(request)} />
                {diceRolls.length > 0 && <DiceFeed rolls={diceRolls} className="pp-dados-rolagens" />}
              </section>
            </div>
          )}

          {/* Montada mesmo escondida, como a aba Jogo: o rascunho e o canal escolhido ficam para quando ele voltar. */}
          {chat !== undefined && (
            <div role="tabpanel" id={`${panelId}-panel-chat`} aria-labelledby={`${panelId}-tab-chat`} className="pp-tabpanel" hidden={tab !== 'chat'}>
              <PlayerChat {...chat} party={party} visible={open && tab === 'chat'} />
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

/** Ponto de menção nova no chat. O texto escondido dá o aviso a quem usa leitor de tela. */
function UnreadDot() {
  return (
    <span className="pp-unread">
      <span className="pp-visually-hidden"> (menção nova no chat)</span>
    </span>
  )
}
