import { describe, expect, it } from 'vitest'
import {
  clampScale,
  panBy,
  zoomAt,
  constrainToAngleStep,
  angleDegrees,
  contentBounds,
  fitCamera,
  MIN_SCALE,
  MAX_SCALE,
} from './world'
import type { MapData, Wall, Drawing } from '../types/map'

describe('clampScale', () => {
  it('mantém valor dentro do intervalo', () => {
    expect(clampScale(1)).toBe(1)
  })

  it('trava no mínimo', () => {
    expect(clampScale(0)).toBe(MIN_SCALE)
  })

  it('trava no máximo', () => {
    expect(clampScale(999)).toBe(MAX_SCALE)
  })
})

describe('panBy', () => {
  it('desloca x/y e preserva escala', () => {
    const result = panBy({ x: 10, y: 10, scale: 2 }, 5, -3)
    expect(result).toEqual({ x: 15, y: 7, scale: 2 })
  })
})

describe('zoomAt', () => {
  it('mantém o ponto do mundo sob o cursor fixo ao aplicar zoom', () => {
    const camera = { x: 0, y: 0, scale: 1 }
    const pointer = { x: 400, y: 300 }

    const worldBefore = {
      x: (pointer.x - camera.x) / camera.scale,
      y: (pointer.y - camera.y) / camera.scale,
    }

    const next = zoomAt(camera, pointer, -100)

    const worldAfter = {
      x: (pointer.x - next.x) / next.scale,
      y: (pointer.y - next.y) / next.scale,
    }

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6)
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6)
  })

  it('wheel negativo (scroll pra cima) aumenta o zoom', () => {
    const next = zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, -100)
    expect(next.scale).toBeGreaterThan(1)
  })

  it('wheel positivo (scroll pra baixo) diminui o zoom', () => {
    const next = zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 100)
    expect(next.scale).toBeLessThan(1)
  })
})

describe('constrainToAngleStep', () => {
  it('~37 graus livre (dx=4,dy=3) com step 45 (default) trava em 45 graus, preservando a distância do start', () => {
    const result = constrainToAngleStep({ x: 0, y: 0 }, { x: 4, y: 3 })
    const expected = 5 * Math.SQRT1_2 // distância 5, ângulo 45°
    expect(result.x).toBeCloseTo(expected, 6)
    expect(result.y).toBeCloseTo(expected, 6)
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(5, 6)
  })

  it('mesmo ~37 graus livre com step 90 explícito: cai no eixo mais próximo (só 4 direções), preservando a distância (diferente da versão antiga, que truncava pro eixo dominante)', () => {
    const result = constrainToAngleStep({ x: 0, y: 0 }, { x: 4, y: 3 }, 90)
    expect(result).toEqual({ x: 5, y: 0 })
  })

  it('step 45: ângulo perto de 90° (dx pequeno, dy grande) trava em 90°, preservando a distância', () => {
    const result = constrainToAngleStep({ x: 0, y: 0 }, { x: 1, y: 10 })
    const distance = Math.hypot(1, 10)
    expect(result.x).toBeCloseTo(0, 6)
    expect(result.y).toBeCloseTo(distance, 6)
  })

  it('exatamente 45 graus (dx === dy): com step 45 o resultado FICA na diagonal — 45° agora é um ângulo travado válido, não é mais forçado pro eixo vertical', () => {
    const result = constrainToAngleStep({ x: 0, y: 0 }, { x: 50, y: 50 })
    expect(result.x).toBeCloseTo(50, 6)
    expect(result.y).toBeCloseTo(50, 6)
  })

  it('funciona com deslocamento negativo (arrasto pra esquerda/cima) — trava em 180°', () => {
    const result = constrainToAngleStep({ x: 200, y: 200 }, { x: 120, y: 210 })
    const distance = Math.hypot(80, 10)
    expect(result.x).toBeCloseTo(200 - distance, 6)
    expect(result.y).toBeCloseTo(200, 6)
  })

  it('start != origem: resultado é relativo ao ponto inicial, não a (0,0)', () => {
    const result = constrainToAngleStep({ x: 500, y: 300 }, { x: 500, y: 450 })
    expect(result.x).toBeCloseTo(500, 6)
    expect(result.y).toBeCloseTo(450, 6)
  })

  it('start === end (arrasto de distância zero): não quebra nem retorna NaN', () => {
    const result = constrainToAngleStep({ x: 10, y: 10 }, { x: 10, y: 10 })
    expect(result.x).toBeCloseTo(10, 6)
    expect(result.y).toBeCloseTo(10, 6)
  })
})

describe('angleDegrees', () => {
  it('0° pra direita, 90° pra baixo, 180° pra esquerda, 270° pra cima — sempre em [0,360)', () => {
    expect(angleDegrees({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0, 6)
    expect(angleDegrees({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90, 6)
    expect(angleDegrees({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(180, 6)
    expect(angleDegrees({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(270, 6)
  })

  it('start != origem: ângulo é relativo ao ponto inicial', () => {
    expect(angleDegrees({ x: 500, y: 300 }, { x: 500, y: 450 })).toBeCloseTo(90, 6)
  })
})

// Reusa lib/mapFactory.ts (createEmptyMap/addWall/...) em vez de montar o
// literal MapData na mão — mesma fonte de verdade que o resto do app usa
// pra criar mapa, então o teste não pode divergir do schema real.
import { createEmptyMap, addWall, addToken, addProp, addStair, addLight, addRegion, addDrawing } from '../lib/mapFactory'

const emptyMap = (): MapData => createEmptyMap('map-1', 'Mapa de teste', 1000, 1000, 50)

const wall = (overrides: Partial<Wall> = {}): Wall => ({
  id: overrides.id ?? 'wall-1',
  x1: 0,
  y1: 0,
  x2: 100,
  y2: 0,
  blocksLight: true,
  blocksMove: true,
  door: null,
  ...overrides,
})

describe('contentBounds', () => {
  it('mapa vazio devolve null — não existe caixa de conteúdo nenhum', () => {
    expect(contentBounds(emptyMap())).toBeNull()
  })

  it('uma parede sozinha vira a bounding box exata dos 2 pontos', () => {
    const map = addWall(emptyMap(), wall({ x1: 10, y1: 20, x2: 110, y2: 220 }))
    expect(contentBounds(map)).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 220 })
  })

  it('combina walls/tokens/props/stairs/lights/regions/drawings na MESMA caixa', () => {
    let map = emptyMap()
    map = addWall(map, wall({ x1: 0, y1: 0, x2: 50, y2: 0 }))
    map = addToken(map, { id: 't1', characterId: null, name: 'Herói', x: 500, y: 500, size: 1, image: null })
    map = addProp(map, { id: 'p1', src: 'x.png', x: 900, y: 100, width: 40, height: 40, linkedMapPath: null })
    map = addStair(map, {
      id: 's1', shape: 'straight', direction: 'up', stepWidth: 50,
      segments: [{ x1: 0, y1: 900, x2: 100, y2: 950 }],
    })
    map = addLight(map, { id: 'l1', x: -200, y: 500, radius: 60, color: '#fff', intensity: 1 })
    map = addRegion(map, {
      id: 'r1', points: [{ x: 300, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 400 }],
      tag: '', fillColor: '#000', fillPattern: 'solid', data: {},
    })

    const bounds = contentBounds(map)
    // minX vem da luz (-200, raio 60 → -260); maxX vem do prop (900 + width/2=20 → 920);
    // minY vem da parede (y=0); maxY vem da escada (segmento até y=950).
    expect(bounds).toEqual({ minX: -260, minY: 0, maxX: 920, maxY: 950 })
  })

  it('conteúdo com coordenada negativa entra na caixa normalmente (min fica negativo)', () => {
    const map = addWall(emptyMap(), wall({ x1: -500, y1: -300, x2: -100, y2: -50 }))
    expect(contentBounds(map)).toEqual({ minX: -500, minY: -300, maxX: -100, maxY: -50 })
  })

  it('um único ponto (luz de raio 0) vira caixa degenerada minX===maxX e minY===maxY, sem quebrar', () => {
    const map = addLight(emptyMap(), { id: 'l1', x: 42, y: 42, radius: 0, color: '#fff', intensity: 1 })
    expect(contentBounds(map)).toEqual({ minX: 42, minY: 42, maxX: 42, maxY: 42 })
  })

  it('todo kind de Drawing entra na caixa (freehand/line/circle/curve/text/rect/ellipse/polygon)', () => {
    const drawings: Drawing[] = [
      { id: 'd1', kind: 'freehand', points: [{ x: 5, y: 5 }, { x: 15, y: 25 }], color: '#000', width: 2 },
      { id: 'd2', kind: 'line', x1: -10, y1: 0, x2: 0, y2: 0, color: '#000', width: 2 },
      { id: 'd3', kind: 'circle', cx: 200, cy: 200, radius: 10, color: '#000', width: 2, filled: false, fillAlpha: 1 },
      { id: 'd4', kind: 'curve', points: [{ x: 0, y: 300 }], color: '#000', width: 2 },
      { id: 'd5', kind: 'text', x: 700, y: 5, text: 'oi', color: '#000', fontSize: 12 },
      { id: 'd6', kind: 'rect', x: 0, y: 0, w: 20, h: 30, color: '#000', width: 2, filled: false, fillAlpha: 1 },
      { id: 'd7', kind: 'ellipse', cx: 0, cy: -400, rx: 5, ry: 5, color: '#000', width: 2, filled: false, fillAlpha: 1 },
      { id: 'd8', kind: 'polygon', points: [{ x: 800, y: 800 }], color: '#000', width: 2, filled: false, fillAlpha: 1 },
    ]
    const map = drawings.reduce((m, d) => addDrawing(m, d), emptyMap())
    const bounds = contentBounds(map)
    expect(bounds).not.toBeNull()
    // minY é puxado pela ellipse (cy=-400, ry=5 → -405); minX pela line (-10);
    // maxX pelo polygon (800); maxY pelo circle (cy=200+radius=10 → 210).
    expect(bounds).toEqual({ minX: -10, minY: -405, maxX: 800, maxY: 800 })
  })

  it('Drawing freehand/curve/polygon com lista de pontos vazia não fabrica ponto (0,0)', () => {
    const map = addDrawing(emptyMap(), { id: 'd1', kind: 'freehand', points: [], color: '#000', width: 2 })
    expect(contentBounds(map)).toBeNull()
  })
})

describe('fitCamera', () => {
  it('centraliza bounds no viewport e mapeia o centro do mundo pro centro da tela', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    const viewport = { width: 800, height: 600 }
    const camera = fitCamera(bounds, viewport, 0)

    const screenCenterX = 50 * camera.scale + camera.x
    const screenCenterY = 50 * camera.scale + camera.y
    expect(screenCenterX).toBeCloseTo(viewport.width / 2, 6)
    expect(screenCenterY).toBeCloseTo(viewport.height / 2, 6)
  })

  it('conteúdo mais LARGO que alto: o eixo largura é quem trava a escala', () => {
    const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 100 }
    const viewport = { width: 800, height: 600 }
    const camera = fitCamera(bounds, viewport, 0)
    expect(camera.scale).toBeCloseTo(800 / 1000, 6)
  })

  it('conteúdo mais ALTO que largo: o eixo altura é quem trava a escala', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 1000 }
    const viewport = { width: 800, height: 600 }
    const camera = fitCamera(bounds, viewport, 0)
    expect(camera.scale).toBeCloseTo(600 / 1000, 6)
  })

  it('respeita a margem: sobra menos espaço disponível, escala menor que sem margem', () => {
    // viewport pequeno o bastante pra nenhuma das duas escalas saturar em
    // MAX_SCALE — senão as duas batem no teto e a comparação vira falso-verde.
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    const viewport = { width: 200, height: 200 }
    const semMargem = fitCamera(bounds, viewport, 0)
    const comMargem = fitCamera(bounds, viewport, 50)
    expect(comMargem.scale).toBeLessThan(semMargem.scale)
  })

  it('viewport muito pequeno (menor que a margem): trava em MIN_SCALE, sem NaN/Infinity', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    const viewport = { width: 10, height: 10 }
    const camera = fitCamera(bounds, viewport, 50)
    expect(camera.scale).toBe(MIN_SCALE)
    expect(Number.isFinite(camera.x)).toBe(true)
    expect(Number.isFinite(camera.y)).toBe(true)
  })

  it('bounds de área zero (parede perfeitamente horizontal, altura 0): não estoura em NaN/Infinity', () => {
    const bounds = { minX: 0, minY: 50, maxX: 500, maxY: 50 } // altura 0
    const viewport = { width: 800, height: 600 }
    const camera = fitCamera(bounds, viewport, 20)
    expect(Number.isFinite(camera.scale)).toBe(true)
    expect(camera.scale).toBeGreaterThanOrEqual(MIN_SCALE)
    expect(camera.scale).toBeLessThanOrEqual(MAX_SCALE)
    expect(Number.isFinite(camera.x)).toBe(true)
    expect(Number.isFinite(camera.y)).toBe(true)
  })

  it('bounds de um único ponto (largura E altura 0): não estoura em NaN nem zoom infinito', () => {
    const bounds = { minX: 42, minY: 42, maxX: 42, maxY: 42 }
    const viewport = { width: 800, height: 600 }
    const camera = fitCamera(bounds, viewport, 0)
    expect(Number.isFinite(camera.scale)).toBe(true)
    expect(camera.scale).toBe(MAX_SCALE) // conteúdo ~0 cabe folgado: satura no teto de zoom
    expect(Number.isFinite(camera.x)).toBe(true)
    expect(Number.isFinite(camera.y)).toBe(true)
  })

  it('escala nunca sai do intervalo [MIN_SCALE, MAX_SCALE] — mesmo limite que a roda do mouse (zoomAt) respeita', () => {
    const casosGrandes = fitCamera({ minX: 0, minY: 0, maxX: 100000, maxY: 100000 }, { width: 800, height: 600 }, 0)
    const casosMinusculos = fitCamera({ minX: 0, minY: 0, maxX: 0.001, maxY: 0.001 }, { width: 800, height: 600 }, 0)
    expect(casosGrandes.scale).toBeGreaterThanOrEqual(MIN_SCALE)
    expect(casosMinusculos.scale).toBeLessThanOrEqual(MAX_SCALE)
  })
})
