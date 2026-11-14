import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Flores do campo (item 125 dos carimbos de 14/11/2026): uma moita baixa e
 * larga de folhagem miúda, salpicada de flores de cinco pétalas em duas ou
 * três cores (branca, amarela, lilás, rosa), com três delas mais altas, na
 * ponta de um cabinho, quebrando o contorno de cima. Algumas folhas
 * compridas escapam pelas beiras: é mato florido, não arbusto podado. O que a
 * separa do Arbusto (bola verde lisa) é ser rasteira e larga e as flores; da
 * Árvore redonda florida, o tamanho (cabe numa casa) e a cor que domina.
 *
 * Cada flor tem o disco no tom da sombra, um pouco para baixo e para a
 * direita, e as pétalas claras puxadas para a luz (de cima à esquerda), com o
 * miolo. A semente escolhe as cores da moita (uma manda, as outras acompanham)
 * e onde cada flor cai; o giro gira os lóbulos e a roda das flores. A luz não
 * gira.
 */

const FOLHA_ESCURA: Rgb = [50, 98, 62]
const FOLHA_MEDIA: Rgb = [80, 134, 76]
const FOLHA_CLARA: Rgb = [128, 170, 100]

interface TonsDaFlor {
  clara: Rgb
  sombra: Rgb
  miolo: Rgb
}

const BRANCA: TonsDaFlor = { clara: [238, 234, 222], sombra: [186, 190, 180], miolo: [214, 176, 82] }
const AMARELA: TonsDaFlor = { clara: [226, 196, 104], sombra: [178, 140, 68], miolo: [124, 88, 52] }
const LILAS: TonsDaFlor = { clara: [178, 152, 212], sombra: [122, 102, 162], miolo: [222, 196, 120] }
const ROSA: TonsDaFlor = { clara: [224, 136, 150], sombra: [168, 90, 106], miolo: [228, 202, 132] }
const CORES: readonly TonsDaFlor[] = [BRANCA, AMARELA, LILAS, ROSA]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

function circulos(g: CanvasRenderingContext2D, lista: ReadonlyArray<readonly [number, number, number]>): void {
  g.beginPath()
  for (const [x, y, r] of lista) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  g.fill()
}

type Ponto = readonly [number, number]
type Circulo = [number, number, number]

/** A moita vista de cima e um pouco de frente: larga e baixa. */
const MOITA = { cy: -0.15, rx: 0.36, ry: 0.19 } as const

function lobulos(giro: number, semente: number, encolher: number, dx: number, dy: number): Circulo[] {
  const lista: Circulo[] = [[dx, MOITA.cy + dy, 0.17 * encolher]]
  for (let i = 0; i < 9; i++) {
    const a = giro + (i * Math.PI * 2) / 9 + (sorteio(semente, i) - 0.5) * 0.5
    const d = (0.62 + 0.14 * sorteio(semente, 10 + i)) * encolher
    lista.push([dx + Math.cos(a) * MOITA.rx * d, MOITA.cy + dy + Math.sin(a) * MOITA.ry * d, (0.11 + 0.04 * sorteio(semente, 20 + i)) * encolher])
  }
  return lista
}

/**
 * Uma folha comprida do pé `a` à ponta `b`, de meia largura `w`, arqueada:
 * o meio sobe `verga` e a ponta cai, como capim que pesa (no mesmo caminho das outras).
 */
function folha(g: CanvasRenderingContext2D, a: Ponto, b: Ponto, w: number, verga: number): void {
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2 - verga
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const m = Math.hypot(dx, dy) || 1
  const nx = (-dy / m) * w * 2
  const ny = (dx / m) * w * 2
  g.moveTo(a[0], a[1])
  g.quadraticCurveTo(mx + nx, my + ny, b[0], b[1])
  g.quadraticCurveTo(mx - nx, my - ny, a[0], a[1])
}

/** As folhas compridas que escapam pelas beiras da moita, arqueadas: as da luz num tom, as da sombra no outro. */
function desenharFolhasDaBeira(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const folhas = Array.from({ length: 7 }, (_, i) => {
    const a = giro + 0.3 + (i * Math.PI * 2) / 7 + (sorteio(semente, 30 + i) - 0.5) * 0.6
    const c = Math.cos(a)
    const s = Math.sin(a)
    const longe = 1.12 + 0.2 * sorteio(semente, 40 + i)
    const pe: Ponto = [c * MOITA.rx * 0.55, MOITA.cy - 0.02 + s * MOITA.ry * 0.55]
    const ponta: Ponto = [c * MOITA.rx * longe, MOITA.cy + 0.02 + s * MOITA.ry * longe]
    return { pe, ponta, luz: voltadoParaALuz(c, s) }
  })
  for (const [tom, daLuz] of [[FOLHA_ESCURA, false], [FOLHA_MEDIA, true]] as const) {
    g.fillStyle = css(tom)
    g.beginPath()
    for (const f of folhas.filter((f) => f.luz > 0.5 === daLuz)) folha(g, f.pe, f.ponta, 0.03, 0.07)
    g.fill()
  }
}

interface Flor {
  x: number
  y: number
  r: number
  cor: TonsDaFlor
  giro: number
}

function flores(giro: number, semente: number): { flores: Flor[]; cabinhos: Array<[Ponto, Ponto]> } {
  // Uma cor manda, outra acompanha e às vezes aparece uma terceira.
  const k = semente % CORES.length
  const salto = semente % 2 === 0 ? 1 : 3
  const manda = CORES[k]
  const segue = CORES[(k + salto) % CORES.length]
  const terceira = CORES[(k + 2) % CORES.length]
  const corDa = (i: number) => {
    const t = sorteio(semente, 120 + i)
    return t < 0.56 ? manda : t < 0.86 ? segue : terceira
  }
  const n = 14 + Math.floor(sorteio(semente, 110) * 3)
  const lista: Flor[] = []
  for (let i = 0; i < n; i++) {
    // Espalhadas por todo o alto da moita, até a beira; a roda das flores gira com o giro.
    const a = giro + i * 2.39996 + sorteio(semente, 130 + i) * 0.6
    const d = Math.sqrt((i + 0.5) / n) * (0.88 + 0.16 * sorteio(semente, 140 + i))
    lista.push({ x: Math.cos(a) * d * 0.33, y: MOITA.cy - 0.05 + Math.sin(a) * d * 0.17, r: 0.04 + 0.012 * sorteio(semente, 150 + i), cor: corDa(i), giro: a * 1.7 })
  }
  // As três mais altas, cada uma no seu cabinho, acima do contorno da moita.
  const cabinhos: Array<[Ponto, Ponto]> = []
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.17 + Math.sin(giro + i * 2.1) * 0.05 + (sorteio(semente, 160 + i) - 0.5) * 0.04
    const y = -0.41 - 0.09 * sorteio(semente, 170 + i)
    cabinhos.push([[x * 0.6, MOITA.cy - 0.08], [x, y]])
    lista.push({ x, y, r: 0.05, cor: corDa(20 + i), giro: giro + i })
  }
  return { flores: lista.sort((p, q) => p.y - q.y), cabinhos }
}

/** As cinco pétalas de cada flor, um pouco puxadas para a luz. */
function petalas(f: Flor): Circulo[] {
  return Array.from({ length: 5 }, (_, k): Circulo => {
    const a = f.giro + (k * Math.PI * 2) / 5
    return [f.x - f.r * 0.12 + Math.cos(a) * f.r * 0.52, f.y - f.r * 0.14 + Math.sin(a) * f.r * 0.46, f.r * 0.46]
  })
}

function desenharFlores(g: CanvasRenderingContext2D, lista: readonly Flor[]): void {
  for (const cor of CORES) {
    const destas = lista.filter((f) => f.cor === cor)
    if (destas.length === 0) continue
    g.fillStyle = css(cor.sombra)
    circulos(g, destas.map((f): Circulo => [f.x + f.r * 0.1, f.y + f.r * 0.12, f.r * 0.92]))
    g.fillStyle = css(cor.clara)
    circulos(g, destas.flatMap(petalas))
    g.fillStyle = css(cor.miolo)
    circulos(g, destas.map((f): Circulo => [f.x - f.r * 0.1, f.y - f.r * 0.12, f.r * 0.3]))
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  desenharFolhasDaBeira(g, giro, semente)
  g.fillStyle = css(FOLHA_ESCURA)
  circulos(g, lobulos(giro, semente, 1, 0, 0))
  g.fillStyle = css(FOLHA_MEDIA)
  circulos(g, lobulos(giro, semente, 0.8, -0.04, -0.035))
  g.fillStyle = css(FOLHA_CLARA)
  circulos(g, lobulos(giro, semente, 0.42, -0.12, -0.08))
  const { flores: lista, cabinhos } = flores(giro, semente)
  // Os cabinhos das três de cima: finos, afinando até a flor.
  g.fillStyle = css(FOLHA_ESCURA)
  g.beginPath()
  for (const [pe, flor] of cabinhos) {
    g.moveTo(pe[0] - 0.014, pe[1])
    g.quadraticCurveTo((pe[0] + flor[0]) / 2 - 0.02, (pe[1] + flor[1]) / 2, flor[0], flor[1])
    g.quadraticCurveTo((pe[0] + flor[0]) / 2 + 0.006, (pe[1] + flor[1]) / 2, pe[0] + 0.014, pe[1])
    g.closePath()
  }
  g.fill()
  desenharFlores(g, lista)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'flores-do-campo', nome: 'Flores do campo', tamanho: 5, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [FOLHA_ESCURA, FOLHA_MEDIA, FOLHA_CLARA, ...CORES.flatMap((c) => [c.clara, c.sombra, c.miolo])]
