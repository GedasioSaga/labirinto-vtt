import { describe, expect, it } from 'vitest'
import type { CabineDeTransporte, ChamadaDeCabine } from '../lib/cabine'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, PinPassage, Token } from '../types/map'
import { CABINE_CALL_MIN_INTERVAL_MS, createHostSession, TRAVEL_REQUEST_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * CABINE DE TRANSPORTE no host — CHAMAR, FILA e OCUPANTE. Quem está numa
 * parada sem a cabine a chama (`cabine.call`): a chamada vai ao integrador,
 * que a põe na fila da aventura e avisa o mestre. Quem pede para passar com a
 * cabine ali embarca: é o ocupante até o mestre responder, e a parada fica
 * "ocupada" para os outros, que não passam. Nada disso diz ao jogador qual é
 * a cabine, onde ela está, nem quem está nela.
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

function espinha(atual: CabineDeTransporte['atual'], fila?: ChamadaDeCabine[]): CabineDeTransporte {
  return { id: 'cab-espinha-secreta', nome: 'Espinha do Farol', paradas: [PARADA_TERREO, PARADA_TOPO], atual, ...(fila === undefined ? {} : { fila }) }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/** Ana e Caio no Térreo, Bia no Topo; uma grade de cabine em cada cena. */
function mundo(atual: CabineDeTransporte['atual'], passagem: PinPassage = 'pede', fila?: ChamadaDeCabine[]): HostWorld {
  const terreo: MapData = {
    ...createEmptyMap('mapa-terreo', 'Térreo', 40, 10, 50),
    tokens: [token('ana-ficha', 200, 200), token('caio-ficha', 250, 250)],
    pins: [viagem('grade-terreo', 300, 200, PARADA_TOPO, passagem)],
  }
  const topo: MapData = {
    ...createEmptyMap('mapa-topo', 'Topo', 40, 10, 50),
    tokens: [token('bia-ficha', 200, 200)],
    pins: [viagem('grade-topo', 300, 200, PARADA_TERREO, passagem)],
  }
  return {
    open: { sceneId: TERREO, name: 'Térreo', map: terreo },
    background: [{ sceneId: TOPO, name: 'Topo do Farol', map: topo }],
    cabines: [espinha(atual, fila)],
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
  const caio = welcomeOf(s.handleMessage('c3', { type: 'join', code: CODE, name: 'Caio' }, w).outbound)
  s.assignToken(ana.playerId, 'ana-ficha')
  s.assignToken(bia.playerId, 'bia-ficha')
  s.assignToken(caio.playerId, 'caio-ficha')
  return {
    s,
    ana: ana.playerId,
    caio: caio.playerId,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

function paradaNoSnapshot(r: HostResult, clientId: string): Pin | undefined {
  const snap = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error(`sem snapshot para ${clientId}`)
  return snap.map.pins.find((p) => p.kind === 'viagem')
}

function recusa(r: HostResult): string | null {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'pin.travel.rejected' ? msg.reason : null
}

describe('hostSession: chamar a cabine', () => {
  it('a Bia, no Topo sem a cabine, chama: o integrador recebe a chamada da parada dela, com a ficha e quem chamou', () => {
    const w = mundo(PARADA_TERREO)
    const t = mesa(w)
    const r = t.s.handleMessage('c2', { type: 'cabine.call', pinId: 'grade-topo' }, w)
    expect(r.chamadaDeCabine).toEqual({
      cabineId: 'cab-espinha-secreta',
      chamada: { parada: PARADA_TOPO, tokenId: 'bia-ficha', nome: 'nome-bia-ficha' },
      jogador: 'Bia',
      cabine: 'Espinha do Farol',
      cena: 'Topo do Farol',
    })
    // A chamada é do integrador: nada dela vai ao jogador pela rede.
    expect(JSON.stringify(r.outbound)).not.toContain('Espinha')
  })

  it('não vale: a cabine já está na parada, a parada já está na fila, o pino não é parada, a chamada vem rápido demais', () => {
    const aqui = mundo(PARADA_TERREO)
    const t = mesa(aqui)
    expect(t.s.handleMessage('c1', { type: 'cabine.call', pinId: 'grade-terreo' }, aqui).chamadaDeCabine).toBeUndefined()

    const naFila = mundo(PARADA_TERREO, 'pede', [{ parada: PARADA_TOPO, tokenId: 'outra', nome: 'Outra' }])
    const u = mesa(naFila)
    expect(u.s.handleMessage('c2', { type: 'cabine.call', pinId: 'grade-topo' }, naFila).chamadaDeCabine).toBeUndefined()

    const semCabine: HostWorld = { ...mundo(PARADA_TERREO), cabines: [] }
    const v = mesa(semCabine)
    expect(v.s.handleMessage('c2', { type: 'cabine.call', pinId: 'grade-topo' }, semCabine).chamadaDeCabine).toBeUndefined()

    const w = mundo(PARADA_TERREO)
    const x = mesa(w)
    expect(x.s.handleMessage('c2', { type: 'cabine.call', pinId: 'grade-topo' }, w).chamadaDeCabine).toBeDefined()
    expect(x.s.handleMessage('c2', { type: 'cabine.call', pinId: 'grade-topo' }, w).chamadaDeCabine).toBeUndefined()
    x.advance(CABINE_CALL_MIN_INTERVAL_MS)
    expect(x.s.handleMessage('c2', { type: 'cabine.call', pinId: 'grade-topo' }, w).chamadaDeCabine).toBeDefined()
  })

  it('pino de outra cena não se chama: a Ana, no Térreo, não chama pela grade do Topo', () => {
    const w = mundo(PARADA_TOPO)
    const t = mesa(w)
    expect(t.s.handleMessage('c1', { type: 'cabine.call', pinId: 'grade-topo' }, w).chamadaDeCabine).toBeUndefined()
    expect(t.s.handleMessage('c1', { type: 'cabine.call', pinId: 'grade-terreo' }, w).chamadaDeCabine).toBeDefined()
  })

  it('com a parada na fila, quem está nela lê "chamada" (e continua sem passar); a outra parada lê o de sempre', () => {
    const w = mundo(PARADA_TERREO, 'livre', [{ parada: PARADA_TOPO, tokenId: 'bia-ficha', nome: 'Bia' }])
    const t = mesa(w)
    const r = t.s.broadcast(w)
    expect(paradaNoSnapshot(r, 'c2')?.cabine).toBe('chamada')
    expect(paradaNoSnapshot(r, 'c1')?.cabine).toBe('aqui')
    expect(recusa(t.s.handleMessage('c2', { type: 'pin.travel.request', pinId: 'grade-topo' }, w))).toBe('unavailable')
  })
})

describe('hostSession: ocupante da cabine', () => {
  it('a Ana pede para passar com a cabine ali: embarca; o Caio, na mesma parada, lê "ocupada" e não passa', () => {
    const w = mundo(PARADA_TERREO, 'pede')
    const t = mesa(w)
    const pedido = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade-terreo' }, w)
    expect(pedido.travelRequest?.cabine).toBe('Espinha do Farol')
    const r = t.s.broadcast(w)
    expect(paradaNoSnapshot(r, 'c1')?.cabine).toBe('aqui')
    expect(paradaNoSnapshot(r, 'c3')?.cabine).toBe('ocupada')
    expect(recusa(t.s.handleMessage('c3', { type: 'pin.travel.request', pinId: 'grade-terreo' }, w))).toBe('unavailable')
    // "ocupada" não diz quem: nem o nome da Ana nem a ficha dela vão ao Caio por causa da cabine.
    const paraCaio = paradaNoSnapshot(r, 'c3')
    expect(JSON.stringify(paraCaio)).not.toContain('Ana')
  })

  it('o painel do mestre sabe quem está na cabine; o mestre diz "Não" e a cabine fica livre de novo', () => {
    const w = mundo(PARADA_TERREO, 'pede')
    const t = mesa(w)
    const pedido = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade-terreo' }, w)
    expect(t.s.listPlayers(w).find((p) => p.playerId === t.ana)?.naCabine).toBe('cab-espinha-secreta')
    expect(t.s.listPlayers(w).find((p) => p.playerId === t.caio)?.naCabine).toBeUndefined()
    t.s.denyTravel(pedido.travelRequest?.requestId ?? '')
    expect(t.s.listPlayers(w).find((p) => p.playerId === t.ana)?.naCabine).toBeUndefined()
    expect(paradaNoSnapshot(t.s.broadcast(w), 'c3')?.cabine).toBe('aqui')
    t.advance(TRAVEL_REQUEST_MIN_INTERVAL_MS)
    expect(t.s.handleMessage('c3', { type: 'pin.travel.request', pinId: 'grade-terreo' }, w).travelRequest?.cabine).toBe('Espinha do Farol')
  })

  it('o "Deixar ir" do ocupante leva a cabine, e ele deixa de ocupá-la', () => {
    const w = mundo(PARADA_TERREO, 'pede')
    const t = mesa(w)
    const pedido = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade-terreo' }, w)
    const ida = t.s.approveTravel(pedido.travelRequest?.requestId ?? '', w)
    expect(ida.applyCabine).toEqual({ cabineId: 'cab-espinha-secreta', parada: PARADA_TOPO })
    expect(t.s.listPlayers(w).find((p) => p.playerId === t.ana)?.naCabine).toBeUndefined()
  })

  it('a cabine saiu (o mestre a levou): o pedido pendente não ocupa a parada onde ela chegou', () => {
    const t = mesa(mundo(PARADA_TERREO, 'pede'))
    t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade-terreo' }, mundo(PARADA_TERREO, 'pede'))
    const levada = mundo(PARADA_TOPO, 'pede')
    expect(paradaNoSnapshot(t.s.broadcast(levada), 'c2')?.cabine).toBe('aqui')
    expect(t.s.listPlayers(levada).find((p) => p.playerId === t.ana)?.naCabine).toBeUndefined()
  })

  it('pino de viagem sem cabine: o pedido não fala em cabine', () => {
    const w: HostWorld = { ...mundo(PARADA_TERREO, 'pede'), cabines: undefined }
    const t = mesa(w)
    const pedido = t.s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'grade-terreo' }, w)
    expect(pedido.travelRequest).toBeDefined()
    expect(pedido.travelRequest?.cabine).toBeUndefined()
  })
})
