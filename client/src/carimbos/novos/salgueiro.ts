import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Salgueiro-chorão (item 117 dos carimbos de 14/11/2026): a copa que CAI. Os
 * ramos pendem em franjas, andar sobre andar, do alto até perto do chão,
 * como uma saia em camadas: cada andar é uma roda de línguas compridas de
 * ponta fina, as do alto mais curtas e mais claras (a luz vem de cima), as de
 * baixo compridas formando a cortina, com o escuro de dentro aparecendo entre
 * elas e o pé do tronco embaixo da barra. O verde é mais amarelado e claro
 * que o da mata. O giro balança as franjas e troca o comprimento de cada fio;
 * a árvore só INCLINA de leve. A luz não gira: os fios da esquerda claros,
 * os da direita no escuro.
 */

const TRONCO: Rgb = [100, 80, 58]
const TRONCO_SOMBRA: Rgb = [68, 54, 42]
/** O escuro de dentro da cortina: aparece entre os fios e na barra. */
const DENTRO: Rgb = [46, 84, 62]
const ESCURO: Rgb = [70, 114, 74]
const MEDIO: Rgb = [104, 146, 86]
const CLARO: Rgb = [146, 178, 104]
const BRILHO: Rgb = [184, 204, 136]
/** Do escuro ao claro: o tom de cada fio sai daqui pelo andar e pelo lado da luz. */
const TONS: readonly Rgb[] = [DENTRO, misturar(DENTRO, ESCURO, 0.5), ESCURO, MEDIO, CLARO, BRILHO]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

interface Andar {
  /** O meio da roda de onde os fios pendem, e os meio-eixos dela. */
  y: number
  rx: number
  ry: number
  /** Comprimento médio dos fios do andar. */
  comprido: number
  fios: number
  /** O tom de partida do andar em `TONS` (o de baixo é o mais escuro). */
  tom: number
}

/** A cortina embaixo e três andares de franja até o alto. */
const ANDARES: readonly Andar[] = [
  { y: -0.6, rx: 0.42, ry: 0.15, comprido: 0.36, fios: 16, tom: 1.5 },
  { y: -0.72, rx: 0.37, ry: 0.13, comprido: 0.28, fios: 13, tom: 2.2 },
  { y: -0.83, rx: 0.29, ry: 0.105, comprido: 0.21, fios: 10, tom: 2.9 },
  { y: -0.92, rx: 0.18, ry: 0.07, comprido: 0.15, fios: 7, tom: 3.5 },
]

/** Uma língua de ramos no caminho atual: larga em cima, ponta embaixo. */
function lingua(g: CanvasRenderingContext2D, x: number, topo: number, largura: number, pontaX: number, pontaY: number): void {
  const meio = topo + (pontaY - topo) * 0.55
  g.moveTo(x - largura, topo)
  g.quadraticCurveTo(x - largura * 0.95 + (pontaX - x) * 0.4, meio, pontaX, pontaY)
  g.quadraticCurveTo(x + largura * 0.95 + (pontaX - x) * 0.4, meio, x + largura, topo)
  g.closePath()
}

function desenharAndar(g: CanvasRenderingContext2D, andar: Andar, k: number, giro: number, semente: number, vento: number): void {
  // A roda do andar (o que fica entre os fios dele e os do andar de cima).
  g.fillStyle = css(TONS[Math.floor(andar.tom)])
  g.beginPath()
  g.ellipse(0, andar.y, andar.rx * 0.96, andar.ry * 1.1, 0, 0, Math.PI * 2)
  g.fill()
  // Os fios: em volta da frente da roda (um pouco além dos lados), agrupados
  // pelo tom num caminho só por tom.
  const porTom: Array<Array<() => void>> = TONS.map(() => [])
  for (let j = 0; j < andar.fios; j++) {
    const angulo = -0.22 + ((Math.PI + 0.44) * (j + 0.5)) / andar.fios + (sorteio(semente, 10 * k + j) - 0.5) * 0.14
    const x = -Math.cos(angulo) * andar.rx
    const topo = andar.y + Math.sin(angulo) * andar.ry
    const comprido = andar.comprido * (0.8 + 0.35 * sorteio(semente, 50 + 10 * k + j)) * (0.93 + 0.07 * Math.sin(giro * 2 + j * 1.3 + k))
    const lado = x < -andar.rx * 0.35 ? 1.3 : x < andar.rx * 0.25 ? 0.7 : 0
    const tom = Math.min(TONS.length - 1, Math.max(0, Math.round(andar.tom + lado + (j % 2 === 0 ? -0.2 : 0.3))))
    const largura = 0.033 + 0.01 * sorteio(semente, 90 + 10 * k + j)
    porTom[tom].push(() => lingua(g, x, topo, largura, x * 1.04 + vento * (0.6 + Math.sin(angulo) * 0.4), topo + comprido))
  }
  porTom.forEach((fios, tom) => {
    if (fios.length === 0) return
    g.fillStyle = css(TONS[tom])
    g.beginPath()
    for (const fio of fios) fio()
    g.fill()
  })
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.save()
  g.rotate(Math.sin(giro) * 0.04)
  const vento = Math.cos(giro) * 0.035

  // O pé do tronco: só aparece embaixo da barra da cortina.
  g.fillStyle = css(TRONCO)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(-0.11, 0.03)
  g.quadraticCurveTo(-0.05, 0.0, -0.05, -0.12)
  g.lineTo(-0.04, -0.36)
  g.lineTo(0, -0.36)
  g.closePath()
  g.fill()
  g.fillStyle = css(TRONCO_SOMBRA)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(0, -0.36)
  g.lineTo(0.045, -0.36)
  g.lineTo(0.05, -0.12)
  g.quadraticCurveTo(0.055, 0.0, 0.1 + 0.03 * sorteio(semente, 1), 0.035)
  g.closePath()
  g.fill()

  // A cortina de trás, no escuro de dentro: a barra em pontas, mais baixa no
  // meio (a frente da cortina está mais perto de quem vê).
  const pontas = 10
  const barra = (k: number) => {
    const t = k / (pontas - 1)
    return {
      x: -0.45 + 0.9 * t + vento * (0.6 + 0.4 * Math.sin(t * Math.PI)),
      y: -0.17 + 0.05 * Math.sin(t * Math.PI) - 0.07 * sorteio(semente, 20 + k),
    }
  }
  g.fillStyle = css(DENTRO)
  g.beginPath()
  g.moveTo(-0.4, -0.64)
  g.quadraticCurveTo(-0.48, -0.42, barra(0).x, barra(0).y)
  for (let k = 1; k < pontas; k++) {
    const a = barra(k - 1)
    const b = barra(k)
    g.lineTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 0.1)
    g.lineTo(b.x, b.y)
  }
  g.quadraticCurveTo(0.48, -0.42, 0.4, -0.64)
  g.closePath()
  g.fill()

  // Os andares de franja, de baixo para cima: cada um tampa o pé dos fios do de baixo.
  ANDARES.forEach((andar, k) => desenharAndar(g, andar, k, giro, semente, vento))
  // O cocuruto: a roda clara do alto, de onde tudo pende.
  g.fillStyle = css(CLARO)
  g.beginPath()
  g.ellipse(-0.015, -0.93, 0.085, 0.042, 0, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'salgueiro', nome: 'Salgueiro-chorão', tamanho: 16, sombra: 'em-pe', desenhar }

export const paleta: readonly Rgb[] = [TRONCO, TRONCO_SOMBRA, ...TONS]
