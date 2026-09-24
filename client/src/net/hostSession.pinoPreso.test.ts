import { describe, expect, it } from 'vitest'
import { createEmptyMap, setTokenPosition } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PINO PRESO A UMA FICHA, no host: o mestre move o navio e a prancha (pino de
 * viagem presa a ele) chega ao jogador no lugar novo, a viagem por ela continua
 * valendo, e o jogador nunca recebe a qual ficha o pino está preso. Com o navio
 * fora da visão, a prancha não sai — nem por pedido de viagem direto ao host.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const PORTO = 'cena-porto'
const CONVES = 'cena-conves'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: id, image: null, destino, ...extra }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

function recusa(r: HostResult): string | null {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'pin.travel.rejected' ? msg.reason : null
}

/** O mapa que o jogador `c1` recebeu na última difusão. */
function mapaDoJogador(r: HostResult): MapData {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot' && msg?.type !== 'delta') throw new Error('esperava o mapa do jogador')
  return msg.map
}

function porto(): MapData {
  return {
    ...createEmptyMap('mapa-porto', 'Porto de Vel', 80, 10, 50),
    tokens: [token('heroi', 200, 200), token('navio', 400, 200)],
    pins: [viagem('prancha', 420, 200, { sceneId: CONVES, pinId: 'escada' }, { presoA: 'navio' })],
  }
}

function conves(): MapData {
  return {
    ...createEmptyMap('mapa-conves', 'Convés', 20, 10, 50),
    tokens: [],
    pins: [viagem('escada', 300, 250, { sceneId: PORTO, pinId: 'prancha' })],
  }
}

function mundo(portoMap: MapData): HostWorld {
  return {
    open: { sceneId: PORTO, name: 'Porto de Vel', map: portoMap },
    background: [{ sceneId: CONVES, name: 'Convés', map: conves() }],
  }
}

function mesa(w: HostWorld) {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
  s.assignToken(ana.playerId, 'heroi')
  s.broadcast(w)
  return s
}

describe('hostSession: pino preso a uma ficha', () => {
  it('o navio anda e a prancha chega ao jogador no lugar novo, sem dizer a que ficha está presa', () => {
    const s = mesa(mundo(porto()))
    const w = mundo(setTokenPosition(porto(), 'navio', 600, 200))
    const r = s.broadcast(w)
    const mapa = mapaDoJogador(r)
    expect(mapa.pins.map((p) => [p.id, p.x, p.y])).toEqual([['prancha', 620, 200]])
    expect(JSON.stringify(r.outbound)).not.toContain('presoA')
  })

  it('a viagem pela prancha continua valendo depois que o navio andou', () => {
    const s = mesa(mundo(porto()))
    const w = mundo(setTokenPosition(porto(), 'navio', 600, 200))
    s.broadcast(w)
    const pedido = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'prancha' }, w).travelRequest
    expect(pedido).toMatchObject({ toSceneId: CONVES })
  })

  /**
   * O cais já foi explorado (o herói esteve lá) e o herói agora está a 2300 px,
   * longe da visão. Um pino PARADO no cais continua saindo pela memória — é
   * anotação fixa. A prancha presa ao navio não: ela contaria onde o navio
   * está agora, e o navio ele não vê.
   */
  function heroiLonge(presa: boolean): { s: ReturnType<typeof mesa>; w: HostWorld } {
    const base = porto()
    const inicio = presa ? base : { ...base, pins: base.pins.map((p) => ({ ...p, presoA: undefined })) }
    const s = mesa(mundo(inicio))
    const longe = setTokenPosition(inicio, 'heroi', 2500, 200)
    s.broadcast(mundo(longe))
    // O navio anda DENTRO do cais explorado, fora da visão do herói.
    const w = mundo(setTokenPosition(longe, 'navio', 600, 200))
    return { s, w }
  }

  it('navio fora da visão: a prancha não sai, nem pela memória, e o pedido direto é recusado com o motivo genérico', () => {
    const { s, w } = heroiLonge(true)
    const r = s.broadcast(w)
    const mapa = mapaDoJogador(r)
    expect(mapa.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(mapa.pins).toEqual([])
    expect(JSON.stringify(r.outbound)).not.toContain('prancha')
    const pedido = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'prancha' }, w)
    expect(recusa(pedido)).toBe('unavailable')
    expect(pedido.travelRequest).toBeUndefined()
  })

  it('controle: o mesmo pino, solto, sai pela memória do cais', () => {
    const { s, w } = heroiLonge(false)
    const mapa = mapaDoJogador(s.broadcast(w))
    expect(mapa.pins.map((p) => [p.id, p.x, p.y])).toEqual([['prancha', 420, 200]])
  })
})
