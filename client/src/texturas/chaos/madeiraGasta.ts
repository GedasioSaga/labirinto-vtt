import { hash, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * MADEIRA VELHA (pedido de 14/11/2026: "texturas novas de madeira"): tábuas
 * largas acinzentadas pelo tempo, quatro por casa, deitadas na horizontal,
 * com rachas que nascem nas pontas, nós escuros e uma ou outra tábua mais
 * escura de umidade: celeiro, ruína. As juntas são mais abertas que as do
 * Convés (`embutidas.ts`, `conves`), porque a tábua velha encolheu. Luz de
 * cima à esquerda, como todas.
 */

const CASAS = 8
const TABUAS_POR_CASA = 4
const FILAS = CASAS * TABUAS_POR_CASA
/** Comprimento das tábuas, em casas (2,7 a 4,8 m). */
const COMPRIMENTO_MINIMO = 1.8
const COMPRIMENTO_MAXIMO = 3.2
/** Duas emendas de filas vizinhas nunca ficam mais perto que isto, em casas. */
const EMENDA_MINIMA = 0.6
const TENTATIVAS = 16
const SEMENTE = 1500
/** Ruído de valor sem período: o veio, o nó e a racha são medidos ao longo da tábua, contínua na emenda do ladrilho. */
const SEM_PERIODO = 1 << 20
const PASSO_DO_INICIO = 4096
const PRIMO_DA_FILA = 7919

/**
 * O cinza do tempo: a madeira velha dos objetos (`meioTermo/materiais.ts`,
 * #7b776e) com um fio a mais de marrom (croma ~0,09), para ainda se ler
 * madeira e não pedra. Cinco tons vizinhos, um por tábua.
 */
const TONS: readonly Rgb[] = [rgb('#857c6f'), rgb('#8a8275'), rgb('#7f776b'), rgb('#878074'), rgb('#7c7468')]
/**
 * A tábua úmida: mais escura no mesmo cinza-pardo (croma 0,09), nunca preta.
 * A primeira (#5f5446, cobrindo até 85%) lia como outra madeira e formava
 * uma mancha que voltava em grade no 3 x 3.
 */
const UMIDO: Rgb = rgb('#655b4e')
/** Uma tábua em quantas fica úmida, e o quanto a umidade cobre o tom (varia ao longo dela: um trecho molhado, outro quase seco). */
const CHANCE_DE_UMIDADE = 0.1
const UMIDADE_MINIMA = 0.1
const UMIDADE_MAXIMA = 0.65
/**
 * O nó: um cerne pardo-escuro (croma 0,07), oval ao longo da fibra, com um
 * anel mais escuro em volta. Pequeno e frequente, na primeira folha, lia
 * como furo de prego; agora é maior e mais raro.
 */
const NO: Rgb = rgb('#4b4238')
const CHANCE_DO_NO = 0.16
const FORCA_DO_NO = 0.55
/** O anel do nó: até 1,6 vez o raio, escurecendo de leve (a fibra que contorna o nó). */
const ANEL_DO_NO = 1.6
const ESCURO_DO_ANEL = 0.08
/** A racha: nasce numa ponta e afina até sumir; no meio dela, a sombra é funda mas nunca preta. */
const CHANCE_DA_RACHA = 0.45
const LARGURA_DA_RACHA = 0.07
const ESCURO_DA_RACHA = 0.33
const VARIACAO_DA_TABUA = 0.08
const JUNTA_LONGA = 0.2
const JUNTA_DA_PONTA = 0.15
const ESCURO_DA_JUNTA = 0.13
const CHANFRO = 0.022
/** O veio aparece mais que no Convés: o tempo levanta a fibra. */
const VEIO = 0.05
const MANCHA = 0.06
/** Aspereza: período 256 por ladrilho (abaixo dos 600 que viram chuvisco). */
const PERIODO_DA_ASPEREZA = 256
const ASPEREZA = 0.02

/** Uma volta sem emenda em [0, 1). */
function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** A distância entre duas posições do ladrilho dando a volta, em casas. */
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

/** A fila encosta nas de cima (a vizinha e, mais de leve, a de duas acima) ou, a última, na primeira do outro lado da emenda. */
function encosta(fila: Float64Array, prontas: readonly Float64Array[], f: number): boolean {
  if (f >= 1 && perto(fila, prontas[f - 1], EMENDA_MINIMA)) return true
  if (f >= 2 && perto(fila, prontas[f - 2], EMENDA_MINIMA / 2)) return true
  return f === FILAS - 1 && perto(fila, prontas[0], EMENDA_MINIMA)
}

let emendasProntas: readonly Float64Array[] | null = null

/** As emendas de todas as filas, sorteadas uma vez (preguiçosa, como `emendas()` do Convés). */
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

/**
 * A distância do ponto ao nó `n` da tábua, em raios do nó (oval ao longo da
 * fibra); `Infinity` = a tábua não tem esse nó. `lx` em casas, `fy` em larguras de tábua.
 */
function distanciaAoNo(tabua: number, n: number, lx: number, fy: number, comprimento: number): number {
  if (hash(tabua, n, SEMENTE + 6) >= CHANCE_DO_NO) return Infinity
  const cx = 0.4 + hash(tabua, n, SEMENTE + 7) * (comprimento - 0.8)
  const cy = 0.3 + hash(tabua, n, SEMENTE + 8) * 0.4
  // Comprido ao longo da fibra (três a quatro vezes mais longo que largo): redondo, lia como furo.
  const rx = 0.14 + hash(tabua, n, SEMENTE + 9) * 0.08
  const ry = 0.14 + hash(tabua, n, SEMENTE + 10) * 0.06
  const dx = (lx - cx) / rx
  const dy = (fy - cy) / ry
  return Math.sqrt(dx * dx + dy * dy)
}

/** O quanto a racha da tábua escurece o ponto: nasce numa das pontas e afina até sumir. */
function rachaDaTabua(tabua: number, id: number, lx: number, fy: number, comprimento: number): number {
  if (hash(tabua, 0, SEMENTE + 11) >= CHANCE_DA_RACHA) return 0
  const tamanho = 0.4 + hash(tabua, 1, SEMENTE + 11) * 0.8
  const daPonta = hash(tabua, 2, SEMENTE + 11) < 0.5 ? lx : comprimento - lx
  if (daPonta >= tamanho) return 0
  const afina = 1 - daPonta / tamanho
  const meio = 0.3 + hash(tabua, 3, SEMENTE + 11) * 0.4 + (valor(lx * 1.4, 0.5, SEM_PERIODO, id + 3) - 0.5) * 0.12
  const largura = LARGURA_DA_RACHA * Math.sqrt(afina)
  return passoSuave(largura, largura * 0.2, Math.abs(fy - meio)) * afina
}

function canal(x: number): number {
  return x <= 0 ? 0 : x >= 255 ? 255 : Math.round(x)
}

/** O tom da tábua puxado para o úmido (`tu`) e para o nó (`tn`), vezes a luz `k`, em 0xRRGGBB, sem criar array por pixel. */
function pintar(tom: Rgb, tu: number, tn: number, k: number): number {
  const r = (tom[0] + (UMIDO[0] - tom[0]) * tu) * (1 - tn) + NO[0] * tn
  const g = (tom[1] + (UMIDO[1] - tom[1]) * tu) * (1 - tn) + NO[1] * tn
  const b = (tom[2] + (UMIDO[2] - tom[2]) * tu) * (1 - tn) + NO[2] * tn
  return (canal(r * k) << 16) | (canal(g * k) << 8) | canal(b * k)
}

/** A cor da madeira velha no ponto (u, v) do ladrilho de 8 casas. */
export function texturaMadeiraGasta(u: number, v: number): number {
  // Meia tábua de deslocamento: a emenda do ladrilho cai no meio da tábua, nunca numa junta.
  const y = naVolta(v) * FILAS + 0.5
  const fila = Math.floor(y) % FILAS
  const fy = y - Math.floor(y)
  const doFila = emendas()[fila]
  const x = naVolta(u)
  let k = doFila.length - 1
  for (let i = 0; i < doFila.length; i += 1) if (doFila[i] <= x) k = i
  const inicio = doFila[k]
  const fim = doFila[(k + 1) % doFila.length]
  // Em casas, ao longo da tábua: contínuo através da emenda do ladrilho.
  const lx = naVolta(x - inicio) * CASAS
  const comprimento = (naVolta(fim - inicio) || 1) * CASAS
  const tabua = Math.round(inicio * PASSO_DO_INICIO) + fila * PRIMO_DA_FILA
  const tom = TONS[Math.floor(hash(tabua, fila, SEMENTE + 2) * TONS.length) % TONS.length]
  let luz = 1 + (hash(tabua, fila, SEMENTE + 3) - 0.5) * VARIACAO_DA_TABUA
  const id = tabua * 4 + SEMENTE
  // A umidade: a tábua inteira mais escura, mais forte numa parte que na outra.
  let umidade = 0
  if (hash(tabua, fila, SEMENTE + 5) < CHANCE_DE_UMIDADE) {
    const aoLongo = passoSuave(0.3, 0.7, valor(lx * 0.6, 0.5, SEM_PERIODO, id + 3))
    umidade = UMIDADE_MINIMA + (UMIDADE_MAXIMA - UMIDADE_MINIMA) * aoLongo
  }
  // O veio levantado pelo tempo e as manchas largas do sol e da chuva.
  const onda = (valor(lx * 0.4, fy * 1.2, SEM_PERIODO, id) - 0.5) * 0.8
  const veio = valor(lx * 1.2, (fy + onda) * 2.2, SEM_PERIODO, id + 1) - 0.5
  const mancha = valor(lx * 0.3, fy * 0.7, SEM_PERIODO, id + 2) - 0.5
  luz += veio * VEIO + mancha * MANCHA
  // Os nós (até dois por tábua) e a racha que nasce na ponta.
  const dNo = Math.min(distanciaAoNo(tabua, 0, lx, fy, comprimento), distanciaAoNo(tabua, 1, lx, fy, comprimento))
  const no = passoSuave(1, 0.3, dNo) * FORCA_DO_NO
  luz -= passoSuave(ANEL_DO_NO, 1, dNo) * ESCURO_DO_ANEL
  luz -= rachaDaTabua(tabua, id, lx, fy, comprimento) * ESCURO_DA_RACHA
  // Juntas abertas e macias: as compridas entre as filas e as das pontas.
  const borda = Math.min(fy, 1 - fy)
  const ponta = Math.min(lx, comprimento - lx) * TABUAS_POR_CASA
  const junta = Math.max(passoSuave(JUNTA_LONGA, 0, borda), passoSuave(JUNTA_DA_PONTA, 0, ponta) * 0.9)
  // A beirada de cima da tábua pega a luz (vem de cima); a de baixo fica na sombra.
  const chanfro = passoSuave(0.3, 0.06, fy) * CHANFRO - passoSuave(0.7, 0.94, fy) * CHANFRO
  luz += chanfro - junta * ESCURO_DA_JUNTA
  luz += (valor(u * PERIODO_DA_ASPEREZA, v * PERIODO_DA_ASPEREZA, PERIODO_DA_ASPEREZA, SEMENTE + 4) - 0.5) * ASPEREZA
  return pintar(tom, umidade, no, luz)
}
