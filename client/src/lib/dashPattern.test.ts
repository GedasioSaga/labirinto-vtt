import { describe, expect, it } from 'vitest'
import { computeDashSegments, dashGeometry, flattenCurve, readDash } from './dashPattern'
import type { DrawingCap, DrawingDash, DrawingPoint } from '../types/map'

/** A linha da jornada `task-jornada-linha-pontilhada.spec.ts`, em px de mundo. */
const INICIO: DrawingPoint = { x: 420, y: 380 }
const FIM: DrawingPoint = { x: 900, y: 380 }
/** O miolo que a régua da jornada percorre — sem as pontas. */
const MEDIR_DE = INICIO.x + 30
const MEDIR_ATE = FIM.x - 30
/** Vão mínimo para contar como interrupção, igual ao da jornada. */
const VAO_MINIMO_PX = 2

interface Leitura {
  fracaoComTinta: number
  vaos: number
}

/**
 * A MESMA régua da jornada, em cima da geometria em vez de em cima do PNG:
 * percorre o miolo de 1 em 1 px e marca onde há tinta. A ponta
 * arredondada/quadrada estende a tinta `width / 2` para fora de cada
 * extremidade do pedacinho — é exatamente isso que faz um 2/6 fixo virar
 * traço CONTÍNUO num traço grosso, e é o que `dashGeometry` desconta.
 */
function lerOTraco(segmentos: Array<{ from: DrawingPoint; to: DrawingPoint }>, width: number, cap: DrawingCap): Leitura {
  const extensao = cap === 'butt' ? 0 : width / 2
  const temTinta: boolean[] = []
  for (let x = MEDIR_DE; x < MEDIR_ATE; x += 1) {
    const amostra = x + 0.5
    temTinta.push(
      segmentos.some(
        (s) => amostra >= Math.min(s.from.x, s.to.x) - extensao && amostra <= Math.max(s.from.x, s.to.x) + extensao,
      ),
    )
  }

  let vaos = 0
  let corrida = 0
  for (const tinta of temTinta) {
    if (tinta) {
      if (corrida >= VAO_MINIMO_PX) vaos += 1
      corrida = 0
    } else {
      corrida += 1
    }
  }
  if (corrida >= VAO_MINIMO_PX) vaos += 1

  return { fracaoComTinta: temTinta.filter(Boolean).length / temTinta.length, vaos }
}

function medirALinha(dash: DrawingDash, width: number, cap: DrawingCap): Leitura {
  const geometria = dashGeometry(dash, width, cap)
  const segmentos = geometria ? computeDashSegments([INICIO, FIM], geometria) : [{ from: INICIO, to: FIM }]
  return lerOTraco(segmentos, width, cap)
}

describe('dashPattern — o traço contínuo de hoje não muda', () => {
  it('linha sem o campo `dash` (mapa salvo antes desta feature) lê como contínua', () => {
    expect(readDash({ dash: undefined })).toBe('solid')
    expect(readDash({})).toBe('solid')
  })

  it('contínua não produz geometria: o render segue pelo caminho de sempre', () => {
    expect(dashGeometry('solid', 7, 'round')).toBeNull()
    expect(dashGeometry('solid', 1, 'butt')).toBeNull()
  })

  it('CONTROLE POSITIVO: a mesma régua vê a linha contínua sem nenhum vão', () => {
    const leitura = medirALinha('solid', 7, 'round')
    expect(leitura.vaos).toBe(0)
    expect(leitura.fracaoComTinta).toBe(1)
  })
})

describe('dashPattern — tracejada e pontilhada saem INTERROMPIDAS na régua da jornada', () => {
  // Espessura 7 e ponta arredondada: o par exato da jornada (ela ajusta a
  // Espessura para 7 e não mexe na Ponta, que nasce arredondada).
  it.each(['dashed', 'dotted'] as const)('%s tem pelo menos 3 vãos e tinta entre 15%% e 85%%', (dash) => {
    const leitura = medirALinha(dash, 7, 'round')
    expect(leitura.vaos).toBeGreaterThanOrEqual(3)
    expect(leitura.fracaoComTinta).toBeLessThan(0.85)
    expect(leitura.fracaoComTinta).toBeGreaterThan(0.15)
  })

  it('a pontilhada tem mais fundo entre os pontos do que a tracejada', () => {
    expect(medirALinha('dotted', 7, 'round').fracaoComTinta).toBeLessThan(medirALinha('dashed', 7, 'round').fracaoComTinta)
  })

  it.each([
    ['dotted', 1, 'round'],
    ['dotted', 20, 'round'],
    ['dotted', 7, 'butt'],
    ['dashed', 1, 'butt'],
    ['dashed', 20, 'square'],
  ] as Array<[DrawingDash, number, DrawingCap]>)(
    'continua interrompida com espessura e ponta nas bordas (%s, %i px, %s)',
    (dash, width, cap) => {
      const leitura = medirALinha(dash, width, cap)
      expect(leitura.vaos).toBeGreaterThanOrEqual(3)
      expect(leitura.fracaoComTinta).toBeLessThan(0.85)
      expect(leitura.fracaoComTinta).toBeGreaterThan(0.15)
    },
  )

  it('a ponta arredondada encurta o pedacinho: sem esse desconto o pontilhado grosso sairia cheio', () => {
    const arredondada = dashGeometry('dotted', 7, 'round')
    const reta = dashGeometry('dotted', 7, 'butt')
    if (arredondada === null || reta === null) throw new Error('pontilhada deveria ter geometria')
    expect(arredondada.period).toBe(reta.period)
    expect(arredondada.length).toBeCloseTo(reta.length - 7, 6)
  })
})

describe('computeDashSegments', () => {
  it('não reinicia o padrão a cada vértice: o último pedacinho de um trecho continua no seguinte', () => {
    const geometria = dashGeometry('dashed', 2, 'butt')
    if (geometria === null) throw new Error('tracejada deveria ter geometria')
    // Período 10, traço 6. Uma polilinha reta quebrada em dois trechos de 10 px
    // tem de dar o MESMO resultado de uma reta única de 20 px.
    const quebrada = computeDashSegments([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }], geometria)
    const inteira = computeDashSegments([{ x: 0, y: 0 }, { x: 20, y: 0 }], geometria)
    expect(quebrada.map((s) => [s.from.x, s.to.x])).toEqual(inteira.map((s) => [s.from.x, s.to.x]))
  })

  it('segmento de comprimento zero ou ponto único não vira pedacinho nenhum', () => {
    const geometria = dashGeometry('dotted', 7, 'round')
    if (geometria === null) throw new Error('pontilhada deveria ter geometria')
    expect(computeDashSegments([{ x: 5, y: 5 }, { x: 5, y: 5 }], geometria)).toEqual([])
    expect(computeDashSegments([{ x: 5, y: 5 }], geometria)).toEqual([])
    expect(computeDashSegments([], geometria)).toEqual([])
  })
})

describe('flattenCurve', () => {
  it('achata a curva em polilinha, começando no primeiro ponto de controle', () => {
    const pontos = [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }]
    const achatada = flattenCurve(pontos)
    expect(achatada.length).toBeGreaterThan(pontos.length)
    expect(achatada[0]).toEqual({ x: 0, y: 0 })
    expect(achatada[achatada.length - 1].x).toBeCloseTo(100, 6)
    expect(achatada[achatada.length - 1].y).toBeCloseTo(0, 6)
  })

  it('curva com menos de 2 pontos volta como veio, sem quebrar', () => {
    expect(flattenCurve([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }])
    expect(flattenCurve([])).toEqual([])
  })
})
