import { describe, expect, it } from 'vitest'
import { Graphics } from 'pixi.js'
import { SIGNAL_COLORS } from '../lib/signals'
import { OWNER_RING_WIDTH_PX, ownerRingOuterPx } from './ownerMarker'
import {
  FACING_LABEL_GAP_PX,
  FACING_NIB_COLOR,
  FACING_NIB_EDGE_ALPHA,
  FACING_NIB_EDGE_COLOR,
  FACING_NIB_EDGE_WIDTH_PX,
  FACING_NIB_LENGTH_PX,
  drawFacingNib,
  facingLabelOffset,
  facingNibReach,
  tokenFacing,
} from './facingMarker'

type Instrucao = Graphics['context']['instructions'][number]
interface Ponto {
  x: number
  y: number
}

/** Vértices do triângulo preenchido do bico, na ordem desenhada: canto esquerdo, ponta, canto direito. */
function trianguloDoBico(g: Graphics): Ponto[] {
  const preenchimento = g.context.instructions.find((i) => i.action === 'fill')
  if (preenchimento?.action !== 'fill') throw new Error('o bico não tem preenchimento')
  const poly = preenchimento.data.path.instructions.find((p) => p.action === 'poly')
  if (!poly) throw new Error('o preenchimento do bico não é um polígono')
  const plano = poly.data[0] as number[]
  const pontos: Ponto[] = []
  for (let k = 0; k < plano.length; k += 2) pontos.push({ x: plano[k], y: plano[k + 1] })
  return pontos
}

function tracoDoBico(g: Graphics): Extract<Instrucao, { action: 'stroke' }> {
  const traco = g.context.instructions.find((i) => i.action === 'stroke')
  if (traco?.action !== 'stroke') throw new Error('o bico não tem fio')
  return traco
}

/** Raio do disco de uma ficha de 1 casa numa grade de 40 px (`tokenRadius` da PlayerView). */
const RAIO = 20

describe('tokenFacing: só existe frente quando o mestre deu uma à ficha', () => {
  it('rotação ausente, ou que não é número finito, não tem frente', () => {
    expect(tokenFacing(undefined)).toBeNull()
    expect(tokenFacing(Number.NaN)).toBeNull()
    expect(tokenFacing(Number.POSITIVE_INFINITY)).toBeNull()
    // Pacote malformado: número escrito em texto não vira frente.
    expect(tokenFacing('90' as unknown as number)).toBeNull()
  })

  it('graus no sentido horário viram radianos: 0 é para cima e 90 para a direita', () => {
    expect(tokenFacing(0)).toBe(0)
    expect(tokenFacing(90)).toBeCloseTo(Math.PI / 2, 12)
    expect(tokenFacing(180)).toBeCloseTo(Math.PI, 12)
    expect(tokenFacing(-90)).toBeCloseTo(-Math.PI / 2, 12)
  })
})

describe('drawFacingNib: bico branco apontando para cima, no espaço da ficha', () => {
  it('ficha alheia: ponta no eixo, acima do centro, a FACING_NIB_LENGTH_PX de tela da borda do disco em qualquer zoom', () => {
    for (const zoom of [0.3, 1, 2.5]) {
      const g = new Graphics()
      drawFacingNib(g, RAIO, zoom, false)
      const [esquerdo, ponta, direito] = trianguloDoBico(g)
      expect(ponta.x).toBe(0)
      expect(ponta.y).toBeLessThan(0)
      expect((-ponta.y - RAIO) * zoom).toBeCloseTo(FACING_NIB_LENGTH_PX, 9)
      expect(facingNibReach(RAIO, zoom, false)).toBeCloseTo(-ponta.y, 9)
      // Simétrico, e os cantos da base ficam SOBRE a borda do disco: o bico nasce dela, sem vão.
      expect(esquerdo.y).toBe(direito.y)
      expect(esquerdo.x).toBeCloseTo(-direito.x, 9)
      expect(Math.hypot(direito.x, direito.y)).toBeCloseTo(RAIO, 9)
    }
  })

  it('ficha do jogador: o bico nasce na borda de fora do aro branco e passa do aro inteiro', () => {
    for (const zoom of [0.5, 1, 2]) {
      const g = new Graphics()
      drawFacingNib(g, RAIO, zoom, true)
      const [esquerdo, ponta] = trianguloDoBico(g)
      // Branco com branco: o canto do bico encosta na borda de fora da faixa branca do aro.
      expect(Math.hypot(esquerdo.x, esquerdo.y) * zoom).toBeCloseTo(RAIO * zoom + OWNER_RING_WIDTH_PX, 9)
      // A ponta passa do aro com fio escuro e tudo: o aro não engole o bico.
      expect(-ponta.y * zoom).toBeGreaterThan(ownerRingOuterPx(RAIO, zoom))
      expect(-ponta.y * zoom - (RAIO * zoom + OWNER_RING_WIDTH_PX)).toBeCloseTo(FACING_NIB_LENGTH_PX, 9)
      expect(facingNibReach(RAIO, zoom, true)).toBeCloseTo(-ponta.y, 9)
    }
  })

  it('branco por dentro e fio escuro de 1 px de tela só nos dois lados inclinados: a base não risca o disco nem o aro', () => {
    for (const zoom of [0.5, 2]) {
      const g = new Graphics()
      drawFacingNib(g, RAIO, zoom, true)
      const preenchimento = g.context.instructions.find((i) => i.action === 'fill')
      if (preenchimento?.action !== 'fill') throw new Error('o bico não tem preenchimento')
      expect(preenchimento.data.style.color).toBe(FACING_NIB_COLOR)
      expect(preenchimento.data.style.alpha).toBe(1)
      const traco = tracoDoBico(g)
      expect(traco.data.style.color).toBe(FACING_NIB_EDGE_COLOR)
      expect(traco.data.style.alpha).toBe(FACING_NIB_EDGE_ALPHA)
      expect(traco.data.style.width * zoom).toBeCloseTo(FACING_NIB_EDGE_WIDTH_PX, 9)
      // Caminho aberto: canto, ponta, canto. Fechar o caminho riscaria a base por cima do disco.
      expect(traco.data.path.instructions.map((p) => p.action)).toEqual(['moveTo', 'lineTo', 'lineTo'])
    }
  })

  it('o branco é o mesmo do aro de dono, e redesenhar limpa o bico anterior', () => {
    expect(FACING_NIB_COLOR).toBe(0xffffff)
    const g = new Graphics()
    drawFacingNib(g, RAIO, 1, false)
    drawFacingNib(g, RAIO, 2, false)
    expect(g.context.instructions.filter((i) => i.action === 'fill')).toHaveLength(1)
    expect(g.context.instructions.filter((i) => i.action === 'stroke')).toHaveLength(1)
  })

  it('ficha minúscula no zoom longe: a base nunca fica mais larga que o disco', () => {
    const minusculo = 4
    const g = new Graphics()
    drawFacingNib(g, minusculo, 0.3, false)
    const [esquerdo, ponta, direito] = trianguloDoBico(g)
    for (const p of [esquerdo, ponta, direito]) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
    expect(direito.x - esquerdo.x).toBeGreaterThan(0)
    expect(direito.x - esquerdo.x).toBeLessThan(2 * minusculo)
    expect(Math.hypot(direito.x, direito.y)).toBeCloseTo(minusculo, 9)
  })

  it('zoom inválido não gera bico infinito', () => {
    for (const zoom of [0, -1, Number.NaN]) {
      const g = new Graphics()
      drawFacingNib(g, RAIO, zoom, false)
      for (const p of trianguloDoBico(g)) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
      expect(Number.isFinite(tracoDoBico(g).data.style.width)).toBe(true)
      expect(Number.isFinite(facingNibReach(RAIO, zoom, true))).toBe(true)
    }
  })
})

/*
 * O serrilhado do bico mistura o branco com o fio: cada pixel da borda é um
 * ponto da rampa branco↔fio. As jornadas leem "tem sinal na tela" contando
 * pixels a ±20 por canal da cor de sinal do jogador — mesma régua de
 * `pixi/constants.nomeDaFicha.test.ts`, que mediu o nome da ficha virando
 * "sinal" sem ninguém ter sinalizado.
 */
type Rgb = readonly [number, number, number]
const rgbDeNumero = (cor: number): Rgb => [(cor >> 16) & 0xff, (cor >> 8) & 0xff, cor & 0xff]
const rgbDeHex = (hex: string): Rgb => rgbDeNumero(Number.parseInt(hex.slice(1), 16))
/** Tolerância por canal da régua das jornadas. */
const TOLERANCIA_DA_REGUA = 20
/** A régua mais a folga de arredondamento de 8 bits do canvas e da GPU. */
const LONGE_DO_SINAL = TOLERANCIA_DA_REGUA + 5
const BRANCO: Rgb = [255, 255, 255]

/** Menor distância (maior diferença entre canais) de um ponto da rampa `a`↔`b` até `cor`. */
function distanciaDaRampa(a: Rgb, b: Rgb, cor: Rgb): number {
  let menor = Number.POSITIVE_INFINITY
  for (let passo = 0; passo <= 2000; passo += 1) {
    const t = passo / 2000
    let maior = 0
    for (let canal = 0; canal < 3; canal += 1) maior = Math.max(maior, Math.abs(b[canal] + t * (a[canal] - b[canal]) - cor[canal]))
    menor = Math.min(menor, maior)
  }
  return menor
}

describe('o serrilhado do bico não vira sinal na foto da tela', () => {
  it('controle: o fio preto a 55% do aro, sobre o branco, passaria perto de #a1887f (a régua morde e separa)', () => {
    // Preto a 55% sobre o branco dá o cinza 115; a rampa até o branco cruza o cinza ~144.
    const fioDoAroSobreOBranco: Rgb = [115, 115, 115]
    expect(distanciaDaRampa(BRANCO, fioDoAroSobreOBranco, rgbDeHex('#a1887f'))).toBeLessThanOrEqual(TOLERANCIA_DA_REGUA)
    // Separa: longe do azul de sinal, a mesma rampa não chega perto.
    expect(distanciaDaRampa(BRANCO, fioDoAroSobreOBranco, rgbDeHex('#64b5f6'))).toBeGreaterThan(LONGE_DO_SINAL)
  })

  it.each(SIGNAL_COLORS)('a rampa entre o branco do bico e o fio opaco dele fica longe da cor de sinal %s', (hex) => {
    expect(FACING_NIB_EDGE_ALPHA).toBe(1)
    expect(distanciaDaRampa(rgbDeNumero(FACING_NIB_COLOR), rgbDeNumero(FACING_NIB_EDGE_COLOR), rgbDeHex(hex))).toBeGreaterThan(LONGE_DO_SINAL)
  })
})

describe('facingLabelOffset: o nome da ficha com frente começa depois do bico', () => {
  it('logo abaixo do alcance do bico, com a folga em px de tela, em qualquer zoom e dono', () => {
    for (const zoom of [0.5, 1, 2]) {
      for (const own of [false, true]) {
        const alcance = facingNibReach(RAIO, zoom, own)
        expect(facingLabelOffset(RAIO, zoom, own)).toBeGreaterThan(alcance)
        expect((facingLabelOffset(RAIO, zoom, own) - alcance) * zoom).toBeCloseTo(FACING_LABEL_GAP_PX, 9)
      }
    }
  })
})
