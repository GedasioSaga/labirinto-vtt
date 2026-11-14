import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Bambuzal (item 112 da lista de 14/11/2026): uma touceira de sete colmos
 * altos, verde-amarelados, com os nós à mostra, abrindo um pouco para fora,
 * e os leques de folha estreita no alto. Vista de cima com um pouco de
 * frente, como a palmeira: os colmos sobem, as folhas pendem. O que o separa
 * dos Juncos (tufo baixo e escuro com taboa) é a ALTURA e o colmo claro com
 * nó; do Pinheiro, as hastes soltas em vez do cone.
 * A luz é a de todos (de cima à esquerda): cada colmo tem a banda clara à
 * esquerda, e o tom de cada folha vem da direção dela. O giro troca a
 * arrumação da touceira e o leque das folhas; a semente, as alturas.
 */

type Ponto = readonly [number, number]

const CHAO_DA_TOUCEIRA: Rgb = [104, 96, 64]
// O colmo é amarelado e lustroso: o oliva de antes sumia na grama.
const COLMO_CLARO: Rgb = [196, 194, 116]
const COLMO: Rgb = [156, 162, 86]
const COLMO_SOMBRA: Rgb = [112, 122, 62]
const NO: Rgb = [90, 102, 54]
const FOLHA_ESCURA: Rgb = [40, 96, 62]
const FOLHA: Rgb = [70, 132, 76]
const FOLHA_CLARA: Rgb = [128, 170, 96]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Direção da luz no chão (de cima à esquerda), para tingir o que aponta para ela. */
const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

/** O quanto a direção (dx, dy) aponta para a luz: 0 de costas, 1 de frente. */
function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

const COLMOS = 7

interface Colmo {
  base: Ponto
  curva: Ponto
  topo: Ponto
  grosso: number
}

interface Folha {
  de: Ponto
  dx: number
  dy: number
  comprimento: number
  /** 0 a 1: o quanto pega luz (direção e altura no colmo). */
  luz: number
}

/** O ponto no colmo a uma fração `t` da base ao topo (a curva de segundo grau dele). */
function noColmo(c: Colmo, t: number): Ponto {
  const u = 1 - t
  return [u * u * c.base[0] + 2 * u * t * c.curva[0] + t * t * c.topo[0], u * u * c.base[1] + 2 * u * t * c.curva[1] + t * t * c.topo[1]]
}

function colmos(giro: number, semente: number): Colmo[] {
  return Array.from({ length: COLMOS }, (_, i) => {
    const t = i / (COLMOS - 1) - 0.5
    const a = giro + i * 2.4
    const bx = t * 0.3 + Math.cos(a) * 0.05 + (sorteio(semente, i + 30) - 0.5) * 0.05
    const by = Math.sin(a) * 0.085
    // Um em cada três é broto novo, mais baixo: a touceira não sai em fileira de cerca.
    const novo = (i + semente) % 3 === 1
    const altura = novo ? 0.56 + 0.14 * sorteio(semente, i) : 0.76 + 0.2 * sorteio(semente, i)
    const abre = bx * 1.05 + (sorteio(semente, i + 10) - 0.5) * 0.14 + Math.sin(giro) * 0.04
    return {
      base: [bx, by] as Ponto,
      curva: [bx + abre * 0.3, by - altura * 0.55] as Ponto,
      topo: [bx + abre, by - altura] as Ponto,
      grosso: 0.03 + 0.008 * sorteio(semente, i + 20),
    }
  }).sort((p, q) => p.base[1] - q.base[1])
}

/** Os leques de folha: três por colmo, no terço de cima; o do alto com uma folha subindo. */
function folhas(lista: readonly Colmo[], giro: number, semente: number): Folha[] {
  const saida: Folha[] = []
  lista.forEach((c, k) => {
    for (const [j, t] of [0.6, 0.79, 0.98].entries()) {
      const de = noColmo(c, t)
      const quantas = j === 2 ? 6 : 4
      for (let i = 0; i < quantas; i++) {
        const s = k * 31 + j * 7 + i
        const lado = i % 2 === 0 ? -1 : 1
        // Pendendo para os lados; a última do leque do alto sobe (curta, para caber no quadro).
        const sobe = j === 2 && i === quantas - 1
        const caida = 0.15 + 0.8 * sorteio(semente, 100 + s) + Math.sin(giro + s) * 0.15
        const angulo = sobe ? -Math.PI / 2 + (sorteio(semente, 200 + s) - 0.5) * 0.9 : lado > 0 ? caida : Math.PI - caida
        const dx = Math.cos(angulo)
        const dy = Math.sin(angulo) * 0.75
        saida.push({
          de,
          dx,
          dy,
          comprimento: sobe ? 0.12 + 0.04 * sorteio(semente, 300 + s) : 0.17 + 0.07 * sorteio(semente, 300 + s),
          // Vista de cima, a folha do alto mostra a face que olha o céu: pega mais luz que a de baixo.
          luz: voltadoParaALuz(dx, dy) * 0.5 + t * 0.5 - (dx > 0 ? 0.08 : 0),
        })
      }
    }
  })
  return saida
}

/** Uma folha estreita de bambu (a lança), acrescentada ao caminho aberto. */
function folha(g: CanvasRenderingContext2D, f: Folha): void {
  const n = Math.hypot(f.dx, f.dy) || 1
  const ux = f.dx / n
  const uy = f.dy / n
  const largura = 0.032
  const ponta: Ponto = [f.de[0] + ux * f.comprimento, f.de[1] + uy * f.comprimento + 0.025]
  const meio: Ponto = [f.de[0] + ux * f.comprimento * 0.45, f.de[1] + uy * f.comprimento * 0.45 - 0.01]
  g.moveTo(f.de[0], f.de[1])
  g.quadraticCurveTo(meio[0] - uy * largura, meio[1] + ux * largura, ponta[0], ponta[1])
  g.quadraticCurveTo(meio[0] + uy * largura, meio[1] - ux * largura, f.de[0], f.de[1])
  g.closePath()
}

function pintarFolhas(g: CanvasRenderingContext2D, lista: readonly Folha[], cor: Rgb): void {
  if (lista.length === 0) return
  g.fillStyle = css(cor)
  g.beginPath()
  for (const f of lista) folha(g, f)
  g.fill()
}

/** Um colmo: o corpo no meio-tom, a banda da sombra à direita, a da luz à esquerda e os nós. */
function pintarColmo(g: CanvasRenderingContext2D, c: Colmo, semente: number, k: number): void {
  const lado = (desvio: number, largura: number, cor: Rgb) => {
    g.fillStyle = css(cor)
    g.beginPath()
    g.moveTo(c.base[0] + desvio - largura, c.base[1])
    g.quadraticCurveTo(c.curva[0] + desvio * 0.8 - largura * 0.85, c.curva[1], c.topo[0] + desvio * 0.6 - largura * 0.6, c.topo[1])
    g.lineTo(c.topo[0] + desvio * 0.6 + largura * 0.6, c.topo[1])
    g.quadraticCurveTo(c.curva[0] + desvio * 0.8 + largura * 0.85, c.curva[1], c.base[0] + desvio + largura, c.base[1])
    g.closePath()
    g.fill()
  }
  lado(0, c.grosso, COLMO_SOMBRA)
  lado(-c.grosso * 0.3, c.grosso * 0.62, COLMO)
  lado(-c.grosso * 0.55, c.grosso * 0.3, COLMO_CLARO)
  // Os nós: um anel mais escuro a cada palmo, mais juntos embaixo.
  g.fillStyle = css(NO)
  g.beginPath()
  const nos = 5
  for (let i = 1; i <= nos; i++) {
    const t = (i / (nos + 1)) ** 0.9 + (sorteio(semente, 400 + k * 7 + i) - 0.5) * 0.04
    const [x, y] = noColmo(c, t)
    const r = c.grosso * (1.05 - 0.35 * t)
    g.moveTo(x + r, y)
    g.ellipse(x, y, r, 0.011, 0, 0, Math.PI * 2)
  }
  g.fill()
}

function desenharBambuzal(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // O chão da touceira: folha seca em volta dos pés, manchas soltas que assentam o tufo
  // (um disco inteiro parecia um vaso).
  g.fillStyle = css(CHAO_DA_TOUCEIRA, 0.5)
  g.beginPath()
  for (let i = 0; i < 4; i++) {
    const a = giro + i * 1.6 + sorteio(semente, 500 + i) * 0.8
    const x = Math.cos(a) * 0.12
    const y = 0.01 + Math.sin(a) * 0.035
    const rx = 0.11 + 0.04 * sorteio(semente, 510 + i)
    g.moveTo(x + rx, y)
    g.ellipse(x, y, rx, 0.045, 0, 0, Math.PI * 2)
  }
  g.fill()

  const lista = colmos(giro, semente)
  const todas = folhas(lista, giro, semente)
  // As folhas de costas para a luz ficam atrás dos colmos; as outras por cima.
  pintarFolhas(
    g,
    todas.filter((f) => f.luz < 0.5),
    FOLHA_ESCURA,
  )
  lista.forEach((c, k) => pintarColmo(g, c, semente, k))
  pintarFolhas(
    g,
    todas.filter((f) => f.luz >= 0.5 && f.luz < 0.68),
    FOLHA,
  )
  pintarFolhas(
    g,
    todas.filter((f) => f.luz >= 0.68),
    misturar(FOLHA, FOLHA_CLARA, 0.85),
  )
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'bambuzal',
  nome: 'Bambuzal',
  tamanho: 13,
  sombra: 'em-pe',
  desenhar: desenharBambuzal,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [CHAO_DA_TOUCEIRA, COLMO_CLARO, COLMO, COLMO_SOMBRA, NO, FOLHA_ESCURA, FOLHA, FOLHA_CLARA]
