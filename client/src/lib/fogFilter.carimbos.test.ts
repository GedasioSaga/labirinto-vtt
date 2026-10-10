/**
 * CARIMBOS no recorte do jogador: o mestre soltou objetos perto da ficha,
 * longe (na névoa), numa sala secreta e numa zona oculta. Sai só o de base no
 * que ele conhece; dos importados, só o que um objeto dele usa, sem o nome.
 */
import { describe, expect, it } from 'vitest'
import type { Carimbo, MapData, Region, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { filterMapForPlayer } from './fogFilter'

const RAIO = 300
const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }
const POSSE = { p1: ['ana'] }
const IMAGEM = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAA='

const objeto = (id: string, x: number, y: number, tipo = 'pinheiro'): Carimbo => ({ id, tipo, x, y, tamanho: 30, giro: 45 })

const SALA_SECRETA: Region = {
  id: 'cofre',
  tag: 'region',
  fillColor: '#444444',
  fillPattern: 'solid',
  data: {},
  secret: true,
  room: { shape: 'rect', name: 'Cofre' },
  points: [
    { x: 150, y: 150 },
    { x: 250, y: 150 },
    { x: 250, y: 250 },
    { x: 150, y: 250 },
  ],
}

function cena(): MapData {
  return {
    ...createEmptyMap('m-carimbo', 'Mundo', 40, 10, 50),
    tokens: [ANA],
    regions: [SALA_SECRETA],
    carimbosImportados: [
      { id: 'importado:farol', nome: 'Farol do mestre', imagem: IMAGEM },
      { id: 'importado:covil', nome: 'Covil do dragão', imagem: IMAGEM },
    ],
    carimbos: [objeto('perto', 130, 110, 'importado:farol'), objeto('arvore', 60, 140, 'arvore'), objeto('longe', 1800, 100, 'importado:covil'), objeto('no-cofre', 200, 200)],
  }
}

describe('Carimbos no recorte do jogador', () => {
  it('sai o objeto no conhecido; o da névoa e o da sala secreta não viajam, nem o importado que só eles usam', () => {
    const view = filterMapForPlayer(cena(), 'p1', POSSE, RAIO)
    expect(view.map.carimbos?.map((c) => c.id)).toEqual(['perto', 'arvore'])
    expect(view.map.carimbosImportados).toEqual([{ id: 'importado:farol', nome: 'Carimbo', imagem: IMAGEM }])
    const texto = JSON.stringify(view.map)
    expect(texto).not.toContain('Farol do mestre')
    expect(texto).not.toContain('Covil do dragão')
    expect(texto).not.toContain('importado:covil')
    expect(texto).not.toContain('no-cofre')
    expect(texto).not.toContain('1800')
  })

  it('zona oculta esconde o objeto debaixo dela, mesmo perto da ficha', () => {
    const comZona: MapData = {
      ...cena(),
      concealZones: [{ id: 'z', name: 'Mata', revealed: false, points: [{ x: 40, y: 120 }, { x: 90, y: 120 }, { x: 90, y: 170 }, { x: 40, y: 170 }] }],
    }
    const view = filterMapForPlayer(comZona, 'p1', POSSE, RAIO)
    expect(view.map.carimbos?.map((c) => c.id)).toEqual(['perto'])
  })

  it('nada conhecido: os campos não viajam (o mapa do mestre não escapa pelo recorte)', () => {
    const longe: MapData = { ...cena(), carimbos: [objeto('longe', 1800, 100, 'importado:covil')] }
    const view = filterMapForPlayer(longe, 'p1', POSSE, RAIO)
    expect(view.map.carimbos).toBeUndefined()
    expect(view.map.carimbosImportados).toBeUndefined()
  })
})
