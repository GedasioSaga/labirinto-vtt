import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { createEmptyMap, updatePin } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * MOTIVO DO BLOQUEIO no disco e no desfazer: `motivo` é campo novo e opcional
 * do pino de viagem. Só um valor da lista volta do arquivo; o resto (texto
 * livre, número, arquivo editado à mão) volta AUSENTE — "Está trancada", o de
 * sempre. Mapa antigo abre e grava sem o campo. Trocar o motivo é uma entrada
 * do desfazer; escolher o mesmo motivo de novo não é.
 */

const pino = (extra: string): string => `{"id": "p", "x": 1, "y": 2, "kind": "viagem", "description": "", "image": null, "passagem": "trancada"${extra}}`

const CARACOL: Pin = { id: 'p', x: 10, y: 10, kind: 'viagem', description: 'Caracol', image: null, passagem: 'trancada' }

function mapaCom(pin: Pin): MapData {
  return { ...createEmptyMap('m', 'M', 5, 5, 64), pins: [pin] }
}

describe('mapFile: motivo do bloqueio', () => {
  it('cada motivo da lista vai e volta do disco', () => {
    for (const motivo of ['desabou', 'alagada', 'em-chamas', 'sem-energia'] as const) {
      const lido = deserializeMap(serializeMap(mapaCom({ ...CARACOL, motivo })))
      expect(lido.pins[0].motivo, motivo).toBe(motivo)
    }
  })

  it('valor fora da lista volta AUSENTE e não é regravado', () => {
    for (const valor of ['"inventado"', '"<b>x</b>"', '1', 'null', '{}', '["desabou"]', 'true']) {
      const lido = deserializeMap(`{"id": "torto", "pins": [${pino(`, "motivo": ${valor}`)}]}`)
      expect(lido.pins[0].motivo, `motivo: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `motivo: ${valor}`).not.toContain('motivo')
    }
  })

  it('mapa antigo abre sem o campo e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "pins": [${pino('')}]}`)
    expect(antigo.pins[0].passagem).toBe('trancada')
    expect(antigo.pins[0].motivo).toBeUndefined()
    expect(serializeMap(antigo)).not.toContain('motivo')
  })
})

describe('updatePin: motivo do bloqueio', () => {
  it('escolher o motivo muda só o motivo', () => {
    const antes = mapaCom(CARACOL)
    const depois = updatePin(antes, 'p', { motivo: 'alagada' })
    expect(depois).not.toBe(antes)
    expect(depois.pins[0]).toEqual({ ...CARACOL, motivo: 'alagada' })
  })

  it('o mesmo motivo de novo devolve o mesmo mapa; voltar a "Trancada" (sem motivo) é mudança', () => {
    const alagada = mapaCom({ ...CARACOL, motivo: 'alagada' })
    expect(updatePin(alagada, 'p', { motivo: 'alagada' })).toBe(alagada)
    const trancada = updatePin(alagada, 'p', { motivo: undefined })
    expect(trancada).not.toBe(alagada)
    expect(trancada.pins[0].motivo).toBeUndefined()
    // Tirar o motivo de quem nunca teve não empurra entrada vazia no desfazer.
    const semMotivo = mapaCom(CARACOL)
    expect(updatePin(semMotivo, 'p', { motivo: undefined })).toBe(semMotivo)
  })
})
