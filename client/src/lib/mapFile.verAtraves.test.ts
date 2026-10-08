import { describe, expect, it } from 'vitest'
import type { MapData, Region } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * VER ATRAVÉS DAS PAREDES (`RoomMeta.dentroVeFora` / `foraVeDentro`) no DISCO:
 * ausente continua ausente (mapa antigo abre igual), `true` volta como foi
 * salvo, e qualquer outro valor de arquivo editado à mão sai — a parede volta
 * a segurar a visão em vez de carregar um valor que o tipo não tem.
 */

function vitrine(room: Record<string, unknown>): Region {
  const base: Region = { id: 'vitrine', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], tag: '', fillColor: '#123', fillPattern: 'solid', data: {} }
  return { ...base, room: { shape: 'rect', name: 'Vitrine', ...room } }
}

function mapaCom(room: Record<string, unknown>): MapData {
  return { ...createEmptyMap('m', 'M', 100, 100, 10), regions: [vitrine(room)] }
}

describe('mapFile — ver através das paredes da Sala', () => {
  it('ida e volta preserva os dois interruptores ligados', () => {
    const volta = deserializeMap(serializeMap(mapaCom({ dentroVeFora: true, foraVeDentro: true })))
    expect(volta.regions[0].room?.dentroVeFora).toBe(true)
    expect(volta.regions[0].room?.foraVeDentro).toBe(true)
  })

  it('sala sem os campos abre sem os campos', () => {
    const room = deserializeMap(serializeMap(mapaCom({}))).regions[0].room
    expect(room?.name).toBe('Vitrine')
    expect(room !== undefined && 'dentroVeFora' in room).toBe(false)
    expect(room !== undefined && 'foraVeDentro' in room).toBe(false)
  })

  it('valor torto (texto, número, false, null) sai; o outro campo e a sala ficam', () => {
    for (const torto of ['true', 1, false, null]) {
      const room = deserializeMap(serializeMap(mapaCom({ dentroVeFora: torto, foraVeDentro: true, dark: true }))).regions[0].room
      expect(room?.name).toBe('Vitrine')
      expect(room !== undefined && 'dentroVeFora' in room).toBe(false)
      expect(room?.foraVeDentro).toBe(true)
      expect(room?.dark).toBe(true)
    }
    const soFora = deserializeMap(serializeMap(mapaCom({ dentroVeFora: true, foraVeDentro: 'sim' }))).regions[0].room
    expect(soFora?.dentroVeFora).toBe(true)
    expect(soFora !== undefined && 'foraVeDentro' in soFora).toBe(false)
  })
})
