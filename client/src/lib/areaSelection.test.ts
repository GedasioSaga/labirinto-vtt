import { describe, expect, it } from 'vitest'
import {
  areaSelectionMode,
  selectEntitiesInArea,
  areaSelectionBounds,
  moveAreaSelection,
  isAreaSelectionEmpty,
  EMPTY_AREA_SELECTION,
  classifyMarqueeGesture,
  marqueeHintPlacement,
} from './areaSelection'
import type { Wall, Region, Light, Token, Prop, Stair, Drawing, LayerId } from '../types/map'
import {
  createEmptyMap,
  addWall,
  addRegion,
  addLight,
  addToken,
  addProp,
  addStair,
  addDrawing,
  addRoom,
} from './mapFactory'

const baseMap = createEmptyMap('m1', 'Mapa', 1000, 1000, 50)

describe('areaSelectionMode', () => {
  it('arrasto da esquerda pra direita (x2 >= x1) é contenção', () => {
    expect(areaSelectionMode({ x1: 0, y1: 0, x2: 100, y2: 100 })).toBe('contain')
  })

  it('arrasto da direita pra esquerda (x2 < x1) é interseção', () => {
    expect(areaSelectionMode({ x1: 100, y1: 0, x2: 0, y2: 100 })).toBe('intersect')
  })
})

describe('selectEntitiesInArea — Parede', () => {
  const wall: Wall = { id: 'w1', x1: 10, y1: 10, x2: 90, y2: 10, blocksLight: true, blocksMove: true, door: null }
  const map = addWall(baseMap, wall)

  it('contenção: parede inteira dentro do retângulo entra', () => {
    const selection = selectEntitiesInArea(map, { x1: 0, y1: 0, x2: 100, y2: 100 })
    expect(selection.walls).toEqual(['w1'])
  })

  it('contenção: parede que sai do retângulo NÃO entra', () => {
    const selection = selectEntitiesInArea(map, { x1: 0, y1: 0, x2: 50, y2: 100 })
    expect(selection.walls).toEqual([])
  })

  it('interseção: mesma parede parcialmente fora entra quando o arrasto é direita-pra-esquerda', () => {
    const selection = selectEntitiesInArea(map, { x1: 50, y1: 0, x2: 0, y2: 100 })
    expect(selection.walls).toEqual(['w1'])
  })

  it('retângulo longe da parede não encontra nada, nos dois modos', () => {
    expect(selectEntitiesInArea(map, { x1: 500, y1: 500, x2: 600, y2: 600 }).walls).toEqual([])
    expect(selectEntitiesInArea(map, { x1: 600, y1: 500, x2: 500, y2: 600 }).walls).toEqual([])
  })
})

describe('selectEntitiesInArea — camada oculta e item travado', () => {
  const visibleWall: Wall = { id: 'w1', x1: 10, y1: 10, x2: 20, y2: 10, blocksLight: true, blocksMove: true, door: null }
  const lockedWall: Wall = { id: 'w2', x1: 10, y1: 20, x2: 20, y2: 20, blocksLight: true, blocksMove: true, door: null, locked: true }

  it('item em camada oculta (map.hiddenLayers) não entra na seleção', () => {
    const hiddenLayers: LayerId[] = ['paredes']
    const map = { ...addWall(baseMap, visibleWall), hiddenLayers }
    expect(selectEntitiesInArea(map, { x1: 0, y1: 0, x2: 100, y2: 100 }).walls).toEqual([])
  })

  it('item travado (locked=true) não entra na seleção mesmo dentro do retângulo', () => {
    const map = addWall(baseMap, lockedWall)
    expect(selectEntitiesInArea(map, { x1: 0, y1: 0, x2: 100, y2: 100 }).walls).toEqual([])
  })
})

describe('selectEntitiesInArea — Região (polígono)', () => {
  const region: Region = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
    tag: '',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
  }
  const map = addRegion(baseMap, region)

  it('contenção: retângulo de seleção maior que a região inteira encontra', () => {
    expect(selectEntitiesInArea(map, { x1: -10, y1: -10, x2: 110, y2: 110 }).regions).toEqual(['r1'])
  })

  it('contenção: retângulo de seleção menor que a região (região não cabe inteira) NÃO encontra', () => {
    expect(selectEntitiesInArea(map, { x1: 0, y1: 0, x2: 50, y2: 50 }).regions).toEqual([])
  })

  it('interseção: retângulo pequeno DENTRO da região grande encontra (nenhum vértice cruza, mas os cantos do retângulo estão dentro do polígono)', () => {
    const selection = selectEntitiesInArea(map, { x1: 60, y1: 40, x2: 40, y2: 60 })
    expect(selection.regions).toEqual(['r1'])
  })

  it('região degenerada (menos de 3 pontos) nunca entra', () => {
    const degenerate: Region = { id: 'r2', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], tag: '', fillColor: '#000', fillPattern: 'solid', data: {} }
    const mapWithDegenerate = addRegion(baseMap, degenerate)
    expect(selectEntitiesInArea(mapWithDegenerate, { x1: -10, y1: -10, x2: 10, y2: 10 }).regions).toEqual([])
  })
})

describe('selectEntitiesInArea — Token (raio = grid/2 * size)', () => {
  const token: Token = { id: 't1', characterId: null, name: 'Herói', x: 100, y: 100, size: 1, image: null }
  // grid=50 (baseMap), size=1 → raio 25. Ponto de borda do retângulo a 20px do centro entra; a 30px não.
  const map = addToken(baseMap, token)

  it('retângulo que cobre o raio do token encontra', () => {
    expect(selectEntitiesInArea(map, { x1: 70, y1: 70, x2: 130, y2: 130 }).tokens).toEqual(['t1'])
  })

  it('retângulo que não alcança o raio do token não encontra (interseção)', () => {
    expect(selectEntitiesInArea(map, { x1: 200, y1: 100, x2: 140, y2: 130 }).tokens).toEqual([])
  })
})

describe('selectEntitiesInArea — Drawing rect/ellipse/polygon (sem hit-test de clique, mas selecionáveis por área)', () => {
  const rectDrawing: Drawing = { id: 'd1', kind: 'rect', x: 10, y: 10, w: 20, h: 20, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
  const ellipseDrawing: Drawing = { id: 'd2', kind: 'ellipse', cx: 200, cy: 200, rx: 10, ry: 10, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
  const polygonDrawing: Drawing = { id: 'd3', kind: 'polygon', points: [{ x: 300, y: 300 }, { x: 320, y: 300 }, { x: 310, y: 320 }], color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }

  it('rect: contenção encontra quando cabe inteiro', () => {
    const map = addDrawing(baseMap, rectDrawing)
    expect(selectEntitiesInArea(map, { x1: 0, y1: 0, x2: 40, y2: 40 }).drawings).toEqual(['d1'])
  })

  it('ellipse: bounding box usado pra contenção', () => {
    const map = addDrawing(baseMap, ellipseDrawing)
    expect(selectEntitiesInArea(map, { x1: 180, y1: 180, x2: 220, y2: 220 }).drawings).toEqual(['d2'])
  })

  it('polygon: contenção encontra quando todos os vértices cabem', () => {
    const map = addDrawing(baseMap, polygonDrawing)
    expect(selectEntitiesInArea(map, { x1: 290, y1: 290, x2: 330, y2: 330 }).drawings).toEqual(['d3'])
  })
})

describe('selectEntitiesInArea — arrasto abaixo do mínimo (clique acidental)', () => {
  const wall: Wall = { id: 'w1', x1: 10, y1: 10, x2: 20, y2: 10, blocksLight: true, blocksMove: true, door: null }
  const map = addWall(baseMap, wall)

  it('retângulo quase sem área (menor que o mínimo nos 2 eixos) devolve seleção vazia', () => {
    const selection = selectEntitiesInArea(map, { x1: 10, y1: 10, x2: 11, y2: 11 })
    expect(isAreaSelectionEmpty(selection)).toBe(true)
  })
})

describe('moveAreaSelection', () => {
  it('dx=dy=0 devolve a MESMA referência de map (sem mudança)', () => {
    const map = addWall(baseMap, { id: 'w1', x1: 0, y1: 0, x2: 10, y2: 0, blocksLight: true, blocksMove: true, door: null })
    const selection = selectEntitiesInArea(map, { x1: -5, y1: -5, x2: 15, y2: 5 })
    expect(moveAreaSelection(map, selection, 0, 0)).toBe(map)
  })

  it('move luz, token, objeto e escada por delta', () => {
    const light: Light = { id: 'l1', x: 100, y: 100, radius: 50, color: '#fff', intensity: 1 }
    const token: Token = { id: 't1', characterId: null, name: 'A', x: 200, y: 200, size: 1, image: null }
    const prop: Prop = { id: 'p1', src: 'x.png', x: 300, y: 300, width: 20, height: 20, linkedMapPath: null }
    const stair: Stair = { id: 's1', shape: 'straight', direction: 'up', segments: [{ x1: 400, y1: 400, x2: 450, y2: 400 }], stepWidth: 50 }

    let map = addLight(baseMap, light)
    map = addToken(map, token)
    map = addProp(map, prop)
    map = addStair(map, stair)

    const selection = { walls: [], regions: [], lights: ['l1'], tokens: ['t1'], props: ['p1'], stairs: ['s1'], drawings: [] }
    const moved = moveAreaSelection(map, selection, 10, -5)

    expect(moved.lights[0]).toMatchObject({ x: 110, y: 95 })
    expect(moved.tokens[0]).toMatchObject({ x: 210, y: 195 })
    expect(moved.props[0]).toMatchObject({ x: 310, y: 295 })
    expect(moved.stairs[0].segments[0]).toMatchObject({ x1: 410, y1: 395, x2: 460, y2: 395 })
  })

  it('item travado (locked) NÃO se move mesmo se vier numa seleção (defesa em profundidade)', () => {
    const lockedLight: Light = { id: 'l1', x: 100, y: 100, radius: 50, color: '#fff', intensity: 1, locked: true }
    const map = addLight(baseMap, lockedLight)
    const moved = moveAreaSelection(map, { walls: [], regions: [], lights: ['l1'], tokens: [], props: [], stairs: [], drawings: [] }, 10, 10)
    expect(moved.lights[0]).toMatchObject({ x: 100, y: 100 })
  })

  it('região + suas próprias paredes selecionadas juntas: delta aplicado UMA vez só (não dobra)', () => {
    const region: Region = { id: 'r1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], tag: '', fillColor: '#fff', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Sala' } }
    const wallTop: Wall = { id: 'w-top', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, regionId: 'r1', regionEdgeIndex: 0 }
    const wallRight: Wall = { id: 'w-right', x1: 100, y1: 0, x2: 100, y2: 100, blocksLight: true, blocksMove: true, door: null, regionId: 'r1', regionEdgeIndex: 1 }
    const map = addRoom(baseMap, region, [wallTop, wallRight])

    const selection = { walls: ['w-top', 'w-right'], regions: ['r1'], lights: [], tokens: [], props: [], stairs: [], drawings: [] }
    const moved = moveAreaSelection(map, selection, 10, 10)

    expect(moved.regions[0].points[0]).toMatchObject({ x: 10, y: 10 }) // não 20,20
    const movedWallTop = moved.walls.find((w) => w.id === 'w-top')
    expect(movedWallTop).toMatchObject({ x1: 10, y1: 10, x2: 110, y2: 10 }) // não dobrado
  })

  it('2 paredes irmãs da MESMA região selecionadas, região NÃO selecionada: a região move 1 vez só (via delegação da primeira parede), a segunda parede não dobra o delta', () => {
    const region: Region = { id: 'r1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], tag: '', fillColor: '#fff', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Sala' } }
    const wallTop: Wall = { id: 'w-top', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null, regionId: 'r1', regionEdgeIndex: 0 }
    const wallRight: Wall = { id: 'w-right', x1: 100, y1: 0, x2: 100, y2: 100, blocksLight: true, blocksMove: true, door: null, regionId: 'r1', regionEdgeIndex: 1 }
    const map = addRoom(baseMap, region, [wallTop, wallRight])

    const selection = { walls: ['w-top', 'w-right'], regions: [], lights: [], tokens: [], props: [], stairs: [], drawings: [] }
    const moved = moveAreaSelection(map, selection, 10, 10)

    expect(moved.regions[0].points[0]).toMatchObject({ x: 10, y: 10 })
    const movedWallTop = moved.walls.find((w) => w.id === 'w-top')
    expect(movedWallTop).toMatchObject({ x1: 10, y1: 10, x2: 110, y2: 10 })
  })

  it('move Drawing dos 3 kinds sem função de delta em mapFactory.moveDrawing (rect/ellipse/polygon) — prova de que moveAreaSelection NÃO depende do no-op de lá', () => {
    const rectDrawing: Drawing = { id: 'd1', kind: 'rect', x: 10, y: 10, w: 20, h: 20, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
    const ellipseDrawing: Drawing = { id: 'd2', kind: 'ellipse', cx: 200, cy: 200, rx: 10, ry: 10, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
    const polygonDrawing: Drawing = { id: 'd3', kind: 'polygon', points: [{ x: 300, y: 300 }, { x: 320, y: 300 }], color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }

    let map = addDrawing(baseMap, rectDrawing)
    map = addDrawing(map, ellipseDrawing)
    map = addDrawing(map, polygonDrawing)

    const selection = { walls: [], regions: [], lights: [], tokens: [], props: [], stairs: [], drawings: ['d1', 'd2', 'd3'] }
    const moved = moveAreaSelection(map, selection, 5, 5)

    const movedRect = moved.drawings.find((d) => d.id === 'd1')
    const movedEllipse = moved.drawings.find((d) => d.id === 'd2')
    const movedPolygon = moved.drawings.find((d) => d.id === 'd3')
    expect(movedRect).toMatchObject({ x: 15, y: 15 })
    expect(movedEllipse).toMatchObject({ cx: 205, cy: 205 })
    expect(movedPolygon && movedPolygon.kind === 'polygon' ? movedPolygon.points[0] : null).toMatchObject({ x: 305, y: 305 })
  })
})

describe('areaSelectionBounds', () => {
  it('seleção vazia devolve null', () => {
    expect(areaSelectionBounds(baseMap, EMPTY_AREA_SELECTION)).toBeNull()
  })

  it('bounding box combinado de mais de uma entidade', () => {
    const light: Light = { id: 'l1', x: 100, y: 100, radius: 50, color: '#fff', intensity: 1 }
    const token: Token = { id: 't1', characterId: null, name: 'A', x: 0, y: 0, size: 1, image: null }
    let map = addLight(baseMap, light)
    map = addToken(map, token)

    const bounds = areaSelectionBounds(map, { walls: [], regions: [], lights: ['l1'], tokens: ['t1'], props: [], stairs: [], drawings: [] })
    expect(bounds).toMatchObject({ minX: -25, minY: -25 }) // token: raio 25 (grid 50/2 * size 1), centrado em (0,0)
  })
})

describe('classifyMarqueeGesture', () => {
  it('gesto quase parado é clique, não arrasto — é assim que clicar no vazio larga a seleção', () => {
    expect(classifyMarqueeGesture({ x1: 100, y1: 100, x2: 101, y2: 100.5 }, 1, false)).toBe('click')
  })

  it('pointerdown e pointerup no MESMO ponto é clique', () => {
    expect(classifyMarqueeGesture({ x1: 100, y1: 100, x2: 100, y2: 100 }, 1, false)).toBe('click')
  })

  it('arrasto de verdade sem Shift SUBSTITUI a seleção', () => {
    expect(classifyMarqueeGesture({ x1: 0, y1: 0, x2: 200, y2: 150 }, 1, false)).toBe('replace')
  })

  it('arrasto de verdade com Shift SOMA à seleção', () => {
    expect(classifyMarqueeGesture({ x1: 0, y1: 0, x2: 200, y2: 150 }, 1, true)).toBe('add')
  })

  it('o limiar é de TELA: com zoom em 25%, 8 px de mundo ainda são 2 px de dedo — clique', () => {
    expect(classifyMarqueeGesture({ x1: 0, y1: 0, x2: 8, y2: 0 }, 0.25, false)).toBe('click')
    // ...e os mesmos 8 px de mundo com zoom 1 já são arrasto.
    expect(classifyMarqueeGesture({ x1: 0, y1: 0, x2: 8, y2: 0 }, 1, false)).toBe('replace')
  })

  it('arrasto da direita pra esquerda (modo interseção) também é arrasto', () => {
    expect(classifyMarqueeGesture({ x1: 300, y1: 300, x2: 100, y2: 100 }, 1, false)).toBe('replace')
  })

  it('escala de câmera inválida não trava o gesto: cai em 1', () => {
    expect(classifyMarqueeGesture({ x1: 0, y1: 0, x2: 200, y2: 0 }, 0, false)).toBe('replace')
    expect(classifyMarqueeGesture({ x1: 0, y1: 0, x2: 200, y2: 0 }, Number.NaN, false)).toBe('replace')
  })
})

describe('marqueeHintPlacement', () => {
  const LABEL = { width: 200, height: 16 }

  it('retângulo grande: a dica encosta no canto ONDE O GESTO COMEÇOU, com folga', () => {
    const placement = marqueeHintPlacement({ x1: 100, y1: 100, x2: 600, y2: 400 }, 1, LABEL)
    expect(placement).toEqual({ visible: true, x: 110, y: 110 })
  })

  it('arrasto pra cima e pra esquerda: a dica vai pro canto de baixo/direita, que é onde o gesto começou', () => {
    const placement = marqueeHintPlacement({ x1: 600, y1: 400, x2: 100, y2: 100 }, 1, LABEL)
    expect(placement).toEqual({ visible: true, x: 600 - 10 - 200, y: 400 - 10 - 16 })
  })

  it('retângulo estreito demais pro texto: dica escondida em vez de vazar pra fora', () => {
    expect(marqueeHintPlacement({ x1: 0, y1: 0, x2: 150, y2: 300 }, 1, LABEL).visible).toBe(false)
  })

  it('retângulo baixo demais pro texto: dica escondida', () => {
    expect(marqueeHintPlacement({ x1: 0, y1: 0, x2: 500, y2: 30 }, 1, LABEL).visible).toBe(false)
  })

  it('com zoom afastado o texto ocupa MAIS mundo, então cabe em menos retângulos', () => {
    const rect = { x1: 0, y1: 0, x2: 260, y2: 60 }
    expect(marqueeHintPlacement(rect, 1, LABEL).visible).toBe(true)
    expect(marqueeHintPlacement(rect, 0.5, LABEL).visible).toBe(false)
  })

  it('com zoom afastado a folga também cresce em mundo, pra continuar 10 px de tela', () => {
    const placement = marqueeHintPlacement({ x1: 0, y1: 0, x2: 2000, y2: 2000 }, 0.5, LABEL)
    expect(placement).toEqual({ visible: true, x: 20, y: 20 })
  })

  it('escala inválida cai em 1 em vez de devolver NaN', () => {
    expect(marqueeHintPlacement({ x1: 0, y1: 0, x2: 600, y2: 400 }, 0, LABEL)).toEqual({ visible: true, x: 10, y: 10 })
  })

  it('texto ainda não medido (0x0, fonte carregando) não vira NaN nem dica fora da caixa', () => {
    expect(marqueeHintPlacement({ x1: 0, y1: 0, x2: 600, y2: 400 }, 1, { width: 0, height: 0 })).toEqual({
      visible: true,
      x: 10,
      y: 10,
    })
    // Caixa menor que a folga mínima: escondida, e com coordenada finita.
    const minusculo = marqueeHintPlacement({ x1: 5, y1: 5, x2: 5, y2: 5 }, 1, { width: 0, height: 0 })
    expect(minusculo).toEqual({ visible: false, x: 5, y: 5 })
  })

  it('retângulo de área zero não quebra nenhuma das duas decisões', () => {
    const degenerado = { x1: 42, y1: 42, x2: 42, y2: 42 }
    expect(classifyMarqueeGesture(degenerado, 1, false)).toBe('click')
    expect(marqueeHintPlacement(degenerado, 1, LABEL).visible).toBe(false)
  })
})
