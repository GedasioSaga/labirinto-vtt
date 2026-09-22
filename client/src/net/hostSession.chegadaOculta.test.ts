import { describe, expect, it } from 'vitest'
import { arrivalSpot } from '../lib/pinTravel'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * MÃO ÚNICA no host: pedido de viagem por uma chegada oculta é recusado com o
 * motivo genérico de sempre, e a viagem pela ORIGEM continua chegando no
 * ponto do par — que está escondido do jogador, mas não deixou de existir.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'

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

const PAR_EM = { x: 1000, y: 250 }

function cripta(soChegada: boolean, comHeroi: boolean): MapData {
  return {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 40, 10, 50),
    tokens: comHeroi ? [token('heroi', PAR_EM.x - 50, PAR_EM.y)] : [],
    pins: [viagem('fundo', PAR_EM.x, PAR_EM.y, { sceneId: SALAO, pinId: 'alcapao' }, soChegada ? { soChegada: true } : {})],
  }
}

function salao(comHeroi: boolean): MapData {
  return {
    ...createEmptyMap('mapa-salao', 'Aventura', 40, 10, 50),
    tokens: comHeroi ? [token('heroi', 200, 200)] : [],
    pins: [viagem('alcapao', 400, 200, { sceneId: CRIPTA, pinId: 'fundo' })],
  }
}

/** O mestre com `aberta` no editor; a outra cena de fundo. O herói está na cena `ondeEsta`. */
function mundo(aberta: 'salao' | 'cripta', ondeEsta: 'salao' | 'cripta', soChegada: boolean): HostWorld {
  const s = { sceneId: SALAO, name: 'Salão', map: salao(ondeEsta === 'salao') }
  const c = { sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta(soChegada, ondeEsta === 'cripta') }
  return aberta === 'salao' ? { open: s, background: [c] } : { open: c, background: [s] }
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
  return { s, pedir: (pinId: string) => s.handleMessage('c1', { type: 'pin.travel.request', pinId }, w) }
}

describe('hostSession: chegada oculta (mão única)', () => {
  it('pedido para um pino soChegada é recusado com o motivo genérico, e nada chega ao mestre', () => {
    const t = mesa(mundo('cripta', 'cripta', true))
    const r = t.pedir('fundo')
    expect(recusa(r)).toBe('unavailable')
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toBeUndefined()
  })

  it('controle: sem a marca, o mesmo pedido chega ao mestre', () => {
    const t = mesa(mundo('cripta', 'cripta', false))
    expect(t.pedir('fundo').travelRequest).toMatchObject({ toSceneId: SALAO })
  })

  it('a viagem pela origem chega no ponto do par oculto', () => {
    const w = mundo('salao', 'salao', true)
    const t = mesa(w)
    const pedido = t.pedir('alcapao').travelRequest
    if (pedido === undefined) throw new Error('o pedido pela origem deveria valer')
    const r = t.s.approveTravel(pedido.requestId, w)
    const par = cripta(true, false).pins[0]
    const esperado = arrivalSpot(cripta(true, false), par, 1)
    expect(r.applyTransfer).toMatchObject({ tokenId: 'heroi', fromSceneId: SALAO, toSceneId: CRIPTA, x: esperado.x, y: esperado.y })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed' } }])
  })
})
