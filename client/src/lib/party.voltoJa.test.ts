/**
 * "VOLTO JÁ" do lado do mestre: o jogador que avisou que saiu por um instante
 * ganha o selo "volto já" no Grupo e no painel Jogo — e continua contado na
 * cena dele (bolinha e pedido suspenso), mesmo que a conexão caia enquanto
 * está fora. É o que separa "saiu de propósito" de "caiu".
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import { partyMembers, partyPresenceLabel, peopleByScene, type PartyMember } from './party'
import { playerStatusLabel } from '../components/RoomPanel'

const mundo: HostWorld = {
  open: {
    sceneId: 's-a',
    name: 'Salão',
    map: { ...createEmptyMap('m-a', 'Salão', 10, 10, 50), tokens: [{ id: 't1', characterId: null, name: 'Ana', x: 50, y: 50, size: 1, image: null }] },
  },
  background: [],
}

function jogador(over: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c1', playerId: 'ana', name: 'Ana', status: 'playing', connected: true, tokenIds: ['t1'], visionRadius: 700, sceneId: 's-a', sceneName: 'Salão', ...over }
}

function membro(over: Partial<PartyMember>): PartyMember {
  return { playerId: 'p', name: 'X', connected: true, sceneId: 's-a', sceneName: 'Salão', token: { id: 't', color: '#3cff00', x: 0, y: 0 }, travelPending: false, ...over }
}

describe('Volto já no painel do mestre', () => {
  it('o Grupo lê "volto já", conectado ou não', () => {
    const [fora] = partyMembers([jogador({ away: true })], mundo)
    expect(fora?.away).toBe(true)
    expect(fora && partyPresenceLabel(fora)).toBe('volto já')
    const [caiuFora] = partyMembers([jogador({ away: true, connected: false, clientId: null })], mundo)
    expect(caiuFora && partyPresenceLabel(caiuFora)).toBe('volto já')
  })

  it('controle: sem o aviso, o Grupo continua em "online" e "fora"', () => {
    const [ana] = partyMembers([jogador({})], mundo)
    expect(ana?.away).toBeUndefined()
    expect(ana && partyPresenceLabel(ana)).toBe('online')
    const [caiu] = partyMembers([jogador({ connected: false, clientId: null })], mundo)
    expect(caiu && partyPresenceLabel(caiu)).toBe('fora')
  })

  it('o painel Jogo diz "volto já" no lugar de conectado/desconectado', () => {
    expect(playerStatusLabel(jogador({ away: true }))).toBe('jogando · volto já')
    expect(playerStatusLabel(jogador({ away: true, connected: false, clientId: null }))).toBe('jogando · volto já')
    expect(playerStatusLabel(jogador({}))).toBe('jogando · conectado')
  })

  it('na lista Cenas, quem está no Volto já e caiu continua na cena com o pedido suspenso', () => {
    const cena = peopleByScene([membro({ playerId: 'ana', name: 'Ana', connected: false, away: true, travelPending: true })]).get('s-a')
    expect(cena?.people.map((p) => p.name)).toEqual(['Ana'])
    expect(cena?.pendingRequests).toBe(1)
    // Controle: quem só caiu continua saindo da lista, como sempre.
    expect(peopleByScene([membro({ connected: false, travelPending: true })]).size).toBe(0)
  })
})
