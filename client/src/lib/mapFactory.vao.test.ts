// VÃO ABERTO na parede da sala — nem parede, nem porta.
//
// O que `addOpeningOnWall` (mapFactory.ts) promete, e é o que estes testes
// cobram:
//  1. o trecho clicado deixa de existir como `Wall` — não vira entidade nova,
//     não vira porta aberta: some. É por isso que nenhum renderer precisa
//     saber do vão (onde não há parede, nada é desenhado);
//  2. o resto da aresta CONTINUA parede: abrir o vão num ponto não fura o lado
//     inteiro da sala;
//  3. a colisão acompanha os dois: o token atravessa pelo vão e continua
//     barrado no trecho que sobrou (`lib/collision.ts`, a mesma função que o
//     editor e o host usam);
//  4. o vínculo com a Sala (`regionId`/`regionEdgeIndex`) sobrevive nos
//     pedaços — mover ou redimensionar a Sala leva o vão junto, como já
//     acontece com os pedaços de porta (`lib/roomLink.ts`).
import { describe, expect, it } from 'vitest'
import { addOpeningOnWall, addDoorOnWall, addRoom, createEmptyMap } from './mapFactory'
import { buildRoomFromDraft } from './drawingFactory'
import { findTokenPath } from './collision'
import type { MapData, Wall } from '../types/map'

const SALA = 'sala'
/** Aresta 0 da Sala retangular: de (0,0) a (512,0) — `buildRoomFromDraft`
 *  numera topo, direita, baixo, esquerda. Nela, a distância ao longo da
 *  aresta É o x. */
const ARESTA = 0
const ARESTA_COMPRIMENTO = 512
const GRADE = 64
/** Comprimento do vão que o store passa: uma célula da grade (mapStore.ts,
 *  `addOpeningOnWall` → `map.grid`). Copiado aqui pelo mesmo motivo que
 *  `VAO` em `mapFactory.porta-tipo.test.ts`: teste de lib não importa a store. */
const VAO = GRADE

function salaVazia(): MapData {
  const { region, walls } = buildRoomFromDraft(SALA, ['e0', 'e1', 'e2', 'e3'], { x: 0, y: 0 }, { x: ARESTA_COMPRIMENTO, y: 320 })
  return addRoom(createEmptyMap('m_vao', 'Vão aberto', 30, 20, GRADE), region, walls)
}

function pedacosDaAresta(map: MapData): Wall[] {
  return map.walls.filter((w) => w.regionId === SALA && w.regionEdgeIndex === ARESTA).sort((a, b) => a.x1 - b.x1)
}

/** `true` quando o token consegue ir de `de` a `para` pelo mapa. */
function passa(map: MapData, de: { x: number; y: number }, para: { x: number; y: number }): boolean {
  return findTokenPath(de, para, map.walls, GRADE) !== null
}

describe('addOpeningOnWall — o vão é ausência de parede', () => {
  it('parte a aresta em dois pedaços e some com o trecho clicado', () => {
    const map = addOpeningOnWall(salaVazia(), 'e0', { x: 256, y: 0 }, VAO)

    const pedacos = pedacosDaAresta(map)
    expect(pedacos).toHaveLength(2)
    expect(pedacos.map((p) => [p.x1, p.x2])).toEqual([
      [0, 224],
      [288, 512],
    ])
    // Nenhum pedaço no lugar do vão — nem parede, nem porta aberta.
    expect(pedacos.every((p) => p.door === null)).toBe(true)
  })

  it('os pedaços que sobram continuam vinculados à mesma aresta da Sala', () => {
    const map = addOpeningOnWall(salaVazia(), 'e0', { x: 256, y: 0 }, VAO)

    for (const pedaco of pedacosDaAresta(map)) {
      expect(pedaco.regionId).toBe(SALA)
      expect(pedaco.regionEdgeIndex).toBe(ARESTA)
      // Colinear com a original: mesma linha y=0, herdada por construção.
      expect(pedaco.y1).toBe(0)
      expect(pedaco.y2).toBe(0)
    }
  })

  it('o token atravessa pelo vão e continua barrado no trecho que ainda tem parede', () => {
    const map = addOpeningOnWall(salaVazia(), 'e0', { x: 256, y: 0 }, VAO)

    // Pelo vão (x=256): de dentro (y=32) para fora (y=-32).
    expect(passa(map, { x: 256, y: 32 }, { x: 256, y: -32 })).toBe(true)
    // Pelo trecho sólido (x=128), o mesmo movimento: barrado.
    expect(passa(map, { x: 128, y: 32 }, { x: 128, y: -32 })).toBe(false)
    // E a aresta oposta da sala (y=320) segue inteira.
    expect(passa(map, { x: 256, y: 288 }, { x: 256, y: 352 })).toBe(false)
  })

  it('antes de abrir o vão o mesmo movimento é barrado — a prova acima não é vácuo', () => {
    expect(passa(salaVazia(), { x: 256, y: 32 }, { x: 256, y: -32 })).toBe(false)
  })

  it('clique colado na ponta deixa só o pedaço do outro lado', () => {
    const map = addOpeningOnWall(salaVazia(), 'e0', { x: 4, y: 0 }, VAO)

    const pedacos = pedacosDaAresta(map)
    expect(pedacos).toHaveLength(1)
    expect([pedacos[0].x1, pedacos[0].x2]).toEqual([36, 512])
  })

  it('vão maior que a parede abre o lado inteiro: a parede desaparece', () => {
    const map = addOpeningOnWall(salaVazia(), 'e0', { x: 256, y: 0 }, ARESTA_COMPRIMENTO * 2)

    expect(pedacosDaAresta(map)).toHaveLength(0)
    // A sala continua de pé: as outras três arestas não foram tocadas.
    expect(map.walls).toHaveLength(3)
  })

  it('abrir o vão em cima de uma porta troca a porta pelo buraco', () => {
    const comPorta = addDoorOnWall(salaVazia(), 'e0', { x: 256, y: 0 }, 32, 'normal')
    const porta = pedacosDaAresta(comPorta).find((p) => p.door !== null)
    expect(porta).toBeDefined()
    if (!porta) return

    const map = addOpeningOnWall(comPorta, porta.id, { x: 256, y: 0 }, VAO)

    expect(pedacosDaAresta(map).some((p) => p.door !== null)).toBe(false)
    // Porta fechada barrava; o vão no lugar dela deixa passar.
    expect(passa(comPorta, { x: 256, y: 32 }, { x: 256, y: -32 })).toBe(false)
    expect(passa(map, { x: 256, y: 32 }, { x: 256, y: -32 })).toBe(true)
  })

  it('parede inexistente devolve o MESMO mapa, sem cópia', () => {
    const map = salaVazia()
    expect(addOpeningOnWall(map, 'nao-existe', { x: 0, y: 0 }, VAO)).toBe(map)
  })
})
