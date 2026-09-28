import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * PINO SEM HASTE no recorte do jogador. O jogador desenha e toca o pino com o
 * mesmo renderer e o mesmo teste de toque do mestre (`pixi/drawPins.ts`,
 * `findPinAt`), então a marca VAI — é só forma, não diz nada da cena. Mas vai
 * só como `true`, só no pino que o jogador já recebe, e pino sem a marca
 * continua chegando sem a chave (o recorte é uma lista do que vai).
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

describe('fogFilter: pino sem haste', () => {
  it('o pino que o mestre deixou sem haste chega sem haste para o jogador, em qualquer tipo', () => {
    const pins = [
      pino('marcador', 240, 200, { semHaste: true }),
      pino('alavanca', 250, 200, { kind: 'alavanca', semHaste: true }),
      pino('porta', 260, 200, { kind: 'viagem', semHaste: true }),
    ]
    const { map } = filterMapForPlayer(mapaCom(pins), 'p1', POSSE, RAIO)
    expect(map.pins.map((p) => [p.id, p.semHaste])).toEqual([
      ['marcador', true],
      ['alavanca', true],
      ['porta', true],
    ])
  })

  it('pino de sempre chega sem a chave: o jogador vê a haste', () => {
    const { map } = filterMapForPlayer(mapaCom([pino('comum', 240, 200)]), 'p1', POSSE, RAIO)
    expect(map.pins).toHaveLength(1)
    expect('semHaste' in map.pins[0]).toBe(false)
  })

  it('valor torto no campo (arquivo editado à mão) não atravessa', () => {
    const forjado = pino('forjado', 240, 200, { semHaste: 'o tesouro está na cripta' as unknown as true }) // as: o cenário é justamente um arquivo que o tipo não descreve
    const { map } = filterMapForPlayer(mapaCom([forjado]), 'p1', POSSE, RAIO)
    expect(map.pins).toHaveLength(1)
    expect('semHaste' in map.pins[0]).toBe(false)
    expect(JSON.stringify(map)).not.toContain('tesouro')
  })

  it('pino oculto, secreto ou fora da visão não chega, com ou sem haste', () => {
    const pins = [
      pino('visivel', 240, 200, { semHaste: true }),
      pino('oculto', 250, 200, { semHaste: true, hidden: true }),
      pino('secreto', 260, 200, { semHaste: true, secret: true }),
      pino('longe', 900, 900, { semHaste: true }),
    ]
    const { map } = filterMapForPlayer(mapaCom(pins), 'p1', POSSE, RAIO)
    expect(map.pins.map((p) => p.id)).toEqual(['visivel'])
  })

  it('pino "só de perto" com a ficha longe chega vazio, mas com a forma que o mestre escolheu', () => {
    // A carta está a 4 casas do herói (160 px com casa de 40), à vista mas longe de ler.
    const { map } = filterMapForPlayer(mapaCom([pino('carta', 360, 200, { semHaste: true, lerDePerto: 1 })]), 'p1', POSSE, RAIO)
    expect(map.pins).toHaveLength(1)
    expect(map.pins[0].longe).toBe(true)
    expect(map.pins[0].description).toBe('')
    expect(map.pins[0].semHaste).toBe(true)
  })
})
