import { HATCH_INK_COLOR, HATCH_TILE_STROKE_PX, PARCHMENT_COLOR } from './dungeonStyle'

/**
 * Subconjunto de `CanvasRenderingContext2D` que os pintores usam. Recebido por
 * parâmetro para o teste passar um contexto falso (vitest roda sem canvas 2D).
 */
export interface TileContext {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  lineCap: CanvasLineCap
  globalAlpha: number
  fillRect: (x: number, y: number, w: number, h: number) => void
  beginPath: () => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  stroke: () => void
}

/** PRNG determinístico de 32 bits: a mesma semente dá o mesmo tile (screenshot estável). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export interface HatchSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Bloco do tile que recebe um cacho de traços (64 px num tile de 256 = 4 × 4 blocos). */
export const HATCH_BLOCK_PX = 64
const HATCH_ALPHA = 0.85
const MIN_STROKES = 3
const MAX_STROKES = 5
const STROKE_SPACING_PX = 8
const STROKE_LENGTH_MIN_PX = 38
const STROKE_LENGTH_MAX_PX = 54
/** 0°, 45°, 90° e 135°: as 4 orientações do cacho. */
const ORIENTATIONS = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]

/**
 * Segmentos da hachura num tile `size × size`, já com as cópias deslocadas de
 * ±size: um traço que sai por uma borda reaparece do lado oposto, e o tile
 * emenda sem costura com `addressMode: 'repeat'`. Puro, para o teste.
 */
export function computeHatchTileSegments(size: number, seed: number): HatchSegment[] {
  const random = mulberry32(seed)
  const segments: HatchSegment[] = []
  const blocks = Math.max(1, Math.round(size / HATCH_BLOCK_PX))
  const block = size / blocks
  for (let row = 0; row < blocks; row++) {
    for (let col = 0; col < blocks; col++) {
      const angle = ORIENTATIONS[Math.floor(random() * ORIENTATIONS.length)]
      const count = MIN_STROKES + Math.floor(random() * (MAX_STROKES - MIN_STROKES + 1))
      const length = STROKE_LENGTH_MIN_PX + random() * (STROKE_LENGTH_MAX_PX - STROKE_LENGTH_MIN_PX)
      // Centro com jitter: o cacho não fica preso ao meio do bloco, e cachos vizinhos se tocam.
      const cx = (col + 0.5) * block + (random() - 0.5) * block * 0.3
      const cy = (row + 0.5) * block + (random() - 0.5) * block * 0.3
      const ux = Math.cos(angle)
      const uy = Math.sin(angle)
      const px = -uy
      const py = ux
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * STROKE_SPACING_PX
        const half = (length / 2) * (0.85 + random() * 0.15)
        const mx = cx + px * offset
        const my = cy + py * offset
        const base = { x1: mx - ux * half, y1: my - uy * half, x2: mx + ux * half, y2: my + uy * half }
        for (const dx of [-size, 0, size]) {
          for (const dy of [-size, 0, size]) {
            const copy = { x1: base.x1 + dx, y1: base.y1 + dy, x2: base.x2 + dx, y2: base.y2 + dy }
            if (segmentTouchesTile(copy, size)) segments.push(copy)
          }
        }
      }
    }
  }
  return segments
}

/** Caixa do segmento (engordada pela meia largura do traço) cruza o tile? */
function segmentTouchesTile(s: HatchSegment, size: number): boolean {
  const pad = HATCH_TILE_STROKE_PX
  return Math.max(s.x1, s.x2) >= -pad && Math.min(s.x1, s.x2) <= size + pad && Math.max(s.y1, s.y2) >= -pad && Math.min(s.y1, s.y2) <= size + pad
}

/** Pinta o tile de hachura: fundo pergaminho opaco + cachos de traços escuros. */
export function paintHatchTile(ctx: TileContext, size: number, seed: number): void {
  ctx.globalAlpha = 1
  ctx.fillStyle = hex(PARCHMENT_COLOR)
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = hex(HATCH_INK_COLOR)
  ctx.lineWidth = HATCH_TILE_STROKE_PX
  ctx.lineCap = 'round'
  ctx.globalAlpha = HATCH_ALPHA
  ctx.beginPath()
  for (const s of computeHatchTileSegments(size, seed)) {
    ctx.moveTo(s.x1, s.y1)
    ctx.lineTo(s.x2, s.y2)
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}
