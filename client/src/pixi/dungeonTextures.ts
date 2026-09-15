import { CanvasSource, FillPattern, Matrix, Texture } from 'pixi.js'
import { HATCH_TILE_REFERENCE_GRID, HATCH_TILE_SIZE } from './dungeonStyle'
import { paintHatchTile } from './proceduralTiles'

/** Semente fixa: o mesmo tile em todo mount (screenshot do e2e estável). */
const HATCH_SEED = 0x5eed

export interface DungeonTextures {
  /** Padrão da faixa de hachura, em espaço GLOBAL: faixas sobrepostas ficam na mesma fase. */
  hatchPattern: FillPattern
  /** Reescala o padrão para outra grade, sem recriar a textura. */
  setGrid: (grid: number) => void
  /** Libera a textura do tile (FillPattern.destroy destrói a textura junto). */
  destroy: () => void
}

/**
 * Cria as texturas procedurais POR RENDERER (chamar no setup() do PixiCanvas e
 * do PlayerView, nunca em escopo de módulo). Devolve `null` sem canvas 2D
 * (vitest em Node/jsdom): quem desenha cai em cor lisa.
 */
export function createDungeonTextures(grid: number): DungeonTextures | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = HATCH_TILE_SIZE
  canvas.height = HATCH_TILE_SIZE
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    ctx = null
  }
  if (!ctx) return null
  paintHatchTile(ctx, HATCH_TILE_SIZE, HATCH_SEED)

  const texture = new Texture({
    source: new CanvasSource({
      resource: canvas,
      addressMode: 'repeat',
      scaleMode: 'linear',
      autoGenerateMipmaps: true,
    }),
  })
  const hatchPattern = new FillPattern({ texture, repetition: 'repeat', textureSpace: 'global' })
  let currentGrid = Number.NaN
  let destroyed = false

  const setGrid = (next: number) => {
    if (destroyed || next === currentGrid || !(next > 0)) return
    currentGrid = next
    const ratio = next / HATCH_TILE_REFERENCE_GRID
    hatchPattern.setTransform(new Matrix().scale(ratio, ratio))
  }
  setGrid(grid)

  return {
    hatchPattern,
    setGrid,
    destroy: () => {
      if (destroyed) return
      destroyed = true
      hatchPattern.destroy()
    },
  }
}
