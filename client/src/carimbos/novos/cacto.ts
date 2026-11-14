import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Cacto (item 137 dos carimbos de 14/11/2026): o saguaro do deserto, a coluna
 * alta com um a três braços que saem de lado e sobem. Visto de cima e um
 * pouco de frente, como a palmeira: a coluna em pé, o alto arredondado.
 * O volume são quatro camadas chapadas de verde-sálvia, cada uma mais estreita
 * e puxada para a luz (de cima à esquerda): nas colunas viram as faixas das
 * costelas, no cotovelo do braço a luz cai por cima. Às vezes floresce: umas
 * flores rosadas no alto. O giro escolhe para onde cada braço aponta (os de
 * trás saem por trás da coluna) e inclina de leve; a luz não gira.
 *
 * O verde é mais azulado e apagado que o da mata (o cacto não some no capim e
 * não se confunde com os juncos nem com o pinheiro).
 */

const ESCURO: Rgb = [46, 94, 80]
const MEIO_ESCURO: Rgb = [64, 118, 92]
const MEIO: Rgb = [92, 144, 104]
const CLARO: Rgb = [146, 182, 130]
const FLOR: Rgb = [212, 132, 148]
const FLOR_MIOLO: Rgb = [230, 204, 132]

/**
 * As camadas de tom de uma coluna: o quanto cada uma é puxada para a luz (em
 * meias larguras, para a esquerda e para cima) e a meia largura que sobra.
 * Cada camada cabe dentro da de baixo, também no alto arredondado.
 */
const CAMADAS = [
  { cor: ESCURO, dx: 0, dy: 0, w: 1 },
  { cor: MEIO_ESCURO, dx: 0.12, dy: 0.08, w: 0.84 },
  { cor: MEIO, dx: 0.3, dy: 0.18, w: 0.62 },
  { cor: CLARO, dx: 0.52, dy: 0.34, w: 0.3 },
] as const

/** Meia largura da coluna e de um braço. */
const COLUNA = 0.105
const BRACO = 0.072

type Ponto = readonly [number, number]

interface Tubo {
  /** A linha do meio: de `a` a `b`, curvada para `c`. */
  a: Ponto
  c: Ponto
  b: Ponto
  w: number
}

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Um tubo (a coluna ou um braço) nas quatro camadas de tom, de ponta redonda. */
function pintarTubo(g: CanvasRenderingContext2D, t: Tubo): void {
  g.lineCap = 'round'
  for (const k of CAMADAS) {
    const ox = -k.dx * t.w
    const oy = -k.dy * t.w
    g.strokeStyle = css(k.cor)
    g.lineWidth = 2 * t.w * k.w
    g.beginPath()
    g.moveTo(t.a[0] + ox, t.a[1] + oy)
    g.quadraticCurveTo(t.c[0] + ox, t.c[1] + oy, t.b[0] + ox, t.b[1] + oy)
    g.stroke()
  }
}

/** Uma florzinha: cinco pétalas em roda e o miolo. */
function flor(g: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number): void {
  g.fillStyle = css(FLOR)
  g.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = giro + (i * Math.PI * 2) / 5
    const px = x + Math.cos(a) * r * 0.55
    const py = y + Math.sin(a) * r * 0.4
    g.moveTo(px + r * 0.5, py)
    g.arc(px, py, r * 0.5, 0, Math.PI * 2)
  }
  g.fill()
  g.fillStyle = css(FLOR_MIOLO)
  g.beginPath()
  g.arc(x, y, r * 0.32, 0, Math.PI * 2)
  g.fill()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const alto = 0.9 + 0.12 * sorteio(semente, 1)
  const topo = -alto + COLUNA
  const coluna: Tubo = { a: [0, 0.08], c: [0, (0.08 + topo) / 2], b: [0, topo], w: COLUNA }

  // Os braços: um a três, para os lados (o que apontaria reto para quem vê
  // abre para o lado, senão some na frente da coluna).
  const n = 1 + Math.min(2, Math.floor(sorteio(semente, 2) * 3.2))
  const bracos = Array.from({ length: n }, (_, i) => {
    const a = giro + (i * Math.PI * 2) / n + (sorteio(semente, 10 + i) - 0.5) * 0.6
    const cos = Math.cos(a)
    const lado = cos >= 0 ? 1 : -1
    const alcance = 0.17 + 0.05 * sorteio(semente, 20 + i)
    const dx = lado * Math.max(Math.abs(cos), 0.6) * alcance
    const dy = Math.sin(a) * alcance * 0.55
    const junta = alto * (0.3 + 0.2 * sorteio(semente, 30 + i))
    const sobe = 0.18 + 0.14 * sorteio(semente, 40 + i)
    const tubo: Tubo = {
      a: [lado * 0.02, -junta],
      c: [dx, -junta + dy + 0.03],
      b: [dx, -junta - sobe + dy + BRACO],
      w: BRACO,
    }
    return { tubo, atras: Math.sin(a) < -0.15, flor: sorteio(semente, 50 + i) < 0.3 }
  })

  g.save()
  g.rotate(Math.sin(giro) * 0.05)
  // O pé: tudo acima do chão, e a base da coluna como a beira de um cilindro.
  g.beginPath()
  g.moveTo(-0.72, -1.18)
  g.lineTo(0.72, -1.18)
  g.lineTo(0.72, 0)
  g.lineTo(-0.72, 0)
  g.closePath()
  g.moveTo(COLUNA, 0)
  g.ellipse(0, 0, COLUNA, COLUNA * 0.4, 0, 0, Math.PI * 2)
  g.clip()

  for (const b of bracos.filter((b) => b.atras)) pintarTubo(g, b.tubo)
  pintarTubo(g, coluna)
  for (const b of bracos.filter((b) => !b.atras)) pintarTubo(g, b.tubo)

  // Às vezes floresce: no alto da coluna e na ponta de algum braço.
  if (sorteio(semente, 60) < 0.5) {
    const y = topo - COLUNA * 0.7
    flor(g, -0.035, y + 0.012, 0.034, giro)
    flor(g, 0.03, y + 0.02, 0.03, giro + 1)
    flor(g, 0, y - 0.012, 0.03, giro + 2)
    for (const b of bracos) if (b.flor) flor(g, b.tubo.b[0] - 0.01, b.tubo.b[1] - BRACO * 0.6, 0.03, giro + 3)
  }
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'cacto', nome: 'Cacto', tamanho: 11, sombra: 'em-pe', desenhar }

export const paleta: readonly Rgb[] = [ESCURO, MEIO_ESCURO, MEIO, CLARO, FLOR, FLOR_MIOLO]
