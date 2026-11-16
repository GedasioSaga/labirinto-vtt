import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'
import { facesDaRocha, pintarRocha, tomDaRocha, type TonsDaRocha } from './_rochaFacetada'

/**
 * Cristais verdes que brilham (referências de 15/11/2026, lote L3: "o que
 * falta das 4 referências", versão original no estilo Meio-Termo): um ninho
 * de lascas de cristal verde, finas e altas, nascendo de um calombo de rocha
 * da caverna, a maior no meio quase em pé e as outras abrindo para fora. O
 * que as separa dos Cristais (cinco prismas grossos de ametista, sem luz) é a
 * forma, a cor e a LUZ: aqui as lascas são agulhas de duas faces (a da
 * esquerda acesa, a da direita no escuro, como o pinheiro), com um miolo
 * claro aceso por dentro e a ponta quase branca; e o cristal ILUMINA em volta
 * (a tabela `LUZ_DOS_CARIMBOS` de `lib/luzDoFogo.ts`, parada, sem tremer: luz
 * de pedra não treme como fogo). O brilho é pintado no corpo, como nos
 * Cogumelos que brilham; nada pulsa. O giro gira o ninho em volta do pé; a luz
 * não gira.
 */

/** A face no escuro: o verde fundo do cristal (contido; o verde aceso fica para o miolo). */
const VERDE_FUNDO: Rgb = [30, 80, 62]
const VERDE_MEIO: Rgb = [60, 136, 98]
const VERDE_CLARO: Rgb = [124, 202, 158]
/** O miolo aceso e a ponta: o verde quase branco da luz de dentro. */
const MIOLO: Rgb = [204, 240, 214]
/** A rocha da caverna, cinza frio com um fio do verde dos cristais. */
const ROCHA: TonsDaRocha = { escura: [62, 68, 66], meia: [94, 100, 96], clara: [132, 138, 130] }

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
/** O pé do ninho no quadro. */
const PE_Y = -0.03
/** O calombo de onde as lascas nascem: o pé delas fica afundado no alto dele. */
const CALOMBO = { raio: 0.22, altura: 0.09 } as const
/** A luz do alto do calombo (o topo, de frente para o céu, como a dos Cristais). */
const LUZ_DO_ALTO = 0.5
/** Onde a lasca deixa de ser corpo e vira ponta, em fração do comprimento. */
const OMBRO = 0.74
/**
 * O miolo aceso: de onde a onde ao longo da lasca, a meia largura (em meias larguras da lasca) e a força dele. Na
 * primeira folha (15/11/2026) era mais estreito e fraco (0,34 e 0,62): na mesa a lasca lia como folha de babosa.
 */
const MIOLO_DA_LASCA = { de: 0.16, ate: 0.9, largura: 0.46, alfa: 0.8 } as const

type Ponto = readonly [number, number]

interface Lasca {
  /** O pé no chão, antes do giro. */
  readonly dx: number
  readonly dy: number
  /** O quanto ela fica em pé (radianos acima do chão; pi/2 = de pé). */
  readonly elevacao: number
  readonly comprimento: number
  /** Meia largura na tela. */
  readonly largura: number
  /** O quanto ela abre para o lado, além de apontar para fora do ninho. */
  readonly desvio: number
}

const LASCAS: readonly Lasca[] = [
  { dx: 0, dy: 0, elevacao: 1.42, comprimento: 0.66, largura: 0.07, desvio: 0 },
  { dx: -0.12, dy: 0.04, elevacao: 1.02, comprimento: 0.42, largura: 0.055, desvio: 0.3 },
  { dx: 0.13, dy: -0.03, elevacao: 1.12, comprimento: 0.5, largura: 0.06, desvio: -0.25 },
  { dx: 0.06, dy: 0.12, elevacao: 0.92, comprimento: 0.28, largura: 0.046, desvio: 0.4 },
  { dx: -0.07, dy: -0.1, elevacao: 1.22, comprimento: 0.36, largura: 0.05, desvio: -0.35 },
  { dx: 0.19, dy: 0.07, elevacao: 0.82, comprimento: 0.22, largura: 0.04, desvio: 0.2 },
  { dx: -0.18, dy: -0.02, elevacao: 0.86, comprimento: 0.24, largura: 0.042, desvio: -0.15 },
]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function poligono(g: CanvasRenderingContext2D, pontos: readonly Ponto[], cor: string): void {
  g.fillStyle = cor
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
  g.fill()
}

interface LascaNaTela {
  readonly pe: Ponto
  /** O rumo da lasca na tela (unitário) e o comprimento que ela mostra (encurtada quando aponta para quem vê). */
  readonly rumo: Ponto
  readonly comprimento: number
  /** O lado direito da tela, perpendicular ao rumo. */
  readonly lado: Ponto
  readonly largura: number
  /** Quanto a face da esquerda olha para a luz (0 a 1): a lasca que pende para a esquerda acende mais. */
  readonly luz: number
}

function naTela(l: Lasca, giro: number, semente: number, i: number): LascaNaTela {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const gx = l.dx * c - l.dy * s
  const gy = l.dx * s + l.dy * c
  // O pé afundado no calombo: mais alto no meio dele, mais baixo na beira.
  const naBeira = Math.min(1, Math.hypot(l.dx, l.dy) / CALOMBO.raio)
  const pe: Ponto = [gx, PE_Y + gy * ACHATA - CALOMBO.altura * (0.8 - 0.5 * naBeira)]
  const azimute = (l.dx === 0 && l.dy === 0 ? -Math.PI / 2 : Math.atan2(l.dy, l.dx)) + giro + l.desvio
  const elevacao = l.elevacao + (sorteio(semente, 10 + i) - 0.5) * 0.12
  const rx = Math.cos(elevacao) * Math.cos(azimute)
  const ry = Math.cos(elevacao) * Math.sin(azimute) * ACHATA - Math.sin(elevacao)
  const n = Math.hypot(rx, ry) || 1
  const rumo: Ponto = [rx / n, ry / n]
  // O lado direito: o rumo girado de um quarto de volta, sempre para a direita da tela.
  const lado: Ponto = -rumo[1] >= 0 ? [-rumo[1], rumo[0]] : [rumo[1], -rumo[0]]
  return {
    pe,
    rumo,
    comprimento: l.comprimento * n * (0.9 + 0.2 * sorteio(semente, 20 + i)),
    lado,
    largura: l.largura,
    luz: Math.min(1, Math.max(0, 0.55 - rumo[0] * 0.7)),
  }
}

/** O ponto a `t` do comprimento e `k` meias larguras para a direita. */
function em(l: LascaNaTela, t: number, k: number): Ponto {
  return [l.pe[0] + l.rumo[0] * l.comprimento * t + l.lado[0] * l.largura * k, l.pe[1] + l.rumo[1] * l.comprimento * t + l.lado[1] * l.largura * k]
}

function desenharLasca(g: CanvasRenderingContext2D, l: LascaNaTela): void {
  const ponta = em(l, 1, 0.1)
  // A quina do meio corre um nada à direita do eixo: a face acesa (a da esquerda) é a mais larga.
  const quina = 0.14
  poligono(g, [em(l, 0, -1), em(l, OMBRO, -0.92), ponta, em(l, OMBRO, quina), em(l, 0, quina)], css(misturar(VERDE_MEIO, VERDE_CLARO, l.luz)))
  poligono(g, [em(l, 0, quina), em(l, OMBRO, quina), ponta, em(l, OMBRO, 0.92), em(l, 0, 1)], css(misturar(VERDE_FUNDO, VERDE_MEIO, 0.25 + 0.3 * l.luz)))
  // A faceta de cima da ponta, de frente para o céu e acesa por dentro: a mais clara, quase o miolo.
  poligono(g, [em(l, OMBRO, -0.92), ponta, em(l, OMBRO, quina)], css(misturar(VERDE_CLARO, MIOLO, 0.55 + 0.35 * l.luz)))
  // O miolo aceso por dentro: um fuso claro ao longo da quina, que vaza nas duas faces.
  const m = MIOLO_DA_LASCA
  poligono(g, [em(l, m.de, quina), em(l, (m.de + m.ate) / 2, quina - m.largura), em(l, m.ate, quina), em(l, (m.de + m.ate) / 2, quina + m.largura * 0.7)], css(MIOLO, m.alfa))
}

/** A lasca de rocha em volta do pé de um cristal: seis quinas, achatada como o chão. */
function pedrinha(x: number, y: number, raio: number, semente: number, i: number): Ponto[] {
  return Array.from({ length: 6 }, (_, k): Ponto => {
    const a = (k * Math.PI) / 3 + sorteio(semente, 60 + i * 6 + k) * 0.5
    const d = raio * (0.75 + 0.45 * sorteio(semente, 100 + i * 6 + k))
    return [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5]
  })
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // O calombo de rocha de onde elas nascem: um bloco baixo e lascado (o das rochas do lote C6).
  pintarRocha(
    g,
    facesDaRocha({
      cx: 0,
      cy: PE_Y + 0.01,
      raio: CALOMBO.raio,
      altura: CALOMBO.altura,
      lados: 7,
      aneis: [
        [0, 1],
        [1, 0.6],
      ],
      recuo: 0.05,
      aspereza: 0.35,
      picos: 0.6,
      giro: giro + 0.9,
      semente: semente + 5,
    }),
    ROCHA,
  )
  // De trás para a frente: o pé mais alto na tela sai primeiro.
  const lascas = LASCAS.map((l, i) => naTela(l, giro, semente, i)).sort((a, b) => a.pe[1] - b.pe[1])
  const pedra = css(tomDaRocha(ROCHA, LUZ_DO_ALTO))
  lascas.forEach((l, i) => {
    desenharLasca(g, l)
    // O pé de cada uma some numa pedrinha da rocha: o corte reto da lasca não aparece.
    poligono(g, pedrinha(l.pe[0], l.pe[1] + l.largura * 0.2, l.largura * 1.15, semente, i), pedra)
  })
}

export const carimbo: DefinicaoDeCarimbo = { id: 'cristais-verdes', nome: 'Cristais verdes', tamanho: 9, sombra: 'em-pe', desenhar }

/** Todas as cores chapadas do desenho (as faces saem destas, misturadas pela luz). */
export const paleta: readonly Rgb[] = [VERDE_FUNDO, VERDE_MEIO, VERDE_CLARO, MIOLO, ROCHA.escura, ROCHA.meia, ROCHA.clara]
