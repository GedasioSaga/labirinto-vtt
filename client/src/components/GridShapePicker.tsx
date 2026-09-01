import type { ReactElement } from 'react'
import type { GridShape } from '../types/map'
import { hexPath } from './gridArt'

interface GridShapePickerProps {
  value: GridShape
  onChange: (shape: GridShape) => void
  /** Distingue os dois grupos quando a tela inicial e o editor coexistem. */
  groupLabel: string
}

const OPTIONS: Array<{ shape: GridShape; label: string }> = [
  { shape: 'square', label: 'Quadrado' },
  { shape: 'hex', label: 'Hexágono' },
  { shape: 'triangle', label: 'Triangular' },
]

function SquareArt() {
  return (
    <svg width="34" height="26" viewBox="0 0 26 24" fill="none" stroke="currentColor" aria-hidden="true">
      <g strokeWidth="1.2">
        <rect x="2" y="3" width="21" height="18" />
        <path d="M9 3v18M16 3v18M2 9h21M2 15h21" />
      </g>
    </svg>
  )
}

function HexArt() {
  return (
    <svg width="34" height="26" viewBox="0 0 26 24" fill="none" stroke="currentColor" aria-hidden="true">
      <g strokeWidth="1.2">
        <path d={hexPath(8, 7.5, 6)} />
        <path d={hexPath(18.4, 7.5, 6)} />
        <path d={hexPath(13.2, 16.5, 6)} />
      </g>
    </svg>
  )
}

/**
 * Malha triangular: fileira de triângulos alternando ponta pra cima e pra baixo,
 * que é o padrão que `drawTriGrid` desenha. Distingue de `HexArt` (células
 * fechadas de 6 lados) e de `SquareArt` (retículo ortogonal).
 */
function TriangleArt() {
  return (
    <svg width="34" height="26" viewBox="0 0 26 24" fill="none" stroke="currentColor" aria-hidden="true">
      <g strokeWidth="1.2">
        <path d="M2 19h21M2 19L7.25 6M7.25 6h10.5M7.25 6L12.5 19M12.5 19L17.75 6M17.75 6L23 19" />
      </g>
    </svg>
  )
}

const ART: Record<GridShape, () => ReactElement> = {
  square: SquareArt,
  hex: HexArt,
  triangle: TriangleArt,
}

/**
 * Escolha do formato da grade desenhando o formato em si, em vez de um `<select>`
 * com duas palavras — o controle mostra o que controla.
 */
export function GridShapePicker({ value, onChange, groupLabel }: GridShapePickerProps) {
  return (
    <div className="lb-seg" role="radiogroup" aria-label={groupLabel}>
      {OPTIONS.map(({ shape, label }) => {
        const Art = ART[shape]
        return (
          <button
            key={shape}
            type="button"
            role="radio"
            aria-checked={value === shape}
            className="lb-seg__option"
            onClick={() => onChange(shape)}
          >
            <Art />
            {label}
          </button>
        )
      })}
    </div>
  )
}
