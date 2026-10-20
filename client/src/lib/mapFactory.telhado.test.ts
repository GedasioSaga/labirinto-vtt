import { describe, expect, it } from 'vitest'
import type { MapData, Region } from '../types/map'
import { createEmptyMap, setRoomRoofStyle } from './mapFactory'

function regiao(id: string, room?: Region['room']): Region {
  return { id, points: [], tag: '', fillColor: '#123', fillPattern: 'solid', data: {}, ...(room ? { room } : {}) }
}

function mapa(regions: Region[]): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 50), regions }
}

const casa = (extra: Partial<NonNullable<Region['room']>> = {}) => regiao('casa', { shape: 'rect', name: 'Casa', roof: true, ...extra })

describe('setRoomRoofStyle — modelo e cor do telhado da Sala', () => {
  it('madeira grava o modelo; a cor de antes (da paleta das telhas) não vai junto', () => {
    const antes = mapa([casa({ corDoTeto: '#656b72' })])
    const depois = setRoomRoofStyle(antes, 'casa', { modelo: 'madeira' })
    expect(depois.regions[0].room?.modeloDoTeto).toBe('madeira')
    expect(depois.regions[0].room !== undefined && 'corDoTeto' in depois.regions[0].room).toBe(false)
    expect(antes.regions[0].room?.modeloDoTeto).toBe(undefined)
  })

  it('cor livre continua ao trocar de modelo', () => {
    const depois = setRoomRoofStyle(mapa([casa({ corDoTeto: '#123456' })]), 'casa', { modelo: 'madeira' })
    expect(depois.regions[0].room?.corDoTeto).toBe('#123456')
  })

  it('cor da paleta grava minúscula; null tira o campo (volta à padrão do modelo)', () => {
    const comCor = setRoomRoofStyle(mapa([casa({ modeloDoTeto: 'madeira' })]), 'casa', { cor: '#4D5F4F' })
    expect(comCor.regions[0].room?.corDoTeto).toBe('#4d5f4f')
    const semCor = setRoomRoofStyle(comCor, 'casa', { cor: null })
    expect(semCor.regions[0].room?.modeloDoTeto).toBe('madeira')
    expect(semCor.regions[0].room !== undefined && 'corDoTeto' in semCor.regions[0].room).toBe(false)
  })

  it('voltar a telhas tira o modelo do arquivo (undefined === telhas); a cor padrão não é gravada', () => {
    const depois = setRoomRoofStyle(mapa([casa({ modeloDoTeto: 'madeira' })]), 'casa', { modelo: 'telhas' })
    expect(depois.regions[0].room !== undefined && 'modeloDoTeto' in depois.regions[0].room).toBe(false)
    const barro = setRoomRoofStyle(mapa([casa({ corDoTeto: '#656b72' })]), 'casa', { cor: '#8a5a46' })
    expect(barro.regions[0].room !== undefined && 'corDoTeto' in barro.regions[0].room).toBe(false)
  })

  it('nada diferente na tela, região comum, id inexistente ou cor inválida: devolve o MESMO mapa', () => {
    const antes = mapa([casa(), regiao('area')])
    expect(setRoomRoofStyle(antes, 'casa', { modelo: 'telhas' })).toBe(antes)
    expect(setRoomRoofStyle(antes, 'casa', { cor: '#8a5a46' })).toBe(antes)
    expect(setRoomRoofStyle(antes, 'casa', { cor: null })).toBe(antes)
    expect(setRoomRoofStyle(antes, 'casa', { cor: 'vermelho' })).toBe(antes)
    expect(setRoomRoofStyle(antes, 'area', { modelo: 'madeira' })).toBe(antes)
    expect(setRoomRoofStyle(antes, 'sumiu', { modelo: 'madeira' })).toBe(antes)
  })
})
