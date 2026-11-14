import { hash, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * PARQUÊ EM CESTA (pedido de 14/11/2026: "texturas novas de madeira"; troca
 * do "convés de navio", que já existe): quadrados de meia casa com três
 * tacos cada, um quadrado deitado e o vizinho em pé, como o trançado de uma
 * cesta, em nogueira média. Os quadrados deitados e os em pé ficam um tico
 * diferentes de tom (a fibra pega a luz de outro jeito) e a junta do quadrado
 * é um pouco mais funda que a de taco com taco. Luz de cima à esquerda: a
 * beirada de cima e a da esquerda de cada taco clareiam.
 */

const CASAS = 8
/** Quadrados por casa e por ladrilho: 16 de lado, número par, então o xadrez deitado/em pé dá a volta certo. */
const QUADRADOS_POR_CASA = 2
const QUADRADOS = CASAS * QUADRADOS_POR_CASA
const TACOS_POR_QUADRADO = 3
const SEMENTE = 1400
/** Ruído de valor sem período: o veio é medido no próprio taco. */
const SEM_PERIODO = 1 << 20

/**
 * A nogueira média: a nogueira dos objetos (`meioTermo/materiais.ts`,
 * #5f4532) um pouco mais clara e com o croma de lá (0,17), para o trançado
 * ter luz bastante para ler na mesa. Matiz 25° (a primeira, a 23°, puxava
 * para o rosado na folha). Cinco tons vizinhos, um por taco.
 */
const TONS: readonly Rgb[] = [rgb('#6b523f'), rgb('#6f5643'), rgb('#674e3c'), rgb('#715845'), rgb('#694f3d')]
/** Os quadrados deitados um pouco mais claros que os em pé: é o que faz o trançado ler de longe sem virar xadrez. */
const TOM_DEITADO = 0.03
const TOM_EM_PE = -0.03
const VARIACAO_DO_TACO = 0.07
const VARIACAO_DO_QUADRADO = 0.04
const JUNTA = 0.13
/** A junta entre quadrados é mais funda que a de taco com taco dentro do quadrado. */
const ESCURO_DA_JUNTA_DO_QUADRADO = 0.17
const ESCURO_DA_JUNTA_DO_TACO = 0.12
const BEIRADA = 0.26
const LUZ_DA_BEIRADA = 0.03
const VEIO = 0.05
const MANCHA = 0.045

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function canal(x: number): number {
  return x <= 0 ? 0 : x >= 255 ? 255 : Math.round(x)
}

/** O tom vezes a luz `k`, em 0xRRGGBB, sem criar array por pixel. */
function pintar(tom: Rgb, k: number): number {
  return (canal(tom[0] * k) << 16) | (canal(tom[1] * k) << 8) | canal(tom[2] * k)
}

/** A cor do parquê em cesta no ponto (u, v) do ladrilho de 8 casas. */
export function texturaParqueCesta(u: number, v: number): number {
  // Meio quadrado de deslocamento: a emenda do ladrilho cai no meio do quadrado, nunca na junta dele.
  const x = naVolta(u) * QUADRADOS + 0.5
  const y = naVolta(v) * QUADRADOS + 0.5
  const i = Math.floor(x) % QUADRADOS
  const j = Math.floor(y) % QUADRADOS
  const fx = x - Math.floor(x)
  const fy = y - Math.floor(y)
  const deitado = ((i + j) & 1) === 0
  // Em larguras de taco: ao longo (0 a 3, de ponta a ponta do quadrado) e atravessado (qual dos três tacos e onde nele).
  const aoLongo = (deitado ? fx : fy) * TACOS_POR_QUADRADO
  const atravessadoNoQuadrado = (deitado ? fy : fx) * TACOS_POR_QUADRADO
  const taco = Math.min(TACOS_POR_QUADRADO - 1, Math.floor(atravessadoNoQuadrado))
  const atravessado = atravessadoNoQuadrado - taco
  const numero = (j * QUADRADOS + i) * TACOS_POR_QUADRADO + taco
  const tom = TONS[Math.floor(hash(numero, 1, SEMENTE) * TONS.length) % TONS.length]
  let luz = 1 + (deitado ? TOM_DEITADO : TOM_EM_PE)
  luz += (hash(numero, 2, SEMENTE) - 0.5) * VARIACAO_DO_TACO + (hash(i, j, SEMENTE + 1) - 0.5) * VARIACAO_DO_QUADRADO
  // O veio da nogueira corre ao longo do taco, fraco, começando num ponto sorteado.
  const id = numero * 4 + SEMENTE
  const desvio = hash(numero, 3, SEMENTE) * 50
  const onda = (valor(aoLongo * 0.6 + desvio, atravessado * 1.2, SEM_PERIODO, id) - 0.5) * 0.6
  const veio = valor(aoLongo * 1.4 + desvio, (atravessado + onda) * 2.3, SEM_PERIODO, id + 1) - 0.5
  const mancha = valor(aoLongo * 0.5 + desvio, atravessado * 0.8, SEM_PERIODO, id + 2) - 0.5
  luz += veio * VEIO + mancha * MANCHA
  // Juntas: a do lado comprido do taco (a de fora é a do quadrado) e a das pontas (sempre a do quadrado).
  const deCima = atravessado
  const deBaixo = 1 - atravessado
  const juntaDeCima = passoSuave(JUNTA, 0, deCima) * (taco === 0 ? ESCURO_DA_JUNTA_DO_QUADRADO : ESCURO_DA_JUNTA_DO_TACO)
  const juntaDeBaixo = passoSuave(JUNTA, 0, deBaixo) * (taco === TACOS_POR_QUADRADO - 1 ? ESCURO_DA_JUNTA_DO_QUADRADO : ESCURO_DA_JUNTA_DO_TACO)
  const juntaDaPonta = passoSuave(JUNTA, 0, Math.min(aoLongo, TACOS_POR_QUADRADO - aoLongo)) * ESCURO_DA_JUNTA_DO_QUADRADO
  const junta = Math.max(juntaDeCima, juntaDeBaixo, juntaDaPonta)
  // A beirada de cima e a da esquerda pegam a luz (o "atravessado 0" e o "ao longo 0" são sempre o lado de cima ou da esquerda).
  const beirada =
    (passoSuave(BEIRADA, 0, deCima) - passoSuave(BEIRADA, 0, deBaixo)) * LUZ_DA_BEIRADA +
    (passoSuave(BEIRADA, 0, aoLongo) - passoSuave(BEIRADA, 0, TACOS_POR_QUADRADO - aoLongo)) * LUZ_DA_BEIRADA * 0.7
  luz += beirada - junta
  return pintar(tom, luz)
}
