import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Carvalho grande (item 115 da lista de 14/11/2026): a copa LARGA em
 * cúpula, mais larga que alta, de muitos cachos miúdos num verde-oliva
 * fechado, sobre um tronco grosso e curto que abre em pernadas; no vão de
 * baixo da copa, a sombra funda e as pernadas à mostra. O que o separa da
 * Árvore (três cachos verde-mata num tronco fino) é o tamanho, a largura,
 * o verde mais oliva e o tronco de pernadas; faz uma sombra larga no chão.
 * A luz é a de todos (de cima à esquerda): os cachos da direita mais
 * apagados, os do alto mais acesos. O giro gira os lóbulos e mexe na
 * arrumação; a semente, o tamanho de cada cacho e o desenho das raízes.
 */

type Ponto = readonly [number, number]

const CASCA_CLARA: Rgb = [128, 108, 84]
const CASCA: Rgb = [94, 78, 62]
const CASCA_SOMBRA: Rgb = [68, 56, 46]
const VAO_DA_COPA: Rgb = [30, 60, 42]
const FOLHA_ESCURA: Rgb = [42, 84, 50]
const FOLHA: Rgb = [70, 116, 62]
const FOLHA_CLARA: Rgb = [122, 154, 88]

/** Clareia (`f` > 0) ou escurece (`f` < 0) mantendo o tom. */
function luz(c: Rgb, f: number): Rgb {
  return f >= 0 ? misturar(c, [236, 238, 226], f) : misturar(c, [8, 18, 22], -f)
}

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Vários círculos num caminho só: o preenchimento é a união deles, sem emenda. */
function circulos(g: CanvasRenderingContext2D, lista: ReadonlyArray<readonly [number, number, number]>): void {
  g.beginPath()
  for (const [x, y, r] of lista) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  g.fill()
}

/**
 * Uma pernada que afina de `a` até `b`, curvada por `c`, acrescentada ao
 * caminho aberto (quem chama faz o `beginPath` e o `fill`). Sempre no mesmo
 * sentido, então a união de várias não fura.
 */
function galho(g: CanvasRenderingContext2D, a: Ponto, c: Ponto, b: Ponto, grosso: number, fino: number): void {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const n = Math.hypot(dx, dy) || 1
  const nx = -dy / n
  const ny = dx / n
  const meio = (grosso + fino) / 2
  g.moveTo(a[0] + nx * grosso, a[1] + ny * grosso)
  g.quadraticCurveTo(c[0] + nx * meio, c[1] + ny * meio, b[0] + nx * fino, b[1] + ny * fino)
  g.lineTo(b[0] - nx * fino, b[1] - ny * fino)
  g.quadraticCurveTo(c[0] - nx * meio, c[1] - ny * meio, a[0] - nx * grosso, a[1] - ny * grosso)
  g.closePath()
}

/** Os lóbulos de um cacho: o miolo e `n` em volta, miúdos (a folhagem do carvalho é crespa). */
function lobulos(cx: number, cy: number, raio: number, giro: number, semente: number, n: number): Array<[number, number, number]> {
  const lista: Array<[number, number, number]> = [[cx, cy, raio * 0.68]]
  for (let i = 0; i < n; i++) {
    const a = giro + (i * Math.PI * 2) / n + (sorteio(semente, i) - 0.5) * 0.5
    const r = raio * (0.32 + 0.1 * sorteio(semente, i + 10))
    const d = raio * 0.64
    lista.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.86, r])
  }
  return lista
}

interface Cacho {
  x: number
  y: number
  r: number
  luz: number
}

/**
 * Os cachos da cúpula: três atrás no alto, dois na frente embaixo (com o vão
 * entre eles, onde aparecem as pernadas) e um no topo, que tampa os outros.
 */
const CACHOS: ReadonlyArray<Cacho> = [
  { x: -0.4, y: -0.7, r: 0.21, luz: 0 },
  { x: 0.4, y: -0.68, r: 0.2, luz: -0.12 },
  { x: -0.37, y: -0.47, r: 0.19, luz: -0.03 },
  { x: 0.36, y: -0.45, r: 0.18, luz: -0.14 },
  { x: -0.13, y: -0.86, r: 0.23, luz: 0.05 },
  { x: 0.17, y: -0.84, r: 0.22, luz: -0.02 },
  { x: 0.01, y: -0.66, r: 0.21, luz: 0.02 },
]

function desenharCarvalho(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const inclina = Math.sin(giro) * 0.025
  const forquilha: Ponto = [inclina, -0.3]
  const cachos = CACHOS.map((c, i) => ({
    x: c.x + Math.cos(giro + i * 2.2) * 0.02,
    y: c.y + Math.sin(giro + i * 2.2) * 0.018,
    r: c.r * (0.93 + 0.14 * sorteio(semente, 20 + i)),
    luz: c.luz,
    i,
  }))

  // O tronco grosso com as raízes abrindo no chão: o corpo na sombra...
  const raizDireita = 0.17 + 0.05 * sorteio(semente, 30)
  const raizEsquerda = 0.16 + 0.04 * sorteio(semente, 31)
  g.fillStyle = css(CASCA_SOMBRA)
  g.beginPath()
  g.moveTo(-raizEsquerda, 0.03)
  g.quadraticCurveTo(-0.07, 0.01, -0.07, -0.09)
  g.lineTo(-0.055 + inclina, forquilha[1])
  g.lineTo(0.06 + inclina, forquilha[1])
  g.lineTo(0.075, -0.09)
  g.quadraticCurveTo(0.08, 0.012, raizDireita, 0.038)
  g.quadraticCurveTo(0.05, 0.05, 0, 0.035)
  g.quadraticCurveTo(-0.06, 0.05, -raizEsquerda, 0.03)
  g.closePath()
  g.fill()
  // ...o meio-tom e a faixa da luz, à esquerda.
  g.fillStyle = css(CASCA)
  g.beginPath()
  g.moveTo(-raizEsquerda, 0.03)
  g.quadraticCurveTo(-0.07, 0.01, -0.07, -0.09)
  g.lineTo(-0.055 + inclina, forquilha[1])
  g.lineTo(0.018 + inclina, forquilha[1])
  g.lineTo(0.022, 0.03)
  g.quadraticCurveTo(-0.07, 0.048, -raizEsquerda, 0.03)
  g.closePath()
  g.fill()
  g.fillStyle = css(CASCA_CLARA)
  g.beginPath()
  g.moveTo(-raizEsquerda + 0.02, 0.026)
  g.quadraticCurveTo(-0.06, 0.008, -0.062, -0.09)
  g.lineTo(-0.05 + inclina, forquilha[1] + 0.02)
  g.lineTo(-0.02 + inclina, forquilha[1] + 0.02)
  g.lineTo(-0.025, 0.03)
  g.closePath()
  g.fill()

  // As pernadas: da forquilha até o miolo dos cachos da frente e do alto; aparecem no vão.
  g.fillStyle = css(CASCA)
  g.beginPath()
  for (const c of cachos.filter((c) => c.i >= 2 && c.i !== 6)) {
    const meio: Ponto = [(forquilha[0] + c.x) / 2 + c.x * 0.12, (forquilha[1] + c.y) / 2 + 0.04]
    galho(g, forquilha, meio, [c.x * 0.8, c.y + c.r * 0.2], 0.045, 0.016)
  }
  g.fill()

  // O vão da copa: a sombra funda por baixo da cúpula, pousando nas pernadas.
  g.fillStyle = css(VAO_DA_COPA)
  circulos(g, [
    ...lobulos(-0.2, -0.58, 0.2, giro + 4, semente * 3 + 40, 7),
    ...lobulos(0.22, -0.56, 0.2, giro + 5, semente * 3 + 41, 7),
    [0.01, -0.55, 0.12],
  ])

  // Os cachos: os de trás e os de baixo primeiro; o do topo por último.
  const ordem = [...cachos].sort((p, q) => {
    const fundo = (c: { i: number; y: number }) => (c.i === 6 ? 0 : c.i < 2 ? -2 : c.i < 4 ? -1 : 1)
    return fundo(p) - fundo(q) || q.y - p.y
  })
  for (const c of ordem) {
    const lobos = giro + c.i * 2.1
    const s = semente * 7 + c.i
    g.fillStyle = css(luz(FOLHA_ESCURA, c.luz))
    circulos(g, lobulos(c.x, c.y, c.r, lobos, s, 9))
    g.fillStyle = css(luz(FOLHA, c.luz))
    circulos(g, lobulos(c.x - c.r * 0.13, c.y - c.r * 0.16, c.r * 0.76, lobos, s, 8))
    g.fillStyle = css(luz(FOLHA_CLARA, c.luz))
    circulos(g, lobulos(c.x - c.r * 0.34, c.y - c.r * 0.38, c.r * 0.38, lobos, s, 5))
  }
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'carvalho',
  nome: 'Carvalho grande',
  tamanho: 18,
  sombra: 'em-pe',
  desenhar: desenharCarvalho,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [CASCA_CLARA, CASCA, CASCA_SOMBRA, VAO_DA_COPA, FOLHA_ESCURA, FOLHA, FOLHA_CLARA]
