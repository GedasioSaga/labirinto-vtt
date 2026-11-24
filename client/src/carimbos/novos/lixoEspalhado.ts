import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Lixo espalhado (item 89 dos objetos de 24/11/2026, lote L09 "Cortiço"): o lixo miúdo que se junta na rua de lama e em
 * volta das casas. Um TRAPO amarrotado, CACOS de barro e de louça, PAPEL (uma bola amassada e um pedaço rasgado), uma
 * LATA deitada com ferrugem e os farelos em volta, tudo em cores APAGADAS (o vinho, o azul e o ocre desbotados, o barro
 * sem brilho), em cima de uma mancha de poeira bem transparente que amarra as peças numa coisa só.
 *
 * Rente ao chão, como a palha espalhada: cada peça tem a sombrinha dela embaixo à direita (a luz vem de cima à esquerda e
 * não gira) e um fio de luz na beira de cima, sem contorno grosso; o carimbo não tem sombra própria. O giro gira o
 * arranjo e cada peça; a semente escolhe quantas de cada, onde caem, as cores e qual lata ou papel sai.
 */

const POEIRA: Rgb = [112, 98, 78]
const SOMBRA: Rgb = [62, 52, 40]
/** Os panos desbotados do trapo. */
const PANOS: readonly Rgb[] = [
  [128, 84, 76],
  [92, 104, 118],
  [150, 128, 90],
]
/** O barro do caco de telha e de pote, a louça encardida e a beira de cada um. */
const BARRO: Rgb = [156, 104, 78]
const LOUCA: Rgb = [190, 184, 168]
const VIDRO: Rgb = [118, 134, 120]
/** O papel velho, a dobra dele e a lata com a ferrugem. */
const PAPEL: Rgb = [204, 196, 174]
const DOBRA_DO_PAPEL: Rgb = [164, 154, 132]
const LATA: Rgb = [126, 124, 118]
const LATA_CLARA: Rgb = [178, 176, 168]
const FERRUGEM: Rgb = [138, 90, 60]
/** Os farelos: terra, palha e carvão. */
const FARELOS: readonly Rgb[] = [
  [96, 84, 66],
  [164, 146, 104],
  [70, 64, 58],
]
/** O fio de luz das beiras (misturado à cor de cada peça) e o escuro das dobras. */
const LUZ: Rgb = [232, 226, 206]
const ESCURO: Rgb = [40, 34, 28]

/** O chão visto de cima e um pouco de frente (o das folhas secas e da palha). */
const ACHATA = 0.6
const CENTRO_Y = -0.12
const RAIO = 0.46
/** A sombrinha de cada peça: para onde cai e quanto escurece. */
const SOMBRINHA = { dx: 0.012, dy: 0.01, alfa: 0.34 } as const

type Ponto = readonly [number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Do chão (x para a direita, z para quem vê) para o quadro. */
function noChao(x: number, z: number): Ponto {
  return [x, CENTRO_Y + z * ACHATA]
}

/** Uma peça no chão: onde cai (no chão), o giro dela e o tamanho. */
interface Lugar {
  x: number
  z: number
  rumo: number
  escala: number
}

/** Os pontos (no chão, em volta do lugar) girados pelo rumo e postos no quadro. */
function contorno(l: Lugar, pontos: readonly Ponto[]): Ponto[] {
  const [co, si] = [Math.cos(l.rumo), Math.sin(l.rumo)]
  return pontos.map(([px, pz]) => noChao(l.x + (px * co - pz * si) * l.escala, l.z + (px * si + pz * co) * l.escala))
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[], dx = 0, dy = 0): void {
  g.beginPath()
  g.moveTo(pontos[0][0] + dx, pontos[0][1] + dy)
  for (const [x, y] of pontos.slice(1)) g.lineTo(x + dx, y + dy)
  g.closePath()
}

/** A peça chapada: a sombrinha, o corpo e o fio de luz na beira de cima à esquerda. */
function pintarChapada(g: CanvasRenderingContext2D, pontos: readonly Ponto[], cor: Rgb, luz = 0.4): void {
  g.fillStyle = css(SOMBRA, SOMBRINHA.alfa)
  caminho(g, pontos, SOMBRINHA.dx, SOMBRINHA.dy)
  g.fill()
  g.fillStyle = css(cor)
  caminho(g, pontos)
  g.fill()
  g.save()
  g.clip()
  g.strokeStyle = css(misturar(cor, LUZ, luz), 0.8)
  g.lineWidth = 0.012
  caminho(g, pontos, 0.004, 0.005)
  g.stroke()
  g.restore()
}

/** Um polígono mole em volta da origem: `n` pontas com o raio sorteado entre `r0` e `r1`. */
function amassado(semente: number, i: number, n: number, r0: number, r1: number): Ponto[] {
  return Array.from({ length: n }, (_, j): Ponto => {
    const a = (j / n) * Math.PI * 2 + (sorteio(semente, i + j) - 0.5) * 0.5
    const r = r0 + (r1 - r0) * sorteio(semente, i + 40 + j)
    return [Math.cos(a) * r, Math.sin(a) * r]
  })
}

/** O TRAPO amarrotado: o pano, duas dobras escuras e a ponta virada, mais clara. */
function trapo(g: CanvasRenderingContext2D, l: Lugar, semente: number, i: number): void {
  const cor = PANOS[Math.floor(sorteio(semente, i) * PANOS.length)]
  pintarChapada(g, contorno(l, amassado(semente, i * 10, 9, 0.07, 0.115)), cor, 0.35)
  g.strokeStyle = css(misturar(cor, ESCURO, 0.4), 0.55)
  g.lineWidth = 0.011
  g.lineCap = 'round'
  for (const [a, b] of [[[-0.07, -0.02], [0.05, 0.015]], [[-0.03, 0.04], [0.06, 0.05]]] as const) {
    const [p, q] = contorno(l, [a, b])
    g.beginPath()
    g.moveTo(p[0], p[1])
    g.quadraticCurveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 0.012, q[0], q[1])
    g.stroke()
  }
  g.fillStyle = css(misturar(cor, LUZ, 0.22))
  caminho(g, contorno(l, [[0.04, -0.07], [0.1, -0.06], [0.07, -0.02]]))
  g.fill()
}

/** Um CACO: o triângulo torto, a beira grossa clara de um lado (a borda do pote) e a sombrinha. */
function caco(g: CanvasRenderingContext2D, l: Lugar, semente: number, i: number): void {
  const t = sorteio(semente, i)
  const cor = t < 0.55 ? BARRO : t < 0.85 ? LOUCA : VIDRO
  const pontos = contorno(l, [[-0.05, -0.02], [0.045, -0.035], [0.035 + 0.02 * sorteio(semente, i + 1), 0.03], [-0.02, 0.035]])
  pintarChapada(g, pontos, cor, cor === VIDRO ? 0.55 : 0.4)
  const [a, b] = [pontos[0], pontos[1]]
  g.strokeStyle = css(misturar(cor, LUZ, 0.35))
  g.lineWidth = 0.014
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(a[0], a[1])
  g.lineTo(b[0], b[1])
  g.stroke()
}

/** O PAPEL: a bola amassada (com as dobras) ou o pedaço rasgado, chapado, com a dobra do meio. */
function papel(g: CanvasRenderingContext2D, l: Lugar, semente: number, i: number): void {
  if (sorteio(semente, i) < 0.5) {
    pintarChapada(g, contorno(l, amassado(semente, i * 7, 8, 0.042, 0.058)), PAPEL, 0.3)
    g.strokeStyle = css(DOBRA_DO_PAPEL, 0.8)
    g.lineWidth = 0.008
    g.lineCap = 'round'
    for (const [a, b] of [[[-0.03, -0.01], [0.02, 0.02]], [[0, -0.035], [0.012, 0.01]], [[0.025, -0.02], [-0.01, 0.03]]] as const) {
      const [p, q] = contorno(l, [a, b])
      g.beginPath()
      g.moveTo(p[0], p[1])
      g.lineTo(q[0], q[1])
      g.stroke()
    }
    return
  }
  const rasgado: Ponto[] = [[-0.08, -0.05], [0.07, -0.06], [0.08, 0.0], [0.06, 0.02], [0.075, 0.05], [-0.07, 0.055]]
  pintarChapada(g, contorno(l, rasgado), PAPEL, 0.3)
  const [p, q] = contorno(l, [[-0.005, -0.055], [0.0, 0.052]])
  g.strokeStyle = css(DOBRA_DO_PAPEL, 0.7)
  g.lineWidth = 0.009
  g.beginPath()
  g.moveTo(p[0], p[1])
  g.lineTo(q[0], q[1])
  g.stroke()
}

/** A LATA deitada: o corpo (claro em cima, escuro embaixo), a tampa redonda na ponta, a ferrugem e um amassado. */
function lata(g: CanvasRenderingContext2D, l: Lugar, semente: number, i: number): void {
  const corpo = contorno(l, [[-0.075, -0.042], [0.07, -0.042], [0.07, 0.042], [-0.075, 0.042]])
  pintarChapada(g, corpo, LATA, 0.2)
  g.fillStyle = css(LATA_CLARA, 0.7)
  caminho(g, contorno(l, [[-0.07, -0.034], [0.066, -0.034], [0.066, -0.012], [-0.07, -0.012]]))
  g.fill()
  g.fillStyle = css(ESCURO, 0.22)
  caminho(g, contorno(l, [[-0.07, 0.018], [0.066, 0.018], [0.066, 0.038], [-0.07, 0.038]]))
  g.fill()
  g.fillStyle = css(FERRUGEM, 0.75)
  caminho(g, contorno(l, amassado(semente, i * 3 + 90, 7, 0.012, 0.024).map(([x, z]): Ponto => [x - 0.02, z + 0.012])))
  g.fill()
  // A tampa: a elipse na ponta da direita, com o aro claro e o fundo mais escuro.
  const [cx, cy] = contorno(l, [[0.072, 0]])[0]
  const ang = Math.atan2(Math.sin(l.rumo) * ACHATA, Math.cos(l.rumo))
  g.fillStyle = css(misturar(LATA, ESCURO, 0.2))
  g.beginPath()
  g.ellipse(cx, cy, 0.022 * l.escala, 0.04 * l.escala * (0.7 + 0.3 * Math.abs(Math.cos(l.rumo))), ang, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = css(LATA_CLARA, 0.85)
  g.lineWidth = 0.008
  g.stroke()
}

/** A mancha de poeira de baixo: mansa e torta, amarra as peças. */
function poeira(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.fillStyle = css(POEIRA, 0.13)
  g.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = giro + (i * Math.PI * 2) / 6 + (sorteio(semente, 500 + i) - 0.5) * 0.7
    const d = RAIO * (0.2 + 0.3 * sorteio(semente, 510 + i))
    const r = RAIO * (0.26 + 0.14 * sorteio(semente, 520 + i))
    const [x, y] = noChao(Math.cos(a) * d, Math.sin(a) * d)
    g.moveTo(x + r, y)
    g.ellipse(x, y, r, r * ACHATA, 0, 0, Math.PI * 2)
  }
  g.fill()
}

/** Os lugares das peças, numa espiral sorteada: espalhados sem amontoar nem deixar buraco grande no meio. */
function lugares(n: number, giro: number, semente: number): Lugar[] {
  return Array.from({ length: n }, (_, i): Lugar => {
    const a = giro + i * 2.39996 + sorteio(semente, 600 + i) * 0.5
    const d = RAIO * Math.min(0.92, Math.pow((i + 0.6) / n, 0.6) * (0.78 + 0.3 * sorteio(semente, 620 + i)))
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, rumo: giro + sorteio(semente, 640 + i) * Math.PI * 2, escala: 0.9 + 0.25 * sorteio(semente, 660 + i) }
  })
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.save()
  poeira(g, giro, semente)
  // Os farelos primeiro (por baixo de tudo).
  for (let i = 0; i < 12; i++) {
    const a = giro + sorteio(semente, 700 + i) * Math.PI * 2
    const d = RAIO * (0.15 + 0.85 * sorteio(semente, 720 + i))
    const [x, y] = noChao(Math.cos(a) * d, Math.sin(a) * d)
    g.fillStyle = css(FARELOS[i % FARELOS.length], 0.85)
    g.beginPath()
    g.ellipse(x, y, 0.011 + 0.008 * sorteio(semente, 740 + i), 0.008, giro + i, 0, Math.PI * 2)
    g.fill()
  }
  // Quantas de cada: sempre um trapo, uma lata ou um papel grande; o resto, cacos e papel.
  const pecas: Array<(g: CanvasRenderingContext2D, l: Lugar, semente: number, i: number) => void> = [trapo, caco, papel, caco]
  if (sorteio(semente, 800) > 0.3) pecas.push(lata)
  if (sorteio(semente, 801) > 0.4) pecas.push(caco)
  if (sorteio(semente, 802) > 0.5) pecas.push(papel)
  if (sorteio(semente, 803) > 0.6) pecas.push(trapo)
  const onde = lugares(pecas.length, giro, semente)
  // As de trás (de cima no quadro) primeiro: a de baixo cobre a beira da de cima.
  const ordem = pecas.map((p, i) => ({ p, l: onde[i], i })).sort((a, b) => a.l.z - b.l.z)
  for (const { p, l, i } of ordem) p(g, l, semente, 900 + i * 13)
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'lixo-espalhado', nome: 'Lixo espalhado', tamanho: 8, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [POEIRA, SOMBRA, ...PANOS, BARRO, LOUCA, VIDRO, PAPEL, DOBRA_DO_PAPEL, LATA, LATA_CLARA, FERRUGEM, ...FARELOS]
