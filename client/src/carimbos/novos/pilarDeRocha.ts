import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'
import { facesDaRocha, pintarRocha, pontoNaFace, type FaceDaRocha, type TonsDaRocha } from './_rochaFacetada'

/**
 * Pilar de rocha (L04 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Cavernas e
 * mina): a coluna de rocha que a caverna deixou de pé, do chão ao teto, larga no pé e com os andares das camadas da
 * pedra (um bojo, um recuo, outro bojo), de onde saem as bordas que pegam luz por cima e fazem sombra embaixo. É o
 * bloco facetado das rochas do lote C6 (`_rochaFacetada.ts`), com mais andares e alto: cada face toma o tom pela
 * direção para onde olha em 3D (a luz de cima à esquerda e do alto). O topo é a quebra irregular onde a coluna some
 * no escuro do teto. Em volta do pé, as lascas que caíram dela. O que o separa da Estalagmite (o cone liso de
 * calcário creme) é a pedra cinza facetada e os andares; do Rochedo com musgo, a altura. O giro gira a coluna em
 * volta do eixo e muda o lado das lascas; a luz não gira.
 */

/** A rocha da caverna, cinza-pardo: a mesma família das rochas dos Cristais, um nada mais quente. */
const ROCHA: TonsDaRocha = { escura: [82, 77, 76], meia: [120, 113, 107], clara: [162, 154, 142] }
/** As frestas das camadas: o escuro da própria rocha. */
const FRESTA: Rgb = [56, 52, 54]
/**
 * A coluna: o raio do pé, a altura e os andares [altura de 0 a 1, raio relativo]: o pé esparramado, bojo, recuo,
 * bojo e o topo largo e quebrado. Na 1ª folha (28/11/2026) era fina, escura e de topo em bicos: lia menir, não pilar.
 */
const COLUNA = {
  raio: 0.31,
  altura: 0.84,
  aneis: [
    [0, 1],
    [0.12, 0.82],
    [0.32, 0.86],
    [0.5, 0.72],
    [0.68, 0.78],
    [0.86, 0.7],
    [1, 0.66],
  ],
} as const
/** O quanto a coluna inteira clareia: os lados em pé quase não chegam ao claro pela conta das pedras baixas. */
const CLAREIA = 0.42
/** As frestas: em quantas faces de lado (fração) e a grossura. */
const FRESTAS = { parte: 0.55, grossura: 0.009, alfa: 0.58 } as const
/** As lascas do pé: [ângulo em volta do pé, distância em raios do pé, raio]. */
const LASCAS: readonly (readonly [number, number, number])[] = [
  [0.5, 1.12, 0.06],
  [1.4, 1.2, 0.045],
  [2.5, 1.12, 0.055],
  [4.4, 1.16, 0.04],
]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** As frestas das camadas: um risco atravessado em parte das faces de lado, um nada torto. */
function pintarFrestas(g: CanvasRenderingContext2D, faces: readonly FaceDaRocha[], semente: number): void {
  g.strokeStyle = css(FRESTA, FRESTAS.alfa)
  g.lineWidth = FRESTAS.grossura
  g.lineCap = 'round'
  g.beginPath()
  faces.forEach((face, i) => {
    if (face.tipo !== 'lado' || sorteio(semente, 200 + i) > FRESTAS.parte) return
    const t = 0.3 + 0.4 * sorteio(semente, 300 + i)
    const [ax, ay] = pontoNaFace(face, 0.04 + 0.1 * sorteio(semente, 400 + i), t)
    const [bx, by] = pontoNaFace(face, 0.82 + 0.14 * sorteio(semente, 500 + i), t + (sorteio(semente, 600 + i) - 0.5) * 0.16)
    g.moveTo(ax, ay)
    g.lineTo(bx, by)
  })
  g.stroke()
}

/** Uma lasca caída: um bloco baixo de cinco quinas. */
function pintarLasca(g: CanvasRenderingContext2D, x: number, y: number, raio: number, giro: number, semente: number): void {
  pintarRocha(
    g,
    facesDaRocha({
      cx: x,
      cy: y,
      raio,
      altura: raio * 0.7,
      lados: 5,
      aneis: [
        [0, 1],
        [1, 0.62],
      ],
      recuo: 0.08,
      aspereza: 0.4,
      picos: 0.5,
      giro,
      semente,
    }),
    ROCHA,
    0.1,
  )
}

function desenharPilarDeRocha(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const cy = 0.04
  const lascas = LASCAS.map(([a, d, r], i) => {
    const angulo = a + giro + (sorteio(semente, 10 + i) - 0.5) * 0.6
    const dist = COLUNA.raio * d
    return { x: Math.cos(angulo) * dist, y: cy + Math.sin(angulo) * dist * ACHATA, r: r * (0.8 + 0.4 * sorteio(semente, 20 + i)), i }
  })
  // As de trás saem antes da coluna; as da frente, depois.
  for (const l of lascas.filter((l) => l.y < cy)) pintarLasca(g, l.x, l.y, l.r, giro + l.i, semente + 30 + l.i)
  const faces = facesDaRocha({
    cx: 0,
    cy,
    raio: COLUNA.raio,
    altura: COLUNA.altura,
    lados: 9,
    aneis: COLUNA.aneis,
    recuo: 0.03,
    aspereza: 0.26,
    picos: 0.16,
    giro,
    semente,
  })
  pintarRocha(g, faces, ROCHA, CLAREIA)
  pintarFrestas(g, faces, semente)
  for (const l of lascas.filter((l) => l.y >= cy)) pintarLasca(g, l.x, l.y, l.r, giro + l.i, semente + 30 + l.i)
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'pilar-de-rocha',
  nome: 'Pilar de rocha',
  tamanho: 11,
  sombra: 'em-pe',
  desenhar: desenharPilarDeRocha,
}

/** Todas as cores chapadas do desenho (as faces saem da rampa da rocha, misturadas pela luz). */
export const paleta: readonly Rgb[] = [ROCHA.escura, ROCHA.meia, ROCHA.clara, FRESTA]
