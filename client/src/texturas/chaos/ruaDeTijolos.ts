import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * RUA DE TIJOLOS (lote das referências, 15/11/2026: "rua de tijolo vermelho"; cartão próprio): a rua e a calçada de
 * cidade velha da Nova Inglaterra. Tijolos de barro vermelho deitados em espinha de peixe a 90° (um em pé, um
 * deitado, em escada), de 1/3 x 2/3 de casa: cada tijolo de uma queima (uns mais alaranjados, uns mais roxos, um ou
 * outro bem queimado e escuro), o barro manchado e poroso, os cantos gastos e redondos e a borda roída; a beirada de
 * cima à esquerda pega a luz e a de baixo à direita cai na sombra. A junta é de areia cinzenta (a cor dela é que a
 * desenha, não a sombra) e, onde a rua é mais úmida, o tijolo escurece e a junta esverdeia de limo.
 *
 * A espinha: com o tijolo de 1 x 2 larguras, ela repete a cada 4 larguras nas duas direções (a rede (1, 1) e (4, 0)),
 * então 24 larguras (8 casas de 3) dão a volta no ladrilho. A conta do tijolo é a do Taco em espinha (`tacoEspinha.ts`),
 * sem o giro de 45°.
 *
 * Diferente das vizinhas: o Paralelepípedo é granito cinza em fileira reta; o Calçamento é pedra redonda miúda; o
 * Taco em espinha é madeira a 45°. Aqui é barro vermelho, a espinha corre na grade e a junta é larga e clara.
 */

const CASAS = 8
/** Larguras de tijolo por casa: o tijolo tem 1/3 de casa de largura e 2/3 de comprimento. */
const LARGURAS_POR_CASA = 3
const LARGURA = 1 / LARGURAS_POR_CASA
const N = CASAS * LARGURAS_POR_CASA
/** O comprimento do tijolo, em larguras, e um degrau inteiro da espinha (o deitado e o em pé). */
const COMPRIMENTO = 2
const DEGRAU = 2 * COMPRIMENTO
const SEMENTE = 6900

/** A junta, em casas a partir da beira do tijolo (com o canto gasto, a beira é a do retângulo de canto redondo). */
const JUNTA = { fio: 0.008, fim: 0.026 } as const
/** O canto gasto (raio em casas, de um tijolo para outro) e o quanto a borda é roída. */
const CANTO = { menor: 0.015, maior: 0.05 } as const
const ROIDO = 0.008
/** A beirada: a faixa (casas) e quanto clareia do lado da luz e escurece do outro. */
const BEIRADA = { largura: 0.045, luz: 0.06 } as const
/** O tijolo: o quanto foge do tom, o bem queimado, o barro manchado e o poro. */
const VARIACAO = 0.05
const QUEIMADO = { chance: 0.07, luz: -0.16 } as const
const MANCHA = 0.04
const PORO = 0.03
/** A umidade: escurece o tijolo e esverdeia a junta onde a rua é mais úmida. */
const UMIDADE = { luz: -0.08, limo: 0.45 } as const

/** Barro vermelho contido (croma ~0,3, o teto é 0,5): um mais alaranjado, um mais roxo, os outros entre eles. */
const TONS: readonly Rgb[] = [rgb('#8c4f3f'), rgb('#935744'), rgb('#86493a'), rgb('#90553f'), rgb('#83493d'), rgb('#8f5a49')]
const AREIA = rgb('#7d766b')
const LIMO = rgb('#5f6450')

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function voltaInteira(n: number, m: number): number {
  const r = n % m
  return r < 0 ? r + m : r
}

/**
 * A distância (casas) do ponto à beira do retângulo de canto redondo, positiva dentro. `a` ao longo (de 0 a
 * comprimento) e `b` atravessado (de 0 a 1), em larguras; `raio` em casas.
 */
function dentroDoTijolo(a: number, b: number, raio: number): number {
  const meioA = (COMPRIMENTO * LARGURA) / 2
  const meioB = LARGURA / 2
  const qa = Math.abs(a * LARGURA - meioA) - (meioA - raio)
  const qb = Math.abs(b * LARGURA - meioB) - (meioB - raio)
  const fa = Math.max(qa, 0)
  const fb = Math.max(qb, 0)
  return raio - Math.sqrt(fa * fa + fb * fb) - Math.min(Math.max(qa, qb), 0)
}

export function texturaRuaDeTijolos(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const qx = uu * N
  const qy = vv * N
  // O tijolo deitado: a fileira é qy, a escada vem do quanto anda em qx.
  const linha = Math.floor(qy)
  const t = qx - linha
  const escada = Math.floor(t / DEGRAU)
  const resto = t - escada * DEGRAU
  let aoLongo: number
  let atravessado: number
  let numero: number
  if (resto < COMPRIMENTO) {
    aoLongo = resto
    atravessado = qy - linha
    numero = voltaInteira(linha, N) * N + voltaInteira(linha + escada * DEGRAU, N)
  } else {
    // O tijolo em pé: a coluna é qx.
    const coluna = Math.floor(qx)
    const t2 = qy - coluna - 1
    const m = Math.floor(t2 / DEGRAU)
    aoLongo = t2 - m * DEGRAU
    atravessado = qx - coluna
    numero = N * N + voltaInteira(coluna, N) * N + voltaInteira(coluna + 1 + m * DEGRAU, N)
  }

  const raio = CANTO.menor + (CANTO.maior - CANTO.menor) * hash(numero, 5, SEMENTE)
  const roido = (valor(uu * 160, vv * 160, 160, SEMENTE + 1) - 0.5) * 2 * ROIDO
  const borda = dentroDoTijolo(aoLongo, atravessado, raio) + roido
  // As beiras de cima e da esquerda (início do comprimento e da largura, nos dois tijolos) pegam a luz.
  const cima = Math.min(aoLongo, atravessado) * LARGURA
  const baixo = Math.min(COMPRIMENTO - aoLongo, 1 - atravessado) * LARGURA

  let c = TONS[Math.floor(hash(numero, 0, SEMENTE) * TONS.length) % TONS.length]
  let k = (hash(numero, 1, SEMENTE) - 0.5) * 2 * VARIACAO
  if (hash(numero, 2, SEMENTE) < QUEIMADO.chance) k += QUEIMADO.luz
  k += fbm(uu + hash(numero, 3, SEMENTE), vv + hash(numero, 4, SEMENTE), 12, 2, SEMENTE + 2) * MANCHA
  k += (valor(uu * 448, vv * 448, 448, SEMENTE + 3) - 0.5) * PORO
  k += (passoSuave(BEIRADA.largura, 0, cima) - passoSuave(BEIRADA.largura, 0, baixo)) * BEIRADA.luz
  const umido = passoSuave(0.0, 0.7, fbm(uu, vv, 2, 3, SEMENTE + 4))
  k += umido * UMIDADE.luz
  c = luz(c, k)

  const junta = luz(misturar(AREIA, LIMO, umido * UMIDADE.limo), (valor(uu * 224, vv * 224, 224, SEMENTE + 5) - 0.5) * 0.08)
  return empacotar(misturar(c, junta, passoSuave(JUNTA.fim, JUNTA.fio, borda)))
}
