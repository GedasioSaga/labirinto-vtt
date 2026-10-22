/**
 * DA FICHA AO MOTOR — o que a cena entrega ao caminhamento: as paredes do
 * piso da ficha, o raio dela e as outras fichas do mesmo piso.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, Wall } from '../../types/map'
import { createEmptyMap } from '../mapFactory'
import { caminhoAgora, CacheDeMalhas } from './agenda'
import { entradaDaFicha, raioDaFicha } from './daFicha'

function wall(id: string, x1: number, y1: number, x2: number, y2: number, piso?: number): Wall {
  const base: Wall = { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
  return piso === undefined ? base : { ...base, piso }
}

function token(id: string, x: number, y: number, size: number, piso?: number): Token {
  const base: Token = { id, characterId: null, name: id, x, y, size, image: null }
  return piso === undefined ? base : { ...base, piso }
}

describe('entradaDaFicha', () => {
  it('ficha no primeiro andar: só as paredes e as fichas dele, sem ela mesma', () => {
    const map: MapData = {
      ...createEmptyMap('m', 'M', 20, 10, 64),
      walls: [wall('terreo', 320, 0, 320, 640), wall('alto', 640, 0, 640, 640, 1)],
      tokens: [token('npc', 96, 96, 1, 1), token('vizinho', 480, 96, 2, 1), token('embaixo', 160, 96, 1)],
    }
    const entrada = entradaDaFicha(map, 'npc')
    expect(entrada?.mapa.walls.map((w) => w.id)).toEqual(['alto'])
    expect(entrada?.raio).toBe(32)
    expect(entrada?.fichas).toEqual([{ id: 'vizinho', x: 480, y: 96, raio: 64 }])
  })

  it('mapa sem pisos, sem paredes, sem outras fichas e tamanho inválido: térreo, raio padrão, caminho reto', () => {
    const map: MapData = { ...createEmptyMap('m', 'M', 10, 10, 64), tokens: [token('so', 96, 96, Number.NaN)] }
    const entrada = entradaDaFicha(map, 'so')
    expect(entrada).not.toBeNull()
    if (entrada === null) return
    expect(entrada.mapa.walls).toEqual([])
    expect(entrada.fichas).toEqual([])
    expect(entrada.raio).toBe(raioDaFicha({ size: 1 }, 64))
    const r = caminhoAgora(new CacheDeMalhas(), entrada.mapa, entrada.raio, { de: { x: 96, y: 96 }, para: { x: 544, y: 544 }, fichas: entrada.fichas })
    expect(r).toEqual({ tipo: 'caminho', pontos: [{ x: 96, y: 96 }, { x: 544, y: 544 }], comprimento: Math.hypot(448, 448), portas: 0 })
  })

  it('ficha que não está no mapa: null', () => {
    expect(entradaDaFicha(createEmptyMap('m', 'M', 10, 10, 64), 'ninguem')).toBeNull()
  })
})
