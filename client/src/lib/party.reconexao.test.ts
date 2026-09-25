import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import { offlineForLabel, partyMembers, partyPresenceLabel } from './party'

/** "fora há 0:10" no Grupo: o mestre vê há quanto tempo cada um caiu. */

const world: HostWorld = { open: { sceneId: null, name: 'Mapa', map: createEmptyMap('m', 'Mapa', 10, 10, 50) }, background: [] }

function player(patch: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c1', playerId: 'p1', name: 'Gina', status: 'waiting', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, ...patch }
}

describe('party: há quanto tempo o jogador está fora', () => {
  it('a linha carrega o momento da queda, e só de quem caiu', () => {
    const [fora, online] = partyMembers(
      [player({ clientId: null, connected: false, disconnectedAt: 1_000 }), player({ playerId: 'p2', name: 'Ana' })],
      world,
    )
    expect(fora?.offlineSince).toBe(1_000)
    expect(online?.offlineSince).toBeUndefined()
  })

  it('menos de um minuto em m:ss; depois, em minutos; depois de uma hora, em horas', () => {
    expect(offlineForLabel(0)).toBe('0:00')
    expect(offlineForLabel(10_000)).toBe('0:10')
    expect(offlineForLabel(59_999)).toBe('0:59')
    expect(offlineForLabel(60_000)).toBe('1 min')
    expect(offlineForLabel(125_000)).toBe('2 min')
    expect(offlineForLabel(3_600_000)).toBe('1 h')
    // Relógio que andou para trás não vira tempo negativo.
    expect(offlineForLabel(-5_000)).toBe('0:00')
  })

  it('"fora há 0:10" para quem caiu há 10 s; "online" para quem está', () => {
    const [fora, online] = partyMembers(
      [player({ clientId: null, connected: false, disconnectedAt: 50_000 }), player({ playerId: 'p2', name: 'Ana' })],
      world,
    )
    if (fora === undefined || online === undefined) throw new Error('duas linhas')
    expect(partyPresenceLabel(fora, 60_000)).toBe('fora há 0:10')
    expect(partyPresenceLabel(fora, 50_000 + 120_000)).toBe('fora há 2 min')
    expect(partyPresenceLabel(online, 60_000)).toBe('online')
  })

  it('fora sem o momento da queda (dado antigo) continua dizendo só "fora"', () => {
    const [fora] = partyMembers([player({ clientId: null, connected: false })], world)
    if (fora === undefined) throw new Error('uma linha')
    expect(partyPresenceLabel(fora, 60_000)).toBe('fora')
  })
})
