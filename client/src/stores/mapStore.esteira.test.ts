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

  it('o Avançar usa o raio do dono que a sala manda: o guarda além dele não segura a cabine', () => {
    const pinos = [
      { id: 'p1', x: 125, y: 200, kind: 'exclamacao' as const, description: '', image: null, cabine: 'p2' },
      { id: 'p2', x: 975, y: 200, kind: 'exclamacao' as const, description: '', image: null },
    ]
    const mapa = { ...torre({ tokens: [ficha('ana', 125, 200), ficha('guarda', 975, 200)] }), pins: pinos, movement: { tokensOccupy: true } }
    useMapStore.setState({ map: mapa, past: [], future: [] })
    // Raio que alcança o guarda (850 px): ele segura, e nada vai para o desfazer.
    useMapStore.getState().advanceConveyors(new Map([['ana', 900]]))
    expect(useMapStore.getState().map).toBe(mapa)
    expect(useMapStore.getState().past).toHaveLength(0)
    // O raio da sala (700 px): Ana não o vê, e a cabine a leva.
    useMapStore.getState().advanceConveyors(new Map([['ana', 700]]))
    expect(useMapStore.getState().map.tokens[0]).toMatchObject({ id: 'ana', x: 975, y: 200 })
    expect(useMapStore.getState().past).toHaveLength(1)
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
