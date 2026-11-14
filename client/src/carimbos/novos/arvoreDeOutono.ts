import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Árvore de outono (item 116 da lista de 14/11/2026): a copa redonda e um
 * pouco alta, MALHADA de vermelho, laranja e dourado (cada cacho de uma cor,
 * a semente reparte), sobre um tronco cinza-castanho que abre em dois
 * galhos; umas folhas caindo do lado e outras no chão em volta do pé. O que
 * a separa das árvores verdes é a cor; da Cerejeira (rosa, larga e baixa), o
 * tom quente e a copa mais alta e fechada.
 * A luz é a de todos (de cima à esquerda): os cachos da direita apagados, o
 * brilho dourado no alto à esquerda. O giro gira os lóbulos e mexe na
 * arrumação; a semente troca as cores dos cachos (uma mais vermelha, outra
 * mais dourada) e as folhas.
 */

type Ponto = readonly [number, number]

const CASCA_CLARA: Rgb = [132, 112, 96]
const CASCA: Rgb = [98, 80, 68]
const CASCA_SOMBRA: Rgb = [70, 56, 50]
const COPA_SOMBRA: Rgb = [104, 50, 42]
const VERMELHO_ESCURO: Rgb = [128, 58, 46]
const VERMELHO: Rgb = [176, 82, 62]
const LARANJA: Rgb = [204, 122, 72]
const DOURADO: Rgb = [216, 164, 84]
const DOURADO_CLARO: Rgb = [232, 196, 128]

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
 * aberto (quem chama faz o `beginPath` e o `fill`). Sempre no mesmo sentido.
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

/** Os lóbulos de um cacho: o miolo e sete em volta. */
function lobulos(cx: number, cy: number, raio: number, giro: number, semente: number): Array<[number, number, number]> {
  const lista: Array<[number, number, number]> = [[cx, cy, raio * 0.68]]
  for (let i = 0; i < 7; i++) {
    const a = giro + (i * Math.PI * 2) / 7 + (sorteio(semente, i) - 0.5) * 0.5
    const r = raio * (0.38 + 0.1 * sorteio(semente, i + 10))
    const d = raio * 0.58
    lista.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.88, r])
  }
  return lista
}

interface TonsDoCacho {
  escuro: Rgb
  medio: Rgb
  claro: Rgb
}

/** As três famílias de cor do outono; a semente diz qual cacho fica com qual. */
const FAMILIAS: readonly TonsDoCacho[] = [
  { escuro: VERMELHO_ESCURO, medio: VERMELHO, claro: LARANJA },
  { escuro: misturar(VERMELHO_ESCURO, VERMELHO, 0.45), medio: LARANJA, claro: DOURADO },
  { escuro: misturar(VERMELHO, LARANJA, 0.4), medio: DOURADO, claro: DOURADO_CLARO },
]

/**
 * Os cachos: dois embaixo, um no miolo (sem ele o vão do meio virava uma
 * bola escura), dois no meio e um no alto, que tampa os outros: a copa é
 * alta e fechada.
 */
const CACHOS = [
  { x: -0.25, y: -0.53, r: 0.18, luz: 0 },
  { x: 0.26, y: -0.51, r: 0.17, luz: -0.12 },
  { x: 0.01, y: -0.62, r: 0.19, luz: -0.04 },
  { x: -0.23, y: -0.8, r: 0.21, luz: 0.04 },
  { x: 0.24, y: -0.78, r: 0.2, luz: -0.07 },
  { x: 0, y: -0.96, r: 0.19, luz: 0.06 },
] as const

/** Uma folha pequena (a ponta e o talo), acrescentada ao caminho aberto. */
function folhinha(g: CanvasRenderingContext2D, x: number, y: number, a: number, tam: number): void {
  const dx = Math.cos(a) * tam
  const dy = Math.sin(a) * tam * 0.6
  g.moveTo(x - dx, y - dy)
  g.quadraticCurveTo(x - dy * 0.9, y + dx * 0.9, x + dx, y + dy)
  g.quadraticCurveTo(x + dy * 0.9, y - dx * 0.9, x - dx, y - dy)
  g.closePath()
}

function desenharArvoreDeOutono(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const inclina = Math.sin(giro) * 0.035
  // A copa puxa para o vermelho ou para o dourado, árvore a árvore.
  const desloca = Math.floor(sorteio(semente, 1) * FAMILIAS.length)
  const familia = (i: number) => FAMILIAS[(i + desloca + (sorteio(semente, 2 + i) < 0.3 ? 1 : 0)) % FAMILIAS.length]

  // As folhas no chão em volta do pé: rente, sem sombra que se note.
  g.fillStyle = css(familia(0).medio)
  g.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = giro * 0.8 + i * 1.05 + sorteio(semente, 10 + i) * 0.7
    const d = 0.14 + 0.2 * sorteio(semente, 20 + i)
    folhinha(g, Math.cos(a) * d, 0.035 + Math.sin(a) * d * 0.3, a * 2.3, 0.026)
  }
  g.fill()
  g.fillStyle = css(DOURADO)
  g.beginPath()
  for (let i = 0; i < 4; i++) {
    const a = giro * 0.8 + i * 1.6 + 0.5 + sorteio(semente, 30 + i) * 0.7
    const d = 0.18 + 0.17 * sorteio(semente, 40 + i)
    folhinha(g, Math.cos(a) * d, 0.04 + Math.sin(a) * d * 0.3, a * 1.7, 0.024)
  }
  g.fill()

  // O tronco: o corpo na sombra com as raízes, a faixa da luz à esquerda.
  const forquilha: Ponto = [inclina, -0.4]
  g.fillStyle = css(CASCA_SOMBRA)
  g.beginPath()
  g.moveTo(0, 0.022)
  g.lineTo(-0.1, 0.028)
  g.quadraticCurveTo(-0.046, 0.006, -0.042, -0.1)
  g.lineTo(-0.036 + inclina, forquilha[1])
  g.lineTo(0.04 + inclina, forquilha[1])
  g.lineTo(0.05, -0.1)
  g.quadraticCurveTo(0.056, 0.006, 0.11 + 0.03 * sorteio(semente, 50), 0.032)
  g.closePath()
  g.fill()
  g.fillStyle = css(CASCA_CLARA)
  g.beginPath()
  g.moveTo(-0.004, 0.022)
  g.lineTo(-0.1, 0.028)
  g.quadraticCurveTo(-0.046, 0.006, -0.042, -0.1)
  g.lineTo(-0.036 + inclina, forquilha[1])
  g.lineTo(-0.006 + inclina, forquilha[1])
  g.closePath()
  g.fill()
  // Os dois galhos que abrem da forquilha para os cachos de baixo.
  g.fillStyle = css(CASCA)
  g.beginPath()
  galho(g, forquilha, [-0.1, -0.5], [-0.2, -0.58], 0.03, 0.012)
  galho(g, forquilha, [0.1, -0.5], [0.21, -0.57], 0.03, 0.012)
  g.fill()

  // A sombra da copa por baixo dos cachos de baixo, pousando no tronco.
  g.fillStyle = css(COPA_SOMBRA)
  circulos(g, [...lobulos(-0.22, -0.5, 0.17, giro + 3, semente * 5 + 9), ...lobulos(0.26, -0.48, 0.16, giro + 4, semente * 5 + 8), [0.02, -0.5, 0.09]])

  CACHOS.forEach((c, i) => {
    const x = c.x + Math.cos(giro + i * 2.2) * 0.02
    const y = c.y + Math.sin(giro + i * 2.2) * 0.018
    const r = c.r * (0.93 + 0.14 * sorteio(semente, 60 + i))
    const tons = familia(i)
    const lobos = giro + i * 2.1
    const s = semente * 5 + i
    g.fillStyle = css(luz(tons.escuro, c.luz))
    circulos(g, lobulos(x, y, r, lobos, s))
    g.fillStyle = css(luz(tons.medio, c.luz))
    circulos(g, lobulos(x - r * 0.12, y - r * 0.16, r * 0.76, lobos, s))
    g.fillStyle = css(luz(tons.claro, c.luz))
    circulos(g, lobulos(x - r * 0.34, y - r * 0.38, r * 0.38, lobos, s))
  })

  // Duas folhas caindo, do lado da copa (paradas no ar: o carimbo não mexe).
  g.fillStyle = css(LARANJA)
  g.beginPath()
  const lado = Math.cos(giro + 1.3) >= 0 ? 1 : -1
  folhinha(g, lado * (0.42 + 0.04 * sorteio(semente, 70)), -0.36, giro + 0.8, 0.028)
  folhinha(g, lado * (0.34 + 0.05 * sorteio(semente, 71)), -0.2, giro + 2.2, 0.024)
  g.fill()
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'arvore-de-outono',
  nome: 'Árvore de outono',
  tamanho: 15,
  sombra: 'em-pe',
  desenhar: desenharArvoreDeOutono,
}

/** Todas as cores chapadas do desenho (os tons do meio dos cachos saem da mistura delas). */
export const paleta: readonly Rgb[] = [CASCA_CLARA, CASCA, CASCA_SOMBRA, COPA_SOMBRA, VERMELHO_ESCURO, VERMELHO, LARANJA, DOURADO, DOURADO_CLARO]
