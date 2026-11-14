import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Arbusto seco que rola (item 139 dos carimbos de 14/11/2026): a bola de
 * gravetos secos do deserto, solta no chão. Vista de cima e um pouco de
 * frente, ela é uma BOLA VAZADA: um miolo meio transparente (o chão aparece
 * por entre os gravetos) e por cima os gravetos em arcos que dão a volta na
 * bola, em três camadas de tom: os de trás no escuro, os do meio no palha e,
 * na metade de cima à esquerda (a da luz), uns arcos claros. Umas pontas
 * espetadas furam a borda, para a silhueta não sair um círculo liso. O
 * giro gira os arcos; a luz não gira.
 *
 * A cor é a palha seca (mais clara e mais amarela que a madeira da árvore
 * morta), apagada o bastante para não brilhar na areia.
 */

const MIOLO: Rgb = [96, 78, 54]
const GRAVETO_ESCURO: Rgb = [112, 90, 62]
const GRAVETO: Rgb = [156, 128, 88]
const GRAVETO_CLARO: Rgb = [200, 176, 128]

/** A bola: o centro (pousada no chão) e o raio. */
const BOLA = { y: -0.29, raio: 0.3 } as const

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Um arco de graveto: um pedaço de um círculo da bola visto de lado (uma
 * elipse do tamanho da bola, achatada pelo quanto o círculo está deitado),
 * com o centro um pouco fora do meio para os arcos não baterem todos juntos.
 */
interface Arco {
  x: number
  y: number
  rx: number
  ry: number
  rotacao: number
  de: number
  ate: number
}

function sortearArcos(semente: number, giro: number, quantos: number, k0: number, raio: number): Arco[] {
  return Array.from({ length: quantos }, (_, i) => {
    const k = k0 + i * 7
    const de = sorteio(semente, k + 3) * Math.PI * 2
    return {
      x: (sorteio(semente, k) - 0.5) * raio * 0.24,
      y: BOLA.y + (sorteio(semente, k + 1) - 0.5) * raio * 0.2,
      rx: raio * (0.78 + 0.22 * sorteio(semente, k + 2)),
      ry: raio * (0.18 + 0.7 * sorteio(semente, k + 4)),
      rotacao: giro + sorteio(semente, k + 5) * Math.PI,
      de,
      ate: de + 1.4 + 1.8 * sorteio(semente, k + 6),
    }
  })
}

function tracarArcos(g: CanvasRenderingContext2D, arcos: readonly Arco[], cor: Rgb, largura: number): void {
  g.strokeStyle = css(cor)
  g.lineWidth = largura
  g.beginPath()
  for (const a of arcos) {
    const c = Math.cos(a.rotacao)
    const s = Math.sin(a.rotacao)
    const x0 = Math.cos(a.de) * a.rx
    const y0 = Math.sin(a.de) * a.ry
    g.moveTo(a.x + x0 * c - y0 * s, a.y + x0 * s + y0 * c)
    g.ellipse(a.x, a.y, a.rx, a.ry, a.rotacao, a.de, a.ate)
  }
  g.stroke()
}

/** O meio de um arco, para saber se ele fica na metade da luz. */
function meioDoArco(a: Arco): readonly [number, number] {
  const t = (a.de + a.ate) / 2
  const x0 = Math.cos(t) * a.rx
  const y0 = Math.sin(t) * a.ry
  const c = Math.cos(a.rotacao)
  const s = Math.sin(a.rotacao)
  return [a.x + x0 * c - y0 * s, a.y + x0 * s + y0 * c]
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const raio = BOLA.raio * (0.92 + 0.14 * sorteio(semente, 1))
  g.lineCap = 'round'

  // O miolo: a bola emaranhada por dentro, meio transparente.
  g.fillStyle = css(MIOLO, 0.72)
  g.beginPath()
  g.ellipse(0.012, BOLA.y + 0.01, raio * 0.88, raio * 0.84, 0, 0, Math.PI * 2)
  g.fill()

  // Os de trás, no escuro; os do meio (alguns cruzando o miolo); e os claros só onde a luz bate.
  tracarArcos(g, sortearArcos(semente, giro, 10, 10, raio), GRAVETO_ESCURO, 0.03)
  tracarArcos(g, [...sortearArcos(semente, giro, 8, 100, raio), ...sortearArcos(semente, giro + 1, 4, 150, raio * 0.6)], GRAVETO, 0.028)
  const claros = sortearArcos(semente, giro, 18, 200, raio * 0.94).filter((a) => {
    const [x, y] = meioDoArco(a)
    return x * -0.6 + (y - BOLA.y) * -0.8 > raio * 0.05
  })
  tracarArcos(g, claros.slice(0, 8), GRAVETO_CLARO, 0.026)

  // As pontas espetadas: gravetos curtos que furam a borda da bola.
  g.strokeStyle = css(GRAVETO)
  g.lineWidth = 0.022
  g.beginPath()
  const pontas = 7
  for (let i = 0; i < pontas; i++) {
    const a = giro + (i * Math.PI * 2) / pontas + (sorteio(semente, 400 + i) - 0.5) * 0.7
    const de = raio * 0.82
    const ate = raio * (1.04 + 0.12 * sorteio(semente, 410 + i))
    const torto = (sorteio(semente, 420 + i) - 0.5) * 0.5
    g.moveTo(Math.cos(a) * de, BOLA.y + Math.sin(a) * de)
    g.lineTo(Math.cos(a + torto * 0.3) * ate, BOLA.y + Math.sin(a + torto * 0.3) * ate)
  }
  g.stroke()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'arbusto-que-rola', nome: 'Arbusto seco que rola', tamanho: 6, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [MIOLO, GRAVETO_ESCURO, GRAVETO, GRAVETO_CLARO]
