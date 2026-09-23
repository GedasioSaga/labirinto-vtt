import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import { TOOL_CLUSTERS } from '../components/labels'

/** Botão Desenho (plano de 15/09/2026, D5/D9): a última forma usada é preferência de sessão. */
describe('lastDrawingTool', () => {
  beforeEach(() => {
    useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_last_drawing', 'Teste', 10, 10, 64))
    useMapStore.setState({ activeTool: 'select', lastDrawingTool: 'brush' })
  })

  it('nasce Pincel', () => {
    expect(useMapStore.getState().lastDrawingTool).toBe('brush')
  })

  it('Elipse e depois Selecionar mantém lastDrawingTool = ellipse', () => {
    useMapStore.getState().setActiveTool('ellipse')
    expect(useMapStore.getState().lastDrawingTool).toBe('ellipse')
    useMapStore.getState().setActiveTool('select')
    expect(useMapStore.getState().activeTool).toBe('select')
    expect(useMapStore.getState().lastDrawingTool).toBe('ellipse')
  })

  it('ferramenta que não é forma (Parede, Texto, Medir) não altera', () => {
    useMapStore.getState().setActiveTool('rect')
    for (const tool of ['wall', 'text', 'measure', 'eraser', 'floor'] as const) {
      useMapStore.getState().setActiveTool(tool)
      expect(useMapStore.getState().lastDrawingTool, tool).toBe('rect')
    }
  })

  it('cada uma das 7 formas vira a última', () => {
    for (const shape of TOOL_CLUSTERS.drawing.tools) {
      useMapStore.getState().setActiveTool('select')
      useMapStore.getState().setActiveTool(shape)
      expect(useMapStore.getState().lastDrawingTool).toBe(shape)
    }
  })

  it('reescolher a forma que já está ativa também grava (ramo da mesma ferramenta)', () => {
    useMapStore.setState({ activeTool: 'line', lastDrawingTool: 'brush' })
    useMapStore.getState().setActiveTool('line')
    expect(useMapStore.getState().lastDrawingTool).toBe('line')
  })

  it('não entra no mapa', () => {
    useMapStore.getState().setActiveTool('polygon')
    expect(Object.keys(useMapStore.getState().map)).not.toContain('lastDrawingTool')
  })
})
