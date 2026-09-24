import { beforeEach, describe, expect, it } from 'vitest'
import { torre } from '../lib/__fixtures__/hazardTower'
import { hazardOfRoom, hazardsOf } from '../lib/hazards'
import { useMapStore } from './mapStore'

/**
 * ZONA DE PERIGO, lado do HISTÓRICO. Pintar a sala e avançar o perigo são
 * decisões do mestre sobre o mapa: Ctrl+Z desfaz um passo por vez. E o clique
 * que não muda nada (avançar sem porta aberta) não gasta entrada do desfazer.
 */
describe('mapStore — zona de perigo', () => {
  beforeEach(() => {
    useMapStore.setState({ map: torre(), past: [], future: [] })
  })

  it('pintar e avançar são dois passos do desfazer', () => {
    useMapStore.getState().setRoomHazard('sala-a', 'fogo')
    const zona = hazardOfRoom(useMapStore.getState().map, 'sala-a')
    expect(zona?.kind).toBe('fogo')
    useMapStore.getState().advanceHazard(zona?.id ?? '')
    expect(hazardsOf(useMapStore.getState().map)[0]?.roomIds).toEqual(['sala-a', 'sala-b'])
    expect(useMapStore.getState().past).toHaveLength(2)

    useMapStore.getState().undo()
    expect(hazardsOf(useMapStore.getState().map)[0]?.roomIds).toEqual(['sala-a'])
    useMapStore.getState().undo()
    expect('hazards' in useMapStore.getState().map).toBe(false)
  })

  it('avançar sem porta aberta, ou pintar com o mesmo perigo, não gasta histórico', () => {
    useMapStore.getState().setRoomHazard('sala-c', 'agua')
    const zona = hazardOfRoom(useMapStore.getState().map, 'sala-c')
    const antes = useMapStore.getState().map
    useMapStore.getState().advanceHazard(zona?.id ?? '')
    useMapStore.getState().setRoomHazard('sala-c', 'agua')
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(1)
  })
})
