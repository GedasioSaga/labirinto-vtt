import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { previewTokenDrag } from './playerTokenDrag'

const GRID = 50
const origem = { x: 125, y: 125 }

function cena(patch: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('docas', '', 60, 20, GRID), ...patch }
}

describe('previewTokenDrag (arrasto da própria ficha)', () => {
  it('mostra "6 quadrados" junto ao dedo, com a mesma régua do Medir', () => {
    expect(previewTokenDrag(cena(), origem, { x: 125 + 6 * GRID, y: 125 + 3 * GRID })).toEqual({
      at: { x: 425, y: 275 },
      label: '6 quadrados',
    })
  })

  it('Passo 6 nas Docas: o dedo vai a 30 casas, a ficha para na sexta e o rótulo diz 6', () => {
    const preview = previewTokenDrag(cena({ movement: { maxStepCells: 6 } }), origem, { x: 125 + 30 * GRID, y: 125 })
    expect(preview).toEqual({ at: { x: 425, y: 125 }, label: '6 quadrados' })
  })

  it('Mercado livre: 30 casas são 30 quadrados', () => {
    expect(previewTokenDrag(cena(), origem, { x: 125 + 30 * GRID, y: 125 }).label).toBe('30 quadrados')
  })

  it('ficha que não saiu da casa não mostra rótulo', () => {
    expect(previewTokenDrag(cena(), origem, { x: 130, y: 128 }).label).toBeNull()
  })
})
