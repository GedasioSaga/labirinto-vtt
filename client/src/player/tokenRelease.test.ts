import { describe, expect, it } from 'vitest'
import { findPinAt, PIN_HEAD_OFFSET } from '../lib/pins'
import { SIGNAL_LONG_PRESS_TOLERANCE_PX } from '../lib/signals'
import type { Pin } from '../types/map'
import { resolveTokenRelease } from './tokenRelease'

/** Folga de dedo do toque no pino, em px de tela (a mesma de PlayerView). */
const PIN_TAP_TOLERANCE_PX = 18

const PIN: Pin = { id: 'pino-bau', x: 100, y: 100, kind: 'exclamacao', description: 'Um baú velho', image: null }
/** A ficha encostada no pino: o disco dela cobre a cabeça do pino. */
const TOKEN_ON_PIN = { x: 100, y: 80 }
/** Cabeça do pino, onde o dedo aperta. Câmera 1:1, então tela === mundo. */
const PIN_HEAD = { x: PIN.x, y: PIN.y - PIN_HEAD_OFFSET }

/** O que PlayerView faz ao soltar a ficha: procura o pino sob o ponto onde o dedo APERTOU. */
function release(start: { x: number; y: number }, end: { x: number; y: number }, visiblePins: readonly Pin[], token = TOKEN_ON_PIN) {
  const pin = findPinAt(visiblePins, start, PIN_TAP_TOLERANCE_PX)
  const drop = { x: token.x + (end.x - start.x), y: token.y + (end.y - start.y) }
  return resolveTokenRelease({ startScreen: start, endScreen: end, drop }, token, pin === null ? null : pin.id, SIGNAL_LONG_PRESS_TOLERANCE_PX)
}

describe('soltar a própria ficha encostada num pino', () => {
  it('toque parado no pino abre o cartão, mesmo com a ficha por cima dele', () => {
    expect(release(PIN_HEAD, PIN_HEAD, [PIN])).toEqual({ kind: 'openPin', pinId: 'pino-bau' })
  })

  it('dedo que treme dentro da folga ainda é toque: abre o cartão e a ficha não anda', () => {
    const tremido = { x: PIN_HEAD.x + 3, y: PIN_HEAD.y - 3 }
    expect(release(PIN_HEAD, tremido, [PIN])).toEqual({ kind: 'openPin', pinId: 'pino-bau' })
  })

  it('arrastar a ficha para fora do pino continua movendo, sem abrir cartão', () => {
    const longe = { x: PIN_HEAD.x + 40.4, y: PIN_HEAD.y + 20.6 }
    expect(release(PIN_HEAD, longe, [PIN])).toEqual({ kind: 'move', x: 140, y: 101 })
  })

  it('toque parado na ficha longe de qualquer pino não faz nada', () => {
    const noCorpo = { x: TOKEN_ON_PIN.x + 30, y: TOKEN_ON_PIN.y + 20 }
    expect(release(noCorpo, noCorpo, [PIN])).toEqual({ kind: 'stay' })
  })

  it('pino que o jogador não recebeu (névoa, zona oculta, segredo) não abre nada', () => {
    expect(release(PIN_HEAD, PIN_HEAD, [])).toEqual({ kind: 'stay' })
  })

  it('ficha que sumiu no meio do gesto não pede movimento', () => {
    const longe = { x: PIN_HEAD.x + 40, y: PIN_HEAD.y }
    expect(resolveTokenRelease({ startScreen: PIN_HEAD, endScreen: longe, drop: longe }, null, null, SIGNAL_LONG_PRESS_TOLERANCE_PX)).toEqual({
      kind: 'stay',
    })
  })
})
