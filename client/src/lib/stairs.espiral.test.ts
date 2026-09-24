/**
 * ESCADA EM ESPIRAL: o lance arrastado vira o DIÂMETRO de um círculo, e a
 * escada se desenha como o minimapa desenha uma espiral vista de cima — um
 * círculo de traço fino, o poste no meio e raios finos (um por degrau). A boca
 * (onde fica o pino da escada) continua na ponta do arrasto, agora na borda do
 * círculo; o primeiro raio aponta para ela. Subir gira num sentido, descer no
 * outro, e o tom clareia rumo ao alto, como no lance reto.
 */
import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { computeSpiralPlan, SPIRAL_SPOKE_COUNT } from './stairs'
import { findStairAt } from './selectionHitTest'
import { eraseDecisionForStair } from './eraseGeometry'
import { selectEntitiesInArea } from './areaSelection'
import { addStair, createEmptyMap } from './mapFactory'
import { resolveHoverGeometry } from '../pixi/drawHover'
import { drawStairs, STAIR_RAIL_ALPHA, STAIR_TREAD_ALPHA_AT_FOOT } from '../pixi/drawStairs'
import { SELECTION_COLOR, STAIR_COLOR } from '../pixi/constants'
import type { Stair } from '../types/map'

const ESPIRAL: Stair = { id: 'torre', shape: 'spiral', direction: 'up', segments: [{ x1: 100, y1: 200, x2: 300, y2: 200 }], stepWidth: 64 }

function strokes(g: Graphics) {
  return g.context.instructions.filter((i) => i.action === 'stroke')
}

describe('computeSpiralPlan — círculo com raios', () => {
  it('o arrasto é o diâmetro: centro no meio, raio na metade, e o primeiro raio aponta para a boca', () => {
    const plan = computeSpiralPlan(ESPIRAL.segments[0], 'up')
    if (plan === null) throw new Error('espiral válida devolveu null')
    expect(plan.center).toEqual({ x: 200, y: 200 })
    expect(plan.radius).toBe(100)
    expect(plan.spokes).toHaveLength(SPIRAL_SPOKE_COUNT)
    expect(plan.postRadius).toBeGreaterThan(0)
    expect(plan.postRadius).toBeLessThan(plan.radius)
    const primeiro = plan.spokes[0]
    expect(primeiro.to.x).toBeCloseTo(100, 6)
    expect(primeiro.to.y).toBeCloseTo(200, 6)
    // Todo raio vai do poste até a borda do círculo.
    for (const raio of plan.spokes) {
      expect(Math.hypot(raio.to.x - 200, raio.to.y - 200)).toBeCloseTo(100, 6)
      expect(Math.hypot(raio.from.x - 200, raio.from.y - 200)).toBeCloseTo(plan.postRadius, 6)
    }
    expect(plan.spokes.map((r) => r.climb)[0]).toBe(0)
    expect(plan.spokes[plan.spokes.length - 1].climb).toBe(1)
  })

  it('subir e descer giram em sentidos opostos a partir da boca', () => {
    const sobe = computeSpiralPlan(ESPIRAL.segments[0], 'up')
    const desce = computeSpiralPlan(ESPIRAL.segments[0], 'down')
    if (sobe === null || desce === null) throw new Error('espiral válida devolveu null')
    expect(sobe.spokes[0].to).toEqual(desce.spokes[0].to)
    // Espelho no eixo da boca (y = 200): o segundo raio de um é o reflexo do outro.
    expect(sobe.spokes[1].to.x).toBeCloseTo(desce.spokes[1].to.x, 6)
    expect(sobe.spokes[1].to.y - 200).toBeCloseTo(-(desce.spokes[1].to.y - 200), 6)
    expect(sobe.spokes[1].to.y).not.toBeCloseTo(desce.spokes[1].to.y, 3)
  })

  it('arrasto de comprimento zero não vira espiral', () => {
    expect(computeSpiralPlan({ x1: 5, y1: 5, x2: 5, y2: 5 }, 'up')).toBeNull()
  })
})

describe('drawStairs — espiral', () => {
  it('um traço para o círculo e o poste, e um traço fino por raio, clareando rumo ao alto', () => {
    const g = new Graphics()
    drawStairs(g, [ESPIRAL], null)
    const traços = strokes(g)
    expect(traços).toHaveLength(SPIRAL_SPOKE_COUNT + 1)
    expect(traços.every((s) => s.data.style.color === STAIR_COLOR)).toBe(true)

    const [contorno, ...raios] = traços
    const circulos = contorno.data.path.instructions.filter((i) => i.action === 'circle')
    expect(circulos).toHaveLength(2)
    expect((contorno.data.style as { alpha: number }).alpha).toBeCloseTo(STAIR_RAIL_ALPHA, 6)

    // Raio FINO: todos com a mesma espessura do fio do contorno, nada de galão engordando.
    expect(raios.every((r) => r.data.style.width === contorno.data.style.width)).toBe(true)
    expect((raios[0].data.style as { alpha: number }).alpha).toBeCloseTo(STAIR_TREAD_ALPHA_AT_FOOT, 6)
    expect((raios[raios.length - 1].data.style as { alpha: number }).alpha).toBeCloseTo(1, 6)
  })

  it('selecionada: o realce amarelo vem por baixo, um por traço real', () => {
    const g = new Graphics()
    drawStairs(g, [ESPIRAL], 'torre')
    const traços = strokes(g)
    const amarelos = traços.filter((s) => s.data.style.color === SELECTION_COLOR)
    const reais = traços.filter((s) => s.data.style.color !== SELECTION_COLOR)
    expect(amarelos).toHaveLength(reais.length)
    expect(reais).toHaveLength(SPIRAL_SPOKE_COUNT + 1)
    expect(reais.every((s) => s.data.style.color === STAIR_COLOR)).toBe(true)
    expect(traços.indexOf(amarelos[amarelos.length - 1])).toBeLessThan(traços.indexOf(reais[0]))
  })
})

describe('findStairAt — espiral', () => {
  it('tocar em qualquer ponto do círculo pega a escada; fora dele, não', () => {
    // Longe do diâmetro arrastado, mas dentro do círculo.
    expect(findStairAt([ESPIRAL], { x: 200, y: 290 })?.id).toBe('torre')
    expect(findStairAt([ESPIRAL], { x: 200, y: 115 })?.id).toBe('torre')
    expect(findStairAt([ESPIRAL], { x: 200, y: 330 })).toBeNull()
    // A mesma escada reta não responde tão longe do lance.
    expect(findStairAt([{ ...ESPIRAL, shape: 'straight' }], { x: 200, y: 290 })).toBeNull()
  })
})

// A espiral é o círculo desenhado em TODO lugar que pergunta "onde está a escada":
// borracha, contorno de hover e seleção por área concordam com o clique acima.
describe('borracha — espiral', () => {
  it('passar em cima do círculo, longe do diâmetro, apaga a escada; fora dele, não', () => {
    expect(eraseDecisionForStair(ESPIRAL, { x: 200, y: 290 }, 10)).toBe('remove')
    expect(eraseDecisionForStair(ESPIRAL, { x: 200, y: 105 }, 10)).toBe('remove')
    expect(eraseDecisionForStair(ESPIRAL, { x: 200, y: 330 }, 10)).toBe('keep')
    // A mesma escada reta continua sendo só o lance.
    expect(eraseDecisionForStair({ ...ESPIRAL, shape: 'straight' }, { x: 200, y: 290 }, 10)).toBe('keep')
    // Espiral sem lance nenhum (dado velho ou corrompido) não quebra: não há o que apagar.
    expect(eraseDecisionForStair({ ...ESPIRAL, segments: [] }, { x: 200, y: 200 }, 10)).toBe('keep')
  })
})

describe('contorno de hover — espiral', () => {
  it('o contorno é o círculo desenhado, não o diâmetro', () => {
    const map = addStair(createEmptyMap('m1', 'Mapa', 1000, 1000, 50), ESPIRAL)
    expect(resolveHoverGeometry(map, { kind: 'stair', id: 'torre' })).toEqual({ shape: 'circle', cx: 200, cy: 200, radius: 100 })
    const reta = addStair(createEmptyMap('m1', 'Mapa', 1000, 1000, 50), { ...ESPIRAL, shape: 'straight' })
    expect(resolveHoverGeometry(reta, { kind: 'stair', id: 'torre' })).toEqual({
      shape: 'segments',
      segments: [{ a: { x: 100, y: 200 }, b: { x: 300, y: 200 } }],
    })
  })
})

describe('seleção por área — espiral', () => {
  const map = addStair(createEmptyMap('m1', 'Mapa', 1000, 1000, 50), ESPIRAL)

  it('interseção: retângulo que só toca o círculo, longe do diâmetro, pega a escada', () => {
    // Arrasto da direita para a esquerda = interseção.
    expect(selectEntitiesInArea(map, { x1: 210, y1: 280, x2: 190, y2: 295 }).stairs).toEqual(['torre'])
    expect(selectEntitiesInArea(map, { x1: 210, y1: 310, x2: 190, y2: 330 }).stairs).toEqual([])
  })

  it('contenção: cercar só o diâmetro não basta, é preciso cercar o círculo', () => {
    expect(selectEntitiesInArea(map, { x1: 90, y1: 190, x2: 310, y2: 210 }).stairs).toEqual([])
    expect(selectEntitiesInArea(map, { x1: 90, y1: 90, x2: 310, y2: 310 }).stairs).toEqual(['torre'])
  })
})
