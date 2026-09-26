import { describe, expect, it } from 'vitest'
import type { CabineDeTransporte } from '../lib/cabine'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, PinPassage, Token } from '../types/map'
import { createHostSession, TRAVEL_REQUEST_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * CABINE DE TRANSPORTE no host: a parada diz ao jogador se a cabine está ali,
 * sem nunca dizer qual é a cabine nem onde ela está; só se passa com a cabine
 * na parada; e quem passa leva a cabine para a chegada.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const TERREO = 'cena-terreo'
const TOPO = 'cena-topo-do-farol'
const PARADA_TERREO = { sceneId: TERREO, pinId: 'grade-terreo' }
const PARADA_TOPO = { sceneId: TOPO, pinId: 'grade-topo' }

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino'], passagem: PinPassage): Pin {
  return { id, x, y, kind: 'viagem', description: 'Grade da cabine', image: null, destino, passagem }
}

function espinha(atual: CabineDeTransporte['atual']): CabineDeTransporte {
  return { id: 'cab-espinha-secreta', nome: 'Espinha do Farol', paradas: [PARADA_TERREO, PARADA_TOPO], atual }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

function mundo(atual: CabineDeTransporte['atual'], passagem: PinPassage = 'livre'): HostWorld {
  const terreo: MapData = {
    ...createEmptyMap('mapa-terreo', 'Térreo', 40, 10, 50),
    // Encostadas na grade: o pino de viagem só atravessa de perto.
    tokens: [token('ana-ficha', 250, 200)],
    pins: [viagem('grade-terreo', 300, 200, PARADA_TOPO, passagem)],
  }
  const topo: MapData = {
    ...createEmptyMap('mapa-topo', 'Topo', 40, 10, 50),
    tokens: [token('bia-ficha', 250, 200)],
    pins: [viagem('grade-topo', 300, 200, PARADA_TERREO, passagem)],
  }
  return {
    open: { sceneId: TERREO, name: 'Térreo', map: terreo },
    background: [{ sceneId: TOPO, name: 'Topo do Farol', map: topo }],
    cabines: [espinha(atual)],
  }
}

function mesa(w: HostWorld) {
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
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
  const bia = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w).outbound)
  s.assignToken(ana.playerId, 'ana-ficha')
  s.assignToken(bia.playerId, 'bia-ficha')
  return {
    s,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

/** O pino de viagem que a conexão `clientId` recebeu no snapshot. */
function paradaNoSnapshot(r: HostResult, clientId: string): Pin | undefined {
  const snap = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error(`sem snapshot para ${clientId}`)
  return snap.map.pins.find((p) => p.kind === 'viagem')
}

function recusa(r: HostResult): string | null {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'pin.travel.rejected' ? msg.reason : null
}

describe('hostSession: cabine de transporte', () => {
  it('quem está na parada da cabine lê "aqui"; quem está na outra parada lê "longe"', () => {
    const w = mundo(PARADA_TERREO)
    const t = mesa(w)
    const r = t.s.broadcast(w)
    expect(paradaNoSnapshot(r, 'c1')?.cabine).toBe('aqui')
    expect(paradaNoSnapshot(r, 'c2')?.cabine).toBe('longe')
  })

  it('o snapshot nunca leva o nome nem o id da cabine, nem a cena ou o pino onde ela está', () => {
    const w = mundo(PARADA_TOPO)
    const t = mesa(w)
    const r = t.s.broadcast(w)
    const paraAna = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c1').map((o) => o.msg))
    expect(paraAna).toContain('"cabine":"longe"')
    expect(paraAna).not.toContain('Espinha')
    expect(paraAna).not.toContain('cab-espinha-secreta')
    expect(paraAna).not.toContain(TOPO)
    expect(paraAna).not.toContain('grade-topo')
  })

  it('sem a cabine na parada, ninguém passa — nem pino livre, nem pedido ao mestre', () => {
    const livre = mesa(mundo(PARADA_TOPO, 'livre'))
    const r = livre.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade-terreo' }, mundo(PARADA_TOPO, 'livre'))
    expect(recusa(r)).toBe('unavailable')
    expect(r.applyTransfer).toBeUndefined()

    const pede = mesa(mundo(PARADA_TOPO, 'pede'))
    const p = pede.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade-terreo' }, mundo(PARADA_TOPO, 'pede'))
    expect(recusa(p)).toBe('unavailable')
    expect(p.travelRequest).toBeUndefined()
  })

  it('com a cabine na parada, passa, e a cabine vai junto para a chegada', () => {
    const w = mundo(PARADA_TERREO, 'livre')
    const t = mesa(w)
    const r = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade-terreo' }, w)
    expect(r.applyTransfer).toMatchObject({ toSceneId: TOPO })
    expect(r.applyCabine).toEqual({ cabineId: 'cab-espinha-secreta', parada: PARADA_TOPO })
    // O que vai ao jogador continua sem nada da cabine: `applyCabine` é só do integrador.
    expect(JSON.stringify(r.outbound)).not.toContain('cab-espinha-secreta')
  })

  it('o "Deixar ir" de um pedido feito com a cabine ali recusa se ela saiu antes da resposta', () => {
    const t = mesa(mundo(PARADA_TERREO, 'pede'))
    const pedido = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade-terreo' }, mundo(PARADA_TERREO, 'pede'))
    const requestId = pedido.travelRequest?.requestId
    expect(requestId).toBeDefined()
    t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS)
    const resposta = t.s.approveTravel(requestId ?? '', mundo(PARADA_TOPO, 'pede'))
    expect(resposta.applyTransfer).toBeUndefined()
    expect(resposta.outbound.map((o) => o.msg)).toEqual([{ type: 'pin.travel.rejected', reason: 'unavailable' }])
  })

  it('mundo sem cabines (aventura antiga): o pino de viagem é o de sempre, sem o campo', () => {
    const w: HostWorld = { ...mundo(PARADA_TERREO), cabines: undefined }
    const t = mesa(w)
    const r = t.s.broadcast(w)
    expect(paradaNoSnapshot(r, 'c1')).toBeDefined()
    expect(paradaNoSnapshot(r, 'c1')?.cabine).toBeUndefined()
    const passou = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade-terreo' }, w)
    expect(passou.applyTransfer).toMatchObject({ toSceneId: TOPO })
    expect(passou.applyCabine).toBeUndefined()
  })
})
