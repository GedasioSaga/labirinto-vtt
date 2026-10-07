import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'
import { SceneVisionControls, type SceneVisionControlsProps } from './SceneVisionControls'

/** Raio em px que o jogador usa quando a cena não diz nada (`DEFAULT_VISION_RADIUS`, `net/hostBridge.ts`). */
export const RAIO_PADRAO_PX = 700

/** Lado da prévia, em px de tela. */
const PREVIA_LADO = 168
/** Folga, em quadrados, entre a borda do raio e a borda da prévia. */
const PREVIA_FOLGA = 1.5
/** Abaixo disso a grade vira borrão: some e fica só o círculo. */
const QUADRO_MIN_PX = 6

export interface SceneSettingsDialogProps {
  sceneName: string
  /** Tamanho do quadro da cena em px: converte o raio padrão em quadrados. */
  cellPx: number
  vision: Required<Pick<SceneVisionControlsProps, 'dark' | 'onDarkChange'>> & SceneVisionControlsProps
  onClose: () => void
}

/** Quadrados que o jogador enxerga: o valor da cena, senão o raio padrão convertido. */
export function raioEmQuadrados(visionCells: number | undefined, cellPx: number): { cells: number; padrao: boolean } {
  if (visionCells !== undefined) return { cells: visionCells, padrao: false }
  const lado = Number.isFinite(cellPx) && cellPx > 0 ? cellPx : 64
  return { cells: Math.round((RAIO_PADRAO_PX / lado) * 10) / 10, padrao: true }
}

function formatarQuadrados(cells: number): string {
  const texto = String(cells).replace('.', ',')
  return cells === 1 ? '1 quadrado' : `${texto} quadrados`
}

/**
 * Radar da visão: a ficha no meio, a grade em volta e o círculo até onde o
 * jogador enxerga. Em cena escura só a casa da ficha fica clara; o círculo vira
 * tracejado, porque lá fora ele só vê o que uma Luz ilumina.
 */
export function VisionPreview({ cells, dark }: { cells: number; dark: boolean }) {
  const meio = PREVIA_LADO / 2
  const quadro = meio / (cells + PREVIA_FOLGA)
  const raio = cells * quadro
  const linhas: number[] = []
  if (quadro >= QUADRO_MIN_PX) {
    // Linhas a partir do centro: a ficha fica no meio de uma casa.
    for (let d = quadro / 2; d < meio; d += quadro) linhas.push(meio + d, meio - d)
  }
  return (
    <svg className="lb-cena-config__previa" width={PREVIA_LADO} height={PREVIA_LADO} viewBox={`0 0 ${PREVIA_LADO} ${PREVIA_LADO}`} role="img" aria-label={`Prévia: o jogador vê ${formatarQuadrados(cells)} em volta${dark ? ', cena escura' : ''}`}>
      <rect width={PREVIA_LADO} height={PREVIA_LADO} className="lb-cena-config__escuro" />
      {!dark && <circle cx={meio} cy={meio} r={raio} className="lb-cena-config__visto" />}
      {dark && <rect x={meio - quadro * 1.5} y={meio - quadro * 1.5} width={quadro * 3} height={quadro * 3} className="lb-cena-config__visto" />}
      {linhas.map((p) => (
        <g key={p} className="lb-cena-config__grade">
          <line x1={p} y1={0} x2={p} y2={PREVIA_LADO} />
          <line x1={0} y1={p} x2={PREVIA_LADO} y2={p} />
        </g>
      ))}
      <circle cx={meio} cy={meio} r={raio} className={`lb-cena-config__borda${dark ? ' lb-cena-config__borda--escura' : ''}`} />
      <circle cx={meio} cy={meio} r={Math.max(3, quadro * 0.35)} className="lb-cena-config__ficha" />
    </svg>
  )
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * "Configurar cena" (pedido de 07/10/2026): a visão dos jogadores, por cena,
 * com o radar ao lado. Abre pelo botão de engrenagem na linha da cena.
 */
export function SceneSettingsDialog({ sceneName, cellPx, vision, onClose }: SceneSettingsDialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  const { cells, padrao } = raioEmQuadrados(vision.visionCells, cellPx)

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('input')?.focus()
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Janela modal: nenhuma tecla daqui vale como atalho do editor.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
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

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onClose()
    pressStartedOnBackdrop.current = false
  }

  return createPortal(
    <div
      className="lb-dialog-backdrop"
      onMouseDown={(event) => (pressStartedOnBackdrop.current = event.target === event.currentTarget)}
      onClick={onBackdropClick}
    >
      <div ref={dialogRef} className="lb-panel lb-dialog lb-cena-config" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
        <header className="lb-dialog__head">
          <h2 id={titleId} className="lb-dialog__title">
            Configurar {sceneName}
          </h2>
          <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="lb-dialog__body lb-scroll lb-cena-config__corpo">
          <SceneVisionControls {...vision} />
          <figure className="lb-cena-config__radar">
            <VisionPreview cells={cells} dark={vision.dark} />
            <figcaption className="lb-field__hint">
              {padrao ? `Sem valor: raio padrão, cerca de ${formatarQuadrados(cells)}.` : `${formatarQuadrados(cells)} em volta da ficha.`}
              {vision.dark ? ' Cena escura: fora da casa da ficha, só o que uma Luz ilumina.' : ''} Vezes o fator de cada jogador.
            </figcaption>
          </figure>
        </div>
      </div>
    </div>,
    document.body,
  )
}
