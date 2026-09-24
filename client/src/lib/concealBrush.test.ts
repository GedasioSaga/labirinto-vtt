import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { pointInRing } from './floorContour'
import type { ConcealZone, MapData, RegionPoint } from '../types/map'
import {
  REVEAL_BRUSH_CELL,
  cellKeyAt,
  concealedPieces,
  paintRevealBrush,
  revealBrushRadius,
  strokeCells,
  unveiledCellsOf,
} from './concealBrush'

const ZONA: RegionPoint[] = [
  { x: 500, y: 20 },
  { x: 980, y: 20 },
  { x: 980, y: 580 },
  { x: 500, y: 580 },
]

function mapaComZona(extra: Partial<ConcealZone> = {}): MapData {
  const zona: ConcealZone = { id: 'z1', name: 'Ala leste secreta', revealed: false, points: ZONA, ...extra }
  return { ...createEmptyMap('m', 'M', 20, 12, 50), concealZones: [zona] }
}

const TRACO: RegionPoint[] = [
  { x: 560, y: 450 },
  { x: 750, y: 450 },
  { x: 940, y: 450 },
]

/** Ponto coberto pelo preto: dentro de alguma peça devolvida. */
const preto = (pecas: RegionPoint[][], p: RegionPoint): boolean => pecas.some((peca) => pointInRing(p, peca))

describe('pincel de revelar: células do traço', () => {
  it('pega a faixa em volta do traço e nada a 150 px dele', () => {
    const celulas = new Set(strokeCells(TRACO, 25))
    expect(celulas.has(cellKeyAt({ x: 700, y: 450 }))).toBe(true)
    expect(celulas.has(cellKeyAt({ x: 700, y: 445 }))).toBe(true)
    expect(celulas.has(cellKeyAt({ x: 700, y: 455 }))).toBe(true)
    expect(celulas.has(cellKeyAt({ x: 700, y: 300 }))).toBe(false)
    expect(celulas.has(cellKeyAt({ x: 700, y: 600 }))).toBe(false)
  })

  it('um toque parado (um ponto só) ainda pinta um disco', () => {
    const celulas = new Set(strokeCells([{ x: 600, y: 300 }], 25))
    expect(celulas.has(cellKeyAt({ x: 600, y: 300 }))).toBe(true)
    expect(celulas.has(cellKeyAt({ x: 600, y: 200 }))).toBe(false)
  })

  it('traço vazio ou raio inválido não pinta nada', () => {
    expect(strokeCells([], 25)).toEqual([])
    expect(strokeCells(TRACO, 0)).toEqual([])
    expect(strokeCells(TRACO, Number.NaN)).toEqual([])
    expect(strokeCells([{ x: Number.NaN, y: 3 }], 25)).toEqual([])
  })

  it('largura do pincel é em quadrados da grade (diâmetro)', () => {
    expect(revealBrushRadius(50, 1)).toBe(25)
    expect(revealBrushRadius(50, 4)).toBe(100)
  })
})

describe('pincel de revelar: gravar no mapa', () => {
  it('revelar grava as células DENTRO da zona e devolve mapa novo', () => {
    const antes = mapaComZona()
    const r = paintRevealBrush(antes, [{ x: 400, y: 450 }, ...TRACO], 25, 'revelar')
    expect(r.map).not.toBe(antes)
    expect(r.hitZone).toBe(true)
    const celulas = unveiledCellsOf(r.map.concealZones[0])
    expect(celulas.has(cellKeyAt({ x: 800, y: 450 }))).toBe(true)
    // O pedaço do traço fora da zona não vira célula de zona nenhuma.
    expect(celulas.has(cellKeyAt({ x: 400, y: 450 }))).toBe(false)
  })

  it('esconder apaga o que foi pintado; o mapa volta sem células', () => {
    const revelado = paintRevealBrush(mapaComZona(), TRACO, 25, 'revelar').map
    const escondido = paintRevealBrush(revelado, TRACO, 25, 'esconder').map
    expect(unveiledCellsOf(escondido.concealZones[0]).size).toBe(0)
    expect(escondido.concealZones[0].unveiledCells).toBeUndefined()
  })

  it('esconder só um pedaço deixa o resto revelado', () => {
    const revelado = paintRevealBrush(mapaComZona(), TRACO, 25, 'revelar').map
    const parcial = paintRevealBrush(revelado, [{ x: 900, y: 450 }], 25, 'esconder').map
    const celulas = unveiledCellsOf(parcial.concealZones[0])
    expect(celulas.has(cellKeyAt({ x: 900, y: 450 }))).toBe(false)
    expect(celulas.has(cellKeyAt({ x: 640, y: 450 }))).toBe(true)
  })

  it('traço fora de zona ativa não muda nada e avisa que não pegou zona', () => {
    const antes = mapaComZona()
    const r = paintRevealBrush(antes, [{ x: 100, y: 100 }, { x: 300, y: 100 }], 25, 'revelar')
    expect(r.map).toBe(antes)
    expect(r.hitZone).toBe(false)
  })

  it('zona já revelada inteira não recebe pincel', () => {
    const antes = mapaComZona({ revealed: true })
    const r = paintRevealBrush(antes, TRACO, 25, 'revelar')
    expect(r.map).toBe(antes)
    expect(r.hitZone).toBe(false)
  })

  it('repintar o mesmo pedaço não gera mapa novo (sem entrada vazia no Ctrl+Z)', () => {
    const uma = paintRevealBrush(mapaComZona(), TRACO, 25, 'revelar').map
    expect(paintRevealBrush(uma, TRACO, 25, 'revelar').map).toBe(uma)
  })

  it('campo corrompido no arquivo conta como nada revelado (erro para o lado de esconder)', () => {
    const lixo = { ...mapaComZona().concealZones[0], unveiledCells: [42, 'x', '1,2,3', '3;4', '7,8'] } as unknown as ConcealZone // simula map.json editado à mão: o tipo não deixa escrever isto
    const celulas = unveiledCellsOf(lixo)
    expect([...celulas]).toEqual(['7,8'])
  })
})

describe('pincel de revelar: preto que sobra', () => {
  it('sem células, o preto é o polígono da zona inteiro', () => {
    expect(concealedPieces(ZONA, [])).toEqual([ZONA])
  })

  it('com a faixa pintada, o preto cobre a zona menos a faixa', () => {
    const celulas = strokeCells(TRACO, 25)
    const pecas = concealedPieces(ZONA, celulas)
    // Na faixa: sem preto.
    for (const x of [640, 700, 800, 900]) expect(preto(pecas, { x, y: 451 }), `x=${x}`).toBe(false)
    // Longe da faixa, ainda dentro da zona: preto.
    for (const p of [{ x: 760, y: 150 }, { x: 900, y: 250 }, { x: 600, y: 180 }, { x: 520, y: 450 }, { x: 960, y: 450 }, { x: 700, y: 560 }]) {
      expect(preto(pecas, p), `(${p.x},${p.y})`).toBe(true)
    }
    // Fora da zona: nunca preto.
    expect(preto(pecas, { x: 250, y: 450 })).toBe(false)
    // Toda peça é polígono de verdade, dentro da caixa da zona.
    for (const peca of pecas) {
      expect(peca.length).toBeGreaterThanOrEqual(3)
      for (const p of peca) {
        expect(p.x).toBeGreaterThanOrEqual(500 - 1e-6)
        expect(p.x).toBeLessThanOrEqual(980 + 1e-6)
      }
    }
  })

  it('zona côncava (em L) continua certa em volta do pedaço pintado', () => {
    const L: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 200 },
      { x: 0, y: 200 },
    ]
    const pecas = concealedPieces(L, strokeCells([{ x: 50, y: 150 }], 15))
    expect(preto(pecas, { x: 52, y: 152 })).toBe(false)
    expect(preto(pecas, { x: 150, y: 50 })).toBe(true)
    expect(preto(pecas, { x: 20, y: 180 })).toBe(true)
    // O canto de fora do L não vira preto por causa do recorte.
    expect(preto(pecas, { x: 150, y: 150 })).toBe(false)
  })

  it('célula de pincel mede REVEAL_BRUSH_CELL de lado', () => {
    expect(cellKeyAt({ x: REVEAL_BRUSH_CELL * 3 + 1, y: REVEAL_BRUSH_CELL * 2 + 1 })).toBe('3,2')
    expect(cellKeyAt({ x: -1, y: -1 })).toBe('-1,-1')
  })
})
