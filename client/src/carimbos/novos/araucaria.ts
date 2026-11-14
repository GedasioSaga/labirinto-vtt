import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Araucária (item 121 dos carimbos de 14/11/2026): o pinheiro-do-paraná, a
 * árvore em CANDELABRO. Um tronco alto, reto e limpo, e lá em cima a copa
 * chata e larga como um guarda-chuva virado: os braços saem do alto do
 * tronco, correm para fora e levantam a ponta, e cada ponta tem um tufo de
 * folha espetada (a roseta escura da araucária). Às vezes sobra um andar de
 * braços mais curto embaixo. Vista de cima e um pouco de frente, a copa é
 * uma roda de tufos: os de trás ficam atrás do tronco, os da frente na
 * frente. O giro gira a roda em volta do tronco; a árvore só inclina de
 * leve. A luz não gira.
 */

const CASCA: Rgb = [120, 98, 80]
const CASCA_SOMBRA: Rgb = [82, 68, 58]
const BRACO: Rgb = [88, 72, 60]
const TUFO_ESCURO: Rgb = [34, 84, 66]
const TUFO_MEDIO: Rgb = [52, 114, 82]
const TUFO_CLARO: Rgb = [94, 148, 102]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

interface Tufo {
  x: number
  y: number
  r: number
  /** O ângulo do braço (gira as pontas do tufo). */
  a: number
}

/** O alto do tronco, de onde saem os braços da copa. */
const ALTO = { x: 0, y: -0.84 } as const
/** Pontas de cada tufo (a roseta espetada). */
const PONTAS = 11

/** Os tufos de uma camada num caminho só: estrelas achatadas, de pontas alternadas. */
function tufos(g: CanvasRenderingContext2D, lista: readonly Tufo[], encolher: number, dx: number, dy: number, cor: Rgb): void {
  if (lista.length === 0) return
  g.fillStyle = css(cor)
  g.beginPath()
  for (const t of lista) {
    const r = t.r * encolher
    for (let k = 0; k <= PONTAS * 2; k++) {
      const a = t.a + (k * Math.PI) / PONTAS
      const d = k % 2 === 0 ? r * (0.9 + 0.1 * Math.cos(k * 1.7 + t.a * 3)) : r * 0.64
      const x = t.x + dx + Math.cos(a) * d
      const y = t.y + dy + Math.sin(a) * d * 0.72
      if (k === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
  }
  g.fill()
}

/** As três camadas de um grupo de tufos: o escuro inteiro, o médio para a luz e o claro no alto à esquerda. */
function camadas(g: CanvasRenderingContext2D, lista: readonly Tufo[]): void {
  tufos(g, lista, 1, 0.008, 0.012, TUFO_ESCURO)
  tufos(g, lista, 0.74, -0.018, -0.02, TUFO_MEDIO)
  tufos(g, lista, 0.38, -0.04, -0.04, TUFO_CLARO)
}

/** Um braço: do alto do tronco para fora, caído no meio e de ponta levantada. */
function braco(g: CanvasRenderingContext2D, de: { x: number; y: number }, para: Tufo, grosso: number): void {
  const curva = { x: de.x + (para.x - de.x) * 0.6, y: de.y + (para.y - de.y) * 0.6 + 0.05 }
  const dx = para.x - de.x
  const dy = para.y - de.y
  const n = Math.hypot(dx, dy) || 1
  const nx = (-dy / n) * grosso
  const ny = (dx / n) * grosso
  g.beginPath()
  g.moveTo(de.x + nx, de.y + ny)
  g.quadraticCurveTo(curva.x + nx * 0.6, curva.y + ny * 0.6, para.x, para.y)
  g.quadraticCurveTo(curva.x - nx * 0.6, curva.y - ny * 0.6, de.x - nx, de.y - ny)
  g.closePath()
  g.fill()
}

/** Uma roda de braços em volta do tronco, na altura `y`. */
function roda(giro: number, semente: number, quantos: number, y: number, alcance: number, raio: number, base: number): Tufo[] {
  return Array.from({ length: quantos }, (_, k) => {
    const a = giro + (k * Math.PI * 2) / quantos + (sorteio(semente, base + k) - 0.5) * 0.5
    const d = alcance * (0.86 + 0.2 * sorteio(semente, base + 20 + k))
    return { x: Math.cos(a) * d, y: y + Math.sin(a) * d * 0.4 - 0.09, r: raio * (0.9 + 0.2 * sorteio(semente, base + 40 + k)), a }
  })
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.save()
  g.rotate(Math.sin(giro) * 0.035)
  const deCima = roda(giro, semente, 9, ALTO.y, 0.37, 0.13, 0)
  const temAndarDeBaixo = sorteio(semente, 90) < 0.6
  const deBaixo = temAndarDeBaixo ? roda(giro + 0.5, semente + 3, 3, -0.6, 0.24, 0.085, 60) : []
  const meio: Tufo = { x: -0.01, y: ALTO.y - 0.1, r: 0.1, a: giro }
  const atras = (lista: readonly Tufo[], y: number) => lista.filter((t) => t.y < y - 0.09).sort((p, q) => p.y - q.y)
  const naFrente = (lista: readonly Tufo[], y: number) => lista.filter((t) => t.y >= y - 0.09).sort((p, q) => p.y - q.y)

  // O andar de cima, a parte de trás: atrás de tudo.
  camadas(g, atras(deCima, ALTO.y))

  // O tronco alto e reto: a metade da luz e a da sombra, alargando no pé.
  g.fillStyle = css(CASCA)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(-0.085, 0.03)
  g.quadraticCurveTo(-0.04, 0.005, -0.038, -0.1)
  g.lineTo(-0.022, ALTO.y)
  g.lineTo(0, ALTO.y)
  g.closePath()
  g.fill()
  g.fillStyle = css(CASCA_SOMBRA)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(0, ALTO.y)
  g.lineTo(0.022, ALTO.y)
  g.lineTo(0.038, -0.1)
  g.quadraticCurveTo(0.042, 0.005, 0.09, 0.032)
  g.closePath()
  g.fill()

  // O andar de baixo (quando há), com o tronco já desenhado atrás dos da frente.
  if (temAndarDeBaixo) {
    camadas(g, atras(deBaixo, -0.6))
    g.fillStyle = css(BRACO)
    for (const t of deBaixo) braco(g, { x: 0, y: -0.6 }, t, 0.014)
    camadas(g, naFrente(deBaixo, -0.6))
  }

  // Os braços de cima e o tufo do meio (os brotos que sobem do alto do tronco).
  g.fillStyle = css(BRACO)
  for (const t of deCima) braco(g, ALTO, t, 0.018)
  camadas(g, [meio])
  camadas(g, naFrente(deCima, ALTO.y))
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'araucaria', nome: 'Araucária', tamanho: 15, sombra: 'em-pe', desenhar }

export const paleta: readonly Rgb[] = [CASCA, CASCA_SOMBRA, BRACO, TUFO_ESCURO, TUFO_MEDIO, TUFO_CLARO]
