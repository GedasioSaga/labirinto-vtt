import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { MapData, Pin } from '../types/map'
import type { Bounds } from '../pixi/world'
import { mapObjectKey, mapObjectOf } from './mapObjects'
import { PIN_HEAD_OFFSET, PIN_HEAD_RADIUS, findPinAt } from './pins'

/**
 * PINO SEM HASTE NA CAIXA DO OBJETO: a caixa do pino (`MapObjectEntry.bounds`,
 * a que a lista "Objetos do mapa" e a busca usam para enquadrar) segue o toque
 * (`findPinAt`). Sem a haste, o vão entre a cabeça e a ponta é chão: uma caixa
 * que pega só onde a haste estaria não pega o pino. Com haste, nada muda.
 */

function pino(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 200, y: 300, kind: 'exclamacao', description: '', image: null, ...extra }
}

/** Sem o campo `semHaste`: o pino de sempre, com haste. */
const COM_HASTE = pino('com-haste')
const SEM_HASTE = pino('sem-haste', { semHaste: true })
const MAPA: MapData = { ...createEmptyMap('m', 'M', 10, 10, 50), pins: [COM_HASTE, SEM_HASTE] }

/** A caixa do pino como a lista monta (`mapObjectOf`). */
function caixaDo(pin: Pin): Bounds {
  const entry = mapObjectOf(MAPA, mapObjectKey('pin', pin.id))
  if (entry === null) throw new Error(`pino ${pin.id} fora da lista`)
  return entry.bounds
}

/** As duas caixas se sobrepõem. */
function pega(caixa: Bounds, alvo: Bounds): boolean {
  return caixa.minX < alvo.maxX && caixa.maxX > alvo.minX && caixa.minY < alvo.maxY && caixa.maxY > alvo.minY
}

/**
 * A menor caixa que cobre todo ponto onde o toque acerta o pino, de 1 em 1 px.
 * As medidas do pino são inteiras, então as bordas do toque caem na grade.
 */
function caixaDoToque(pin: Pin): Bounds {
  const caixa = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (let y = pin.y - 60; y <= pin.y + 20; y++) {
    for (let x = pin.x - 40; x <= pin.x + 40; x++) {
      if (findPinAt([pin], { x, y }) === null) continue
      caixa.minX = Math.min(caixa.minX, x)
      caixa.minY = Math.min(caixa.minY, y)
      caixa.maxX = Math.max(caixa.maxX, x)
      caixa.maxY = Math.max(caixa.maxY, y)
    }
  }
  return caixa
}

/** Base da cabeça: dali até a ponta cravada só passa a haste. */
const BASE_DA_CABECA = 300 - PIN_HEAD_OFFSET + PIN_HEAD_RADIUS
/** Só a haste: estreita, da base da cabeça (sem encostar) até a ponta. */
const SO_A_HASTE: Bounds = { minX: 198, minY: BASE_DA_CABECA + 1, maxX: 202, maxY: 300 }
/** Em volta do centro da cabeça. */
const NA_CABECA: Bounds = { minX: 195, minY: 300 - PIN_HEAD_OFFSET - 5, maxX: 205, maxY: 300 - PIN_HEAD_OFFSET + 5 }

describe('mapObjectOf: caixa do pino sem haste', () => {
  it('caixa só na haste: não pega o pino sem haste, mas pega o pino com haste', () => {
    expect(pega(SO_A_HASTE, caixaDo(SEM_HASTE))).toBe(false)
    expect(pega(SO_A_HASTE, caixaDo(COM_HASTE))).toBe(true)
  })

  it('caixa na cabeça: pega os dois', () => {
    expect(pega(NA_CABECA, caixaDo(SEM_HASTE))).toBe(true)
    expect(pega(NA_CABECA, caixaDo(COM_HASTE))).toBe(true)
  })

  it('a caixa é a do toque: só a cabeça no pino sem haste, cabeça e haste no pino com haste', () => {
    expect(caixaDo(SEM_HASTE)).toEqual(caixaDoToque(SEM_HASTE))
    expect(caixaDo(SEM_HASTE).maxY).toBe(BASE_DA_CABECA)
    expect(caixaDo(COM_HASTE)).toEqual(caixaDoToque(COM_HASTE))
    expect(caixaDo(COM_HASTE).maxY).toBe(300)
  })
})
