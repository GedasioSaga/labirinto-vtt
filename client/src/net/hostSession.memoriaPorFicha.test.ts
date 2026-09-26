import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored, type Exploration } from '../lib/exploration'
import { createEmptyMap, setTokenPosition } from '../lib/mapFactory'
import type { DoorState, MapData, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * MEMÓRIA POR FICHA. Três salas lado a lado (A | B | C), separadas por
 * paredes cheias: da sala onde a Lia está não se vê nenhuma outra. O que a
 * Lia viu vai junto quando o mestre passa a ficha — e só o que ELA viu.
 */
const CODE = 'FICHA1'
const RADIUS = 700

const EM_A = { x: 200, y: 600 }
const EM_B = { x: 600, y: 600 }
const EM_C = { x: 1000, y: 600 }
/** Longe da parede e do armário: célula inteira da sala, no meio. */
const PONTO_A = { x: 200, y: 900 }
const PONTO_C = { x: 1000, y: 900 }

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>

function wall(id: string, x1: number, y1: number, x2: number, y2: number, door: DoorState | null = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function token(id: string, at: { x: number; y: number }): Token {
  return { id, characterId: null, name: `nome-${id}`, x: at.x, y: at.y, size: 1, image: null }
}

function sala(id: string, name: string, x0: number, x1: number): Region {
  const points = [
    { x: x0, y: 0 },
    { x: x1, y: 0 },
    { x: x1, y: 1200 },
    { x: x0, y: 1200 },
  ]
  return { id, points, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name } }
}

const ARMARIO_ABERTO: DoorState = { open: true, locked: false, kind: 'normal' }

function tresSalas(extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('torre', 'Torre', 30, 30, 40),
    walls: [wall('ab', 400, 0, 400, 1200), wall('bc', 800, 0, 800, 1200), wall('armario', 100, 1100, 200, 1100, ARMARIO_ABERTO)],
    regions: [sala('sala-a', 'Sala Alfa', 0, 400), sala('sala-b', 'Sala Beta', 400, 800), sala('sala-c', 'Sala Gama', 800, 1200)],
    tokens: [token('lia', EM_A), token('caio', EM_C)],
    ...extra,
  }
}

function mesa() {
  let n = 0
  const s: HostSession = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string, map: MapData): string => {
    const first = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map).outbound[0]?.msg
    if (first?.type !== 'welcome') throw new Error('esperava welcome')
    return first.playerId
  }
  // A tela de cada conexão: o último snapshot que ela recebeu (o broadcast só manda quando ela muda).
  const telas = new Map<string, Snapshot>()
  const snapshotPara = (clientId: string, map: MapData): Snapshot => {
    const saida = s.broadcast(map).outbound
    for (const o of saida) if (o.msg.type === 'snapshot') telas.set(o.clientId, o.msg)
    const msg = saida.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
    if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
    return msg
  }
  const tela = (clientId: string): Snapshot => {
    const snap = telas.get(clientId)
    if (snap === undefined) throw new Error(`sem tela para ${clientId}`)
    return snap
  }
  return { s, entra, snapshotPara, tela }
}

function exploradoDe(snap: Snapshot): Exploration {
  const exp = decodeExploration(snap.explored)
  if (exp === null) throw new Error('explored inválido')
  return exp
}

/** A Lia começa na sala A e anda para a B: a A vira memória (não se vê de B). */
function liaAndaDeAParaB(t: ReturnType<typeof mesa>, clientId: string, base: MapData = tresSalas()): MapData {
  const naA = t.snapshotPara(clientId, base)
  expect(JSON.stringify(naA)).toContain('Sala Alfa')
  const emB = setTokenPosition(base, 'lia', EM_B.x, EM_B.y)
  const naB = t.snapshotPara(clientId, emB)
  // Pré-condição: de B, a sala A não está na visão — só na memória.
  expect(isPointExplored(exploradoDe(naB), PONTO_A)).toBe(true)
  return emB
}

describe('memória por ficha', () => {
  it('passar a ficha passa o que ela viu: quem recebe já tem a sala A no mapa', () => {
    const t = mesa()
    const ana = t.entra('c1', 'Ana', tresSalas())
    t.s.assignToken(ana, 'lia')
    const emB = liaAndaDeAParaB(t, 'c1')

    const bia = t.entra('c2', 'Bia', emB)
    t.s.assignToken(bia, 'lia')
    const snap = t.snapshotPara('c2', emB)
    expect(isPointExplored(exploradoDe(snap), PONTO_A)).toBe(true)
    expect(snap.map.regions.map((r) => r.id)).toContain('sala-a')
  })

  it('a porta lembrada vai junto, com o estado que a ficha viu (aberta)', () => {
    const t = mesa()
    const ana = t.entra('c1', 'Ana', tresSalas())
    t.s.assignToken(ana, 'lia')
    const emB = liaAndaDeAParaB(t, 'c1')

    const bia = t.entra('c2', 'Bia', emB)
    t.s.assignToken(bia, 'lia')
    const armario = t.snapshotPara('c2', emB).map.walls.find((w) => w.id === 'armario')
    expect(armario?.door?.open).toBe(true)
  })

  it('quem chega depois do kick herda o mapa da ficha', () => {
    const t = mesa()
    const ana = t.entra('c1', 'Ana', tresSalas())
    t.s.assignToken(ana, 'lia')
    const emB = liaAndaDeAParaB(t, 'c1')
    t.s.kick('c1')

    const carla = t.entra('c3', 'Carla', emB)
    t.s.assignToken(carla, 'lia')
    expect(isPointExplored(exploradoDe(t.snapshotPara('c3', emB)), PONTO_A)).toBe(true)
  })

  it('devolver a ficha traz o que o substituto viu com ela', () => {
    const t = mesa()
    const ana = t.entra('c1', 'Ana', tresSalas())
    const bia = t.entra('c2', 'Bia', tresSalas())
    t.s.assignToken(ana, 'lia')
    const emB = liaAndaDeAParaB(t, 'c1')

    t.s.assignToken(bia, 'lia')
    t.snapshotPara('c2', emB)
    const emC = setTokenPosition(emB, 'lia', EM_C.x, EM_C.y)
    expect(isPointExplored(exploradoDe(t.snapshotPara('c2', emC)), PONTO_C)).toBe(true)
    const deVoltaEmB = setTokenPosition(emC, 'lia', EM_B.x, EM_B.y)
    t.snapshotPara('c2', deVoltaEmB)

    t.s.assignToken(ana, 'lia')
    const snap = t.snapshotPara('c1', deVoltaEmB)
    // A Ana nunca esteve na C: quem a viu foi a Lia, nas mãos da Bia.
    expect(isPointExplored(exploradoDe(snap), PONTO_C)).toBe(true)
    expect(snap.map.regions.map((r) => r.id)).toContain('sala-c')
  })

  it('SEGURANÇA: a ficha passada leva só o que ELA viu, nunca o que outra ficha do mesmo dono viu', () => {
    const t = mesa()
    const bruno = t.entra('c1', 'Bruno', tresSalas())
    t.s.assignToken(bruno, 'lia')
    t.s.assignToken(bruno, 'caio')
    // Bruno vê A (Lia) e C (Caio) ao mesmo tempo: a tela dele (a da Lia já em B) tem os dois.
    const emB = liaAndaDeAParaB(t, 'c1')
    expect(isPointExplored(exploradoDe(t.tela('c1')), PONTO_C)).toBe(true)

    const bia = t.entra('c2', 'Bia', emB)
    t.s.assignToken(bia, 'lia')
    const snap = t.snapshotPara('c2', emB)
    const exp = exploradoDe(snap)
    expect(isPointExplored(exp, PONTO_A)).toBe(true)
    expect(isPointExplored(exp, PONTO_C)).toBe(false)
    expect(isPointExplored(exp, { x: 1100, y: 300 })).toBe(false)
    expect(JSON.stringify(snap)).not.toContain('Sala Gama')
    expect(snap.map.tokens.map((tk) => tk.id)).toEqual(['lia'])
  })

  it('SEGURANÇA: zona que o mestre escondeu DEPOIS que a ficha viu não chega a quem herda', () => {
    const t = mesa()
    const ana = t.entra('c1', 'Ana', tresSalas())
    t.s.assignToken(ana, 'lia')
    const emB = liaAndaDeAParaB(t, 'c1')
    const zona = {
      id: 'zona-cofre',
      name: 'nome-da-zona',
      revealed: false,
      points: [
        { x: 40, y: 40 },
        { x: 360, y: 40 },
        { x: 360, y: 360 },
        { x: 40, y: 360 },
      ],
    }
    const escondida: MapData = { ...emB, concealZones: [zona] }

    const bia = t.entra('c2', 'Bia', escondida)
    t.s.assignToken(bia, 'lia')
    const snap = t.snapshotPara('c2', escondida)
    const exp = exploradoDe(snap)
    expect(isPointExplored(exp, { x: 200, y: 200 })).toBe(false)
    expect(isPointExplored(exp, PONTO_A)).toBe(true)
    expect(JSON.stringify(snap)).not.toContain('nome-da-zona')
  })

  it('SEGURANÇA: ajudante emprestado sem visão não entrega a memória da ficha', () => {
    const t = mesa()
    const ana = t.entra('c1', 'Ana', tresSalas())
    t.s.assignToken(ana, 'lia')
    t.s.assignToken(ana, 'caio')
    const emB = liaAndaDeAParaB(t, 'c1')

    const bia = t.entra('c2', 'Bia', emB)
    t.s.assignToken(bia, 'caio')
    t.s.lendToken(bia, 'lia', { tarefa: 'Vigiar a porta', minutos: 30, visao: false })
    const snap = t.snapshotPara('c2', emB)
    expect(isPointExplored(exploradoDe(snap), PONTO_A)).toBe(false)
    expect(isPointExplored(exploradoDe(snap), PONTO_C)).toBe(true)
    expect(JSON.stringify(snap)).not.toContain('Sala Alfa')
  })

  it('Esconder planta apaga também a memória das fichas do jogador (a planta não volta sozinha)', () => {
    const t = mesa()
    const ana = t.entra('c1', 'Ana', tresSalas())
    t.s.assignToken(ana, 'lia')
    const emB = liaAndaDeAParaB(t, 'c1')

    t.s.hidePlan(ana)
    const snap = t.snapshotPara('c1', emB)
    expect(isPointExplored(exploradoDe(snap), PONTO_A)).toBe(false)
    expect(isPointExplored(exploradoDe(snap), EM_B)).toBe(true)

    const bia = t.entra('c2', 'Bia', emB)
    t.s.assignToken(bia, 'lia')
    expect(isPointExplored(exploradoDe(t.snapshotPara('c2', emB)), PONTO_A)).toBe(false)
  })

  it('a visão de cada ficha fica no host: o snapshot não leva campo novo', () => {
    const t = mesa()
    const ana = t.entra('c1', 'Ana', tresSalas())
    t.s.assignToken(ana, 'lia')
    const snap = t.snapshotPara('c1', tresSalas())
    // `partyTokens` (ITEM PEGÁVEL) e `place`/`places` (LUGARES) já existiam antes; o que não pode entrar é a visão por ficha.
    expect(Object.keys(snap).sort()).toEqual(['concealed', 'explored', 'map', 'ownTokens', 'partyTokens', 'place', 'places', 'rev', 'type', 'vision'])
    expect(JSON.stringify(snap)).not.toContain('eyes')
  })
})
