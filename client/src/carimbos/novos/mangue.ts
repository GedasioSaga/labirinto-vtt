import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Mangue (item 114 da lista de 14/11/2026): a árvore do pântano em pé na
 * água, sobre as RAÍZES-ESCORA que saem do tronco em arco e entram na água
 * em volta, com a copa fechada e lustrosa em cima, duas ou três raízes
 * aéreas descendo da copa, e as bolhas subindo da lama: umas rodelas na
 * água e duas ou três no ar, PINTADAS (o carimbo não mexe). O que o separa
 * das outras árvores é o leque de raízes em arco sobre a água; o verde puxa
 * para o do pântano (`#47948c`).
 * A luz é a de todos (de cima à esquerda): as raízes da esquerda claras, as
 * de trás e as da direita escuras. O giro gira as raízes e muda o lado das
 * bolhas; a semente, o tamanho de cada raiz.
 */

type Ponto = readonly [number, number]

const MARGEM: Rgb = [88, 100, 74]
const AGUA_FUNDA: Rgb = [40, 84, 80]
const AGUA_RASA: Rgb = [78, 128, 116]
const RAIZ_CLARA: Rgb = [140, 118, 92]
const RAIZ: Rgb = [108, 90, 72]
const RAIZ_SOMBRA: Rgb = [78, 66, 54]
const COPA_SOMBRA: Rgb = [28, 70, 58]
const COPA_ESCURA: Rgb = [36, 92, 72]
const COPA: Rgb = [62, 124, 92]
const COPA_CLARA: Rgb = [112, 160, 112]
const BOLHA: Rgb = [176, 214, 204]
const BOLHA_BRILHO: Rgb = [232, 242, 236]

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

/** Os lóbulos da copa: um miolo e nove em volta, miúdos (a copa do mangue é fechada e encaroçada). */
function lobulos(cx: number, cy: number, raio: number, giro: number, semente: number): Array<[number, number, number]> {
  const lista: Array<[number, number, number]> = [[cx, cy, raio * 0.7]]
  for (let i = 0; i < 9; i++) {
    const a = giro + (i * Math.PI * 2) / 9 + (sorteio(semente, i) - 0.5) * 0.45
    const r = raio * (0.3 + 0.1 * sorteio(semente, i + 10))
    const d = raio * 0.66
    lista.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.82, r])
  }
  return lista
}

/** A água em volta do pé. */
const POCA = { y: 0.03, rx: 0.48, ry: 0.17 } as const
/** Onde as raízes saem do tronco (abaixo dele, o tronco aparece até a copa). */
const SAIDA_DAS_RAIZES = -0.25

interface Raiz {
  de: Ponto
  arco: Ponto
  ate: Ponto
  /** Atrás do tronco (a ponta mais alta na tela que o pé). */
  atras: boolean
  luz: number
}

function raizes(giro: number, semente: number): Raiz[] {
  const n = 7
  return Array.from({ length: n }, (_, i) => {
    const a = giro + (i * Math.PI * 2) / n + (sorteio(semente, 20 + i) - 0.5) * 0.5
    const d = 0.26 + 0.1 * sorteio(semente, 30 + i)
    const ate: Ponto = [Math.cos(a) * d, POCA.y + Math.sin(a) * d * 0.36]
    const de: Ponto = [Math.cos(a) * 0.025, SAIDA_DAS_RAIZES - 0.05 * sorteio(semente, 40 + i)]
    // O arco sai para fora e um pouco para cima antes de descer na água (o joelho da raiz).
    const arco: Ponto = [Math.cos(a) * d * 0.85, SAIDA_DAS_RAIZES - 0.07 + Math.sin(a) * d * 0.2]
    return { de, arco, ate, atras: Math.sin(a) < 0, luz: -Math.cos(a) * 0.6 - Math.sin(a) * 0.4 }
  })
}

function pintarRaizes(g: CanvasRenderingContext2D, lista: readonly Raiz[], cor: Rgb, grosso: number): void {
  if (lista.length === 0) return
  g.strokeStyle = css(cor)
  g.lineWidth = grosso
  g.lineCap = 'round'
  g.beginPath()
  for (const r of lista) {
    g.moveTo(r.de[0], r.de[1])
    g.quadraticCurveTo(r.arco[0], r.arco[1], r.ate[0], r.ate[1])
  }
  g.stroke()
}

function desenharMangue(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // A água: a margem de lama, o fundo escuro no alto (a margem faz sombra) e o raso embaixo.
  g.fillStyle = css(MARGEM, 0.6)
  g.beginPath()
  g.ellipse(0, POCA.y + 0.008, POCA.rx + 0.04, POCA.ry + 0.03, 0, 0, Math.PI * 2)
  g.fill()
  const agua = g.createLinearGradient(0, POCA.y - POCA.ry, 0, POCA.y + POCA.ry)
  agua.addColorStop(0, css(AGUA_FUNDA))
  agua.addColorStop(1, css(AGUA_RASA))
  g.fillStyle = agua
  g.beginPath()
  g.ellipse(0, POCA.y, POCA.rx, POCA.ry, 0, 0, Math.PI * 2)
  g.fill()

  const lista = raizes(giro, semente)
  // As rodelas onde cada raiz entra na água (um anel claro e manso, largo).
  g.fillStyle = css(AGUA_RASA)
  g.beginPath()
  for (const r of lista) {
    g.moveTo(r.ate[0] + 0.04, r.ate[1] + 0.006)
    g.ellipse(r.ate[0], r.ate[1] + 0.006, 0.04, 0.016, 0, 0, Math.PI * 2)
  }
  g.fill()

  // As raízes de trás, na sombra, antes do tronco.
  pintarRaizes(
    g,
    lista.filter((r) => r.atras),
    RAIZ_SOMBRA,
    0.036,
  )
  // O tronco curto, entre as raízes e a copa: metade da luz, metade da sombra.
  const inclina = Math.sin(giro) * 0.03
  g.fillStyle = css(RAIZ_SOMBRA)
  g.beginPath()
  g.moveTo(-0.05, SAIDA_DAS_RAIZES + 0.02)
  g.lineTo(-0.035 + inclina, -0.56)
  g.lineTo(0.04 + inclina, -0.56)
  g.lineTo(0.055, SAIDA_DAS_RAIZES + 0.02)
  g.closePath()
  g.fill()
  g.fillStyle = css(RAIZ_CLARA)
  g.beginPath()
  g.moveTo(-0.05, SAIDA_DAS_RAIZES + 0.02)
  g.lineTo(-0.035 + inclina, -0.56)
  g.lineTo(0.0 + inclina, -0.56)
  g.lineTo(0.0, SAIDA_DAS_RAIZES + 0.02)
  g.closePath()
  g.fill()
  // As da frente por cima: as que olham para a luz claras, as outras no meio-tom.
  const frente = lista.filter((r) => !r.atras)
  // Grossas o bastante para a mesa: finas, pareciam pernas de aranha.
  pintarRaizes(
    g,
    frente.filter((r) => r.luz <= 0),
    RAIZ,
    0.04,
  )
  pintarRaizes(
    g,
    frente.filter((r) => r.luz > 0),
    RAIZ_CLARA,
    0.04,
  )

  // Duas ou três raízes aéreas: descem da beira da copa direto na água.
  const aereas = 2 + (sorteio(semente, 50) < 0.5 ? 1 : 0)
  g.strokeStyle = css(RAIZ)
  g.lineWidth = 0.018
  g.lineCap = 'round'
  g.beginPath()
  for (let i = 0; i < aereas; i++) {
    const a = giro + 1.1 + i * 2.1 + sorteio(semente, 51 + i) * 0.5
    const x = Math.cos(a) * 0.3
    const pe = POCA.y + Math.abs(Math.sin(a)) * 0.08 - 0.02
    g.moveTo(x * 0.9, -0.5)
    g.quadraticCurveTo(x * 1.08, -0.25, x * 1.05, pe)
  }
  g.stroke()

  // A copa: a sombra dela por baixo, e três camadas chapadas com a luz no alto à esquerda.
  const cy = -0.72
  const raio = 0.39 * (0.94 + 0.12 * sorteio(semente, 60))
  const vies = sorteio(semente, 61) * 0.05
  g.fillStyle = css(COPA_SOMBRA)
  circulos(g, lobulos(0.02, cy + 0.06, raio * 0.92, giro + 1, semente + 3))
  g.fillStyle = css(COPA_ESCURA)
  circulos(g, lobulos(0, cy, raio, giro, semente))
  g.fillStyle = css(COPA)
  circulos(g, lobulos(-raio * 0.12, cy - raio * 0.15, raio * 0.78, giro, semente))
  g.fillStyle = css(luz(COPA_CLARA, vies))
  circulos(g, lobulos(-raio * 0.34, cy - raio * 0.4, raio * 0.4, giro + 0.5, semente))

  // As bolhas: umas na água e uma coluna subindo no ar, por fora das raízes, de um lado que muda
  // com o giro (no meio das raízes elas sumiam).
  const lado = Math.cos(giro + 2.4) >= 0 ? 1 : -1
  const bx = lado * (0.36 + 0.04 * sorteio(semente, 70))
  const by = POCA.y + 0.04
  const noAr = 3 + (sorteio(semente, 71) < 0.5 ? 1 : 0)
  const bolhas: Array<[number, number, number]> = [
    [bx, by, 0.036],
    [bx - lado * 0.075, by + 0.045, 0.026],
    [-bx * 0.55, by + 0.08, 0.026],
  ]
  for (let i = 0; i < noAr; i++) {
    bolhas.push([bx + lado * 0.02 * i + Math.sin(i * 2.1 + semente) * 0.02, by - 0.1 - i * 0.085, 0.034 - i * 0.006])
  }
  g.fillStyle = css(BOLHA, 0.7)
  circulos(g, bolhas)
  g.fillStyle = css(BOLHA_BRILHO)
  circulos(
    g,
    bolhas.map(([x, y, r]) => [x - r * 0.35, y - r * 0.35, r * 0.32] as [number, number, number]),
  )
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'mangue',
  nome: 'Mangue',
  tamanho: 14,
  sombra: 'em-pe',
  desenhar: desenharMangue,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [
  MARGEM,
  AGUA_FUNDA,
  AGUA_RASA,
  RAIZ_CLARA,
  RAIZ,
  RAIZ_SOMBRA,
  COPA_SOMBRA,
  COPA_ESCURA,
  COPA,
  COPA_CLARA,
  BOLHA,
  BOLHA_BRILHO,
]
