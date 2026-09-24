import { describe, expect, it } from 'vitest'
import type { MapData, Region } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * "Raio de visão aqui" (`RoomMeta.raioDeVisao`) e "Vista de longe"
 * (`Light.vistaDeLonge`) no DISCO: ausente continua ausente (mapa antigo abre
 * igual), número positivo volta como foi salvo, e lixo de arquivo editado à mão
 * sai em vez de virar raio de visão.
 */

function mirante(room: Record<string, unknown>): Region {
  const base: Region = { id: 'mirante', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], tag: '', fillColor: '#123', fillPattern: 'solid', data: {} }
  return { ...base, room: { shape: 'rect', name: 'Mirante', ...room } }
}

function ida(map: MapData): MapData {
  return deserializeMap(serializeMap(map))
}

describe('mapFile — raio de visão da sala e luz vista de longe', () => {
  it('ida e volta preserva o raio da sala e a marca da luz', () => {
    const map: MapData = {
      ...createEmptyMap('m', 'M', 100, 100, 10),
      regions: [mirante({ raioDeVisao: 1500 })],
      lights: [{ id: 'farol', x: 5, y: 5, radius: 100, color: '#fff', intensity: 1, vistaDeLonge: true }],
    }
    const volta = ida(map)
    expect(volta.regions[0].room?.raioDeVisao).toBe(1500)
    expect(volta.lights[0].vistaDeLonge).toBe(true)
  })

  it('sala sem o campo abre sem o campo', () => {
    const volta = ida({ ...createEmptyMap('m', 'M', 100, 100, 10), regions: [mirante({})] })
    expect(volta.regions[0].room?.name).toBe('Mirante')
    expect(volta.regions[0].room !== undefined && 'raioDeVisao' in volta.regions[0].room).toBe(false)
  })

  it('raio torto no arquivo (texto, zero, negativo, null) sai; a sala abre igual', () => {
    for (const torto of ['700', 0, -5, null]) {
      const json = serializeMap({ ...createEmptyMap('m', 'M', 100, 100, 10), regions: [mirante({ raioDeVisao: torto })] })
      const volta = deserializeMap(json)
      expect(volta.regions[0].room?.name).toBe('Mirante')
      expect(volta.regions[0].room !== undefined && 'raioDeVisao' in volta.regions[0].room).toBe(false)
    }
  })
})
