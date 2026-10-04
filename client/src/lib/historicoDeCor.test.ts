import { beforeEach, describe, expect, it } from 'vitest'
import { chaveDeArrastoDeCor } from './historicoDeCor'
import { createEmptyMap } from './mapFactory'
import { mesmaGeometriaDaPeca, mesmaGeometriaDoChao } from './floorGeometry'
import { EMPTY_SELECTION } from './selectionModel'
import { useMapStore } from '../stores/mapStore'
import type { FloorPiece } from '../types/map'

describe('chaveDeArrastoDeCor', () => {
  it('um campo de cor com texto emenda; vários campos, undefined ou null não', () => {
    expect(chaveDeArrastoDeCor('p', { fillColor: '#ff0000' }, ['fillColor'])).toBe('p:fillColor')
    expect(chaveDeArrastoDeCor('p', { fillColor: undefined }, ['fillColor'])).toBeUndefined()
    expect(chaveDeArrastoDeCor('p', { strokeColor: null }, ['strokeColor'])).toBeUndefined()
    expect(chaveDeArrastoDeCor('p', { fillColor: '#ff0000', locked: true }, ['fillColor'])).toBeUndefined()
    expect(chaveDeArrastoDeCor('p', { locked: true }, ['fillColor'])).toBeUndefined()
  })
})

const PECA: FloorPiece = { id: 'p1', shape: { kind: 'rect', cx: 100, cy: 100, w: 128, h: 128 }, op: 'add', modifiers: {} }

describe('cor do chão no histórico: o arrasto do seletor é UM passo de Ctrl+Z', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...createEmptyMap('m', 'M', 30, 20, 64), floor: [PECA] },
      selection: EMPTY_SELECTION,
      past: [],
      future: [],
    })
  })

  it('30 quadros de cor da peça viram 1 entrada; Ctrl+Z volta à cor de antes do arrasto', () => {
    const { updateFloorPiece } = useMapStore.getState()
    for (let i = 0; i < 30; i++) updateFloorPiece('p1', { fillColor: `#0000${(i + 16).toString(16)}` })
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(useMapStore.getState().map.floor[0].fillColor).toBe('#00002d')
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.floor[0].fillColor).toBeUndefined()
  })

  it('outra mudança no meio fecha o passo; "Voltar à cor do chão" é um passo próprio', () => {
    const { updateFloorPiece } = useMapStore.getState()
    updateFloorPiece('p1', { fillColor: '#ff0000' })
    updateFloorPiece('p1', { fillColor: '#ee0000' })
    updateFloorPiece('p1', { locked: true })
    updateFloorPiece('p1', { fillColor: '#00ff00' })
    updateFloorPiece('p1', { fillColor: undefined })
    expect(useMapStore.getState().past).toHaveLength(4)
  })

  it('cor e contorno do chão do mapa também emendam, cada campo no seu passo', () => {
    const { setFloorStyle } = useMapStore.getState()
    for (let i = 0; i < 10; i++) setFloorStyle({ fillColor: `#1010${(i + 16).toString(16)}` })
    for (let i = 0; i < 10; i++) setFloorStyle({ strokeColor: `#2020${(i + 16).toString(16)}` })
    expect(useMapStore.getState().past).toHaveLength(2)
  })
})

describe('mesmaGeometria — o que conta como desenho do chão', () => {
  it('só a cor, a trava ou o nome mudaram: mesma geometria', () => {
    expect(mesmaGeometriaDaPeca(PECA, { ...PECA, fillColor: '#ff0000', locked: true })).toBe(true)
    expect(mesmaGeometriaDoChao([PECA], [{ ...PECA, fillColor: '#ff0000' }])).toBe(true)
    expect(mesmaGeometriaDaPeca(PECA, { ...PECA, modifiers: {} })).toBe(true)
  })

  it('forma, operação, giro, modificador, visibilidade ou ordem diferentes: geometria nova', () => {
    expect(mesmaGeometriaDaPeca(PECA, { ...PECA, shape: { ...PECA.shape } as FloorPiece['shape'] })).toBe(false)
    expect(mesmaGeometriaDaPeca(PECA, { ...PECA, op: 'subtract' })).toBe(false)
    expect(mesmaGeometriaDaPeca(PECA, { ...PECA, rotation: 10 })).toBe(false)
    expect(mesmaGeometriaDaPeca(PECA, { ...PECA, modifiers: { rounding: 4 } })).toBe(false)
    expect(mesmaGeometriaDaPeca(PECA, { ...PECA, hidden: true })).toBe(false)
    const outra = { ...PECA, id: 'p2', shape: { ...PECA.shape } as FloorPiece['shape'] }
    expect(mesmaGeometriaDoChao([PECA, outra], [outra, PECA])).toBe(false)
    expect(mesmaGeometriaDoChao([PECA], [])).toBe(false)
  })
})
