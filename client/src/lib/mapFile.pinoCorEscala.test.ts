import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * COR E TAMANHO DO PINO no disco (fatia 14): campos novos e opcionais. A cor
 * só volta `#rrggbb` (minúscula); o tamanho só número na faixa 0,5 a 3 e
 * diferente de 1. O resto volta AUSENTE, e mapa antigo abre e grava igual.
 */

const pino = (extra: string): string => `{"id": "p", "x": 1, "y": 2, "kind": "exclamacao", "description": "", "image": null${extra}}`

describe('mapFile: cor e escala do pino', () => {
  it('vão e voltam do disco; a cor volta minúscula', () => {
    const map = {
      ...createEmptyMap('map_c', 'C', 5, 5, 64),
      pins: [{ id: 'bau', x: 64, y: 64, kind: 'exclamacao' as const, description: 'Baú', image: null, cor: '#5B6670', escala: 2.5 }],
    }
    const lido = deserializeMap(serializeMap(map)).pins[0]
    expect([lido.cor, lido.escala]).toEqual(['#5b6670', 2.5])
    expect({ x: lido.x, y: lido.y }).toEqual({ x: 64, y: 64 })
  })

  it('cor torta volta AUSENTE: o latão de sempre', () => {
    for (const valor of ['"red"', '"#fff"', '"#12345g"', '"5b6670"', '1', 'null', '{}', 'true']) {
      const lido = deserializeMap(`{"id": "torto", "pins": [${pino(`, "cor": ${valor}`)}]}`)
      expect(lido.pins[0].cor, `cor: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `cor: ${valor}`).not.toContain('"cor"')
    }
  })

  it('escala fora da faixa, não numérica ou 1 volta AUSENTE: o tamanho de sempre', () => {
    for (const valor of ['0', '0.4', '4', '3.01', '-1', '"2"', 'null', 'true', '1']) {
      const lido = deserializeMap(`{"id": "torto", "pins": [${pino(`, "escala": ${valor}`)}]}`)
      expect(lido.pins[0].escala, `escala: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `escala: ${valor}`).not.toContain('"escala"')
    }
  })

  it('as pontas da faixa valem', () => {
    const lido = deserializeMap(`{"id": "ponta", "pins": [${pino(', "escala": 0.5')}, ${pino(', "escala": 3').replace('"p"', '"q"')}]}`)
    expect(lido.pins.map((p) => p.escala)).toEqual([0.5, 3])
  })

  it('mapa antigo abre sem os campos e grava igual', () => {
    const texto = `{"id": "antigo", "pins": [${pino('')}]}`
    const antigo = deserializeMap(texto)
    expect(antigo.pins[0].cor).toBeUndefined()
    expect(antigo.pins[0].escala).toBeUndefined()
    const salvo = serializeMap(antigo)
    expect(salvo).not.toContain('"cor"')
    expect(salvo).not.toContain('"escala"')
    expect(serializeMap(deserializeMap(salvo))).toBe(salvo)
  })
})
