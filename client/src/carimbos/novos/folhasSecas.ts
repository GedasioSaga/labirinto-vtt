import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Folhas secas espalhadas (item 128 dos carimbos de 14/11/2026): um monte
 * ralo de folhas caídas, deitadas no chão, mais juntas no meio e soltas na
 * beira. A maioria é folha em gota (amêndoa), umas poucas são de cinco pontas
 * (a folha de bordo, que diz "outono" de longe). As cores são as do outono,
 * contidas: ocre, ferrugem, marrom, palha e um vermelho queimado.
 *
 * Cada folha está um pouco dobrada na nervura: a metade que olha para a luz
 * (de cima à esquerda) clara, a outra no tom escuro da mesma cor; é o que dá
 * relevo sem contorno. Por baixo, uma mancha mansa e transparente de terra
 * úmida junta as folhas num monte (sem ela, viravam confete solto na mesa).
 * Rente ao chão, sem sombra, como a Poça: fica por baixo
 * das sombras dos outros. O giro gira o monte e cada folha; a semente
 * escolhe as cores e onde cada uma cai. A luz não gira.
 */

interface TonsDaFolha {
  clara: Rgb
  escura: Rgb
}

const OCRE: TonsDaFolha = { clara: [206, 162, 86], escura: [158, 118, 62] }
const FERRUGEM: TonsDaFolha = { clara: [184, 112, 66], escura: [140, 82, 52] }
const MARROM: TonsDaFolha = { clara: [152, 112, 74], escura: [108, 80, 54] }
const PALHA: TonsDaFolha = { clara: [216, 186, 108], escura: [170, 140, 76] }
const VERMELHO: TonsDaFolha = { clara: [168, 90, 70], escura: [124, 64, 54] }

/** Quantas de cada cor (a soma é 1), sorteando de cima para baixo. */
const MISTURA: ReadonlyArray<readonly [TonsDaFolha, number]> = [
  [OCRE, 0.28],
  [FERRUGEM, 0.24],
  [MARROM, 0.2],
  [PALHA, 0.16],
  [VERMELHO, 0.12],
]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

type Ponto = readonly [number, number]

/** O chão visto de cima e um pouco de frente (o das pedras e do tronco). */
const ACHATA = 0.6
/** O meio do monte no quadro e o raio dele no chão. */
const CENTRO_Y = -0.1
const RAIO = 0.42
/** A terra úmida embaixo das folhas (transparente: o chão do mapa aparece). */
const HUMUS: Rgb = [92, 72, 50]

/** Do chão (x para a direita, z para quem vê) para o quadro. */
function noChao(x: number, z: number): Ponto {
  return [x, CENTRO_Y + z * ACHATA]
}

function corSorteada(t: number): TonsDaFolha {
  let soma = 0
  for (const [tons, parte] of MISTURA) {
    soma += parte
    if (t < soma) return tons
  }
  return MISTURA[0][0]
}

interface Folha {
  x: number
  z: number
  /** Para onde a ponta aponta, no chão. */
  rumo: number
  comprimento: number
  bordo: boolean
  tons: TonsDaFolha
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[]): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
}

/** A folha em gota: a inteira no tom escuro e, por cima, a metade da luz no claro. */
function folhaEmGota(g: CanvasRenderingContext2D, f: Folha): void {
  const dx = Math.cos(f.rumo)
  const dz = Math.sin(f.rumo)
  const meia = f.comprimento * 0.5
  const largura = f.comprimento * 0.46
  const pe = noChao(f.x - dx * meia, f.z - dz * meia)
  const ponta = noChao(f.x + dx * meia, f.z + dz * meia)
  const ladoA = noChao(f.x - dz * largura, f.z + dx * largura)
  const ladoB = noChao(f.x + dz * largura, f.z - dx * largura)
  g.fillStyle = css(f.tons.escura)
  g.beginPath()
  g.moveTo(pe[0], pe[1])
  g.quadraticCurveTo(ladoA[0], ladoA[1], ponta[0], ponta[1])
  g.quadraticCurveTo(ladoB[0], ladoB[1], pe[0], pe[1])
  g.fill()
  // A metade do lado A está na luz se a normal dela, já no quadro, aponta para cima à esquerda.
  const daLuz = voltadoParaALuz(-dz, dx * ACHATA) > 0.5 ? ladoA : ladoB
  g.fillStyle = css(f.tons.clara)
  g.beginPath()
  g.moveTo(pe[0], pe[1])
  g.quadraticCurveTo(daLuz[0], daLuz[1], ponta[0], ponta[1])
  g.closePath()
  g.fill()
}

/** Ângulo (a partir da ponta do meio) e raio de cada ponta e de cada recorte da folha de bordo. */
const PONTAS_DO_BORDO: ReadonlyArray<readonly [number, number]> = [
  [-Math.PI, 0.16],
  [-2.15, 0.62],
  [-1.62, 0.36],
  [-1.12, 0.94],
  [-0.56, 0.4],
  [0, 1],
  [0.56, 0.4],
  [1.12, 0.94],
  [1.62, 0.36],
  [2.15, 0.62],
]

/** A folha de bordo: cinco pontas, o cabinho e a metade da luz (as pontas de um lado da nervura). */
function folhaDeBordo(g: CanvasRenderingContext2D, f: Folha): void {
  const r = f.comprimento * 0.62
  const ponto = (angulo: number, k: number): Ponto => noChao(f.x + Math.cos(f.rumo + angulo) * r * k, f.z + Math.sin(f.rumo + angulo) * r * k)
  const contorno = PONTAS_DO_BORDO.map(([a, k]) => ponto(a, k))
  g.fillStyle = css(f.tons.escura)
  caminho(g, contorno)
  g.fill()
  // O cabinho, do recorte do pé para trás.
  const pe = ponto(Math.PI, 0.16)
  const cabo = ponto(Math.PI, 0.62)
  g.beginPath()
  g.moveTo(pe[0] - 0.007, pe[1])
  g.lineTo(cabo[0], cabo[1])
  g.lineTo(pe[0] + 0.007, pe[1])
  g.closePath()
  g.fill()
  // O lado da luz: o das pontas de ângulo negativo se a normal dele olha para a luz.
  const ladoNegativo = voltadoParaALuz(Math.cos(f.rumo - Math.PI / 2), Math.sin(f.rumo - Math.PI / 2) * ACHATA) > 0.5
  const meio = noChao(f.x, f.z)
  const metade = ladoNegativo ? PONTAS_DO_BORDO.slice(0, 6) : [...PONTAS_DO_BORDO.slice(5), PONTAS_DO_BORDO[0]]
  g.fillStyle = css(f.tons.clara)
  caminho(g, [meio, ...metade.map(([a, k]) => ponto(a, k))])
  g.fill()
}

function folhas(giro: number, semente: number): Folha[] {
  const n = 20 + Math.floor(sorteio(semente, 0) * 4)
  const lista: Folha[] = []
  for (let i = 0; i < n; i++) {
    // Uma espiral sorteada: cobre o monte sem buraco nem bolo, mais junto no meio.
    const a = giro + i * 2.39996 + sorteio(semente, 1 + i) * 0.5
    const d = RAIO * Math.pow((i + 0.5) / n, 0.6) * (0.82 + 0.26 * sorteio(semente, 30 + i))
    const bordo = sorteio(semente, 60 + i) < 0.22
    lista.push({
      x: Math.cos(a) * d,
      z: Math.sin(a) * d,
      rumo: giro + sorteio(semente, 90 + i) * Math.PI * 2,
      comprimento: (bordo ? 0.2 : 0.17) + 0.06 * sorteio(semente, 120 + i),
      bordo,
      tons: corSorteada(sorteio(semente, 150 + i)),
    })
  }
  // As de fora primeiro: o meio fica por cima, amontoado.
  return lista.reverse()
}

/** O chão úmido por baixo do monte: uma mancha mansa de húmus que amarra as folhas numa coisa só. */
function desenharHumus(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.fillStyle = css(HUMUS, 0.26)
  g.beginPath()
  // Lóbulos de tamanho e distância sorteados: a mancha sai torta, menor que o monte (as folhas da beira passam dela).
  for (let i = 0; i < 7; i++) {
    const a = giro + (i * Math.PI * 2) / 7 + (sorteio(semente, 200 + i) - 0.5) * 0.7
    const d = RAIO * (0.3 + 0.25 * sorteio(semente, 220 + i))
    const r = RAIO * (0.3 + 0.16 * sorteio(semente, 210 + i))
    const [x, y] = noChao(Math.cos(a) * d, Math.sin(a) * d)
    g.moveTo(x + r, y)
    g.ellipse(x, y, r, r * ACHATA, 0, 0, Math.PI * 2)
  }
  g.fill()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  desenharHumus(g, giro, semente)
  for (const f of folhas(giro, semente)) (f.bordo ? folhaDeBordo : folhaEmGota)(g, f)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'folhas-secas', nome: 'Folhas secas', tamanho: 10, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [HUMUS, ...MISTURA.flatMap(([tons]) => [tons.clara, tons.escura])]
