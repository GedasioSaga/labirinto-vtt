import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Capim alto (item 124 dos carimbos de 14/11/2026): uma touceira de capim de
 * pasto que sai de um pé só e abre em chafariz, mais larga que alta. As
 * lâminas largas no pé, que afinam até a ponta, sobem e caem para fora; a
 * ponta de cada uma já secou (palha). Do meio sobem três ou quatro hastes que
 * se curvam com o peso do pendão: uma pluma clara em fuso, deitada para fora
 * como uma pena. O que o separa dos Juncos (hastes retas em leque estreito,
 * verde-azulado, a taboa marrom em pé) é o chafariz largo, o verde-oliva
 * puxado para o amarelo, a palha nas pontas e a pluma que tomba; da
 * Samambaia, a lâmina lisa (sem folíolos) que sobe em vez de deitar.
 *
 * Por dentro da touceira, um miolo de lâminas curtas e escuras dá corpo ao
 * tufo na mesa (só as lâminas soltas viravam risco no capim do mapa). Atrás dele as
 * lâminas que abrem para trás; na frente, as que abrem para quem vê. O giro
 * gira o chafariz em volta do pé; a luz não gira: a lâmina que cai para a
 * esquerda e para cima sai clara, a da direita e de baixo, escura.
 */

const MIOLO: Rgb = [46, 78, 44]
const LAMINA_ESCURA: Rgb = [70, 106, 52]
const LAMINA_CLARA: Rgb = [154, 176, 90]
const PALHA_ESCURA: Rgb = [146, 138, 84]
const PALHA_CLARA: Rgb = [210, 196, 132]
const HASTE: Rgb = [112, 120, 68]
const PLUMA: Rgb = [168, 150, 104]
const PLUMA_CLARA: Rgb = [222, 210, 162]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

type Ponto = readonly [number, number]

/** Uma curva do pé à ponta, puxada para `meio`. */
interface Curva {
  pe: Ponto
  meio: Ponto
  ponta: Ponto
}

/** Uma lâmina: a curva, a meia largura no pé, onde a palha começa, para onde abre e quanto pega de luz. */
interface Lamina extends Curva {
  largura: number
  /** De 0 (no pé) a 1 (na ponta): onde a palha começa. */
  palha: number
  /** -1 abre para trás, 1 abre para quem vê. */
  frente: number
  /** 0 de costas para a luz, 1 de frente. */
  luz: number
}

const LAMINAS = 20
const PASSOS = 9
/** O chão visto de cima e um pouco de frente: o que abre para os lados encolhe na vertical. */
const ACHATA = 0.5

function naCurva(c: Curva, t: number): { p: Ponto; n: Ponto } {
  const s = 1 - t
  const { pe: a, meio: m, ponta: b } = c
  const p: Ponto = [s * s * a[0] + 2 * s * t * m[0] + t * t * b[0], s * s * a[1] + 2 * s * t * m[1] + t * t * b[1]]
  const dx = 2 * s * (m[0] - a[0]) + 2 * t * (b[0] - m[0])
  const dy = 2 * s * (m[1] - a[1]) + 2 * t * (b[1] - m[1])
  const d = Math.hypot(dx, dy) || 1
  return { p, n: [-dy / d, dx / d] }
}

/**
 * O trecho da curva de `de` a `ate` (0 no pé, 1 na ponta), com a largura de
 * cada lado dada por `largura(t)`: `lado` 1 só do lado da normal, -1 só do
 * outro, 0 dos dois.
 */
function tracar(g: CanvasRenderingContext2D, c: Curva, de: number, ate: number, largura: (t: number) => number, lado: -1 | 0 | 1 = 0): void {
  g.beginPath()
  contornar(g, c, de, ate, largura, lado)
}

/** O mesmo contorno de `tracar`, somado ao caminho aberto (várias lâminas num preenchimento só). */
function contornar(g: CanvasRenderingContext2D, c: Curva, de: number, ate: number, largura: (t: number) => number, lado: -1 | 0 | 1 = 0): void {
  const ida: Ponto[] = []
  const volta: Ponto[] = []
  for (let i = 0; i <= PASSOS; i++) {
    const t = de + ((ate - de) * i) / PASSOS
    const { p, n } = naCurva(c, t)
    const w = largura(t)
    const mais = lado === -1 ? 0 : w
    const menos = lado === 1 ? 0 : w
    ida.push([p[0] + n[0] * mais, p[1] + n[1] * mais])
    volta.push([p[0] - n[0] * menos, p[1] - n[1] * menos])
  }
  g.moveTo(ida[0][0], ida[0][1])
  for (const [x, y] of ida.slice(1)) g.lineTo(x, y)
  for (const [x, y] of volta.reverse()) g.lineTo(x, y)
  g.closePath()
}

function pintarLamina(g: CanvasRenderingContext2D, l: Lamina): void {
  const k = Math.min(1, Math.max(0, 0.06 + 0.62 * l.luz + 0.16 * (l.frente + 1)))
  const largura = (t: number) => l.largura * Math.pow(1 - t, 0.75)
  g.fillStyle = css(misturar(LAMINA_ESCURA, LAMINA_CLARA, k))
  tracar(g, l, 0, 1, largura)
  g.fill()
  g.fillStyle = css(misturar(PALHA_ESCURA, PALHA_CLARA, k))
  tracar(g, l, l.palha, 1, largura)
  g.fill()
}

function laminas(giro: number, semente: number): Lamina[] {
  return Array.from({ length: LAMINAS }, (_, i): Lamina => {
    const a = giro + (i * Math.PI * 2) / LAMINAS + (sorteio(semente, i) - 0.5) * 0.45
    const dx = Math.cos(a)
    const dy = Math.sin(a) * ACHATA
    // Quanto a lâmina abre: a que fica em pé é alta e quase não sai do pé; a de fora cai longe e mais baixo.
    const abre = sorteio(semente, 20 + i)
    const alcance = 0.2 + 0.32 * abre
    const alto = 0.8 - 0.34 * abre + 0.1 * sorteio(semente, 40 + i)
    const pe: Ponto = [dx * 0.07, -0.03 + dy * 0.08]
    return {
      pe,
      meio: [pe[0] + dx * alcance * 0.42, pe[1] + dy * alcance * 0.42 - alto * 1.16],
      ponta: [pe[0] + dx * alcance, pe[1] + dy * alcance - alto * (0.6 - 0.26 * abre)],
      largura: 0.046 + 0.012 * sorteio(semente, 60 + i),
      palha: 0.58 + 0.2 * sorteio(semente, 80 + i),
      frente: Math.sin(a),
      luz: voltadoParaALuz(dx, dy - 0.2),
    }
  }).sort((p, q) => p.frente - q.frente)
}

/** As hastes do pendão, que tombam para fora com o peso, e a pluma em fuso no alto de cada uma. */
function desenharPendoes(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const quantos = 3 + (sorteio(semente, 100) < 0.5 ? 1 : 0)
  const hastes = Array.from({ length: quantos }, (_, i): Curva => {
    const a = giro + 0.7 + (i * Math.PI * 2) / quantos + (sorteio(semente, 101 + i) - 0.5) * 0.6
    const dx = Math.cos(a)
    const dy = Math.sin(a) * ACHATA
    const alto = 0.92 + 0.12 * sorteio(semente, 105 + i)
    const tomba = 0.15 + 0.08 * sorteio(semente, 109 + i)
    const pe: Ponto = [dx * 0.03, -0.1]
    return { pe, meio: [dx * 0.08, -alto * 1.18], ponta: [dx * tomba, dy * tomba - alto * 0.86] }
  })
  const PLUMA_DE = 0.56
  const fuso = (t: number) => 0.042 * Math.sin((Math.PI * (t - PLUMA_DE)) / (1 - PLUMA_DE)) ** 0.8
  g.fillStyle = css(HASTE)
  for (const h of hastes) {
    tracar(g, h, 0, PLUMA_DE + 0.05, (t) => 0.011 * (1 - t * 0.4))
    g.fill()
  }
  for (const h of hastes) {
    g.fillStyle = css(PLUMA)
    tracar(g, h, PLUMA_DE, 1, fuso)
    g.fill()
    // A metade da pluma que olha para a luz, clara.
    const { n } = naCurva(h, 0.78)
    g.fillStyle = css(PLUMA_CLARA)
    tracar(g, h, PLUMA_DE + 0.03, 0.98, (t) => fuso(t) * 0.8, voltadoParaALuz(n[0], n[1]) > 0.5 ? 1 : -1)
    g.fill()
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const todas = laminas(giro, semente)
  // As que abrem para trás ficam atrás do miolo e das hastes.
  for (const l of todas.filter((l) => l.frente < -0.25)) pintarLamina(g, l)
  desenharPendoes(g, giro, semente)
  // O miolo: a sombra de dentro da touceira, feita de lâminas curtas e escuras
  // em leque (um vaso liso no lugar delas virava um capim plantado num pote).
  g.fillStyle = css(MIOLO)
  g.beginPath()
  for (let i = 0; i < 9; i++) {
    const a = giro + 0.35 + (i * Math.PI * 2) / 9 + (sorteio(semente, 120 + i) - 0.5) * 0.4
    const dx = Math.cos(a)
    const dy = Math.sin(a) * ACHATA
    const alto = 0.34 + 0.1 * sorteio(semente, 130 + i)
    const curta: Curva = { pe: [dx * 0.04, -0.02 + dy * 0.05], meio: [dx * 0.07, -alto * 1.1 + dy * 0.06], ponta: [dx * 0.19, -alto + dy * 0.14] }
    contornar(g, curta, 0, 1, (t) => 0.055 * Math.pow(1 - t, 0.7))
  }
  g.fill()
  for (const l of todas.filter((l) => l.frente >= -0.25)) pintarLamina(g, l)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'capim-alto', nome: 'Capim alto', tamanho: 6, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [MIOLO, LAMINA_ESCURA, LAMINA_CLARA, PALHA_ESCURA, PALHA_CLARA, HASTE, PLUMA, PLUMA_CLARA]
