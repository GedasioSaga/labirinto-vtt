import { describe, expect, it } from 'vitest'
import { computeHatchTileSegments, mulberry32, paintHatchTile, type TileContext } from './proceduralTiles'
import { HATCH_TILE_SIZE, HATCH_TILE_STROKE_PX } from './dungeonStyle'

/** Contexto 2D falso que registra cada chamada, na ordem. */
function recordingContext(): { ctx: TileContext; calls: string[] } {
  const calls: string[] = []
  const ctx: TileContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    globalAlpha: 1,
    fillRect: (x, y, w, h) => calls.push(`fillRect ${x} ${y} ${w} ${h}`),
    beginPath: () => calls.push('beginPath'),
    moveTo: (x, y) => calls.push(`moveTo ${x.toFixed(3)} ${y.toFixed(3)}`),
    lineTo: (x, y) => calls.push(`lineTo ${x.toFixed(3)} ${y.toFixed(3)}`),
    stroke: () => calls.push('stroke'),
  }
  return { ctx, calls }
}

describe('proceduralTiles — tile de hachura determinístico e sem costura (passo 3, F2)', () => {
  it('mulberry32: a mesma semente gera a mesma sequência; sementes diferentes divergem', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const c = mulberry32(43)
    const seqA = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(seqA)
    expect([c(), c(), c()]).not.toEqual(seqA)
    for (const value of seqA) expect(value).toBeGreaterThanOrEqual(0)
  })

  it('paintHatchTile: mesma semente → mesma sequência de chamadas', () => {
    const first = recordingContext()
    const second = recordingContext()
    paintHatchTile(first.ctx, HATCH_TILE_SIZE, 7)
    paintHatchTile(second.ctx, HATCH_TILE_SIZE, 7)
    expect(first.calls).toEqual(second.calls)
    expect(first.calls[0]).toBe(`fillRect 0 0 ${HATCH_TILE_SIZE} ${HATCH_TILE_SIZE}`)
    expect(first.ctx.lineWidth).toBe(HATCH_TILE_STROKE_PX)
  })

  it('traço de pelo menos 3 texels: a 35% de escala efetiva continua com 1 px de tela', () => {
    expect(HATCH_TILE_STROKE_PX * 0.35).toBeGreaterThanOrEqual(1)
  })

  it('o tile emenda: todo traço que sai por uma borda tem a cópia deslocada de ±size entrando pelo lado oposto', () => {
    const size = HATCH_TILE_SIZE
    const segments = computeHatchTileSegments(size, 11)
    const has = (x1: number, y1: number, x2: number, y2: number) =>
      segments.some((s) => Math.abs(s.x1 - x1) < 1e-9 && Math.abs(s.y1 - y1) < 1e-9 && Math.abs(s.x2 - x2) < 1e-9 && Math.abs(s.y2 - y2) < 1e-9)
    let crossing = 0
    for (const s of segments) {
      if (Math.max(s.x1, s.x2) > size) {
        crossing++
        expect(has(s.x1 - size, s.y1, s.x2 - size, s.y2)).toBe(true)
      }
      if (Math.max(s.y1, s.y2) > size) {
        crossing++
        expect(has(s.x1, s.y1 - size, s.x2, s.y2 - size)).toBe(true)
      }
    }
    expect(crossing).toBeGreaterThan(0)
  })

  it('cada bloco de 64 px recebe um cacho de 3 a 5 traços', () => {
    const size = HATCH_TILE_SIZE
    const inside = computeHatchTileSegments(size, 3).filter((s) => {
      const mx = (s.x1 + s.x2) / 2
      const my = (s.y1 + s.y2) / 2
      return mx >= 0 && mx < size && my >= 0 && my < size
    })
    // 16 blocos × 3..5 traços; o jitter pode empurrar o meio de um traço para fora, por isso a folga.
    expect(inside.length).toBeGreaterThanOrEqual(16 * 3 - 8)
    expect(inside.length).toBeLessThanOrEqual(16 * 5)
  })
})
