import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Ratos (lote L03 de 24/11/2026, Tortura e fogo; desenho ORIGINAL): dois ou
 * três ratos de masmorra, vistos de cima e um pouco de frente, cada um numa
 * POSE que a semente escolhe: CORRENDO (o corpo esticado, o rabo quase reto
 * atrás), PARADO farejando (encolhido, a cabeça virada, o rabo dando a volta)
 * ou VIRANDO (a cabeça e o rabo em curva, um para cada lado).
 *
 * Bicho de verdade, sem cartoon: o corpo em gota (a anca larga, os ombros
 * estreitos), a cabeça em cunha com o focinho fino, as orelhas redondas e
 * pequenas, os olhos dois pontos escuros sem brilho, as patas miúdas saindo
 * de debaixo do corpo e o rabo comprido, pelado e fino, afinando até a ponta.
 * As cores são as do rato-pardo: o lombo castanho-acinzentado, mais escuro no
 * fio das costas e do lado da sombra, e um deles mais escuro, quase preto. Sem
 * contorno, sem dente, sem olho vermelho.
 *
 * O volume é o de sempre dos carimbos: três tons chapados (o corpo escuro, o
 * lombo no meio-tom e o claro do lado da luz, de cima à esquerda). O giro
 * muda para onde cada rato corre e o lugar deles; a luz não gira. A sombra no
 * chão sai da silhueta (`baixa`).
 */

interface Pelo {
  readonly escuro: Rgb
  readonly meio: Rgb
  readonly claro: Rgb
}

/** O rato-pardo e o rato-preto (o mais escuro do bando). */
const PARDO: Pelo = { escuro: [68, 58, 50], meio: [112, 98, 85], claro: [150, 136, 120] }
const PRETO: Pelo = { escuro: [50, 45, 42], meio: [80, 73, 68], claro: [112, 104, 97] }
/** O rabo pelado e as patas, a orelha por dentro e o olho. */
const RABO: Rgb = [146, 118, 108]
const RABO_ESCURO: Rgb = [112, 90, 82]
const PATA: Rgb = [162, 136, 124]
const ORELHA_POR_DENTRO: Rgb = [158, 128, 118]
const OLHO: Rgb = [42, 36, 33]

/** O chão visto de cima e um pouco de frente: o rato tem altura, então achata menos que as pedras. */
const ACHATA = 0.72
/** O meio do bando no quadro e o raio em que os ratos ficam. */
const MEIO_Y = -0.2
const RAIO_DO_BANDO = 0.26
/** O comprimento do corpo (unidades): um rato grande de masmorra, perto de um terço de casa com a cabeça. */
const CORPO = 0.27

/** A luz no plano (de cima à esquerda), a dos outros carimbos. */
const LUZ = { x: -0.6, y: -0.8 }

/** As poses: quanto o corpo estica, quanto a cabeça vira (rad) e a curva do rabo (rad por trecho; o sinal é sorteado). */
const POSES: readonly { readonly estica: number; readonly cabeca: number; readonly rabo: number }[] = [
  { estica: 1.14, cabeca: 0.08, rabo: 0.1 },
  { estica: 0.84, cabeca: 0.55, rabo: 0.5 },
  { estica: 0.98, cabeca: -0.42, rabo: 0.3 },
]
const TRECHOS_DO_RABO = 9

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
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

/**
 * Um rato no referencial dele: o focinho aponta para +x, a anca fica no -x, e
 * a origem é o meio do corpo. O claro do lombo anda para o lado da luz, que é
 * girada para esse referencial.
 */
function desenharRato(g: CanvasRenderingContext2D, r: Rato): void {
  const pose = POSES[r.pose]
  const c = CORPO * r.tamanho
  const meio = c * 0.5 * pose.estica
  const largo = c * 0.25 / Math.sqrt(pose.estica)
  g.save()
  g.translate(r.x, r.y)
  g.scale(1, ACHATA)
  g.rotate(r.rumo)
  // A luz no referencial do rato (a rotação ao contrário; o achatado mexe pouco e fica de fora).
  const lx = LUZ.x * Math.cos(r.rumo) + LUZ.y * Math.sin(r.rumo)
  const ly = -LUZ.x * Math.sin(r.rumo) + LUZ.y * Math.cos(r.rumo)

  // O rabo: sai da anca e afina até a ponta, em trechos cada vez mais finos.
  g.lineCap = 'round'
  let [tx, ty] = [-meio * 0.92, 0]
  let rumoDoRabo = Math.PI + r.lado * 0.15
  const trecho = (c * 0.95) / TRECHOS_DO_RABO
  for (let i = 0; i < TRECHOS_DO_RABO; i++) {
    const t = i / (TRECHOS_DO_RABO - 1)
    rumoDoRabo += r.lado * pose.rabo * (0.5 + 0.9 * t)
    const [nx, ny] = [tx + Math.cos(rumoDoRabo) * trecho, ty + Math.sin(rumoDoRabo) * trecho]
    g.strokeStyle = css(i % 3 === 2 ? RABO_ESCURO : RABO)
    g.lineWidth = c * (0.085 - 0.06 * t)
    g.beginPath()
    g.moveTo(tx, ty)
    g.lineTo(nx, ny)
    g.stroke()
    tx = nx
    ty = ny
  }

  // As patas: quatro pontinhas claras saindo de debaixo do corpo (as de trás mais compridas).
  for (const [px, py, comprida] of [[-0.5, 1, 1.5], [-0.5, -1, 1.5], [0.42, 1, 1], [0.42, -1, 1]] as const) {
    oval(g, meio * px + c * 0.05, largo * 0.92 * py, c * 0.06 * comprida, c * 0.034, py * 0.5, PATA)
  }

  // O corpo em gota: a anca larga atrás, os ombros estreitos na frente (duas ovais numa cor só).
  const [ancaX, ombroX] = [-meio * 0.34, meio * 0.36]
  oval(g, ancaX, 0, meio * 0.68, largo, 0, r.pelo.escuro)
  oval(g, ombroX, 0, meio * 0.62, largo * 0.8, 0, r.pelo.escuro)
  // O lombo no meio-tom e o claro do lado da luz.
  oval(g, ancaX + lx * c * 0.03, ly * c * 0.03, meio * 0.56, largo * 0.78, 0, r.pelo.meio)
  oval(g, ombroX + lx * c * 0.03, ly * c * 0.03, meio * 0.5, largo * 0.62, 0, r.pelo.meio)
  oval(g, ancaX + lx * c * 0.075, ly * largo * 0.42, meio * 0.34, largo * 0.36, 0, r.pelo.claro)
  oval(g, ombroX + lx * c * 0.06, ly * largo * 0.36, meio * 0.3, largo * 0.28, 0, r.pelo.claro)

  // A cabeça: gira no pescoço. A cunha do focinho, as orelhas atrás dela e os olhos.
  g.translate(meio * 0.78, 0)
  g.rotate(r.lado * pose.cabeca)
  const cab = c * 0.2
  for (const lado of [-1, 1]) {
    oval(g, -cab * 0.1, lado * cab * 0.62, cab * 0.34, cab * 0.3, 0, r.pelo.escuro)
    oval(g, -cab * 0.08, lado * cab * 0.64, cab * 0.2, cab * 0.17, 0, ORELHA_POR_DENTRO)
  }
  g.fillStyle = css(r.pelo.escuro)
  g.beginPath()
  g.moveTo(-cab * 0.5, -cab * 0.56)
  g.quadraticCurveTo(cab * 0.5, -cab * 0.56, cab * 1.34, -cab * 0.06)
  g.quadraticCurveTo(cab * 1.44, 0, cab * 1.34, cab * 0.06)
  g.quadraticCurveTo(cab * 0.5, cab * 0.56, -cab * 0.5, cab * 0.56)
  g.closePath()
  g.fill()
  // O alto da cabeça no meio-tom, puxado para a luz; o focinho fica escuro, com a ponta rosada.
  const lxc = lx * Math.cos(r.lado * pose.cabeca) + ly * Math.sin(r.lado * pose.cabeca)
  const lyc = -lx * Math.sin(r.lado * pose.cabeca) + ly * Math.cos(r.lado * pose.cabeca)
  oval(g, cab * 0.12 + lxc * cab * 0.1, lyc * cab * 0.12, cab * 0.56, cab * 0.36, 0, r.pelo.meio)
  oval(g, cab * 1.32, 0, cab * 0.1, cab * 0.08, 0, ORELHA_POR_DENTRO)
  for (const lado of [-1, 1]) oval(g, cab * 0.56, lado * cab * 0.25, cab * 0.085, cab * 0.07, 0, OLHO)
  g.restore()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const quantos = sorteio(semente, 1) < 0.45 ? 2 : 3
  const ratos: Rato[] = []
  for (let i = 0; i < quantos; i++) {
    // Em volta do meio, cada um no seu terço; correm em roda, um ou outro para fora.
    const a = giro + (i / quantos) * Math.PI * 2 + (sorteio(semente, 10 + i) - 0.5) * 0.9
    const rho = RAIO_DO_BANDO * (0.62 + 0.38 * sorteio(semente, 20 + i))
    const paraFora = sorteio(semente, 30 + i) < 0.3
    ratos.push({
      x: Math.cos(a) * rho,
      y: MEIO_Y + Math.sin(a) * rho * ACHATA,
      rumo: a + (paraFora ? 0 : Math.PI / 2) + (sorteio(semente, 40 + i) - 0.5) * 1.1,
      pose: (Math.floor(sorteio(semente, 50 + i) * POSES.length) + i) % POSES.length,
      pelo: i === 1 ? PRETO : PARDO,
      tamanho: 0.86 + 0.28 * sorteio(semente, 60 + i),
      lado: sorteio(semente, 70 + i) < 0.5 ? 1 : -1,
    })
  }
  ratos.sort((p, q) => p.y - q.y)
  for (const r of ratos) desenharRato(g, r)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'ratos', nome: 'Ratos', tamanho: 7, sombra: 'baixa', desenhar }

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [...[PARDO, PRETO].flatMap((p) => [p.escuro, p.meio, p.claro]), RABO, RABO_ESCURO, PATA, ORELHA_POR_DENTRO, OLHO]
