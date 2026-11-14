import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Musgo (item 132 dos carimbos de 14/11/2026): uma almofada de musgo rente
 * ao chão, feita de muitos montinhos miúdos que se encostam, com duas ilhas
 * menores soltas e uns tufinhos perdidos em volta. O volume vem em duas
 * escalas, em camadas chapadas: a ALMOFADA inteira tem a beira recortada de
 * baixo à direita no verde-escuro e o lado de cima à esquerda no claro; o
 * GRÃO de veludo são pontinhos (vão escuro embaixo à direita de cada
 * montinho, brilho no lado da luz), sem desenhar cada montinho como bolinha.
 * Manchas amareladas são o musgo novo. O que o separa do Arbusto (uma bola em pé com sombra) é ser
 * chato, espalhado, de beira recortada, de grão miúdo e de verde amarelado.
 * Sem sombra: fica por baixo das sombras dos outros. O giro gira a almofada
 * e as ilhas; a luz não gira.
 */

const MUSGO_ESCURO: Rgb = [50, 82, 46]
const MUSGO_VAO: Rgb = [70, 104, 50]
const MUSGO_MEIO: Rgb = [88, 124, 58]
const MUSGO_AMARELADO: Rgb = [118, 136, 62]
const MUSGO_CLARO: Rgb = [128, 154, 76]
const MUSGO_BRILHO: Rgb = [166, 182, 106]

/** O chão visto de cima e um pouco de frente. */
const ACHATA = 0.55
/** Os montinhos são domos baixos: na tela, um pouco mais altos que o chão achatado. */
const DOMO = 0.68
const MEIO_Y = -0.05
const ANGULO_DE_OURO = 2.39996

/** Um montinho: x e y no chão (antes de achatar), o raio e o quanto ele fica do lado da luz na sua almofada (0 a 1). */
type Montinho = readonly [number, number, number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

/** O quanto um montinho fica do lado da luz da almofada: 0,5 no meio, 1 na beira de cima à esquerda. */
function ladoDaLuz(dx: number, dy: number, raio: number): number {
  return 0.5 + 0.5 * Math.min(1, (dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / raio)
}

/** Os montinhos (encolhidos e deslocados) num caminho só: o preenchimento é a união deles. */
function camada(g: CanvasRenderingContext2D, lista: readonly Montinho[], encolhe: number, dx: number, dy: number, cor: Rgb): void {
  g.fillStyle = css(cor)
  g.beginPath()
  for (const [x, y, r] of lista) {
    const rx = r * encolhe
    const cx = x + dx * r
    const cy = MEIO_Y + y * ACHATA + dy * r
    g.moveTo(cx + rx, cy)
    g.ellipse(cx, cy, rx, rx * DOMO, 0, 0, Math.PI * 2)
  }
  g.fill()
}

function montinhos(giro: number, semente: number): Montinho[] {
  const lista: Montinho[] = []
  // A almofada grande, em espiral, um pouco comprida no rumo do giro: os montinhos maiores no meio.
  const n = 32
  const estica = 1.18
  const raio = 0.3
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const rho = raio * Math.sqrt(t) * (0.9 + 0.2 * sorteio(semente, i))
    const b = i * ANGULO_DE_OURO
    const u = Math.cos(b) * rho * estica
    const v = (Math.sin(b) * rho) / estica
    const x = u * Math.cos(giro) - v * Math.sin(giro)
    const y = u * Math.sin(giro) + v * Math.cos(giro)
    lista.push([x, y, 0.066 * (1 - 0.3 * t) * (0.85 + 0.3 * sorteio(semente, 40 + i)), ladoDaLuz(x, y, raio)])
  }
  // Duas ilhas menores, encostadas na beira em lados sorteados.
  for (let ilha = 0; ilha < 2; ilha++) {
    const a = giro + 1.6 + ilha * 2.7 + (sorteio(semente, 80 + ilha) - 0.5) * 0.8
    const d = 0.38 + 0.05 * sorteio(semente, 82 + ilha)
    const cx = Math.cos(a) * d
    const cy = Math.sin(a) * d
    for (let i = 0; i < 5; i++) {
      const b = a + i * 1.4 + sorteio(semente, 84 + ilha * 5 + i)
      const e = i === 0 ? 0 : 0.045 + 0.02 * sorteio(semente, 94 + ilha * 5 + i)
      lista.push([cx + Math.cos(b) * e, cy + Math.sin(b) * e, 0.036 + 0.018 * sorteio(semente, 104 + ilha * 5 + i), ladoDaLuz(Math.cos(b) * e, Math.sin(b) * e, 0.07)])
    }
  }
  // Uns tufinhos perdidos.
  for (let i = 0; i < 4; i++) {
    const a = giro + 2.4 + i * 1.6 + sorteio(semente, 120 + i)
    const d = 0.46 + 0.1 * sorteio(semente, 124 + i)
    lista.push([Math.cos(a) * d, Math.sin(a) * d, 0.022 + 0.01 * sorteio(semente, 128 + i), 0.5])
  }
  return lista
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const lista = montinhos(giro, semente)
  // A beira da almofada: o verde-escuro sobra embaixo à direita, recortada pelos montinhos.
  camada(g, lista, 1, 0, 0, MUSGO_ESCURO)
  // O corpo: a união dos montinhos no meio-tom (por dentro não sobra vão, nada de bolinha).
  camada(g, lista, 0.92, -0.1, -0.13, MUSGO_MEIO)
  // As manchas de musgo novo, amareladas: agrupadas por um ondulado do lugar, não salpicadas.
  camada(
    g,
    lista.filter(([x, y]) => Math.sin(x * 11 + semente) * Math.cos(y * 13 - semente * 0.7) > 0.3),
    0.74,
    -0.14,
    -0.18,
    MUSGO_AMARELADO,
  )
  // O lado de cima à esquerda da almofada, no claro.
  camada(
    g,
    lista.filter(([, , , luz]) => luz > 0.6),
    0.78,
    -0.18,
    -0.24,
    MUSGO_CLARO,
  )
  // O grão de veludo: pontinhos de vão embaixo à direita dos montinhos e uns pontinhos de brilho no claro.
  camada(
    g,
    lista.filter(([, , r], i) => r > 0.03 && sorteio(semente, 160 + i) < 0.6),
    0.24,
    0.28,
    0.22,
    MUSGO_VAO,
  )
  camada(
    g,
    lista.filter(([, , r, luz], i) => r > 0.04 && luz > 0.55 && sorteio(semente, 180 + i) < 0.45),
    0.15,
    -0.32,
    -0.4,
    MUSGO_BRILHO,
  )
}

export const carimbo: DefinicaoDeCarimbo = { id: 'musgo', nome: 'Musgo', tamanho: 10, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [MUSGO_ESCURO, MUSGO_VAO, MUSGO_MEIO, MUSGO_AMARELADO, MUSGO_CLARO, MUSGO_BRILHO]
