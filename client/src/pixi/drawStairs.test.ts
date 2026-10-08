import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawStairs, STAIR_RAIL_ALPHA } from './drawStairs'
import { SELECTION_COLOR, STAIR_COLOR, STAIR_PLATE_COLOR } from './constants'
import { WALL_COLOR, WALL_INTERIOR_ALPHA } from './drawWalls'
import { MIN_TREAD_GAP_SCREEN_PX } from './stairFlight'
import type { Point } from './world'
import type { Stair, StairDirection } from '../types/map'
import { DEFAULT_FLOOR_STYLE, LEGACY_FLOOR_STYLE } from '../lib/mapFile'
import { computeSpiralPlan, SPIRAL_POST_RATIO, type SpiralPlan } from '../lib/stairs'

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

// --------------------------------------------------------------------------
// LEITURA DAS INSTRUÇÕES DO PIXI
//
// O Graphics guarda o desenho como lista de instruções (preenchimento ou
// traço, cada uma com estilo e caminho). Os testes leem essa lista e, mais
// abaixo, rasterizam ela — o mesmo desenho que vai para a GPU, sem subir
// navegador.
// --------------------------------------------------------------------------

type Instrucao = Graphics['context']['instructions'][number]
/** Preenchimento ou traço: a escada não usa textura. */
type Pintura = Exclude<Instrucao, { action: 'texture' }>
type Traco = Extract<Pintura, { action: 'stroke' }>
type PassoDoCaminho = Pintura['data']['path']['instructions'][number]

function pinturas(g: Graphics): Pintura[] {
  return g.context.instructions.filter((i): i is Pintura => i.action === 'fill' || i.action === 'stroke')
}

function comoTraco(pintura: Pintura | undefined): Traco {
  if (pintura === undefined || pintura.action !== 'stroke') throw new Error('esperava um traço')
  return pintura
}

interface Forma {
  pontos: Point[]
  fechada: boolean
}

function comoPontos(dados: readonly number[] | readonly Point[]): Point[] {
  const pontos: Point[] = []
  for (let i = 0; i < dados.length; i += 1) {
    const dado = dados[i]
    if (typeof dado === 'number') {
      if (i % 2 === 0 && i + 1 < dados.length) pontos.push({ x: dado, y: dados[i + 1] as number })
    } else {
      pontos.push({ x: dado.x, y: dado.y })
    }
  }
  return pontos
}

/** Lados do polígono que faz as vezes de `circle` no rasterizador: a 100 px de raio, erra menos de 0,06 px. */
const LADOS_DO_CIRCULO = 96

/**
 * As formas de um caminho do Pixi: `moveTo` abre uma forma, `lineTo` estende,
 * `closePath` fecha; `poly`, `rect` e `circle` são formas inteiras (o círculo
 * vira um polígono de LADOS_DO_CIRCULO lados). O `moveTo` solto que o Pixi
 * deixa depois de cada fill/stroke vira forma de 1 ponto e é descartado, como
 * o próprio Pixi faz. Passo que a escada não usa quebra o teste em vez de
 * sumir calado.
 */
function formasDoCaminho(passos: readonly PassoDoCaminho[]): Forma[] {
  const formas: Forma[] = []
  let atual: Point[] = []
  const encerrar = (fechada: boolean) => {
    if (atual.length >= 2) formas.push({ pontos: atual, fechada })
    atual = []
  }
  for (const passo of passos) {
    switch (passo.action) {
      case 'moveTo':
        encerrar(false)
        atual = [{ x: passo.data[0], y: passo.data[1] }]
        break
      case 'lineTo':
        atual.push({ x: passo.data[0], y: passo.data[1] })
        break
      case 'closePath':
        encerrar(true)
        break
      case 'poly':
        encerrar(false)
        formas.push({ pontos: comoPontos(passo.data[0]), fechada: passo.data[1] === true })
        break
      case 'rect': {
        encerrar(false)
        const [x, y, w, h] = passo.data as number[]
        formas.push({ pontos: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], fechada: true })
        break
      }
      case 'circle': {
        encerrar(false)
        const [cx, cy, r] = passo.data as number[]
        const pontos: Point[] = []
        for (let i = 0; i < LADOS_DO_CIRCULO; i += 1) {
          const angulo = (2 * Math.PI * i) / LADOS_DO_CIRCULO
          pontos.push({ x: cx + Math.cos(angulo) * r, y: cy + Math.sin(angulo) * r })
        }
        formas.push({ pontos, fechada: true })
        break
      }
      default:
        throw new Error(`passo de caminho sem rasterizador no teste: ${passo.action}`)
    }
  }
  encerrar(false)
  return formas
}

interface Circulo {
  x: number
  y: number
  r: number
}

/** Os `circle` de um caminho do Pixi, com centro e raio exatos (sem virar polígono). */
function circulosDoCaminho(passos: readonly PassoDoCaminho[]): Circulo[] {
  const circulos: Circulo[] = []
  for (const passo of passos) {
    if (passo.action === 'circle') {
      const [x, y, r] = passo.data as number[]
      circulos.push({ x, y, r })
    }
  }
  return circulos
}

/** O que importa para comparar duas pinturas: ação, cor, opacidade, espessura e geometria. */
function resumo(pintura: Pintura) {
  return {
    acao: pintura.action,
    cor: pintura.data.style.color,
    alpha: pintura.data.style.alpha,
    largura: pintura.action === 'stroke' ? pintura.data.style.width : null,
    formas: formasDoCaminho(pintura.data.path.instructions),
  }
}

interface Caixa {
  x0: number
  x1: number
  y0: number
  y1: number
}

function caixaDe(pontos: readonly Point[]): Caixa {
  const xs = pontos.map((p) => p.x)
  const ys = pontos.map((p) => p.y)
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

function esperarCaixa(real: Caixa, esperada: Caixa): void {
  expect(real.x0).toBeCloseTo(esperada.x0, 9)
  expect(real.x1).toBeCloseTo(esperada.x1, 9)
  expect(real.y0).toBeCloseTo(esperada.y0, 9)
  expect(real.y1).toBeCloseTo(esperada.y1, 9)
}

describe('drawStairs — o lance é uma placa com degraus, não uma seta', () => {
  it('sem seleção: placa, patamar, degraus e moldura, nessa ordem, e nada em SELECTION_COLOR', () => {
    const g = new Graphics()
    drawStairs(g, [buildStair()], null)
    expect(pinturas(g).map((p) => [p.action, p.data.style.color])).toEqual([
      ['fill', STAIR_PLATE_COLOR],
      ['fill', STAIR_COLOR],
      ['stroke', STAIR_COLOR],
      ['stroke', STAIR_COLOR],
    ])
  })

  it('degraus são traços retos de ponta reta; a moldura é um retângulo de canto vivo', () => {
    const g = new Graphics()
    drawStairs(g, [buildStair()], null)
    const [, , degrausCrus, molduraCrua] = pinturas(g)
    const degraus = comoTraco(degrausCrus)
    const moldura = comoTraco(molduraCrua)
    for (const traco of [degraus, moldura]) {
      expect(traco.data.style.color).toBe(STAIR_COLOR)
      expect(traco.data.style.alpha).toBeCloseTo(STAIR_RAIL_ALPHA, 6)
    }

    expect(degraus.data.style.cap).toBe('butt')
    const formasDosDegraus = formasDoCaminho(degraus.data.path.instructions)
    expect(formasDosDegraus.length).toBeGreaterThan(3)
    for (const forma of formasDosDegraus) {
      expect(forma.fechada).toBe(false)
      expect(forma.pontos).toHaveLength(2)
    }

    expect(moldura.data.style.join).toBe('miter')
    const formasDaMoldura = formasDoCaminho(moldura.data.path.instructions)
    expect(formasDaMoldura).toHaveLength(1)
    expect(formasDaMoldura[0].fechada).toBe(true)
    expect(formasDaMoldura[0].pontos).toHaveLength(4)
  })

  it('escada em L: um lance desenhado por segmento', () => {
    const g = new Graphics()
    const emL = buildStair({
      shape: 'l',
      segments: [
        { x1: 0, y1: 0, x2: 256, y2: 0 },
        { x1: 256, y1: 0, x2: 256, y2: 256 },
      ],
    })
    drawStairs(g, [emL], null)
    expect(pinturas(g)).toHaveLength(8)
  })

  it('lance de comprimento zero não desenha nada', () => {
    const g = new Graphics()
    drawStairs(g, [buildStair({ segments: [{ x1: 5, y1: 5, x2: 5, y2: 5 }] })], null)
    expect(g.context.instructions).toHaveLength(0)
  })
})

describe('drawStairs — seleção como contorno por fora', () => {
  it('selecionada: o anel amarelo vem ANTES (por baixo) e a escada por cima fica igual à não selecionada', () => {
    const gPlain = new Graphics()
    const gSelected = new Graphics()
    drawStairs(gPlain, [buildStair()], null)
    drawStairs(gSelected, [buildStair()], 's1')

    const [anel, ...resto] = pinturas(gSelected)
    expect(comoTraco(anel).data.style.color).toBe(SELECTION_COLOR)
    expect(resto.map(resumo)).toEqual(pinturas(gPlain).map(resumo))
  })

  it('o anel tem espessura fixa na tela e encosta na placa por fora', () => {
    const anelNoZoom = (scale: number) => {
      const g = new Graphics()
      drawStairs(g, [buildStair()], 's1', scale)
      const anel = comoTraco(pinturas(g)[0])
      const formas = formasDoCaminho(anel.data.path.instructions)
      expect(formas).toHaveLength(1)
      expect(formas[0].fechada).toBe(true)
      expect(anel.data.style.join).toBe('miter')
      return { largura: anel.data.style.width, caixa: caixaDe(formas[0].pontos) }
    }
    // Placa em x [0, 200] e y [-32, 32]; o anel de SELECTION_OUTLINE_SCREEN_PX
    // (2 px de tela) corre do lado de fora, com a borda de dentro na placa.
    const perto = anelNoZoom(1)
    expect(perto.largura).toBeCloseTo(2, 9)
    esperarCaixa(perto.caixa, { x0: -1, x1: 201, y0: -33, y1: 33 })
    const longe = anelNoZoom(0.5)
    expect(longe.largura).toBeCloseTo(4, 9)
    esperarCaixa(longe.caixa, { x0: -2, x1: 202, y0: -34, y1: 34 })
  })
})

describe('drawStairs — opacidade de rascunho (prévia do arrasto, drawDraft.ts)', () => {
  /** A camada sem a opacidade: ação, cor, espessura e o caminho cru (a espiral usa `circle`). */
  const desenho = (pintura: Pintura) => ({
    acao: pintura.action,
    cor: pintura.data.style.color,
    largura: pintura.action === 'stroke' ? pintura.data.style.width : null,
    caminho: pintura.data.path.instructions,
  })

  it.each([
    { nome: 'lance reto', escada: buildStair() },
    { nome: 'espiral', escada: buildStair({ shape: 'spiral' }) },
  ])('$nome: `opacity` multiplica a opacidade de toda camada, realce incluso, sem mexer no desenho', ({ escada }) => {
    const cheia = new Graphics()
    const meia = new Graphics()
    drawStairs(cheia, [escada], 's1')
    drawStairs(meia, [escada], 's1', 1, 1, 0.5)
    expect(pinturas(meia).map(desenho)).toEqual(pinturas(cheia).map(desenho))
    expect(pinturas(cheia).some((pintura) => pintura.data.style.color === SELECTION_COLOR)).toBe(true)
    const opacidadesCheias = pinturas(cheia).map((pintura) => pintura.data.style.alpha)
    pinturas(meia).forEach((pintura, i) => expect(pintura.data.style.alpha).toBeCloseTo(opacidadesCheias[i] * 0.5, 9))
  })
})

// --------------------------------------------------------------------------
// A MEDIDA DA JORNADA, EM CIMA DO DESENHO
//
// `e2e/task-jornada-escada-legivel.spec.ts` fotografa o canvas e cobra dois
// números do que o mestre enxerga: (1) sobe e desce têm de diferir em pelo
// menos 25% dos pixels de tinta; (2) pelo menos 35% das colunas do lance têm de
// ter massa de degrau. As funções abaixo são a MESMA conta da jornada (copiada
// de lá — a jornada é fixa, não se edita), rodando sobre um rasterizador das
// instruções reais que `drawStairs` deixa no Graphics, em vez da foto do Pixi.
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

/** Regra par-ímpar, como o preenchimento do Pixi. */
function dentroDoPoligono(x: number, y: number, pontos: readonly Point[]): boolean {
  let dentro = false
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i, i += 1) {
    const a = pontos[i]
    const b = pontos[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro
  }
  return dentro
}

/** Faixa de `largura` centrada no segmento, esticada `estender` além de cada ponta. */
function dentroDoTraco(x: number, y: number, a: Point, b: Point, largura: number, estender: number): boolean {
  const comprimento = Math.hypot(b.x - a.x, b.y - a.y)
  if (comprimento === 0) return false
  const ux = (b.x - a.x) / comprimento
  const uy = (b.y - a.y) / comprimento
  const aoLongo = (x - a.x) * ux + (y - a.y) * uy
  const aoLado = (y - a.y) * ux - (x - a.x) * uy
  return aoLongo >= -estender && aoLongo <= comprimento + estender && Math.abs(aoLado) <= largura / 2
}

function arestas(forma: Forma): [Point, Point][] {
  const lados: [Point, Point][] = []
  for (let i = 1; i < forma.pontos.length; i += 1) lados.push([forma.pontos[i - 1], forma.pontos[i]])
  if (forma.fechada) lados.push([forma.pontos[forma.pontos.length - 1], forma.pontos[0]])
  return lados
}

/**
 * Pinta as instruções do Graphics num recorte (LARGURA x ALTURA, a janela da
 * jornada, se nada for dito) cujo canto de cima à esquerda está em `origem`
 * (mundo, zoom 1): amostra no centro de cada pixel, uma mistura por
 * instrução. Canto de moldura em `miter` = lados esticados meio traço; ponta
 * `butt` = sem esticar.
 */
function rasterizar(g: Graphics, origem: Point = { x: 0, y: 0 }, larguraDoRecorte = LARGURA, alturaDoRecorte = ALTURA): Recorte {
  const pixels = new Array<number>(larguraDoRecorte * alturaDoRecorte).fill(COR_DO_FUNDO)
  for (const pintura of pinturas(g)) {
    const formas = formasDoCaminho(pintura.data.path.instructions)
    const { color, alpha } = pintura.data.style
    let cobre: (x: number, y: number) => boolean
    if (pintura.action === 'stroke') {
      const largura = pintura.data.style.width
      cobre = (x, y) =>
        formas.some((forma) => arestas(forma).some(([a, b]) => dentroDoTraco(x, y, a, b, largura, forma.fechada ? largura / 2 : 0)))
    } else {
      cobre = (x, y) => formas.some((forma) => dentroDoPoligono(x, y, forma.pontos))
    }
    for (let y = 0; y < alturaDoRecorte; y += 1) {
      for (let x = 0; x < larguraDoRecorte; x += 1) {
        const indice = y * larguraDoRecorte + x
        if (cobre(origem.x + x + 0.5, origem.y + y + 0.5)) pixels[indice] = misturar(pixels[indice], color, alpha)
      }
    }
  }
  return { largura: larguraDoRecorte, altura: alturaDoRecorte, pixels }
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

/** Quantos pixels do recorte são tinta (a mais de LIMIAR_CANAL do fundo), como a jornada conta. */
function tintaDe(recorte: Recorte): number {
  const fundo = fundoDe(recorte)
  return recorte.pixels.filter((c) => distanciaCanal(c, fundo) > LIMIAR_CANAL).length
}

function fotografar(direction: StairDirection, origem: Point = { x: 0, y: 0 }): Recorte {
  const g = new Graphics()
  const segmento = { x1: origem.x + X_PE, y1: origem.y + ALTURA / 2, x2: origem.x + X_TOPO, y2: origem.y + ALTURA / 2 }
  drawStairs(g, [buildStair({ direction, stepWidth: STEP_WIDTH, segments: [segmento] })], null)
  return rasterizar(g, origem)
}

describe('drawStairs — cores que funcionam em chão claro e escuro', () => {
  it('a placa é chão para quem mede: sobre o canvas fica a no máximo LIMIAR_CANAL dele', () => {
    expect(distanciaCanal(tonsSobre(COR_DO_FUNDO).placa, COR_DO_FUNDO)).toBeLessThanOrEqual(LIMIAR_CANAL)
  })
})

// --------------------------------------------------------------------------
// O MIOLO PESA MENOS QUE A PAREDE
//
// Queixa de 28/09/2026: a placa em #1e1e1e chapado pesava no chão claro —
// chamava mais atenção que a parede e lia como buraco preto. A régua é o
// contraste WCAG (luminância relativa) do tom que cada camada deixa na tela
// sobre o chão, com a cor e a opacidade lidas das instruções que `drawStairs`
// deixa no Graphics. Em cada chão que o app pinta de verdade:
//   - PESO: a placa se separa do chão MENOS que a parede interna, a parede mais
//     fraca do mapa (WALL_COLOR a WALL_INTERIOR_ALPHA). Escada é desenho no
//     chão, não um furo nele.
//   - LEITURA: o degrau se separa da placa PELO MENOS tanto quanto a parede
//     interna se separa do chão. Tirar o peso não pode apagar o degrau.
// --------------------------------------------------------------------------

const deHex = (css: string): number => Number.parseInt(css.slice(1), 16)

const CHAOS_DE_REFERENCIA = [
  { nome: 'terracota do mapa novo', chao: deHex(DEFAULT_FLOOR_STYLE.fillColor) },
  { nome: 'verde do mapa antigo', chao: deHex(LEGACY_FLOOR_STYLE.fillColor) },
  // Cinzas das recriações de minimapa (lib/__fixtures__/hazardTower.ts e andar6.ts).
  { nome: 'cinza #3a3a3a', chao: 0x3a3a3a },
  { nome: 'cinza #2b2b2b, o mesmo do canvas vazio', chao: COR_DO_FUNDO },
]

/** Luminância relativa (WCAG 2.x) de uma cor 0xRRGGBB. */
function luminancia(cor: number): number {
  const linear = (deslocamento: number) => {
    const s = canal(cor, deslocamento) / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(16) + 0.7152 * linear(8) + 0.0722 * linear(0)
}

/** Razão de contraste WCAG: 1 para cores iguais, 21 para preto contra branco. */
function contraste(a: number, b: number): number {
  const [clara, escura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (clara + 0.05) / (escura + 0.05)
}

/** Quanto a parede interna se separa do chão: o teto do peso da placa e o piso da leitura do degrau. */
function contrasteDaParedeInterna(chao: number): number {
  return contraste(misturar(chao, WALL_COLOR, WALL_INTERIOR_ALPHA), chao)
}

/**
 * O tom que placa, patamar e degrau deixam na tela sobre `chao`, com a cor e a
 * opacidade que o Graphics realmente recebeu (ordem: placa, patamar, degraus,
 * moldura). Patamar e degrau caem em cima da placa.
 */
function tonsSobre(chao: number): { placa: number; patamar: number; degrau: number } {
  const g = new Graphics()
  drawStairs(g, [buildStair()], null)
  const [placa, patamar, degraus] = pinturas(g)
  const naPlaca = misturar(chao, placa.data.style.color, placa.data.style.alpha)
  return {
    placa: naPlaca,
    patamar: misturar(naPlaca, patamar.data.style.color, patamar.data.style.alpha),
    degrau: misturar(naPlaca, degraus.data.style.color, degraus.data.style.alpha),
  }
}

describe('drawStairs — o miolo pesa menos que a parede, em todo chão', () => {
  it.each(CHAOS_DE_REFERENCIA)('$nome: a placa se separa do chão menos que a parede interna', ({ chao }) => {
    expect(contraste(tonsSobre(chao).placa, chao)).toBeLessThan(contrasteDaParedeInterna(chao))
  })

  it.each(CHAOS_DE_REFERENCIA)('$nome: o degrau se separa da placa pelo menos tanto quanto a parede interna do chão', ({ chao }) => {
    const { placa, degrau } = tonsSobre(chao)
    expect(contraste(degrau, placa)).toBeGreaterThanOrEqual(contrasteDaParedeInterna(chao))
  })

  it.each(CHAOS_DE_REFERENCIA)('$nome: o patamar é um terceiro tom, longe da placa e do degrau', ({ chao }) => {
    const { placa, patamar, degrau } = tonsSobre(chao)
    expect(distanciaCanal(patamar, placa)).toBeGreaterThan(LIMIAR_CANAL)
    expect(distanciaCanal(patamar, degrau)).toBeGreaterThan(LIMIAR_CANAL)
  })
})

describe('drawStairs — o que o mestre vê sem selecionar nada', () => {
  const sobe = fotografar('up')
  const desce = fotografar('down')

  it('desenha tinta de verdade no recorte, como a jornada exige', () => {
    expect(tintaDe(sobe)).toBeGreaterThan(500)
    expect(tintaDe(desce)).toBeGreaterThan(500)
  })

  it('a escada que sobe e a que desce são desenhos diferentes, não a mesma com a seta trocada', () => {
    expect(fracaoDiferente(sobe, desce)).toBeGreaterThanOrEqual(DIFERENCA_SENTIDO_MINIMA)
  })

  it('controle negativo: duas escadas com o mesmo sentido, em lugares diferentes, continuam iguais', () => {
    expect(fracaoDiferente(sobe, fotografar('up', { x: 1000, y: 500 }))).toBeLessThan(DIFERENCA_IGUAL_MAXIMA)
  })

  it('o lance tem massa de degrau, não um pente de fios de cabelo com chão no meio', () => {
    expect(fracaoMassaDegrau(sobe)).toBeGreaterThanOrEqual(MASSA_DEGRAU_MINIMA)
    expect(fracaoMassaDegrau(desce)).toBeGreaterThanOrEqual(MASSA_DEGRAU_MINIMA)
  })

  it('o fundo da medida continua sendo chão: canvas ou placa, nunca degrau nem patamar', () => {
    const placaNoCanvas = tonsSobre(COR_DO_FUNDO).placa
    expect([COR_DO_FUNDO, placaNoCanvas]).toContain(fundoDe(sobe))
    expect([COR_DO_FUNDO, placaNoCanvas]).toContain(fundoDe(desce))
  })
})

// --------------------------------------------------------------------------
// ESPIRAL: O LANCE RETO ENROLADO NO POSTE
//
// A espiral fala a mesma língua do lance reto: placa translúcida no disco,
// patamar no último quarto da volta, degraus finos com o peso, a opacidade e o
// passo do degrau reto (raios de poste a aro, apertando no pé e abrindo rumo ao
// patamar) e contorno de 1 px no aro e no poste. O sentido se lê pelo patamar
// e pelo ritmo, sem seta: a espiral que desce é o espelho da que sobe no eixo
// da boca. Espiral dos testes: o lance padrão (0,0)-(200,0) é o diâmetro, então
// o disco tem centro (100,0), raio 100 e a boca em (0,0).
// --------------------------------------------------------------------------

describe('drawStairs — a espiral fala a língua do lance reto', () => {
  const CENTRO: Point = { x: 100, y: 0 }
  const espiral = (overrides: Partial<Stair> = {}) => buildStair({ shape: 'spiral', ...overrides })

  function planoDe(direction: StairDirection): SpiralPlan {
    const plano = computeSpiralPlan({ x1: 0, y1: 0, x2: 200, y2: 0 }, direction)
    if (plano === null) throw new Error('a espiral dos testes tem diâmetro')
    return plano
  }

  /** Ângulo andado desde a boca, no sentido da subida, até o ponto: 0 na boca, 2π na volta inteira. */
  function varreduraDe(ponto: Point, plano: SpiralPlan): number {
    const volta = 2 * Math.PI
    const angulo = Math.atan2(ponto.y - plano.center.y, ponto.x - plano.center.x)
    return (((plano.turn * (angulo - plano.mouthAngle)) % volta) + volta) % volta
  }

  function camadasDaEspiral(g: Graphics) {
    const camadas = pinturas(g)
    expect(camadas).toHaveLength(4)
    const [placa, patamar, degraus, contorno] = camadas
    return { placa, patamar, degraus: comoTraco(degraus), contorno: comoTraco(contorno) }
  }

  /** Poste e aro do contorno, do menor para o maior raio. */
  function posteEAro(contorno: Traco): [Circulo, Circulo] {
    const circulos = circulosDoCaminho(contorno.data.path.instructions).sort((a, b) => a.r - b.r)
    expect(circulos).toHaveLength(2)
    return [circulos[0], circulos[1]]
  }

  const distanciaAoCentro = (p: Point) => Math.hypot(p.x - CENTRO.x, p.y - CENTRO.y)

  it.each(['up', 'down'] as const)('%s: placa, patamar, degraus e contorno, com a cor e a opacidade de cada camada do lance reto', (direction) => {
    const reta = new Graphics()
    const torre = new Graphics()
    drawStairs(reta, [buildStair({ direction })], null)
    drawStairs(torre, [espiral({ direction })], null)
    const tinta = (g: Graphics) => pinturas(g).map((p) => [p.action, p.data.style.color, p.data.style.alpha])
    expect(tinta(torre)).toEqual(tinta(reta))
  })

  it.each([1, 0.5, 2])('zoom %s: cada degrau é um raio reto de ponta reta, do poste ao aro, com a espessura do degrau reto', (scale) => {
    const reta = new Graphics()
    const torre = new Graphics()
    drawStairs(reta, [buildStair()], null, scale)
    drawStairs(torre, [espiral()], null, scale)
    const degrauReto = comoTraco(pinturas(reta)[2])
    const { degraus, contorno } = camadasDaEspiral(torre)
    expect(degraus.data.style.width).toBeCloseTo(degrauReto.data.style.width, 9)
    expect(degraus.data.style.cap).toBe('butt')

    const [poste, aro] = posteEAro(contorno)
    const traco = contorno.data.style.width
    const formas = formasDoCaminho(degraus.data.path.instructions)
    expect(formas.length).toBeGreaterThan(3)
    for (const forma of formas) {
      expect(forma.fechada).toBe(false)
      expect(forma.pontos).toHaveLength(2)
      const [a, b] = forma.pontos.map((p) => ({ x: p.x - CENTRO.x, y: p.y - CENTRO.y }))
      // Raio de verdade: as duas pontas no mesmo ângulo, vistas do centro.
      expect(a.x * b.y - a.y * b.x).toBeCloseTo(0, 6)
      expect(a.x * b.x + a.y * b.y).toBeGreaterThan(0)
      // Encosta por dentro no traço do poste e no do aro, sem cruzar nenhum dos dois.
      const [dentro, fora] = forma.pontos.map(distanciaAoCentro).sort((x, y) => x - y)
      expect(dentro).toBeCloseTo(poste.r + traco / 2, 9)
      expect(fora).toBeCloseTo(aro.r - traco / 2, 9)
    }
  })

  it('o contorno é o traço de 1 px da moldura, no aro e no poste; a placa é o disco inteiro', () => {
    const reta = new Graphics()
    const torre = new Graphics()
    drawStairs(reta, [buildStair()], null)
    drawStairs(torre, [espiral()], null)
    const moldura = comoTraco(pinturas(reta)[3])
    const { placa, contorno } = camadasDaEspiral(torre)
    const traco = contorno.data.style.width
    expect(traco).toBeCloseTo(moldura.data.style.width, 9)
    expect(contorno.data.style.alpha).toBeCloseTo(STAIR_RAIL_ALPHA, 9)

    const [poste, aro] = posteEAro(contorno)
    for (const circulo of [poste, aro]) {
      expect(circulo.x).toBeCloseTo(CENTRO.x, 9)
      expect(circulo.y).toBeCloseTo(CENTRO.y, 9)
    }
    // O aro corre por dentro da borda do disco, como a moldura por dentro da
    // placa; o traço do poste corre por fora dele, do lado dos degraus.
    expect(aro.r + traco / 2).toBeCloseTo(100, 9)
    expect(poste.r - traco / 2).toBeCloseTo(100 * SPIRAL_POST_RATIO, 9)

    const disco = circulosDoCaminho(placa.data.path.instructions)
    expect(disco).toHaveLength(1)
    expect(disco[0].x).toBeCloseTo(CENTRO.x, 9)
    expect(disco[0].y).toBeCloseTo(CENTRO.y, 9)
    expect(disco[0].r).toBeCloseTo(100, 9)
  })

  it.each([
    { scale: 1, largura: 2 },
    { scale: 0.5, largura: 4 },
  ])('zoom $scale: selecionada, um anel de SELECTION_COLOR com $largura de mundo por fora do disco, e a espiral por cima igual à não selecionada', ({ scale, largura }) => {
    const simples = new Graphics()
    const marcada = new Graphics()
    drawStairs(simples, [espiral()], null, scale)
    drawStairs(marcada, [espiral()], 's1', scale)
    const [anelCru, ...resto] = pinturas(marcada)
    const anel = comoTraco(anelCru)
    expect(anel.data.style.color).toBe(SELECTION_COLOR)
    expect(anel.data.style.width).toBeCloseTo(largura, 9)
    expect(formasDoCaminho(anel.data.path.instructions)).toHaveLength(1)
    const circulos = circulosDoCaminho(anel.data.path.instructions)
    expect(circulos).toHaveLength(1)
    expect(circulos[0].x).toBeCloseTo(CENTRO.x, 9)
    expect(circulos[0].y).toBeCloseTo(CENTRO.y, 9)
    // Borda de dentro do anel na borda do disco: encosta por fora, não cobre o aro.
    expect(circulos[0].r - largura / 2).toBeCloseTo(100, 9)
    expect(resto.map(resumo)).toEqual(pinturas(simples).map(resumo))
  })

  it('o patamar é o último quarto da volta, entre poste e aro; o da que desce é o espelho do da que sobe', () => {
    const patamarDe = (direction: StairDirection) => {
      const g = new Graphics()
      drawStairs(g, [espiral({ direction })], null)
      const { patamar, contorno } = camadasDaEspiral(g)
      expect(patamar.action).toBe('fill')
      expect(patamar.data.style.color).toBe(STAIR_COLOR)
      const formas = formasDoCaminho(patamar.data.path.instructions)
      expect(formas).toHaveLength(1)
      return { pontos: formas[0].pontos, contorno }
    }
    const centroide = (pontos: readonly Point[]): Point => ({
      x: pontos.reduce((soma, p) => soma + p.x, 0) / pontos.length,
      y: pontos.reduce((soma, p) => soma + p.y, 0) / pontos.length,
    })
    const sobe = patamarDe('up')
    const desce = patamarDe('down')
    // Boca à esquerda. Quem sobe gira no sentido horário da tela (esquerda,
    // topo, direita, baixo): o patamar fecha a volta embaixo, à esquerda. Quem
    // desce entra pela boca direto no patamar, que fica em cima, à esquerda.
    expect(centroide(sobe.pontos).x).toBeLessThan(CENTRO.x)
    expect(centroide(sobe.pontos).y).toBeGreaterThan(CENTRO.y)
    expect(centroide(desce.pontos).x).toBeLessThan(CENTRO.x)
    expect(centroide(desce.pontos).y).toBeLessThan(CENTRO.y)
    expect(desce.pontos).toHaveLength(sobe.pontos.length)
    sobe.pontos.forEach((p, i) => {
      expect(desce.pontos[i].x).toBeCloseTo(p.x, 9)
      expect(desce.pontos[i].y).toBeCloseTo(-p.y, 9)
    })

    for (const [direction, { pontos, contorno }] of [['up', sobe], ['down', desce]] as const) {
      const plano = planoDe(direction)
      const [poste, aro] = posteEAro(contorno)
      const traco = contorno.data.style.width
      for (const ponto of pontos) {
        let phi = varreduraDe(ponto, plano)
        if (phi < 1e-6) phi += 2 * Math.PI
        expect(phi).toBeGreaterThanOrEqual(plano.climbSweep - 1e-9)
        expect(phi).toBeLessThanOrEqual(2 * Math.PI + 1e-9)
        const r = distanciaAoCentro(ponto)
        expect(r).toBeGreaterThanOrEqual(poste.r + traco / 2 - 1e-9)
        expect(r).toBeLessThanOrEqual(aro.r - traco / 2 + 1e-9)
      }
    }
  })

  it.each(['up', 'down'] as const)('%s: da boca rumo ao patamar os degraus se abrem, como no lance reto', (direction) => {
    const g = new Graphics()
    drawStairs(g, [espiral({ direction })], null)
    const plano = planoDe(direction)
    const { degraus } = camadasDaEspiral(g)
    const varreduras = formasDoCaminho(degraus.data.path.instructions)
      .map((forma) => varreduraDe(forma.pontos[0], plano))
      .sort((a, b) => a - b)
    for (const phi of varreduras) {
      expect(phi).toBeGreaterThan(0)
      expect(phi).toBeLessThan(plano.climbSweep)
    }
    const marcos = [0, ...varreduras, plano.climbSweep]
    const vaos = marcos.slice(1).map((marco, i) => marco - marcos[i])
    for (let i = 1; i < vaos.length; i += 1) expect(vaos[i]).toBeGreaterThan(vaos[i - 1])
  })

  it.each([2, 1, 0.5, 0.25, 0.1])('zoom %s: todo vão entre degraus, e entre degrau e boca ou patamar, fica aberto na tela', (scale) => {
    const g = new Graphics()
    drawStairs(g, [espiral()], null, scale)
    const plano = planoDe('up')
    const { degraus } = camadasDaEspiral(g)
    const larguraDoDegrau = degraus.data.style.width
    const formas = formasDoCaminho(degraus.data.path.instructions)
    expect(formas.length).toBeGreaterThanOrEqual(1)
    const [dentro, fora] = formas[0].pontos.map(distanciaAoCentro).sort((a, b) => a - b)
    const meio = (dentro + fora) / 2
    const varreduras = formas.map((forma) => varreduraDe(forma.pontos[0], plano)).sort((a, b) => a - b)
    const marcos = [0, ...varreduras, plano.climbSweep]
    for (let i = 1; i < marcos.length; i += 1) {
      const ponta = i === 1 || i === marcos.length - 1
      const angulo = marcos[i] - marcos[i - 1]
      const comido = ponta ? larguraDoDegrau / 2 : larguraDoDegrau
      expect(angulo * meio * scale - comido * scale).toBeGreaterThanOrEqual(MIN_TREAD_GAP_SCREEN_PX - 1e-6)
      // Perto do poste, onde os raios se juntam, o vão só precisa não fechar.
      if (!ponta) expect(angulo * dentro - larguraDoDegrau).toBeGreaterThan(0)
    }
  })

  it.each([
    { nome: 'a de 3 células a 200%', diametro: 192, scale: 2 },
    { nome: 'a de 5 células a 100%, que virava roda de carroça', diametro: 320, scale: 1 },
  ])('$nome: de perto, o ritmo do lance reto — tantos degraus quanto o lance com a largura do degrau da espiral e a subida dela', ({ diametro, scale }) => {
    // O degrau da espiral vai do poste ao aro; a subida se mede na linha do
    // meio do degrau. O lance reto equivalente tem essa largura e essa subida
    // antes do patamar (o patamar reto tem um degrau de fundo). Nesses zooms
    // nenhum dos dois perde degrau por estar longe.
    const torre = espiral({ segments: [{ x1: 0, y1: 0, x2: diametro, y2: 0 }] })
    const plano = computeSpiralPlan(torre.segments[0], 'up')
    if (plano === null) throw new Error('a espiral do teste tem diâmetro')
    const largura = plano.radius - plano.postRadius
    const subida = plano.climbSweep * ((plano.radius + plano.postRadius) / 2)
    const degrausDe = (escada: Stair) => {
      const g = new Graphics()
      drawStairs(g, [escada], null, scale)
      return formasDoCaminho(comoTraco(pinturas(g)[2]).data.path.instructions).length
    }
    const naEspiral = degrausDe(torre)
    const noLance = degrausDe(buildStair({ stepWidth: largura, segments: [{ x1: 0, y1: 0, x2: subida + largura, y2: 0 }] }))
    expect(naEspiral).toBe(noLance)
    expect(naEspiral).toBeGreaterThan(20)
  })

  it('de longe, menos degraus, como no lance reto', () => {
    const contar = (scale: number) => {
      const g = new Graphics()
      drawStairs(g, [espiral()], null, scale)
      return formasDoCaminho(camadasDaEspiral(g).degraus.data.path.instructions).length
    }
    expect(contar(0.1)).toBeLessThan(contar(1))
  })

  describe('o que o mestre vê sem selecionar nada', () => {
    function fotografarEspiral(direction: StairDirection, origem: Point = { x: 0, y: 0 }): Recorte {
      const g = new Graphics()
      const diametro = { x1: origem.x + 10, y1: origem.y + 90, x2: origem.x + 170, y2: origem.y + 90 }
      drawStairs(g, [espiral({ direction, segments: [diametro] })], null)
      return rasterizar(g, origem, 180, 180)
    }
    const sobe = fotografarEspiral('up')
    const desce = fotografarEspiral('down')

    it('desenha tinta de verdade no recorte', () => {
      expect(tintaDe(sobe)).toBeGreaterThan(500)
      expect(tintaDe(desce)).toBeGreaterThan(500)
    })

    it('a espiral que sobe e a que desce são desenhos diferentes', () => {
      expect(fracaoDiferente(sobe, desce)).toBeGreaterThanOrEqual(DIFERENCA_SENTIDO_MINIMA)
    })

    it('controle negativo: duas espirais com o mesmo sentido, em lugares diferentes, continuam iguais', () => {
      expect(fracaoDiferente(sobe, fotografarEspiral('up', { x: 1000, y: 500 }))).toBeLessThan(DIFERENCA_IGUAL_MAXIMA)
    })
  })
})
