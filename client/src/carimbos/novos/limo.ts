import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Limo (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Esgotos): o LODO VERDE
 * que cresce onde o esgoto molha sempre, visto de cima. Não é poça nem musgo: é uma película GROSSA e brilhante,
 * espalhada em lóbulos moles com uma CAUDA para um lado (o rumo para onde ele escorre, que a semente e o giro mudam),
 * de onde saem dois ou três FIOS finos. Por baixo, o filme ralo e meio transparente, que mancha o chão um pouco além
 * da beira; no corpo, o verde-oliva molhado; no miolo, a parte mais grossa, mais escura e parda; a beira de baixo pega
 * a luz (é espessa, faz menisco). O que diz "molhado" são os BRILHOS em arco curto na beira de cima à esquerda de cada
 * lóbulo grande e as BOLHAS presas no miolo, espalhadas, cada uma com o anel fino e o ponto de luz. Na mesa, ao lado da Lama (parda e
 * redonda) e da Poça de esgoto (água com o reflexo do céu), ele é o único VERDE e o único de brilho miúdo.
 *
 * Fica rente ao chão: sem sombra, por baixo das sombras dos outros. A luz não gira.
 */

const FILME: Rgb = [58, 68, 40]
const CORPO: Rgb = [78, 94, 50]
const CORPO_CLARO: Rgb = [96, 112, 62]
const MIOLO: Rgb = [54, 62, 34]
const PARDO: Rgb = [70, 64, 40]
const BEIRA_DE_LUZ: Rgb = [128, 140, 92]
const BRILHO: Rgb = [184, 194, 160]
const BOLHA: Rgb = [44, 52, 30]

/** O chão visto de cima e um pouco de frente (o mesmo achatamento da Poça de esgoto e da Lama). */
const ACHATA = 0.55
const MEIO_Y = -0.02
const VOLTA = Math.PI * 2

type Mancha = readonly [number, number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

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

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // O rumo em que o limo escorre: a cauda e os fios vão para lá.
  const escorre = giro + sorteio(semente, 1) * VOLTA
  const [ex, ey] = [Math.cos(escorre), Math.sin(escorre)]

  // Os lóbulos: um miolo largo e cinco a sete em volta, mais compridos para o lado da cauda.
  const quantos = 5 + (semente % 3)
  const lobos: Mancha[] = [[-ex * 0.04, -ey * 0.04, 0.17]]
  for (let i = 0; i < quantos; i += 1) {
    const a = giro + (i * VOLTA) / quantos + (sorteio(semente, 10 + i) - 0.5) * 0.8
    const paraACauda = Math.max(0, Math.cos(a - escorre))
    const d = 0.11 + 0.08 * sorteio(semente, 20 + i) + 0.07 * paraACauda
    lobos.push([Math.cos(a) * d, Math.sin(a) * d, 0.085 + 0.05 * sorteio(semente, 30 + i)])
  }
  // A cauda: três gotas grandes que afinam no rumo em que escorre.
  for (let k = 1; k <= 3; k += 1) {
    lobos.push([ex * (0.15 + k * 0.075), ey * (0.15 + k * 0.075), 0.08 - k * 0.016])
  }

  // Os fios: dois ou três riscos finos que saem da beira e terminam numa gotinha.
  const fios: (readonly [number, number, number, number])[] = []
  const nFios = 2 + (semente % 2)
  for (let k = 0; k < nFios; k += 1) {
    const a = escorre + (k - (nFios - 1) / 2) * 0.55 + (sorteio(semente, 40 + k) - 0.5) * 0.3
    const de = 0.2 + 0.04 * sorteio(semente, 44 + k)
    const ate = de + 0.07 + 0.06 * sorteio(semente, 48 + k)
    fios.push([Math.cos(a) * de, Math.sin(a) * de, Math.cos(a) * ate, Math.sin(a) * ate])
  }

  // O filme ralo que mancha o chão além da beira, e os fios com a gotinha.
  manchas(g, lobos, 1.22, 0, 0.004, FILME, 0.32)
  g.strokeStyle = css(FILME, 0.6)
  g.lineCap = 'round'
  g.lineWidth = 0.016
  g.beginPath()
  for (const [x0, y0, x1, y1] of fios) {
    g.moveTo(x0, MEIO_Y + y0 * ACHATA)
    g.quadraticCurveTo((x0 + x1) / 2 + (y1 - y0) * 0.25, MEIO_Y + ((y0 + y1) / 2) * ACHATA, x1, MEIO_Y + y1 * ACHATA)
  }
  g.stroke()
  manchas(
    g,
    fios.map(([, , x1, y1]) => [x1, y1, 0.016] as const),
    1,
    0,
    0,
    CORPO,
    0.85,
  )

  // O corpo: a beira de baixo que pega luz (menisco), o verde molhado por cima e o miolo grosso, mais pardo.
  manchas(g, lobos, 1, 0.003, 0.006, BEIRA_DE_LUZ, 0.75)
  g.save()
  caminho(g, lobos, 1, 0.003, 0.006)
  g.clip()
  const alto = 0.3 * ACHATA
  const corpo = g.createLinearGradient(-ex * 0.2, MEIO_Y - alto, ex * 0.2, MEIO_Y + alto)
  corpo.addColorStop(0, css(CORPO))
  corpo.addColorStop(1, css(CORPO_CLARO))
  g.fillStyle = corpo
  caminho(g, lobos, 1, 0.003, -0.004)
  g.fill()
  const miolo: Mancha[] = lobos.slice(0, 3).map(([x, y, r]) => [x * 0.6 - ex * 0.02, y * 0.6 - ey * 0.02, r * 0.62] as const)
  manchas(g, miolo, 1, 0, -0.006, MIOLO, 0.62)
  manchas(g, miolo.slice(0, 1), 0.7, 0.01, -0.008, PARDO, 0.45)

  // As bolhas presas no miolo: espalhadas em volta (nunca duas lado a lado, que viram olhos), uma maior e as outras
  // miúdas, cada uma com o anel fino e o ponto de luz em cima à esquerda.
  const nBolhas = 2 + (semente % 3)
  const inicio = sorteio(semente, 59) * VOLTA
  for (let k = 0; k < nBolhas; k += 1) {
    const a = inicio + (k * VOLTA) / nBolhas + (sorteio(semente, 60 + k) - 0.5) * 0.6
    const d = 0.05 + 0.09 * sorteio(semente, 64 + k)
    const r = k === 0 ? 0.016 : 0.007 + 0.005 * sorteio(semente, 68 + k)
    const [x, y] = [Math.cos(a) * d, MEIO_Y + Math.sin(a) * d * ACHATA]
    g.strokeStyle = css(BOLHA, 0.55)
    g.lineWidth = 0.004
    g.beginPath()
    g.ellipse(x, y, r, r * (ACHATA + 0.15), 0, 0, VOLTA)
    g.stroke()
    g.fillStyle = css(BRILHO, 0.7)
    g.beginPath()
    g.ellipse(x - r * 0.35, y - r * 0.3, r * 0.32, r * 0.24, 0, 0, VOLTA)
    g.fill()
  }

  // Os brilhos do molhado: um arco curto na beira de cima à esquerda de cada lóbulo grande (o domo molhado pegando a
  // luz), acompanhando a curva dele: nada de risco reto, que vira chuva.
  g.strokeStyle = css(BRILHO, 0.42)
  g.lineCap = 'round'
  for (const [x, y, r] of lobos) {
    if (r < 0.1) continue
    g.lineWidth = r * 0.09
    g.beginPath()
    g.ellipse(x, MEIO_Y + y * ACHATA, r * 0.72, r * 0.72 * ACHATA, 0, Math.PI * 1.08, Math.PI * 1.42)
    g.stroke()
  }
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'limo', nome: 'Limo', tamanho: 10, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [FILME, CORPO, CORPO_CLARO, MIOLO, PARDO, BEIRA_DE_LUZ, BRILHO, BOLHA]
