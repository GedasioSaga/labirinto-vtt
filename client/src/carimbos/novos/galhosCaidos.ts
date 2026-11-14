import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Galhos caídos (item 129 dos carimbos de 14/11/2026): dois galhos que a
 * ventania derrubou, deitados no chão e cruzados, e um graveto solto. O de
 * cima é o maior: quebrado na ponta grossa (a madeira clara à mostra),
 * afinando até a outra, com uma forquilha e um raminho; o de baixo, mais
 * fino, passa por baixo dele num ângulo raso. Na ponta dos raminhos ainda há duas ou três
 * folhas murchas, o que diz "galho de árvore" (e não raiz nem cobra).
 *
 * A casca é a do Tronco caído e da Árvore morta, em faixas: o lado que olha
 * para a luz (cima à esquerda) claro, o outro no meio-tom; por baixo, uma
 * borda escura segura o galho no capim. O marrom é mais quente que o da
 * Árvore morta: galho que caiu ontem, não madeira seca de anos. O que o
 * separa do Tronco caído é a espessura e a forquilha; da Árvore morta, estar
 * deitado e espalhado, não em roda.
 *
 * Os pontos saem já no quadro: o arranjo é feito no chão (u para a direita,
 * v para quem vê), girado pelo giro e achatado como o chão visto de cima e um
 * pouco de frente. A luz não gira: o tom de cada faixa vem da direção do
 * galho no quadro. A sombra é `deitada`.
 */

interface TonsDaMadeira {
  clara: Rgb
  meia: Rgb
  escura: Rgb
}

const CASCA: TonsDaMadeira = { clara: [150, 118, 82], meia: [110, 86, 60], escura: [78, 61, 45] }
const BORDA: Rgb = [62, 50, 38]
const LENHO: Rgb = [200, 174, 126]
const LENHO_NA_SOMBRA: Rgb = [156, 130, 92]
const FOLHA_CLARA: Rgb = [164, 158, 88]
const FOLHA_ESCURA: Rgb = [112, 112, 62]

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

/** O chão visto de cima e um pouco de frente, e o meio do arranjo no quadro. */
const ACHATA = 0.6
const CENTRO_Y = -0.07

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[]): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
}

/** Abaixo desta meia largura o galho sai num tom só (as duas camadas viram serrilhado). */
const GRAVETO = 0.009
const PASSOS_DO_GALHO = 8

/** A linha do meio do galho (a curva de `a` a `b` puxada para `c`) e a normal em cada passo. */
function curvaDoGalho(a: Ponto, c: Ponto, b: Ponto): { centro: Ponto[]; normal: Ponto[] } {
  const centro: Ponto[] = []
  const normal: Ponto[] = []
  for (let i = 0; i <= PASSOS_DO_GALHO; i++) {
    const t = i / PASSOS_DO_GALHO
    const s = 1 - t
    centro.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]])
    const dx = 2 * s * (c[0] - a[0]) + 2 * t * (b[0] - c[0])
    const dy = 2 * s * (c[1] - a[1]) + 2 * t * (b[1] - c[1])
    const n = Math.hypot(dx, dy) || 1
    normal.push([-dy / n, dx / n])
  }
  return { centro, normal }
}

/** Um galho no quadro: de `a` a `b`, curvado para `c`, afinando de `grosso` a `fino` (meias larguras). */
interface Galho {
  a: Ponto
  c: Ponto
  b: Ponto
  grosso: number
  fino: number
}

/** O mesmo galho, mais largo dos dois lados, num tom só: a borda escura por baixo. */
function contornarGalho(g: CanvasRenderingContext2D, galho: Galho, folga: number): void {
  const { centro, normal } = curvaDoGalho(galho.a, galho.c, galho.b)
  const largura = (i: number) => {
    const w = galho.grosso + ((galho.fino - galho.grosso) * i) / PASSOS_DO_GALHO
    return w + Math.min(folga, w * 0.4)
  }
  const borda = (lado: 1 | -1) => centro.map(([x, y], i): Ponto => [x + normal[i][0] * lado * largura(i), y + normal[i][1] * lado * largura(i)])
  g.fillStyle = css(BORDA)
  caminho(g, [...borda(1), ...borda(-1).reverse()])
  g.fill()
}

/** A casca em duas faixas: o meio-tom puxado para o escuro e, do lado da luz, a faixa clara. */
function pintarGalho(g: CanvasRenderingContext2D, galho: Galho, tons: TonsDaMadeira): void {
  const passos = PASSOS_DO_GALHO
  const { centro, normal } = curvaDoGalho(galho.a, galho.c, galho.b)
  const largura = (i: number) => galho.grosso + ((galho.fino - galho.grosso) * i) / passos
  const [nx, ny] = normal[passos >> 1]
  const olhar = nx * LUZ_NO_PLANO.x + ny * LUZ_NO_PLANO.y
  const lado = olhar >= 0 ? 1 : -1
  const forca = Math.min(1, Math.abs(olhar) * 1.5)
  const faixa = (de: number, ate: number): Ponto[] => {
    const borda = (k: number) => centro.map(([x, y], i): Ponto => [x + normal[i][0] * lado * k * largura(i), y + normal[i][1] * lado * k * largura(i)])
    return [...borda(de), ...borda(ate).reverse()]
  }
  if (galho.grosso < GRAVETO) {
    g.fillStyle = css(tons.meia)
    caminho(g, faixa(-1, 1))
    g.fill()
    return
  }
  g.fillStyle = css(misturar(tons.meia, tons.escura, forca))
  caminho(g, faixa(-1, 1))
  g.fill()
  g.fillStyle = css(misturar(tons.meia, tons.clara, forca))
  caminho(g, faixa(-0.05, 1))
  g.fill()
}

interface Arranjo {
  /** De baixo para cima: cada família é contornada inteira e depois pintada (a forquilha emenda sem borda). */
  familias: Galho[][]
  /** As pontas quebradas (o galho e de que ponta). */
  quebras: Galho[]
  folhas: Array<{ pe: Ponto; ponta: Ponto }>
}

function arranjar(giro: number, semente: number): Arranjo {
  const r = (i: number) => sorteio(semente, i)
  const cos = Math.cos(giro)
  const sen = Math.sin(giro)
  // Do chão para o quadro: gira em volta do meio e achata a profundidade.
  const girar = (u: number, v: number): Ponto => [u * cos - v * sen, (u * sen + v * cos) * ACHATA]
  const noChao = (u: number, v: number): Ponto => {
    const [x, y] = girar(u, v)
    return [x, CENTRO_Y + y]
  }
  // Um galho no chão, saindo de (u, v) no rumo dado, com a curva puxada para um lado.
  const ramo = (u: number, v: number, rumo: number, comprimento: number, dobra: number, grosso: number, fino: number): Galho => {
    const du = Math.cos(rumo)
    const dv = Math.sin(rumo)
    const mu = u + (du * comprimento) / 2 - dv * dobra
    const mv = v + (dv * comprimento) / 2 + du * dobra
    return { a: noChao(u, v), c: noChao(mu, mv), b: noChao(u + du * comprimento, v + dv * comprimento), grosso, fino }
  }
  // O grande: atravessa o arranjo, a ponta grossa (a quebrada) de um lado, a forquilha para o `lado`.
  const lado = r(1) < 0.5 ? 1 : -1
  const rumoA = (r(2) - 0.5) * 0.5
  const compA = 0.8 + 0.12 * r(3)
  const inicioA = { u: -Math.cos(rumoA) * compA * 0.5, v: -Math.sin(rumoA) * compA * 0.5 - 0.02 }
  const dobraA = (r(4) - 0.5) * 0.12
  const A = ramo(inicioA.u, inicioA.v, rumoA, compA, dobraA, 0.05, 0.016)
  // A forquilha e os raminhos, medidos no chão pela mesma curva.
  const noA = (t: number) => {
    const s = 1 - t
    const fim = { u: inicioA.u + Math.cos(rumoA) * compA, v: inicioA.v + Math.sin(rumoA) * compA }
    const meio = { u: (inicioA.u + fim.u) / 2 - Math.sin(rumoA) * dobraA, v: (inicioA.v + fim.v) / 2 + Math.cos(rumoA) * dobraA }
    return { u: s * s * inicioA.u + 2 * s * t * meio.u + t * t * fim.u, v: s * s * inicioA.v + 2 * s * t * meio.v + t * t * fim.v }
  }
  const f1 = noA(0.5)
  const rumoF1 = rumoA + lado * (0.5 + 0.2 * r(5))
  const compF1 = 0.26 + 0.08 * r(6)
  const F1 = ramo(f1.u, f1.v, rumoF1, compF1, lado * 0.02, 0.024, 0.008)
  const f2 = noA(0.76)
  const rumoF2 = rumoA - lado * (0.55 + 0.2 * r(7))
  const F2 = ramo(f2.u, f2.v, rumoF2, 0.13 + 0.05 * r(8), -lado * 0.01, 0.015, 0.006)
  const f3 = { u: f1.u + Math.cos(rumoF1) * compF1 * 0.55, v: f1.v + Math.sin(rumoF1) * compF1 * 0.55 }
  const rumoF3 = rumoF1 - lado * 0.6
  const F3 = ramo(f3.u, f3.v, rumoF3, 0.09 + 0.03 * r(9), 0, 0.011, 0.005)

  // O de baixo: cruza o grande num ângulo raso, para o lado da ponta quebrada
  // (de través, os dois viravam um sinal de mais na mesa).
  const rumoB = rumoA - lado * (0.55 + 0.35 * r(10))
  const compB = 0.5 + 0.1 * r(11)
  const meioB = { u: -0.16 + 0.12 * r(12), v: 0.04 }
  const B = ramo(meioB.u - Math.cos(rumoB) * compB * 0.5, meioB.v - Math.sin(rumoB) * compB * 0.5, rumoB, compB, (r(13) - 0.5) * 0.08, 0.034, 0.013)
  const fB = { u: meioB.u + Math.cos(rumoB) * compB * 0.2, v: meioB.v + Math.sin(rumoB) * compB * 0.2 }
  const FB = ramo(fB.u, fB.v, rumoB + lado * 0.6, 0.11 + 0.04 * r(14), 0, 0.013, 0.005)

  // O graveto solto, na frente, do lado oposto à forquilha.
  const rumoC = rumoA + 0.4 + r(15) * 0.6
  const C = ramo(-lado * (0.16 + 0.08 * r(16)), 0.24, rumoC, 0.17 + 0.06 * r(17), 0.01, 0.017, 0.012)

  // As folhas murchas na ponta do raminho de cima e do da forquilha.
  const folhas: Array<{ pe: Ponto; ponta: Ponto }> = []
  for (const [k, raminho, rumo] of [[0, F3, rumoF3], [1, F2, rumoF2]] as const) {
    const quantas = k === 0 ? 3 : 2
    for (let i = 0; i < quantas; i++) {
      const vira = rumo + (i - (quantas - 1) / 2) * 0.9 + (r(20 + k * 3 + i) - 0.5) * 0.4
      const comprimento = 0.1 + 0.03 * r(30 + k * 3 + i)
      const base = raminho.b
      const ponta = girar(Math.cos(vira) * comprimento, Math.sin(vira) * comprimento)
      folhas.push({ pe: base, ponta: [base[0] + ponta[0], base[1] + ponta[1]] })
    }
  }
  return { familias: [[C], [B, FB], [A, F1, F2, F3]], quebras: [A, B], folhas }
}

/** A ponta quebrada: a madeira à mostra na boca do galho, clara se a boca olha para a luz. */
function desenharQuebra(g: CanvasRenderingContext2D, galho: Galho): void {
  const dx = galho.a[0] - galho.c[0]
  const dy = galho.a[1] - galho.c[1]
  const m = Math.hypot(dx, dy) || 1
  const angulo = Math.atan2(dy, dx)
  const cx = galho.a[0] + (dx / m) * galho.grosso * 0.15
  const cy = galho.a[1] + (dy / m) * galho.grosso * 0.15
  g.fillStyle = css(CASCA.escura)
  g.beginPath()
  g.ellipse(cx, cy, galho.grosso * 0.5, galho.grosso * 1.02, angulo, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(voltadoParaALuz(dx, dy) > 0.45 ? LENHO : LENHO_NA_SOMBRA)
  g.beginPath()
  g.ellipse(cx + (dx / m) * galho.grosso * 0.08, cy + (dy / m) * galho.grosso * 0.08, galho.grosso * 0.34, galho.grosso * 0.78, angulo, 0, Math.PI * 2)
  g.fill()
}

/** As folhas murchas em gota, num caminho por tom: as que apontam para a luz claras. */
function desenharFolhas(g: CanvasRenderingContext2D, folhas: Arranjo['folhas']): void {
  for (const [tom, daLuz] of [[FOLHA_ESCURA, false], [FOLHA_CLARA, true]] as const) {
    g.fillStyle = css(tom)
    g.beginPath()
    for (const { pe, ponta } of folhas) {
      const dx = ponta[0] - pe[0]
      const dy = ponta[1] - pe[1]
      if (voltadoParaALuz(dx, dy) > 0.5 !== daLuz) continue
      const mx = (pe[0] + ponta[0]) / 2
      const my = (pe[1] + ponta[1]) / 2
      const m = Math.hypot(dx, dy) || 1
      const nx = (-dy / m) * 0.05
      const ny = (dx / m) * 0.05
      g.moveTo(pe[0], pe[1])
      g.quadraticCurveTo(mx + nx, my + ny, ponta[0], ponta[1])
      g.quadraticCurveTo(mx - nx, my - ny, pe[0], pe[1])
    }
    g.fill()
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const { familias, quebras, folhas } = arranjar(giro, semente)
  for (const familia of familias) {
    for (const galho of familia) contornarGalho(g, galho, 0.013)
    // O principal da família por último: cobre a emenda das forquilhas.
    for (const galho of [...familia.slice(1), familia[0]]) pintarGalho(g, galho, CASCA)
    for (const galho of quebras.filter((q) => q === familia[0])) desenharQuebra(g, galho)
  }
  desenharFolhas(g, folhas)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'galhos-caidos', nome: 'Galhos caídos', tamanho: 8, sombra: 'deitada', desenhar }

export const paleta: readonly Rgb[] = [CASCA.clara, CASCA.meia, CASCA.escura, BORDA, LENHO, LENHO_NA_SOMBRA, FOLHA_CLARA, FOLHA_ESCURA]
