import { describe, expect, it } from 'vitest'
import type { MapData, Prop } from '../types/map'
import {
  contornoDaCerca,
  criarMovel,
  geometriaDaCerca,
  movelComOutroTipo,
  normalizarCurvaDaCerca,
  propMobiliaFromFile,
  tracosDoGlifo,
  voltaDaCerca,
} from './mobilia'
import {
  alcaDaCurvaDaCerca,
  amostrasDaCercaCurva,
  arrastarCurvaDaCerca,
  contornoDaCercaCurva,
  rotuloDaCurvaDaCerca,
} from './cercaCurva'
import { curvaForTurnDegrees, turnDegreesForCurva } from './stairCurve'
import { pointInPolygonInclusive } from './roomNesting'
import { findPropAt } from '../pixi/propInteraction'
import { eraseDecisionForProp } from './eraseGeometry'
import { selectEntitiesInArea } from './areaSelection'
import { createEmptyMap } from './mapFactory'

/**
 * CERCA CURVA (pedido de 13/10/2026: "cercas curvas que nem as escadas"). Um
 * arco só, até meia volta, pela alça do meio do fio; as pontas não saem do
 * lugar. A volta mora em `Prop.mobiliaCurva`, em GRAUS: esticar a cerca mantém
 * a volta (a flecha cresce junto com a corda), como a escada que muda de
 * comprimento (`withStairLength`).
 */

const GRADE = 40
const ESPESSURA = GRADE / 4
/** Raio do mourão: 0,45 da espessura (`lib/mobilia.ts`). */
const RAIO = 0.45 * ESPESSURA

function cerca(extra: Partial<Prop> = {}): Prop {
  return { ...criarMovel('cerca', { x: 200, y: 200 }, GRADE, 'c'), ...extra }
}

function distancia(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Corda da cerca deitada de `comprimento`: de mourão a mourão das pontas. */
function corda(comprimento: number): number {
  return comprimento - 2 * RAIO
}

describe('cerca curva — geometria', () => {
  it('sem curva é a cerca de hoje: volta 0 e volta ausente dão os mesmos mourões e os mesmos traços', () => {
    const reta = geometriaDaCerca(6 * GRADE, ESPESSURA)
    const zero = geometriaDaCerca(6 * GRADE, ESPESSURA, 0)
    if (reta === null || zero === null) throw new Error('cerca sem geometria')
    expect(zero.mouroes).toEqual(reta.mouroes)
    expect(zero.arco).toBeNull()
    expect(tracosDoGlifo('cerca', 6 * GRADE, ESPESSURA, 'frente', 0)).toEqual(tracosDoGlifo('cerca', 6 * GRADE, ESPESSURA))
  })

  it('curva de 90°: os mourões das pontas não saem do lugar e todos ficam no mesmo arco', () => {
    const reta = geometriaDaCerca(6 * GRADE, ESPESSURA)
    const curva = geometriaDaCerca(6 * GRADE, ESPESSURA, 90)
    if (reta === null || curva === null || curva.arco === null) throw new Error('cerca curva sem arco')
    const { arco } = curva
    const primeiro = curva.mouroes[0]
    const ultimo = curva.mouroes[curva.mouroes.length - 1]
    expect(primeiro.x).toBeCloseTo(reta.mouroes[0].x, 9)
    expect(primeiro.y).toBeCloseTo(0, 9)
    expect(ultimo.x).toBeCloseTo(reta.mouroes[reta.mouroes.length - 1].x, 9)
    expect(ultimo.y).toBeCloseTo(0, 9)
    for (const m of curva.mouroes) expect(distancia(m, arco.center)).toBeCloseTo(arco.radius, 9)
    // A flecha no meio é a da volta pedida (a conta da escada).
    expect(arco.radius - distancia({ x: 0, y: 0 }, arco.center)).toBeCloseTo(Math.abs(curvaForTurnDegrees(90, corda(6 * GRADE))), 9)
  })

  it('os mourões se repartem pelo ARCO, ~1 casa de arco entre vizinhos: meia volta tem mais mourões que a reta', () => {
    const curva = geometriaDaCerca(6 * GRADE, ESPESSURA, 180)
    if (curva === null || curva.arco === null) throw new Error('cerca curva sem arco')
    const { center, radius } = curva.arco
    // 6 casas: corda 231 px, meia volta = π × 115,5 ≈ 363 px de arco ≈ 9 casas → 10 mourões (a reta tem 7).
    expect(curva.mouroes).toHaveLength(10)
    for (let i = 1; i < curva.mouroes.length; i += 1) {
      const a = Math.atan2(curva.mouroes[i - 1].y - center.y, curva.mouroes[i - 1].x - center.x)
      const b = Math.atan2(curva.mouroes[i].y - center.y, curva.mouroes[i].x - center.x)
      let passo = Math.abs(b - a)
      if (passo > Math.PI) passo = 2 * Math.PI - passo
      expect(passo * radius).toBeGreaterThan(0.75 * GRADE)
      expect(passo * radius).toBeLessThan(1.25 * GRADE)
    }
  })

  it('o fio segue o arco em pedaços curtos, de borda a borda dos mourões, sem entrar em nenhum', () => {
    const largura = 6 * GRADE
    const geometria = geometriaDaCerca(largura, ESPESSURA, 120)
    if (geometria === null || geometria.arco === null) throw new Error('cerca curva sem arco')
    const { mouroes, raio, arco } = geometria
    const tracos = tracosDoGlifo('cerca', largura, ESPESSURA, 'frente', 120)
    const naBordaDeMourao = (x: number, y: number) => mouroes.some((m) => Math.abs(Math.hypot(x - m.x, y - m.y) - raio) < 1e-9)
    const fio = tracos.filter((t) => !(naBordaDeMourao(t.x1, t.y1) && naBordaDeMourao(t.x2, t.y2)))
    expect(fio.length).toBeGreaterThan(mouroes.length - 1)
    let total = 0
    for (const t of fio) {
      for (const p of [{ x: t.x1, y: t.y1 }, { x: t.x2, y: t.y2 }]) {
        expect(distancia(p, arco.center)).toBeCloseTo(arco.radius, 6)
        for (const m of mouroes) expect(distancia(p, m)).toBeGreaterThanOrEqual(raio - 1e-6)
      }
      const pedaco = Math.hypot(t.x2 - t.x1, t.y2 - t.y1)
      expect(pedaco).toBeLessThanOrEqual(arco.radius * (Math.PI / 32))
      total += pedaco
    }
    // O fio cobre o arco inteiro menos o que os mourões tapam.
    const arcoTodo = arco.radius * Math.abs(arco.sweep)
    expect(total).toBeGreaterThan(arcoTodo - 2 * raio * mouroes.length - 1)
  })

  it('meia volta é o limite (270° desenha como 180°), e o sinal escolhe o lado', () => {
    expect(geometriaDaCerca(2 * GRADE, ESPESSURA, 270)).toEqual(geometriaDaCerca(2 * GRADE, ESPESSURA, 180))
    const paraBaixo = geometriaDaCerca(2 * GRADE, ESPESSURA, 90)
    const paraCima = geometriaDaCerca(2 * GRADE, ESPESSURA, -90)
    if (paraBaixo === null || paraCima === null) throw new Error('cerca sem geometria')
    const meio = (g: typeof paraBaixo) => g.mouroes[Math.floor(g.mouroes.length / 2)]
    expect(meio(paraBaixo).y).toBeGreaterThan(5)
    expect(meio(paraCima).y).toBeLessThan(-5)
  })

  it('a cerca em pé curva do mesmo jeito, para o lado', () => {
    const geometria = geometriaDaCerca(ESPESSURA, 6 * GRADE, 90)
    if (geometria === null) throw new Error('cerca sem geometria')
    const { mouroes } = geometria
    expect(mouroes[0].x).toBeCloseTo(0, 9)
    expect(mouroes[mouroes.length - 1].x).toBeCloseTo(0, 9)
    expect(Math.abs(mouroes[Math.floor(mouroes.length / 2)].x)).toBeGreaterThan(5)
  })

  it('contorno: o retângulo de sempre na reta; na curva, a faixa dobrada, com todo mourão dentro', () => {
    const reta = contornoDaCerca(2 * GRADE, ESPESSURA, 0)
    expect(reta).toEqual([
      { x: -GRADE, y: -ESPESSURA / 2 },
      { x: GRADE, y: -ESPESSURA / 2 },
      { x: GRADE, y: ESPESSURA / 2 },
      { x: -GRADE, y: ESPESSURA / 2 },
    ])
    const curva = contornoDaCerca(6 * GRADE, ESPESSURA, 150)
    const geometria = geometriaDaCerca(6 * GRADE, ESPESSURA, 150)
    if (geometria === null) throw new Error('cerca sem geometria')
    expect(curva.length).toBeGreaterThan(8)
    for (const m of geometria.mouroes) expect(pointInPolygonInclusive(m, curva)).toBe(true)
    // O meio da corda (o centro do objeto) fica fora da faixa dobrada.
    expect(pointInPolygonInclusive({ x: 0, y: 0 }, curva)).toBe(false)
  })
})

describe('cerca curva — o campo no objeto', () => {
  it('só a cerca guarda a curva: número finito, limitado a meia volta; zero e o resto viram ausente', () => {
    expect(normalizarCurvaDaCerca('cerca', 45)).toBe(45)
    expect(normalizarCurvaDaCerca('cerca', -45.5)).toBe(-45.5)
    expect(normalizarCurvaDaCerca('cerca', 400)).toBe(180)
    expect(normalizarCurvaDaCerca('cerca', -200)).toBe(-180)
    for (const valor of [0, Number.NaN, Number.POSITIVE_INFINITY, '45', null, undefined, {}]) {
      expect(normalizarCurvaDaCerca('cerca', valor), String(valor)).toBeUndefined()
    }
    expect(normalizarCurvaDaCerca('mesa', 45)).toBeUndefined()
    expect(normalizarCurvaDaCerca(undefined, 45)).toBeUndefined()
  })

  it('voltaDaCerca: 0 sem curva ou fora da cerca', () => {
    expect(voltaDaCerca(cerca())).toBe(0)
    expect(voltaDaCerca(cerca({ mobiliaCurva: 60 }))).toBe(60)
    expect(voltaDaCerca({ mobilia: 'mesa', mobiliaCurva: 60 })).toBe(0)
  })

  it('leitura do arquivo: a curva da cerca fica; torta, fora do limite ou em outro tipo, some ou é limitada', () => {
    const curva = cerca({ mobiliaCurva: 90 })
    expect(propMobiliaFromFile(curva)).toBe(curva)
    expect(propMobiliaFromFile(cerca({ mobiliaCurva: 400 })).mobiliaCurva).toBe(180)
    expect(propMobiliaFromFile(cerca({ mobiliaCurva: 0 }))).not.toHaveProperty('mobiliaCurva')
    expect(propMobiliaFromFile(cerca({ mobilia: 'mesa', mobiliaCurva: 90 }))).not.toHaveProperty('mobiliaCurva')
    const { mobilia: _tipo, ...comum } = cerca({ mobiliaCurva: 90 })
    expect(propMobiliaFromFile(comum)).not.toHaveProperty('mobiliaCurva')
  })

  it('trocar o tipo da cerca curva tira a curva', () => {
    expect(movelComOutroTipo(cerca({ mobiliaCurva: 90 }), 'mesa', GRADE)).not.toHaveProperty('mobiliaCurva')
  })
})

describe('cerca curva — a alça do meio do fio', () => {
  const flecha90 = Math.abs(curvaForTurnDegrees(90, corda(2 * GRADE)))

  it('fica no meio da cerca reta e no meio do arco da curva, girando com o objeto', () => {
    expect(alcaDaCurvaDaCerca(cerca())).toEqual({ x: 200, y: 200 })
    const curva = alcaDaCurvaDaCerca(cerca({ mobiliaCurva: 90 }))
    expect(curva?.x).toBeCloseTo(200, 9)
    expect(curva?.y).toBeCloseTo(200 + flecha90, 9)
    // Girada 90° no sentido horário: o "para baixo" da cerca vira "para a esquerda".
    const girada = alcaDaCurvaDaCerca(cerca({ mobiliaCurva: 90, rotation: 90 }))
    expect(girada?.x).toBeCloseTo(200 - flecha90, 9)
    expect(girada?.y).toBeCloseTo(200, 9)
  })

  it('só a cerca tem alça de curva', () => {
    expect(alcaDaCurvaDaCerca(cerca({ mobilia: 'mesa' }))).toBeNull()
    expect(alcaDaCurvaDaCerca(cerca({ width: 0 }))).toBeNull()
  })

  it('arrastar para o lado arqueia para ele; a ponta, o tamanho e o giro ficam', () => {
    const reta = cerca()
    const baixo = arrastarCurvaDaCerca({ prop: reta, pointer: { x: 200, y: 220 }, snap: false })
    expect(baixo.mobiliaCurva).toBeCloseTo(turnDegreesForCurva(20, corda(2 * GRADE)), 9)
    expect(baixo.mobiliaCurva).toBeGreaterThan(0)
    expect({ x: baixo.x, y: baixo.y, width: baixo.width, height: baixo.height, rotation: baixo.rotation }).toEqual({
      x: reta.x,
      y: reta.y,
      width: reta.width,
      height: reta.height,
      rotation: reta.rotation,
    })
    const cima = arrastarCurvaDaCerca({ prop: reta, pointer: { x: 200, y: 180 }, snap: false })
    expect(cima.mobiliaCurva).toBeCloseTo(-(baixo.mobiliaCurva ?? 0), 9)
  })

  it('não passa de meia volta, por mais longe que o ponteiro vá', () => {
    expect(arrastarCurvaDaCerca({ prop: cerca(), pointer: { x: 200, y: 900 }, snap: false }).mobiliaCurva).toBe(180)
    expect(arrastarCurvaDaCerca({ prop: cerca(), pointer: { x: 200, y: -900 }, snap: true }).mobiliaCurva).toBe(-180)
  })

  it('com a grade, a volta encaixa de 15 em 15°', () => {
    const solto = arrastarCurvaDaCerca({ prop: cerca(), pointer: { x: 200, y: 211 }, snap: false }).mobiliaCurva ?? 0
    const encaixado = arrastarCurvaDaCerca({ prop: cerca(), pointer: { x: 200, y: 211 }, snap: true }).mobiliaCurva
    expect(encaixado).toBe(Math.round(solto / 15) * 15)
  })

  it('voltar ao meio endireita: o campo sai; da reta sem mudar nada, o mesmo objeto', () => {
    const curva = cerca({ mobiliaCurva: 90 })
    const endireitada = arrastarCurvaDaCerca({ prop: curva, pointer: { x: 201, y: 201 }, snap: true })
    expect(endireitada).not.toHaveProperty('mobiliaCurva')
    const reta = cerca()
    expect(arrastarCurvaDaCerca({ prop: reta, pointer: { x: 200, y: 200 }, snap: false })).toBe(reta)
    expect(arrastarCurvaDaCerca({ prop: reta, pointer: { x: 200, y: 200.1 }, snap: false })).toBe(reta)
  })

  it('sem a grade, o ponteiro de volta perto da corda (dentro do encaixe) também endireita', () => {
    const curva = cerca({ mobiliaCurva: 90 })
    expect(arrastarCurvaDaCerca({ prop: curva, pointer: { x: 200, y: 201.5 }, snap: false, encaixeDaReta: 2 })).not.toHaveProperty('mobiliaCurva')
    // Fora do encaixe, curva — mesmo pouco.
    expect(arrastarCurvaDaCerca({ prop: curva, pointer: { x: 200, y: 202.5 }, snap: false, encaixeDaReta: 2 }).mobiliaCurva).toBeGreaterThan(0)
    // Sem encaixe, só a flecha invisível (meio px) endireita.
    expect(arrastarCurvaDaCerca({ prop: curva, pointer: { x: 200, y: 201.5 }, snap: false }).mobiliaCurva).toBeGreaterThan(0)
  })

  it('na cerca girada, o arrasto lê o lado da própria cerca', () => {
    const girada = cerca({ rotation: 90 })
    const curva = arrastarCurvaDaCerca({ prop: girada, pointer: { x: 180, y: 200 }, snap: false })
    expect(curva.mobiliaCurva).toBeCloseTo(turnDegreesForCurva(20, corda(2 * GRADE)), 9)
  })

  it('objeto que não é cerca não curva', () => {
    const mesa = cerca({ mobilia: 'mesa' })
    expect(arrastarCurvaDaCerca({ prop: mesa, pointer: { x: 200, y: 260 }, snap: false })).toBe(mesa)
  })

  it('o rótulo do arrasto: "reta" ou a volta em graus, como na escada', () => {
    expect(rotuloDaCurvaDaCerca(cerca())).toBe('reta')
    expect(rotuloDaCurvaDaCerca(cerca({ mobiliaCurva: 90 }))).toBe('curva 90°')
    expect(rotuloDaCurvaDaCerca(cerca({ mobiliaCurva: -44.6 }))).toBe('curva 45°')
  })
})

describe('cerca curva — clique, borracha, área e névoa usam a forma curva', () => {
  /** Meia volta numa cerca de 6 casas: o meio da corda fica longe do arco. */
  const curva = cerca({ width: 6 * GRADE, mobiliaCurva: 180 })
  const meioDoArco = alcaDaCurvaDaCerca(curva) ?? { x: Number.NaN, y: Number.NaN }

  it('contorno no mundo só para a cerca curva', () => {
    expect(contornoDaCercaCurva(cerca())).toBeNull()
    expect(contornoDaCercaCurva(cerca({ mobilia: 'mesa', mobiliaCurva: 90 }))).toBeNull()
    const contorno = contornoDaCercaCurva(curva)
    if (contorno === null) throw new Error('cerca curva sem contorno')
    expect(pointInPolygonInclusive(meioDoArco, contorno)).toBe(true)
  })

  it('o clique pega o arco e não pega o vão do meio da corda', () => {
    expect(findPropAt([curva], meioDoArco)?.id).toBe('c')
    expect(findPropAt([curva], { x: 200, y: 200 })).toBeNull()
    // A cerca reta continua pela caixa de sempre.
    expect(findPropAt([cerca()], { x: 200, y: 200 })?.id).toBe('c')
  })

  it('a borracha apaga pelo arco, não pelo retângulo reto', () => {
    expect(eraseDecisionForProp(curva, meioDoArco, 2)).toBe('remove')
    expect(eraseDecisionForProp(curva, { x: 200, y: 200 }, 2)).toBe('keep')
  })

  it('a seleção por área (contenção) precisa cobrir o arco inteiro, não só a caixa reta', () => {
    const mapa: MapData = { ...createEmptyMap('m', 'M', 20, 20, GRADE), props: [curva] }
    const soACaixa = { x1: 200 - 3 * GRADE - 2, y1: 200 - ESPESSURA, x2: 200 + 3 * GRADE + 2, y2: 200 + ESPESSURA }
    expect(selectEntitiesInArea(mapa, soACaixa).props).toEqual([])
    const tudo = { x1: 200 - 3 * GRADE - 2, y1: 200 - ESPESSURA, x2: 200 + 3 * GRADE + 2, y2: meioDoArco.y + ESPESSURA }
    expect(selectEntitiesInArea(mapa, tudo).props).toEqual(['c'])
  })

  it('amostras para a névoa: nenhuma na reta; na curva, as pontas, o meio e os quartos do arco', () => {
    expect(amostrasDaCercaCurva(cerca())).toEqual([])
    const amostras = amostrasDaCercaCurva(curva)
    expect(amostras).toHaveLength(5)
    expect(amostras[2].x).toBeCloseTo(meioDoArco.x, 9)
    expect(amostras[2].y).toBeCloseTo(meioDoArco.y, 9)
  })
})
