/**
 * SALA POR CIMA DA TEXTURA (pedido de 12/10/2026: "A sala é para ficar acima
 * das texturas caso a sala tenha sido feito depois de ter colocado a
 * textura"). A ordem entre sala e textura é a ordem em que o mestre as fez:
 * a sala de depois tira a textura de antes de dentro dela (o chão da sala
 * aparece); a textura pintada depois da sala continua por cima dela.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from '../stores/mapStore'
import * as mapFactory from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { planoDasTexturas } from './planoDasTexturas'
import { lerTexturas, salasPorCimaDasTexturas, texturasParaJogador } from './texturas'
import type { MapData, PinceladaDeTextura, Region, RegionPoint } from '../types/map'

const quadrado = (x: number, y: number, lado: number): RegionPoint[] => [
  { x, y },
  { x: x + lado, y },
  { x: x + lado, y: y + lado },
  { x, y: y + lado },
]
const sala = (id: string, pontos: RegionPoint[], extra: Partial<Region> = {}): Region => ({
  id,
  points: pontos,
  tag: 'room',
  fillColor: '#d6cfc0',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: id },
  ...extra,
})
const regiaoComum = (id: string, pontos: RegionPoint[]): Region => ({ id, points: pontos, tag: 'region', fillColor: '#a8776a', fillPattern: 'solid', data: {} })
const grama = (id: string, extra: Partial<PinceladaDeTextura> = {}): PinceladaDeTextura =>
  ({ id, tipo: 'pincel', textura: 'grama', forca: 1, raio: 300, pontos: [{ x: 300, y: 300 }], ...extra }) as PinceladaDeTextura
const marca = (regiao: string): PinceladaDeTextura => ({ id: `sala-${regiao}`, tipo: 'sala', regiao })
const todas = () => true

const SALA = sala('s4', quadrado(200, 200, 200))

describe('plano: a sala de depois tira a textura de antes', () => {
  it('textura e depois a sala: o passo da sala apaga, na forma dela, da camada que já existia', () => {
    const plano = planoDasTexturas([grama('g'), marca('s4')], [SALA], [], todas)
    expect(plano?.passos).toHaveLength(2)
    const [, daSala] = plano?.passos ?? []
    expect(daSala.camada).toBeNull()
    expect(daSala.apagaDe).toEqual([0])
    expect(daSala.forca).toBe(1)
    expect(daSala.forma).toEqual({ tipo: 'balde', forma: { contorno: SALA.points, recortes: [], caixa: { minX: 200, minY: 200, maxX: 400, maxY: 400 } } })
  })

  it('sala e depois a textura: a tinta de depois volta a cobrir a sala (o passo dela vem depois do da sala)', () => {
    const plano = planoDasTexturas([grama('g0', { pontos: [{ x: 2000, y: 2000 }] }), marca('s4'), grama('g')], [SALA], [], todas)
    expect(plano?.passos.map((p) => p.camada)).toEqual([0, null, 0])
  })

  it('sala apagada, sem fundo ou fora do recorte: o passo dela não tira nada', () => {
    expect(planoDasTexturas([grama('g'), marca('s4')], [], [], todas)?.passos).toHaveLength(1)
    expect(planoDasTexturas([grama('g'), marca('s4')], [{ ...SALA, filled: false }], [], todas)?.passos).toHaveLength(1)
  })
})

describe('salasPorCimaDasTexturas: a sala que nasce depois da textura ganha o passo dela', () => {
  const base = (extra: Partial<MapData> = {}): MapData => ({ ...mapFactory.createEmptyMap('m-sala-cima', 'M', 20, 12, 50), ...extra })

  it('sala nova num mapa com textura: o passo da sala entra no fim da lista', () => {
    const antes = base({ texturas: [grama('g')] })
    const depois = salasPorCimaDasTexturas(antes, { ...antes, regions: [SALA] })
    expect(depois.texturas?.map((p) => p.tipo)).toEqual(['pincel', 'sala'])
    expect(depois.texturas?.[1]).toMatchObject({ tipo: 'sala', regiao: 's4' })
  })

  it('sem textura, região comum ou sala que já existia: nada muda', () => {
    const semTextura = base()
    const comSala = { ...semTextura, regions: [SALA] }
    expect(salasPorCimaDasTexturas(semTextura, comSala)).toBe(comSala)
    const antes = base({ texturas: [grama('g')] })
    const comRegiao = { ...antes, regions: [regiaoComum('r', quadrado(0, 0, 100))] }
    expect(salasPorCimaDasTexturas(antes, comRegiao)).toBe(comRegiao)
    const jaTinha = base({ texturas: [grama('g')], regions: [SALA] })
    const movida = { ...jaTinha, regions: [{ ...SALA, points: quadrado(300, 300, 200) }] }
    expect(salasPorCimaDasTexturas(jaTinha, movida)).toBe(movida)
  })

  it('PISOS: só a textura do piso da sala conta, e o passo nasce no piso dela', () => {
    const antes = base({ texturas: [grama('g', { piso: 1 })] })
    const noTerreo = { ...antes, regions: [SALA] }
    expect(salasPorCimaDasTexturas(antes, noTerreo)).toBe(noTerreo)
    const noPrimeiro = salasPorCimaDasTexturas(antes, { ...antes, regions: [{ ...SALA, piso: 1 }] })
    expect(noPrimeiro.texturas?.[1]).toMatchObject({ tipo: 'sala', regiao: 's4', piso: 1 })
  })
})

describe('o passo da sala no arquivo e no jogador', () => {
  it('sobrevive à leitura do arquivo; quebrado sai', () => {
    expect(lerTexturas([grama('g'), marca('s4')])).toEqual([grama('g'), marca('s4')])
    expect(lerTexturas([grama('g'), { id: 'x', tipo: 'sala', regiao: '' }])).toEqual([grama('g')])
  })

  it('vai ao jogador só com a sala no recorte dele', () => {
    const conhece = () => true
    const escondido = () => false
    expect(texturasParaJogador([grama('g'), marca('s4')], conhece, escondido, (alvo) => alvo.id === 's4')?.map((p) => p.tipo)).toEqual(['pincel', 'sala'])
    expect(texturasParaJogador([grama('g'), marca('s4')], conhece, escondido, () => false)?.map((p) => p.tipo)).toEqual(['pincel'])
  })
})

describe('editor: criar a sala depois de pintar', () => {
  beforeEach(() => {
    useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('m-sala-cima-store', 'M', 20, 12, 50) })
  })

  it('a sala nova sai por cima da textura, e um Ctrl+Z desfaz a sala e o passo juntos', () => {
    expect(useMapStore.getState().pintarTextura({ tipo: 'pincel', textura: 'floresta', forca: 1, raio: 200, pontos: [{ x: 300, y: 300 }] })).toBe('pintou')
    useMapStore.getState().addRoom(SALA, [])
    const passos = useMapStore.getState().map.texturas ?? []
    expect(passos.map((p) => p.tipo)).toEqual(['pincel', 'sala'])
    // Salvo e aberto de novo, a ordem continua.
    const reaberto = deserializeMap(serializeMap(useMapStore.getState().map))
    expect(reaberto.texturas?.map((p) => p.tipo)).toEqual(['pincel', 'sala'])
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.regions).toHaveLength(0)
    expect(useMapStore.getState().map.texturas?.map((p) => p.tipo)).toEqual(['pincel'])
  })

  it('pintar depois da sala: a pincelada nova entra depois do passo da sala (cobre a sala)', () => {
    useMapStore.getState().pintarTextura({ tipo: 'pincel', textura: 'floresta', forca: 1, raio: 200, pontos: [{ x: 300, y: 300 }] })
    useMapStore.getState().addRoom(SALA, [])
    useMapStore.getState().pintarTextura({ tipo: 'pincel', textura: 'floresta', forca: 1, raio: 200, pontos: [{ x: 300, y: 300 }] })
    expect(useMapStore.getState().map.texturas?.map((p) => p.tipo)).toEqual(['pincel', 'sala', 'pincel'])
  })

  it('sala criada antes de qualquer textura não ganha passo', () => {
    useMapStore.getState().addRoom(SALA, [])
    expect(useMapStore.getState().map.texturas).toBeUndefined()
  })
})
