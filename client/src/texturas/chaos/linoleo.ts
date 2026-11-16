import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor } from '../ruido'

/**
 * LINÓLEO VERDE (lote das referências, 15/11/2026: "linóleo verde manchado"; cartão próprio): o chão de hospital,
 * de repartição e de escola dos anos 1920. Linóleo verde-sálvia marmorizado, em folhas de rolo de quatro casas de
 * largura: a massa é MANCHADA, nuvens tortas de verde mais claro e mais fundo, de um palmo a uma casa, um nada
 * esticadas ao longo do rolo (a calandra puxou a massa), passando de uma para a outra sem beira; no meio delas, o
 * pontilhado miúdo e claro da cortiça. Cada folha foi cortada de um ponto diferente do rolo (a mancha não continua de
 * uma para a outra) e de uma fornada um nada diferente; a emenda entre elas é um fio fino e escuro, quase sumido. Por
 * cima, o uso: o caminho gasto mais claro e apagado, e manchas largas de cera velha e de sujeira, mais fundas e um
 * tico amareladas.
 *
 * Diferente das vizinhas: o Piso de borracha é placa preta de bolinhas; o Concreto é placa cinza com junta; o
 * Azulejo verde é peça com rejunte. Aqui é folha lisa, sem peça nem grade, e o desenho é a mancha.
 */

const CASAS = 8
/**
 * A largura da folha do rolo, em casas: duas folhas por ladrilho, as emendas correm na horizontal a 2 e a 6 casas da
 * beira (a emenda do ladrilho cai no meio de uma folha). Folha larga: a emenda é rara e não vira listra.
 */
const FOLHA = 4
const FOLHAS = CASAS / FOLHA
const DESLOCA = 2
const SEMENTE = 6800

/**
 * As manchas da massa: o ruído (células por ladrilho na primeira oitava, oitavas, ganho), quantas vezes mais apertado
 * na vertical (inteiro: segue repetindo), a torção e o contraste (o quanto o ruído anda do fundo para o claro).
 */
const MANCHA = { celulas: 6, oitavas: 4, ganho: 0.6, estica: 2, torce: 0.06, contraste: 0.75 } as const
/** O pontilhado da cortiça: células por ladrilho, o limiar (poucos pontos) e o quanto clareiam. */
const PONTILHADO = { celulas: 288, limiar: 0.86, luz: 0.06 } as const
/** O grão fino da massa. */
const GRAO = 0.01
/** A emenda: a meia largura do fio e do halo (casas) e quanto escurece. */
const EMENDA = { fio: 0.003, halo: 0.01, forca: 0.07 } as const
/** O quanto cada folha foge do tom (fornada). */
const FORNADA = 0.02
/** O uso: o caminho gasto (clareia e apaga) e as manchas de cera velha e de sujeira (escurecem e amarelam um nada). */
const GASTO = { luz: 0.035, apaga: 0.16 } as const
const SUJEIRA = { luz: -0.04, amarela: 0.25 } as const

const FUNDO_ESCURO = rgb('#5c7960')
const FUNDO_CLARO = rgb('#82a085')
/** O amarelado da cera velha. */
const CERA = rgb('#7a7f62')

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function voltaInteira(n: number, m: number): number {
  const r = n % m
  return r < 0 ? r + m : r
}

export function texturaLinoleoVerde(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const y = vv * CASAS + DESLOCA
  const fy = Math.floor(y / FOLHA)
  const folha = voltaInteira(fy, FOLHAS)
  // Cada folha é um pedaço diferente do rolo: a mancha dela é a do ladrilho deslocado (segue a volta).
  const pu = uu + hash(folha, 0, SEMENTE)
  const pv = vv + hash(folha, 1, SEMENTE)

  // As manchas: o ruído torcido e um nada esticado na horizontal, do fundo ao claro sem beira.
  const tx = fbm(pu, pv, 2, 3, SEMENTE + 1) * MANCHA.torce
  const ty = fbm(pu, pv, 2, 3, SEMENTE + 2) * MANCHA.torce
  const n = fbm(naVolta(pu + tx), naVolta((pv + ty) * MANCHA.estica), MANCHA.celulas, MANCHA.oitavas, SEMENTE + 3, MANCHA.ganho)
  let c = misturar(FUNDO_ESCURO, FUNDO_CLARO, 0.5 + n * MANCHA.contraste)

  let k = (hash(folha, 2, SEMENTE) - 0.5) * 2 * FORNADA
  k += (valor(uu * 320, vv * 320, 320, SEMENTE + 4) - 0.5) * GRAO
  k += passoSuave(PONTILHADO.limiar, PONTILHADO.limiar + 0.05, valor(uu * PONTILHADO.celulas, vv * PONTILHADO.celulas, PONTILHADO.celulas, SEMENTE + 5)) * PONTILHADO.luz
  const gasto = passoSuave(0.2, 0.8, fbm(uu, vv, 2, 3, SEMENTE + 6))
  k += gasto * GASTO.luz
  // A sujeira é larga e mansa (sem mancha que vire marco quando o ladrilho se repete).
  const sujeira = passoSuave(0.1, 0.7, fbm(uu, vv, 4, 3, SEMENTE + 7))
  k += sujeira * SUJEIRA.luz
  // A emenda: um fio escuro, quase sumido.
  const ly = y - fy * FOLHA
  k -= passoSuave(EMENDA.halo, EMENDA.fio, Math.min(ly, FOLHA - ly)) * EMENDA.forca
  c = luz(c, k)
  const cinza = (c[0] + c[1] + c[2]) / 3
  c = misturar(c, [cinza, cinza, cinza], gasto * GASTO.apaga)
  return empacotar(misturar(c, CERA, sujeira * SUJEIRA.amarela))
}
