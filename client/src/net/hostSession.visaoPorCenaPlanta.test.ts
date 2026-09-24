/**
 * VISÃO POR CENA + PLANTA REVELADA, JUNTAS. Os dois recursos passam pelo
 * mesmo `snapshotFor`: a planta revelada é marcada antes do recorte e o
 * recorte usa o alcance da cena vezes o fator do jogador. Juntar os ramos
 * sem um dos dois perde a planta ou volta ao raio global.
 */
import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const CASA = 64
/** Centro de um mapa de 60 x 60 casas: longe da borda em toda direção. */
const CENTRO = 30 * CASA
/** Raio global de fábrica, bem maior que as 6 casas da mina. */
const RAIO_GLOBAL = 700

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mina(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-mina', 'Mina', 60, 60, CASA), tokens, visionCells: 6 }
}

function cena(map: MapData, planKnownByAll: boolean): HostScene {
  return { sceneId: 's-mina', name: 'Mina', map, planKnownByAll }
}

function mesa(mundo: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: RAIO_GLOBAL, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Eva' }, mundo)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'eva')
  return { s, eva: welcome.playerId }
}

function snapshotDe(r: HostResult) {
  const msg = r.outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot')
  return msg
}

function alcance(ring: RegionPoint[] | undefined): number {
  if (ring === undefined) return 0
  return Math.round(Math.max(...ring.map((p) => Math.hypot(p.x - CENTRO, p.y - CENTRO))))
}

describe('visão por cena com planta conhecida por todos', () => {
  it('mina de 6 casas com planta aberta: Eva (x1,5) vê 9 casas e a planta longe já vem explorada', () => {
    const mundo: HostWorld = { open: cena(mina([ficha('eva', CENTRO, CENTRO)]), true), background: [] }
    const { s, eva } = mesa(mundo)
    s.setVisionFactor(eva, 1.5)
    const snap = snapshotDe(s.broadcast(mundo))
    // O alcance é o da cena vezes o fator, não o raio global.
    expect(alcance(snap.vision[0])).toBe(9 * CASA)
    const exp = decodeExploration(snap.explored)
    if (exp === null) throw new Error('explored inválido')
    // A planta: um canto a 25 casas, bem fora das 9 que ela enxerga.
    expect(isPointExplored(exp, { x: CENTRO + 25 * CASA, y: CENTRO + 25 * CASA })).toBe(true)
  })

  it('a mesma mina sem a flag: o alcance continua 9 casas e o canto longe não vem', () => {
    const mundo: HostWorld = { open: cena(mina([ficha('eva', CENTRO, CENTRO)]), false), background: [] }
    const { s, eva } = mesa(mundo)
    s.setVisionFactor(eva, 1.5)
    const snap = snapshotDe(s.broadcast(mundo))
    expect(alcance(snap.vision[0])).toBe(9 * CASA)
    const exp = decodeExploration(snap.explored)
    if (exp === null) throw new Error('explored inválido')
    expect(isPointExplored(exp, { x: CENTRO + 25 * CASA, y: CENTRO + 25 * CASA })).toBe(false)
    expect(isPointExplored(exp, { x: CENTRO, y: CENTRO })).toBe(true)
  })
})
