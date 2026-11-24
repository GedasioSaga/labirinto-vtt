import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Palha espalhada (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"): a palha que se espalha pelo chão da
 * cela e do estábulo, fina e rente. Três ou quatro TUFOS pequenos, cada um um feixe de fios compridos que sai junto de
 * uma ponta e abre um pouco, e em volta os FIOS SOLTOS, deitados em todas as direções, quase todos com uma curva mansa
 * (uns poucos retos). Cor de feno: o feno quente, o claro e o escuro, sem amarelo vivo (o velho, acinzentado, saiu: a
 * mistura com ele virava cinza na areia).
 *
 * Cada fio é um traço fino com a sombra dele embaixo à direita (a luz vem de cima à esquerda e não gira) e, em alguns,
 * o fio de luz do lado de cima: é o que dá relevo sem contorno. Por baixo, uma mancha de poeira que junta os fios num
 * tufo só, também na terra (fraca demais, eles viravam riscos soltos na mesa). Rente ao chão, sem sombra própria, como
 * as folhas secas: fica por baixo das sombras dos outros. O giro gira o arranjo e cada fio; a semente escolhe quantos,
 * onde caem e as cores.
 */

const FENO: Rgb = [184, 156, 98]
const FENO_CLARO: Rgb = [204, 186, 134]
const FENO_ESCURO: Rgb = [136, 118, 80]
/** O fio de luz do lado de cima dos fios mais claros. */
const REALCE: Rgb = [222, 208, 162]
/** A sombra de cada fio e a poeira de baixo (as duas transparentes: o chão do mapa aparece). */
const SOMBRA_DO_FIO: Rgb = [84, 72, 52]
const POEIRA: Rgb = [124, 108, 80]

/** Quantos de cada cor (a soma é 1), sorteando de cima para baixo. */
const MISTURA: ReadonlyArray<readonly [Rgb, number]> = [
  [FENO, 0.44],
  [FENO_CLARO, 0.3],
  [FENO_ESCURO, 0.26],
]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

type Ponto = readonly [number, number]

/** O chão visto de cima e um pouco de frente (o das folhas secas). */
const ACHATA = 0.6
/** O meio da palha no quadro e o raio dela no chão. */
const CENTRO_Y = -0.1
const RAIO = 0.4
/**
 * A largura do fio (unidades do quadro) e a sombra dele: para onde cai e quanto escurece. Fino como palha: com 0,019 e
 * curtos, os fios liam como gravetos. Na areia, quem segura a cor é o feno quente e a poeira de baixo, que junta os
 * fios num tufo. A sombra anda com a largura (cerca de um terço dela).
 */
const LARGURA_DO_FIO = 0.012
const SOMBRA = { dx: 0.0045, dy: 0.004, alfa: 0.34 } as const
/** O comprimento dos fios soltos e dos fios dos tufos (de, mais até): o dobro do primeiro desenho. */
const FIO_SOLTO = { de: 0.18, aMais: 0.3 } as const
const FIO_DO_TUFO = { de: 0.24, aMais: 0.2 } as const
/** A curva mansa: a parte dos fios que curva e quanto o meio sai para o lado, em frações do comprimento. */
const CURVA = { parte: 0.8, de: 0.05, aMais: 0.07, reta: 0.015 } as const
/** A poeira que junta os fios e o pé de cada tufo (o alfa de cada um). */
const ALFA_DA_POEIRA = 0.26
const ALFA_DO_PE = 0.24

/** Do chão (x para a direita, z para quem vê) para o quadro. */
function noChao(x: number, z: number): Ponto {
  return [x, CENTRO_Y + z * ACHATA]
}

function corSorteada(t: number): Rgb {
  let soma = 0
  for (const [cor, parte] of MISTURA) {
    soma += parte
    if (t < soma) return cor
  }
  return MISTURA[0][0]
}

interface Fio {
  /** O meio do fio no chão. */
  x: number
  z: number
  /** Para onde ele aponta, no chão. */
  rumo: number
  comprimento: number
  /** Quanto o meio do fio sai para o lado (a curva). */
  curva: number
  largura: number
  cor: Rgb
  realce: boolean
}

/** Um traço do fio, deslocado (dx, dy) no quadro: a curva de uma ponta à outra pelo meio puxado para o lado. */
function tracar(g: CanvasRenderingContext2D, f: Fio, dx: number, dy: number): void {
  const meia = f.comprimento / 2
  const [cx, sz] = [Math.cos(f.rumo), Math.sin(f.rumo)]
  const a = noChao(f.x - cx * meia, f.z - sz * meia)
  const b = noChao(f.x + cx * meia, f.z + sz * meia)
  const m = noChao(f.x - sz * f.curva, f.z + cx * f.curva)
  g.beginPath()
  g.moveTo(a[0] + dx, a[1] + dy)
  g.quadraticCurveTo(m[0] + dx, m[1] + dy, b[0] + dx, b[1] + dy)
  g.stroke()
}

/** O fio: a sombra embaixo à direita, o corpo e, nos claros, o fio de luz do lado de cima. */
function desenharFio(g: CanvasRenderingContext2D, f: Fio): void {
  g.strokeStyle = css(SOMBRA_DO_FIO, SOMBRA.alfa)
  g.lineWidth = f.largura * 1.3
  tracar(g, f, SOMBRA.dx, SOMBRA.dy)
  g.strokeStyle = css(f.cor)
  g.lineWidth = f.largura
  tracar(g, f, 0, 0)
  if (!f.realce) return
  g.strokeStyle = css(REALCE, 0.75)
  g.lineWidth = f.largura * 0.42
  tracar(g, f, -f.largura * 0.22, -f.largura * 0.26)
}

/** A curva do fio: quase todos com o meio saindo um pouco para um lado (o fio de palha seco enverga); uns poucos retos. */
function curvaMansa(semente: number, i: number, comprimento: number): number {
  const quanto = sorteio(semente, i + 8000)
  if (sorteio(semente, i + 6000) >= CURVA.parte) return (quanto - 0.5) * 2 * CURVA.reta * comprimento
  const lado = sorteio(semente, i + 7000) < 0.5 ? -1 : 1
  return lado * comprimento * (CURVA.de + CURVA.aMais * quanto)
}

/** Os fios soltos, numa espiral sorteada: cobre a mancha sem buraco nem bolo, mais ralos na beira. */
function fiosSoltos(giro: number, semente: number): Fio[] {
  const n = 39 + Math.floor(sorteio(semente, 0) * 12)
  const lista: Fio[] = []
  for (let i = 0; i < n; i++) {
    const a = giro + i * 2.39996 + sorteio(semente, 1 + i) * 0.6
    const d = RAIO * Math.min(1, Math.pow((i + 0.5) / n, 0.55) * (0.82 + 0.28 * sorteio(semente, 40 + i)))
    const cor = corSorteada(sorteio(semente, 80 + i))
    const comprimento = FIO_SOLTO.de + FIO_SOLTO.aMais * sorteio(semente, 160 + i)
    lista.push({
      x: Math.cos(a) * d,
      z: Math.sin(a) * d,
      rumo: giro + sorteio(semente, 120 + i) * Math.PI * 2,
      comprimento,
      curva: curvaMansa(semente, 200 + i, comprimento),
      largura: LARGURA_DO_FIO * (0.85 + 0.3 * sorteio(semente, 240 + i)),
      cor,
      realce: cor === FENO_CLARO || cor === FENO,
    })
  }
  // Os de fora primeiro: os do meio ficam por cima.
  return lista.reverse()
}

interface Tufo {
  x: number
  z: number
  fios: Fio[]
}

/** Os tufos: cada um um feixe de fios que sai junto da raiz e abre um pouco para a ponta. */
function tufos(giro: number, semente: number): Tufo[] {
  const n = 3 + Math.floor(sorteio(semente, 300) * 2)
  const lista: Tufo[] = []
  for (let t = 0; t < n; t++) {
    const a = giro + (t / n) * Math.PI * 2 + (sorteio(semente, 310 + t) - 0.5) * 0.9
    // A raiz fica mais perto do meio que antes: os fios, o dobro mais compridos, não podem sair do quadro.
    const d = RAIO * (0.15 + 0.35 * sorteio(semente, 320 + t))
    const [tx, tz] = [Math.cos(a) * d, Math.sin(a) * d]
    const rumo = giro + sorteio(semente, 330 + t) * Math.PI * 2
    const quantos = 10 + Math.floor(sorteio(semente, 340 + t) * 6)
    const fios: Fio[] = []
    for (let i = 0; i < quantos; i++) {
      const j = 400 + t * 40 + i
      const r = rumo + (sorteio(semente, j) - 0.5) * 0.55
      const comprimento = FIO_DO_TUFO.de + FIO_DO_TUFO.aMais * sorteio(semente, j + 1000)
      // A raiz fica junto (um pouco espalhada de través); o fio abre a partir dela.
      const lado = (sorteio(semente, j + 2000) - 0.5) * 0.03
      const [rx, rz] = [tx - Math.sin(rumo) * lado, tz + Math.cos(rumo) * lado]
      const cor = corSorteada(sorteio(semente, j + 3000))
      fios.push({
        x: rx + (Math.cos(r) * comprimento) / 2,
        z: rz + (Math.sin(r) * comprimento) / 2,
        rumo: r,
        comprimento,
        curva: curvaMansa(semente, j + 4000, comprimento),
        largura: LARGURA_DO_FIO * (0.9 + 0.25 * sorteio(semente, j + 5000)),
        cor,
        realce: cor !== FENO_ESCURO,
      })
    }
    lista.push({ x: tx + (Math.cos(rumo) * 0.08) / 2, z: tz + (Math.sin(rumo) * 0.08) / 2, fios })
  }
  return lista
}

/** A poeira de baixo: uma mancha mansa e torta que amarra os fios numa coisa só. */
function desenharPoeira(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.fillStyle = css(POEIRA, ALFA_DA_POEIRA)
  g.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = giro + (i * Math.PI * 2) / 6 + (sorteio(semente, 500 + i) - 0.5) * 0.7
    const d = RAIO * (0.25 + 0.25 * sorteio(semente, 510 + i))
    const r = RAIO * (0.28 + 0.14 * sorteio(semente, 520 + i))
    const [x, y] = noChao(Math.cos(a) * d, Math.sin(a) * d)
    g.moveTo(x + r, y)
    g.ellipse(x, y, r, r * ACHATA, 0, 0, Math.PI * 2)
  }
  g.fill()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.save()
  g.lineCap = 'round'
  desenharPoeira(g, giro, semente)
  const soltos = fiosSoltos(giro, semente)
  // Os soltos de fora vão por baixo dos tufos; os do meio, por cima.
  const metade = Math.floor(soltos.length * 0.6)
  for (const f of soltos.slice(0, metade)) desenharFio(g, f)
  for (const t of tufos(giro, semente)) {
    // O pé do tufo, um pouco mais escuro: a palha junta faz sombra nela mesma.
    const [x, y] = noChao(t.x, t.z)
    g.fillStyle = css(SOMBRA_DO_FIO, ALFA_DO_PE)
    g.beginPath()
    g.ellipse(x, y, 0.1, 0.1 * ACHATA, 0, 0, Math.PI * 2)
    g.fill()
    for (const f of t.fios) desenharFio(g, f)
  }
  for (const f of soltos.slice(metade)) desenharFio(g, f)
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'palha-espalhada', nome: 'Palha espalhada', tamanho: 9, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [FENO, FENO_CLARO, FENO_ESCURO, REALCE, SOMBRA_DO_FIO, POEIRA]
