import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Lixo espalhado (item 89 dos objetos de 24/11/2026, lote L09 "Cortiço"): o lixo miúdo que se junta na rua de lama e em
 * volta das casas. Uma peça ÂNCORA, grande (um quarto de casa): o TRAPO amarrotado ou a LATA deitada com ferrugem; e,
 * ARRASTADAS para um lado só (a enxurrada ou o vento levou), de três a cinco peças menores, cada vez menores longe dela:
 * CACOS de barro e de louça, PAPEL (uma bola amassada ou um pedaço rasgado), um retalho, e uns farelos no rastro. Tudo em
 * cores APAGADAS (o vinho, o cinza-azulado e o ocre desbotados, o barro sem brilho), em cima de uma mancha de poeira bem
 * transparente e de beira torta, comprida no rumo do rastro, que amarra as peças numa coisa só.
 *
 * Rente ao chão, como a palha espalhada: cada peça tem a sombrinha dela embaixo à direita (a luz vem de cima à esquerda e
 * não gira) e um fio de luz na beira de cima, sem contorno grosso; o carimbo não tem sombra própria. O giro gira o
 * arranjo e cada peça; a semente escolhe a âncora, para que lado vai o rastro, quantas peças e quais, e as cores.
 */

const POEIRA: Rgb = [112, 98, 78]
const SOMBRA: Rgb = [62, 52, 40]
/** Os panos desbotados do trapo. */
const PANOS: readonly Rgb[] = [
  [128, 84, 76],
  [110, 114, 118],
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
/** A poeira: metade da força de antes (lia anel), com a beira torta em tantos pontos. */
const ALFA_DA_POEIRA = 0.065
const PONTOS_DA_POEIRA = 22
/** A âncora (um quarto de casa: o trapo grande ou a lata maior), o retalho do rastro e o leque do rastro (radianos). */
const ESCALA_DO_TRAPO_ANCORA = 0.95
const ESCALA_DA_LATA_ANCORA = 1.35
const ESCALA_DO_RETALHO = 0.5
const LEQUE_DO_RASTRO = 0.9
/** Os farelos, só no rastro. */
const FARELOS_NO_RASTRO = 5

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

/**
 * A mancha de poeira de baixo: um borrão só, bem transparente, comprido no rumo do rastro e de beira torta (três ondas
 * sorteadas no raio), que amarra as peças sem desenhar anel nem oval.
 */
function poeira(g: CanvasRenderingContext2D, rumo: number, semente: number): void {
  const [ux, uz] = [Math.cos(rumo), Math.sin(rumo)]
  const fases = [0, 1, 2].map((i) => sorteio(semente, 500 + i) * Math.PI * 2)
  g.fillStyle = css(POEIRA, ALFA_DA_POEIRA)
  g.beginPath()
  for (let i = 0; i < PONTOS_DA_POEIRA; i++) {
    const t = (i / PONTOS_DA_POEIRA) * Math.PI * 2
    const torto = 1 + 0.2 * Math.sin(3 * t + fases[0]) + 0.13 * Math.sin(5 * t + fases[1]) + 0.08 * Math.sin(8 * t + fases[2])
    const [al, at] = [Math.cos(t) * RAIO * 0.62 * torto, Math.sin(t) * RAIO * 0.36 * torto]
    const [x, y] = noChao(ux * (al + RAIO * 0.12) - uz * at, uz * (al + RAIO * 0.12) + ux * at)
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.closePath()
  g.fill()
}

/** Uma peça a desenhar: a função dela e a escala (a âncora inteira; as do rastro, menores). */
type DesenhoDaPeca = (g: CanvasRenderingContext2D, l: Lugar, semente: number, i: number) => void

/**
 * O arranjo: a ÂNCORA um pouco para trás do meio e o RASTRO das menores, todas para o mesmo lado dela (num leque
 * estreito em volta do `rumo`), cada vez mais longe e menores.
 */
function arranjo(n: number, rumo: number, giro: number, semente: number): { ancora: Lugar; rastro: Lugar[] } {
  const [ux, uz] = [Math.cos(rumo), Math.sin(rumo)]
  const ancora: Lugar = { x: -ux * RAIO * 0.3, z: -uz * RAIO * 0.3, rumo: giro + sorteio(semente, 611) * Math.PI * 2, escala: 1 }
  const rastro = Array.from({ length: n }, (_, i): Lugar => {
    const longe = RAIO * (0.42 + 0.62 * ((i + 0.35 + 0.4 * sorteio(semente, 620 + i)) / n))
    const a = rumo + (sorteio(semente, 630 + i) - 0.5) * LEQUE_DO_RASTRO
    return {
      x: ancora.x + Math.cos(a) * longe,
      z: ancora.z + Math.sin(a) * longe,
      rumo: giro + sorteio(semente, 640 + i) * Math.PI * 2,
      escala: 0.86 - (0.3 * i) / n,
    }
  })
  return { ancora, rastro }
}

/** O retalho: um trapo pequeno no rastro. */
function retalho(g: CanvasRenderingContext2D, l: Lugar, semente: number, i: number): void {
  trapo(g, { ...l, escala: l.escala * ESCALA_DO_RETALHO }, semente, i)
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.save()
  // Para que lado o rastro foi arrastado: o giro e um tanto sorteado.
  const rumo = giro + (sorteio(semente, 610) - 0.5) * 0.8
  poeira(g, rumo, semente)
  // A âncora (o trapo ou a lata) e as menores do rastro, de três a cinco.
  const ancoraEhTrapo = sorteio(semente, 800) > 0.45
  const doRastro: DesenhoDaPeca[] = [caco, papel, caco]
  if (sorteio(semente, 801) > 0.35) doRastro.push(ancoraEhTrapo ? papel : retalho)
  if (sorteio(semente, 802) > 0.6) doRastro.push(caco)
  const { ancora, rastro } = arranjo(doRastro.length, rumo, giro, semente)
  // Os farelos no rastro (por baixo de tudo), entre a âncora e a última peça.
  for (let i = 0; i < FARELOS_NO_RASTRO; i++) {
    const longe = RAIO * (0.3 + 0.75 * sorteio(semente, 720 + i))
    const a = rumo + (sorteio(semente, 700 + i) - 0.5) * LEQUE_DO_RASTRO * 1.2
    const [x, y] = noChao(ancora.x + Math.cos(a) * longe, ancora.z + Math.sin(a) * longe)
    g.fillStyle = css(FARELOS[i % FARELOS.length], 0.85)
    g.beginPath()
    g.ellipse(x, y, 0.01 + 0.007 * sorteio(semente, 740 + i), 0.007, giro + i, 0, Math.PI * 2)
    g.fill()
  }
  const pecas: { p: DesenhoDaPeca; l: Lugar; i: number }[] = [
    { p: ancoraEhTrapo ? trapo : lata, l: { ...ancora, escala: ancoraEhTrapo ? ESCALA_DO_TRAPO_ANCORA : ESCALA_DA_LATA_ANCORA }, i: 0 },
    ...doRastro.map((p, i) => ({ p, l: rastro[i], i: i + 1 })),
  ]
  // As de trás (de cima no quadro) primeiro: a de baixo cobre a beira da de cima.
  for (const { p, l, i } of [...pecas].sort((a, b) => a.l.z - b.l.z)) p(g, l, semente, 900 + i * 13)
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'lixo-espalhado', nome: 'Lixo espalhado', tamanho: 8, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [POEIRA, SOMBRA, ...PANOS, BARRO, LOUCA, VIDRO, PAPEL, DOBRA_DO_PAPEL, LATA, LATA_CLARA, FERRUGEM, ...FARELOS]
