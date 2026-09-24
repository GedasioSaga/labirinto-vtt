import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, PinPassage, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * MARCO + VIAGEM no host: o Templo que a cidade inteira conhece chega à Ana
 * mesmo na névoa, mas VER o marco de longe não é estar lá. A passagem por ele
 * só vale quando o pino está à vista ou explorado, como todo pino de viagem —
 * senão o marco vira teletransporte de qualquer ponto do mapa.
 */

const CODE = 'AB12CD'
const RADIUS = 300
const CAPITAL = 'cena-capital'
const INTERIOR = 'cena-templo'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function templo(passagem: PinPassage): Pin {
  return {
    id: 'templo',
    x: 1500,
    y: 300,
    kind: 'viagem',
    description: 'Templo de Pelor',
    image: null,
    marco: true,
    passagem,
    destino: { sceneId: INTERIOR, pinId: 'nave' },
  }
}

function capital(anaX: number, anaY: number, passagem: PinPassage): MapData {
  return {
    ...createEmptyMap('mapa-capital', 'Capital', 2000, 2000, 50),
    tokens: [token('ficha-ana', anaX, anaY)],
    pins: [templo(passagem)],
  }
}

function interior(): MapData {
  return {
    ...createEmptyMap('mapa-templo', 'Templo', 1000, 1000, 50),
    pins: [{ id: 'nave', x: 500, y: 500, kind: 'viagem', description: 'nave', image: null, destino: { sceneId: CAPITAL, pinId: 'templo' } }],
  }
}

function mundo(anaX: number, anaY: number, passagem: PinPassage): HostWorld {
  return {
    open: { sceneId: CAPITAL, name: 'Capital', map: capital(anaX, anaY, passagem) },
    background: [{ sceneId: INTERIOR, name: 'Templo', map: interior() }],
  }
}

function welcomeOf(result: HostResult): string {
  const first = result.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function pinosDa(result: HostResult): Pin[] {
  const msg: HostMessage | undefined = result.outbound.find((o) => o.clientId === 'c-ana')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot para a Ana')
  return msg.map.pins
}

function recusa(r: HostResult): string | null {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'pin.travel.rejected' ? msg.reason : null
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
  const ana = welcomeOf(s.handleMessage('c-ana', { type: 'join', code: CODE, name: 'Ana' }, w))
  s.assignToken(ana, 'ficha-ana')
  const snapshot = s.broadcast(w)
  return { s, snapshot, pedir: () => s.handleMessage('c-ana', { type: 'pin.travel.request', pinId: 'templo' }, w) }
}

describe('hostSession: pino marco que também é de viagem', () => {
  it('Ana no cais, que nunca foi ao Templo: vê o marco, mas a passagem livre é recusada e ela não troca de cena', () => {
    const t = mesa(mundo(200, 200, 'livre'))
    expect(pinosDa(t.snapshot).map((p) => p.id)).toEqual(['templo'])
    const r = t.pedir()
    expect(recusa(r)).toBe('unavailable')
    expect(r.applyTransfer).toBeUndefined()
    expect(r.travelRequest).toBeUndefined()
  })

  it('no modo "pede ao mestre", o pedido de longe também não chega ao mestre', () => {
    const t = mesa(mundo(200, 200, 'pede'))
    const r = t.pedir()
    expect(recusa(r)).toBe('unavailable')
    expect(r.travelRequest).toBeUndefined()
  })

  it('o recorte avisa o cartão: o marco visto de longe sai marcado soMarco', () => {
    const t = mesa(mundo(200, 200, 'livre'))
    expect(pinosDa(t.snapshot).find((p) => p.id === 'templo')?.soMarco).toBe(true)
  })

  it('controle: Ana na porta do Templo passa direto, e o pino não sai marcado', () => {
    const t = mesa(mundo(1450, 300, 'livre'))
    expect(pinosDa(t.snapshot).find((p) => p.id === 'templo')?.soMarco).toBeUndefined()
    const r = t.pedir()
    expect(recusa(r)).toBeNull()
    expect(r.applyTransfer).toMatchObject({ tokenId: 'ficha-ana', fromSceneId: CAPITAL, toSceneId: INTERIOR })
  })
})
