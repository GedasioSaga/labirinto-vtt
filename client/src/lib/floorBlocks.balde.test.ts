import { describe, expect, it } from 'vitest'
import type { FloorPiece, MapLine, Region, Wall } from '../types/map'
import { centroDoBloco, chaveDoBloco } from './floorBlocks'
import { baldeNoPonto } from './floorTool'

/**
 * Balde de tinta do Chão: a área que ele enche para em parede, linha do mapa,
 * borda de sala e borda do mapa, e não só no chão que já existe. Pedido do
 * usuário de 28/09/2026: "acho que da para criar a ferramenta balde de tinta
 * para pintar essa situação de uma vez".
 */

const CELL = 64
const COLUNAS = 10
const LINHAS = 8

function parede(x1: number, y1: number, x2: number, y2: number): Wall {
  return { id: `w${x1},${y1},${x2},${y2}`, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null } as Wall
}

/** Caixa de paredes nas linhas da grade, de (c0, r0) até (c1, r1) em células. */
function caixaDeParedes(c0: number, r0: number, c1: number, r1: number): Wall[] {
  const [x0, y0, x1, y1] = [c0 * CELL, r0 * CELL, c1 * CELL, r1 * CELL]
  return [parede(x0, y0, x1, y0), parede(x1, y0, x1, y1), parede(x1, y1, x0, y1), parede(x0, y1, x0, y0)]
}

function sala(c0: number, r0: number, c1: number, r1: number): Region {
  const [x0, y0, x1, y1] = [c0 * CELL, r0 * CELL, c1 * CELL, r1 * CELL]
  return {
    id: 'sala',
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    tag: '',
    fillColor: '#224d05',
    fillPattern: 'solid',
    data: {},
  } as Region
}

function mapa(extra: { walls?: Wall[]; lines?: MapLine[]; regions?: Region[]; floor?: FloorPiece[] }) {
  return { floor: [], grid: CELL, width: COLUNAS, height: LINHAS, walls: [], lines: [], regions: [], ...extra }
}

function celulas(piece: FloorPiece | null): Set<string> {
  if (piece === null || piece.shape.kind !== 'blocos') return new Set()
  return new Set(piece.shape.cells.map((c) => chaveDoBloco(c.col, c.row)))
}

function retangulo(c0: number, r0: number, c1: number, r1: number): Set<string> {
  const saida = new Set<string>()
  for (let col = c0; col < c1; col += 1) for (let row = r0; row < r1; row += 1) saida.add(chaveDoBloco(col, row))
  return saida
}

const clique = (col: number, row: number) => centroDoBloco({ col, row }, CELL)

describe('balde de tinta — para em parede, linha, sala e borda do mapa', () => {
  it('dentro de uma caixa de paredes enche só a caixa', () => {
    const piece = baldeNoPonto(mapa({ walls: caixaDeParedes(2, 2, 6, 5) }), clique(3, 3), () => 'caixa')
    expect(celulas(piece)).toEqual(retangulo(2, 2, 6, 5))
  })

  it('fora da caixa enche o resto do mapa até a borda, sem entrar na caixa', () => {
    const piece = baldeNoPonto(mapa({ walls: caixaDeParedes(2, 2, 6, 5) }), clique(8, 7), () => 'fora')
    const esperado = retangulo(0, 0, COLUNAS, LINHAS)
    for (const chave of retangulo(2, 2, 6, 5)) esperado.delete(chave)
    expect(celulas(piece)).toEqual(esperado)
  })

  it('a borda da sala segura o balde dos dois lados', () => {
    const map = mapa({ regions: [sala(1, 1, 4, 3)] })
    expect(celulas(baldeNoPonto(map, clique(2, 2), () => 'dentro'))).toEqual(retangulo(1, 1, 4, 3))
    const fora = celulas(baldeNoPonto(map, clique(7, 6), () => 'fora'))
    expect(fora.size).toBe(COLUNAS * LINHAS - 6)
    expect(fora.has(chaveDoBloco(2, 2))).toBe(false)
  })

  it('linha do mapa aberta que corta o mapa de ponta a ponta separa os dois lados', () => {
    const linha = {
      id: 'l',
      points: [
        { x: 5 * CELL, y: 0 },
        { x: 5 * CELL, y: LINHAS * CELL },
      ],
      closed: false,
      dotted: false,
      color: '#000',
      width: 2,
    } as MapLine
    expect(celulas(baldeNoPonto(mapa({ lines: [linha] }), clique(1, 1), () => 'esq'))).toEqual(retangulo(0, 0, 5, LINHAS))
  })

  it('parede em diagonal também segura: a caixa em losango não vaza pelo canto', () => {
    const [cx, cy, raio] = [5 * CELL, 4 * CELL, 3 * CELL]
    const walls = [parede(cx, cy - raio, cx + raio, cy), parede(cx + raio, cy, cx, cy + raio), parede(cx, cy + raio, cx - raio, cy), parede(cx - raio, cy, cx, cy - raio)]
    const dentro = celulas(baldeNoPonto(mapa({ walls }), clique(4, 3), () => 'losango'))
    expect(dentro.size).toBeGreaterThan(4)
    // CONTROLE POSITIVO: os cantos do mapa ficam do lado de fora do losango.
    expect(dentro.has(chaveDoBloco(0, 0))).toBe(false)
    expect(dentro.has(chaveDoBloco(COLUNAS - 1, LINHAS - 1))).toBe(false)
  })

  it('mapa vazio enche até a borda do mapa, sem passar dela', () => {
    expect(celulas(baldeNoPonto(mapa({}), clique(4, 4), () => 'tudo'))).toEqual(retangulo(0, 0, COLUNAS, LINHAS))
  })

  it('clique fora do mapa não enche nada', () => {
    expect(baldeNoPonto(mapa({}), { x: -10, y: 10 }, () => 'x')).toBeNull()
  })
})
