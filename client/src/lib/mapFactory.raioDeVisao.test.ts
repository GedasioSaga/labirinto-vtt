import { describe, expect, it } from 'vitest'
import type { MapData, Region } from '../types/map'
import { createEmptyMap, setRoomVisionRadius } from './mapFactory'

function regiao(id: string, room?: Region['room']): Region {
  return { id, points: [], tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, ...(room ? { room } : {}) }
}

function mapa(regions: Region[]): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 50), regions }
}

describe('setRoomVisionRadius — "Raio de visão aqui" da Sala', () => {
  it('grava o raio na Sala', () => {
    const antes = mapa([regiao('mirante', { shape: 'rect', name: 'Mirante' })])
    const depois = setRoomVisionRadius(antes, 'mirante', 1500)
    expect(depois.regions[0].room?.raioDeVisao).toBe(1500)
    expect(antes.regions[0].room?.raioDeVisao).toBe(undefined)
  })

  it('null tira o campo (a Sala volta ao raio do jogador), sem deixar a chave no arquivo', () => {
    const antes = mapa([regiao('mirante', { shape: 'rect', name: 'Mirante', raioDeVisao: 1500 })])
    const depois = setRoomVisionRadius(antes, 'mirante', null)
    expect(depois.regions[0].room?.name).toBe('Mirante')
    expect(depois.regions[0].room !== undefined && 'raioDeVisao' in depois.regions[0].room).toBe(false)
  })

  it('mesmo valor, região comum ou id inexistente: devolve o MESMO mapa (sem desfazer vazio)', () => {
    const antes = mapa([regiao('mirante', { shape: 'rect', name: 'Mirante', raioDeVisao: 1500 }), regiao('area')])
    expect(setRoomVisionRadius(antes, 'mirante', 1500)).toBe(antes)
    expect(setRoomVisionRadius(antes, 'area', 900)).toBe(antes)
    expect(setRoomVisionRadius(antes, 'sumiu', 900)).toBe(antes)
  })
})
