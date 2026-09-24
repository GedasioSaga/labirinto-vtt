import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * DENTRO DA SALA SECRETA, pela rede: a Ana, com a ficha dentro do Quarto
 * Secreto, recebe o cômodo e o pino por onde veio; a Bia, na Biblioteca, não
 * recebe nada dele. Depois que a Ana sai, o quarto fica no mapa lembrado DELA
 * (e só dela); "Esconder planta" esquece a descoberta junto com o resto.
 */
const CODE = 'SECR02'

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Region> = {}): Region {
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
    ...extra,
  }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function mansao(ana: { x: number; y: number }): MapData {
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
      parede('estante', 900, 250, 900, 300, { ...sec, door: { open: false, locked: true, kind: 'normal' } }),
      parede('sec-n', 900, 100, 1150, 100, sec),
      parede('sec-l', 1150, 100, 1150, 450, sec),
      parede('sec-s', 1150, 450, 900, 450, sec),
    ],
    regions: [sala('r-bib', 'Biblioteca', 500, 100, 900, 450), sala('r-secreto', 'Quarto Secreto', 900, 100, 1150, 450, { secret: true })],
    pins: [{ id: 'pino-chegada', x: 1000, y: 275, kind: 'viagem', description: 'Alçapão', image: null }],
    tokens: [ficha('ana', ana.x, ana.y), ficha('bia', 700, 275)],
  }
}

const DENTRO = { x: 1000, y: 200 }
const FORA = { x: 800, y: 200 }

function mesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return welcome.playerId
  }
  const ana = entra('c-ana', 'Ana')
  const bia = entra('c-bia', 'Bia')
  s.assignToken(ana, 'ana')
  s.assignToken(bia, 'bia')
  return { s, ana }
}

function snapshotDe(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const snap = r.outbound.find((m) => m.clientId === clientId && m.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return snap
}

describe('hostSession: dentro da sala secreta', () => {
  it('Ana dentro do quarto recebe o cômodo e o pino; SEGURANÇA: a Bia não recebe nada dele', () => {
    const map = mansao(DENTRO)
    const { s } = mesa(map)
    const r = s.broadcast(map)
    const daAna = snapshotDe(r, 'c-ana')
    expect(daAna.map.regions.find((reg) => reg.id === 'r-secreto')?.room?.name).toBe('Quarto Secreto')
    expect(daAna.map.walls.map((w) => w.id)).toContain('sec-l')
    expect(daAna.map.pins.map((p) => p.id)).toEqual(['pino-chegada'])
    const daBia = JSON.stringify(snapshotDe(r, 'c-bia'))
    expect(daBia).not.toContain('r-secreto')
    expect(daBia).not.toContain('Quarto Secreto')
    expect(daBia).not.toContain('pino-chegada')
    expect(daBia).not.toContain('"sec-l"')
    expect(daBia).not.toContain('nome-ana')
  })

  it('a Ana sai: o quarto fica no mapa lembrado dela; SEGURANÇA: a Bia continua sem ele', () => {
    const { s } = mesa(mansao(DENTRO))
    s.broadcast(mansao(DENTRO))
    const saiu = mansao(FORA)
    const r = s.broadcast(saiu)
    const daAna = snapshotDe(r, 'c-ana')
    expect(daAna.map.regions.find((reg) => reg.id === 'r-secreto')?.room?.name).toBe('Quarto Secreto')
    expect(daAna.map.pins.map((p) => p.id)).toEqual(['pino-chegada'])
    const daBia = JSON.stringify(snapshotDe(r, 'c-bia'))
    expect(daBia).not.toContain('r-secreto')
    expect(daBia).not.toContain('pino-chegada')
  })

  it('"Esconder planta" esquece a descoberta junto com o resto da memória', () => {
    const { s, ana } = mesa(mansao(DENTRO))
    s.broadcast(mansao(DENTRO))
    s.hidePlan(ana)
    const r = s.broadcast(mansao(FORA))
    const daAna = JSON.stringify(snapshotDe(r, 'c-ana'))
    expect(daAna).not.toContain('r-secreto')
    expect(daAna).not.toContain('pino-chegada')
    expect(daAna).toContain('r-bib')
  })

  it('de dentro do quarto a estante é porta à vista: tocar recusa por trancada, não por "não visível"', () => {
    const map = mansao(DENTRO)
    const { s } = mesa(map)
    s.broadcast(map)
    const r = s.handleMessage('c-ana', { type: 'door.toggle', wallId: 'estante' }, map)
    // A estante é porta do próprio quarto: de dentro ela é vista; recusa por trancada, não por invisível.
    expect(r.outbound).toEqual([{ clientId: 'c-ana', msg: { type: 'door.toggle.rejected', wallId: 'estante', reason: 'locked' } }])
  })
})
