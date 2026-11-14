import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Estalagmite (item 145 dos carimbos de 14/11/2026): o cone de calcário que
 * sobe do chão da caverna, largo e esparramado no pé (onde a água escorreu e
 * secou), afinando até a ponta arredondada e molhada, com três anéis de bojo
 * no corpo (as camadas do pingo), e uma ou duas menores do lado, que dão a
 * escala. Cor de calcário creme, mais clara e lisa que a pedra da serra. O
 * corpo é um cilindro que afina: o meio-tom até um pouco além do meio, o
 * claro na banda da esquerda (como o toco seco); cada anel tem o lábio de
 * cima claro e a sombra embaixo. O giro só inclina de leve (ela fica em pé) e
 * muda o lado das pequenas; a luz não gira.
 */

const CALCARIO_ESCURO: Rgb = [122, 110, 96]
const CALCARIO_MEIO: Rgb = [170, 156, 132]
const CALCARIO_CLARO: Rgb = [208, 196, 172]
const CALCARIO_BRILHO: Rgb = [232, 226, 208]

type Ponto = readonly [number, number]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
/** Quantos degraus de altura no contorno (o resto é a ponta e o pé). */
const PASSOS = 24

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

interface Pico {
  /** O meio do pé no quadro. */
  readonly x: number
  readonly y: number
  readonly altura: number
  /** O raio do corpo logo acima do pé (o pé esparramado é mais largo). */
  readonly raio: number
  /** Inclinação (unidades de x por unidade de altura): leve, ela fica em pé. */
  readonly inclina: number
  /** O quanto o corpo entorta no meio. */
  readonly curva: number
  /** A altura (0 a 1) de cada anel de bojo. */
  readonly aneis: readonly number[]
}

/** O raio do corpo na altura u (0 no pé, 1 na ponta): o cone, o pé que esparrama e os anéis. */
function raioNa(p: Pico, u: number): number {
  const corpo = 0.12 + 0.88 * Math.pow(1 - u, 0.85)
  // O pé esparrama em curva, sem degrau (estreito e alto, ele virava uma saia).
  const pe = 0.5 * Math.exp(-((u / 0.16) ** 2))
  let anel = 0
  for (const a of p.aneis) anel += 0.1 * Math.exp(-(((u - a) / 0.055) ** 2))
  return p.raio * (corpo + pe) * (1 + anel)
}

function meioNa(p: Pico, u: number): number {
  return p.x + p.inclina * p.altura * u + p.curva * Math.sin(Math.PI * u)
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[]): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
}

/** O contorno: o lado esquerdo subindo, a ponta redonda, o direito descendo e a frente do pé (meia elipse no chão). */
function contorno(p: Pico): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i <= PASSOS; i++) {
    const u = i / PASSOS
    pontos.push([meioNa(p, u) - raioNa(p, u), p.y - p.altura * u])
  }
  const rTopo = raioNa(p, 1)
  const xTopo = meioNa(p, 1)
  const yTopo = p.y - p.altura
  for (let i = 1; i < 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI
    pontos.push([xTopo + Math.cos(a) * rTopo, yTopo + Math.sin(a) * rTopo * 1.4])
  }
  for (let i = PASSOS; i >= 0; i--) {
    const u = i / PASSOS
    pontos.push([meioNa(p, u) + raioNa(p, u), p.y - p.altura * u])
  }
  const r0 = raioNa(p, 0)
  for (let i = 1; i < 16; i++) {
    const a = (i / 16) * Math.PI
    pontos.push([p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0 * ACHATA])
  }
  return pontos
}

/** Uma banda de luz: tudo à esquerda da linha que corre a `k` raios do meio, do alto ao pé. */
function banda(p: Pico, k: number): Ponto[] {
  const r0 = raioNa(p, 0)
  const esquerda = p.x - r0 - 0.02
  const alto = p.y - p.altura - raioNa(p, 1) * 1.6
  const pontos: Ponto[] = [
    [esquerda, alto],
    [meioNa(p, 1) + raioNa(p, 1) * k, alto],
  ]
  for (let i = PASSOS; i >= 0; i--) {
    const u = i / PASSOS
    pontos.push([meioNa(p, u) + raioNa(p, u) * k, p.y - p.altura * u])
  }
  pontos.push([p.x + r0 * k, p.y + r0 * ACHATA + 0.01])
  pontos.push([esquerda, p.y + r0 * ACHATA + 0.01])
  return pontos
}

function elipses(g: CanvasRenderingContext2D, lista: ReadonlyArray<readonly [number, number, number, number]>, cor: string): void {
  g.fillStyle = cor
  g.beginPath()
  for (const [x, y, rx, ry] of lista) {
    g.moveTo(x + rx, y)
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  }
  g.fill()
}

function pintarPico(g: CanvasRenderingContext2D, p: Pico): void {
  const silhueta = contorno(p)
  g.fillStyle = css(CALCARIO_ESCURO)
  caminho(g, silhueta)
  g.fill()
  g.save()
  caminho(g, silhueta)
  g.clip()
  g.fillStyle = css(CALCARIO_MEIO)
  caminho(g, banda(p, 0.3))
  g.fill()
  g.fillStyle = css(CALCARIO_CLARO)
  caminho(g, banda(p, -0.32))
  g.fill()
  // Os anéis: a sombra embaixo do bojo, do lado de lá da luz, e o lábio de cima, do lado da luz.
  // De ponta a ponta, claro e escuro empilhavam pratos.
  const aneis = p.aneis.map((a) => ({ x: meioNa(p, a), y: p.y - p.altura * a, r: raioNa(p, a) }))
  elipses(
    g,
    aneis.map((a) => [a.x + a.r * 0.45, a.y + 0.03, a.r * 0.75, 0.03] as const),
    css(CALCARIO_ESCURO, 0.42),
  )
  elipses(
    g,
    aneis.map((a) => [a.x - a.r * 0.42, a.y - 0.012, a.r * 0.58, 0.022] as const),
    css(CALCARIO_CLARO, 0.7),
  )
  // A ponta molhada: um brilho do lado da luz.
  const u = 0.88
  elipses(g, [[meioNa(p, u) - raioNa(p, u) * 0.38, p.y - p.altura * u, raioNa(p, u) * 0.36, 0.05]], css(CALCARIO_BRILHO))
  g.restore()
}

function desenharEstalagmite(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const anel = (i: number, base: number) => base + 0.06 * sorteio(semente, 20 + i)
  const grande: Pico = {
    x: 0,
    y: -0.02,
    altura: 0.88 * (0.94 + 0.12 * sorteio(semente, 1)),
    raio: 0.17,
    inclina: Math.sin(giro) * 0.065,
    curva: (sorteio(semente, 2) - 0.5) * 0.04,
    aneis: [anel(0, 0.24), anel(1, 0.47), anel(2, 0.69)],
  }
  // As pequenas: uma ou duas, sempre de lado (na frente do pé, a pequena parecia grudada na grande).
  const quantas = sorteio(semente, 3) < 0.3 ? 1 : 2
  const primeiro = Math.cos(giro + 0.6) >= 0 ? 1 : -1
  const pequenas: Pico[] = Array.from({ length: quantas }, (_, i) => {
    const lado = i === 0 ? primeiro : -primeiro
    const k = i === 0 ? 0.48 + 0.12 * sorteio(semente, 5) : 0.34 + 0.1 * sorteio(semente, 6)
    return {
      x: lado * (0.27 + 0.05 * sorteio(semente, 7 + i)),
      y: 0.02 + Math.sin(giro * 1.3 + i * 2.2) * 0.07,
      altura: grande.altura * k,
      raio: grande.raio * (0.45 + k * 0.5),
      inclina: lado * 0.05 + Math.sin(giro + i) * 0.03,
      curva: 0,
      aneis: [anel(3 + i, 0.3), anel(5 + i, 0.6)],
    }
  })
  // A de trás (mais alta na tela) sai antes da grande; a da frente, depois.
  for (const p of pequenas.filter((p) => p.y < grande.y)) pintarPico(g, p)
  pintarPico(g, grande)
  for (const p of pequenas.filter((p) => p.y >= grande.y)) pintarPico(g, p)
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'estalagmite',
  nome: 'Estalagmite',
  tamanho: 9,
  sombra: 'em-pe',
  desenhar: desenharEstalagmite,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [CALCARIO_ESCURO, CALCARIO_MEIO, CALCARIO_CLARO, CALCARIO_BRILHO]
