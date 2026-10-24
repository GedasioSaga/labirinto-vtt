/**
 * MOTOR DE PINTURA dos móveis do Meio-Termo, portado do protótipo aprovado
 * (`docs/design/objetos/prototipo/objetos.js`, blocos "ruído", "texturas",
 * "luz" e `pintarCena`). Puro: sem canvas, sem DOM, sem Pixi. Entra uma CENA
 * (as peças e as sombras de um móvel, montadas por `moveis/<tipo>.ts`) e sai
 * RGBA num `Uint8ClampedArray`; o teste mede os pixels de verdade e a tela
 * (`pixi/rasterDosMoveis.ts`) só põe os bytes numa textura.
 *
 * Cada peça tem forma por distância (`formas.ts`), chanfro (`bisel`: a borda
 * arredonda até `bisel` px para dentro) e material. A textura do material dá a
 * variação de tom, a normal do chanfro dá a luz (de cima à esquerda, a mesma
 * do telhado e do relevo) e a sombra no chão sai da mesma forma, afastada para
 * baixo à direita pela altura.
 *
 * A pintura é um GERADOR que cede a vez a cada linha de pixels: a fila de
 * `rasterDosMoveis.ts` roda fatias de 8 ms e nenhuma tarefa trava a tela. A
 * composição final (do acumulador para os bytes, com o preto levantado até o
 * piso de luz) também anda uma linha por passo; a textura só sobe para a placa
 * depois do último, então nunca é enviada pela metade.
 *
 * Mesma entrada, mesma imagem: nenhum `Math.random`, todo sorteio é `hash`.
 * Só a vista "de cima"; a frente e o cilindro da 3/4 chegam com a fatia MT11.
 */
import { hash, type Rgb } from '../../ruido'
import type { Caixa, Forma } from './formas'

// ---------- ruído suave em tabela (o mesmo do protótipo) ----------

/** Tabela de 256 x 256 valores sorteados uma vez: o ruído suave lê dela em vez de sortear por pixel. */
const LADO_DA_TABELA = 256
const MASCARA = LADO_DA_TABELA - 1
const SEMENTE_DA_TABELA = 4219
const TABELA = new Float32Array(LADO_DA_TABELA * LADO_DA_TABELA)
for (let y = 0; y < LADO_DA_TABELA; y += 1) {
  for (let x = 0; x < LADO_DA_TABELA; x += 1) TABELA[y * LADO_DA_TABELA + x] = hash(x, y, SEMENTE_DA_TABELA) - 0.5
}

/** Ruído de valor suave, entre -0,5 e 0,5, com período de 256 unidades (maior que qualquer móvel). */
export function ruido(x: number, y: number): number {
  const xf = Math.floor(x)
  const yf = Math.floor(y)
  let fx = x - xf
  let fy = y - yf
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  const x0 = xf & MASCARA
  const x1 = (xf + 1) & MASCARA
  const y0 = (yf & MASCARA) * LADO_DA_TABELA
  const y1 = ((yf + 1) & MASCARA) * LADO_DA_TABELA
  const a = TABELA[y0 + x0]
  const b = TABELA[y0 + x1]
  const c = TABELA[y1 + x0]
  const d = TABELA[y1 + x1]
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/**
 * A inclinação do ruído no ponto (a derivada exata da mesma interpolação), em
 * `INCLINACAO`. Uma leitura só no lugar das quatro de uma diferença: o
 * amassado do lençol e do cobertor é a maior parte do custo da cama.
 */
const INCLINACAO = new Float64Array(2)
function inclinacaoDoRuido(x: number, y: number): void {
  const xf = Math.floor(x)
  const yf = Math.floor(y)
  const fx = x - xf
  const fy = y - yf
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const x0 = xf & MASCARA
  const x1 = (xf + 1) & MASCARA
  const y0 = (yf & MASCARA) * LADO_DA_TABELA
  const y1 = ((yf + 1) & MASCARA) * LADO_DA_TABELA
  const a = TABELA[y0 + x0]
  const b = TABELA[y0 + x1]
  const c = TABELA[y1 + x0]
  const d = TABELA[y1 + x1]
  const k = a - b - c + d
  INCLINACAO[0] = 6 * fx * (1 - fx) * (b - a + k * sy)
  INCLINACAO[1] = 6 * fy * (1 - fy) * (c - a + k * sx)
}

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function suave01(t: number): number {
  const x = limitar(t, 0, 1)
  return x * x * (3 - 2 * x)
}

// ---------- materiais e peças ----------

export type ClasseDaPeca = 'madeira' | 'metal' | 'tecido' | 'palha' | 'pedra' | 'corda' | 'casca' | 'folha' | 'liso'

/** O material como o pintor o lê: a classe escolhe a textura, `rgb` é o tom em luz neutra. */
export interface MaterialDaPeca {
  readonly classe: ClasseDaPeca
  readonly rgb: Rgb
  /** Só no tecido: trama de linho ou lã fofa. */
  readonly fio?: 'linho' | 'la'
  /** Só na pedra: granito pintado, arenito em camadas ou ardósia em lâminas. */
  readonly pedra?: 'granito' | 'arenito' | 'ardosia'
  /** Só na casca da lenha: a bétula é branca com riscos; as outras têm fendas ao longo da tora. */
  readonly casca?: 'betula' | 'fendida'
}

/** Sombra que a peça faz nas peças de baixo (o travesseiro no lençol, a cinta na tampa). */
export interface Projecao {
  readonly dist: number
  readonly forca: number
  readonly suave?: number
}

/** Tampa afundada: a borda de cima à esquerda faz sombra dentro da peça. */
export interface Recesso {
  readonly k: number
  readonly forca: number
}

/** Tampa em arco (o baú): a normal inclina pela distância ao centro `c`, em `r` px. */
export interface CurvaY {
  readonly c: number
  readonly r: number
  readonly forca: number
}

/** Coordenadas do veio em volta de um centro (as aduelas do barril vistas de cima). */
export interface Polar {
  readonly cx: number
  readonly cy: number
  readonly r: number
}

/**
 * Coordenadas do veio ao longo de um ARCO de centro (cx, cy) e raio `r` (a
 * vara, a corda e o arame da cerca curva): u anda pelo arco a partir do ângulo
 * `a0`, v atravessa (a distância ao raio). Assim o veio e a torção acompanham a
 * curva em vez de cortá-la reto.
 */
export interface Arco {
  readonly cx: number
  readonly cy: number
  readonly r: number
  readonly a0: number
}

export interface OpcoesDaPeca {
  readonly dx?: number
  readonly dy?: number
  readonly bisel?: number
  /** Direção do veio, em radianos. */
  readonly eixo?: number
  /** Largura da tábua em px; 0 = peça inteiriça, sem fresta. */
  readonly tabua?: number
  readonly semente?: number
  readonly contorno?: number
  readonly luz?: number
  readonly tom?: number
  readonly alfa?: number
  readonly suave?: number
  readonly ruga?: number
  readonly polar?: Polar
  /** Veio pelo arco (vence `eixo`). */
  readonly arco?: Arco
  readonly recesso?: Recesso
  readonly curvaY?: CurvaY
  readonly projeta?: Projecao
  readonly metal?: number
  /**
   * Textura própria da peça no lugar da do material (o topo cortado do mourão,
   * a lenha queimada, o leito de brasa, o desenho do tapete). Os dados dela
   * (centro, calor, medidas) vão fechados na função.
   */
  readonly textura?: Textura
}

/**
 * Soma a variação do material no ponto. `escala` = pixels da imagem por px do
 * protótipo (a trama miúda some abaixo de um certo tamanho). `s` = [r, g, b,
 * luz, emissão, alfa]: a emissão (0..1) é a parte da cor que não pega luz nem
 * sombra (a brasa acesa).
 */
export type Textura = (u: number, v: number, x: number, y: number, p: Peca, s: Float32Array, escala: number) => void

export interface Peca {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly dx: number
  readonly dy: number
  readonly bisel: number
  readonly eixo: number
  readonly tabua: number
  readonly semente: number
  readonly contorno: number
  readonly luz: number
  readonly alfa: number
  readonly suave: number
  readonly ruga: number
  readonly polar: Polar | undefined
  readonly arco: Arco | undefined
  readonly recesso: Recesso | undefined
  readonly curvaY: CurvaY | undefined
  /**
   * A mesma curva de `curvaY`, ao longo de x: só a peça girada um quarto de
   * volta na vista 3/4 (`tresQuartos.ts`, a tampa em arco do baú deitada de
   * lado) a tem. Ausente = o caminho de sempre, byte a byte.
   */
  readonly curvaX?: CurvaY
  readonly projeta: Projecao | undefined
  readonly metal: number
  readonly tex: Textura | null
  readonly base: Rgb
  readonly su: number
  readonly sv: number
}

/** Sombra no chão: a forma arrastada do pé até a altura `z` (px). */
export interface Sombra {
  readonly forma: Forma
  readonly z: number
  readonly suave?: number
  readonly forca?: number
  /** Tampo solto no ar (mesa, assento): a sombra não é arrastada desde o pé. */
  readonly solta?: boolean
}

export interface Cena {
  readonly partes: Peca[]
  readonly sombras: Sombra[]
  /**
   * O escuro em que o pixel escuro demais é levantado (o piso de luz).
   * Ausente = o escuro quente da nogueira (`COR_DO_PISO`). A sebe (classe
   * folha) usa `PISO_DA_FOLHA`: com a nogueira, o contorno dela saía marrom.
   */
  corDoPiso?: Rgb
}

/**
 * O escuro da FOLHA (revisão de design da MT5): verde-escuro `#2f4a35`, com
 * luminância linear 0,058, acima do piso de 0,045. É o tom em que a borda
 * escura da sebe é levantada, no lugar do marrom da nogueira.
 */
export const PISO_DA_FOLHA: Rgb = [0x2f, 0x4a, 0x35]

/** Borrão do contato (px do protótipo). */
export const SUAVE_DO_CONTATO = 1.3

/** Contato da peça com o chão: a sombra curta e firme bem no pé. */
export function contato(forma: Forma, forca = 0.3): Sombra {
  return { forma, z: 0, suave: SUAVE_DO_CONTATO, forca }
}

export type CriarPeca = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaPeca) => Peca

/** Brilho do metal quando a peça não diz outro. */
const METAL_PADRAO = 0.42

/**
 * Fábrica de peças com a semente do móvel (`base`, o hash da chave): somada à
 * semente de cada peça, móveis diferentes ganham veios diferentes e o mesmo
 * móvel sai sempre igual.
 */
export function criarPecas(base: number): CriarPeca {
  return (forma, mat, o = {}) => {
    const semente = (o.semente ?? 1) + base
    const tom = o.tom ?? 1
    return {
      forma,
      mat,
      dx: o.dx ?? 0,
      dy: o.dy ?? 0,
      bisel: o.bisel ?? 1,
      eixo: o.eixo ?? 0,
      tabua: o.tabua ?? 8,
      semente,
      contorno: o.contorno ?? 0.22,
      luz: o.luz ?? 0,
      alfa: o.alfa ?? 1,
      suave: o.suave ?? 0,
      ruga: o.ruga ?? 0,
      polar: o.polar,
      arco: o.arco,
      recesso: o.recesso,
      curvaY: o.curvaY,
      projeta: o.projeta,
      metal: o.metal ?? (mat.classe === 'metal' ? METAL_PADRAO : 0),
      tex: o.textura ?? TEXTURA[mat.classe],
      base: [mat.rgb[0] * tom, mat.rgb[1] * tom, mat.rgb[2] * tom],
      su: semente * 37.17,
      sv: semente * 11.31,
    }
  }
}

// ---------- texturas: cada uma soma variação de luz no ponto ----------
// `s` = [r, g, b, luz, emissão, alfa]. (u, v) = coordenadas do material: u ao longo do veio.

function texMadeira(u: number, v: number, _x: number, _y: number, p: Peca, s: Float32Array): void {
  const W = p.tabua
  let j = 0
  let dentro = 99
  let fora = 99
  if (W > 0) {
    const fv = v / W
    j = Math.floor(fv)
    dentro = (fv - j) * W
    fora = W - dentro
  }
  const hj = hash(j, p.semente, 811)
  let luz = (hj - 0.5) * 0.12
  // Veio: linhas ao longo da tábua, onduladas pelo ruído (veio reto e fino vira hachura no zoom 50%).
  const onda = ruido(u * 0.03 + hj * 97, j * 3.7 + p.semente) * 9 + ruido(u * 0.09 + 40, v * 0.05 + j * 5.1) * 2.2
  luz += Math.sin((v + onda) * 3.3) * 0.026
  luz += ruido(u * 0.018 + hj * 31, v * 0.22 + j * 9) * 0.1
  luz += ruido(u * 0.35 + p.semente * 3, v * 2.4) * 0.05
  if (W > 0) {
    // Emenda de topo de vez em quando, em lugar sorteado por tábua.
    const L = 60 + hash(j, p.semente, 812) * 90
    const uu = u / L + hash(j, p.semente, 813)
    const fu = (uu - Math.floor(uu)) * L
    const ateTopo = fu < L - fu ? fu : L - fu
    if (ateTopo < 0.7) luz -= 0.22 * (1 - ateTopo / 0.7)
    // Fresta escura entre tábuas; a beira de cima pega um pouco de luz.
    const ate = dentro < fora ? dentro : fora
    if (ate < 0.75) luz -= 0.3 * (1 - ate / 0.75) * (1 - ate / 0.75)
    else if (dentro < 1.6) luz += 0.03
  }
  s[3] += luz
}

function texMetal(u: number, v: number, _x: number, _y: number, p: Peca, s: Float32Array): void {
  s[3] += ruido(u * 0.16 + p.semente * 7, v * 0.16) * 0.12 + ruido(u * 0.05, v * 1.3 + p.semente) * 0.05 + ruido(u * 0.7, v * 0.7) * 0.03
}

function texTecido(u: number, v: number, _x: number, _y: number, p: Peca, s: Float32Array): void {
  if (p.mat.fio === 'linho') {
    const tela = ((Math.floor(u * 1.4) + Math.floor(v * 1.4)) & 1) === 1 ? 0.012 : -0.012
    s[3] += ruido(u * 0.05 + p.semente * 5, v * 1.15) * 0.08 + ruido(u * 0.6, v * 0.6) * 0.04 + tela
  } else {
    s[3] += ruido(u * 0.5 + p.semente * 5, v * 0.5) * 0.08 + ruido(u * 0.12, v * 0.12 + p.semente) * 0.07 + Math.sin((u + v) * 2.6) * 0.012
  }
}

/**
 * Abaixo deste tamanho (pixels da imagem por px do protótipo; o nível 1 tem
 * 0,89) o quadrado de 2,8 px da trama cai em 2 ou 3 pixels e a palha vira uma
 * grade de 3 x 2 casas: a trama fica com só `CONTRASTE_DA_TRAMA_MIUDA` do contraste.
 */
const ESCALA_MINIMA_DA_TRAMA = 1.5
const CONTRASTE_DA_TRAMA_MIUDA = 0.35

/** Palha trançada em cesto: fios de 1,4 px, cada quadrado de 2,8 px vira de lado. */
function texPalha(u: number, v: number, _x: number, _y: number, _p: Peca, s: Float32Array, escala: number): void {
  const c = 2.8
  const i = Math.floor(u / c)
  const j = Math.floor(v / c)
  const deitada = ((i + j) & 1) === 0
  const atravessa = deitada ? v : u
  const aoLongo = deitada ? u : v
  const k = atravessa / (c / 2)
  const fk = k - Math.floor(k)
  let luz = (Math.sin(fk * Math.PI) - 0.64) * 0.2 + (hash(i, j, 77) - 0.5) * 0.07
  const fe = aoLongo / c - Math.floor(aoLongo / c)
  const borda = fe < 1 - fe ? fe : 1 - fe
  if (borda < 0.16) luz -= 0.13 * (1 - borda / 0.16)
  s[3] += escala < ESCALA_MINIMA_DA_TRAMA ? luz * CONTRASTE_DA_TRAMA_MIUDA : luz
}

/** O grão do granito (fração da cor, no pontilhado: some pela metade na sombra). */
const GRAO_ESCURO = -0.2
const GRAO_CLARO = 0.13
/**
 * As camadas do arenito: faixas de ±4% de luz a cada `PERIODO_DAS_CAMADAS` px
 * ao longo da pedra (2 ou 3 numa pedra da roda), um pouco onduladas.
 */
const PERIODO_DAS_CAMADAS = 5
const LUZ_DAS_CAMADAS = 0.04

/** Granito com grão claro e escuro, arenito em camadas, ardósia em lâminas (`objetos.js:430-444`). */
function texPedra(u: number, v: number, _x: number, _y: number, p: Peca, s: Float32Array): void {
  let luz = ruido(u * 0.09 + p.semente * 13, v * 0.09) * 0.16 + (hash(p.semente, 1, 707) - 0.5) * 0.12
  const tipo = p.mat.pedra ?? 'granito'
  if (tipo === 'granito') {
    luz += ruido(u * 0.4, v * 0.4) * 0.06
    const h = hash(Math.floor(u * 1.5), Math.floor(v * 1.5), p.semente)
    if (h > 0.93) s[6] = GRAO_ESCURO
    else if (h < 0.05) s[6] = GRAO_CLARO
  } else if (tipo === 'arenito') {
    const fase = (v + ruido(u * 0.06 + p.semente, v * 0.05) * 2.5) / PERIODO_DAS_CAMADAS
    luz += limitar(Math.sin(fase * Math.PI * 2) * 1.8, -1, 1) * LUZ_DAS_CAMADAS + ruido(u * 1.1, v * 1.1) * 0.035
  } else {
    luz += ruido(u * 0.04, v * 0.55 + p.semente) * 0.09 + ruido(u * 0.35, v * 0.35) * 0.03
  }
  s[3] += luz
}

/**
 * A corda é palha clara (revisão da MT3): a de antes, #b89860 a #c8a868, quase
 * igualava o pinho dos mourões (#c0a060) e, a 1x, a torção sumia. A torção é
 * uma cor própria, mais escura e mais quente, não só menos luz.
 */
export const TOM_DA_CORDA: Rgb = [0xc9, 0xbc, 0x98]
const TORCAO_DA_CORDA: Rgb = [0xa8, 0x99, 0x6f]
/**
 * Frequência da torção: a faixa se repete a cada ~4,5 px do protótipo na
 * perpendicular (4 pixels no nível 1). Com 1,6, como no protótipo, eram 2,7 px,
 * menos de 2,5 pixels a 1x: a torção virava ruído.
 */
const TORCAO = 0.95

/** Corda torcida: faixas em diagonal da cor da torção ao longo do comprimento (`objetos.js:463`). */
function texCorda(u: number, v: number, _x: number, _y: number, _p: Peca, s: Float32Array): void {
  // Faixa estreita da torção (pouco mais de um terço da volta): a corda continua lendo clara.
  const t = limitar((Math.sin((u * 0.75 + v * 1.25) * TORCAO) - 0.3) / 0.7, 0, 1)
  s[0] += (TORCAO_DA_CORDA[0] - s[0]) * t
  s[1] += (TORCAO_DA_CORDA[1] - s[1]) * t
  s[2] += (TORCAO_DA_CORDA[2] - s[2]) * t
  s[3] += ruido(u * 0.6, v * 0.6) * 0.04 + LUZ_DA_CORDA
}

/** A corda é redonda e o chanfro a escurece nas bordas: um pouco de luz a mais deixa o meio no tom da palha. */
const LUZ_DA_CORDA = 0.08

/** Casca da lenha: bétula branca com riscos de través; as outras, fendas ao longo da tora (`objetos.js:468-480`). */
function texCasca(u: number, v: number, _x: number, _y: number, p: Peca, s: Float32Array): void {
  if (p.mat.casca === 'betula') {
    let luz = ruido(u * 0.08 + p.semente * 3, v * 0.3) * 0.08
    const marca = ruido(u * 0.55 + p.semente * 9, v * 0.07 + p.semente)
    if (marca > 0.2) luz -= 0.4 * Math.min(1, (marca - 0.2) / 0.08)
    s[3] += luz
    return
  }
  const fenda = ruido(u * 0.07 + p.semente * 5, v * 0.9 + p.semente)
  let luz = fenda * 0.22 + ruido(u * 0.5, v * 0.5) * 0.06
  if (fenda < -0.12) luz -= 0.16
  s[3] += luz
}

/**
 * Folha (a sebe da MT5, como `texFolha` do vaso): luz manchada em duas
 * escalas, sem listra; cada lóbulo desloca o ruído pela própria semente. Fraca
 * (até ±0,1, revisão de design da MT5): quem dá o volume são os 3 tons da
 * folhagem (massa, copa e realce); com ±0,44 a sebe virava granulado.
 */
export function texFolhagem(_u: number, _v: number, x: number, y: number, p: Peca, s: Float32Array): void {
  s[3] += ruido(x * 0.42 + p.su, y * 0.42 + p.sv) * 0.07 + ruido(x * 1.05 + 7, y * 1.05) * 0.03
}

const TEXTURA: Readonly<Record<ClasseDaPeca, Textura | null>> = {
  madeira: texMadeira,
  metal: texMetal,
  tecido: texTecido,
  palha: texPalha,
  pedra: texPedra,
  corda: texCorda,
  casca: texCasca,
  folha: texFolhagem,
  liso: null,
}

/** A textura do material (a que a peça usa sem `textura` própria): a lenha queimada pinta a casca por baixo da brasa. */
export function texturaDaClasse(classe: ClasseDaPeca): Textura | null {
  return TEXTURA[classe]
}

// ---------- luz ----------

/** De onde vem a luz: cima à esquerda, um pouco mais da esquerda (a do telhado), 52° acima do chão. */
const LX = -0.62
const LY = -0.48
const LZ = 0.62
/** A mesma direção só no chão, para saber de que lado a borda faz sombra. */
const RX = -0.79
const RY = -0.61
/** Meio-caminho entre a luz e o olho: onde o metal brilha. */
const HX = -0.344
const HY = -0.267
const HZ = 0.9
const FORCA_DA_LUZ = 0.9
/** Parte somada (não multiplicada) da variação de textura: madeira escura ainda mostra o veio (como no telhado). */
const LUZ_SOMADA = 22
/** Sombra no chão: quanto ela anda (para baixo à direita) por px de altura do móvel. */
export const SOMBRA_X = 0.27
export const SOMBRA_Y = 0.21
const SOMBRA_COR: Rgb = [14, 11, 8]
/** Passo da diferença que tira a normal do chanfro. */
const E = 0.3
/** Escala do amassado do tecido. */
const KR = 0.11
/** Luz mínima e máxima de um pixel: nenhum canto vira preto, nenhum brilho estoura. */
const LUZ_MINIMA = 0.28
const LUZ_MAXIMA = 1.5

/** Onde a peça pinta: o acumulador (cor já multiplicada pela cobertura) e a sombra das peças de cima. */
interface Alvo {
  readonly buf: Float32Array
  readonly sombra: Float32Array
  readonly W: number
  readonly H: number
  readonly x0: number
  readonly y0: number
  readonly S: number
}

/** Os limites em pixel da caixa `b` deslocada por (dx, dy) com `folga`, presos à imagem. */
function janela(alvo: Alvo, b: Caixa, dx: number, dy: number, folga: number): [number, number, number, number] {
  const { W, H, x0, y0, S } = alvo
  return [
    Math.max(0, Math.floor((b[0] + dx - folga - x0) * S)),
    Math.max(0, Math.floor((b[1] + dy - folga - y0) * S)),
    Math.min(W, Math.ceil((b[2] + dx + folga - x0) * S)),
    Math.min(H, Math.ceil((b[3] + dy + folga - y0) * S)),
  ]
}

/** [r, g, b, luz, emissão, alfa, pontilhado]: o pontilhado é detalhe que some pela metade na sombra (o grão do granito). */
const SAIDA = new Float32Array(7)
/**
 * Quanto o pontilhado aparece pela luz que chega no ponto (luz do chanfro x
 * sombra das peças de cima): inteiro a partir de `LUZ_DO_PONTILHADO_CHEIO`,
 * metade a partir de `LUZ_DO_PONTILHADO_MEIO` para baixo. Sem isso o grão tinha
 * o mesmo contraste na luz e na sombra e lia como textura colada por cima.
 */
const LUZ_DO_PONTILHADO_CHEIO = 0.95
const LUZ_DO_PONTILHADO_MEIO = 0.6
const PONTILHADO_NA_SOMBRA = 0.5
const VOLTA_INTEIRA = Math.PI * 2

/** A normal do chanfro no ponto (nx, ny), ou zero longe da borda. */
function normalDoChanfro(f: Forma, x: number, y: number, t: number, bisel: number, saida: Float64Array): void {
  saida[0] = 0
  saida[1] = 0
  if (bisel <= 0 || t >= bisel) return
  const gx = f.d(x + E, y) - f.d(x - E, y)
  const gy = f.d(x, y + E) - f.d(x, y - E)
  const gl = Math.sqrt(gx * gx + gy * gy)
  if (gl <= 1e-6) return
  let q = (bisel - (t > 0 ? t : 0)) / bisel
  if (q > 0.95) q = 0.95
  const inc = q / Math.sqrt(1 - q * q) / gl
  saida[0] = inc * gx
  saida[1] = inc * gy
}

const NORMAL = new Float64Array(2)

/**
 * Pinta uma peça POR BAIXO do que já está no acumulador (a lista vai da
 * frente para trás), cedendo a vez a cada linha.
 */
function* pintarParte(alvo: Alvo, p: Peca): Generator<void, void, void> {
  const { buf, W, x0, y0, S } = alvo
  const f = p.forma
  const inv = 1 / S
  const largAA = p.suave > 0 ? p.suave * S : 1
  const [px0, py0, px1, py1] = janela(alvo, f.b, p.dx, p.dy, p.suave + 2 * inv)
  if (px1 <= px0 || py1 <= py0) return
  const [br, bg, bb] = p.base
  const { bisel, tex, metal, contorno, ruga, alfa, polar, arco, recesso: rec, curvaY: curva, curvaX } = p
  const cosE = Math.cos(p.eixo)
  const sinE = Math.sin(p.eixo)
  const M = alvo.sombra
  for (let py = py0; py < py1; py += 1) {
    const y = y0 + (py + 0.5) * inv - p.dy
    let o = (py * W + px0) * 4
    for (let px = px0; px < px1; px += 1, o += 4) {
      // Pixel já coberto pelas peças de cima não precisa de textura nem de luz.
      const resta = 1 - buf[o + 3]
      if (resta <= 0.004) continue
      const x = x0 + (px + 0.5) * inv - p.dx
      const d = f.d(x, y)
      let cob = 0.5 - (d * S) / largAA
      if (cob <= 0) continue
      if (cob > 1) cob = 1
      const t = -d
      normalDoChanfro(f, x, y, t, bisel, NORMAL)
      let nx = NORMAL[0]
      let ny = NORMAL[1]
      if (ruga > 0) {
        inclinacaoDoRuido(x * KR + p.su, y * KR)
        nx -= INCLINACAO[0] * KR * ruga
        ny -= INCLINACAO[1] * KR * ruga
      }
      if (curva !== undefined) {
        let q = (y - curva.c) / curva.r
        q = q > 0.97 ? 0.97 : q < -0.97 ? -0.97 : q
        ny += (curva.forca * q) / Math.sqrt(1 - q * q)
      }
      if (curvaX !== undefined) {
        let q = (x - curvaX.c) / curvaX.r
        q = q > 0.97 ? 0.97 : q < -0.97 ? -0.97 : q
        nx += (curvaX.forca * q) / Math.sqrt(1 - q * q)
      }
      let u: number
      let v: number
      if (polar !== undefined) {
        const rx = x - polar.cx
        const ry = y - polar.cy
        u = Math.sqrt(rx * rx + ry * ry)
        v = Math.atan2(ry, rx) * polar.r
      } else if (arco !== undefined) {
        const rx = x - arco.cx
        const ry = y - arco.cy
        let da = Math.atan2(ry, rx) - arco.a0
        da -= Math.round(da / VOLTA_INTEIRA) * VOLTA_INTEIRA
        u = da * arco.r
        v = Math.sqrt(rx * rx + ry * ry) - arco.r
      } else {
        u = x * cosE + y * sinE
        v = -x * sinE + y * cosE
      }
      u += p.su
      v += p.sv
      SAIDA[0] = br
      SAIDA[1] = bg
      SAIDA[2] = bb
      SAIDA[3] = p.luz
      SAIDA[4] = 0
      SAIDA[5] = 1
      SAIDA[6] = 0
      if (tex !== null) tex(u, v, x, y, p, SAIDA, S)
      const nlen = Math.sqrt(nx * nx + ny * ny + 1)
      const nl = (nx * LX + ny * LY + LZ) / nlen
      let fl = 1 + FORCA_DA_LUZ * (nl - LZ)
      if (rec !== undefined) {
        const sh = limitar(0.5 + f.d(x + RX * rec.k, y + RY * rec.k) / 0.9, 0, 1)
        fl *= 1 - rec.forca * sh
      }
      if (contorno > 0 && t < 0.85) fl *= 1 - contorno * (1 - (t > 0 ? t : 0) / 0.85)
      fl = fl < LUZ_MINIMA ? LUZ_MINIMA : fl > LUZ_MAXIMA ? LUZ_MAXIMA : fl
      const luz = SAIDA[3]
      const somada = LUZ_SOMADA * luz
      let cr = (SAIDA[0] * (1 + luz) + somada) * fl
      let cg = (SAIDA[1] * (1 + luz) + somada) * fl
      let cb = (SAIDA[2] * (1 + luz) + somada) * fl
      if (metal > 0) {
        const nh = (nx * HX + ny * HY + HZ) / nlen
        if (nh > 0) {
          const brilho = Math.pow(nh, 18) * metal * 255
          cr += brilho
          cg += brilho * 0.96
          cb += brilho * 0.88
        }
      }
      const sombraDeCima = M[o >> 2]
      const pontilhado = SAIDA[6]
      if (pontilhado !== 0) {
        const q = limitar((fl * sombraDeCima - LUZ_DO_PONTILHADO_MEIO) / (LUZ_DO_PONTILHADO_CHEIO - LUZ_DO_PONTILHADO_MEIO), 0, 1)
        const f = 1 + pontilhado * (PONTILHADO_NA_SOMBRA + (1 - PONTILHADO_NA_SOMBRA) * q)
        cr *= f
        cg *= f
        cb *= f
      }
      // Emissão (a brasa acesa): essa parte da cor não pega a luz do chanfro nem a sombra das peças de cima
      // (abaixo, em `m`). O piso de luz continua valendo depois, em `compor`. Só as texturas próprias a usam.
      const em = SAIDA[4]
      if (em > 0) {
        cr += (SAIDA[0] - cr) * em
        cg += (SAIDA[1] - cg) * em
        cb += (SAIDA[2] - cb) * em
      }
      cr = cr < 0 ? 0 : cr > 255 ? 255 : cr
      cg = cg < 0 ? 0 : cg > 255 ? 255 : cg
      cb = cb < 0 ? 0 : cb > 255 ? 255 : cb
      const a = cob * alfa * SAIDA[5]
      if (a <= 0) continue
      // Por baixo do que já está pintado; a sombra das peças de cima (M) escurece só a cor, e não a parte que emite.
      const k = resta * a
      const m = k * (em > 0 ? sombraDeCima + (1 - sombraDeCima) * em : sombraDeCima)
      buf[o] += cr * m
      buf[o + 1] += cg * m
      buf[o + 2] += cb * m
      buf[o + 3] += k
    }
    yield
  }
}

/** Borda padrão da sombra que uma peça projeta nas de baixo. */
const SUAVE_DA_PROJECAO = 0.9

/**
 * Sombra que a peça faz nas peças de baixo. Como a pintura vai da frente para
 * trás, ela é guardada num multiplicador por pixel que as peças pintadas
 * depois (as de baixo) usam.
 */
function* projetar(alvo: Alvo, p: Peca, projecao: Projecao): Generator<void, void, void> {
  const { sombra: M, W, x0, y0, S } = alvo
  const su = projecao.suave ?? SUAVE_DA_PROJECAO
  const ox = -RX * projecao.dist
  const oy = -RY * projecao.dist
  const f = p.forma
  const inv = 1 / S
  const [px0, py0, px1, py1] = janela(alvo, f.b, p.dx + ox, p.dy + oy, su * 2)
  for (let py = py0; py < py1; py += 1) {
    const y = y0 + (py + 0.5) * inv - p.dy - oy
    for (let px = px0; px < px1; px += 1) {
      const x = x0 + (px + 0.5) * inv - p.dx - ox
      const k = suave01(0.5 - f.d(x, y) / (2 * su))
      if (k <= 0) continue
      M[py * W + px] *= 1 - projecao.forca * k
    }
    yield
  }
}

/**
 * Quantos px de altura cada amostra da sombra cobre: a sombra é a forma
 * arrastada do pé até o topo, não só o topo afastado. Com 7 px e no máximo 8
 * amostras, a peça alta e fina (o poste do encosto, a perna) saía em degraus.
 */
const PASSO_DA_SOMBRA = 2.5
const BORDA_DA_SOMBRA_NO_PE = 0.8
const AMOSTRAS_MAXIMAS_DA_SOMBRA = 20

/** Meia largura do borrão da sombra (px do protótipo): a forma não escurece o chão a mais que isto de fora dela. */
export function bordaDaSombra(s: Pick<Sombra, 'z' | 'suave'>): number {
  return s.suave ?? BORDA_DA_SOMBRA_NO_PE + 0.09 * s.z
}

/**
 * Sombra no chão: a forma da peça arrastada do pé (no chão) até a altura `z`,
 * para baixo à direita; fica mais suave quanto mais longe do pé. Sombras que se
 * cruzam não somam (fica a mais forte em `mapa`).
 */
function* pintarSombras(alvo: Alvo, sombras: readonly Sombra[], mapa: Float32Array): Generator<void, void, void> {
  const { W, x0, y0, S } = alvo
  const inv = 1 / S
  for (const s of sombras) {
    const ox = SOMBRA_X * s.z
    const oy = SOMBRA_Y * s.z
    const su = bordaDaSombra(s)
    const fo = s.forca ?? Math.max(0.16, 0.34 - 0.0022 * s.z)
    const n = s.solta !== true && s.z > PASSO_DA_SOMBRA ? Math.min(AMOSTRAS_MAXIMAS_DA_SOMBRA, Math.ceil(s.z / PASSO_DA_SOMBRA)) : 0
    const su0 = Math.min(su, BORDA_DA_SOMBRA_NO_PE)
    const b = s.forma.b
    const caixaArrastada: Caixa = [b[0] + Math.min(0, ox), b[1] + Math.min(0, oy), b[2] + Math.max(0, ox), b[3] + Math.max(0, oy)]
    const [px0, py0, px1, py1] = janela(alvo, caixaArrastada, 0, 0, su * 2)
    for (let py = py0; py < py1; py += 1) {
      const y = y0 + (py + 0.5) * inv
      for (let px = px0; px < px1; px += 1) {
        const x = x0 + (px + 0.5) * inv
        let k = 0.5 - s.forma.d(x - ox, y - oy) / (2 * su)
        // A sombra satura em k = 1 (`suave01`): achado o miolo, as outras amostras não mudam nada.
        for (let j = 0; j < n && k < 1; j += 1) {
          const t = j / n
          const suJ = su0 + (su - su0) * t
          const kj = 0.5 - s.forma.d(x - ox * t, y - oy * t) / (2 * suJ)
          if (kj > k) k = kj
        }
        if (k <= 0) continue
        const a = fo * suave01(k)
        const i = py * W + px
        if (a > mapa[i]) mapa[i] = a
      }
      yield
    }
  }
}

// ---------- a imagem ----------

/** Onde a imagem fica em relação ao centro do móvel (px do protótipo) e o tamanho dela em pixels. */
export interface LimitesDaImagem {
  readonly x0: number
  readonly y0: number
  readonly W: number
  readonly H: number
}

function unir(b: number[], x0: number, y0: number, x1: number, y1: number): void {
  if (x0 < b[0]) b[0] = x0
  if (y0 < b[1]) b[1] = y0
  if (x1 > b[2]) b[2] = x1
  if (y1 > b[3]) b[3] = y1
}

/** A caixa das peças e das sombras (com a borda borrada), em `S` pixels por px do protótipo. */
export function limitesDaCena(cena: Cena, S: number): LimitesDaImagem {
  const tudo = [Infinity, Infinity, -Infinity, -Infinity]
  for (const p of cena.partes) unir(tudo, p.forma.b[0] + p.dx, p.forma.b[1] + p.dy, p.forma.b[2] + p.dx, p.forma.b[3] + p.dy)
  for (const s of cena.sombras) {
    const su = bordaDaSombra(s) * 2
    const b = s.forma.b
    unir(tudo, b[0] - su, b[1] - su, b[2] + su, b[3] + su)
    unir(tudo, b[0] + SOMBRA_X * s.z - su, b[1] + SOMBRA_Y * s.z - su, b[2] + SOMBRA_X * s.z + su, b[3] + SOMBRA_Y * s.z + su)
  }
  const x0 = Math.floor(tudo[0] - 1)
  const y0 = Math.floor(tudo[1] - 1)
  return {
    x0,
    y0,
    W: Math.max(1, Math.ceil((tudo[2] + 1 - x0) * S)),
    H: Math.max(1, Math.ceil((tudo[3] + 1 - y0) * S)),
  }
}

/**
 * Ruído de arredondamento: meio tom para cima ou para baixo, sorteado por
 * pixel. Sem ele, a borda da sombra (degradê longo e fraco) vira anéis de 8 bits.
 */
const LADO_DO_PONTILHADO = 64
const PONTILHADO = new Float32Array(LADO_DO_PONTILHADO * LADO_DO_PONTILHADO * 2)
for (let i = 0; i < PONTILHADO.length; i += 1) PONTILHADO[i] = hash(i, 17, 9001) - 0.5

/** Pixel quase transparente fica de fora (vale 0). */
const ALFA_MINIMO = 0.002

// ---------- o preto levantado (`docs/design/vila-meio-termo/prototipo/meio.js:84-125`) ----------

/** Nenhum pixel opaco de peça fica abaixo desta luminância LINEAR (a prova do protótipo usa 0,03). */
export const PISO_DE_LUZ = 0.045
/** Só o pixel de peça (alfa em 0..255 a partir daqui) é levantado; a sombra no chão, transparente, fica como está. */
const ALFA_DO_LEVANTAMENTO = 160
/**
 * O escuro quente da nogueira: o contorno derivado de `nogueira` (#775739)
 * pelo Estilo Mother do Meio-Termo (`tons()` com escuro 0,6 e piso 0,06 de
 * `meio.js:86-89`) dá #643d24; aqui o azul sobe de 0x24 para 0x28 (saturação
 * HSV 0,60 em vez de 0,64, luminância linear 0,062 nos dois): com o tom cru,
 * os pixels levantados do barril de nogueira e latão no nível 3 punham a
 * saturação p95 em 0,621, acima do teto de 0,62. O pixel escuro demais é
 * misturado nele.
 */
const COR_DO_PISO: Rgb = [0x64, 0x3d, 0x28]
/** Mistura um pouco além do necessário: a conta é em sRGB e o piso é linear. */
const EXCESSO_DO_LEVANTAMENTO = 1.25

/** sRGB de 8 bits para linear, em tabela. */
const LINEAR = new Float32Array(256)
for (let i = 0; i < 256; i += 1) {
  const u = i / 255
  LINEAR[i] = u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
}

/** Luminância linear (Rec. 709) de uma cor de 8 bits já arredondada. */
export function luminanciaLinear(r: number, g: number, b: number): number {
  return 0.2126 * LINEAR[r] + 0.7152 * LINEAR[g] + 0.0722 * LINEAR[b]
}

const LUZ_DO_PISO = luminanciaLinear(COR_DO_PISO[0], COR_DO_PISO[1], COR_DO_PISO[2])

function canal8(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v)
}

/** O escuro do levantamento e a luminância linear dele. */
interface Piso {
  readonly cor: Rgb
  readonly luz: number
}

const PISO_DA_NOGUEIRA: Piso = { cor: COR_DO_PISO, luz: LUZ_DO_PISO }

function pisoDaCena(cena: Cena): Piso {
  const cor = cena.corDoPiso
  return cor === undefined ? PISO_DA_NOGUEIRA : { cor, luz: luminanciaLinear(cor[0], cor[1], cor[2]) }
}

/** A cor do pixel (8 bits, cor pura) em `COR`, levantada até o piso de luz se for escura demais. */
const COR = new Float64Array(3)
function levantar(r: number, g: number, b: number, alfa: number, piso: Piso): void {
  let r8 = canal8(r)
  let g8 = canal8(g)
  let b8 = canal8(b)
  if (alfa >= ALFA_DO_LEVANTAMENTO) {
    const L = luminanciaLinear(r8, g8, b8)
    if (L < PISO_DE_LUZ) {
      const alvo = piso.cor
      const t = Math.min(1, ((PISO_DE_LUZ - L) / Math.max(0.001, piso.luz - L)) * EXCESSO_DO_LEVANTAMENTO)
      r8 = canal8(r8 + (alvo[0] - r8) * t)
      g8 = canal8(g8 + (alvo[1] - g8) * t)
      b8 = canal8(b8 + (alvo[2] - b8) * t)
    }
  }
  COR[0] = r8
  COR[1] = g8
  COR[2] = b8
}

/**
 * Junta as peças (por cima) e o chão (sombras, por baixo) em `destino`, uma
 * linha por passo (a imagem grande não trava a fila), e levanta o preto: pixel
 * de peça abaixo do piso de luz vira o escuro quente da nogueira.
 * `premultiplicada`: cor já multiplicada pelo alfa, o que a textura da tela
 * espera; sem ela, a cor pura (a que o teste mede). A textura só sobe para a
 * placa depois do último passo, então nunca aparece pela metade.
 */
function* compor(alvo: Alvo, chao: Float32Array, destino: Uint8ClampedArray, premultiplicada: boolean, piso: Piso): Generator<void, void, void> {
  const { buf, W, H } = alvo
  for (let py = 0, o = 0; py < H; py += 1) {
    const linha = (py & (LADO_DO_PONTILHADO - 1)) * LADO_DO_PONTILHADO
    for (let px = 0; px < W; px += 1, o += 4) {
      const resta = 1 - buf[o + 3]
      const baixo = chao[o >> 2]
      const a = buf[o + 3] + resta * baixo
      if (a <= ALFA_MINIMO) {
        destino[o] = 0
        destino[o + 1] = 0
        destino[o + 2] = 0
        destino[o + 3] = 0
        continue
      }
      const q = (linha + (px & (LADO_DO_PONTILHADO - 1))) * 2
      const pr = PONTILHADO[q]
      const alfa = Math.min(255, Math.max(0, a * 255 + PONTILHADO[q + 1]))
      levantar(
        (buf[o] + resta * baixo * SOMBRA_COR[0]) / a + pr,
        (buf[o + 1] + resta * baixo * SOMBRA_COR[1]) / a + pr,
        (buf[o + 2] + resta * baixo * SOMBRA_COR[2]) / a + pr,
        alfa,
        piso,
      )
      const k = premultiplicada ? alfa / 255 : 1
      destino[o] = COR[0] * k
      destino[o + 1] = COR[1] * k
      destino[o + 2] = COR[2] * k
      destino[o + 3] = alfa
    }
    yield
  }
}

/**
 * Bytes do buffer de trabalho por pixel da imagem enquanto ela é pintada: o
 * acumulador RGBA, a sombra das peças de cima e o chão, em Float32 (4 + 1 + 1
 * canais de 4 bytes). São 6 vezes os bytes RGBA da imagem pronta.
 */
export const BYTES_DE_TRABALHO_POR_PIXEL = (4 + 1 + 1) * Float32Array.BYTES_PER_ELEMENT

/**
 * Pinta a cena em `destino` (RGBA, `limites.W` x `limites.H`), cedendo a vez
 * a cada linha: as peças da frente para trás (a última da lista fica por cima),
 * depois o chão (sombras) por baixo de tudo e, no último passo, a composição.
 */
export function* pintarCenaEmPassos(
  cena: Cena,
  S: number,
  limites: LimitesDaImagem,
  destino: Uint8ClampedArray,
  premultiplicada: boolean,
): Generator<void, void, void> {
  const { W, H, x0, y0 } = limites
  const alvo: Alvo = { buf: new Float32Array(W * H * 4), sombra: new Float32Array(W * H).fill(1), W, H, x0, y0, S }
  for (let i = cena.partes.length - 1; i >= 0; i -= 1) {
    const p = cena.partes[i]
    yield* pintarParte(alvo, p)
    if (p.projeta !== undefined) yield* projetar(alvo, p, p.projeta)
  }
  const chao = new Float32Array(W * H)
  yield* pintarSombras(alvo, cena.sombras, chao)
  yield* compor(alvo, chao, destino, premultiplicada, pisoDaCena(cena))
}

/** A cena inteira de uma vez (teste, folha de contato): RGBA de cor pura. */
export function pintarCena(cena: Cena, S: number): { limites: LimitesDaImagem; pixels: Uint8ClampedArray } {
  const limites = limitesDaCena(cena, S)
  const pixels = new Uint8ClampedArray(limites.W * limites.H * 4)
  const passos = pintarCenaEmPassos(cena, S, limites, pixels, false)
  while (!passos.next().done) {
    // cada passo é uma linha; aqui não há fila, então anda até o fim
  }
  return { limites, pixels }
}
