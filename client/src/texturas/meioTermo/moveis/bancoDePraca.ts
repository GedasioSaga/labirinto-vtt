/**
 * BANCO DE PRAÇA de cima com volume (lote 1 dos objetos novos, 11/11/2026): o
 * banco de jardim de ripas com as duas pontas de ferro fundido. No fundo (em
 * cima), o ENCOSTO: duas ripas no alto, presas nos dois montantes de ferro, a
 * de baixo um pouco à frente da de cima (o encosto é deitado para trás) e
 * fazendo sombra no assento. Na frente, o ASSENTO de ripas ao comprido, com o
 * vão escuro entre elas e um parafuso em cada ponta. Dos lados, os BRAÇOS de
 * ferro, do montante até o punho redondo da frente, mais largos que o
 * montante.
 *
 * Na 3/4 as alturas saem das sombras: o pé da frente e o montante de cada
 * ponta são colunas (o pé sobe do chão até o braço, o montante até o alto do
 * encosto) e o braço, o assento e as duas ripas do encosto são tampos no ar,
 * com o chão aparecendo por baixo do banco, debaixo dos braços e entre as
 * ripas do encosto. A 25% de zoom sobram as listras do assento entre as duas
 * pontas escuras, com a faixa clara do encosto no fundo. Materiais: `madeira`
 * (as ripas) e `ferragens` (os pés e os braços).
 */
import { hash } from '../../ruido'
import { caixa, elipse, uniao } from './formas'
import { contato } from './motor'
import { BURACO, type MontarMovel } from './contexto'

/** Alturas em casas: o assento, o braço e o alto do encosto. */
const ALTURA_DO_ASSENTO = 0.3
const ALTURA_DO_BRACO = 0.46
const ALTURA_DO_ENCOSTO = 0.68
/** A ripa de baixo do encosto fica esta fração de casa abaixo da de cima. */
const DESCIDA_DA_RIPA_DE_BAIXO = 0.15
/** O encosto visto de cima: a faixa do fundo com as duas ripas, em fração da profundidade. */
const FUNDO_DO_ENCOSTO = 0.23
/**
 * Quanto uma ripa entra debaixo da que está acima dela na vista de cima (px do
 * protótipo): sem isso o chão aparecia num fio claro entre o encosto e o
 * assento, como se o banco fosse vazado ali.
 */
const SOBREPOSTO = 0.2
/** A beira da frente que sobra do assento (o punho do braço passa dele), em fração da profundidade. */
const FRENTE_LIVRE = 0.06
/** Largura do ferro do braço e do pé da frente e a do montante do encosto (px do protótipo): 3 e 2 pixels a 1x. */
const LARGURA_DO_BRACO = 3.8
const LARGURA_DO_MONTANTE = 2.4
/** Quanto o ferro fica para dentro da pegada: o punho, mais largo que o braço, não passa dela. */
const RECUO_DO_FERRO = 0.7
/** O punho redondo da frente do braço, em fração da largura do braço; o pé da frente tem o fundo dele. */
const RAIO_DO_PUNHO = 0.66
/** Uma ripa do assento a cada tanto de profundidade (px do protótipo) e o vão entre duas. */
const PASSO_DA_RIPA = 5.8
const VAO_DAS_RIPAS = 1
/** O banco mais raso que o mestre fizer ainda tem estas ripas. */
const RIPAS_MINIMAS = 3
/** Quanto a ripa do assento entra debaixo do braço de ferro (px do protótipo). */
const RIPA_SOB_O_BRACO = 1.2
/** O vão entre as ripas é a sombra debaixo do banco, e não o chão claro: o escuro da casa, meio transparente. */
const ALFA_DO_VAO = 0.62
/** O parafuso de cada ripa fica a esta distância da ponta dela (px do protótipo). */
const RECUO_DO_PARAFUSO = 4.2
const RAIO_DO_PARAFUSO = 0.7
/** Quanto da diferença de altura vira distância da sombra que a peça de cima faz na de baixo (a regra da cadeira). */
const SOMBRA_POR_ALTURA = 0.3
/** O assento fica um tom abaixo do encosto: o encosto está mais alto, mais perto da luz, e é ele que diz "banco". */
const TOM_DO_ASSENTO = 0.9
const TOM_DO_ENCOSTO = 1.06

export const montarBancoDePraca: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  const mad = c.m.madeira
  const ferro = c.m.ferragens
  const zAssento = g * ALTURA_DO_ASSENTO
  const zBraco = g * ALTURA_DO_BRACO
  const zEncosto = g * ALTURA_DO_ENCOSTO
  const zRipaDeBaixo = zEncosto - g * DESCIDA_DA_RIPA_DE_BAIXO
  const yEncosto = -hh + FUNDO_DO_ENCOSTO * h
  /** Onde o ferro do braço começa, do meio para a ponta, e o meio dele. */
  const xBraco = hw - RECUO_DO_FERRO - LARGURA_DO_BRACO
  const xMeioDoFerro = xBraco + LARGURA_DO_BRACO / 2
  const L = cena.partes

  // O assento: as ripas ao comprido, de debaixo do encosto até perto da beira.
  const xRipa = xBraco + RIPA_SOB_O_BRACO
  const y0 = yEncosto - SOBREPOSTO
  const y1 = hh - FRENTE_LIVRE * h
  cena.sombras.push({ forma: caixa(-xRipa, y0, xRipa, y1, 1), z: zAssento, solta: true })
  const ripas = Math.max(RIPAS_MINIMAS, Math.round((y1 - y0) / PASSO_DA_RIPA))
  const alto = (y1 - y0 - (ripas - 1) * VAO_DAS_RIPAS) / ripas
  for (let k = 1; k < ripas; k += 1) {
    const y = y0 + k * (alto + VAO_DAS_RIPAS) - VAO_DAS_RIPAS
    L.push(P(caixa(-xRipa + 0.6, y - 0.3, xRipa - 0.6, y + VAO_DAS_RIPAS + 0.3), BURACO, { bisel: 0, contorno: 0, alfa: ALFA_DO_VAO }))
  }
  for (let k = 0; k < ripas; k += 1) {
    const y = y0 + k * (alto + VAO_DAS_RIPAS)
    // A ripa da frente é a mais boleada: é nela que a perna dobra.
    const daFrente = k === ripas - 1
    L.push(P(caixa(-xRipa, y, xRipa, y + alto, 0.9), mad, { tabua: 0, bisel: daFrente ? 1.9 : 1.2, tom: TOM_DO_ASSENTO + 0.1 * hash(k, 3, 517), semente: 520 + k }))
    for (const x of [-xRipa + RECUO_DO_PARAFUSO, xRipa - RECUO_DO_PARAFUSO]) {
      L.push(P(elipse(x, y + alto / 2, RAIO_DO_PARAFUSO, RAIO_DO_PARAFUSO), ferro, { bisel: 0.6, contorno: 0, metal: 0.22 }))
    }
  }

  // O encosto: duas ripas no alto, entre os montantes; a de baixo, mais à frente, faz sombra no assento.
  const yFundo = -hh + 0.4
  const xEncosto = xMeioDoFerro - LARGURA_DO_MONTANTE / 2 + 0.3
  const altoDaRipa = (yEncosto - yFundo + SOBREPOSTO) / 2
  const deCima = caixa(-xEncosto, yFundo, xEncosto, yFundo + altoDaRipa, 0.8)
  const deBaixo = caixa(-xEncosto, yEncosto - altoDaRipa, xEncosto, yEncosto, 0.8)
  cena.sombras.push({ forma: deCima, z: zEncosto, solta: true }, { forma: deBaixo, z: zRipaDeBaixo, solta: true })
  L.push(P(deBaixo, mad, { tabua: 0, bisel: 1.2, tom: TOM_DO_ENCOSTO - 0.04, semente: 531, projeta: { dist: (zRipaDeBaixo - zAssento) * SOMBRA_POR_ALTURA, forca: 0.36, suave: 1.4 } }))
  L.push(P(deCima, mad, { tabua: 0, bisel: 1.2, tom: TOM_DO_ENCOSTO, semente: 532, projeta: { dist: (zEncosto - zRipaDeBaixo) * SOMBRA_POR_ALTURA, forca: 0.3 } }))

  // As pontas de ferro: o braço, do montante do encosto até o punho redondo, em cima do pé da frente.
  const punho = LARGURA_DO_BRACO * RAIO_DO_PUNHO
  const yFrente = hh - RECUO_DO_FERRO
  for (const lado of [-1, 1]) {
    const xm = lado * xMeioDoFerro
    const montante = caixa(xm - LARGURA_DO_MONTANTE / 2, -hh + 0.3, xm + LARGURA_DO_MONTANTE / 2, yEncosto, 0.8)
    const braco = caixa(xm - LARGURA_DO_BRACO / 2, yEncosto - 0.6, xm + LARGURA_DO_BRACO / 2, yFrente, 1.6)
    const pe = caixa(xm - LARGURA_DO_BRACO / 2, yFrente - 2 * punho, xm + LARGURA_DO_BRACO / 2, yFrente, 1.6)
    // O braço é um tampo no ar entre o montante e o pé: de ponta (o banco girado), a 3/4 mostra as duas pernas
    // e a barra do braço, e não uma chapa cheia. O braço vem antes do pé na lista: com a mesma altura e a mesma
    // base, a 3/4 pinta o pé depois, e o punho (que está no pé) fica por cima do braço.
    cena.sombras.push({ forma: montante, z: zEncosto }, { forma: braco, z: zBraco, solta: true }, { forma: pe, z: zBraco }, contato(uniao(montante, pe), 0.3))
    L.push(P(braco, ferro, { bisel: 1.4, contorno: 0.28, semente: 541 + lado, projeta: { dist: (zBraco - zAssento) * SOMBRA_POR_ALTURA, forca: 0.3, suave: 1.2 } }))
    L.push(P(elipse(xm, yFrente - punho, punho, punho), ferro, { bisel: punho, contorno: 0.26, semente: 544 + lado }))
    L.push(P(montante, ferro, { bisel: 1, contorno: 0.28, semente: 547 + lado }))
  }
}
