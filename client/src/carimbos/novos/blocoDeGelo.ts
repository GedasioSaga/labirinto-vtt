import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Bloco de gelo (item 143 dos carimbos de 14/11/2026): um bloco de gelo
 * grosso largado no chão, de quinas gastas, às vezes com uma lasca menor do
 * lado. Visto de cima e um pouco de frente, como as pedras: um bloco de
 * quatro lados que afina um pouco para o topo chato. Cada lado toma a luz
 * pela direção para onde olha (o ciano escuro do lado de baixo à direita, o
 * claro do de cima à esquerda) e o topo, de frente para o céu, é o mais claro;
 * o que diz "gelo" é a beira acesa nas quinas do topo que olham para a luz,
 * a faixa clara de dentro que atravessa o bloco (o gelo deixa a luz entrar)
 * e uma quina do topo lascada. O giro gira o bloco no chão; a luz não gira.
 *
 * Os cianos partem da água da poça (`embutidos.ts`), mais frios e claros.
 */

const GELO_TOPO: Rgb = [210, 234, 238]
const GELO_CLARO: Rgb = [164, 206, 220]
const GELO_MEIO: Rgb = [118, 172, 196]
const GELO_ESCURO: Rgb = [80, 132, 160]
const BEIRA: Rgb = [238, 244, 245]
const DENTRO: Rgb = [226, 240, 243]

/** Luz em 3D (x direita, y para baixo na tela, z para cima): a das pedras. */
const LUZ_3D = (() => {
  const v = { x: -0.5, y: -0.55, z: 0.67 }
  const n = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / n, y: v.y / n, z: v.z / n }
})()

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55

type Ponto = readonly [number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[]): void {
  g.beginPath()
  pontos.forEach((p, i) => (i === 0 ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1])))
  g.closePath()
}

/** O tom de um lado pelo quanto ele olha para a luz (0 de costas, 1 de frente). */
function tomDoLado(brilho: number): Rgb {
  if (brilho < 0.2) return GELO_ESCURO
  if (brilho < 0.5) return GELO_MEIO
  return GELO_CLARO
}

interface Bloco {
  x: number
  y: number
  /** Meio comprimento e meia largura no chão, e a altura. */
  a: number
  b: number
  altura: number
  giro: number
  /** Qual quina do topo é lascada (-1: nenhuma). */
  lasca: number
  /** Se atravessa a faixa clara de dentro. */
  faixa: boolean
}

function desenharBloco(g: CanvasRenderingContext2D, k: Bloco, semente: number): void {
  const c = Math.cos(k.giro)
  const s = Math.sin(k.giro)
  const encolhe = 0.86
  // As quinas do pé, giradas no chão; as do topo encolhidas e subidas.
  const quinas = [
    [-k.a, -k.b],
    [k.a, -k.b],
    [k.a, k.b],
    [-k.a, k.b],
  ].map(([u, v], i): { pe: Ponto; topo: Ponto } => {
    const gasta = 0.94 + 0.08 * sorteio(semente, 10 + i)
    const x = (u * c - v * s) * gasta
    const y = (u * s + v * c) * gasta
    return {
      pe: [k.x + x, k.y + y * ACHATA],
      topo: [k.x + x * encolhe - 0.01, k.y + y * encolhe * ACHATA - k.altura],
    }
  })
  // Os lados, de trás para a frente, cada um com a luz pela direção da normal.
  const lados = quinas.map((p, i) => {
    const q = quinas[(i + 1) % 4]
    const mx = (p.pe[0] + q.pe[0]) / 2 - k.x
    const my = ((p.pe[1] + q.pe[1]) / 2 - k.y) / ACHATA
    const m = Math.hypot(mx, my) || 1
    const nz = 0.25
    const n = Math.hypot(1, nz)
    const brilho = ((mx / m) * LUZ_3D.x + (my / m) * LUZ_3D.y + nz * LUZ_3D.z) / n
    return { pontos: [p.pe, q.pe, q.topo, p.topo], fundo: my / m, brilho, i }
  })
  lados.sort((p, q) => p.fundo - q.fundo)
  for (const lado of lados) {
    g.fillStyle = css(tomDoLado(lado.brilho))
    caminho(g, lado.pontos)
    g.fill()
  }
  // A faixa clara de dentro: atravessa os lados da frente na diagonal, meio transparente.
  if (k.faixa) {
    const frente = lados.filter((l) => l.fundo > 0.2)
    g.fillStyle = css(DENTRO, 0.32)
    g.beginPath()
    for (const l of frente) {
      const [p, q, qt, pt] = l.pontos
      const t0 = 0.28 + 0.12 * sorteio(semente, 20 + l.i)
      const t1 = t0 + 0.2
      const em = (a: Ponto, b: Ponto, t: number): Ponto => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      const baixo0 = em(p, q, t0)
      const baixo1 = em(p, q, t1)
      const alto0 = em(pt, qt, t0 + 0.16)
      const alto1 = em(pt, qt, t1 + 0.16)
      g.moveTo(baixo0[0], baixo0[1] - 0.012)
      g.lineTo(baixo1[0], baixo1[1] - 0.012)
      g.lineTo(alto1[0], alto1[1] + 0.008)
      g.lineTo(alto0[0], alto0[1] + 0.008)
      g.closePath()
    }
    g.fill()
  }
  // O topo; a quina lascada vira um corte que mostra o lado claro.
  const topo = quinas.map((q) => q.topo)
  let contorno: Ponto[] = topo
  if (k.lasca >= 0) {
    const i = k.lasca
    const antes = topo[(i + 3) % 4]
    const depois = topo[(i + 1) % 4]
    const quina = topo[i]
    const corte = 0.3
    const p1: Ponto = [quina[0] + (antes[0] - quina[0]) * corte, quina[1] + (antes[1] - quina[1]) * corte]
    const p2: Ponto = [quina[0] + (depois[0] - quina[0]) * corte, quina[1] + (depois[1] - quina[1]) * corte]
    contorno = [...topo.slice(0, i), p1, p2, ...topo.slice(i + 1)]
    // O fundo da lasca: um triângulo baixo no tom do lado claro.
    g.fillStyle = css(GELO_CLARO)
    caminho(g, [p1, quina, p2, [quina[0], quina[1] + k.altura * 0.35]])
    g.fill()
  }
  g.fillStyle = css(GELO_TOPO)
  caminho(g, contorno)
  g.fill()
  // A beira acesa: as quinas do topo que olham para a luz (as de cima e da esquerda).
  g.strokeStyle = css(BEIRA)
  g.lineWidth = 0.018
  g.lineCap = 'round'
  g.beginPath()
  for (let i = 0; i < contorno.length; i++) {
    const p = contorno[i]
    const q = contorno[(i + 1) % contorno.length]
    // A normal para fora do lado do topo (na tela): aponta para a luz?
    const nx = q[1] - p[1]
    const ny = -(q[0] - p[0])
    const mx = (p[0] + q[0]) / 2 - k.x
    const my = (p[1] + q[1]) / 2 - (k.y - k.altura)
    const para = nx * mx + ny * my >= 0 ? 1 : -1
    if (para * (nx * -0.6 + ny * -0.8) <= 0) continue
    g.moveTo(p[0] + (q[0] - p[0]) * 0.08, p[1] + (q[1] - p[1]) * 0.08)
    g.lineTo(p[0] + (q[0] - p[0]) * 0.92, p[1] + (q[1] - p[1]) * 0.92)
  }
  g.stroke()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const blocos: Bloco[] = [
    {
      x: 0,
      y: -0.06,
      a: 0.25 * (0.92 + 0.16 * sorteio(semente, 1)),
      b: 0.19 * (0.92 + 0.16 * sorteio(semente, 2)),
      altura: 0.26 * (0.9 + 0.2 * sorteio(semente, 3)),
      giro: giro + 0.35,
      lasca: Math.floor(sorteio(semente, 4) * 4),
      faixa: true,
    },
  ]
  // A lasca do lado (às vezes): um bloco pequeno e baixo, encostado.
  if (sorteio(semente, 5) < 0.6) {
    const a = giro + 2.2 + (sorteio(semente, 6) - 0.5) * 0.8
    const d = 0.33
    blocos.push({
      x: Math.cos(a) * d,
      y: -0.06 + Math.sin(a) * d * ACHATA,
      a: 0.09,
      b: 0.07,
      altura: 0.1,
      giro: giro * 1.7 + 0.6,
      lasca: -1,
      faixa: false,
    })
  }
  blocos.sort((p, q) => p.y - q.y)
  blocos.forEach((b, i) => desenharBloco(g, b, semente + i * 7))
}

export const carimbo: DefinicaoDeCarimbo = { id: 'bloco-de-gelo', nome: 'Bloco de gelo', tamanho: 8, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [GELO_TOPO, GELO_CLARO, GELO_MEIO, GELO_ESCURO, BEIRA, DENTRO]
