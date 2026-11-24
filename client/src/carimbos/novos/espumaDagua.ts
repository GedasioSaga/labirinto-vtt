import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Espuma d'água (lote L08 de 24/11/2026, item 80: a mancha branca do pé das quedas dos mapas 2 e 6, desenho próprio).
 * Uma mancha de ESPUMA BRANCO-GELO (nunca branco puro) para pôr no pé de uma cachoeira, em volta de uma pedra no rio
 * ou onde a correnteza bate. Vista de cima e um pouco de frente: o VÉU ralo e transparente por baixo (a água mexida,
 * que deixa o rio aparecer); em cima dele o FERVEDOURO, um cacho de bolhas encostadas, cada uma com a sombra
 * azulada embaixo à direita e o brilho em cima à esquerda; e o RASTRO, bolhas miúdas e riscos finos que a corrente
 * leva embora e que somem.
 *
 * O GIRO ESCOLHE PARA ONDE A CORRENTE LEVA O RASTRO (sem giro, para a direita); a semente muda o cacho. Fica rente à
 * água: sem sombra, por baixo das sombras e dos outros objetos, como a poça e a vitória-régia. A luz não gira.
 */

const VEU: Rgb = [206, 224, 224]
const ESPUMA: Rgb = [226, 235, 231]
const ESPUMA_SOMBRA: Rgb = [176, 204, 210]
const BRILHO: Rgb = [240, 244, 242]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Uma bolha: o meio (já no quadro) e o raio. */
type Bolha = readonly [number, number, number]

/** O meio da mancha, o quanto a água achata (vista de cima e um pouco de frente) e a volta de ouro do cacho. */
const MEIO = { x: 0, y: -0.12 } as const
const ACHATA = 0.6
const ANGULO_DE_OURO = 2.39996
/** As bolhas são domos baixos: na tela, um pouco mais altas que a água achatada. */
const DOMO = 0.8

/** As bolhas (encolhidas e deslocadas) num caminho só: o preenchimento é a união delas. */
function camada(g: CanvasRenderingContext2D, lista: readonly Bolha[], encolhe: number, dx: number, dy: number, cor: Rgb, alfa = 1): void {
  if (lista.length === 0) return
  g.fillStyle = css(cor, alfa)
  g.beginPath()
  for (const [x, y, r] of lista) {
    const rr = r * encolhe
    const cx = x + dx * r
    const cy = y + dy * r
    g.moveTo(cx + rr, cy)
    g.ellipse(cx, cy, rr, rr * DOMO, 0, 0, Math.PI * 2)
  }
  g.fill()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // Para onde a corrente leva (na água achatada) e o de través.
  const vai = { x: Math.cos(giro), y: Math.sin(giro) }
  const naAgua = (aoLongo: number, deTraves: number): readonly [number, number] => [
    MEIO.x + vai.x * aoLongo - vai.y * deTraves,
    MEIO.y + (vai.y * aoLongo + vai.x * deTraves) * ACHATA,
  ]
  const rumo = Math.atan2(vai.y * ACHATA, vai.x)

  // O véu: três manchas ralas, compridas no rumo da corrente, que se somam no meio e somem na beira.
  const veus = [
    { ao: 0.02, rx: 0.52, ry: 0.33, alfa: 0.2 },
    { ao: -0.06, rx: 0.42, ry: 0.28, alfa: 0.26 },
    { ao: 0.22, rx: 0.36, ry: 0.16, alfa: 0.22 },
  ]
  veus.forEach((v, i) => {
    const [x, y] = naAgua(v.ao, (sorteio(semente, i) - 0.5) * 0.06)
    // A mancha comprida no rumo da corrente, achatada como a água (o raio ao longo e o de través, já na tela).
    g.fillStyle = css(VEU, v.alfa)
    g.beginPath()
    g.ellipse(x, y, v.rx * Math.hypot(vai.x, vai.y * ACHATA), v.ry * Math.hypot(vai.y, vai.x * ACHATA), rumo, 0, Math.PI * 2)
    g.fill()
  })

  // O fervedouro: o cacho de bolhas em espiral, as maiores no meio, do lado de onde a água vem.
  const cacho: Bolha[] = []
  const n = 26
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const rho = 0.3 * Math.sqrt(t) * (0.8 + 0.4 * sorteio(semente, 10 + i))
    const b = i * ANGULO_DE_OURO + semente
    const [x, y] = naAgua(-0.1 + Math.cos(b) * rho * 1.2, Math.sin(b) * rho)
    // As do meio maiores; para a beira o cacho rareia e a água aparece entre as bolhas.
    cacho.push([x, y, 0.062 * (1 - 0.5 * t) * (0.7 + 0.6 * sorteio(semente, 40 + i))])
  }
  // O rastro: bolhas miúdas que a corrente leva, cada vez menores e mais espalhadas.
  const rastro: Bolha[] = []
  for (let i = 0; i < 16; i++) {
    const t = (i + 0.5) / 16
    const [x, y] = naAgua(0.1 + 0.38 * t + (sorteio(semente, 70 + i) - 0.5) * 0.06, (sorteio(semente, 90 + i) - 0.5) * (0.3 - 0.1 * t))
    rastro.push([x, y, 0.036 * (1 - 0.55 * t) * (0.7 + 0.6 * sorteio(semente, 110 + i))])
  }

  // Os riscos finos de espuma que a corrente estica.
  g.strokeStyle = css(ESPUMA, 0.6)
  g.lineWidth = 0.016
  g.lineCap = 'round'
  g.beginPath()
  for (let i = 0; i < 4; i++) {
    const lado = (i - 1.5) * 0.085 + (sorteio(semente, 130 + i) - 0.5) * 0.03
    const de = naAgua(0.14 + 0.08 * sorteio(semente, 134 + i), lado)
    const meio = naAgua(0.32, lado * 1.25 + (sorteio(semente, 138 + i) - 0.5) * 0.05)
    const ate = naAgua(0.44 + 0.08 * sorteio(semente, 142 + i), lado * 1.1)
    g.moveTo(de[0], de[1])
    g.quadraticCurveTo(meio[0], meio[1], ate[0], ate[1])
  }
  g.stroke()

  // As bolhas em três camadas chapadas: a sombra azulada embaixo à direita, o corpo e o brilho em cima à esquerda.
  camada(g, cacho, 1.06, 0.14, 0.2, ESPUMA_SOMBRA)
  camada(g, rastro, 1.06, 0.14, 0.2, ESPUMA_SOMBRA, 0.8)
  camada(g, cacho, 1, 0, 0, ESPUMA)
  camada(g, rastro, 1, 0, 0, ESPUMA, 0.92)
  camada(
    g,
    cacho.filter(([, , r]) => r > 0.045),
    0.42,
    -0.26,
    -0.3,
    BRILHO,
  )
}

export const carimbo: DefinicaoDeCarimbo = { id: 'espuma-dagua', nome: "Espuma d'água", tamanho: 9, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [VEU, ESPUMA, ESPUMA_SOMBRA, BRILHO]
