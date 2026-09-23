/**
 * DIÁRIO DE VIAGENS (G15), a parte pura: de onde sai cada linha, a ordem
 * (a mais nova em cima), qual linha ganha "Desfazer" e o texto que o mestre lê.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from '../net/hostSession'
import { TRAVEL_LOG_MAX, addTravel, travelClock, travelLine, travelLogEntry, undoableTravelIds, withoutTravel, type TravelLogEntry } from './travelLog'

const ficha = (id: string, name: string, x: number, y: number): Token => ({ id, characterId: null, name, x, y, size: 1, image: null })

const mundo: HostWorld = {
  open: { sceneId: 's-a', name: 'Salão', map: { ...createEmptyMap('m-a', 'A', 30, 10, 50), tokens: [ficha('t-ana', 'Ana', 700, 300)] } },
  background: [{ sceneId: 's-b', name: 'Cripta', map: { ...createEmptyMap('m-b', 'B', 30, 10, 50), tokens: [ficha('t-bia', 'Bia', 100, 100)] } }],
}

const transfer = (over: Partial<AppliedTransfer> = {}): AppliedTransfer => ({
  tokenId: 't-ana',
  playerId: 'p-ana',
  playerName: 'Jogadora Ana',
  fromSceneId: 's-a',
  toSceneId: 's-b',
  toSceneName: 'Cripta',
  x: 1025,
  y: 275,
  ...over,
})

function entrada(id: string, playerId: string, over: Partial<TravelLogEntry> = {}): TravelLogEntry {
  return {
    id,
    at: 0,
    playerId,
    tokenId: `t-${playerId}`,
    tokenName: playerId,
    fromSceneId: 's-a',
    fromSceneName: 'Salão',
    fromX: 0,
    fromY: 0,
    toSceneId: 's-b',
    toSceneName: 'Cripta',
    ...over,
  }
}

describe('travelLogEntry: a linha nasce da transferência e do mundo ANTES de a ficha sair', () => {
  it('guarda nome da ficha, as duas cenas pelo nome do mestre e a casa de onde a ficha saiu', () => {
    expect(travelLogEntry(transfer(), mundo, 1234, 'v1')).toEqual({
      id: 'v1',
      at: 1234,
      playerId: 'p-ana',
      tokenId: 't-ana',
      tokenName: 'Ana',
      fromSceneId: 's-a',
      fromSceneName: 'Salão',
      fromX: 700,
      fromY: 300,
      toSceneId: 's-b',
      toSceneName: 'Cripta',
    })
  })

  it('ficha de uma cena de FUNDO também vale (volta da Cripta)', () => {
    const volta = transfer({ tokenId: 't-bia', playerId: 'p-bia', fromSceneId: 's-b', toSceneId: 's-a', toSceneName: 'Salão' })
    expect(travelLogEntry(volta, mundo, 0, 'v2')).toMatchObject({ tokenName: 'Bia', fromSceneName: 'Cripta', fromX: 100, fromY: 100, toSceneName: 'Salão' })
  })

  it('sem a cena de origem ou sem a ficha nela: nada a anotar', () => {
    expect(travelLogEntry(transfer({ fromSceneId: 's-x' }), mundo, 0, 'v3')).toBeNull()
    expect(travelLogEntry(transfer({ tokenId: 'fantasma' }), mundo, 0, 'v4')).toBeNull()
  })
})

describe('addTravel / withoutTravel / undoableTravelIds', () => {
  it('a mais nova entra em cima', () => {
    const log = addTravel(addTravel([], entrada('v1', 'ana')), entrada('v2', 'bruno'))
    expect(log.map((e) => e.id)).toEqual(['v2', 'v1'])
  })

  it('o diário tem teto: a mais velha sai', () => {
    let log: TravelLogEntry[] = []
    for (let i = 0; i < TRAVEL_LOG_MAX + 3; i += 1) log = addTravel(log, entrada(`v${i}`, 'ana'))
    expect(log).toHaveLength(TRAVEL_LOG_MAX)
    expect(log[0]?.id).toBe(`v${TRAVEL_LOG_MAX + 2}`)
  })

  it('"Desfazer" só na ÚLTIMA viagem de cada jogador', () => {
    const log = [entrada('v4', 'ana'), entrada('v3', 'bruno'), entrada('v2', 'ana'), entrada('v1', 'bruno')]
    expect([...undoableTravelIds(log)].sort()).toEqual(['v3', 'v4'])
  })

  it('desfeita, a viagem sai do diário e a anterior do mesmo jogador vira a última', () => {
    const log = withoutTravel([entrada('v2', 'ana'), entrada('v1', 'ana')], 'v2')
    expect(log.map((e) => e.id)).toEqual(['v1'])
    expect([...undoableTravelIds(log)]).toEqual(['v1'])
  })
})

describe('texto da linha', () => {
  it('"HH:MM" na hora local, com zero à esquerda', () => {
    expect(travelClock(new Date(2026, 8, 23, 9, 5, 59).getTime())).toBe('09:05')
    expect(travelClock(new Date(2026, 8, 23, 22, 10).getTime())).toBe('22:10')
  })

  it('"Ana: Salão → Cripta"', () => {
    expect(travelLine(entrada('v1', 'ana', { tokenName: 'Ana' }))).toBe('Ana: Salão → Cripta')
  })
})
