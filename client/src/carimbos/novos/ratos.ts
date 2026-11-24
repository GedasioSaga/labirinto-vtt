import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Ratos (lote L03 de 24/11/2026, Tortura e fogo; desenho ORIGINAL): dois ou
 * três ratos de masmorra, vistos de cima e um pouco de frente, cada um numa
 * POSE que a semente escolhe: CORRENDO (o corpo esticado, o rabo quase reto
 * atrás), PARADO farejando (encolhido, a cabeça virada, o rabo dando a volta)
 * ou VIRANDO (a cabeça e o rabo em curva, um para cada lado).
 *
 * Bicho de verdade, sem cartoon: o corpo e a cabeça são UM contorno só, em
 * gota (a anca larga, os ombros estreitos, o pescoço e a cunha do focinho, que
 * vira com a pose), as orelhas redondas e pequenas, os olhos dois pontos
 * escuros sem brilho, as patas miúdas quase no tom do pelo e o rabo comprido,
 * pelado e fino, afinando até a ponta, numa cor só. As cores são as do
 * rato-pardo, e um deles é mais escuro, quase preto. Sem contorno, sem dente,
 * sem olho vermelho.
 *
 * A luz é UM claro suave que atravessa o corpo, do lado da luz (de cima à
 * esquerda) para o lado da sombra: antes eram ovais concêntricas, e o rato lia
 * como amendoim com alvo no meio. O giro muda para onde cada rato corre e o
 * lugar deles; a luz não gira.
 *
 * É do chão (`sombra: 'nenhuma'`): cada rato pinta a SUA sombra de contato,
 * macia, do tamanho do corpo e quase debaixo dele. A sombra tirada da silhueta
 * (`baixa`) caía longe e se soltava dos ratos. O bando fica centrado no ponto
 * do carimbo.
 */

interface Pelo {
  readonly escuro: Rgb
  readonly meio: Rgb
  readonly claro: Rgb
}

/** O rato-pardo e o rato-preto (o mais escuro do bando). */
const PARDO: Pelo = { escuro: [68, 58, 50], meio: [112, 98, 85], claro: [150, 136, 120] }
const PRETO: Pelo = { escuro: [50, 45, 42], meio: [80, 73, 68], claro: [112, 104, 97] }
/** O rabo pelado, o rosado das patas (entra só um pouco, por cima do tom do pelo), a orelha por dentro e o olho. */
const RABO: Rgb = [134, 110, 100]
const PATA: Rgb = [162, 136, 124]
const ORELHA_POR_DENTRO: Rgb = [140, 114, 104]
const OLHO: Rgb = [42, 36, 33]
/** A sombra de contato de cada rato. */
const SOMBRA: Rgb = [26, 22, 20]

/** O chão visto de cima e um pouco de frente: o rato tem altura, então achata menos que as pedras. */
const ACHATA = 0.72
/** O meio do bando no quadro (o ponto do carimbo) e o raio em que os ratos ficam. */
const MEIO_Y = 0
const RAIO_DO_BANDO = 0.24
/** Até onde o desenho pode descer no quadro (a arte acaba em 0,3): o bando sobe o que passar daqui. */
const FUNDO_DO_QUADRO = 0.27
/** O comprimento do corpo (unidades): um rato grande de masmorra, perto de um terço de casa com a cabeça. */
const CORPO = 0.27

/** A luz no plano (de cima à esquerda), a dos outros carimbos. */
const LUZ = { x: -0.6, y: -0.8 }
/** A sombra de contato: para onde cai (a direção da sombra do mapa), quanto anda (unidades) e a força no miolo. */
const DIRECAO_DA_SOMBRA = { x: 0.537, y: 0.844 }
const DESLOCAMENTO_DA_SOMBRA = 0.012
const ALFA_DA_SOMBRA = 0.3

/** As poses: quanto o corpo estica, quanto a cabeça vira (rad) e a curva do rabo (rad por trecho; o sinal é sorteado). */
const POSES: readonly { readonly estica: number; readonly cabeca: number; readonly rabo: number }[] = [
  { estica: 1.14, cabeca: 0.08, rabo: 0.1 },
  { estica: 0.84, cabeca: 0.55, rabo: 0.5 },
  { estica: 0.98, cabeca: -0.42, rabo: 0.3 },
]
const TRECHOS_DO_RABO = 9
/** Quantas amostras tem a espinha (da anca ao focinho). */
const AMOSTRAS = 15
/**
 * A meia largura ao longo da espinha (0 = a ponta da anca, 1 = a ponta do focinho), em fração da meia largura da
 * anca: a anca larga, os ombros, o pescoço, as bochechas e a cunha do focinho. É o contorno em gota.
 */
const LARGURAS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.05, 0.64],
  [0.2, 1],
  [0.36, 0.95],
  [0.56, 0.72],
  [0.68, 0.5],
  [0.77, 0.5],
  [0.9, 0.3],
  [0.97, 0.14],
  [1, 0],
]
/** Onde a cabeça começa a virar e onde acaba de virar, ao longo da espinha. */
const PESCOCO: readonly [number, number] = [0.56, 0.8]

type P = readonly [number, number]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
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

function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, giro: number, cor: Rgb): void {
  g.fillStyle = css(cor)
  g.beginPath()
  g.ellipse(x, y, rx, ry, giro, 0, Math.PI * 2)
  g.fill()
}

interface Rato {
  readonly x: number
  readonly y: number
  /** Para onde ele aponta (rad, na tela antes de achatar). */
  readonly rumo: number
  readonly pose: number
  readonly pelo: Pelo
  readonly tamanho: number
  /** Para que lado o rabo e a cabeça entortam (1 ou -1). */
  readonly lado: number
}

/** O rato no referencial dele (o focinho para +x, a anca no -x): a espinha, o contorno em gota e o rabo. */
interface Forma {
  readonly c: number
  readonly largo: number
  readonly comprimento: number
  /** A espinha: o ponto, o rumo (rad) e a meia largura em cada amostra. */
  readonly espinha: readonly { readonly x: number; readonly y: number; readonly rumo: number; readonly w: number }[]
  readonly contorno: readonly P[]
  /** O rabo: os pontos, da anca à ponta. */
  readonly rabo: readonly P[]
}

function formaDe(r: Rato): Forma {
  const pose = POSES[r.pose]
  const c = CORPO * r.tamanho
  const meio = c * 0.5 * pose.estica
  const largo = (c * 0.25) / Math.sqrt(pose.estica)
  const comprimento = c * (0.88 * pose.estica + 0.29)
  const passo = comprimento / (AMOSTRAS - 1)
  const vira = r.lado * pose.cabeca
  const espinha: { x: number; y: number; rumo: number; w: number }[] = []
  let [x, y] = [-meio * 0.98, 0]
  for (let i = 0; i < AMOSTRAS; i++) {
    const s = i / (AMOSTRAS - 1)
    const rumo = vira * suave((s - PESCOCO[0]) / (PESCOCO[1] - PESCOCO[0]))
    espinha.push({ x, y, rumo, w: largo * larguraEm(s) })
    const adiante = vira * suave((s + 0.5 / (AMOSTRAS - 1) - PESCOCO[0]) / (PESCOCO[1] - PESCOCO[0]))
    x += Math.cos(adiante) * passo
    y += Math.sin(adiante) * passo
  }
  const deUmLado = espinha.map((e): P => [e.x - Math.sin(e.rumo) * e.w, e.y + Math.cos(e.rumo) * e.w])
  const doOutro = espinha.map((e): P => [e.x + Math.sin(e.rumo) * e.w, e.y - Math.cos(e.rumo) * e.w])
  // As duas pontas (a anca e o focinho) têm largura zero: um ponto só de cada.
  const contorno: P[] = [...deUmLado, ...doOutro.slice(1, -1).reverse()]
  // O rabo: sai da anca e afina até a ponta, em trechos.
  const rabo: P[] = [[-meio * 0.92, 0]]
  let rumoDoRabo = Math.PI + r.lado * 0.15
  const trecho = (c * 0.95) / TRECHOS_DO_RABO
  for (let i = 0; i < TRECHOS_DO_RABO; i++) {
    const t = i / (TRECHOS_DO_RABO - 1)
    rumoDoRabo += r.lado * pose.rabo * (0.5 + 0.9 * t)
    const [tx, ty] = rabo[i]
    rabo.push([tx + Math.cos(rumoDoRabo) * trecho, ty + Math.sin(rumoDoRabo) * trecho])
  }
  return { c, largo, comprimento, espinha, contorno, rabo }
}

/** O ponto local do rato na tela (gira, achata e põe no lugar). */
function naTela(r: Rato, [x, y]: P): P {
  const [co, si] = [Math.cos(r.rumo), Math.sin(r.rumo)]
  return [r.x + x * co - y * si, r.y + (x * si + y * co) * ACHATA]
}

/** O ponto da espinha em `s` (0 a 1), afastado `n` meias larguras para o lado. */
function naEspinha(f: Forma, s: number, n: number): P {
  const q = s * (AMOSTRAS - 1)
  const i = Math.min(AMOSTRAS - 2, Math.floor(q))
  const t = q - i
  const [a, b] = [f.espinha[i], f.espinha[i + 1]]
  const rumo = a.rumo + (b.rumo - a.rumo) * t
  const w = (a.w + (b.w - a.w) * t) * n
  return [a.x + (b.x - a.x) * t - Math.sin(rumo) * w, a.y + (b.y - a.y) * t + Math.cos(rumo) * w]
}

/** A sombra de contato do rato: uma mancha macia do tamanho do corpo, um nada para o lado da sombra. */
function desenharSombra(g: CanvasRenderingContext2D, r: Rato, f: Forma): void {
  const [mx, my] = naEspinha(f, 0.46, 0)
  g.save()
  g.translate(r.x + DIRECAO_DA_SOMBRA.x * DESLOCAMENTO_DA_SOMBRA, r.y + DIRECAO_DA_SOMBRA.y * DESLOCAMENTO_DA_SOMBRA)
  g.scale(1, ACHATA)
  g.rotate(r.rumo)
  g.translate(mx, my)
  // Um círculo do comprimento do corpo, achatado na largura dele: o degradê radial vira a mancha macia. (O raio fica em
  // unidades do quadro, sem esticar a escala: a régua dos carimbos confere os números crus que o desenho passa.)
  const raio = f.comprimento * 0.56
  g.scale(1, (f.largo * 1.3) / raio)
  const mancha = g.createRadialGradient(0, 0, 0, 0, 0, raio)
  mancha.addColorStop(0, css(SOMBRA, ALFA_DA_SOMBRA))
  mancha.addColorStop(0.55, css(SOMBRA, ALFA_DA_SOMBRA * 0.86))
  mancha.addColorStop(1, css(SOMBRA, 0))
  g.fillStyle = mancha
  g.beginPath()
  g.arc(0, 0, raio, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

function desenharRato(g: CanvasRenderingContext2D, r: Rato, f: Forma): void {
  const { c, largo } = f
  g.save()
  g.translate(r.x, r.y)
  g.scale(1, ACHATA)
  g.rotate(r.rumo)
  // A luz no referencial do rato (a rotação ao contrário; o achatado mexe pouco e fica de fora).
  const lx = LUZ.x * Math.cos(r.rumo) + LUZ.y * Math.sin(r.rumo)
  const ly = -LUZ.x * Math.sin(r.rumo) + LUZ.y * Math.cos(r.rumo)

  // O rabo: uma cor só, em trechos cada vez mais finos (o trecho de ponta redonda emenda no seguinte).
  g.lineCap = 'round'
  g.strokeStyle = css(RABO)
  for (let i = 0; i < TRECHOS_DO_RABO; i++) {
    const t = i / (TRECHOS_DO_RABO - 1)
    g.lineWidth = c * (0.085 - 0.06 * t)
    g.beginPath()
    g.moveTo(f.rabo[i][0], f.rabo[i][1])
    g.lineTo(f.rabo[i + 1][0], f.rabo[i + 1][1])
    g.stroke()
  }

  // As patas: quatro pontinhas quase no tom do pelo, saindo de debaixo do corpo (as de trás mais compridas).
  const pata = misturar(r.pelo.meio, PATA, 0.3)
  for (const [s, lado, comprida] of [[0.2, 1, 1.4], [0.2, -1, 1.4], [0.55, 1, 1], [0.55, -1, 1]] as const) {
    const [px, py] = naEspinha(f, s, lado * 1.08)
    oval(g, px + c * 0.03, py, c * 0.055 * comprida, c * 0.03, lado * 0.5, pata)
  }

  // O corpo e a cabeça: UM contorno em gota, da anca larga até o focinho, liso (a curva passa pelo meio de cada lado).
  const n = f.contorno.length
  const entre = (i: number): P => {
    const [a, b] = [f.contorno[i % n], f.contorno[(i + 1) % n]]
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  }
  g.beginPath()
  const [x0, y0] = entre(n - 1)
  g.moveTo(x0, y0)
  for (let i = 0; i < n; i++) {
    const [mx, my] = entre(i)
    g.quadraticCurveTo(f.contorno[i][0], f.contorno[i][1], mx, my)
  }
  g.closePath()
  // A luz: um claro só, atravessando o corpo do lado da luz para o lado da sombra. Sem anéis.
  const [cx, cy] = naEspinha(f, 0.46, 0)
  const alcance = Math.abs(lx) * f.comprimento * 0.5 + Math.abs(ly) * largo
  const pelo = g.createLinearGradient(cx + lx * alcance, cy + ly * alcance, cx - lx * alcance, cy - ly * alcance)
  pelo.addColorStop(0, css(misturar(r.pelo.meio, r.pelo.claro, 0.8)))
  pelo.addColorStop(0.42, css(r.pelo.meio))
  pelo.addColorStop(1, css(r.pelo.escuro))
  g.fillStyle = pelo
  g.fill()

  // As orelhas, de cada lado da cabeça: uma mancha só, um nada rosada (com miolo claro a orelha virava um olho esbugalhado).
  for (const lado of [-1, 1]) {
    const [ox, oy] = naEspinha(f, 0.73, lado * 0.96)
    oval(g, ox, oy, c * 0.05, c * 0.042, 0, misturar(r.pelo.escuro, ORELHA_POR_DENTRO, 0.42))
  }
  // Os olhos, dois pontos escuros, e a ponta do focinho rosada.
  for (const lado of [-1, 1]) {
    const [ex, ey] = naEspinha(f, 0.855, lado * 0.62)
    oval(g, ex, ey, c * 0.017, c * 0.014, 0, OLHO)
  }
  const [nx, ny] = naEspinha(f, 0.985, 0)
  oval(g, nx, ny, c * 0.018, c * 0.015, 0, ORELHA_POR_DENTRO)
  g.restore()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const quantos = sorteio(semente, 1) < 0.45 ? 2 : 3
  const soltos: Rato[] = []
  for (let i = 0; i < quantos; i++) {
    // Em volta do meio, cada um no seu terço; correm em roda, um ou outro para fora.
    const a = giro + (i / quantos) * Math.PI * 2 + (sorteio(semente, 10 + i) - 0.5) * 0.9
    const rho = RAIO_DO_BANDO * (0.62 + 0.38 * sorteio(semente, 20 + i))
    const paraFora = sorteio(semente, 30 + i) < 0.3
    soltos.push({
      x: Math.cos(a) * rho,
      y: MEIO_Y + Math.sin(a) * rho * ACHATA,
      rumo: a + (paraFora ? 0 : Math.PI / 2) + (sorteio(semente, 40 + i) - 0.5) * 1.1,
      pose: (Math.floor(sorteio(semente, 50 + i) * POSES.length) + i) % POSES.length,
      pelo: i === 1 ? PRETO : PARDO,
      tamanho: 0.86 + 0.28 * sorteio(semente, 60 + i),
      lado: sorteio(semente, 70 + i) < 0.5 ? 1 : -1,
    })
  }
  // O bando inteiro sobe o que passar do fundo do quadro (o rabo ou o focinho de um rato virado para a frente).
  let fundo = -Infinity
  for (const r of soltos) {
    const f = formaDe(r)
    for (const ponto of [...f.contorno, ...f.rabo]) fundo = Math.max(fundo, naTela(r, ponto)[1])
  }
  const sobe = Math.max(0, fundo + 0.02 - FUNDO_DO_QUADRO)
  const ratos = soltos.map((r) => ({ ...r, y: r.y - sobe })).sort((p, q) => p.y - q.y)
  const formas = ratos.map(formaDe)
  ratos.forEach((r, i) => desenharSombra(g, r, formas[i]))
  ratos.forEach((r, i) => desenharRato(g, r, formas[i]))
}

export const carimbo: DefinicaoDeCarimbo = { id: 'ratos', nome: 'Ratos', tamanho: 7, sombra: 'nenhuma', desenhar }

/** Todas as cores chapadas do desenho (as misturas saem delas). */
export const paleta: readonly Rgb[] = [...[PARDO, PRETO].flatMap((p) => [p.escuro, p.meio, p.claro]), RABO, PATA, ORELHA_POR_DENTRO, OLHO, SOMBRA]
