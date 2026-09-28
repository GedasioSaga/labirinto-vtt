import { describe, expect, it } from 'vitest'
import type { MapData } from '../types/map'
import { createEmptyMap, moveFloorPiece } from './mapFactory'
import { buildFloorPiece } from './floorTool'
import { corDaCamada, linhasDeCamada, nomeDaCamadaDaPeca, pecaNaCamada } from './camadasDoChao'

/**
 * Pedido de 28/09/2026: travar o chão para ele não mudar de lugar, e pintar o
 * chão por camada ("um chão é mar e outro é chão normal").
 */

const retangulo = (id: string, op: 'add' | 'subtract' = 'add') =>
  buildFloorPiece(id, { kind: 'rect', cx: 100, cy: 100, w: 100, h: 100 }, op)

const mapa = (...ids: string[]): MapData => ({ ...createEmptyMap('m', 'M', 10, 10, 50), floor: ids.map((id) => retangulo(id)) })

describe('chão travado', () => {
  it('peça travada não se move; destravada volta a se mover', () => {
    const travado = { ...mapa('a'), floor: [{ ...retangulo('a'), locked: true }] }
    expect(moveFloorPiece(travado, 'a', 50, 50)).toBe(travado)
    const solto = { ...travado, floor: [{ ...travado.floor[0], locked: undefined }] }
    const movido = moveFloorPiece(solto, 'a', 50, 50)
    expect(movido.floor[0].shape).toMatchObject({ cx: 150, cy: 150 })
  })
})

describe('chão por camada', () => {
  it('camada Chão não põe cor; Mar pinta a peça de azul', () => {
    expect(pecaNaCamada(retangulo('a'), 'chao').fillColor).toBeUndefined()
    expect(pecaNaCamada(retangulo('a'), 'mar').fillColor).toBe(corDaCamada('mar'))
  })

  it('buraco nunca ganha cor', () => {
    expect(pecaNaCamada(retangulo('b', 'subtract'), 'mar').fillColor).toBeUndefined()
  })

  it('o nome vem da cor da peça', () => {
    expect(nomeDaCamadaDaPeca(retangulo('a'))).toBe('Chão')
    expect(nomeDaCamadaDaPeca(pecaNaCamada(retangulo('a'), 'mar'))).toBe('Mar')
    expect(nomeDaCamadaDaPeca({ ...retangulo('a'), fillColor: '#123456' })).toBe('Cor própria')
    expect(nomeDaCamadaDaPeca(retangulo('b', 'subtract'))).toBe('Buraco')
  })

  it('a lista vem de cima para baixo e numera peças da mesma camada', () => {
    const floor = [pecaNaCamada(retangulo('mar1'), 'mar'), retangulo('chao'), { ...pecaNaCamada(retangulo('mar2'), 'mar'), locked: true }]
    const linhas = linhasDeCamada(floor, '#ddccaa')
    expect(linhas.map((l) => [l.id, l.nome, l.index, l.locked])).toEqual([
      ['mar2', 'Mar 2', 2, true],
      ['chao', 'Chão', 1, false],
      ['mar1', 'Mar', 0, false],
    ])
    expect(linhas[1].cor).toBe('#ddccaa')
  })
})
