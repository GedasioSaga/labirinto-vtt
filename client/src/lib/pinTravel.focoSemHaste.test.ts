import { describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { PIN_HEAD_OFFSET, PIN_HEIGHT } from './pins'
import { pinFocusPoint } from './pinTravel'

/**
 * FOCO DO PINO SEM HASTE: a câmera que chega por um pino centraliza o desenho.
 * Com haste, o desenho vai da ponta cravada ao topo da cabeça, e o meio é a
 * metade da altura. Sem haste (`semHaste`), o desenho é só a cabeça: o foco é
 * o centro dela, não um ponto no chão abaixo.
 */

function pino(extra: Partial<Pin> = {}): Pin {
  return { id: 'p', x: 200, y: 300, kind: 'exclamacao', description: '', image: null, ...extra }
}

describe('pinFocusPoint', () => {
  it('pino com haste: meio do desenho, metade da altura acima da ponta', () => {
    expect(pinFocusPoint(pino())).toEqual({ x: 200, y: 300 - PIN_HEIGHT / 2 })
  })

  it('pino sem haste: centro da cabeça', () => {
    expect(pinFocusPoint(pino({ semHaste: true }))).toEqual({ x: 200, y: 300 - PIN_HEAD_OFFSET })
  })
})
