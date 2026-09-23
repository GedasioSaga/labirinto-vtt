import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import type { Drawing } from '../types/map'

const rect: Drawing = { id: 'r1', kind: 'rect', x: 0, y: 0, w: 100, h: 50, color: '#ff0000', width: 2, filled: true, fillAlpha: 0.5 }
const line: Drawing = { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 100, y2: 0, color: '#00ff00', width: 3 }
const text: Drawing = { id: 't1', kind: 'text', x: 0, y: 0, text: 'Oi', color: '#ffffff', fontSize: 14 }

function drawingById(id: string): Drawing | undefined {
  return useMapStore.getState().map.drawings.find((d) => d.id === id)
}

/** Auditoria 14/09: retângulo, linha e pincel já desenhados não tinham Cor nem Espessura editáveis. */
describe('editar estilo de desenho existente', () => {
  beforeEach(() => {
    const map = { ...mapFactory.createEmptyMap('map_draw_style', 'Teste', 10, 10, 64), drawings: [rect, line, text] }
    useMapStore.getState().loadMap(map)
  })

  it('setDrawingColor troca a cor do desenho e entra no histórico', () => {
    useMapStore.getState().setDrawingColor('r1', '#123456')
    expect(drawingById('r1')).toMatchObject({ color: '#123456' })
    expect(drawingById('l1')).toMatchObject({ color: '#00ff00' })
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(drawingById('r1')).toMatchObject({ color: '#ff0000' })
  })

  it('setDrawingWidth troca a espessura de linha/forma e entra no histórico; texto não tem espessura', () => {
    useMapStore.getState().setDrawingWidth('l1', 9)
    useMapStore.getState().setDrawingWidth('t1', 9)
    expect(drawingById('l1')).toMatchObject({ width: 9 })
    expect(drawingById('t1')).not.toHaveProperty('width')
  })

  it('variantes Live (arrasto de slider / seletor de cor) mudam o mapa sem empilhar histórico', () => {
    useMapStore.getState().setDrawingWidthLive('r1', 12)
    useMapStore.getState().setDrawingColorLive('r1', '#abcdef')
    expect(drawingById('r1')).toMatchObject({ width: 12, color: '#abcdef' })
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('largura inválida (não finita ou < 1) é ignorada', () => {
    useMapStore.getState().setDrawingWidth('l1', Number.NaN)
    useMapStore.getState().setDrawingWidthLive('l1', 0)
    expect(drawingById('l1')).toMatchObject({ width: 3 })
  })
})
