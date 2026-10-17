import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../../lib/mapFactory'
import type { MapData, RegionPoint } from '../../types/map'
import { ondeDoPino } from './CabecaDaSelecao'

const quadrado = (x: number, y: number, lado: number): RegionPoint[] => [{ x, y }, { x: x + lado, y }, { x: x + lado, y: y + lado }, { x, y: y + lado }]

/** Uma Sala (com o nome dado), uma região comum e três pinos: dentro da Sala, na região comum e no chão. */
function mapa(nomeDaSala: string): MapData {
  return {
    ...createEmptyMap('map_onde', 'Cena', 30, 20, 50),
    regions: [
      { id: 'cais', points: quadrado(500, 500, 300), tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: nomeDaSala } },
      { id: 'lisa', points: quadrado(0, 0, 200), tag: '', fillColor: '#a8776a', fillPattern: 'solid', data: {} },
    ],
    pins: [
      { id: 'dentro', x: 650, y: 650, kind: 'exclamacao', description: '', image: null },
      { id: 'na-regiao-comum', x: 100, y: 100, kind: 'interrogacao', description: '', image: null },
      { id: 'no-chao', x: 1200, y: 900, kind: 'viagem', description: '', image: null },
    ],
  }
}

describe('ondeDoPino (o local na cabeça da ficha do pino)', () => {
  it('dá o nome da Sala onde o pino está, aparado', () => {
    expect(ondeDoPino(mapa('  Cais do Porto '), 'dentro')).toBe('Cais do Porto')
  })

  it('fica vazio no chão, em região comum, em Sala sem nome e para pino que não existe', () => {
    expect(ondeDoPino(mapa('Cais do Porto'), 'no-chao')).toBe('')
    expect(ondeDoPino(mapa('Cais do Porto'), 'na-regiao-comum')).toBe('')
    expect(ondeDoPino(mapa('   '), 'dentro')).toBe('')
    expect(ondeDoPino(mapa('Cais do Porto'), 'sumiu')).toBe('')
  })
})
