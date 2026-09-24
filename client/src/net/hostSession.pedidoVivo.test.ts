import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * CAIXA DE PEDIDOS COM IDADE, do lado da sessão: o pedido de passagem guarda
 * a hora em que chegou, e a distância da ficha ao pino é medida AGORA, a cada
 * leitura — o mestre decide olhando o mundo de hoje, não o do pedido. Só o
 * mestre lê isto (`travelRequestStatus`); nada vai ao jogador.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const GRADE = 50

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino']): Pin {
  return { id, x, y, kind: 'viagem', description: `Escada ${id}`, image: null, destino }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/** O herói no Salão (ou na Cripta), a escada em (400, 200): 4 casas de 50 px do herói em (200, 200). */
function mundo(heroi: { cena: 'salao' | 'cripta'; x: number; y: number } = { cena: 'salao', x: 200, y: 200 }): HostWorld {
  const ficha = token('heroi', heroi.x, heroi.y)
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Salão', 40, 10, GRADE),
    tokens: heroi.cena === 'salao' ? [ficha] : [],
    pins: [viagem('escada-a', 400, 200, { sceneId: CRIPTA, pinId: 'escada-b' })],
  }
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta', 40, 10, GRADE),
    tokens: heroi.cena === 'cripta' ? [ficha] : [],
    pins: [viagem('escada-b', 1000, 250, { sceneId: SALAO, pinId: 'escada-a' })],
  }
  return { open: { sceneId: SALAO, name: 'Salão', map: salao }, background: [{ sceneId: CRIPTA, name: 'Cripta', map: cripta }] }
}

function mesa() {
  let clock = 5_000_000
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => clock,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const w = mundo()
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
  s.assignToken(ana.playerId, 'heroi')
  const pedir = () => {
    const pedido = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada-a' }, w).travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    return pedido
  }
  return {
    s,
    w,
    pedir,
    agora: () => clock,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

describe('hostSession: pedido de passagem com idade e distância', () => {
  it('guarda a hora do pedido e mede a distância da ficha ao pino', () => {
    const t = mesa()
    const pedidoEm = t.agora()
    const pedido = t.pedir()
    expect(t.s.travelRequestStatus(pedido.requestId, t.w)).toEqual({ requestedAt: pedidoEm, distanceCells: 4 })
  })

  it('a hora é a do pedido, não a da leitura: o relógio andar não a muda', () => {
    const t = mesa()
    const pedidoEm = t.agora()
    const pedido = t.pedir()
    t.advance(3 * 60_000)
    expect(t.s.travelRequestStatus(pedido.requestId, t.w)?.requestedAt).toBe(pedidoEm)
  })

  it('a distância é a de AGORA: a ficha que se afastou do pino aparece longe', () => {
    const t = mesa()
    const pedido = t.pedir()
    // 1.400 - 400 = 1.000 px = 20 casas de 50 px.
    const longe = mundo({ cena: 'salao', x: 1400, y: 200 })
    expect(t.s.travelRequestStatus(pedido.requestId, longe)).toEqual({ requestedAt: expect.any(Number), distanceCells: 20 })
  })

  it('a ficha saiu da cena do pedido: distância desconhecida (null), e não a de outro mapa', () => {
    const t = mesa()
    const pedido = t.pedir()
    // Na Cripta a ficha está a 0 px de (1000, 250)... mas o pino do pedido é o do Salão.
    const foi = mundo({ cena: 'cripta', x: 1000, y: 250 })
    expect(t.s.travelRequestStatus(pedido.requestId, foi)).toEqual({ requestedAt: expect.any(Number), distanceCells: null })
  })

  it('pedido respondido, ou que nunca existiu, não tem estado', () => {
    const t = mesa()
    const pedido = t.pedir()
    expect(t.s.travelRequestStatus('id-que-nao-existe', t.w)).toBeNull()
    t.s.denyTravel(pedido.requestId)
    expect(t.s.travelRequestStatus(pedido.requestId, t.w)).toBeNull()
  })

  it('pedido novo depois do recusado começa a contar do zero', () => {
    const t = mesa()
    t.s.denyTravel(t.pedir().requestId)
    t.advance(TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS + 60_000)
    const segundoEm = t.agora()
    const segundo = t.pedir()
    expect(t.s.travelRequestStatus(segundo.requestId, t.w)).toEqual({ requestedAt: segundoEm, distanceCells: 4 })
  })
})
