import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Mato na fresta (item 90 dos objetos de 24/11/2026, lote L09 "Cortiço"): o capim ralo e SECO que nasce no pé do muro,
 * entre as pedras da calçada e na fresta da parede. Dois ou três tufos baixos que saem do mesmo RISCO escuro (a fresta,
 * com um pouco de terra solta na boca), folhas finas e tortas, umas em pé, outras deitadas para os lados; a cor vai da
 * palha queimada ao oliva seco e ao cinza esverdeado, nunca o verde vivo do capim alto. Um ou dois PENDÕES de semente,
 * mais altos, e uma folha quebrada caída.
 *
 * A luz vem de cima à esquerda e não gira: a folha do lado da luz ganha o fio claro na beira esquerda. O giro inclina o
 * tufo e espalha os tufos ao longo da fresta; a semente escolhe quantos tufos, as alturas, as cores e os pendões. A
 * sombra é a baixa do relevo (a mancha mansa na base), e a fresta tem a sombrinha dela.
 */

const FRESTA: Rgb = [46, 40, 34]
const TERRA_SOLTA: Rgb = [104, 88, 66]
/** As folhas secas, da mais clara à mais escura, e o fio de luz da beira. */
const FOLHAS: readonly Rgb[] = [
  [176, 160, 110],
  [150, 146, 96],
  [124, 128, 90],
  [112, 118, 98],
  [96, 92, 68],
]
const LUZ: Rgb = [226, 216, 170]
/** O pendão de semente (a espiga e o talo). */
const PENDAO: Rgb = [186, 166, 120]
const TALO: Rgb = [136, 124, 86]

/** Quanto o tufo sobe no quadro (y negativo é para cima) e quanto se abre para os lados. */
const ALTURA_DO_TUFO = 0.62
const ABERTURA = 0.34
/** O chão visto de cima e um pouco de frente: a fresta e a terra achatadas. */
const ACHATA = 0.55
/** Quantos trechos desenham a fresta. */
const PASSOS_DA_FRESTA = 10

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/**
 * A fresta: a rachadura funda e torta no chão, larga no meio e fina nas pontas, com a beira de baixo pegando a luz (a
 * parede da fresta que olha para cima à esquerda) e uns torrões de terra solta na boca. A beira clara embaixo é o que
 * faz ler buraco; em cima, leria graveto.
 */
function fresta(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const rumo = Math.sin(giro) * 0.35
  const meia = 0.46
  const n = PASSOS_DA_FRESTA
  const centro = Array.from({ length: n + 1 }, (_, i): readonly [number, number] => {
    const x = -meia + (2 * meia * i) / n
    return [x, x * rumo * ACHATA + (sorteio(semente, 30 + i) - 0.5) * 0.024]
  })
  const larg = centro.map((_, i) => (0.005 + 0.017 * Math.sin((Math.PI * i) / n)) * (0.75 + 0.5 * sorteio(semente, 50 + i)))
  g.save()
  for (let i = 0; i < 4; i++) {
    const [x, y] = centro[1 + Math.floor(sorteio(semente, 90 + i) * (n - 1))]
    g.fillStyle = css(TERRA_SOLTA, 0.8)
    g.beginPath()
    g.ellipse(x + (sorteio(semente, 95 + i) - 0.5) * 0.06, y + 0.03 + sorteio(semente, 99 + i) * 0.02, 0.014, 0.009, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = css(FRESTA, 0.92)
  g.beginPath()
  centro.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y - larg[i]) : g.lineTo(x, y - larg[i])))
  for (let i = n; i >= 0; i--) g.lineTo(centro[i][0], centro[i][1] + larg[i])
  g.closePath()
  g.fill()
  g.strokeStyle = css(misturar(TERRA_SOLTA, LUZ, 0.35), 0.6)
  g.lineWidth = 0.01
  g.lineCap = 'round'
  traco(g, centro.map(([x, y], i) => [x, y + larg[i] + 0.006] as const))
  g.restore()
}

function traco(g: CanvasRenderingContext2D, pontos: readonly (readonly [number, number])[]): void {
  g.beginPath()
  g.moveTo(pontos[0][0], pontos[0][1])
  for (const [x, y] of pontos.slice(1)) g.lineTo(x, y)
  g.stroke()
}

/** Uma folha: a lâmina fina e torta da raiz à ponta, mais larga no meio, com o fio de luz do lado esquerdo. */
function folha(g: CanvasRenderingContext2D, raiz: readonly [number, number], ang: number, comp: number, curva: number, larg: number, cor: Rgb): void {
  const [dx, dy] = [Math.sin(ang), -Math.cos(ang)]
  const [nx, ny] = [-dy, dx]
  const ponta: readonly [number, number] = [raiz[0] + dx * comp + nx * curva, raiz[1] + dy * comp + ny * curva]
  const meio: readonly [number, number] = [raiz[0] + dx * comp * 0.55 + nx * curva * 0.25, raiz[1] + dy * comp * 0.55 + ny * curva * 0.25]
  g.fillStyle = css(cor)
  g.beginPath()
  g.moveTo(raiz[0] - nx * larg * 0.5, raiz[1] - ny * larg * 0.5)
  g.quadraticCurveTo(meio[0] - nx * larg, meio[1] - ny * larg, ponta[0], ponta[1])
  g.quadraticCurveTo(meio[0] + nx * larg, meio[1] + ny * larg, raiz[0] + nx * larg * 0.5, raiz[1] + ny * larg * 0.5)
  g.closePath()
  g.fill()
  // O fio de luz fica na beira que olha para a esquerda (a luz não gira).
  const lado = nx < 0 ? 1 : -1
  g.strokeStyle = css(misturar(cor, LUZ, 0.45), 0.75)
  g.lineWidth = larg * 0.35
  g.beginPath()
  g.moveTo(raiz[0] - lado * nx * larg * 0.3, raiz[1] - lado * ny * larg * 0.3)
  g.quadraticCurveTo(meio[0] - lado * nx * larg * 0.55, meio[1] - lado * ny * larg * 0.55, ponta[0], ponta[1])
  g.stroke()
}

/** Um tufo: as folhas abertas em leque desde a raiz, as de trás mais escuras e baixas, as da frente mais claras. */
function tufo(g: CanvasRenderingContext2D, raiz: readonly [number, number], tamanho: number, inclina: number, semente: number, i: number): void {
  const n = 7 + Math.floor(sorteio(semente, i) * 4)
  // As deitadas primeiro e as do meio por último: as em pé ficam na frente das deitadas.
  const ordem = Array.from({ length: n }, (_, j) => j).sort((a, b) => Math.abs(b / (n - 1) - 0.5) - Math.abs(a / (n - 1) - 0.5))
  for (const j of ordem) {
    const t = j / (n - 1)
    const ang = inclina + (t - 0.5) * 2 * ABERTURA * 3 + (sorteio(semente, i * 20 + j) - 0.5) * 0.35
    const deitada = Math.abs(t - 0.5) * 2
    const comp = tamanho * ALTURA_DO_TUFO * (1 - 0.45 * deitada) * (0.65 + 0.5 * sorteio(semente, i * 20 + j + 7))
    const curva = (t - 0.5) * tamanho * 0.18 * (0.6 + sorteio(semente, i * 20 + j + 13))
    const cor = FOLHAS[Math.min(FOLHAS.length - 1, Math.floor(sorteio(semente, i * 20 + j + 3) * FOLHAS.length))]
    const escurece = j % 2 === 0 ? 0 : 0.12
    folha(g, [raiz[0] + (t - 0.5) * 0.05, raiz[1]], ang, comp, curva, 0.024 + 0.01 * (1 - deitada), misturar(cor, FRESTA, escurece))
  }
}

/** O pendão: o talo fino e a espiga de semente na ponta, mais alto que o tufo. */
function pendao(g: CanvasRenderingContext2D, raiz: readonly [number, number], altura: number, ang: number): void {
  const [dx, dy] = [Math.sin(ang), -Math.cos(ang)]
  const topo: readonly [number, number] = [raiz[0] + dx * altura, raiz[1] + dy * altura]
  g.strokeStyle = css(TALO)
  g.lineWidth = 0.012
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(raiz[0], raiz[1])
  g.quadraticCurveTo(raiz[0] + dx * altura * 0.6 + 0.03, raiz[1] + dy * altura * 0.6, topo[0], topo[1])
  g.stroke()
  g.fillStyle = css(PENDAO)
  g.beginPath()
  g.ellipse(topo[0] + dx * 0.04, topo[1] + dy * 0.04, 0.02, 0.06, ang, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(misturar(PENDAO, LUZ, 0.4), 0.8)
  g.beginPath()
  g.ellipse(topo[0] + dx * 0.04 - 0.006, topo[1] + dy * 0.04 - 0.01, 0.008, 0.035, ang, 0, Math.PI * 2)
  g.fill()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.save()
  fresta(g, giro, semente)
  const tufos = 2 + (sorteio(semente, 1) > 0.45 ? 1 : 0)
  const inclina = Math.sin(giro) * 0.22
  // A folha quebrada caída no chão, deitada ao lado da fresta.
  const lado = sorteio(semente, 2) > 0.5 ? 1 : -1
  folha(g, [lado * 0.22, 0.03], lado * 1.45, 0.24, 0.03, 0.02, FOLHAS[3])
  // Os tufos ao longo da fresta, o maior no meio, e os pendões saindo do maior.
  for (let i = 0; i < tufos; i++) {
    const t = tufos === 1 ? 0.5 : i / (tufos - 1)
    const x = (t - 0.5) * 0.62 + (sorteio(semente, 40 + i) - 0.5) * 0.1
    const y = x * Math.sin(giro) * 0.35 * ACHATA
    const grande = 1 - Math.abs(t - 0.5) * 0.7
    const tamanho = (0.7 + 0.4 * sorteio(semente, 50 + i)) * grande
    tufo(g, [x, y], tamanho, inclina + (t - 0.5) * 0.3, semente, 60 + i)
    if (grande > 0.9) {
      const pendoes = 1 + (sorteio(semente, 70 + i) > 0.5 ? 1 : 0)
      for (let p = 0; p < pendoes; p++) pendao(g, [x + (p - 0.5) * 0.03, y], ALTURA_DO_TUFO * (0.95 + 0.25 * sorteio(semente, 80 + p)), inclina + (p - 0.5) * 0.4 + 0.08)
    }
  }
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'mato-na-fresta', nome: 'Mato na fresta', tamanho: 4.5, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [FRESTA, TERRA_SOLTA, ...FOLHAS, LUZ, PENDAO, TALO]
