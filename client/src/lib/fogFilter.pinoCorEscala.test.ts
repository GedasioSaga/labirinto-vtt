import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * COR E TAMANHO DO PINO no recorte do jogador (fatia 14). O jogador desenha e
 * toca o pino com o mesmo renderer e o mesmo `findPinAt` do mestre, então os
 * dois VÃO — são forma, não dizem nada da cena. Mas só valor válido, e pino
 * sem eles continua chegando sem as chaves (o recorte é uma lista do que vai).
 */

const RAIO = 300
const POSSE = { p1: ['heroi'] }

function mapaCom(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
    pins,
  }
}

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: `desc-${id}`, image: null, ...extra }
}

describe('fogFilter: cor e escala do pino', () => {
  it('a cor e o tamanho chegam ao jogador, em qualquer tipo', () => {
    const pins = [
      pino('marcador', 240, 200, { cor: '#5b6670', escala: 3 }),
      pino('alavanca', 250, 200, { kind: 'alavanca', cor: '#E2645A' }),
      pino('porta', 260, 200, { kind: 'viagem', escala: 0.5 }),
    ]
    const { map } = filterMapForPlayer(mapaCom(pins), 'p1', POSSE, RAIO)
    expect(map.pins.map((p) => [p.id, p.cor, p.escala])).toEqual([
      ['marcador', '#5b6670', 3],
      ['alavanca', '#e2645a', undefined],
      ['porta', undefined, 0.5],
    ])
  })

  it('pino de sempre chega sem as chaves', () => {
    const { map } = filterMapForPlayer(mapaCom([pino('comum', 240, 200)]), 'p1', POSSE, RAIO)
    expect(map.pins).toHaveLength(1)
    expect('cor' in map.pins[0]).toBe(false)
    expect('escala' in map.pins[0]).toBe(false)
  })

  it('valor torto (arquivo editado à mão) não atravessa', () => {
    const tortos: Partial<Pin>[] = [{ cor: 'red', escala: 0 }, { cor: '#fff', escala: 4 }, { cor: '', escala: Number.NaN }, { escala: 1 }]
    const pins = tortos.map((extra, i) => pino(`t${i}`, 240 + i, 200, extra))
    const { map } = filterMapForPlayer(mapaCom(pins), 'p1', POSSE, RAIO)
    expect(map.pins).toHaveLength(tortos.length)
    for (const p of map.pins) {
      expect('cor' in p, p.id).toBe(false)
      expect('escala' in p, p.id).toBe(false)
    }
  })
})
