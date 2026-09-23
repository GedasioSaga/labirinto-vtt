import { beforeEach, describe, expect, it } from 'vitest'
import { GROUP_CREATED_TEXT, GROUP_NEEDS_TWO_TEXT, GROUP_UNDONE_TEXT, useMapStore } from './mapStore'
import { useToastStore } from './toastStore'
import { createEmptyMap } from '../lib/mapFactory'
import type { SelectionItem } from '../lib/selectionModel'

const SALA: SelectionItem = { kind: 'region', id: 'sala-casa' }
const MESA: SelectionItem = { kind: 'drawing', id: 'des-mesa' }
const PORTA: SelectionItem = { kind: 'wall', id: 'parede-porta' }

const VILA = createEmptyMap('map_vila', 'Vila', 20, 16, 50)
const OUTRA = createEmptyMap('map_outra', 'Outra', 20, 16, 50)

describe('mapStore — agrupar objetos (Ctrl+G)', () => {
  beforeEach(() => {
    useMapStore.getState().loadMap(VILA)
    useMapStore.setState({ itemGroups: {} })
  })

  it('groupSelected junta os 3 itens selecionados num grupo do mapa aberto', () => {
    useMapStore.getState().setSelection([SALA, PORTA, MESA])

    expect(useMapStore.getState().groupSelected()).toBe(true)

    const grupos = useMapStore.getState().itemGroups[VILA.id]
    expect(grupos).toHaveLength(1)
    expect(grupos[0].members).toEqual([SALA, PORTA, MESA])
  })

  it('agrupar não mexe no MapData nem no histórico (nada vai para o arquivo nem para o jogador)', () => {
    const mapaAntes = useMapStore.getState().map
    const passadoAntes = useMapStore.getState().past
    useMapStore.getState().setSelection([SALA, MESA])

    useMapStore.getState().groupSelected()

    expect(useMapStore.getState().map).toBe(mapaAntes)
    expect(useMapStore.getState().past).toBe(passadoAntes)
  })

  it('com um item só selecionado não há o que agrupar', () => {
    useMapStore.getState().setSelection([MESA])

    expect(useMapStore.getState().groupSelected()).toBe(false)
    expect(useMapStore.getState().itemGroups[VILA.id] ?? []).toEqual([])
  })

  it('ungroupSelected desfaz o grupo de quem está selecionado', () => {
    useMapStore.getState().setSelection([SALA, PORTA, MESA])
    useMapStore.getState().groupSelected()
    useMapStore.getState().setSelection([MESA])

    expect(useMapStore.getState().ungroupSelected()).toBe(true)
    expect(useMapStore.getState().itemGroups[VILA.id]).toEqual([])
  })

  it('ungroupSelected sem grupo na seleção devolve false', () => {
    useMapStore.getState().setSelection([MESA])
    expect(useMapStore.getState().ungroupSelected()).toBe(false)
  })

  it('avisa o que aconteceu, sem repetir a contagem "N itens" do painel', () => {
    useToastStore.setState({ toasts: [] })
    useMapStore.getState().setSelection([SALA, PORTA, MESA])
    useMapStore.getState().groupSelected()
    useMapStore.getState().ungroupSelected()
    useMapStore.getState().setSelection([MESA])
    useMapStore.getState().groupSelected()

    const textos = useToastStore.getState().toasts.map((t) => t.text)
    expect(textos).toEqual([GROUP_CREATED_TEXT, GROUP_UNDONE_TEXT, GROUP_NEEDS_TWO_TEXT])
    for (const texto of textos) expect(texto).not.toMatch(/\d itens\b/)
  })

  it('o grupo é do mapa: abrir outro mapa não o traz, voltar ao primeiro o encontra', () => {
    useMapStore.getState().setSelection([SALA, PORTA, MESA])
    useMapStore.getState().groupSelected()

    useMapStore.getState().loadMap(OUTRA)
    expect(useMapStore.getState().itemGroups[OUTRA.id] ?? []).toEqual([])

    useMapStore.getState().loadMap(VILA)
    expect(useMapStore.getState().itemGroups[VILA.id]).toHaveLength(1)
  })
})
