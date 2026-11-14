import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Cerejeira florida (item 111 da lista de 14/11/2026): a copa larga em
 * guarda-chuva, feita de nuvens de flor cor-de-rosa, com os galhos escuros
 * à mostra no vão de baixo, e umas pétalas caídas em volta do pé. O que a
 * separa da Árvore (três cachos verdes) e da Árvore redonda (uma bola verde
 * que às vezes floresce) é a COR inteira da copa e a forma: cinco nuvens
 * baixas num arco, mais larga que alta, e o tronco que abre em leque.
 * A luz é a de todos: de cima à esquerda; o giro gira os lóbulos e muda a
 * arrumação das nuvens, a semente muda o tom (umas mais brancas).
 */

type Ponto = readonly [number, number]

const CASCA_CLARA: Rgb = [116, 86, 80]
const CASCA: Rgb = [86, 64, 64]
const CASCA_SOMBRA: Rgb = [66, 50, 52]
const SOMBRA_DA_COPA: Rgb = [128, 76, 98]
const FLOR_ESCURA: Rgb = [176, 102, 132]
const FLOR_MEDIA: Rgb = [214, 142, 170]
const FLOR_CLARA: Rgb = [236, 188, 206]
const PETALA: Rgb = [242, 218, 226]

/** Clareia (`f` > 0) ou escurece (`f` < 0) mantendo o tom. */
function luz(c: Rgb, f: number): Rgb {
  return f >= 0 ? misturar(c, [236, 238, 226], f) : misturar(c, [8, 18, 22], -f)
}

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
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

/**
 * Um galho que afina de `a` até `b`, curvado por `c`, acrescentado ao caminho
 * aberto (quem chama faz o `beginPath` e o `fill`): vários galhos num
 * preenchimento só. Sempre no mesmo sentido, então a união não fura.
 */
function galho(g: CanvasRenderingContext2D, a: Ponto, c: Ponto, b: Ponto, grosso: number, fino: number): void {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const n = Math.hypot(dx, dy) || 1
  const nx = -dy / n
  const ny = dx / n
  const meio = (grosso + fino) / 2
  g.moveTo(a[0] + nx * grosso, a[1] + ny * grosso)
  g.quadraticCurveTo(c[0] + nx * meio, c[1] + ny * meio, b[0] + nx * fino, b[1] + ny * fino)
  g.lineTo(b[0] - nx * fino, b[1] - ny * fino)
  g.quadraticCurveTo(c[0] - nx * meio, c[1] - ny * meio, a[0] - nx * grosso, a[1] - ny * grosso)
  g.closePath()
}

/** Os lóbulos de uma nuvem de flor: um miolo e oito em volta, achatados como a copa vista de cima. */
function lobulos(cx: number, cy: number, raio: number, giro: number, semente: number): Array<[number, number, number]> {
  const lista: Array<[number, number, number]> = [[cx, cy, raio * 0.66]]
  for (let i = 0; i < 8; i++) {
    const a = giro + (i * Math.PI * 2) / 8 + (sorteio(semente, i) - 0.5) * 0.6
    const r = raio * (0.34 + 0.12 * sorteio(semente, i + 10))
    const d = raio * 0.6
    lista.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r])
  }
  return lista
}

interface Nuvem {
  x: number
  y: number
  r: number
  luz: number
}

/** As cinco nuvens: um arco largo e baixo; a semente e o giro mexem um pouco em cada uma. */
function nuvens(giro: number, semente: number): Nuvem[] {
  const base: ReadonlyArray<Nuvem> = [
    { x: -0.37, y: -0.56, r: 0.17, luz: 0.03 },
    { x: -0.17, y: -0.79, r: 0.2, luz: 0.06 },
    { x: 0.11, y: -0.85, r: 0.21, luz: 0.04 },
    { x: 0.35, y: -0.64, r: 0.18, luz: -0.1 },
    { x: 0.06, y: -0.58, r: 0.15, luz: -0.04 },
  ]
  return base.map((n, i) => ({
    x: n.x + Math.cos(giro + i * 1.7) * 0.025,
    y: n.y + Math.sin(giro + i * 1.7) * 0.02,
    r: n.r * (0.92 + 0.16 * sorteio(semente, 20 + i)),
    luz: n.luz,
  }))
}

function desenharCerejeira(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const inclina = Math.sin(giro) * 0.035
  const forquilha: Ponto = [inclina, -0.34]
  // Umas mais brancas, outras mais rosadas: o grupo não sai clonado.
  const branco = 0.22 * sorteio(semente, 30)
  const tom = (c: Rgb) => misturar(c, PETALA, branco)

  // As pétalas caídas em volta do pé, rente ao chão: rosadas (as brancas viravam brilho solto).
  g.fillStyle = css(misturar(tom(FLOR_MEDIA), FLOR_CLARA, 0.35))
  g.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = giro * 0.7 + i * 1.05 + sorteio(semente, 40 + i) * 0.8
    const d = 0.15 + 0.22 * sorteio(semente, 50 + i)
    const x = Math.cos(a) * d
    const y = 0.03 + Math.sin(a) * d * 0.32
    const rx = 0.028
    g.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * rx)
    g.ellipse(x, y, rx, 0.016, a, 0, Math.PI * 2)
  }
  g.fill()

  // O tronco: o corpo na sombra, com as raízes abrindo no chão...
  g.fillStyle = css(CASCA_SOMBRA)
  g.beginPath()
  galho(g, [0.005, 0.01], [-0.04, -0.17], forquilha, 0.06, 0.04)
  g.moveTo(-0.12, 0.028)
  g.quadraticCurveTo(-0.045, 0.004, -0.04, -0.07)
  g.lineTo(0.04, -0.07)
  g.quadraticCurveTo(0.05, 0.004, 0.13, 0.034)
  g.closePath()
  g.fill()
  // ...e a faixa da luz, à esquerda.
  g.fillStyle = css(CASCA_CLARA)
  g.beginPath()
  galho(g, [-0.02, 0.012], [-0.062, -0.17], [forquilha[0] - 0.018, forquilha[1] + 0.01], 0.028, 0.018)
  g.moveTo(-0.12, 0.028)
  g.quadraticCurveTo(-0.05, 0.006, -0.046, -0.05)
  g.lineTo(-0.02, -0.05)
  g.lineTo(-0.02, 0.014)
  g.closePath()
  g.fill()

  const copa = nuvens(giro, semente)
  // Os galhos: da forquilha até o miolo de cada nuvem, abrindo em leque; aparecem no vão de baixo.
  g.fillStyle = css(CASCA)
  g.beginPath()
  for (const n of copa) {
    const meio: Ponto = [(forquilha[0] + n.x) / 2 + n.x * 0.18, (forquilha[1] + n.y) / 2 + 0.03]
    galho(g, forquilha, meio, [n.x * 0.9, n.y + n.r * 0.3], 0.032, 0.012)
  }
  g.fill()

  // A sombra da copa por baixo das nuvens, um pouco para baixo e à direita.
  g.fillStyle = css(tom(SOMBRA_DA_COPA))
  circulos(
    g,
    copa.filter((n) => n.y > -0.7).flatMap((n, i) => lobulos(n.x + 0.02, n.y + 0.04, n.r * 0.9, giro + i * 2.3, semente * 5 + i)),
  )

  // As nuvens de flor: as de baixo primeiro, a do alto tampa as outras (como a Árvore).
  const ordem = copa.map((n, i) => ({ n, i })).sort((p, q) => q.n.y - p.n.y)
  for (const { n, i } of ordem) {
    const lobos = giro + i * 2.3
    const s = semente * 5 + i
    g.fillStyle = css(luz(tom(FLOR_ESCURA), n.luz))
    circulos(g, lobulos(n.x, n.y, n.r, lobos, s))
    g.fillStyle = css(luz(tom(FLOR_MEDIA), n.luz))
    circulos(g, lobulos(n.x - n.r * 0.12, n.y - n.r * 0.16, n.r * 0.78, lobos, s))
    g.fillStyle = css(luz(tom(FLOR_CLARA), n.luz))
    circulos(g, lobulos(n.x - n.r * 0.32, n.y - n.r * 0.36, n.r * 0.4, lobos, s))
  }

  // Poucas flores abertas no alto das nuvens que pegam luz (bolinha demais fica estranho).
  g.fillStyle = css(PETALA)
  circulos(
    g,
    copa
      .filter((n) => n.luz >= 0)
      .map((n, i) => [n.x - n.r * (0.1 + 0.4 * sorteio(semente, 60 + i)), n.y - n.r * (0.5 + 0.2 * sorteio(semente, 70 + i)), 0.024] as [number, number, number]),
  )
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'cerejeira',
  nome: 'Cerejeira florida',
  tamanho: 15,
  sombra: 'em-pe',
  desenhar: desenharCerejeira,
}

/** Todas as cores chapadas do desenho (as do brilho, do tom e da luz saem da mistura delas). */
export const paleta: readonly Rgb[] = [CASCA_CLARA, CASCA, CASCA_SOMBRA, SOMBRA_DA_COPA, FLOR_ESCURA, FLOR_MEDIA, FLOR_CLARA, PETALA]
