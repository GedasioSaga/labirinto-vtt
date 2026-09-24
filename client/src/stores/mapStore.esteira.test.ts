import { beforeEach, describe, expect, it } from 'vitest'
import { ficha, torre } from '../lib/__fixtures__/hazardTower'
import { conveyorOfRoom } from '../lib/conveyors'
import { useMapStore } from './mapStore'

/**
 * MOVIMENTO IMPOSTO, lado do HISTÓRICO. Marcar a esteira e apertar "Avançar
 * esteiras" são decisões do mestre sobre o mapa: Ctrl+Z desfaz o avanço
 * inteiro de uma vez. E o Avançar que não move ninguém não gasta desfazer.
 */
describe('mapStore — esteira', () => {
  beforeEach(() => {
    useMapStore.setState({ map: torre({ tokens: [ficha('ana', 125, 75)] }), past: [], future: [] })
  })

  it('marcar e avançar são dois passos do desfazer', () => {
    useMapStore.getState().setRoomConveyor('sala-a', { direction: 'leste', stepCells: 3 })
    expect(conveyorOfRoom(useMapStore.getState().map, 'sala-a')?.direction).toBe('leste')
    useMapStore.getState().advanceConveyors()
    expect(useMapStore.getState().map.tokens[0]).toMatchObject({ id: 'ana', x: 275, y: 75 })
    expect(useMapStore.getState().past).toHaveLength(2)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.tokens[0]).toMatchObject({ id: 'ana', x: 125, y: 75 })
    useMapStore.getState().undo()
    expect('conveyors' in useMapStore.getState().map).toBe(false)
  })

  it('cabine contínua: ligar o pino e avançar são dois passos do desfazer; ligar igual não gasta', () => {
    const pinos = [
      { id: 'p1', x: 125, y: 75, kind: 'exclamacao' as const, description: '', image: null },
      { id: 'p2', x: 375, y: 325, kind: 'exclamacao' as const, description: '', image: null },
    ]
    useMapStore.setState({ map: { ...torre({ tokens: [ficha('ana', 125, 75)] }), pins: pinos }, past: [], future: [] })
    useMapStore.getState().setPinCabin('p1', 'p2')
    useMapStore.getState().setPinCabin('p1', 'p2')
    expect(useMapStore.getState().map.pins[0]?.cabine).toBe('p2')
    useMapStore.getState().advanceConveyors()
    expect(useMapStore.getState().map.tokens[0]).toMatchObject({ id: 'ana', x: 375, y: 325 })
    expect(useMapStore.getState().past).toHaveLength(2)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.tokens[0]).toMatchObject({ id: 'ana', x: 125, y: 75 })
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.pins[0]?.cabine).toBeUndefined()
  })

  it('avançar sem ninguém para mover, ou marcar igual, não gasta histórico', () => {
    useMapStore.getState().setRoomConveyor('sala-b', { direction: 'sul', stepCells: 2 })
    const antes = useMapStore.getState().map
    useMapStore.getState().advanceConveyors()
    useMapStore.getState().setRoomConveyor('sala-b', { direction: 'sul', stepCells: 2 })
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(1)
  })
})
