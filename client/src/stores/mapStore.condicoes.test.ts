import { beforeEach, describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * CONDIÇÃO NA FICHA, lado do HISTÓRICO. Marcar "Envenenado" é decisão do
 * mestre sobre o mapa como qualquer outra: Ctrl+Z desfaz e Ctrl+Y refaz. E
 * clique numa ficha que não existe mais não gasta entrada do desfazer — senão o
 * próximo Ctrl+Z do mestre "não faz nada" aos olhos dele.
 */
const LANTERNA: Token = { id: 'lanterna', characterId: null, name: 'Lanterna', x: 425, y: 325, size: 1, image: null, color: '#3cff00' }
const OGRO: Token = { id: 'ogro', characterId: null, name: 'Ogro', x: 625, y: 325, size: 1, image: null, color: '#ff5a00' }

const fichaDoMapa = (id: string): Token | undefined => useMapStore.getState().map.tokens.find((t) => t.id === id)

describe('mapStore toggleTokenCondition', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, tokens: [LANTERNA, OGRO], regions: [], walls: [], lights: [] },
      past: [],
      future: [],
    })
  })

  it('marca na ficha certa; o desfazer devolve a ficha EXATAMENTE como era; o refazer marca de novo', () => {
    useMapStore.getState().toggleTokenCondition('lanterna', 'envenenado')
    expect(fichaDoMapa('lanterna')?.conditions).toEqual(['envenenado'])
    expect(fichaDoMapa('ogro')).toEqual(OGRO)

    useMapStore.getState().undo()
    expect(fichaDoMapa('lanterna')).toEqual(LANTERNA)

    useMapStore.getState().redo()
    expect(fichaDoMapa('lanterna')?.conditions).toEqual(['envenenado'])
  })

  it('clicar de novo desmarca, e cada clique é um passo do desfazer', () => {
    useMapStore.getState().toggleTokenCondition('ogro', 'caido')
    useMapStore.getState().toggleTokenCondition('ogro', 'caido')
    expect(fichaDoMapa('ogro')).toEqual(OGRO)
    expect(useMapStore.getState().past).toHaveLength(2)
    useMapStore.getState().undo()
    expect(fichaDoMapa('ogro')?.conditions).toEqual(['caido'])
  })

  it('ficha que não existe não mexe no mapa nem gasta entrada de histórico', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().toggleTokenCondition('nao-existe', 'dormindo')
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})
