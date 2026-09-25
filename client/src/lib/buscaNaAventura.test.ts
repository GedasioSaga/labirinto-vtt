import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { MapData, Region } from '../types/map'
import { ADVENTURE_SEARCH_LIMIT, searchAdventure, type SceneSearchSource } from './buscaNaAventura'

/**
 * BUSCA DO MESTRE nas OUTRAS cenas da aventura: sala, pino e ficha pelo nome,
 * sem diferença de acento nem de maiúscula, cada achado com o caminho de onde
 * ele mora — a cena (com as pastas de fora) e as salas que o contêm, da mais
 * de fora para a mais de dentro.
 */

function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number, parentId?: string): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#1e8c8c',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
    ...(parentId === undefined ? {} : { parentId }),
  }
}

const BLOCOS: MapData = {
  ...createEmptyMap('map_blocos', 'Blocos', 60, 60, 50),
  regions: [
    sala('r-bloco-b', 'Bloco B', 0, 0, 2000, 2000),
    sala('r-escada', 'Escada de Incêndio Oeste · B12', 100, 100, 300, 500, 'r-bloco-b'),
    sala('r-cozinha-b', 'Cozinha', 400, 100, 800, 500, 'r-bloco-b'),
  ],
  pins: [{ id: 'p-posta', x: 900, y: 900, kind: 'viagem', description: 'Posta do elevador', image: null, destino: null }],
  tokens: [{ id: 'k-vigia', characterId: null, name: 'Vigia Noturno', x: 1025, y: 1025, size: 1, image: null }],
}

const CASA: MapData = {
  ...createEmptyMap('map_casa', 'Casa', 30, 30, 50),
  regions: [sala('r-casa', 'Casa da Viúva Benedita', 0, 0, 1000, 1000), sala('r-cozinha-v', 'Cozinha', 100, 100, 400, 400, 'r-casa')],
}

const FONTES: SceneSearchSource[] = [
  { sceneId: 's-blocos', path: ['Andar 9', 'Blocos'], map: BLOCOS },
  { sceneId: 's-casa', path: ['Bateria Baixa'], map: CASA },
]

describe('searchAdventure', () => {
  it('acha a sala de outra cena sem acento nem maiúscula, com o caminho da cena e das salas de fora', () => {
    const { hits, total } = searchAdventure(FONTES, 'escada incendio')
    expect(total).toBe(1)
    expect(hits).toHaveLength(1)
    const [hit] = hits
    expect(hit.sceneId).toBe('s-blocos')
    expect(hit.kind).toBe('room')
    expect(hit.objectKey).toBe('room:r-escada')
    expect(hit.name).toBe('Escada de Incêndio Oeste · B12')
    expect(hit.path).toBe('Andar 9 › Blocos › Bloco B')
    // O "Ir lá" centra no meio da sala e precisa da caixa inteira na tela.
    expect(hit.focus).toEqual({ x: 200, y: 300 })
    expect(hit.bounds).toEqual({ minX: 100, minY: 100, maxX: 300, maxY: 500 })
  })

  it('acha pino e ficha pelo nome, com o caminho da cena', () => {
    const pino = searchAdventure(FONTES, 'POSTA').hits
    expect(pino.map((h) => [h.kind, h.objectKey, h.name, h.path, h.travel])).toEqual([['pin', 'pin:p-posta', 'Posta do elevador', 'Andar 9 › Blocos', true]])
    const ficha = searchAdventure(FONTES, 'vigia').hits
    expect(ficha.map((h) => [h.kind, h.objectKey, h.name, h.path])).toEqual([['token', 'token:k-vigia', 'Vigia Noturno', 'Andar 9 › Blocos']])
  })

  it('duas "Cozinha": as duas aparecem, cada uma com o próprio caminho; o caminho desempata a busca', () => {
    const todas = searchAdventure(FONTES, 'cozinha').hits
    expect(todas.map((h) => h.path).sort()).toEqual(['Andar 9 › Blocos › Bloco B', 'Bateria Baixa › Casa da Viúva Benedita'])
    const daViuva = searchAdventure(FONTES, 'cozinha viuva').hits
    expect(daViuva.map((h) => h.objectKey)).toEqual(['room:r-cozinha-v'])
  })

  it('o caminho sozinho não basta: "bloco" acha a sala Bloco B, não tudo o que mora nela', () => {
    const { hits } = searchAdventure(FONTES, 'bloco')
    expect(hits.map((h) => h.objectKey)).toEqual(['room:r-bloco-b'])
  })

  it('busca vazia ou só de espaços não acha nada: a lista de fora só aparece com algo digitado', () => {
    expect(searchAdventure(FONTES, '')).toEqual({ hits: [], total: 0 })
    expect(searchAdventure(FONTES, '   ')).toEqual({ hits: [], total: 0 })
    expect(searchAdventure([], 'cozinha')).toEqual({ hits: [], total: 0 })
  })

  it('muitos achados: devolve só os primeiros, e o total diz quantos há', () => {
    const muitas: MapData = {
      ...createEmptyMap('map_celas', 'Celas', 200, 10, 50),
      regions: Array.from({ length: ADVENTURE_SEARCH_LIMIT + 7 }, (_, i) => sala(`r-cela-${i}`, `Cela ${i + 1}`, i * 60, 0, i * 60 + 50, 50)),
    }
    const { hits, total } = searchAdventure([{ sceneId: 's-celas', path: ['Celas'], map: muitas }], 'cela')
    expect(total).toBe(ADVENTURE_SEARCH_LIMIT + 7)
    expect(hits).toHaveLength(ADVENTURE_SEARCH_LIMIT)
    // Ordem natural dos números: "Cela 2" antes de "Cela 10".
    expect(hits.slice(0, 3).map((h) => h.name)).toEqual(['Cela 1', 'Cela 2', 'Cela 3'])
  })

  it('quem começa com o que foi digitado vem antes de quem só contém', () => {
    const mapa: MapData = {
      ...createEmptyMap('map_x', 'X', 30, 30, 50),
      regions: [sala('r-a', 'Antiga Cripta', 0, 0, 100, 100), sala('r-b', 'Cripta', 200, 0, 300, 100)],
    }
    const { hits } = searchAdventure([{ sceneId: 's-x', path: ['X'], map: mapa }], 'cripta')
    expect(hits.map((h) => h.name)).toEqual(['Cripta', 'Antiga Cripta'])
  })
})
