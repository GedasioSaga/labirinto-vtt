import { describe, expect, it } from 'vitest'
import type { MapData, Wall } from '../types/map'
import { addDoorOnWall, addWall, createEmptyMap, definirMaterialDaParede } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * PAREDE COM TEXTURA (`Wall.material`, pedido de 07/11/2026): o campo passa pelo
 * arquivo (só o do catálogo), e a escolha leva junto os pedaços da parede partida
 * por porta, sem gastar entrada de Ctrl+Z quando não muda nada.
 */

function parede(id: string, extra: Partial<Wall> = {}): Wall {
  return { id, x1: 0, y1: 0, x2: 256, y2: 0, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function mapaCom(...walls: Wall[]): MapData {
  return walls.reduce((map, w) => addWall(map, w), createEmptyMap('m', 'Teste', 1024, 1024, 64))
}

describe('material da parede', () => {
  it('passa pelo arquivo: o do catálogo volta, o desconhecido sai e o mapa antigo continua só linhas', () => {
    const torta = { ...parede('neon', { y1: 64, y2: 64 }), material: 'neon' } as unknown as Wall
    const lido = deserializeMap(serializeMap(mapaCom(parede('castelo', { material: 'castelo' }), torta, parede('antiga', { y1: 128, y2: 128 }))))
    const porId = new Map(lido.walls.map((w) => [w.id, w]))
    expect(porId.get('castelo')?.material).toBe('castelo')
    expect(porId.get('neon')).toBeDefined()
    expect(porId.get('neon')).not.toHaveProperty('material')
    expect(porId.get('antiga')).not.toHaveProperty('material')
  })

  it('leva os pedaços da parede partida por porta; repetir não muda o mapa; Só linhas tira o campo', () => {
    const comPorta = addDoorOnWall(mapaCom(parede('w')), 'w', { x: 128, y: 0 }, 32, 'normal')
    expect(comPorta.walls.length).toBe(3)
    const umPedaco = comPorta.walls.find((w) => w.door === null)
    if (umPedaco === undefined) throw new Error('a porta não partiu a parede')
    const ferro = definirMaterialDaParede(comPorta, umPedaco.id, 'ferro')
    expect(ferro.walls.map((w) => w.material)).toEqual(['ferro', 'ferro', 'ferro'])
    // O mesmo material de novo devolve o MESMO mapa: o store não grava entrada de Ctrl+Z.
    expect(definirMaterialDaParede(ferro, umPedaco.id, 'ferro')).toBe(ferro)
    const linhas = definirMaterialDaParede(ferro, umPedaco.id, null)
    for (const w of linhas.walls) expect(w).not.toHaveProperty('material')
  })
})
