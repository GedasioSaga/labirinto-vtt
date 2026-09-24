import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, encodeExploration } from '../lib/exploration'
import type { HostMessage } from './protocol'
import { createPlayerScreens } from './playerScreens'

function snapshot(rev: number, mapId: string): HostMessage {
  const map = createEmptyMap(mapId, mapId, 10, 10, 50)
  return { type: 'snapshot', rev, map, vision: [], explored: encodeExploration(createExploration(map)), ownTokens: ['t1'], concealed: [] }
}

describe('net/playerScreens: a tela de cada jogador é o último recorte que saiu para ele', () => {
  it('sem nada recebido não há tela', () => {
    expect(createPlayerScreens().get('c1')).toBeNull()
  })

  it('o snapshot vira a tela, com mapa, visão e fichas do jogador tal como saíram', () => {
    const screens = createPlayerScreens()
    const msg = snapshot(3, 'salao')
    expect(screens.record('c1', msg)).toBe(true)
    const tela = screens.get('c1')
    if (tela?.kind !== 'map' || msg.type !== 'snapshot') throw new Error('deveria haver mapa na tela')
    expect(tela.map).toBe(msg.map)
    expect(tela.ownTokens).toEqual(['t1'])
    expect(screens.get('c2')).toBeNull()
  })

  it('snapshot com rev antigo não troca a tela (o jogador também o descarta)', () => {
    const screens = createPlayerScreens()
    screens.record('c1', snapshot(5, 'cripta'))
    expect(screens.record('c1', snapshot(4, 'salao'))).toBe(false)
    const tela = screens.get('c1')
    expect(tela?.kind === 'map' ? tela.map.id : null).toBe('cripta')
  })

  it('lobby.waiting apaga o mapa; kicked e room.closed encerram a tela; sinal e laser não mexem', () => {
    const screens = createPlayerScreens()
    screens.record('c1', snapshot(1, 'salao'))
    expect(screens.record('c1', { type: 'signal', x: 1, y: 1, from: 'Bruno', color: '#fff' })).toBe(false)
    expect(screens.record('c1', { type: 'laser', off: true })).toBe(false)
    expect(screens.get('c1')?.kind).toBe('map')
    expect(screens.record('c1', { type: 'lobby.waiting' })).toBe(true)
    expect(screens.get('c1')).toEqual({ kind: 'waiting' })
    expect(screens.record('c1', { type: 'lobby.waiting' })).toBe(false)
    expect(screens.record('c1', { type: 'kicked' })).toBe(true)
    expect(screens.get('c1')).toBeNull()
    screens.record('c2', snapshot(9, 'salao'))
    screens.record('c2', { type: 'room.closed' })
    expect(screens.get('c2')).toBeNull()
  })

  it('forget e clear somem com a tela', () => {
    const screens = createPlayerScreens()
    screens.record('c1', snapshot(1, 'a'))
    screens.record('c2', snapshot(2, 'b'))
    expect(screens.forget('c1')).toBe(true)
    expect(screens.get('c1')).toBeNull()
    expect(screens.clear()).toBe(true)
    expect(screens.get('c2')).toBeNull()
    expect(screens.clear()).toBe(false)
  })
})
