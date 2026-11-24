import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Blocos de cantaria (lote L07 "Selva: ruína e água", 24/11/2026; versão original das Pedras, só a ideia): três
 * blocos de pedra CORTADA que caíram de uma ruína e ficaram meio enterrados, mais uma lasca. O que os separa das
 * Pedras da serra (lascadas, redondas) é a quina reta: cada bloco é um prisma de faces planas, com o alto inclinado
 * (um canto afundou mais que o outro), a faixa lisa da cantaria em volta do alto (a borda que o canteiro aparelhou)
 * e o miolo áspero mais escuro, uma quina quebrada e a terra que subiu no pé. O musgo pega o alto de um ou outro. O
 * giro gira o arranjo e cada bloco; a luz não gira (a face virada para a esquerda clara, a da direita escura). A
 * semente troca o tamanho, a inclinação e a pedra (arenito das ruínas ou o cinzento da serra).
 */

interface Tons {
  /** A faixa aparelhada do alto (a mais clara). */
  readonly faixa: Rgb
  /** O miolo áspero do alto. */
  readonly miolo: Rgb
  /** A face virada para a luz (para a esquerda) e a de costas para ela. */
  readonly clara: Rgb
  readonly escura: Rgb
}

/** O arenito das ruínas e o cinzento da serra, os dois contidos. */
const ARENITO: Tons = { faixa: [206, 190, 158], miolo: [184, 166, 134], clara: [158, 140, 110], escura: [116, 102, 80] }
const CINZENTO: Tons = { faixa: [190, 186, 174], miolo: [166, 161, 149], clara: [140, 135, 124], escura: [102, 98, 90] }
/** A terra que subiu no pé (meio enterrado) e o musgo verde-escuro. */
const TERRA: Rgb = [88, 76, 60]
const MUSGO: Rgb = [100, 114, 76]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
/** Quanto a faixa aparelhada come do alto (o miolo é o alto encolhido em volta do meio). */
const MIOLO = 0.7
/** Quanto a terra passa do pé do bloco. */
const TERRA_EM_VOLTA = 1.16
/** As duas manchas do musgo no alto: [deslocamento em x e em y, raios], em frações do meio comprimento e da meia largura. */
const MANCHAS_DE_MUSGO: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0.4, 0.26],
  [0.2, 0.1, 0.26, 0.2],
]

type P = readonly [number, number]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function misturar(a: Rgb, b: Rgb, t: number): Rgb {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]
}

function preencher(g: CanvasRenderingContext2D, pontos: readonly P[], cor: string): void {
  g.fillStyle = cor
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
  g.fill()
}

/** Um bloco: meio na base (no chão), meio comprimento e meia largura, giro no chão e a altura de cada canto. */
interface Bloco {
  readonly x: number
  readonly y: number
  readonly a: number
  readonly b: number
  readonly giro: number
  readonly alturas: readonly [number, number, number, number]
  readonly tons: Tons
  /** O canto quebrado (0 a 3) e se o alto tem musgo. */
  readonly quebrado: number
  readonly musgo: boolean
}

function desenharBloco(g: CanvasRenderingContext2D, k: Bloco): void {
  const c = Math.cos(k.giro)
  const s = Math.sin(k.giro)
  const noChao: P[] = ([[-k.a, -k.b], [k.a, -k.b], [k.a, k.b], [-k.a, k.b]] as const).map(([u, v]): P => [k.x + u * c - v * s, k.y + u * s + v * c])
  const pe = noChao.map(([x, y]): P => [x, y * ACHATA])
  const alto = pe.map(([x, y], i): P => [x, y - k.alturas[i]])
  const [mx, my] = [k.x, k.y * ACHATA]
  // A terra que subiu no pé: o contorno do pé um pouco maior, por baixo de tudo.
  preencher(g, pe.map(([x, y]): P => [mx + (x - mx) * TERRA_EM_VOLTA, my + (y - my) * TERRA_EM_VOLTA + 0.01]), css(TERRA, 0.6))
  // As faces que olham para quem vê (a normal no chão aponta para baixo na tela): a da esquerda clara, a da direita escura.
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4
    const [ax, ay] = noChao[i]
    const [bx, by] = noChao[j]
    let nx = by - ay
    let ny = -(bx - ax)
    if (nx * ((ax + bx) / 2 - k.x) + ny * ((ay + by) / 2 - k.y) < 0) {
      nx = -nx
      ny = -ny
    }
    const l = Math.hypot(nx, ny) || 1
    if (ny / l <= 0.05) continue
    preencher(g, [pe[i], pe[j], alto[j], alto[i]], css(misturar(k.tons.clara, k.tons.escura, (nx / l + 1) / 2)))
  }
  // O alto: a faixa aparelhada (clara) e o miolo áspero por cima, encolhido em volta do meio.
  const [ax, ay] = [alto.reduce((t, p) => t + p[0], 0) / 4, alto.reduce((t, p) => t + p[1], 0) / 4]
  preencher(g, alto, css(k.tons.faixa))
  preencher(g, alto.map(([x, y]): P => [ax + (x - ax) * MIOLO, ay + (y - ay) * MIOLO]), css(k.tons.miolo))
  // A quina quebrada: um triângulo da face escura comendo um canto do alto.
  const q = alto[k.quebrado]
  const ant = alto[(k.quebrado + 3) % 4]
  const prox = alto[(k.quebrado + 1) % 4]
  preencher(g, [q, [q[0] + (ant[0] - q[0]) * 0.22, q[1] + (ant[1] - q[1]) * 0.22], [q[0] + (prox[0] - q[0]) * 0.22, q[1] + (prox[1] - q[1]) * 0.22 + 0.02]], css(k.tons.escura))
  if (k.musgo) {
    // O musgo contido: duas manchas meio transparentes que se cruzam (uma só, chapada, lia como um olho no bloco).
    const [cx, cy] = [ax + (alto[0][0] - ax) * 0.45, ay + (alto[0][1] - ay) * 0.45]
    g.fillStyle = css(MUSGO, 0.42)
    for (const [dx, dy, ra, rb] of MANCHAS_DE_MUSGO) {
      g.beginPath()
      g.ellipse(cx + dx * k.a, cy + dy * k.b, k.a * ra, k.b * rb, k.giro, 0, Math.PI * 2)
      g.fill()
    }
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const tons = sorteio(semente, 1) < 0.7 ? ARENITO : CINZENTO
  // O arranjo no chão (unidades): o bloco grande deitado e inclinado, o médio torto e meio enterrado, o pequeno e a lasca.
  const molde: readonly (readonly [number, number, number, number, number, number, number])[] = [
    // [x, y, meio comprido, meia largura, giro próprio, altura, inclinação]
    [-0.16, -0.02, 0.2, 0.15, 0.25, 0.26, 0.4],
    [0.24, 0.07, 0.15, 0.11, -0.55, 0.15, 0.55],
    [0.02, 0.17, 0.1, 0.08, 0.9, 0.11, 0.3],
    [0.33, -0.1, 0.05, 0.04, 0.4, 0.05, 0.2],
  ]
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const blocos: Bloco[] = molde.map(([dx, dy, a, b, proprio, h, inclina], i) => {
    const tamanho = 0.88 + 0.24 * sorteio(semente, 10 + i)
    const altura = h * (0.85 + 0.3 * sorteio(semente, 20 + i))
    // O alto inclinado: os cantos de um lado afundam mais (o bloco caiu torto).
    const lado = Math.floor(sorteio(semente, 30 + i) * 4)
    const afunda = (k: number): number => altura * (1 - (k === lado || k === (lado + 1) % 4 ? inclina * (0.6 + 0.4 * sorteio(semente, 40 + i)) : 0))
    const alturas: readonly [number, number, number, number] = [afunda(0), afunda(1), afunda(2), afunda(3)]
    return {
      x: dx * c - dy * s,
      y: dx * s + dy * c,
      a: a * tamanho,
      b: b * tamanho,
      giro: giro + proprio + (sorteio(semente, 50 + i) - 0.5) * 0.5,
      alturas,
      tons,
      quebrado: Math.floor(sorteio(semente, 60 + i) * 4),
      musgo: sorteio(semente, 70 + i) < (i === 0 ? 0.75 : 0.4),
    }
  })
  // De trás para a frente na tela.
  for (const k of [...blocos].sort((p, q) => p.y - q.y)) desenharBloco(g, k)
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'blocos-de-cantaria',
  nome: 'Blocos de cantaria',
  tamanho: 10,
  sombra: 'baixa',
  desenhar,
}

/** Todas as cores chapadas do desenho (as faces são misturas da clara com a escura, dentro da faixa delas). */
export const paleta: readonly Rgb[] = [...[ARENITO, CINZENTO].flatMap((t) => [t.faixa, t.miolo, t.clara, t.escura]), TERRA, MUSGO]
