import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Crânio de boi (item 140 dos carimbos de 14/11/2026): o crânio de chifres
 * longos largado no chão do deserto, de cara para o céu. Visto de cima e um
 * pouco de frente, como as pedras: o chão achata o desenho na vertical. O
 * crânio é o osso desbotado (branco-acinzentado, não amarelo, para não sumir
 * na areia): a testa larga entre os chifres, as órbitas fundas, o focinho
 * que afina até as duas narinas. Os chifres saem para os lados e sobem na
 * ponta, do osso claro na base ao castanho na ponta; um deles às vezes mais
 * curto (quebrado). O volume são duas camadas chapadas (a do osso na sombra
 * por baixo, a da luz por cima puxada para cima à esquerda) e o fundo das
 * órbitas. O giro gira o crânio no chão para qualquer lado; a luz não gira.
 */

const OSSO_SOMBRA: Rgb = [166, 158, 142]
const OSSO: Rgb = [214, 208, 190]
const OSSO_CLARO: Rgb = [234, 230, 216]
const BURACO: Rgb = [84, 74, 62]
const CHIFRE_SOMBRA: Rgb = [140, 124, 100]
const CHIFRE: Rgb = [190, 176, 146]
const CHIFRE_PONTA: Rgb = [108, 92, 72]

/** O chão visto de cima e um pouco de frente. */
const ACHATA = 0.62
/** O meio do crânio no quadro. */
const CENTRO = { x: 0, y: -0.12 } as const
/** O quanto a camada da luz é puxada para cima à esquerda. */
const PUXA_PARA_A_LUZ = { x: -0.012, y: -0.016 } as const

type Ponto = readonly [number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/**
 * A metade esquerda do contorno do crânio (u para o lado, v da testa ao
 * focinho), em unidades: o resto sai espelhado.
 */
const MEIO_CRANIO: readonly Ponto[] = [
  [0, -0.15],
  [-0.05, -0.162],
  [-0.095, -0.168],
  [-0.118, -0.14],
  [-0.116, -0.09],
  [-0.124, -0.045],
  [-0.12, -0.005],
  [-0.096, 0.04],
  [-0.074, 0.085],
  [-0.064, 0.14],
  [-0.06, 0.185],
  [-0.046, 0.218],
  [-0.02, 0.232],
]

/** O crânio inteiro: a metade e o espelho dela, encolhido pelo `k` em volta do meio. */
function contornoDoCranio(k: number): Ponto[] {
  const esquerda = MEIO_CRANIO.map(([u, v]): Ponto => [u * k, v * k])
  const direita = [...MEIO_CRANIO].reverse().map(([u, v]): Ponto => [-u * k, v * k])
  return [...esquerda, ...direita]
}

/** Uma órbita (ou narina) como polígono: elipse em (u, v), virada pelo `inclina`. */
function oval(u: number, v: number, ru: number, rv: number, inclina: number): Ponto[] {
  const lista: Ponto[] = []
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2
    const x = Math.cos(t) * ru
    const y = Math.sin(t) * rv
    lista.push([u + x * Math.cos(inclina) - y * Math.sin(inclina), v + x * Math.sin(inclina) + y * Math.cos(inclina)])
  }
  return lista
}

/**
 * Um chifre (do lado `lado`): a linha do meio sai da quina da testa, vai
 * para o lado e sobe na ponta; a largura afina da base à ponta. `ate` corta
 * o chifre (1 inteiro; menos, quebrado).
 */
function chifre(lado: 1 | -1, comprimento: number, ate: number, de: number, larguraDe: number): Ponto[] {
  const passos = 9
  const centro: Ponto[] = []
  for (let i = 0; i <= passos; i++) {
    const t = de + ((ate - de) * i) / passos
    // Sai para o lado caindo um pouco, e a ponta vira para trás da testa (o
    // "para cima" do chifre, com o crânio deitado de cara para o céu).
    const u = lado * (0.085 + comprimento * (t - 0.06 * t * t))
    const v = -0.15 + comprimento * (0.22 * t - 0.62 * t * t * t)
    centro.push([u, v])
  }
  const largura = (i: number) => {
    const t = de + ((ate - de) * i) / passos
    return larguraDe * (1 - 0.82 * t)
  }
  const normal = (i: number): Ponto => {
    const a = centro[Math.max(0, i - 1)]
    const b = centro[Math.min(passos, i + 1)]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const n = Math.hypot(dx, dy) || 1
    return [-dy / n, dx / n]
  }
  const borda = (s: 1 | -1) => centro.map((p, i): Ponto => [p[0] + normal(i)[0] * s * largura(i), p[1] + normal(i)[1] * s * largura(i)])
  return [...borda(1), ...borda(-1).reverse()]
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  // Do crânio (u, v) para o quadro: gira no chão e achata.
  const noChao = (p: Ponto, puxa = false): Ponto => {
    const x = p[0] * c - p[1] * s
    const y = (p[0] * s + p[1] * c) * ACHATA
    return [CENTRO.x + x + (puxa ? PUXA_PARA_A_LUZ.x : 0), CENTRO.y + y + (puxa ? PUXA_PARA_A_LUZ.y : 0)]
  }
  const pintar = (pontos: readonly Ponto[], cor: Rgb, puxa = false) => {
    g.fillStyle = css(cor)
    g.beginPath()
    pontos.forEach((p, i) => {
      const [x, y] = noChao(p, puxa)
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    })
    g.closePath()
    g.fill()
  }

  // Os chifres: compridos, um às vezes quebrado.
  const comprimento = 0.24 + 0.04 * sorteio(semente, 1)
  const quebrado = sorteio(semente, 2) < 0.35 ? (sorteio(semente, 3) < 0.5 ? 1 : -1) : 0
  for (const lado of [1, -1] as const) {
    const ate = lado === quebrado ? 0.62 : 0.98 + 0.04 * sorteio(semente, 4 + lado)
    pintar(chifre(lado, comprimento, ate, 0, 0.036), CHIFRE_SOMBRA)
    pintar(chifre(lado, comprimento * 0.97, Math.min(ate, 0.86), 0, 0.026), CHIFRE, true)
    // A ponta escurece (só no chifre inteiro: o quebrado mostra o osso claro).
    if (lado !== quebrado) pintar(chifre(lado, comprimento, ate, 0.66, 0.036), CHIFRE_PONTA)
  }

  // O crânio: a sombra inteira, a luz por cima, e um brilho na testa.
  pintar(contornoDoCranio(1.04), OSSO_SOMBRA)
  pintar(contornoDoCranio(0.93), OSSO, true)
  pintar(oval(-0.03, -0.11, 0.05, 0.03, 0.1), OSSO_CLARO, true)
  pintar(oval(0.0, 0.11, 0.024, 0.07, 0), OSSO_CLARO, true)

  // As órbitas e as narinas: o fundo escuro, a beira de baixo pegando luz.
  for (const lado of [1, -1] as const) {
    pintar(oval(lado * 0.074, -0.038, 0.036, 0.03, lado * 0.4), BURACO)
    pintar(oval(lado * 0.024, 0.196, 0.013, 0.021, lado * -0.25), BURACO)
  }
}

export const carimbo: DefinicaoDeCarimbo = { id: 'cranio-de-boi', nome: 'Crânio de boi', tamanho: 7, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [OSSO_SOMBRA, OSSO, OSSO_CLARO, BURACO, CHIFRE_SOMBRA, CHIFRE, CHIFRE_PONTA]
