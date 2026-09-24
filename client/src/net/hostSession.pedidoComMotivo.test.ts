import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, Token } from '../types/map'
import { createHostSession, type HostWorld } from './hostSession'
import { TRAVEL_DENY_TEXT_MAX_LENGTH, type HostMessage } from './protocol'

/**
 * PEDIDO COM "VER" E "NÃO, PORQUE…" no host. O "Ver" só lê onde está a ficha
 * de quem pediu (não responde nada); o "Não" leva um motivo curto SÓ a quem
 * pediu — sem o nome nem o id da cena para onde o pino leva.
 */

const CODE = 'AB12CD'
const SALAO = 'cena-salao'
const PORTAO = 'cena-portao'
const GRADE = 50
const casa = (coluna: number, linha: number) => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })

function ficha(id: string, p: { x: number; y: number }): Token {
  return { id, characterId: null, name: id, x: p.x, y: p.y, size: 1, image: null }
}

function escada(id: string, p: { x: number; y: number }, sceneId: string, pinId: string): Pin {
  return { id, x: p.x, y: p.y, kind: 'viagem', description: id, image: null, destino: { sceneId, pinId } }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/** Salão com o portão; Felipe (quem pede) e Gabi (colega na mesma sala). */
function mesa() {
  const pos: Record<string, { x: number; y: number }> = { espada: casa(9, 5), lanca: casa(9, 6) }
  const world = (): HostWorld => ({
    open: {
      sceneId: SALAO,
      name: 'Salão',
      map: {
        ...createEmptyMap('mapa-salao', 'Aventura', 40, 12, GRADE),
        tokens: Object.entries(pos).map(([id, p]) => ficha(id, p)),
        pins: [escada('portao-a', casa(10, 5), PORTAO, 'portao-b')],
      },
    },
    background: [
      {
        sceneId: PORTAO,
        name: 'Portão Norte',
        map: { ...createEmptyMap('mapa-portao', 'Planta', 40, 12, GRADE), tokens: [], pins: [escada('portao-b', casa(20, 5), SALAO, 'portao-a')] },
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
  entra('c1', 'Felipe', 'espada')
  entra('c2', 'Gabi', 'lanca')
  s.broadcast(world())
  const pedir = (clientId: string): string => {
    const r = s.handleMessage(clientId, { type: 'pin.travel.request', pinId: 'portao-a' }, world())
    if (r.travelRequest === undefined) throw new Error(`o pedido de ${clientId} deveria valer`)
    return r.travelRequest.requestId
  }
  return { s, pos, world, ids, pedir }
}

describe('hostSession: "Não, porque…" do pedido de passagem', () => {
  it('o motivo vai SÓ a quem pediu, sem nome nem id da cena do outro lado', () => {
    const t = mesa()
    const pedido = t.pedir('c1')
    const r = t.s.denyTravel(pedido, 'o portão fecha à noite')
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.denied', text: 'o portão fecha à noite' } }])
    // Gabi, na mesma sala, não recebe nem o frame.
    expect(r.outbound.some((o) => o.clientId === 'c2')).toBe(false)
    const quadro = JSON.stringify(r.outbound)
    expect(quadro).not.toContain('Portão Norte')
    expect(quadro).not.toContain(PORTAO)
    expect(quadro).not.toContain('portao-b')
    expect(t.s.isTravelPending(pedido)).toBe(false)
  })

  it('motivo em branco vale o "Não" de sempre; motivo acima do teto sai cortado no teto', () => {
    const t = mesa()
    expect(t.s.denyTravel(t.pedir('c1'), '   ').outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.denied' } }])
    const longo = 'a'.repeat(TRAVEL_DENY_TEXT_MAX_LENGTH + 30)
    const [saida] = t.s.denyTravel(t.pedir('c2'), longo).outbound
    expect(saida?.msg).toEqual({ type: 'pin.travel.denied', text: 'a'.repeat(TRAVEL_DENY_TEXT_MAX_LENGTH) })
  })

  it('o "Não" sem motivo continua exatamente como antes', () => {
    const t = mesa()
    expect(t.s.denyTravel(t.pedir('c1')).outbound).toEqual([{ clientId: 'c1', msg: { type: 'pin.travel.denied' } }])
  })
})

describe('hostSession: "Ver" do pedido de passagem', () => {
  it('diz a cena e a ficha de quem pediu, sem responder o pedido', () => {
    const t = mesa()
    const pedido = t.pedir('c1')
    expect(t.s.travelTarget(pedido, t.world())).toEqual({ sceneId: SALAO, ...casa(9, 5) })
    // Ver não decide nada: o pedido continua esperando o mestre.
    expect(t.s.isTravelPending(pedido)).toBe(true)
  })

  it('segue a ficha se ela andou; pedido já decidido não tem para onde levar', () => {
    const t = mesa()
    const pedido = t.pedir('c1')
    t.pos.espada = casa(8, 5)
    expect(t.s.travelTarget(pedido, t.world())).toEqual({ sceneId: SALAO, ...casa(8, 5) })
    t.s.denyTravel(pedido)
    expect(t.s.travelTarget(pedido, t.world())).toBeNull()
  })
})
