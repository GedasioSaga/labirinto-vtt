import { describe, expect, it } from 'vitest'
import type { MapData, Region, Token } from '../types/map'
import { createExploration, markAll } from './exploration'
import { filterFloorMemory, filterMapForGroup, filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * PISOS NA MESMA CENA em cima de DADOS INTERNOS DA SALA: o recorte por piso
 * (`mapaDoPiso`) roda antes de tudo, e a sala que ele entrega passa pelo
 * mesmo corte de `data`, `tag` e `locked` do térreo. Quem está no 1º piso
 * recebe a sala de lá como a tela desenha, sem o endereço nem o rótulo do
 * mestre — e nada da sala do térreo, nem os internos dela.
 */
const RADIUS = 700
const ENDERECO_TERREO = 'T00-SAGUAO'
const ENDERECO_PRIMEIRO = 'P01-BIBLIOTECA'
const ROTULO_PRIMEIRO = 'Armadilha-de-livros'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function regiao(id: string, extra: Partial<Region> = {}): Region {
  const points = [
    { x: 100, y: 100 },
    { x: 900, y: 100 },
    { x: 900, y: 900 },
    { x: 100, y: 900 },
  ]
  return { id, points, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, ...extra }
}

function sala(id: string, nome: string, extra: Partial<Region> = {}): Region {
  return regiao(id, { room: { shape: 'rect', name: nome }, ...extra })
}

/** Saguão (região comum) no térreo, biblioteca (sala) no 1º piso, no mesmo lugar do plano; Caio no 1º piso. */
function torre(): MapData {
  return {
    // Largura e altura em px de mundo: a memória explorada cobre as salas (100..900).
    ...createEmptyMap('torre', 'Torre', 1000, 1000, 40),
    regions: [
      regiao('saguao', { tag: 'Saguao-interno', data: { endereco: ENDERECO_TERREO }, locked: true }),
      sala('biblioteca', 'Biblioteca', { piso: 1, tag: ROTULO_PRIMEIRO, data: { endereco: ENDERECO_PRIMEIRO }, locked: true }),
    ],
    tokens: [ficha('caio', 500, 500, { piso: 1 })],
  }
}

describe('fogFilter — dados internos da sala no piso de cima', () => {
  it('Caio no 1º piso recebe a biblioteca sem data, tag nem locked; o saguão do térreo não chega', () => {
    const map = torre()
    const regioes = filterMapForPlayer(map, 'p1', { p1: ['caio'] }, RADIUS).map.regions
    expect(regioes.map((r) => r.id)).toEqual(['biblioteca'])
    const [biblioteca] = regioes
    expect(biblioteca?.room?.name).toBe('Biblioteca')
    expect(biblioteca?.data).toEqual({})
    expect(biblioteca?.tag).toBe('')
    expect(biblioteca !== undefined && 'locked' in biblioteca).toBe(false)
  })

  it('nenhum caminho do recorte do 1º piso carrega endereço ou rótulo de piso algum', () => {
    const map = torre()
    const exp = createExploration(map)
    markAll(exp)
    const recortes = [
      filterMapForPlayer(map, 'p1', { p1: ['caio'] }, RADIUS, exp).map,
      // TELA DA MESA: o grupo segue o piso do primeiro membro.
      filterMapForGroup(map, [{ tokenIds: ['caio'], visionRadius: RADIUS }]).map,
    ]
    for (const recorte of recortes) {
      expect(recorte.regions.map((r) => r.id)).toEqual(['biblioteca'])
      const pacote = JSON.stringify(recorte)
      expect(pacote).not.toContain(ENDERECO_PRIMEIRO)
      expect(pacote).not.toContain(ENDERECO_TERREO)
      expect(pacote).not.toContain(ROTULO_PRIMEIRO)
      expect(pacote).not.toContain('Saguao-interno')
      expect(pacote).not.toContain('"locked":true')
    }
  })

  it('memória do andar (ninguém olhando, lê o térreo): o saguão sai sem os internos e a biblioteca não sai', () => {
    const map = torre()
    const exp = createExploration(map)
    markAll(exp)
    const memoria = filterFloorMemory(map, exp, new Map()).map
    expect(memoria.regions.map((r) => r.id)).toEqual(['saguao'])
    expect(memoria.regions[0]?.tag).toBe('')
    expect(JSON.stringify(memoria)).not.toContain(ENDERECO_TERREO)
    expect(JSON.stringify(memoria)).not.toContain(ENDERECO_PRIMEIRO)
  })

  it('o mapa do mestre segue com os internos dos dois pisos', () => {
    const map = torre()
    filterMapForPlayer(map, 'p1', { p1: ['caio'] }, RADIUS)
    expect(map.regions.map((r) => r.data.endereco)).toEqual([ENDERECO_TERREO, ENDERECO_PRIMEIRO])
    expect(map.regions[1]?.tag).toBe(ROTULO_PRIMEIRO)
  })
})
