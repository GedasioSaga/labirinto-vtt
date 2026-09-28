import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { createEmptyMap, updatePin } from './mapFactory'

/**
 * `updatePin` com "Só o círculo, sem haste": ligar e desligar são mudança
 * (entram no desfazer); ligar de novo, ou desligar o que nunca foi ligado,
 * devolve o MESMO mapa — sem entrada vazia no histórico.
 */

const BAU: Pin = { id: 'bau', x: 10, y: 10, kind: 'exclamacao', description: 'Baú', image: null }
const mapa = (pin: Pin): MapData => ({ ...createEmptyMap('m', 'M', 5, 5, 50), pins: [pin] })

describe('mapFactory.updatePin: semHaste', () => {
  it('ligar tira a haste; desligar devolve', () => {
    const ligado = updatePin(mapa(BAU), 'bau', { semHaste: true })
    expect(ligado.pins[0].semHaste).toBe(true)
    const desligado = updatePin(ligado, 'bau', { semHaste: undefined })
    expect(desligado).not.toBe(ligado)
    expect(desligado.pins[0].semHaste).toBeUndefined()
  })

  it('só a forma muda: o ponto do pino fica onde estava', () => {
    const ligado = updatePin(mapa(BAU), 'bau', { semHaste: true })
    expect({ x: ligado.pins[0].x, y: ligado.pins[0].y }).toEqual({ x: BAU.x, y: BAU.y })
  })

  it('o mesmo valor, ou desligar o que nunca foi ligado, devolve o mesmo mapa', () => {
    const semHaste = mapa({ ...BAU, semHaste: true })
    expect(updatePin(semHaste, 'bau', { semHaste: true })).toBe(semHaste)
    const comum = mapa(BAU)
    expect(updatePin(comum, 'bau', { semHaste: undefined })).toBe(comum)
  })
})
