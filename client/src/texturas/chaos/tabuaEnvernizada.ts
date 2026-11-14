import { fbm, hash, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * TÁBUA ENVERNIZADA (pedido de 14/11/2026: "texturas novas de madeira"):
 * tábuas médias de mogno escuro avermelhado, cinco por casa, deitadas na
 * horizontal, com as emendas desencontradas e um reflexo largo e macio de
 * verniz correndo ao longo de cada tábua: o chão de um salão nobre. Mais
 * quente, mais estreita e mais polida que o Convés (`embutidas.ts`,
 * `conves`): o veio quase some sob o verniz e a junta é fina e fechada. O
 * reflexo acende em manchas largas que pegam várias tábuas de uma vez, como
 * o piso polido refletindo a janela. Luz de cima à esquerda: o reflexo pende
 * para a metade de cima de cada tábua, a beirada de baixo fica na sombra.
 */

const CASAS = 8
const TABUAS_POR_CASA = 5
const FILAS = CASAS * TABUAS_POR_CASA
/** Comprimento das tábuas, em casas (3,7 a 6 m: tábua corrida de salão). */
const COMPRIMENTO_MINIMO = 2.5
const COMPRIMENTO_MAXIMO = 4
/** Duas emendas de filas vizinhas nunca ficam mais perto que isto, em casas. */
const EMENDA_MINIMA = 0.6
const TENTATIVAS = 16
const SEMENTE = 1200
/** Ruído de valor sem período: o veio e o reflexo são medidos ao longo da tábua, que já é contínua na emenda do ladrilho. */
const SEM_PERIODO = 1 << 20
const PASSO_DO_INICIO = 4096
const PRIMO_DA_FILA = 7919

/**
 * O mogno: marrom-avermelhado escuro (matiz 14°, croma ~0,18), mais claro
 * que o Convés (#2e1a0c) para o reflexo ter onde aparecer e mais vermelho
 * que a cerejeira dos objetos (#7c4b37). Cinco tons vizinhos, um por tábua.
 */
const TONS: readonly Rgb[] = [rgb('#533025'), rgb('#563327'), rgb('#502e23'), rgb('#553226'), rgb('#522f24')]
/** O reflexo do verniz: o mesmo mogno lavado de luz e com MENOS croma (0,16), para o brilho não acender a saturação. */
const REFLEXO: Rgb = rgb('#8a6c62')
/** O quanto o reflexo cobre o tom no meio dele, no máximo (0,17 na primeira folha não se via). */
const FORCA_DO_REFLEXO = 0.32
/** Onde o reflexo corre na tábua (0 = beirada de cima) e a largura dele, em larguras de tábua: largo, quase a tábua toda. */
const CENTRO_DO_REFLEXO = 0.42
const LARGURA_DO_REFLEXO = 0.34
/**
 * O brilho grande: manchas macias de umas 2 casas onde várias tábuas brilham
 * juntas, como o piso polido que reflete a janela. Cada tábua sozinha
 * acendendo e apagando (segunda folha) virava risquinho solto na mesa; com
 * 3 manchas por ladrilho e o apagado em 0,2 (terceira), a mancha voltava em
 * grade no 3 x 3.
 */
const CELULAS_DO_BRILHO = 4
const OITAVAS_DO_BRILHO = 2
/** Fora da mancha o reflexo não some de todo: o verniz brilha um pouco em toda parte. */
const REFLEXO_APAGADO = 0.38
const VARIACAO_DA_TABUA = 0.08
const JUNTA_LONGA = 0.13
const JUNTA_DA_PONTA = 0.11
const ESCURO_DA_JUNTA = 0.17
const CHANFRO = 0.028
/** Sob o verniz o veio quase some. */
const VEIO = 0.045
const MANCHA = 0.05

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

function canal(x: number): number {
  return x <= 0 ? 0 : x >= 255 ? 255 : Math.round(x)
}

/** O tom misturado ao reflexo (`t`) e vezes a luz `k`, em 0xRRGGBB, sem criar array por pixel. */
function pintar(tom: Rgb, t: number, k: number): number {
  const r = (tom[0] + (REFLEXO[0] - tom[0]) * t) * k
  const g = (tom[1] + (REFLEXO[1] - tom[1]) * t) * k
  const b = (tom[2] + (REFLEXO[2] - tom[2]) * t) * k
  return (canal(r) << 16) | (canal(g) << 8) | canal(b)
}

/** A cor da tábua envernizada no ponto (u, v) do ladrilho de 8 casas. */
export function texturaTabuaEnvernizada(u: number, v: number): number {
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
  // O veio do mogno: faixas compridas e mansas, apagadas pelo verniz.
  const onda = (valor(lx * 0.4, fy * 1.2, SEM_PERIODO, id) - 0.5) * 0.6
  const veio = valor(lx * 1.2, (fy + onda) * 2, SEM_PERIODO, id + 1) - 0.5
  const mancha = valor(lx * 0.3, fy * 0.7, SEM_PERIODO, id + 2) - 0.5
  luz += veio * VEIO + mancha * MANCHA
  // O reflexo: uma faixa larga e macia ao longo de cada tábua, mais forte em cima, acesa nas manchas do brilho grande.
  const atravessado = (fy - CENTRO_DO_REFLEXO) / LARGURA_DO_REFLEXO
  const grande = passoSuave(-0.35, 0.55, fbm(u, v, CELULAS_DO_BRILHO, OITAVAS_DO_BRILHO, SEMENTE + 5))
  const aoLongo = 0.75 + 0.25 * valor(lx * 0.6, 0.5, SEM_PERIODO, id + 3)
  const daTabua = 0.7 + 0.3 * hash(tabua, fila, SEMENTE + 4)
  const reflexo = Math.exp(-atravessado * atravessado) * (REFLEXO_APAGADO + (1 - REFLEXO_APAGADO) * grande) * aoLongo * daTabua * FORCA_DO_REFLEXO
  // Juntas finas e fechadas: as compridas entre as filas e as das pontas.
  const borda = Math.min(fy, 1 - fy)
  const ponta = Math.min(lx, comprimento - lx) * TABUAS_POR_CASA
  const junta = Math.max(passoSuave(JUNTA_LONGA, 0, borda), passoSuave(JUNTA_DA_PONTA, 0, ponta) * 0.9)
  // A beirada de cima da tábua pega a luz (vem de cima); a de baixo fica na sombra.
  const chanfro = passoSuave(0.26, 0.05, fy) * CHANFRO - passoSuave(0.74, 0.95, fy) * CHANFRO
  luz += chanfro - junta * ESCURO_DA_JUNTA
  return pintar(tom, reflexo * (1 - junta), luz)
}
