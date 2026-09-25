import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, PinExit, Token } from '../types/map'
import { createHostSession, TRAVEL_REQUEST_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * ENCRUZILHADA no host: o pedido leva a saída escolhida (`exitId`), o host a
 * confere contra as saídas DAQUELE pino, o mestre lê o rótulo dela, e o
 * "Deixar ir" só vale para o destino que o aviso disse.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const TORRE = 'cena-torre'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, description: string, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description, image: null, destino, ...extra }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

const SAIDA_TORRE: PinExit = { id: 'saida_torre', rotulo: 'Escada da torre', destino: { sceneId: TORRE, pinId: 'chegada-torre' } }

/**
 * O Salão aberto com a encruzilhada (principal para a Cripta, extra para a
 * Torre) e um segundo pino, também encruzilhada, com uma saída `saida_poco`
 * que NÃO é da primeira. `torre` troca o par da Torre (religar).
 */
function mundo(torre: { pinoPar: string } = { pinoPar: 'chegada-torre' }): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Aventura', 40, 10, 50),
    // Encostado na encruzilhada e no alçapão: pino só atravessa de perto.
    tokens: [token('heroi', 425, 225)],
    pins: [
      viagem('cruz', 400, 200, 'Encruzilhada', { sceneId: CRIPTA, pinId: 'escada-b' }, {
        rotulo: 'Porta da cripta',
        saidas: [{ ...SAIDA_TORRE, destino: { sceneId: TORRE, pinId: torre.pinoPar } }],
      }),
      viagem('outro', 450, 250, 'Alçapão', { sceneId: CRIPTA, pinId: 'fundo-b' }, {
        saidas: [{ id: 'saida_poco', rotulo: 'Poço', destino: { sceneId: TORRE, pinId: 'poco-c' } }],
      }),
    ],
  }
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 40, 10, 50),
    pins: [
      viagem('escada-b', 1000, 250, 'Escada que sobe', { sceneId: SALAO, pinId: 'cruz' }),
      viagem('fundo-b', 100, 100, 'Fundo', { sceneId: SALAO, pinId: 'outro' }),
    ],
  }
  const torreMapa: MapData = {
    ...createEmptyMap('mapa-torre', 'Torre Alta', 40, 10, 50),
    pins: [
      viagem('chegada-torre', 600, 300, 'Topo da escada', { sceneId: SALAO, pinId: 'cruz' }),
      viagem('outra-chegada', 900, 300, 'Sacada', { sceneId: SALAO, pinId: 'cruz' }),
      viagem('poco-c', 300, 300, 'Boca do poço', { sceneId: SALAO, pinId: 'outro' }),
    ],
  }
  return {
    open: { sceneId: SALAO, name: 'Salão', map: salao },
    background: [
      { sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta },
      { sceneId: TORRE, name: 'Torre Alta', map: torreMapa },
    ],
  }
}

function mesa() {
  let clock = 1_000_000
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
  s.broadcast(w)
  return {
    s,
    w,
    advance: (ms: number) => {
      clock += ms
    },
    pedir: (pinId: string, exitId?: string, world: HostWorld = w) =>
      s.handleMessage('c1', exitId === undefined ? { type: 'pin.travel.request', pinId } : { type: 'pin.travel.request', pinId, exitId }, world),
  }
}

function recusa(r: HostResult): string | null {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'pin.travel.rejected' ? msg.reason : null
}

describe('hostSession: encruzilhada (pino de viagem com várias saídas)', () => {
  it('exitId válido: o mestre lê o RÓTULO da saída e a cena dela', () => {
    const t = mesa()
    const r = t.pedir('cruz', 'saida_torre')
    expect(r.outbound).toEqual([])
    expect(r.travelRequest).toMatchObject({ pinLabel: 'Escada da torre', toSceneId: TORRE, toSceneName: 'Torre Alta' })
  })

  it('sem exitId (cliente antigo) vale a saída principal, com o rótulo dela', () => {
    const t = mesa()
    expect(t.pedir('cruz').travelRequest).toMatchObject({ pinLabel: 'Porta da cripta', toSceneId: CRIPTA })
  })

  it('"Deixar ir" leva ao par DAQUELA saída', () => {
    const t = mesa()
    const pedido = t.pedir('cruz', 'saida_torre').travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    const r = t.s.approveTravel(pedido.requestId, t.w)
    expect(r.applyTransfer).toMatchObject({ tokenId: 'heroi', fromSceneId: SALAO, toSceneId: TORRE })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed' } }])
  })

  it('SEGURANÇA — exitId de OUTRO pino é recusado com o motivo genérico; o mesmo id no pino dele vale', () => {
    const t = mesa()
    const r = t.pedir('cruz', 'saida_poco')
    expect(recusa(r)).toBe('unavailable')
    expect(r.travelRequest).toBeUndefined()
    // Controle positivo: a saída existe e está ligada — só não é da encruzilhada.
    t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS)
    expect(t.pedir('outro', 'saida_poco').travelRequest).toMatchObject({ pinLabel: 'Poço', toSceneId: TORRE })
  })

  it('exitId inventado é recusado, e exitId fora da forma é mensagem inválida', () => {
    const t = mesa()
    expect(recusa(t.pedir('cruz', 'saida_que_nao_existe'))).toBe('unavailable')
    for (const exitId of ['', 7, 'x'.repeat(65)]) {
      const r = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'cruz', exitId }, t.w)
      expect(r.outbound[0]?.msg).toEqual({ type: 'error', reason: 'invalid_message' })
    }
  })

  it('a saída religada entre o pedido e a aprovação: o "Deixar ir" não vale para o destino novo', () => {
    const t = mesa()
    const pedido = t.pedir('cruz', 'saida_torre').travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    // O mestre religa a saída da Torre para outro pino de chegada depois de ler o aviso.
    const religado = mundo({ pinoPar: 'outra-chegada' })
    const r = t.s.approveTravel(pedido.requestId, religado)
    expect(r.applyTransfer).toBeUndefined()
    expect(recusa(r)).toBe('unavailable')
  })

  it('controle: sem religar, o mesmo "Deixar ir" vale', () => {
    const t = mesa()
    const pedido = t.pedir('cruz', 'saida_torre').travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria valer')
    expect(t.s.approveTravel(pedido.requestId, mundo()).applyTransfer).toMatchObject({ toSceneId: TORRE })
  })
})
