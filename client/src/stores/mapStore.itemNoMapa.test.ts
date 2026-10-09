/**
 * ITEM NO MAPA (entrega 5) no editor: trocar a forma do item (imagem no chão ⇄
 * pino de item) é UM passo do Ctrl+Z, e a seleção segue o item na forma nova.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { objetoDeItem } from '../lib/itemNoMapa'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from './mapStore'

const POCAO = { nome: 'Poção', imagem: `midia:${'5'.repeat(64)}.webp`, livre: true as const }

beforeEach(() => {
  useMapStore.getState().loadMap({ ...createEmptyMap('m', 'Porto', 20, 20, 50), props: [objetoDeItem('i', { x: 300, y: 300 }, 50, POCAO)] })
})

describe('trocar a forma do item no editor', () => {
  it('a imagem no chão vira pino selecionado; o Ctrl+Z devolve a imagem; a volta seleciona o objeto', () => {
    const store = useMapStore.getState()
    store.trocarFormaDoItem('i')
    let estado = useMapStore.getState()
    expect(estado.map.props).toEqual([])
    expect(estado.map.pins.map((p) => [p.id, p.icon, p.item?.nome])).toEqual([['i', 'item', 'Poção']])
    expect(estado.selectedPinId).toBe('i')

    estado.trocarFormaDoItem('i')
    estado = useMapStore.getState()
    expect(estado.map.pins).toEqual([])
    expect(estado.map.props.map((p) => p.id)).toEqual(['i'])
    expect(estado.selectedPinId).toBeNull()
    expect(estado.selection).toEqual([{ kind: 'prop', id: 'i' }])

    estado.undo()
    expect(useMapStore.getState().map.pins.map((p) => p.id)).toEqual(['i'])
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.props.map((p) => p.id)).toEqual(['i'])
    expect(useMapStore.getState().map.pins).toEqual([])
  })

  it('id que não é item não muda nada nem entra no desfazer', () => {
    const antes = useMapStore.getState()
    antes.trocarFormaDoItem('nada')
    expect(useMapStore.getState().map).toBe(antes.map)
    expect(useMapStore.getState().past).toBe(antes.past)
  })
})
