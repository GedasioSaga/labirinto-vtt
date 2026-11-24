import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Rachadura no chão (lista de 24/11/2026, item 120; o pedido que mais se repete: 6 dos 8 mapas): uma trinca FINA e
 * RAMIFICADA, sem brilho, que serve a qualquer piso. Uma linha principal torta, de pontas finas, com dois a quatro
 * galhos que saem dela em ângulo e às vezes um galhinho no galho, e umas lascas miúdas na beira, onde o chão
 * esfarelou. Vista de cima e um pouco de frente, como as outras coisas do chão (`ACHATA`).
 *
 * Ela não pinta: ESCURECE o próprio chão. A cor é um quase-preto neutro, sempre meio transparente; por cima do chão
 * isso dá `chão × (1 − alfa)` (a mistura do Canvas com o preto É a multiplicação pelo cinza `1 − alfa`), então a
 * trinca na laje clara sai cinza-escuro de laje, na madeira sai pardo-escuro de madeira, na lajota escura quase
 * some no escuro dela, como trinca de verdade. Três camadas, cada uma num caminho só (a união das fitas: onde o galho
 * cruza a linha não escurece duas vezes): o halo largo e fraco (a beira afundada), o corpo e o fundo, mais estreito.
 * É do chão (`sombra: 'nenhuma'`): fica por baixo das sombras dos outros. O giro gira a trinca inteira; a semente
 * muda o desenho.
 */

/** O escuro da trinca: quase preto, neutro (nem azul nem pardo: quem dá a cor é o chão). */
const ESCURO: Rgb = [22, 20, 19]
/** Quanto cada camada escurece o chão: o halo, o corpo e o fundo (no meio da trinca, o chão fica a ~30%). */
const ALFA = { halo: 0.14, corpo: 0.5, fundo: 0.3, lasca: 0.32 } as const
/** O chão visto de cima e um pouco de frente (o das pedras, da lama e da fenda). */
const ACHATA = 0.55
/** O meio da trinca no quadro: um tanto acima do pé, para a trinca de pé na tela (giro de 90°) caber no quadro. */
const MEIO_Y = -0.06
/** Nada sai deste raio, no chão: a trinca girada em qualquer rumo fica dentro do quadro da biblioteca. */
const RAIO_MAXIMO = 0.62
/** A linha principal: o comprimento (unidades do chão), os pontos, o quanto entorta e a meia largura no meio. */
const PRINCIPAL = { comprimento: [0.92, 1.14] as const, pontos: 17, entorta: 0.7, volta: 0.75, meiaLargura: 0.014 } as const
/** Os galhos: o comprimento, os pontos, o ângulo com a linha (rad), a largura na saída (fração da linha ali). */
const GALHO = { comprimento: [0.16, 0.4] as const, pontos: 7, angulo: [0.45, 1.0] as const, largura: 0.72, entorta: 0.6 } as const
/** O galhinho (no galho): o comprimento, os pontos, o ângulo, a largura na saída e a chance. */
const GALHINHO = { comprimento: [0.07, 0.15] as const, pontos: 4, angulo: [0.4, 0.8] as const, largura: 0.6, chance: 0.55 } as const
/** O halo é a fita mais larga: tantas vezes a largura, mais um tanto fixo. */
const HALO = { vezes: 2.4, mais: 0.0045 } as const
/** O fundo: a fita mais estreita, só onde a trinca é grossa o bastante. */
const FUNDO = { vezes: 0.45, minimo: 0.006 } as const
/**
 * A quebra: cada ponto sai um nada da linha, para o lado (a trinca anda em zigue-zague miúdo, de canto vivo, e não
 * em curva macia de galho de árvore). Só o ponto desenhado sai; o caminho segue o rumo dele.
 */
const QUEBRA = { principal: 0.014, galho: 0.008 } as const
/** As lascas: quantas, o tamanho e o quanto se afastam da linha. */
const LASCAS = { quantas: [3, 5] as const, tamanho: [0.006, 0.012] as const } as const

interface Ponto {
  readonly x: number
  readonly y: number
  /** Meia largura, em unidades do chão. */
  readonly w: number
}

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function entre(faixa: readonly [number, number], t: number): number {
  return faixa[0] + (faixa[1] - faixa[0]) * t
}

/**
 * Um trecho de trinca a partir de (x0, y0) no rumo `rumo`: anda `pontos - 1` passos entortando (e voltando para o
 * rumo, para não enrolar), a meia largura caindo de `w0` até zero na ponta. Para no `RAIO_MAXIMO`.
 */
function trecho(x0: number, y0: number, rumo: number, comprimento: number, pontos: number, w0: number, entorta: number, semente: number, base: number): Ponto[] {
  const passo = comprimento / (pontos - 1)
  const lista: Ponto[] = [{ x: x0, y: y0, w: w0 }]
  let desvio = 0
  let x = x0
  let y = y0
  for (let i = 1; i < pontos; i += 1) {
    desvio = (desvio + (sorteio(semente, base + i) - 0.5) * entorta) * 0.7
    x += Math.cos(rumo + desvio) * passo
    y += Math.sin(rumo + desvio) * passo
    if (Math.hypot(x, y) > RAIO_MAXIMO) break
    const t = i / (pontos - 1)
    const quebra = i < pontos - 1 ? (sorteio(semente + 0.5, base + i) - 0.5) * 2 * QUEBRA.galho : 0
    const w = w0 * Math.pow(1 - t, 0.8) * (0.85 + 0.3 * sorteio(semente, base + 40 + i))
    lista.push({ x: x - Math.sin(rumo + desvio) * quebra, y: y + Math.cos(rumo + desvio) * quebra, w })
  }
  return lista
}

/** A linha principal: de uma ponta à outra, fina nas duas pontas e grossa no meio. */
function principal(semente: number): Ponto[] {
  const p = PRINCIPAL
  const comprimento = entre(p.comprimento, sorteio(semente, 1))
  const passo = comprimento / (p.pontos - 1)
  const lista: Ponto[] = []
  let rumo = (sorteio(semente, 2) - 0.5) * 0.3
  let x = -comprimento / 2
  let y = (sorteio(semente, 3) - 0.5) * 0.1
  for (let i = 0; i < p.pontos; i += 1) {
    if (i > 0) {
      rumo = (rumo + (sorteio(semente, 10 + i) - 0.5) * p.entorta) * p.volta
      x += Math.cos(rumo) * passo
      y += Math.sin(rumo) * passo
    }
    const t = i / (p.pontos - 1)
    const w = p.meiaLargura * Math.pow(Math.sin(Math.PI * t), 0.65) * (0.8 + 0.4 * sorteio(semente, 30 + i))
    const quebra = i > 0 && i < p.pontos - 1 ? (sorteio(semente + 0.5, 70 + i) - 0.5) * 2 * QUEBRA.principal : 0
    lista.push({ x: x - Math.sin(rumo) * quebra, y: y + Math.cos(rumo) * quebra, w })
  }
  return lista
}

/** A linha principal e os galhos (e galhinhos), no chão, antes de girar. */
function trinca(semente: number): Ponto[][] {
  const linha = principal(semente)
  const trechos: Ponto[][] = [linha]
  const quantos = 2 + (sorteio(semente, 50) < 0.55 ? 1 : 0) + (sorteio(semente, 51) < 0.25 ? 1 : 0)
  for (let gi = 0; gi < quantos; gi += 1) {
    const base = 100 + gi * 60
    // Onde sai: longe das pontas, um galho para cada lado, alternando.
    const i0 = 3 + Math.floor(sorteio(semente, base) * (linha.length - 7))
    const a = linha[i0]
    const b = linha[Math.min(linha.length - 1, i0 + 1)]
    const lado = (gi + Math.floor(sorteio(semente, 52) * 2)) % 2 === 0 ? 1 : -1
    const rumo = Math.atan2(b.y - a.y, b.x - a.x) + lado * entre(GALHO.angulo, sorteio(semente, base + 1))
    const galho = trecho(a.x, a.y, rumo, entre(GALHO.comprimento, sorteio(semente, base + 2)), GALHO.pontos, a.w * GALHO.largura, GALHO.entorta, semente, base + 3)
    if (galho.length < 3) continue
    trechos.push(galho)
    if (sorteio(semente, base + 4) < GALHINHO.chance) {
      const j0 = Math.min(galho.length - 2, 2 + Math.floor(sorteio(semente, base + 5) * 2))
      const c = galho[j0]
      const d = galho[j0 + 1]
      const outro = sorteio(semente, base + 6) < 0.5 ? 1 : -1
      const rumo2 = Math.atan2(d.y - c.y, d.x - c.x) + outro * entre(GALHINHO.angulo, sorteio(semente, base + 7))
      const galhinho = trecho(c.x, c.y, rumo2, entre(GALHINHO.comprimento, sorteio(semente, base + 8)), GALHINHO.pontos, c.w * GALHINHO.largura, GALHO.entorta, semente, base + 9)
      if (galhinho.length >= 2) trechos.push(galhinho)
    }
  }
  return trechos
}

/**
 * As fitas dos trechos num caminho só, já giradas e achatadas: cada fita é o lado esquerdo indo e o direito voltando,
 * todas na mesma mão, e o preenchimento (regra do não-zero) é a união delas.
 */
function fitas(g: CanvasRenderingContext2D, trechos: readonly Ponto[][], giro: number, largura: (w: number) => number): void {
  const cg = Math.cos(giro)
  const sg = Math.sin(giro)
  const telaX = (x: number, y: number): number => x * cg - y * sg
  const telaY = (x: number, y: number): number => MEIO_Y + (x * sg + y * cg) * ACHATA
  g.beginPath()
  for (const t of trechos) {
    const n = t.length
    if (n < 2) continue
    const esquerda: number[] = []
    const direita: number[] = []
    for (let i = 0; i < n; i += 1) {
      const a = t[Math.max(0, i - 1)]
      const b = t[Math.min(n - 1, i + 1)]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const tamanho = Math.hypot(dx, dy) || 1
      const w = largura(t[i].w)
      const nx = (-dy / tamanho) * w
      const ny = (dx / tamanho) * w
      esquerda.push(t[i].x + nx, t[i].y + ny)
      direita.push(t[i].x - nx, t[i].y - ny)
    }
    g.moveTo(telaX(esquerda[0], esquerda[1]), telaY(esquerda[0], esquerda[1]))
    for (let i = 1; i < n; i += 1) g.lineTo(telaX(esquerda[i * 2], esquerda[i * 2 + 1]), telaY(esquerda[i * 2], esquerda[i * 2 + 1]))
    for (let i = n - 1; i >= 0; i -= 1) g.lineTo(telaX(direita[i * 2], direita[i * 2 + 1]), telaY(direita[i * 2], direita[i * 2 + 1]))
    g.closePath()
  }
}

/** As lascas: grãozinhos de chão esfarelado na beira da linha principal, um de cada lado, alternando. */
function lascas(g: CanvasRenderingContext2D, linha: readonly Ponto[], giro: number, semente: number): void {
  const cg = Math.cos(giro)
  const sg = Math.sin(giro)
  const quantas = Math.round(entre(LASCAS.quantas, sorteio(semente, 200)))
  g.fillStyle = css(ESCURO, ALFA.lasca)
  g.beginPath()
  for (let k = 0; k < quantas; k += 1) {
    const i = 2 + Math.floor(sorteio(semente, 201 + k) * (linha.length - 4))
    const a = linha[i]
    const b = linha[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const tamanho = Math.hypot(dx, dy) || 1
    const lado = k % 2 === 0 ? 1 : -1
    const r = entre(LASCAS.tamanho, sorteio(semente, 211 + k))
    const afasta = a.w + r * 0.6
    const x = a.x + (-dy / tamanho) * afasta * lado
    const y = a.y + (dx / tamanho) * afasta * lado
    const tx = x * cg - y * sg
    const ty = MEIO_Y + (x * sg + y * cg) * ACHATA
    g.moveTo(tx + r, ty)
    g.ellipse(tx, ty, r, r * ACHATA * (0.8 + 0.5 * sorteio(semente, 221 + k)), giro, 0, Math.PI * 2)
  }
  g.fill()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const trechos = trinca(semente)
  g.fillStyle = css(ESCURO, ALFA.halo)
  fitas(g, trechos, giro, (w) => w * HALO.vezes + HALO.mais)
  g.fill()
  g.fillStyle = css(ESCURO, ALFA.corpo)
  fitas(g, trechos, giro, (w) => w)
  g.fill()
  // O fundo só nos trechos grossos (a linha e os galhos), estreito: a trinca escurece mais no meio.
  g.fillStyle = css(ESCURO, ALFA.fundo)
  fitas(g, trechos.slice(0, 1 + Math.min(trechos.length - 1, 4)), giro, (w) => Math.max(0, w * FUNDO.vezes - (w < FUNDO.minimo ? w : 0)))
  g.fill()
  lascas(g, trechos[0], giro, semente)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'rachadura-no-chao', nome: 'Rachadura no chão', tamanho: 12, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [ESCURO]
