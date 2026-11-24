import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Rachadura no chão (lista de 24/11/2026, item 120; o pedido que mais se repete: 6 dos 8 mapas): uma trinca FINA e
 * RAMIFICADA, sem brilho, que serve a qualquer piso. A linha principal anda em SEGMENTOS RETOS que dobram de 20° a 40°
 * no vértice (o zigue-zague anguloso de pedra que quebrou, e não a curva macia de galho seco), com a largura quase
 * a mesma até perto das pontas; dois a quatro galhos curtos saem dela quase em ângulo reto (60° a 100°), às vezes com
 * um galhinho, e umas lascas miúdas na beira, onde o chão esfarelou. Vista de cima e um pouco de frente, como as
 * outras coisas do chão (`ACHATA`).
 *
 * Ela não pinta: ESCURECE o próprio chão. A cor é um quase-preto neutro, sempre meio transparente; por cima do chão
 * isso dá `chão × (1 − alfa)` (a mistura do Canvas com o preto É a multiplicação pelo cinza `1 − alfa`), então a
 * trinca na laje clara sai cinza-escuro de laje, na madeira sai pardo-escuro de madeira, na lajota escura quase
 * some no escuro dela, como trinca de verdade. Cada camada é um caminho só (a união das fitas: onde o galho cruza a
 * linha não escurece duas vezes): o halo em três anéis fracos e cada vez mais largos em VOLTA do corpo (a beira
 * afundada some num degradê, sem o contorno de borda dupla), o corpo e o fundo, mais estreito. No meio da trinca o
 * chão fica a ~45%. É do chão (`sombra: 'nenhuma'`): fica por baixo das sombras dos outros. O giro gira a trinca
 * inteira; a semente muda o desenho.
 */

/** O escuro da trinca: quase preto, neutro (nem azul nem pardo: quem dá a cor é o chão). */
const ESCURO: Rgb = [22, 20, 19]
/** Quanto cada camada escurece o chão: cada anel do halo, o corpo, o fundo e as lascas (no meio, 0,6 x 0,75 = ~45%). */
const ALFA = { halo: 0.05, corpo: 0.4, fundo: 0.25, lasca: 0.32 } as const
/** O chão visto de cima e um pouco de frente (o das pedras, da lama e da fenda). */
const ACHATA = 0.55
/** O meio da trinca no quadro: um tanto acima do pé, para a trinca de pé na tela (giro de 90°) caber no quadro. */
const MEIO_Y = -0.06
/** Nada sai deste raio, no chão: a trinca girada em qualquer rumo fica dentro do quadro da biblioteca. */
const RAIO_MAXIMO = 0.62
/** A linha principal encolhe até as pontas ficarem nesta fração do raio. */
const FOLGA_DO_RAIO = 0.96
/**
 * A linha principal: o comprimento (unidades do chão, ao longo dela), os pontos, a meia largura no meio, a fração de
 * cada ponta onde ela afina, os passos de cada segmento reto (2 a 4 passos = 3 a 5 pontos) e o quanto o rumo pode
 * fugir do rumo de partida (rad) antes de a dobra voltar para ele.
 */
const PRINCIPAL = { comprimento: [0.92, 1.14] as const, pontos: 17, meiaLargura: 0.014, ponta: 0.15, passos: [2, 4] as const, desvio: 0.6 } as const
/** A dobra no vértice entre dois segmentos retos, em radianos (20° a 40°). */
const DOBRA = [0.35, 0.7] as const
/**
 * Os galhos: o comprimento, os pontos, o ângulo com a linha (rad: 60° a 100°), a largura na saída (fração da linha
 * ali), os passos por segmento, o desvio e a fração de fora em que afinam.
 */
const GALHO = { comprimento: [0.1, 0.25] as const, pontos: 6, angulo: [1.0, 1.7] as const, largura: 0.72, passos: [2, 3] as const, desvio: 0.5, afina: 0.5 } as const
/** O galhinho (no galho): o comprimento, os pontos, o ângulo, a largura na saída, os passos e a chance. */
const GALHINHO = { comprimento: [0.06, 0.12] as const, pontos: 3, angulo: [0.9, 1.4] as const, largura: 0.6, passos: [1, 2] as const, chance: 0.45 } as const
/** O halo: três anéis em volta do corpo, cada um até tantas vezes a largura, mais um tanto fixo. */
const HALO: readonly { readonly vezes: number; readonly mais: number }[] = [
  { vezes: 1.7, mais: 0.0025 },
  { vezes: 2.4, mais: 0.0045 },
  { vezes: 3.1, mais: 0.0065 },
]
/** O fundo: a fita mais estreita, só onde a trinca é grossa o bastante. */
const FUNDO = { vezes: 0.45, minimo: 0.006 } as const
/** As lascas: quantas, o tamanho e o quanto se afastam da linha. */
const LASCAS = { quantas: [3, 5] as const, tamanho: [0.006, 0.012] as const } as const
/** Os sorteios dos segmentos da linha começam aqui, e os de cada galho aqui, de 200 em 200 (longe uns dos outros e das lascas). */
const BASE_DA_LINHA = 300
const BASE_DOS_GALHOS = 1000
const PASSO_DOS_GALHOS = 200

interface Ponto {
  readonly x: number
  readonly y: number
  /** Meia largura, em unidades do chão. */
  readonly w: number
}

interface Lugar {
  readonly x: number
  readonly y: number
}

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function entre(faixa: readonly [number, number], t: number): number {
  return faixa[0] + (faixa[1] - faixa[0]) * t
}

/**
 * Anda `pontos - 1` passos de `passo` a partir de (x0, y0), no rumo `rumo0`, em SEGMENTOS RETOS de `passos` passos;
 * no vértice entre dois segmentos o rumo dobra de 20° a 40° (`DOBRA`) para um lado sorteado, e para o lado de volta
 * quando já fugiu mais que `desvio` do rumo de partida.
 */
function emSegmentos(x0: number, y0: number, rumo0: number, passo: number, pontos: number, passos: readonly [number, number], desvio: number, semente: number, base: number): Lugar[] {
  const lista: Lugar[] = [{ x: x0, y: y0 }]
  let x = x0
  let y = y0
  let rumo = rumo0
  let falta = Math.round(entre(passos, sorteio(semente, base)))
  for (let i = 1; i < pontos; i += 1) {
    if (falta <= 0) {
      const dobra = entre(DOBRA, sorteio(semente, base + 10 + i))
      let lado = sorteio(semente, base + 30 + i) < 0.5 ? 1 : -1
      if (Math.abs(rumo + lado * dobra - rumo0) > desvio && rumo !== rumo0) lado = rumo > rumo0 ? -1 : 1
      rumo += lado * dobra
      falta = Math.round(entre(passos, sorteio(semente, base + 50 + i)))
    }
    x += Math.cos(rumo) * passo
    y += Math.sin(rumo) * passo
    lista.push({ x, y })
    falta -= 1
  }
  return lista
}

/** A meia largura da linha principal na fração `t` dela: inteira no meio, afinando só na `ponta` de cada lado. */
function larguraDaLinha(t: number): number {
  const d = Math.min(t, 1 - t) / PRINCIPAL.ponta
  return d >= 1 ? 1 : 1 - (1 - d) * (1 - d)
}

/** A linha principal: de uma ponta à outra, centrada no quadro e encolhida se uma ponta sairia do raio. */
function principal(semente: number): Ponto[] {
  const p = PRINCIPAL
  const comprimento = entre(p.comprimento, sorteio(semente, 1))
  const rumo0 = (sorteio(semente, 2) - 0.5) * 0.3
  const caminho = emSegmentos(0, 0, rumo0, comprimento / (p.pontos - 1), p.pontos, p.passos, p.desvio, semente, BASE_DA_LINHA)
  const ultimo = caminho[caminho.length - 1]
  const mx = ultimo.x / 2
  const my = ultimo.y / 2 - (sorteio(semente, 3) - 0.5) * 0.1
  let maior = 0
  for (const q of caminho) maior = Math.max(maior, Math.hypot(q.x - mx, q.y - my))
  const cabe = Math.min(1, (RAIO_MAXIMO * FOLGA_DO_RAIO) / maior)
  return caminho.map((q, i) => ({
    x: (q.x - mx) * cabe,
    y: (q.y - my) * cabe,
    w: p.meiaLargura * larguraDaLinha(i / (p.pontos - 1)) * (0.88 + 0.24 * sorteio(semente + 0.25, 30 + i)),
  }))
}

/** Um galho a partir do ponto `a`: segmentos retos, a largura `w0` na saída afinando na metade de fora. Para no raio. */
function galho(a: Ponto, rumo: number, comprimento: number, pontos: number, w0: number, passos: readonly [number, number], semente: number, base: number): Ponto[] {
  const caminho = emSegmentos(a.x, a.y, rumo, comprimento / (pontos - 1), pontos, passos, GALHO.desvio, semente, base)
  const lista: Ponto[] = []
  for (let i = 0; i < caminho.length; i += 1) {
    const q = caminho[i]
    if (Math.hypot(q.x, q.y) > RAIO_MAXIMO) break
    const t = i / (pontos - 1)
    const w = w0 * Math.pow(Math.min(1, (1 - t) / GALHO.afina), 0.8) * (0.88 + 0.24 * sorteio(semente + 0.25, base + 80 + i))
    lista.push({ x: q.x, y: q.y, w })
  }
  return lista
}

/** A linha principal e os galhos (e galhinhos), no chão, antes de girar. */
function trinca(semente: number): Ponto[][] {
  const linha = principal(semente)
  const trechos: Ponto[][] = [linha]
  const quantos = 2 + (sorteio(semente, 50) < 0.55 ? 1 : 0) + (sorteio(semente, 51) < 0.25 ? 1 : 0)
  for (let gi = 0; gi < quantos; gi += 1) {
    const base = BASE_DOS_GALHOS + gi * PASSO_DOS_GALHOS
    // Onde sai: longe das pontas, um galho para cada lado, alternando.
    const i0 = 3 + Math.floor(sorteio(semente, base) * (linha.length - 7))
    const a = linha[i0]
    const b = linha[Math.min(linha.length - 1, i0 + 1)]
    const lado = (gi + Math.floor(sorteio(semente, 52) * 2)) % 2 === 0 ? 1 : -1
    const rumo = Math.atan2(b.y - a.y, b.x - a.x) + lado * entre(GALHO.angulo, sorteio(semente, base + 1))
    const g = galho(a, rumo, entre(GALHO.comprimento, sorteio(semente, base + 2)), GALHO.pontos, a.w * GALHO.largura, GALHO.passos, semente, base + 10)
    if (g.length < 3) continue
    trechos.push(g)
    if (sorteio(semente, base + 4) < GALHINHO.chance) {
      const j0 = Math.min(g.length - 2, 1 + Math.floor(sorteio(semente, base + 5) * 2))
      const c = g[j0]
      const d = g[j0 + 1]
      const outro = sorteio(semente, base + 6) < 0.5 ? 1 : -1
      const rumo2 = Math.atan2(d.y - c.y, d.x - c.x) + outro * entre(GALHINHO.angulo, sorteio(semente, base + 7))
      const galhinho = galho(c, rumo2, entre(GALHINHO.comprimento, sorteio(semente, base + 8)), GALHINHO.pontos, c.w * GALHINHO.largura, GALHINHO.passos, semente, base + 50)
      if (galhinho.length >= 2) trechos.push(galhinho)
    }
  }
  return trechos
}

/**
 * Acrescenta ao caminho as fitas dos trechos, já giradas e achatadas. Cada fita vai pela borda `ida` e volta pela
 * `volta` (quanto cada borda anda para a esquerda da linha, pela meia largura dali), todas na mesma mão: o
 * preenchimento (regra do não-zero) é a união delas. O corpo vai por `w` e volta por `−w`; um anel do halo vai pela
 * beira de fora e volta pela do corpo.
 */
function fitas(g: CanvasRenderingContext2D, trechos: readonly Ponto[][], giro: number, ida: (w: number) => number, volta: (w: number) => number): void {
  const cg = Math.cos(giro)
  const sg = Math.sin(giro)
  const telaX = (x: number, y: number): number => x * cg - y * sg
  const telaY = (x: number, y: number): number => MEIO_Y + (x * sg + y * cg) * ACHATA
  for (const t of trechos) {
    const n = t.length
    if (n < 2) continue
    const deIda: number[] = []
    const deVolta: number[] = []
    for (let i = 0; i < n; i += 1) {
      const a = t[Math.max(0, i - 1)]
      const b = t[Math.min(n - 1, i + 1)]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const tamanho = Math.hypot(dx, dy) || 1
      const nx = -dy / tamanho
      const ny = dx / tamanho
      const wi = ida(t[i].w)
      const wv = volta(t[i].w)
      deIda.push(t[i].x + nx * wi, t[i].y + ny * wi)
      deVolta.push(t[i].x + nx * wv, t[i].y + ny * wv)
    }
    g.moveTo(telaX(deIda[0], deIda[1]), telaY(deIda[0], deIda[1]))
    for (let i = 1; i < n; i += 1) g.lineTo(telaX(deIda[i * 2], deIda[i * 2 + 1]), telaY(deIda[i * 2], deIda[i * 2 + 1]))
    for (let i = n - 1; i >= 0; i -= 1) g.lineTo(telaX(deVolta[i * 2], deVolta[i * 2 + 1]), telaY(deVolta[i * 2], deVolta[i * 2 + 1]))
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
  // O halo: três anéis fracos em volta do corpo (dos dois lados), cada um mais largo: a beira some num degradê.
  g.fillStyle = css(ESCURO, ALFA.halo)
  for (const anel of HALO) {
    const fora = (w: number): number => w * anel.vezes + anel.mais
    g.beginPath()
    fitas(g, trechos, giro, fora, (w) => w)
    fitas(g, trechos, giro, (w) => -w, (w) => -fora(w))
    g.fill()
  }
  g.fillStyle = css(ESCURO, ALFA.corpo)
  g.beginPath()
  fitas(g, trechos, giro, (w) => w, (w) => -w)
  g.fill()
  // O fundo só nos trechos grossos (a linha e os galhos), estreito: a trinca escurece mais no meio.
  const fundo = (w: number): number => Math.max(0, w * FUNDO.vezes - (w < FUNDO.minimo ? w : 0))
  g.fillStyle = css(ESCURO, ALFA.fundo)
  g.beginPath()
  fitas(g, trechos.slice(0, 1 + Math.min(trechos.length - 1, 4)), giro, fundo, (w) => -fundo(w))
  g.fill()
  lascas(g, trechos[0], giro, semente)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'rachadura-no-chao', nome: 'Rachadura no chão', tamanho: 12, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [ESCURO]
