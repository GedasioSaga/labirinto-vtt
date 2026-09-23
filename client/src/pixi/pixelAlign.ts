// Traço fino nítido. Uma linha de 1 px de mundo desenhada numa coordenada
// inteira cai na FRONTEIRA entre dois pixels físicos e o antialias pinta os
// dois pela metade: 2 px cinza em vez de 1 px forte (medido 15/09/2026). Em
// DPR 1,25 a mesma linha cobre 1,25 px e a espessura alterna linha a linha.
//
// Receita: (1) `world.position` sempre em pixel físico inteiro
// (`snapToPhysicalPixel`), para o alinhamento depender só do zoom e não do pan;
// (2) espessura inteira em px físicos (`hairlinePhysicalWidth`); (3) o centro
// do traço no meio do pixel físico (`alignToPixel`), convertido de volta para
// mundo. Resultado: 1 coluna forte, vizinhas intactas, em qualquer zoom.

export interface PixelGrid {
  /** Pixels físicos por px de mundo: escala da câmera × resolução do renderer. */
  pxPerWorld: number
  /** Espessura do traço em pixels físicos (inteiro >= 1). */
  physicalWidth: number
}

function validPositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/** Espessura em px físicos para `cssWidth` px de tela: inteira e nunca 0. */
export function hairlinePhysicalWidth(cssWidth: number, rendererResolution: number): number {
  const res = validPositive(rendererResolution, 1)
  const width = validPositive(cssWidth, 1)
  return Math.max(1, Math.round(width * res))
}

export function pixelGrid(cameraScale: number, rendererResolution: number, cssWidth = 1): PixelGrid {
  const res = validPositive(rendererResolution, 1)
  return { pxPerWorld: validPositive(cameraScale, 1) * res, physicalWidth: hairlinePhysicalWidth(cssWidth, res) }
}

/** Largura do traço em px de mundo (o que vai no `stroke({ width })`). */
export function strokeWidthInWorld(grid: PixelGrid): number {
  return grid.physicalWidth / grid.pxPerWorld
}

/**
 * Coordenada de mundo mais próxima de `value` cujo traço, centrado nela, cobre
 * pixels físicos inteiros: meio do pixel para espessura ímpar, fronteira para
 * par. Pressupõe `world.position` em pixel físico inteiro.
 */
export function alignToPixel(value: number, grid: PixelGrid): number {
  const half = grid.physicalWidth % 2 === 1 ? 0.5 : 0
  return (Math.round(value * grid.pxPerWorld - half) + half) / grid.pxPerWorld
}

/** Posição de tela (px CSS) arredondada ao pixel físico inteiro mais próximo. */
export function snapToPhysicalPixel(value: number, rendererResolution: number): number {
  const res = validPositive(rendererResolution, 1)
  return Math.round(value * res) / res
}
