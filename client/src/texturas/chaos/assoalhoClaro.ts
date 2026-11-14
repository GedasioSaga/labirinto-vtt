import { hash, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * ASSOALHO CLARO (pedido de 14/11/2026: "texturas novas de madeira"): tábuas
 * estreitas de pinho cor de mel claro, seis por casa, deitadas na horizontal,
 * com as emendas das pontas desencontradas fila a fila e o veio fino quase
 * apagado: o chão de uma casa de vila limpa. O mesmo desenho de tábua do
 * Convés (`embutidas.ts`, `conves`), mas mais clara, mais estreita e mais nova.
 * Luz de cima à esquerda, como todas: a beirada de cima de cada tábua pega a
 * luz, a de baixo fica na sombra.
 */

const CASAS = 8
const TABUAS_POR_CASA = 6
const FILAS = CASAS * TABUAS_POR_CASA
/** Comprimento das tábuas, em casas (3 a 5,2 m de pinho; mais curta, a mesa virava retalho). */
const COMPRIMENTO_MINIMO = 2
const COMPRIMENTO_MAXIMO = 3.5
/** Duas emendas de filas vizinhas nunca ficam mais perto que isto, em casas (a fiada não vira escada). */
const EMENDA_MINIMA = 0.45
/** Sorteios por fila até as emendas fugirem das filas de cima. */
const TENTATIVAS = 16
const SEMENTE = 1100
/** Ruído de valor sem período: o veio é medido ao longo da tábua, que já é contínua na emenda do ladrilho. */
const SEM_PERIODO = 1 << 20
/** O número da tábua: o início dela em 1/4096 do ladrilho mais a fila vezes um primo (único e igual dos dois lados da emenda). */
const PASSO_DO_INICIO = 4096
const PRIMO_DA_FILA = 7919

/**
 * O mel claro: o pinho dos objetos (`meioTermo/materiais.ts`, #a3875f) mais
 * claro e com menos croma (0,19 no lugar de 0,27), para o chão não engolir a
 * mesa de pinho posta em cima dele. Cinco tons vizinhos, um por tábua, todos
 * com o mesmo croma (um tom mais acinzentado na primeira folha virava bege).
 */
const TONS: readonly Rgb[] = [rgb('#b09b7c'), rgb('#b49f80'), rgb('#ab967a'), rgb('#b19d7f'), rgb('#ad987b')]
/** Uma tábua mais clara ou mais escura que a vizinha: é o que separa as tábuas de longe, sem risca. */
const VARIACAO_DA_TABUA = 0.075
/** Juntas largas e macias de contraste baixo: no pinho claro, junta funda vira listra (a régua é 0,0175). */
const JUNTA_LONGA = 0.17
const JUNTA_DA_PONTA = 0.13
const ESCURO_DA_JUNTA = 0.085
const CHANFRO = 0.022
const VEIO = 0.035
const MANCHA = 0.05
/** Poro do pinho: período 320 por ladrilho (abaixo dos 600 que viram chuvisco) e quase nada de força. */
const PERIODO_DO_PORO = 320
const PORO = 0.018

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

/** O tom vezes a luz `k`, em 0xRRGGBB, sem criar array por pixel. */
function pintar(tom: Rgb, k: number): number {
  return (canal(tom[0] * k) << 16) | (canal(tom[1] * k) << 8) | canal(tom[2] * k)
}

/** A cor do assoalho claro no ponto (u, v) do ladrilho de 8 casas. */
export function texturaAssoalhoClaro(u: number, v: number): number {
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
  // O veio: linhas compridas e onduladas ao longo da tábua, quase apagadas, e uma mancha larga.
  const id = tabua * 4 + SEMENTE
  const onda = (valor(lx * 0.45, fy * 1.3, SEM_PERIODO, id) - 0.5) * 0.7
  const veio = valor(lx * 1.6, (fy + onda) * 2.2, SEM_PERIODO, id + 1) - 0.5
  const mancha = valor(lx * 0.35, fy * 0.8, SEM_PERIODO, id + 2) - 0.5
  luz += veio * VEIO + mancha * MANCHA
  // Juntas: as compridas entre as filas e as das pontas, largas e macias.
  const borda = Math.min(fy, 1 - fy)
  const ponta = Math.min(lx, comprimento - lx) * TABUAS_POR_CASA
  const junta = Math.max(passoSuave(JUNTA_LONGA, 0, borda), passoSuave(JUNTA_DA_PONTA, 0, ponta) * 0.9)
  // A beirada de cima da tábua pega a luz (vem de cima); a de baixo fica na sombra.
  const chanfro = passoSuave(0.3, 0.06, fy) * CHANFRO - passoSuave(0.7, 0.94, fy) * CHANFRO
  luz += chanfro - junta * ESCURO_DA_JUNTA
  luz += (valor(u * PERIODO_DO_PORO, v * PERIODO_DO_PORO, PERIODO_DO_PORO, SEMENTE + 4) - 0.5) * PORO
  return pintar(tom, luz)
}
