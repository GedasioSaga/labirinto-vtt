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
  it('mostra "6 casas" junto ao dedo (um nome só, E20), com a mesma régua do Medir', () => {
    expect(previewTokenDrag(cena(), origem, { x: 125 + 6 * GRID, y: 125 + 3 * GRID })).toEqual({
      at: { x: 425, y: 275 },
      label: '6 casas',
    })
  })

  it('Passo 6 nas Docas: o dedo vai a 30 casas, a ficha para na sexta e o rótulo diz 6', () => {
    const preview = previewTokenDrag(cena({ movement: { maxStepCells: 6 } }), origem, { x: 125 + 30 * GRID, y: 125 })
    expect(preview).toEqual({ at: { x: 425, y: 125 }, label: '6 casas' })
  })

  it('Lento (Fase 3): passo 6 vira 3, o mesmo corte do host; a ficha sem condição (campo ausente) anda os 6', () => {
    const docas = cena({ movement: { maxStepCells: 6 } })
    const longe = { x: 125 + 30 * GRID, y: 125 }
    expect(previewTokenDrag(docas, origem, longe, { conditions: ['lento'] })).toEqual({ at: { x: 275, y: 125 }, label: '3 casas' })
    expect(previewTokenDrag(docas, origem, longe, {})).toEqual({ at: { x: 425, y: 125 }, label: '6 casas' })
  })

  it('Mercado livre: o dedo a 30 casas diz 30 casas', () => {
    expect(previewTokenDrag(cena(), origem, { x: 125 + 30 * GRID, y: 125 }).label).toBe('30 casas')
  })

  it('ficha que não saiu da casa não mostra rótulo', () => {
    expect(previewTokenDrag(cena(), origem, { x: 130, y: 128 }).label).toBeNull()
  })
})
