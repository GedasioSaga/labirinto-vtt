/**
 * MESA DE PÁTIO de cima com volume (lote L10 de 24/11/2026, presídio moderno; objeto novo): a mesa de piquenique do
 * banho de sol, de RIPAS de madeira curtida pelo tempo, com os dois BANCOS presos a ela pela mesma armação de aço
 * galvanizado, para ninguém arrastar. De cima aparecem as cinco ripas do tampo e as duas de cada banco, cada uma com o
 * seu tom, os parafusos de cabeça redonda onde as ripas cruzam a armação, a travessa de aço no vão entre o tampo e
 * os bancos e o pé da armação despontando por fora de cada banco. Nas ripas, o que o pátio deixa: a marca redonda de
 * uma caneca e uma contagem riscada a ponta de faca (quatro riscos e um atravessado).
 *
 * NA 3/4 é derivada (`tresQuartos.ts`, beirada padrão): o tampo e os bancos são tampos soltos; a travessa no vão é
 * um tampo solto na altura do banco, um nada abaixo das ripas; as pernas da armação são colunas finas, debaixo da
 * beira do tampo e na beira de fora de cada banco (com a peça de cada uma fora das ripas, para a perna ser de aço e
 * não de madeira). A armação em A, de lado, cai numa linha só na tela: as pernas e a travessa fazem o desenho dela.
 * Nada lê o giro.
 *
 * Sem material escolhido: a madeira curtida e o aço galvanizado são fixos.
 */
import { anel, capsula, caixa, elipse } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** Alturas em casas: o tampo (0,75 m) e os bancos (0,45 m). */
const ALTURA_DO_TAMPO = 0.5
const ALTURA_DO_BANCO = 0.3
/** O tampo: a meia fundura (px) e o recuo das pontas; os bancos: a fundura, o recuo das pontas e a beira de fora (px). */
const MEIO_TAMPO = 11.6
const PONTA_DO_TAMPO = 1.5
const FUNDURA_DO_BANCO = 10
const PONTA_DO_BANCO = 5
const BEIRA_DO_BANCO = 1.2
/** Ripas: quantas no tampo e em cada banco, e a fresta entre elas (px). */
const RIPAS_DO_TAMPO = 5
const RIPAS_DO_BANCO = 2
const FRESTA = 0.6
/** A armação: a distância das pontas (px), a meia largura da travessa e das pernas, e quanto a perna desce abaixo do banco. */
const ARMACAO_DA_PONTA = 13
const MEIA_TRAVESSA = 1.4
const MEIA_PERNA = 1.2
const DEBAIXO_DO_BANCO = 3.6
/** A madeira curtida pelo sol (cinza-amarronzada) e o aço galvanizado. */
const MADEIRA: MaterialDaPeca = { classe: 'madeira', rgb: [0x9e, 0x8a, 0x6e] }
const GALVANIZADO: MaterialDaPeca = { classe: 'metal', rgb: [0x92, 0x97, 0x96] }
/** O escuro dos riscos e da marca da caneca: a madeira bem escura, meio transparente. */
const ESCURO_DA_MADEIRA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x3d, 0x30] }
/** O tom de cada ripa (curtida em tons diferentes), na ordem. */
const TONS = [1.02, 0.95, 1.05, 0.97, 1.0, 0.93, 1.04] as const

export const montarMesaDePatio: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const zTampo = g * ALTURA_DO_TAMPO
  const zBanco = g * ALTURA_DO_BANCO
  const tampo = caixa(-hw + PONTA_DO_TAMPO, -MEIO_TAMPO, hw - PONTA_DO_TAMPO, MEIO_TAMPO, 1)
  const bancoY = (lado: -1 | 1): readonly [number, number] => {
    const fora = lado * (hh - BEIRA_DO_BANCO)
    const dentro = fora - lado * FUNDURA_DO_BANCO
    return lado < 0 ? [fora, dentro] : [dentro, fora]
  }
  const xs = [-(hw - ARMACAO_DA_PONTA), hw - ARMACAO_DA_PONTA] as const
  const L = cena.partes
  const aco = { tabua: 0, bisel: 0.6, contorno: 0.28 }

  // As sombras: o tampo e os bancos soltos; as pernas, colunas finas.
  cena.sombras.push({ forma: tampo, z: zTampo, solta: true, suave: 1.6, forca: 0.26 })
  for (const lado of [-1, 1] as const) {
    const [y0, y1] = bancoY(lado)
    cena.sombras.push({ forma: caixa(-hw + PONTA_DO_BANCO, y0, hw - PONTA_DO_BANCO, y1, 1), z: zBanco, solta: true, suave: 1.4, forca: 0.24 })
  }

  // A ARMAÇÃO: em cada vão, a travessa na altura do banco; a perna debaixo da beira do tampo e a perna por fora do
  // banco (de cima, só o pé despontando). Vêm primeiro: as ripas cobrem o resto.
  for (const x of xs) {
    for (const lado of [-1, 1] as const) {
      const [b0, b1] = bancoY(lado)
      const vao0 = lado < 0 ? b1 : MEIO_TAMPO
      const vao1 = lado < 0 ? -MEIO_TAMPO : b0
      const travessa = caixa(x - MEIA_TRAVESSA, vao0, x + MEIA_TRAVESSA, vao1, 0.4)
      cena.sombras.push({ forma: travessa, z: zBanco - 3.4, solta: true, forca: 0.14 })
      L.push(P(travessa, GALVANIZADO, { ...aco, tom: 0.9, semente: 9901 }))
      // A perna debaixo da beira do tampo: a peça dela fica no vão, logo depois da beira (senão subiria com as ripas).
      const yPerna = lado * (MEIO_TAMPO + 0.8)
      const perna = caixa(x - MEIA_PERNA, yPerna - 0.8, x + MEIA_PERNA, yPerna + 0.8, 0.4)
      cena.sombras.push({ forma: perna, z: zTampo - 3.4, forca: 0.12 })
      L.push(P(perna, GALVANIZADO, { ...aco, tom: 1.04, semente: 9902 }))
      // O pé de fora do banco, despontando: a coluna desce do banco ao chão.
      const yPe = lado * (hh - 0.5)
      const pe = caixa(x - MEIA_PERNA, yPe - 1.1, x + MEIA_PERNA, yPe + 1.1, 0.5)
      cena.sombras.push({ forma: pe, z: zBanco - DEBAIXO_DO_BANCO, forca: 0.2 }, contato(pe, 0.32))
      L.push(P(pe, GALVANIZADO, { ...aco, tom: 1.02, semente: 9903 }))
    }
  }

  // As RIPAS, cada uma com o seu tom; nos bancos e no tampo.
  const ripas = (x0: number, x1: number, y0: number, y1: number, n: number, semente: number): void => {
    const largura = (y1 - y0 - FRESTA * (n - 1)) / n
    for (let k = 0; k < n; k += 1) {
      const ya = y0 + k * (largura + FRESTA)
      L.push(P(caixa(x0, ya, x1, ya + largura, 0.7), MADEIRA, { tabua: 0, eixo: 0, bisel: 0.9, contorno: 0.26, tom: TONS[(k + semente) % TONS.length], semente: semente + k, projeta: { dist: 0.5, forca: 0.2 } }))
    }
  }
  for (const lado of [-1, 1] as const) {
    const [y0, y1] = bancoY(lado)
    ripas(-hw + PONTA_DO_BANCO, hw - PONTA_DO_BANCO, y0, y1, RIPAS_DO_BANCO, lado < 0 ? 9910 : 9920)
  }
  ripas(-hw + PONTA_DO_TAMPO, hw - PONTA_DO_TAMPO, -MEIO_TAMPO, MEIO_TAMPO, RIPAS_DO_TAMPO, 9930)

  // Os parafusos de cabeça redonda onde cada ripa cruza a armação.
  const parafuso = (x: number, y: number): void => {
    L.push(P(elipse(x, y, 0.75, 0.75), GALVANIZADO, { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 1.08, semente: 9940 }))
  }
  const passoDoTampo = (2 * MEIO_TAMPO + FRESTA) / RIPAS_DO_TAMPO
  for (const x of xs) {
    for (let k = 0; k < RIPAS_DO_TAMPO; k += 1) parafuso(x, -MEIO_TAMPO + passoDoTampo * (k + 0.5) - FRESTA / 2)
    for (const lado of [-1, 1] as const) {
      const [y0, y1] = bancoY(lado)
      const passo = (y1 - y0 + FRESTA) / RIPAS_DO_BANCO
      for (let k = 0; k < RIPAS_DO_BANCO; k += 1) parafuso(x, y0 + passo * (k + 0.5) - FRESTA / 2)
    }
  }

  // O que o pátio deixa: a marca redonda de uma caneca e a contagem riscada (quatro riscos e um atravessado).
  const risco = { tabua: 0, bisel: 0, contorno: 0, semente: 9950 }
  L.push(P(anel(hw * 0.38, -MEIO_TAMPO * 0.35, 2.6, 2.6, 2.05, 2.05), ESCURO_DA_MADEIRA, { ...risco, alfa: 0.2, suave: 0.5 }))
  const xConta = -hw * 0.3
  const yConta = MEIO_TAMPO * 0.42
  for (let k = 0; k < 4; k += 1) {
    const x = xConta + k * 1.25
    L.push(P(capsula(x, yConta - 1.7, x + 0.15, yConta + 1.7, 0.22), ESCURO_DA_MADEIRA, { ...risco, alfa: 0.42 }))
  }
  L.push(P(capsula(xConta - 0.8, yConta + 1.4, xConta + 4.6, yConta - 1.3, 0.22), ESCURO_DA_MADEIRA, { ...risco, alfa: 0.42 }))
}
