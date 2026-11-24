import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Poça de esgoto (lote L11 de 24/11/2026, "Arena e cortiço"; versão da Poça, carimbo novo: a Poça de sempre não
 * muda). A água parada e suja do beco, vista de cima: a forma é torta, de lóbulos (a semente muda o contorno, o
 * giro vira os lóbulos), com a terra encharcada e escura em volta, meio transparente, e uns respingos fora da
 * beira. A água é escura, parda esverdeada: mais funda no alto (a margem de cima faz sombra nela), mais clara
 * embaixo, com a beira de baixo pegando luz. Por cima dela, a NATA de lodo verde-oliva encostada num lado, a
 * mancha de gordura comprida e apagada, um reflexo de céu pequeno e a ESPUMA SUJA: uma jangada de bolhas
 * amareladas encostada na beira para onde a água escorre, outra menor do lado oposto e bolhas soltas no meio,
 * cada bolha com o anel sujo e o miolo claro. Dois ciscos boiando.
 *
 * Fica rente ao chão: sem sombra, por baixo das sombras dos outros. A luz não gira.
 */

const TERRA_MOLHADA: Rgb = [70, 64, 52]
const BEIRA_DE_LUZ: Rgb = [128, 132, 108]
const AGUA_FUNDA: Rgb = [48, 56, 46]
const AGUA_RASA: Rgb = [98, 104, 78]
const LODO: Rgb = [70, 82, 50]
const GORDURA: Rgb = [116, 108, 118]
const REFLEXO: Rgb = [150, 160, 148]
const ESPUMA_SUJA: Rgb = [136, 128, 104]
const ESPUMA: Rgb = [188, 182, 160]
const CISCO: Rgb = [98, 80, 58]

/** O chão visto de cima e um pouco de frente. */
const ACHATA = 0.55
/** O meio da poça no quadro. */
const MEIO_Y = -0.02
const VOLTA = Math.PI * 2

type Mancha = readonly [number, number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Várias manchas do chão (círculos no chão, elipses na tela) num caminho só: o preenchimento é a união delas. */
function caminho(g: CanvasRenderingContext2D, lista: readonly Mancha[], encolhe: number, dx: number, dy: number): void {
  g.beginPath()
  for (const [x, y, r] of lista) {
    const rx = r * encolhe
    g.moveTo(x + dx + rx, MEIO_Y + y * ACHATA + dy)
    g.ellipse(x + dx, MEIO_Y + y * ACHATA + dy, rx, rx * ACHATA, 0, 0, VOLTA)
  }
}

function manchas(g: CanvasRenderingContext2D, lista: readonly Mancha[], encolhe: number, dx: number, dy: number, cor: Rgb, alfa = 1): void {
  g.fillStyle = css(cor, alfa)
  caminho(g, lista, encolhe, dx, dy)
  g.fill()
}

/** Uma jangada de espuma: bolhas grudadas em volta de (x, y) no chão, as maiores no meio. */
function jangada(semente: number, sal: number, x: number, y: number, raio: number, quantas: number): Mancha[] {
  return Array.from({ length: quantas }, (_, i) => {
    const a = sorteio(semente, sal + i) * VOLTA
    const d = raio * Math.sqrt(sorteio(semente, sal + 20 + i)) * 0.9
    return [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, raio * (0.2 + 0.3 * sorteio(semente, sal + 40 + i)) * (1 - (0.5 * d) / raio)] as const
  })
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // Os lóbulos, no chão (antes de achatar): de oito a dez em volta de um miolo grande, cada um do seu tamanho. São
  // muitos e pequenos perto do miolo: a beira sai torta sem virar nuvem.
  const quantos = 8 + (semente % 3)
  const lobos: Mancha[] = Array.from({ length: quantos }, (_, i) => {
    const a = giro + (i * VOLTA) / quantos + (sorteio(semente, i) - 0.5) * 0.6
    const d = 0.22 * (0.72 + 0.5 * sorteio(semente, 10 + i))
    return [Math.cos(a) * d * 1.3, Math.sin(a) * d, 0.125 * (0.75 + 0.5 * sorteio(semente, 20 + i))] as const
  })
  lobos.push([0, 0, 0.3], [0.1 * Math.cos(giro), 0.06 * Math.sin(giro), 0.27])

  // Os respingos fora da beira (só terra molhada, sem água), sem passar do pé do quadro.
  const respingos: Mancha[] = Array.from({ length: 4 }, (_, i) => {
    const a = giro + 0.9 + (i * VOLTA) / 4 + (sorteio(semente, 30 + i) - 0.5) * 0.9
    const d = Math.min(0.52 + 0.07 * sorteio(semente, 40 + i), 0.48 / Math.max(0.6, Math.abs(Math.sin(a))))
    return [Math.cos(a) * d, Math.sin(a) * d, 0.014 + 0.014 * sorteio(semente, 50 + i)] as const
  })

  // A terra encharcada em volta, a beira que pega luz e a água por cima (subida um nada: a beira de baixo fica acesa).
  manchas(g, lobos, 1.16, 0, 0.004, TERRA_MOLHADA, 0.45)
  manchas(g, respingos, 1, 0, 0, TERRA_MOLHADA, 0.6)
  manchas(g, lobos, 1.05, 0, 0.006, TERRA_MOLHADA, 0.8)
  manchas(g, lobos, 1, 0.003, 0.007, BEIRA_DE_LUZ, 0.9)
  g.save()
  caminho(g, lobos, 1, 0.003, 0.007)
  g.clip()
  const alto = 0.4 * ACHATA
  const agua = g.createLinearGradient(0, MEIO_Y - alto, 0, MEIO_Y + alto)
  agua.addColorStop(0, css(AGUA_FUNDA))
  agua.addColorStop(1, css(AGUA_RASA))
  g.fillStyle = agua
  caminho(g, lobos, 1, 0.003, -0.009)
  g.fill()

  // A nata de lodo: encostada no lado de onde a água não corre, em dois lóbulos puxados para dentro.
  const escorre = giro * 1.3 + sorteio(semente, 60) * VOLTA
  const [ex, ey] = [Math.cos(escorre), Math.sin(escorre)]
  const nata: Mancha[] = [0, 1, 2].map((i) => {
    const [x, y, r] = lobos[(semente + i * 2) % quantos]
    return [x * 0.86 - ex * 0.05, y * 0.86 - ey * 0.05, r * 0.82] as const
  })
  manchas(g, nata, 1, 0.003, -0.004, LODO, 0.5)
  manchas(g, nata, 0.62, -0.004, -0.008, LODO, 0.45)

  // A gordura (uma nódoa larga e apagada, deitada, na maioria) e o reflexo pequeno do céu.
  if (sorteio(semente, 61) < 0.75) {
    g.fillStyle = css(GORDURA, 0.26)
    g.beginPath()
    g.ellipse(-ex * 0.1 + 0.02, MEIO_Y - ey * 0.05 + 0.03, 0.15, 0.034, 0.06, 0, VOLTA)
    g.fill()
  }
  g.fillStyle = css(REFLEXO, 0.3)
  g.beginPath()
  g.ellipse(-0.14, MEIO_Y - 0.05, 0.075, 0.016, -0.08, 0, VOLTA)
  g.fill()
  g.restore()

  // A ESPUMA SUJA: a jangada maior na beira para onde a água escorre, a menor do outro lado e as bolhas soltas.
  const maior = jangada(semente, 70, ex * 0.27, ey * 0.2, 0.15, 17)
  const menor = jangada(semente, 140, -ex * 0.2 + ey * 0.1, -ey * 0.16 - ex * 0.06, 0.085, 8)
  const soltasNoMeio: Mancha[] = Array.from({ length: 4 }, (_, i) => {
    const a = escorre + 0.8 + i * 1.9 + sorteio(semente, 200 + i)
    const d = 0.06 + 0.12 * sorteio(semente, 204 + i)
    return [Math.cos(a) * d, Math.sin(a) * d, 0.016 + 0.014 * sorteio(semente, 208 + i)] as const
  })
  const bolhas = [...maior, ...menor, ...soltasNoMeio]
  // O anel sujo de cada bolha (a união delas é a mancha da jangada) e o miolo claro, puxado para a luz.
  manchas(g, bolhas, 1.12, 0.003, 0.004, AGUA_FUNDA, 0.4)
  manchas(g, bolhas, 1, 0, 0, ESPUMA_SUJA)
  g.fillStyle = css(ESPUMA)
  g.beginPath()
  for (const [x, y, r] of bolhas) {
    const rx = r * 0.66
    g.moveTo(x - r * 0.16 + rx, MEIO_Y + y * ACHATA - r * 0.14)
    g.ellipse(x - r * 0.16, MEIO_Y + y * ACHATA - r * 0.14, rx, rx * (ACHATA + 0.12), 0, 0, VOLTA)
  }
  g.fill()

  // Os ciscos: dois gravetos curtos boiando.
  g.strokeStyle = css(CISCO)
  g.lineCap = 'round'
  g.lineWidth = 0.014
  g.beginPath()
  for (let i = 0; i < 2; i += 1) {
    const a = escorre + 2.6 + i * 2.2 + sorteio(semente, 220 + i)
    const d = 0.1 + 0.1 * sorteio(semente, 222 + i)
    const [x, y] = [Math.cos(a) * d, MEIO_Y + Math.sin(a) * d * ACHATA]
    const rumo = giro + sorteio(semente, 224 + i) * 3
    g.moveTo(x - Math.cos(rumo) * 0.035, y - Math.sin(rumo) * 0.035 * ACHATA)
    g.lineTo(x + Math.cos(rumo) * 0.035, y + Math.sin(rumo) * 0.035 * ACHATA)
  }
  g.stroke()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'poca-de-esgoto', nome: 'Poça de esgoto', tamanho: 12, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [TERRA_MOLHADA, BEIRA_DE_LUZ, AGUA_FUNDA, AGUA_RASA, LODO, GORDURA, REFLEXO, ESPUMA_SUJA, ESPUMA, CISCO]
