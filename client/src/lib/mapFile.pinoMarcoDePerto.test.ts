import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * PINO MARCO e SÓ DE PERTO no disco: dois campos novos e opcionais. `marco`
 * só volta quando é `true`; `lerDePerto` só quando é um número inteiro de casas
 * entre 1 e 20. O resto volta AUSENTE, e mapa antigo não ganha nenhum dos dois.
 * `longe` é só do recorte do jogador e nunca volta do arquivo.
 */

const pino = (extra: string): string => `{"id": "p", "x": 1, "y": 2, "kind": "exclamacao", "description": "", "image": null${extra}}`

describe('mapFile: marco e lerDePerto', () => {
  it('os dois vão e voltam do disco', () => {
    const map = {
      ...createEmptyMap('map_c', 'C', 5, 5, 64),
      pins: [{ id: 'templo', x: 64, y: 64, kind: 'exclamacao' as const, description: 'Templo', image: null, marco: true as const, lerDePerto: 2 }],
    }
    const lido = deserializeMap(serializeMap(map)).pins[0]
    expect(lido.marco).toBe(true)
    expect(lido.lerDePerto).toBe(2)
  })

  it('marco fora da forma volta AUSENTE', () => {
    for (const valor of ['false', '"true"', '1', 'null', '{}']) {
      const lido = deserializeMap(`{"id": "torto", "pins": [${pino(`, "marco": ${valor}`)}]}`)
      expect(lido.pins[0].marco, `marco: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `marco: ${valor}`).not.toContain('"marco"')
    }
  })

  it('lerDePerto fora da forma volta AUSENTE: o pino é lido de qualquer lugar, como sempre', () => {
    for (const valor of ['0', '-1', '1.5', '21', '"2"', 'null', 'true', '1e400']) {
      const lido = deserializeMap(`{"id": "torto", "pins": [${pino(`, "lerDePerto": ${valor}`)}]}`)
      expect(lido.pins[0].lerDePerto, `lerDePerto: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `lerDePerto: ${valor}`).not.toContain('"lerDePerto"')
    }
  })

  it('longe gravado no arquivo (editado à mão) não entra no mapa do mestre', () => {
    const lido = deserializeMap(`{"id": "torto", "pins": [${pino(', "longe": true')}]}`)
    expect(lido.pins[0].longe).toBeUndefined()
  })

  it('mapa antigo abre sem os campos e grava sem eles', () => {
    const antigo = deserializeMap(`{"id": "antigo", "pins": [${pino('')}]}`)
    expect(antigo.pins[0].marco).toBeUndefined()
    expect(antigo.pins[0].lerDePerto).toBeUndefined()
    expect(serializeMap(antigo)).not.toContain('"marco"')
    expect(serializeMap(antigo)).not.toContain('"lerDePerto"')
  })
})
