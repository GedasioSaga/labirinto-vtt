import { describe, expect, it, beforeEach } from 'vitest'
import type { Region } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * TETO DE CONSTRUÇÃO, lado do HISTÓRICO. O interruptor "Teto fechado para
 * jogadores" é uma decisão do mestre como qualquer outra: Ctrl+Z tem de
 * desfazer. E clicar no que já está no lugar não pode gastar uma entrada do
 * histórico, senão o primeiro Ctrl+Z do mestre "não faz nada" aos olhos dele.
 */
const SALA: Region = {
  id: 'sala-do-teto',
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
  tag: '',
  fillColor: '#123',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Casa' },
}

const roofDaSala = (): boolean | undefined => useMapStore.getState().map.regions[0]?.room?.roof

describe('mapStore setRoomRoof', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, regions: [SALA], tokens: [], walls: [], lights: [] },
      selection: [],
      past: [],
      future: [],
    })
  })

  it('liga o teto, e o undo devolve a Sala sem teto', () => {
    expect(roofDaSala()).toBeUndefined()

    useMapStore.getState().setRoomRoof('sala-do-teto', true)
    expect(roofDaSala()).toBe(true)

    // Volta a `undefined`, não a `false`: o undo devolve a Sala EXATAMENTE
    // como ela estava, sem inventar campo que o mapa não tinha.
    useMapStore.getState().undo()
    expect(roofDaSala()).toBeUndefined()
  })

  it('valor igual, região comum e id inexistente não gastam entrada de histórico', () => {
    const antes = useMapStore.getState().past.length
    useMapStore.getState().setRoomRoof('sala-do-teto', false)
    useMapStore.getState().setRoomRoof('nao-existe', true)
    expect(useMapStore.getState().past.length).toBe(antes)

    useMapStore.setState({ map: { ...useMapStore.getState().map, regions: [{ ...SALA, room: undefined }] } })
    useMapStore.getState().setRoomRoof('sala-do-teto', true)
    expect(useMapStore.getState().map.regions[0].room).toBeUndefined()
  })
})
