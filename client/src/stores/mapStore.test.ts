import { describe, expect, it, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import type { Prop, Region, Token, Wall } from '../types/map'

const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1 }
const blockingWall: Wall = { id: 'w1', x1: 5, y1: -10, x2: 5, y2: 10, blocksLight: true, blocksMove: true, door: null }
const prop: Prop = { id: 'p1', src: '/a.png', x: 0, y: 0, width: 64, height: 64, linkedMapPath: null }

describe('mapStore moveToken', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, tokens: [], walls: [], lights: [], regions: [] },
      selection: null,
    })
  })

  it('move o token para a posição alvo quando nada bloqueia', () => {
    useMapStore.getState().addToken(token)

    useMapStore.getState().moveToken('t1', 10, 10)

    const moved = useMapStore.getState().map.tokens.find((t) => t.id === 't1')
    expect(moved).toEqual({ ...token, x: 10, y: 10 })
  })

  it('mantém a posição original quando o movimento cruza parede bloqueante', () => {
    useMapStore.getState().addToken(token)
    useMapStore.getState().addWall(blockingWall)

    useMapStore.getState().moveToken('t1', 10, 0)

    const notMoved = useMapStore.getState().map.tokens.find((t) => t.id === 't1')
    expect(notMoved).toEqual(token)
  })

  it('não faz nada (early return) quando o id não existe', () => {
    useMapStore.getState().addToken(token)
    const before = useMapStore.getState().map

    useMapStore.getState().moveToken('inexistente', 10, 10)

    expect(useMapStore.getState().map).toBe(before)
  })
})

describe('mapStore addDrawing/removeSelected(drawing)/configuração de desenho', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      selection: null,
      drawColor: '#ffffff',
      drawWidth: 4,
      drawFilled: false,
    })
  })

  it('addDrawing adiciona ao mapa', () => {
    useMapStore.getState().addDrawing({ id: 'd1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 4 })
    expect(useMapStore.getState().map.drawings).toHaveLength(1)
  })

  it('removeSelected apaga o desenho selecionado', () => {
    useMapStore.getState().addDrawing({ id: 'd1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 4 })
    useMapStore.getState().setSelection({ kind: 'drawing', id: 'd1' })

    useMapStore.getState().removeSelected()

    expect(useMapStore.getState().map.drawings).toEqual([])
    expect(useMapStore.getState().selection).toBeNull()
  })

  it('setDrawColor/setDrawWidth/setDrawFilled atualizam a configuração', () => {
    useMapStore.getState().setDrawColor('#ff0000')
    useMapStore.getState().setDrawWidth(10)
    useMapStore.getState().setDrawFilled(true)

    const state = useMapStore.getState()
    expect(state.drawColor).toBe('#ff0000')
    expect(state.drawWidth).toBe(10)
    expect(state.drawFilled).toBe(true)
  })
})

describe('mapStore setWallDoor/setScenarioLink', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], scenarioLink: null },
      selection: null,
    })
  })

  it('setWallDoor reflete no map', () => {
    useMapStore.getState().addWall(blockingWall)

    useMapStore.getState().setWallDoor('w1', { open: false, locked: false })

    const wall = useMapStore.getState().map.walls.find((w) => w.id === 'w1')
    expect(wall?.door).toEqual({ open: false, locked: false })
  })

  it('setScenarioLink reflete no map', () => {
    useMapStore.getState().setScenarioLink('https://exemplo.com/cenario')

    expect(useMapStore.getState().map.scenarioLink).toBe('https://exemplo.com/cenario')
  })
})

describe('mapStore setPropLinkedPath', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, props: [] },
      selection: null,
    })
  })

  it('reflete no map, sem tocar outros props', () => {
    useMapStore.getState().addProp(prop)
    useMapStore.getState().addProp({ ...prop, id: 'p2' })

    useMapStore.getState().setPropLinkedPath('p1', 'C:/mapas/map_2/map.json')

    const p1 = useMapStore.getState().map.props.find((p) => p.id === 'p1')
    const p2 = useMapStore.getState().map.props.find((p) => p.id === 'p2')
    expect(p1?.linkedMapPath).toBe('C:/mapas/map_2/map.json')
    expect(p2?.linkedMapPath).toBeNull()
  })

  it('aceita null pra desvincular', () => {
    useMapStore.getState().addProp({ ...prop, linkedMapPath: 'C:/mapas/map_2/map.json' })

    useMapStore.getState().setPropLinkedPath('p1', null)

    expect(useMapStore.getState().map.props.find((p) => p.id === 'p1')?.linkedMapPath).toBeNull()
  })
})

describe('mapStore updateTextLabel', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      selection: null,
    })
  })

  it('atualiza só o campo passado no patch, só no drawing certo', () => {
    useMapStore.getState().addDrawing({ id: 'd1', kind: 'text', x: 0, y: 0, text: 'Rótulo', color: '#fff', fontSize: 16 })
    useMapStore.getState().addDrawing({ id: 'd2', kind: 'text', x: 5, y: 5, text: 'Outro', color: '#000', fontSize: 20 })

    useMapStore.getState().updateTextLabel('d1', { text: 'Sala Secreta' })

    const drawings = useMapStore.getState().map.drawings
    const d1 = drawings.find((d) => d.id === 'd1')
    const d2 = drawings.find((d) => d.id === 'd2')
    expect(d1?.kind).toBe('text')
    if (d1?.kind === 'text') {
      expect(d1.text).toBe('Sala Secreta')
      expect(d1.color).toBe('#fff')
      expect(d1.fontSize).toBe(16)
    }
    expect(d2?.kind).toBe('text')
    if (d2?.kind === 'text') {
      expect(d2.text).toBe('Outro')
    }
  })
})

describe('mapStore setDrawFontSize', () => {
  it('atualiza drawFontSize', () => {
    useMapStore.getState().setDrawFontSize(32)
    expect(useMapStore.getState().drawFontSize).toBe(32)
  })
})

describe('mapStore regionFillColor', () => {
  const region: Region = { id: 'r1', points: [], tag: '', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} }

  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, regions: [] },
      regionFillColor: '#3a7ad0',
    })
  })

  it('setRegionFillColor atualiza a cor usada ao desenhar a próxima região', () => {
    useMapStore.getState().setRegionFillColor('#00ff00')
    expect(useMapStore.getState().regionFillColor).toBe('#00ff00')
  })

  it('setRegionColor muda a cor só da região alvo, sem tocar outras', () => {
    useMapStore.getState().addRegion(region)
    useMapStore.getState().addRegion({ ...region, id: 'r2' })

    useMapStore.getState().setRegionColor('r1', '#00ff00')

    const r1 = useMapStore.getState().map.regions.find((r) => r.id === 'r1')
    const r2 = useMapStore.getState().map.regions.find((r) => r.id === 'r2')
    expect(r1?.fillColor).toBe('#00ff00')
    expect(r2?.fillColor).toBe('#3a7ad0')
  })
})

describe('mapStore regionFillPattern', () => {
  const region: Region = { id: 'r1', points: [], tag: '', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} }

  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, regions: [] },
      regionFillPattern: 'solid',
    })
  })

  it('setRegionFillPattern atualiza o padrão usado ao desenhar a próxima região', () => {
    useMapStore.getState().setRegionFillPattern('hatch')
    expect(useMapStore.getState().regionFillPattern).toBe('hatch')
  })

  it('setRegionPattern muda o padrão só da região alvo, sem tocar outras', () => {
    useMapStore.getState().addRegion(region)
    useMapStore.getState().addRegion({ ...region, id: 'r2' })

    useMapStore.getState().setRegionPattern('r1', 'hatch')

    const r1 = useMapStore.getState().map.regions.find((r) => r.id === 'r1')
    const r2 = useMapStore.getState().map.regions.find((r) => r.id === 'r2')
    expect(r1?.fillPattern).toBe('hatch')
    expect(r2?.fillPattern).toBe('solid')
  })
})

describe('mapStore updateCurvePoint', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      selection: null,
    })
  })

  it('atualiza só o ponto do índice certo, no drawing certo, sem tocar outros', () => {
    useMapStore.getState().addDrawing({ id: 'd1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }], color: '#fff', width: 4 })
    useMapStore.getState().addDrawing({ id: 'd2', kind: 'curve', points: [{ x: 5, y: 5 }, { x: 15, y: 15 }], color: '#fff', width: 4 })

    useMapStore.getState().updateCurvePoint('d1', 1, 99, 88)

    const drawings = useMapStore.getState().map.drawings
    const d1 = drawings.find((d) => d.id === 'd1')
    const d2 = drawings.find((d) => d.id === 'd2')
    expect(d1?.kind).toBe('curve')
    if (d1?.kind === 'curve') {
      expect(d1.points).toEqual([{ x: 0, y: 0 }, { x: 99, y: 88 }, { x: 20, y: 0 }])
    }
    expect(d2?.kind).toBe('curve')
    if (d2?.kind === 'curve') {
      expect(d2.points).toEqual([{ x: 5, y: 5 }, { x: 15, y: 15 }])
    }
  })
})
