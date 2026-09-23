import { describe, expect, it } from 'vitest'
import { deserializeMap, serializeMap } from './mapFile'
import { addRoom, createEmptyMap, rotateRegion } from './mapFactory'
import { buildRoomFromDraft } from './drawingFactory'

/**
 * GIRAR SALA, lado do ARQUIVO. `RoomMeta.rotation` é campo novo: a sala de
 * mapa salvo antes dele abre igual (sem o campo, que é "nunca girada"), a sala
 * girada volta girada do disco, e lixo no campo sai em vez de virar ângulo.
 */

/** Uma sala em JSON, como o arquivo guarda — `room` com ou sem o campo novo. */
function mapaComSala(room: Record<string, unknown>): string {
  return JSON.stringify({
    id: 'map_girar',
    regions: [
      {
        id: 'sala',
        points: [{ x: 0, y: 0 }, { x: 128, y: 0 }, { x: 128, y: 384 }, { x: 0, y: 384 }],
        tag: '',
        fillColor: '#a8776a',
        fillPattern: 'solid',
        data: {},
        room,
      },
    ],
  })
}

describe('mapFile — o ângulo da sala girada', () => {
  it('sala salva antes do campo existir: abre sem ele, e regravar não inventa "rotation"', () => {
    const map = deserializeMap(mapaComSala({ shape: 'rect', name: 'Cripta' }))
    expect(map.regions[0].room).toEqual({ shape: 'rect', name: 'Cripta' })
    expect(serializeMap(map)).not.toContain('rotation')
  })

  it('sala girada: o ângulo volta do disco como foi gravado', () => {
    const map = deserializeMap(mapaComSala({ shape: 'rect', name: 'Cripta', rotation: -37.5 }))
    expect(map.regions[0].room?.rotation).toBe(-37.5)
  })

  it('valor que não é número finito sai do campo — e a sala continua abrindo inteira', () => {
    for (const lixo of ['90', null, true, { graus: 90 }, 'NaN']) {
      const map = deserializeMap(mapaComSala({ shape: 'rect', name: 'Cripta', rotation: lixo }))
      expect(map.regions[0].room).toEqual({ shape: 'rect', name: 'Cripta' })
      expect(map.regions[0].points).toHaveLength(4)
    }
  })

  it('ida e volta por disco de uma sala girada preserva os pontos girados e o ângulo', () => {
    const { region, walls } = buildRoomFromDraft('sala', ['w0', 'w1', 'w2', 'w3'], { x: 576, y: 256 }, { x: 704, y: 640 })
    const girado = rotateRegion(addRoom(createEmptyMap('m', 'M', 30, 20, 64), region, walls), 'sala', 37)
    expect(deserializeMap(serializeMap(girado))).toEqual(girado)
  })
})
