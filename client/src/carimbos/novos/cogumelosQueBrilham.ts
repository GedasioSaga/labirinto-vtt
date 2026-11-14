import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Cogumelos que brilham (item 146 dos carimbos de 14/11/2026): uma moita de
 * quatro ou cinco cogumelos finos de caverna, de chapéu em sino claro e frio
 * (verde-água que puxa para o branco no alto), a lamela de baixo mais funda,
 * o pé fino e pálido. O BRILHO é pintado no corpo: o miolo claro de cada
 * chapéu (`pintarLuzDoChapeu`, a parte que acende; separada para virar um
 * `brilho` que pulsa, se um dia o app quiser), um halo chapado de tom claro
 * em volta dos chapéus e outro no chão em volta da moita, tudo dentro do
 * quadro. A LUZ no mapa (o claro em volta, de noite) é a da tabela de luz
 * do integrador: cor `0xdcf2ea`, 1,5 casa.
 *
 * Bem diferente do cogumelo gigante (um só, vermelho de pintas): aqui são
 * muitos, pequenos, sem pinta, e o que se lê é o claro frio. O giro gira a
 * moita em volta do meio e inclina cada um para fora; a luz não gira.
 */

const PE_CLARO: Rgb = [200, 216, 206]
const PE_SOMBRA: Rgb = [140, 166, 160]
const LAMELA: Rgb = [70, 130, 132]
const CHAPEU: Rgb = [116, 190, 182]
const CHAPEU_CLARO: Rgb = [172, 226, 214]
const CHAPEU_LUZ: Rgb = [224, 244, 236]
const HALO: Rgb = [196, 238, 224]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

type Elipse = readonly [number, number, number, number]

function elipses(g: CanvasRenderingContext2D, lista: readonly Elipse[], cor: string): void {
  g.fillStyle = cor
  g.beginPath()
  for (const [x, y, rx, ry] of lista) {
    g.moveTo(x + rx, y)
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  }
  g.fill()
}

/** A moita antes do giro: o pé no chão (y sem achatar), a altura do pé e o raio do chapéu. */
const MOITA = [
  { dx: 0.01, dy: -0.09, altura: 0.4, raio: 0.17 },
  { dx: -0.23, dy: 0.04, altura: 0.27, raio: 0.13 },
  { dx: 0.21, dy: 0.09, altura: 0.21, raio: 0.12 },
  { dx: 0.29, dy: -0.15, altura: 0.14, raio: 0.09 },
  { dx: -0.07, dy: 0.22, altura: 0.1, raio: 0.075 },
] as const

interface Cogumelo {
  readonly x: number
  readonly y: number
  readonly altura: number
  readonly raio: number
  readonly inclina: number
}

/** O chapéu: o centro dele na tela e os raios (o sino visto de cima e um pouco de frente). */
function chapeu(c: Cogumelo): Elipse {
  return [c.x + c.inclina, c.y - c.altura, c.raio, c.raio * 0.72]
}

/** A parte que acende: o claro do sino e o miolo, do lado de cima à esquerda. */
function pintarLuzDoChapeu(g: CanvasRenderingContext2D, c: Cogumelo): void {
  const [cx, cy, rx, ry] = chapeu(c)
  elipses(g, [[cx - rx * 0.14, cy - ry * 0.16, rx * 0.74, ry * 0.66]], css(CHAPEU_CLARO))
  elipses(g, [[cx - rx * 0.24, cy - ry * 0.3, rx * 0.38, ry * 0.32]], css(CHAPEU_LUZ))
}

function pintarCogumelo(g: CanvasRenderingContext2D, c: Cogumelo): void {
  const { x, y, altura: h, raio: r, inclina } = c
  const pe = r * 0.34
  const alto = r * 0.24
  const topo = y - h
  // O pé: inteiro na sombra, depois a metade da esquerda clara.
  g.fillStyle = css(PE_SOMBRA)
  g.beginPath()
  g.moveTo(x - pe, y)
  g.quadraticCurveTo(x, y + pe * 0.45, x + pe, y)
  g.quadraticCurveTo(x + alto + inclina * 0.4, y - h * 0.5, x + alto + inclina, topo)
  g.lineTo(x - alto + inclina, topo)
  g.quadraticCurveTo(x - alto + inclina * 0.4, y - h * 0.5, x - pe, y)
  g.closePath()
  g.fill()
  g.fillStyle = css(PE_CLARO)
  g.beginPath()
  g.moveTo(x - pe, y)
  g.quadraticCurveTo(x - pe * 0.3, y + pe * 0.3, x + pe * 0.1, y + pe * 0.3)
  g.quadraticCurveTo(x + inclina * 0.4, y - h * 0.5, x + inclina + alto * 0.1, topo)
  g.lineTo(x - alto + inclina, topo)
  g.quadraticCurveTo(x - alto + inclina * 0.4, y - h * 0.5, x - pe, y)
  g.closePath()
  g.fill()
  // O chapéu: a lamela embaixo (a beira funda), o sino, e por cima a luz.
  const [cx, cy, rx, ry] = chapeu(c)
  elipses(g, [[cx + rx * 0.03, cy + ry * 0.36, rx * 0.9, ry * 0.58]], css(LAMELA))
  elipses(g, [[cx, cy, rx, ry]], css(CHAPEU))
  pintarLuzDoChapeu(g, c)
}

function desenharCogumelosQueBrilham(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const quantos = sorteio(semente, 1) < 0.35 ? 4 : 5
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const moita: Cogumelo[] = MOITA.slice(0, quantos)
    .map((m, i) => {
      const x = m.dx * c - m.dy * s
      const y = (m.dx * s + m.dy * c) * ACHATA
      return {
        x,
        y,
        altura: m.altura * (0.85 + 0.3 * sorteio(semente, 10 + i)),
        raio: m.raio * (0.9 + 0.2 * sorteio(semente, 20 + i)),
        // Cada um pende para fora da moita, e um pouco com o giro.
        inclina: x * 0.22 + Math.sin(giro + i * 1.7) * 0.02,
      }
    })
    .sort((a, b) => a.y - b.y)
  // O halo no chão: dois degraus chapados de claro em volta da moita.
  elipses(g, [[0, -0.01, 0.5, 0.27]], css(HALO, 0.2))
  elipses(g, [[0, -0.01, 0.34, 0.17]], css(HALO, 0.22))
  // O halo dos chapéus, num caminho só (onde dois se cruzam não dobra); mais largo e forte, ele virava bolha de sabão.
  elipses(
    g,
    moita.map((m) => {
      const [cx, cy, rx, ry] = chapeu(m)
      return [cx, cy + ry * 0.12, rx * 1.36, ry * 1.5] as const
    }),
    css(HALO, 0.26),
  )
  for (const m of moita) pintarCogumelo(g, m)
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'cogumelos-que-brilham',
  nome: 'Cogumelos que brilham',
  tamanho: 6,
  sombra: 'baixa',
  desenhar: desenharCogumelosQueBrilham,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [PE_CLARO, PE_SOMBRA, LAMELA, CHAPEU, CHAPEU_CLARO, CHAPEU_LUZ, HALO]
