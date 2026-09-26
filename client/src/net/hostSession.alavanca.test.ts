import { describe, expect, it } from 'vitest'
import { buildPin, createEmptyMap, setWallDoor } from '../lib/mapFactory'
import type { MapData, Pin, Token, Wall } from '../types/map'
import { createHostSession, DOOR_TOGGLE_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

/**
 * ALAVANCA na sessão do mestre. Diego, encostado na alavanca da cripta, puxa:
 * a porta ligada abre (ou fecha) no mapa do mestre, e a colisão e a visão de
 * todos acompanham no broadcast seguinte. Quem está longe, quem não vê a
 * alavanca e a alavanca de porta trancada não movem nada. A resposta ao
 * jogador nunca diz qual porta, nem se ela abriu ou fechou.
 */

const CODE = 'AB12CD'
const GRID = 40
const RADIUS = 700
/** Quem puxou: o aviso do mestre diz quem mexeu na porta (nada disto vai ao jogador). */
const DIEGO = { playerId: 'id-1', playerName: 'Diego' }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function porta(id: string, x: number, locked = false): Wall {
  return { id, x1: x, y1: 0, x2: x, y2: 1000, blocksLight: true, blocksMove: true, door: { open: false, locked, kind: 'normal' } }
}

function alavanca(id: string, x: number, y: number, portaLigada: string | undefined): Pin {
  const pin: Pin = { ...buildPin(id, { x, y }, 'alavanca'), description: 'Alavanca' }
  return portaLigada === undefined ? pin : { ...pin, portaLigada }
}

/**
 * Cripta: a porta da cripta em x=500 e o cofre em x=800, os dois fechados.
 * Diego (180,200) encosta na alavanca da cripta; Bruno (300,600) vê a
 * alavanca de longe; Carla (700,200) está do outro lado da porta fechada.
 */
function cripta(walls: Wall[] = [porta('porta-cripta', 500), porta('porta-cofre-7c1e', 800)], pins?: Pin[]): MapData {
  return {
    ...createEmptyMap('mapa-cripta', 'Cripta', 1000, 1000, GRID),
    walls,
    pins: pins ?? [alavanca('alav-cripta', 200, 200, 'porta-cripta'), alavanca('alav-cofre', 200, 240, 'porta-cofre-7c1e'), alavanca('alav-solta', 160, 240, undefined)],
    tokens: [ficha('diego', 180, 200), ficha('bruno', 300, 600), ficha('carla', 700, 200)],
  }
}

function mesa(map: HostWorld | MapData = cripta()) {
  let clock = 0
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => clock, randomId: () => `id-${(n += 1)}` })
  for (const [clientId, nome, id] of [
    ['c1', 'Diego', 'diego'],
    ['c2', 'Bruno', 'bruno'],
    ['c3', 'Carla', 'carla'],
  ] as const) { // literal: cada linha vira tupla de 3 textos, não string[]
    const joined = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, map).outbound[0]?.msg
    if (joined?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(joined.playerId, id)
  }
  // O primeiro envio: o broadcast só manda de novo quando a tela de alguém muda.
  const inicial = s.broadcast(map)
  return {
    s,
    inicial,
    puxar: (clientId: string, pinId: string, world: HostWorld | MapData = map): HostResult => {
      clock += DOOR_TOGGLE_MIN_INTERVAL_MS
      return s.handleMessage(clientId, { type: 'pin.lever', pinId }, world)
    },
  }
}

/** O que o integrador faz com `applyDoor` (o mesmo de `App.tsx`). */
function aplicar(map: MapData, result: HostResult): MapData {
  const change = result.applyDoor
  if (change === undefined) throw new Error('esperava applyDoor')
  const wall = map.walls.find((w) => w.id === change.wallId)
  if (wall?.door == null) throw new Error('porta sumiu')
  return setWallDoor(map, change.wallId, { ...wall.door, open: change.open })
}

function snapshotFor(result: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

describe('protocolo: pin.lever', () => {
  it('aceita a forma certa sem campo extra; recusa id vazio, ausente ou que não é texto', () => {
    expect(parsePlayerMessage({ type: 'pin.lever', pinId: 'alav-cripta', wallId: 'x' })).toEqual({ type: 'pin.lever', pinId: 'alav-cripta' })
    expect(parsePlayerMessage({ type: 'pin.lever', pinId: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.lever' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.lever', pinId: 7 })).toBeNull()
  })
})

describe('puxar a alavanca', () => {
  it('Diego encostado: a porta ligada abre, e a resposta não diz qual porta nem o estado dela', () => {
    const t = mesa()
    const r = t.puxar('c1', 'alav-cripta')
    expect(r.applyDoor).toEqual({ wallId: 'porta-cripta', open: true, ...DIEGO })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.lever.answer', answer: 'pulled' } }])
  })

  it('puxar de novo fecha a porta aberta', () => {
    const map = cripta()
    const t = mesa(map)
    const aberta = aplicar(map, t.puxar('c1', 'alav-cripta'))
    expect(t.puxar('c1', 'alav-cripta', aberta).applyDoor).toEqual({ wallId: 'porta-cripta', open: false, ...DIEGO })
  })

  it('a visão acompanha: com a porta aberta Diego passa a ver Carla do outro lado', () => {
    const map = cripta()
    const t = mesa(map)
    expect(snapshotFor(t.inicial, 'c1').map.tokens.map((tk) => tk.id)).not.toContain('carla')
    const aberta = aplicar(map, t.puxar('c1', 'alav-cripta'))
    expect(snapshotFor(t.s.broadcast(aberta), 'c1').map.tokens.map((tk) => tk.id)).toContain('carla')
  })

  it('a colisão acompanha: atravessar a porta é recusado fechada e aceito aberta', () => {
    const map = cripta()
    const t = mesa(map)
    const antes = t.s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'diego', x: 580, y: 200 }, map)
    expect(antes.applyMove).toBeUndefined()
    expect(antes.outbound[0]?.msg.type).toBe('token.move.rejected')
    const aberta = aplicar(map, t.puxar('c1', 'alav-cripta'))
    const depois = t.s.handleMessage('c1', { type: 'token.move', reqId: 'r2', tokenId: 'diego', x: 580, y: 200 }, aberta)
    expect(depois.applyMove).toEqual({ tokenId: 'diego', x: 580, y: 200 })
  })

  it('porta de OUTRA sala, fora da vista: abre do mesmo jeito, e o id dela não sai para ninguém', () => {
    const t = mesa()
    const r = t.puxar('c1', 'alav-cofre')
    expect(r.applyDoor).toEqual({ wallId: 'porta-cofre-7c1e', open: true, ...DIEGO })
    expect(r.outbound.length).toBe(1)
    expect(JSON.stringify(r.outbound)).not.toContain('porta-cofre-7c1e')
  })

  it('cena de fundo: o integrador recebe a cena onde a porta mora', () => {
    const world: HostWorld = {
      open: { sceneId: 'cena-salao', name: 'Salão', map: createEmptyMap('mapa-salao', 'Salão', 1000, 1000, GRID) },
      background: [{ sceneId: 'cena-cripta', name: 'Cripta', map: cripta() }],
    }
    const t = mesa(world)
    expect(t.puxar('c1', 'alav-cripta').applyDoor).toEqual({ wallId: 'porta-cripta', open: true, sceneId: 'cena-cripta', ...DIEGO })
  })
})

describe('quando a alavanca não move nada', () => {
  it('Bruno vê a alavanca de longe: far, e nenhuma porta muda', () => {
    const t = mesa()
    const r = t.puxar('c2', 'alav-cripta')
    expect(r.applyDoor).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c2', msg: { type: 'pin.lever.rejected', reason: 'far' } }])
  })

  it('Carla, atrás da porta fechada, não vê a alavanca: unavailable, igual a pino inexistente', () => {
    const t = mesa()
    const escondida = t.puxar('c3', 'alav-cripta')
    const inexistente = t.puxar('c3', 'nao-existe')
    expect(escondida.applyDoor).toBeUndefined()
    expect(escondida.outbound).toEqual([{ clientId: 'c3', msg: { type: 'pin.lever.rejected', reason: 'unavailable' } }])
    expect(inexistente.outbound).toEqual([{ clientId: 'c3', msg: { type: 'pin.lever.rejected', reason: 'unavailable' } }])
  })

  it('pino que não é alavanca: unavailable', () => {
    const map = cripta(undefined, [{ ...buildPin('marco', { x: 200, y: 200 }, 'exclamacao'), portaLigada: 'porta-cripta' }])
    const t = mesa(map)
    const r = t.puxar('c1', 'marco')
    expect(r.applyDoor).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.lever.rejected', reason: 'unavailable' } }])
  })

  it('porta ligada TRANCADA, alavanca sem porta ou porta apagada: stuck — o mesmo motivo, que não diz qual', () => {
    const trancada = mesa(cripta([porta('porta-cripta', 500, true), porta('porta-cofre-7c1e', 800)]))
    const r1 = trancada.puxar('c1', 'alav-cripta')
    expect(r1.applyDoor).toBeUndefined()
    expect(r1.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.lever.rejected', reason: 'stuck' } }])

    const t = mesa()
    const r2 = t.puxar('c1', 'alav-solta')
    expect(r2.applyDoor).toBeUndefined()
    expect(r2.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.lever.rejected', reason: 'stuck' } }])

    const semCofre = mesa(cripta([porta('porta-cripta', 500)]))
    const r3 = semCofre.puxar('c1', 'alav-cofre')
    expect(r3.applyDoor).toBeUndefined()
    expect(r3.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.lever.rejected', reason: 'stuck' } }])
  })

  it('pedidos em rajada: o excesso morre em silêncio', () => {
    const map = cripta()
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 1000, randomId: () => `id-${(n += 1)}` })
    const joined = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Diego' }, map).outbound[0]?.msg
    if (joined?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(joined.playerId, 'diego')
    s.broadcast(map)
    expect(s.handleMessage('c1', { type: 'pin.lever', pinId: 'alav-cripta' }, map).applyDoor).toEqual({ wallId: 'porta-cripta', open: true, ...DIEGO })
    const rajada = s.handleMessage('c1', { type: 'pin.lever', pinId: 'alav-cripta' }, map)
    expect(rajada.applyDoor).toBeUndefined()
    expect(rajada.outbound).toEqual([])
  })

  it('quem não entrou na sala recebe not_joined', () => {
    const t = mesa()
    expect(t.s.handleMessage('intruso', { type: 'pin.lever', pinId: 'alav-cripta' }, cripta()).outbound).toEqual([
      { clientId: 'intruso', msg: { type: 'error', reason: 'not_joined' } },
    ])
  })
})
