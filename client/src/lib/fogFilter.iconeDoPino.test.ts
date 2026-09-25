import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * ÍCONE DO MARCADOR no recorte do jogador. O cartão do jogador desenha o
 * símbolo que o mestre escolheu (baú, armadilha…), então o ícone precisa
 * chegar — mas SÓ um dos seis nomes conhecidos, e só no pino que o jogador
 * pode ver. Texto livre no campo (arquivo editado à mão) não atravessa.
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

describe('fogFilter: ícone do marcador', () => {
  it('o ícone do pino que o jogador vê chega, com o nome exato', () => {
    const { map } = filterMapForPlayer(mapaCom([pino('bau', 240, 200, { icon: 'bau' })]), 'p1', POSSE, RAIO)
    expect(map.pins).toHaveLength(1)
    expect(map.pins[0].icon).toBe('bau')
  })

  it('ícone de pino oculto, secreto ou fora da visão não chega', () => {
    const pins = [
      pino('visivel', 240, 200, { icon: 'chave' }),
      pino('oculto', 250, 200, { icon: 'armadilha', hidden: true }),
      pino('secreto', 260, 200, { icon: 'perigo', secret: true }),
      pino('longe', 900, 900, { icon: 'agua' }),
    ]
    const { map } = filterMapForPlayer(mapaCom(pins), 'p1', POSSE, RAIO)
    expect(map.pins.map((p) => p.id)).toEqual(['visivel'])
    const recorte = JSON.stringify(map)
    for (const escondido of ['armadilha', 'perigo', 'agua', 'oculto', 'secreto', 'longe']) {
      expect(recorte, `o recorte vazou "${escondido}"`).not.toContain(escondido)
    }
  })

  it('texto livre no campo do ícone (arquivo editado à mão) não atravessa', () => {
    const forjado = pino('forjado', 240, 200, { icon: 'o tesouro está na cripta' as Pin['icon'] }) // as: o cenário é justamente um arquivo que o tipo não descreve
    const { map } = filterMapForPlayer(mapaCom([forjado]), 'p1', POSSE, RAIO)
    expect(map.pins).toHaveLength(1)
    expect('icon' in map.pins[0]).toBe(false)
    expect(JSON.stringify(map)).not.toContain('tesouro')
  })

  it('pino de viagem não leva ícone: no mapa ele desenha a passagem, nunca o símbolo', () => {
    const viagem = pino('porta', 240, 200, { kind: 'viagem', icon: 'escada' })
    const { map } = filterMapForPlayer(mapaCom([viagem]), 'p1', POSSE, RAIO)
    expect(map.pins).toHaveLength(1)
    expect('icon' in map.pins[0]).toBe(false)
  })
})
