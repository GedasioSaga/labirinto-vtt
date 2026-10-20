import { describe, expect, it } from 'vitest'
import type { MapData, Region } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * MODELO E COR DO TELHADO no DISCO: ausente continua ausente (mapa antigo abre
 * com telha barro), valor válido volta como foi salvo, e lixo de arquivo
 * editado à mão sai em vez de chegar ao desenho do jogador.
 */

function casa(room: Record<string, unknown>): Region {
  const base: Region = { id: 'casa', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], tag: '', fillColor: '#123', fillPattern: 'solid', data: {} }
  return { ...base, room: { shape: 'rect', name: 'Casa', roof: true, ...room } }
}

function mapa(regions: Region[]): MapData {
  return { ...createEmptyMap('m', 'M', 100, 100, 10), regions }
}

/** Simula o arquivo editado à mão: o valor torto entra no JSON sem passar pelo tipo. */
function doArquivo(room: Record<string, unknown>): MapData {
  const json = JSON.parse(serializeMap(mapa([casa({})])))
  json.regions[0].room = { ...json.regions[0].room, ...room }
  return deserializeMap(JSON.stringify(json))
}

describe('mapFile — modelo e cor do telhado', () => {
  it('ida e volta preserva madeira e a cor', () => {
    const volta = deserializeMap(serializeMap(mapa([casa({ modeloDoTeto: 'madeira', corDoTeto: '#4d5f4f' })])))
    expect(volta.regions[0].room?.modeloDoTeto).toBe('madeira')
    expect(volta.regions[0].room?.corDoTeto).toBe('#4d5f4f')
  })

  it('sala sem os campos abre sem os campos', () => {
    const volta = deserializeMap(serializeMap(mapa([casa({})])))
    const room = volta.regions[0].room
    expect(room?.roof).toBe(true)
    expect(room !== undefined && ('modeloDoTeto' in room || 'corDoTeto' in room)).toBe(false)
  })

  it('modelo desconhecido sai; a cor válida fica', () => {
    const room = doArquivo({ modeloDoTeto: 'palha', corDoTeto: '#4d5f4f' }).regions[0].room
    expect(room !== undefined && 'modeloDoTeto' in room).toBe(false)
    expect(room?.corDoTeto).toBe('#4d5f4f')
  })

  it('cor inválida (nome, #rgb, número, null) sai; o modelo válido fica', () => {
    for (const corDoTeto of ['vermelho', '#f00', 123, null]) {
      const room = doArquivo({ modeloDoTeto: 'madeira', corDoTeto }).regions[0].room
      expect(room?.modeloDoTeto).toBe('madeira')
      expect(room !== undefined && 'corDoTeto' in room).toBe(false)
    }
  })
})
