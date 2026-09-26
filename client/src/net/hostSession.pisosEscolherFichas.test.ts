import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, Token } from '../types/map'
import { createHostSession, type AppliedTransfer, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PISOS NA MESMA CENA em cima de ESCOLHER FICHAS NO PINO: os pisos estão
 * empilhados no mesmo x/y. O pônei de Bruno está no 1º piso, bem em cima da
 * ponte do térreo, colado à ficha dele. Para o pino do térreo, o pônei não
 * existe: não é caixa, não passa escolhido e não vai de séquito — senão a
 * ficha do andar de cima atravessaria por um pino que ela nem vê.
 */

const CODE = 'AB12CD'
const ESTRADA = 'cena-estrada'
const VILA = 'cena-vila'
const GRADE = 50
const casa = (coluna: number, linha: number) => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const PONTE_A = casa(10, 5)
const PONTE_B = casa(20, 5)
/** Entre dois pedidos do mesmo jogador: acima dos limites de pedido do host. */
const PAUSA_MS = 60_000

function ficha(id: string, p: { x: number; y: number }, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id.toUpperCase(), x: p.x, y: p.y, size: 1, image: null, ...extra }
}

function ponte(id: string, p: { x: number; y: number }, sceneId: string, pinId: string): Pin {
  return { id, x: p.x, y: p.y, kind: 'viagem', description: 'Ponte', image: null, destino: { sceneId, pinId }, passagem: 'pede' }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/**
 * Bruno no térreo, na diagonal da ponte; a coruja dele colada atrás, no
 * térreo; o pônei no 1º piso, MAIS perto da ponte que Bruno (sem o piso na
 * conta, ele iria à frente).
 */
function mesa() {
  const fichas = [ficha('bruno', casa(9, 6)), ficha('coruja', casa(8, 6)), ficha('ponei', casa(10, 6), { piso: 1 })]
  const world = (): HostWorld => ({
    open: {
      sceneId: ESTRADA,
      name: 'Estrada Real',
      map: { ...createEmptyMap('mapa-estrada', 'Aventura', 40, 12, GRADE), tokens: fichas, pins: [ponte('ponte-a', PONTE_A, VILA, 'ponte-b')] },
    },
    background: [
      {
        sceneId: VILA,
        name: 'Vila Cinzenta',
        map: { ...createEmptyMap('mapa-vila', 'Planta', 40, 12, GRADE), tokens: [], pins: [ponte('ponte-b', PONTE_B, ESTRADA, 'ponte-a')] },
      },
    ],
  })
  let agora = 1_000_000
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => agora, randomId: () => `id-${(n += 1)}` })
  const bruno = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Bruno' }, world()).outbound).playerId
  for (const tokenId of ['bruno', 'coruja', 'ponei']) s.assignToken(bruno, tokenId)
  s.broadcast(world())
  const pede = (tokenIds?: string[]): HostResult => {
    agora += PAUSA_MS
    const msg = tokenIds === undefined ? { type: 'pin.travel.request' as const, pinId: 'ponte-a' } : { type: 'pin.travel.request' as const, pinId: 'ponte-a', tokenIds }
    return s.handleMessage('c1', msg, world())
  }
  const aprova = (r: HostResult): HostResult => {
    if (r.travelRequest === undefined) throw new Error('o pedido deveria valer')
    return s.approveTravel(r.travelRequest.requestId, world())
  }
  return { pede, aprova }
}

const quemPassa = (transfer: AppliedTransfer | undefined): string[] =>
  transfer === undefined ? [] : [transfer.tokenId, ...(transfer.entourage ?? []).map((e) => e.tokenId)]

const para = (r: HostResult, clientId: string): HostMessage[] => r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)

describe('hostSession: escolher fichas no pino com pisos na mesma cena', () => {
  it('escolher o pônei do 1º piso para a ponte do térreo recusa o pedido inteiro, com o motivo genérico', () => {
    const t = mesa()
    const r = t.pede(['bruno', 'ponei'])
    expect(r.travelRequest).toBeUndefined()
    expect(r.applyTransfer).toBeUndefined()
    expect(para(r, 'c1')).toEqual([{ type: 'pin.travel.rejected', reason: 'unavailable' }])
  })

  it('só o pônei, parado em cima da ponte mas no 1º piso: recusa igual a um id inventado', () => {
    const t = mesa()
    expect(para(t.pede(['ponei']), 'c1')).toEqual(para(mesa().pede(['nao-existe']), 'c1'))
    expect(para(t.pede(['ponei']), 'c1')).toEqual([{ type: 'pin.travel.rejected', reason: 'unavailable' }])
  })

  it('escolher as duas do térreo vale: Bruno à frente, a coruja junto, o pônei fica no 1º piso', () => {
    const t = mesa()
    const r = t.pede(['coruja', 'bruno'])
    expect(r.travelRequest?.tokenNames).toEqual(['BRUNO', 'CORUJA'])
    expect(quemPassa(t.aprova(r).applyTransfer)).toEqual(['bruno', 'coruja'])
  })

  it('sem escolha, o séquito de sempre é só do térreo: o pônei colado, mas no 1º piso, não atravessa', () => {
    const t = mesa()
    expect(quemPassa(t.aprova(t.pede()).applyTransfer)).toEqual(['bruno', 'coruja'])
  })
})

/**
 * VIAJAR JUNTO com pisos: Bruno (térreo) pede a ponte; Ana está no 1º piso,
 * no mesmo x/y ao lado dele; Caio, no térreo, a 2 casas. Só Caio é
 * companheiro — Ana, "colada" no plano, está no andar de cima.
 */
function mesaComColegas() {
  const fichas = [ficha('bruno', casa(9, 6)), ficha('ana', casa(10, 6), { piso: 1 }), ficha('caio', casa(11, 7))]
  const world = (): HostWorld => ({
    open: {
      sceneId: ESTRADA,
      name: 'Estrada Real',
      map: { ...createEmptyMap('mapa-estrada', 'Aventura', 40, 12, GRADE), tokens: fichas, pins: [ponte('ponte-a', PONTE_A, VILA, 'ponte-b')] },
    },
    background: [
      {
        sceneId: VILA,
        name: 'Vila Cinzenta',
        map: { ...createEmptyMap('mapa-vila', 'Planta', 40, 12, GRADE), tokens: [], pins: [ponte('ponte-b', PONTE_B, ESTRADA, 'ponte-a')] },
      },
    ],
  })
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
  const ids: Record<string, string> = {}
  const entra = (clientId: string, name: string, tokenId: string) => {
    ids[name] = welcomeOf(s.handleMessage(clientId, { type: 'join', code: CODE, name }, world()).outbound).playerId
    s.assignToken(ids[name], tokenId)
  }
  entra('c1', 'Bruno', 'bruno')
  entra('c2', 'Ana', 'ana')
  entra('c3', 'Caio', 'caio')
  s.broadcast(world())
  const r = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'ponte-a' }, world())
  if (r.travelRequest === undefined) throw new Error('o pedido de Bruno deveria valer')
  return { s, world, ids, pedido: r.travelRequest.requestId }
}

describe('hostSession: viajar junto com pisos na mesma cena', () => {
  it('companheiro é só quem está no piso de quem pediu: Caio vai, Ana (1º piso, colada no plano) não', () => {
    const t = mesaComColegas()
    expect(t.s.travelCompanions(t.pedido, t.world())).toEqual([t.ids.Caio])
  })

  it('"Deixar ir todos": Bruno e Caio atravessam, Ana fica no 1º piso', () => {
    const t = mesaComColegas()
    const passaram = t.s.approveTravelTogether(t.pedido, t.world()).map((r) => r.applyTransfer?.tokenId)
    expect(passaram).toEqual(['bruno', 'caio'])
  })
})
