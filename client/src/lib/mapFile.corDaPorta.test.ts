import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * COR DA PORTA no disco (fatia 22): `DoorState.cor` é campo novo e opcional.
 * Só `#rrggbb` volta do arquivo, em minúscula; qualquer outra coisa volta
 * AUSENTE (o laranja de sempre), e mapa antigo abre e grava sem o campo.
 */
const parede = (door: string): string => `{"id": "w", "x1": 0, "y1": 0, "x2": 50, "y2": 0, "blocksLight": true, "blocksMove": true, "door": ${door}}`

describe('mapFile: cor da porta', () => {
  it('cor válida vai e volta do disco', () => {
    const map = {
      ...createEmptyMap('map_a', 'A', 5, 5, 64),
      walls: [{ id: 'w', x1: 0, y1: 0, x2: 50, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: true, kind: 'normal' as const, cor: '#79a9cc' } }],
    }
    expect(deserializeMap(serializeMap(map)).walls[0]?.door).toEqual({ open: false, locked: true, kind: 'normal', cor: '#79a9cc' })
  })

  it('hex em maiúscula volta em minúscula', () => {
    const lido = deserializeMap(`{"id": "p", "walls": [${parede('{"open": true, "locked": false, "kind": "normal", "cor": "#79A9CC"}')}]}`)
    expect(lido.walls[0]?.door?.cor).toBe('#79a9cc')
  })

  it('SEGURANÇA: cor torta volta AUSENTE e não chega ao arquivo gravado', () => {
    for (const valor of ['"red"', '"#12"', '"javascript:alert(1)"', '"#79a9cc; background: url(x)"', '"#79a9cg"', '""', '1', 'true', 'null', '{}', '["#79a9cc"]']) {
      const lido = deserializeMap(`{"id": "torto", "walls": [${parede(`{"open": false, "locked": false, "kind": "normal", "cor": ${valor}}`)}]}`)
      expect(lido.walls[0]?.door, `cor: ${valor}`).toEqual({ open: false, locked: false, kind: 'normal' })
      expect(serializeMap(lido), `cor: ${valor}`).not.toContain('"cor"')
    }
  })

  it('mapa antigo, sem cor, abre igual e grava sem o campo', () => {
    const texto = `{"id": "antigo", "walls": [${parede('{"open": false, "locked": true, "kind": "double", "animacao": "girar"}')}]}`
    const antigo = deserializeMap(texto)
    expect(antigo.walls[0]?.door).toEqual({ open: false, locked: true, kind: 'double', animacao: 'girar' })
    expect(serializeMap(antigo)).not.toContain('"cor"')
    // Duas voltas pelo disco dão o mesmo arquivo: nada nasce no caminho.
    expect(serializeMap(deserializeMap(serializeMap(antigo)))).toBe(serializeMap(antigo))
  })

  it('a cor convive com os outros campos da porta', () => {
    const lido = deserializeMap(`{"id": "p", "walls": [${parede('{"open": false, "locked": false, "kind": "gate", "secret": true, "opensFrom": "left", "animacao": "deslizar", "cor": "#e2645a"}')}]}`)
    expect(lido.walls[0]?.door).toEqual({ open: false, locked: false, kind: 'gate', secret: true, opensFrom: 'left', animacao: 'deslizar', cor: '#e2645a' })
  })
})
