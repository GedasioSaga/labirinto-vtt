import { describe, expect, it } from 'vitest'
import { arrivalSpot } from '../lib/pinTravel'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Stair, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * ESCADA QUE LEVA A OUTRO ANDAR no host: Bruno toca a escada do Térreo, passa
 * (livre) e chega ao pé da escada do 1º andar. O pedido pela escada escondida
 * é recusado com o motivo genérico de sempre — o id do pino não atravessa o escuro.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const TERREO = 'cena-terreo'
const ANDAR1 = 'cena-andar1'
const BOCA_DE_CIMA = { x: 1000, y: 250 }

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function escada(id: string, direction: Stair['direction'], x: number, y: number, extra: Partial<Stair> = {}): Stair {
  return { id, shape: 'straight', direction, segments: [{ x1: x, y1: y, x2: x, y2: y - 100 }], stepWidth: 50, ...extra }
}

function pinoDaEscada(id: string, stairId: string, x: number, y: number, destino: Pin['destino'], passagem: Pin['passagem']): Pin {
  return { id, x, y, kind: 'viagem', description: '', image: null, destino, passagem, escadaId: stairId }
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

function andar1(): MapData {
  return {
    ...createEmptyMap('mapa-andar1', 'Primeiro andar', 40, 10, 50),
    stairs: [escada('escada-de-cima', 'down', BOCA_DE_CIMA.x, BOCA_DE_CIMA.y)],
    pins: [pinoDaEscada('pino-de-cima', 'escada-de-cima', BOCA_DE_CIMA.x, BOCA_DE_CIMA.y, { sceneId: TERREO, pinId: 'pino-de-baixo' }, 'livre')],
  }
}

function terreo(passagem: Pin['passagem'], escadaSecreta: boolean): MapData {
  return {
    ...createEmptyMap('mapa-terreo', 'Térreo', 40, 10, 50),
    // Bruno encostado no pé da escada: o pino de viagem só atravessa de perto.
    tokens: [token('bruno', 250, 200)],
    stairs: [escada('escada-de-baixo', 'up', 300, 200, escadaSecreta ? { secret: true } : {})],
    pins: [pinoDaEscada('pino-de-baixo', 'escada-de-baixo', 300, 200, { sceneId: ANDAR1, pinId: 'pino-de-cima' }, passagem)],
  }
}

function mundo(passagem: Pin['passagem'], escadaSecreta = false): HostWorld {
  return {
    open: { sceneId: TERREO, name: 'Térreo', map: terreo(passagem, escadaSecreta) },
    background: [{ sceneId: ANDAR1, name: 'Primeiro andar', map: andar1() }],
  }
}

function mesa(w: HostWorld) {
  const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 1_000_000, randomId: () => 'id-1' })
  const bruno = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Bruno' }, w).outbound)
  s.assignToken(bruno.playerId, 'bruno')
  s.broadcast(w)
  return { s, tocar: (pinId: string) => s.handleMessage('c1', { type: 'pin.travel.request', pinId }, w) }
}

describe('hostSession: escada que leva a outro andar', () => {
  it('livre: Bruno passa pela escada e chega ao pé da escada de cima, sem esperar o mestre', () => {
    const r = mesa(mundo('livre')).tocar('pino-de-baixo')
    const par = andar1().pins[0]
    const esperado = arrivalSpot(andar1(), par, 1)
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toMatchObject({ tokenId: 'bruno', fromSceneId: TERREO, toSceneId: ANDAR1, x: esperado.x, y: esperado.y })
    expect(Math.hypot(esperado.x - BOCA_DE_CIMA.x, esperado.y - BOCA_DE_CIMA.y)).toBeLessThanOrEqual(50)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed' } }])
  })

  it('pede: o mestre lê "Escada" e o nome do andar; o jogador não recebe nada do destino', () => {
    const r = mesa(mundo('pede')).tocar('pino-de-baixo')
    expect(r.travelRequest).toMatchObject({ pinLabel: 'Escada', toSceneId: ANDAR1, toSceneName: 'Primeiro andar' })
    expect(r.outbound).toEqual([])
  })

  it('escada secreta: o pedido pelo pino dela é recusado com o motivo genérico, e nada chega ao mestre', () => {
    const r = mesa(mundo('livre', true)).tocar('pino-de-baixo')
    expect(recusa(r)).toBe('unavailable')
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toBeUndefined()
  })

  it('o recorte que o jogador recebe traz a escada e o pino dela, sem o destino nem o nome do andar', () => {
    const w = mundo('livre')
    const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 1_000_000, randomId: () => 'id-1' })
    const bruno = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Bruno' }, w).outbound)
    s.assignToken(bruno.playerId, 'bruno')
    const enviado = s.broadcast(w).outbound.find((o) => o.clientId === 'c1')?.msg
    if (enviado === undefined || (enviado.type !== 'snapshot' && enviado.type !== 'delta')) throw new Error('esperava o mapa do jogador')
    expect(enviado.map.pins.map((p) => [p.id, p.escadaId])).toEqual([['pino-de-baixo', 'escada-de-baixo']])
    const tudo = JSON.stringify(enviado)
    expect(tudo).not.toContain(ANDAR1)
    expect(tudo).not.toContain('Primeiro andar')
    expect(tudo).not.toContain('pino-de-cima')
  })
})
