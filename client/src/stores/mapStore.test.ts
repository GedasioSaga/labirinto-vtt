import { describe, expect, it, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import type { Prop, Region, RegionPoint, Token, Wall } from '../types/map'
import { buildRoomFromDraft } from '../lib/drawingFactory'

const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1 }
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
      selection: null,
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

describe('mapStore undo/redo', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, walls: [], drawings: [] },
      past: [],
      future: [],
      selection: null,
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

describe('mapStore insertCurvePoint/removeCurvePoint/moveCurve', () => {
  beforeEach(() => {
    useMapStore.setState({
      map: { ...useMapStore.getState().map, drawings: [] },
      past: [],
      future: [],
      selection: null,
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
      selection: null,
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
      selection: null,
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
      selection: null,
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
      selection: null,
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
      selection: null,
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
      selection: null,
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
