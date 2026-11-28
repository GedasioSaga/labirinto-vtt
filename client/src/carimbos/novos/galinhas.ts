import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Galinhas (lote L07 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Vila e fazenda;
 * desenho ORIGINAL): três ou quatro galinhas soltas no terreiro, vistas de cima e um pouco de frente, como os ratos.
 * Cada uma numa POSE que a semente escolhe: CISCANDO (o pescoço esticado, a cabeça lá na frente, rente ao chão, e
 * dois grãos de milho na frente do bico), ANDANDO (a cabeça alta, perto do peito) ou DEITADA (chocando: o corpo
 * redondo, a cabeça encolhida e virada para um lado).
 *
 * Bicho de verdade, sem cartoon: o corpo é UM contorno em gota (o peito redondo na frente, a anca larga atrás), as
 * ASAS dobradas nos dois lados, um nada mais escuras, com a ponta das penas clara, e o RABO em leque atrás, alto. A
 * cabeça é pequena, com a crista e a barbela de um vermelho contido, o bico ocre e os olhos dois pontos escuros. As
 * três plumagens de quintal: a BRANCA (creme, nunca o branco puro), a PEDRÊS ruiva (o rabo quase preto) e a CARIJÓ
 * (cinza com pintas claras: pintas, não listras).
 *
 * A luz é UM claro suave que atravessa o corpo do lado da luz (de cima à esquerda) para o da sombra, como nos ratos.
 * O giro muda para onde cada uma olha e o lugar delas; a luz não gira. É do chão (`sombra: 'nenhuma'`): cada galinha
 * pinta a SUA sombra de contato, macia, quase debaixo dela. O bando fica centrado no ponto do carimbo.
 */

interface Plumagem {
  readonly escuro: Rgb
  readonly meio: Rgb
  readonly claro: Rgb
  /** O rabo (a pedrês tem o rabo quase preto) e as pintas (só a carijó). */
  readonly rabo: Rgb
  readonly pintas?: Rgb
}

const BRANCA: Plumagem = { escuro: [168, 160, 146], meio: [208, 202, 189], claro: [232, 228, 218], rabo: [190, 184, 170] }
const PEDRES: Plumagem = { escuro: [96, 62, 44], meio: [136, 92, 64], claro: [168, 124, 90], rabo: [62, 46, 38] }
const CARIJO: Plumagem = { escuro: [84, 80, 75], meio: [120, 115, 108], claro: [152, 147, 139], rabo: [62, 59, 56], pintas: [200, 196, 186] }
const PLUMAGENS: readonly Plumagem[] = [PEDRES, BRANCA, CARIJO]
/** A crista e a barbela, o bico, o olho, o milho e a sombra de contato. */
const CRISTA: Rgb = [166, 72, 58]
const BICO: Rgb = [190, 156, 92]
const OLHO: Rgb = [38, 30, 26]
const MILHO: Rgb = [196, 162, 84]
const SOMBRA: Rgb = [26, 22, 20]

/** O chão visto de cima e um pouco de frente (a galinha tem altura: achata como o rato). */
const ACHATA = 0.74
/** O raio em que as galinhas ficam e até onde o desenho pode descer no quadro (a arte acaba em 0,3). */
const RAIO_DO_BANDO = 0.25
const FUNDO_DO_QUADRO = 0.27
/** O comprimento do corpo, do rabo ao peito (unidades do quadro). */
const CORPO = 0.25

const LUZ = { x: -0.6, y: -0.8 }
const DIRECAO_DA_SOMBRA = { x: 0.537, y: 0.844 }
const DESLOCAMENTO_DA_SOMBRA = 0.014
const ALFA_DA_SOMBRA = 0.3

/** As poses: onde fica a cabeça (à frente do peito, em corpos), o quanto ela vira (rad) e se o corpo arredonda. */
type Pose = 'ciscando' | 'andando' | 'deitada'
const CABECA: Readonly<Record<Pose, { readonly frente: number; readonly vira: number; readonly redonda: number }>> = {
  ciscando: { frente: 0.2, vira: 0.25, redonda: 1 },
  andando: { frente: 0.12, vira: 0.12, redonda: 1 },
  deitada: { frente: 0.06, vira: 0.9, redonda: 1.14 },
}
/** A meia largura ao longo da espinha (0 = o rabo, 1 = o peito), em fração da meia largura da anca: a gota. */
const LARGURAS: readonly (readonly [number, number])[] = [
  [0, 0.3],
  [0.1, 0.72],
  [0.32, 1],
  [0.58, 0.97],
  [0.8, 0.78],
  [0.93, 0.48],
  [1, 0],
]
const AMOSTRAS = 13

type P = readonly [number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function suave(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

function larguraEm(s: number): number {
  let i = 1
  while (i < LARGURAS.length - 1 && LARGURAS[i][0] < s) i += 1
  const [s0, w0] = LARGURAS[i - 1]
  const [s1, w1] = LARGURAS[i]
  return w0 + (w1 - w0) * suave((s - s0) / (s1 - s0))
}

function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, giro: number, cor: Rgb, alfa = 1): void {
  g.fillStyle = css(cor, alfa)
  g.beginPath()
  g.ellipse(x, y, rx, ry, giro, 0, Math.PI * 2)
  g.fill()
}

interface Galinha {
  readonly x: number
  readonly y: number
  readonly rumo: number
  readonly pose: Pose
  readonly plumagem: Plumagem
  readonly tamanho: number
  /** Para que lado a cabeça vira (1 ou -1). */
  readonly lado: number
  readonly semente: number
}

/** O contorno do corpo (o rabo no -x, o peito no +x), no referencial da galinha. */
function contornoDe(gal: Galinha): { readonly contorno: readonly P[]; readonly c: number; readonly largo: number } {
  const c = CORPO * gal.tamanho
  const redonda = CABECA[gal.pose].redonda
  const comprimento = c / redonda
  const largo = c * 0.36 * redonda
  const lado1: P[] = []
  const lado2: P[] = []
  for (let i = 0; i < AMOSTRAS; i++) {
    const s = i / (AMOSTRAS - 1)
    const x = -comprimento * 0.55 + comprimento * s
    const w = largo * larguraEm(s)
    lado1.push([x, w])
    lado2.push([x, -w])
  }
  return { contorno: [...lado1, ...lado2.slice(1, -1).reverse()], c, largo }
}

/** O ponto da galinha na tela (gira, achata e põe no lugar). */
function naTela(gal: Galinha, [x, y]: P): P {
  const [co, si] = [Math.cos(gal.rumo), Math.sin(gal.rumo)]
  return [gal.x + x * co - y * si, gal.y + (x * si + y * co) * ACHATA]
}

/** Onde fica a cabeça, no referencial da galinha. */
function cabecaDe(gal: Galinha, c: number): P {
  const pose = CABECA[gal.pose]
  const a = gal.lado * pose.vira
  const r = c * (0.42 + pose.frente)
  return [Math.cos(a) * r, Math.sin(a) * r]
}

function caminhoLiso(g: CanvasRenderingContext2D, pontos: readonly P[]): void {
  const n = pontos.length
  const entre = (i: number): P => {
    const [a, b] = [pontos[i % n], pontos[(i + 1) % n]]
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  }
  g.beginPath()
  const [x0, y0] = entre(n - 1)
  g.moveTo(x0, y0)
  for (let i = 0; i < n; i++) {
    const [mx, my] = entre(i)
    g.quadraticCurveTo(pontos[i][0], pontos[i][1], mx, my)
  }
  g.closePath()
}

function desenharSombra(g: CanvasRenderingContext2D, gal: Galinha, c: number): void {
  g.save()
  g.translate(gal.x + DIRECAO_DA_SOMBRA.x * DESLOCAMENTO_DA_SOMBRA, gal.y + DIRECAO_DA_SOMBRA.y * DESLOCAMENTO_DA_SOMBRA)
  g.scale(1, ACHATA)
  g.rotate(gal.rumo)
  const raio = c * 0.62
  g.scale(1, 0.62)
  const mancha = g.createRadialGradient(0, 0, 0, 0, 0, raio)
  mancha.addColorStop(0, css(SOMBRA, ALFA_DA_SOMBRA))
  mancha.addColorStop(0.55, css(SOMBRA, ALFA_DA_SOMBRA * 0.85))
  mancha.addColorStop(1, css(SOMBRA, 0))
  g.fillStyle = mancha
  g.beginPath()
  g.arc(0, 0, raio, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

function desenharGalinha(g: CanvasRenderingContext2D, gal: Galinha): void {
  const { contorno, c, largo } = contornoDe(gal)
  const pl = gal.plumagem
  g.save()
  g.translate(gal.x, gal.y)
  g.scale(1, ACHATA)
  g.rotate(gal.rumo)
  const lx = LUZ.x * Math.cos(gal.rumo) + LUZ.y * Math.sin(gal.rumo)
  const ly = -LUZ.x * Math.sin(gal.rumo) + LUZ.y * Math.cos(gal.rumo)
  const [hx, hy] = cabecaDe(gal, c)

  // O pescoço, do peito até a cabeça, no tom do corpo (por baixo do corpo e da cabeça).
  g.lineCap = 'round'
  g.strokeStyle = css(misturar(pl.meio, pl.escuro, 0.25))
  g.lineWidth = c * 0.2
  g.beginPath()
  g.moveTo(c * 0.3, 0)
  g.quadraticCurveTo(c * 0.42, hy * 0.4, hx * 0.9, hy * 0.9)
  g.stroke()

  // O corpo em gota, com o claro do lado da luz.
  caminhoLiso(g, contorno)
  const alcance = Math.abs(lx) * c * 0.5 + Math.abs(ly) * largo
  const corpo = g.createLinearGradient(lx * alcance, ly * alcance, -lx * alcance, -ly * alcance)
  corpo.addColorStop(0, css(misturar(pl.meio, pl.claro, 0.85)))
  corpo.addColorStop(0.45, css(pl.meio))
  corpo.addColorStop(1, css(pl.escuro))
  g.fillStyle = corpo
  g.fill()

  // As pintas da carijó: miúdas e espalhadas, mais no lombo (pintas, nunca listras).
  if (pl.pintas !== undefined) {
    for (let i = 0; i < 22; i++) {
      const s = sorteio(gal.semente, 100 + i)
      const px = -c * 0.42 + c * 0.7 * s
      const py = (sorteio(gal.semente, 140 + i) - 0.5) * largo * 1.5 * larguraEm(s)
      oval(g, px, py, c * 0.032, c * 0.024, 0.4, pl.pintas, 0.8)
    }
  }

  // As asas dobradas, uma de cada lado, um nada mais escuras, com a ponta das penas clara para trás.
  for (const lado of [-1, 1]) {
    const tom = lado * ly > 0 ? pl.escuro : misturar(pl.meio, pl.escuro, 0.45)
    oval(g, -c * 0.06, lado * largo * 0.6, c * 0.3, largo * 0.34, lado * 0.06, tom, 0.85)
    oval(g, -c * 0.3, lado * largo * 0.55, c * 0.09, largo * 0.2, lado * 0.2, misturar(pl.claro, pl.meio, 0.35), 0.75)
  }

  // O rabo em leque, alto, atrás: penas em pontas, mais escuro (a pedrês, quase preto).
  for (let k = -2; k <= 2; k++) {
    const a = Math.PI + k * 0.24
    const r = c * (0.2 + 0.04 * (2 - Math.abs(k)))
    const bx = -c * 0.42
    oval(g, bx + Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.52, c * 0.045, a, misturar(pl.rabo, pl.escuro, 0.2 + 0.1 * Math.abs(k)))
  }

  // A cabeça: o tom do corpo, a crista vermelha em cima ao comprido, a barbela embaixo do bico, o bico e os olhos.
  const rumoDaCabeca = Math.atan2(hy, hx) + gal.lado * CABECA[gal.pose].vira * 0.6
  const [cx, cy] = [Math.cos(rumoDaCabeca), Math.sin(rumoDaCabeca)]
  oval(g, hx, hy, c * 0.1, c * 0.09, rumoDaCabeca, misturar(pl.meio, pl.claro, 0.4))
  oval(g, hx + cx * c * 0.1, hy + cy * c * 0.1, c * 0.038, c * 0.026, rumoDaCabeca, BICO)
  oval(g, hx + cx * c * 0.08 - cy * c * 0.006, hy + cy * c * 0.08 + cx * c * 0.006, c * 0.022, c * 0.03, rumoDaCabeca, CRISTA, 0.9)
  oval(g, hx - cx * c * 0.01, hy - cy * c * 0.01, c * 0.085, c * 0.034, rumoDaCabeca, CRISTA)
  for (const lado of [-1, 1]) oval(g, hx + cx * c * 0.02 - cy * lado * c * 0.05, hy + cy * c * 0.02 + cx * lado * c * 0.05, c * 0.014, c * 0.014, 0, OLHO)

  // Ciscando: dois grãos de milho no chão, na frente do bico.
  if (gal.pose === 'ciscando') {
    for (let i = 0; i < 2; i++) {
      const d = c * (0.16 + 0.07 * i)
      oval(g, hx + cx * d + (sorteio(gal.semente, 200 + i) - 0.5) * c * 0.1, hy + cy * d + (sorteio(gal.semente, 210 + i) - 0.5) * c * 0.1, c * 0.02, c * 0.016, 0, MILHO)
    }
  }
  g.restore()
}

const POSES: readonly Pose[] = ['ciscando', 'andando', 'ciscando', 'deitada']

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const quantas = sorteio(semente, 1) < 0.5 ? 3 : 4
  const soltas: Galinha[] = []
  for (let i = 0; i < quantas; i++) {
    const a = giro + (i / quantas) * Math.PI * 2 + (sorteio(semente, 10 + i) - 0.5) * 0.8
    const rho = RAIO_DO_BANDO * (0.55 + 0.45 * sorteio(semente, 20 + i))
    const pose = POSES[(Math.floor(sorteio(semente, 50 + i) * POSES.length) + i) % POSES.length]
    soltas.push({
      x: Math.cos(a) * rho,
      y: Math.sin(a) * rho * ACHATA,
      rumo: a + Math.PI / 2 + (sorteio(semente, 40 + i) - 0.5) * 1.6,
      pose,
      plumagem: PLUMAGENS[(i + Math.floor(sorteio(semente, 30 + i) * 2)) % PLUMAGENS.length],
      tamanho: 0.9 + 0.2 * sorteio(semente, 60 + i),
      lado: sorteio(semente, 70 + i) < 0.5 ? 1 : -1,
      semente: semente * 10 + i,
    })
  }
  // O bando sobe o que passar do fundo do quadro (o rabo ou a cabeça de quem está virada para a frente).
  let fundo = -Infinity
  for (const gal of soltas) {
    const { contorno, c } = contornoDe(gal)
    for (const ponto of [...contorno, cabecaDe(gal, c)]) fundo = Math.max(fundo, naTela(gal, ponto)[1] + c * 0.1)
  }
  const sobe = Math.max(0, fundo + 0.02 - FUNDO_DO_QUADRO)
  const galinhas = soltas.map((gal) => ({ ...gal, y: gal.y - sobe })).sort((p, q) => p.y - q.y)
  for (const gal of galinhas) desenharSombra(g, gal, CORPO * gal.tamanho)
  for (const gal of galinhas) desenharGalinha(g, gal)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'galinhas', nome: 'Galinhas', tamanho: 10, sombra: 'nenhuma', desenhar }

/** Todas as cores chapadas do desenho (as misturas saem delas). */
export const paleta: readonly Rgb[] = [
  ...[BRANCA, PEDRES, CARIJO].flatMap((p) => [p.escuro, p.meio, p.claro, p.rabo, ...(p.pintas === undefined ? [] : [p.pintas])]),
  CRISTA,
  BICO,
  OLHO,
  MILHO,
  SOMBRA,
]
