import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Árvore de doces (item 152 da lista de 14/11/2026, Pântano e fantasia):
 * inspirada na ilha de doce do One Piece, desenho nosso. O tronco é um
 * bastão de bala listrado (creme com faixas vermelhas largas em diagonal); a
 * copa é uma nuvem de algodão-doce em lóbulos fofos, com um pirulito de
 * espiral espetado no alto e balas de goma coloridas espalhadas por cima. O
 * sabor (a cor da copa) muda com a semente: morango, menta, uva ou limão,
 * todos em tom pastel, então um bosque espalhado pelo spray sai colorido sem
 * estourar.
 *
 * A luz é a de sempre (de cima à esquerda, não gira): o lado esquerdo do
 * tronco aceso, os lóbulos claros no alto à esquerda, o brilho do pirulito e
 * das balas em cima à esquerda. O giro gira os lóbulos, a espiral e o lugar
 * do pirulito e das balas, e inclina o tronco de leve.
 */

type Ponto = [number, number]
type Circulo = [number, number, number]

interface Sabor {
  contorno: Rgb
  escuro: Rgb
  medio: Rgb
  claro: Rgb
}

const MORANGO: Sabor = { contorno: [170, 100, 130], escuro: [206, 132, 162], medio: [226, 164, 188], claro: [240, 198, 214] }
const MENTA: Sabor = { contorno: [70, 132, 122], escuro: [106, 172, 156], medio: [146, 202, 182], claro: [192, 228, 210] }
const UVA: Sabor = { contorno: [116, 98, 156], escuro: [150, 130, 190], medio: [180, 164, 214], claro: [210, 198, 232] }
const LIMAO: Sabor = { contorno: [164, 138, 72], escuro: [208, 180, 100], medio: [228, 206, 134], claro: [240, 228, 178] }
/** Um sabor por semente: os quatro aparecem duas vezes, sem dois iguais seguidos. */
const SABORES: readonly Sabor[] = [MORANGO, MENTA, UVA, LIMAO, MENTA, MORANGO, LIMAO, UVA]

const CREME: Rgb = [236, 226, 212]
const CREME_SOMBRA: Rgb = [194, 178, 168]
const LISTRA: Rgb = [194, 70, 84]
const LISTRA_SOMBRA: Rgb = [146, 50, 64]
const PIRULITO_BEIRA: Rgb = [182, 160, 152]
const BRILHO: Rgb = [245, 242, 236]

/** As balas de goma: a cor e a sombra dela. */
const BALAS: ReadonlyArray<readonly [Rgb, Rgb]> = [
  [
    [196, 72, 86],
    [146, 52, 66],
  ],
  [
    [84, 136, 198],
    [60, 98, 152],
  ],
  [
    [222, 190, 102],
    [176, 144, 70],
  ],
  [
    [100, 168, 108],
    [70, 126, 82],
  ],
  [
    [224, 150, 88],
    [176, 108, 62],
  ],
]

/** A copa: o meio e o raio no quadro (o pé do objeto em 0, 0), e o alto do tronco por baixo dela. */
const COPA = { cy: -0.7, raio: 0.4, lobulos: 9 } as const
const TRONCO = { topo: -0.44, base: 0.0, largoNoPe: 0.066, largoNoAlto: 0.052 } as const
const PIRULITO = { raio: 0.13, achata: 0.9, voltas: 2.25 } as const

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[]): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
}

/** Vários círculos num caminho só: o preenchimento é a união deles, sem emenda. */
function circulos(g: CanvasRenderingContext2D, lista: ReadonlyArray<readonly [number, number, number]>): void {
  g.beginPath()
  for (const [x, y, r] of lista) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  g.fill()
}

function elipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, cor: Rgb, alfa = 1): void {
  g.fillStyle = css(cor, alfa)
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  g.fill()
}

/** Os lóbulos fofos da nuvem: nove em volta e um no meio, girados pelo giro. */
function lobulos(semente: number, giro: number, encolher: number, dx: number, dy: number): Circulo[] {
  const { cy, raio, lobulos: n } = COPA
  const lista: Circulo[] = []
  for (let i = 0; i < n; i++) {
    const a = giro + (i / n) * Math.PI * 2 + (sorteio(semente, 40 + i) - 0.5) * 0.5
    const d = raio * (0.56 + 0.08 * sorteio(semente, 50 + i)) * encolher
    // Vista de cima e um pouco de frente: a nuvem achata de leve na vertical.
    lista.push([dx + Math.cos(a) * d, cy + dy + Math.sin(a) * d * 0.9, raio * (0.36 + 0.08 * sorteio(semente, 60 + i)) * encolher])
  }
  lista.push([dx - raio * 0.04, cy + dy - raio * 0.05, raio * 0.6 * encolher])
  return lista
}

/** O bastão de bala: creme com a metade da luz acesa e as listras largas em diagonal, clara e escura. */
function desenharTronco(g: CanvasRenderingContext2D, inclina: number, semente: number): void {
  const { topo, base, largoNoPe, largoNoAlto } = TRONCO
  const borda = (lado: number, k: number): Ponto[] =>
    Array.from({ length: 5 }, (_, i) => {
      const t = i / 4
      const largo = largoNoPe + (largoNoAlto - largoNoPe) * t
      return [inclina * t + lado * largo * k, base + (topo - base) * t]
    })
  // O pé redondo, como a boca de um cilindro visto um pouco de frente (reto, parecia um poste espetado).
  const fundo = (de: number): Ponto[] =>
    Array.from({ length: 5 }, (_, i) => {
      const t = (i + 1) / 6
      const x = largoNoPe * (de + (-1 - de) * t)
      return [x, base + 0.022 * Math.sqrt(Math.max(0, 1 - (x / largoNoPe) ** 2))]
    })
  const tronco = [...borda(-1, 1), ...borda(1, 1).reverse(), ...fundo(1)]
  const daLuz = [...borda(-1, 1), ...borda(1, 0.12).reverse(), ...fundo(0.12)]
  g.fillStyle = css(CREME_SOMBRA)
  caminho(g, tronco)
  g.fill()
  g.fillStyle = css(CREME)
  caminho(g, daLuz)
  g.fill()
  // As listras: subindo para a direita, uma a cada 0,1, todas num caminho só.
  const fase = sorteio(semente, 1) * 0.1
  const listras = (pontos: Ponto[][]) => {
    g.beginPath()
    for (const p of pontos) {
      g.moveTo(p[0][0], p[0][1])
      for (const [x, y] of p.slice(1)) g.lineTo(x, y)
      g.closePath()
    }
  }
  const faixas: Ponto[][] = []
  for (let k = 0; k < 6; k++) {
    const y = base - 0.02 - fase - k * 0.1
    const x = inclina * ((base - y) / (base - topo))
    faixas.push([
      [x - 0.1, y + 0.03],
      [x + 0.1, y - 0.035],
      [x + 0.1, y - 0.083],
      [x - 0.1, y - 0.018],
    ])
  }
  g.save()
  caminho(g, tronco)
  g.clip()
  g.fillStyle = css(LISTRA_SOMBRA)
  listras(faixas)
  g.fill()
  caminho(g, daLuz)
  g.clip()
  g.fillStyle = css(LISTRA)
  listras(faixas)
  g.fill()
  g.restore()
}

/** O pirulito: o disco de bala virado para cima, a beira (a grossura) embaixo à direita, a espiral e o brilho. */
function desenharPirulito(g: CanvasRenderingContext2D, x: number, y: number, giro: number): void {
  const { raio, achata, voltas } = PIRULITO
  elipse(g, x + raio * 0.08, y + raio * 0.14, raio, raio * achata, PIRULITO_BEIRA)
  elipse(g, x, y, raio, raio * achata, CREME)
  // A espiral: uma faixa que sai do meio e dá duas voltas e pouco, com a largura de meio passo.
  const passo = raio / (voltas + 0.25)
  const fim = voltas * Math.PI * 2
  const ponto = (r: number, a: number): Ponto => [x + Math.cos(a + giro) * r, y + Math.sin(a + giro) * r * achata]
  const fora: Ponto[] = []
  const dentro: Ponto[] = []
  const passos = Math.round(voltas * 16)
  for (let i = 0; i <= passos; i++) {
    const a = (fim * i) / passos
    const r = (passo * a) / (Math.PI * 2)
    fora.push(ponto(Math.min(raio * 0.97, r + passo * 0.27), a))
    dentro.push(ponto(Math.max(0, r - passo * 0.23), a))
  }
  g.fillStyle = css(LISTRA)
  caminho(g, [...fora, ...dentro.reverse()])
  g.fill()
  elipse(g, x - raio * 0.4, y - raio * 0.42, raio * 0.3, raio * 0.18, BRILHO, 0.55)
}

function desenharArvoreDeDoces(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const sabor = SABORES[((Math.round(semente) % 8) + 8) % 8]
  const inclina = Math.sin(giro) * 0.035
  desenharTronco(g, inclina, semente)

  // A nuvem de algodão-doce: o contorno (a mesma nuvem um pouco maior), o escuro, o médio puxado para a luz e os claros.
  const { raio } = COPA
  g.fillStyle = css(sabor.contorno)
  circulos(
    g,
    lobulos(semente, giro, 1, inclina, 0).map(([x, y, r]): Circulo => [x, y, r + 0.022]),
  )
  g.fillStyle = css(sabor.escuro)
  circulos(g, lobulos(semente, giro, 1, inclina, 0))
  g.fillStyle = css(sabor.medio)
  circulos(g, lobulos(semente, giro, 0.8, inclina - raio * 0.1, -raio * 0.13))
  g.fillStyle = css(sabor.claro)
  circulos(g, lobulos(semente, giro, 0.4, inclina - raio * 0.33, -raio * 0.36))

  // As balas de goma: cinco, em volta, cada uma de uma cor (a ordem muda com a semente).
  const primeira = Math.floor(sorteio(semente, 70) * BALAS.length)
  const balas: Array<{ x: number; y: number; r: number; cores: readonly [Rgb, Rgb] }> = []
  for (let i = 0; i < 5; i++) {
    const a = giro + 0.6 + (i * Math.PI * 2) / 5 + (sorteio(semente, 71 + i) - 0.5) * 0.5
    const d = raio * (0.5 + 0.2 * sorteio(semente, 80 + i))
    balas.push({ x: inclina + Math.cos(a) * d, y: COPA.cy + Math.sin(a) * d * 0.9, r: 0.042 + 0.01 * sorteio(semente, 90 + i), cores: BALAS[(primeira + i) % BALAS.length] })
  }
  for (const b of balas) {
    elipse(g, b.x + b.r * 0.12, b.y + b.r * 0.12, b.r, b.r * 0.86, b.cores[1])
    elipse(g, b.x - b.r * 0.12, b.y - b.r * 0.14, b.r * 0.78, b.r * 0.66, b.cores[0])
  }
  g.fillStyle = css(BRILHO, 0.6)
  g.beginPath()
  for (const b of balas) {
    g.moveTo(b.x - b.r * 0.3 + b.r * 0.2, b.y - b.r * 0.38)
    g.ellipse(b.x - b.r * 0.3, b.y - b.r * 0.38, b.r * 0.2, b.r * 0.14, 0, 0, Math.PI * 2)
  }
  g.fill()

  // O pirulito: espetado no alto da nuvem, num lado que o giro escolhe.
  const a = giro * 0.7 - Math.PI / 2 + (sorteio(semente, 95) - 0.5) * 0.8
  desenharPirulito(g, inclina + Math.cos(a) * raio * 0.32, COPA.cy - raio * 0.08 + Math.sin(a) * raio * 0.26, giro)
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'arvore-de-doces',
  nome: 'Árvore de doces',
  tamanho: 15,
  sombra: 'em-pe',
  desenhar: desenharArvoreDeDoces,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [
  ...SABORES.slice(0, 4).flatMap((s) => [s.contorno, s.escuro, s.medio, s.claro]),
  CREME,
  CREME_SOMBRA,
  LISTRA,
  LISTRA_SOMBRA,
  PIRULITO_BEIRA,
  BRILHO,
  ...BALAS.flat(),
]
