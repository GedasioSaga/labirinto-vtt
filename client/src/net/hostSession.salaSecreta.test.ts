import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, Wall } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * SALA SECRETA NÃO VAZA, pela rede: o snapshot que a Ana recebe junto da
 * estante traz a parede leste inteira (sem porta) e nada do Quarto Secreto; e
 * tocar a estante não faz nada.
 */
const CODE = 'SECR01'

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

function mansao(secreta: boolean, trancada: boolean): MapData {
  const bib = { regionId: 'r-bib' }
  const sec = { regionId: 'r-secreto' }
  return {
    ...createEmptyMap('map_estante', 'Mansao', 1200, 600, 50),
    walls: [
      parede('bib-n', 500, 100, 900, 100, bib),
      parede('bib-l1', 900, 100, 900, 250, bib),
      parede('bib-l2', 900, 300, 900, 450, bib),
      parede('bib-s', 900, 450, 500, 450, bib),
      parede('bib-o', 500, 450, 500, 100, bib),
      parede('estante', 900, 250, 900, 300, { ...sec, door: { open: false, locked: trancada, kind: 'normal' } }),
      parede('sec-n', 900, 100, 1150, 100, sec),
      parede('sec-l', 1150, 100, 1150, 450, sec),
      parede('sec-s', 1150, 450, 900, 450, sec),
    ],
    regions: [sala('r-bib', 'Biblioteca', 500, 100, 900, 450), { ...sala('r-secreto', 'Quarto Secreto', 900, 100, 1150, 450), secret: secreta }],
    // Ana encostada na estante: perto o bastante para tocar a porta, se fosse porta.
    tokens: [{ id: 'lanterna', characterId: null, name: 'Lanterna', x: 880, y: 275, size: 1, image: null }],
  }
}

function anaNaMesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const first = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(first.playerId, 'lanterna')
  return s
}

function snapshotDe(mensagens: { clientId: string; msg: HostMessage }[]): Extract<HostMessage, { type: 'snapshot' }> {
  const snap = mensagens.find((m) => m.clientId === 'c1' && m.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error('esperava snapshot para a Ana')
  return snap
}

describe('hostSession: sala secreta não vaza pela rede', () => {
  it('SEGURANÇA: o snapshot traz a estante como parede comum e nada do Quarto Secreto', () => {
    const map = mansao(true, true)
    const s = anaNaMesa(map)
    const snap = snapshotDe(s.broadcast(map).outbound)
    const json = JSON.stringify(snap)
    expect(json).not.toContain('r-secreto')
    expect(json).not.toContain('Quarto Secreto')
    expect(json).not.toContain('"sec-n"')
    const estante = snap.map.walls.find((w) => w.id === 'estante')
    expect(estante?.door).toBeNull()
    // Vínculo da Biblioteca, como as paredes vizinhas: nada que a distinga delas.
    expect(estante?.regionId).toBe('r-bib')
    // A visão não passa pela estante: nenhum vértice do anel além da parede leste.
    expect(Math.max(...snap.vision.flat().map((p) => p.x))).toBeLessThanOrEqual(900.5)
  })

  it('tocar a estante enquanto a sala é secreta não faz nada (recusa sem dizer que é porta)', () => {
    const map = mansao(true, false)
    const s = anaNaMesa(map)
    s.broadcast(map)
    const r = s.handleMessage('c1', { type: 'door.toggle', wallId: 'estante' }, map)
    expect(r.applyDoor).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'estante', reason: 'not_visible' } }])
  })

  it('mestre desliga o oculto e destranca: a porta chega e abre', () => {
    const map = mansao(false, false)
    const s = anaNaMesa(map)
    const snap = snapshotDe(s.broadcast(map).outbound)
    expect(snap.map.walls.find((w) => w.id === 'estante')?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(s.handleMessage('c1', { type: 'door.toggle', wallId: 'estante' }, map).applyDoor).toEqual({ wallId: 'estante', open: true, playerId: 'id-1', playerName: 'Ana' })
  })
})
