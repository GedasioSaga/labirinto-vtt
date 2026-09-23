/**
 * RECADO PARA ESCOLHIDOS: com a vila numa cena só, o mestre precisa saber em
 * que SALA cada jogador está para mandar o recado só à taverna. A sala vem do
 * polígono das Salas do mapa da cena dele, da mais interna para a de fora.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { HostWorld } from '../net/hostSession'
import type { Region } from '../types/map'
import { peopleByScene, type PartyMember } from './party'

function sala(id: string, name: string, x1: number, y1: number, x2: number, y2: number, parentId?: string): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name },
    ...(parentId === undefined ? {} : { parentId }),
  }
}

const VILA: HostWorld = {
  open: {
    sceneId: 's-vila',
    name: 'Vila de Pedravel',
    map: {
      ...createEmptyMap('m-vila', 'Vila', 30, 20, 50),
      regions: [
        sala('taverna', 'Taverna', 0, 0, 400, 400),
        sala('casa', 'Casa do prefeito', 500, 0, 1000, 400),
        sala('quarto', 'Quarto do prefeito', 600, 100, 800, 300, 'casa'),
        // Região comum (sem `room`) não é sala: não entra na lista.
        { ...sala('praca', 'Praça', 0, 0, 1400, 1000), room: undefined },
      ],
    },
  },
  background: [{ sceneId: 's-mina', name: 'Mina', map: createEmptyMap('m-mina', 'Mina', 10, 10, 50) }],
}

function membro(playerId: string, x: number, y: number, sceneId = 's-vila'): PartyMember {
  return { playerId, name: playerId, connected: true, sceneId, sceneName: null, token: { id: `t-${playerId}`, color: '#3cff00', x, y }, travelPending: false }
}

function salasDe(byScene: ReturnType<typeof peopleByScene>, sceneId: string, playerId: string): string[] | undefined {
  return byScene
    .get(sceneId)
    ?.people.find((p) => p.playerId === playerId)
    ?.rooms?.map((r) => `${r.id}:${r.name}`)
}

describe('peopleByScene com o mundo: a sala de cada jogador', () => {
  const grupo = [membro('ana', 100, 100), membro('bruno', 700, 200), membro('elisa', 900, 50), membro('felipe', 450, 600), membro('gabi', 100, 100, 's-mina')]
  const byScene = peopleByScene(grupo, VILA)

  it('da mais interna para a de fora', () => {
    expect(salasDe(byScene, 's-vila', 'ana')).toEqual(['taverna:Taverna'])
    expect(salasDe(byScene, 's-vila', 'bruno')).toEqual(['quarto:Quarto do prefeito', 'casa:Casa do prefeito'])
    expect(salasDe(byScene, 's-vila', 'elisa')).toEqual(['casa:Casa do prefeito'])
  })

  it('fora de toda sala, ou na cena sem sala: lista vazia', () => {
    expect(salasDe(byScene, 's-vila', 'felipe')).toEqual([])
    // A Mina não tem sala: o mesmo ponto (100,100) da Taverna não vale lá.
    expect(salasDe(byScene, 's-mina', 'gabi')).toEqual([])
  })

  it('sem o mundo, nada de sala (o jeito de antes)', () => {
    expect(salasDe(peopleByScene(grupo), 's-vila', 'bruno')).toBeUndefined()
  })
})
