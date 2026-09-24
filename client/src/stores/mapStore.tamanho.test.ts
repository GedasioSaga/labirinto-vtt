import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import { createEmptyMap } from '../lib/mapFactory'
import { decodeExploration, isPointExplored, type Exploration } from '../lib/exploration'
import { createHostSession, type HostResult, type HostWorld } from '../net/hostSession'
import type { MapData, Token } from '../types/map'

const CODE = 'AB12CD'
const GRADE = 50
/** Canto da Mina que a Carla explora antes de andar para longe. */
const CANTO = { x: 150, y: 250 }
const LONGE = { x: 1300, y: 250 }

function ficha(x: number, y: number): Token {
  return { id: 'carla', characterId: null, name: 'Carla', x, y, size: 1, image: null }
}

function minaNoEditor(): MapData {
  return { ...createEmptyMap('mapa-mina', 'Mina Funda', 30, 10, GRADE), tokens: [ficha(CANTO.x, CANTO.y)] }
}

/** O que a ponte manda à sessão: a cena aberta é o mapa do editor, como está agora. */
function mundo(): HostWorld {
  return { open: { sceneId: 'cena-mina', name: 'Mina Funda', map: useMapStore.getState().map }, background: [] }
}

function exploradoDe(r: HostResult): Exploration {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot para a Carla')
  const exp = decodeExploration(msg.explored)
  if (exp === null) throw new Error('explorado ilegível')
  return exp
}

describe('mapStore setMapSize (Configurações do mapa > Tamanho)', () => {
  beforeEach(() => {
    useMapStore.setState({ map: minaNoEditor(), past: [], future: [] })
  })

  it('troca largura e altura e cria 1 entrada de undo; Ctrl+Z volta ao tamanho de antes', () => {
    useMapStore.getState().setMapSize(50, 12)
    expect(useMapStore.getState().map.width).toBe(50)
    expect(useMapStore.getState().map.height).toBe(12)
    expect(useMapStore.getState().past.length).toBe(1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.width).toBe(30)
    expect(useMapStore.getState().map.height).toBe(10)
  })

  it('o mesmo tamanho não cria entrada de undo', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().setMapSize(30, 10)
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past.length).toBe(0)
  })

  it('Mina +20 quadrados pela ação do editor: o jogador guarda o explorado no mesmo lugar e a faixa nova vem preta', () => {
    const s = createHostSession({ code: CODE, visionRadius: 300, now: () => 0, randomId: () => 'id-1' })
    const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Carla' }, mundo())
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, 'carla')
    s.broadcast(mundo())
    // A Carla anda para longe do canto: ele fica só na memória.
    useMapStore.setState({ map: { ...useMapStore.getState().map, tokens: [ficha(LONGE.x, LONGE.y)] } })
    s.broadcast(mundo())

    useMapStore.getState().setMapSize(50, 10)
    const exp = exploradoDe(s.broadcast(mundo()))

    expect(exp.cols * exp.cell).toBe(50 * GRADE)
    expect(isPointExplored(exp, CANTO)).toBe(true)
    expect(isPointExplored(exp, { x: 2200, y: 250 })).toBe(false)
  })
})
