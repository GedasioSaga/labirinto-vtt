import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Raiz retorcida (item 149 da lista de 14/11/2026, Pântano e fantasia): duas
 * raízes grossas TORCIDAS uma na outra, como corda, deitadas no chão. Saem
 * juntas de um monte de terra numa ponta, se enroscam três ou quatro vezes
 * (cada cruzamento com a de cima por cima, alternando, e a beira escura
 * separando as duas) e na outra ponta se abrem, afinam e afundam cada uma
 * num punhado de terra. Uma ou duas radículas finas escapam para o lado. Às
 * vezes tem musgo no monte de onde saem (o pântano).
 *
 * Deitada como o tronco caído: o giro aponta a raiz para qualquer lado, o
 * comprimento encolhe quando ela aponta para cima ou para baixo (o chão
 * visto um pouco de frente), a grossura não. A luz é a de sempre (de cima à
 * esquerda) e não gira: a faixa clara de cada pedaço fica no lado que olha
 * para ela, e anda suave de um lado para o outro quando a raiz faz a curva
 * (sem pulo de um pedaço para o outro).
 */

type Ponto = [number, number]

const RAIZ_CLARA: Rgb = [160, 122, 90]
const RAIZ: Rgb = [124, 90, 66]
const RAIZ_SOMBRA: Rgb = [92, 66, 52]
/** A beira escura das raízes (o contorno do jogo: escuro, nunca preto). */
const RAIZ_BORDA: Rgb = [66, 50, 44]
const TERRA: Rgb = [96, 78, 60]
const TERRA_CLARA: Rgb = [132, 108, 80]
const MUSGO: Rgb = [72, 116, 78]
const MUSGO_CLARO: Rgb = [108, 148, 94]

/** O quadro da raiz: o meio um pouco acima da base, e o chão achatado como o do tronco caído. */
const QUADRO = { y: -0.22, achata: 0.7, metade: 0.54 } as const
/** As duas raízes: a de cima mais grossa; a amplitude da torção e o quanto se abrem no fim. */
const FIOS = { grossa: 0.066, fina: 0.053, afina: 0.3, amplitude: 0.075, abre: 0.11 } as const
/** Amostras por meia volta da torção (cada cruzamento fica no meio de um pedaço). */
const PASSOS = 6
/** A beira escura: no máximo isto, e nunca mais que 40% da meia largura. */
const BORDA = 0.012
const LUZ_NO_PLANO = { x: -0.6, y: -0.8 } as const

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function suave(t: number): number {
  const k = Math.min(1, Math.max(0, t))
  return k * k * (3 - 2 * k)
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[]): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
}

/** Leva (u ao longo da raiz, v de través), no chão, para o quadro. */
function noQuadro(giro: number): (u: number, v: number) => Ponto {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  return (u, v) => [u * c - v * s, QUADRO.y + (u * s + v * c) * QUADRO.achata]
}

/** Uma raiz já na tela: a linha do meio, a meia largura, a normal e para que lado está a luz em cada ponto. */
interface Fio {
  pontos: Ponto[]
  larguras: number[]
  normais: Ponto[]
  /** De -0,55 (a luz bate no lado -normal) a 0,55 (no +normal). */
  luz: number[]
}

function fazerFio(pontos: Ponto[], larguras: number[]): Fio {
  const normais: Ponto[] = []
  const luz: number[] = []
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[Math.max(0, i - 1)]
    const b = pontos[Math.min(pontos.length - 1, i + 1)]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const n = Math.hypot(dx, dy) || 1
    const nx = -dy / n
    const ny = dx / n
    normais.push([nx, ny])
    luz.push(0.55 * (nx * LUZ_NO_PLANO.x + ny * LUZ_NO_PLANO.y))
  }
  return { pontos, larguras, normais, luz }
}

/** A faixa do fio de i0 a i1, entre as frações `de` e `ate` da meia largura (do lado -normal ao +normal). */
function faixa(fio: Fio, i0: number, i1: number, de: (i: number) => number, ate: (i: number) => number): Ponto[] {
  const ida: Ponto[] = []
  const volta: Ponto[] = []
  for (let i = i0; i <= i1; i++) {
    const [x, y] = fio.pontos[i]
    const [nx, ny] = fio.normais[i]
    const w = fio.larguras[i]
    ida.push([x + nx * w * de(i), y + ny * w * de(i)])
    volta.push([x + nx * w * ate(i), y + ny * w * ate(i)])
  }
  return [...ida, ...volta.reverse()]
}

const limitar = (x: number) => Math.min(1, Math.max(-1, x))

/** A beira escura do fio de i0 a i1 (um pouco mais larga que ele, dos dois lados). */
function pintarBorda(g: CanvasRenderingContext2D, fio: Fio, i0: number, i1: number): void {
  const aro = (i: number) => 1 + Math.min(BORDA, fio.larguras[i] * 0.4) / fio.larguras[i]
  g.fillStyle = css(RAIZ_BORDA)
  caminho(
    g,
    faixa(fio, i0, i1, (i) => -aro(i), aro),
  )
  g.fill()
}

/** O corpo do fio: a sombra inteira, a faixa da luz e, nos grossos, o brilho estreito por cima. */
function pintarCorpo(g: CanvasRenderingContext2D, fio: Fio, i0: number, i1: number, brilho: boolean): void {
  g.fillStyle = css(RAIZ_SOMBRA)
  caminho(
    g,
    faixa(fio, i0, i1, () => -1, () => 1),
  )
  g.fill()
  g.fillStyle = css(RAIZ)
  caminho(
    g,
    faixa(
      fio,
      i0,
      i1,
      (i) => limitar(fio.luz[i] - 0.45),
      (i) => limitar(fio.luz[i] + 0.45),
    ),
  )
  g.fill()
  if (!brilho) return
  g.fillStyle = css(RAIZ_CLARA)
  caminho(
    g,
    faixa(
      fio,
      i0,
      i1,
      (i) => limitar(fio.luz[i] * 1.45 - 0.16),
      (i) => limitar(fio.luz[i] * 1.45 + 0.16),
    ),
  )
  g.fill()
}

/** Vários ovais achatados como o chão num caminho só: o preenchimento é a união deles. */
function torroes(g: CanvasRenderingContext2D, cor: Rgb, x: number, y: number, r: number, lista: ReadonlyArray<readonly [number, number, number]>): void {
  const ry = r * QUADRO.achata
  g.fillStyle = css(cor)
  g.beginPath()
  for (const [dx, dy, k] of lista) {
    g.moveTo(x + dx * r + k * r, y + dy * ry)
    g.ellipse(x + dx * r, y + dy * ry, k * r, k * ry, 0, 0, Math.PI * 2)
  }
  g.fill()
}

/**
 * O monte de terra de onde as duas saem: torrões juntos, de borda torta (um
 * oval liso com o miolo claro parecia a ponta serrada de um cano), o alto de
 * cada um aceso à esquerda; às vezes coberto de musgo de um lado.
 */
function monte(g: CanvasRenderingContext2D, [x, y]: Ponto, r: number, giro: number, musgo: boolean): void {
  // Os torrões giram com o giro (a borda muda), a luz não.
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const torrao = (dx: number, dy: number, k: number): [number, number, number] => [dx * c - dy * s, dx * s + dy * c, k]
  const lista = [torrao(0, 0, 0.78), torrao(-0.55, 0.35, 0.5), torrao(0.4, 0.5, 0.48), torrao(0.1, -0.6, 0.46), torrao(-0.5, -0.4, 0.4)]
  torroes(g, TERRA, x, y, r, lista)
  torroes(
    g,
    TERRA_CLARA,
    x - r * 0.12,
    y - r * 0.14,
    r,
    lista.map(([dx, dy, k]) => [dx * 0.9 - 0.1, dy * 0.9 - 0.12, k * 0.55] as const),
  )
  if (!musgo) return
  torroes(g, MUSGO, x, y, r, [torrao(-0.25, -0.2, 0.5), torrao(0.25, -0.45, 0.42), torrao(-0.55, 0.15, 0.36)])
  torroes(g, MUSGO_CLARO, x - r * 0.1, y - r * 0.12, r, [torrao(-0.3, -0.25, 0.28), torrao(0.18, -0.5, 0.22)])
}

/** Onde a ponta afunda: um punhado de terra por cima dela, sem brilho (de longe some; de perto, a raiz entra no chão). */
function punhado(g: CanvasRenderingContext2D, [x, y]: Ponto, r: number, giro: number): void {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  torroes(g, TERRA, x, y, r, [
    [0, 0, 0.75],
    [0.5 * c, 0.5 * s, 0.5],
    [-0.45 * c + 0.2 * s, -0.45 * s - 0.2 * c, 0.45],
  ])
}

function desenharRaizRetorcida(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const ponto = noQuadro(giro)
  // Três ou quatro meias voltas; o arco da raiz inteira e qual delas começa por cima mudam com a semente.
  const voltas = sorteio(semente, 1) < 0.5 ? 3 : 4
  const amostras = voltas * PASSOS
  const arco = (sorteio(semente, 2) - 0.5) * 0.18
  const fase = sorteio(semente, 3) * Math.PI * 2
  const primeiraPorCima = sorteio(semente, 4) < 0.5 ? 0 : 1
  // No fim (meia volta exata), de que lado fica cada uma: as duas se abrem para fora.
  const ladoNoFim = voltas % 2 === 0 ? 1 : -1
  const ultimoCruzamento = 1 - 1 / (2 * voltas)

  const fio = (lado: 1 | -1, grossura: number): { fio: Fio; chao: Ponto[] } => {
    const chao: Ponto[] = []
    const pontos: Ponto[] = []
    const larguras: number[] = []
    for (let k = 0; k <= amostras; k++) {
      const t = k / amostras
      const teta = Math.PI / 2 + (k * Math.PI) / PASSOS
      const u = -QUADRO.metade + 2 * QUADRO.metade * t
      // Saem quase juntas do montinho e só depois abrem a torção inteira.
      const amplitude = FIOS.amplitude * (0.3 + 0.7 * suave(t / 0.3))
      const abre = lado * ladoNoFim * FIOS.abre * suave((t - ultimoCruzamento) / (1 - ultimoCruzamento))
      const v = arco * 4 * t * (1 - t) + lado * amplitude * Math.sin(teta) + abre
      chao.push([u, v])
      pontos.push(ponto(u, v))
      // Nós: a grossura incha e afina devagar ao longo da raiz.
      // A ponta que se abre afina de vez (raiz acaba fina, não rombuda).
      const ponta = 1 - 0.62 * suave((t - 0.76) / 0.24)
      larguras.push(grossura * (1 - FIOS.afina * t) * ponta * (1 + 0.14 * Math.sin(t * 17 + fase + lado)))
    }
    return { fio: fazerFio(pontos, larguras), chao }
  }
  const a = fio(1, FIOS.grossa)
  const b = fio(-1, FIOS.fina)

  // As radículas: finas, do lado de fora das voltas, por baixo de tudo.
  const radiculas = 1 + (sorteio(semente, 5) < 0.6 ? 1 : 0)
  for (let r = 0; r < radiculas; r++) {
    const m = 1 + ((r + Math.floor(sorteio(semente, 6) * 2)) % (voltas - 1))
    // Na meia volta m as duas estão no ponto mais aberto: cada uma é a de fora do seu lado.
    const daGrossa = sorteio(semente, 8 + r) < 0.5
    const lado = (daGrossa ? 1 : -1) * Math.sign(Math.sin(Math.PI / 2 + m * Math.PI))
    const [u0, v0] = (daGrossa ? a : b).chao[m * PASSOS]
    const sai = 0.75 + 0.5 * sorteio(semente, 10 + r)
    const comprimento = 0.15 + 0.07 * sorteio(semente, 12 + r)
    const para = sorteio(semente, 14 + r) < 0.5 ? 1 : -1
    const fim: Ponto = [u0 + para * Math.cos(sai) * comprimento, v0 + lado * Math.sin(sai) * comprimento]
    const meio: Ponto = [(u0 + fim[0]) / 2 + para * 0.05, (v0 + fim[1]) / 2 - lado * 0.02]
    const pontos: Ponto[] = []
    const larguras: number[] = []
    for (let i = 0; i <= PASSOS; i++) {
      const t = i / PASSOS
      const s = 1 - t
      pontos.push(ponto(s * s * u0 + 2 * s * t * meio[0] + t * t * fim[0], s * s * v0 + 2 * s * t * meio[1] + t * t * fim[1]))
      larguras.push(0.026 * (1 - 0.8 * t))
    }
    const radicula = fazerFio(pontos, larguras)
    pintarBorda(g, radicula, 0, PASSOS)
    pintarCorpo(g, radicula, 0, PASSOS, false)
  }

  // A beira escura das duas inteiras primeiro; depois cada cruzamento: a de baixo,
  // a beira da de cima só ali (separa as duas) e a de cima. Cada pedaço passa um
  // passo do seu (o vizinho de mesma cor cobre a emenda).
  pintarBorda(g, b.fio, 0, amostras)
  pintarBorda(g, a.fio, 0, amostras)
  for (let j = 0; j < voltas; j++) {
    const i0 = j * PASSOS
    const i1 = i0 + PASSOS
    const porCima = (j + primeiraPorCima) % 2 === 0 ? a : b
    const porBaixo = porCima === a ? b : a
    pintarCorpo(g, porBaixo.fio, Math.max(0, i0 - 1), Math.min(amostras, i1 + 1), porBaixo === a)
    pintarBorda(g, porCima.fio, i0 + 1, i1 - 1)
    pintarCorpo(g, porCima.fio, Math.max(0, i0 - 1), Math.min(amostras, i1 + 1), porCima === a)
  }

  // A terra por cima: o monte de onde as duas saem e um punhado na ponta de cada uma (a raiz afunda ali).
  monte(g, ponto(-QUADRO.metade - 0.03, 0), 0.12, giro + semente, sorteio(semente, 20) < 0.5)
  punhado(g, ponto(...a.chao[amostras]), 0.045, giro)
  punhado(g, ponto(...b.chao[amostras]), 0.04, giro + 1.3)
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'raiz-retorcida',
  nome: 'Raiz retorcida',
  tamanho: 10,
  sombra: 'deitada',
  desenhar: desenharRaizRetorcida,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [RAIZ_CLARA, RAIZ, RAIZ_SOMBRA, RAIZ_BORDA, TERRA, TERRA_CLARA, MUSGO, MUSGO_CLARO]
