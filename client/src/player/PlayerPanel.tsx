import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent, FormEvent, MouseEvent, RefObject } from 'react'
import type { StorageLike } from './playerConnection'
import { NAME_MAX_LENGTH } from '../net/protocol'

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

export interface PlayerCharacter {
  id: string
  name: string
}

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
}: PlayerPanelProps) {
  const drawerScreen = useSyncExternalStore(subscribeDrawerScreen, isDrawerScreen, () => false)
  // Um estado por forma: a coluna do notebook nasce aberta e a gaveta do
  // celular nasce fechada. Atravessar o corte (girar o celular, estreitar a
  // janela) mostra cada forma como ela estava, sem a gaveta abrir sozinha por
  // cima do mapa.
  const [columnOpen, setColumnOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const open = drawerScreen ? drawerOpen : columnOpen
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

  const first = characters[0]
  // O personagem editável é o primeiro da lista: é quase sempre o único, e
  // "qual dos meus" só faria sentido com uma escolha na tela que ninguém pediu.
  const myTokenId = first?.id ?? null
  const myTokenName = first?.name ?? ''
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

          {first !== undefined && (
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
      </aside>
    </>
  )
}
