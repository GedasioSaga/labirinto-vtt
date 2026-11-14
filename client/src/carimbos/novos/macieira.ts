import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Macieira com frutas (item 119 dos carimbos de 14/11/2026): árvore de
 * pomar, mais LARGA que alta. O tronco curto e torto abre em dois braços logo
 * abaixo da copa; a copa é uma cúpula baixa e cheia de lóbulos miúdos (folha
 * de pomar, não o cacho grande da Árvore), e as maçãs vermelhas pontilham a
 * copa, cada uma com o lado da sombra e o pontinho de luz. Às vezes caiu uma
 * maçã ou duas no chão. O giro troca os lóbulos e onde as maçãs estão; a
 * árvore só inclina de leve. A luz não gira.
 */

const TRONCO: Rgb = [106, 80, 58]
const TRONCO_SOMBRA: Rgb = [72, 56, 44]
const SOMBRA_DA_COPA: Rgb = [38, 78, 54]
const COPA_ESCURA: Rgb = [52, 102, 62]
const COPA_MEDIA: Rgb = [82, 138, 76]
const COPA_CLARA: Rgb = [134, 174, 98]
const MACA: Rgb = [192, 60, 50]
const MACA_SOMBRA: Rgb = [140, 44, 44]
const MACA_LUZ: Rgb = [232, 156, 136]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function circulos(g: CanvasRenderingContext2D, lista: ReadonlyArray<readonly [number, number, number]>): void {
  g.beginPath()
  for (const [x, y, r] of lista) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  g.fill()
}

type Circulo = [number, number, number]

/** A cúpula larga e baixa da copa. */
const COPA = { cy: -0.58, rx: 0.4, ry: 0.27 } as const

/** Os lóbulos miúdos em volta da borda da cúpula e três no miolo. */
function lobulos(giro: number, semente: number, encolher: number, dx: number, dy: number): Circulo[] {
  const lista: Circulo[] = [
    [dx - 0.12 * encolher, COPA.cy + dy, 0.2 * encolher],
    [dx + 0.12 * encolher, COPA.cy + dy + 0.01, 0.2 * encolher],
    [dx, COPA.cy + dy - 0.06 * encolher, 0.2 * encolher],
  ]
  const n = 11
  for (let i = 0; i < n; i++) {
    const a = giro + (i * Math.PI * 2) / n + (sorteio(semente, i) - 0.5) * 0.4
    const d = 0.84 + 0.12 * sorteio(semente, 20 + i)
    lista.push([dx + Math.cos(a) * COPA.rx * d * encolher, COPA.cy + dy + Math.sin(a) * COPA.ry * d * encolher, (0.11 + 0.035 * sorteio(semente, 40 + i)) * encolher])
  }
  return lista
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // Maçãs no chão, antes de tudo (o tronco e a copa passam por cima).
  const noChao = Math.floor(sorteio(semente, 90) * 3)
  const caidas: Circulo[] = []
  for (let i = 0; i < noChao; i++) {
    const a = giro * 1.3 + i * 2.4 + sorteio(semente, 91 + i)
    caidas.push([Math.cos(a) * (0.13 + 0.07 * sorteio(semente, 95 + i)), 0.045 + Math.sin(a) * 0.035, 0.028])
  }
  if (caidas.length > 0) {
    g.fillStyle = css(MACA_SOMBRA)
    circulos(g, caidas.map(([x, y, r]) => [x + 0.004, y + 0.004, r] as Circulo))
    g.fillStyle = css(MACA)
    circulos(g, caidas.map(([x, y, r]) => [x - 0.004, y - 0.005, r * 0.78] as Circulo))
  }

  g.save()
  g.rotate(Math.sin(giro) * 0.04)
  // O tronco curto e torto, abrindo em dois braços embaixo da copa.
  const torto = (sorteio(semente, 80) - 0.5) * 0.06
  g.fillStyle = css(TRONCO)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(-0.1, 0.03)
  g.quadraticCurveTo(-0.05, 0.0, -0.048 + torto, -0.14)
  g.quadraticCurveTo(-0.05 + torto, -0.26, -0.2, -0.42)
  g.lineTo(-0.15, -0.45)
  g.quadraticCurveTo(-0.05 + torto, -0.34, torto, -0.3)
  g.closePath()
  g.fill()
  g.fillStyle = css(TRONCO_SOMBRA)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(torto, -0.3)
  g.quadraticCurveTo(0.05 + torto, -0.36, 0.17, -0.46)
  g.lineTo(0.21, -0.42)
  g.quadraticCurveTo(0.06 + torto, -0.26, 0.05 + torto, -0.14)
  g.quadraticCurveTo(0.052, 0.0, 0.11, 0.035)
  g.closePath()
  g.fill()

  // A copa: a sombra embaixo dela (pousa nos braços), o escuro inteiro, o
  // médio puxado para a luz e o claro no alto à esquerda.
  g.fillStyle = css(SOMBRA_DA_COPA)
  circulos(g, [
    [-0.2, COPA.cy + 0.13, 0.13],
    [0.02, COPA.cy + 0.16, 0.15],
    [0.22, COPA.cy + 0.12, 0.13],
  ])
  g.fillStyle = css(COPA_ESCURA)
  circulos(g, lobulos(giro, semente, 1, 0, 0))
  g.fillStyle = css(COPA_MEDIA)
  circulos(g, lobulos(giro, semente, 0.82, -0.05, -0.05))
  g.fillStyle = css(COPA_CLARA)
  circulos(g, lobulos(giro + 0.6, semente + 1, 0.42, -0.14, -0.11))

  // As maçãs: espalhadas pela copa (mais na metade de baixo, que pende), cada
  // uma no vermelho com o lado da sombra embaixo à direita e um ponto de luz.
  const macas: Circulo[] = []
  const quantas = 7 + Math.floor(sorteio(semente, 60) * 3)
  for (let i = 0; i < quantas; i++) {
    const a = giro * 0.7 + i * 2.39996 + sorteio(semente, 61 + i) * 0.6
    const d = Math.sqrt((i + 0.5) / quantas) * 0.9
    const x = Math.cos(a) * COPA.rx * d
    const y = COPA.cy + 0.02 + Math.sin(a) * COPA.ry * d * 0.95
    macas.push([x, y, 0.03 + 0.014 * sorteio(semente, 75 + i)])
  }
  g.fillStyle = css(MACA_SOMBRA)
  circulos(g, macas.map(([x, y, r]) => [x + 0.005, y + 0.006, r] as Circulo))
  g.fillStyle = css(MACA)
  circulos(g, macas.map(([x, y, r]) => [x - 0.003, y - 0.003, r * 0.84] as Circulo))
  g.fillStyle = css(MACA_LUZ)
  circulos(g, macas.map(([x, y, r]) => [x - r * 0.38, y - r * 0.38, r * 0.3] as Circulo))
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'macieira', nome: 'Macieira', tamanho: 14, sombra: 'em-pe', desenhar }

export const paleta: readonly Rgb[] = [TRONCO, TRONCO_SOMBRA, SOMBRA_DA_COPA, COPA_ESCURA, COPA_MEDIA, COPA_CLARA, MACA, MACA_SOMBRA, MACA_LUZ]
