import { css, type Rgb } from '../embutidos'

/**
 * O desenho do IPÊ florido (item 120 dos carimbos de 14/11/2026), dividido
 * pelo ipê amarelo e pelo ipê roxo (`ipeAmarelo.ts`, `ipeRoxo.ts`): só muda
 * a cor da flor. Não exporta `carimbo`: é o ajudante dos dois.
 *
 * Na florada o ipê está SEM FOLHA: a copa é feita só de cachos de flor,
 * soltos, nas pontas dos galhos que sobem do tronco em vaso; entre os
 * cachos aparecem os galhos escuros. Embaixo, o TAPETE de flores caídas no
 * chão, que é o que todo mundo lembra do ipê. Os cachos são de bolinhas
 * miúdas (flor), não os lóbulos grandes da copa de folha. O giro gira os
 * braços em volta do tronco (os de trás ficam atrás dos galhos); a árvore só
 * inclina de leve. A luz não gira: o lado de cima à esquerda de cada cacho
 * claro, o tronco com a metade da direita na sombra.
 */

export interface TonsDoIpe {
  escuro: Rgb
  medio: Rgb
  claro: Rgb
}

const CASCA: Rgb = [108, 94, 82]
const CASCA_SOMBRA: Rgb = [74, 64, 58]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

type Circulo = [number, number, number]

function circulos(g: CanvasRenderingContext2D, lista: ReadonlyArray<readonly [number, number, number]>): void {
  g.beginPath()
  for (const [x, y, r] of lista) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  g.fill()
}

interface Cacho {
  x: number
  y: number
  r: number
  /** Para trás (negativo) ou para a frente do tronco. */
  fundo: number
}

const FORQUILHA = { x: 0, y: -0.3 } as const

/** Um galho que afina da forquilha até a ponta, subindo em vaso. */
function galho(g: CanvasRenderingContext2D, ponta: { x: number; y: number }, grosso: number, fino: number): void {
  const de = FORQUILHA
  const curva = { x: de.x + (ponta.x - de.x) * 0.72, y: de.y + (ponta.y - de.y) * 0.25 - 0.04 }
  const dx = ponta.x - de.x
  const dy = ponta.y - de.y
  const n = Math.hypot(dx, dy) || 1
  const nx = -dy / n
  const ny = dx / n
  const meio = (grosso + fino) / 2
  g.fillStyle = css(ponta.x < -0.05 ? CASCA : CASCA_SOMBRA)
  g.beginPath()
  g.moveTo(de.x + nx * grosso, de.y + ny * grosso)
  g.quadraticCurveTo(curva.x + nx * meio, curva.y + ny * meio, ponta.x + nx * fino, ponta.y + ny * fino)
  g.lineTo(ponta.x - nx * fino, ponta.y - ny * fino)
  g.quadraticCurveTo(curva.x - nx * meio, curva.y - ny * meio, de.x - nx * grosso, de.y - ny * grosso)
  g.closePath()
  g.fill()
}

/** As bolinhas de um cacho: uma no meio e seis em volta, o contorno girado. */
function bolinhas(c: Cacho, giro: number, semente: number, i: number): Circulo[] {
  const lista: Circulo[] = [[c.x, c.y, c.r * 0.58]]
  for (let j = 0; j < 6; j++) {
    const a = giro * 1.3 + i * 0.9 + (j * Math.PI) / 3 + (sorteio(semente, 300 + i * 7 + j) - 0.5) * 0.5
    const d = c.r * (0.52 + 0.12 * sorteio(semente, 400 + i * 7 + j))
    lista.push([c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.85, c.r * (0.4 + 0.12 * sorteio(semente, 500 + i * 7 + j))])
  }
  return lista
}

/** Os cachos de um lado (de trás ou da frente) em três camadas chapadas. */
function desenharCachos(g: CanvasRenderingContext2D, cachos: ReadonlyArray<Cacho & { i: number }>, giro: number, semente: number, tons: TonsDoIpe): void {
  if (cachos.length === 0) return
  const todas = cachos.map((c) => bolinhas(c, giro, semente, c.i))
  g.fillStyle = css(tons.escuro)
  circulos(g, todas.flat().map(([x, y, r]) => [x + 0.01, y + 0.014, r] as Circulo))
  g.fillStyle = css(tons.medio)
  circulos(g, todas.flat().map(([x, y, r]) => [x - 0.008, y - 0.012, r * 0.82] as Circulo))
  // A luz: florzinhas claras no alto à esquerda de cada cacho.
  g.fillStyle = css(tons.claro)
  circulos(
    g,
    cachos.flatMap((c) => [
      [c.x - c.r * 0.38, c.y - c.r * 0.4, c.r * 0.26] as Circulo,
      [c.x - c.r * 0.02, c.y - c.r * 0.55, c.r * 0.19] as Circulo,
      [c.x - c.r * 0.6, c.y - c.r * 0.02, c.r * 0.17] as Circulo,
    ]),
  )
}

export function desenharIpe(g: CanvasRenderingContext2D, giro: number, semente: number, tons: TonsDoIpe): void {
  // O tapete de flores caídas em volta do pé, mais cheio perto do tronco.
  const petalas: Circulo[] = []
  for (let i = 0; i < 20; i++) {
    const a = sorteio(semente, 200 + i) * Math.PI * 2 + giro
    const d = Math.sqrt(sorteio(semente, 230 + i))
    petalas.push([0.04 + Math.cos(a) * 0.42 * d, 0.035 + Math.sin(a) * 0.12 * d, 0.014 + 0.012 * sorteio(semente, 260 + i)])
  }
  // O chão coberto: uma mancha rala da cor da flor, e as flores soltas por cima.
  g.fillStyle = css(tons.medio, 0.32)
  g.beginPath()
  g.ellipse(0.04, 0.035, 0.36, 0.1, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(tons.medio)
  circulos(g, petalas.slice(0, 12))
  g.fillStyle = css(tons.claro)
  circulos(g, petalas.slice(12))

  g.save()
  g.rotate(Math.sin(giro) * 0.04)
  // Os braços em volta do tronco; entre um e outro, um cacho menor mais baixo; e um no alto.
  const bracos = Array.from({ length: 4 }, (_, k) => {
    const a = giro + (k * Math.PI) / 2 + (sorteio(semente, k) - 0.5) * 0.6
    const alcance = 0.3 + 0.08 * sorteio(semente, 10 + k)
    const alto = 0.6 + 0.12 * sorteio(semente, 20 + k)
    return { a, x: Math.cos(a) * alcance, y: -alto + Math.sin(a) * alcance * 0.42 }
  })
  const cachos: Array<Cacho & { i: number }> = bracos.map((b, k) => ({ x: b.x, y: b.y, r: 0.14 + 0.025 * sorteio(semente, 30 + k), fundo: Math.sin(b.a), i: k }))
  bracos.forEach((b, k) => {
    const a = b.a + Math.PI / 4
    cachos.push({ x: Math.cos(a) * 0.2, y: -0.55 + Math.sin(a) * 0.09, r: 0.1 + 0.02 * sorteio(semente, 40 + k), fundo: Math.sin(a), i: 4 + k })
  })
  cachos.push({ x: (sorteio(semente, 50) - 0.5) * 0.1, y: -0.86, r: 0.13, fundo: -0.2, i: 8 })

  const atras = cachos.filter((c) => c.fundo < 0).sort((a, b) => a.y - b.y)
  const frente = cachos.filter((c) => c.fundo >= 0).sort((a, b) => a.y - b.y)
  // Os galhos dos cachos de trás entram neles: vão antes dos cachos.
  bracos.forEach((b, k) => {
    if (cachos[k].fundo < 0) galho(g, b, 0.026, 0.008)
  })
  galho(g, { x: cachos[8].x, y: cachos[8].y + 0.04 }, 0.02, 0.007)
  desenharCachos(g, atras, giro, semente, tons)

  // O tronco até a forquilha (metade da luz e metade da sombra) e os galhos.
  g.fillStyle = css(CASCA)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(-0.09, 0.03)
  g.quadraticCurveTo(-0.042, 0.0, -0.038, -0.1)
  g.lineTo(-0.028, FORQUILHA.y)
  g.lineTo(0, FORQUILHA.y - 0.02)
  g.closePath()
  g.fill()
  g.fillStyle = css(CASCA_SOMBRA)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(0, FORQUILHA.y - 0.02)
  g.lineTo(0.028, FORQUILHA.y)
  g.lineTo(0.038, -0.1)
  g.quadraticCurveTo(0.045, 0.0, 0.1, 0.032)
  g.closePath()
  g.fill()
  bracos.forEach((b, k) => {
    if (cachos[k].fundo >= 0) galho(g, b, 0.026, 0.008)
  })

  desenharCachos(g, frente, giro, semente, tons)
  g.restore()
}

/** As cores do ipê de um tom: a casca e as da flor. */
export function paletaDoIpe(tons: TonsDoIpe): readonly Rgb[] {
  return [CASCA, CASCA_SOMBRA, tons.escuro, tons.medio, tons.claro]
}
