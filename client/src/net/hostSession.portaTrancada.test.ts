import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession, DOOR_TOGGLE_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

/**
 * PORTA TRANCADA VIRA PEDIDO. A porta trancada chega ao jogador como porta
 * fechada comum (o cadeado é do mestre); o toque nela responde "Trancada", e
 * o jogador pode Bater, Forçar ou Usar chave — o pedido vira uma linha na
 * caixa do mestre, que responde "Destrancar e abrir" ou "Não".
 */

const CODE = 'AB12CD'
const RADIUS = 700
const GRID = 40
const fechada = { open: false, locked: false, kind: 'normal' as const }
const trancada = { ...fechada, locked: true }

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

/** Parede vertical em x=500 com três portas (Escritório trancada, as outras não) e a ficha de Ana encostada no Escritório. */
function mansao(escritorio: NonNullable<Wall['door']> = trancada, anaX = 460): MapData {
  return {
    ...createEmptyMap('mapa-mansao', 'Mansão', 1000, 1000, GRID),
    walls: [
      wall('acima', 500, 0, 500, 180),
      { ...wall('escritorio', 500, 180, 500, 220, escritorio), blocksLight: false },
      wall('meio', 500, 220, 500, 300),
      { ...wall('cozinha', 500, 300, 500, 340, fechada), blocksLight: false },
      wall('meio2', 500, 340, 500, 400),
      { ...wall('quarto', 500, 400, 500, 440, { ...fechada, open: true }), blocksLight: false },
      wall('abaixo', 500, 440, 500, 1000),
    ],
    tokens: [token('lirio', anaX, 200)],
  }
}

function sequentialIds(): () => string {
  let n = 0
  return () => {
    n += 1
    return `id-${n}`
  }
}

/** Ana jogando na Mansão, com um snapshot já enviado. `world` põe a Mansão de fundo e o Salão aberto no editor. */
function mesa(map: MapData = mansao()) {
  let clock = 0
  const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => clock, randomId: sequentialIds() })
  const world: HostWorld = {
    open: { sceneId: 'cena-salao', name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 1000, 1000, GRID) },
    background: [{ sceneId: 'cena-mansao', name: 'Mansão', map }],
  }
  const joined = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, world).outbound[0]?.msg
  if (joined?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(joined.playerId, 'lirio')
  s.broadcast(world)
  return { s, world, playerId: joined.playerId, advance: (ms: number) => void (clock += ms) }
}

function snapshotOf(result: HostResult): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = result.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot')
  return msg
}

describe('protocolo: door.request', () => {
  it('aceita Bater, Forçar e Usar chave; recusa jeito inventado e porta sem id', () => {
    expect(parsePlayerMessage({ type: 'door.request', wallId: 'escritorio', how: 'force', extra: 1 })).toEqual({ type: 'door.request', wallId: 'escritorio', how: 'force' })
    expect(parsePlayerMessage({ type: 'door.request', wallId: 'escritorio', how: 'knock' })).not.toBeNull()
    expect(parsePlayerMessage({ type: 'door.request', wallId: 'escritorio', how: 'key' })).not.toBeNull()
    expect(parsePlayerMessage({ type: 'door.request', wallId: 'escritorio', how: 'explodir' })).toBeNull()
    expect(parsePlayerMessage({ type: 'door.request', wallId: '', how: 'force' })).toBeNull()
    expect(parsePlayerMessage({ type: 'door.request', how: 'force' })).toBeNull()
  })
})

describe('porta trancada chega ao jogador como porta fechada comum', () => {
  it('SEGURANÇA: nenhuma porta do snapshot vem trancada — as três têm o mesmo estado de porta comum', () => {
    const t = mesa()
    const snap = snapshotOf(t.s.broadcast(t.world))
    const portas = snap.map.walls.filter((w) => w.door !== null)
    expect(portas.map((w) => w.id).sort()).toEqual(['cozinha', 'escritorio', 'quarto'])
    expect(snap.map.walls.find((w) => w.id === 'escritorio')?.door).toEqual(fechada)
    expect(JSON.stringify(snap)).not.toContain('"locked":true')
  })

  it('SEGURANÇA: a lembrança da porta, longe dela, também não guarda o cadeado', () => {
    const t = mesa()
    t.s.broadcast(t.world)
    const longe = mansao(trancada, 100)
    const snap = snapshotOf(t.s.broadcast({ ...t.world, background: [{ sceneId: 'cena-mansao', name: 'Mansão', map: longe }] }))
    expect(JSON.stringify(snap)).not.toContain('"locked":true')
  })
})

describe('hostSession door.request (pedido ao mestre)', () => {
  it('Forçar a porta trancada: vira pedido ao mestre, com o nome da cena só para ele; o jogador não recebe nada ainda', () => {
    const t = mesa()
    const r = t.s.handleMessage('c1', { type: 'door.request', wallId: 'escritorio', how: 'force' }, t.world)
    expect(r.doorRequest).toEqual({ requestId: expect.any(String), playerId: t.playerId, playerName: 'Ana', how: 'force', sceneName: 'Mansão' })
    expect(r.outbound).toEqual([])
    expect(r.applyDoor).toBeUndefined()
    expect(t.s.isDoorRequestPending(r.doorRequest?.requestId ?? '')).toBe(true)
  })

  it('mapa solto (sem aventura): o pedido vem sem nome de cena, e o "Destrancar e abrir" vale a cena aberta', () => {
    const map = mansao()
    const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 0, randomId: sequentialIds() })
    const joined = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound[0]?.msg
    if (joined?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(joined.playerId, 'lirio')
    const pedido = s.handleMessage('c1', { type: 'door.request', wallId: 'escritorio', how: 'force' }, map).doorRequest
    expect(pedido).toEqual({ requestId: expect.any(String), playerId: joined.playerId, playerName: 'Ana', how: 'force' })
    expect(s.approveDoorRequest(pedido?.requestId ?? '', map).applyDoor).toEqual({ wallId: 'escritorio', open: true, unlock: true })
  })

  it('5 toques não viram 5 linhas: com um pedido esperando, os seguintes respondem "pending"', () => {
    const t = mesa()
    const pedidos: HostResult[] = []
    for (let i = 0; i < 5; i += 1) {
      pedidos.push(t.s.handleMessage('c1', { type: 'door.request', wallId: 'escritorio', how: 'force' }, t.world))
      t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
    }
    expect(pedidos.filter((r) => r.doorRequest !== undefined)).toHaveLength(1)
    for (const r of pedidos.slice(1)) {
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.request.rejected', wallId: 'escritorio', reason: 'pending' } }])
    }
  })

  it('"Destrancar e abrir": destranca e abre na cena de fundo, e Ana lê que o mestre abriu', () => {
    const t = mesa()
    const pedido = t.s.handleMessage('c1', { type: 'door.request', wallId: 'escritorio', how: 'force' }, t.world).doorRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    const r = t.s.approveDoorRequest(pedido.requestId, t.world)
    expect(r.applyDoor).toEqual({ wallId: 'escritorio', open: true, unlock: true, sceneId: 'cena-mansao' })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.request.answer', answer: 'opened' } }])
    expect(t.s.isDoorRequestPending(pedido.requestId)).toBe(false)
    // Respondido, o pedido não vale uma segunda vez.
    expect(t.s.approveDoorRequest(pedido.requestId, t.world)).toEqual({ outbound: [] })
  })

  it('"Não": Ana lê que o mestre disse não, a porta fica como está, e ela pode pedir de novo', () => {
    const t = mesa()
    const pedido = t.s.handleMessage('c1', { type: 'door.request', wallId: 'escritorio', how: 'knock' }, t.world).doorRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    const r = t.s.denyDoorRequest(pedido.requestId)
    expect(r).toEqual({ outbound: [{ clientId: 'c1', msg: { type: 'door.request.answer', answer: 'denied' } }] })
    t.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
    expect(t.s.handleMessage('c1', { type: 'door.request', wallId: 'escritorio', how: 'key' }, t.world).doorRequest).toBeDefined()
  })

  it('SEGURANÇA: nada que vai ao jogador leva o nome da cena, nem o do Salão aberto no editor', () => {
    const t = mesa()
    const pedido = t.s.handleMessage('c1', { type: 'door.request', wallId: 'escritorio', how: 'force' }, t.world)
    const id = pedido.doorRequest?.requestId ?? ''
    const paraJogador = JSON.stringify([pedido.outbound, t.s.approveDoorRequest(id, t.world).outbound])
    expect(paraJogador).not.toContain('Mansão')
    expect(paraJogador).not.toContain('Salão')
    expect(paraJogador).not.toContain('cena-')
  })

  it('porta destrancada, longe ou fora da vista: não vira pedido, e a recusa não diz o que existe no escuro', () => {
    const livre = mesa(mansao(fechada))
    expect(livre.s.handleMessage('c1', { type: 'door.request', wallId: 'escritorio', how: 'force' }, livre.world).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'door.request.rejected', wallId: 'escritorio', reason: 'not_locked' } },
    ])
    const longe = mesa(mansao(trancada, 200))
    const r = longe.s.handleMessage('c1', { type: 'door.request', wallId: 'escritorio', how: 'force' }, longe.world)
    expect(r.doorRequest).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.request.rejected', wallId: 'escritorio', reason: 'far' } }])
    for (const wallId of ['acima', 'nao-existe']) {
      longe.advance(DOOR_TOGGLE_MIN_INTERVAL_MS)
      expect(longe.s.handleMessage('c1', { type: 'door.request', wallId, how: 'force' }, longe.world).outbound).toEqual([
        { clientId: 'c1', msg: { type: 'door.request.rejected', wallId, reason: 'not_visible' } },
      ])
    }
  })

  it('jogador que cai perde o pedido: o aviso do mestre não abre porta para ninguém', () => {
    const t = mesa()
    const pedido = t.s.handleMessage('c1', { type: 'door.request', wallId: 'escritorio', how: 'force' }, t.world).doorRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    t.s.disconnect('c1')
    expect(t.s.isDoorRequestPending(pedido.requestId)).toBe(false)
    expect(t.s.approveDoorRequest(pedido.requestId, t.world)).toEqual({ outbound: [] })
  })
})
