import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'
import * as mapFactory from '../lib/mapFactory'
import { carimbo, linha, marcador, peca, pino } from '../lib/__fixtures__/itensDeCamada'
import type { Carimbo, LayerId, MapData } from '../types/map'

/**
 * FERRAMENTAS DE CRIAR E EDITAR × CADEADO DA CAMADA (fase 3, fatia 5). Pino
 * (Anotações), linha (Paredes), marcador (Portas), textura e carimbo
 * (Terreno) perguntam ao ponto único: camada travada RECUSA o gesto sem mudar
 * o mapa nem gastar Ctrl+Z, e avisa com "Destravar" (um aviso por camada).
 * Destravada, tudo como hoje.
 */

/**
 * O cadeado de Terreno ainda não tem onde morar (`lockedLayers` guarda só as
 * 9 camadas de antes; a fatia 6 decide onde fica o das 13). O teste simula o
 * mapa que essa fatia vai gravar para provar que a recusa já está ligada.
 */
const TERRENO_TRAVADO = ['terreno'] as unknown as LayerId[] // as: simula o cadeado de Terreno que `lockedLayers` (LayerId[]) ainda não guarda

function abrir(extra: Partial<MapData> = {}): void {
  useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('m', 'M', 20, 12, 50), continente: true, ...extra })
  useToastStore.setState({ toasts: [] })
}

function avisos(): string[] {
  return useToastStore.getState().toasts.map((aviso) => aviso.text)
}

function semMudanca(antes: MapData): void {
  expect(useMapStore.getState().map).toBe(antes)
  expect(useMapStore.getState().past).toHaveLength(0)
}

describe('pino × camada Anotações travada', () => {
  beforeEach(() => abrir({ pins: [pino], lockedLayers: ['anotacoes'] }))

  it('criar recusa e avisa', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().addPin({ ...pino, id: 'p2' })
    semMudanca(antes)
    expect(avisos()).toEqual(['A camada Anotações está travada'])
  })

  it('mover, editar e apagar recusam, com UM aviso só', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().movePinLive(pino.id, 500, 500)
    useMapStore.getState().updatePin(pino.id, { nome: 'Cripta' })
    useMapStore.getState().removePin(pino.id)
    semMudanca(antes)
    expect(avisos()).toEqual(['A camada Anotações está travada'])
  })

  it('destravada, criar e apagar funcionam como hoje', () => {
    abrir({ pins: [pino] })
    useMapStore.getState().addPin({ ...pino, id: 'p2' })
    useMapStore.getState().removePin(pino.id)
    expect(useMapStore.getState().map.pins.map((p) => p.id)).toEqual(['p2'])
    expect(avisos()).toEqual([])
  })
})

describe('linhas e marcadores do mapa × Paredes e Portas travadas', () => {
  it('Paredes travada: "linhas e portas a partir da imagem" recusa inteiro e avisa', () => {
    abrir({ lockedLayers: ['paredes'] })
    const antes = useMapStore.getState().map
    useMapStore.getState().addMapDetails([linha], [marcador])
    semMudanca(antes)
    expect(avisos()).toEqual(['A camada Paredes está travada'])
  })

  it('Portas travada: o marcador barra', () => {
    abrir({ lockedLayers: ['portas'] })
    const antes = useMapStore.getState().map
    useMapStore.getState().addMapDetails([], [marcador])
    semMudanca(antes)
    expect(avisos()).toEqual(['A camada Portas está travada'])
  })

  it('recriar o minimapa com Salas travada no mapa antigo recusa (Chão segue Salas)', () => {
    abrir({ lockedLayers: ['salas'] })
    const antes = useMapStore.getState().map
    useMapStore.getState().applyMinimapTrace([peca], [linha], [marcador], {})
    semMudanca(antes)
    expect(avisos()).toEqual(['A camada Salas está travada'])
  })

  it('destravadas, entram como hoje', () => {
    abrir()
    useMapStore.getState().addMapDetails([linha], [marcador])
    expect(useMapStore.getState().map.lines).toEqual([linha])
    expect(useMapStore.getState().map.markers).toEqual([marcador])
  })
})

describe('texturas e carimbos × Terreno travada', () => {
  it('pincel, borracha, balde e "apagar todas" de textura recusam e avisam', () => {
    abrir({ lockedLayers: TERRENO_TRAVADO })
    useMapStore.getState().setTexturaEscolhida('floresta')
    const antes = useMapStore.getState().map
    const s = useMapStore.getState()
    expect(s.pintarTextura({ tipo: 'pincel', textura: 'floresta', forca: 0.8, raio: 30, pontos: [{ x: 150, y: 150 }] })).toBe('camada-travada')
    expect(s.pintarTextura({ tipo: 'borracha', forca: 1, raio: 30, pontos: [{ x: 150, y: 150 }] })).toBe('camada-travada')
    expect(s.encherComTextura({ x: 150, y: 150 })).toBe('camada-travada')
    s.apagarTodasAsTexturas()
    semMudanca(antes)
    expect(avisos()).toEqual(['A camada Terreno está travada'])
  })

  it('carimbar, apagar e "apagar todos" recusam e avisam', () => {
    abrir({ lockedLayers: TERRENO_TRAVADO, carimbos: [carimbo] })
    const antes = useMapStore.getState().map
    const s = useMapStore.getState()
    expect(s.carimbar([{ ...carimbo, id: 'c2' }])).toBe('camada-travada')
    expect(s.apagarCarimbos([{ x: carimbo.x, y: carimbo.y }], 50)).toBe('camada-travada')
    s.apagarTodosOsCarimbos()
    semMudanca(antes)
    expect(avisos()).toEqual(['A camada Terreno está travada'])
  })

  it('carimbo com camada escolhida travada fica; o livre ao lado sai', () => {
    const preso: Carimbo = { ...carimbo, id: 'preso', camada: 'objetos' }
    abrir({ lockedLayers: ['objetos'], carimbos: [preso, carimbo] })
    expect(useMapStore.getState().apagarCarimbos([{ x: carimbo.x, y: carimbo.y }], 50)).toBe('apagou')
    expect(useMapStore.getState().map.carimbos?.map((c) => c.id)).toEqual(['preso'])
    expect(avisos()).toEqual(['A camada Objetos está travada'])
  })

  it('Terreno destravada: carimbar funciona como hoje', () => {
    abrir()
    expect(useMapStore.getState().carimbar([carimbo])).toBe('carimbou')
    expect(useMapStore.getState().map.carimbos).toHaveLength(1)
    expect(avisos()).toEqual([])
  })
})
