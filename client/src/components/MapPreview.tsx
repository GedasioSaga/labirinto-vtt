import { useId } from 'react'
import type { GridShape } from '../types/map'
import { gridTile } from './gridArt'

interface MapPreviewProps {
  /** Largura em quadros. */
  width: number
  /** Altura em quadros. */
  height: number
  /** Tamanho do quadro em pixels. */
  grid: number
  shape: GridShape
}

/**
 * Prévia do mapa que está sendo criado: proporção real da tela e a grade
 * escolhida, desenhada com a mesma geometria do canvas. Serve para conferir de
 * relance se 30×20 é o formato que se quer, antes de criar.
 */
export function MapPreview({ width, height, grid, shape }: MapPreviewProps) {
  const patternId = useId()
  const pxWidth = Math.max(1, width) * Math.max(1, grid)
  const pxHeight = Math.max(1, height) * Math.max(1, grid)
  const tile = gridTile(shape, Math.max(1, grid))

  return (
    <svg
      viewBox={`0 0 ${pxWidth} ${pxHeight}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Prévia do mapa: ${width} por ${height} quadros, grade ${shape === 'hex' ? 'hexagonal' : 'quadrada'}`}
    >
      <defs>
        <pattern id={patternId} width={tile.width} height={tile.height} patternUnits="userSpaceOnUse">
          <path
            d={tile.path}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </pattern>
      </defs>
      <rect width={pxWidth} height={pxHeight} fill={`url(#${patternId})`} />
      <rect className="lb-preview__frame" width={pxWidth} height={pxHeight} />
    </svg>
  )
}
