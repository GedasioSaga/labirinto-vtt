/**
 * BANCA DE FRUTAS de cima com volume (lote 3 dos objetos novos, 11/11/2026): a
 * banca aberta da feira, sem toldo. Uma mesa de tábuas INCLINADA para a
 * freguesia, em dois degraus (o de trás mais alto), cheia de mercadoria:
 * - atrás, o caixote de MAÇÃS em monte (lustrosas, com o cabinho), o de
 *   VERDURAS (os pés de alface e de repolho e o maço de cenouras, com a rama) e
 *   o de LARANJAS;
 * - na frente, as ABÓBORAS soltas na tábua (gomos e cabo), o caixote de UVAS
 *   (os cachos roxos e verdes sobre as folhas de parreira) e a BALANÇA de dois
 *   pratos de latão, com as maçãs num prato, os pesos de ferro no outro e a
 *   fileira de pesos na tábua.
 *
 * Não é a barraca (`barraca.ts`): lá o toldo listrado cobre quase tudo e o
 * balcão mostra uma fileira de sete frutas; aqui não há pano nenhum, a banca é
 * a mesa cheia, com os caixotes de ripas e os montes de cor.
 *
 * Na 3/4 (`tresQuartos.ts`) cada degrau é um tampo solto, com a beirada
 * `ESPESSURA_DA_BANCA` (a diferença de altura entre os dois: a beirada do de
 * trás desce exatamente até o tampo do da frente, e a banca vira uma escada de
 * tábuas), e as quatro pernas são colunas. O degrau de trás faz sombra no da
 * frente.
 *
 * A 25% de zoom sobram os seis blocos de cor (vermelho, verde, laranja, ocre,
 * roxo e o brilho do latão) dentro das ripas claras. Material: `madeira` (a
 * mesa); os caixotes de pinho, a mercadoria e a balança são fixos. As frutas
 * dos montes, as cenouras e os cachos têm tamanho fixo: a banca esticada
 * ganha mais deles, não frutas maiores (as abóboras e os pés de verdura
 * acompanham a profundidade do degrau).
 */
import { hash } from '../../ruido'
import { caixa, capsula, dentroDe, elipse, elipseGirada, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, type CriarPeca, type MaterialDaPeca, type Peca, type Projecao, type Textura } from './motor'
import { BURACO, G, LENCOL, PREGO, QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** Altura do degrau da frente e o quanto o de trás fica acima dele, em casas: mais alto, para a freguesia ver a mercadoria do fundo. */
const ALTURA_DA_FRENTE = 0.58
const DEGRAU = 0.28
const ALTURA_DE_TRAS = ALTURA_DA_FRENTE + DEGRAU
/**
 * A beirada de cada degrau na 3/4 (px do protótipo): a diferença de altura entre os dois, para a do degrau de
 * trás descer exatamente até o tampo do da frente. O perfil da banca em `tresQuartos.ts` usa este valor.
 */
export const ESPESSURA_DA_BANCA = DEGRAU * G
/** Onde o degrau de trás acaba e o da frente começa, em fração da profundidade a partir do fundo. */
const DIVISA_DOS_DEGRAUS = 0.49
/** A folga da mesa até a beira da pegada (px do protótipo). */
const FOLGA_DA_MESA = 0.6
/** Cada degrau é feito de tantas tábuas ao comprido, com uma ripa pregada na beira da frente (px do protótipo). */
const TABUAS_DO_DEGRAU = 3
const RIPA_DA_BEIRA = 1.7
/** A sombra do degrau de trás no da frente. */
const SOMBRA_DO_DEGRAU: Projecao = { dist: 4.4, forca: 0.36, suave: 1.6 }
/** As pernas: o lado de cada uma e o quanto ficam para dentro do canto (px do protótipo). */
const LADO_DA_PERNA = 3.6
const RECUO_DA_PERNA = 2.2

/** O que a banca expõe. */
type Mercadoria = 'macas' | 'verduras' | 'laranjas' | 'aboboras' | 'uvas' | 'balanca'
/** O que vai em cada degrau, da esquerda para a direita, e a parte da largura que cada vão ocupa. */
type Vaos = readonly (readonly [Mercadoria, number])[]
const NO_DEGRAU_DE_TRAS: Vaos = [['macas', 0.33], ['verduras', 0.35], ['laranjas', 0.32]]
const NO_DEGRAU_DA_FRENTE: Vaos = [['aboboras', 0.38], ['uvas', 0.32], ['balanca', 0.3]]
/** O respiro entre um vão e o vizinho, e entre o vão e a beira do degrau (px do protótipo). */
const ENTRE_VAOS = 0.9

// ---------- as cores (vivas, mas contidas: saturação HSV abaixo de 0,6) ----------

/** O pinho dos caixotes (o da caixa do catálogo), mais claro que a mesa. */
const PINHO = materialDaPeca('pinho')
const LATAO = materialDaPeca('latao')
const MACA: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x52, 0x46] }
const MACA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [0x96, 0x46, 0x42] }
const MACA_VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0xa4, 0xa8, 0x60] }
const LARANJA: MaterialDaPeca = { classe: 'liso', rgb: [0xd2, 0x92, 0x58] }
const LARANJA_MADURA: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0x86, 0x54] }
const ABOBORA: MaterialDaPeca = { classe: 'liso', rgb: [0xc8, 0x8e, 0x56] }
const ABOBORA_VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0x6c, 0x80, 0x5c] }
const MORANGA: MaterialDaPeca = { classe: 'liso', rgb: [0xd4, 0xb8, 0x84] }
const UVA_ROXA: MaterialDaPeca = { classe: 'liso', rgb: [0x72, 0x58, 0x86] }
const UVA_VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0xa2, 0xae, 0x70] }
const CENOURA: MaterialDaPeca = { classe: 'liso', rgb: [0xcc, 0x8a, 0x58] }
/** As folhas (a classe `folha` dá a luz manchada): a alface, o repolho, o miolo claro, a rama e a parreira. */
const ALFACE: MaterialDaPeca = { classe: 'folha', rgb: [0x84, 0xa2, 0x5e] }
const REPOLHO: MaterialDaPeca = { classe: 'folha', rgb: [0x76, 0x98, 0x70] }
const MIOLO: MaterialDaPeca = { classe: 'folha', rgb: [0xb4, 0xc4, 0x84] }
const RAMA: MaterialDaPeca = { classe: 'folha', rgb: [0x6a, 0x8c, 0x52] }
const PARREIRA: MaterialDaPeca = { classe: 'folha', rgb: [0x6e, 0x8e, 0x5a] }
/** O cabinho da fruta, o cabo da abóbora e o engaço do cacho: um pardo esverdeado. */
const CABO: MaterialDaPeca = { classe: 'liso', rgb: [0x74, 0x64, 0x42] }
/** O lustro da casca da maçã: um ponto claro do lado da luz. */
const LUSTRO: MaterialDaPeca = { classe: 'liso', rgb: [0xf0, 0xe6, 0xd6] }
/** A tinta da etiqueta de preço. */
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x48, 0x3a] }

/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5

// ---------- o caixote ----------

/** A grossura da ripa do caixote, vista de cima (px do protótipo). */
const RIPA = 1.8

/** Um caixote de feira visto de cima: o fundo escuro, as quatro ripas da borda e um prego em cada canto. Devolve o vão de dentro. */
function caixote(P: CriarPeca, L: Peca[], [x0, y0, x1, y1]: Caixa, sem: number): Caixa {
  L.push(P(caixa(x0 + RIPA / 2, y0 + RIPA / 2, x1 - RIPA / 2, y1 - RIPA / 2), BURACO, { bisel: 0, contorno: 0, semente: sem }))
  const ripa = (forma: Forma, eixo: number, k: number): void => {
    L.push(P(forma, PINHO, { eixo, tabua: 0, bisel: 0.8, tom: 0.96 + 0.1 * hash(k, sem, 431), contorno: 0.26, semente: sem + k, projeta: { dist: 0.9, forca: 0.26, suave: 0.6 } }))
  }
  ripa(caixa(x0, y0, x0 + RIPA, y1, 0.4), QUARTO, 1)
  ripa(caixa(x1 - RIPA, y0, x1, y1, 0.4), QUARTO, 2)
  ripa(caixa(x0 + RIPA - 0.2, y0, x1 - RIPA + 0.2, y0 + RIPA, 0.3), 0, 3)
  ripa(caixa(x0 + RIPA - 0.2, y1 - RIPA, x1 - RIPA + 0.2, y1, 0.3), 0, 4)
  for (const x of [x0 + RIPA / 2, x1 - RIPA / 2]) {
    for (const y of [y0 + RIPA / 2, y1 - RIPA / 2]) L.push(P(elipse(x, y, 0.42, 0.42), PREGO, { bisel: 0.4, contorno: 0, metal: 0.2 }))
  }
  return [x0 + RIPA, y0 + RIPA, x1 - RIPA, y1 - RIPA]
}

/** A etiqueta de preço espetada no canto do fundo do caixote: o cartão claro com dois riscos de tinta. */
function etiqueta(P: CriarPeca, L: Peca[], x: number, y: number, sem: number): void {
  L.push(P(caixa(x - 2.3, y - 1.6, x + 2.3, y + 1.6, 0.3), LENCOL, { bisel: 0.4, tom: 1.04, contorno: 0.3, semente: sem, projeta: { dist: 1, forca: 0.3, suave: 0.6 } }))
  L.push(P(capsula(x - 1.3, y - 0.5, x + 1.2, y - 0.5, 0.26), TINTA, { bisel: 0, contorno: 0, alfa: 0.7 }))
  L.push(P(capsula(x - 1.3, y + 0.6, x + 0.3, y + 0.6, 0.26), TINTA, { bisel: 0, contorno: 0, alfa: 0.7 }))
}

// ---------- as frutas em monte ----------

/** Uma fruta redonda do monte. */
interface Fruta {
  /** As cores, sorteadas por fruta (a repetida sai mais). */
  readonly cores: readonly MaterialDaPeca[]
  /** O raio (px do protótipo). */
  readonly raio: number
  /** A casca lustrosa (a maçã): um ponto de brilho do lado da luz. */
  readonly lustro: boolean
  /** A casca porosa (a laranja): um grão fino no lugar do brilho. */
  readonly porosa: boolean
  /** Uma folha junto do cabinho de algumas (a laranja colhida com a folha). */
  readonly comFolha: boolean
}

const MACAS: Fruta = { cores: [MACA, MACA, MACA, MACA_ESCURA, MACA_ESCURA, MACA_VERDE], raio: 2.7, lustro: true, porosa: false, comFolha: false }
const LARANJAS: Fruta = { cores: [LARANJA, LARANJA, LARANJA_MADURA], raio: 2.9, lustro: false, porosa: true, comFolha: true }

/** A distância entre duas frutas vizinhas do monte, em raios, e o quanto cada uma sai do lugar (fração do passo). */
const PASSO_DAS_FRUTAS = 1.72
const DESARRUMADO = 0.34
/** O quanto a fruta da beira passa por cima da ripa do caixote, em raios: o caixote está cheio. */
const TRANSBORDA = 0.3
/** O alto do monte: a segunda camada fica a esta fração para dentro, de cada lado, e é mais clara (pega mais luz). */
const RECUO_DO_ALTO = 0.24
const TOM_DE_BAIXO = 0.9
const TOM_DO_ALTO = 1.05
/** A parte das frutas com folha que a tem de fato. */
const PARTE_COM_FOLHA = 0.24
/** A sombra que a fruta de cima faz nas de baixo. */
const SOMBRA_DA_FRUTA: Projecao = { dist: 1, forca: 0.3, suave: 0.7 }

/** A casca porosa: um grão fino, que some no tamanho de mesa. */
const texPorosa: Textura = (_u, _v, x, y, p, s, escala) => {
  if (escala >= ESCALA_DO_DETALHE) s[3] += ruido(x * 1.7 + p.su, y * 1.7) * 0.07
}

/** Uma fruta: a bola com a luz de um lado, o cabinho (ou o umbigo) e, na casca lustrosa, o brilho. */
function umaFruta(P: CriarPeca, L: Peca[], x: number, y: number, fruta: Fruta, tom: number, emCima: boolean, sem: number): void {
  const r = fruta.raio * (0.9 + 0.2 * hash(sem, 1, 433))
  const cor = fruta.cores[Math.floor(hash(sem, 2, 433) * fruta.cores.length)]
  L.push(P(elipse(x, y, r, r * (0.94 + 0.06 * hash(sem, 3, 433))), cor, {
    bisel: r * 0.94,
    contorno: 0.3,
    tom: tom * (0.94 + 0.12 * hash(sem, 4, 433)),
    textura: fruta.porosa ? texPorosa : undefined,
    semente: sem,
    projeta: emCima ? SOMBRA_DA_FRUTA : undefined,
  }))
  const cx = x + (hash(sem, 5, 433) - 0.5) * r * 0.7
  const cy = y + (hash(sem, 6, 433) - 0.5) * r * 0.7
  L.push(P(elipse(cx, cy, r * 0.17, r * 0.14), CABO, { bisel: 0, contorno: 0, alfa: 0.8 }))
  if (fruta.lustro) L.push(P(elipse(x - r * 0.36, y - r * 0.38, r * 0.3, r * 0.2), LUSTRO, { bisel: 0, contorno: 0, alfa: 0.36, suave: 0.5 }))
  if (fruta.comFolha && hash(sem, 9, 433) < PARTE_COM_FOLHA) {
    const ang = hash(sem, 10, 433) * Math.PI * 2
    const folha = elipseGirada(cx + Math.cos(ang) * r * 0.55, cy + Math.sin(ang) * r * 0.55, r * 0.6, r * 0.28, ang)
    L.push(P(folha, RAMA, { bisel: 0.4, tom: 1.04, contorno: 0.3, semente: sem + 1, projeta: { dist: 0.5, forca: 0.24, suave: 0.5 } }))
  }
}

/** O monte de frutas no vão: a camada de baixo, que transborda da ripa, e o alto do monte no meio. */
function monte(P: CriarPeca, L: Peca[], [x0, y0, x1, y1]: Caixa, fruta: Fruta, sem: number): void {
  const camada = (ax0: number, ay0: number, ax1: number, ay1: number, tom: number, emCima: boolean, semDaCamada: number): void => {
    const passo = fruta.raio * PASSO_DAS_FRUTAS
    const colunas = Math.max(1, Math.round((ax1 - ax0) / passo))
    const linhas = Math.max(1, Math.round((ay1 - ay0) / (passo * 0.9)))
    const dx = (ax1 - ax0) / colunas
    const dy = (ay1 - ay0) / linhas
    for (let j = 0; j < linhas; j += 1) {
      // As fileiras alternadas ficam meia fruta para o lado, como num monte de verdade.
      const impar = colunas > 1 ? j % 2 : 0
      for (let i = 0; i < colunas - impar; i += 1) {
        const k = semDaCamada + j * 40 + i
        const x = ax0 + (i + 0.5 + impar * 0.5) * dx + (hash(k, 7, 433) - 0.5) * dx * DESARRUMADO
        const y = ay0 + (j + 0.5) * dy + (hash(k, 8, 433) - 0.5) * dy * DESARRUMADO
        umaFruta(P, L, x, y, fruta, tom, emCima, k)
      }
    }
  }
  const fora = fruta.raio * (PASSO_DAS_FRUTAS / 2 - 1 + TRANSBORDA)
  camada(x0 - fora, y0 - fora, x1 + fora, y1 + fora, TOM_DE_BAIXO, false, sem)
  const mx = (x1 - x0) * RECUO_DO_ALTO
  const my = (y1 - y0) * RECUO_DO_ALTO
  camada(x0 + mx, y0 + my, x1 - mx, y1 - my, TOM_DO_ALTO, true, sem + 2000)
}

// ---------- as verduras ----------

/** O raio do pé de alface, em fração da altura do vão, e as folhas de cada volta. */
const RAIO_DO_PE = 0.38
const FOLHAS_DE_FORA = 7
const FOLHAS_DO_MEIO = 5

/** Um pé de alface (ou de repolho) visto de cima: a volta de folhas de fora, a do meio, mais clara, e o miolo. */
function peDeVerdura(P: CriarPeca, L: Peca[], x: number, y: number, r: number, folha: MaterialDaPeca, sem: number): void {
  const giro = hash(sem, 1, 439) * Math.PI
  const volta = (folhas: number, longe: number, rx: number, ry: number, tom: number, k: number): void => {
    for (let i = 0; i < folhas; i += 1) {
      const a = giro * k + (i / folhas) * Math.PI * 2
      const forma = elipseGirada(x + Math.cos(a) * r * longe, y + Math.sin(a) * r * longe, r * rx, r * ry, a + QUARTO)
      L.push(P(forma, folha, { bisel: r * 0.16, tom: tom * (0.94 + 0.12 * hash(sem + i, k, 439)), contorno: 0.3, semente: sem + k * 10 + i, projeta: { dist: 0.7, forca: 0.26, suave: 0.6 } }))
    }
  }
  volta(FOLHAS_DE_FORA, 0.56, 0.5, 0.42, 0.84, 1)
  volta(FOLHAS_DO_MEIO, 0.3, 0.42, 0.33, 1, 2)
  L.push(P(elipse(x, y, r * 0.3, r * 0.3), MIOLO, { bisel: r * 0.2, tom: 1.02, contorno: 0.26, semente: sem + 40, projeta: { dist: 0.6, forca: 0.24, suave: 0.5 } }))
}

/** A cenoura: a largura na cabeça e o passo dos anéis da casca (px do protótipo). */
const LARGURA_DA_CENOURA = 2.9
const ANEL_DA_CENOURA = 2.3
/** O contorno de meia cenoura, da cabeça à ponta: [ao longo, meia largura], em frações do comprimento e da largura. */
const PERFIL_DA_CENOURA: readonly Ponto[] = [
  [0, 0.34],
  [0.07, 0.5],
  [0.3, 0.45],
  [0.72, 0.24],
  [0.95, 0.08],
]

/** Os anéis da casca da cenoura, de través (o `u` corre ao longo dela). */
const texDaCenoura: Textura = (u, _v, _x, _y, _p, s, escala) => {
  if (escala < ESCALA_DO_DETALHE) return
  const f = u / ANEL_DA_CENOURA
  if (f - Math.floor(f) < 0.16) s[3] -= 0.1
}

/** Uma cenoura, da cabeça (x, y) para a ponta na direção `ang`, com a rama saindo para o outro lado. */
function cenoura(P: CriarPeca, L: Peca[], x: number, y: number, comprimento: number, rama: number, ang: number, emCima: boolean, sem: number): void {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const em = (ao: number, tr: number): Ponto => [x + ao * co - tr * si, y + ao * si + tr * co]
  for (let i = -1; i <= 1; i += 1) {
    const [fx, fy] = em(-rama * (0.7 + 0.3 * hash(sem, i + 5, 441)), i * rama * 0.34)
    L.push(P(capsula(x, y, fx, fy, 0.62), RAMA, { bisel: 0.5, tom: 0.9 + 0.2 * hash(sem, i + 9, 441), contorno: 0.28, semente: sem + 3 + i }))
  }
  const corpo = [
    ...PERFIL_DA_CENOURA.map(([t, q]): Ponto => em(t * comprimento, -q * LARGURA_DA_CENOURA)),
    em(comprimento, 0),
    ...[...PERFIL_DA_CENOURA].reverse().map(([t, q]): Ponto => em(t * comprimento, q * LARGURA_DA_CENOURA)),
  ]
  L.push(P(poligono(corpo), CENOURA, {
    eixo: ang,
    bisel: LARGURA_DA_CENOURA * 0.44,
    tom: 0.94 + 0.14 * hash(sem, 2, 441),
    contorno: 0.3,
    textura: texDaCenoura,
    semente: sem,
    projeta: emCima ? SOMBRA_DA_FRUTA : undefined,
  }))
}

/** As folhas do forro do caixote de verduras: [x, y] em frações do lado dos pés e o ângulo. */
const FORRO_DE_FOLHAS: readonly (readonly [number, number, number])[] = [
  [0.14, 0.2, 0.7],
  [0.52, 0.12, 0.1],
  [0.9, 0.22, -0.6],
  [0.12, 0.8, -0.7],
  [0.5, 0.9, 0.05],
  [0.9, 0.8, 0.8],
]
/** Quanto a folha do forro passa da ripa do caixote (px do protótipo): o resto dela é cortado. */
const SOBRA_DO_FORRO = 0.7

/** O caixote de verduras: os pés de alface e de repolho à esquerda e o maço de cenouras à direita, a rama para o fundo. */
function exporVerduras(P: CriarPeca, L: Peca[], [x0, y0, x1, y1]: Caixa, sem: number): void {
  const alto = y1 - y0
  const larguraDoMaco = Math.min((x1 - x0) * 0.36, alto * 0.62)
  const xMaco = x1 - larguraDoMaco
  const r = alto * RAIO_DO_PE
  // As folhas largas que forram o caixote, por baixo dos pés: sem elas o fundo escuro aparecia entre um pé e o outro.
  const fundo = caixa(x0 - SOBRA_DO_FORRO, y0 - SOBRA_DO_FORRO, xMaco + SOBRA_DO_FORRO, y1 + SOBRA_DO_FORRO)
  FORRO_DE_FOLHAS.forEach(([fx, fy, ang], i) => {
    const folha = elipseGirada(x0 + (xMaco - x0) * fx, y0 + alto * fy, alto * 0.3, alto * 0.2, ang)
    L.push(P(dentroDe(folha, fundo), ALFACE, { bisel: 0.7, tom: 0.7 + 0.08 * hash(sem, i + 40, 443), contorno: 0.28, semente: sem + 700 + i }))
  })
  const pes = Math.max(1, Math.round((xMaco - x0) / (r * 1.5)))
  for (let i = 0; i < pes; i += 1) {
    const x = x0 + ((i + 0.5) * (xMaco - x0)) / pes
    const y = (y0 + y1) / 2 + (i % 2 === 0 ? -1 : 1) * alto * 0.08
    peDeVerdura(P, L, x, y, r, i % 2 === 0 ? ALFACE : REPOLHO, sem + i * 60)
  }
  const cenouras = Math.max(2, Math.floor(larguraDoMaco / (LARGURA_DA_CENOURA * 0.9)))
  const rama = alto * 0.3
  for (let i = 0; i < cenouras; i += 1) {
    const x = xMaco + ((i + 0.5) * larguraDoMaco) / cenouras
    const ang = QUARTO + (hash(sem, i, 443) - 0.5) * 0.24
    cenoura(P, L, x, y0 + rama + hash(sem, i + 20, 443) * 1.6, alto * 0.66, rama, ang, false, sem + 400 + i * 10)
  }
  // Uma cenoura atravessada por cima do maço.
  cenoura(P, L, xMaco + larguraDoMaco * 0.16, y0 + alto * 0.52, Math.min(alto * 0.6, larguraDoMaco * 1.05), rama * 0.7, 0.42, true, sem + 500)
}

// ---------- as abóboras ----------

/** Os gomos da abóbora e o quanto o sulco entre dois escurece. */
const GOMOS_DA_ABOBORA = 9
const SULCO_DA_ABOBORA = 0.2

/** A casca da abóbora: os gomos em volta do cabo (o sulco escuro some perto dele) e as manchas largas. */
function texDaAbobora(cx: number, cy: number, r: number, giro: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const dx = x - cx
    const dy = y - cy
    const gomo = Math.abs(Math.sin((Math.atan2(dy, dx) + giro) * (GOMOS_DA_ABOBORA / 2)))
    const longe = Math.min(1, Math.hypot(dx, dy) / (r * 0.3))
    s[3] += (Math.sqrt(gomo) - 0.72) * SULCO_DA_ABOBORA * longe + ruido(x * 0.3 + p.su, y * 0.3) * 0.06
  }
}

/** Uma abóbora: a bola achatada com os gomos, a sombra dela na tábua e o cabo torto no meio. */
function abobora(P: CriarPeca, L: Peca[], x: number, y: number, r: number, cor: MaterialDaPeca, sem: number): void {
  const giro = hash(sem, 1, 447) * Math.PI
  L.push(P(elipse(x, y, r * 1.05, r * 0.96), cor, { bisel: r * 0.8, tom: 0.96 + 0.1 * hash(sem, 2, 447), contorno: 0.3, textura: texDaAbobora(x, y, r, giro), semente: sem, projeta: { dist: 2, forca: 0.34, suave: 1.2 } }))
  const cabo = r * 0.16
  L.push(P(capsula(x, y, x + Math.cos(giro) * cabo * 1.5, y + Math.sin(giro) * cabo * 1.5, cabo), CABO, { bisel: cabo * 0.8, contorno: 0.3, semente: sem + 1, projeta: { dist: 0.6, forca: 0.26, suave: 0.5 } }))
}

/** As abóboras soltas na tábua: uma laranja e uma verde, alternadas, e uma moranga clara, menor, na frente das duas primeiras. */
function exporAboboras(P: CriarPeca, L: Peca[], [x0, y0, x1, y1]: Caixa, sem: number): void {
  const larg = x1 - x0
  const alto = y1 - y0
  const r = Math.min(alto * 0.41, larg * 0.23)
  const quantas = Math.max(2, Math.round(larg / (r * 2.3)))
  for (let i = 0; i < quantas; i += 1) {
    const x = x0 + ((i + 0.5) * larg) / quantas
    const y = (y0 + y1) / 2 + (i % 2 === 0 ? -1 : 1) * alto * 0.06 - alto * 0.04
    abobora(P, L, x, y, r * (i % 2 === 0 ? 1 : 0.9), i % 2 === 0 ? ABOBORA : ABOBORA_VERDE, sem + i * 10)
  }
  abobora(P, L, x0 + larg / quantas, y1 - r * 0.56, r * 0.56, MORANGA, sem + 200)
}

// ---------- as uvas ----------

/** O cacho: as bagas de cada fileira, do ombro à ponta, o raio da baga e a distância entre fileiras (px do protótipo). */
const FILEIRAS_DO_CACHO: readonly number[] = [3, 4, 3, 2, 1]
const BAGA = 1.32
const PASSO_DO_CACHO = 1.9
/** O comprimento de um cacho, do engaço à ponta. */
const COMPRIMENTO_DO_CACHO = (FILEIRAS_DO_CACHO.length + 0.4) * PASSO_DO_CACHO

/** Um cacho de uvas com o ombro em (x, y), pendendo na direção `ang`: o engaço e as bagas, cada uma uma bolinha. */
function cacho(P: CriarPeca, L: Peca[], x: number, y: number, ang: number, uva: MaterialDaPeca, sem: number): void {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  L.push(P(capsula(x - co * 2.2, y - si * 2.2, x + co * 0.6, y + si * 0.6, 0.5), CABO, { bisel: 0.4, contorno: 0.26, semente: sem }))
  FILEIRAS_DO_CACHO.forEach((bagas, k) => {
    for (let i = 0; i < bagas; i += 1) {
      const ao = (k + 0.5) * PASSO_DO_CACHO + (hash(sem + k, i, 449) - 0.5) * 0.7
      const tr = (i - (bagas - 1) / 2) * BAGA * 1.7 + (hash(sem + k, i + 9, 449) - 0.5) * 0.6
      const forma = elipse(x + ao * co - tr * si, y + ao * si + tr * co, BAGA, BAGA)
      L.push(P(forma, uva, { bisel: BAGA, tom: 0.86 + 0.3 * hash(sem + k, i + 20, 449), contorno: 0.3, semente: sem + k * 8 + i }))
    }
  })
}

/** O caixote de uvas: as folhas de parreira no fundo e os cachos em duas fileiras, roxos e verdes. */
function exporUvas(P: CriarPeca, L: Peca[], [x0, y0, x1, y1]: Caixa, sem: number): void {
  const larg = x1 - x0
  const alto = y1 - y0
  const folhas: readonly (readonly [number, number, number])[] = [[0.1, 0.16, -0.6], [0.9, 0.2, 0.7], [0.5, 0.9, 0.1], [0.06, 0.84, 0.9]]
  folhas.forEach(([fx, fy, ang], i) => {
    L.push(P(elipseGirada(x0 + larg * fx, y0 + alto * fy, 5, 3.4, ang), PARREIRA, { bisel: 0.6, tom: 0.84 + 0.1 * hash(sem, i, 451), contorno: 0.28, semente: sem + i }))
  })
  const colunas = Math.max(2, Math.round(larg / (COMPRIMENTO_DO_CACHO * 1.05)))
  const fileiras = Math.max(1, Math.round(alto / COMPRIMENTO_DO_CACHO))
  for (let j = 0; j < fileiras; j += 1) {
    for (let i = 0; i < colunas; i += 1) {
      const k = j * colunas + i
      const x = x0 + ((i + 0.5 + (j % 2 === 0 ? -0.08 : 0.12)) * larg) / colunas
      const y = y0 + (j * alto) / fileiras + 1.2
      const ang = QUARTO + (hash(sem, k + 30, 451) - 0.5) * 1.1
      cacho(P, L, x, y, ang, k % 3 === 1 ? UVA_VERDE : UVA_ROXA, sem + 100 + k * 50)
    }
  }
}

// ---------- a balança ----------

/** A balança cabe num vão deste tamanho (px do protótipo); no vão menor ela encolhe. */
const VAO_DA_BALANCA = { larg: 30.6, alto: 23 } as const
/** O meio braço do travessão, o raio de cada prato e o raio do maior peso (px do protótipo, no vão cheio). */
const MEIO_TRAVESSAO = 9.3
const RAIO_DO_PRATO = 5.3
const RAIO_DO_PESO = 1.7
/** Os pesos da fileira, do maior para o menor, em fração do maior. */
const PESOS_NA_TABUA: readonly number[] = [1, 0.82, 0.66, 0.52]

/** Um peso de ferro visto de cima: o cilindro e o botão de pegar. */
function peso(P: CriarPeca, L: Peca[], x: number, y: number, r: number, sem: number): void {
  L.push(P(elipse(x, y, r, r), PREGO, { bisel: r * 0.45, contorno: 0.3, metal: 0.3, semente: sem, projeta: { dist: 0.8, forca: 0.3, suave: 0.6 } }))
  L.push(P(elipse(x, y, r * 0.42, r * 0.42), PREGO, { bisel: r * 0.3, tom: 1.2, contorno: 0.2, metal: 0.3, semente: sem + 1 }))
}

/**
 * A balança de dois pratos, de cima: a base de ferro, os dois pratos de latão pendurados por três correntes
 * (uma com duas maçãs, a outra com os pesos), a coluna e o travessão por cima; na frente, a fileira de pesos.
 */
function exporBalanca(P: CriarPeca, L: Peca[], [x0, y0, x1, y1]: Caixa, sem: number): void {
  const k = Math.min(1, (x1 - x0) / VAO_DA_BALANCA.larg, (y1 - y0) / VAO_DA_BALANCA.alto)
  const cx = (x0 + x1) / 2
  const cy = y0 + (y1 - y0) * 0.4
  const braco = MEIO_TRAVESSAO * k
  const prato = RAIO_DO_PRATO * k
  L.push(P(caixa(cx - 5.4 * k, cy - 2.6 * k, cx + 5.4 * k, cy + 3.4 * k, 1.2 * k), PREGO, { bisel: 1, contorno: 0.3, metal: 0.24, semente: sem, projeta: { dist: 1.2, forca: 0.3, suave: 0.8 } }))
  for (const lado of [-1, 1]) {
    const px = cx + lado * braco
    const py = cy + 0.5 * k
    L.push(P(elipse(px, py, prato, prato), LATAO, { bisel: prato * 0.3, contorno: 0.3, semente: sem + 10 + lado, projeta: { dist: 2.2, forca: 0.34, suave: 1 } }))
    L.push(P(elipse(px, py, prato * 0.78, prato * 0.78), LATAO, { bisel: 0, tom: 0.8, contorno: 0.1, recesso: { k: 1.4, forca: 0.34 }, semente: sem + 12 + lado }))
    if (lado < 0) {
      umaFruta(P, L, px - prato * 0.26, py + prato * 0.1, { ...MACAS, raio: prato * 0.42 }, 1, false, sem + 20)
      umaFruta(P, L, px + prato * 0.3, py - prato * 0.16, { ...MACAS, raio: prato * 0.4 }, 1.04, true, sem + 21)
    } else {
      peso(P, L, px - prato * 0.24, py - prato * 0.14, RAIO_DO_PESO * 0.9 * k, sem + 24)
      peso(P, L, px + prato * 0.3, py + prato * 0.2, RAIO_DO_PESO * 0.66 * k, sem + 26)
    }
    // As três correntes, da beira do prato até a ponta do travessão, em cima do meio dele.
    for (let i = 0; i < 3; i += 1) {
      const a = QUARTO + (i * Math.PI * 2) / 3
      L.push(P(capsula(px, cy, px + Math.cos(a) * prato * 0.92, py + Math.sin(a) * prato * 0.92, 0.3), LATAO, { bisel: 0.2, tom: 0.7, contorno: 0.16, semente: sem + 30 + i }))
    }
  }
  L.push(P(capsula(cx - braco - 0.8 * k, cy, cx + braco + 0.8 * k, cy, 0.8 * k), LATAO, { bisel: 0.6, contorno: 0.3, semente: sem + 40, projeta: { dist: 1.6, forca: 0.3, suave: 0.8 } }))
  L.push(P(elipse(cx, cy, 1.7 * k, 1.7 * k), LATAO, { bisel: 1.1 * k, tom: 1.08, contorno: 0.3, semente: sem + 41 }))
  PESOS_NA_TABUA.forEach((parte, i) => {
    peso(P, L, cx - 5.6 * k + i * 3.7 * k, cy + (y1 - cy) * 0.74, RAIO_DO_PESO * parte * k, sem + 50 + i * 2)
  })
}

// ---------- a banca ----------

/** Põe a mercadoria no vão: no caixote, ou solta na tábua (as abóboras e a balança). */
function expor(P: CriarPeca, L: Peca[], mercadoria: Mercadoria, vao: Caixa, sem: number): void {
  switch (mercadoria) {
    case 'aboboras':
      exporAboboras(P, L, vao, sem)
      return
    case 'balanca':
      exporBalanca(P, L, vao, sem)
      return
    case 'verduras':
      exporVerduras(P, L, caixote(P, L, vao, sem), sem + 20)
      return
    case 'uvas':
      exporUvas(P, L, caixote(P, L, vao, sem), sem + 20)
      return
    case 'macas':
    case 'laranjas': {
      const dentro = caixote(P, L, vao, sem)
      monte(P, L, dentro, mercadoria === 'macas' ? MACAS : LARANJAS, sem + 20)
      etiqueta(P, L, dentro[2] - 2.4, dentro[1] + 1.8, sem + 9000)
    }
  }
}

export const montarBancaDeFrutas: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const yDivisa = -hh + h * DIVISA_DOS_DEGRAUS
  const x0 = -hw + FOLGA_DA_MESA
  const x1 = hw - FOLGA_DA_MESA

  // As quatro pernas, cada par até a beirada do degrau dele: de cima a mesa as esconde; na 3/4 aparecem as
  // do degrau que estiver na frente (as do de trás, mais altas, quando a banca está de costas).
  const pernas: readonly (readonly [number, number])[] = [
    [-hh + FOLGA_DA_MESA + RECUO_DA_PERNA, g * ALTURA_DE_TRAS - ESPESSURA_DA_BANCA],
    [hh - FOLGA_DA_MESA - RECUO_DA_PERNA - LADO_DA_PERNA, g * ALTURA_DA_FRENTE - ESPESSURA_DA_BANCA],
  ]
  for (const lado of [-1, 1]) {
    for (const [y, z] of pernas) {
      const x = lado < 0 ? x0 + RECUO_DA_PERNA : x1 - RECUO_DA_PERNA - LADO_DA_PERNA
      const perna = caixa(x, y, x + LADO_DA_PERNA, y + LADO_DA_PERNA, 0.5)
      cena.sombras.push({ forma: perna, z }, contato(perna, 0.3))
    }
  }

  /** Um degrau: o tabuleiro de tábuas com a ripa da beira e a mercadoria de cada vão. */
  const degrau = (y0: number, y1: number, z: number, vaos: Vaos, deTras: boolean, sem: number): void => {
    const tabuleiro = caixa(x0, y0, x1, y1, 0.8)
    cena.sombras.push({ forma: tabuleiro, z, solta: true, forca: 0.3 })
    L.push(P(tabuleiro, mad, { tabua: (y1 - y0) / TABUAS_DO_DEGRAU, bisel: 1.2, semente: sem, projeta: deTras ? SOMBRA_DO_DEGRAU : undefined }))
    L.push(P(caixa(x0, y1 - RIPA_DA_BEIRA, x1, y1, 0.5), mad, { tabua: 0, bisel: 0.8, tom: 1.08, semente: sem + 1 }))
    for (const xDoPrego of [x0 + 2.4, 0, x1 - 2.4]) L.push(P(elipse(xDoPrego, y1 - RIPA_DA_BEIRA / 2, 0.5, 0.5), PREGO, { bisel: 0.4, contorno: 0, metal: 0.2 }))
    const largura = x1 - x0 - 2 * ENTRE_VAOS
    let x = x0 + ENTRE_VAOS
    vaos.forEach(([mercadoria, parte], i) => {
      const vao: Caixa = [x + ENTRE_VAOS, y0 + 2 * ENTRE_VAOS, x + largura * parte - ENTRE_VAOS, y1 - RIPA_DA_BEIRA - ENTRE_VAOS]
      expor(P, L, mercadoria, vao, sem + 100 + i * 1000)
      x += largura * parte
    })
  }
  // O da frente primeiro: o de trás fica por cima e faz sombra nele.
  degrau(yDivisa, hh - FOLGA_DA_MESA, g * ALTURA_DA_FRENTE, NO_DEGRAU_DA_FRENTE, false, 4100)
  degrau(-hh + FOLGA_DA_MESA, yDivisa, g * ALTURA_DE_TRAS, NO_DEGRAU_DE_TRAS, true, 12100)
}
