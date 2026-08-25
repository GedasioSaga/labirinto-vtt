import type { GridShape } from '../types/map'

/**
 * Geometria SVG das grades — pura, sem React.
 *
 * O hexágono é pointy-top e usa a mesma convenção de `pixi/hexGrid.ts`
 * (vértices em 60°·i − 30°, `size` = circunraio), para a prévia bater com o que
 * o canvas desenha de verdade.
 */

export interface GridTile {
  /** Largura do ladrilho que se repete, em px de mundo. */
  width: number
  /** Altura do ladrilho que se repete, em px de mundo. */
  height: number
  /** Caminho SVG desenhado dentro do ladrilho, já emendando nas bordas. */
  path: string
}

const round = (value: number) => Math.round(value * 1000) / 1000

/** Contorno de um hexágono pointy-top centrado em (cx, cy). */
export function hexPath(cx: number, cy: number, size: number): string {
  const corners: string[] = []
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    corners.push(`${round(cx + size * Math.cos(angle))} ${round(cy + size * Math.sin(angle))}`)
  }
  return `M${corners.join('L')}Z`
}

function squareTile(cell: number): GridTile {
  // Só as bordas direita e inferior: repetidas, formam a grade inteira sem
  // traço duplo nas emendas.
  return { width: cell, height: cell, path: `M${cell} 0V${cell}M0 ${cell}H${cell}` }
}

function hexTile(size: number): GridTile {
  const width = round(Math.sqrt(3) * size)
  const height = round(3 * size)
  // A malha hexagonal é gerada por (width, 0) e (width/2, height/2). Um
  // retângulo width×height contém dois centros; os vizinhos entram no caminho
  // para o ladrilho emendar sem costura visível.
  const centers: Array<[number, number]> = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
    [width / 2, height / 2],
    [-width / 2, height / 2],
    [(width * 3) / 2, height / 2],
  ]
  return { width, height, path: centers.map(([cx, cy]) => hexPath(cx, cy, size)).join('') }
}

export function gridTile(shape: GridShape, cell: number): GridTile {
  return shape === 'hex' ? hexTile(cell) : squareTile(cell)
}
