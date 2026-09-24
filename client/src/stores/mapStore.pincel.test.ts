import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import { cellKeyAt, unveiledCellsOf } from '../lib/concealBrush'
import type { ConcealZone } from '../types/map'

/** O traço do Pincel de revelar no store: um Ctrl+Z por traço, nenhum para traço que não muda nada. */
describe('mapStore.paintRevealBrush', () => {
  const zona: ConcealZone = {
    id: 'z1',
    name: 'Ala leste',
    revealed: false,
    points: [
      { x: 500, y: 20 },
      { x: 980, y: 20 },
      { x: 980, y: 580 },
      { x: 500, y: 580 },
    ],
  }
  const traco = [
    { x: 560, y: 450 },
    { x: 940, y: 450 },
  ]

  beforeEach(() => {
    useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('m', 'M', 20, 12, 50), concealZones: [zona] })
  })

  it('começa revelando, um quadrado de largura', () => {
    expect(useMapStore.getState().revealBrushMode).toBe('revelar')
    expect(useMapStore.getState().revealBrushWidth).toBe(1)
  })

  it('um traço revela o pedaço e vira UMA entrada de desfazer', () => {
    const acertou = useMapStore.getState().paintRevealBrush(traco, 25, 'revelar')
    expect(acertou).toBe(true)
    const celulas = unveiledCellsOf(useMapStore.getState().map.concealZones[0])
    expect(celulas.has(cellKeyAt({ x: 800, y: 450 }))).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.concealZones[0].unveiledCells).toBeUndefined()
  })

  it('traço fora de zona não gasta desfazer e avisa que não pegou zona', () => {
    const acertou = useMapStore.getState().paintRevealBrush([{ x: 100, y: 100 }, { x: 300, y: 100 }], 25, 'revelar')
    expect(acertou).toBe(false)
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})
