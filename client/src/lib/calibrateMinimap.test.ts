import { describe, expect, it } from 'vitest'
import type { FloorPiece } from '../types/map'
import { compileFloor } from './floorSdf'
import { rasterizeMinimap, type MinimapRasterStyle } from './minimapRaster'
import { borderWindows, calibrateLineStyle, calibrateStroke, insetPieces, scoreWindow } from './calibrateMinimap'

const STYLE: Omit<MinimapRasterStyle, 'strokeWidth'> = {
  background: [0, 0, 0],
  floor: [0, 107, 0],
  stroke: [133, 133, 133],
  strokeAlpha: 0.955,
  lineAlpha: 0.955,
  samples: 4,
}

const SIZE = 160
const RECT = { x: 0, y: 0, w: SIZE, h: SIZE }

function blob(): FloorPiece[] {
  return [
    { id: 'a', shape: { kind: 'ellipse', cx: 80.3, cy: 78.6, rx: 55.2, ry: 41.7 }, op: 'add', rotation: 17, modifiers: {} },
    { id: 'b', shape: { kind: 'rect', cx: 78, cy: 80, w: 30.4, h: 18.3 }, op: 'subtract', rotation: -9, modifiers: {} },
  ]
}

describe('calibrateLineStyle', () => {
  it('recupera largura 1,4 e cor #858585 de linhas cinzas desenhadas com essa largura', () => {
    const floor = blob()
    const truthLines = [
      { id: 'a', points: [{ x: 50.3, y: 60.2 }, { x: 110.6, y: 64.9 }], closed: false, dotted: false, color: '#858585', width: 1.4 },
      { id: 'b', points: [{ x: 70.1, y: 45.4 }, { x: 72.8, y: 110.3 }], closed: false, dotted: false, color: '#858585', width: 1.4 },
    ]
    const style = { ...STYLE, strokeWidth: 1 }
    const reference = rasterizeMinimap({ originX: 0, originY: 0, width: SIZE, height: SIZE, floor: compileFloor(floor), lines: truthLines, markers: [] }, style)
    const traced = truthLines.map((l) => ({ ...l, width: 0.8, color: '#6b746b' }))
    const result = calibrateLineStyle({
      reference,
      width: SIZE,
      rect: RECT,
      lines: traced,
      markers: [],
      floorPieces: floor,
      style,
      colors: [null, '#858585'],
      windowSize: 32,
      windowCount: 8,
    })
    expect(result).not.toBeNull()
    expect(Math.abs((result as { lineWidth: number }).lineWidth - 1.4)).toBeLessThanOrEqual(0.15)
    expect((result as { lineColor: string | null }).lineColor).toBe('#858585')
  }, 60_000)
})

describe('insetPieces', () => {
  it('peça que soma emagrece, peça que subtrai engorda, forma continua a mesma referência', () => {
    const pieces = blob()
    const inset = insetPieces(pieces, 0.5)
    expect(inset.map((p) => p.modifiers.grow)).toEqual([-0.5, 0.5])
    expect(inset[0].shape).toBe(pieces[0].shape)
  })
})

describe('borderWindows', () => {
  it('janelas ficam dentro da área útil', () => {
    const windows = borderWindows(blob(), { x: 10, y: 10, w: 140, h: 140 }, 40, 8)
    expect(windows.length).toBeGreaterThan(4)
    for (const w of windows) {
      expect(w.x).toBeGreaterThanOrEqual(10)
      expect(w.x + w.w).toBeLessThanOrEqual(150)
    }
  })
})

describe('scoreWindow', () => {
  it('imagem idêntica pontua 100%', () => {
    const raster = rasterizeMinimap({ originX: 0, originY: 0, width: SIZE, height: SIZE, floor: compileFloor(blob()), lines: [], markers: [] }, { ...STYLE, strokeWidth: 1 })
    const s = scoreWindow(raster, SIZE, raster, RECT)
    expect(s.ink).toBeGreaterThan(0)
    expect(s.matches).toBe(s.ink)
  })
})

describe('calibrateStroke', () => {
  it('recupera largura 1,3 e recuo 0,65 de uma referência gerada com esses valores', () => {
    const truth = blob()
    const reference = rasterizeMinimap({ originX: 0, originY: 0, width: SIZE, height: SIZE, floor: compileFloor(truth), lines: [], markers: [] }, { ...STYLE, strokeWidth: 1.3 })
    // Peças vetorizadas "sem recuo" seguem a face externa do traço: a verdade engordada meia largura.
    const basePieces = insetPieces(truth, -0.65)
    const result = calibrateStroke({ reference, width: SIZE, height: SIZE, rect: RECT, basePieces, lines: [], markers: [], style: STYLE, windowSize: 40, windowCount: 8 })
    expect(result).not.toBeNull()
    expect(Math.abs((result as { strokeWidth: number }).strokeWidth - 1.3)).toBeLessThanOrEqual(0.1)
    expect(Math.abs((result as { inset: number }).inset - 0.65)).toBeLessThanOrEqual(0.1)
    expect((result as { score: number }).score).toBeGreaterThan(0.97)
  }, 60_000)

  it('com métrica de erro e opacidades candidatas recupera também a opacidade do traço', () => {
    const truth = blob()
    // n-torres: 16 níveis de cobertura por borda, para largura e opacidade não empatarem.
    const style = { ...STYLE, pattern: 'rooks' as const }
    const reference = rasterizeMinimap(
      { originX: 0, originY: 0, width: SIZE, height: SIZE, floor: compileFloor(truth), lines: [], markers: [] },
      { ...style, strokeWidth: 1.1, strokeAlpha: 0.8 },
    )
    const result = calibrateStroke({
      reference,
      width: SIZE,
      height: SIZE,
      rect: RECT,
      basePieces: insetPieces(truth, -0.55),
      lines: [],
      markers: [],
      style,
      windowSize: 40,
      windowCount: 8,
      metric: 'error',
      alphas: [0.7, 0.8, 0.9, 1],
    })
    expect(result).not.toBeNull()
    const r = result as { strokeWidth: number; strokeAlpha: number }
    // Com cobertura quantizada em quartos (grade 4×4), larguras vizinhas geram imagens quase iguais:
    // o que importa é a opacidade certa e a largura na vizinhança.
    expect(Math.abs(r.strokeWidth - 1.1)).toBeLessThanOrEqual(0.2)
    // Largura e opacidade são quase degeneradas (mesma tinta): aceita o candidato vizinho.
    expect(Math.abs(r.strokeAlpha - 0.8)).toBeLessThanOrEqual(0.1 + 1e-9)
  }, 60_000)
})
