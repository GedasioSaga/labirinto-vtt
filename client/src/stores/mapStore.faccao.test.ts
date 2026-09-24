import { beforeEach, describe, expect, it } from 'vitest'
import { andar6, GUARDA } from '../lib/__fixtures__/andar6'
import { alertaDaCena, faccaoDaSala } from '../lib/faccoes'
import { useMapStore } from './mapStore'

/**
 * FACÇÃO E ALERTA, lado do HISTÓRICO: dar dono a uma sala e subir o alerta da
 * cena são decisões do mestre sobre o mapa — Ctrl+Z desfaz; repetir o mesmo
 * valor não gasta entrada do desfazer.
 */
describe('mapStore — facção e alerta', () => {
  beforeEach(() => {
    const { alerta: _alerta, ...calmo } = andar6()
    useMapStore.setState({ map: calmo, past: [], future: [] })
  })

  it('subir o alerta e dar dono ao Mercado são dois passos do desfazer', () => {
    useMapStore.getState().setSceneAlerta('atento')
    useMapStore.getState().setRoomFaccao('d-mercado', GUARDA)
    expect(alertaDaCena(useMapStore.getState().map)).toBe('atento')
    expect(faccaoDaSala(useMapStore.getState().map.regions, 'd-mercado')?.faccao).toBe(GUARDA)
    expect(useMapStore.getState().past).toHaveLength(2)

    useMapStore.getState().undo()
    expect(faccaoDaSala(useMapStore.getState().map.regions, 'd-mercado')).toBeNull()
    useMapStore.getState().undo()
    expect(alertaDaCena(useMapStore.getState().map)).toBe('calmo')
  })

  it('o mesmo alerta ou a mesma facção não gastam histórico', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().setSceneAlerta('calmo')
    useMapStore.getState().setRoomFaccao('d-norte', GUARDA)
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})
