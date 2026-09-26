import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, PinExit, PinPassage, Token } from '../types/map'
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

/** Segunda saída do Templo (encruzilhada): leva ao Altar, no mesmo interior. */
const SAIDA_ALTAR: PinExit = { id: 'saida_altar', rotulo: 'Escada do altar', destino: { sceneId: INTERIOR, pinId: 'altar' } }

/** `extra` muda o Templo (posição, saídas) sem mexer no resto do mundo. */
function templo(passagem: PinPassage, extra: Partial<Pin> = {}): Pin {
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
    ...extra,
  }
}

function capital(anaX: number, anaY: number, passagem: PinPassage, extra: Partial<Pin> = {}): MapData {
  return {
    ...createEmptyMap('mapa-capital', 'Capital', 2000, 2000, 50),
    tokens: [token('ficha-ana', anaX, anaY)],
    pins: [templo(passagem, extra)],
  }
}

function interior(): MapData {
  return {
    ...createEmptyMap('mapa-templo', 'Templo', 1000, 1000, 50),
    pins: [
      { id: 'nave', x: 500, y: 500, kind: 'viagem', description: 'nave', image: null, destino: { sceneId: CAPITAL, pinId: 'templo' } },
      { id: 'altar', x: 800, y: 500, kind: 'viagem', description: 'altar', image: null, destino: { sceneId: CAPITAL, pinId: 'templo' } },
    ],
  }
}

function mundo(anaX: number, anaY: number, passagem: PinPassage, extra: Partial<Pin> = {}): HostWorld {
  return {
    open: { sceneId: CAPITAL, name: 'Capital', map: capital(anaX, anaY, passagem, extra) },
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

describe('hostSession: marco + viagem nas outras portas de entrada', () => {
  it('encruzilhada: de longe, nenhuma saída do marco vale (nem a extra), livre ou pedindo', () => {
    for (const passagem of ['livre', 'pede'] as const) {
      const w = mundo(200, 200, passagem, { rotulo: 'Nave', saidas: [SAIDA_ALTAR] })
      const t = mesa(w)
      expect(pinosDa(t.snapshot).find((p) => p.id === 'templo')?.soMarco).toBe(true)
      const r = t.s.handleMessage('c-ana', { type: 'pin.travel.request', pinId: 'templo', exitId: 'saida_altar' }, w)
      expect(recusa(r)).toBe('unavailable')
      expect(r.applyTransfer).toBeUndefined()
      expect(r.travelRequest).toBeUndefined()
    }
  })

  it('controle da encruzilhada: na porta do Templo, a saída extra leva ao Altar', () => {
    const w = mundo(1450, 300, 'livre', { rotulo: 'Nave', saidas: [SAIDA_ALTAR] })
    const t = mesa(w)
    const r = t.s.handleMessage('c-ana', { type: 'pin.travel.request', pinId: 'templo', exitId: 'saida_altar' }, w)
    expect(recusa(r)).toBeNull()
    expect(r.applyTransfer).toMatchObject({ tokenId: 'ficha-ana', fromSceneId: CAPITAL, toSceneId: INTERIOR })
  })

  it('"Deixar ir": o mestre arrasta o Templo para a névoa nunca vista antes de aprovar, e a aprovação é recusada', () => {
    const perto = mundo(1450, 300, 'pede')
    const t = mesa(perto)
    const pedido = t.pedir().travelRequest
    if (pedido === undefined) throw new Error('o pedido de perto deveria chegar ao mestre')
    // Mesmo mundo, Ana no mesmo lugar; só o marco foi para longe, onde ela nunca olhou.
    const movido = mundo(1450, 300, 'pede', { x: 1500, y: 1800 })
    expect(pinosDa(t.s.broadcast(movido)).find((p) => p.id === 'templo')?.soMarco).toBe(true)
    const r = t.s.approveTravel(pedido.requestId, movido)
    expect(r.applyTransfer).toBeUndefined()
    expect(recusa(r)).toBe('unavailable')
  })

  it('controle do "Deixar ir": com o Templo no lugar, a mesma aprovação leva a Ana', () => {
    const perto = mundo(1450, 300, 'pede')
    const t = mesa(perto)
    const pedido = t.pedir().travelRequest
    if (pedido === undefined) throw new Error('o pedido de perto deveria chegar ao mestre')
    expect(t.s.approveTravel(pedido.requestId, perto).applyTransfer).toMatchObject({ tokenId: 'ficha-ana', toSceneId: INTERIOR })
  })

  it('explorado continua valendo: Ana que esteve na porta e voltou ao cais trata o marco como todo pino (de longe, "far", e não o "só marco")', () => {
    const t = mesa(mundo(1450, 300, 'livre'))
    const cais = mundo(200, 200, 'livre')
    // Longe agora, mas o Templo ficou no explorado dela: não é "só marco".
    expect(pinosDa(t.s.broadcast(cais)).find((p) => p.id === 'templo')?.soMarco).toBeUndefined()
    // SÓ DE PERTO: de longe todo pino visto responde "far" — o explorado não é
    // mais atalho de viagem, e o marco explorado responde igual a todo pino
    // (o "só marco" nunca visto seria o `unavailable` genérico).
    const r = t.s.handleMessage('c-ana', { type: 'pin.travel.request', pinId: 'templo' }, cais)
    expect(recusa(r)).toBe('far')
    expect(r.applyTransfer).toBeUndefined()
  })
})
