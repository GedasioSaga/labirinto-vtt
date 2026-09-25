import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import type { Prop } from '../types/map'

/**
 * `Prop.mobilia` no disco: o tipo do móvel (catre, mesa, baú) vai e volta;
 * mapa salvo antes do campo abre igual e grava sem ele; tipo fora do catálogo
 * (arquivo editado à mão, versão futura) some e o objeto continua no mapa.
 */

const objeto = (extra: string): string => `{"id": "p", "src": "", "x": 1, "y": 2, "width": 40, "height": 80, "linkedMapPath": null${extra}}`

function comMovel(extra: Partial<Prop>) {
  const prop: Prop = { id: 'p', src: '', x: 1, y: 2, width: 40, height: 80, linkedMapPath: null, ...extra }
  return { ...createEmptyMap('map_m', 'M', 5, 5, 40), props: [prop] }
}

describe('mapFile: mobília desenhada', () => {
  it('o catre vai e volta do disco', () => {
    expect(deserializeMap(serializeMap(comMovel({ mobilia: 'catre' }))).props[0].mobilia).toBe('catre')
  })

  it('mapa antigo abre com o objeto, sem o campo, e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "props": [${objeto('')}]}`)
    expect(antigo.props).toHaveLength(1)
    expect('mobilia' in antigo.props[0]).toBe(false)
    expect(serializeMap(antigo)).not.toContain('mobilia')
  })

  it('tipo fora do catálogo some, e o objeto fica no mapa', () => {
    for (const valor of ['"trono"', '1', 'null', '{}']) {
      const lido = deserializeMap(`{"id": "torto", "props": [${objeto(`, "mobilia": ${valor}`)}]}`)
      expect(lido.props, `mobilia: ${valor}`).toHaveLength(1)
      expect(lido.props[0].mobilia, `mobilia: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `mobilia: ${valor}`).not.toContain('mobilia')
    }
  })
})
