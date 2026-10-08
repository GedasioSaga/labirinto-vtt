import { describe, expect, it } from 'vitest'
import type { Drawing, DrawingPoint } from '../types/map'
import { areaDoBalde } from './baldeDeTinta'
import { flattenCurve } from './dashPattern'
import { aceitaParedesAoRedor, contornoDoDesenho, segmentosDasParedesDoDesenho } from './paredesDoDesenho'

const COR = '#000000'

/** Área com sinal (fórmula do laço). Anel de fora sai positivo; buraco, negativo. */
function area(anel: readonly DrawingPoint[]): number {
  let soma = 0
  for (let i = 0; i < anel.length; i += 1) {
    const a = anel[i]
    const b = anel[(i + 1) % anel.length]
    soma += a.x * b.y - b.x * a.y
  }
  return soma / 2
}

function distanciaAoSegmento(p: DrawingPoint, a: DrawingPoint, b: DrawingPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const tamanho2 = dx * dx + dy * dy
  const t = tamanho2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / tamanho2))
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y)
}

function distanciaAPolilinha(p: DrawingPoint, pontos: readonly DrawingPoint[]): number {
  let menor = Infinity
  for (let i = 0; i + 1 < pontos.length; i += 1) menor = Math.min(menor, distanciaAoSegmento(p, pontos[i], pontos[i + 1]))
  return menor
}

/** Par-ou-ímpar: `p` cai dentro do anel? */
function dentro(p: DrawingPoint, anel: readonly DrawingPoint[]): boolean {
  let dentroDele = false
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const a = anel[i]
    const b = anel[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentroDele = !dentroDele
  }
  return dentroDele
}

function lado(a: DrawingPoint, b: DrawingPoint, c: DrawingPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

/**
 * Algum lado de algum anel cruza outro lado (do mesmo anel ou de outro)? Só
 * cruzamento de verdade: lados vizinhos que dividem a ponta não contam.
 * Força bruta de propósito, para não depender do código que está sendo testado.
 */
function temCruzamento(aneis: readonly DrawingPoint[][]): boolean {
  const lados: Array<[DrawingPoint, DrawingPoint]> = []
  for (const anel of aneis) for (let i = 0; i < anel.length; i += 1) lados.push([anel[i], anel[(i + 1) % anel.length]])
  for (let i = 0; i < lados.length; i += 1) {
    for (let j = i + 1; j < lados.length; j += 1) {
      const [a, b] = lados[i]
      const [c, d] = lados[j]
      if (lado(a, b, c) * lado(a, b, d) < 0 && lado(c, d, a) * lado(c, d, b) < 0) return true
    }
  }
  return false
}

function freehand(points: DrawingPoint[], width: number, extra: Partial<Extract<Drawing, { kind: 'freehand' }>> = {}): Drawing {
  return { id: 'f', kind: 'freehand', points, color: COR, width, ...extra }
}

/**
 * Laço de verdade (trocoide): o traço passa por cima dele mesmo em (200, ~226)
 * e fecha um olho de ~45 x 77 px em volta de (200, 188).
 */
function rabiscoComLaco(): DrawingPoint[] {
  const pontos: DrawingPoint[] = []
  for (let k = 0; k <= 160; k += 1) {
    const t = -Math.PI + (2 * Math.PI * k) / 160
    pontos.push({ x: 200 + 20 * t - 50 * Math.sin(t), y: 200 - 50 * Math.cos(t) })
  }
  return pontos
}

/** Espiral de Arquimedes com voltas a ~19 px uma da outra: o traço nunca encosta nele mesmo. */
function espiralSemEncostar(): DrawingPoint[] {
  const pontos: DrawingPoint[] = []
  for (let k = 0; k <= 300; k += 1) {
    const teta = (k / 300) * 6 * Math.PI
    const raio = 10 + 3 * teta
    pontos.push({ x: 300 + raio * Math.cos(teta), y: 300 + raio * Math.sin(teta) })
  }
  return pontos
}

/** Rabisco de 500 pontos que se cruza várias vezes (rosácea): o pior caso de laços. */
function rabiscoQueSeCruza(): DrawingPoint[] {
  const pontos: DrawingPoint[] = []
  for (let k = 0; k < 500; k += 1) {
    const teta = (k / 500) * 4 * Math.PI
    pontos.push({
      x: 400 + 150 * Math.cos(teta) + 60 * Math.cos(5.3 * teta),
      y: 400 + 150 * Math.sin(teta) + 60 * Math.sin(5.3 * teta),
    })
  }
  return pontos
}

describe('contornoDoDesenho — traço (dos dois lados da grossura)', () => {
  it('linha reta de 100 px com grossura 10 vira um estádio em volta, a ~5 px do eixo', () => {
    const linha: Drawing = { id: 'l', kind: 'line', x1: 100, y1: 100, x2: 200, y2: 100, color: COR, width: 10 }
    const aneis = contornoDoDesenho(linha)
    expect(aneis).toHaveLength(1)
    expect(area(aneis[0])).toBeGreaterThan(0)
    for (const p of aneis[0]) {
      expect(Math.abs(distanciaAoSegmento(p, { x: 100, y: 100 }, { x: 200, y: 100 }) - 5)).toBeLessThan(0.3)
    }
    const xs = aneis[0].map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(95, 0)
    expect(Math.max(...xs)).toBeCloseTo(205, 0)
  })

  it('ponta reta não passa da ponta do traço; ponta quadrada passa meia grossura, sem arredondar', () => {
    const reta = contornoDoDesenho({ id: 'l', kind: 'line', x1: 100, y1: 100, x2: 200, y2: 100, color: COR, width: 10, cap: 'butt' })
    expect(reta).toHaveLength(1)
    const xsReta = reta[0].map((p) => p.x)
    expect(Math.min(...xsReta)).toBeGreaterThan(99.6)
    expect(Math.max(...xsReta)).toBeLessThan(200.4)

    const quadrada = contornoDoDesenho({ id: 'l', kind: 'line', x1: 100, y1: 100, x2: 200, y2: 100, color: COR, width: 10, cap: 'square' })
    expect(quadrada).toHaveLength(1)
    // Retângulo de 110 x 10 = 1100 px²; o estádio daria 100 x 10 + π·5² ≈ 1078.
    // A grade chanfra cada quina em no máximo meia célula (2 px² com passo 2).
    expect(area(quadrada[0])).toBeGreaterThan(1090)
    const xsQuadrada = quadrada[0].map((p) => p.x)
    expect(Math.min(...xsQuadrada)).toBeCloseTo(95, 0)
    expect(Math.max(...xsQuadrada)).toBeCloseTo(205, 0)
  })

  it('rabisco que faz laço: anel de fora + buraco dentro do laço, sem nenhum cruzamento', () => {
    const pontos = rabiscoComLaco()
    const aneis = contornoDoDesenho(freehand(pontos, 4))
    expect(aneis).toHaveLength(2)
    const fora = aneis.filter((anel) => area(anel) > 0)
    const buracos = aneis.filter((anel) => area(anel) < 0)
    expect(fora).toHaveLength(1)
    expect(buracos).toHaveLength(1)
    const olho = { x: 200, y: 188 }
    expect(dentro(olho, buracos[0])).toBe(true)
    expect(dentro(olho, fora[0])).toBe(true)
    expect(temCruzamento(aneis)).toBe(false)
    for (const anel of aneis) for (const p of anel) expect(Math.abs(distanciaAPolilinha(p, pontos) - 2)).toBeLessThan(0.6)
  })

  it('espiral que não encosta nela mesma vira um corredor só, fechado nas pontas', () => {
    const aneis = contornoDoDesenho(freehand(espiralSemEncostar(), 4))
    expect(aneis).toHaveLength(1)
    expect(area(aneis[0])).toBeGreaterThan(0)
    expect(temCruzamento(aneis)).toBe(false)
  })

  it('rabisco que se cruza várias vezes: anéis sem cruzamento, com buracos nos laços', () => {
    const aneis = contornoDoDesenho(freehand(rabiscoQueSeCruza(), 4))
    expect(aneis.filter((anel) => area(anel) > 0)).toHaveLength(1)
    expect(aneis.filter((anel) => area(anel) < 0).length).toBeGreaterThan(3)
    expect(temCruzamento(aneis)).toBe(false)
  })

  it('curva segue a mesma curva que o desenho mostra (Catmull-Rom achatada)', () => {
    const points = [{ x: 100, y: 100 }, { x: 200, y: 40 }, { x: 300, y: 160 }, { x: 380, y: 100 }]
    const aneis = contornoDoDesenho({ id: 'c', kind: 'curve', points, color: COR, width: 6 })
    expect(aneis).toHaveLength(1)
    const eixo = flattenCurve(points)
    for (const p of aneis[0]) expect(Math.abs(distanciaAPolilinha(p, eixo) - 3)).toBeLessThan(0.6)
  })

  it('marcador conta a grossura que aparece na tela, não a nominal', () => {
    const aneis = contornoDoDesenho(freehand([{ x: 0, y: 0 }, { x: 100, y: 0 }], 10, { texture: 'marker' }))
    const ys = aneis[0].map((p) => p.y)
    expect(Math.max(...ys)).toBeCloseTo(8.5, 0)
  })

  it('rabisco de ~600 px com traço de 4 px dá poucas centenas de segmentos, não milhares', () => {
    const pontos: DrawingPoint[] = []
    for (let x = 0; x <= 480; x += 4) pontos.push({ x, y: 100 + 50 * Math.sin(x / 40) + 0.6 * Math.sin(x * 1.7) })
    const segmentos = segmentosDasParedesDoDesenho(freehand(pontos, 4))
    expect(segmentos.length).toBeGreaterThan(20)
    expect(segmentos.length).toBeLessThan(400)
  })
})

describe('contornoDoDesenho — formas', () => {
  it('retângulo sem preenchimento, grossura 4: anel de fora e de dentro da faixa do traço', () => {
    const aneis = contornoDoDesenho({ id: 'r', kind: 'rect', x: 10, y: 10, w: 100, h: 50, color: COR, width: 4, filled: false, fillAlpha: 0 })
    expect(aneis).toEqual([
      [{ x: 8, y: 8 }, { x: 112, y: 8 }, { x: 112, y: 62 }, { x: 8, y: 62 }],
      [{ x: 12, y: 12 }, { x: 12, y: 58 }, { x: 108, y: 58 }, { x: 108, y: 12 }],
    ])
  })

  it('retângulo preenchido: só o anel de fora', () => {
    const aneis = contornoDoDesenho({ id: 'r', kind: 'rect', x: 10, y: 10, w: 100, h: 50, color: COR, width: 4, filled: true, fillAlpha: 1 })
    expect(aneis).toEqual([[{ x: 8, y: 8 }, { x: 112, y: 8 }, { x: 112, y: 62 }, { x: 8, y: 62 }]])
  })

  it('retângulo com traço mais grosso que ele mesmo não tem anel de dentro', () => {
    const aneis = contornoDoDesenho({ id: 'r', kind: 'rect', x: 0, y: 0, w: 6, h: 40, color: COR, width: 8, filled: false, fillAlpha: 0 })
    expect(aneis).toHaveLength(1)
  })

  it('círculo sem preenchimento: dois círculos, raio mais e menos meia grossura', () => {
    const aneis = contornoDoDesenho({ id: 'c', kind: 'circle', cx: 200, cy: 200, radius: 50, color: COR, width: 6, filled: false, fillAlpha: 0 })
    expect(aneis).toHaveLength(2)
    const [fora] = aneis.filter((anel) => area(anel) > 0)
    const [buraco] = aneis.filter((anel) => area(anel) < 0)
    for (const p of fora) expect(Math.hypot(p.x - 200, p.y - 200)).toBeCloseTo(53, 1)
    for (const p of buraco) expect(Math.hypot(p.x - 200, p.y - 200)).toBeCloseTo(47, 1)
  })

  it('círculo preenchido: um anel só', () => {
    const aneis = contornoDoDesenho({ id: 'c', kind: 'circle', cx: 200, cy: 200, radius: 50, color: COR, width: 6, filled: true, fillAlpha: 1 })
    expect(aneis).toHaveLength(1)
    expect(area(aneis[0])).toBeGreaterThan(0)
  })

  it('elipse e polígono sem preenchimento: anel de fora e de dentro, sem cruzamento', () => {
    const elipse = contornoDoDesenho({ id: 'e', kind: 'ellipse', cx: 300, cy: 200, rx: 120, ry: 60, color: COR, width: 4, filled: false, fillAlpha: 0 })
    expect(elipse).toHaveLength(2)
    expect(temCruzamento(elipse)).toBe(false)
    const triangulo = contornoDoDesenho({
      id: 'p', kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 150 }], color: COR, width: 6, filled: false, fillAlpha: 0,
    })
    expect(triangulo).toHaveLength(2)
    expect(triangulo.filter((anel) => area(anel) > 0)).toHaveLength(1)
    expect(temCruzamento(triangulo)).toBe(false)
  })

  it('polígono preenchido com traço: só o anel de fora, meia grossura para fora', () => {
    const aneis = contornoDoDesenho({
      id: 'p', kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], color: COR, width: 6, filled: true, fillAlpha: 1,
    })
    expect(aneis).toHaveLength(1)
    const xs = aneis[0].map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(-3, 0)
    expect(Math.max(...xs)).toBeCloseTo(203, 0)
  })
})

describe('contornoDoDesenho — pintura do balde', () => {
  it('quadrado pintado: o anel é o próprio contorno, sem o ponto alinhado', () => {
    const aneis = contornoDoDesenho({
      id: 'b', kind: 'polygon', color: COR, width: 0, filled: true, fillAlpha: 1,
      points: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 50 }, { x: 100, y: 0 }],
    })
    expect(aneis).toEqual([[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]])
  })

  it('pintura com buraco: anel de fora + buraco, sem a ponte da fechadura', () => {
    const drawings: Drawing[] = [
      { id: 'sala', kind: 'rect', x: 100, y: 100, w: 500, h: 500, color: COR, width: 4, filled: false, fillAlpha: 0 },
      { id: 'pilar', kind: 'circle', cx: 350, cy: 350, radius: 80, color: COR, width: 4, filled: false, fillAlpha: 0 },
    ]
    const contorno = areaDoBalde({ width: 10, height: 10, grid: 70, drawings }, { x: 200, y: 200 })
    if (!contorno) throw new Error('o balde não encheu')
    const pintura: Drawing = { id: 'tinta', kind: 'polygon', points: contorno, color: COR, width: 0, filled: true, fillAlpha: 1 }
    const aneis = contornoDoDesenho(pintura)
    expect(aneis).toHaveLength(2)
    const [fora] = aneis.filter((anel) => area(anel) > 0)
    const [buraco] = aneis.filter((anel) => area(anel) < 0)
    expect(dentro({ x: 350, y: 350 }, buraco)).toBe(true)
    expect(dentro({ x: 350, y: 350 }, fora)).toBe(true)
    // A área pintada (o polígono com a ponte) é exatamente fora menos buraco.
    expect(Math.abs(area(fora) + area(buraco) - Math.abs(area(contorno)))).toBeLessThan(5)
    // Cada canto da parede é um canto da pintura: a parede não inventa contorno.
    const cantos = new Set(contorno.map((p) => `${p.x},${p.y}`))
    for (const anel of aneis) for (const p of anel) expect(cantos.has(`${p.x},${p.y}`)).toBe(true)
    expect(temCruzamento(aneis)).toBe(false)
  })
})

describe('contornoDoDesenho — sem paredes', () => {
  it('texto e caminho não têm paredes; forma sem traço e sem preenchimento também não', () => {
    const texto: Drawing = { id: 't', kind: 'text', x: 0, y: 0, text: 'oi', color: COR, fontSize: 12 }
    const caminho: Drawing = { id: 'p', kind: 'path', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], color: COR, width: 70 }
    expect(contornoDoDesenho(texto)).toEqual([])
    expect(contornoDoDesenho(caminho)).toEqual([])
    expect(aceitaParedesAoRedor(texto)).toBe(false)
    expect(aceitaParedesAoRedor(caminho)).toBe(false)
    expect(aceitaParedesAoRedor(freehand(espiralSemEncostar(), 4))).toBe(true)
    expect(contornoDoDesenho({ id: 'r', kind: 'rect', x: 0, y: 0, w: 50, h: 50, color: COR, width: 0, filled: false, fillAlpha: 0 })).toEqual([])
  })

  it('traço de um ponto só ou com coordenada inválida não quebra', () => {
    expect(contornoDoDesenho(freehand([{ x: 10, y: 10 }], 4))).toEqual([])
    expect(contornoDoDesenho(freehand([{ x: Number.NaN, y: 0 }, { x: 10, y: 0 }], 4))).toEqual([])
  })
})

describe('segmentosDasParedesDoDesenho', () => {
  it('cada anel vira um segmento por lado, fechando no primeiro ponto', () => {
    const segmentos = segmentosDasParedesDoDesenho({ id: 'r', kind: 'rect', x: 10, y: 10, w: 100, h: 50, color: COR, width: 4, filled: false, fillAlpha: 0 })
    expect(segmentos).toHaveLength(8)
    expect(segmentos[0]).toEqual({ x1: 8, y1: 8, x2: 112, y2: 8 })
    expect(segmentos[3]).toEqual({ x1: 8, y1: 62, x2: 8, y2: 8 })
  })

  it('mesma entrada, mesma saída (para recriar as paredes quando o desenho muda)', () => {
    const desenho = freehand(rabiscoQueSeCruza(), 4)
    const primeira = segmentosDasParedesDoDesenho(desenho)
    expect(segmentosDasParedesDoDesenho(structuredClone(desenho))).toEqual(primeira)
    expect(segmentosDasParedesDoDesenho(desenho)).toEqual(primeira)
  })

  it('mover o desenho move as paredes junto, sem mudar a forma', () => {
    const pontos = rabiscoComLaco()
    const antes = segmentosDasParedesDoDesenho(freehand(pontos, 4))
    const depois = segmentosDasParedesDoDesenho(freehand(pontos.map((p) => ({ x: p.x + 64, y: p.y - 32 })), 4))
    expect(depois).toHaveLength(antes.length)
    depois.forEach((s, i) => {
      expect(s.x1).toBeCloseTo(antes[i].x1 + 64, 1)
      expect(s.y1).toBeCloseTo(antes[i].y1 - 32, 1)
    })
  })

  it('desempenho: rabisco de 500 pontos que se cruza em menos de 30 ms', () => {
    const desenho = freehand(rabiscoQueSeCruza(), 4)
    segmentosDasParedesDoDesenho(desenho)
    const inicio = performance.now()
    segmentosDasParedesDoDesenho(desenho)
    expect(performance.now() - inicio).toBeLessThan(30)
  })
})
