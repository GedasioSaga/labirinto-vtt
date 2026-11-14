import { hash, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * TACO EM ESPINHA (pedido de 14/11/2026: "texturas novas de madeira"): tacos
 * curtos de carvalho médio em espinha de peixe, a 45°, as colunas da espinha
 * correndo de cima para baixo; dois tons alternados de leve (os tacos que
 * descem para a direita um pouco mais claros que os que descem para a
 * esquerda, como a fibra pega a luz no taco de verdade) e junta fina e
 * macia: biblioteca, palácio. Luz de cima à esquerda: a beirada do taco
 * virada para lá clareia, a do lado oposto escurece.
 *
 * O desenho: a espinha com os tacos em pé e deitados (comprimento = 4
 * larguras) tem a rede (1, 1) e (4, -4) em larguras de taco; girada 45°, a
 * rede fica (0, 1/5 casa) e (4/5 casa, 0), então o ladrilho de 8 casas tem 40
 * passos numa direção e 10 colunas na outra e repete sem emenda.
 */

const CASAS = 8
/** A diagonal do taco (a largura vezes raiz de 2), em casas: 5 tacos de cada lado por casa, ao longo da coluna. */
const DIAGONAIS_POR_CASA = 5
/** O taco tem 4 larguras de comprido (taco de ~21 x 85 cm na casa de 1,5 m). */
const COMPRIMENTO = 4
/** Passos da escada por ladrilho e colunas da espinha por ladrilho: o número do taco dá a volta neles. */
const PASSOS = CASAS * DIAGONAIS_POR_CASA
const COLUNAS = PASSOS / COMPRIMENTO
/** Uma coluna da espinha anda 2 comprimentos de taco na rede girada (o taco deitado e o em pé). */
const DUAS = 2 * COMPRIMENTO
const SEMENTE = 1300
/** Ruído de valor sem período: o veio é medido no próprio taco. */
const SEM_PERIODO = 1 << 20

/**
 * O carvalho médio: o carvalho dos objetos (`meioTermo/materiais.ts`,
 * #8b6b47) com um quarto a menos de croma (0,19 no lugar de 0,27), para caber
 * no teto de 0,22 e não brigar com a mesa de carvalho em cima. Quatro tons
 * vizinhos, um por taco.
 */
const TONS: readonly Rgb[] = [rgb('#8a7259'), rgb('#8e765c'), rgb('#866e56'), rgb('#8c745c')]
/** Os dois tons da espinha: a fibra de um lado pega mais luz que a do outro. */
const TOM_DESCENDO = 0.035
const TOM_SUBINDO = -0.035
const VARIACAO_DO_TACO = 0.07
/** Junta fina (0,11 da largura de cada lado, ~2 px no ladrilho de 1024) e macia. */
const JUNTA = 0.11
const ESCURO_DA_JUNTA = 0.13
/** A beirada virada para a luz clareia e a oposta escurece, numa faixa de um quarto da largura. */
const BEIRADA = 0.25
const LUZ_DA_BEIRADA = 0.035
const VEIO = 0.05
const MANCHA = 0.04

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function voltaInteira(n: number, m: number): number {
  const r = n % m
  return r < 0 ? r + m : r
}

function canal(x: number): number {
  return x <= 0 ? 0 : x >= 255 ? 255 : Math.round(x)
}

/** O tom vezes a luz `k`, em 0xRRGGBB, sem criar array por pixel. */
function pintar(tom: Rgb, k: number): number {
  return (canal(tom[0] * k) << 16) | (canal(tom[1] * k) << 8) | canal(tom[2] * k)
}

/** A cor do taco em espinha no ponto (u, v) do ladrilho de 8 casas. */
export function texturaTacoEspinha(u: number, v: number): number {
  const px = naVolta(u) * CASAS
  const py = naVolta(v) * CASAS
  // Girado 45°, em larguras de taco: o eixo qx desce para a direita, o qy desce para a esquerda.
  const qx = (px + py) * DIAGONAIS_POR_CASA
  const qy = (py - px) * DIAGONAIS_POR_CASA
  // Taco que desce para a direita (deitado na rede girada): a linha é qy, a escada vem do quanto anda em qx.
  const linha = Math.floor(qy)
  const t = qx - linha
  const escada = Math.floor(t / DUAS)
  const resto = t - escada * DUAS
  const descendo = resto < COMPRIMENTO
  let aoLongo: number
  let atravessado: number
  let numero: number
  if (descendo) {
    aoLongo = resto
    atravessado = qy - linha
    numero = voltaInteira(escada, COLUNAS) * PASSOS + voltaInteira(linha + escada * COMPRIMENTO, PASSOS)
  } else {
    // Taco que desce para a esquerda: a coluna é qx.
    const coluna = Math.floor(qx)
    const t2 = qy - coluna - 1
    const m = Math.floor(t2 / DUAS)
    aoLongo = t2 - m * DUAS
    atravessado = qx - coluna
    numero = PASSOS * COLUNAS + voltaInteira(-m, COLUNAS) * PASSOS + voltaInteira(coluna + m * COMPRIMENTO, PASSOS)
  }
  const tom = TONS[Math.floor(hash(numero, 1, SEMENTE) * TONS.length) % TONS.length]
  let luz = 1 + (descendo ? TOM_DESCENDO : TOM_SUBINDO) + (hash(numero, 2, SEMENTE) - 0.5) * VARIACAO_DO_TACO
  // O veio corre ao longo do taco, fraco, e começa num ponto sorteado (dois tacos vizinhos não repetem o desenho).
  const id = numero * 4 + SEMENTE
  const desvio = hash(numero, 3, SEMENTE) * 50
  const onda = (valor(aoLongo * 0.5 + desvio, atravessado * 1.2, SEM_PERIODO, id) - 0.5) * 0.6
  const veio = valor(aoLongo * 1.3 + desvio, (atravessado + onda) * 2.4, SEM_PERIODO, id + 1) - 0.5
  const mancha = valor(aoLongo * 0.4 + desvio, atravessado * 0.8, SEM_PERIODO, id + 2) - 0.5
  luz += veio * VEIO + mancha * MANCHA
  // Junta fina e macia nos quatro lados do taco.
  const borda = Math.min(atravessado, 1 - atravessado)
  const ponta = Math.min(aoLongo, COMPRIMENTO - aoLongo)
  const junta = Math.max(passoSuave(JUNTA, 0, borda), passoSuave(JUNTA, 0, ponta))
  // A beirada virada para a luz: no taco que desce para a direita é a ponta de cima; no outro, o lado comprido de cima.
  const lado = descendo ? aoLongo : atravessado
  const ladoOposto = descendo ? COMPRIMENTO - aoLongo : 1 - atravessado
  const beirada = (passoSuave(BEIRADA, 0, lado) - passoSuave(BEIRADA, 0, ladoOposto)) * LUZ_DA_BEIRADA
  luz += beirada - junta * ESCURO_DA_JUNTA
  return pintar(tom, luz)
}
