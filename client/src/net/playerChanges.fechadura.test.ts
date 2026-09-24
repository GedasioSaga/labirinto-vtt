import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Pin, Wall } from '../types/map'
import { hostPlayerChanges } from './playerChanges'

/**
 * FECHADURA COM SEGREDO no mapa do mestre: o jogador acertou, a sessão
 * conferiu, e o integrador abre a fechadura e destranca a porta ligada — fora
 * do Ctrl+Z do mestre, como a porta que o jogador abre.
 */

const COFRE: Pin = { id: 'cofre', x: 100, y: 100, kind: 'exclamacao', description: 'Cofre', image: null, segredo: { resposta: '12', forma: 'teclado', abrePorta: 'porta' } }
const PORTA: Wall = { id: 'porta', x1: 300, y1: 240, x2: 340, y2: 240, blocksLight: true, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } }
const LUZ = { id: 'l1', x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 }

function mapa(): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), walls: [PORTA], pins: [COFRE] }
}

beforeEach(() => {
  useMapStore.getState().loadMap(mapa())
  useAdventureStore.setState({ cache: {}, dirty: {} })
})

describe('applyLock no mapa do mestre', () => {
  it('abre a fechadura e destranca a porta, e o Ctrl+Z desfaz o passo do mestre, não a abertura', () => {
    useMapStore.getState().addLight(LUZ)
    hostPlayerChanges.applyLock({ pinId: 'cofre' })
    const agora = useMapStore.getState().map
    expect(agora.pins[0].segredo?.aberta).toBe(true)
    expect(agora.walls[0].door).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    const depois = useMapStore.getState().map
    expect(depois.lights).toHaveLength(0)
    expect(depois.pins[0].segredo?.aberta).toBe(true)
    expect(depois.walls[0].door?.locked).toBe(false)
  })
})
