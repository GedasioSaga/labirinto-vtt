import { describe, expect, it } from 'vitest'
import { findWallAt, findLightAt, isPointInPolygon, findRegionAt, findDrawingAt, findSelectableAt, findCurveControlPointAt, estimateTextWidth, findNearestExistingVertex } from './selectionHitTest'
import type { Wall, Light, Region, Drawing, MapData } from '../types/map'
import { createEmptyMap, addWall, addLight, addRegion, addToken, addProp, addDrawing } from './mapFactory'

const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null }
const light: Light = { id: 'l1', x: 200, y: 200, radius: 300, color: '#ffaa33', intensity: 0.8 }
const region: Region = { id: 'r1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], tag: '', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} }

describe('findWallAt', () => {
  it('ponto perto do segmento (dentro da tolerância) encontra a parede', () => {
    expect(findWallAt([wall], { x: 50, y: 3 })?.id).toBe('w1')
  })

  it('ponto longe do segmento não encontra nada', () => {
    expect(findWallAt([wall], { x: 50, y: 100 })).toBeNull()
  })

  it('ponto perto mas fora do intervalo do segmento (além da ponta) não encontra', () => {
    expect(findWallAt([wall], { x: 150, y: 0 })).toBeNull()
  })
})

describe('findLightAt', () => {
  it('ponto perto do centro da luz encontra (raio de seleção, não o raio de iluminação)', () => {
    expect(findLightAt([light], { x: 202, y: 200 })?.id).toBe('l1')
  })

  it('ponto dentro do raio de iluminação mas longe do centro não encontra (seleção é pelo centro, não pelo glow inteiro)', () => {
    expect(findLightAt([light], { x: 400, y: 200 })).toBeNull()
  })
})

describe('isPointInPolygon', () => {
  it('ponto claramente dentro do quadrado retorna true', () => {
    expect(isPointInPolygon({ x: 50, y: 50 }, region.points)).toBe(true)
  })

  it('ponto claramente fora do quadrado retorna false', () => {
    expect(isPointInPolygon({ x: 500, y: 500 }, region.points)).toBe(false)
  })
})

describe('findRegionAt', () => {
  it('encontra a região que contém o ponto', () => {
    expect(findRegionAt([region], { x: 50, y: 50 })?.id).toBe('r1')
  })

  it('região degenerada (menos de 3 pontos) nunca é encontrada', () => {
    const degenerate: Region = { id: 'r2', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], tag: '', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} }
    expect(findRegionAt([degenerate], { x: 0, y: 0 })).toBeNull()
  })
})

const freehandDrawing: Drawing = { id: 'd1', kind: 'freehand', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], color: '#fff', width: 4 }
const lineDrawing: Drawing = { id: 'd2', kind: 'line', x1: 0, y1: 50, x2: 100, y2: 50, color: '#fff', width: 4 }
const circleOutline: Drawing = { id: 'd3', kind: 'circle', cx: 200, cy: 200, radius: 50, color: '#fff', width: 4, filled: false, fillAlpha: 0 }
const circleFilled: Drawing = { id: 'd4', kind: 'circle', cx: 300, cy: 300, radius: 50, color: '#fff', width: 4, filled: true, fillAlpha: 0.5 }

describe('findDrawingAt', () => {
  it('encontra freehand perto de um segmento do traço', () => {
    expect(findDrawingAt([freehandDrawing], { x: 50, y: 3 })?.id).toBe('d1')
  })

  it('não encontra freehand longe de qualquer segmento', () => {
    expect(findDrawingAt([freehandDrawing], { x: 50, y: 100 })).toBeNull()
  })

  it('encontra line perto do segmento', () => {
    expect(findDrawingAt([lineDrawing], { x: 50, y: 52 })?.id).toBe('d2')
  })

  it('circle sem fill: só encontra perto do anel, não no centro', () => {
    expect(findDrawingAt([circleOutline], { x: 250, y: 200 })?.id).toBe('d3')
    expect(findDrawingAt([circleOutline], { x: 200, y: 200 })).toBeNull()
  })

  it('circle com fill: encontra em qualquer ponto dentro do raio', () => {
    expect(findDrawingAt([circleFilled], { x: 300, y: 300 })?.id).toBe('d4')
    expect(findDrawingAt([circleFilled], { x: 320, y: 300 })?.id).toBe('d4')
  })

  it('encontra curve perto de um segmento do traço, igual freehand', () => {
    const curveDrawing: Drawing = { id: 'd5', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], color: '#fff', width: 4 }
    expect(findDrawingAt([curveDrawing], { x: 50, y: 3 })?.id).toBe('d5')
  })

  it('encontra text quando o ponto está dentro da caixa estimada', () => {
    const textDrawing: Drawing = { id: 'd6', kind: 'text', x: 100, y: 100, text: 'Sala', color: '#fff', fontSize: 16 }
    expect(findDrawingAt([textDrawing], { x: 110, y: 105 })?.id).toBe('d6')
  })

  it('não encontra text quando o ponto está longe da caixa estimada', () => {
    const textDrawing: Drawing = { id: 'd6', kind: 'text', x: 100, y: 100, text: 'Sala', color: '#fff', fontSize: 16 }
    expect(findDrawingAt([textDrawing], { x: 1000, y: 1000 })).toBeNull()
  })

  // Bug 3 do dossiê F4 ("depois que eu seleciono o retângulo eu não posso
  // mudar nem a posição nem o tamanho") — antes desta fase, rect/ellipse/
  // polygon não tinham hit-test NENHUM (comentário explícito "Fase 1").
  const rectFilled: Drawing = { id: 'r1', kind: 'rect', x: 100, y: 100, w: 50, h: 30, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
  const rectOutline: Drawing = { id: 'r2', kind: 'rect', x: 100, y: 100, w: 50, h: 30, color: '#fff', width: 2, filled: false, fillAlpha: 0.5 }

  it('rect preenchido: encontra em qualquer ponto dentro da área', () => {
    expect(findDrawingAt([rectFilled], { x: 125, y: 115 })?.id).toBe('r1')
  })

  it('rect vazado: encontra perto da borda, não no meio', () => {
    expect(findDrawingAt([rectOutline], { x: 101, y: 110 })?.id).toBe('r2')
    expect(findDrawingAt([rectOutline], { x: 125, y: 115 })).toBeNull()
  })

  it('rect: não encontra longe de qualquer aresta', () => {
    expect(findDrawingAt([rectOutline], { x: 1000, y: 1000 })).toBeNull()
  })

  const ellipseFilled: Drawing = { id: 'e1', kind: 'ellipse', cx: 200, cy: 200, rx: 40, ry: 20, color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
  const ellipseOutline: Drawing = { id: 'e2', kind: 'ellipse', cx: 200, cy: 200, rx: 40, ry: 20, color: '#fff', width: 2, filled: false, fillAlpha: 0.5 }

  it('ellipse preenchida: encontra no centro e dentro do raio', () => {
    expect(findDrawingAt([ellipseFilled], { x: 200, y: 200 })?.id).toBe('e1')
  })

  it('ellipse vazada: encontra perto do contorno, não no centro', () => {
    expect(findDrawingAt([ellipseOutline], { x: 240, y: 200 })?.id).toBe('e2')
    expect(findDrawingAt([ellipseOutline], { x: 200, y: 200 })).toBeNull()
  })

  const polygonFilled: Drawing = {
    id: 'p1', kind: 'polygon', points: [{ x: 300, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 400 }, { x: 300, y: 400 }],
    color: '#fff', width: 2, filled: true, fillAlpha: 0.5,
  }
  const polygonOutline: Drawing = { ...polygonFilled, id: 'p2', filled: false }

  it('polygon preenchido: encontra em qualquer ponto dentro da área', () => {
    expect(findDrawingAt([polygonFilled], { x: 350, y: 350 })?.id).toBe('p1')
  })

  it('polygon vazado: encontra perto de uma aresta, não no meio', () => {
    expect(findDrawingAt([polygonOutline], { x: 301, y: 350 })?.id).toBe('p2')
    expect(findDrawingAt([polygonOutline], { x: 350, y: 350 })).toBeNull()
  })

  it('polygon com menos de 3 pontos: nunca encontrado (mesma guarda de findRegionAt)', () => {
    const degenerate: Drawing = { id: 'p3', kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#fff', width: 2, filled: true, fillAlpha: 0.5 }
    expect(findDrawingAt([degenerate], { x: 0, y: 0 })).toBeNull()
  })
})

describe('estimateTextWidth', () => {
  it('calcula largura proporcional ao número de caracteres e ao tamanho da fonte', () => {
    expect(estimateTextWidth('abcd', 20)).toBe(4 * 20 * 0.55)
  })

  it('texto vazio tem largura zero', () => {
    expect(estimateTextWidth('', 20)).toBe(0)
  })
})

describe('findCurveControlPointAt', () => {
  const points = [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }]

  it('ponto perto de points[1] retorna 1', () => {
    expect(findCurveControlPointAt(points, { x: 52, y: 51 })).toBe(1)
  })

  it('ponto longe de todos retorna null', () => {
    expect(findCurveControlPointAt(points, { x: 500, y: 500 })).toBeNull()
  })
})

describe('findSelectableAt — drawing na cadeia de prioridade', () => {
  it('drawing tem prioridade sobre parede/região, e Linha é arrastável', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    map = { ...map, drawings: [lineDrawing] }
    const hit = findSelectableAt(map, { x: 50, y: 52 })
    expect(hit).toEqual({ kind: 'drawing', id: 'd2', draggable: true })
  })

  // Agente B3 (dossiê F4, bug3, prioridade 4: "mover circle/text/freehand").
  // Antes desta fase só 'line' vinha com draggable:true — qualquer outro kind
  // agora também é (mapFactory.moveDrawing cobre os 7 kinds, ver CONTRATO).
  it('circle também é arrastável (não só line)', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = { ...map, drawings: [circleFilled] }
    const hit = findSelectableAt(map, { x: 300, y: 300 })
    expect(hit).toEqual({ kind: 'drawing', id: 'd4', draggable: true })
  })

  it('luz tem prioridade sobre drawing quando ambos no mesmo ponto', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addLight(map, { id: 'l1', x: 50, y: 52, radius: 300, color: '#fff', intensity: 1 })
    map = { ...map, drawings: [lineDrawing] }
    const hit = findSelectableAt(map, { x: 50, y: 52 })
    expect(hit).toEqual({ kind: 'light', id: 'l1', draggable: false })
  })
})

describe('findSelectableAt (cadeia de prioridade)', () => {
  it('token tem prioridade sobre tudo (marcável e arrastável)', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addWall(map, wall)
    map = addToken(map, { id: 't1', characterId: null, name: 'Herói', x: 50, y: 3, size: 1, image: null })
    const hit = findSelectableAt(map, { x: 50, y: 3 })
    expect(hit).toEqual({ kind: 'token', id: 't1', draggable: true })
  })

  it('prop tem prioridade sobre luz/parede/região (marcável e arrastável)', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    map = addProp(map, { id: 'p1', src: '/a.png', x: 50, y: 50, width: 20, height: 20, linkedMapPath: null })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'prop', id: 'p1', draggable: true })
  })

  it('luz tem prioridade sobre parede/região, mas não é arrastável', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    map = addLight(map, { id: 'l1', x: 50, y: 50, radius: 300, color: '#fff', intensity: 1 })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'light', id: 'l1', draggable: false })
  })

  it('parede tem prioridade sobre região, mas não é arrastável', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    map = addWall(map, { id: 'w2', x1: 0, y1: 50, x2: 100, y2: 50, blocksLight: true, blocksMove: true, door: null })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'wall', id: 'w2', draggable: false })
  })

  it('token tem prioridade sobre prop quando ambos estão no mesmo ponto', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addProp(map, { id: 'p1', src: '/a.png', x: 50, y: 50, width: 20, height: 20, linkedMapPath: null })
    map = addToken(map, { id: 't1', characterId: null, name: 'Herói', x: 50, y: 50, size: 1, image: null })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'token', id: 't1', draggable: true })
  })

  it('prop tem prioridade sobre luz quando ambas estão no mesmo ponto', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addLight(map, { id: 'l1', x: 50, y: 50, radius: 300, color: '#fff', intensity: 1 })
    map = addProp(map, { id: 'p1', src: '/a.png', x: 50, y: 50, width: 20, height: 20, linkedMapPath: null })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'prop', id: 'p1', draggable: true })
  })

  it('luz tem prioridade sobre parede quando ambas estão no mesmo ponto', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addWall(map, { id: 'w2', x1: 0, y1: 50, x2: 100, y2: 50, blocksLight: true, blocksMove: true, door: null })
    map = addLight(map, { id: 'l1', x: 50, y: 50, radius: 300, color: '#fff', intensity: 1 })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'light', id: 'l1', draggable: false })
  })

  it('token tem prioridade sobre luz e região quando todos estão no mesmo ponto', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    map = addLight(map, { id: 'l1', x: 50, y: 50, radius: 300, color: '#fff', intensity: 1 })
    map = addToken(map, { id: 't1', characterId: null, name: 'Herói', x: 50, y: 50, size: 1, image: null })
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'token', id: 't1', draggable: true })
  })

  it('região é encontrada quando não há nada mais específico no ponto, e não é arrastável', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addRegion(map, region)
    const hit = findSelectableAt(map, { x: 50, y: 50 })
    expect(hit).toEqual({ kind: 'region', id: 'r1', draggable: false })
  })

  it('retorna null quando nada está no ponto', () => {
    const map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    expect(findSelectableAt(map, { x: 9999, y: 9999 })).toBeNull()
  })
})

describe('findNearestExistingVertex', () => {
  it('acha o vertice mais proximo dentre varios candidatos espalhados (ponta de wall, vertice de region, ponta de line, ponto de curve), dentro da tolerancia', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addWall(map, { id: 'w1', x1: 500, y1: 500, x2: 600, y2: 500, blocksLight: true, blocksMove: true, door: null })
    map = addRegion(map, { id: 'r1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], tag: '', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} })
    map = addDrawing(map, { id: 'd1', kind: 'line', x1: 300, y1: 300, x2: 400, y2: 300, color: '#fff', width: 4 })
    map = addDrawing(map, { id: 'd2', kind: 'curve', points: [{ x: 200, y: 200 }, { x: 250, y: 250 }], color: '#fff', width: 4 })

    // Ponto perto de { x: 100, y: 100 } (vertice da region) — o mais proximo
    // dentre TODOS os candidatos acima, os outros estao bem mais longe.
    expect(findNearestExistingVertex(map, { x: 105, y: 103 })).toEqual({ x: 100, y: 100 })
  })

  it('retorna null quando todos os candidatos estao mais longe que a tolerancia', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addWall(map, { id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null })
    map = addRegion(map, { id: 'r1', points: [{ x: 500, y: 500 }, { x: 600, y: 500 }, { x: 600, y: 600 }] , tag: '', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} })

    expect(findNearestExistingVertex(map, { x: 250, y: 250 })).toBeNull()
  })

  it('respeita a tolerancia custom passada como terceiro argumento', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addWall(map, { id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null })

    // A 20px de (0,0): fora da tolerancia default (12), dentro de uma maior (25).
    expect(findNearestExistingVertex(map, { x: 20, y: 0 })).toBeNull()
    expect(findNearestExistingVertex(map, { x: 20, y: 0 }, 25)).toEqual({ x: 0, y: 0 })
  })

  it('ignora pontos de drawing freehand (sem vertice estrutural pra conectar)', () => {
    let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
    map = addDrawing(map, { id: 'd1', kind: 'freehand', points: [{ x: 10, y: 10 }, { x: 20, y: 20 }], color: '#fff', width: 4 })

    expect(findNearestExistingVertex(map, { x: 10, y: 10 })).toBeNull()
  })

  // Bug G4 (dossiê F4): "não consigo fechar as paredes externas quando eu
  // puxo para ficar mais perto" — duas paredes de canto que ficam com uma
  // folga visível mesmo quando arrastadas bem próximas uma da outra.
  describe('excludeWallId — arrastar ponta de wall existente sem grudar na própria outra ponta', () => {
    it('sem excludeWallId, a propria outra ponta da wall arrastada pode vencer como candidata mais proxima', () => {
      let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
      // w1 é a wall sendo arrastada: ponta livre em (0,0), outra ponta em (5,5) — bem perto do ponto de arrasto.
      map = addWall(map, { id: 'w1', x1: 0, y1: 0, x2: 5, y2: 5, blocksLight: true, blocksMove: true, door: null })
      // w2 é a wall vizinha que o usuário está tentando alcançar, no canto (0,0).
      map = addWall(map, { id: 'w2', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null })

      // Ponto de arrasto perto de (0,0) — mas (5,5), a outra ponta da própria w1, também está dentro da tolerância e é candidata.
      expect(findNearestExistingVertex(map, { x: 3, y: 3 })).toEqual({ x: 5, y: 5 })
    })

    it('com excludeWallId da wall em arrasto, a own-ponta some da varredura e o vertice da wall vizinha vence', () => {
      let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
      map = addWall(map, { id: 'w1', x1: 0, y1: 0, x2: 5, y2: 5, blocksLight: true, blocksMove: true, door: null })
      map = addWall(map, { id: 'w2', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null })

      expect(findNearestExistingVertex(map, { x: 3, y: 3 }, 12, 'w1')).toEqual({ x: 0, y: 0 })
    })

    it('exclusao nao afeta candidatos de outras walls quando o id nao bate com nenhuma', () => {
      let map: MapData = createEmptyMap('m', 'x', 10, 10, 64)
      map = addWall(map, { id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null })

      expect(findNearestExistingVertex(map, { x: 2, y: 1 }, 12, 'wall-que-nao-existe')).toEqual({ x: 0, y: 0 })
    })
  })
})
