import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent, ComponentProps, FormEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent, RefObject } from 'react'
import type { StorageLike } from './playerConnection'
import { PlayerBackpack } from './PlayerBackpack'
import { NAME_MAX_LENGTH, type ClueEntry, type NoteEntry, type PartyMember, type PartyWhere } from '../net/protocol'
import { formatNoteTime, PlayerNotebook } from './PlayerNotebook'
import type { TokenContract } from '../types/map'
import { loanLabel } from '../lib/tokenLoan'
import { PlayerClueList } from './PlayerClues'
import { PlayerLetterForm, type PlayerLetterFormProps } from './PlayerLetterForm'

/** Caderno sem pistas passadas (tela antiga, teste): a mesma lista vazia, sem objeto novo a cada render. */
const NO_CLUES: readonly ClueEntry[] = []
const IGNORE_CLUE = (): void => {}

// Painel do jogador: meus personagens, ajustes de visão e centralizar a câmera.
// Fica sobre o canvas (não ao lado) para o enquadramento do mapa não depender
// da largura do painel. Em QUALQUER largura ele recolhe pelo botão "Painel",
// que mora numa barra fora do painel junto com "Minha ficha": no notebook o
// painel começa aberto, como coluna; abaixo de 700 px é gaveta e começa fechado.

/** O mesmo corte de player.css: abaixo disto o painel é gaveta sobre o mapa, e não coluna. */
const DRAWER_QUERY = '(max-width: 699px)'

function subscribeDrawerScreen(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(DRAWER_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Sem `matchMedia` (jsdom, navegador muito velho) vale a coluna: é o caso que nunca esconde nada. */
function isDrawerScreen(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DRAWER_QUERY).matches
}

export interface PlayerViewSettings {
  /** Quanto do explorado fora da visão continua visível: 1 − alpha da camada escurecida. */
  exploredBrightness: number
  showGrid: boolean
  /** Nomes das salas, textos da ferramenta Texto e rótulos dos tokens. */
  showNames: boolean
}

export const EXPLORED_BRIGHTNESS_MIN = 0.3
export const EXPLORED_BRIGHTNESS_MAX = 0.8
const EXPLORED_BRIGHTNESS_STEP = 0.05
// Grade desligada por padrão: o mapa do jogador segue o minimapa limpo do editor.
export const DEFAULT_PLAYER_SETTINGS: PlayerViewSettings = { exploredBrightness: 0.55, showGrid: false, showNames: true }
export const PLAYER_SETTINGS_KEY = 'labirinto.jogador.ajustes'

/** Como cada estado do companheiro aparece escrito: é o texto que o jogador lê. */
const PARTY_WHERE_LABEL: Record<PartyWhere, string> = { aqui: 'aqui', longe: 'em outro lugar', fora: 'fora' }

export interface PlayerCharacter {
  id: string
  name: string
  /** AJUDANTE CONTRATADO: o acordo da ficha emprestada pelo mestre. Ausente = personagem do jogador. */
  contrato?: TokenContract
}

type PanelTab = 'jogo' | 'caderno'

const PANEL_TABS: { id: PanelTab; label: string }[] = [
  { id: 'jogo', label: 'Jogo' },
  { id: 'caderno', label: 'Caderno' },
]

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
  const { exploredBrightness, showGrid, showNames } = parsed as Record<string, unknown>
  return {
    exploredBrightness:
      typeof exploredBrightness === 'number' && Number.isFinite(exploredBrightness)
        ? clampBrightness(exploredBrightness)
        : DEFAULT_PLAYER_SETTINGS.exploredBrightness,
    showGrid: typeof showGrid === 'boolean' ? showGrid : DEFAULT_PLAYER_SETTINGS.showGrid,
    showNames: typeof showNames === 'boolean' ? showNames : DEFAULT_PLAYER_SETTINGS.showNames,
  }
}

/** Armazenamento cheio ou bloqueado (aba anônima) não pode derrubar a partida. */
export function savePlayerSettings(storage: StorageLike | null, settings: PlayerViewSettings): void {
  try {
    storage?.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Sem persistência: o ajuste vale só nesta aba.
  }
}

interface PlayerPanelProps {
  characters: PlayerCharacter[]
  /** Cor CSS da bolinha: a mesma do token do jogador no canvas. */
  characterColor: string
  settings: PlayerViewSettings
  onSettingsChange: (settings: PlayerViewSettings) => void
  onFocusToken: (tokenId: string) => void
  /** Modo "Sinalizar" ligado: o próximo toque no mapa vira sinal. */
  signalArmed: boolean
  onToggleSignal: () => void
  /** Modo "Medir" ligado: arrastar no mapa mede a distância (só nesta tela). */
  measureArmed: boolean
  onToggleMeasure: () => void
  /** Modo "Laser" ligado: segurar e arrastar no mapa aponta, e quem está na mesma cena vê. */
  laserArmed: boolean
  onToggleLaser: () => void
  /** Nome novo do próprio token (já aparado); o mestre recebe pelo socket. */
  onRenameToken: (tokenId: string, name: string) => void
  /** Foto nova do próprio token. Rejeita (lança) quando a imagem não serve, e o aviso vai para a tela. */
  onChangeTokenPhoto: (tokenId: string, file: File) => Promise<void>
  /** O painel e a barra de cima: a câmera mede o que eles cobrem para centrar a ficha no que sobra. */
  panelRef?: RefObject<HTMLElement | null>
  barRef?: RefObject<HTMLDivElement | null>
  /** Recados guardados, do mais antigo ao mais novo (a aba mostra o mais novo em cima). */
  notebook: NoteEntry[]
  /** Há recado que o jogador não viu: acende o ponto no "Painel" e na aba Caderno. */
  notebookUnread: boolean
  /** O Caderno ficou à vista: tudo nele conta como lido. */
  onReadNotebook: () => void
  /** MINHAS PISTAS, da mais antiga à mais nova (a lista mostra a mais nova em cima). */
  clues?: readonly ClueEntry[]
  /** Tocou numa pista do Caderno: reabre o cartão dela. */
  onOpenClue?: (clueId: string) => void
  /** ITEM PEGÁVEL: a seção "Comigo". Ausente = o painel de sempre. */
  backpack?: ComponentProps<typeof PlayerBackpack>
  /**
   * Os outros jogadores da mesa e onde estão para ele. `undefined` = o mestre
   * ainda não mandou (ou é antigo e nunca manda): a seção não aparece, em vez
   * de afirmar que ele está sozinho.
   */
  party?: PartyMember[]
  /** CORREIO: o formulário "Bilhete". Ausente (tela antiga, teste) = a seção não aparece. */
  letter?: PlayerLetterFormProps
}

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
  onRenameToken,
  onChangeTokenPhoto,
  panelRef,
  barRef,
  notebook,
  notebookUnread,
  onReadNotebook,
  clues = NO_CLUES,
  onOpenClue = IGNORE_CLUE,
  backpack,
  party,
  letter,
}: PlayerPanelProps) {
  const drawerScreen = useSyncExternalStore(subscribeDrawerScreen, isDrawerScreen, () => false)
  // Um estado por forma: a coluna do notebook nasce aberta e a gaveta do
  // celular nasce fechada. Atravessar o corte (girar o celular, estreitar a
  // janela) mostra cada forma como ela estava, sem a gaveta abrir sozinha por
  // cima do mapa.
  const [columnOpen, setColumnOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const open = drawerScreen ? drawerOpen : columnOpen
  const [tab, setTab] = useState<PanelTab>('jogo')
  const tabButtons = useRef<Partial<Record<PanelTab, HTMLButtonElement | null>>>({})
  const panelId = useId()
  const brightnessId = useId()
  const nameFieldId = useId()
  const photoFieldId = useId()
  const ownPanelRef = useRef<HTMLElement | null>(null)
  const asideRef = panelRef ?? ownPanelRef
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

  // Caderno à vista = lido: aba Caderno com o painel aberto (coluna ou gaveta;
  // recolhido, o painel some nas duas formas). Recado que chega com o Caderno aberto já nasce lido.
  useEffect(() => {
    if (tab !== 'caderno' || !notebookUnread || !open) return
    onReadNotebook()
  }, [tab, notebookUnread, open, onReadNotebook])

  function selectTab(next: PanelTab) {
    setTab(next)
    tabButtons.current[next]?.focus()
  }

  // Setas trocam de aba (e o foco vai junto); Home e End vão às pontas. A fileira é uma parada só do Tab.
  function onTabKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const index = PANEL_TABS.findIndex((item) => item.id === tab)
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (index + 1) % PANEL_TABS.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + PANEL_TABS.length) % PANEL_TABS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = PANEL_TABS.length - 1
    const target = next === null ? undefined : PANEL_TABS[next]
    if (target === undefined) return
    event.preventDefault()
    selectTab(target.id)
  }

  function focusToken(tokenId: string) {
    onFocusToken(tokenId)
    // Na gaveta o painel cobre o mapa: fecha para mostrar onde a câmera foi.
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
  // ninguém pediu. Ajudante emprestado nunca é editável (o NPC é do mestre).
  const mine = characters.find((character) => character.contrato === undefined)
  // Centralizar e "Minha ficha": o personagem próprio; só com o ajudante, ele.
  const first = mine ?? characters[0]
  const myTokenId = mine?.id ?? null
  const myTokenName = mine?.name ?? ''
  const [nameDraft, setNameDraft] = useState(myTokenName)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)

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
      <div ref={barRef} className={open ? 'pp-bar' : 'pp-bar pp-bar--alone'}>
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
          {notebookUnread && <UnreadDot />}
        </button>
        {first !== undefined && (
          <button type="button" className="pp-mine" onClick={() => focusToken(first.id)}>
            <svg className="pp-mine__icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="7" cy="7" r="1.4" fill="currentColor" />
              <path d="M7 0.75v2M7 11.25v2M0.75 7h2M11.25 7h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Minha ficha
          </button>
        )}
      </div>
      <aside id={panelId} ref={asideRef} className="pp-panel" hidden={!open} aria-label="Painel do jogador">
        <div className="pp-panel__body">
          <div className="pp-tabs" role="tablist" aria-label="Painel do jogador" onKeyDown={onTabKeyDown}>
            {PANEL_TABS.map((item) => (
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
                {item.id === 'caderno' && notebookUnread && <UnreadDot />}
              </button>
            ))}
          </div>

          {/* A aba de jogo fica montada mesmo escondida: o rascunho do nome não se perde ao trocar de aba. */}
          <div role="tabpanel" id={`${panelId}-panel-jogo`} aria-labelledby={`${panelId}-tab-jogo`} className="pp-tabpanel" hidden={tab !== 'jogo'}>
            <section className="pp-section" aria-labelledby={`${panelId}-chars`}>
              <h2 id={`${panelId}-chars`} className="pp-heading">
                Meus personagens
              </h2>
              {characters.length === 0 ? (
                <p className="pp-empty">Nenhum personagem seu no mapa.</p>
              ) : (
                <ul className="pp-list">
                  {characters.map((character) => (
                    <li key={character.id}>
                      <button
                        type="button"
                        className="pp-character"
                        aria-label={`Centralizar em ${character.name}`}
                        onClick={() => focusToken(character.id)}
                      >
                        <span className="pp-dot" style={{ background: characterColor }} aria-hidden="true" />
                        <span className="pp-character__name">{character.name}</span>
                      </button>
                      {/* Fora do botão: o aria-label dele cobriria o texto do acordo. */}
                      {character.contrato !== undefined && <p className="pp-character__deal">{loanLabel(character.contrato, formatNoteTime)}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="pp-button" disabled={first === undefined} onClick={() => first && focusToken(first.id)}>
                Centralizar no meu personagem
              </button>
              <button type="button" className="pp-button" aria-pressed={signalArmed} onClick={toggleSignal}>
                {signalArmed ? 'Toque no mapa…' : 'Sinalizar'}
              </button>
              <p className="pp-empty">No PC: Alt+clique ou segure o clique parado.</p>
              <button type="button" className="pp-button pp-button--toggle" aria-pressed={measureArmed} onClick={toggleMeasure}>
                Medir
              </button>
              {measureArmed && <p className="pp-empty">Arraste no mapa para medir. Esc sai.</p>}
              <button type="button" className="pp-button pp-button--toggle" aria-pressed={laserArmed} onClick={toggleLaser}>
                Laser
              </button>
              {laserArmed && <p className="pp-empty">Segure e arraste no mapa para apontar. Quem está na sua cena vê. Esc sai.</p>}
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
              </section>
            )}

            {letter !== undefined && (
              <section className="pp-section" aria-labelledby={`${panelId}-letter`}>
                <h2 id={`${panelId}-letter`} className="pp-heading">
                  Bilhete
                </h2>
                <PlayerLetterForm {...letter} />
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
            </section>
          </div>

          <div
            role="tabpanel"
            id={`${panelId}-panel-caderno`}
            aria-labelledby={`${panelId}-tab-caderno`}
            className="pp-tabpanel"
            hidden={tab !== 'caderno'}
          >
            {/* Só montado à vista: fora da aba, o texto dos recados não fica no documento. */}
            {tab === 'caderno' && (
              <>
                <section className="pp-section" aria-labelledby={`${panelId}-clues`}>
                  <h2 id={`${panelId}-clues`} className="pp-heading">
                    Minhas pistas
                  </h2>
                  <PlayerClueList clues={clues} onOpen={onOpenClue} />
                </section>
                <section className="pp-section" aria-labelledby={`${panelId}-notes`}>
                  <h2 id={`${panelId}-notes`} className="pp-heading">
                    Recados
                  </h2>
                  <PlayerNotebook notes={notebook} />
                </section>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

/** Ponto de "recado novo". O texto escondido dá o aviso a quem usa leitor de tela. */
function UnreadDot() {
  return (
    <span className="pp-unread">
      <span className="pp-visually-hidden"> (recado novo)</span>
    </span>
  )
}
