/**
 * MESA DE PÁTIO de cima com volume (lote L10 de 24/11/2026, presídio moderno; objeto novo): a mesa de piquenique do
 * banho de sol, de RIPAS de madeira curtida pelo tempo (um castanho já puxado para o cinza), com os dois BANCOS presos
 * a ela pela mesma armação de aço galvanizado, para ninguém arrastar. De cima aparecem as cinco ripas do tampo e as
 * duas de cada banco, cada uma com o seu tom, os parafusos de cabeça redonda onde as ripas cruzam a armação e, nas
 * frestas, a madeira mais escura do lado das ripas. A travessa de aço passa por baixo das ripas: de cima ela aparece
 * só nas frestas e na ponta, saindo um nada da beira de fora de cada banco. Nas ripas, o que o pátio deixa: a marca
 * redonda de uma caneca e uma contagem riscada a ponta de faca (quatro riscos e um atravessado).
 *
 * NA 3/4 é derivada (`tresQuartos.ts`, beirada padrão): o tampo e os bancos são tampos soltos. A ARMAÇÃO EM A, de
 * lado, cairia numa linha só na tela; ela é desenhada como se vê (`soNaTresQuartos`, sem giro): em cada ponta, as
 * duas pernas inclinadas em X, que saem de baixo da beira do tampo, cruzam logo abaixo dele e chegam ao chão por
 * fora do banco, com a travessa do banco passando por elas logo debaixo do assento. A âncora vem antes do tampo e do
 * banco da frente na ordem de pintura: o tampo cobre o alto das pernas e o banco, o meio delas. Com giro a armação
 * some e a mesa fica com os tampos soltos e a sombra no chão. Nada lê o giro.
 *
 * Sem material escolhido: a madeira curtida e o aço galvanizado são fixos. O pixel escuro demais sobe para a madeira
 * a 50% (`cena.corDoPiso`), e não para a nogueira do motor.
 */
import type { Rgb } from '../../ruido'
import { anel, capsula, caixa, elipse } from './formas'
import type { MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'
import { ESCURO } from './geladeira'
import { soNaTresQuartos, type PecaDaTela } from './apoioDoBanheiroModerno'

/** Alturas em casas: o tampo (0,75 m) e os bancos (0,45 m). */
const ALTURA_DO_TAMPO = 0.5
const ALTURA_DO_BANCO = 0.3
/** A beirada padrão do tampo solto na 3/4 (px): a perna sai de trás dela. */
const BEIRADA = 0.06 * G
/** O tampo: a meia fundura (px) e o recuo das pontas; os bancos: a fundura, o recuo das pontas e a beira de fora (px). */
const MEIO_TAMPO = 11.6
const PONTA_DO_TAMPO = 1.5
const FUNDURA_DO_BANCO = 10
const PONTA_DO_BANCO = 5
const BEIRA_DO_BANCO = 1.2
/** Ripas: quantas no tampo e em cada banco, e a fresta entre elas (px). */
const RIPAS_DO_TAMPO = 5
const RIPAS_DO_BANCO = 2
const FRESTA = 0.45
/** A fresta mostra o lado das ripas: a madeira a 55% do valor (e não o escuro dos riscos nem o chão). */
const TOM_DA_FRESTA = 0.55
/** A armação: a distância das pontas (px), a meia largura da travessa e o quanto ela sai da beira de fora do banco. */
const ARMACAO_DA_PONTA = 13
const MEIA_TRAVESSA = 1.1
const PONTA_DA_TRAVESSA = 1
/** O tom da travessa debaixo das ripas (na sombra delas) e o da ponta, que pega a luz. */
const TOM_DA_TRAVESSA = 0.78
/**
 * A armação em A na 3/4 (px na tela): a meia abertura do X no alto (debaixo do tampo) e no pé, o raio do tubo da
 * perna e o da travessa do banco, e quanto a travessa passa de cada perna.
 */
const X_DA_ARMACAO = { alto: 1.4, pe: 4.6 } as const
const RAIO_DA_PERNA = 0.95
const RAIO_DA_TRAVESSA = 0.8
const SOBRA_DA_TRAVESSA = 1.6
/** A madeira curtida pelo sol (castanho envelhecido, puxado para o cinza) e o aço galvanizado. */
const MADEIRA: MaterialDaPeca = { classe: 'madeira', rgb: [0x94, 0x8a, 0x78] }
const GALVANIZADO: MaterialDaPeca = { classe: 'metal', rgb: [0x92, 0x97, 0x96] }
/** O escuro dos riscos e da marca da caneca: a madeira bem escura, meio transparente. */
const ESCURO_DA_MADEIRA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x3d, 0x30] }
/**
 * O escuro em que o pixel escuro demais é levantado: a madeira a 50% do valor. Com a nogueira (o padrão do motor), o
 * fio de contorno das ripas e o fundo das frestas na 3/4 saíam castanho-avermelhados (saturação ~0,6).
 */
const PISO_DA_MADEIRA: Rgb = [0x4a, 0x45, 0x3c]
/** O tom de cada ripa (curtida em tons diferentes), na ordem. */
const TONS = [1.02, 0.95, 1.05, 0.97, 1.0, 0.93, 1.04] as const

export const montarMesaDePatio: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DA_MADEIRA
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
  const liso = { tabua: 0, bisel: 0, contorno: 0 }

  // As sombras: o tampo e os bancos soltos. A armação não faz estrutura: na 3/4 ela é desenhada (lá embaixo).
  cena.sombras.push({ forma: tampo, z: zTampo, solta: true, suave: 1.6, forca: 0.26 })
  for (const lado of [-1, 1] as const) {
    const [y0, y1] = bancoY(lado)
    cena.sombras.push({ forma: caixa(-hw + PONTA_DO_BANCO, y0, hw - PONTA_DO_BANCO, y1, 1), z: zBanco, solta: true, suave: 1.4, forca: 0.24 })
  }

  // Debaixo das ripas, primeiro: o fundo das frestas (a madeira a 55%) e a TRAVESSA de aço de cada ponta, que de
  // cima só aparece nas frestas e, no banco, na ponta que sai da beira de fora (a peça tem o meio no banco).
  const debaixo = (x0: number, x1: number, y0: number, y1: number, semente: number): void => {
    L.push(P(caixa(x0 + 0.5, y0 + 0.5, x1 - 0.5, y1 - 0.5), MADEIRA, { ...liso, tom: TOM_DA_FRESTA, semente }))
  }
  debaixo(-hw + PONTA_DO_TAMPO, hw - PONTA_DO_TAMPO, -MEIO_TAMPO, MEIO_TAMPO, 9900)
  for (const lado of [-1, 1] as const) {
    const [y0, y1] = bancoY(lado)
    debaixo(-hw + PONTA_DO_BANCO, hw - PONTA_DO_BANCO, y0, y1, lado < 0 ? 9905 : 9906)
  }
  for (const x of xs) {
    L.push(P(caixa(x - MEIA_TRAVESSA, -MEIO_TAMPO + 0.4, x + MEIA_TRAVESSA, MEIO_TAMPO - 0.4, 0.4), GALVANIZADO, { ...aco, tom: TOM_DA_TRAVESSA, semente: 9901 }))
    for (const lado of [-1, 1] as const) {
      const [b0, b1] = bancoY(lado)
      const [t0, t1] = lado < 0 ? [b0 - PONTA_DA_TRAVESSA, b1 - 0.4] : [b0 + 0.4, b1 + PONTA_DA_TRAVESSA]
      L.push(P(caixa(x - MEIA_TRAVESSA, t0, x + MEIA_TRAVESSA, t1, 0.5), GALVANIZADO, { ...aco, tom: 1, semente: 9902 }))
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

  // Só a 3/4 (o chão da frente em hh, para cima negativo): a ARMAÇÃO EM A de cada ponta. As duas pernas em X saem de
  // trás da beirada do tampo, cruzam logo abaixo dele e chegam ao chão por fora do banco da frente; a de trás, na
  // sombra, sai mais escura. A travessa do banco passa pelas duas logo debaixo do assento, com um parafuso em cada
  // perna; no pé, a sapata e a sombra de contato.
  const alto = MEIO_TAMPO - zTampo + BEIRADA - 1.5
  const chao = hh - 0.3
  const yTravessa = hh - BEIRA_DO_BANCO - zBanco + BEIRADA + 1
  const naPerna = (y: number): number => -X_DA_ARMACAO.alto + ((X_DA_ARMACAO.alto + X_DA_ARMACAO.pe) * (y - alto)) / (chao - alto)
  const armacao: PecaDaTela[] = []
  for (const x of xs) {
    const abertura = naPerna(yTravessa)
    const pernas: readonly (readonly [number, number])[] = [[1, 0.78], [-1, 1]]
    for (const [lado, tom] of pernas) {
      armacao.push({ forma: capsula(x - lado * X_DA_ARMACAO.alto, alto, x + lado * X_DA_ARMACAO.pe, chao, RAIO_DA_PERNA), mat: GALVANIZADO, o: { tabua: 0, bisel: RAIO_DA_PERNA, contorno: 0.28, tom, semente: 9960 } })
    }
    armacao.push({ forma: capsula(x - abertura - SOBRA_DA_TRAVESSA, yTravessa, x + abertura + SOBRA_DA_TRAVESSA, yTravessa, RAIO_DA_TRAVESSA), mat: GALVANIZADO, o: { tabua: 0, bisel: RAIO_DA_TRAVESSA, contorno: 0.28, tom: 0.94, semente: 9961 } })
    for (const lado of [-1, 1]) {
      armacao.push({ forma: elipse(x + lado * abertura, yTravessa, 0.55, 0.55), mat: GALVANIZADO, o: { tabua: 0, bisel: 0.4, contorno: 0.3, tom: 1.1, semente: 9962 } })
      const xPe = x + lado * X_DA_ARMACAO.pe
      armacao.push({ forma: elipse(xPe + 0.4, chao + 0.3, 2.2, 0.8), mat: ESCURO, o: { ...liso, alfa: 0.3, suave: 0.8, semente: 9963 } })
      armacao.push({ forma: caixa(xPe - 1.3, chao - 0.7, xPe + 1.3, chao + 0.2, 0.3), mat: GALVANIZADO, o: { tabua: 0, bisel: 0.3, contorno: 0.28, tom: 0.86, semente: 9964 } })
    }
  }
  soNaTresQuartos(P, cena, hw - 0.4, MEIO_TAMPO - 0.6, armacao)
}
