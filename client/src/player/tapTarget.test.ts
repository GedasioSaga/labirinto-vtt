import { describe, expect, it } from 'vitest'
import { PIN_HEAD_OFFSET } from '../lib/pins'
import type { Pin, Wall } from '../types/map'
import { findTapTarget, holdBecomesSignal } from './tapTarget'

/** Folga de dedo do toque, em px de mundo com câmera 1:1 (a mesma de PlayerView). */
const TAP_TOLERANCE_PX = 18

/** Porta horizontal de uma célula, de (200,300) a (250,300). Sem campos opcionais. */
const PORTA: Wall = {
  id: 'porta-sala',
  x1: 200,
  y1: 300,
  x2: 250,
  y2: 300,
  blocksLight: true,
  blocksMove: true,
  door: { open: false, locked: false, kind: 'normal' },
}
const PAREDE: Wall = { ...PORTA, id: 'parede-norte', y1: 100, y2: 100, door: null }
const PINO: Pin = { id: 'pino-bau', x: 400, y: 400, kind: 'exclamacao', description: 'Um baú velho', image: null }

const MEIO_DA_PORTA = { x: 225, y: 300 }
/** Dedo gordo: ao lado da porta, ainda dentro da folga. */
const PERTO_DA_PORTA = { x: 225, y: 300 + TAP_TOLERANCE_PX - 2 }
const CHAO = { x: 600, y: 600 }

/** O que PlayerView faz no pointerdown: segurar parado ali arma o sinal de 500 ms? */
function segurarViraSinal(point: { x: number; y: number }, pins: readonly Pin[] = [PINO], walls: readonly Wall[] = [PORTA, PAREDE]) {
  return holdBecomesSignal(findTapTarget(pins, walls, point, TAP_TOLERANCE_PX))
}

describe('apertar a porta não vira sinal de mapa', () => {
  it('dedo no meio da porta: é a porta, e segurar não arma o sinal', () => {
    expect(findTapTarget([PINO], [PORTA, PAREDE], MEIO_DA_PORTA, TAP_TOLERANCE_PX)).toEqual({ kind: 'door', doorId: 'porta-sala' })
    expect(segurarViraSinal(MEIO_DA_PORTA)).toBe(false)
  })

  it('dedo ao lado da porta, dentro da folga do toque: também não arma o sinal', () => {
    expect(segurarViraSinal(PERTO_DA_PORTA)).toBe(false)
  })

  it('pino continua sem armar o sinal', () => {
    const cabeca = { x: PINO.x, y: PINO.y - PIN_HEAD_OFFSET }
    expect(findTapTarget([PINO], [PORTA], cabeca, TAP_TOLERANCE_PX)).toEqual({ kind: 'pin', pinId: 'pino-bau' })
    expect(segurarViraSinal(cabeca)).toBe(false)
  })

  it('chão livre continua virando sinal ao segurar', () => {
    expect(findTapTarget([PINO], [PORTA, PAREDE], CHAO, TAP_TOLERANCE_PX)).toEqual({ kind: 'map' })
    expect(segurarViraSinal(CHAO)).toBe(true)
  })

  it('parede sem porta não é controle: segurar em cima dela vira sinal', () => {
    expect(segurarViraSinal({ x: 225, y: 100 })).toBe(true)
  })

  it('porta que o jogador não recebeu (camada oculta) não bloqueia o sinal', () => {
    expect(segurarViraSinal(MEIO_DA_PORTA, [], [PAREDE])).toBe(true)
  })

  it('mapa sem pino nem parede: tudo é chão e segurar vira sinal', () => {
    expect(findTapTarget([], [], MEIO_DA_PORTA, TAP_TOLERANCE_PX)).toEqual({ kind: 'map' })
    expect(segurarViraSinal(MEIO_DA_PORTA, [], [])).toBe(true)
  })
})
