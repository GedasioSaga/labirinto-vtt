/**
 * BLOCO DE INSCRIÇÕES (lote 16 dos objetos novos, 12/11/2026): o monumento
 * antigo da mata, um cubo enorme de pedra polida, de arestas vivas com um
 * chanfro fino, da altura do mausoléu (bem mais alto que uma pessoa), com as
 * faces cobertas de fileiras de GLIFOS ENTALHADOS. Não é um objeto do
 * catálogo: é o ajudante dos três blocos (`blocoDeInscricoesAzul.ts`,
 * `blocoDeInscricoesVermelho.ts` e `blocoDeInscricoesDourado.ts`), como
 * `pipaDeitada.ts` é o dos barris deitados e do tonel. Cada bloco só diz as
 * cores dele (`CoresDoBloco`) e qual é o texto.
 *
 * OS GLIFOS são inventados, com uma lógica só deles: cada um é uma MOLDURA de
 * barras grossas (o cálice aberto em cima, a abóbada aberta embaixo, o
 * colchete aberto para um lado, o degrau, os dois esquadros ou a caixa) com
 * um MIOLO no bolsão que ela deixa (o ponto, a volta, a barrinha ou o par de
 * pontos). Dezesseis combinações formam o alfabeto (`ALFABETO`), e cada face
 * escreve o seu texto em fileiras e colunas regulares. Nenhuma combinação é
 * letra de verdade: a barrinha nunca encosta na moldura (sem "E", "H" nem
 * "日"), e a caixa não leva barrinha. O glifo tem lado e traço fixos em px:
 * o bloco esticado ganha mais glifos, nunca glifos esticados.
 *
 * A PINTURA DOS GLIFOS é a textura da face (como os riscos do círculo mágico),
 * e não uma peça por glifo: cada pixel lê a distância ao glifo da casa dele.
 * O glifo é um REBAIXO: o fundo do sulco mais escuro, a parede do lado da luz
 * na sombra e a parede do outro lado com um fio de luz (de perto; no tamanho
 * de mesa fica só o sulco escuro, que é o que se lê).
 *
 * DE CIMA aparece a face de cima, com a grade de glifos, o lado da luz mais
 * claro, uma LASCA no canto de cima à direita (com os cacos no chão), uma
 * RACHADURA fina e manchas de tempo; em volta do pé, terra e tufos de capim; e
 * a sombra longa e larga que diz que o bloco é alto.
 *
 * NA 3/4 a face de cima sobe a altura do bloco (a sombra dele é uma coluna) e
 * a FACE DA FRENTE aparece embaixo dela, com as fileiras de glifos, os
 * escorridos de chuva que descem do alto, o pé úmido e o capim encostado.
 * Como no cofre (`cofre.ts`), a frente que a 3/4 varre sozinha seria pedra
 * lisa: aqui ela é desenhada já no lugar da tela e GUARDADA debaixo da face de
 * cima, onde nada dela aparece, em FATIAS penduradas em PINOS
 * (`pendurar` de `pipaDeitada.ts`): a face é mais alta do que o bloco é
 * fundo, e a cópia guardada inteira passaria da beira de trás. Os pinos ficam
 * numa faixa estreita do lado da frente, debaixo do tampo e fora da coluna (a
 * coluna acaba `FAIXA_DOS_PINOS` antes da beira): dentro dela, a coluna, mais
 * alta, levaria a fatia junto. O perfil da 3/4 de quem usa isto tem de ser
 * `{ modo: 'derivado', espessura: 0 }`, como o dos barris deitados.
 *
 * GIRO. Na 3/4 o quarto de volta do objeto é pintado na cena (`c.giro`). A
 * face de cima, a lasca, a terra e o capim de cima são montados no referencial
 * do objeto e giram com ele; a coluna, a face da frente e o capim encostado
 * nela são montados NA TELA (a face de baixo na tela, seja qual for o lado do
 * objeto) e devolvidos ao objeto com `desgirarCena`. Cada lado tem o seu texto,
 * e a lasca, quando o giro a leva para a beira da frente, entra também no alto
 * da face. A luz dos sulcos e o lado claro da face de cima ficam na tela.
 *
 * A altura é a média dos dois lados da pegada (o cubo das 2 x 2 casas de
 * partida tem 2 casas de altura, a do mausoléu), nunca menos que
 * `ALTURA_MINIMA`. Cores fixas por literal: nenhuma vem da tabela de materiais.
 */
import { hash, limitar01, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, dentroDe, elipse, menos, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel } from './contexto'
import { desgirarCena, pendurar, pregar, quartosDoGiro, type PecaDoQuadro, type Pino } from './pipaDeitada'

/** As cores de um bloco, todas na luz neutra (a face de cima): o motor e a textura escurecem a frente e os sulcos. */
export interface CoresDoBloco {
  /** A pedra polida (ou o ouro). */
  readonly pedra: Rgb
  /** O fundo dos sulcos dos glifos. */
  readonly sulco: Rgb
  /** Para onde as manchas de tempo, os escorridos e o pé úmido puxam a pedra. */
  readonly mancha: Rgb
  /** A quebra da lasca: a pedra de dentro, fosca. */
  readonly quebra: Rgb
  /** O escuro em que o pixel escuro demais é levantado (o piso de luz): o da própria cor, e não o marrom da nogueira. */
  readonly piso: Rgb
  /** O brilho do motor no chanfro das arestas: quase nada na pedra, o reflexo quente do ouro. */
  readonly brilho: number
  /** As faixas largas de reflexo nas faces: a pedra polida reflete pouco, o ouro reflete o céu e o chão. */
  readonly reflexo: number
  /** O grão miúdo, de perto (o ouro é quase liso). */
  readonly grao: number
  /** Qual texto o bloco tem: cada cor escreve outro. */
  readonly texto: number
}

// ---------- as medidas do bloco ----------

/** A altura mínima do bloco, em casas: mesmo encolhido, é mais alto que uma pessoa. */
const ALTURA_MINIMA = 1.5
/** O bloco recua da pegada este tanto de cada lado (px do protótipo): a terra e o capim do pé cabem na pegada. */
const RECUO = 1.6
/** O canto vivo e o chanfro fino das arestas (px). */
const CANTO = 0.9
const BISEL_DO_TOPO = 1.3
const BISEL_DA_FACE = 1.1
/**
 * A face da frente recebe menos luz que a de cima; um pouco menos escura que a frente varrida (0,74): o fundo
 * dos sulcos dela não pode cair abaixo do piso de luz, senão some no levantamento.
 */
const TOM_DA_FACE = 0.78
/** A sombra no chão do bloco alto, mais forte que a do motor para essa altura (0,16): é ela que diz, de cima, que o bloco é alto. */
const FORCA_DA_SOMBRA = 0.3
const FORCA_DO_CONTATO = 0.32

// ---------- a face da frente guardada ----------

/**
 * Do lado da frente (o de baixo na tela), a coluna da 3/4 acaba este tanto antes da beira da face de cima (px):
 * a faixa que sobra, debaixo dela e fora da coluna, é onde ficam os pinos. O pé do bloco na 3/4 fica nessa
 * linha, um nada para dentro da beira de cima.
 */
const FAIXA_DOS_PINOS = 4
/** Onde ficam os pinos de cada grupo dentro da faixa (px a partir do pé da coluna) e a ordem do grupo na fila da 3/4 (a face, a lasca da frente e o capim, nessa ordem, por cima da coluna). */
const PINOS_DA_FACE = { y: 2.4, ordem: 0.5 } as const
const PINOS_DA_LASCA = { y: 3, ordem: 0.8 } as const
const PINOS_DO_CAPIM = { y: 3.6, ordem: 1.1 } as const
/** O passo entre dois pinos do mesmo grupo (px): maior que o pino, nenhum cai em cima do outro. */
const PASSO_DOS_PINOS = 0.45
/** A cópia guardada fica a esta distância das beiras da face de cima (px): de cima, nada dela aparece. */
const FOLGA_DO_GUARDADO = 1.2
/** Quanto a fatia de baixo sobe na 3/4 (px): menos que a faixa dos pinos menos a folga, e as de cima, uma fatia a mais cada uma. */
const SUBIDA_DA_FATIA_DE_BAIXO = 1.4
/** O que a fatia perde para a emenda de `pendurar` e o arredondamento (px). */
const SOBRA_DA_FATIA = 0.6
/** O capim encostado sobe este nada: o bastante para o pino valer como estrutura. */
const SUBIDA_DO_CAPIM = 0.3

// ---------- os glifos ----------

/** A grade das inscrições, em px do protótipo (não esticam): o passo de um glifo ao outro, o lado do glifo e a grossura do traço. */
const PASSO = 14
const LADO = 10
const TRACO = 2
/** Metade do vão entre dois glifos: até onde cada casa da grade vai além do glifo dela. */
const MEIO_VAO = (PASSO - LADO) / 2
/** A faixa lisa entre os glifos e a beira da face (px); no pé da face da frente, mais alta (a terra e o capim sobem nela). */
const BORDA = 5.8
const BORDA_DO_PE = 7
/**
 * O friso: o sulco fino que emoldura as inscrições de cada face, a este tanto da beira (px), com esta meia
 * largura. É ele que faz da grade de glifos um painel escrito, e não um ladrilho.
 */
const RECUO_DO_FRISO = 2.7
const MEIO_FRISO = 0.55
/** O ponto (o lado, em traços), a volta (o raio do meio do aro e a meia grossura dele, em traços), a barrinha (em lados de glifo) e o par de pontos (o lado, em traços, e a meia distância, em lados). */
const PONTO = 1.3
const RAIO_DA_VOLTA = 0.72
const ARO_DA_VOLTA = 0.32
const BARRINHA = 0.34
const PONTO_DO_PAR = 1.1
const MEIO_PAR = 0.2
/** O tipo do risco: um retângulo (a barra, o ponto) ou uma volta. Cada risco ocupa `CAMPOS` números: o tipo, o meio (x, y) e as duas medidas. */
const RETANGULO = 0
const VOLTA = 1
const CAMPOS = 5
/** A distância devolvida longe de qualquer glifo (px). */
const LONGE_DO_GLIFO = 1e3

/**
 * Uma moldura: as barras, de uma linha da grade do glifo a outra ([x1, y1, x2, y2], com 0 = a beira de cima ou
 * da esquerda, 1 = o meio, 2 = a beira de baixo ou da direita), os bolsões que ela deixa (o meio, em frações do
 * lado; o miolo fica no primeiro, e o degrau ganha um ponto no segundo) e para onde a barrinha e o par deitam.
 */
interface Moldura {
  readonly barras: readonly (readonly [number, number, number, number])[]
  readonly bolsoes: readonly Ponto[]
  readonly barrinhaDeitada: boolean
  readonly parDeitado: boolean
}

const MOLDURAS: readonly Moldura[] = [
  // 0, o cálice, aberto em cima
  { barras: [[0, 0, 0, 2], [0, 2, 2, 2], [2, 0, 2, 2]], bolsoes: [[0.5, 0.4]], barrinhaDeitada: true, parDeitado: false },
  // 1, a abóbada, aberta embaixo
  { barras: [[0, 0, 2, 0], [0, 0, 0, 2], [2, 0, 2, 2]], bolsoes: [[0.5, 0.6]], barrinhaDeitada: true, parDeitado: false },
  // 2, o colchete, aberto à direita
  { barras: [[0, 0, 2, 0], [0, 0, 0, 2], [0, 2, 2, 2]], bolsoes: [[0.6, 0.5]], barrinhaDeitada: false, parDeitado: true },
  // 3, o colchete virado, aberto à esquerda
  { barras: [[0, 0, 2, 0], [2, 0, 2, 2], [0, 2, 2, 2]], bolsoes: [[0.4, 0.5]], barrinhaDeitada: false, parDeitado: true },
  // 4, o degrau: desce do alto à esquerda para o pé à direita
  { barras: [[0, 0, 1, 0], [1, 0, 1, 2], [1, 2, 2, 2]], bolsoes: [[0.8, 0.27], [0.2, 0.73]], barrinhaDeitada: false, parDeitado: false },
  // 5, o degrau espelhado
  { barras: [[1, 0, 2, 0], [1, 0, 1, 2], [0, 2, 1, 2]], bolsoes: [[0.2, 0.27], [0.8, 0.73]], barrinhaDeitada: false, parDeitado: false },
  // 6, os dois esquadros, um no canto de cima à esquerda e outro no de baixo à direita
  { barras: [[0, 0, 1, 0], [0, 0, 0, 1], [1, 2, 2, 2], [2, 1, 2, 2]], bolsoes: [[0.5, 0.5]], barrinhaDeitada: true, parDeitado: true },
  // 7, a caixa
  { barras: [[0, 0, 2, 0], [0, 2, 2, 2], [0, 0, 0, 2], [2, 0, 2, 2]], bolsoes: [[0.5, 0.5]], barrinhaDeitada: false, parDeitado: false },
]

/** O miolo: o ponto, a volta, a barrinha ou o par de pontos. */
type Miolo = 'ponto' | 'volta' | 'barrinha' | 'par'

/** O alfabeto: as dezesseis letras, [moldura, miolo]. As primeiras saem mais vezes no texto. */
const ALFABETO: readonly (readonly [number, Miolo])[] = [
  [0, 'ponto'], [7, 'ponto'], [2, 'volta'], [4, 'ponto'], [1, 'barrinha'], [3, 'par'], [6, 'volta'], [0, 'volta'],
  [5, 'ponto'], [1, 'ponto'], [7, 'volta'], [2, 'barrinha'], [0, 'par'], [3, 'ponto'], [6, 'barrinha'], [1, 'par'],
]
/** Quanto o texto puxa para as primeiras letras (1 = todas iguais). */
const PREFERENCIA_DO_TEXTO = 1.35

/** Os riscos de uma letra, em px a partir do canto do glifo: `CAMPOS` números por risco. */
function riscosDaLetra([indice, miolo]: readonly [number, Miolo]): Float64Array {
  const moldura = MOLDURAS[indice]
  const linha = [TRACO / 2, LADO / 2, LADO - TRACO / 2]
  const riscos: number[] = []
  const retangulo = (cx: number, cy: number, mx: number, my: number): void => {
    riscos.push(RETANGULO, cx, cy, mx, my)
  }
  for (const [i1, j1, i2, j2] of moldura.barras) {
    const [xa, ya, xb, yb] = [linha[i1], linha[j1], linha[i2], linha[j2]]
    retangulo((xa + xb) / 2, (ya + yb) / 2, Math.abs(xb - xa) / 2 + TRACO / 2, Math.abs(yb - ya) / 2 + TRACO / 2)
  }
  const [bx, by] = [moldura.bolsoes[0][0] * LADO, moldura.bolsoes[0][1] * LADO]
  if (miolo === 'ponto') retangulo(bx, by, (PONTO * TRACO) / 2, (PONTO * TRACO) / 2)
  else if (miolo === 'volta') riscos.push(VOLTA, bx, by, RAIO_DA_VOLTA * TRACO, ARO_DA_VOLTA * TRACO)
  else if (miolo === 'barrinha') {
    const meia = (BARRINHA * LADO) / 2
    if (moldura.barrinhaDeitada) retangulo(bx, by, meia, TRACO / 2)
    else retangulo(bx, by, TRACO / 2, meia)
  } else {
    const [dx, dy] = moldura.parDeitado ? [MEIO_PAR * LADO, 0] : [0, MEIO_PAR * LADO]
    const meio = (PONTO_DO_PAR * TRACO) / 2
    retangulo(bx - dx, by - dy, meio, meio)
    retangulo(bx + dx, by + dy, meio, meio)
  }
  // O degrau tem dois bolsões: o segundo leva sempre um ponto.
  if (moldura.bolsoes.length > 1) retangulo(moldura.bolsoes[1][0] * LADO, moldura.bolsoes[1][1] * LADO, (PONTO * TRACO) / 2, (PONTO * TRACO) / 2)
  return Float64Array.from(riscos)
}

const LETRAS: readonly Float64Array[] = ALFABETO.map(riscosDaLetra)

/** A grade de glifos de uma face: o canto do primeiro glifo, quantos cabem e a letra de cada casa. */
interface Grade {
  readonly x0: number
  readonly y0: number
  readonly colunas: number
  readonly fileiras: number
  readonly letras: Uint8Array
}

/** Quantos glifos cabem em `espaco` px e onde começa o primeiro, com a sobra repartida dos dois lados. */
function repartir(de: number, espaco: number): [number, number] {
  const quantos = espaco < LADO ? 0 : Math.floor((espaco - LADO) / PASSO) + 1
  return [quantos, de + (espaco - (quantos > 0 ? (quantos - 1) * PASSO + LADO : 0)) / 2]
}

/** A grade do retângulo (x0, y0)-(x1, y1), com a borda lisa em volta (a de baixo é `bordaDeBaixo`) e o texto `texto`. */
function gradeDaFace(x0: number, y0: number, x1: number, y1: number, bordaDeBaixo: number, texto: number): Grade {
  const [colunas, gx] = repartir(x0 + BORDA, x1 - x0 - 2 * BORDA)
  const [fileiras, gy] = repartir(y0 + BORDA, y1 - y0 - BORDA - bordaDeBaixo)
  const letras = new Uint8Array(colunas * fileiras)
  for (let j = 0; j < fileiras; j += 1) {
    for (let i = 0; i < colunas; i += 1) {
      const sorteio = hash(i, j, texto) ** PREFERENCIA_DO_TEXTO
      letras[j * colunas + i] = Math.min(ALFABETO.length - 1, Math.floor(sorteio * ALFABETO.length))
    }
  }
  return { x0: gx, y0: gy, colunas, fileiras, letras }
}

/** A distância (px) do ponto ao glifo da casa em que ele cai; `LONGE_DO_GLIFO` fora da grade. */
function distanciaAoGlifo(g: Grade, x: number, y: number): number {
  const fx = (x - g.x0 + MEIO_VAO) / PASSO
  const fy = (y - g.y0 + MEIO_VAO) / PASSO
  if (fx < 0 || fy < 0 || fx >= g.colunas || fy >= g.fileiras) return LONGE_DO_GLIFO
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const lx = x - g.x0 - i * PASSO
  const ly = y - g.y0 - j * PASSO
  const r = LETRAS[g.letras[j * g.colunas + i]]
  let d = LONGE_DO_GLIFO
  for (let o = 0; o < r.length; o += CAMPOS) {
    const dx = lx - r[o + 1]
    const dy = ly - r[o + 2]
    let e: number
    if (r[o] === RETANGULO) {
      const qx = Math.abs(dx) - r[o + 3]
      const qy = Math.abs(dy) - r[o + 4]
      e = qx > 0 ? (qy > 0 ? Math.sqrt(qx * qx + qy * qy) : qx) : qy > 0 ? qy : Math.max(qx, qy)
    } else {
      e = Math.abs(Math.sqrt(dx * dx + dy * dy) - r[o + 3]) - r[o + 4]
    }
    if (e < d) d = e
  }
  return d
}

// ---------- a rachadura ----------

/** Uma rachadura: os pontos da linha quebrada (x, y, x, y...) e a caixa dela com folga, onde a textura a procura. */
interface Racha {
  readonly pontos: Float64Array
  readonly b: Caixa
}

/** A grossura da fenda (meia, px), a força dela na luz e a folga da caixa. */
const MEIA_FENDA = 0.22
const ESCURO_DA_FENDA = 0.42
const FOLGA_DA_RACHA = 1.5
/** Os lances da rachadura: quantos, o comprimento (px, o mínimo e o que o sorteio soma) e o quanto cada um entorta (radianos). */
const LANCE_MINIMO = 3.4
const LANCE_SORTEADO = 4.2
const ENTORTA = 1.15

/** A rachadura que entra na face a partir de (x, y), no rumo dado, em `lances` lances tortos que voltam ao rumo. */
function rachadura(x: number, y: number, rumo: number, lances: number, semente: number): Racha {
  const pontos = [x, y]
  let [px, py, a] = [x, y, rumo]
  for (let k = 0; k < lances; k += 1) {
    a = rumo + (a - rumo) * 0.45 + (hash(k, semente, 7401) - 0.5) * ENTORTA
    const passo = LANCE_MINIMO + LANCE_SORTEADO * hash(k, semente, 7402)
    px += Math.cos(a) * passo
    py += Math.sin(a) * passo
    pontos.push(px, py)
  }
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pontos.length; i += 2) {
    x0 = Math.min(x0, pontos[i])
    x1 = Math.max(x1, pontos[i])
    y0 = Math.min(y0, pontos[i + 1])
    y1 = Math.max(y1, pontos[i + 1])
  }
  return { pontos: Float64Array.from(pontos), b: [x0 - FOLGA_DA_RACHA, y0 - FOLGA_DA_RACHA, x1 + FOLGA_DA_RACHA, y1 + FOLGA_DA_RACHA] }
}

/** Quanto da fenda cobre o ponto, de 0 a 1 (só dentro da caixa dela). */
function naFenda(r: Racha, x: number, y: number, escala: number): number {
  if (x < r.b[0] || x > r.b[2] || y < r.b[1] || y > r.b[3]) return 0
  const p = r.pontos
  let menor = Infinity
  for (let i = 2; i < p.length; i += 2) {
    const [ax, ay] = [p[i - 2], p[i - 1]]
    const [dx, dy] = [p[i] - ax, p[i + 1] - ay]
    let h = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9)
    h = h < 0 ? 0 : h > 1 ? 1 : h
    const [qx, qy] = [x - ax - dx * h, y - ay - dy * h]
    menor = Math.min(menor, qx * qx + qy * qy)
  }
  return limitar01(0.5 - (Math.sqrt(menor) - MEIA_FENDA) * escala)
}

// ---------- a textura das faces ----------

/** De onde vem a luz no chão (`RX`, `RY` de `motor.ts`): o lado de cima à esquerda da tela. */
const RUMO_DA_LUZ: Ponto = [-0.79, -0.61]
/** Abaixo desta escala (pixels da imagem por px do protótipo) as paredes do sulco e o grão caem em menos de um pixel: fica só o sulco. */
const ESCALA_DO_DETALHE = 1.5
/** As nuvens largas da pedra e o lado da luz (variação de luz). */
const NUVEM = 0.06
const LADO_DA_LUZ = 0.09
/** As manchas de tempo: a partir de que valor do ruído aparecem, a largura da beira e quanto puxam para a cor da mancha. */
const LIMIAR_DA_MANCHA = 0.2
const BEIRA_DA_MANCHA = 0.22
const FORCA_DA_MANCHA = 0.32
const ESCURO_DA_MANCHA = 0.05
/**
 * Na face da frente: até que fração da altura descem os escorridos de chuva, e a força deles; a altura do pé
 * úmido (px), quanto ele escurece e quanto puxa para a cor da mancha. Contidos: a frente já é mais escura, e
 * o sulco dela não pode sumir no sujo.
 */
const ESCORRIDO = 0.8
const FORCA_DO_ESCORRIDO = 0.38
const ALTURA_DA_UMIDADE = 9
const ESCURO_DA_UMIDADE = 0.08
const SUJO_DA_UMIDADE = 0.5
/** O sulco: o fundo, a parede do lado da luz (na sombra) e a do outro lado (o fio de luz), na luz da textura; a grossura de cada parede (px). */
const FUNDO_DO_SULCO = -0.04
const SOMBRA_DA_PAREDE = 0.3
const LUZ_DA_PAREDE = 0.5
const PAREDE_DA_SOMBRA = 0.8
const PAREDE_DA_LUZ = 0.62
/** Até onde (px) fora do glifo o pixel ainda pode ser coberto por ele (a beira esfumada do sulco no tamanho de mesa). */
const ALCANCE_DO_SULCO = 0.7

/** Uma face com glifos: o retângulo dela, a grade, de onde vem a luz (no referencial em que ela é montada), a rachadura e se é a da frente da 3/4. */
interface Face {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  readonly grade: Grade
  readonly luz: Ponto
  readonly racha: Racha
  readonly frente: boolean
  readonly semente: number
}

/** A distância (px) do ponto ao entalhe mais perto da face: o glifo da casa dele ou o friso em volta das inscrições. */
function distanciaAoEntalhe(f: Face, x: number, y: number): number {
  const qx = Math.abs(x - (f.x0 + f.x1) / 2) - ((f.x1 - f.x0) / 2 - RECUO_DO_FRISO)
  const qy = Math.abs(y - (f.y0 + f.y1) / 2) - ((f.y1 - f.y0) / 2 - RECUO_DO_FRISO)
  const caixa = qx > 0 && qy > 0 ? Math.sqrt(qx * qx + qy * qy) : Math.max(qx, qy)
  return Math.min(distanciaAoGlifo(f.grade, x, y), Math.abs(caixa) - MEIO_FRISO)
}

/** A razão, canal a canal, entre duas cores: o sulco e a mancha seguem o tom da peça (a face da frente é mais escura). */
function razao(de: Rgb, para: Rgb): Rgb {
  return [de[0] / Math.max(1, para[0]), de[1] / Math.max(1, para[1]), de[2] / Math.max(1, para[2])]
}

/** O reflexo largo da face da frente, do alto (0) ao pé (1): claro no alto, uma faixa escura e o pé meio-termo. */
function reflexoDeFrente(t: number): number {
  return 0.7 * Math.cos(t * 3.1) + 0.3 * Math.cos(t * 8.6 + 0.7)
}

/**
 * A pintura de uma face, num passo só por pixel: a pedra (as nuvens, o grão, o lado da luz e o reflexo), as
 * manchas de tempo (e, na frente, os escorridos e o pé úmido), a rachadura e o glifo entalhado.
 */
function texDaFace(f: Face, cores: CoresDoBloco): Textura {
  const { racha } = f
  const [lx, ly] = f.luz
  const doSulco = razao(cores.sulco, cores.pedra)
  const daMancha = razao(cores.mancha, cores.pedra)
  const [cx, cy] = [(f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2]
  const meia = Math.max(f.x1 - f.x0, f.y1 - f.y0) / 2
  const altura = f.y1 - f.y0
  const [s1, s2, s3] = [hash(f.semente, 1, 7310) * 97, hash(f.semente, 2, 7310) * 97, hash(f.semente, 3, 7310) * 97]
  return (_u, _v, x, y, _p, s, escala) => {
    // A pedra polida: as nuvens largas, o grão de perto, o lado da luz e o reflexo.
    let luz = ruido(x * 0.05 + s1, y * 0.05 + s2) * NUVEM + ruido(x * 0.19 + s2, y * 0.19 + s3) * NUVEM * 0.45
    if (escala >= ESCALA_DO_DETALHE) luz += (hash(Math.floor(x * 1.8), Math.floor(y * 1.8), f.semente) - 0.5) * cores.grao
    const rumo = ((x - cx) * lx + (y - cy) * ly) / meia
    luz += LADO_DA_LUZ * rumo + cores.reflexo * (f.frente ? reflexoDeFrente((y - f.y0) / altura) : Math.sin(rumo * 2.3 + 0.5))

    // O tempo: as manchas e, na frente, os escorridos que descem do alto e o pé úmido.
    let sujo = limitar01((ruido(x * 0.042 + s3, y * 0.042 + s1) + 0.5 * ruido(x * 0.12 + s1, y * 0.12 + s3) - LIMIAR_DA_MANCHA) / BEIRA_DA_MANCHA) * FORCA_DA_MANCHA
    if (f.frente) {
      const desce = 1 - (y - f.y0) / (altura * ESCORRIDO)
      if (desce > 0) sujo = Math.max(sujo, limitar01((ruido(x * 0.55 + s2, y * 0.022 + s3) - 0.08) / 0.18) * desce * FORCA_DO_ESCORRIDO)
      const pe = 1 - (f.y1 - y) / ALTURA_DA_UMIDADE
      if (pe > 0) {
        luz -= pe * pe * ESCURO_DA_UMIDADE
        sujo = Math.max(sujo, pe * SUJO_DA_UMIDADE)
      }
    }
    if (sujo > 0) {
      s[0] += (s[0] * daMancha[0] - s[0]) * sujo
      s[1] += (s[1] * daMancha[1] - s[1]) * sujo
      s[2] += (s[2] * daMancha[2] - s[2]) * sujo
      luz -= sujo * ESCURO_DA_MANCHA
    }
    luz -= ESCURO_DA_FENDA * naFenda(racha, x, y, escala)

    // O entalhe: o sulco escuro e, de perto, a parede do lado da luz na sombra e o fio de luz da outra.
    const d = distanciaAoEntalhe(f, x, y)
    if (d < ALCANCE_DO_SULCO) {
      const cob = limitar01(0.5 - d * escala)
      if (cob > 0) {
        s[0] += (s[0] * doSulco[0] - s[0]) * cob
        s[1] += (s[1] * doSulco[1] - s[1]) * cob
        s[2] += (s[2] * doSulco[2] - s[2]) * cob
        let parede = 0
        if (escala >= ESCALA_DO_DETALHE) {
          const sombra = limitar01(0.5 + distanciaAoEntalhe(f, x + lx * PAREDE_DA_SOMBRA, y + ly * PAREDE_DA_SOMBRA) * escala)
          const clara = limitar01(0.5 + distanciaAoEntalhe(f, x - lx * PAREDE_DA_LUZ, y - ly * PAREDE_DA_LUZ) * escala) * (1 - sombra)
          parede = LUZ_DA_PAREDE * clara - SOMBRA_DA_PAREDE * sombra
        }
        luz += cob * (FUNDO_DO_SULCO + parede)
      }
    }
    s[3] += luz
  }
}

/** A quebra da lasca e dos cacos: a pedra de dentro, fosca e áspera, em escamas. */
function texDaQuebra(semente: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    let luz = ruido(x * 0.7 + semente, y * 0.7) * 0.16 + ruido(x * 0.23, y * 0.23 + semente) * 0.1
    if (escala >= ESCALA_DO_DETALHE) luz += (hash(Math.floor(x * 2.2), Math.floor(y * 2.2), semente) - 0.5) * 0.08
    s[3] += luz
  }
}

// ---------- a lasca ----------

/** A lasca do canto de cima à direita: quanto falta ao longo da beira de cima e da da direita (px). */
const LASCA_EM_X = 9.5
const LASCA_EM_Y = 7.5
/** O recorte da lasca por dentro, de uma beira à outra: [fração de `LASCA_EM_X` para a esquerda, fração de `LASCA_EM_Y` para baixo], a partir do canto. */
const RECORTE_DA_LASCA: readonly Ponto[] = [[1, 0.05], [0.76, 0.24], [0.58, 0.3], [0.44, 0.55], [0.22, 0.62], [0.12, 0.86], [0.03, 1]]
/** Na face da frente, a lasca desce este tanto (px) e o recorte é o mesmo, deitado. */
const LASCA_NA_FRENTE = 5.5
/** A quebra fica um pouco mais escura que a pedra polida de cima (é inclinada, de costas para a luz). */
const TOM_DA_QUEBRA = 0.9
/** O meio da caixa da lasca de cima, a esta distância das duas beiras (px): dentro da coluna em qualquer giro. */
const MEIO_DA_LASCA = 12
/** Os cacos no chão, perto do canto lascado: [para a direita, para baixo] a partir do canto (px), o raio e o giro. */
const CACOS: readonly (readonly [number, number, number, number])[] = [
  [4.2, -3.4, 2.3, 0.4],
  [6.8, 3.6, 1.5, 1.9],
  [2.4, 11, 1.2, 2.8],
]

/** O canto lascado (o pedaço que falta) no canto (cx, cy) da face: `sx`, `sy` = para onde é a beira (+1 direita/baixo). */
function pedacoQueFalta(cx: number, cy: number, sx: number, sy: number, emX: number, emY: number): Forma {
  const pontos: Ponto[] = [[cx + sx, cy + sy], [cx - sx * (emX + 0.5), cy + sy]]
  for (const [fx, fy] of RECORTE_DA_LASCA) pontos.push([cx - sx * emX * fx, cy - sy * emY * fy])
  pontos.push([cx + sx, cy - sy * (emY + 0.5)])
  return poligono(pontos)
}

/** A mesma forma numa caixa com o meio em (cx, cy): a 3/4 sobe a peça com a estrutura que contém o meio da caixa dela. */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - f.b[0], f.b[2] - cx)
  const my = Math.max(cy - f.b[1], f.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: f.d }
}

// ---------- o pé: a terra e o capim ----------

/** O capim: o verde da grama puxado para o musgo (o capim da mata, mais escuro que o do gramado), e o tom das folhas de trás e da frente. */
const CAPIM: MaterialDaPeca = { classe: 'folha', rgb: misturar(rgb(tomDoMeio('grama', 0.86)), rgb(tomDoMeio('musgo', 1.02)), 0.4) }
const TOM_DAS_FOLHAS_DE_TRAS = 0.78
const TOM_DAS_FOLHAS_DA_FRENTE = 1.04
/** A terra encostada: a da mata, escura, meio transparente e de beira macia. */
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('lenha', 1.04)) }
const ALFA_DA_TERRA = 0.42
const BEIRA_DA_TERRA = 1.4
/** As pedrinhas na terra. */
const PEDRINHA: MaterialDaPeca = { classe: 'pedra', rgb: rgb(tomDoMeio('granito', 0.92)), pedra: 'granito' }

/** Um tufo a cada tanto de beira (px), a chance de a vaga ficar vazia, e o mesmo para os montes de terra. */
const VAGA_DO_TUFO = 15
const TUFO_FALTA = 0.38
const VAGA_DA_TERRA = 9
const TERRA_FALTA = 0.3
/**
 * As folhas de um tufo: quantas (o mínimo e o que o sorteio soma), a meia largura no pé (px), e o leque
 * (radianos, para cada lado) e o comprimento (px) do tufo deitado no chão, visto de cima, e do tufo de pé,
 * encostado na face da frente da 3/4 (mais fechado: o capim sobe rente à pedra).
 */
const FOLHAS_MINIMAS = 4
const FOLHAS_SORTEADAS = 3
const MEIA_FOLHA = 0.62
const FOLHA_DE_CIMA = { de: 3, ate: 6.5, leque: 1.25 } as const
const FOLHA_DE_PE = { de: 3.8, ate: 8.6, leque: 0.7 } as const
/** O capim de pé não passa das beiras da face (px para dentro): de cima, a cópia guardada dele fica toda debaixo da face de cima. */
const MARGEM_DO_CAPIM_DE_PE = 1.5
/** O monte de terra: o comprimento ao longo da beira e a largura (meias, px), e quanto sai para fora da beira. */
const MONTE = { comprido: 4.2, sorteado: 4.5, largo: 2.2 } as const
const SAIDA_DO_MONTE = 1.1

/** Uma vaga do pé, ao longo de uma beira: onde (de -1 a 1), o tamanho do tufo e a semente. */
interface Vaga {
  readonly t: number
  readonly tamanho: number
  readonly semente: number
}

/** As vagas de tufo de uma beira de `comprimento` px: uma a cada `VAGA_DO_TUFO`, algumas vazias. */
function vagasDosTufos(comprimento: number, semente: number): Vaga[] {
  const n = Math.max(2, Math.round(comprimento / VAGA_DO_TUFO))
  const vagas: Vaga[] = []
  for (let k = 0; k < n; k += 1) {
    if (hash(k, semente, 7501) < TUFO_FALTA) continue
    const t = ((k + 0.5 + (hash(k, semente, 7502) - 0.5) * 0.7) / n) * 2 - 1
    vagas.push({ t, tamanho: 0.7 + 0.5 * hash(k, semente, 7503), semente: semente * 37 + k })
  }
  return vagas
}

/** As beiras do pé no referencial do objeto: o ponto de cada uma em t (de -1 a 1) e para onde é o lado de fora. */
interface Beira {
  readonly ponto: (t: number) => Ponto
  readonly fora: Ponto
  readonly comprimento: number
}

function beirasDoPe(bx: number, by: number): readonly Beira[] {
  return [
    { ponto: (t) => [t * bx, -by], fora: [0, -1], comprimento: 2 * bx },
    { ponto: (t) => [bx, t * by], fora: [1, 0], comprimento: 2 * by },
    { ponto: (t) => [t * bx, by], fora: [0, 1], comprimento: 2 * bx },
    { ponto: (t) => [-bx, t * by], fora: [-1, 0], comprimento: 2 * by },
  ]
}

/** A beira que fica embaixo na tela com o giro (o norte, o leste, o sul ou o oeste do objeto). */
const BEIRA_DA_FRENTE = [2, 1, 0, 3] as const

/** Uma folha de capim: o triângulo do pé (x, y), com a meia largura `meia`, até a ponta. */
function folha(x: number, y: number, pontaX: number, pontaY: number, meia: number): Forma {
  const l = Math.hypot(pontaX - x, pontaY - y) || 1
  const [nx, ny] = [(-(pontaY - y) / l) * meia, ((pontaX - x) / l) * meia]
  return poligono([[x + nx, y + ny], [pontaX, pontaY], [x - nx, y - ny]])
}

/** Várias folhas numa forma só (o tufo): a menor distância. */
function feixe(folhas: readonly Forma[]): Forma {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const f of folhas) {
    x0 = Math.min(x0, f.b[0])
    y0 = Math.min(y0, f.b[1])
    x1 = Math.max(x1, f.b[2])
    y1 = Math.max(y1, f.b[3])
  }
  return {
    b: [x0, y0, x1, y1],
    d(x, y) {
      let d = Infinity
      for (const f of folhas) d = Math.min(d, f.d(x, y))
      return d
    },
  }
}

/** O feitio de um tufo: o comprimento das folhas (px, o menor e o maior) e o leque (radianos, para cada lado). */
interface FeitioDoTufo {
  readonly de: number
  readonly ate: number
  readonly leque: number
}

/**
 * O tufo de folhas que sai do pé (x, y) para o lado (fx, fy), aberto em leque: as folhas de trás e as da
 * frente. Nenhuma ponta passa de `limiteX` para os lados (o capim de pé fica dentro da largura da face).
 */
function tufo(x: number, y: number, fx: number, fy: number, tamanho: number, feitio: FeitioDoTufo, semente: number, limiteX = Infinity): [Forma, Forma] {
  const n = FOLHAS_MINIMAS + Math.floor(hash(1, semente, 7511) * FOLHAS_SORTEADAS)
  const rumo = Math.atan2(fy, fx)
  const atras: Forma[] = []
  const frente: Forma[] = []
  for (let k = 0; k < n; k += 1) {
    const a = rumo + ((k + 0.5) / n - 0.5) * 2 * feitio.leque + (hash(k, semente, 7512) - 0.5) * 0.4
    const comprimento = (feitio.de + (feitio.ate - feitio.de) * hash(k, semente, 7513)) * tamanho
    // O pé de cada folha anda um pouco ao longo da beira.
    const pe = (hash(k, semente, 7514) - 0.5) * 2.4
    const px = Math.max(-limiteX, Math.min(limiteX, x - fy * pe))
    const py = y + fx * pe
    const pontaX = Math.max(-limiteX, Math.min(limiteX, px + Math.cos(a) * comprimento))
    ;(k % 2 === 0 ? atras : frente).push(folha(px, py, pontaX, py + Math.sin(a) * comprimento, MEIA_FOLHA * (0.8 + 0.4 * tamanho)))
  }
  return [feixe(atras), feixe(frente)]
}

/** Põe as folhas de trás e as da frente de um tufo. */
function porTufo(L: Peca[], P: CriarPeca, [atras, frente]: [Forma, Forma], semente: number): void {
  L.push(P(atras, CAPIM, { bisel: 0.35, tom: TOM_DAS_FOLHAS_DE_TRAS, contorno: 0.24, semente }))
  L.push(P(frente, CAPIM, { bisel: 0.35, tom: TOM_DAS_FOLHAS_DA_FRENTE, contorno: 0.24, semente: semente + 1 }))
}

/** A terra e o capim em volta do pé, vistos de cima (no referencial do objeto: giram com ele). */
function montarPe(c: ContextoDoMovel, L: Peca[], cena: Cena, bx: number, by: number, texto: number): void {
  const P = c.peca
  const beiras = beirasDoPe(bx, by)
  // A terra primeiro (por baixo do capim): montes compridos ao longo da beira, saindo um pouco para fora.
  beiras.forEach((beira, lado) => {
    const n = Math.max(2, Math.round(beira.comprimento / VAGA_DA_TERRA))
    for (let k = 0; k < n; k += 1) {
      const sem = texto * 131 + lado * 17 + k
      if (hash(k, sem, 7521) < TERRA_FALTA) continue
      const [x, y] = beira.ponto(((k + 0.5) / n) * 2 - 1)
      const [fx, fy] = beira.fora
      const comprido = MONTE.comprido + MONTE.sorteado * hash(k, sem, 7522)
      const largo = MONTE.largo * (0.7 + 0.6 * hash(k, sem, 7523))
      const [rx, ry] = fx !== 0 ? [largo, comprido] : [comprido, largo]
      L.push(P(elipse(x + fx * SAIDA_DO_MONTE, y + fy * SAIDA_DO_MONTE, rx, ry), TERRA, { bisel: 0, contorno: 0, alfa: ALFA_DA_TERRA, suave: BEIRA_DA_TERRA, semente: sem }))
      if (hash(k, sem, 7524) < 0.22) {
        const r = 0.7 + 0.6 * hash(k, sem, 7525)
        const pedrinha = elipse(x + fx * (SAIDA_DO_MONTE + 1.6) - fy * 1.5, y + fy * (SAIDA_DO_MONTE + 1.6) + fx * 1.5, r, r * 0.8)
        cena.sombras.push(contato(pedrinha, 0.24))
        L.push(P(pedrinha, PEDRINHA, { bisel: r * 0.7, contorno: 0.3, semente: sem + 3 }))
      }
    }
  })
  // O capim: os tufos de cada beira, do pé para fora (o pé fica debaixo do bloco).
  beiras.forEach((beira, lado) => {
    for (const vaga of vagasDosTufos(beira.comprimento, texto * 53 + lado)) {
      const [x, y] = beira.ponto(vaga.t)
      const [fx, fy] = beira.fora
      porTufo(L, P, tufo(x + fx * 0.8, y + fy * 0.8, fx, fy, vaga.tamanho, FOLHA_DE_CIMA, vaga.semente), vaga.semente)
    }
  })
}

// ---------- o giro ----------

/** O ponto do objeto na tela, depois de `quartos` quartos de volta (`girarPonto` de `tresQuartos.ts`). */
function naTela([x, y]: Ponto, quartos: number): Ponto {
  return quartos === 1 ? [-y, x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [y, -x] : [x, y]
}

/** O vetor da tela no referencial do objeto (o contrário de `naTela`). */
function noObjeto([x, y]: Ponto, quartos: number): Ponto {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

// ---------- a coluna e a face da frente, na tela ----------

/** O que a frente precisa saber do bloco, já na tela. */
interface Frente {
  /** A meia largura e a meia fundura do bloco na tela, e a altura (px). */
  readonly mx: number
  readonly my: number
  readonly altura: number
  /** O lado da tela do canto lascado, quando a lasca fica na beira da frente (-1 esquerda, 1 direita), e a largura dela ali. */
  readonly lasca: { readonly lado: number; readonly largura: number } | null
  /** As vagas de capim da beira que fica na frente, já em x da tela. */
  readonly capim: readonly (Vaga & { readonly x: number })[]
  readonly texto: number
}

/**
 * A coluna da 3/4 (a sombra do bloco alto e o contato), e a face da frente desenhada no lugar da tela e
 * guardada em fatias debaixo da face de cima, com a lasca da frente e o capim encostado no pé.
 */
function montarFrente(P: CriarPeca, tela: Cena, cores: CoresDoBloco, f: Frente): void {
  const { mx, my, altura } = f
  const pe = my - FAIXA_DOS_PINOS
  const coluna = caixa(-mx, -my, mx, pe, CANTO)
  tela.sombras.push({ forma: coluna, z: altura, forca: FORCA_DA_SOMBRA }, contato(coluna, FORCA_DO_CONTATO))

  // A face: da beira de baixo da face de cima (subida) até o pé.
  const topo = my - altura
  const retangulo = caixa(-mx, topo, mx, pe, CANTO)
  const furo = f.lasca === null ? null : pedacoQueFalta(f.lasca.lado * mx, topo, f.lasca.lado, -1, f.lasca.largura, LASCA_NA_FRENTE)
  const face: Face = {
    x0: -mx,
    y0: topo,
    x1: mx,
    y1: pe,
    grade: gradeDaFace(-mx, topo, mx, pe, BORDA_DO_PE, f.texto),
    luz: RUMO_DA_LUZ,
    racha: rachadura(mx * (hash(f.texto, 4, 7601) - 0.5) * 1.1, pe, -Math.PI / 2 + (hash(f.texto, 5, 7601) - 0.5) * 0.5, 5, f.texto),
    frente: true,
    semente: f.texto,
  }
  const quadro: PecaDoQuadro = {
    forma: furo === null ? retangulo : menos(retangulo, furo),
    mat: { classe: 'liso', rgb: cores.pedra },
    o: { bisel: BISEL_DA_FACE, tom: TOM_DA_FACE, contorno: 0.26, metal: cores.brilho, textura: texDaFace(face, cores), semente: 7320 },
  }

  // As fatias: cada uma guardada na mesma faixa debaixo da face de cima, subindo uma fatia a mais que a de baixo.
  const alturaDaFace = pe - topo
  const maxima = 2 * my - FAIXA_DOS_PINOS + SUBIDA_DA_FATIA_DE_BAIXO - FOLGA_DO_GUARDADO - SOBRA_DA_FATIA
  const fatias = Math.max(1, Math.ceil(alturaDaFace / maxima))
  const fatia = alturaDaFace / fatias
  for (let i = 0; i < fatias; i += 1) {
    const pino: Pino = { x: (i - (fatias - 1) / 2) * PASSO_DOS_PINOS, y: pe + PINOS_DA_FACE.y, z: SUBIDA_DA_FATIA_DE_BAIXO + i * fatia, ordem: pe + PINOS_DA_FACE.ordem }
    pregar(tela, pino)
    pendurar(P, tela.partes, quadro, pino, [pe - (i + 1) * fatia, pe - i * fatia])
  }

  // A quebra da lasca, no alto da face (na fatia de cima).
  if (furo !== null && f.lasca !== null) {
    const pino: Pino = { x: f.lasca.lado * (mx - f.lasca.largura / 2), y: pe + PINOS_DA_LASCA.y, z: SUBIDA_DA_FATIA_DE_BAIXO + (fatias - 1) * fatia, ordem: pe + PINOS_DA_LASCA.ordem }
    pregar(tela, pino)
    const quebra: PecaDoQuadro = { forma: dentroDe(furo, retangulo), mat: { classe: 'liso', rgb: cores.quebra }, o: { bisel: 0.6, tom: TOM_DA_QUEBRA * TOM_DA_FACE, contorno: 0.3, textura: texDaQuebra(f.texto), semente: 7330 } }
    pendurar(P, tela.partes, quebra, pino, [topo - 1, pe - (fatias - 1) * fatia])
  }

  // O capim encostado no pé da face, de pé, cada tufo no seu pino.
  f.capim.forEach((vaga, k) => {
    const pino: Pino = { x: vaga.x, y: pe + PINOS_DO_CAPIM.y, z: SUBIDA_DO_CAPIM, ordem: pe + PINOS_DO_CAPIM.ordem + k * 0.002 }
    pregar(tela, pino)
    const [atras, frente] = tufo(vaga.x, pe + 0.5, 0, -1, vaga.tamanho, FOLHA_DE_PE, vaga.semente, mx - MARGEM_DO_CAPIM_DE_PE)
    pendurar(P, tela.partes, { forma: atras, mat: CAPIM, o: { bisel: 0.35, tom: TOM_DAS_FOLHAS_DE_TRAS, contorno: 0.24, semente: vaga.semente } }, pino)
    pendurar(P, tela.partes, { forma: frente, mat: CAPIM, o: { bisel: 0.35, tom: TOM_DAS_FOLHAS_DA_FRENTE, contorno: 0.24, semente: vaga.semente + 1 } }, pino)
  })
}

// ---------- o bloco ----------

/** Monta o bloco de inscrições com as cores dadas (os três objetos chamam isto). */
export function montarBlocoDeInscricoes(c: ContextoDoMovel, cena: Cena, cores: CoresDoBloco): void {
  const P = c.peca
  const L = cena.partes
  const quartos = quartosDoGiro(c.giro)
  cena.corDoPiso = cores.piso
  const bx = c.hw - RECUO
  const by = c.hh - RECUO
  const altura = Math.max(ALTURA_MINIMA * c.g, (c.w + c.h) / 2)

  // No chão, por baixo de tudo: a terra, as pedrinhas e o capim do pé, e os cacos da lasca.
  montarPe(c, L, cena, bx, by, cores.texto)
  CACOS.forEach(([dx, dy, r, giro], k) => {
    const pontos: Ponto[] = []
    for (let i = 0; i < 5; i += 1) {
      const a = giro + (i / 5) * Math.PI * 2 + (hash(i, k, 7701) - 0.5) * 0.7
      const raio = r * (0.65 + 0.5 * hash(i, k, 7702))
      pontos.push([bx + dx + Math.cos(a) * raio, -by + dy + Math.sin(a) * raio])
    }
    const caco = poligono(pontos)
    cena.sombras.push(contato(caco, 0.3))
    L.push(P(caco, { classe: 'liso', rgb: cores.quebra }, { bisel: 0.5, tom: TOM_DA_QUEBRA, contorno: 0.3, textura: texDaQuebra(k), semente: 7710 + k }))
  })

  // A coluna e a face da frente, montadas na tela e devolvidas ao objeto. O lado da frente na tela tem o seu
  // texto, o seu capim e, se o giro leva a lasca para a beira da frente, a lasca no alto da face.
  const [mx, my] = quartos % 2 === 1 ? [by, bx] : [bx, by]
  const canto = naTela([bx, -by], quartos)
  const beira = beirasDoPe(bx, by)[BEIRA_DA_FRENTE[quartos]]
  const capim = vagasDosTufos(beira.comprimento, cores.texto * 53 + BEIRA_DA_FRENTE[quartos]).map((vaga) => ({ ...vaga, x: naTela(beira.ponto(vaga.t), quartos)[0] }))
  const frente: Frente = {
    mx,
    my,
    altura,
    lasca: canto[1] > 0 ? { lado: Math.sign(canto[0]), largura: quartos === 1 ? LASCA_EM_Y : LASCA_EM_X } : null,
    capim,
    texto: cores.texto * 11 + quartos,
  }
  if (quartos === 0) montarFrente(P, cena, cores, frente)
  else {
    const tela: Cena = { partes: [], sombras: [] }
    montarFrente(P, tela, cores, frente)
    desgirarCena(tela, quartos, cena)
  }

  // A face de cima, por cima de tudo: a quebra da lasca e, por cima dela, a face recortada.
  const topo = caixa(-bx, -by, bx, by, CANTO)
  const furo = pedacoQueFalta(bx, -by, 1, -1, LASCA_EM_X, LASCA_EM_Y)
  const face: Face = {
    x0: -bx,
    y0: -by,
    x1: bx,
    y1: by,
    grade: gradeDaFace(-bx, -by, bx, by, BORDA, cores.texto * 11 + 7),
    luz: noObjeto(RUMO_DA_LUZ, quartos),
    racha: rachadura(-bx, by * (hash(cores.texto, 6, 7601) - 0.2) * 0.8, (hash(cores.texto, 7, 7601) - 0.5) * 0.6, 6, cores.texto + 50),
    frente: false,
    semente: cores.texto + 30,
  }
  const quebra = comMeioEm(dentroDe(furo, topo), bx - MEIO_DA_LASCA, -by + MEIO_DA_LASCA)
  L.push(P(quebra, { classe: 'liso', rgb: cores.quebra }, { bisel: 0.6, tom: TOM_DA_QUEBRA, contorno: 0.3, textura: texDaQuebra(cores.texto), semente: 7340 }))
  L.push(P(menos(topo, furo), { classe: 'liso', rgb: cores.pedra }, { bisel: BISEL_DO_TOPO, contorno: 0.28, metal: cores.brilho, textura: texDaFace(face, cores), semente: 7350 }))
}
