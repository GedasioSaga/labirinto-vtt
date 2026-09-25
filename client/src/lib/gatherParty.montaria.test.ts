/**
 * "Reunir o grupo aqui" com MONTARIA E FAMILIAR: a reunião movia só a ficha
 * principal de cada jogador, e o pônei colado ficava para trás na outra cena
 * (o mestre tinha de clicar "Trazer" depois). Agora as outras fichas do MESMO
 * dono a até 2 casas da principal, no tabuleiro, vêm junto — cada uma numa
 * casa livre colada à do dono, sem tomar a casa de ninguém do grupo.
 */
import { describe, expect, it } from 'vitest'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { MapData, Token } from '../types/map'
import { applyGatherPlan, planGather } from './gatherParty'
import { createEmptyMap } from './mapFactory'
import { partyMembers } from './party'
import { PIN_HEAD_OFFSET, PIN_HEAD_RADIUS } from './pins'

const GRADE = 50
const casa = (coluna: number, linha: number) => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const PINO = casa(10, 5)
const ESTRADA = 'estrada'
const VILA = 'vila'

function ficha(id: string, p: { x: number; y: number }, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: p.x, y: p.y, size: 1, image: null, ...extra }
}

function mapa(tokens: Token[]): MapData {
  return { ...createEmptyMap(`mapa-${tokens.length}`, 'Teste', 20, 12, GRADE), tokens }
}

/**
 * O pino é da Estrada (a cena aberta). Bruno está na Vila com o pônei colado,
 * a coruja escondida pelo mestre ao lado e o cão a 4 casas. Ana está na
 * Estrada com o gato colado.
 */
function mesa(): { world: HostWorld; players: PlayerInfo[] } {
  const world: HostWorld = {
    open: { sceneId: ESTRADA, name: 'Estrada Real', map: mapa([ficha('ana', casa(2, 2)), ficha('gato', casa(3, 2))]) },
    background: [
      {
        sceneId: VILA,
        name: 'Vila Cinzenta',
        map: mapa([ficha('bruno', casa(5, 5)), ficha('ponei', casa(6, 5)), ficha('coruja', casa(5, 6), { hidden: true }), ficha('cao', casa(9, 5))]),
      },
    ],
  }
  const jogador = (playerId: string, name: string, tokenIds: string[], sceneId: string, sceneName: string): PlayerInfo => ({
    clientId: `c-${playerId}`,
    playerId,
    name,
    status: 'playing',
    connected: true,
    tokenIds,
    visionRadius: 700,
    visionFactor: 1,
    sceneId,
    sceneName,
  })
  return {
    world,
    players: [jogador('p1', 'Bruno', ['bruno', 'ponei', 'coruja', 'cao'], VILA, 'Vila Cinzenta'), jogador('p2', 'Ana', ['ana', 'gato'], ESTRADA, 'Estrada Real')],
  }
}

const chave = (p: { x: number; y: number }) => `${p.x}|${p.y}`
const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

describe('partyMembers: o séquito de cada jogador', () => {
  it('o pônei colado conta; a coruja escondida e o cão a 4 casas não', () => {
    const { world, players } = mesa()
    const [bruno, ana] = partyMembers(players, world)
    expect(bruno.entourageIds).toEqual(['ponei'])
    expect(ana.entourageIds).toEqual(['gato'])
  })

  it('sozinho: sem séquito, o campo nem aparece', () => {
    const { world, players } = mesa()
    const [bruno] = partyMembers([{ ...players[0], tokenIds: ['bruno', 'cao'] }], world)
    expect(bruno.token?.id).toBe('bruno')
    expect(bruno.entourageIds).toBeUndefined()
  })
})

describe('planGather: montaria e familiar vêm junto', () => {
  it('Bruno viaja com o pônei; Ana anda com o gato; cada um colado ao dono, as quatro casas diferentes, nenhuma no pino', () => {
    const { world, players } = mesa()
    const plano = planGather(partyMembers(players, world), world, PINO)
    expect(plano.leftOut).toEqual([])
    const [bruno, ana] = plano.moves
    expect([bruno.name, bruno.travels, (bruno.entourage ?? []).map((e) => e.tokenId)]).toEqual(['Bruno', true, ['ponei']])
    expect([ana.name, ana.travels, (ana.entourage ?? []).map((e) => e.tokenId)]).toEqual(['Ana', false, ['gato']])
    const ponei = bruno.entourage?.[0]
    const gato = ana.entourage?.[0]
    if (ponei === undefined || gato === undefined) throw new Error('o séquito deveria ter casa')
    expect(chebyshev(ponei, bruno)).toBe(GRADE)
    expect(chebyshev(gato, ana)).toBe(GRADE)
    const casas = [bruno, ponei, ana, gato].map(chave)
    expect(new Set(casas).size).toBe(4)
    expect(casas).not.toContain(chave(PINO))
  })

  it('applyGatherPlan: o pônei vai na travessia de Bruno; o gato anda no mesmo passo de Ana', () => {
    const { world, players } = mesa()
    const plano = planGather(partyMembers(players, world), world, PINO)
    const travessias: { playerId: string; entourage: string[] }[] = []
    const passos: string[][] = []
    const falhou = applyGatherPlan(plano, {
      sceneId: ESTRADA,
      bringFromOtherScene: (playerId, _sceneId, at) => {
        travessias.push({ playerId, entourage: (at.entourage ?? []).map((e) => e.tokenId) })
        return true
      },
      placeInScene: (posicoes) => passos.push(posicoes.map((p) => p.id)),
    })
    expect(falhou).toEqual([])
    expect(travessias).toEqual([{ playerId: 'p1', entourage: ['ponei'] }])
    expect(passos).toEqual([['ana', 'gato']])
  })

  it('séquito de 4 fichas: nenhuma senta na casa do pino nem cobre a cabeça dele', () => {
    // Bruno senta colado ao pino; o anel em volta dele passa pela casa do pino na 4a ficha.
    const vila = mapa([ficha('bruno', casa(5, 5)), ficha('ponei', casa(6, 5)), ficha('lince', casa(4, 5)), ficha('rato', casa(5, 4)), ficha('cabra', casa(5, 6))])
    const world: HostWorld = { open: { sceneId: ESTRADA, name: 'Estrada Real', map: mapa([]) }, background: [{ sceneId: VILA, name: 'Vila Cinzenta', map: vila }] }
    const { players } = mesa()
    const bruno = { ...players[0], tokenIds: ['bruno', 'ponei', 'lince', 'rato', 'cabra'] }
    const plano = planGather(partyMembers([bruno], world), world, PINO)
    const [move] = plano.moves
    const sequito = move.entourage ?? []
    expect(sequito.map((e) => e.tokenId)).toEqual(['ponei', 'lince', 'rato', 'cabra'])
    const cabeca = { x: PINO.x, y: PINO.y - PIN_HEAD_OFFSET }
    for (const e of sequito) {
      expect(chave(e)).not.toBe(chave(PINO))
      expect(Math.hypot(e.x - cabeca.x, e.y - cabeca.y)).toBeGreaterThanOrEqual(GRADE / 2 + PIN_HEAD_RADIUS)
    }
    expect(new Set([move, ...sequito].map(chave)).size).toBe(5)
  })

  it('membro sem séquito: o movimento sai como antes, sem campo de séquito', () => {
    const { world, players } = mesa()
    const plano = planGather(partyMembers([{ ...players[1], tokenIds: ['ana'] }], world), world, PINO)
    expect(plano.moves).toHaveLength(1)
    expect(plano.moves[0].entourage).toBeUndefined()
  })
})
