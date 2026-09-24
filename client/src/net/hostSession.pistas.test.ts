import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'
import { parsePlayerMessage } from './protocol'

/**
 * PAINEL PISTAS, lado da sessão: para cada pino, quem RECEBEU (o pino saiu
 * no pacote dele, com o texto) e quem LEU (abriu o cartão, `pin.read`). É o
 * que o mestre anotava no papel antes do confronto. Mesa do crime em
 * miniatura: Gabi ao lado do bilhete, Fábio no mesmo quarto, Ana longe.
 */

const CODE = 'CR1ME7'
const RADIUS = 700
const ANDAR = 'cena-andar-de-cima'
const TEXTO_DO_BILHETE = 'Bilhete: encontre-me no cais à meia-noite'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

const BILHETE: Pin = { id: 'bilhete', x: 300, y: 200, kind: 'interrogacao', description: TEXTO_DO_BILHETE, image: null }
/** Carta que só se lê de perto: a Gabi está colada nela; o Fábio a vê, mas longe. */
const CARTA: Pin = { id: 'carta', x: 300, y: 200, kind: 'exclamacao', description: 'Carta lacrada', image: null, lerDePerto: 1 }

function andar(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('mapa-andar', 'Andar de cima', 40, 10, 50),
    tokens: [ficha('ficha-gabi', 275, 200), ficha('ficha-fabio', 100, 200), ficha('ficha-ana', 1900, 200)],
    pins,
  }
}

function mundo(pins: Pin[] = [BILHETE]): HostWorld {
  return { open: { sceneId: ANDAR, name: 'Andar de cima', map: andar(pins) }, background: [] }
}

function welcomeOf(result: HostResult): string {
  const first = result.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function pinosDo(result: HostResult, clientId: string): string[] {
  const msg: HostMessage | undefined = result.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg.map.pins.map((p) => p.id)
}

function mesa(pins?: Pin[]) {
  let n = 0
  const w = mundo(pins)
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const gabi = welcomeOf(s.handleMessage('c-gabi', { type: 'join', code: CODE, name: 'Gabi' }, w))
  const fabio = welcomeOf(s.handleMessage('c-fabio', { type: 'join', code: CODE, name: 'Fábio' }, w))
  const ana = welcomeOf(s.handleMessage('c-ana', { type: 'join', code: CODE, name: 'Ana' }, w))
  s.assignToken(gabi, 'ficha-gabi')
  s.assignToken(fabio, 'ficha-fabio')
  s.assignToken(ana, 'ficha-ana')
  return { s, w, gabi, fabio, ana }
}

describe('protocolo: pin.read', () => {
  it('aceita só o id do pino, e recusa a forma errada', () => {
    expect(parsePlayerMessage({ type: 'pin.read', pinId: 'bilhete', extra: 'x' })).toEqual({ type: 'pin.read', pinId: 'bilhete' })
    expect(parsePlayerMessage({ type: 'pin.read' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.read', pinId: '' })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.read', pinId: 42 })).toBeNull()
    expect(parsePlayerMessage({ type: 'pin.read', pinId: 'x'.repeat(65) })).toBeNull()
  })
})

describe('hostSession: quem recebeu e quem leu cada pista', () => {
  it('recebeu = o pino saiu no pacote dele: Gabi e Fábio sim, Ana longe não', () => {
    const { s, w, gabi, fabio } = mesa()
    const r = s.broadcast(w)
    expect(pinosDo(r, 'c-gabi')).toContain('bilhete')
    expect(pinosDo(r, 'c-ana')).not.toContain('bilhete')
    expect(s.pinClues()).toEqual({ bilhete: { received: [gabi, fabio], read: [] } })
  })

  it('leu = a Gabi abriu o cartão; a leitura chega sem mandar nada de volta', () => {
    const { s, w, gabi, fabio } = mesa()
    s.broadcast(w)
    const lida = s.handleMessage('c-gabi', { type: 'pin.read', pinId: 'bilhete' }, w)
    expect(lida.outbound).toEqual([])
    expect(s.pinClues().bilhete).toEqual({ received: [gabi, fabio], read: [gabi] })
  })

  it('leitura de quem nunca recebeu o pino, ou de pino inventado, não conta', () => {
    const { s, w, gabi, fabio } = mesa()
    s.broadcast(w)
    s.handleMessage('c-ana', { type: 'pin.read', pinId: 'bilhete' }, w)
    s.handleMessage('c-gabi', { type: 'pin.read', pinId: 'inventado' }, w)
    expect(s.pinClues()).toEqual({ bilhete: { received: [gabi, fabio], read: [] } })
    expect(Object.keys(s.pinClues())).toEqual(['bilhete'])
  })

  it('pin.read malformado responde invalid_message; de quem não entrou, not_joined', () => {
    const { s, w } = mesa()
    const torta = s.handleMessage('c-gabi', { type: 'pin.read' }, w)
    expect(torta.outbound[0]?.msg).toEqual({ type: 'error', reason: 'invalid_message' })
    const estranho = s.handleMessage('c-x', { type: 'pin.read', pinId: 'bilhete' }, w)
    expect(estranho.outbound[0]?.msg).toEqual({ type: 'error', reason: 'not_joined' })
  })

  it('carta só de perto: o Fábio a vê de longe, sem o texto — não recebeu, e a leitura dele não vale', () => {
    const { s, w, gabi, fabio } = mesa([CARTA])
    const r = s.broadcast(w)
    expect(pinosDo(r, 'c-fabio')).toContain('carta')
    s.handleMessage('c-fabio', { type: 'pin.read', pinId: 'carta' }, w)
    s.handleMessage('c-gabi', { type: 'pin.read', pinId: 'carta' }, w)
    expect(s.pinClues().carta).toEqual({ received: [gabi], read: [gabi] })
    expect(s.pinClues().carta?.received).not.toContain(fabio)
  })

  it('esconder a pista do Fábio depois não apaga que ele já recebeu', () => {
    const { s, w, gabi, fabio } = mesa()
    s.broadcast(w)
    s.setPinAudience('bilhete', [gabi])
    expect(pinosDo(s.broadcast(w), 'c-fabio')).not.toContain('bilhete')
    expect(s.pinClues().bilhete).toEqual({ received: [gabi, fabio], read: [] })
  })

  it('expulsar tira o jogador das bolinhas', () => {
    const { s, w, fabio } = mesa()
    s.broadcast(w)
    s.handleMessage('c-gabi', { type: 'pin.read', pinId: 'bilhete' }, w)
    s.kick('c-gabi')
    expect(s.pinClues().bilhete).toEqual({ received: [fabio], read: [] })
  })
})
