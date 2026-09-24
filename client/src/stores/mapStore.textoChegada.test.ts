import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from './mapStore'

/**
 * TEXTO DE CHEGADA, lado do HISTÓRICO: escrever o texto da cena é uma decisão
 * do mestre sobre o mapa, e Ctrl+Z desfaz. Gravar o mesmo texto não gasta
 * entrada do desfazer.
 */
describe('mapStore — texto de chegada', () => {
  beforeEach(() => {
    useMapStore.setState({ map: createEmptyMap('m', 'Cripta', 10, 10, 50), past: [], future: [] })
  })

  it('gravar e apagar são passos do desfazer', () => {
    useMapStore.getState().setArrivalText('  Frio.  ')
    expect(useMapStore.getState().map.textoChegada).toBe('Frio.')
    useMapStore.getState().setArrivalText('')
    expect('textoChegada' in useMapStore.getState().map).toBe(false)
    expect(useMapStore.getState().past).toHaveLength(2)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.textoChegada).toBe('Frio.')
    useMapStore.getState().undo()
    expect('textoChegada' in useMapStore.getState().map).toBe(false)
  })

  it('o mesmo texto não gasta histórico', () => {
    useMapStore.getState().setArrivalText('Frio.')
    const antes = useMapStore.getState().map
    useMapStore.getState().setArrivalText(' Frio. ')
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(1)
  })
})
