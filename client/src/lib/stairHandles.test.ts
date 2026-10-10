import { describe, expect, it } from 'vitest'
import type { Stair } from '../types/map'
import { dragStairHandle, stairHandles, type StairHandleKind } from './stairHandles'
import { findStairHandleAt } from './handleHitArea'
import { stairCurveLimit, stairLength, stairTurnDegrees, STAIR_MIN_CELLS } from './stairCurve'

const GRID = 70

function escada(overrides: Partial<Stair> = {}): Stair {
  return {
    id: 's1',
    shape: 'straight',
    direction: 'up',
    // Em pé, como no print do pedido: do pé (embaixo) ao topo (em cima).
    segments: [{ x1: 140, y1: 420, x2: 140, y2: 140 }],
    stepWidth: 70,
    ...overrides,
  }
}

function alca(stair: Stair, kind: StairHandleKind) {
  const encontrada = stairHandles(stair).find((h) => h.kind === kind)
  if (encontrada === undefined) throw new Error(`sem alça ${kind}`)
  return encontrada.point
}

describe('stairHandles — onde cada alça fica', () => {
  it('reta: as duas pontas, as duas laterais no meio e a de curvar no meio', () => {
    const reta = escada()
    expect(stairHandles(reta).map((h) => h.kind).sort()).toEqual(['curve', 'end', 'side-left', 'side-right', 'start'])
    expect(alca(reta, 'start')).toEqual({ x: 140, y: 420 })
    expect(alca(reta, 'end')).toEqual({ x: 140, y: 140 })
    expect(alca(reta, 'curve')).toEqual({ x: 140, y: 280 })
    // Corda para cima, (0, −1): a normal (−dy, dx) da curva positiva é (1, 0), +x na tela.
    expect(alca(reta, 'side-left')).toEqual({ x: 175, y: 280 })
    expect(alca(reta, 'side-right')).toEqual({ x: 105, y: 280 })
  })

  it('curva: a alça do meio e as laterais seguem o meio do arco', () => {
    const curva = escada({ curva: 70 })
    expect(alca(curva, 'curve')).toEqual({ x: 210, y: 280 })
    expect(alca(curva, 'side-left')).toEqual({ x: 245, y: 280 })
    expect(alca(curva, 'side-right')).toEqual({ x: 175, y: 280 })
  })

  it('espiral só tem as pontas do diâmetro; L e dupla não têm a de curvar', () => {
    expect(stairHandles(escada({ shape: 'spiral' })).map((h) => h.kind).sort()).toEqual(['end', 'start'])
    const l = escada({ shape: 'l', segments: [{ x1: 0, y1: 0, x2: 140, y2: 0 }, { x1: 140, y1: 0, x2: 140, y2: 140 }] })
    expect(stairHandles(l).map((h) => h.kind).sort()).toEqual(['end', 'side-left', 'side-right', 'start'])
    expect(alca(l, 'end')).toEqual({ x: 140, y: 140 })
  })

  it('lance de comprimento zero não tem alça', () => {
    expect(stairHandles(escada({ segments: [{ x1: 5, y1: 5, x2: 5, y2: 5 }] }))).toEqual([])
    expect(stairHandles(escada({ segments: [] }))).toEqual([])
  })

  it('escada girada (na diagonal): as alças seguem o lance', () => {
    const diagonal = escada({ segments: [{ x1: 0, y1: 0, x2: 168, y2: 224 }] }) // 280 de corda
    const lado = alca(diagonal, 'side-left')
    // Normal (−0,8, 0,6) × meia largura 35, a partir do meio (84, 112).
    expect(lado.x).toBeCloseTo(84 - 28, 9)
    expect(lado.y).toBeCloseTo(112 + 21, 9)
  })
})

describe('findStairHandleAt — o clique pega a alça mais perto, no tamanho da tela', () => {
  it('pega a ponta e a de curvar; longe, nada', () => {
    const reta = escada()
    expect(findStairHandleAt(reta, { x: 142, y: 418 }, 1)).toBe('start')
    expect(findStairHandleAt(reta, { x: 140, y: 283 }, 1)).toBe('curve')
    expect(findStairHandleAt(reta, { x: 172, y: 281 }, 1)).toBe('side-left')
    expect(findStairHandleAt(reta, { x: 140, y: 350 }, 1)).toBeNull()
  })

  it('com zoom longe a área cresce em px de mundo', () => {
    expect(findStairHandleAt(escada(), { x: 140, y: 440 }, 1)).toBeNull()
    expect(findStairHandleAt(escada(), { x: 140, y: 440 }, 0.25)).toBe('start')
  })
})

describe('dragStairHandle — o que cada alça faz', () => {
  it('ponta: muda o comprimento na mesma reta e a ponta oposta fica parada', () => {
    const reta = escada()
    // Puxa o topo 1,6 casa para cima e meia casa para o lado: o lado não conta.
    const nova = dragStairHandle({ stair: reta, handle: 'end', pointer: { x: 175, y: 28 }, grid: GRID, snap: false })
    expect(nova.segments[0]).toEqual({ x1: 140, y1: 420, x2: 140, y2: 28 })
  })

  it('ponta com grade: o comprimento cai em meia casa', () => {
    const nova = dragStairHandle({ stair: escada(), handle: 'start', pointer: { x: 140, y: 500 }, grid: GRID, snap: true })
    // 360 px → 5 casas e pouco → 5,0 casas (350 px) a partir do topo parado.
    expect(nova.segments[0]).toEqual({ x1: 140, y1: 490, x2: 140, y2: 140 })
  })

  it('ponta passada da oposta: comprimento mínimo, nunca zero nem invertido', () => {
    const nova = dragStairHandle({ stair: escada(), handle: 'end', pointer: { x: 140, y: 900 }, grid: GRID, snap: false })
    expect(stairLength(nova)).toBeCloseTo(GRID * STAIR_MIN_CELLS, 9)
    expect(nova.segments[0].x1).toBe(140)
    expect(nova.segments[0].y1).toBe(420)
    expect(nova.segments[0].y2).toBeLessThan(420)
  })

  it('lateral: largura simétrica, a linha do meio não sai do lugar', () => {
    const reta = escada()
    const nova = dragStairHandle({ stair: reta, handle: 'side-right', pointer: { x: 70, y: 300 }, grid: GRID, snap: false })
    expect(nova.stepWidth).toBe(140)
    expect(nova.segments).toBe(reta.segments)
  })

  it('lateral com grade cai em meia casa; nunca abaixo do mínimo', () => {
    expect(dragStairHandle({ stair: escada(), handle: 'side-left', pointer: { x: 190, y: 280 }, grid: GRID, snap: true }).stepWidth).toBe(105)
    expect(dragStairHandle({ stair: escada(), handle: 'side-left', pointer: { x: 140, y: 280 }, grid: GRID, snap: false }).stepWidth).toBe(GRID * STAIR_MIN_CELLS)
  })

  it('meio: curva para o lado puxado, as pontas ficam', () => {
    const reta = escada()
    const nova = dragStairHandle({ stair: reta, handle: 'curve', pointer: { x: 100, y: 280 }, grid: GRID, snap: false })
    expect(nova.curva).toBe(-40)
    expect(nova.segments).toBe(reta.segments)
  })

  it('meio com grade: a volta cai de 15 em 15 graus; perto de reto, volta a reta e o campo some', () => {
    const quase = dragStairHandle({ stair: escada({ curva: 30 }), handle: 'curve', pointer: { x: 143, y: 280 }, grid: GRID, snap: true })
    expect(quase.curva).toBeUndefined()
    const curva = dragStairHandle({ stair: escada(), handle: 'curve', pointer: { x: 200, y: 280 }, grid: GRID, snap: true })
    expect(Math.round(stairTurnDegrees(curva)) % 15).toBe(0)
  })

  it('meio puxado longe demais: limitada para os degraus não se cruzarem', () => {
    const nova = dragStairHandle({ stair: escada(), handle: 'curve', pointer: { x: 5000, y: 280 }, grid: GRID, snap: false })
    expect(nova.curva).toBe(stairCurveLimit(280, 70))
  })

  it('L e dupla escalam pela ponta, sem curvar', () => {
    const l = escada({ shape: 'l', segments: [{ x1: 0, y1: 0, x2: 140, y2: 0 }, { x1: 140, y1: 0, x2: 140, y2: 140 }] })
    const nova = dragStairHandle({ stair: l, handle: 'curve', pointer: { x: 70, y: 300 }, grid: GRID, snap: false })
    expect(nova).toBe(l)
  })
})
