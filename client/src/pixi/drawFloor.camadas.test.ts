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

  it('Chão antes de qualquer peça colorida não gera camada (a base já pinta)', () => {
    const camadas = buildColorLayers([peca('chao'), peca('mar', '#2f6690')], undefined)
    expect(camadas.map((c) => c.color)).toEqual(['#2f6690'])
  })
})
