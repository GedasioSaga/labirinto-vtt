import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawStairs, treadAlpha, STAIR_RAIL_ALPHA, STAIR_TREAD_ALPHA_AT_FOOT } from './drawStairs'
import { SELECTION_COLOR, STAIR_COLOR } from './constants'
import { computeStairPlan, type StairPlan } from '../lib/stairs'
import type { Point } from './world'
import type { Stair, StairDirection } from '../types/map'

function buildStair(overrides: Partial<Stair> = {}): Stair {
  return {
    id: 's1',
    shape: 'straight',
    segments: [{ x1: 0, y1: 0, x2: 200, y2: 0 }],
    stepWidth: 64,
    direction: 'up',
    ...overrides,
  } as Stair
}

function strokes(g: Graphics) {
  return g.context.instructions.filter((i) => i.action === 'stroke')
}

describe('drawStairs — seleção como contorno por fora', () => {
  it('sem seleção: nada em SELECTION_COLOR', () => {
    const g = new Graphics()
    drawStairs(g, [buildStair()], null)
    expect(strokes(g).some((s) => s.data.style.color === SELECTION_COLOR)).toBe(false)
  })

  it('selecionada: contorno amarelo vem ANTES (por baixo) e a escada real mantém a cor dela', () => {
    const gPlain = new Graphics()
    const gSelected = new Graphics()
    drawStairs(gPlain, [buildStair()], null)
    drawStairs(gSelected, [buildStair()], 's1')

    const selectedStrokes = strokes(gSelected)
    const yellow = selectedStrokes.filter((s) => s.data.style.color === SELECTION_COLOR)
    const real = selectedStrokes.filter((s) => s.data.style.color !== SELECTION_COLOR)
    expect(yellow.length).toBeGreaterThan(0)
    // Os traços reais são idênticos aos da escada não selecionada: nada pintado de amarelo.
    expect(real.map((s) => [s.data.style.color, s.data.style.width])).toEqual(
      strokes(gPlain).map((s) => [s.data.style.color, s.data.style.width]),
    )
    expect(real.every((s) => s.data.style.color === STAIR_COLOR)).toBe(true)
    expect(selectedStrokes.indexOf(yellow[yellow.length - 1])).toBeLessThan(selectedStrokes.indexOf(real[0]))
  })

  it('o realce acompanha cada traço: mesma sobra em todos, do fio de cabelo ao degrau mais gordo', () => {
    const g = new Graphics()
    const stair = buildStair()
    drawStairs(g, [stair], 's1')
    const traços = strokes(g)
    const amarelos = traços.filter((s) => s.data.style.color === SELECTION_COLOR)
    const reais = traços.filter((s) => s.data.style.color !== SELECTION_COLOR)
    expect(amarelos).toHaveLength(reais.length)
    // SELECTION_OUTLINE_SCREEN_PX (2) de cada lado do traço que ele realça
    for (const [i, amarelo] of amarelos.entries()) {
      expect(amarelo.data.style.width).toBeCloseTo(reais[i].data.style.width + 4, 6)
    }
  })

  it('a sobra do realce é fixa na tela: a 50% de zoom fica 2x mais larga em mundo', () => {
    const sobraDoRealce = (scale: number) => {
      const g = new Graphics()
      drawStairs(g, [buildStair()], 's1', scale)
      const traços = strokes(g)
      const amarelo = traços.find((s) => s.data.style.color === SELECTION_COLOR)
      const real = traços.find((s) => s.data.style.color !== SELECTION_COLOR)
      if (!amarelo || !real) throw new Error('lance válido não desenhou realce')
      return amarelo.data.style.width - real.data.style.width
    }
    expect(sobraDoRealce(1)).toBeCloseTo(4, 6)
    expect(sobraDoRealce(0.5)).toBeCloseTo(8, 6)
  })
})

describe('drawStairs — degrau que aponta, engorda e clareia', () => {
  it('um traço por degrau mais um pelas duas vigas, e o tom clareia ladeira acima', () => {
    const g = new Graphics()
    const stair = buildStair()
    drawStairs(g, [stair], null)
    const plan = computeStairPlan(stair.segments[0], stair.stepWidth, stair.direction)
    if (!plan) throw new Error('lance válido devolveu null')

    const traços = strokes(g)
    expect(traços).toHaveLength(plan.treads.length + 1)
    // O primeiro é o das vigas: fio de cabelo, alpha de viga.
    expect((traços[0].data.style as { alpha: number }).alpha).toBeCloseTo(STAIR_RAIL_ALPHA, 6)

    const degraus = traços.slice(1)
    expect((degraus[0].data.style as { alpha: number }).alpha).toBeCloseTo(STAIR_TREAD_ALPHA_AT_FOOT, 6)
    expect((degraus[degraus.length - 1].data.style as { alpha: number }).alpha).toBeCloseTo(1, 6)
    for (let i = 1; i < degraus.length; i += 1) {
      const anterior = (degraus[i - 1].data.style as { alpha: number; width: number }).alpha
      const atual = (degraus[i].data.style as { alpha: number; width: number }).alpha
      expect(atual).toBeGreaterThan(anterior)
      expect(degraus[i].data.style.width).toBeGreaterThan(degraus[i - 1].data.style.width)
    }
  })

  it('degrau tem piso de 1 px de tela: some o zoom, não some o degrau', () => {
    const g = new Graphics()
    // Lance minúsculo em zoom de longe: a espessura em mundo cairia abaixo de 1 px de tela.
    drawStairs(g, [buildStair({ stepWidth: 4 })], null, 0.25)
    for (const traço of strokes(g).slice(1)) expect(traço.data.style.width).toBeGreaterThanOrEqual(4)
  })

  it('lance de comprimento zero não desenha nada', () => {
    const g = new Graphics()
    drawStairs(g, [buildStair({ segments: [{ x1: 5, y1: 5, x2: 5, y2: 5 }] })], null)
    expect(g.context.instructions).toHaveLength(0)
  })
})

// --------------------------------------------------------------------------
// A MEDIDA DA JORNADA, EM CIMA DA GEOMETRIA
//
// `e2e/task-jornada-escada-legivel.spec.ts` fotografa o canvas e cobra dois
// números do que o mestre enxerga: (1) sobe e desce têm de diferir em pelo
// menos 25% dos pixels de tinta; (2) pelo menos 35% das colunas do lance têm de
// ter massa de degrau. As funções abaixo são a MESMA conta da jornada (copiada
// de lá — a jornada é fixa, não se edita), rodando sobre um rasterizador do
// plano em vez da foto do Pixi.
//
// Diferença conhecida e assumida: aqui não há antialias, então a borda sai
// dura. Serve para dimensionar a margem sem subir navegador; quem decide é a
// jornada, com ponteiro de verdade.
// --------------------------------------------------------------------------

const LIMIAR_CANAL = 24
const DIFERENCA_SENTIDO_MINIMA = 0.25
const DIFERENCA_IGUAL_MAXIMA = 0.02
const MASSA_DEGRAU_MINIMA = 0.35

/** Fundo do canvas do editor (PixiCanvas.tsx). */
const COR_DO_FUNDO = 0x2b2b2b
/** Mesma janela da jornada: recorte de 290 x 80 px com o lance no meio. */
const LARGURA = 290
const ALTURA = 80
const X_PE = 15
const X_TOPO = 271
const STEP_WIDTH = 64

interface Recorte {
  largura: number
  altura: number
  pixels: number[]
}

const canal = (cor: number, deslocamento: number): number => (cor >> deslocamento) & 255

const distanciaCanal = (a: number, b: number): number =>
  Math.max(Math.abs(canal(a, 16) - canal(b, 16)), Math.abs(canal(a, 8) - canal(b, 8)), Math.abs(canal(a, 0) - canal(b, 0)))

function misturar(base: number, tinta: number, alpha: number): number {
  const mistura = (deslocamento: number) =>
    Math.round(canal(base, deslocamento) + (canal(tinta, deslocamento) - canal(base, deslocamento)) * alpha)
  return (mistura(16) << 16) | (mistura(8) << 8) | mistura(0)
}

function distanciaAoSegmento(x: number, y: number, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const comprimento = dx * dx + dy * dy
  const t = comprimento === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / comprimento))
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t))
}

const distanciaAoCaminho = (x: number, y: number, pontos: readonly Point[]): number => {
  let menor = Infinity
  for (let i = 1; i < pontos.length; i += 1) menor = Math.min(menor, distanciaAoSegmento(x, y, pontos[i - 1], pontos[i]))
  return menor
}

/** Pinta o plano do jeito que `drawStairs` pinta: vigas finas e degraus por cima. */
function rasterizar(plan: StairPlan): Recorte {
  const pixels = new Array<number>(LARGURA * ALTURA).fill(COR_DO_FUNDO)
  for (let y = 0; y < ALTURA; y += 1) {
    for (let x = 0; x < LARGURA; x += 1) {
      const cx = x + 0.5
      const cy = y + 0.5
      const indice = y * LARGURA + x
      for (const rail of plan.rails) {
        if (distanciaAoCaminho(cx, cy, rail) <= 0.5) pixels[indice] = misturar(pixels[indice], STAIR_COLOR, STAIR_RAIL_ALPHA)
      }
      for (const tread of plan.treads) {
        if (distanciaAoCaminho(cx, cy, tread.points) <= tread.width / 2) {
          pixels[indice] = misturar(pixels[indice], STAIR_COLOR, treadAlpha(tread.climb))
        }
      }
    }
  }
  return { largura: LARGURA, altura: ALTURA, pixels }
}

function fundoDe(recorte: Recorte): number {
  const contagem = new Map<number, number>()
  for (const c of recorte.pixels) contagem.set(c, (contagem.get(c) ?? 0) + 1)
  let fundo = 0
  let maior = -1
  for (const [cor, n] of contagem) {
    if (n > maior) {
      maior = n
      fundo = cor
    }
  }
  return fundo
}

function fracaoDiferente(a: Recorte, b: Recorte): number {
  const fundoA = fundoDe(a)
  const fundoB = fundoDe(b)
  let uniao = 0
  let diferentes = 0
  for (let i = 0; i < a.pixels.length; i += 1) {
    const ehTinta = distanciaCanal(a.pixels[i], fundoA) > LIMIAR_CANAL || distanciaCanal(b.pixels[i], fundoB) > LIMIAR_CANAL
    if (!ehTinta) continue
    uniao += 1
    if (distanciaCanal(a.pixels[i], b.pixels[i]) > LIMIAR_CANAL) diferentes += 1
  }
  return uniao === 0 ? 0 : diferentes / uniao
}

function fracaoMassaDegrau(recorte: Recorte): number {
  const fundo = fundoDe(recorte)
  const massa: number[] = []
  for (let x = 0; x < recorte.largura; x += 1) {
    let m = 0
    for (let y = 0; y < recorte.altura; y += 1) {
      if (distanciaCanal(recorte.pixels[y * recorte.largura + x], fundo) > LIMIAR_CANAL) m += 1
    }
    massa.push(m)
  }
  const maisCheia = Math.max(...massa)
  if (maisCheia === 0) return 0
  const primeira = massa.findIndex((m) => m > 0)
  let ultima = primeira
  for (let x = 0; x < massa.length; x += 1) if (massa[x] > 0) ultima = x
  let cheias = 0
  for (let x = primeira; x <= ultima; x += 1) if (massa[x] >= maisCheia / 2) cheias += 1
  return cheias / (ultima - primeira + 1)
}

function fotografar(direction: StairDirection): Recorte {
  const plan = computeStairPlan({ x1: X_PE, y1: ALTURA / 2, x2: X_TOPO, y2: ALTURA / 2 }, STEP_WIDTH, direction)
  if (!plan) throw new Error('lance válido devolveu null')
  return rasterizar(plan)
}

describe('drawStairs — o que o mestre vê sem selecionar nada', () => {
  const sobe = fotografar('up')
  const desce = fotografar('down')

  it('a escada que sobe e a que desce são desenhos diferentes, não a mesma com a seta trocada', () => {
    expect(fracaoDiferente(sobe, desce)).toBeGreaterThanOrEqual(DIFERENCA_SENTIDO_MINIMA)
  })

  it('controle negativo: duas escadas com o mesmo sentido continuam iguais', () => {
    expect(fracaoDiferente(sobe, fotografar('up'))).toBeLessThan(DIFERENCA_IGUAL_MAXIMA)
  })

  it('o lance tem massa de degrau, não um pente de fios de cabelo com chão no meio', () => {
    expect(fracaoMassaDegrau(sobe)).toBeGreaterThanOrEqual(MASSA_DEGRAU_MINIMA)
    expect(fracaoMassaDegrau(desce)).toBeGreaterThanOrEqual(MASSA_DEGRAU_MINIMA)
  })

  it('o chão continua sendo a cor mais comum do recorte: a escada não vira o fundo', () => {
    expect(fundoDe(sobe)).toBe(COR_DO_FUNDO)
  })
})
