import { describe, expect, it } from 'vitest'
import { segmentsIntersect, moveCrossesWall, resolveTokenMove } from './collision'
import type { Wall } from '../types/map'

describe('segmentsIntersect', () => {
  it('detecta cruzamento em X', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(true)
  })

  it('segmentos paralelos sem toque não cruzam', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ).toBe(false)
  })

  it('T-junction (endpoint sobre o outro segmento) conta como cruzamento', () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 0 }),
    ).toBe(true)
  })
})

const blockingWall: Wall = { id: 'w1', x1: 5, y1: -10, x2: 5, y2: 10, blocksLight: true, blocksMove: true, door: null }
const decorativeWall: Wall = { ...blockingWall, id: 'w2', blocksMove: false }

describe('moveCrossesWall', () => {
  it('true quando movimento cruza parede bloqueante', () => {
    expect(moveCrossesWall({ x: 0, y: 0 }, { x: 10, y: 0 }, blockingWall)).toBe(true)
  })

  it('false quando a parede não bloqueia movimento, mesmo cruzando geometricamente', () => {
    expect(moveCrossesWall({ x: 0, y: 0 }, { x: 10, y: 0 }, decorativeWall)).toBe(false)
  })

  it('false quando o movimento não cruza a parede', () => {
    expect(moveCrossesWall({ x: 0, y: 0 }, { x: 4, y: 0 }, blockingWall)).toBe(false)
  })

  it('false quando a parede é uma porta aberta, mesmo bloqueando e cruzando de verdade', () => {
    const openDoorWall: Wall = { ...blockingWall, door: { open: true, locked: false, kind: 'normal' } }
    expect(moveCrossesWall({ x: 0, y: 0 }, { x: 10, y: 0 }, openDoorWall)).toBe(false)
  })

  it('true quando a parede é uma porta fechada e o movimento cruza', () => {
    const closedDoorWall: Wall = { ...blockingWall, door: { open: false, locked: false, kind: 'normal' } }
    expect(moveCrossesWall({ x: 0, y: 0 }, { x: 10, y: 0 }, closedDoorWall)).toBe(true)
  })
})

describe('resolveTokenMove', () => {
  it('rejeita movimento que cruza parede bloqueante, mantém posição original', () => {
    const result = resolveTokenMove({ x: 0, y: 0 }, { x: 10, y: 0 }, [blockingWall])
    expect(result).toEqual({ x: 0, y: 0 })
  })

  it('aceita movimento que não cruza nenhuma parede', () => {
    const result = resolveTokenMove({ x: 0, y: 0 }, { x: 4, y: 0 }, [blockingWall])
    expect(result).toEqual({ x: 4, y: 0 })
  })

  it('aceita movimento cruzando parede decorativa (blocksMove: false)', () => {
    const result = resolveTokenMove({ x: 0, y: 0 }, { x: 10, y: 0 }, [decorativeWall])
    expect(result).toEqual({ x: 10, y: 0 })
  })
})

describe('porta trancada', () => {
  it('trancada bloqueia mesmo com open: true (mapa antigo ou UI que deixou os dois ligados)', () => {
    const lockedOpen: Wall = { ...blockingWall, door: { open: true, locked: true, kind: 'normal' } }
    expect(moveCrossesWall({ x: 0, y: 0 }, { x: 10, y: 0 }, lockedOpen)).toBe(true)
    expect(resolveTokenMove({ x: 0, y: 0 }, { x: 10, y: 0 }, [lockedOpen])).toEqual({ x: 0, y: 0 })
  })
})

describe('passagem pelo vão de porta aberta', () => {
  // Parede vertical em x=100 partida pela ferramenta Porta: pedaço de cima, vão de 32 px (134..166), pedaço de baixo.
  const acima: Wall = { id: 'acima', x1: 100, y1: 0, x2: 100, y2: 134, blocksLight: true, blocksMove: true, door: null }
  const porta: Wall = { id: 'porta', x1: 100, y1: 134, x2: 100, y2: 166, blocksLight: true, blocksMove: true, door: { open: true, locked: false, kind: 'normal' } }
  const abaixo: Wall = { id: 'abaixo', x1: 100, y1: 166, x2: 100, y2: 300, blocksLight: true, blocksMove: true, door: null }
  const walls = [acima, porta, abaixo]

  it('entrar em diagonal: o traço do centro pega o pedaço de parede ao lado, mas o token passa pelo vão', () => {
    // Cruza a linha da parede em y=182,5: 16,5 px abaixo do vão.
    expect(resolveTokenMove({ x: 20, y: 150 }, { x: 180, y: 215 }, walls)).toEqual({ x: 180, y: 215 })
  })

  it('traço que passa exatamente na junta porta/parede não trava', () => {
    expect(resolveTokenMove({ x: 20, y: 166 }, { x: 180, y: 166 }, walls)).toEqual({ x: 180, y: 166 })
  })

  it('parede ao lado continua bloqueando quando o traço passa longe do vão', () => {
    expect(resolveTokenMove({ x: 20, y: 280 }, { x: 180, y: 280 }, walls)).toEqual({ x: 20, y: 280 })
  })

  it('mesma diagonal com a porta fechada ou trancada é bloqueada', () => {
    const fechada = { ...porta, door: { open: false, locked: false, kind: 'normal' as const } }
    const trancada = { ...porta, door: { open: true, locked: true, kind: 'normal' as const } }
    expect(resolveTokenMove({ x: 20, y: 150 }, { x: 180, y: 215 }, [acima, fechada, abaixo])).toEqual({ x: 20, y: 150 })
    expect(resolveTokenMove({ x: 20, y: 150 }, { x: 180, y: 215 }, [acima, trancada, abaixo])).toEqual({ x: 20, y: 150 })
  })

  it('não usa o vão para contornar uma segunda parede no caminho', () => {
    const outra: Wall = { id: 'outra', x1: 140, y1: 150, x2: 140, y2: 300, blocksLight: true, blocksMove: true, door: null }
    expect(resolveTokenMove({ x: 20, y: 150 }, { x: 180, y: 215 }, [...walls, outra])).toEqual({ x: 20, y: 150 })
  })
})
