import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Monte de neve (item 141 dos carimbos de 14/11/2026): a neve que o vento
 * juntou num monte comprido e baixo, de lombo macio. Visto de cima e um pouco
 * de frente. O monte é UM lombo comprido deitado no chão, em três andares (o
 * pé, o meio e a crista), de beira que ondula devagar, com um calombo
 * encavalado numa ponta, um pequeno na outra e às vezes uma bola solta do
 * lado; nunca uma fila de bolas (bola branca com borda azulada vira nuvem)
 * nem um prato de neve rala em volta (vira travesseiro num pires). A luz
 * não faz borda em volta: o lado de cima à esquerda é branco até a beira, e
 * a sombra azulada é só o crescente de baixo à direita, em dois passos; o
 * lombo claro corre pela crista. Às vezes umas hastes secas de capim furam a
 * neve, ou uma pedra aparece na beira: dão o tamanho e dizem que é monte de
 * neve, não pedra branca. O giro gira o lombo no chão; a luz não gira.
 *
 * Os brancos são os do pinheiro com neve (`embutidos.ts`), com um tom de
 * sombra a mais, mais fundo, para o monte ler em cima do chão claro.
 */

const NEVE_FUNDA: Rgb = [158, 176, 196]
const NEVE_SOMBRA: Rgb = [188, 202, 214]
const NEVE: Rgb = [222, 230, 238]
const NEVE_CLARA: Rgb = [240, 243, 245]
const CAPIM_SECO: Rgb = [128, 110, 80]
const PEDRA: Rgb = [116, 112, 108]
const PEDRA_CLARA: Rgb = [156, 152, 146]

/** O chão visto de cima e um pouco de frente. */
const ACHATA = 0.55
/** O meio do monte no quadro. */
const MEIO_Y = -0.12

/** Pontos de cada elipse deitada no chão (o chão achatado não deixa usar `ellipse` girada direto). */
const VOLTA = 22

type Ponto = readonly [number, number]
type Poligono = readonly Ponto[]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Vários polígonos num caminho só (a união deles: todos dão a volta no mesmo sentido), deslocados por (dx, dy). */
function caminhoDePoligonos(g: CanvasRenderingContext2D, lista: readonly Poligono[], dx = 0, dy = 0): void {
  g.beginPath()
  for (const pontos of lista) {
    pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x + dx, y + dy) : g.lineTo(x + dx, y + dy)))
    g.closePath()
  }
}

function pintar(g: CanvasRenderingContext2D, lista: readonly Poligono[], cor: Rgb, dx = 0, dy = 0): void {
  g.fillStyle = css(cor)
  caminhoDePoligonos(g, lista, dx, dy)
  g.fill()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const noChao = (u: number, v: number): Ponto => [u * c - v * s, MEIO_Y + (u * s + v * c) * ACHATA]

  // Uma elipse deitada no chão (u ao longo do giro, v de través), subida `alto`
  // acima dele; a beira ondula devagar (a neve não tem borda de régua nem de nuvem).
  const noChaoElipse = (u0: number, v0: number, a: number, b: number, alto: number, onda = 0): Poligono => {
    const pontos: Ponto[] = []
    const f1 = sorteio(semente, 70 + onda) * Math.PI * 2
    const f2 = sorteio(semente, 80 + onda) * Math.PI * 2
    for (let i = 0; i < VOLTA; i++) {
      const t = (i / VOLTA) * Math.PI * 2
      const k = onda === 0 ? 1 : 1 + 0.07 * Math.sin(3 * t + f1) + 0.045 * Math.sin(5 * t + f2)
      const [x, y] = noChao(u0 + Math.cos(t) * a * k, v0 + Math.sin(t) * b * k)
      pontos.push([x, y - alto])
    }
    return pontos
  }
  // Um monte em três andares (o pé, o meio e o lombo), cada um mais estreito e mais alto.
  const andares = (u0: number, v0: number, a: number, b: number, h: number, onda: number): Poligono[] => [
    noChaoElipse(u0, v0, a, b, 0, onda),
    noChaoElipse(u0 - a * 0.04, v0, a * 0.8, b * 0.74, h * 0.6, onda),
    noChaoElipse(u0 - a * 0.06, v0, a * 0.54, b * 0.42, h, onda),
  ]

  // O lombo comprido ao longo do giro, um calombo encavalado numa ponta e um
  // pequeno na outra; às vezes uma bola solta de neve do lado.
  const a = 0.3 + 0.06 * sorteio(semente, 2)
  const b = 0.19 + 0.04 * sorteio(semente, 3)
  const h = 0.14 + 0.04 * sorteio(semente, 4)
  const ponta = sorteio(semente, 5) < 0.5 ? 1 : -1
  const calombos = [
    { u: 0, v: 0, a, b, h, onda: 1 },
    { u: ponta * a * 0.85, v: (sorteio(semente, 6) - 0.5) * b * 0.8, a: a * (0.42 + 0.1 * sorteio(semente, 7)), b: b * 0.7, h: h * 0.66, onda: 2 },
    { u: -ponta * a * 0.88, v: (sorteio(semente, 8) - 0.5) * b * 0.6, a: a * 0.3, b: b * 0.5, h: h * 0.4, onda: 3 },
  ]
  if (sorteio(semente, 9) < 0.5) {
    calombos.push({ u: -ponta * a * 0.4, v: b * 1.35, a: 0.055, b: 0.05, h: 0.04, onda: 4 })
  }

  // A pedra da beira (às vezes): só o alto dela aparece por trás do monte.
  if (sorteio(semente, 50) < 0.4) {
    pintar(g, [noChaoElipse(-ponta * a * 0.6, -b * 0.85, 0.08, 0.07, 0.03)], PEDRA)
    pintar(g, [noChaoElipse(-ponta * a * 0.6, -b * 0.85, 0.045, 0.04, 0.05)], PEDRA_CLARA, -0.012, -0.004)
  }

  // O monte: a sombra inteira, e por cima (dentro dele) o mesmo monte puxado para a luz:
  // o que sobra embaixo à direita é a sombra, em dois passos; a crista clara por último.
  const monte = calombos.flatMap((k) => andares(k.u, k.v, k.a, k.b, k.h, k.onda))
  const calombo = calombos[1]
  pintar(g, monte, NEVE_FUNDA)
  g.save()
  caminhoDePoligonos(g, monte)
  g.clip()
  pintar(g, monte, NEVE_SOMBRA, -0.024, -0.022)
  pintar(g, monte, NEVE, -0.052, -0.048)
  const crista = [
    noChaoElipse(-a * 0.1, -b * 0.12, a * 0.46, b * 0.26, h * 1.02),
    noChaoElipse(calombo.u - calombo.a * 0.1, calombo.v - calombo.b * 0.15, calombo.a * 0.42, calombo.b * 0.3, calombo.h),
  ]
  pintar(g, crista, NEVE_CLARA, -0.03, -0.03)
  g.restore()

  // O capim seco que fura a neve (às vezes): três ou quatro hastes num tufo, na encosta da frente.
  if (sorteio(semente, 60) < 0.55) {
    const [x, y] = noChao((sorteio(semente, 61) - 0.5) * a, b * 0.45)
    const x0 = x + 0.02
    const y0 = y - h * 0.45
    g.strokeStyle = css(CAPIM_SECO)
    g.lineWidth = 0.016
    g.lineCap = 'round'
    g.beginPath()
    const hastes = 3 + (sorteio(semente, 62) < 0.5 ? 1 : 0)
    for (let i = 0; i < hastes; i++) {
      const abre = (i / (hastes - 1) - 0.5) * 0.16
      const alto = 0.12 + 0.07 * sorteio(semente, 63 + i)
      g.moveTo(x0 + abre * 0.3, y0)
      g.quadraticCurveTo(x0 + abre * 0.6, y0 - alto * 0.6, x0 + abre, y0 - alto)
    }
    g.stroke()
  }
}

export const carimbo: DefinicaoDeCarimbo = { id: 'monte-de-neve', nome: 'Monte de neve', tamanho: 10, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [NEVE_FUNDA, NEVE_SOMBRA, NEVE, NEVE_CLARA, CAPIM_SECO, PEDRA, PEDRA_CLARA]
