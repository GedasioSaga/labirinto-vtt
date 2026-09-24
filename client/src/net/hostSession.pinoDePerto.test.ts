import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, TRAVEL_REQUEST_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PINO SÓ DE PERTO: para pedir ou passar por um pino de viagem a ficha precisa
 * estar encostada nele (até 1 casa além da borda dela, a mesma folga da
 * porta). O host confere a distância no pedido e de novo no "Deixar ir"; de
 * longe recusa com `far`, e esse motivo não conta nada do que o jogador não
 * vê: nem o outro lado, nem pino que não chegou no recorte dele.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const GRID = 50
/** O alçapão do Salão, no meio da sala. */
const ALCAPAO = { x: 400, y: 200 }
/** Uma casa ao lado do alçapão: encostado. */
const ENCOSTADO = { x: ALCAPAO.x - GRID, y: ALCAPAO.y }
/** Quatro casas do alçapão: vê, mas não alcança. */
const LONGE = { x: ALCAPAO.x - 4 * GRID, y: ALCAPAO.y }

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function viagem(id: string, at: { x: number; y: number }, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x: at.x, y: at.y, kind: 'viagem', description: 'Alçapão do porão', image: null, destino, ...extra }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

interface Cenario {
  heroi: { x: number; y: number }
  extra?: Token[]
  alcapao?: Partial<Pin>
  /** `null`: o alçapão não leva a lugar nenhum (sem par). */
  destino?: Pin['destino']
}

function mundo({ heroi, extra = [], alcapao = {}, destino = { sceneId: CRIPTA, pinId: 'fundo' } }: Cenario): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Aventura', 40, 10, GRID),
    tokens: [token('heroi', heroi.x, heroi.y), ...extra],
    pins: [viagem('alcapao', ALCAPAO, destino, alcapao)],
  }
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta', 40, 10, GRID),
    pins: [viagem('fundo', { x: 1000, y: 250 }, { sceneId: SALAO, pinId: 'alcapao' }, { description: 'Escada da cripta' })],
  }
  return { open: { sceneId: SALAO, name: 'Salão', map: salao }, background: [{ sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta }] }
}

function mesa(w: HostWorld) {
  let n = 0
  let at = 1_000_000
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => at,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
  s.assignToken(ana.playerId, 'heroi')
  const bia = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w).outbound)
  s.assignToken(bia.playerId, 'ficha-bia')
  s.broadcast(w)
  return {
    s,
    ana,
    bia,
    /** O relógio passa do intervalo mínimo entre dois pedidos pelo mesmo pino. */
    esperaOLimite: () => {
      at += TRAVEL_REQUEST_MIN_INTERVAL_MS + 1
    },
    pedir: (world: HostWorld = w) => s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'alcapao' }, world),
    mover: (x: number, y: number, world: HostWorld = w) => s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x, y }, world),
  }
}

/** A única resposta que o pedido de longe pode ter: o motivo, e mais nada. */
const RECUSA_LONGE: HostResult['outbound'] = [{ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'far' } }]
const RECUSA_GENERICA: HostResult['outbound'] = [{ clientId: 'c1', msg: { type: 'pin.travel.rejected', reason: 'unavailable' } }]

describe('hostSession: pino de viagem só atravessa de perto', () => {
  it('de longe, pedir para passar é recusado com "far" e nada chega ao mestre', () => {
    const t = mesa(mundo({ heroi: LONGE }))
    const r = t.pedir()
    expect(r.outbound).toEqual(RECUSA_LONGE)
    expect(r.travelRequest).toBeUndefined()
    expect(t.s.listPlayers().find((p) => p.name === 'Ana')?.travelPending).toBeUndefined()
  })

  it('encostado (uma casa ao lado ou na diagonal), o pedido chega ao mestre', () => {
    const lado = mesa(mundo({ heroi: ENCOSTADO })).pedir()
    expect(lado.travelRequest?.playerName).toBe('Ana')
    expect(lado.outbound).toEqual([])

    const diagonal = mesa(mundo({ heroi: { x: ALCAPAO.x - GRID, y: ALCAPAO.y - GRID } })).pedir()
    expect(diagonal.travelRequest?.playerName).toBe('Ana')
  })

  it('o limite é a borda da ficha mais uma casa: 75 px passa, 76 px não', () => {
    const noLimite = mesa(mundo({ heroi: { x: ALCAPAO.x - 75, y: ALCAPAO.y } })).pedir()
    expect(noLimite.travelRequest).toBeDefined()
    const passou = mesa(mundo({ heroi: { x: ALCAPAO.x - 76, y: ALCAPAO.y } })).pedir()
    expect(passou.outbound).toEqual(RECUSA_LONGE)
  })

  it('ficha maior alcança de mais longe: o raio dela conta, como na porta', () => {
    const w = mundo({ heroi: { x: ALCAPAO.x - 100, y: ALCAPAO.y } })
    const grande: HostWorld = { ...w, open: { ...w.open, map: { ...w.open.map, tokens: [token('heroi', ALCAPAO.x - 100, ALCAPAO.y, { size: 2 })] } } }
    expect(mesa(grande).pedir().travelRequest).toBeDefined()
  })

  it('pino livre de longe não teleporta; encostado, passa na hora', () => {
    const livre: Partial<Pin> = { passagem: 'livre' }
    const longe = mesa(mundo({ heroi: LONGE, alcapao: livre })).pedir()
    expect(longe.outbound).toEqual(RECUSA_LONGE)
    expect(longe.applyTransfer).toBeUndefined()

    const perto = mesa(mundo({ heroi: ENCOSTADO, alcapao: livre })).pedir()
    expect(perto.applyTransfer?.tokenId).toBe('heroi')
  })

  it('recusado de longe, anda até o pino e pede de novo: agora chega ao mestre', () => {
    const w = mundo({ heroi: LONGE })
    const t = mesa(w)
    expect(t.pedir().outbound).toEqual(RECUSA_LONGE)
    t.esperaOLimite()
    expect(t.pedir(mundo({ heroi: ENCOSTADO })).travelRequest?.playerName).toBe('Ana')
  })

  it('"Deixar ir" reconfere a distância: a ficha que o mestre arrastou para longe não é levada', () => {
    const t = mesa(mundo({ heroi: ENCOSTADO }))
    const pedido = t.pedir().travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    // O mestre arrasta a ficha no editor (sem 'token.move' do jogador): só o "Deixar ir" vê.
    const afastado = { x: ALCAPAO.x - 2 * GRID, y: ALCAPAO.y }
    const r = t.s.approveTravel(pedido.requestId, mundo({ heroi: afastado }))
    expect(r.applyTransfer).toBeUndefined()
    expect(r.outbound).toEqual(RECUSA_LONGE)
    expect(t.s.isTravelPending(pedido.requestId)).toBe(false)
  })

  it('a ficha anda para fora do alcance do pino: o pedido cai na hora, sem esperar um "Deixar ir" que já não daria certo', () => {
    const t = mesa(mundo({ heroi: ENCOSTADO }))
    const pedido = t.pedir().travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    // 76 px: um pixel além do alcance da ficha de tamanho 1 (25 de raio + 50 de folga).
    const moveu = t.mover(ALCAPAO.x - 76, ALCAPAO.y)
    expect(moveu.travelCancelled).toEqual({ requestId: pedido.requestId, playerId: t.ana.playerId, playerName: 'Ana', reason: 'far' })
    expect(moveu.outbound.map((o) => o.msg)).toContainEqual({ type: 'pin.travel.cancelled', reason: 'far' })
    expect(t.s.isTravelPending(pedido.requestId)).toBe(false)
  })

  it('a ficha anda sem sair do alcance (75 px): o pedido continua esperando o mestre, e o "Deixar ir" leva', () => {
    const t = mesa(mundo({ heroi: ENCOSTADO }))
    const pedido = t.pedir().travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    const noLimite = { x: ALCAPAO.x - 75, y: ALCAPAO.y }
    const moveu = t.mover(noLimite.x, noLimite.y)
    expect(moveu.travelCancelled).toBeUndefined()
    expect(t.s.isTravelPending(pedido.requestId)).toBe(true)
    expect(t.s.approveTravel(pedido.requestId, mundo({ heroi: noLimite })).applyTransfer?.tokenId).toBe('heroi')
  })

  it('host e cartão fazem a mesma conta: a ficha grande mais longe alcança, a pequena mais perto não, e o host leva a grande', () => {
    // Grade 50: 'heroi' (tamanho 1) a 80 px, alcance 75; 'gigante' (tamanho 2) a 90 px, alcance 100.
    const gigante = token('gigante', ALCAPAO.x + 90, ALCAPAO.y, { size: 2 })
    const pedir = (alcapao: Partial<Pin>) => {
      const t = mesa(mundo({ heroi: { x: ALCAPAO.x - 80, y: ALCAPAO.y }, extra: [gigante], alcapao }))
      t.s.assignToken(t.ana.playerId, 'gigante')
      return t.pedir()
    }
    const pedido = pedir({})
    expect(pedido.outbound).toEqual([])
    expect(pedido.travelRequest?.playerName).toBe('Ana')
    // Pino livre: quem atravessa é a ficha que alcança, não a de centro mais perto.
    expect(pedir({ passagem: 'livre' }).applyTransfer?.tokenId).toBe('gigante')
  })

  it('"Deixar ir" com a ficha ainda encostada leva normalmente', () => {
    const w = mundo({ heroi: ENCOSTADO })
    const t = mesa(w)
    const pedido = t.pedir().travelRequest
    if (pedido === undefined) throw new Error('o pedido deveria chegar ao mestre')
    expect(t.s.approveTravel(pedido.requestId, w).applyTransfer?.tokenId).toBe('heroi')
  })
})

describe('hostSession: o "far" não conta o que o jogador não vê', () => {
  it('de longe, pino ligado, pino sem par e pino trancado respondem o mesmo "far": o outro lado não vaza', () => {
    const ligado = mesa(mundo({ heroi: LONGE })).pedir()
    const semPar = mesa(mundo({ heroi: LONGE, destino: null })).pedir()
    const trancado = mesa(mundo({ heroi: LONGE, alcapao: { passagem: 'trancada' } })).pedir()
    expect(ligado.outbound).toEqual(RECUSA_LONGE)
    expect(semPar.outbound).toEqual(RECUSA_LONGE)
    expect(trancado.outbound).toEqual(RECUSA_LONGE)
    const fio = JSON.stringify([ligado.outbound, semPar.outbound, trancado.outbound])
    expect(fio).not.toContain('Cripta')
    expect(fio).not.toContain('fundo')
    expect(fio).not.toContain('Alçapão')
  })

  it('pino que não chega no recorte dele ("Quem vê" sem ele) responde o genérico, de longe ou de perto', () => {
    const longe = mesa(mundo({ heroi: LONGE }))
    longe.s.setPinAudience('alcapao', [longe.bia.playerId])
    expect(longe.pedir().outbound).toEqual(RECUSA_GENERICA)

    const perto = mesa(mundo({ heroi: ENCOSTADO }))
    perto.s.setPinAudience('alcapao', [perto.bia.playerId])
    expect(perto.pedir().outbound).toEqual(RECUSA_GENERICA)
  })

  it('pino no escuro, atrás de parede, responde o genérico mesmo de longe: "far" diria que ele existe', () => {
    const w = mundo({ heroi: LONGE })
    // Parede entre a ficha e o alçapão, do chão ao teto da sala: o pino nunca foi visto.
    const parede = { id: 'parede', x1: 300, y1: 0, x2: 300, y2: 500, blocksLight: true, blocksMove: true, door: null }
    const escuro: HostWorld = { ...w, open: { ...w.open, map: { ...w.open.map, walls: [parede] } } }
    const t = mesa(escuro)
    expect(t.pedir(escuro).outbound).toEqual(RECUSA_GENERICA)
  })

  it('ficha escondida pelo mestre encostada no pino não conta: a visível, longe, responde "far"', () => {
    const escondida = token('sombra', ENCOSTADO.x, ENCOSTADO.y, { hidden: true })
    const w = mundo({ heroi: LONGE, extra: [escondida] })
    const t = mesa(w)
    t.s.assignToken(t.ana.playerId, 'sombra')
    const r = t.pedir()
    expect(r.outbound).toEqual(RECUSA_LONGE)
    expect(r.travelRequest).toBeUndefined()
  })
})
