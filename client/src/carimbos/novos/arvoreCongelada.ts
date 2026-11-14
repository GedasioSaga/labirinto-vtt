import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Árvore congelada (item 142 dos carimbos de 14/11/2026): a árvore de folha
 * larga pega pela geada, os galhos sem folha cobertos de gelo. A forma é a da
 * Árvore (`embutidos.ts`, `desenharArvore`): o tronco com as raízes, a copa
 * em três cachos (dois embaixo, um maior no alto) e a sombra da copa por
 * baixo. O que muda é o que a copa é: a folhagem gelada (o verde da mata
 * apagado e esfriado) aparece só na beira de baixo à direita e nas frestas,
 * e por cima dela a GEADA nos brancos azulados do gelo, puxada para a luz;
 * as pontas dos galhos, com uma forquilha, furam a borda dos cachos, e uns
 * pingentes de gelo pendem embaixo deles. A beira escura segura a árvore em
 * cima do chão branco do mapa de neve (copa toda branca sumiria nele). O
 * tronco é a madeira fria, acinzentada.
 * O giro gira o contorno de cada cacho e inclina de leve; a luz não gira.
 */

const TRONCO: Rgb = [104, 96, 90]
const TRONCO_SOMBRA: Rgb = [70, 66, 66]
const GALHO: Rgb = [82, 78, 78]
/** A folhagem gelada que aparece por baixo da geada: o verde da mata apagado e esfriado. */
const SOMBRA_DA_COPA: Rgb = [58, 90, 98]
const GEADA_ESCURA: Rgb = [86, 124, 130]
const GEADA: Rgb = [178, 200, 218]
const GEADA_CLARA: Rgb = [224, 234, 241]
const PINGENTE: Rgb = [206, 228, 238]
const PINGENTE_SOMBRA: Rgb = [146, 184, 206]

interface TonsDaCopa {
  escuro: Rgb
  medio: Rgb
  claro: Rgb
}

const TONS: TonsDaCopa = { escuro: GEADA_ESCURA, medio: GEADA, claro: GEADA_CLARA }

type Ponto = readonly [number, number]

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

/** Os lóbulos de um cacho (os da copa da Árvore, mais curtos: a geada é mais lisa que a folha). */
function lobulos(cy: number, raio: number, giro: number, semente: number, encolher: number, dx: number, dy: number): Array<[number, number, number]> {
  const n = 6
  const lista: Array<[number, number, number]> = [[dx, cy + dy, raio * 0.7 * encolher]]
  for (let i = 0; i < n; i++) {
    const a = giro + (i * Math.PI * 2) / n + (sorteio(semente, i) - 0.5) * 0.5
    const r = raio * (0.42 + 0.1 * sorteio(semente, i + 10)) * encolher
    const d = raio * 0.52 * encolher
    lista.push([dx + Math.cos(a) * d, cy + dy + Math.sin(a) * d * 0.88, r])
  }
  return lista
}

function desenharCacho(g: CanvasRenderingContext2D, giro: number, semente: number, cy: number, raio: number, cx: number): void {
  g.fillStyle = css(TONS.escuro)
  circulos(g, lobulos(cy, raio, giro, semente, 1, cx, 0))
  g.fillStyle = css(TONS.medio)
  circulos(g, lobulos(cy, raio, giro, semente, 0.74, cx - raio * 0.15, -raio * 0.18))
  g.fillStyle = css(TONS.claro)
  circulos(g, lobulos(cy, raio, giro, semente, 0.42, cx - raio * 0.32, -raio * 0.36))
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const inclina = Math.sin(giro) * 0.035
  const topoDoTronco = -0.46
  // O tronco: a metade da luz, com a raiz da esquerda...
  g.fillStyle = css(TRONCO)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(-0.1, 0.026)
  g.quadraticCurveTo(-0.046, 0.004, -0.043, -0.1)
  g.lineTo(-0.033 + inclina, topoDoTronco)
  g.lineTo(inclina, topoDoTronco)
  g.closePath()
  g.fill()
  // ...e a da sombra, com a raiz da direita.
  const raiz = 0.1 + 0.035 * sorteio(semente, 80)
  g.fillStyle = css(TRONCO_SOMBRA)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(inclina, topoDoTronco)
  g.lineTo(0.033 + inclina, topoDoTronco)
  g.lineTo(0.043, -0.1)
  g.quadraticCurveTo(0.05, 0.004, raiz, 0.03)
  g.closePath()
  g.fill()

  const sobe = sorteio(semente, 81) < 0.5 ? -1 : 1
  const tamanho = (i: number) => 0.94 + 0.12 * sorteio(semente, 82 + i)
  const cachos = [
    { x: -0.21, y: -0.54 + 0.025 * sobe, r: 0.215 * tamanho(0) },
    { x: 0.21, y: -0.54 - 0.025 * sobe, r: 0.215 * tamanho(1) },
    { x: (sorteio(semente, 85) - 0.5) * 0.08 + inclina, y: -0.83, r: 0.27 * tamanho(2) },
  ]
  const lobosDoCacho = (i: number) => giro + i * 2.1
  const sementeDoCacho = (i: number) => semente * 3 + i * 17

  // As pontas dos galhos nus: saem do miolo de cada cacho e furam a borda.
  g.strokeStyle = css(GALHO)
  g.lineCap = 'round'
  g.lineWidth = 0.02
  g.beginPath()
  cachos.forEach((c, i) => {
    // Dois galhos nos cachos de baixo, três no do alto, cada um com uma forquilha na ponta.
    const pontas = i === 2 ? 3 : 2
    for (let k = 0; k < pontas; k++) {
      // Só para os lados e para cima: a ponta que desce sumia atrás do tronco.
      const a = Math.PI * (1.08 + (0.84 * (k + 0.15 + 0.7 * sorteio(semente, 90 + i * 5 + k))) / pontas) + (i === 0 ? -0.4 : i === 1 ? 0.4 : 0)
      const ate = c.r * (1.2 + 0.18 * sorteio(semente, 110 + i * 5 + k))
      const meio = c.r * 0.6
      const torto = (sorteio(semente, 130 + i * 5 + k) - 0.5) * 0.06
      const ponta: Ponto = [c.x + Math.cos(a) * ate, c.y + Math.sin(a) * ate * 0.88]
      const forquilha: Ponto = [c.x + Math.cos(a) * c.r * 0.98, c.y + Math.sin(a) * c.r * 0.98 * 0.88]
      const lado = sorteio(semente, 160 + i * 5 + k) < 0.5 ? 1 : -1
      const b = a + lado * 0.75
      g.moveTo(c.x + Math.cos(a) * c.r * 0.3, c.y + Math.sin(a) * c.r * 0.3)
      g.quadraticCurveTo(c.x + Math.cos(a) * meio + torto, c.y + Math.sin(a) * meio * 0.88, ponta[0], ponta[1])
      g.moveTo(forquilha[0], forquilha[1])
      g.lineTo(forquilha[0] + Math.cos(b) * c.r * 0.26, forquilha[1] + Math.sin(b) * c.r * 0.26 * 0.88)
    }
  })
  g.stroke()

  // A sombra por baixo da copa, onde o tronco entra.
  g.fillStyle = css(SOMBRA_DA_COPA)
  circulos(g, [
    ...lobulos(cachos[0].y + 0.035, cachos[0].r, lobosDoCacho(0), sementeDoCacho(0), 1, cachos[0].x + 0.015, 0),
    ...lobulos(cachos[1].y + 0.035, cachos[1].r, lobosDoCacho(1), sementeDoCacho(1), 1, cachos[1].x + 0.015, 0),
    [0.01, -0.5, 0.16],
  ])
  cachos.forEach((c, i) => desenharCacho(g, lobosDoCacho(i), sementeDoCacho(i), c.y, c.r, c.x))

  // Os pingentes de gelo embaixo dos cachos de baixo: a metade da luz e a da sombra.
  const pingentes: Array<{ x: number; y: number; comprido: number }> = []
  for (let i = 0; i < 2; i++) {
    const c = cachos[i]
    for (let k = 0; k < 3; k++) {
      const x = c.x + (k - 1) * c.r * 0.55 + (sorteio(semente, 140 + i * 3 + k) - 0.5) * 0.04
      const fundo = c.y + Math.sqrt(Math.max(0, 1 - ((x - c.x) / (c.r * 1.1)) ** 2)) * c.r * 0.82
      pingentes.push({ x, y: fundo - 0.02, comprido: 0.05 + 0.05 * sorteio(semente, 150 + i * 3 + k) })
    }
  }
  const largura = 0.017
  for (const [cor, lado] of [
    [PINGENTE, -1],
    [PINGENTE_SOMBRA, 1],
  ] as const) {
    g.fillStyle = css(cor)
    g.beginPath()
    for (const p of pingentes) {
      const ponta: Ponto = [p.x + 0.002, p.y + p.comprido]
      g.moveTo(p.x, p.y)
      g.lineTo(p.x + lado * largura, p.y)
      g.lineTo(ponta[0], ponta[1])
      g.closePath()
    }
    g.fill()
  }
}

export const carimbo: DefinicaoDeCarimbo = { id: 'arvore-congelada', nome: 'Árvore congelada', tamanho: 15, sombra: 'em-pe', desenhar }

export const paleta: readonly Rgb[] = [TRONCO, TRONCO_SOMBRA, GALHO, SOMBRA_DA_COPA, GEADA_ESCURA, GEADA, GEADA_CLARA, PINGENTE, PINGENTE_SOMBRA]
