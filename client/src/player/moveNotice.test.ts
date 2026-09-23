import { describe, expect, it } from 'vitest'
import { latestActionNotice, moveNoticeText } from './moveNotice'

describe('recusa do movimento em uma linha', () => {
  it('diz o motivo com as frases do aceite', () => {
    expect(moveNoticeText('wall')).toBe('Parede no caminho')
    expect(moveNoticeText('outside_floor')).toBe('Fora do chão')
    expect(moveNoticeText('not_owner')).toBe('Essa ficha não é sua')
  })

  it('todo motivo do host tem frase', () => {
    for (const reason of ['unknown_token', 'not_owner', 'locked', 'outside_map', 'wall', 'outside_floor'] as const) {
      expect(moveNoticeText(reason).length).toBeGreaterThan(0)
    }
  })

  it('porta e movimento dividem o mesmo lugar na tela: vale o aviso mais novo', () => {
    expect(latestActionNotice(undefined, undefined)).toBeNull()
    expect(latestActionNotice({ id: 3, reason: 'locked' }, undefined)).toEqual({ id: 3, text: 'Trancada' })
    expect(latestActionNotice(undefined, { id: 4, reason: 'wall' })).toEqual({ id: 4, text: 'Parede no caminho' })
    expect(latestActionNotice({ id: 5, reason: 'far' }, { id: 4, reason: 'wall' })).toEqual({ id: 5, text: 'Chegue mais perto da porta' })
    expect(latestActionNotice({ id: 5, reason: 'far' }, { id: 6, reason: 'wall' })).toEqual({ id: 6, text: 'Parede no caminho' })
  })
})
