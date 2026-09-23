import { describe, expect, it } from 'vitest'
import { createEmptyMap, revealSecretPassage, setWallDoor } from '../lib/mapFactory'
import type { DoorState, MapData, Region, Token, Wall } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PORTA SECRETA, pela rede. A porta do meio da parede leste da Biblioteca é
 * 'Secreta' e leva ao Quarto (sala oculta, com um baú dentro). Gabi está
 * encostada nela. Enquanto o mestre não revela: a porta chega como parede comum
 * (sem porta, então sem halo nem toque), não atravessa nem aberta, e nada do
 * Quarto chega. 'Revelar passagem': a porta aparece, abre, e o quarto entra na visão.
 */
const CODE = 'PSEC01'

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
  }
}

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function mansao(porta: Partial<DoorState>, quartoSecreto: boolean): MapData {
  const bib = { regionId: 'r-bib' }
  const quarto = { regionId: 'r-quarto' }
  return {
    ...createEmptyMap('map_porta_secreta', 'Mansao', 1200, 600, 50),
    walls: [
      parede('bib-n', 500, 100, 900, 100, bib),
      parede('bib-l1', 900, 100, 900, 250, bib),
      // A porta foi cortada da parede leste da Biblioteca: o vínculo é dela.
      parede('porta', 900, 250, 900, 300, { ...bib, door: { open: false, locked: false, kind: 'normal', secret: true, ...porta } }),
      parede('bib-l2', 900, 300, 900, 450, bib),
      parede('bib-s', 900, 450, 500, 450, bib),
      parede('bib-o', 500, 450, 500, 100, bib),
      parede('quarto-n', 900, 100, 1150, 100, quarto),
      parede('quarto-l', 1150, 100, 1150, 450, quarto),
      parede('quarto-s', 1150, 450, 900, 450, quarto),
    ],
    regions: [sala('r-bib', 'Biblioteca', 500, 100, 900, 450), { ...sala('r-quarto', 'Quarto da filha', 900, 100, 1150, 450), secret: quartoSecreto }],
    tokens: [ficha('gabi', 'Gabi', 880, 275), ficha('bau', 'Bau de joias', 1000, 275)],
  }
}

function gabiNaMesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const first = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Gabi' }, map).outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(first.playerId, 'gabi')
  return s
}

function snapshotDe(mensagens: { clientId: string; msg: HostMessage }[]): Extract<HostMessage, { type: 'snapshot' }> {
  const snap = mensagens.find((m) => m.clientId === 'c1' && m.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error('esperava snapshot para a Gabi')
  return snap
}

describe('hostSession: porta secreta parece parede até o mestre revelar', () => {
  it('SEGURANÇA: a porta chega como parede comum, sem estado de porta, e nada do quarto chega', () => {
    const map = mansao({}, true)
    const s = gabiNaMesa(map)
    const snap = snapshotDe(s.broadcast(map).outbound)
    const porta = snap.map.walls.find((w) => w.id === 'porta')
    // Parede comum: sem porta (logo sem halo nem toque na tela dela), bloqueia e é da Biblioteca.
    expect(porta).toBeDefined()
    expect(porta?.door).toBeNull()
    expect(porta?.blocksLight).toBe(true)
    expect(porta?.blocksMove).toBe(true)
    expect(porta?.regionId).toBe('r-bib')
    const json = JSON.stringify(snap)
    expect(json).not.toContain('Bau de joias')
    expect(json).not.toContain('"bau"')
    expect(json).not.toContain('Quarto da filha')
    expect(json).not.toContain('r-quarto')
    // A visão não passa da parede leste.
    expect(snap.vision.length).toBeGreaterThan(0)
    expect(Math.max(...snap.vision.flat().map((p) => p.x))).toBeLessThanOrEqual(900.5)
  })

  it('SEGURANÇA: mesmo com o quarto à vista (não oculto), a porta secreta sai como parede e esconde o que há atrás', () => {
    const map = mansao({}, false)
    const s = gabiNaMesa(map)
    const snap = snapshotDe(s.broadcast(map).outbound)
    expect(snap.map.walls.find((w) => w.id === 'porta')?.door).toBeNull()
    expect(snap.map.tokens.map((t) => t.id)).toEqual(['gabi'])
    expect(JSON.stringify(snap)).not.toContain('secret":true')
  })

  it('SEGURANÇA: esquecida aberta pelo mestre, continua parede — nem a visão nem a Gabi atravessam', () => {
    const map = mansao({ open: true }, false)
    const s = gabiNaMesa(map)
    const snap = snapshotDe(s.broadcast(map).outbound)
    expect(snap.map.walls.find((w) => w.id === 'porta')?.door).toBeNull()
    expect(snap.map.tokens.some((t) => t.id === 'bau')).toBe(false)
    expect(Math.max(...snap.vision.flat().map((p) => p.x))).toBeLessThanOrEqual(900.5)
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'm1', tokenId: 'gabi', x: 1000, y: 275 }, map)
    expect(r.applyMove).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'm1', reason: 'wall' } }])
  })

  it('tocar a porta secreta não faz nada e a recusa não diz que é porta', () => {
    const map = mansao({}, true)
    const s = gabiNaMesa(map)
    s.broadcast(map)
    const r = s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(r.applyDoor).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'not_visible' } }])
  })

  it("'Revelar passagem': a porta aparece, Gabi abre, o quarto entra na visão e ela passa", () => {
    const antes = mansao({}, true)
    const map = revealSecretPassage(antes, 'porta')
    const s = gabiNaMesa(map)
    const snap = snapshotDe(s.broadcast(map).outbound)
    expect(snap.map.walls.find((w) => w.id === 'porta')?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    const toque = s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, map)
    expect(toque.applyDoor).toEqual({ wallId: 'porta', open: true })
    const aberta = setWallDoor(map, 'porta', { open: true, locked: false, kind: 'normal' })
    const depois = snapshotDe(s.broadcast(aberta).outbound)
    expect(depois.map.tokens.map((t) => t.name).sort()).toEqual(['Bau de joias', 'Gabi'])
    expect(depois.map.regions.map((r) => r.id).sort()).toEqual(['r-bib', 'r-quarto'])
    const passo = s.handleMessage('c1', { type: 'token.move', reqId: 'm2', tokenId: 'gabi', x: 1000, y: 240 }, aberta)
    expect(passo.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.accepted', reqId: 'm2', x: 1000, y: 240 } }])
  })
})
