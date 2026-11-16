import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { lerCarimbos } from './carimbos'
import { comParedesDosCarimbos, trechosDosCarimbosQueTapam } from './carimbosQueBarram'
import { paredesDoNpc, paredesParaAndarDoJogador } from './obstaculosDeObjeto'
import { visionSegments } from './visibility'
import type { Carimbo, MapData } from '../types/map'

/**
 * CARIMBO QUE BARRA E QUE TAPA (Fase 2, 15/11/2026): as chaves só existem
 * ligadas; mapa sem nenhuma devolve as MESMAS listas de antes (o arquivo, o
 * recorte e a tela do jogador não mudam), e a ficha que já está no pé do
 * carimbo nunca fica presa.
 */

const pinheiro = (id: string, x: number, y: number, extra: Partial<Carimbo> = {}): Carimbo => ({ id, tipo: 'pinheiro', x, y, tamanho: 40, giro: 0, ...extra })

function mapa(carimbos: Carimbo[]): MapData {
  return { ...createEmptyMap('m-mata', 'Mata', 30, 30, 40), carimbos }
}

describe('carimbo sem as chaves', () => {
  it('não muda as paredes de andar, do NPC, nem a visão', () => {
    const m = mapa([pinheiro('c1', 200, 200)])
    expect(paredesParaAndarDoJogador(m.walls, m, 0, null)).toBe(m.walls)
    expect(paredesDoNpc(m.walls, m.props, m.grid, 0, { x: 0, y: 0 }, m.carimbos)).toBe(m.walls)
    expect(visionSegments(m)).toEqual(visionSegments({ ...m, carimbos: [] }))
  })

  it('o arquivo lido não ganha campo: só true vira chave', () => {
    const [lido] = lerCarimbos([{ id: 'c1', tipo: 'pinheiro', x: 1, y: 2, tamanho: 40, giro: 0, barra: false, tapaVisao: 'sim' }]) ?? []
    expect(lido).toBeDefined()
    expect(lido).not.toHaveProperty('barra')
    expect(lido).not.toHaveProperty('tapaVisao')
    expect(lerCarimbos([{ id: 'c1', tipo: 'pinheiro', x: 1, y: 2, tamanho: 40, giro: 0, barra: true, tapaVisao: true }])?.[0]).toMatchObject({ barra: true, tapaVisao: true })
  })
})

describe('Barra a passagem', () => {
  it('a pegada vira 4 paredes que seguram o jogador e o NPC; a mesma entrada, o mesmo array', () => {
    const m = mapa([pinheiro('c1', 200, 200, { barra: true }), pinheiro('c2', 600, 600)])
    const jogador = paredesParaAndarDoJogador(m.walls, m, 0, null)
    expect(jogador.length).toBe(m.walls.length + 4)
    expect(jogador.slice(-4).every((w) => w.blocksMove && !w.blocksLight)).toBe(true)
    expect(paredesParaAndarDoJogador(m.walls, m, 0, null)).toBe(jogador)
    expect(paredesDoNpc(m.walls, m.props, m.grid, 0, { x: 0, y: 0 }, m.carimbos).length).toBe(m.walls.length + 4)
  })

  it('a ficha que já está no pé do carimbo não fica presa', () => {
    const m = mapa([pinheiro('c1', 200, 200, { barra: true })])
    expect(comParedesDosCarimbos(m.walls, m.carimbos, 0, { x: 205, y: 195 })).toEqual(m.walls)
  })

  it('o escondido do jogador (do host) sai das paredes; a mesma escolha, o mesmo array', () => {
    const m = mapa([pinheiro('c1', 200, 200, { barra: true }), pinheiro('c2', 600, 600, { barra: true })])
    const escondeC1 = (c: Carimbo): boolean => c.id === 'c1'
    const semC1 = paredesParaAndarDoJogador(m.walls, m, 0, null, undefined, escondeC1)
    expect(semC1.length).toBe(m.walls.length + 4)
    expect(semC1.some((w) => w.id.startsWith('carimbo:c1:'))).toBe(false)
    expect(paredesParaAndarDoJogador(m.walls, m, 0, null, undefined, escondeC1)).toBe(semC1)
    expect(paredesParaAndarDoJogador(m.walls, m, 0, null, undefined, () => false)).toBe(paredesParaAndarDoJogador(m.walls, m, 0, null))
    expect(paredesParaAndarDoJogador(m.walls, m, 0, null, undefined, () => true)).toBe(m.walls)
  })

  it('o carimbo de outro piso não barra este', () => {
    const m = mapa([pinheiro('c1', 200, 200, { barra: true, piso: 1 })])
    expect(paredesParaAndarDoJogador(m.walls, m, 0, null)).toBe(m.walls)
  })
})

describe('Tapa a visão', () => {
  it('a pegada entra nos obstáculos do olhar, uma vez por lista', () => {
    const m = mapa([pinheiro('c1', 200, 200, { tapaVisao: true })])
    const trechos = trechosDosCarimbosQueTapam(m.carimbos)
    expect(trechos).toHaveLength(4)
    expect(trechosDosCarimbosQueTapam(m.carimbos)).toBe(trechos)
    expect(visionSegments(m).length).toBe(visionSegments({ ...m, carimbos: [] }).length + 4)
  })
})
