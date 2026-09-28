import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { drawStairs, STAIR_RAIL_ALPHA } from './drawStairs'
import { SELECTION_COLOR, STAIR_COLOR, STAIR_LANDING_COLOR, STAIR_PLATE_COLOR } from './constants'
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

/**
 * As formas de um caminho do Pixi: `moveTo` abre uma forma, `lineTo` estende,
 * `closePath` fecha; `poly` e `rect` são formas inteiras. O `moveTo` solto que
 * o Pixi deixa depois de cada fill/stroke vira forma de 1 ponto e é
 * descartado, como o próprio Pixi faz. Passo que a escada não usa quebra o
 * teste em vez de sumir calado.
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
      default:
        throw new Error(`passo de caminho sem rasterizador no teste: ${passo.action}`)
    }
  }
  encerrar(false)
  return formas
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
      ['fill', STAIR_LANDING_COLOR],
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
 * Pinta as instruções do Graphics num recorte de LARGURA x ALTURA cujo canto
 * de cima à esquerda está em `origem` (mundo, zoom 1): amostra no centro de
 * cada pixel, uma mistura por instrução. Canto de moldura em `miter` = lados
 * esticados meio traço; ponta `butt` = sem esticar.
 */
function rasterizar(g: Graphics, origem: Point = { x: 0, y: 0 }): Recorte {
  const pixels = new Array<number>(LARGURA * ALTURA).fill(COR_DO_FUNDO)
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
    for (let y = 0; y < ALTURA; y += 1) {
      for (let x = 0; x < LARGURA; x += 1) {
        const indice = y * LARGURA + x
        if (cobre(origem.x + x + 0.5, origem.y + y + 0.5)) pixels[indice] = misturar(pixels[indice], color, alpha)
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
  it('a placa é chão para quem mede: fica a no máximo LIMIAR_CANAL do fundo do canvas', () => {
    expect(distanciaCanal(STAIR_PLATE_COLOR, COR_DO_FUNDO)).toBeLessThanOrEqual(LIMIAR_CANAL)
  })

  it('o patamar se separa da placa e do degrau: é um terceiro tom, não um degrau largo', () => {
    expect(distanciaCanal(STAIR_LANDING_COLOR, STAIR_PLATE_COLOR)).toBeGreaterThan(LIMIAR_CANAL)
    const degrauSobreAPlaca = misturar(STAIR_PLATE_COLOR, STAIR_COLOR, STAIR_RAIL_ALPHA)
    expect(distanciaCanal(STAIR_LANDING_COLOR, degrauSobreAPlaca)).toBeGreaterThan(LIMIAR_CANAL)
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
    expect([COR_DO_FUNDO, STAIR_PLATE_COLOR]).toContain(fundoDe(sobe))
    expect([COR_DO_FUNDO, STAIR_PLATE_COLOR]).toContain(fundoDe(desce))
  })
})
