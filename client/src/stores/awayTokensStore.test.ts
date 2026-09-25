import { beforeEach, describe, expect, it } from 'vitest'
import type { PlayerInfo } from '../net/hostSession'
import { useAwayTokensStore } from './awayTokensStore'

/**
 * VOLTO JÁ: o canvas do mestre lê desta store quais fichas levam o selo de
 * ausente. Ela só troca de referência quando o conjunto muda — a lista de
 * jogadores chega a cada mudança da sala, e o canvas não pode repintar as
 * fichas à toa.
 */

function jogador(over: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c1', playerId: 'ana', name: 'Ana', status: 'playing', connected: true, tokenIds: ['t1'], visionRadius: 700, ...over }
}

describe('awayTokensStore', () => {
  beforeEach(() => {
    useAwayTokensStore.getState().clear()
  })

  it('guarda as fichas de quem está no Volto já, e esvazia na volta', () => {
    useAwayTokensStore.getState().setFromPlayers([jogador({ away: true })])
    expect([...useAwayTokensStore.getState().tokenIds]).toEqual(['t1'])
    useAwayTokensStore.getState().setFromPlayers([jogador({})])
    expect(useAwayTokensStore.getState().tokenIds.size).toBe(0)
  })

  it('a mesma lista de fichas não troca a referência (o canvas não repinta)', () => {
    useAwayTokensStore.getState().setFromPlayers([jogador({ away: true })])
    const antes = useAwayTokensStore.getState().tokenIds
    useAwayTokensStore.getState().setFromPlayers([jogador({ away: true, connected: false, clientId: null })])
    expect(useAwayTokensStore.getState().tokenIds).toBe(antes)
  })

  it('fechar a sala tira todo selo', () => {
    useAwayTokensStore.getState().setFromPlayers([jogador({ away: true })])
    useAwayTokensStore.getState().clear()
    expect(useAwayTokensStore.getState().tokenIds.size).toBe(0)
  })
})
