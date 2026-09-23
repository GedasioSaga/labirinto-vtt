import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { paintRevealBrush } from '../lib/concealBrush'
import { pointInRing } from '../lib/floorContour'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import type { ConcealZone, MapData, RegionPoint, Token } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * O fio do jogador com o PINCEL DE REVELAR: o snapshot leva a ficha do pedaço
 * pintado e nunca a de fora dele, nem o nome ou o id da zona, nem as células
 * que o mestre pintou.
 */

const CODE = 'PINC11'
const NOME_DA_ZONA = 'Ala leste secreta'
const TRACO: RegionPoint[] = [
  { x: 560, y: 450 },
  { x: 940, y: 450 },
]

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function cena(): MapData {
  const zona: ConcealZone = {
    id: 'zona-ala-leste',
    name: NOME_DA_ZONA,
    revealed: false,
    points: [
      { x: 500, y: 20 },
      { x: 980, y: 20 },
      { x: 980, y: 580 },
      { x: 500, y: 580 },
    ],
  }
  return {
    ...createEmptyMap('m', 'Ala do Pincel', 20, 12, 50),
    tokens: [ficha('tok-lanterna', 'Lanterna', 420, 300), ficha('tok-sentinela', 'Sentinela', 800, 450), ficha('tok-espiao', 'Espiao', 600, 180)],
    concealZones: [zona],
  }
}

function ids(): () => string {
  let n = 0
  return () => {
    n += 1
    return `id-${n}`
  }
}

function snapshotDe(outbound: { clientId: string; msg: HostMessage }[]): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot para c1')
  return msg
}

function mesa() {
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: ids() })
  const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, cena())
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'tok-lanterna')
  return s
}

describe('hostSession + pincel de revelar', () => {
  it('SEGURANÇA: depois de pintar o corredor, o fio leva a Sentinela e nunca o Espiao, a zona ou as células', () => {
    const s = mesa()
    const antes = snapshotDe(s.broadcast(cena()).outbound)
    expect(JSON.stringify(antes)).not.toContain('Sentinela')

    const pintado = paintRevealBrush(cena(), TRACO, 25, 'revelar').map
    const depois = snapshotDe(s.broadcast(pintado).outbound)
    const fio = JSON.stringify(depois)
    expect(fio).toContain('Sentinela')
    expect(fio).not.toContain('Espiao')
    expect(fio).not.toContain('tok-espiao')
    expect(fio).not.toContain(NOME_DA_ZONA)
    expect(fio).not.toContain('zona-ala-leste')
    expect(fio).not.toContain('unveiledCells')
    // O corredor não chega preto; o resto da zona chega.
    expect(depois.concealed.some((peca) => pointInRing({ x: 700, y: 451 }, peca))).toBe(false)
    expect(depois.concealed.some((peca) => pointInRing({ x: 760, y: 150 }, peca))).toBe(true)
    // Está à vista, mas não vira memória: a zona nunca vira explorada.
    expect(depois.vision.some((anel) => pointInRing({ x: 700, y: 451 }, anel))).toBe(true)
    const memoria = decodeExploration(depois.explored)
    if (memoria === null) throw new Error('explored inválido')
    expect(isPointExplored(memoria, { x: 700, y: 451 })).toBe(false)
    expect(isPointExplored(memoria, { x: 300, y: 300 })).toBe(true)
  })

  it('esconder de volta tira a Sentinela do fio no snapshot seguinte', () => {
    const s = mesa()
    const pintado = paintRevealBrush(cena(), TRACO, 25, 'revelar').map
    expect(JSON.stringify(snapshotDe(s.broadcast(pintado).outbound))).toContain('Sentinela')
    const escondido = paintRevealBrush(pintado, TRACO, 25, 'esconder').map
    const fio = JSON.stringify(snapshotDe(s.broadcast(escondido).outbound))
    expect(fio).not.toContain('Sentinela')
    expect(fio).not.toContain('Espiao')
  })
})
