import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import type { Region, RegionPoint } from '../types/map'

/** O risco do Penhasco no store: um Ctrl+Z por risco, nenhum para risco que não muda nada. */
describe('mapStore.riscarPenhasco', () => {
  const terra: Region = {
    id: 'terra',
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
  }
  /** Ao longo da costa de baixo (y = 500), de onde a parede desce à vista. */
  const naCosta: RegionPoint[] = [
    { x: 300, y: 500 },
    { x: 400, y: 505 },
    { x: 500, y: 500 },
  ]

  beforeEach(() => {
    useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('m', 'M', 20, 12, 50), continente: true, regions: [terra] })
    useMapStore.getState().setPenhascoModo('riscar')
    useMapStore.getState().setPenhascoLargura('media')
    useMapStore.getState().setPenhascoAltura('medio')
  })

  it('começa riscando, pincel médio', () => {
    expect(useMapStore.getState().penhascoModo).toBe('riscar')
    expect(useMapStore.getState().penhascoLargura).toBe('media')
  })

  it('um risco na costa vira penhasco e UMA entrada de desfazer; o desfazer tira o campo', () => {
    const resultado = useMapStore.getState().riscarPenhasco({ modo: 'riscar', raio: 30, pontos: naCosta })
    expect(resultado).toBe('riscou')
    const penhascos = useMapStore.getState().map.penhascos ?? []
    expect(penhascos).toHaveLength(1)
    expect(penhascos[0].id).not.toBe('')
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.penhascos).toBeUndefined()
  })

  it('risco longe da costa não gasta desfazer e diz por quê', () => {
    const resultado = useMapStore.getState().riscarPenhasco({ modo: 'riscar', raio: 30, pontos: [{ x: 500, y: 300 }] })
    expect(resultado).toBe('longe-da-costa')
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('a camada Salas escondida esconde a terra: o risco não acha costa (o relevo também não a desenha)', () => {
    useMapStore.getState().loadMap({ ...useMapStore.getState().map, hiddenLayers: ['salas'] })
    expect(useMapStore.getState().riscarPenhasco({ modo: 'riscar', raio: 30, pontos: naCosta })).toBe('longe-da-costa')
  })

  it('a altura começa Média e é preferência da ferramenta (fora do desfazer)', () => {
    expect(useMapStore.getState().penhascoAltura).toBe('medio')
    useMapStore.getState().setPenhascoAltura('alto')
    expect(useMapStore.getState().penhascoAltura).toBe('alto')
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('o risco guarda a altura dele; o Médio não escreve o campo; desfazer tira o risco Alto', () => {
    useMapStore.getState().riscarPenhasco({ modo: 'riscar', raio: 30, pontos: naCosta, altura: 'medio' })
    useMapStore.getState().riscarPenhasco({ modo: 'riscar', raio: 30, pontos: naCosta, altura: 'alto' })
    const [medio, alto] = useMapStore.getState().map.penhascos ?? []
    expect('altura' in medio).toBe(false)
    expect(alto.altura).toBe('alto')
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.penhascos?.map((t) => t.altura)).toEqual([undefined])
    useMapStore.getState().redo()
    expect(useMapStore.getState().map.penhascos?.map((t) => t.altura)).toEqual([undefined, 'alto'])
  })

  it('a borracha tira o penhasco que cobre inteiro, e "Apagar todos" limpa com desfazer', () => {
    useMapStore.getState().riscarPenhasco({ modo: 'riscar', raio: 30, pontos: naCosta })
    useMapStore.getState().riscarPenhasco({ modo: 'riscar', raio: 30, pontos: [{ x: 700, y: 500 }] })
    expect(useMapStore.getState().map.penhascos).toHaveLength(2)
    expect(useMapStore.getState().riscarPenhasco({ modo: 'apagar', raio: 100, pontos: [{ x: 700, y: 500 }] })).toBe('apagou')
    expect(useMapStore.getState().map.penhascos).toHaveLength(1)
    useMapStore.getState().apagarTodosOsPenhascos()
    expect(useMapStore.getState().map.penhascos).toBeUndefined()
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.penhascos).toHaveLength(1)
  })
})
