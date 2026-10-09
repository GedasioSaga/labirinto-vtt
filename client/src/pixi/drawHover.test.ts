import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawHover, resolveHoverGeometry } from './drawHover'
import { createEmptyMap, addWall, addToken, addProp, addRegion, addLight, addStair, addDrawing } from '../lib/mapFactory'
import type { Drawing, Light, Prop, Region, Stair, Token, Wall } from '../types/map'
import type { HoverTarget } from '../lib/hoverHitTest'

const baseMap = createEmptyMap('m1', 'Mapa', 1000, 1000, 50)

function buildToken(id: string, overrides: Partial<Token> = {}): Token {
  return { id, characterId: null, name: 'Herói', x: 50, y: 50, size: 1, image: null, ...overrides }
}

function buildProp(id: string): Prop {
  return { id, src: 'x.png', x: 100, y: 100, width: 40, height: 40, linkedMapPath: null }
}

function buildWall(id: string): Wall {
  return { id, x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null }
}

function buildRegion(id: string): Region {
  return {
    id,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
    tag: '',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
  }
}

function buildLight(id: string): Light {
  return { id, x: 10, y: 20, radius: 60, color: '#ffaa33', intensity: 0.8 }
}

function buildStair(id: string): Stair {
  return { id, shape: 'straight', direction: 'up', segments: [{ x1: 0, y1: 0, x2: 50, y2: 0 }], stepWidth: 50 }
}

describe('resolveHoverGeometry — geometria pura por SelectionKind (sem PixiJS)', () => {
  it('token: círculo no centro, raio = meio-lado da tokenBoundingBox', () => {
    const map = addToken(baseMap, buildToken('t1'))
    const target: HoverTarget = { kind: 'token', id: 't1' }
    expect(resolveHoverGeometry(map, target)).toEqual({ shape: 'circle', cx: 50, cy: 50, radius: 25 })
  })

  it('MAPA DE CONTINENTE: ficha-pino contorna a área do pino (tamanho de tela), não o disco que não está desenhado', () => {
    const map = addToken(baseMap, buildToken('t1'))
    const target: HoverTarget = { kind: 'token', id: 't1' }
    // Zoom 2: a área do pino (48 x 78 px de tela, `AREA_DE_TOQUE`) vira 24 x 39 de mundo.
    expect(resolveHoverGeometry(map, target, { ids: new Set(['t1']), cameraScale: 2 })).toEqual({ shape: 'rect', x: 50 - 12, y: 50 - 26, w: 24, h: 39 })
    // Ficha que não é pino na mesma cena: o disco de sempre.
    expect(resolveHoverGeometry(map, target, { ids: new Set(['outra']), cameraScale: 2 })).toEqual({ shape: 'circle', cx: 50, cy: 50, radius: 25 })
  })

  it('prop: retângulo = propBoundingBox', () => {
    const map = addProp(baseMap, buildProp('p1'))
    const target: HoverTarget = { kind: 'prop', id: 'p1' }
    expect(resolveHoverGeometry(map, target)).toEqual({ shape: 'rect', x: 80, y: 80, w: 40, h: 40 })
  })

  it('light: círculo pequeno no CENTRO da luz (LIGHT_HIT_RADIUS), não o raio de alcance', () => {
    const map = addLight(baseMap, buildLight('l1'))
    const target: HoverTarget = { kind: 'light', id: 'l1' }
    expect(resolveHoverGeometry(map, target)).toEqual({ shape: 'circle', cx: 10, cy: 20, radius: 14 })
  })

  it('wall: 1 segmento com as 2 pontas exatas', () => {
    const map = addWall(baseMap, buildWall('w1'))
    const target: HoverTarget = { kind: 'wall', id: 'w1' }
    expect(resolveHoverGeometry(map, target)).toEqual({
      shape: 'segments',
      segments: [{ a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }],
    })
  })

  it('stair: 1 segmento por StairSegment do lance (aqui só 1, shape straight)', () => {
    const map = addStair(baseMap, buildStair('s1'))
    const target: HoverTarget = { kind: 'stair', id: 's1' }
    expect(resolveHoverGeometry(map, target)).toEqual({
      shape: 'segments',
      segments: [{ a: { x: 0, y: 0 }, b: { x: 50, y: 0 } }],
    })
  })

  it('region: polígono com os pontos exatos da Região', () => {
    const map = addRegion(baseMap, buildRegion('r1'))
    const target: HoverTarget = { kind: 'region', id: 'r1' }
    expect(resolveHoverGeometry(map, target)).toEqual({
      shape: 'polygon',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
    })
  })

  it('drawing rect: retângulo x/y/w/h exatos', () => {
    const drawing: Drawing = { id: 'd1', kind: 'rect', x: 5, y: 6, w: 20, h: 10, color: '#fff', width: 2, filled: false, fillAlpha: 1 }
    const map = addDrawing(baseMap, drawing)
    expect(resolveHoverGeometry(map, { kind: 'drawing', id: 'd1' })).toEqual({ shape: 'rect', x: 5, y: 6, w: 20, h: 10 })
  })

  it('drawing ellipse: cx/cy/rx/ry exatos', () => {
    const drawing: Drawing = { id: 'd1', kind: 'ellipse', cx: 40, cy: 40, rx: 20, ry: 10, color: '#fff', width: 2, filled: false, fillAlpha: 1 }
    const map = addDrawing(baseMap, drawing)
    expect(resolveHoverGeometry(map, { kind: 'drawing', id: 'd1' })).toEqual({ shape: 'ellipse', cx: 40, cy: 40, rx: 20, ry: 10 })
  })

  it('drawing circle: cx/cy/radius exatos', () => {
    const drawing: Drawing = { id: 'd1', kind: 'circle', cx: 0, cy: 0, radius: 30, color: '#fff', width: 2, filled: false, fillAlpha: 1 }
    const map = addDrawing(baseMap, drawing)
    expect(resolveHoverGeometry(map, { kind: 'drawing', id: 'd1' })).toEqual({ shape: 'circle', cx: 0, cy: 0, radius: 30 })
  })

  it('drawing polygon: pontos exatos', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]
    const drawing: Drawing = { id: 'd1', kind: 'polygon', points, color: '#fff', width: 2, filled: false, fillAlpha: 1 }
    const map = addDrawing(baseMap, drawing)
    expect(resolveHoverGeometry(map, { kind: 'drawing', id: 'd1' })).toEqual({ shape: 'polygon', points })
  })

  it('drawing line: 1 segmento com as 2 pontas', () => {
    const drawing: Drawing = { id: 'd1', kind: 'line', x1: 1, y1: 2, x2: 3, y2: 4, color: '#fff', width: 2 }
    const map = addDrawing(baseMap, drawing)
    expect(resolveHoverGeometry(map, { kind: 'drawing', id: 'd1' })).toEqual({
      shape: 'segments',
      segments: [{ a: { x: 1, y: 2 }, b: { x: 3, y: 4 } }],
    })
  })

  it('drawing freehand: N-1 segmentos consecutivos entre os N pontos', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
    const drawing: Drawing = { id: 'd1', kind: 'freehand', points, color: '#fff', width: 2 }
    const map = addDrawing(baseMap, drawing)
    expect(resolveHoverGeometry(map, { kind: 'drawing', id: 'd1' })).toEqual({
      shape: 'segments',
      segments: [
        { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
        { a: { x: 10, y: 0 }, b: { x: 10, y: 10 } },
      ],
    })
  })

  it('drawing text: caixa via estimateTextWidth, altura = fontSize', () => {
    const drawing: Drawing = { id: 'd1', kind: 'text', x: 0, y: 0, text: 'Oi', color: '#fff', fontSize: 20 }
    const map = addDrawing(baseMap, drawing)
    // estimateTextWidth('Oi', 20) = 2 * 20 * 0.55 = 22
    expect(resolveHoverGeometry(map, { kind: 'drawing', id: 'd1' })).toEqual({ shape: 'rect', x: 0, y: 0, w: 22, h: 20 })
  })

  it('CASO OBRIGATÓRIO (regra 5): entidade referenciada pelo target não existe mais no mapa — null, não lança', () => {
    expect(resolveHoverGeometry(baseMap, { kind: 'token', id: 'fantasma' })).toBeNull()
    expect(resolveHoverGeometry(baseMap, { kind: 'wall', id: 'fantasma' })).toBeNull()
    expect(resolveHoverGeometry(baseMap, { kind: 'drawing', id: 'fantasma' })).toBeNull()
  })

  it('região degenerada (menos de 3 pontos, nunca deveria existir mas geometria não confia): null', () => {
    const map = addRegion(baseMap, { ...buildRegion('r1'), points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] })
    expect(resolveHoverGeometry(map, { kind: 'region', id: 'r1' })).toBeNull()
  })

  it('drawing freehand com 1 ponto só (sem segmento possível): null', () => {
    const drawing: Drawing = { id: 'd1', kind: 'freehand', points: [{ x: 0, y: 0 }], color: '#fff', width: 2 }
    const map = addDrawing(baseMap, drawing)
    expect(resolveHoverGeometry(map, { kind: 'drawing', id: 'd1' })).toBeNull()
  })
})

/** Instruções `action: 'stroke'` de fato empilhadas — mesmo padrão de drawWalls.test.ts/drawEditHandles.test.ts. */
function strokeInstructions(g: Graphics) {
  return g.context.instructions.filter((instruction) => instruction.action === 'stroke')
}

/** Largura do único traço desenhado, em px de MUNDO. */
function strokeWidth(g: Graphics): number {
  const [stroke] = strokeInstructions(g)
  if (stroke?.action !== 'stroke') throw new Error('nenhum traço desenhado')
  return stroke.data.style.width
}

describe('drawHover — integração com Graphics real (regra 5: executa de verdade, não só typecheck)', () => {
  it('target null: limpa o gráfico e não desenha nada', () => {
    const g = new Graphics()
    drawHover(g, baseMap, null, 1)
    expect(strokeInstructions(g)).toHaveLength(0)
  })

  it('CASO OBRIGATÓRIO (regra 5): target aponta pra entidade que já não existe — limpa e não desenha (não lança)', () => {
    const g = new Graphics()
    expect(() => drawHover(g, baseMap, { kind: 'token', id: 'fantasma' }, 1)).not.toThrow()
    expect(strokeInstructions(g)).toHaveLength(0)
  })

  it('token: 1 stroke, cor/peso/alpha discretos e DIFERENTES de SELECTION_COLOR', () => {
    const map = addToken(baseMap, buildToken('t1'))
    const g = new Graphics()
    drawHover(g, map, { kind: 'token', id: 't1' }, 1)
    const [stroke] = strokeInstructions(g)
    expect(strokeInstructions(g)).toHaveLength(1)
    expect(stroke.action === 'stroke' && stroke.data.style.color).toBe(0x6fc3ff)
    expect(stroke.action === 'stroke' && stroke.data.style.color).not.toBe(0xffdd55) // SELECTION_COLOR — nunca a mesma cor de "já selecionado"
    expect(strokeWidth(g)).toBe(1.5)
    expect(stroke.action === 'stroke' && stroke.data.style.alpha).toBe(0.55)
  })

  it('forma fechada: o contorno tem 1,5 px de TELA em qualquer zoom (largura de mundo = 1,5 / escala)', () => {
    const map = addToken(baseMap, buildToken('t1'))
    for (const scale of [0.1, 0.25, 1, 2, 4]) {
      const g = new Graphics()
      drawHover(g, map, { kind: 'token', id: 't1' }, scale)
      expect(strokeWidth(g) * scale).toBeCloseTo(1.5, 9)
    }
  })

  it('wall (entidade fina): halo mais largo que o contorno de forma fechada — senão fica invisível', () => {
    const map = addWall(baseMap, buildWall('w1'))
    const g = new Graphics()
    drawHover(g, map, { kind: 'wall', id: 'w1' }, 1)
    expect(strokeInstructions(g)).toHaveLength(1)
    expect(strokeWidth(g)).toBe(6)
    expect(strokeWidth(g)).toBeGreaterThan(1.5) // maior que o contorno das formas fechadas
  })

  it('wall: o halo também é de TELA — 6 px a 10% e a 400%, sem virar traço gordo de perto', () => {
    const map = addWall(baseMap, buildWall('w1'))
    for (const scale of [0.1, 0.5, 1, 4]) {
      const g = new Graphics()
      drawHover(g, map, { kind: 'wall', id: 'w1' }, scale)
      expect(strokeWidth(g) * scale).toBeCloseTo(6, 9)
    }
  })

  it('escala inválida (0, NaN) não desenha traço infinito: cai na escala do próprio nó (1 fora da cena)', () => {
    const map = addToken(baseMap, buildToken('t1'))
    for (const scale of [0, Number.NaN, -2]) {
      const g = new Graphics()
      drawHover(g, map, { kind: 'token', id: 't1' }, scale)
      expect(strokeWidth(g)).toBe(1.5)
    }
  })

  it('redesenho: chamar de novo com target diferente troca o contorno, nunca acumula (graphics.clear() no topo)', () => {
    const map = addToken(addWall(baseMap, buildWall('w1')), buildToken('t1'))
    const g = new Graphics()
    drawHover(g, map, { kind: 'wall', id: 'w1' }, 1)
    drawHover(g, map, { kind: 'token', id: 't1' }, 1)
    expect(strokeInstructions(g)).toHaveLength(1)
  })

  it('o mesmo alvo redesenhado depois do zoom troca a espessura, sem acumular traço', () => {
    const map = addToken(baseMap, buildToken('t1'))
    const g = new Graphics()
    drawHover(g, map, { kind: 'token', id: 't1' }, 1)
    drawHover(g, map, { kind: 'token', id: 't1' }, 3)
    expect(strokeInstructions(g)).toHaveLength(1)
    expect(strokeWidth(g)).toBeCloseTo(0.5, 9)
  })

  it('região: 1 stroke fechado (poly)', () => {
    const map = addRegion(baseMap, buildRegion('r1'))
    const g = new Graphics()
    drawHover(g, map, { kind: 'region', id: 'r1' }, 1)
    expect(strokeInstructions(g)).toHaveLength(1)
  })
})
