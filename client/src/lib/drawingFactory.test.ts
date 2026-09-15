import { describe, expect, it } from 'vitest'
import type { Point } from '../pixi/world'
import {
  isValidWallDraft,
  buildWallFromDraft,
  buildLightAt,
  buildRegionFromPoints,
  isValidRoomDraft,
  buildRoomFromDraft,
  isValidRegularPolygonDraft,
  buildRegularPolygonRoomFromDraft,
  DEFAULT_ROOM_NAME,
  isValidFreehandDraft,
  buildFreehandDrawing,
  isValidLineDraft,
  buildLineDrawing,
  isValidCircleDraft,
  buildCircleDrawing,
  isValidCurveDraft,
  buildCurveDrawing,
  convertLineToCurve,
  convertCurveToLine,
  isValidTextDraft,
  buildTextDrawing,
} from './drawingFactory'

describe('isValidWallDraft', () => {
  it('mesmo ponto de início e fim é inválido (clique sem arrastar)', () => {
    expect(isValidWallDraft({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(false)
  })

  it('pontos diferentes é válido', () => {
    expect(isValidWallDraft({ x: 0, y: 0 }, { x: 64, y: 0 })).toBe(true)
  })
})

describe('buildWallFromDraft', () => {
  it('cria parede sólida (bloqueia luz e movimento, sem porta) com o id dado', () => {
    const wall = buildWallFromDraft('w1', { x: 0, y: 0 }, { x: 64, y: 0 })
    expect(wall).toEqual({
      id: 'w1',
      x1: 0,
      y1: 0,
      x2: 64,
      y2: 0,
      blocksLight: true,
      blocksMove: true,
      door: null,
    })
  })
})

describe('buildLightAt', () => {
  it('cria luz com raio de 4 células (luz plena da tocha, 20 ft) e defaults de tocha', () => {
    const light = buildLightAt('l1', { x: 32, y: 32 }, 64)
    expect(light).toEqual({
      id: 'l1',
      x: 32,
      y: 32,
      radius: 256,
      color: '#ffaa33',
      intensity: 0.8,
    })
  })

  it('raio escala com o tamanho do grid (4 × grid)', () => {
    expect(buildLightAt('l2', { x: 0, y: 0 }, 32).radius).toBe(128)
    expect(buildLightAt('l3', { x: 0, y: 0 }, 128).radius).toBe(512)
  })

  it('arrasto (radiusOverride) ignora o padrão de 4 células', () => {
    expect(buildLightAt('l4', { x: 0, y: 0 }, 64, 700).radius).toBe(700)
  })
})

describe('buildRegionFromPoints', () => {
  it('cria região com tag, cor e padrão de preenchimento default', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r1', points)
    expect(region).toEqual({ id: 'r1', points, tag: 'region', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} })
  })

  it('aceita tag customizada', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r2', points, 'trap')
    expect(region.tag).toBe('trap')
  })

  it('aceita cor customizada', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r3', points, 'trap', '#00ff00')
    expect(region.fillColor).toBe('#00ff00')
  })

  it('aceita padrão de preenchimento customizado', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r4', points, 'trap', '#00ff00', 'hatch')
    expect(region.fillPattern).toBe('hatch')
  })

  it('sem passar fillPattern, default é solid', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]
    const region = buildRegionFromPoints('r5', points, 'trap', '#00ff00')
    expect(region.fillPattern).toBe('solid')
  })
})

describe('isValidRoomDraft', () => {
  it('retângulo normal (largura e altura diferentes de zero) é válido', () => {
    expect(isValidRoomDraft({ x: 0, y: 0 }, { x: 100, y: 50 })).toBe(true)
  })

  it('largura zero é inválido', () => {
    expect(isValidRoomDraft({ x: 10, y: 0 }, { x: 10, y: 50 })).toBe(false)
  })

  it('altura zero é inválido', () => {
    expect(isValidRoomDraft({ x: 0, y: 20 }, { x: 100, y: 20 })).toBe(false)
  })
})

describe('buildRoomFromDraft', () => {
  const wallIds: [string, string, string, string] = ['wt', 'wr', 'wb', 'wl']

  it('normaliza o drag canto-a-canto (start embaixo-direita, end em cima-esquerda) pro retângulo padrão', () => {
    const { region } = buildRoomFromDraft('r1', wallIds, { x: 100, y: 100 }, { x: 0, y: 0 })

    expect(region.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ])
  })

  it('drag em qualquer uma das 4 direções sempre normaliza pro mesmo resultado', () => {
    const corners: [Point, Point][] = [
      [{ x: 0, y: 0 }, { x: 100, y: 100 }], // cima-esquerda -> baixo-direita
      [{ x: 100, y: 100 }, { x: 0, y: 0 }], // baixo-direita -> cima-esquerda
      [{ x: 0, y: 100 }, { x: 100, y: 0 }], // baixo-esquerda -> cima-direita
      [{ x: 100, y: 0 }, { x: 0, y: 100 }], // cima-direita -> baixo-esquerda
    ]

    const results = corners.map(([start, end]) => buildRoomFromDraft('r1', wallIds, start, end))

    for (const { region } of results) {
      expect(region.points).toEqual([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ])
    }
  })

  it('as 4 paredes usam os wallIds dados, na ordem topo/direita/baixo/esquerda, vinculadas à região', () => {
    const { region, walls } = buildRoomFromDraft('r1', wallIds, { x: 0, y: 0 }, { x: 100, y: 100 })

    expect(walls).toHaveLength(4)
    expect(walls[0]).toMatchObject({ id: 'wt', regionId: region.id, regionEdgeIndex: 0, x1: 0, y1: 0, x2: 100, y2: 0 })
    expect(walls[1]).toMatchObject({ id: 'wr', regionId: region.id, regionEdgeIndex: 1, x1: 100, y1: 0, x2: 100, y2: 100 })
    expect(walls[2]).toMatchObject({ id: 'wb', regionId: region.id, regionEdgeIndex: 2, x1: 100, y1: 100, x2: 0, y2: 100 })
    expect(walls[3]).toMatchObject({ id: 'wl', regionId: region.id, regionEdgeIndex: 3, x1: 0, y1: 100, x2: 0, y2: 0 })
    for (const wall of walls) {
      expect(wall.blocksLight).toBe(true)
      expect(wall.blocksMove).toBe(true)
      expect(wall.door).toBeNull()
    }
  })

  it('usa fillColor/fillPattern default quando não fornecidos', () => {
    const { region } = buildRoomFromDraft('r1', wallIds, { x: 0, y: 0 }, { x: 100, y: 100 })
    expect(region.fillColor).toBe('#3a7ad0')
    expect(region.fillPattern).toBe('solid')
  })

  it('aceita fillColor/fillPattern customizados', () => {
    const { region } = buildRoomFromDraft('r1', wallIds, { x: 0, y: 0 }, { x: 100, y: 100 }, '#00ff00', 'hatch')
    expect(region.fillColor).toBe('#00ff00')
    expect(region.fillPattern).toBe('hatch')
  })

  // D1 (ROADMAP.md): esta é a asserção que fecha a dívida — sem ela, a região
  // criada aqui fica indistinguível de uma Região comum e RoomControls nunca
  // aparece na prática (a mesma regressão que motivou a tarefa).
  it('seta region.room com shape "rect" e nome padrão "Sala"', () => {
    const { region } = buildRoomFromDraft('r1', wallIds, { x: 0, y: 0 }, { x: 100, y: 100 })
    expect(region.room).toEqual({ shape: 'rect', name: DEFAULT_ROOM_NAME })
  })

  it('aceita nome customizado', () => {
    const { region } = buildRoomFromDraft('r1', wallIds, { x: 0, y: 0 }, { x: 100, y: 100 }, '#3a7ad0', 'solid', 'Salão do Trono')
    expect(region.room).toEqual({ shape: 'rect', name: 'Salão do Trono' })
  })
})

describe('isValidRegularPolygonDraft', () => {
  it('raio zero (clique sem arrastar) é inválido', () => {
    expect(isValidRegularPolygonDraft({ x: 50, y: 50 }, { x: 50, y: 50 })).toBe(false)
  })

  it('raio bem pequeno (jitter de sub-pixel) é inválido', () => {
    expect(isValidRegularPolygonDraft({ x: 50, y: 50 }, { x: 50.3, y: 50 })).toBe(false)
  })

  it('raio positivo além do mínimo é válido', () => {
    expect(isValidRegularPolygonDraft({ x: 50, y: 50 }, { x: 150, y: 50 })).toBe(true)
  })
})

describe('buildRegularPolygonRoomFromDraft', () => {
  function expectPointClose(actual: { x: number; y: number }, expected: { x: number; y: number }) {
    expect(actual.x).toBeCloseTo(expected.x, 5)
    expect(actual.y).toBeCloseTo(expected.y, 5)
  }

  it('sides=3 (triângulo): gera 3 pontos, o primeiro sob radiusPoint, e 3 paredes vinculadas', () => {
    const wallIds = ['w0', 'w1', 'w2']
    const center = { x: 0, y: 0 }
    const radiusPoint = { x: 100, y: 0 }
    const { region, walls } = buildRegularPolygonRoomFromDraft('r1', wallIds, center, radiusPoint, 3)

    expect(region.points).toHaveLength(3)
    expectPointClose(region.points[0], { x: 100, y: 0 })
    expectPointClose(region.points[1], { x: -50, y: 86.602540 })
    expectPointClose(region.points[2], { x: -50, y: -86.602540 })

    expect(walls).toHaveLength(3)
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex += 1) {
      const wall = walls[edgeIndex]
      const from = region.points[edgeIndex]
      const to = region.points[(edgeIndex + 1) % 3]
      expect(wall.id).toBe(wallIds[edgeIndex])
      expect(wall.regionId).toBe(region.id)
      expect(wall.regionEdgeIndex).toBe(edgeIndex)
      expectPointClose({ x: wall.x1, y: wall.y1 }, from)
      expectPointClose({ x: wall.x2, y: wall.y2 }, to)
      expect(wall.blocksLight).toBe(true)
      expect(wall.blocksMove).toBe(true)
      expect(wall.door).toBeNull()
    }
  })

  it('sides=6 (hexágono): gera 6 pontos e 6 paredes, todas com regionEdgeIndex 0..5', () => {
    const wallIds = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5']
    const center = { x: 0, y: 0 }
    const radiusPoint = { x: 100, y: 0 }
    const { region, walls } = buildRegularPolygonRoomFromDraft('r2', wallIds, center, radiusPoint, 6)

    expect(region.points).toHaveLength(6)
    expectPointClose(region.points[0], { x: 100, y: 0 })
    expectPointClose(region.points[1], { x: 50, y: 86.602540 })
    expectPointClose(region.points[2], { x: -50, y: 86.602540 })
    expectPointClose(region.points[3], { x: -100, y: 0 })
    expectPointClose(region.points[4], { x: -50, y: -86.602540 })
    expectPointClose(region.points[5], { x: 50, y: -86.602540 })

    expect(walls).toHaveLength(6)
    expect(walls.map((w) => w.regionEdgeIndex).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 1, 2, 3, 4, 5])
    for (const wall of walls) {
      expect(wall.regionId).toBe(region.id)
      expect(wall.door).toBeNull()
    }
  })

  it('usa fillColor/fillPattern default quando não fornecidos', () => {
    const { region } = buildRegularPolygonRoomFromDraft('r3', ['w0', 'w1', 'w2'], { x: 0, y: 0 }, { x: 10, y: 0 }, 3)
    expect(region.fillColor).toBe('#3a7ad0')
    expect(region.fillPattern).toBe('solid')
  })

  it('aceita fillColor/fillPattern customizados', () => {
    const { region } = buildRegularPolygonRoomFromDraft(
      'r4', ['w0', 'w1', 'w2'], { x: 0, y: 0 }, { x: 10, y: 0 }, 3, '#00ff00', 'hatch',
    )
    expect(region.fillColor).toBe('#00ff00')
    expect(region.fillPattern).toBe('hatch')
  })

  // D1 (ROADMAP.md): mesma dívida de buildRoomFromDraft, mas aqui shape é
  // 'polygon' — é essa distinção que faz o PixiCanvas manter o arrasto de
  // vértice/ponto médio livre (em vez de resize por canto) pra Sala
  // Circular/Polígono Regular.
  it('seta region.room com shape "polygon" e nome padrão "Sala"', () => {
    const { region } = buildRegularPolygonRoomFromDraft('r5', ['w0', 'w1', 'w2'], { x: 0, y: 0 }, { x: 10, y: 0 }, 3)
    expect(region.room).toEqual({ shape: 'polygon', name: DEFAULT_ROOM_NAME })
  })

  it('aceita nome customizado', () => {
    const { region } = buildRegularPolygonRoomFromDraft(
      'r6', ['w0', 'w1', 'w2'], { x: 0, y: 0 }, { x: 10, y: 0 }, 3, '#3a7ad0', 'solid', 'Torre Circular',
    )
    expect(region.room).toEqual({ shape: 'polygon', name: 'Torre Circular' })
  })
})

describe('isValidFreehandDraft', () => {
  it('menos de 2 pontos é inválido', () => {
    expect(isValidFreehandDraft([{ x: 0, y: 0 }])).toBe(false)
  })
  it('2+ pontos é válido', () => {
    expect(isValidFreehandDraft([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(true)
  })
})

describe('buildFreehandDrawing', () => {
  it('cria desenho freehand com os pontos, cor e espessura dados', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
    expect(buildFreehandDrawing('d1', points, '#ff0000', 6)).toEqual({
      id: 'd1', kind: 'freehand', points, color: '#ff0000', width: 6,
    })
  })

  // Caso 2 obrigatório (regra 5): 5º argumento (cap) AUSENTE, sem valor
  // nenhum passado — precisa continuar sem a chave `cap` no objeto, não com
  // `cap: undefined` escondido por trás de toEqual.
  it('sem 5º argumento, o objeto não ganha chave cap nenhuma', () => {
    const drawing = buildFreehandDrawing('d1b', [{ x: 0, y: 0 }, { x: 1, y: 1 }], '#ff0000', 6)
    expect('cap' in drawing).toBe(false)
  })

  it('bug B2: aceita cap explícito (ponta reta)', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
    const drawing = buildFreehandDrawing('d1c', points, '#ff0000', 6, 'butt')
    expect(drawing).toMatchObject({ cap: 'butt' })
  })
})

describe('isValidLineDraft', () => {
  it('mesmo ponto de início e fim é inválido', () => {
    expect(isValidLineDraft({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(false)
  })
  it('pontos diferentes é válido', () => {
    expect(isValidLineDraft({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true)
  })
})

describe('buildLineDrawing', () => {
  it('cria desenho line com extremos, cor e espessura dados', () => {
    expect(buildLineDrawing('d2', { x: 0, y: 0 }, { x: 10, y: 20 }, '#00ff00', 3)).toEqual({
      id: 'd2', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 20, color: '#00ff00', width: 3,
    })
  })

  // Caso 2 obrigatório (regra 5): campo opcional ausente — bate com o veredito
  // do dossiê (bug2 linha-curva, item A): `undefined` tem que continuar
  // desenhando arredondado, então nem precisa existir a chave.
  it('sem cap, o objeto não ganha chave cap nenhuma (undefined === round na renderização)', () => {
    const drawing = buildLineDrawing('d2b', { x: 0, y: 0 }, { x: 10, y: 20 }, '#00ff00', 3)
    expect('cap' in drawing).toBe(false)
  })

  it('bug B2: aceita cap explícito (ponta reta pedida pelo usuário)', () => {
    const drawing = buildLineDrawing('d2c', { x: 0, y: 0 }, { x: 10, y: 20 }, '#00ff00', 3, 'butt')
    expect(drawing).toMatchObject({ cap: 'butt' })
  })
})

describe('isValidCircleDraft', () => {
  it('raio zero ou negativo é inválido', () => {
    expect(isValidCircleDraft(0)).toBe(false)
    expect(isValidCircleDraft(-5)).toBe(false)
  })
  it('raio positivo é válido', () => {
    expect(isValidCircleDraft(10)).toBe(true)
  })
})

describe('buildCircleDrawing', () => {
  it('cria desenho circle com centro, raio, cor, espessura e filled dados', () => {
    expect(buildCircleDrawing('d3', { x: 50, y: 50 }, 30, '#0000ff', 2, true)).toEqual({
      id: 'd3', kind: 'circle', cx: 50, cy: 50, radius: 30, color: '#0000ff', width: 2, filled: true, fillAlpha: 0.5,
    })
  })
})

describe('isValidCurveDraft', () => {
  it('menos de 2 pontos é inválido', () => {
    expect(isValidCurveDraft([{ x: 0, y: 0 }])).toBe(false)
  })
  it('2+ pontos é válido', () => {
    expect(isValidCurveDraft([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(true)
  })
})

describe('buildCurveDrawing', () => {
  it('cria desenho curve com os pontos simplificados, cor e espessura dados', () => {
    const rawPoints = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 30, y: 0 }]
    expect(buildCurveDrawing('d4', rawPoints, '#123456', 5)).toEqual({
      id: 'd4', kind: 'curve', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], color: '#123456', width: 5,
    })
  })

  it('sem cap, o objeto não ganha chave cap nenhuma', () => {
    const drawing = buildCurveDrawing('d4b', [{ x: 0, y: 0 }, { x: 1, y: 1 }], '#123456', 5)
    expect('cap' in drawing).toBe(false)
  })

  it('bug B2: aceita cap explícito', () => {
    const drawing = buildCurveDrawing('d4c', [{ x: 0, y: 0 }, { x: 1, y: 1 }], '#123456', 5, 'square')
    expect(drawing).toMatchObject({ cap: 'square' })
  })
})

describe('convertLineToCurve (bug B2, leitura B: "dobrar" a linha)', () => {
  it('converte line em curve preservando id/color/width, extremos viram os 2 pontos de controle', () => {
    const line = buildLineDrawing('d5', { x: 0, y: 0 }, { x: 100, y: 50 }, '#ff00ff', 4)
    const curve = convertLineToCurve(line)
    expect(curve).toEqual({
      id: 'd5',
      kind: 'curve',
      points: [{ x: 0, y: 0 }, { x: 100, y: 50 }],
      color: '#ff00ff',
      width: 4,
    })
  })

  it('preserva cap quando a line tinha cap explícito', () => {
    const line = buildLineDrawing('d6', { x: 0, y: 0 }, { x: 10, y: 0 }, '#000000', 2, 'butt')
    const curve = convertLineToCurve(line)
    expect(curve).toMatchObject({ kind: 'curve', cap: 'butt' })
  })

  // Caso 2 obrigatório (regra 5): campo opcional (cap) AUSENTE na line de
  // entrada — sem `?`, sem valor — não pode virar `cap: undefined` nem
  // quebrar; a curva resultante simplesmente não ganha a chave.
  it('line sem cap (campo opcional ausente) produz curve sem chave cap', () => {
    const line = buildLineDrawing('d7', { x: 0, y: 0 }, { x: 10, y: 0 }, '#000000', 2)
    const curve = convertLineToCurve(line)
    expect('cap' in curve).toBe(false)
  })

  it('drawing que não é line volta INALTERADO (mesma referência)', () => {
    const circle = buildCircleDrawing('d8', { x: 0, y: 0 }, 10, '#ff0000', 2, false)
    expect(convertLineToCurve(circle)).toBe(circle)
  })
})

describe('convertCurveToLine (sentido inverso, item 2 do CONTRATO)', () => {
  it('converte curve de 2 pontos em line preservando id/color/width, pontos viram os extremos', () => {
    const line = buildLineDrawing('d9', { x: 0, y: 0 }, { x: 100, y: 50 }, '#ff00ff', 4)
    const curve = convertLineToCurve(line)
    const backToLine = convertCurveToLine(curve)
    expect(backToLine).toEqual({
      id: 'd9', kind: 'line', x1: 0, y1: 0, x2: 100, y2: 50, color: '#ff00ff', width: 4,
    })
  })

  it('preserva cap quando a curve tinha cap explícito', () => {
    const curve = buildCurveDrawing('d10', [{ x: 0, y: 0 }, { x: 10, y: 0 }], '#000000', 2, 'square')
    const line = convertCurveToLine(curve)
    expect(line).toMatchObject({ kind: 'line', cap: 'square' })
  })

  // Caso 2 obrigatório (regra 5): campo opcional (cap) AUSENTE na curve de
  // entrada — a line resultante não pode ganhar `cap: undefined` como chave.
  it('curve sem cap (campo opcional ausente) produz line sem chave cap', () => {
    const curve = buildCurveDrawing('d11', [{ x: 0, y: 0 }, { x: 10, y: 0 }], '#000000', 2)
    const line = convertCurveToLine(curve)
    expect('cap' in line).toBe(false)
  })

  // Regra dura do CONTRATO: NUNCA descartar ponto de controle em silêncio.
  // Uma curve com 3+ pontos (usuário já inseriu midpoint pelo menos uma vez)
  // não pode virar line perdendo os pontos do meio — a função recusa e
  // devolve a MESMA referência, igual ao no-op de convertLineToCurve.
  it('curve com 3+ pontos de controle é INALTERADA (mesma referência) — não descarta ponto em silêncio', () => {
    // Pontos espaçados >= minDistance (24, curveMath.ts) para sobreviverem a
    // simplifyToControlPoints dentro de buildCurveDrawing — sem isso os
    // intermediários seriam descartados na CONSTRUÇÃO da curve, não no teste.
    const curve = buildCurveDrawing('d12', [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 0 }, { x: 90, y: 0 }], '#000000', 2)
    // Narrowing por `kind` (não `as`/`!`): buildCurveDrawing devolve o tipo
    // largo `Drawing`, e só o membro 'curve' da união tem `points`.
    if (curve.kind !== 'curve') throw new Error('buildCurveDrawing deveria retornar kind "curve"')
    expect(curve.points.length).toBeGreaterThan(2)
    expect(convertCurveToLine(curve)).toBe(curve)
  })

  it('drawing que não é curve volta INALTERADO (mesma referência)', () => {
    const circle = buildCircleDrawing('d13', { x: 0, y: 0 }, 10, '#ff0000', 2, false)
    expect(convertCurveToLine(circle)).toBe(circle)
  })
})

describe('isValidTextDraft', () => {
  it('sempre é válido (colocação por clique, sem arrasto)', () => {
    expect(isValidTextDraft()).toBe(true)
  })
})

describe('buildTextDrawing', () => {
  it('cria rótulo de texto com texto default "Rótulo", fontFamily default "Arial" e os campos dados', () => {
    expect(buildTextDrawing('d5', { x: 10, y: 20 }, '#123456', 24)).toEqual({
      id: 'd5', kind: 'text', x: 10, y: 20, text: 'Rótulo', color: '#123456', fontSize: 24, fontFamily: 'Arial',
    })
  })

  it('aceita fontFamily customizada', () => {
    const drawing = buildTextDrawing('d6', { x: 0, y: 0 }, '#000000', 16, 'Georgia')
    expect(drawing).toMatchObject({ fontFamily: 'Georgia' })
  })
})
