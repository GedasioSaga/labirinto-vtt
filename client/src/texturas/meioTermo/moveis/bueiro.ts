/**
 * BUEIRO de cima (lote L13 dos objetos novos, 14/11/2026, grupo Cidade e
 * vila): a boca de esgoto rente ao chão da rua, por onde a água da chuva
 * desce (e por onde o grupo entra nos esgotos). A MOLDURA de quatro blocos de
 * pedra, com as juntas entre eles, cerca o BURACO escuro; sobre ele, a GRADE
 * de ferro: o caixilho que assenta na moldura, a travessa de baixo e as
 * BARRAS de pé, cada uma fazendo sombra no fundo. Lá embaixo, o brilho da
 * água parada. Por cima, as duas folhas secas presas nas barras, a mancha de
 * umidade onde a água escorre para dentro, a ferrugem no caixilho e o musgo
 * nas juntas.
 *
 * O que diz "bueiro" a 25% de zoom é o quadrado escuro riscado de barras
 * claras dentro da moldura de pedra.
 *
 * É OBJETO DE CHÃO rente: nenhuma sombra com altura, a 3/4 fica igual à vista
 * de cima (não tem como passar em "3/4 difere"). A moldura e a grade
 * acompanham a pegada (esticado, vira a boca comprida de sarjeta, com mais
 * barras, nunca barras mais grossas).
 *
 * Materiais: `pedra` (a moldura) e `grade` (o ferro). O buraco, a água, as
 * folhas, a umidade, a ferrugem e o musgo são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, dentroDe, elipse, elipseGirada, menos, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

// ---------- as medidas ----------

/** A moldura: a beira de fora (fração da meia pegada) e a largura dos blocos (fração do menor meio lado). */
const BEIRA_DE_FORA = 0.95
const LARGURA_DO_BLOCO = 0.25
/** A junta entre dois blocos e o quanto o caixilho da grade entra na pedra (px do protótipo). */
const JUNTA = 0.45
const CAIXILHO = 2.2
/** O passo entre as barras e a meia largura de cada uma (px do protótipo). */
const PASSO_DA_BARRA = 5.6
const MEIA_BARRA = 1.15
/** A sombra que cada barra faz no fundo do buraco (px do protótipo). */
const SOMBRA_DA_BARRA = 2.4

// ---------- os materiais fixos ----------

/** O fundo do buraco: quase preto, um nada frio (o escuro de dentro da terra, não o da madeira). */
const BURACO_FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x2a, 0x2b, 0x2a] }
/**
 * O escuro em que o pixel escuro demais é levantado: cinza-escuro neutro. Com a nogueira de sempre, o fundo do
 * buraco saía marrom-avermelhado e o bueiro lia como uma caixa de madeira.
 */
const ESCURO_DO_BURACO: Rgb = [0x3e, 0x40, 0x40]
/** A água parada lá embaixo: o escuro puxado para o verde-cinza. */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x40, 0x3d] }
/** O reflexo do céu na água. */
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x98, 0x93] }
/** A mancha de umidade na pedra e a ferrugem do caixilho. */
const UMIDADE: MaterialDaPeca = { classe: 'liso', rgb: [0x3b, 0x35, 0x2e] }
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x58, 0x3c] }
/** As folhas secas presas na grade e o musgo nas juntas. */
const FOLHA_SECA: MaterialDaPeca = { classe: 'folha', rgb: [0x9a, 0x6a, 0x3a] }
const MUSGO: MaterialDaPeca = { classe: 'folha', rgb: [0x5a, 0x6b, 0x42] }

/** As folhas secas: o meio (frações da meia boca), o comprido (fração do menor meio lado) e o ângulo. */
const FOLHAS: readonly (readonly [number, number, number, number])[] = [
  [-0.45, 0.3, 0.2, 0.7],
  [0.38, -0.5, 0.16, -0.4],
]

export const montarBueiro: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const pedra = c.m.pedra
  const grade = c.m.grade
  const L = cena.partes
  const ox = BEIRA_DE_FORA * hw
  const oy = BEIRA_DE_FORA * hh
  const t = LARGURA_DO_BLOCO * R
  // A boca: o vão de dentro da moldura.
  const bx = ox - t
  const by = oy - t
  const moldura = caixa(-ox, -oy, ox, oy, 1.2)
  cena.sombras.push(contato(moldura, 0.18))
  cena.corDoPiso = ESCURO_DO_BURACO

  // ---------- a moldura: quatro blocos com as juntas, o de cima e o de baixo inteiros ----------
  const blocos: readonly Forma[] = [
    caixa(-ox, -oy, ox, -by - JUNTA, 1),
    caixa(-ox, by + JUNTA, ox, oy, 1),
    caixa(-ox, -by + JUNTA, -bx - JUNTA, by - JUNTA, 1),
    caixa(bx + JUNTA, -by + JUNTA, ox, by - JUNTA, 1),
  ]
  blocos.forEach((bloco, k) => L.push(P(bloco, pedra, { tabua: 0, bisel: 1.6, tom: 0.94 + hash(k, 7, 7301) * 0.12, contorno: 0.26, semente: 7310 + k })))
  // O musgo nas quatro quinas das juntas, onde a água para.
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const mx = sx * (bx + t * 0.5)
    const my = sy * by
    L.push(P(dentroDe(elipse(mx, my, t * 0.34, 1.3), moldura), MUSGO, { bisel: 0.5, contorno: 0.06, tom: 0.9 + hash(sx, sy, 7302) * 0.2, semente: 7320 + sx + sy * 2 }))
  }
  // A umidade escorrendo para dentro pela pedra de baixo (a rua desce para a boca).
  L.push(P(dentroDe(elipse(0, by + t * 0.35, bx * 0.8, t * 0.55), blocos[1]), UMIDADE, { bisel: 0, contorno: 0, alfa: 0.32, suave: 2.2, semente: 7330 }))

  // ---------- o buraco e a água lá embaixo ----------
  const boca = caixa(-bx, -by, bx, by, 0.6)
  L.push(P(boca, BURACO_FUNDO, { bisel: 0, contorno: 0.2, recesso: { k: 3.4, forca: 0.55 }, semente: 7340 }))
  const agua = dentroDe(elipse(bx * 0.15, by * 0.3, bx * 0.8, by * 0.55), boca)
  L.push(P(agua, AGUA, { bisel: 0, contorno: 0, alfa: 0.85, suave: 1.6, semente: 7341 }))
  L.push(P(dentroDe(elipseGirada(bx * 0.35, by * 0.42, bx * 0.3, 0.9, -0.12), boca), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.8, semente: 7342 }))

  // ---------- a grade: a travessa por baixo, as barras de pé e o caixilho ----------
  L.push(P(caixa(-bx, -MEIA_BARRA * 0.9, bx, MEIA_BARRA * 0.9, 0.5), grade, { tabua: 0, bisel: 0.9, tom: 0.78, contorno: 0.3, semente: 7350, projeta: { dist: SOMBRA_DA_BARRA, forca: 0.5, suave: 0.8 } }))
  const barras = Math.max(2, Math.round((bx * 2) / PASSO_DA_BARRA) - 1)
  const passo = (bx * 2) / (barras + 1)
  for (let i = 1; i <= barras; i += 1) {
    const x = -bx + i * passo
    L.push(P(caixa(x - MEIA_BARRA, -by, x + MEIA_BARRA, by, 0.5), grade, { eixo: Math.PI / 2, tabua: 0, bisel: MEIA_BARRA, tom: 1.02, contorno: 0.3, semente: 7360 + i, projeta: { dist: SOMBRA_DA_BARRA, forca: 0.55, suave: 0.8 } }))
  }
  const caixilho = menos(caixa(-bx - CAIXILHO, -by - CAIXILHO, bx + CAIXILHO, by + CAIXILHO, 1), caixa(-bx + 0.6, -by + 0.6, bx - 0.6, by - 0.6))
  L.push(P(caixilho, grade, { tabua: 0, bisel: 1, tom: 0.92, contorno: 0.3, semente: 7370, projeta: { dist: 1.6, forca: 0.45, suave: 0.8 } }))
  // A ferrugem no caixilho, mais no canto de baixo, onde a água passa.
  L.push(P(dentroDe(elipse(-bx * 0.4, by + CAIXILHO * 0.4, bx * 0.45, CAIXILHO * 1.2), caixilho), FERRUGEM, { bisel: 0, contorno: 0, alfa: 0.5, suave: 1.2, semente: 7371 }))
  L.push(P(dentroDe(elipse(bx + CAIXILHO * 0.3, -by * 0.3, CAIXILHO * 1.1, by * 0.35), caixilho), FERRUGEM, { bisel: 0, contorno: 0, alfa: 0.4, suave: 1.2, semente: 7372 }))

  // ---------- as folhas secas presas nas barras ----------
  FOLHAS.forEach(([fx, fy, comp, ang], k) => {
    const meio = comp * R
    const folha = elipseGirada(fx * bx, fy * by, meio, meio * 0.42, ang)
    L.push(P(folha, FOLHA_SECA, { bisel: 0.8, contorno: 0.26, tom: 0.95 + k * 0.1, semente: 7380 + k, projeta: { dist: 1.2, forca: 0.4, suave: 0.6 } }))
  })
}
