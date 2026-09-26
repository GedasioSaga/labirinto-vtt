import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * MOTIVO DO BLOQUEIO no host: o snapshot que sai para o jogador leva o motivo
 * do pino trancado ("desabou") e nada da cena para onde ele levaria. Quando o
 * mestre reabre o pino, o motivo guardado deixa de sair no broadcast seguinte.
 * O pedido de passagem por ele continua recusado, com o motivo genérico.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const NOME_DA_CRIPTA = 'Cripta do Rei Morto'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function caracol(extra: Partial<Pin> = {}): Pin {
  return {
    id: 'caracol',
    x: 400,
    y: 200,
    kind: 'viagem',
    description: 'Escada em caracol',
    image: null,
    destino: { sceneId: CRIPTA, pinId: 'fundo' },
    passagem: 'trancada',
    motivo: 'desabou',
    ...extra,
  }
}

function mundo(pin: Pin): HostWorld {
  // Diego encostado na escada (50 px): o pino de viagem só atravessa (e só recusa pelo modo) de perto.
  const salao: MapData = { ...createEmptyMap('mapa-salao', 'Salão', 40, 10, 50), tokens: [token('ficha-diego', 350, 200)], pins: [pin] }
  return {
    open: { sceneId: SALAO, name: 'Salão', map: salao },
    background: [
      {
        sceneId: CRIPTA,
        name: NOME_DA_CRIPTA,
        map: {
          ...createEmptyMap('mapa-cripta', NOME_DA_CRIPTA, 40, 10, 50),
          pins: [{ id: 'fundo', x: 1000, y: 250, kind: 'viagem', description: 'Fundo', image: null, destino: { sceneId: SALAO, pinId: 'caracol' } }],
        },
      },
    ],
  }
}

function welcomeOf(result: HostResult): string {
  const first = result.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function pinoDoDiego(result: HostResult): Pin {
  const msg: HostMessage | undefined = result.outbound.find((o) => o.clientId === 'c-diego')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot para c-diego')
  const pin = msg.map.pins.find((p) => p.id === 'caracol')
  if (pin === undefined) throw new Error('o caracol devia chegar ao Diego')
  return pin
}

function mesa(w: HostWorld) {
  const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 1_000_000, randomId: () => 'id-1' })
  const diego = welcomeOf(s.handleMessage('c-diego', { type: 'join', code: CODE, name: 'Diego' }, w))
  s.assignToken(diego, 'ficha-diego')
  return s
}

describe('hostSession: motivo do bloqueio', () => {
  it('o snapshot do jogador leva "desabou" e nada da cena de destino', () => {
    const w = mundo(caracol())
    const r = mesa(w).broadcast(w)
    const pin = pinoDoDiego(r)
    expect(pin.passagem).toBe('trancada')
    expect(pin.motivo).toBe('desabou')
    const pacote = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-diego'))
    expect(pacote).not.toContain(CRIPTA)
    expect(pacote).not.toContain(NOME_DA_CRIPTA)
  })

  it('o mestre reabre o pino: o motivo guardado some do broadcast seguinte', () => {
    const w = mundo(caracol())
    const s = mesa(w)
    expect(pinoDoDiego(s.broadcast(w)).motivo).toBe('desabou')
    const reaberto = mundo(caracol({ passagem: 'livre' }))
    const pin = pinoDoDiego(s.broadcast(reaberto))
    expect(pin.passagem).toBe('livre')
    expect('motivo' in pin).toBe(false)
    expect(JSON.stringify(pin)).not.toContain('desabou')
  })

  it('pedido de passagem pelo pino que desabou é recusado com o motivo genérico, sem transferência', () => {
    // Trancado MUDO: o que aceita tentativas (o padrão) vira pedido ao mestre
    // (hostSession.pinoTrancado); o mudo é a recusa genérica que este teste prova.
    const w = mundo(caracol({ mudo: true }))
    const s = mesa(w)
    s.broadcast(w)
    const r = s.handleMessage('c-diego', { type: 'pin.travel.request', pinId: 'caracol' }, w)
    const msg = r.outbound[0]?.msg
    expect(msg?.type === 'pin.travel.rejected' ? msg.reason : null).toBe('unavailable')
    expect(r.applyTransfer).toBeUndefined()
    expect(r.travelRequest).toBeUndefined()
    expect(JSON.stringify(r.outbound)).not.toContain(NOME_DA_CRIPTA)
  })
})
