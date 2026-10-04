import { describe, expect, it } from 'vitest'
import type { FloorPiece } from '../types/map'
import { buildColorLayers } from './drawFloor'

function peca(id: string, fillColor?: string): FloorPiece {
  return { id, shape: { kind: 'rect', cx: 0, cy: 0, w: 128, h: 128 }, op: 'add', fillColor, modifiers: [] } as FloorPiece
}

describe('buildColorLayers', () => {
  it('Chão desenhado depois do Mar vira camada na cor do mapa, por cima dele', () => {
    const camadas = buildColorLayers([peca('mar', '#2f6690'), peca('chao')], undefined)
    expect(camadas.map((c) => c.color)).toEqual(['#2f6690', null])
  })

  it('pintar na Camada 2 não recontorna a Camada 1: a peça intocada reaproveita o contorno', () => {
    const agua = peca('agua', '#2f6690')
    const antes = buildColorLayers([agua, peca('grama', '#4a6b35')], undefined)
    const depois = buildColorLayers([agua, { ...peca('grama', '#4a6b35'), shape: { kind: 'rect', cx: 50, cy: 0, w: 128, h: 128 } }], undefined)
    expect(depois[0].polygons).toBe(antes[0].polygons)
    expect(depois[1].polygons).not.toBe(antes[1].polygons)
    // Buraco novo depois da Camada 1 muda o contorno dela: recalcula.
    const furo: FloorPiece = { ...peca('furo'), op: 'subtract' }
    expect(buildColorLayers([agua, furo], undefined)[0].polygons).not.toBe(antes[0].polygons)
  })

  it('Chão antes de qualquer peça colorida não gera camada (a base já pinta)', () => {
    const camadas = buildColorLayers([peca('chao'), peca('mar', '#2f6690')], undefined)
    expect(camadas.map((c) => c.color)).toEqual(['#2f6690'])
  })
})
