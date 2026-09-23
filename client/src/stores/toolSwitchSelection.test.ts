import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import type { DrawingTool } from '../types/tools'

/**
 * Auditoria 14/09: com a Luz ativa o painel ainda mostrava a Escada selecionada
 * antes, e o Preenchimento aparecia com a Linha ativa por causa de um retângulo
 * que ficou selecionado. Escolher ferramenta de criação limpa a seleção;
 * Selecionar mantém.
 */
describe('setActiveTool e a seleção', () => {
  beforeEach(() => {
    useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_tool_sel', 'Teste', 10, 10, 64))
    useMapStore.setState({ activeTool: 'select' })
  })

  it('ferramenta de criação (Luz) limpa a escada que estava selecionada', () => {
    useMapStore.getState().setSelection([{ kind: 'stair', id: 's1' }])
    useMapStore.getState().setActiveTool('light')
    expect(useMapStore.getState().activeTool).toBe('light')
    expect(useMapStore.getState().selection).toEqual([])
  })

  it('toda ferramenta que não é Selecionar limpa a seleção', () => {
    const tools: DrawingTool[] = ['wall', 'door', 'region', 'room', 'stair', 'token', 'prop', 'brush', 'line', 'rect', 'text', 'floor', 'concealZone']
    for (const tool of tools) {
      useMapStore.setState({ activeTool: 'select' })
      useMapStore.getState().setSelection([{ kind: 'drawing', id: 'd1' }])
      useMapStore.getState().setActiveTool(tool)
      expect(useMapStore.getState().selection, `tool=${tool}`).toEqual([])
    }
  })

  it('Selecionar mantém a seleção', () => {
    useMapStore.setState({ activeTool: 'rect' })
    useMapStore.getState().setSelection([{ kind: 'drawing', id: 'd1' }])
    useMapStore.getState().setActiveTool('select')
    expect(useMapStore.getState().selection).toEqual([{ kind: 'drawing', id: 'd1' }])
  })

  it('reescolher a MESMA ferramenta (ex.: pela setinha de variantes) não apaga a sala recém-criada da seleção', () => {
    useMapStore.setState({ activeTool: 'room' })
    useMapStore.getState().setSelection([{ kind: 'region', id: 'sala' }])
    useMapStore.getState().setActiveTool('room')
    expect(useMapStore.getState().selection).toEqual([{ kind: 'region', id: 'sala' }])
  })

  it('sem seleção, trocar de ferramenta não gera estado novo de seleção (mesma referência)', () => {
    const before = useMapStore.getState().selection
    useMapStore.getState().setActiveTool('wall')
    expect(useMapStore.getState().selection).toBe(before)
  })
})
