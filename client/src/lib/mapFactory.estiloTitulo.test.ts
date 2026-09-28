import { describe, expect, it } from 'vitest'
import type { MapData, Region } from '../types/map'
import { createEmptyMap, setRoomLabelStyle } from './mapFactory'

function regiao(id: string, room?: Region['room']): Region {
  return { id, points: [], tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, ...(room ? { room } : {}) }
}

function mapa(regions: Region[]): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 50), regions }
}

describe('setRoomLabelStyle — estilo do título da Sala', () => {
  it('grava só o eixo mexido, sem tocar o mapa de entrada', () => {
    const antes = mapa([regiao('ancora', { shape: 'rect', name: 'Âncora' })])
    const depois = setRoomLabelStyle(antes, 'ancora', { plate: false, color: '#FF0000' })
    expect(depois.regions[0].room).toMatchObject({ name: 'Âncora', labelPlate: false, labelColor: '#ff0000' })
    expect(depois.regions[0].room?.labelScale).toBeUndefined()
    expect(antes.regions[0].room?.labelPlate).toBeUndefined()
  })

  it('voltar ao padrão apaga o campo', () => {
    const antes = mapa([regiao('ancora', { shape: 'rect', name: 'Âncora', labelVertical: true, labelScale: 0.5 })])
    const depois = setRoomLabelStyle(antes, 'ancora', { vertical: false, scale: 1 })
    const room = depois.regions[0].room
    expect(room !== undefined && 'labelVertical' in room).toBe(false)
    expect(room !== undefined && 'labelScale' in room).toBe(false)
  })

  it('nada muda, região comum ou id inexistente: devolve o MESMO mapa (sem desfazer vazio)', () => {
    const antes = mapa([regiao('ancora', { shape: 'rect', name: 'Âncora', labelPlate: false }), regiao('area')])
    expect(setRoomLabelStyle(antes, 'ancora', { plate: false })).toBe(antes)
    expect(setRoomLabelStyle(antes, 'ancora', { color: 'nada' })).toBe(antes)
    expect(setRoomLabelStyle(antes, 'area', { plate: false })).toBe(antes)
    expect(setRoomLabelStyle(antes, 'sumiu', { plate: false })).toBe(antes)
  })
})
