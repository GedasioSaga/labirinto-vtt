import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * ESCAMAS (lote das referências, 15/11/2026: "piso cinza com escamas"; cartão Pisos de cerâmica): o ladrilho em
 * escama de peixe da varanda, do hall e do banheiro antigo. Peças cinzentas em escama, de 2/3 de casa de largura,
 * em fileiras desencontradas de meia peça: cada escama tem o fundo redondo e a ponta em cima, onde as duas da fileira
 * de cima se encontram. O vidrado empoça um nada na beira de baixo (a escama tem volume), a beirada pega a luz do lado
 * de cima à esquerda, cada peça num cinza um tico diferente (uma ou outra mais escura, como peça trocada) e o rejunte
 * é fino e escuro.
 *
 * A escama é o disco de raio R (a meia largura) com centro na fileira dela; as fileiras ficam a R uma da outra e a de
 * cima cobre a de baixo: a peça que se vê num ponto é a da fileira mais de cima cujo disco o contém. 12 peças por 24
 * fileiras dão a volta no ladrilho de 8 casas.
 *
 * Diferente das vizinhas: nada no catálogo é curvo e repetido assim; o Basalto é favo de pedra, o Calçamento é pedra
 * redonda solta.
 */

const CASAS = 8
/** O raio da escama (a meia largura), em casas: a peça tem 2/3 de casa de largura. */
const R = 1 / 3
const COLUNAS = Math.round(CASAS / (2 * R))
const FILEIRAS = Math.round(CASAS / R)
const SEMENTE = 6500

/**
 * O desenho desce meia fileira: a emenda de cima do ladrilho cai entre duas linhas de centros, não em cima do fundo
 * redondo das escamas (que ali corre na horizontal e faria a emenda pesar mais que qualquer outra linha).
 */
const DESCE = R / 2
/** O rejunte, em casas a partir da beira da escama. */
const JUNTA = { fio: 0.006, fim: 0.019 } as const
/** A beirada da peça: a faixa (casas) e quanto clareia do lado da luz e escurece do outro. */
const BEIRADA = { largura: 0.04, luz: 0.035 } as const
/** O vidrado que empoça na beira de baixo: a faixa (casas, a partir da beira redonda) e o quanto escurece. */
const POCA = { ate: 0.12, forca: 0.035 } as const
/** O quanto cada peça foge do tom dela, a chance da peça trocada (mais escura) e as nuvens do vidrado. */
const VARIACAO_DA_PECA = 0.035
const TROCADA = { chance: 0.08, luz: -0.07 } as const
const NUVEM = 0.014
const GRAO = 0.012

/** Cinza de ladrilho, um nada quente; a peça trocada sai do mesmo cinza, só mais funda. */
const TONS: readonly Rgb[] = [rgb('#9d9c97'), rgb('#a29f99'), rgb('#999893'), rgb('#a09f9b'), rgb('#9b9893')]
const COR_DA_JUNTA = rgb('#787671')
const JUNTA_SUJA = rgb('#6a6864')

/** A luz vem de cima à esquerda: o vetor (no plano) para o lado dela. */
const PARA_A_LUZ = Math.SQRT1_2

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function voltaInteira(n: number, m: number): number {
  const r = n % m
  return r < 0 ? r + m : r
}

/** O centro da escama mais perto de (x) na fileira `j` (as ímpares andam meia peça). */
function centroNaFileira(x: number, j: number): number {
  const desloca = (j & 1) === 0 ? 0 : R
  return Math.round((x - desloca) / (2 * R)) * 2 * R + desloca
}

export function texturaEscamasCinza(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * CASAS
  const y = vv * CASAS + DESCE
  // A fileira de cima primeiro: a peça que se vê é a da fileira mais de cima que contém o ponto.
  let j = Math.floor(y / R)
  let cx = centroNaFileira(x, j)
  let cy = j * R
  if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > R * R) {
    j += 1
    cx = centroNaFileira(x, j)
    cy = j * R
  }
  const i = Math.round((cx - ((j & 1) === 0 ? 0 : R)) / (2 * R))
  const peca = voltaInteira(j, FILEIRAS) * COLUNAS + voltaInteira(i, COLUNAS)

  // A beira de baixo (redonda, a do próprio disco) e as duas de cima (os discos da fileira de cima).
  const dx = x - cx
  const dy = y - cy
  const r = Math.sqrt(dx * dx + dy * dy) || 1e-9
  const fundo = R - r
  const ex = x - (cx - R)
  const dx2 = x - (cx + R)
  const ey = y - (cy - R)
  const re = Math.sqrt(ex * ex + ey * ey) || 1e-9
  const rd = Math.sqrt(dx2 * dx2 + ey * ey) || 1e-9
  const lado = Math.min(re, rd) - R
  const borda = Math.min(fundo, lado)
  // A normal (para fora da peça) da beira mais perto, e o quanto ela olha para a luz.
  let nx: number
  let ny: number
  if (fundo <= lado) {
    nx = dx / r
    ny = dy / r
  } else if (re < rd) {
    nx = -ex / re
    ny = -ey / re
  } else {
    nx = -dx2 / rd
    ny = -ey / rd
  }
  const olhaALuz = -(nx + ny) * PARA_A_LUZ

  let c = TONS[Math.floor(hash(peca, 0, SEMENTE) * TONS.length) % TONS.length]
  let k = (hash(peca, 1, SEMENTE) - 0.5) * 2 * VARIACAO_DA_PECA
  if (hash(peca, 2, SEMENTE) < TROCADA.chance) k += TROCADA.luz
  k += fbm(uu + hash(peca, 3, SEMENTE), vv + hash(peca, 4, SEMENTE), 8, 3, SEMENTE + 1) * NUVEM
  k += (valor(uu * 384, vv * 384, 384, SEMENTE + 2) - 0.5) * GRAO
  // O vidrado empoçado na beira redonda de baixo, e a beirada que pega a luz (ou cai na sombra).
  k -= passoSuave(POCA.ate, 0, fundo) * POCA.forca
  k += passoSuave(BEIRADA.largura, 0, borda) * olhaALuz * BEIRADA.luz
  c = luz(c, k)

  const sujo = passoSuave(-0.2, 0.7, fbm(uu, vv, 3, 3, SEMENTE + 3))
  return empacotar(misturar(c, misturar(COR_DA_JUNTA, JUNTA_SUJA, sujo), passoSuave(JUNTA.fim, JUNTA.fio, borda)))
}
