import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Conchas e estrela-do-mar (item 134 dos carimbos de 14/11/2026): o que a
 * maré deixa na areia. A estrela-do-mar laranja é a peça que se lê de longe
 * (cinco braços, a espinha clara no meio de cada um, a espessura escura
 * embaixo à direita); em volta, uma vieira em leque (cor de pêssego, os
 * gomos em dois tons e as "orelhas" na dobradiça), um caramujo de topo
 * redondo com a espiral marcada e, às vezes, um berbigão pequeno. Tudo
 * chato no chão, com a luz de cima à esquerda. O giro gira o arranjo, a
 * estrela e a abertura do leque; a luz não gira.
 */

const ESTRELA_ESCURA: Rgb = [150, 76, 58]
const ESTRELA: Rgb = [196, 108, 76]
const ESTRELA_CLARA: Rgb = [228, 160, 112]
const VIEIRA_ESCURA: Rgb = [150, 100, 82]
const VIEIRA: Rgb = [228, 186, 152]
const VIEIRA_GOMO: Rgb = [198, 144, 114]
const CARAMUJO_ESCURO: Rgb = [128, 98, 76]
const CARAMUJO: Rgb = [196, 168, 132]
const CARAMUJO_CLARO: Rgb = [226, 210, 180]
const ESPIRAL: Rgb = [112, 82, 64]
const BOCA: Rgb = [196, 132, 128]
const BERBIGAO_ESCURO: Rgb = [134, 118, 100]
const BERBIGAO: Rgb = [214, 200, 178]

/** O chão visto de cima e um pouco de frente. */
const ACHATA = 0.6
const MEIO_Y = -0.06

type Ponto = readonly [number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function elipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, cor: Rgb): void {
  g.fillStyle = css(cor)
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  g.fill()
}

/** Um ponto no chão a partir de um centro na tela: ângulo e distância antes de achatar. */
function noChao(cx: number, cy: number, a: number, d: number): Ponto {
  return [cx + Math.cos(a) * d, cy + Math.sin(a) * d * ACHATA]
}

function caminhoDaEstrela(g: CanvasRenderingContext2D, cx: number, cy: number, raio: number, giro: number): void {
  const braco = (Math.PI * 2) / 5
  g.beginPath()
  for (let k = 0; k < 5; k++) {
    const a = giro + k * braco
    const vale = noChao(cx, cy, a - braco / 2, raio * 0.4)
    const lado1 = noChao(cx, cy, a - 0.13, raio * 0.8)
    const ponta = noChao(cx, cy, a, raio * 1.1)
    const lado2 = noChao(cx, cy, a + 0.13, raio * 0.8)
    if (k === 0) g.moveTo(vale[0], vale[1])
    else g.lineTo(vale[0], vale[1])
    g.lineTo(lado1[0], lado1[1])
    g.quadraticCurveTo(ponta[0], ponta[1], lado2[0], lado2[1])
  }
  g.closePath()
}

function desenharEstrela(g: CanvasRenderingContext2D, cx: number, cy: number, raio: number, giro: number): void {
  // A espessura, que aparece embaixo à direita.
  g.fillStyle = css(ESTRELA_ESCURA)
  caminhoDaEstrela(g, cx + raio * 0.03, cy + raio * 0.05, raio, giro)
  g.fill()
  g.fillStyle = css(ESTRELA)
  caminhoDaEstrela(g, cx - raio * 0.02, cy - raio * 0.02, raio * 0.95, giro)
  g.fill()
  // A espinha de cada braço, clara, e o meio.
  g.strokeStyle = css(ESTRELA_CLARA)
  g.lineWidth = raio * 0.16
  g.lineCap = 'round'
  g.beginPath()
  for (let k = 0; k < 5; k++) {
    const a = giro + (k * Math.PI * 2) / 5
    const [x0, y0] = noChao(cx - raio * 0.04, cy - raio * 0.05, a, raio * 0.12)
    const [x1, y1] = noChao(cx - raio * 0.04, cy - raio * 0.05, a, raio * 0.66)
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
  }
  g.stroke()
}

function caminhoDoLeque(g: CanvasRenderingContext2D, hx: number, hy: number, raio: number, abre: number, de: number, ate: number): void {
  const gomos = 7
  const passo = (ate - de) / gomos
  g.beginPath()
  g.moveTo(hx, hy)
  const primeiro = noChao(hx, hy, abre + de, raio)
  g.lineTo(primeiro[0], primeiro[1])
  for (let j = 0; j < gomos; j++) {
    const meio = noChao(hx, hy, abre + de + passo * (j + 0.5), raio * 1.09)
    const fim = noChao(hx, hy, abre + de + passo * (j + 1), raio)
    g.quadraticCurveTo(meio[0], meio[1], fim[0], fim[1])
  }
  g.closePath()
}

/** A vieira: o leque abre na direção `abre` a partir da dobradiça (hx, hy). */
function desenharVieira(g: CanvasRenderingContext2D, hx: number, hy: number, raio: number, abre: number): void {
  const abertura = 0.95
  g.fillStyle = css(VIEIRA_ESCURA)
  caminhoDoLeque(g, hx + raio * 0.05, hy + raio * 0.08, raio, abre, -abertura, abertura)
  g.fill()
  g.fillStyle = css(VIEIRA)
  caminhoDoLeque(g, hx, hy, raio, abre, -abertura, abertura)
  g.fill()
  // Os gomos: um sim, um não, no tom do meio, do pé até a beira.
  g.fillStyle = css(VIEIRA_GOMO)
  g.beginPath()
  const gomos = 7
  const passo = (abertura * 2) / gomos
  for (let j = 1; j < gomos; j += 2) {
    const a0 = abre - abertura + passo * j
    const p0 = noChao(hx, hy, a0 + passo * 0.12, raio * 0.96)
    const p1 = noChao(hx, hy, a0 + passo * 0.88, raio * 0.96)
    g.moveTo(hx, hy)
    g.lineTo(p0[0], p0[1])
    g.lineTo(p1[0], p1[1])
    g.closePath()
  }
  g.fill()
  // As orelhas da dobradiça.
  const o1 = noChao(hx, hy, abre + Math.PI / 2, raio * 0.26)
  const o2 = noChao(hx, hy, abre - Math.PI / 2, raio * 0.26)
  const o3 = noChao(hx, hy, abre, raio * 0.22)
  const atras = noChao(hx, hy, abre + Math.PI, raio * 0.05)
  g.beginPath()
  g.moveTo(atras[0], atras[1])
  g.lineTo(o1[0], o1[1])
  g.lineTo(o3[0], o3[1])
  g.lineTo(o2[0], o2[1])
  g.closePath()
  g.fill()
}

/** O caramujo visto de cima: o casco redondo, a espiral do ápice para fora e a boca rosada. */
function desenharCaramujo(g: CanvasRenderingContext2D, cx: number, cy: number, raio: number, giro: number): void {
  elipse(g, cx + raio * 0.08, cy + raio * 0.12, raio, raio * 0.8, CARAMUJO_ESCURO)
  elipse(g, cx, cy, raio * 0.94, raio * 0.74, CARAMUJO)
  elipse(g, cx - raio * 0.28, cy - raio * 0.24, raio * 0.48, raio * 0.36, CARAMUJO_CLARO)
  const boca = noChao(cx, cy, giro + 0.6, raio * 0.78)
  elipse(g, boca[0], boca[1], raio * 0.3, raio * 0.2, BOCA)
  g.strokeStyle = css(ESPIRAL)
  g.lineWidth = raio * 0.13
  g.lineCap = 'round'
  g.beginPath()
  const passos = 18
  for (let i = 0; i <= passos; i++) {
    const t = i / passos
    const a = giro + t * Math.PI * 3.2
    const d = raio * (0.06 + 0.72 * t)
    const x = cx - raio * 0.08 + Math.cos(a) * d
    const y = cy - raio * 0.08 + Math.sin(a) * d * 0.78
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
}

function desenharBerbigao(g: CanvasRenderingContext2D, cx: number, cy: number, raio: number): void {
  elipse(g, cx + raio * 0.08, cy + raio * 0.12, raio, raio * 0.78, BERBIGAO_ESCURO)
  elipse(g, cx - raio * 0.04, cy - raio * 0.04, raio * 0.88, raio * 0.66, BERBIGAO)
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const pos = (a: number, d: number): Ponto => [Math.cos(a) * d, MEIO_Y + Math.sin(a) * d * ACHATA]
  const jit = (i: number) => (sorteio(semente, i) - 0.5) * 0.4
  const aEstrela = giro + jit(1)
  const aVieira = giro + 2.3 + jit(2)
  const aCaramujo = giro + 3.9 + jit(3)
  const aBerbigao = giro + 5.1 + jit(4)
  const estrela = pos(aEstrela, 0.08)
  const vieira = pos(aVieira, 0.29)
  const caramujo = pos(aCaramujo, 0.3)
  const berbigao = pos(aBerbigao, 0.33)
  const pecas = [
    { y: estrela[1], faz: () => desenharEstrela(g, estrela[0], estrela[1], 0.26 * (0.94 + 0.12 * sorteio(semente, 5)), giro * 1.7 + sorteio(semente, 6)) },
    { y: vieira[1] + 0.06, faz: () => desenharVieira(g, vieira[0], vieira[1], 0.19, aVieira + (sorteio(semente, 7) - 0.5) * 0.6) },
    { y: caramujo[1], faz: () => desenharCaramujo(g, caramujo[0], caramujo[1], 0.11, giro + semente) },
    ...(sorteio(semente, 8) < 0.6 ? [{ y: berbigao[1], faz: () => desenharBerbigao(g, berbigao[0], berbigao[1], 0.065) }] : []),
  ].sort((p, q) => p.y - q.y)
  for (const p of pecas) p.faz()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'conchas', nome: 'Conchas e estrela-do-mar', tamanho: 7, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [
  ESTRELA_ESCURA,
  ESTRELA,
  ESTRELA_CLARA,
  VIEIRA_ESCURA,
  VIEIRA,
  VIEIRA_GOMO,
  CARAMUJO_ESCURO,
  CARAMUJO,
  CARAMUJO_CLARO,
  ESPIRAL,
  BOCA,
  BERBIGAO_ESCURO,
  BERBIGAO,
]
