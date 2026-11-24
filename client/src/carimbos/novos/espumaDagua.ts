import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Espuma d'água (lote L08 de 24/11/2026, item 80: a mancha branca do pé das quedas dos mapas 2 e 6, desenho próprio).
 * Uma RENDA de espuma BRANCO-GELO azulado (nunca branco puro) para pôr no pé de uma cachoeira, em volta de uma pedra
 * no rio ou onde a correnteza bate. Vista de cima e um pouco de frente: MANCHAS de beira rendada e macia em TRÊS
 * TAMANHOS, meio transparentes (de 40% a 85%: o rio aparece por elas e entre elas), mais juntas no centro, do lado de
 * onde a água vem, e abrindo em FIAPOS rio abaixo, cada vez mais finos e mais ralos. Por cima, poucas bolhas, de
 * tamanhos desiguais. Sem véu em elipse e sem contorno: a mancha não tem forma fechada.
 *
 * A beira macia sai de duas camadas: a mancha maior, rala, e a mesma mancha menor e mais cheia por dentro.
 *
 * O GIRO ESCOLHE PARA ONDE A CORRENTE LEVA OS FIAPOS (sem giro, para a direita); a semente muda a renda. Fica rente à
 * água: sem sombra, por baixo das sombras e dos outros objetos, como a poça e a vitória-régia. A luz não gira.
 */

const ESPUMA: Rgb = [226, 238, 240]
const ESPUMA_FRIA: Rgb = [204, 224, 232]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

type Ponto = readonly [number, number]

/** O meio da mancha e o quanto a água achata (vista de cima e um pouco de frente). */
const MEIO = { x: 0, y: -0.12 } as const
const ACHATA = 0.6
/** Os três tamanhos de mancha (o raio, em unidades) e quantos cantos tem o contorno de cada uma. */
const GRANDE = 0.1
const MEDIA = 0.066
const MIUDA = 0.04
/** A volta de ouro: espalha as manchas do centro sem fila e deixa vãos entre elas (a renda). */
const ANGULO_DE_OURO = 2.39996
const CANTOS = 13

/**
 * Uma mancha de beira rendada: o contorno fechado de `CANTOS` cantos com o raio sorteado (entra e sai), alisado por
 * curvas. `longo` estica a mancha no rumo da corrente (o fiapo).
 */
function mancha(g: CanvasRenderingContext2D, centro: Ponto, raio: number, longo: number, rumo: Ponto, semente: number, sal: number, encolhe: number): void {
  const pontos: Ponto[] = []
  for (let i = 0; i < CANTOS; i++) {
    const a = (i / CANTOS) * Math.PI * 2 + sorteio(semente, sal + i) * 0.5
    // A beira entra fundo de vez em quando: é a renda.
    const r = raio * encolhe * (0.64 + 0.52 * sorteio(semente, sal + 40 + i) * (i % 3 === 0 ? 0.5 : 1))
    const ao = Math.cos(a) * r * longo
    const traves = Math.sin(a) * r
    pontos.push([centro[0] + rumo[0] * ao - rumo[1] * traves, centro[1] + (rumo[1] * ao + rumo[0] * traves) * ACHATA])
  }
  const meio = (p: Ponto, q: Ponto): Ponto => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const primeiro = meio(pontos[CANTOS - 1], pontos[0])
  g.moveTo(primeiro[0], primeiro[1])
  for (let i = 0; i < CANTOS; i++) {
    const m = meio(pontos[i], pontos[(i + 1) % CANTOS])
    g.quadraticCurveTo(pontos[i][0], pontos[i][1], m[0], m[1])
  }
  g.closePath()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // Para onde a corrente leva e o ponto (ao longo dela, de través) na água achatada.
  const vai: Ponto = [Math.cos(giro), Math.sin(giro)]
  const naAgua = (aoLongo: number, deTraves: number): Ponto => [MEIO.x + vai[0] * aoLongo - vai[1] * deTraves, MEIO.y + (vai[1] * aoLongo + vai[0] * deTraves) * ACHATA]

  interface Mancha {
    readonly centro: Ponto
    readonly raio: number
    readonly longo: number
    readonly alfa: number
    readonly sal: number
  }
  const manchas: Mancha[] = []
  // O centro, do lado de onde a água vem: três grandes e seis médias em volta, com vãos entre elas (o rio aparece).
  for (let i = 0; i < 9; i++) {
    const grande = i < 3
    const rho = (grande ? 0.05 : 0.11) + 0.11 * Math.sqrt((i + 0.5) / 9) * (0.7 + 0.6 * sorteio(semente, i))
    const b = i * ANGULO_DE_OURO + semente * 1.3
    manchas.push({ centro: naAgua(-0.13 + Math.cos(b) * rho * 1.25, Math.sin(b) * rho), raio: (grande ? GRANDE : MEDIA) * (0.84 + 0.3 * sorteio(semente, 8 + i)), longo: 1.25, alfa: (grande ? 0.8 : 0.62) + 0.08 * sorteio(semente, 20 + i), sal: 100 + i * 60 })
  }
  // Rio abaixo: as miúdas e os fiapos, cada vez mais finos, mais longe e mais ralos.
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6
    manchas.push({ centro: naAgua(0.1 + 0.34 * t + (sorteio(semente, 40 + i) - 0.5) * 0.06, (sorteio(semente, 46 + i) - 0.5) * (0.3 - 0.14 * t)), raio: MIUDA * (1.1 - 0.5 * t) * (0.8 + 0.4 * sorteio(semente, 52 + i)), longo: 1.8 + 1.8 * t, alfa: 0.62 - 0.22 * t, sal: 500 + i * 60 })
  }

  // A beira macia: cada mancha em duas camadas, a de fora rala e fria, a de dentro mais cheia.
  for (const m of manchas) {
    g.fillStyle = css(ESPUMA_FRIA, Math.max(0.4, m.alfa * 0.56))
    g.beginPath()
    mancha(g, m.centro, m.raio, m.longo, vai, semente, m.sal, 1.2)
    g.fill()
  }
  for (const m of manchas) {
    g.fillStyle = css(ESPUMA, Math.min(0.85, m.alfa))
    g.beginPath()
    mancha(g, m.centro, m.raio, m.longo, vai, semente, m.sal + 7, 0.84)
    g.fill()
  }

  // Poucas bolhas por cima do centro, de tamanhos desiguais (cada uma com a sua beira torta).
  g.fillStyle = css(ESPUMA, 0.85)
  g.beginPath()
  for (let i = 0; i < 5; i++) {
    const centro = naAgua(-0.2 + 0.3 * sorteio(semente, 70 + i), (sorteio(semente, 76 + i) - 0.5) * 0.24)
    mancha(g, centro, 0.014 + 0.03 * sorteio(semente, 82 + i) * sorteio(semente, 88 + i), 1, vai, semente, 900 + i * 60, 1)
  }
  g.fill()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'espuma-dagua', nome: "Espuma d'água", tamanho: 9, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [ESPUMA, ESPUMA_FRIA]
