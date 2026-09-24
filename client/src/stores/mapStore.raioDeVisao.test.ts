import { beforeEach, describe, expect, it } from 'vitest'
import type { Region } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * "Raio de visão aqui", lado do HISTÓRICO. O número da Sala é decisão do mestre
 * como qualquer outra: Ctrl+Z desfaz, e confirmar o que já está no lugar não
 * gasta entrada do histórico. `mapFactory.raioDeVisao.test` prova a função
 * pura; aqui a prova é a ação da store que o painel chama.
 */
const SALA: Region = {
  id: 'caracol',
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
  tag: '',
  fillColor: '#123',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Escada caracol' },
}

const raioDaSala = (): number | undefined => useMapStore.getState().map.regions[0]?.room?.raioDeVisao

describe('mapStore setRoomVisionRadius', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, regions: [SALA], tokens: [], walls: [], lights: [] },
      selection: [],
      past: [],
      future: [],
    })
  })

  it('grava o raio da Sala com um desfazer, e o undo devolve a Sala sem o campo', () => {
    expect(raioDaSala()).toBeUndefined()

    useMapStore.getState().setRoomVisionRadius('caracol', 150)
    expect(raioDaSala()).toBe(150)
    expect(useMapStore.getState().past.length).toBe(1)

    useMapStore.getState().undo()
    expect(raioDaSala()).toBeUndefined()
    expect(Object.keys(useMapStore.getState().map.regions[0]?.room ?? {})).not.toContain('raioDeVisao')
  })

  it('null tira o campo (volta ao raio do jogador), com um desfazer próprio', () => {
    useMapStore.getState().setRoomVisionRadius('caracol', 150)
    useMapStore.getState().setRoomVisionRadius('caracol', null)
    expect(raioDaSala()).toBeUndefined()
    expect(useMapStore.getState().past.length).toBe(2)

    useMapStore.getState().undo()
    expect(raioDaSala()).toBe(150)
  })

  it('valor igual, região comum e id inexistente não gastam entrada de histórico', () => {
    useMapStore.getState().setRoomVisionRadius('caracol', 150)
    const antes = useMapStore.getState().past.length
    useMapStore.getState().setRoomVisionRadius('caracol', 150)
    useMapStore.getState().setRoomVisionRadius('nao-existe', 900)
    expect(useMapStore.getState().past.length).toBe(antes)

    useMapStore.setState({ map: { ...useMapStore.getState().map, regions: [{ ...SALA, room: undefined }] } })
    useMapStore.getState().setRoomVisionRadius('caracol', 900)
    expect(useMapStore.getState().map.regions[0]?.room).toBeUndefined()
    expect(useMapStore.getState().past.length).toBe(antes)
  })
})
