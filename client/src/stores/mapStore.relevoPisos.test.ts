import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import { deserializeMap, serializeMap } from '../lib/mapFile'
import { mapaDoPiso } from '../lib/pisos'
import type { Carimbo, MapData, PinceladaDeTextura, Region, RegionPoint, TracoDePenhasco } from '../types/map'

/**
 * PISOS x RELEVO: a pincelada de textura, o carimbo e o risco de penhasco
 * guardam o piso em que foram feitos, como toda entidade com piso. A
 * pincelada do 1º piso não aparece no térreo, a borracha do térreo não
 * alcança o 1º piso, e mapa salvo antes do campo abre no térreo, igual.
 */

/** Terra de (100, 100) a (900, 500), no piso pedido. */
function terra(piso?: number): Region {
  return {
    id: `terra-${piso ?? 0}`,
    tag: 'region',
    fillColor: '#a8776a',
    fillPattern: 'solid',
    data: {},
    points: [
      { x: 100, y: 100 },
      { x: 900, y: 100 },
      { x: 900, y: 500 },
      { x: 100, y: 500 },
    ],
    ...(piso === undefined ? {} : { piso }),
  }
}

/** Ao longo da costa de baixo (y = 500), de onde a parede desce à vista. */
const NA_COSTA: RegionPoint[] = [
  { x: 300, y: 500 },
  { x: 400, y: 505 },
  { x: 500, y: 500 },
]

function abrir(map: MapData, piso: number): void {
  useMapStore.getState().loadMap(map)
  useMapStore.setState({ pisoAtivo: piso })
}

function mapaDeDoisPisos(extra: Partial<MapData> = {}): MapData {
  return { ...mapFactory.createEmptyMap('m-relevo-pisos', 'M', 20, 12, 50), continente: true, regions: [terra(), terra(1)], ...extra }
}

const noPiso = (piso: number) => mapaDoPiso(useMapStore.getState().map, piso)

beforeEach(() => {
  useMapStore.getState().setPenhascoModo('riscar')
})

describe('texturas por piso', () => {
  it('a pincelada no 1º piso guarda o piso e não aparece no térreo', () => {
    abrir(mapaDeDoisPisos(), 1)
    expect(useMapStore.getState().pintarTextura({ tipo: 'pincel', textura: 'floresta', forca: 1, raio: 30, pontos: [{ x: 300, y: 300 }] })).toBe('pintou')
    expect(useMapStore.getState().map.texturas?.[0].piso).toBe(1)
    expect(noPiso(1).texturas).toHaveLength(1)
    expect(noPiso(0).texturas ?? []).toHaveLength(0)
  })

  it('a borracha do térreo não alcança a pincelada do 1º piso', () => {
    const doPrimeiro: PinceladaDeTextura = { id: 'p1', tipo: 'pincel', textura: 'floresta', forca: 1, raio: 30, pontos: [{ x: 300, y: 300 }], piso: 1 }
    abrir(mapaDeDoisPisos({ texturas: [doPrimeiro] }), 0)
    expect(useMapStore.getState().pintarTextura({ tipo: 'borracha', forca: 1, raio: 30, pontos: [{ x: 300, y: 300 }] })).toBe('nada-a-apagar')
    useMapStore.getState().apagarTodasAsTexturas()
    expect(useMapStore.getState().map.texturas).toEqual([doPrimeiro])
  })

  it('o balde do 1º piso guarda o piso', () => {
    abrir(mapaDeDoisPisos(), 1)
    expect(useMapStore.getState().encherComTextura({ x: 300, y: 300 })).toBe('pintou')
    const [balde] = useMapStore.getState().map.texturas ?? []
    expect(balde).toMatchObject({ tipo: 'balde', piso: 1, alvo: { id: 'terra-1' } })
    expect(noPiso(0).texturas ?? []).toHaveLength(0)
  })
})

describe('carimbos por piso', () => {
  const objeto = (id: string, x: number, y: number): Carimbo => ({ id, tipo: 'pinheiro', x, y, tamanho: 20, giro: 0 })

  it('o carimbo do 1º piso guarda o piso, não aparece no térreo e a borracha do térreo não o apaga', () => {
    abrir(mapaDeDoisPisos(), 1)
    expect(useMapStore.getState().carimbar([objeto('a', 300, 300)])).toBe('carimbou')
    expect(useMapStore.getState().map.carimbos?.[0].piso).toBe(1)
    expect(noPiso(0).carimbos ?? []).toHaveLength(0)
    useMapStore.setState({ pisoAtivo: 0 })
    expect(useMapStore.getState().apagarCarimbos([{ x: 300, y: 300 }], 40)).toBe('nada-a-apagar')
    useMapStore.getState().apagarTodosOsCarimbos()
    expect(useMapStore.getState().map.carimbos).toHaveLength(1)
  })
})

describe('penhasco por piso', () => {
  it('o risco do 1º piso guarda o piso e não aparece no térreo; a borracha do térreo não o alcança', () => {
    abrir(mapaDeDoisPisos(), 1)
    expect(useMapStore.getState().riscarPenhasco({ modo: 'riscar', raio: 30, pontos: NA_COSTA })).toBe('riscou')
    expect(useMapStore.getState().map.penhascos?.[0].piso).toBe(1)
    expect(noPiso(0).penhascos ?? []).toHaveLength(0)
    useMapStore.setState({ pisoAtivo: 0 })
    expect(useMapStore.getState().riscarPenhasco({ modo: 'apagar', raio: 60, pontos: NA_COSTA })).toBe('nada-a-apagar')
    useMapStore.getState().apagarTodosOsPenhascos()
    expect(useMapStore.getState().map.penhascos).toHaveLength(1)
  })

  it('a costa é a da terra do piso em edição: sem terra no 1º piso, o risco não acha costa', () => {
    abrir({ ...mapaDeDoisPisos(), regions: [terra()] }, 1)
    expect(useMapStore.getState().riscarPenhasco({ modo: 'riscar', raio: 30, pontos: NA_COSTA })).toBe('longe-da-costa')
  })
})

describe('arquivo', () => {
  it('mapa salvo antes do campo abre com tudo no térreo, sem ganhar chave', () => {
    const antigo = {
      ...mapaDeDoisPisos(),
      regions: [terra()],
      texturas: [{ id: 't', tipo: 'pincel', textura: 'floresta', forca: 1, raio: 30, pontos: [{ x: 300, y: 300 }] }],
      carimbos: [{ id: 'c', tipo: 'pinheiro', x: 300, y: 300, tamanho: 20, giro: 0 }],
      penhascos: [{ id: 'r', modo: 'riscar', raio: 30, pontos: NA_COSTA }],
    }
    const lido = deserializeMap(JSON.stringify(antigo))
    const terreo = mapaDoPiso(lido, 0)
    expect(terreo.texturas).toHaveLength(1)
    expect(terreo.carimbos).toHaveLength(1)
    expect(terreo.penhascos).toHaveLength(1)
    expect(lido.texturas?.[0]).not.toHaveProperty('piso')
    expect(lido.carimbos?.[0]).not.toHaveProperty('piso')
    expect(lido.penhascos?.[0]).not.toHaveProperty('piso')
  })

  it('o piso vai e volta pelo arquivo; piso torto sai (o item fica no térreo)', () => {
    const risco: TracoDePenhasco = { id: 'r', modo: 'riscar', raio: 30, pontos: NA_COSTA, piso: 2 }
    const mapa = {
      ...mapaDeDoisPisos(),
      texturas: [
        { id: 't1', tipo: 'pincel', textura: 'floresta', forca: 1, raio: 30, pontos: [{ x: 300, y: 300 }], piso: 1 },
        { id: 't2', tipo: 'pincel', textura: 'floresta', forca: 1, raio: 30, pontos: [{ x: 300, y: 300 }], piso: 'x' },
      ],
      carimbos: [{ id: 'c', tipo: 'pinheiro', x: 300, y: 300, tamanho: 20, giro: 0, piso: -1 }],
      penhascos: [risco],
    }
    const lido = deserializeMap(serializeMap(deserializeMap(JSON.stringify(mapa))))
    expect(lido.texturas?.map((t) => t.piso)).toEqual([1, undefined])
    expect(lido.carimbos?.[0].piso).toBe(-1)
    expect(lido.penhascos?.[0].piso).toBe(2)
  })
})
