import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PAREDES SÓ AS VISTAS, na rede. O snapshot que sai para o jogador leva as
 * paredes que ele vê agora ou que lembra de ter visto — nunca a planta do nível
 * inteiro. Mapa aberto de 1000 × 1000 px, raio 300: a Ana começa em (200, 200).
 */

const CODE = 'AB12CD'
const RADIUS = 300
const PERTO = { x: 200, y: 200 }
const LONGE = { x: 800, y: 800 }

function token(at: { x: number; y: number }): Token {
  return { id: 'heroi', characterId: null, name: 'Heroi', x: at.x, y: at.y, size: 1, image: null }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Uma parede à vista da Ana e duas no canto oposto do mapa, onde ela nunca andou. */
function nivel(heroi: { x: number; y: number }): MapData {
  return {
    ...createEmptyMap('mapa-nivel', 'Nivel', 25, 25, 40),
    tokens: [token(heroi)],
    walls: [wall('parede-da-entrada', 120, 320, 280, 320), wall('parede-do-cofre', 700, 900, 900, 900), wall('parede-da-cripta', 900, 650, 900, 850)],
  }
}

function snapshotOf(messages: { clientId: string; msg: HostMessage }[]): Extract<HostMessage, { type: 'snapshot' }> {
  const found = messages.find((o) => o.clientId === 'c1' && o.msg.type === 'snapshot')?.msg
  if (found === undefined || found.type !== 'snapshot') throw new Error('esperava snapshot para c1')
  return found
}

function mesa() {
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
  const joined = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, nivel(PERTO)).outbound[0]?.msg
  if (joined?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(joined.playerId, 'heroi')
  return { s, playerId: joined.playerId }
}

describe('hostSession: o jogador só recebe as paredes que viu', () => {
  it('as paredes do canto que ela nunca viu não chegam pela rede', () => {
    const t = mesa()
    const snap = snapshotOf(t.s.broadcast(nivel(PERTO)).outbound)
    expect(snap.map.walls.map((w) => w.id)).toEqual(['parede-da-entrada'])
    const json = JSON.stringify(snap)
    expect(json).not.toContain('parede-do-cofre')
    expect(json).not.toContain('parede-da-cripta')
  })

  it('ela anda até o canto: as paredes de lá chegam, e a da entrada continua lembrada', () => {
    const t = mesa()
    t.s.broadcast(nivel(PERTO))
    const la = snapshotOf(t.s.broadcast(nivel(LONGE)).outbound)
    expect(la.map.walls.map((w) => w.id).sort()).toEqual(['parede-da-cripta', 'parede-da-entrada', 'parede-do-cofre'])
  })

  it('"Revelar planta" do mestre continua entregando as paredes que ela nunca viu', () => {
    const t = mesa()
    t.s.broadcast(nivel(PERTO))
    t.s.revealPlan(t.playerId, nivel(PERTO))
    const snap = snapshotOf(t.s.broadcast(nivel(PERTO)).outbound)
    expect(snap.map.walls.map((w) => w.id).sort()).toEqual(['parede-da-cripta', 'parede-da-entrada', 'parede-do-cofre'])
  })
})
