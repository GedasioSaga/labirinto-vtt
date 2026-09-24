import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

/**
 * DESISTIR DO PEDIDO de passagem, no host: o jogador que espera o mestre pode
 * retirar o pedido (`pin.travel.cancel`), e o pedido cai sozinho quando a
 * ficha se afasta do pino. Nos dois casos o pedido sai da sessão (a linha da
 * Caixa de Pedidos some) e o jogador recebe só o motivo — nunca o destino.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const GRID = 50
/** O pino do Salão. A ficha pede de 4 casas (200 px) dele. */
const ALCAPAO = { x: 400, y: 200 }

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino'], description: string): Pin {
  return { id, x, y, kind: 'viagem', description, image: null, destino }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/** O Salão com as fichas nas posições dadas; a Cripta Rubra de fundo. */
function mundo(heroi: { x: number; y: number }, extra: Token[] = []): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Aventura', 40, 10, GRID),
    tokens: [token('heroi', heroi.x, heroi.y), ...extra],
    pins: [viagem('alcapao', ALCAPAO.x, ALCAPAO.y, { sceneId: CRIPTA, pinId: 'fundo' }, 'Alçapão do porão')],
  }
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta', 40, 10, GRID),
    pins: [viagem('fundo', 1000, 250, { sceneId: SALAO, pinId: 'alcapao' }, 'Escada da cripta')],
  }
  return { open: { sceneId: SALAO, name: 'Salão', map: salao }, background: [{ sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta }] }
}

function mesa(w: HostWorld) {
  let n = 0
  let at = 1_000_000
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => at,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
  s.assignToken(ana.playerId, 'heroi')
  const bia = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w).outbound)
  s.assignToken(bia.playerId, 'ficha-bia')
  s.broadcast(w)
  return {
    s,
    ana,
    /** O relógio anda: o limite de pedidos por segundo não atrapalha o pedido seguinte. */
    passa: (ms: number) => {
      at += ms
    },
    pedir: (world: HostWorld = w) => s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'alcapao' }, world),
    desistir: (world: HostWorld = w, clientId = 'c1') => s.handleMessage(clientId, { type: 'pin.travel.cancel' }, world),
    mover: (x: number, y: number, world: HostWorld = w) => s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x, y }, world),
  }
}

function pedidoDe(r: HostResult): string {
  if (r.travelRequest === undefined) throw new Error('o pedido deveria chegar ao mestre')
  return r.travelRequest.requestId
}

/** A resposta de desistência que saiu para `clientId`, ou `undefined`. */
function retirado(r: HostResult, clientId = 'c1'): HostMessage | undefined {
  return r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'pin.travel.cancelled')?.msg
}

describe('protocolo: pin.travel.cancel', () => {
  it('o jogador manda só o tipo; campo a mais não atravessa', () => {
    expect(parsePlayerMessage({ type: 'pin.travel.cancel' })).toEqual({ type: 'pin.travel.cancel' })
    expect(parsePlayerMessage(JSON.stringify({ type: 'pin.travel.cancel', requestId: 'id-9', pinId: 'x' }))).toEqual({ type: 'pin.travel.cancel' })
  })
})

describe('hostSession: desistir do pedido de passagem', () => {
  it('"Desistir" tira o pedido da sessão, avisa o mestre com o nome e responde ao jogador só o motivo', () => {
    const w = mundo({ x: 200, y: 200 })
    const t = mesa(w)
    const requestId = pedidoDe(t.pedir())
    expect(t.s.isTravelPending(requestId)).toBe(true)

    const r = t.desistir()
    expect(t.s.isTravelPending(requestId)).toBe(false)
    expect(r.travelCancelled).toEqual({ requestId, playerId: t.ana.playerId, playerName: 'Ana', reason: 'player' })
    // Ao jogador: só o tipo e o motivo. Nada de pino, cena, id do pedido.
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.cancelled', reason: 'player' } }])
    const fio = JSON.stringify(r.outbound)
    expect(fio).not.toContain('Cripta')
    expect(fio).not.toContain('Alçapão')
    expect(fio).not.toContain(requestId)
    // O selo "pedido" do painel Grupo sai junto.
    expect(t.s.listPlayers(w).find((p) => p.name === 'Ana')?.travelPending).toBeUndefined()
  })

  it('depois de desistir, o "Deixar ir" atrasado do mestre não leva ninguém, e o jogador pode pedir de novo', () => {
    const w = mundo({ x: 200, y: 200 })
    const t = mesa(w)
    const requestId = pedidoDe(t.pedir())
    t.desistir()
    const tarde = t.s.approveTravel(requestId, w)
    expect(tarde.applyTransfer).toBeUndefined()
    expect(tarde.outbound).toEqual([])
    t.passa(60_000)
    const denovo = t.pedir()
    expect(denovo.outbound).toEqual([])
    expect(denovo.travelRequest).toMatchObject({ playerName: 'Ana', toSceneId: CRIPTA })
  })

  it('desistir sem pedido esperando (o mestre respondeu antes) não manda nada a ninguém', () => {
    const w = mundo({ x: 200, y: 200 })
    const t = mesa(w)
    const requestId = pedidoDe(t.pedir())
    t.s.denyTravel(requestId)
    const r = t.desistir()
    expect(r.outbound).toEqual([])
    expect(r.travelCancelled).toBeUndefined()
  })

  it('a desistência de Ana não chega a Bia, nem o pedido de Bia cai quando Ana desiste', () => {
    const w = mundo({ x: 200, y: 200 }, [token('ficha-bia', 250, 200)])
    const t = mesa(w)
    pedidoDe(t.pedir())
    const daBia = pedidoDe(t.s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'alcapao' }, w))
    const r = t.desistir()
    expect(r.outbound.map((o) => o.clientId)).toEqual(['c1'])
    expect(retirado(r, 'c2')).toBeUndefined()
    expect(t.s.isTravelPending(daBia)).toBe(true)
  })

  it('a ficha se afasta 3 casas além de onde pediu: o pedido cai sozinho, com o motivo "far"', () => {
    const w = mundo({ x: 200, y: 200 })
    const t = mesa(w)
    const requestId = pedidoDe(t.pedir())
    // Pediu a 4 casas do pino; vai para 7.
    const r = t.mover(50, 200)
    expect(r.applyMove).toMatchObject({ tokenId: 'heroi', x: 50, y: 200 })
    expect(t.s.isTravelPending(requestId)).toBe(false)
    expect(retirado(r)).toEqual({ type: 'pin.travel.cancelled', reason: 'far' })
    expect(r.travelCancelled).toEqual({ requestId, playerId: t.ana.playerId, playerName: 'Ana', reason: 'far' })
    // O aceite do movimento continua saindo primeiro.
    expect(r.outbound[0]?.msg.type).toBe('token.move.accepted')
  })

  it('andar perto do pino, ou chegar mais perto, não derruba o pedido', () => {
    const w = mundo({ x: 200, y: 200 })
    const t = mesa(w)
    const requestId = pedidoDe(t.pedir())
    // Duas casas mais longe que ao pedir: ainda dentro da folga.
    const perto = t.mover(100, 200)
    expect(perto.applyMove).toMatchObject({ x: 100, y: 200 })
    expect(retirado(perto)).toBeUndefined()
    expect(perto.travelCancelled).toBeUndefined()
    // Do lado do pino.
    const encostou = t.mover(350, 200, mundo({ x: 100, y: 200 }))
    expect(retirado(encostou)).toBeUndefined()
    expect(t.s.isTravelPending(requestId)).toBe(true)
  })

  it('ficha própria que o mestre escondeu, parada no pino, não segura o pedido quando a ficha visível se afasta', () => {
    // O familiar de Ana está em cima do alçapão, mas escondido: nem o pedido
    // nem o "Deixar ir" o enxergam, então também não pode contar como "perto".
    const familiar: Token = { ...token('familiar', ALCAPAO.x, ALCAPAO.y), hidden: true }
    const w = mundo({ x: 200, y: 200 }, [familiar])
    const t = mesa(w)
    t.s.assignToken(t.ana.playerId, 'familiar')
    const requestId = pedidoDe(t.pedir())
    // O pedido saiu com a ficha visível, a 4 casas.
    expect(t.s.isTravelPending(requestId)).toBe(true)
    const r = t.mover(0, 200)
    expect(r.applyMove).toMatchObject({ tokenId: 'heroi', x: 0, y: 200 })
    expect(retirado(r)).toEqual({ type: 'pin.travel.cancelled', reason: 'far' })
    expect(r.travelCancelled).toEqual({ requestId, playerId: t.ana.playerId, playerName: 'Ana', reason: 'far' })
    expect(t.s.isTravelPending(requestId)).toBe(false)
  })

  it('segunda ficha própria visível perto do pino segura o pedido mesmo com a outra longe', () => {
    const w = mundo({ x: 200, y: 200 }, [token('familiar', 350, 200)])
    const t = mesa(w)
    t.s.assignToken(t.ana.playerId, 'familiar')
    const requestId = pedidoDe(t.pedir())
    const r = t.mover(0, 200)
    expect(retirado(r)).toBeUndefined()
    expect(r.travelCancelled).toBeUndefined()
    expect(t.s.isTravelPending(requestId)).toBe(true)
  })

  it('a folga conta da posição do pedido: quem pediu colado no pino e anda 3 casas perde o pedido', () => {
    const w = mundo({ x: 350, y: 200 })
    const t = mesa(w)
    const requestId = pedidoDe(t.pedir())
    const r = t.mover(350 - 3 * GRID, 200)
    expect(retirado(r)).toEqual({ type: 'pin.travel.cancelled', reason: 'far' })
    expect(t.s.isTravelPending(requestId)).toBe(false)
  })
})
