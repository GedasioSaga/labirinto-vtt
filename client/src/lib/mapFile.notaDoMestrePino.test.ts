import { describe, expect, it } from 'vitest'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * NOTA DO MESTRE NO PINO saiu em 09/10/2026 (decisão do usuário: o dado é
 * apagado). Mapa salvo antes abre sem ela e grava sem ela. A nota da SALA
 * (`RoomMeta.notaDoMestre`) é outro campo e continua indo e voltando.
 */

const pino = (extra: string): string => `{"id": "p", "x": 1, "y": 2, "kind": "exclamacao", "description": "Um baú.", "image": null${extra}}`

describe('mapFile: nota do mestre do pino é descartada', () => {
  it('mapa antigo com nota no pino abre sem ela e grava sem ela; o resto do pino fica', () => {
    const lido = deserializeMap(`{"id": "antigo", "pins": [${pino(', "nome": "Baú", "notaDoMestre": "Mímico."')}]}`)
    expect('notaDoMestre' in lido.pins[0]).toBe(false)
    expect(lido.pins[0].description).toBe('Um baú.')
    expect(lido.pins[0].nome).toBe('Baú')
    const gravado = serializeMap(lido)
    expect(gravado).not.toContain('notaDoMestre')
    expect(gravado).not.toContain('Mímico')
  })

  it('valor torto (não texto) também some', () => {
    for (const valor of ['1', 'true', 'null', '{"x": 1}', '["a"]']) {
      const lido = deserializeMap(`{"id": "torto", "pins": [${pino(`, "notaDoMestre": ${valor}`)}]}`)
      expect('notaDoMestre' in lido.pins[0], `notaDoMestre: ${valor}`).toBe(false)
    }
  })

  it('a nota do mestre da SALA continua: vai e volta do disco', () => {
    const sala = '{"id": "sala", "points": [{"x": 0, "y": 0}, {"x": 64, "y": 0}, {"x": 64, "y": 64}], "room": {"name": "Cripta", "notaDoMestre": "Armadilha no altar."}}'
    const lido = deserializeMap(`{"id": "com-sala", "regions": [${sala}], "pins": [${pino(', "notaDoMestre": "some"')}]}`)
    expect(lido.regions[0].room?.notaDoMestre).toBe('Armadilha no altar.')
    const gravado = serializeMap(lido)
    expect(gravado).toContain('Armadilha no altar.')
    expect(gravado).not.toContain('"some"')
  })
})
