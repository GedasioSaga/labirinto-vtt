import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Arbusto com frutinhas (item 127 dos carimbos de 14/11/2026): uma moita
 * redonda e fechada, de folha miúda, carregada de cachinhos de frutinhas
 * vermelhas. O verde é mais fundo e mais frio que o do Arbusto, para o
 * vermelho saltar; e a beira não é lisa: uma coroa de folhas pontudas escapa
 * por baixo dos lóbulos, e umas folhinhas claras do lado da luz dão a
 * textura de folha. Cada frutinha tem a sombra para baixo e para a direita e,
 * do lado da luz, um ponto de brilho.
 *
 * O que o separa do Arbusto é o vermelho e a beira de folhas; da Macieira, o
 * tamanho (moita de uma casa, sem tronco) e as frutas miúdas em cacho. O giro
 * gira os lóbulos, a coroa de folhas e os cachos; a luz não gira.
 */

const FOLHA_ESCURA: Rgb = [34, 82, 58]
const FOLHA_MEDIA: Rgb = [54, 110, 70]
const FOLHA_CLARA: Rgb = [98, 150, 94]
const FRUTA_SOMBRA: Rgb = [112, 40, 50]
const FRUTA: Rgb = [178, 64, 70]
const FRUTA_BRILHO: Rgb = [232, 172, 164]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

function circulos(g: CanvasRenderingContext2D, lista: ReadonlyArray<readonly [number, number, number]>): void {
  g.beginPath()
  for (const [x, y, r] of lista) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  g.fill()
}

type Ponto = readonly [number, number]
type Circulo = [number, number, number]

/** A copa da moita no quadro (o pé em 0, 0): um pouco mais alta que a do Arbusto. */
const COPA = { cy: -0.3, raio: 0.37 } as const
/** A copa é vista de cima e um pouco de frente: achatada de leve na vertical. */
const ACHATA = 0.88

function lobulos(giro: number, semente: number, encolher: number, dx: number, dy: number): Circulo[] {
  const { cy, raio } = COPA
  const lista: Circulo[] = [[dx, cy + dy, raio * 0.66 * encolher]]
  for (let i = 0; i < 8; i++) {
    const a = giro + (i * Math.PI * 2) / 8 + (sorteio(semente, i) - 0.5) * 0.5
    const r = raio * (0.34 + 0.1 * sorteio(semente, i + 10)) * encolher
    const d = raio * 0.58 * encolher
    lista.push([dx + Math.cos(a) * d, cy + dy + Math.sin(a) * d * ACHATA, r])
  }
  return lista
}

/** Uma folha em gota, do pé `a` à ponta `b`, de meia largura `w` (no caminho aberto). */
function folha(g: CanvasRenderingContext2D, a: Ponto, b: Ponto, w: number): void {
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const m = Math.hypot(dx, dy) || 1
  const nx = (-dy / m) * w * 2
  const ny = (dx / m) * w * 2
  g.moveTo(a[0], a[1])
  g.quadraticCurveTo(mx + nx, my + ny, b[0], b[1])
  g.quadraticCurveTo(mx - nx, my - ny, a[0], a[1])
}

/** A coroa de folhas pontudas por baixo dos lóbulos: só as pontas escapam, e a beira fica de folha. */
function desenharCoroa(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const { cy, raio } = COPA
  const folhas = Array.from({ length: 14 }, (_, i) => {
    const a = giro + 0.2 + (i * Math.PI * 2) / 14 + (sorteio(semente, 30 + i) - 0.5) * 0.3
    const c = Math.cos(a)
    const s = Math.sin(a)
    // Pouco para fora: a beira fica de folha, sem virar ouriço.
    const longe = raio * (0.98 + 0.1 * sorteio(semente, 50 + i))
    return { pe: [c * raio * 0.6, cy + s * raio * 0.6 * ACHATA] as Ponto, ponta: [c * longe, cy + s * longe * ACHATA] as Ponto, luz: voltadoParaALuz(c, s) }
  })
  for (const [tom, daLuz] of [[FOLHA_ESCURA, false], [FOLHA_MEDIA, true]] as const) {
    g.fillStyle = css(tom)
    g.beginPath()
    for (const f of folhas.filter((f) => f.luz > 0.62 === daLuz)) folha(g, f.pe, f.ponta, 0.05)
    g.fill()
  }
}

/** As folhinhas soltas por cima da copa: claras do lado da luz, médias no resto. */
function desenharFolhinhas(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const { cy, raio } = COPA
  const folhas = Array.from({ length: 12 }, (_, i) => {
    const a = giro * 1.3 + i * 2.39996
    const d = raio * (0.25 + 0.55 * Math.sqrt((i + 0.5) / 12))
    const x = Math.cos(a) * d
    const y = cy + Math.sin(a) * d * ACHATA
    const rumo = a + 1.1 + (sorteio(semente, 70 + i) - 0.5) * 0.8
    const comprimento = 0.08 + 0.02 * sorteio(semente, 80 + i)
    const pe: Ponto = [x - Math.cos(rumo) * comprimento * 0.5, y - Math.sin(rumo) * comprimento * 0.5]
    const ponta: Ponto = [x + Math.cos(rumo) * comprimento * 0.5, y + Math.sin(rumo) * comprimento * 0.5]
    return { pe, ponta, luz: voltadoParaALuz(x + 0.06, y - cy + 0.06) }
  })
  for (const [tom, daLuz] of [[FOLHA_MEDIA, false], [FOLHA_CLARA, true]] as const) {
    g.fillStyle = css(tom)
    g.beginPath()
    for (const f of folhas.filter((f) => f.luz > 0.55 === daLuz)) folha(g, f.pe, f.ponta, 0.022)
    g.fill()
  }
}

/** Os cachos de três frutinhas, mais no alto e na frente da copa (o que se vê de cima). */
function frutas(giro: number, semente: number): Circulo[] {
  const { cy, raio } = COPA
  const cachos = 6 + Math.floor(sorteio(semente, 90) * 3)
  const lista: Circulo[] = []
  for (let i = 0; i < cachos; i++) {
    const a = giro + i * 2.39996 + sorteio(semente, 91 + i) * 0.5
    const d = raio * (0.2 + 0.58 * Math.sqrt((i + 0.5) / cachos))
    const x = Math.cos(a) * d
    const y = cy + Math.sin(a) * d * ACHATA
    const r = 0.032 + 0.006 * sorteio(semente, 100 + i)
    const vira = sorteio(semente, 110 + i) * Math.PI * 2
    const quantas = sorteio(semente, 120 + i) < 0.3 ? 2 : 3
    for (let k = 0; k < quantas; k++) {
      const b = vira + (k * Math.PI * 2) / 3
      lista.push([x + Math.cos(b) * r * 0.95, y + Math.sin(b) * r * 0.85, r])
    }
  }
  // De trás para a frente: a de baixo cobre a de cima.
  return lista.sort((p, q) => p[1] - q[1])
}

function desenharFrutas(g: CanvasRenderingContext2D, lista: readonly Circulo[]): void {
  g.fillStyle = css(FRUTA_SOMBRA)
  circulos(g, lista.map(([x, y, r]): Circulo => [x + r * 0.16, y + r * 0.18, r * 1.04]))
  g.fillStyle = css(FRUTA)
  circulos(g, lista.map(([x, y, r]): Circulo => [x - r * 0.06, y - r * 0.06, r * 0.86]))
  // O brilho só nas frutinhas do lado da luz.
  const { cy } = COPA
  g.fillStyle = css(FRUTA_BRILHO)
  circulos(
    g,
    lista.filter(([x, y]) => voltadoParaALuz(x + 0.05, y - cy + 0.05) > 0.38).map(([x, y, r]): Circulo => [x - r * 0.38, y - r * 0.4, r * 0.3]),
  )
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  desenharCoroa(g, giro, semente)
  g.fillStyle = css(FOLHA_ESCURA)
  circulos(g, lobulos(giro, semente, 1, 0, 0))
  g.fillStyle = css(FOLHA_MEDIA)
  circulos(g, lobulos(giro, semente, 0.78, -COPA.raio * 0.12, -COPA.raio * 0.15))
  g.fillStyle = css(FOLHA_CLARA)
  circulos(g, lobulos(giro, semente, 0.38, -COPA.raio * 0.34, -COPA.raio * 0.38))
  desenharFolhinhas(g, giro, semente)
  desenharFrutas(g, frutas(giro, semente))
}

export const carimbo: DefinicaoDeCarimbo = { id: 'arbusto-com-frutinhas', nome: 'Arbusto com frutinhas', tamanho: 6, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [FOLHA_ESCURA, FOLHA_MEDIA, FOLHA_CLARA, FRUTA_SOMBRA, FRUTA, FRUTA_BRILHO]
