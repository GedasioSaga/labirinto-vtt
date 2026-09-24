import { beforeEach, describe, expect, it } from 'vitest'
import { DICE_FEED_MAX } from '../lib/dice'
import type { HostDiceRoll } from '../net/hostSession'
import { useDiceStore } from './diceStore'

const rolagem = (id: string): HostDiceRoll => ({ id, from: 'Ana', count: 1, sides: 6, modifier: 0, results: [3], total: 3, at: 0 })

describe('diceStore (tela do mestre)', () => {
  beforeEach(() => useDiceStore.getState().clear())

  it('guarda as rolagens na ordem em que chegam, só as últimas', () => {
    for (let i = 0; i < DICE_FEED_MAX + 2; i += 1) useDiceStore.getState().push(rolagem(`r${i}`))
    const rolls = useDiceStore.getState().rolls
    expect(rolls).toHaveLength(DICE_FEED_MAX)
    expect(rolls[0]?.id).toBe('r2')
  })

  it('sala fechada: some tudo', () => {
    useDiceStore.getState().push(rolagem('r1'))
    useDiceStore.getState().clear()
    expect(useDiceStore.getState().rolls).toEqual([])
  })
})
