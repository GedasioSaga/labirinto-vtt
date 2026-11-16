import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * LOSANGOS (lote das referências, 15/11/2026: "mosaico em losangos bege/marrom com borda (e a forma amarela)";
 * cartão Pisos de cerâmica): o chão de saguão, de hotel e de casa de bem dos anos 1920. Ladrilhos em losango de uma
 * casa de diagonal, em xadrez girado: o losango do meio da casa num tom claro, o do canto da casa num tom fundo
 * (os vértices caem no meio dos lados da casa, então a grade do mapa passa pelos cantos dos losangos e a peça nunca
 * sai cortada ao meio no pincel). Cada peça tem a borda: um filete fino e escuro que contorna o losango, como o
 * rejunte de cor do mosaico. A peça é de cimento queimado com granilha: o grão miúdo de pedra aparece de perto, o
 * caminho de quem passa gastou o polido em manchas largas (a peça fica um nada mais clara e mais apagada) e a sujeira
 * escurece o filete numa parte do chão.
 *
 * Contido de propósito: os dois tons ficam a ~0,13 de luz um do outro (no xadrez, metade do chão é de cada um e a
 * régua de desvio da luz é 0,09) e a diferença se lê mais pela cor (bege contra marrom) que pela luz.
 *
 * Diferente das vizinhas: o Chão de metal xadrez e as Lajotas são grade reta; aqui tudo corre a 45°, e o filete
 * contorna cada peça. A borda da SALA (a faixa em volta do mosaico) é a Moldura entalhada do cartão Pisos de pedra.
 */

const CASAS = 8
/** Uma volta do ladrilho, em meias casas: o número de cada losango é o centro dele em meias casas, na volta. */
const MEIAS = 2 * CASAS

/** O filete, em casas a partir da beira do losango: até o `fio`, a cor dele; no `fim`, a peça. */
const FILETE = { fio: 0.008, fim: 0.024 } as const
/** A beirada da peça: a faixa (casas) e quanto clareia do lado da luz e escurece do outro. */
const BEIRADA = { largura: 0.05, luz: 0.03 } as const
/** O quanto cada peça foge do tom dela, e as nuvens do cimento. */
const VARIACAO_DA_PECA = 0.03
const NUVEM = 0.018
/** A granilha: pedrinhas miúdas mais claras e mais escuras, poucas e fracas. */
const GRANILHA = { celulas: 192, limiar: 0.8, luz: 0.045 } as const
/** O gasto do caminho: quanto a peça clareia e perde de cor onde mais se passa. */
const GASTO = { luz: 0.03, apaga: 0.14 } as const

export interface TomDosLosangos {
  /** O losango do meio da casa e o do canto da casa. */
  readonly claro: Rgb
  readonly fundo: Rgb
  /** O filete que contorna cada peça, limpo e sujo. */
  readonly filete: Rgb
  readonly fileteSujo: Rgb
  readonly semente: number
}

/** Bege de areia e marrom de café com leite: o par clássico do saguão. */
const BEGE: TomDosLosangos = {
  claro: rgb('#b8a487'),
  fundo: rgb('#9f8064'),
  filete: rgb('#745e4b'),
  fileteSujo: rgb('#655243'),
  semente: 6300,
}

/** A forma amarela: palha clara e mostarda, com o filete de ocre fundo; amarelo de cimento, nunca de limão. */
const AMARELO: TomDosLosangos = {
  claro: rgb('#c3ad78'),
  fundo: rgb('#a99059'),
  filete: rgb('#7b6843'),
  fileteSujo: rgb('#6a5a3b'),
  semente: 6400,
}

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function voltaInteira(n: number, m: number): number {
  const r = n % m
  return r < 0 ? r + m : r
}

const RAIZ_DE_METADE = Math.SQRT1_2

function losangosNoTom(tom: TomDosLosangos): (u: number, v: number) => number {
  const s = tom.semente
  return (u, v) => {
    const uu = naVolta(u)
    const vv = naVolta(v)
    const x = uu * CASAS
    const y = vv * CASAS
    // Girado 45°: as beiras dos losangos são x + y = n + 1/2 e x - y = m + 1/2.
    const a = x + y - 0.5
    const b = x - y - 0.5
    const fa = Math.floor(a)
    const fb = Math.floor(b)
    const la = a - fa
    const lb = b - fb
    // Ímpar: o losango do meio da casa; par: o do canto.
    const doMeio = ((fa + fb) & 1) !== 0
    const peca = voltaInteira(fa - fb, MEIAS) * MEIAS + voltaInteira(fa + fb + 2, MEIAS)
    // A distância (casas) às quatro beiras. A beira a0 olha para cima à esquerda (pega a luz), a a1 para baixo à
    // direita (sombra); as de b ficam de lado para a luz.
    const a0 = la * RAIZ_DE_METADE
    const a1 = (1 - la) * RAIZ_DE_METADE
    const borda = Math.min(a0, a1, Math.min(lb, 1 - lb) * RAIZ_DE_METADE)

    let c = doMeio ? tom.claro : tom.fundo
    const ou = hash(peca, 1, s)
    const ov = hash(peca, 2, s)
    let k = (hash(peca, 0, s) - 0.5) * 2 * VARIACAO_DA_PECA
    k += fbm(uu + ou, vv + ov, 8, 3, s + 1) * NUVEM
    // A granilha: só as células que passam do limiar viram pedrinha, clara ou escura.
    const g = valor(uu * GRANILHA.celulas, vv * GRANILHA.celulas, GRANILHA.celulas, s + 2)
    const pedrinha = passoSuave(GRANILHA.limiar, GRANILHA.limiar + 0.06, g)
    k += pedrinha * GRANILHA.luz * (hash(Math.floor(uu * GRANILHA.celulas), Math.floor(vv * GRANILHA.celulas), s + 3) < 0.5 ? 1 : -1)
    k += (passoSuave(BEIRADA.largura, 0, a0) - passoSuave(BEIRADA.largura, 0, a1)) * BEIRADA.luz
    // O caminho gasto: clareia e apaga a cor, nos dois tons.
    const gasto = passoSuave(0.15, 0.75, fbm(uu, vv, 2, 3, s + 4))
    k += gasto * GASTO.luz
    c = luz(c, k)
    const cinza = (c[0] + c[1] + c[2]) / 3
    c = misturar(c, [cinza, cinza, cinza], gasto * GASTO.apaga)

    const sujo = passoSuave(-0.2, 0.7, fbm(uu, vv, 3, 3, s + 5))
    return empacotar(misturar(c, misturar(tom.filete, tom.fileteSujo, sujo), passoSuave(FILETE.fim, FILETE.fio, borda)))
  }
}

/** Losangos bege: bege e marrom. */
export const texturaLosangosBege = losangosNoTom(BEGE)
/** Losangos amarelos: a forma amarela. */
export const texturaLosangosAmarelos = losangosNoTom(AMARELO)
