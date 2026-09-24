import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import type { Pin, Wall } from '../types/map'

/**
 * ALAVANCA no editor: o "Acionar agora" do painel abre/fecha a porta ligada
 * com desfazer; porta trancada não se move e não empilha histórico. Trocar o
 * tipo e desligar a porta são `updatePin` com histórico.
 */

function porta(locked: boolean): Wall {
  return { id: 'porta-1', x1: 500, y1: 0, x2: 500, y2: 1000, blocksLight: true, blocksMove: true, door: { open: false, locked, kind: 'normal' } }
}

const ALAVANCA: Pin = { ...mapFactory.buildPin('alav', { x: 100, y: 100 }, 'alavanca'), portaLigada: 'porta-1' }

function portaAberta(): boolean | undefined {
  return useMapStore.getState().map.walls.find((w) => w.id === 'porta-1')?.door?.open
}

function carregar(locked: boolean): void {
  useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('map_alav', 'Teste', 20, 20, 50), walls: [porta(locked)], pins: [ALAVANCA] })
}

describe('pullLever no mapStore', () => {
  beforeEach(() => carregar(false))

  it('aciona a porta ligada e entra no desfazer', () => {
    useMapStore.getState().pullLever('alav')
    expect(portaAberta()).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(portaAberta()).toBe(false)
  })

  it('porta trancada: nada muda, nada no histórico', () => {
    carregar(true)
    useMapStore.getState().pullLever('alav')
    expect(portaAberta()).toBe(false)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('desligar a porta é um passo do desfazer; desligar de novo não é', () => {
    useMapStore.getState().updatePin('alav', { portaLigada: undefined })
    expect(useMapStore.getState().map.pins[0]?.portaLigada).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().updatePin('alav', { portaLigada: undefined })
    expect(useMapStore.getState().past).toHaveLength(1)
  })
})
