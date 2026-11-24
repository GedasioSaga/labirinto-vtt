import { empacotar, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * TÁBUAS COM FRESTAS (lista de 24/11/2026, item 115; forma no cartão Pisos de madeira; mapa 3): o assoalho velho de
 * barraco e de casa de tábua, TRÊS tábuas largas por casa (a Madeira velha tem quatro), de um pardo mais escuro e mais
 * quente que o cinza da Madeira velha, e FRESTAS: em uma de cada três juntas compridas a tábua encolheu e abriu um
 * vão largo e escuro, que alarga e estreita ao longo dela (a tábua empenada). No vão, a sombra da tábua de cima
 * escurece a metade de cima e a de baixo fica um nada mais clara; a beirada de cima da tábua de baixo pega a luz.
 * As outras juntas ficam fechadas e finas. Nós escuros, rachas que nascem nas pontas e uma ou outra tábua úmida, como
 * na Madeira velha; as emendas das pontas desencontradas fila a fila.
 *
 * O vão é largo mas raso de contraste (a fresta é o pardo mais fundo, nunca preto): a regra das texturas de chão
 * (`embutidas.test.ts`) quer a junta macia, e três tábuas por casa já são 24 juntas no ladrilho.
 */

const CASAS = 8
const TABUAS_POR_CASA = 3
const FILAS = CASAS * TABUAS_POR_CASA
/** A largura da tábua, em casas. */
const LARGURA = 1 / TABUAS_POR_CASA
/** Comprimento das tábuas, em casas (3,3 a 6 m). */
const COMPRIMENTO_MINIMO = 2.2
const COMPRIMENTO_MAXIMO = 4
/** Duas emendas de filas vizinhas nunca ficam mais perto que isto, em casas. */
const EMENDA_MINIMA = 0.7
const TENTATIVAS = 16
const SEMENTE = 11500
/** Ruído de valor sem período: o veio, o nó e a racha são medidos ao longo da tábua, contínua na emenda do ladrilho. */
const SEM_PERIODO = 1 << 20
const PASSO_DO_INICIO = 4096
const PRIMO_DA_FILA = 7919

/** O pardo do tempo, mais escuro e quente que o da Madeira velha (croma ~0,1). Cinco tons vizinhos, um por tábua. */
const TONS: readonly Rgb[] = [rgb('#6e6152'), rgb('#736556'), rgb('#695c4e'), rgb('#76695a'), rgb('#65584a')]
const UMIDO: Rgb = rgb('#554a3e')
const NO: Rgb = rgb('#3f362d')
/** O fundo da fresta: o pardo mais fundo, nunca preto; a metade de cima na sombra da tábua, a de baixo um nada mais clara. */
const FRESTA: Rgb = rgb('#2a221c')
const SOMBRA_DA_FRESTA = luz(FRESTA, -0.12)
const FUNDO_DA_FRESTA = luz(FRESTA, 0.14)

const CHANCE_DE_UMIDADE = 0.1
const UMIDADE_MINIMA = 0.1
const UMIDADE_MAXIMA = 0.6
const CHANCE_DO_NO = 0.18
const FORCA_DO_NO = 0.55
const ANEL_DO_NO = 1.6
const ESCURO_DO_ANEL = 0.08
const CHANCE_DA_RACHA = 0.4
const LARGURA_DA_RACHA = 0.06
const ESCURO_DA_RACHA = 0.3
const VARIACAO_DA_TABUA = 0.09
const VEIO = 0.05
const MANCHA = 0.06
const PERIODO_DA_ASPEREZA = 256
const ASPEREZA = 0.02
/**
 * A fresta aberta: uma junta comprida em quantas, a meia largura dela (casas: o vão inteiro tem de 4 a 10 cm na
 * tábua de 50) e o quanto ela alarga e estreita ao longo (voltas inteiras no ladrilho, para a emenda fechar).
 */
const FRESTA_ABERTA = { chance: 0.34, meia: 0.03, varia: 0.014, ondas: 6 } as const
/** A meia largura da junta fechada e da junta da ponta, em casas, e o macio da beira do vão. */
const JUNTA_FECHADA = 0.009
/** O quanto a junta fechada puxa para o fundo da fresta (a aberta puxa inteiro). */
const FORCA_DA_FECHADA = 0.38
const JUNTA_DA_PONTA = 0.012
const MACIO = 0.005
/** A beirada da tábua: a de cima pega a luz, a de baixo cai na sombra (faixa em casas, força). */
const CHANFRO = { largura: 0.045, luz: 0.05, sombra: 0.07 } as const

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function distanciaNaVolta(a: number, b: number): number {
  const d = naVolta(a - b)
  return Math.min(d, 1 - d) * CASAS
}

function perto(a: Float64Array, b: Float64Array, minima: number): boolean {
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) if (distanciaNaVolta(a[i], b[j]) < minima) return true
  }
  return false
}

/** As emendas de uma fila (o início de cada tábua em [0, 1)), em ordem, pelo sorteio `tentativa`. */
function sortearFila(fila: number, tentativa: number): Float64Array {
  const chave = tentativa * 64
  const medio = COMPRIMENTO_MINIMO + (COMPRIMENTO_MAXIMO - COMPRIMENTO_MINIMO) * hash(fila, chave, SEMENTE + 1)
  const quantas = Math.max(1, Math.round(CASAS / medio))
  const pesos = new Float64Array(quantas)
  let soma = 0
  for (let i = 0; i < quantas; i += 1) {
    pesos[i] = 0.75 + 0.5 * hash(fila, chave + 1 + i, SEMENTE + 1)
    soma += pesos[i]
  }
  const inicios = new Float64Array(quantas)
  let pos = hash(fila, chave + 63, SEMENTE + 1)
  for (let i = 0; i < quantas; i += 1) {
    inicios[i] = naVolta(pos)
    pos += pesos[i] / soma
  }
  return inicios.sort()
}

function encosta(fila: Float64Array, prontas: readonly Float64Array[], f: number): boolean {
  if (f >= 1 && perto(fila, prontas[f - 1], EMENDA_MINIMA)) return true
  if (f >= 2 && perto(fila, prontas[f - 2], EMENDA_MINIMA / 2)) return true
  return f === FILAS - 1 && perto(fila, prontas[0], EMENDA_MINIMA)
}

let emendasProntas: readonly Float64Array[] | null = null

function emendas(): readonly Float64Array[] {
  if (emendasProntas !== null) return emendasProntas
  const filas: Float64Array[] = []
  for (let f = 0; f < FILAS; f += 1) {
    let escolhida = sortearFila(f, 0)
    for (let tentativa = 1; tentativa < TENTATIVAS && encosta(escolhida, filas, f); tentativa += 1) escolhida = sortearFila(f, tentativa)
    filas.push(escolhida)
  }
  emendasProntas = filas
  return filas
}

/** A meia largura da junta comprida de baixo da fila `fila` no ponto `uu` do ladrilho, em casas. */
function meiaJuntaAbaixo(fila: number, uu: number): number {
  if (hash(fila, 0, SEMENTE + 20) >= FRESTA_ABERTA.chance) return JUNTA_FECHADA
  const aoLongo = valor(uu * FRESTA_ABERTA.ondas, 0.5, FRESTA_ABERTA.ondas, SEMENTE + 30 + fila)
  return FRESTA_ABERTA.meia + (aoLongo - 0.5) * 2 * FRESTA_ABERTA.varia
}

function distanciaAoNo(tabua: number, n: number, lx: number, fy: number, comprimento: number): number {
  if (hash(tabua, n, SEMENTE + 6) >= CHANCE_DO_NO) return Infinity
  const cx = 0.4 + hash(tabua, n, SEMENTE + 7) * (comprimento - 0.8)
  const cy = 0.3 + hash(tabua, n, SEMENTE + 8) * 0.4
  const rx = 0.15 + hash(tabua, n, SEMENTE + 9) * 0.08
  const ry = 0.12 + hash(tabua, n, SEMENTE + 10) * 0.05
  const dx = (lx - cx) / rx
  const dy = (fy - cy) / ry
  return Math.sqrt(dx * dx + dy * dy)
}

function rachaDaTabua(tabua: number, id: number, lx: number, fy: number, comprimento: number): number {
  if (hash(tabua, 0, SEMENTE + 11) >= CHANCE_DA_RACHA) return 0
  const tamanho = 0.4 + hash(tabua, 1, SEMENTE + 11) * 0.9
  const daPonta = hash(tabua, 2, SEMENTE + 11) < 0.5 ? lx : comprimento - lx
  if (daPonta >= tamanho) return 0
  const afina = 1 - daPonta / tamanho
  const meio = 0.3 + hash(tabua, 3, SEMENTE + 11) * 0.4 + (valor(lx * 1.4, 0.5, SEM_PERIODO, id + 3) - 0.5) * 0.12
  const largura = LARGURA_DA_RACHA * Math.sqrt(afina)
  return passoSuave(largura, largura * 0.2, Math.abs(fy - meio)) * afina
}

/** A cor das tábuas com frestas no ponto (u, v) do ladrilho de 8 casas. */
export function texturaTabuasComFrestas(u: number, v: number): number {
  const uu = naVolta(u)
  // Meia tábua de deslocamento: a emenda do ladrilho cai no meio da tábua, nunca numa junta.
  const y = naVolta(v) * FILAS + 0.5
  const fila = Math.floor(y) % FILAS
  const fy = y - Math.floor(y)
  const doFila = emendas()[fila]
  let k = doFila.length - 1
  for (let i = 0; i < doFila.length; i += 1) if (doFila[i] <= uu) k = i
  const inicio = doFila[k]
  const fim = doFila[(k + 1) % doFila.length]
  const lx = naVolta(uu - inicio) * CASAS
  const comprimento = (naVolta(fim - inicio) || 1) * CASAS
  const tabua = Math.round(inicio * PASSO_DO_INICIO) + fila * PRIMO_DA_FILA
  const tom = TONS[Math.floor(hash(tabua, fila, SEMENTE + 2) * TONS.length) % TONS.length]
  const id = tabua * 4 + SEMENTE
  let claro = 1 + (hash(tabua, fila, SEMENTE + 3) - 0.5) * VARIACAO_DA_TABUA

  // A umidade: a tábua inteira mais escura, mais forte numa parte que na outra.
  let umidade = 0
  if (hash(tabua, fila, SEMENTE + 5) < CHANCE_DE_UMIDADE) {
    const aoLongo = passoSuave(0.3, 0.7, valor(lx * 0.6, 0.5, SEM_PERIODO, id + 3))
    umidade = UMIDADE_MINIMA + (UMIDADE_MAXIMA - UMIDADE_MINIMA) * aoLongo
  }
  // O veio levantado pelo tempo e as manchas largas.
  const onda = (valor(lx * 0.4, fy * 1.2, SEM_PERIODO, id) - 0.5) * 0.8
  const veio = valor(lx * 1.2, (fy + onda) * 2.2, SEM_PERIODO, id + 1) - 0.5
  const mancha = valor(lx * 0.3, fy * 0.7, SEM_PERIODO, id + 2) - 0.5
  claro += veio * VEIO + mancha * MANCHA
  const dNo = Math.min(distanciaAoNo(tabua, 0, lx, fy, comprimento), distanciaAoNo(tabua, 1, lx, fy, comprimento))
  const no = passoSuave(1, 0.3, dNo) * FORCA_DO_NO
  claro -= passoSuave(ANEL_DO_NO, 1, dNo) * ESCURO_DO_ANEL
  claro -= rachaDaTabua(tabua, id, lx, fy, comprimento) * ESCURO_DA_RACHA

  // As juntas compridas de cima e de baixo desta fila (a de cima é a de baixo da fila anterior), em casas.
  const meiaDeCima = meiaJuntaAbaixo((fila + FILAS - 1) % FILAS, uu)
  const meiaDeBaixo = meiaJuntaAbaixo(fila, uu)
  const dCima = fy * LARGURA - meiaDeCima
  const dBaixo = (1 - fy) * LARGURA - meiaDeBaixo
  // A beirada da tábua: a de cima (junto do vão de cima) pega a luz, a de baixo cai na sombra.
  claro += passoSuave(CHANFRO.largura, 0, dCima) * CHANFRO.luz - passoSuave(CHANFRO.largura, 0, dBaixo) * CHANFRO.sombra
  claro += (valor(uu * PERIODO_DA_ASPEREZA, v * PERIODO_DA_ASPEREZA, PERIODO_DA_ASPEREZA, SEMENTE + 4) - 0.5) * ASPEREZA

  const r = (tom[0] + (UMIDO[0] - tom[0]) * umidade) * (1 - no) + NO[0] * no
  const g = (tom[1] + (UMIDO[1] - tom[1]) * umidade) * (1 - no) + NO[1] * no
  const b = (tom[2] + (UMIDO[2] - tom[2]) * umidade) * (1 - no) + NO[2] * no
  let c: Rgb = [r * claro, g * claro, b * claro]

  // O vão: a metade de cima do vão de baixo na sombra; a metade de baixo do vão de cima, o fundo um nada mais claro.
  // A junta fechada é só um fio pardo: o vão escuro inteiro fica para a fresta aberta.
  const naFrestaDeCima = passoSuave(MACIO, -MACIO, dCima) * (meiaDeCima > JUNTA_FECHADA ? 1 : FORCA_DA_FECHADA)
  const naFrestaDeBaixo = passoSuave(MACIO, -MACIO, dBaixo) * (meiaDeBaixo > JUNTA_FECHADA ? 1 : FORCA_DA_FECHADA)
  const sujeira = (valor(uu * 128, naVolta(v) * 128, 128, SEMENTE + 12) - 0.5) * 0.2
  if (naFrestaDeBaixo > 0) c = misturar(c, luz(SOMBRA_DA_FRESTA, sujeira), naFrestaDeBaixo)
  if (naFrestaDeCima > 0) c = misturar(c, luz(FUNDO_DA_FRESTA, sujeira), naFrestaDeCima)
  // A junta da ponta, fechada, com a beirada escurecida.
  const ponta = Math.min(lx, comprimento - lx)
  c = misturar(c, luz(FRESTA, 0.1 + sujeira), passoSuave(JUNTA_DA_PONTA + MACIO, JUNTA_DA_PONTA - MACIO, ponta) * 0.85)
  return empacotar(c)
}
