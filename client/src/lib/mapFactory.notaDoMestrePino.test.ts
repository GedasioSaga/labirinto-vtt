import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { createEmptyMap, updatePin } from './mapFactory'

/** NOTA DO MESTRE NO PINO: escrever a nota é mudança (entra no desfazer); a mesma nota de novo não é. */

function mapaCom(pin: Pin): MapData {
  return { ...createEmptyMap('m', 'M', 5, 5, 64), pins: [pin] }
}

const PINO: Pin = { id: 'p', x: 10, y: 10, kind: 'exclamacao', description: 'Um baú.', image: null }

describe('updatePin: notaDoMestre', () => {
  it('escrever a nota muda só a nota', () => {
    const antes = mapaCom(PINO)
    const depois = updatePin(antes, 'p', { notaDoMestre: 'Mímico.' })
    expect(depois).not.toBe(antes)
    expect(depois.pins[0]).toEqual({ ...PINO, notaDoMestre: 'Mímico.' })
  })

  it('a mesma nota de novo devolve o mesmo mapa (sem entrada vazia no desfazer)', () => {
    const antes = mapaCom({ ...PINO, notaDoMestre: 'Mímico.' })
    expect(updatePin(antes, 'p', { notaDoMestre: 'Mímico.' })).toBe(antes)
  })

  it('apagar a nota de um pino que nunca teve não é mudança; apagar uma nota escrita é', () => {
    const semNota = mapaCom(PINO)
    expect(updatePin(semNota, 'p', { notaDoMestre: '' })).toBe(semNota)
    const comNota = mapaCom({ ...PINO, notaDoMestre: 'Mímico.' })
    const apagada = updatePin(comNota, 'p', { notaDoMestre: '' })
    expect(apagada).not.toBe(comNota)
    expect(apagada.pins[0].notaDoMestre ?? '').toBe('')
  })
})
