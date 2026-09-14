import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const RADIUS = 700

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Duas salas separadas por parede vertical em x=500. */
function twoRooms(): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    walls: [wall('divisoria', 500, 0, 500, 1000)],
    tokens: [token('heroi', 200, 200), token('ladino', 800, 200)],
  }
}

function sequentialIds(): () => string {
  let n = 0
  return () => {
    n += 1
    return `id-${n}`
  }
}

function newSession() {
  return createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 0, randomId: sequentialIds() })
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string; resumeToken: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

describe('hostSession', () => {
  it('join com código errado devolve error bad_code e não cria jogador', () => {
    const s = newSession()
    const r = s.handleMessage('c1', { type: 'join', code: 'ZZZZZZ', name: 'Ana' }, twoRooms())
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'error', reason: 'bad_code' } }])
    expect(s.listPlayers()).toEqual([])
  })

  it('mensagem inválida devolve error invalid_message; ping é ignorado', () => {
    const s = newSession()
    expect(s.handleMessage('c1', { name: 'x' }, twoRooms()).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } },
    ])
    expect(s.handleMessage('c1', { type: 'ping' }, twoRooms()).outbound).toEqual([])
  })

  it('join ok devolve welcome + lobby.waiting e lista jogador aguardando', () => {
    const s = newSession()
    const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, twoRooms())
    expect(r.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
    expect(s.listPlayers()).toMatchObject([{ clientId: 'c1', name: 'Ana', status: 'waiting', connected: true }])
  })

  it('assign + broadcast: jogador recebe só o próprio token, nunca o alheio atrás da parede', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    const p2 = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    s.assignToken(p2.playerId, 'ladino')

    const r = s.broadcast(map)
    expect(s.rev).toBe(1)
    const toC1 = r.outbound.find((o) => o.clientId === 'c1')?.msg
    if (toC1?.type !== 'snapshot') throw new Error('esperava snapshot para c1')
    expect(toC1.rev).toBe(1)
    expect(toC1.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(JSON.stringify(toC1)).not.toContain('ladino')
    expect(toC1.vision.length).toBe(1)
  })

  it('broadcast ignora jogador sem token', () => {
    const s = newSession()
    s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, twoRooms())
    expect(s.broadcast(twoRooms()).outbound).toEqual([])
  })

  it('token.move de token alheio é rejeitado com not_owner, sem applyMove', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'ladino', x: 810, y: 200 }, map)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'r1', reason: 'not_owner' } }])
    expect(r.applyMove).toBeUndefined()
  })

  it('token.move antes do join devolve not_joined', () => {
    const s = newSession()
    const r = s.handleMessage('c9', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 1, y: 1 }, twoRooms())
    expect(r.outbound).toEqual([{ clientId: 'c9', msg: { type: 'error', reason: 'not_joined' } }])
  })

  it('move válido devolve accepted e applyMove para o integrador', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r2', tokenId: 'heroi', x: 240, y: 200 }, map)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.accepted', reqId: 'r2', x: 240, y: 200 } }])
    expect(r.applyMove).toEqual({ tokenId: 'heroi', x: 240, y: 200 })
  })

  it('move atravessando parede é rejeitado com wall', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r3', tokenId: 'heroi', x: 700, y: 200 }, map)
    expect(r.outbound[0]?.msg).toEqual({ type: 'token.move.rejected', reqId: 'r3', reason: 'wall' })
  })

  it('resume após disconnect reassume o playerId e manda snapshot se já tinha token', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    s.disconnect('c1')
    expect(s.listPlayers()[0]).toMatchObject({ connected: false, clientId: null })

    const r = s.handleMessage('c7', { type: 'join', code: CODE, name: 'Ana', resume: p1.resumeToken }, map)
    expect(welcomeOf(r.outbound)).toEqual(p1)
    expect(r.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'snapshot'])
    expect(s.listPlayers()).toMatchObject([{ clientId: 'c7', playerId: p1.playerId, status: 'playing' }])
    // A conexão antiga não fala mais por esse jogador.
    expect(s.handleMessage('c1', { type: 'token.move', reqId: 'x', tokenId: 'heroi', x: 1, y: 1 }, map).outbound[0]?.msg).toEqual({
      type: 'error',
      reason: 'not_joined',
    })
  })

  it('resume com token desconhecido cria jogador novo aguardando', () => {
    const s = newSession()
    const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana', resume: 'inexistente' }, twoRooms())
    expect(r.outbound.map((o) => o.msg.type)).toEqual(['welcome', 'lobby.waiting'])
  })

  it('kick gera kicked, remove o jogador e invalida o resume', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    expect(s.kick('c1').outbound).toEqual([{ clientId: 'c1', msg: { type: 'kicked' } }])
    expect(s.listPlayers()).toEqual([])
    const r = s.handleMessage('c2', { type: 'join', code: CODE, name: 'Ana', resume: p1.resumeToken }, map)
    expect(welcomeOf(r.outbound).playerId).not.toBe(p1.playerId)
    expect(s.kick('desconhecido').outbound).toEqual([])
  })

  it('assignToken tira o token do dono anterior; unassign volta a aguardando', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    const p2 = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map).outbound)
    s.assignToken(p1.playerId, 'heroi')
    s.assignToken(p2.playerId, 'heroi')
    expect(s.listPlayers().map((p) => p.tokenIds)).toEqual([[], ['heroi']])
    s.unassignToken(p2.playerId, 'heroi')
    expect(s.listPlayers().map((p) => p.status)).toEqual(['waiting', 'waiting'])
  })

  it('perder o último token manda lobby.waiting; ainda com token, não', () => {
    const s = newSession()
    const map = twoRooms()
    const p1 = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound)
    const p2 = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, map).outbound)
    expect(s.assignToken(p1.playerId, 'heroi').outbound).toEqual([])
    expect(s.assignToken(p1.playerId, 'ladino').outbound).toEqual([])
    expect(s.unassignToken(p1.playerId, 'ladino').outbound).toEqual([])
    expect(s.unassignToken(p1.playerId, 'heroi').outbound).toEqual([{ clientId: 'c1', msg: { type: 'lobby.waiting' } }])
    // Sem token nenhum: remover de novo não reenvia.
    expect(s.unassignToken(p1.playerId, 'heroi').outbound).toEqual([])
    expect(s.unassignToken('desconhecido', 'heroi').outbound).toEqual([])

    // Token tomado por outro jogador: o dono anterior volta ao lobby.
    s.assignToken(p1.playerId, 'heroi')
    expect(s.assignToken(p2.playerId, 'heroi').outbound).toEqual([{ clientId: 'c1', msg: { type: 'lobby.waiting' } }])

    // Desconectado não recebe nada (o resume entrega o estado certo).
    s.disconnect('c2')
    expect(s.unassignToken(p2.playerId, 'heroi').outbound).toEqual([])
  })
})
