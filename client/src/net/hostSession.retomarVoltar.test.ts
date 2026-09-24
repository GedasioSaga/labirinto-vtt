/**
 * RETOMAR A MESA junto com VOLTAR É A MESMA PESSOA: as duas mexem em quem é
 * quem ao entrar, e a memória do mapa explorado é guardada por playerId.
 * - Depois de um "Desfazer", o impostor que caiu não vira pergunta "Ana
 *   voltou?" para a Ana de verdade: ela reencontra o assento, e o mestre não é
 *   convidado a juntar os dois.
 * - "Guardar ficha" de quem está fora não apaga o assento nem o explorado
 *   dele da mesa gravada: a ficha volta a ele na retomada.
 * - "É ela" depois de retomar: a Ana continua gravada com o explorado dela.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, Token } from '../types/map'
import { createHostSession, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const OESTE = { x: 250, y: 250 }
const LESTE = { x: 1250, y: 250 }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function sala(id: string, x0: number, y0: number, x1: number, y1: number): Region {
  return {
    id,
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: id },
  }
}

function porao(ana: { x: number; y: number }): MapData {
  return {
    ...createEmptyMap('m-porao', 'Porão', 30, 10, 50),
    tokens: [ficha('lirio', ana.x, ana.y)],
    regions: [sala('porao-oeste', 50, 50, 450, 450), sala('porao-leste', 1050, 50, 1450, 450)],
  }
}

function mundo(map: MapData): HostWorld {
  return { open: { sceneId: 's-porao', name: 'Porão', map }, background: [] }
}

function sessao(prefixo: string, restaura: Pick<Parameters<typeof createHostSession>[0], 'restoreSeats' | 'restoreExploration'> = {}) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 250, now: () => 1_000 + n, randomId: () => `${prefixo}-${(n += 1)}`, ...restaura })
  const entra = (clientId: string, name: string, w: HostWorld) => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, w)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return { playerId: welcome.playerId, result: r }
  }
  return { s, entra }
}

/** Dia 1: Ana anda do leste ao oeste do Porão com Lírio; a mesa é gravada. */
function dia1() {
  const { s, entra } = sessao('d1')
  const ana = entra('c1', 'Ana', mundo(porao(LESTE)))
  s.assignToken(ana.playerId, 'lirio')
  s.broadcast(mundo(porao(LESTE)))
  s.broadcast(mundo(porao(OESTE)))
  return { seats: s.savedSeats(), exploration: s.savedExploration() }
}

function dia2() {
  const ontem = dia1()
  return sessao('d2', { restoreSeats: ontem.seats, restoreExploration: ontem.exploration })
}

describe('hostSession: retomar a mesa com "voltar é a mesma pessoa"', () => {
  it('Desfazer e o impostor cai: a Ana de verdade reencontra o assento e o mestre NÃO recebe "Ana voltou?" sobre o impostor', () => {
    const { s, entra } = dia2()
    const w = mundo(porao(OESTE))
    const impostor = entra('c1', 'Ana', w)
    expect(impostor.result.reclaimed?.tokenIds).toEqual(['lirio'])
    s.undoReclaim(impostor.playerId)
    s.disconnect('c1')
    const ana = entra('c2', 'ana', w)
    expect(ana.result.reclaimed?.tokenIds).toEqual(['lirio'])
    expect(ana.result.returnCandidate).toBeUndefined()
    expect(s.isReturnPending(ana.playerId)).toBe(false)
    // E o "É ela" que chegasse mesmo assim não junta os dois: Lírio fica com a Ana de verdade.
    expect(s.confirmReturn(ana.playerId, impostor.playerId, w).outbound).toEqual([])
    expect(s.listPlayers(w).find((p) => p.playerId === ana.playerId)?.tokenIds).toEqual(['lirio'])
  })

  it('"Guardar ficha" de quem está fora: a mesa gravada ainda tem o assento e o explorado dele', () => {
    const { s, entra } = dia2()
    const w = mundo(porao(OESTE))
    const ana = entra('c1', 'Ana', w)
    s.broadcast(w)
    s.disconnect('c1')
    // O que a ponte faz no "Guardar ficha": a ficha sai do mapa e fica sem dono na sessão.
    s.unassignToken(ana.playerId, 'lirio')
    const guardadas = new Map([[ana.playerId, ['lirio']]])
    expect(s.savedSeats(guardadas)).toEqual([{ name: 'Ana', tokenIds: ['lirio'], visionRadius: null, sceneKey: 'm-porao' }])
    const explorado = s.savedExploration(guardadas)
    expect(explorado.map((seat) => [seat.name, seat.scenes.map((scene) => scene.mapId)])).toEqual([['Ana', ['m-porao']]])
    // Sem ficha guardada, quem está fora sem ficha continua fora da mesa, como antes.
    expect(s.savedSeats()).toEqual([])
  })

  it('"É ela" depois de retomar: a Ana que voltou por outro aparelho continua gravada com o explorado dela', () => {
    const { s, entra } = dia2()
    const w = mundo(porao(OESTE))
    const ana = entra('c1', 'Ana', w)
    s.disconnect('c1')
    const outroAparelho = entra('c2', 'Ana', w)
    expect(outroAparelho.result.returnCandidate).toEqual({ playerId: outroAparelho.playerId, previousId: ana.playerId, name: 'Ana' })
    expect(outroAparelho.result.reclaimed).toBeUndefined()
    expect(s.confirmReturn(outroAparelho.playerId, ana.playerId, w).outbound.length).toBeGreaterThan(0)
    expect(s.savedSeats().map((seat) => [seat.name, seat.tokenIds])).toEqual([['Ana', ['lirio']]])
    const explorado = s.savedExploration()
    expect(explorado.map((seat) => [seat.name, seat.scenes.map((scene) => scene.mapId)])).toEqual([['Ana', ['m-porao']]])
  })
})
