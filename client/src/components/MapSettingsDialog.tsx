import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { SettingsIcon, CloseIcon } from './icons'
import { GridControls, type GridControlsProps } from './GridControls'
import { GridAlignControls, type GridAlignControlsProps } from './GridAlignControls'
import { MapScaleControls, type MapScaleControlsProps } from './MapScaleControls'
import { ScenarioLinkControls, type ScenarioLinkControlsProps } from './ScenarioLinkControls'
import { MapSizeControls, type MapSizeControlsProps } from './MapSizeControls'
import { FEATURES } from '../lib/features'

export interface MapSettingsProps {
  grid: GridControlsProps
  gridAlign: GridAlignControlsProps
  mapScale: MapScaleControlsProps
  scenarioLink: ScenarioLinkControlsProps
  mapSize: MapSizeControlsProps
}

export interface MapSettingsDialogProps extends MapSettingsProps {
  onClose: () => void
}

interface ScenarioLinkVisibility {
  /** Default `FEATURES.scenarioLink`. Escondido, o dado continua passando e sendo gravado. */
  showScenarioLink?: boolean
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

function focusablesIn(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
}

/**
 * Janela "Configurações do mapa": o que é do mapa inteiro e se mexe pouco
 * (formato e estilo da grade, alinhamento à imagem, medição, tamanho, link de cenário)
 * sai do painel lateral e mora aqui.
 *
 * Vai por portal para o `body` porque o painel usa `backdrop-filter`, que faz
 * dele o bloco de contenção de `position: fixed` — dentro dele a janela ficaria
 * presa na coluna de 264px.
 */
export function MapSettingsDialog({
  onClose,
  grid,
  gridAlign,
  mapScale,
  scenarioLink,
  mapSize,
  showScenarioLink = FEATURES.scenarioLink,
}: MapSettingsDialogProps & ScenarioLinkVisibility) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Fecha só se o clique COMEÇOU no fundo: arrastar um slider da janela e
  // soltar fora dispara `click` no ancestral comum, que é o próprio fundo.
  const pressStartedOnBackdrop = useRef(false)
  const hasBackgroundImage = gridAlign.imageWidth !== null && gridAlign.imageHeight !== null

  useEffect(() => {
    const [first] = focusablesIn(bodyRef.current)
    ;(first ?? dialogRef.current)?.focus()
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Janela modal: nenhuma tecla daqui vale como atalho do editor (Delete
    // apagando a seleção, letras trocando de ferramenta, Esc desmarcando).
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = focusablesIn(dialogRef.current)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function onBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    pressStartedOnBackdrop.current = event.target === event.currentTarget
  }

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onClose()
    pressStartedOnBackdrop.current = false
  }

  return createPortal(
    <div className="lb-dialog-backdrop" onMouseDown={onBackdropMouseDown} onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="lb-panel lb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="lb-dialog__head">
          <h2 id={titleId} className="lb-dialog__title">
            Configurações do mapa
          </h2>
          <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>
        <div ref={bodyRef} className="lb-dialog__body lb-scroll">
          <GridControls {...grid} />
          {hasBackgroundImage ? (
            <GridAlignControls {...gridAlign} />
          ) : (
            <section className="lb-section">
              <h2 className="lb-eyebrow">Alinhar grade à imagem</h2>
              <p className="lb-field__hint">
                Importe uma imagem de fundo pela barra de baixo para ajustar a grade às casas desenhadas nela.
              </p>
            </section>
          )}
          <MapScaleControls {...mapScale} />
          <MapSizeControls {...mapSize} />
          {showScenarioLink && <ScenarioLinkControls {...scenarioLink} />}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Engrenagem do cabeçalho do painel: abre a janela e devolve o foco a ela ao fechar. */
export function MapSettingsButton({ showScenarioLink, ...props }: MapSettingsProps & ScenarioLinkVisibility) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="lb-iconbtn lb-inspector__settings"
        aria-label="Configurações do mapa"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <SettingsIcon size={18} />
      </button>
      {open && <MapSettingsDialog {...props} showScenarioLink={showScenarioLink} onClose={close} />}
    </>
  )
}
