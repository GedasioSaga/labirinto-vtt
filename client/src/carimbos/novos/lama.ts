import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Lama (item 131 dos carimbos de 14/11/2026): um lamaçal raso visto de cima.
 * A forma é torta, de lóbulos (não a elipse limpa da Poça), com a beira mais
 * seca e clara meio transparente (a lama rala que some no chão em volta), o
 * miolo molhado escuro, o fundo mais mole ainda mais escuro, uma ou duas
 * poças rasas de água barrenta (escuras no alto, claras embaixo, a beira de
 * baixo pegando luz e um reflexo de céu pequeno), o brilho
 * molhado em riscos curtos, uns torrões baixos, respingos fora da beira e,
 * na maioria, um rastro de pegadas atravessando (a pegada é um buraco: a
 * parede de cima à esquerda na sombra, a de baixo à direita pegando luz).
 * Fica rente ao chão: sem sombra, por baixo das sombras dos outros. O giro
 * gira os lóbulos, as poças, o rastro e os torrões; a luz não gira.
 */

const BEIRA_SECA: Rgb = [128, 104, 76]
const LAMA: Rgb = [96, 74, 54]
const LAMA_FUNDA: Rgb = [76, 60, 46]
const TORRAO: Rgb = [114, 90, 66]
const AGUA_FUNDA: Rgb = [62, 56, 46]
const AGUA_RASA: Rgb = [96, 90, 74]
const BEIRA_DA_POCA: Rgb = [126, 116, 92]
const REFLEXO: Rgb = [182, 190, 182]

/** O chão visto de cima e um pouco de frente. */
const ACHATA = 0.55
/** O meio do lamaçal no quadro. */
const MEIO_Y = -0.02

type Mancha = readonly [number, number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Várias manchas do chão (círculos no chão, elipses na tela) num caminho só: o preenchimento é a união delas. */
function caminhoDasManchas(g: CanvasRenderingContext2D, lista: readonly Mancha[], encolhe: number, dx: number, dy: number): void {
  g.beginPath()
  for (const [x, y, r] of lista) {
    const rx = r * encolhe
    g.moveTo(x + dx + rx, MEIO_Y + y * ACHATA + dy)
    g.ellipse(x + dx, MEIO_Y + y * ACHATA + dy, rx, rx * ACHATA, 0, 0, Math.PI * 2)
  }
}

function manchas(g: CanvasRenderingContext2D, lista: readonly Mancha[], encolhe: number, dx: number, dy: number, cor: Rgb, alfa = 1): void {
  g.fillStyle = css(cor, alfa)
  caminhoDasManchas(g, lista, encolhe, dx, dy)
  g.fill()
}

/** Uma pegada (a sola e o salto) virada para `a`, com o meio em (x, y) no chão; só o caminho, sem abrir nem preencher. */
function caminhoDaPegada(g: CanvasRenderingContext2D, x: number, y: number, a: number, dx: number, dy: number): void {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const giroNaTela = Math.atan2(s * ACHATA, c)
  const ao = Math.hypot(c, s * ACHATA)
  const deTraves = Math.hypot(s, c * ACHATA)
  for (const [adiante, comprido, largo] of [
    [0.032, 0.05, 0.028],
    [-0.05, 0.028, 0.022],
  ] as const) {
    const px = x + c * adiante + dx
    const py = MEIO_Y + (y + s * adiante) * ACHATA + dy
    const rx = comprido * ao
    const ry = largo * deTraves
    g.moveTo(px + Math.cos(giroNaTela) * rx, py + Math.sin(giroNaTela) * rx)
    g.ellipse(px, py, rx, ry, giroNaTela, 0, Math.PI * 2)
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // Os lóbulos, no chão (antes de achatar): oito em volta e um grande no meio.
  const lobos: Mancha[] = Array.from({ length: 8 }, (_, i) => {
    const a = giro + (i * Math.PI * 2) / 8 + (sorteio(semente, i) - 0.5) * 0.5
    const d = 0.22 * (0.75 + 0.5 * sorteio(semente, 10 + i))
    const r = 0.165 * (0.8 + 0.5 * sorteio(semente, 20 + i))
    return [Math.cos(a) * d, Math.sin(a) * d, r] as const
  })
  lobos.push([0, 0, 0.3])

  // Os respingos fora da beira (gotas soltas), sem passar do pé do quadro.
  const respingos: Mancha[] = Array.from({ length: 6 }, (_, i) => {
    const a = giro + 0.4 + (i * Math.PI * 2) / 6 + (sorteio(semente, 30 + i) - 0.5) * 0.8
    const d = Math.min(0.53 + 0.07 * sorteio(semente, 40 + i), 0.5 / Math.max(0.6, Math.abs(Math.sin(a))))
    return [Math.cos(a) * d, Math.sin(a) * d, 0.022 + 0.02 * sorteio(semente, 50 + i)] as const
  })

  manchas(g, [...lobos, ...respingos], 1, 0, 0, BEIRA_SECA, 0.78)
  manchas(g, lobos, 0.8, 0.004, 0.004, LAMA)
  // O fundo mais mole: o meio e dois lóbulos sorteados, puxados para dentro.
  const fundo: Mancha[] = [lobos[8], lobos[semente % 8], lobos[(semente + 3) % 8]].map(([x, y, r]) => [x * 0.6, y * 0.6, r] as const)
  manchas(g, fundo, 0.6, 0.004, 0.006, LAMA_FUNDA)

  // As poças rasas: cada uma é a união de duas manchas (beira torta). É um buraco com água, como
  // a Poça: escura no alto (a margem de cima faz sombra), clara embaixo, a beira de baixo pegando
  // luz e um reflexo de céu pequeno; o reflexo em faixa no alto fazia a poça parecer pedra.
  const quantasPocas = sorteio(semente, 60) < 0.55 ? 1 : 2
  for (let p = 0; p < quantasPocas; p++) {
    const [fx, fy, fr] = fundo[p]
    const a = giro * 1.3 + p * 2.1
    const r = fr * (p === 0 ? 0.42 : 0.5) * (0.9 + 0.2 * sorteio(semente, 61 + p))
    const poca: Mancha[] = [
      [fx + Math.cos(a) * r * 0.35, fy + Math.sin(a) * r * 0.35, r],
      [fx - Math.cos(a) * r * 0.45, fy - Math.sin(a) * r * 0.45, r * 0.72],
    ]
    const cy = MEIO_Y + fy * ACHATA
    manchas(g, poca, 1, 0.003, 0.004, BEIRA_DA_POCA)
    g.save()
    caminhoDasManchas(g, poca, 1, 0.003, 0.004)
    g.clip()
    const agua = g.createLinearGradient(0, cy - r * ACHATA, 0, cy + r * ACHATA)
    agua.addColorStop(0, css(AGUA_FUNDA))
    agua.addColorStop(1, css(AGUA_RASA))
    g.fillStyle = agua
    caminhoDasManchas(g, poca, 1, 0.003, -0.006)
    g.fill()
    g.fillStyle = css(REFLEXO, 0.45)
    g.beginPath()
    g.ellipse(fx - r * 0.35, cy - r * 0.12 * ACHATA, r * 0.38, r * 0.1, -0.1, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }

  // O brilho molhado da lama: riscos curtos e mansos.
  g.fillStyle = css(REFLEXO, 0.22)
  g.beginPath()
  for (let i = 0; i < 4; i++) {
    const a = giro + 0.5 + i * 1.7 + sorteio(semente, 100 + i)
    const d = 0.12 + 0.18 * sorteio(semente, 104 + i)
    const x = Math.cos(a) * d
    const y = MEIO_Y + Math.sin(a) * d * ACHATA
    const rx = 0.04 + 0.03 * sorteio(semente, 108 + i)
    g.moveTo(x + rx, y)
    g.ellipse(x, y, rx, 0.009, -0.1, 0, Math.PI * 2)
  }
  g.fill()

  // Os torrões: montinhos baixos no miolo, sem brilho de pedra.
  const torroes: Mancha[] = Array.from({ length: 4 }, (_, i) => {
    const a = giro + 0.9 + i * 2.39996 + sorteio(semente, 70 + i)
    const d = 0.14 + 0.22 * sorteio(semente, 80 + i)
    return [Math.cos(a) * d, Math.sin(a) * d, 0.02 + 0.012 * sorteio(semente, 90 + i)] as const
  })
  manchas(g, torroes, 1, 0.006, 0.006, LAMA_FUNDA)
  manchas(g, torroes, 0.75, -0.004, -0.004, TORRAO)

  // O rastro: três pegadas atravessando o lamaçal (na maioria dos desenhos).
  if (sorteio(semente, 120) < 0.7) {
    const a = giro + 0.7 + (sorteio(semente, 121) - 0.5) * 0.6
    const c = Math.cos(a)
    const s = Math.sin(a)
    for (const [cor, dx, dy] of [
      [BEIRA_SECA, 0.006, 0.006],
      [LAMA_FUNDA, -0.002, -0.002],
    ] as const) {
      g.fillStyle = css(cor)
      g.beginPath()
      for (let k = 0; k < 3; k++) {
        const t = -0.24 + k * 0.21
        const lado = k % 2 === 0 ? 1 : -1
        caminhoDaPegada(g, c * t - s * 0.045 * lado, s * t + c * 0.045 * lado, a, dx, dy)
      }
      g.fill()
    }
  }
}

export const carimbo: DefinicaoDeCarimbo = { id: 'lama', nome: 'Lama', tamanho: 12, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [BEIRA_SECA, LAMA, LAMA_FUNDA, TORRAO, AGUA_FUNDA, AGUA_RASA, BEIRA_DA_POCA, REFLEXO]
