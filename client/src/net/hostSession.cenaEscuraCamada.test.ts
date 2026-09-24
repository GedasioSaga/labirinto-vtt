import { describe, expect, it } from 'vitest'
import { pointInRing } from '../lib/floorContour'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, RegionPoint } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * SALA ESCURA NA CAMADA SALAS ESCONDIDA, pela REDE. Com a camada Salas oculta
 * pelo mestre, a sala escura não existe para o jogador: não escurece nada, e o
 * snapshot sai idêntico ao de uma sala clara. Se ela ainda cortasse a visão, o
 * recorte no anel de visão (e no explorado) desenharia o formato dela.
 *
 * Geometria (px de mundo, grade 40, sem paredes nem chão): Carla em (300,300),
 * fora da cripta; cripta escura em L, 400..700 sem o canto 550..700 x 550..700;
 * um vigia dentro do braço de baixo do L, em (450,620).
 */
const CODE = 'ESCU02'

const CRIPTA_EM_L: RegionPoint[] = [
  { x: 400, y: 400 },
  { x: 700, y: 400 },
  { x: 700, y: 550 },
  { x: 550, y: 550 },
  { x: 550, y: 700 },
  { x: 400, y: 700 },
]

function cripta(dark: boolean): Region {
  return {
    id: 'cripta',
    points: CRIPTA_EM_L,
    tag: '',
    fillColor: '#223',
    fillPattern: 'solid',
    data: {},
    room: dark ? { shape: 'polygon', name: 'Cripta', dark: true } : { shape: 'polygon', name: 'Cripta' },
  }
}

function mausoleu(opcoes: { dark: boolean; salasOcultas: boolean }): MapData {
  return {
    ...createEmptyMap('map_mausoleu', 'Mausoléu', 1000, 1000, 40),
    hiddenLayers: opcoes.salasOcultas ? ['salas'] : [],
    regions: [cripta(opcoes.dark)],
    tokens: [
      { id: 'carla', characterId: null, name: 'Carla', x: 300, y: 300, size: 1, image: null },
      { id: 'vigia', characterId: null, name: 'Vigia', x: 450, y: 620, size: 1, image: null },
    ],
  }
}

function carlaNaMesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 800, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const first = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Carla' }, map).outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(first.playerId, 'carla')
  return s
}

function snapshotDe(mensagens: { clientId: string; msg: HostMessage }[]): Extract<HostMessage, { type: 'snapshot' }> {
  const snap = mensagens.find((m) => m.clientId === 'c1' && m.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error('esperava snapshot para a Carla')
  return snap
}

const inVision = (vision: RegionPoint[][], point: RegionPoint): boolean => vision.some((ring) => ring.length >= 3 && pointInRing(point, ring))
const idsDasFichas = (snap: Extract<HostMessage, { type: 'snapshot' }>): string[] => snap.map.tokens.map((t) => t.id).sort()

describe('hostSession: sala escura em camada escondida não corta a visão do jogador', () => {
  it('controle: com a camada Salas à vista, a cripta escura esconde o vigia e fica fora da visão', () => {
    const map = mausoleu({ dark: true, salasOcultas: false })
    const snap = snapshotDe(carlaNaMesa(map).broadcast(map).outbound)
    expect(idsDasFichas(snap)).toEqual(['carla'])
    expect(inVision(snap.vision, { x: 450, y: 620 })).toBe(false)
    expect(inVision(snap.vision, { x: 300, y: 300 })).toBe(true)
  })

  it('SEGURANÇA: com a camada Salas escondida, o snapshot sai igual ao de sala clara — nem o L nem o nome chegam', () => {
    const escura = mausoleu({ dark: true, salasOcultas: true })
    const clara = mausoleu({ dark: false, salasOcultas: true })
    const snapEscura = snapshotDe(carlaNaMesa(escura).broadcast(escura).outbound)
    const snapClara = snapshotDe(carlaNaMesa(clara).broadcast(clara).outbound)
    expect(snapEscura.vision).toEqual(snapClara.vision)
    expect(snapEscura.explored).toEqual(snapClara.explored)
    expect(snapEscura.map.regions).toEqual([])
    const json = JSON.stringify(snapEscura)
    expect(json).not.toContain('Cripta')
    expect(json).not.toContain('"dark"')
    // Sem o escuro, os dois braços do L e o canto de fora dele ficam à vista.
    expect(idsDasFichas(snapEscura)).toEqual(['carla', 'vigia'])
    expect(inVision(snapEscura.vision, { x: 450, y: 620 })).toBe(true)
    expect(inVision(snapEscura.vision, { x: 620, y: 450 })).toBe(true)
    expect(inVision(snapEscura.vision, { x: 620, y: 620 })).toBe(true)
  })

  it('SEGURANÇA: o mestre esconde a camada Salas com a Carla já na mesa — o próximo snapshot para de cortar a visão', () => {
    const antes = mausoleu({ dark: true, salasOcultas: false })
    const depois = mausoleu({ dark: true, salasOcultas: true })
    const clara = mausoleu({ dark: false, salasOcultas: true })
    const sessao = carlaNaMesa(antes)
    expect(inVision(snapshotDe(sessao.broadcast(antes).outbound).vision, { x: 450, y: 620 })).toBe(false)
    const snapDepois = snapshotDe(sessao.broadcast(depois).outbound)
    const snapClara = snapshotDe(carlaNaMesa(clara).broadcast(clara).outbound)
    expect(snapDepois.vision).toEqual(snapClara.vision)
    expect(snapDepois.map.regions).toEqual([])
    expect(idsDasFichas(snapDepois)).toEqual(['carla', 'vigia'])
  })
})
