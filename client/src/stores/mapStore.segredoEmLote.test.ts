import { beforeEach, describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * "Oculto para jogadores" EM LOTE, lado do histórico: revelar 4 guardas era um
 * clique (e um Ctrl+Z) por ficha. Agora os 4 selecionados mudam juntos, e UM
 * Ctrl+Z devolve os 4 como eram.
 */
const guarda = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 75, size: 1, image: null, color: '#aa2222' })
const GUARDAS = [guarda('g1', 75), guarda('g2', 125), guarda('g3', 175), guarda('g4', 225)]

const secretos = (): boolean[] => useMapStore.getState().map.tokens.map((t) => t.secret === true)

describe('mapStore setSelectionSecret', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, tokens: GUARDAS, regions: [], walls: [], lights: [], props: [], stairs: [], drawings: [] },
      selection: GUARDAS.map((t) => ({ kind: 'token' as const, id: t.id })),
      past: [],
      future: [],
    })
  })

  it('4 guardas selecionados > Oculto: os 4 somem num passo só, e Ctrl+Z desfaz os 4', () => {
    useMapStore.getState().setSelectionSecret(true)
    expect(secretos()).toEqual([true, true, true, true])
    expect(useMapStore.getState().past).toHaveLength(1)

    useMapStore.getState().undo()
    expect(secretos()).toEqual([false, false, false, false])
    expect(useMapStore.getState().map.tokens).toEqual(GUARDAS)
  })

  it('nada a mudar não gasta entrada do desfazer', () => {
    useMapStore.getState().setSelectionSecret(false)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(useMapStore.getState().map.tokens).toBe(GUARDAS)
  })
})
