import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { aplicarEstadoNoMapa } from '../lib/estadoDoMundo'
import type { DoorState, MapData, Pin, Wall } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * ESTADO DO MUNDO pela rede. A comporta ao lado da Gabi e o alçapão aos pés
 * dela obedecem à "Maré". O mestre troca a maré para baixa: no snapshot
 * seguinte a comporta chega aberta e o alçapão livre. Nenhum snapshot leva a
 * regra, o id do estado ou os valores que o mestre escreveu.
 */
const CODE = 'MARE01'
const MARE = 'estado_mare_da_torre'

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

const comporta: DoorState = {
  open: false,
  locked: true,
  kind: 'normal',
  porEstado: {
    estadoId: MARE,
    efeitos: [
      { valor: 'AltaSecreta', efeito: 'trancada' },
      { valor: 'BaixaSecreta', efeito: 'aberta' },
    ],
  },
}

const alcapao: Pin = {
  id: 'alcapao',
  x: 475,
  y: 580,
  kind: 'viagem',
  description: 'Alçapão',
  image: null,
  passagem: 'trancada',
  porEstado: {
    estadoId: MARE,
    efeitos: [
      { valor: 'AltaSecreta', efeito: 'trancada' },
      { valor: 'BaixaSecreta', efeito: 'livre' },
    ],
  },
}

function andarZero(): MapData {
  return {
    ...createEmptyMap('map_andar0', 'Andar 0 das Galerias', 1000, 1000, 50),
    walls: [parede('n1', 0, 500, 450, 500), parede('comporta', 450, 500, 500, 500, { door: comporta }), parede('n2', 500, 500, 1000, 500)],
    tokens: [{ id: 'gabi', characterId: null, name: 'Gabi', x: 475, y: 540, size: 1, image: null }],
    pins: [alcapao],
  }
}

function gabiNaMesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 400, now: () => 0, randomId: () => `id-${(n += 1)}` })
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

function semRegra(snap: Extract<HostMessage, { type: 'snapshot' }>) {
  const json = JSON.stringify(snap)
  expect(json).not.toContain('porEstado')
  expect(json).not.toContain(MARE)
  expect(json).not.toContain('AltaSecreta')
  expect(json).not.toContain('BaixaSecreta')
}

describe('hostSession: o jogador recebe o efeito do estado do mundo, nunca o estado', () => {
  it('maré alta: comporta trancada e alçapão trancado, sem a regra no snapshot', () => {
    const map = andarZero()
    const s = gabiNaMesa(map)
    const snap = snapshotDe(s.broadcast(map).outbound)
    // O efeito (trancada) mora no host; o CADEADO nunca sai no recorte (`withoutLock`, fogFilter):
    // o jogador vê a comporta fechada comum e descobre a tranca tentando abrir.
    expect(snap.map.walls.find((w) => w.id === 'comporta')?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(map.walls.find((w) => w.id === 'comporta')?.door?.locked).toBe(true)
    expect(snap.map.pins.find((p) => p.id === 'alcapao')?.passagem).toBe('trancada')
    semRegra(snap)
  })

  it('o mestre troca para maré baixa: o snapshot seguinte traz a comporta aberta e o alçapão livre, ainda sem a regra', () => {
    const map = andarZero()
    const s = gabiNaMesa(map)
    s.broadcast(map)
    const baixa = aplicarEstadoNoMapa(map, MARE, 'BaixaSecreta')
    const snap = snapshotDe(s.broadcast(baixa).outbound)
    expect(snap.map.walls.find((w) => w.id === 'comporta')?.door).toEqual({ open: true, locked: false, kind: 'normal' })
    expect(snap.map.pins.find((p) => p.id === 'alcapao')?.passagem).toBe('livre')
    semRegra(snap)
  })

  it('a Gabi passa pela comporta que a maré abriu (o host valida pelo estado gravado)', () => {
    const map = andarZero()
    const s = gabiNaMesa(map)
    s.broadcast(map)
    const fechada = s.handleMessage('c1', { type: 'token.move', reqId: 'm1', tokenId: 'gabi', x: 475, y: 450 }, map)
    expect(fechada.applyMove).toBeUndefined()
    const baixa = aplicarEstadoNoMapa(map, MARE, 'BaixaSecreta')
    s.broadcast(baixa)
    const aberta = s.handleMessage('c1', { type: 'token.move', reqId: 'm2', tokenId: 'gabi', x: 475, y: 450 }, baixa)
    expect(aberta.applyMove).toEqual(expect.objectContaining({ tokenId: 'gabi', x: 475, y: 450 }))
  })
})
