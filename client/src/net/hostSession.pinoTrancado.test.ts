import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, TRAVEL_REQUEST_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PINO TRANCADO VIRA PEDIDO: o pino de viagem trancado aceita "Pedir ao
 * mestre" (a opção "aceita tentativas", ligada por padrão). O pedido chega ao
 * mestre marcado como trancado; ele responde "Liberar uma vez", "Passar para
 * pede" ou "Não". Com a opção desligada (`mudo`), nada chega — e o jogador lê
 * o mesmo motivo genérico de sempre, sem o nome da outra cena.
 */

const CODE = 'AB12CD'
const RAIO = 700
const CENA_LAB = 'cena-laboratorio'
const CENA_PATIO = 'cena-patio'
const NOME_LAB = 'Laboratório'
const NOME_PATIO = 'Pátio dos fundos'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, description: string, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description, image: null, destino, ...extra }
}

/** O Laboratório aberto (o Diego nele), o Pátio de fundo. `porta` = como está o pino da porta do laboratório. */
function mundo(porta: Partial<Pin> = { passagem: 'trancada' }): HostWorld {
  const lab: MapData = {
    ...createEmptyMap('mapa-lab', NOME_LAB, 40, 10, 50),
    tokens: [token('diego', 200, 200)],
    pins: [
      viagem('porta-lab', 400, 200, 'Porta de aço', { sceneId: CENA_PATIO, pinId: 'porta-patio' }, porta),
      // Trancado também, mas longe (1700 px, raio 700): no escuro para o Diego.
      viagem('alcapao-longe', 1900, 250, 'Alçapão', { sceneId: CENA_PATIO, pinId: 'poco-patio' }, { passagem: 'trancada' }),
    ],
  }
  const patio: MapData = {
    ...createEmptyMap('mapa-patio', NOME_PATIO, 40, 10, 50),
    tokens: [],
    pins: [
      viagem('porta-patio', 1000, 250, 'Porta dos fundos', { sceneId: CENA_LAB, pinId: 'porta-lab' }),
      viagem('poco-patio', 100, 100, 'Poço', { sceneId: CENA_LAB, pinId: 'alcapao-longe' }),
    ],
  }
  return { open: { sceneId: CENA_LAB, name: NOME_LAB, map: lab }, background: [{ sceneId: CENA_PATIO, name: NOME_PATIO, map: patio }] }
}

function mesa(w: HostWorld = mundo()) {
  let clock = 1_000_000
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RAIO,
    now: () => clock,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const joined = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Diego' }, w).outbound[0]?.msg
  if (joined?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(joined.playerId, 'diego')
  s.broadcast(w)
  return {
    s,
    diego: joined.playerId,
    advance: (ms: number) => {
      clock += ms
    },
    pedir: (pinId: string, world: HostWorld = w) => s.handleMessage('c1', { type: 'pin.travel.request', pinId }, world),
  }
}

function recusa(r: HostResult): string | null {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'pin.travel.rejected' ? msg.reason : null
}

/** Tudo o que sai pela rede para o jogador, junto, para procurar o que não pode vazar. */
function paraOJogador(r: HostResult): HostMessage[] {
  return r.outbound.map((o) => o.msg)
}

describe('hostSession: pino de viagem trancado vira pedido', () => {
  it('trancada (aceita tentativas, o padrão): o pedido vai ao mestre marcado como trancado, e ao Diego não sai nada', () => {
    const t = mesa()
    const r = t.pedir('porta-lab')
    expect(r.travelRequest).toMatchObject({ playerName: 'Diego', pinLabel: 'Porta de aço', toSceneName: NOME_PATIO, trancada: true })
    // Esperando o mestre: nada volta ao jogador — nem recusa, nem o nome do Pátio.
    expect(paraOJogador(r)).toEqual([])
    expect(r.applyTransfer).toBeUndefined()
    expect(t.s.isTravelPending(r.travelRequest?.requestId ?? '')).toBe(true)
  })

  it('"Liberar uma vez": o Diego passa ("Você chegou"), e a sessão não destranca o pino', () => {
    const t = mesa()
    const pedido = t.pedir('porta-lab').travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    const r = t.s.approveTravel(pedido.requestId, mundo())
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed' } }])
    expect(r.applyTransfer).toMatchObject({ tokenId: 'diego', fromSceneId: CENA_LAB, toSceneId: CENA_PATIO })
    // Uma vez só: nada manda o integrador mudar o modo do pino.
    expect(r.applyPinPassage).toBeUndefined()
    expect(t.s.isTravelPending(pedido.requestId)).toBe(false)
  })

  it('"Passar para pede": o Diego passa E o pino da porta vira "pede" na cena dele', () => {
    const t = mesa()
    const pedido = t.pedir('porta-lab').travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    const r = t.s.approveLockedTravelAsAsk(pedido.requestId, mundo())
    expect(r.applyTransfer).toMatchObject({ tokenId: 'diego', toSceneId: CENA_PATIO })
    // A porta está na cena aberta no editor: sem `sceneId`.
    expect(r.applyPinPassage).toEqual({ pinId: 'porta-lab', passagem: 'pede' })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.changed' } }])
  })

  it('"Passar para pede" num pedido que não é de pino trancado não muda modo nenhum', () => {
    const t = mesa(mundo({}))
    const pedido = t.pedir('porta-lab', mundo({})).travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    expect(pedido.trancada).toBeUndefined()
    const r = t.s.approveLockedTravelAsAsk(pedido.requestId, mundo({}))
    expect(r.applyPinPassage).toBeUndefined()
    expect(r.applyTransfer).toBeDefined()
  })

  it('"Não": pin.travel.denied, e o Diego fica', () => {
    const t = mesa()
    const pedido = t.pedir('porta-lab').travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    const r = t.s.denyTravel(pedido.requestId)
    expect(r).toEqual({ outbound: [{ clientId: 'c1', msg: { type: 'pin.travel.denied' } }] })
  })

  it('opção desligada (mudo): nada chega ao mestre, e o Diego lê o motivo genérico sem o nome do Pátio', () => {
    const mudo = mundo({ passagem: 'trancada', mudo: true })
    const t = mesa(mudo)
    const r = t.pedir('porta-lab', mudo)
    expect(r.travelRequest).toBeUndefined()
    expect(recusa(r)).toBe('unavailable')
    expect(r).toEqual({ outbound: [{ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'unavailable' } }] })
    expect(JSON.stringify(r)).not.toContain(NOME_PATIO)
    expect(JSON.stringify(r)).not.toContain(CENA_PATIO)
  })

  it('trancado no escuro: o pedido não vira pergunta — a névoa vale para o pino trancado também', () => {
    const t = mesa()
    const r = t.pedir('alcapao-longe')
    expect(r.travelRequest).toBeUndefined()
    expect(recusa(r)).toBe('unavailable')
    expect(JSON.stringify(r)).not.toContain(NOME_PATIO)
  })

  it('pedido comum pendente e depois trancado: o "Deixar ir" continua recusando', () => {
    const t = mesa(mundo({}))
    const pedido = t.pedir('porta-lab', mundo({})).travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    const r = t.s.approveTravel(pedido.requestId, mundo({ passagem: 'trancada' }))
    expect(r.applyTransfer).toBeUndefined()
    expect(recusa(r)).toBe('unavailable')
  })

  it('pedido de pino trancado pendente: um segundo pedido é "pending", não uma segunda linha', () => {
    const t = mesa()
    expect(t.pedir('porta-lab').travelRequest).toBeDefined()
    t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS)
    const r = t.pedir('porta-lab')
    expect(r.travelRequest).toBeUndefined()
    expect(recusa(r)).toBe('pending')
  })
})
