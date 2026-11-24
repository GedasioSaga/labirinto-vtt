import { empacotar, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * TÁBUAS COM FRESTAS (lista de 24/11/2026, item 115; forma no cartão Pisos de madeira; mapa 3): o assoalho velho de
 * barraco e de casa de tábua, TRÊS tábuas largas por casa (a Madeira velha tem quatro), de pardos bem separados, mais
 * escuros e mais quentes que o cinza da Madeira velha, de veio aberto, e FRESTAS. A fresta é POR TÁBUA: o encontro de
 * uma tábua com a da fila de baixo sorteia se abre (uns 40%) e a largura dele, e o vão fecha de novo na junta fina a
 * 0,3 casa da ponta de qualquer das duas (a tábua encolheu no meio). Assim as frestas são traços de umas 2 a 4 casas,
 * desencontrados, e nunca uma listra correndo a fila inteira. No vão, a beira da tábua de cima projeta a sombra em
 * uns 40% dele e o resto mostra o fundo, um nada mais claro: o vão tem fundura e não é um traço chapado. A beirada de
 * cima da tábua pega a luz. As outras juntas ficam fechadas e finas. Nós escuros, rachas que nascem nas pontas e uma
 * ou outra tábua úmida, como na Madeira velha; as emendas das pontas desencontradas fila a fila.
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

/**
 * O pardo do tempo, mais escuro e quente que o da Madeira velha (croma ~0,1). Três tons bem separados, um por tábua:
 * com tons vizinhos o piso saía liso e sumia perto da Madeira velha.
 */
const TONS: readonly Rgb[] = [rgb('#7a6a55'), rgb('#615446'), rgb('#6e5d4b')]
const UMIDO: Rgb = rgb('#554a3e')
const NO: Rgb = rgb('#3f362d')
/** O fundo da fresta: o pardo mais fundo, nunca preto; a parte de cima na sombra da tábua, a de baixo um nada mais clara. */
const FRESTA: Rgb = rgb('#33291f')
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
const VEIO = 0.09
const MANCHA = 0.06
const PERIODO_DA_ASPEREZA = 256
const ASPEREZA = 0.02
/**
 * A fresta aberta: em quantos encontros de duas tábuas (a de cima e a da fila de baixo), a meia largura de cada
 * encontro (casas: o vão inteiro tem de 5 a 9 cm na tábua de 50) e o quanto ela alarga e estreita ao longo (voltas
 * inteiras no ladrilho, para a emenda fechar).
 */
const FRESTA_ABERTA = { chance: 0.4, meia: [0.024, 0.04] as const, varia: 0.006, ondas: 6 } as const
/** A fresta fecha na junta fina perto da ponta de qualquer das duas tábuas: daqui (casas) para dentro ela abre. */
const FECHA_NA_PONTA = 0.3
/** A sombra da beira da tábua de cima cobre esta fração do vão (com a passagem macia); o resto é o fundo. */
const SOMBRA_NO_VAO = { ate: 0.4, macio: 0.06 } as const
/** A meia largura da junta fechada e da junta da ponta, em casas, e o macio da beira do vão. */
const JUNTA_FECHADA = 0.009
/** O quanto a junta fechada puxa para o fundo da fresta (a aberta puxa inteiro), e onde ela já conta como aberta. */
const FORCA_DA_FECHADA = 0.38
const ABRINDO = 0.008
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

/** A tábua da fila `fila` no ponto `uu` do ladrilho: o número dela, onde o ponto está nela e o comprimento (casas). */
interface TabuaNoPonto {
  readonly tabua: number
  readonly lx: number
  readonly comprimento: number
}

function tabuaEm(fila: number, uu: number): TabuaNoPonto {
  const doFila = emendas()[fila]
  let k = doFila.length - 1
  for (let i = 0; i < doFila.length; i += 1) if (doFila[i] <= uu) k = i
  const inicio = doFila[k]
  const fim = doFila[(k + 1) % doFila.length]
  return { tabua: Math.round(inicio * PASSO_DO_INICIO) + fila * PRIMO_DA_FILA, lx: naVolta(uu - inicio) * CASAS, comprimento: (naVolta(fim - inicio) || 1) * CASAS }
}

/**
 * A meia largura da junta comprida entre a fila `fila` e a de baixo, no ponto `uu` do ladrilho, em casas. A fresta é
 * do ENCONTRO das duas tábuas (a sorte e a largura saem das duas), e fecha perto da ponta de qualquer uma delas.
 */
function meiaJuntaAbaixo(fila: number, uu: number): number {
  const cima = tabuaEm(fila, uu)
  const baixo = tabuaEm((fila + 1) % FILAS, uu)
  if (hash(cima.tabua, baixo.tabua, SEMENTE + 20) >= FRESTA_ABERTA.chance) return JUNTA_FECHADA
  const larga = FRESTA_ABERTA.meia[0] + (FRESTA_ABERTA.meia[1] - FRESTA_ABERTA.meia[0]) * hash(cima.tabua, baixo.tabua, SEMENTE + 21)
  const aoLongo = valor(uu * FRESTA_ABERTA.ondas, 0.5, FRESTA_ABERTA.ondas, SEMENTE + 30 + fila) - 0.5
  const ponta = Math.min(cima.lx, cima.comprimento - cima.lx, baixo.lx, baixo.comprimento - baixo.lx)
  const aberta = larga + aoLongo * 2 * FRESTA_ABERTA.varia
  return JUNTA_FECHADA + (aberta - JUNTA_FECHADA) * passoSuave(0, FECHA_NA_PONTA, ponta)
}

/** O quanto a junta puxa para a cor do vão: a fechada só um fio pardo, a aberta inteira. */
function forcaDaJunta(meia: number): number {
  return FORCA_DA_FECHADA + (1 - FORCA_DA_FECHADA) * passoSuave(JUNTA_FECHADA, JUNTA_FECHADA + ABRINDO, meia)
}

/** A cor do vão na fração `f` dele, de cima (0) para baixo (1): a sombra da tábua de cima e depois o fundo. */
function corDoVao(f: number, sujeira: number): Rgb {
  const fundo = passoSuave(SOMBRA_NO_VAO.ate - SOMBRA_NO_VAO.macio, SOMBRA_NO_VAO.ate + SOMBRA_NO_VAO.macio, f)
  return luz(misturar(SOMBRA_DA_FRESTA, FUNDO_DA_FRESTA, fundo), sujeira)
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
  const { tabua, lx, comprimento } = tabuaEm(fila, uu)
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

  // O vão: cada fila pinta a metade dele que cai nela. A fração `f` conta de cima para baixo do vão inteiro: a beira
  // da tábua de cima faz sombra em uns 40% e o resto mostra o fundo. A junta fechada é só um fio pardo.
  const naFrestaDeCima = passoSuave(MACIO, -MACIO, dCima) * forcaDaJunta(meiaDeCima)
  const naFrestaDeBaixo = passoSuave(MACIO, -MACIO, dBaixo) * forcaDaJunta(meiaDeBaixo)
  const sujeira = (valor(uu * 128, naVolta(v) * 128, 128, SEMENTE + 12) - 0.5) * 0.2
  if (naFrestaDeBaixo > 0) c = misturar(c, corDoVao(Math.max(0, -dBaixo) / (2 * meiaDeBaixo), sujeira), naFrestaDeBaixo)
  if (naFrestaDeCima > 0) c = misturar(c, corDoVao(1 - Math.max(0, -dCima) / (2 * meiaDeCima), sujeira), naFrestaDeCima)
  // A junta da ponta, fechada, com a beirada escurecida.
  const ponta = Math.min(lx, comprimento - lx)
  c = misturar(c, luz(FRESTA, 0.1 + sujeira), passoSuave(JUNTA_DA_PONTA + MACIO, JUNTA_DA_PONTA - MACIO, ponta) * 0.85)
  return empacotar(c)
}
