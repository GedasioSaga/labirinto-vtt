import { describe, expect, it } from 'vitest'
import { peopleByScene, pendingRequestsLabel, type PartyMember } from './party'

function membro(over: Partial<PartyMember>): PartyMember {
  return {
    playerId: 'p',
    name: 'X',
    connected: true,
    sceneId: 's-a',
    sceneName: 'Salao',
    token: { id: 't', color: '#3cff00', x: 0, y: 0 },
    travelPending: false,
    ...over,
  }
}

/** O retrato da lista Cenas numa forma fácil de comparar: cena -> [nomes, pedidos]. */
function retrato(members: PartyMember[]): Record<string, [string[], number]> {
  const out: Record<string, [string[], number]> = {}
  for (const [sceneId, entry] of peopleByScene(members)) out[sceneId] = [entry.people.map((p) => `${p.name}:${p.color}`), entry.pendingRequests]
  return out
}

describe('peopleByScene', () => {
  it('agrupa por cena, na ordem do Grupo, com a cor da ficha', () => {
    const grupo = [
      membro({ playerId: 'ana', name: 'Ana' }),
      membro({ playerId: 'bruno', name: 'Bruno', sceneId: 's-b', token: { id: 'm', color: '#ff5a00', x: 0, y: 0 } }),
      membro({ playerId: 'carla', name: 'Carla', token: { id: 'c', color: '#123456', x: 0, y: 0 } }),
    ]
    expect(retrato(grupo)).toEqual({
      's-a': [['Ana:#3cff00', 'Carla:#123456'], 0],
      's-b': [['Bruno:#ff5a00'], 0],
    })
  })

  it('quem caiu não aparece, nem a bolinha nem o pedido', () => {
    const grupo = [membro({ playerId: 'ana', name: 'Ana' }), membro({ playerId: 'bruno', name: 'Bruno', connected: false, travelPending: true })]
    expect(retrato(grupo)).toEqual({ 's-a': [['Ana:#3cff00'], 0] })
  })

  it('conta os pedidos na cena de quem pediu', () => {
    const grupo = [
      membro({ playerId: 'ana', name: 'Ana', travelPending: true }),
      membro({ playerId: 'bruno', name: 'Bruno', travelPending: true }),
      membro({ playerId: 'carla', name: 'Carla', sceneId: 's-b' }),
    ]
    expect(retrato(grupo)).toEqual({ 's-a': [['Ana:#3cff00', 'Bruno:#3cff00'], 2], 's-b': [['Carla:#3cff00'], 0] })
  })

  it('sem ficha na cena: sem bolinha (não há cor), mas o pedido dele ainda conta', () => {
    expect(retrato([membro({ name: 'Ana', token: null, travelPending: true })])).toEqual({ 's-a': [[], 1] })
  })

  it('mapa solto ou jogador sem cena: nada', () => {
    expect(retrato([membro({ sceneId: null, travelPending: true }), membro({ playerId: 'b', sceneId: null })])).toEqual({})
    expect(retrato([])).toEqual({})
  })

  it('o selo fala singular e plural', () => {
    expect(pendingRequestsLabel(1)).toBe('1 pedido')
    expect(pendingRequestsLabel(3)).toBe('3 pedidos')
  })
})
