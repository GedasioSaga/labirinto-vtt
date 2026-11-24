import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Mato na fresta (item 90 dos objetos de 24/11/2026, lote L09 "Cortiço"): o capim ralo e SECO que nasce no pé do muro,
 * entre as pedras da calçada e na fresta da parede. Dois ou três tufos baixos que saem da mesma FRESTA curta (o escuro
 * do próprio chão, afinando nas duas pontas, com um pouco de terra solta na boca e a beira de baixo pegando a luz); cada
 * tufo tem de oito a catorze folhas FINAS como fio, curvas, de comprimentos desencontrados, umas em pé, outras deitadas
 * para os lados e algumas QUEBRADAS na ponta, caídas. A cor vai da palha queimada ao oliva seco e ao cinza esverdeado,
 * nunca o verde vivo do capim alto. Os PENDÕES de semente, mais altos e mais claros que as folhas, com os grãos à mostra,
 * são o que se lê de longe; e uma folha quebrada caída no chão.
 *
 * A luz vem de cima à esquerda e não gira: as folhas do lado esquerdo do tufo e o lado esquerdo da espiga são mais
 * claros. O giro inclina o tufo e espalha os tufos ao longo da fresta; a semente escolhe quantos tufos, as alturas, as
 * cores, as folhas quebradas e os pendões. A sombra é a baixa do relevo (a mancha mansa na base).
 */

/** O escuro da fresta: transparente, escurece o chão de baixo uns 40% (o escuro do próprio chão, não um preto). */
const FRESTA: Rgb = [30, 25, 20]
const ALFA_DA_FRESTA = 0.42
const TERRA_SOLTA: Rgb = [104, 88, 66]
/** As folhas secas, da mais clara à mais escura. */
const FOLHAS: readonly Rgb[] = [
  [176, 160, 110],
  [150, 146, 96],
  [124, 128, 90],
  [112, 118, 98],
  [96, 92, 68],
]
const LUZ: Rgb = [226, 216, 170]
/** O pendão de semente (a espiga, o lado dela na sombra e o talo). */
const PENDAO: Rgb = [196, 178, 130]
const SOMBRA_DO_PENDAO: Rgb = [112, 98, 70]
const TALO: Rgb = [136, 124, 86]

/** Quanto o tufo sobe no quadro (y negativo é para cima) e quanto se abre para os lados (radianos de cada lado). */
const ALTURA_DO_TUFO = 0.62
const ABERTURA = 0.95
/** O chão visto de cima e um pouco de frente: a fresta e a terra achatadas. */
const ACHATA = 0.55
/** A fresta: a meia largura do risco (unidades; nunca mais comprida que o tufo) e quantos trechos a desenham. */
const MEIA_FRESTA = 0.28
const PASSOS_DA_FRESTA = 10
/** A folha: a largura na raiz (unidades; um fio de 1 px a 100% na folha de carimbos), os pontos e a parte quebrada. */
const LARGURA_DA_FOLHA = 0.02
const PASSOS_DA_FOLHA = 6
const PARTE_QUEBRADA = 0.3
/** O tufo: de 8 a 14 folhas, e a chance de uma folha ter a ponta quebrada. */
const FOLHAS_POR_TUFO: readonly [number, number] = [8, 14]
const CHANCE_DE_QUEBRAR = 0.3
/** Os grãos de cada espiga. */
const GRAOS = 5

type Ponto = readonly [number, number]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/**
 * A fresta: a rachadura curta e torta no chão, larga no meio e afinando até sumir nas duas pontas, do escuro do próprio
 * chão (transparente), com a beira de baixo pegando a luz (a parede da fresta que olha para cima à esquerda) e uns
 * torrões de terra solta na boca. A beira clara embaixo é o que faz ler buraco; em cima, leria graveto.
 */
function fresta(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const rumo = Math.sin(giro) * 0.35
  const n = PASSOS_DA_FRESTA
  const centro = Array.from({ length: n + 1 }, (_, i): Ponto => {
    const x = -MEIA_FRESTA + (2 * MEIA_FRESTA * i) / n
    return [x, x * rumo * ACHATA + (sorteio(semente, 30 + i) - 0.5) * 0.022]
  })
  const larg = centro.map((_, i) => 0.0015 + 0.016 * Math.pow(Math.sin((Math.PI * i) / n), 1.3) * (0.8 + 0.4 * sorteio(semente, 50 + i)))
  g.save()
  for (let i = 0; i < 3; i++) {
    const [x, y] = centro[2 + Math.floor(sorteio(semente, 90 + i) * (n - 3))]
    g.fillStyle = css(TERRA_SOLTA, 0.8)
    g.beginPath()
    g.ellipse(x + (sorteio(semente, 95 + i) - 0.5) * 0.05, y + 0.026 + sorteio(semente, 99 + i) * 0.016, 0.012, 0.008, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = css(FRESTA, ALFA_DA_FRESTA)
  g.beginPath()
  centro.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y - larg[i]) : g.lineTo(x, y - larg[i])))
  for (let i = n; i >= 0; i--) g.lineTo(centro[i][0], centro[i][1] + larg[i])
  g.closePath()
  g.fill()
  g.strokeStyle = css(misturar(TERRA_SOLTA, LUZ, 0.35), 0.45)
  g.lineWidth = 0.008
  g.lineCap = 'round'
  g.beginPath()
  centro.slice(2, n - 1).forEach(([x, y], j) => {
    const i = j + 2
    if (j === 0) g.moveTo(x, y + larg[i] + 0.005)
    else g.lineTo(x, y + larg[i] + 0.005)
  })
  g.stroke()
  g.restore()
}

/** Uma lâmina que afina da raiz (largura `larg`) até a ponta, ao longo dos `pontos`. */
function lamina(g: CanvasRenderingContext2D, pontos: readonly Ponto[], larg: number, cor: Rgb): void {
  const n = pontos.length
  const lados = pontos.map(([x, y], i): readonly [Ponto, Ponto] => {
    const [ax, ay] = pontos[Math.max(0, i - 1)]
    const [bx, by] = pontos[Math.min(n - 1, i + 1)]
    const l = Math.hypot(bx - ax, by - ay) || 1
    const r = (larg / 2) * Math.pow(1 - i / (n - 1), 0.8)
    const [nx, ny] = [-(by - ay) / l, (bx - ax) / l]
    return [[x + nx * r, y + ny * r], [x - nx * r, y - ny * r]]
  })
  g.fillStyle = css(cor)
  g.beginPath()
  lados.forEach(([p], i) => (i === 0 ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1])))
  for (let i = n - 1; i >= 0; i--) g.lineTo(lados[i][1][0], lados[i][1][1])
  g.closePath()
  g.fill()
}

/**
 * Uma folha: o fio curvo da raiz à ponta; com `quebra` (radianos), a ponta dobrou ali pelos 70% e caiu para o lado em
 * que a folha pende.
 */
function folha(g: CanvasRenderingContext2D, raiz: Ponto, ang: number, comp: number, curva: number, larg: number, cor: Rgb, quebra = 0): void {
  const [dx, dy] = [Math.sin(ang), -Math.cos(ang)]
  const [nx, ny] = [-dy, dx]
  const ate = quebra === 0 ? 1 : 1 - PARTE_QUEBRADA
  const ponta: Ponto = [raiz[0] + dx * comp * ate + nx * curva * ate, raiz[1] + dy * comp * ate + ny * curva * ate]
  const meio: Ponto = [raiz[0] + dx * comp * ate * 0.55 + nx * curva * 0.2, raiz[1] + dy * comp * ate * 0.55 + ny * curva * 0.2]
  const pontos: Ponto[] = Array.from({ length: PASSOS_DA_FOLHA + 1 }, (_, i): Ponto => {
    const t = i / PASSOS_DA_FOLHA
    const s = 1 - t
    return [s * s * raiz[0] + 2 * s * t * meio[0] + t * t * ponta[0], s * s * raiz[1] + 2 * s * t * meio[1] + t * t * ponta[1]]
  })
  if (quebra !== 0) {
    const lado = curva < 0 ? -1 : 1
    const caido = ang + lado * quebra
    const resto = comp * PARTE_QUEBRADA
    for (const f of [0.5, 1]) pontos.push([ponta[0] + Math.sin(caido) * resto * f, ponta[1] - Math.cos(caido) * resto * f])
  }
  lamina(g, pontos, larg, cor)
}

/**
 * Um tufo: de 8 a 14 fios abertos em leque desde a raiz, de comprimentos desencontrados, os do lado esquerdo mais
 * claros (a luz), os de trás mais escuros, alguns com a ponta quebrada. As deitadas primeiro e as do meio por último: as
 * em pé ficam na frente das deitadas.
 */
function tufo(g: CanvasRenderingContext2D, raiz: Ponto, tamanho: number, inclina: number, semente: number, i: number): void {
  const [menos, mais] = FOLHAS_POR_TUFO
  const n = menos + Math.floor(sorteio(semente, i) * (mais - menos + 1))
  const ordem = Array.from({ length: n }, (_, j) => j).sort((a, b) => Math.abs(b / (n - 1) - 0.5) - Math.abs(a / (n - 1) - 0.5))
  for (const j of ordem) {
    const t = j / (n - 1)
    const s = (k: number): number => sorteio(semente, i * 40 + j * 3 + k)
    const ang = inclina + (t - 0.5) * 2 * ABERTURA + (s(0) - 0.5) * 0.3
    const deitada = Math.abs(t - 0.5) * 2
    const comp = tamanho * ALTURA_DO_TUFO * (1 - 0.4 * deitada) * (0.45 + 0.65 * s(1))
    const curva = ((t - 0.5) * 0.24 + (s(2) - 0.5) * 0.08) * tamanho
    const base = FOLHAS[Math.min(FOLHAS.length - 1, Math.floor(s(3) * FOLHAS.length))]
    const cor = t < 0.4 ? misturar(base, LUZ, 0.14) : j % 2 === 0 ? base : misturar(base, FRESTA, 0.14)
    const quebra = s(4) < CHANCE_DE_QUEBRAR ? 1.6 + 0.6 * s(5) : 0
    folha(g, [raiz[0] + (t - 0.5) * 0.05, raiz[1]], ang, comp, curva, LARGURA_DA_FOLHA * (0.8 + 0.25 * (1 - deitada)), cor, quebra)
  }
}

/** O pendão: o talo fino e a espiga de semente na ponta, mais alta e mais clara que o tufo, com os grãos. */
function pendao(g: CanvasRenderingContext2D, raiz: Ponto, altura: number, ang: number): void {
  const [dx, dy] = [Math.sin(ang), -Math.cos(ang)]
  const [nx, ny] = [-dy, dx]
  const topo: Ponto = [raiz[0] + dx * altura, raiz[1] + dy * altura]
  g.strokeStyle = css(TALO)
  g.lineWidth = 0.011
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(raiz[0], raiz[1])
  g.quadraticCurveTo(raiz[0] + dx * altura * 0.6 + 0.03, raiz[1] + dy * altura * 0.6, topo[0], topo[1])
  g.stroke()
  // A espiga: o lado da sombra embaixo à direita, o corpo claro e os grãos alternando de um lado e do outro.
  const [ex, ey] = [topo[0] + dx * 0.05, topo[1] + dy * 0.05]
  g.fillStyle = css(SOMBRA_DO_PENDAO, 0.85)
  g.beginPath()
  g.ellipse(ex + 0.007, ey + 0.005, 0.028, 0.08, ang, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(PENDAO)
  g.beginPath()
  g.ellipse(ex, ey, 0.025, 0.076, ang, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(misturar(PENDAO, LUZ, 0.45))
  for (let j = 0; j < GRAOS; j++) {
    const ao = ((j + 0.5) / GRAOS - 0.5) * 0.12
    const lado = j % 2 === 0 ? -1 : 1
    g.beginPath()
    g.ellipse(ex + dx * ao + nx * lado * 0.011, ey + dy * ao + ny * lado * 0.011, 0.009, 0.014, ang + lado * 0.5, 0, Math.PI * 2)
    g.fill()
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.save()
  fresta(g, giro, semente)
  const tufos = 2 + (sorteio(semente, 1) > 0.45 ? 1 : 0)
  const inclina = Math.sin(giro) * 0.22
  // A folha quebrada caída no chão, deitada ao lado da fresta.
  const lado = sorteio(semente, 2) > 0.5 ? 1 : -1
  folha(g, [lado * 0.2, 0.03], lado * 1.45, 0.22, 0.03, LARGURA_DA_FOLHA, FOLHAS[3])
  // Os tufos ao longo da fresta, o maior no meio, e os pendões saindo dos maiores.
  for (let i = 0; i < tufos; i++) {
    const t = tufos === 1 ? 0.5 : i / (tufos - 1)
    const x = (t - 0.5) * 0.44 + (sorteio(semente, 40 + i) - 0.5) * 0.08
    const y = x * Math.sin(giro) * 0.35 * ACHATA
    const grande = 1 - Math.abs(t - 0.5) * 0.7
    const tamanho = (0.7 + 0.4 * sorteio(semente, 50 + i)) * grande
    tufo(g, [x, y], tamanho, inclina + (t - 0.5) * 0.3, semente, 60 + i)
    const pendoes = grande > 0.9 ? 1 + (sorteio(semente, 70 + i) > 0.4 ? 1 : 0) : sorteio(semente, 75 + i) > 0.5 ? 1 : 0
    for (let p = 0; p < pendoes; p++) {
      pendao(g, [x + (p - 0.5) * 0.03, y], ALTURA_DO_TUFO * tamanho * (1.15 + 0.25 * sorteio(semente, 80 + i * 2 + p)), inclina + (p - 0.5) * 0.45 + 0.08)
    }
  }
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'mato-na-fresta', nome: 'Mato na fresta', tamanho: 4.5, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [FRESTA, TERRA_SOLTA, ...FOLHAS, LUZ, PENDAO, SOMBRA_DO_PENDAO, TALO]
