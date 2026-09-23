/** Lasers dos jogadores na tela do mestre: só o da cena aberta é desenhado. */
import { beforeEach, describe, expect, it } from 'vitest'
import { LASER_TRAIL_MS } from '../lib/laser'
import { usePlayerLaserStore } from './playerLaserStore'

const lote = (onOpenScene: boolean) => ({ playerId: 'p1', name: 'Ana', color: '#3cff00', update: { points: [{ x: 10, y: 20 }] }, onOpenScene })

describe('playerLaserStore', () => {
  beforeEach(() => usePlayerLaserStore.getState().clear())

  it('lote da cena aberta vira rastro aceso, na cor e com o nome de quem aponta', () => {
    usePlayerLaserStore.getState().receive(lote(true), 0)
    expect(usePlayerLaserStore.getState().lasers).toEqual([
      { key: 'p1', label: 'Ana', color: '#3cff00', trail: { points: [{ x: 10, y: 20, t: 0 }], on: true }, lastAt: 0 },
    ])
  })

  it('lote de outra cena não desenha nada, e termina o rastro que havia (os pontos são de outro mapa)', () => {
    usePlayerLaserStore.getState().receive(lote(false), 0)
    expect(usePlayerLaserStore.getState().lasers).toEqual([])
    usePlayerLaserStore.getState().receive(lote(true), 0)
    usePlayerLaserStore.getState().receive(lote(false), 10)
    expect(usePlayerLaserStore.getState().lasers[0]?.trail.on).toBe(false)
  })

  it('prune tira quem já sumiu', () => {
    usePlayerLaserStore.getState().receive(lote(true), 0)
    usePlayerLaserStore.getState().receive({ ...lote(true), update: { off: true } }, 10)
    usePlayerLaserStore.getState().prune(LASER_TRAIL_MS + 20)
    expect(usePlayerLaserStore.getState().lasers).toEqual([])
  })
})
