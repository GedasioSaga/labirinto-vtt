import { hash, luzNaInclinacao, LUZ_NO_PLANO, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * TRONCOS (pedido de 14/11/2026: "texturas novas de madeira"): troncos
 * roliços deitados lado a lado, três por casa, na horizontal, a casca
 * marrom-acinzentada com a luz no dorso e a sombra funda entre um e outro: a
 * estiva de um forte. Cada tronco tem a grossura dele, afina um pouco de uma
 * ponta à outra e não é reto de régua; as pontas de dois troncos da mesma
 * fila se encostam desencontradas das filas vizinhas. Luz de cima à
 * esquerda, como todas: a metade de cima do tronco pega a luz.
 */

const CASAS = 8
const TRONCOS_POR_CASA = 3
const FILAS = CASAS * TRONCOS_POR_CASA
/** Comprimento dos troncos, em casas (5 a 9 m; curtos, a primeira folha lia como tijolo). */
const COMPRIMENTO_MINIMO = 3.5
const COMPRIMENTO_MAXIMO = 6
/** Duas pontas de filas vizinhas nunca ficam mais perto que isto, em casas. */
const EMENDA_MINIMA = 1
const TENTATIVAS = 16
const SEMENTE = 1600
/** Ruído de valor sem período: a casca e a curva são medidas ao longo do tronco, contínuo na emenda do ladrilho. */
const SEM_PERIODO = 1 << 20
const PASSO_DO_INICIO = 4096
const PRIMO_DA_FILA = 7919

/**
 * A casca: o marrom-acinzentado da lenha de carvalho dos objetos
 * (`meioTermo/materiais.ts`, #55453a) mais claro (o chão inteiro é casca,
 * escura demais apagava a luz do dorso). Croma ~0,12. Cinco tons, um por tronco.
 */
const TONS: readonly Rgb[] = [rgb('#6a5a4b'), rgb('#6e5e4e'), rgb('#675848'), rgb('#6b5b4a'), rgb('#6f5f4d')]
/** Raio do tronco em alturas de fila (0,5 = encosta no vizinho) e o quanto ele varia de um tronco para outro. */
const RAIO = 0.48
const RAIO_VARIA = 0.06
/** O tronco afina de uma ponta à outra (fração do raio). */
const AFINA = 0.05
/** O quanto o tronco foge da reta, em alturas de fila. */
const CURVA = 0.035
/** A força da luz no roliço: o dorso claro e a barriga escura (0,3 na primeira folha lia como tábua). */
const LUZ_DO_ROLICO = 0.4
/** O fundo entre dois troncos: sombra, nunca preto, numa fenda estreita (o roliço é que mostra o tronco). */
const FENDA = 0.26
const FENDA_DE = 0.9
const FENDA_ATE = 1.04
/** Pouca diferença de um tronco para o outro: mais que isso, uma fila escura voltava em faixa no 3 x 3. */
const VARIACAO_DO_TRONCO = 0.05
/** As fissuras da casca correm ao longo do tronco, fracas (cada risco atravessado conta na listra). */
const CASCA = 0.07
/** As placas da casca: curtas ao longo do tronco e largas no través, para a casca variar no comprido. */
const PLACA = 0.09
const MANCHA = 0.06
/**
 * Tocos de galho cortado: até três por tronco, ovais, escuros no miolo, com
 * a borda de cima pegando a luz. Pequenos e escuros (terceira folha), liam
 * como sujeira na mesa; agora são maiores e mais mansos.
 */
const VAGAS_DE_TOCO = 3
const CHANCE_DO_TOCO = 0.3
const ESCURO_DO_TOCO = 0.2
const LUZ_DO_TOCO = 0.12
/** Até onde vai a borda clara do toco, em raios dele. */
const BORDA_DO_TOCO = 1.6
/** O raio do tronco em casas: a ponta é meia esfera desse raio, clara do lado da luz. */
const RAIO_EM_CASAS = RAIO / TRONCOS_POR_CASA
/** Entre duas pontas da mesma fila, a fenda funda, em casas. */
const VAO_DA_PONTA = 0.02

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

/** As pontas de uma fila (o início de cada tronco em [0, 1)), em ordem, pelo sorteio `tentativa`. */
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

let pontasProntas: readonly Float64Array[] | null = null

/** As pontas de todas as filas, sorteadas uma vez (preguiçosa, como `emendas()` do Convés). */
function pontas(): readonly Float64Array[] {
  if (pontasProntas !== null) return pontasProntas
  const filas: Float64Array[] = []
  for (let f = 0; f < FILAS; f += 1) {
    let escolhida = sortearFila(f, 0)
    for (let tentativa = 1; tentativa < TENTATIVAS && encosta(escolhida, filas, f); tentativa += 1) escolhida = sortearFila(f, tentativa)
    filas.push(escolhida)
  }
  pontasProntas = filas
  return filas
}

/**
 * A luz que os tocos de galho do tronco somam no ponto: o miolo escuro e a
 * borda de cima clara. `lx` em casas, `t` no través do tronco (-1 a 1).
 */
function tocos(tronco: number, lx: number, t: number, comprimento: number): number {
  let soma = 0
  for (let n = 0; n < VAGAS_DE_TOCO; n += 1) {
    if (hash(tronco, n, SEMENTE + 5) >= CHANCE_DO_TOCO) continue
    const cx = 0.3 + hash(tronco, n, SEMENTE + 6) * (comprimento - 0.6)
    const ct = (hash(tronco, n, SEMENTE + 7) - 0.5) * 0.9
    const rx = 0.07 + hash(tronco, n, SEMENTE + 8) * 0.04
    const rt = 0.3 + hash(tronco, n, SEMENTE + 9) * 0.12
    const dx = (lx - cx) / rx
    const dt = (t - ct) / rt
    const d = Math.sqrt(dx * dx + dt * dt)
    if (d >= BORDA_DO_TOCO) continue
    // A borda de cima à esquerda do toco (dx e dt negativos) vira para a luz; no miolo (d = 0) não há borda.
    const virada = d > 0 ? Math.max(0, -(dx + dt) / (d * Math.SQRT2)) : 0
    soma += -passoSuave(1, 0.35, d) * ESCURO_DO_TOCO + passoSuave(BORDA_DO_TOCO, 1, d) * passoSuave(0.7, 1, d) * virada * LUZ_DO_TOCO
  }
  return soma
}

function canal(x: number): number {
  return x <= 0 ? 0 : x >= 255 ? 255 : Math.round(x)
}

/** O tom vezes a luz `k`, em 0xRRGGBB, sem criar array por pixel. */
function pintar(tom: Rgb, k: number): number {
  return (canal(tom[0] * k) << 16) | (canal(tom[1] * k) << 8) | canal(tom[2] * k)
}

/** A cor dos troncos no ponto (u, v) do ladrilho de 8 casas. */
export function texturaTroncos(u: number, v: number): number {
  // Meio tronco de deslocamento: a emenda do ladrilho cai no dorso, nunca na fenda.
  const y = naVolta(v) * FILAS + 0.5
  const fila = Math.floor(y) % FILAS
  const fy = y - Math.floor(y)
  const doFila = pontas()[fila]
  const x = naVolta(u)
  let k = doFila.length - 1
  for (let i = 0; i < doFila.length; i += 1) if (doFila[i] <= x) k = i
  const inicio = doFila[k]
  const fim = doFila[(k + 1) % doFila.length]
  // Em casas, ao longo do tronco: contínuo através da emenda do ladrilho.
  const lx = naVolta(x - inicio) * CASAS
  const comprimento = (naVolta(fim - inicio) || 1) * CASAS
  const tronco = Math.round(inicio * PASSO_DO_INICIO) + fila * PRIMO_DA_FILA
  const id = tronco * 4 + SEMENTE
  const tom = TONS[Math.floor(hash(tronco, fila, SEMENTE + 2) * TONS.length) % TONS.length]
  // O corte do tronco: o centro foge um pouco da reta e o raio afina de uma ponta à outra.
  const centro = 0.5 + (valor(lx * 0.45, 0.5, SEM_PERIODO, id) - 0.5) * 2 * CURVA
  const grossura = 1 - RAIO_VARIA * hash(tronco, fila, SEMENTE + 3)
  // A ponta é meia esfera: perto dela o raio encolhe (o corte vira curva) e a superfície desce para o lado.
  const ponta = Math.min(lx, comprimento - lx)
  const naPonta = ponta < RAIO_EM_CASAS ? (RAIO_EM_CASAS - ponta) / RAIO_EM_CASAS : 0
  const encolhe = Math.sqrt(Math.max(0, 1 - naPonta * naPonta))
  const raio = RAIO * grossura * (1 - AFINA * (lx / comprimento)) * Math.max(encolhe, 0.05)
  const t = (fy - centro) / raio
  const dentro = Math.min(Math.abs(t), 0.985)
  // A inclinação do roliço (a altura é raiz de 1 - t²): a metade de cima vira para a luz.
  const inclinacao = (t < 0 ? dentro : -dentro) / Math.sqrt(1 - dentro * dentro)
  // Na ponta a superfície desce para fora: a ponta da esquerda vira para a luz, a da direita para a sombra.
  const caida = Math.min(naPonta, 0.95)
  const inclinacaoDaPonta = ((lx < comprimento - lx ? 1 : -1) * caida) / Math.sqrt(1 - caida * caida)
  let luz = 1 + (luzNaInclinacao(inclinacaoDaPonta, inclinacao) - LUZ_NO_PLANO) * LUZ_DO_ROLICO
  luz += (hash(tronco, fila, SEMENTE + 4) - 0.5) * VARIACAO_DO_TRONCO
  // A casca: fissuras compridas ao longo do tronco (seguem o roliço, medidas em t) e manchas largas.
  const casca = valor(lx * 1.8, t * 2.2, SEM_PERIODO, id + 1)
  const fissura = 1 - Math.abs(casca * 2 - 1)
  const placa = valor(lx * 3.5, t * 1.3, SEM_PERIODO, id + 3) - 0.5
  const mancha = valor(lx * 0.5, t * 0.6, SEM_PERIODO, id + 2) - 0.5
  luz += (fissura - 0.5) * CASCA + placa * PLACA + mancha * MANCHA
  luz += tocos(tronco, lx, t, comprimento)
  // A fenda entre dois troncos e o vão estreito onde duas pontas se encostam.
  const fenda = Math.max(passoSuave(FENDA_DE, FENDA_ATE, Math.abs(t)), passoSuave(VAO_DA_PONTA, 0, ponta))
  luz = luz * (1 - fenda) + (1 - FENDA) * fenda
  return pintar(tom, luz)
}
