import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { findSelectableAt } from '../lib/selectionHitTest'
import { selecaoDoLacoNoPiso } from '../lib/pisoEmEdicao'
import { carimboNoPonto, caixaDoCarimbo } from '../lib/carimbos'
import type { Carimbo, MapData, Prop } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * CARIMBO EDITÁVEL (Fase 2, 15/11/2026): o Selecionar acha o carimbo, ele
 * entra na seleção comum e anda junto com um objeto num gesto só, com um
 * passo no Ctrl+Z.
 */

const pinheiro = (id: string, x: number, y: number, extra: Partial<Carimbo> = {}): Carimbo => ({ id, tipo: 'pinheiro', x, y, tamanho: 40, giro: 0, ...extra })
const barril: Prop = { id: 'barril', src: '', linkedMapPath: null, x: 400, y: 400, width: 40, height: 40, rotation: 0, mobilia: 'barril' }

function mapa(carimbos: Carimbo[], extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m-carimbo', 'Mata', 30, 30, 40), carimbos, props: [barril], ...extra }
}

beforeEach(() => {
  useMapStore.getState().loadMap(mapa([pinheiro('c1', 200, 200), pinheiro('c2', 600, 600)]))
})

describe('achar o carimbo no ponto', () => {
  it('o clique no corpo acha o carimbo; fora da caixa, nada', () => {
    const map = useMapStore.getState().map
    // O corpo vai do pé (200) até um tamanho acima (160): a copa responde.
    expect(findSelectableAt(map, { x: 200, y: 175 })).toEqual({ kind: 'carimbo', id: 'c1', draggable: true })
    expect(findSelectableAt(map, { x: 300, y: 300 })).toBeNull()
  })

  it('o de cima na tela ganha: a base mais embaixo está na frente', () => {
    const lista = [pinheiro('atras', 100, 100), pinheiro('frente', 100, 120)]
    expect(carimboNoPonto(lista, { x: 100, y: 95 })?.id).toBe('frente')
  })

  it('o objeto por cima ganha o clique do carimbo de baixo', () => {
    const map = mapa([pinheiro('c1', 400, 420)])
    expect(findSelectableAt(map, { x: 400, y: 400 })?.kind).toBe('prop')
  })

  it('com o olho de Terreno fechado o carimbo não responde', () => {
    const map = mapa([pinheiro('c1', 200, 200)], { hiddenLayers: ['terreno'] })
    expect(findSelectableAt(map, { x: 200, y: 175 })).toBeNull()
  })

  it('o laço pega o carimbo pela caixa do corpo', () => {
    const map = useMapStore.getState().map
    const caixa = caixaDoCarimbo(pinheiro('c1', 200, 200))
    const laco = selecaoDoLacoNoPiso(map, 0, { x1: caixa.minX - 5, y1: caixa.minY - 5, x2: caixa.maxX + 5, y2: caixa.maxY + 5 })
    expect(laco).toEqual([{ kind: 'carimbo', id: 'c1' }])
  })
})

describe('mexer na seleção com carimbo', () => {
  it('pinheiro e barril andam juntos num gesto, e um Ctrl+Z desfaz os dois', () => {
    const store = useMapStore.getState()
    const antes = store.map
    store.setSelection([{ kind: 'carimbo', id: 'c1' }, { kind: 'prop', id: 'barril' }])
    // O arrasto: vários pointermove sem histórico, um passo ao soltar.
    for (let i = 0; i < 10; i++) useMapStore.getState().moveSelectionLive(3, 2)
    useMapStore.getState().commitDragHistory(antes)
    const depois = useMapStore.getState().map
    expect(depois.carimbos?.find((c) => c.id === 'c1')).toMatchObject({ x: 230, y: 220 })
    expect(depois.props.find((p) => p.id === 'barril')).toMatchObject({ x: 430, y: 420 })
    expect(depois.carimbos?.find((c) => c.id === 'c2')).toMatchObject({ x: 600, y: 600 })
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('o carimbo travado fica parado no arrasto do grupo', () => {
    useMapStore.getState().loadMap(mapa([pinheiro('c1', 200, 200, { locked: true })]))
    const store = useMapStore.getState()
    store.setSelection([{ kind: 'carimbo', id: 'c1' }, { kind: 'prop', id: 'barril' }])
    store.moveSelectionBy(10, 0)
    const depois = useMapStore.getState().map
    expect(depois.carimbos?.[0]).toMatchObject({ x: 200, y: 200 })
    expect(depois.props[0]).toMatchObject({ x: 410 })
  })

  it('Delete apaga o carimbo selecionado num passo', () => {
    const store = useMapStore.getState()
    store.setSelection([{ kind: 'carimbo', id: 'c1' }])
    store.removeSelected()
    expect(useMapStore.getState().map.carimbos?.map((c) => c.id)).toEqual(['c2'])
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.carimbos?.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('Ctrl+D duplica o carimbo uma casa ao lado e seleciona a cópia', () => {
    const store = useMapStore.getState()
    store.setSelection([{ kind: 'carimbo', id: 'c1' }])
    store.duplicateSelected()
    const { map, selection } = useMapStore.getState()
    expect(map.carimbos).toHaveLength(3)
    const copia = map.carimbos?.[2]
    expect(copia).toMatchObject({ tipo: 'pinheiro', x: 240, y: 240 })
    expect(selection).toEqual([{ kind: 'carimbo', id: copia?.id }])
  })

  it('a ficha troca tipo, tamanho e giro num passo; o arrasto do tamanho junta num passo só', () => {
    const store = useMapStore.getState()
    const antes = store.map
    store.mudarCarimbo('c1', { tipo: 'arvore', giro: 45 })
    expect(useMapStore.getState().map.carimbos?.[0]).toMatchObject({ tipo: 'arvore', giro: 45, tamanho: 40 })
    const depoisDoTipo = useMapStore.getState().map
    for (const tamanho of [44, 48, 52]) useMapStore.getState().mudarCarimbo('c1', { tamanho }, 'tamanho')
    expect(useMapStore.getState().map.carimbos?.[0]?.tamanho).toBe(52)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(depoisDoTipo)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('o carimbo travado só destrava; o que já vale não vira passo', () => {
    const store = useMapStore.getState()
    store.mudarCarimbo('c1', { locked: true })
    const travado = useMapStore.getState().map
    expect(travado.carimbos?.[0]?.locked).toBe(true)
    useMapStore.getState().mudarCarimbo('c1', { giro: 90 })
    useMapStore.getState().mudarCarimbo('c1', { locked: true })
    expect(useMapStore.getState().map).toBe(travado)
    useMapStore.getState().mudarCarimbo('c1', { locked: false })
    expect(useMapStore.getState().map.carimbos?.[0]).not.toHaveProperty('locked')
  })

  it('as chaves de jogo valem no carimbo travado e desligar tira o campo', () => {
    const store = useMapStore.getState()
    store.mudarCarimbo('c1', { locked: true })
    useMapStore.getState().mudarCarimbo('c1', { barra: true, tapaVisao: true })
    expect(useMapStore.getState().map.carimbos?.[0]).toMatchObject({ locked: true, barra: true, tapaVisao: true })
    useMapStore.getState().mudarCarimbo('c1', { barra: false })
    const c1 = useMapStore.getState().map.carimbos?.[0]
    expect(c1).not.toHaveProperty('barra')
    expect(c1?.tapaVisao).toBe(true)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.carimbos?.[0]?.barra).toBe(true)
  })

  it('Ctrl+C e Ctrl+V colam o carimbo com o centro no ponto', () => {
    const store = useMapStore.getState()
    store.setSelection([{ kind: 'carimbo', id: 'c2' }])
    expect(store.copySelected()).toBe(true)
    expect(useMapStore.getState().pasteClipboardAt({ x: 800, y: 800 })).toBe(true)
    const { map, selection } = useMapStore.getState()
    expect(map.carimbos).toHaveLength(3)
    expect(selection).toHaveLength(1)
    expect(selection[0]?.kind).toBe('carimbo')
  })
})
