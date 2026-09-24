import { beforeEach, describe, expect, it } from 'vitest'
import { torre } from '../lib/__fixtures__/hazardTower'
import { areaTriggerOfRegion } from '../lib/areaTriggers'
import { useMapStore } from './mapStore'

/**
 * GATILHO DE ÁREA, lado do HISTÓRICO. Marcar a área e mostrar aos jogadores
 * são decisões do mestre sobre o mapa: Ctrl+Z desfaz uma de cada vez. Clique
 * que não muda nada não gasta entrada do desfazer.
 */
describe('mapStore — gatilho de área', () => {
  beforeEach(() => {
    useMapStore.setState({ map: torre(), past: [], future: [] })
  })

  it('marcar e revelar são dois passos do desfazer', () => {
    useMapStore.getState().setRegionTrigger('sala-b', 'armadilha')
    expect(areaTriggerOfRegion(useMapStore.getState().map, 'sala-b')?.kind).toBe('armadilha')
    useMapStore.getState().setRegionTriggerRevealed('sala-b', true)
    expect(areaTriggerOfRegion(useMapStore.getState().map, 'sala-b')?.revealed).toBe(true)
    expect(useMapStore.getState().past).toHaveLength(2)

    useMapStore.getState().undo()
    expect(areaTriggerOfRegion(useMapStore.getState().map, 'sala-b')?.revealed).toBe(false)
    useMapStore.getState().undo()
    expect('gatilhos' in useMapStore.getState().map).toBe(false)
  })

  it('marcar com o mesmo tipo, ou revelar sem gatilho, não gasta histórico', () => {
    useMapStore.getState().setRegionTrigger('sala-a', 'alarme')
    const antes = useMapStore.getState().map
    useMapStore.getState().setRegionTrigger('sala-a', 'alarme')
    useMapStore.getState().setRegionTriggerRevealed('sala-c', true)
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(1)
  })
})
