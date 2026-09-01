import { describe, expect, it, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import type { Drawing, Light, Prop, Region, RegionPoint, Stair, Token, Wall } from '../types/map'
import { buildRoomFromDraft } from '../lib/drawingFactory'

const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1, image: null }
const blockingWall: Wall = { id: 'w1', x1: 5, y1: -10, x2: 5, y2: 10, blocksLight: true, blocksMove: true, door: null }
const prop: Prop = { id: 'p1', src: '/a.png', x: 0, y: 0, width: 64, height: 64, linkedMapPath: null }

function buildRoomFixture() {
  return buildRoomFromDraft('r1', ['w0', 'w1', 'w2', 'w3'], { x: 0, y: 0 }, { x: 100, y: 100 })
}

/**
 * Confirma a invariante do vínculo Sala↔Paredes para `regionId`: cada parede
 * vinculada tem `regionEdgeIndex` único em `0..n-1` (n = pontos ATUAIS da
 * região), e suas coordenadas batem com o segmento `points[i] -> points[(i+1)%n]`.
 */
function assertRoomLinkInvariant(regionId: string) {
  const map = useMapStore.getState().map
  const region = map.regions.find((r) => r.id === regionId)
  expect(region).toBeDefined()
  if (!region) return
  const n = region.points.length

  const linkedWalls = map.walls.filter((w) => w.regionId === regionId)
  const seenIndexes = new Set<number>()

  for (const wall of linkedWalls) {
    const edgeIndex = wall.regionEdgeIndex
    expect(edgeIndex).toBeDefined()
    if (edgeIndex === undefined) continue
    expect(edgeIndex).toBeGreaterThanOrEqual(0)
    expect(edgeIndex).toBeLessThan(n)
    expect(seenIndexes.has(edgeIndex)).toBe(false)
    seenIndexes.add(edgeIndex)

    const from: RegionPoint = region.points[edgeIndex]
    const to: RegionPoint = region.points[(edgeIndex + 1) % n]
    expect(wall.x1).toBe(from.x)
    expect(wall.y1).toBe(from.y)
    expect(wall.x2).toBe(to.x)
    expect(wall.y2).toBe(to.y)
  }
}

describe('mapStore moveToken', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, tokens: [], walls: [], lights: [], regions: [] },
      selection: [],
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
      selection: [],
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
    useMapStore.getState().setSelection([{ kind: 'drawing', id: 'd1' }])

    useMapStore.getState().removeSelected()

    expect(useMapStore.getState().map.drawings).toEqual([])
    expect(useMapStore.getState().selection).toEqual([])
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
      selection: [],
    })
  })

  it('setWallDoor reflete no map', () => {
    useMapStore.getState().addWall(blockingWall)

    useMapStore.getState().setWallDoor('w1', { open: false, locked: false, kind: 'normal' })

    const wall = useMapStore.getState().map.walls.find((w) => w.id === 'w1')
    expect(wall?.door).toEqual({ open: false, locked: false, kind: 'normal' })
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
      selection: [],
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
      selection: [],
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

describe('mapStore setDrawFontFamily', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      past: [],
      future: [],
      drawFontFamily: 'Arial',
    })
  })

  it('atualiza só o estado de UI drawFontFamily, sem entrada de undo', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setDrawFontFamily('Georgia')

    expect(useMapStore.getState().drawFontFamily).toBe('Georgia')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })
})

describe('mapStore setTextFontFamily', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('muda a fontFamily só do texto alvo, sem tocar outro, e conta como entrada de undo', () => {
    useMapStore.getState().addDrawing({ id: 'd1', kind: 'text', x: 0, y: 0, text: 'Rótulo', color: '#fff', fontSize: 16, fontFamily: 'Arial' })
    useMapStore.getState().addDrawing({ id: 'd2', kind: 'text', x: 5, y: 5, text: 'Outro', color: '#000', fontSize: 20, fontFamily: 'Arial' })
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setTextFontFamily('d1', 'Georgia')

    const drawings = useMapStore.getState().map.drawings
    const d1 = drawings.find((d) => d.id === 'd1')
    const d2 = drawings.find((d) => d.id === 'd2')
    expect(d1?.kind).toBe('text')
    if (d1?.kind === 'text') expect(d1.fontFamily).toBe('Georgia')
    expect(d2?.kind).toBe('text')
    if (d2?.kind === 'text') expect(d2.fontFamily).toBe('Arial')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('undo desfaz a troca de fontFamily', () => {
    useMapStore.getState().addDrawing({ id: 'd1', kind: 'text', x: 0, y: 0, text: 'Rótulo', color: '#fff', fontSize: 16, fontFamily: 'Arial' })

    useMapStore.getState().setTextFontFamily('d1', 'Georgia')
    useMapStore.getState().undo()

    const d1 = useMapStore.getState().map.drawings.find((d) => d.id === 'd1')
    expect(d1?.kind).toBe('text')
    if (d1?.kind === 'text') expect(d1.fontFamily).toBe('Arial')
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

// Fase 6 — pedido do usuário ("poligono fino/medio/grosso, arredondado ou
// reto"). Mesmo padrão do describe acima (regionFillPattern), dois eixos novos.
describe('mapStore regionStrokeWidth/regionStrokeJoin', () => {
  const region: Region = { id: 'r1', points: [], tag: '', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} }

  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, regions: [] },
      regionStrokeWidth: 2,
      regionStrokeJoin: 'miter',
    })
  })

  it('setRegionStrokeWidth atualiza a espessura usada ao desenhar a próxima região', () => {
    useMapStore.getState().setRegionStrokeWidth(12)
    expect(useMapStore.getState().regionStrokeWidth).toBe(12)
  })

  it('setRegionStrokeWidthForRegion muda a espessura só da região alvo, sem tocar outras', () => {
    useMapStore.getState().addRegion(region)
    useMapStore.getState().addRegion({ ...region, id: 'r2' })

    useMapStore.getState().setRegionStrokeWidthForRegion('r1', 12)

    const r1 = useMapStore.getState().map.regions.find((r) => r.id === 'r1')
    const r2 = useMapStore.getState().map.regions.find((r) => r.id === 'r2')
    expect(r1?.strokeWidth).toBe(12)
    expect(r2?.strokeWidth).toBeUndefined()
  })

  it('setRegionStrokeJoin atualiza a junção usada ao desenhar a próxima região', () => {
    useMapStore.getState().setRegionStrokeJoin('round')
    expect(useMapStore.getState().regionStrokeJoin).toBe('round')
  })

  it('setRegionStrokeJoinForRegion muda a junção só da região alvo, sem tocar outras', () => {
    useMapStore.getState().addRegion(region)
    useMapStore.getState().addRegion({ ...region, id: 'r2' })

    useMapStore.getState().setRegionStrokeJoinForRegion('r1', 'round')

    const r1 = useMapStore.getState().map.regions.find((r) => r.id === 'r1')
    const r2 = useMapStore.getState().map.regions.find((r) => r.id === 'r2')
    expect(r1?.strokeJoin).toBe('round')
    expect(r2?.strokeJoin).toBeUndefined()
  })
})

describe('mapStore undo/redo', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], drawings: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('addWall seguido de undo remove a wall e restaura o estado anterior', () => {
    useMapStore.getState().addWall(blockingWall)
    expect(useMapStore.getState().map.walls).toHaveLength(1)

    useMapStore.getState().undo()

    expect(useMapStore.getState().map.walls).toEqual([])
  })

  it('undo seguido de redo reaplica a mutação', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.walls).toEqual([])

    useMapStore.getState().redo()

    expect(useMapStore.getState().map.walls).toEqual([blockingWall])
  })

  it('múltiplos undos em sequência voltam vários passos', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().addWall({ ...blockingWall, id: 'w2' })
    useMapStore.getState().addWall({ ...blockingWall, id: 'w3' })
    expect(useMapStore.getState().map.walls).toHaveLength(3)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.walls).toHaveLength(2)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.walls).toHaveLength(1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.walls).toHaveLength(0)
  })

  it('undo com past vazio não quebra (map inalterado)', () => {
    const before = useMapStore.getState().map

    useMapStore.getState().undo()

    expect(useMapStore.getState().map).toBe(before)
    expect(useMapStore.getState().map.walls).toEqual([])
  })

  it('redo com future vazio não quebra (map inalterado)', () => {
    useMapStore.getState().addWall(blockingWall)
    const before = useMapStore.getState().map

    useMapStore.getState().redo()

    expect(useMapStore.getState().map).toBe(before)
  })

  it('nova ação após um undo zera future (redo deixa de estar disponível)', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().undo()
    expect(useMapStore.getState().future).toHaveLength(1)

    useMapStore.getState().addWall({ ...blockingWall, id: 'w2' })
    expect(useMapStore.getState().future).toEqual([])

    useMapStore.getState().redo()
    expect(useMapStore.getState().map.walls.map((w) => w.id)).toEqual(['w2'])
  })

  it('loadMap limpa past e future', () => {
    useMapStore.getState().addWall(blockingWall)
    expect(useMapStore.getState().past).toHaveLength(1)

    useMapStore.getState().loadMap({ ...useMapStore.getState().map, walls: [] })

    expect(useMapStore.getState().past).toEqual([])
    expect(useMapStore.getState().future).toEqual([])
  })
})

describe('mapStore updateCurvePoint', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      selection: [],
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

describe('mapStore insertCurvePoint/removeCurvePoint/moveCurve', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('insertCurvePoint insere um ponto novo no índice certo, sem tocar outra curva', () => {
    useMapStore.getState().addDrawing({ id: 'c1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }], color: '#fff', width: 4 })
    useMapStore.getState().addDrawing({ id: 'c2', kind: 'curve', points: [{ x: 5, y: 5 }], color: '#fff', width: 4 })

    useMapStore.getState().insertCurvePoint('c1', 0, 25, 25)

    const c1 = useMapStore.getState().map.drawings.find((d) => d.id === 'c1')
    const c2 = useMapStore.getState().map.drawings.find((d) => d.id === 'c2')
    expect(c1?.kind).toBe('curve')
    if (c1?.kind === 'curve') expect(c1.points).toEqual([{ x: 0, y: 0 }, { x: 25, y: 25 }, { x: 50, y: 50 }, { x: 100, y: 0 }])
    expect(c2?.kind).toBe('curve')
    if (c2?.kind === 'curve') expect(c2.points).toEqual([{ x: 5, y: 5 }])
  })

  it('removeCurvePoint remove o ponto certo, sem tocar outra curva', () => {
    useMapStore.getState().addDrawing({ id: 'c1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 25, y: 25 }, { x: 50, y: 50 }, { x: 100, y: 0 }], color: '#fff', width: 4 })
    useMapStore.getState().addDrawing({ id: 'c2', kind: 'curve', points: [{ x: 5, y: 5 }, { x: 15, y: 15 }], color: '#fff', width: 4 })

    useMapStore.getState().removeCurvePoint('c1', 1)

    const c1 = useMapStore.getState().map.drawings.find((d) => d.id === 'c1')
    const c2 = useMapStore.getState().map.drawings.find((d) => d.id === 'c2')
    expect(c1?.kind).toBe('curve')
    if (c1?.kind === 'curve') expect(c1.points).toEqual([{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }])
    expect(c2?.kind).toBe('curve')
    if (c2?.kind === 'curve') expect(c2.points).toEqual([{ x: 5, y: 5 }, { x: 15, y: 15 }])
  })

  it('removeCurvePoint recusa (map idêntico, sem entrada de undo) quando a curva só tem 2 pontos', () => {
    useMapStore.getState().addDrawing({ id: 'c1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: '#fff', width: 4 })
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().removeCurvePoint('c1', 0)

    expect(useMapStore.getState().map).toBe(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })

  it('moveCurve desloca todos os pontos da curva, sem tocar outra curva', () => {
    useMapStore.getState().addDrawing({ id: 'c1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 50, y: 50 }], color: '#fff', width: 4 })
    useMapStore.getState().addDrawing({ id: 'c2', kind: 'curve', points: [{ x: 5, y: 5 }], color: '#fff', width: 4 })

    useMapStore.getState().moveCurve('c1', 10, 20)

    const c1 = useMapStore.getState().map.drawings.find((d) => d.id === 'c1')
    const c2 = useMapStore.getState().map.drawings.find((d) => d.id === 'c2')
    expect(c1?.kind).toBe('curve')
    if (c1?.kind === 'curve') expect(c1.points).toEqual([{ x: 10, y: 20 }, { x: 60, y: 70 }])
    expect(c2?.kind).toBe('curve')
    if (c2?.kind === 'curve') expect(c2.points).toEqual([{ x: 5, y: 5 }])
  })

  it('inserir e depois remover o mesmo ponto volta a curva ao formato original, e mover preserva esse formato', () => {
    useMapStore.getState().addDrawing({ id: 'c1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }], color: '#fff', width: 4 })
    const original = useMapStore.getState().map.drawings.find((d) => d.id === 'c1')

    useMapStore.getState().insertCurvePoint('c1', 0, 25, 25)
    useMapStore.getState().removeCurvePoint('c1', 1)

    const backToOriginal = useMapStore.getState().map.drawings.find((d) => d.id === 'c1')
    expect(backToOriginal).toEqual(original)

    useMapStore.getState().moveCurve('c1', 5, 5)
    const moved = useMapStore.getState().map.drawings.find((d) => d.id === 'c1')
    expect(moved?.kind).toBe('curve')
    if (moved?.kind === 'curve' && original?.kind === 'curve') {
      expect(moved.points).toEqual(original.points.map((p) => ({ x: p.x + 5, y: p.y + 5 })))
    }
  })
})

describe('mapStore addRoom', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], regions: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('adiciona 1 região + N paredes de uma vez, atomicamente (1 entrada de undo)', () => {
    // parede solta não relacionada, pra provar isolamento
    const looseWall = { ...blockingWall, id: 'wLoose' }
    useMapStore.getState().addWall(looseWall)
    const pastLengthBefore = useMapStore.getState().past.length

    const { region, walls } = buildRoomFixture()
    useMapStore.getState().addRoom(region, walls)

    expect(useMapStore.getState().map.regions).toEqual([region])
    expect(useMapStore.getState().map.walls).toEqual([looseWall, ...walls])
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()

    expect(useMapStore.getState().map.regions).toEqual([])
    expect(useMapStore.getState().map.walls).toEqual([looseWall])
  })
})

describe('mapStore linkRegionWalls', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], regions: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('preenche as arestas sem parede da região, cria 1 entrada de undo, e undo desfaz', () => {
    const region: Region = {
      id: 'r1',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      tag: 'room',
      fillColor: '#3a7ad0',
      fillPattern: 'solid',
      data: {},
    }
    useMapStore.getState().addRegion(region)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().linkRegionWalls('r1')

    expect(useMapStore.getState().map.walls.filter((w) => w.regionId === 'r1')).toHaveLength(4)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()

    expect(useMapStore.getState().map.walls.filter((w) => w.regionId === 'r1')).toHaveLength(0)
  })

  it('região com todas as arestas já completas não gera entrada de undo', () => {
    const { region, walls } = buildRoomFixture()
    useMapStore.getState().addRoom(region, walls)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().linkRegionWalls('r1')

    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })
})

describe('mapStore smoothRegion', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], regions: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('região com parede vinculada: suaviza o contorno, retraça as paredes, cria 1 entrada de undo, e undo desfaz tudo', () => {
    const { region, walls } = buildRoomFixture()
    useMapStore.getState().addRoom(region, walls)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().smoothRegion('r1')

    const smoothed = useMapStore.getState().map.regions.find((r) => r.id === 'r1')
    expect(smoothed?.points).toHaveLength(8)
    expect(useMapStore.getState().map.walls.filter((w) => w.regionId === 'r1')).toHaveLength(8)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().undo()

    const undone = useMapStore.getState().map.regions.find((r) => r.id === 'r1')
    expect(undone?.points).toEqual(region.points)
    expect(useMapStore.getState().map.walls.filter((w) => w.regionId === 'r1')).toEqual(walls)
  })

  it('região inexistente não gera entrada de undo', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().smoothRegion('inexistente')

    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })
})

describe('mapStore updateWallPoint', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], regions: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('atualiza o endpoint de uma parede solta, sem tocar outra', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().addWall({ ...blockingWall, id: 'w2' })

    useMapStore.getState().updateWallPoint('w1', 0, 50, 50)

    const w1 = useMapStore.getState().map.walls.find((w) => w.id === 'w1')
    const w2 = useMapStore.getState().map.walls.find((w) => w.id === 'w2')
    expect(w1).toMatchObject({ x1: 50, y1: 50 })
    expect(w2).toEqual({ ...blockingWall, id: 'w2' })
  })

  it('recusa (map idêntico, sem entrada de undo) numa parede vinculada a região', () => {
    const { region, walls } = buildRoomFixture()
    useMapStore.getState().addRoom(region, walls)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().updateWallPoint('w0', 0, 999, 999)

    expect(useMapStore.getState().map).toBe(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })
})

describe('mapStore moveWall', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], regions: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('desloca uma parede solta, sem tocar outra', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().addWall({ ...blockingWall, id: 'w2' })

    useMapStore.getState().moveWall('w1', 10, 20)

    const w1 = useMapStore.getState().map.walls.find((w) => w.id === 'w1')
    const w2 = useMapStore.getState().map.walls.find((w) => w.id === 'w2')
    expect(w1).toEqual({ ...blockingWall, x1: 15, y1: 10, x2: 15, y2: 30 })
    expect(w2).toEqual({ ...blockingWall, id: 'w2' })
  })

  it('numa parede vinculada, desloca a região inteira junto com as paredes vinculadas', () => {
    const { region, walls } = buildRoomFixture()
    useMapStore.getState().addRoom(region, walls)

    useMapStore.getState().moveWall('w0', 10, 20)

    const movedRegion = useMapStore.getState().map.regions.find((r) => r.id === 'r1')
    expect(movedRegion?.points).toEqual(region.points.map((p) => ({ x: p.x + 10, y: p.y + 20 })))
    assertRoomLinkInvariant('r1')
  })
})

describe('mapStore updateRegionPoint/insertRegionPoint/removeRegionPoint/moveRegion', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], regions: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('updateRegionPoint atualiza o ponto e resincroniza as paredes vinculadas', () => {
    const looseWall = { ...blockingWall, id: 'wLoose' }
    useMapStore.getState().addWall(looseWall)
    const { region, walls } = buildRoomFixture()
    useMapStore.getState().addRoom(region, walls)

    useMapStore.getState().updateRegionPoint('r1', 0, 5, 5)

    const movedRegion = useMapStore.getState().map.regions.find((r) => r.id === 'r1')
    expect(movedRegion?.points[0]).toEqual({ x: 5, y: 5 })
    assertRoomLinkInvariant('r1')
    expect(useMapStore.getState().map.walls.find((w) => w.id === 'wLoose')).toEqual(looseWall)
  })

  it('insertRegionPoint insere um vértice novo mantendo a invariante', () => {
    const looseWall = { ...blockingWall, id: 'wLoose' }
    useMapStore.getState().addWall(looseWall)
    const { region, walls } = buildRoomFixture()
    useMapStore.getState().addRoom(region, walls)

    useMapStore.getState().insertRegionPoint('r1', 0, 50, 0, 'wNovo')

    const movedRegion = useMapStore.getState().map.regions.find((r) => r.id === 'r1')
    expect(movedRegion?.points).toHaveLength(5)
    assertRoomLinkInvariant('r1')
    expect(useMapStore.getState().map.walls.find((w) => w.id === 'wLoose')).toEqual(looseWall)
  })

  it('removeRegionPoint remove o vértice mantendo a invariante', () => {
    const { region, walls } = buildRoomFixture()
    useMapStore.getState().addRoom(region, walls)
    useMapStore.getState().insertRegionPoint('r1', 0, 50, 0, 'wNovo')

    useMapStore.getState().removeRegionPoint('r1', 1)

    const finalRegion = useMapStore.getState().map.regions.find((r) => r.id === 'r1')
    expect(finalRegion?.points).toEqual(region.points)
    assertRoomLinkInvariant('r1')
  })

  it('removeRegionPoint recusa (map idêntico, sem entrada de undo) quando a região só tem 3 pontos', () => {
    const triangle: Region = {
      id: 'tri',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }],
      tag: 'trap',
      fillColor: '#3a7ad0',
      fillPattern: 'solid',
      data: {},
    }
    useMapStore.getState().addRegion(triangle)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().removeRegionPoint('tri', 0)

    expect(useMapStore.getState().map).toBe(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })

  it('moveRegion desloca todos os pontos e as paredes vinculadas, sem tocar parede solta', () => {
    const looseWall = { ...blockingWall, id: 'wLoose' }
    useMapStore.getState().addWall(looseWall)
    const { region, walls } = buildRoomFixture()
    useMapStore.getState().addRoom(region, walls)

    useMapStore.getState().moveRegion('r1', 30, 40)

    const movedRegion = useMapStore.getState().map.regions.find((r) => r.id === 'r1')
    expect(movedRegion?.points).toEqual(region.points.map((p) => ({ x: p.x + 30, y: p.y + 40 })))
    assertRoomLinkInvariant('r1')
    expect(useMapStore.getState().map.walls.find((w) => w.id === 'wLoose')).toEqual(looseWall)
  })

  it('a ligação sala↔paredes sobrevive a arrastar vértice, inserir, remover e mover a sala inteira', () => {
    const { region, walls } = buildRoomFixture()
    useMapStore.getState().addRoom(region, walls)
    assertRoomLinkInvariant('r1')

    useMapStore.getState().updateRegionPoint('r1', 0, 5, 5)
    assertRoomLinkInvariant('r1')

    useMapStore.getState().insertRegionPoint('r1', 0, 25, 5, 'wNovo')
    assertRoomLinkInvariant('r1')

    useMapStore.getState().removeRegionPoint('r1', 1)
    assertRoomLinkInvariant('r1')

    useMapStore.getState().moveRegion('r1', 15, -15)
    assertRoomLinkInvariant('r1')
  })
})

describe('mapStore toggleLayerVisibility', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], hiddenLayers: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('esconde e depois mostra de novo a mesma camada (toggle), com 1 entrada de undo cada vez', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().toggleLayerVisibility('paredes')
    expect(useMapStore.getState().map.hiddenLayers).toEqual(['paredes'])
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().toggleLayerVisibility('paredes')
    expect(useMapStore.getState().map.hiddenLayers).toEqual([])
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 2)
  })

  it('limpa a seleção quando o item selecionado fica na camada recém-ocultada', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().setSelection([{ kind: 'wall', id: 'w1' }])

    useMapStore.getState().toggleLayerVisibility('paredes')

    expect(useMapStore.getState().selection).toEqual([])
  })

  it('NÃO limpa a seleção quando a camada ocultada é de outro tipo de entidade', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().setSelection([{ kind: 'wall', id: 'w1' }])

    useMapStore.getState().toggleLayerVisibility('tokens')

    expect(useMapStore.getState().selection).toEqual([{ kind: 'wall', id: 'w1' }])
  })

  it('NÃO limpa a seleção ao MOSTRAR a camada de novo (só limpa ao ocultar)', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().toggleLayerVisibility('paredes')
    useMapStore.getState().setSelection([{ kind: 'wall', id: 'w1' }])

    useMapStore.getState().toggleLayerVisibility('paredes')

    expect(useMapStore.getState().selection).toEqual([{ kind: 'wall', id: 'w1' }])
  })

  it('sem seleção, só troca hiddenLayers, sem lançar', () => {
    useMapStore.getState().toggleLayerVisibility('iluminacao')
    expect(useMapStore.getState().map.hiddenLayers).toEqual(['iluminacao'])
  })
})

describe('mapStore toggleLayerLock (Onda 4, Frente D)', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], hiddenLayers: [], lockedLayers: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('trava e depois destrava a mesma camada (toggle), com 1 entrada de undo cada vez', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().toggleLayerLock('paredes')
    expect(useMapStore.getState().map.lockedLayers).toEqual(['paredes'])
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)

    useMapStore.getState().toggleLayerLock('paredes')
    expect(useMapStore.getState().map.lockedLayers).toEqual([])
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 2)
  })

  it('limpa a seleção quando o item selecionado fica na camada recém-travada', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().setSelection([{ kind: 'wall', id: 'w1' }])

    useMapStore.getState().toggleLayerLock('paredes')

    expect(useMapStore.getState().selection).toEqual([])
  })

  it('NÃO limpa a seleção quando a camada travada é de outro tipo de entidade', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().setSelection([{ kind: 'wall', id: 'w1' }])

    useMapStore.getState().toggleLayerLock('tokens')

    expect(useMapStore.getState().selection).toEqual([{ kind: 'wall', id: 'w1' }])
  })

  it('travar uma camada não mexe em hiddenLayers — os dois eixos são independentes', () => {
    useMapStore.getState().toggleLayerLock('paredes')
    expect(useMapStore.getState().map.hiddenLayers).toEqual([])
  })
})

describe('mapStore setPropLayer', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, props: [] },
      selection: [],
    })
  })

  it('reflete no map, sem tocar outro prop', () => {
    useMapStore.getState().addProp(prop)
    useMapStore.getState().addProp({ ...prop, id: 'p2' })

    useMapStore.getState().setPropLayer('p1', 'decoracao')

    const p1 = useMapStore.getState().map.props.find((p) => p.id === 'p1')
    const p2 = useMapStore.getState().map.props.find((p) => p.id === 'p2')
    expect(p1?.layer).toBe('decoracao')
    expect(p2?.layer).toBeUndefined()
  })

  it('aceita undefined pra voltar ao default — campo opcional ausente', () => {
    useMapStore.getState().addProp({ ...prop, layer: 'decoracao' })

    useMapStore.getState().setPropLayer('p1', undefined)

    expect(useMapStore.getState().map.props.find((p) => p.id === 'p1')?.layer).toBeUndefined()
  })
})

describe('mapStore setTokenImage', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, tokens: [] },
      selection: [],
    })
  })

  it('reflete no map, sem tocar outro token', () => {
    useMapStore.getState().addToken(token)
    useMapStore.getState().addToken({ ...token, id: 't2' })

    useMapStore.getState().setTokenImage('t1', '/tmp/goblin.png')

    const t1 = useMapStore.getState().map.tokens.find((t) => t.id === 't1')
    const t2 = useMapStore.getState().map.tokens.find((t) => t.id === 't2')
    expect(t1?.image).toBe('/tmp/goblin.png')
    expect(t2?.image).toBeNull()
  })

  it('aceita null pra voltar ao círculo genérico — campo opcional ausente', () => {
    useMapStore.getState().addToken({ ...token, image: '/tmp/goblin.png' })

    useMapStore.getState().setTokenImage('t1', null)

    expect(useMapStore.getState().map.tokens.find((t) => t.id === 't1')?.image).toBeNull()
  })
})

describe('mapStore setDrawingFillAlpha/setDrawingFilled', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      selection: [],
    })
  })

  it('muda fillAlpha/filled só do drawing certo, entre dois círculos', () => {
    useMapStore.getState().addDrawing({ id: 'd1', kind: 'circle', cx: 0, cy: 0, radius: 10, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 })
    useMapStore.getState().addDrawing({ id: 'd2', kind: 'circle', cx: 5, cy: 5, radius: 10, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 })

    useMapStore.getState().setDrawingFillAlpha('d1', 0.9)
    useMapStore.getState().setDrawingFilled('d1', false)

    const d1 = useMapStore.getState().map.drawings.find((d) => d.id === 'd1')
    const d2 = useMapStore.getState().map.drawings.find((d) => d.id === 'd2')
    expect(d1?.kind).toBe('circle')
    if (d1?.kind === 'circle') {
      expect(d1.fillAlpha).toBe(0.9)
      expect(d1.filled).toBe(false)
    }
    expect(d2?.kind).toBe('circle')
    if (d2?.kind === 'circle') expect(d2.fillAlpha).toBe(0.5)
  })

  it('não faz nada num kind sem fillAlpha/filled (line) — campo ausente do tipo, sem lançar', () => {
    useMapStore.getState().addDrawing({ id: 'd1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 2 })

    useMapStore.getState().setDrawingFillAlpha('d1', 0.9)
    useMapStore.getState().setDrawingFilled('d1', true)

    const d1 = useMapStore.getState().map.drawings.find((d) => d.id === 'd1')
    expect(d1).toEqual({ id: 'd1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 2 })
  })
})

describe('mapStore updateToken/updateProp (F3, contrato C4: rotação/travar/ocultar)', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, tokens: [], props: [] },
      selection: [],
      past: [],
      future: [],
    })
  })

  it('updateToken aplica o patch, cria 1 entrada de undo, e não toca outro token', () => {
    useMapStore.getState().addToken(token)
    useMapStore.getState().addToken({ ...token, id: 't2' })
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().updateToken('t1', { rotation: 90, locked: true, hidden: true })

    const t1 = useMapStore.getState().map.tokens.find((t) => t.id === 't1')
    const t2 = useMapStore.getState().map.tokens.find((t) => t.id === 't2')
    expect(t1).toEqual({ ...token, rotation: 90, locked: true, hidden: true })
    expect(t2).toEqual({ ...token, id: 't2' })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('updateToken com patch parcial preserva os campos não passados — token recém-criado sem rotation/locked/hidden (campo opcional ausente)', () => {
    useMapStore.getState().addToken(token)
    expect(token.rotation).toBeUndefined()
    expect(token.locked).toBeUndefined()

    useMapStore.getState().updateToken('t1', { locked: true })

    const t1 = useMapStore.getState().map.tokens.find((t) => t.id === 't1')
    expect(t1?.locked).toBe(true)
    expect(t1?.rotation).toBeUndefined()
    expect(t1?.hidden).toBeUndefined()
  })

  it('updateProp aplica o patch, cria 1 entrada de undo, e não toca outro prop', () => {
    useMapStore.getState().addProp(prop)
    useMapStore.getState().addProp({ ...prop, id: 'p2' })
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().updateProp('p1', { rotation: 45, hidden: true })

    const p1 = useMapStore.getState().map.props.find((p) => p.id === 'p1')
    const p2 = useMapStore.getState().map.props.find((p) => p.id === 'p2')
    expect(p1).toEqual({ ...prop, rotation: 45, hidden: true })
    expect(p2).toEqual({ ...prop, id: 'p2' })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })
})

describe('mapStore setWallKindForWall', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [] },
      selection: [],
    })
  })

  it('reflete no map, sem tocar outra parede', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().addWall({ ...blockingWall, id: 'w2' })

    useMapStore.getState().setWallKindForWall('w1', 'interior')

    const w1 = useMapStore.getState().map.walls.find((w) => w.id === 'w1')
    const w2 = useMapStore.getState().map.walls.find((w) => w.id === 'w2')
    expect(w1?.wallKind).toBe('interior')
    expect(w2?.wallKind).toBeUndefined()
  })
})

// Fase 6 — pedido do usuário ("ta muito gordo, quero fino/medio/grosso" +
// "ponta reta ou redonda"). Mesmo padrão do describe acima, dois eixos novos.
describe('mapStore setWallThicknessForWall/setWallLineStyleForWall', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [] },
      selection: [],
      wallThickness: undefined,
      wallLineStyle: undefined,
    })
  })

  it('setWallThickness atualiza a preferência da próxima parede', () => {
    useMapStore.getState().setWallThickness('thick')
    expect(useMapStore.getState().wallThickness).toBe('thick')
  })

  it('setWallThicknessForWall reflete no map, sem tocar outra parede', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().addWall({ ...blockingWall, id: 'w2' })

    useMapStore.getState().setWallThicknessForWall('w1', 'thick')

    const w1 = useMapStore.getState().map.walls.find((w) => w.id === 'w1')
    const w2 = useMapStore.getState().map.walls.find((w) => w.id === 'w2')
    expect(w1?.thickness).toBe('thick')
    expect(w2?.thickness).toBeUndefined()
  })

  it('setWallLineStyle atualiza a preferência da próxima parede', () => {
    useMapStore.getState().setWallLineStyle('straight')
    expect(useMapStore.getState().wallLineStyle).toBe('straight')
  })

  it('setWallLineStyleForWall reflete no map, sem tocar outra parede', () => {
    useMapStore.getState().addWall(blockingWall)
    useMapStore.getState().addWall({ ...blockingWall, id: 'w2' })

    useMapStore.getState().setWallLineStyleForWall('w1', 'straight')

    const w1 = useMapStore.getState().map.walls.find((w) => w.id === 'w1')
    const w2 = useMapStore.getState().map.walls.find((w) => w.id === 'w2')
    expect(w1?.lineStyle).toBe('straight')
    expect(w2?.lineStyle).toBeUndefined()
  })
})

describe('mapStore setGridSettings', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, gridSettings: { color: '#4a4a4a', opacity: 1, lineWidth: 1, lineStyle: 'solid' } },
      past: [],
      future: [],
    })
  })

  it('faz merge parcial e cria 1 entrada de undo', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setGridSettings({ color: '#ff0000' })

    expect(useMapStore.getState().map.gridSettings).toEqual({ color: '#ff0000', opacity: 1, lineWidth: 1, lineStyle: 'solid' })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('undo restaura o gridSettings anterior', () => {
    useMapStore.getState().setGridSettings({ lineStyle: 'dashed' })

    useMapStore.getState().undo()

    expect(useMapStore.getState().map.gridSettings.lineStyle).toBe('solid')
  })
})

describe('mapStore setGridOffset/setGridCellSize (F3, contrato C5: alinhar grade à imagem)', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, gridOffset: undefined, grid: 64 },
      past: [],
      future: [],
    })
  })

  it('setGridOffset substitui o deslocamento e cria 1 entrada de undo — campo opcional ausente por padrão', () => {
    expect(useMapStore.getState().map.gridOffset).toBeUndefined()
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setGridOffset({ x: 10, y: -3 })

    expect(useMapStore.getState().map.gridOffset).toEqual({ x: 10, y: -3 })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('setGridCellSize troca map.grid e cria 1 entrada de undo', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setGridCellSize(48)

    expect(useMapStore.getState().map.grid).toBe(48)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('undo desfaz setGridOffset e setGridCellSize independentemente (2 entradas distintas)', () => {
    useMapStore.getState().setGridOffset({ x: 5, y: 5 })
    useMapStore.getState().setGridCellSize(80)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.grid).toBe(64)
    expect(useMapStore.getState().map.gridOffset).toEqual({ x: 5, y: 5 })

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.gridOffset).toBeUndefined()
  })
})

describe('mapStore updateLight/updateLightRadiusLive', () => {
  const lightFixture: Light = { id: 'l1', x: 0, y: 0, radius: 8, color: '#ffaa33', intensity: 0.8 }

  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, lights: [] },
      past: [],
      future: [],
    })
  })

  it('updateLight aplica o patch e cria 1 entrada de undo', () => {
    useMapStore.getState().addLight(lightFixture)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().updateLight('l1', { color: '#00ff00', intensity: 1 })

    const l1 = useMapStore.getState().map.lights.find((l) => l.id === 'l1')
    expect(l1).toEqual({ ...lightFixture, color: '#00ff00', intensity: 1 })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('updateLightRadiusLive muda o raio SEM criar entrada de undo, e commitDragHistory fecha o gesto depois', () => {
    useMapStore.getState().addLight(lightFixture)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().updateLightRadiusLive('l1', 50)
    expect(useMapStore.getState().map.lights.find((l) => l.id === 'l1')?.radius).toBe(50)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })
})

describe('mapStore snapTargets/setSnapTarget/setSnapEnabled', () => {
  beforeEach(() => {
    useMapStore.setState({
      snapTargets: { token: false, wall: false, prop: false },
      past: [],
      future: [],
    })
  })

  it('setSnapTarget muda só o alvo indicado, sem tocar os outros, e sem entrada de undo (preferência de sessão)', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setSnapTarget('token', true)

    expect(useMapStore.getState().snapTargets).toEqual({ token: true, wall: false, prop: false })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })

  it('setSnapEnabled (compat com e2e legado) aplica o mesmo booleano aos 3 alvos', () => {
    useMapStore.getState().setSnapEnabled(true)
    expect(useMapStore.getState().snapTargets).toEqual({ token: true, wall: true, prop: true })

    useMapStore.getState().setSnapEnabled(false)
    expect(useMapStore.getState().snapTargets).toEqual({ token: false, wall: false, prop: false })
  })
})

describe('mapStore wallKind/setWallKind', () => {
  it('atualiza a preferência de próxima parede, sem entrada de undo', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setWallKind('interior')

    expect(useMapStore.getState().wallKind).toBe('interior')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })
})

describe('mapStore drawFillAlpha/setDrawFillAlpha', () => {
  it('atualiza a preferência de próxima forma, sem entrada de undo', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setDrawFillAlpha(0.9)

    expect(useMapStore.getState().drawFillAlpha).toBe(0.9)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })
})

describe('mapStore doorKind/setDoorKind', () => {
  it('atualiza a preferência de próxima porta, sem entrada de undo', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setDoorKind('gate')

    expect(useMapStore.getState().doorKind).toBe('gate')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })
})

describe('mapStore addDoorOnWall/setWallDoorKind/setDoorLocked (F2)', () => {
  // 200px de comprimento — folga suficiente pra caber até o maior vão
  // (DOOR_LENGTH_BY_KIND.gate = 96px) sem clampar numa das pontas, o que
  // tornaria o teste de comprimento um falso-positivo (ver addDoorOnWall,
  // mapFactory.ts: parede mais curta que doorLength devolve a parede inteira).
  const longWall: Wall = { id: 'w1', x1: 0, y1: 40, x2: 200, y2: 40, blocksLight: true, blocksMove: true, door: null }

  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [] },
      past: [],
      future: [],
      selection: [],
    })
    useMapStore.getState().addWall(longWall)
  })

  it('addDoorOnWall usa DOOR_LENGTH_BY_KIND[kind] pro comprimento e grava o kind pedido na porta, com histórico', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().addDoorOnWall('w1', { x: 100, y: 40 }, 'gate')

    const doorPiece = useMapStore.getState().map.walls.find((w) => w.door !== null)
    expect(doorPiece?.door?.kind).toBe('gate')
    // DOOR_LENGTH_BY_KIND.gate = 96px — o vão da porta (comprimento do
    // pedaço com door) tem que refletir esse comprimento, não os 32px de
    // 'normal'.
    expect(doorPiece && Math.hypot(doorPiece.x2 - doorPiece.x1, doorPiece.y2 - doorPiece.y1)).toBeCloseTo(96, 9)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('setWallDoorKind troca o kind de uma porta já criada e redimensiona o vão, com histórico', () => {
    useMapStore.getState().addDoorOnWall('w1', { x: 100, y: 40 }, 'normal')
    const doorId = useMapStore.getState().map.walls.find((w) => w.door !== null)?.id
    expect(doorId).toBeDefined()
    if (!doorId) return
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setWallDoorKind(doorId, 'double')

    const wall = useMapStore.getState().map.walls.find((w) => w.id === doorId)
    expect(wall?.door?.kind).toBe('double')
    expect(wall && Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)).toBeCloseTo(64, 9)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('setDoorLocked tranca/destranca uma porta já criada, com histórico', () => {
    useMapStore.getState().addDoorOnWall('w1', { x: 100, y: 40 }, 'normal')
    const doorId = useMapStore.getState().map.walls.find((w) => w.door !== null)?.id
    expect(doorId).toBeDefined()
    if (!doorId) return
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setDoorLocked(doorId, true)

    expect(useMapStore.getState().map.walls.find((w) => w.id === doorId)?.door?.locked).toBe(true)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })
})

describe('mapStore Stair (F2): addStair/removeStair/moveStair/updateStairPoint/setStairDirection', () => {
  const stair: Stair = { id: 's1', shape: 'straight', direction: 'up', segments: [{ x1: 0, y1: 0, x2: 0, y2: 64 }], stepWidth: 32 }

  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, stairs: [] },
      past: [],
      future: [],
      selection: [],
    })
  })

  it('addStair/removeStair/moveStair/updateStairPoint/setStairDirection refletem no map, cada um com histórico', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().addStair(stair)
    expect(useMapStore.getState().map.stairs).toEqual([stair])

    useMapStore.getState().moveStair('s1', 10, 0)
    expect(useMapStore.getState().map.stairs[0].segments[0]).toEqual({ x1: 10, y1: 0, x2: 10, y2: 64 })

    useMapStore.getState().updateStairPoint('s1', 0, 1, 20, 5)
    expect(useMapStore.getState().map.stairs[0].segments[0]).toEqual({ x1: 10, y1: 0, x2: 20, y2: 5 })

    useMapStore.getState().setStairDirection('s1', 'down')
    expect(useMapStore.getState().map.stairs[0].direction).toBe('down')

    useMapStore.getState().removeStair('s1')
    expect(useMapStore.getState().map.stairs).toEqual([])

    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 5)
  })

  it('removeSelected apaga a escada selecionada — removers[SelectionKind] cobre "stair"', () => {
    useMapStore.getState().addStair(stair)
    useMapStore.getState().setSelection([{ kind: 'stair', id: 's1' }])

    useMapStore.getState().removeSelected()

    expect(useMapStore.getState().map.stairs).toEqual([])
    expect(useMapStore.getState().selection).toEqual([])
  })

  it('toggleLayerVisibility("escadas") limpa a seleção quando a escada selecionada fica oculta', () => {
    useMapStore.getState().addStair(stair)
    useMapStore.getState().setSelection([{ kind: 'stair', id: 's1' }])

    useMapStore.getState().toggleLayerVisibility('escadas')

    expect(useMapStore.getState().selection).toEqual([])
  })
})

describe('mapStore Sala (F2): setRoomName/resizeRoomDimensions/resizeRoomCornerLive', () => {
  function seedRoom() {
    const { region, walls } = buildRoomFixture()
    useMapStore.setState({
      map: { ...useMapStore.getState().map, regions: [{ ...region, room: { shape: 'rect', name: 'Sala' } }], walls },
      past: [],
      future: [],
      selection: [],
    })
  }

  it('setRoomName reflete no map, com histórico', () => {
    seedRoom()
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setRoomName('r1', 'Salão')

    expect(useMapStore.getState().map.regions[0].room?.name).toBe('Salão')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('resizeRoomDimensions reflete no map E sincroniza as paredes vinculadas, com histórico', () => {
    seedRoom()
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().resizeRoomDimensions('r1', 200, 50)

    expect(useMapStore.getState().map.regions[0].points).toEqual([
      { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 50 }, { x: 0, y: 50 },
    ])
    assertRoomLinkInvariant('r1')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('resizeRoomCornerLive aplica no map SEM histórico (par de commitDragHistory no pointerup)', () => {
    seedRoom()
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().resizeRoomCornerLive('r1', 2, 150, 120)

    expect(useMapStore.getState().map.regions[0].points[2]).toEqual({ x: 150, y: 120 })
    assertRoomLinkInvariant('r1')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })
})

describe('mapStore setMapScale/setMeasurementMode (F2)', () => {
  it('setMapScale reflete no map, com histórico', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setMapScale({ unitsPerCell: 1.5, unit: 'm', precision: 1 })

    expect(useMapStore.getState().map.scale).toEqual({ unitsPerCell: 1.5, unit: 'm', precision: 1 })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('setMeasurementMode reflete no map, com histórico', () => {
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setMeasurementMode('euclidean')

    expect(useMapStore.getState().map.measurementMode).toBe('euclidean')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('setGridShape (via store) também reseta measurementMode pro default do formato novo', () => {
    useMapStore.getState().setMeasurementMode('manhattan')

    useMapStore.getState().setGridShape('hex')

    expect(useMapStore.getState().map.measurementMode).toBe('hex')
  })
})

// ─────────────────────────────────────────────────────────────
// F4 (integrador I7) — bug3 mover/redimensionar (B3): resize por canto de
// Drawing/Prop/Token, sem histórico, par de commitDragHistory.
// ─────────────────────────────────────────────────────────────
describe('mapStore F4 (B3) — resizeDrawingCornerLive/resizePropCornerLive/updateTokenLive', () => {
  const rectDrawing: Drawing = { id: 'd1', kind: 'rect', x: 0, y: 0, w: 100, h: 100, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }

  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [], props: [], tokens: [] },
      selection: [],
      past: [],
      future: [],
    })
  })

  it('resizeDrawingCornerLive redimensiona um rect SEM histórico (par de commitDragHistory no pointerup)', () => {
    useMapStore.getState().addDrawing(rectDrawing)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().resizeDrawingCornerLive('d1', 2, 150, 120, { shift: false, alt: false })

    const resized = useMapStore.getState().map.drawings.find((d) => d.id === 'd1')
    expect(resized).toMatchObject({ x: 0, y: 0, w: 150, h: 120 })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('resizeDrawingCornerLive não faz nada (mesma referência) quando o drawing não existe', () => {
    useMapStore.getState().addDrawing(rectDrawing)
    const before = useMapStore.getState().map

    useMapStore.getState().resizeDrawingCornerLive('inexistente', 2, 150, 120, { shift: false, alt: false })

    expect(useMapStore.getState().map).toBe(before)
  })

  it('resizeDrawingCornerLive não faz nada para um kind sem resize por canto (ex.: line)', () => {
    const line: Drawing = { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 2 }
    useMapStore.getState().addDrawing(line)
    const before = useMapStore.getState().map

    useMapStore.getState().resizeDrawingCornerLive('l1', 0, 5, 5, { shift: false, alt: false })

    expect(useMapStore.getState().map).toBe(before)
  })

  it('resizePropCornerLive redimensiona um Prop SEM histórico', () => {
    useMapStore.getState().addProp(prop)
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length

    // prop 64x64 centrado em (0,0): canto 2 (baixo-direita, {32,32}) vai pra {50,50}.
    useMapStore.getState().resizePropCornerLive('p1', 2, 50, 50, { shift: false, alt: false })

    const resized = useMapStore.getState().map.props.find((p) => p.id === 'p1')
    expect(resized).toMatchObject({ x: 9, y: 9, width: 82, height: 82 })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('updateTokenLive muda só o size, sem histórico — patch parcial não afeta os demais campos', () => {
    useMapStore.getState().addToken(token)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().updateTokenLive('t1', { size: 2 })

    const updated = useMapStore.getState().map.tokens.find((t) => t.id === 't1')
    expect(updated).toEqual({ ...token, size: 2 })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })
})

// ─────────────────────────────────────────────────────────────
// F4 (integrador I7) — bug2/N2 "ponta da linha" e "dobrar a linha".
// ─────────────────────────────────────────────────────────────
describe('mapStore F4 (N2/B2) — drawCap/setDrawingCap/convertDrawingToCurve', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      selection: [],
      past: [],
      future: [],
      drawCap: 'round',
    })
  })

  it('drawCap começa em "round" (aparência idêntica à de hoje); setDrawCap muda a preferência sem histórico', () => {
    expect(useMapStore.getState().drawCap).toBe('round')
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setDrawCap('square')

    expect(useMapStore.getState().drawCap).toBe('square')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })

  it('setDrawingCap edita uma line já criada, com histórico', () => {
    const line: Drawing = { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 2 }
    useMapStore.getState().addDrawing(line)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setDrawingCap('l1', 'butt')

    const updated = useMapStore.getState().map.drawings.find((d) => d.id === 'l1')
    expect(updated).toMatchObject({ cap: 'butt' })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('setDrawingCap não afeta um kind sem campo cap (ex.: rect) — campo continua ausente', () => {
    const rect: Drawing = { id: 'r1', kind: 'rect', x: 0, y: 0, w: 10, h: 10, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
    useMapStore.getState().addDrawing(rect)

    useMapStore.getState().setDrawingCap('r1', 'butt')

    const untouched = useMapStore.getState().map.drawings.find((d) => d.id === 'r1')
    expect(untouched).toEqual(rect)
  })

  it('convertDrawingToCurve troca uma line selecionada por uma curve equivalente, preservando cor/espessura/cap, com histórico', () => {
    const line: Drawing = { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 40, y2: 0, color: '#fff', width: 2, cap: 'butt' }
    useMapStore.getState().addDrawing(line)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().convertDrawingToCurve('l1')

    const converted = useMapStore.getState().map.drawings.find((d) => d.id === 'l1')
    expect(converted).toEqual({
      id: 'l1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 40, y: 0 }], color: '#fff', width: 2, cap: 'butt',
    })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('convertDrawingToCurve num kind que não é line é no-op (entidade igual) — campo cap AUSENTE não quebra', () => {
    const circle: Drawing = { id: 'c1', kind: 'circle', cx: 0, cy: 0, radius: 10, color: '#fff', width: 2, filled: false, fillAlpha: 0 }
    useMapStore.getState().addDrawing(circle)

    useMapStore.getState().convertDrawingToCurve('c1')

    const untouched = useMapStore.getState().map.drawings.find((d) => d.id === 'c1')
    expect(untouched).toEqual(circle)
  })
})

// ─────────────────────────────────────────────────────────────
// F4 (integrador I7) — N2 "tirar o fundo" de Região/Sala.
// ─────────────────────────────────────────────────────────────
describe('mapStore F4 (N2) — regionFillEnabled/setRegionFilled', () => {
  const region: Region = { id: 'r1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], tag: 'region', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} }

  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, regions: [] },
      selection: [],
      past: [],
      future: [],
      regionFillEnabled: true,
    })
  })

  it('regionFillEnabled começa true (aparência idêntica à de hoje); setRegionFillEnabled muda a preferência sem histórico', () => {
    expect(useMapStore.getState().regionFillEnabled).toBe(true)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setRegionFillEnabled(false)

    expect(useMapStore.getState().regionFillEnabled).toBe(false)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })

  it('setRegionFilled edita uma região já criada, com histórico', () => {
    useMapStore.getState().addRegion(region)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setRegionFilled('r1', false)

    expect(useMapStore.getState().map.regions[0].filled).toBe(false)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })
})

// ─────────────────────────────────────────────────────────────
// Onda 4, item 24 — modelo canônico de seleção (lib/selectionModel.ts).
// Migra o describe antigo "F4 (N3) — areaSelection/setAreaSelection/
// moveAreaSelectionLive": os dois campos separados (`selection` de 1 item +
// `areaSelection` de grupo) viraram UM `selection: SelectionSet`.
// `setAreaSelection` sumiu (não existe mais estado separado pra "setar");
// `moveAreaSelectionLive` virou `moveSelectionLive`, operando sobre
// `selection` via `selectionToAreaSelection` — mesma mecânica de
// `lib/areaSelection.ts` por baixo, só a fonte do grupo mudou.
// ─────────────────────────────────────────────────────────────
describe('mapStore Onda 4 (item 24) — selection como SelectionSet/moveSelectionLive/moveSelectionBy', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, tokens: [], walls: [], regions: [] },
      selection: [],
      past: [],
      future: [],
    })
  })

  it('selection começa vazia ([]), nunca null', () => {
    expect(useMapStore.getState().selection).toEqual([])
  })

  it('setSelection substitui o conjunto inteiro — 1 item é só um array de tamanho 1', () => {
    useMapStore.getState().setSelection([{ kind: 'token', id: 't1' }])

    expect(useMapStore.getState().selection).toEqual([{ kind: 'token', id: 't1' }])
  })

  it('setSelection com 2+ itens (Shift+clique) guarda o conjunto sem deduplicar por conta própria — quem chama decide', () => {
    useMapStore.getState().setSelection([{ kind: 'token', id: 't1' }, { kind: 'wall', id: 'w1' }])

    expect(useMapStore.getState().selection).toEqual([{ kind: 'token', id: 't1' }, { kind: 'wall', id: 'w1' }])
  })

  it('moveSelectionLive move TODOS os itens selecionados SEM histórico (par de commitDragHistory no pointerup)', () => {
    useMapStore.getState().addToken(token)
    useMapStore.getState().setSelection([{ kind: 'token', id: 't1' }])
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().moveSelectionLive(10, 20)

    const moved = useMapStore.getState().map.tokens.find((t) => t.id === 't1')
    expect(moved).toEqual({ ...token, x: 10, y: 20 })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)

    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('moveSelectionLive não faz nada (mesma referência) quando a seleção está vazia', () => {
    const before = useMapStore.getState().map

    useMapStore.getState().moveSelectionLive(10, 20)

    expect(useMapStore.getState().map).toBe(before)
  })

  it('moveSelectionBy move TODOS os itens do conjunto, com UMA entrada de histórico', () => {
    const tokenB: Token = { id: 't2', characterId: null, name: 'Herói 2', x: 5, y: 5, size: 1, image: null }
    useMapStore.getState().addToken(token)
    useMapStore.getState().addToken(tokenB)
    useMapStore.getState().setSelection([{ kind: 'token', id: 't1' }, { kind: 'token', id: 't2' }])
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().moveSelectionBy(10, 20)

    expect(useMapStore.getState().map.tokens.find((t) => t.id === 't1')).toEqual({ ...token, x: 10, y: 20 })
    expect(useMapStore.getState().map.tokens.find((t) => t.id === 't2')).toEqual({ ...tokenB, x: 15, y: 25 })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('moveSelectionBy não faz nada (nem histórico) quando a seleção está vazia', () => {
    const before = useMapStore.getState().map
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().moveSelectionBy(10, 20)

    expect(useMapStore.getState().map).toBe(before)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })

  it('removeSelected apaga TODOS os itens do conjunto, com UMA entrada de histórico', () => {
    const tokenB: Token = { id: 't2', characterId: null, name: 'Herói 2', x: 5, y: 5, size: 1, image: null }
    useMapStore.getState().addToken(token)
    useMapStore.getState().addToken(tokenB)
    useMapStore.getState().setSelection([{ kind: 'token', id: 't1' }, { kind: 'token', id: 't2' }])
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().removeSelected()

    expect(useMapStore.getState().map.tokens).toEqual([])
    expect(useMapStore.getState().selection).toEqual([])
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('duplicateSelected clona TODOS os itens do conjunto e seleciona as cópias, com UMA entrada de histórico', () => {
    const tokenB: Token = { id: 't2', characterId: null, name: 'Herói 2', x: 5, y: 5, size: 1, image: null }
    useMapStore.getState().addToken(token)
    useMapStore.getState().addToken(tokenB)
    useMapStore.getState().setSelection([{ kind: 'token', id: 't1' }, { kind: 'token', id: 't2' }])
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().duplicateSelected()

    expect(useMapStore.getState().map.tokens).toHaveLength(4)
    const newSelection = useMapStore.getState().selection
    expect(newSelection).toHaveLength(2)
    expect(newSelection.every((item) => item.kind === 'token' && item.id !== 't1' && item.id !== 't2')).toBe(true)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('loadMap limpa selection (volta a []) junto de past/future', () => {
    useMapStore.getState().addToken(token)
    useMapStore.getState().setSelection([{ kind: 'token', id: 't1' }])

    useMapStore.getState().loadMap({ ...useMapStore.getState().map, tokens: [] })

    expect(useMapStore.getState().selection).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────
// Fase 5 — N1 "setinha de variantes": os 3 eixos que faltavam (pincel/
// borracha/escada) mais o sentido inverso de convertDrawingToCurve.
// ─────────────────────────────────────────────────────────────
describe('mapStore Fase 5 — drawTexture/setDrawingTexture (pincel: caneta/lápis/marcador)', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      selection: [],
      past: [],
      future: [],
      drawTexture: 'pen',
    })
  })

  it('drawTexture começa em "pen" (aparência idêntica à de hoje); setDrawTexture muda a preferência sem histórico', () => {
    expect(useMapStore.getState().drawTexture).toBe('pen')
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setDrawTexture('pencil')

    expect(useMapStore.getState().drawTexture).toBe('pencil')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })

  it('setDrawingTexture edita um freehand já criado, com histórico', () => {
    const freehand: Drawing = { id: 'f1', kind: 'freehand', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], color: '#fff', width: 4 }
    useMapStore.getState().addDrawing(freehand)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setDrawingTexture('f1', 'marker')

    const updated = useMapStore.getState().map.drawings.find((d) => d.id === 'f1')
    expect(updated).toMatchObject({ texture: 'marker' })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('setDrawingTexture não afeta um kind sem textura (line) — campo texture AUSENTE não quebra', () => {
    const line: Drawing = { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, color: '#fff', width: 2 }
    useMapStore.getState().addDrawing(line)

    useMapStore.getState().setDrawingTexture('l1', 'marker')

    expect(useMapStore.getState().map.drawings.find((d) => d.id === 'l1')).toEqual(line)
  })
})

describe('mapStore Fase 5 — stairSizePreset/setStairStepWidthForStair (escada P/M/G)', () => {
  const stair: Stair = { id: 's1', shape: 'straight', direction: 'up', segments: [{ x1: 0, y1: 0, x2: 64, y2: 0 }], stepWidth: 64 }

  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, stairs: [], grid: 64 },
      selection: [],
      past: [],
      future: [],
      stairSizePreset: 'medium',
    })
  })

  it('stairSizePreset começa em "medium" (1×grid, aparência idêntica à de hoje); setStairSizePreset muda a preferência sem histórico', () => {
    expect(useMapStore.getState().stairSizePreset).toBe('medium')
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setStairSizePreset('large')

    expect(useMapStore.getState().stairSizePreset).toBe('large')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })

  it('setStairStepWidthForStair edita stepWidth de uma escada já criada, com histórico', () => {
    useMapStore.getState().addStair(stair)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setStairStepWidthForStair('s1', 32)

    expect(useMapStore.getState().map.stairs.find((s) => s.id === 's1')?.stepWidth).toBe(32)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })
})

describe('mapStore Fase 5 — convertDrawingToLine (B2, sentido inverso de convertDrawingToCurve)', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      selection: [],
      past: [],
      future: [],
    })
  })

  it('converte uma curve de 2 pontos de volta pra line, preservando cor/espessura/cap, com histórico', () => {
    const curve: Drawing = { id: 'c1', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 40, y: 0 }], color: '#fff', width: 2, cap: 'butt' }
    useMapStore.getState().addDrawing(curve)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().convertDrawingToLine('c1')

    const converted = useMapStore.getState().map.drawings.find((d) => d.id === 'c1')
    expect(converted).toEqual({ id: 'c1', kind: 'line', x1: 0, y1: 0, x2: 40, y2: 0, color: '#fff', width: 2, cap: 'butt' })
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('convertDrawingToLine numa curve com 3+ pontos é no-op (mesma referência) — nunca descarta ponto em silêncio', () => {
    const curve: Drawing = { id: 'c2', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 20, y: 30 }, { x: 40, y: 0 }], color: '#fff', width: 2 }
    useMapStore.getState().addDrawing(curve)

    useMapStore.getState().convertDrawingToLine('c2')

    expect(useMapStore.getState().map.drawings.find((d) => d.id === 'c2')).toEqual(curve)
  })
})

describe('mapStore Fase 5 — eraseMode/erasePartOfDrawing (borracha: apagar parte ou objeto todo)', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      selection: [],
      past: [],
      future: [],
      eraseMode: 'objeto',
    })
  })

  it('eraseMode começa em "objeto" (comportamento idêntico ao de hoje); setEraseMode muda a preferência sem histórico', () => {
    expect(useMapStore.getState().eraseMode).toBe('objeto')
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().setEraseMode('parte')

    expect(useMapStore.getState().eraseMode).toBe('parte')
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })

  it('erasePartOfDrawing recorta um freehand pelo meio em 2 pedaços, com histórico', () => {
    const freehand: Drawing = {
      id: 'f1', kind: 'freehand',
      points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 40, y: 0 }, { x: 60, y: 0 }, { x: 80, y: 0 }],
      color: '#fff', width: 2,
    }
    useMapStore.getState().addDrawing(freehand)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().erasePartOfDrawing('f1', { x: 40, y: 0 }, 10)

    const remaining = useMapStore.getState().map.drawings
    expect(remaining).toHaveLength(2)
    expect(remaining.every((d) => d.id !== 'f1')).toBe(true) // ids novos (crypto.randomUUID)
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore + 1)
  })

  it('erasePartOfDrawing sem tocar o traço não gera entrada de histórico (mesma referência)', () => {
    const freehand: Drawing = { id: 'f2', kind: 'freehand', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], color: '#fff', width: 2 }
    useMapStore.getState().addDrawing(freehand)
    const pastLengthBefore = useMapStore.getState().past.length

    useMapStore.getState().erasePartOfDrawing('f2', { x: 500, y: 500 }, 5)

    expect(useMapStore.getState().map.drawings).toEqual([freehand])
    expect(useMapStore.getState().past.length).toBe(pastLengthBefore)
  })

  it('erasePartOfDrawing com id inexistente não quebra nem muda o map', () => {
    const before = useMapStore.getState().map

    useMapStore.getState().erasePartOfDrawing('inexistente', { x: 0, y: 0 }, 10)

    expect(useMapStore.getState().map).toBe(before)
  })
})
