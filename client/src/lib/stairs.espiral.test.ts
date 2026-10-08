/**
 * ESCADA EM ESPIRAL: o lance arrastado vira o DIÂMETRO de um círculo, e a
 * escada é o lance reto enrolado no poste. A subida parte da boca (a ponta do
 * arrasto, onde fica o pino da escada, agora na borda do círculo) e o último
 * quarto da volta é o patamar, que fecha a volta e encosta na boca pelo outro
 * lado. Subir gira no sentido horário da tela; descer é o espelho no eixo da
 * boca, a mesma escada percorrida do alto. O desenho (placa, patamar, degraus e
 * contorno) é testado em pixi/drawStairs.test.ts; aqui ficam a geometria e
 * todo lugar que pergunta "onde está a escada".
 */
import { describe, expect, it } from 'vitest'
import { computeSpiralPlan, spiralPoint } from './stairs'
import { findStairAt } from './selectionHitTest'
import { eraseDecisionForStair } from './eraseGeometry'
import { selectEntitiesInArea } from './areaSelection'
import { addStair, createEmptyMap } from './mapFactory'
import { resolveHoverGeometry } from '../pixi/drawHover'
import type { Stair, StairDirection } from '../types/map'

const ESPIRAL: Stair = { id: 'torre', shape: 'spiral', direction: 'up', segments: [{ x1: 100, y1: 200, x2: 300, y2: 200 }], stepWidth: 64 }

function planoDe(direction: StairDirection) {
  const plano = computeSpiralPlan(ESPIRAL.segments[0], direction)
  if (plano === null) throw new Error('espiral válida devolveu null')
  return plano
}

describe('computeSpiralPlan — o lance reto enrolado no poste', () => {
  it('o arrasto é o diâmetro: centro no meio, raio na metade, e a subida parte da boca', () => {
    const plano = planoDe('up')
    expect(plano.center).toEqual({ x: 200, y: 200 })
    expect(plano.radius).toBe(100)
    expect(plano.postRadius).toBeGreaterThan(0)
    expect(plano.postRadius).toBeLessThan(plano.radius)
    // A boca é a ponta do arrasto, na borda do círculo: varredura zero.
    expect(plano.mouthAngle).toBeCloseTo(Math.PI, 9)
    const boca = spiralPoint(plano, 0, plano.radius)
    expect(boca.x).toBeCloseTo(100, 9)
    expect(boca.y).toBeCloseTo(200, 9)
  })

  it('a subida e o patamar fecham uma volta inteira, e o patamar é a fatia menor', () => {
    const plano = planoDe('up')
    expect(plano.climbSweep + plano.landingSweep).toBeCloseTo(2 * Math.PI, 9)
    expect(plano.landingSweep).toBeGreaterThan(0)
    expect(plano.climbSweep).toBeGreaterThan(plano.landingSweep)
  })

  it('subir gira no sentido horário da tela a partir da boca; descer é o espelho no eixo da boca', () => {
    const sobe = planoDe('up')
    const desce = planoDe('down')
    expect(sobe.turn).toBe(1)
    expect(desce.turn).toBe(-1)
    // Um quarto de volta depois da boca (que está à esquerda): quem sobe está
    // em cima do centro, quem desce, embaixo. Na tela o y cresce para baixo.
    const quartoDaSubida = spiralPoint(sobe, Math.PI / 2, 100)
    expect(quartoDaSubida.x).toBeCloseTo(200, 9)
    expect(quartoDaSubida.y).toBeCloseTo(100, 9)
    const quartoDaDescida = spiralPoint(desce, Math.PI / 2, 100)
    expect(quartoDaDescida.x).toBeCloseTo(200, 9)
    expect(quartoDaDescida.y).toBeCloseTo(300, 9)
  })

  it('arrasto de comprimento zero não vira espiral', () => {
    expect(computeSpiralPlan({ x1: 5, y1: 5, x2: 5, y2: 5 }, 'up')).toBeNull()
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
