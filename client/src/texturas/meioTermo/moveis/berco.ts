/**
 * BERÇO de balanço de cima com volume (lote 4 dos objetos novos, 11/11/2026):
 * o berço de madeira de quarto de casa, com a cabeça à esquerda. De cima
 * aparecem a CABECEIRA em arco (a tábua alta e grossa, abaulada para fora), a
 * PESEIRA reta entre os dois postes de pinha torneada, as duas GRADES (a
 * travessa fina com as contas das ripas torneadas aparecendo dos dois lados
 * dela) e, lá dentro, o colchão com o LENÇOL claro, o travesseirinho junto da
 * cabeceira, a MANTA dobrada nos pés (a dobra mais clara e duas listras) e o
 * COELHO DE PANO deitado entre os dois. Por baixo, saindo dos dois lados, as
 * pontas dos dois BALANÇOS (os pés em arco): a de cima no escuro e a de baixo
 * na luz, que é como um arco que sobe nas pontas pega a luz.
 *
 * Na 3/4 as alturas saem das sombras (`tresQuartos.ts`: cada sombra com altura
 * é uma estrutura, pintada do norte para o sul; cada peça sobe com a estrutura
 * mais alta que contém o meio da caixa dela):
 * - o COLCHÃO é a coluna do meio, com a frente de pano (a maior peça dela é o
 *   lençol): é o que se vê por entre as ripas;
 * - cada RIPA é uma coluna fina e a TRAVESSA da grade um tampo no ar, na mesma
 *   altura: a conta da ripa fica com a ripa (no empate vale a estrutura mais
 *   justa), e a travessa, pintada depois, cobre o alto delas;
 * - a SAIA (a tábua de baixo da grade) é uma coluna baixa na beira de cada
 *   lado, que chega mais à frente que as ripas: pintada depois delas, esconde
 *   o pé de cada uma, que a 3/4 varreria até o chão;
 * - a cabeceira, a peseira e os postes são colunas; as pontas dos balanços,
 *   quatro colunas baixas (inteiro, o balanço seria pintado por cima do berço).
 *
 * As larguras das madeiras são em casas (o berço esticado ganha comprimento e
 * mais ripas, não ripas mais grossas). Materiais: `madeira` e `manta`; o
 * lençol, o travesseiro e o coelho são fixos.
 */
import { caixa, capsula, dentroDe, elipse, elipseGirada, menos, uniao, type Forma, type Ponto } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type Peca } from './motor'
import { BURACO, LENCOL, QUARTO, type MontarMovel } from './contexto'

/** Alturas em casas: o balanço, a saia, o colchão, a grade, a peseira, os postes dela e a cabeceira. */
const ALTURA_DO_BALANCO = 0.1
const ALTURA_DA_SAIA = 0.17
const ALTURA_DO_COLCHAO = 0.3
const ALTURA_DA_GRADE = 0.62
const ALTURA_DA_PESEIRA = 0.66
const ALTURA_DO_POSTE = 0.72
const ALTURA_DA_CABECEIRA = 0.84

/** Quanto a ponta de cada balanço passa do corpo, de cada lado, e a largura dele, em casas. */
const SOBRA_DO_BALANCO = 0.07
const LARGURA_DO_BALANCO = 0.075
/** Onde fica cada balanço, em fração da largura a partir da ponta do berço: o da cabeça e o dos pés. */
const BALANCO_DA_CABECA = 0.17
const BALANCO_DOS_PES = 0.1
/**
 * O arco do balanço visto de cima: a normal inclina para o meio do berço (as
 * pontas sobem), então a ponta de baixo pega a luz e a de cima fica no escuro.
 */
const FORCA_DO_ARCO_DO_BALANCO = -0.3

/** A cabeceira: a flecha do arco (quanto o meio avança) e a espessura dela nas pontas, em casas. */
const FLECHA_DA_CABECEIRA = 0.085
const ESPESSURA_DA_CABECEIRA = 0.045
/** O arco da cabeceira é um pedaço de elipse: os raios em vezes a flecha e em vezes a meia largura do corpo. */
const RAIO_DO_ARCO_EM_FLECHAS = 2.5
const RAIO_DO_ARCO_EM_MEIOS_CORPOS = 1.25
/** O friso entalhado da cabeceira: quanto fica para dentro da beira do arco e a largura dele (px do protótipo). */
const RECUO_DO_FRISO = 1.4
const LARGURA_DO_FRISO = 0.7
/** A peseira e os postes dela: a espessura da tábua, o raio do poste e o da pinha torneada, em casas. */
const ESPESSURA_DA_PESEIRA = 0.046
const RAIO_DO_POSTE = 0.03
const RAIO_DA_PINHA = 0.039
/** As pinhas das pontas da cabeceira, um pouco menores. */
const RAIO_DA_PINHA_DA_CABECEIRA = 0.034

/** A grade: a largura da travessa, o raio da ripa e o da conta torneada dela, e de quanto em quanto há uma ripa, em casas. */
const LARGURA_DA_TRAVESSA = 0.036
const RAIO_DA_RIPA = 0.018
const RAIO_DA_CONTA = 0.031
const PASSO_DAS_RIPAS = 0.095
/** A primeira e a última ripa ficam a esta distância das pontas da travessa, em casas. */
const RECUO_DAS_RIPAS = 0.1
/** O lábio da saia que aparece de cima, fora da travessa, em casas. */
const LABIO_DA_SAIA = 0.0125
/** Quanto o colchão entra debaixo da travessa (px do protótipo): de cima não sobra chão entre os dois. */
const COLCHAO_SOB_A_TRAVESSA = 1.5

/** O travesseiro: a largura em fração do comprimento do colchão e a meia altura em fração do vão entre as grades. */
const LARGURA_DO_TRAVESSEIRO = 0.18
const MEIA_ALTURA_DO_TRAVESSEIRO = 0.7
/** A manta: onde começa (fração do comprimento do colchão), a largura da dobra e onde ficam as duas listras nela. */
const COMECO_DA_MANTA = 0.52
const DOBRA_DA_MANTA = 0.11
const LISTRAS_DA_MANTA: readonly number[] = [0.62, 0.74]
const MEIA_LISTRA = 0.55

/** O pano do coelho (um rosa queimado, de boneco velho), a barriga de retalho cru e o focinho. */
const PANO_DO_COELHO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0xc2, 0x8b, 0x80] }
const RETALHO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xe0, 0xd2, 0xb6] }
const FOCINHO: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x58, 0x52] }
/** A listra da manta: lã crua. */
const LISTRA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: LENCOL.rgb }
/** O comprimento do coelho deitado, das patas às pontas das orelhas, nas medidas dele (px do protótipo). */
const COMPRIMENTO_DO_COELHO = 13.2
/** O coelho deitado de cabeça para a cabeceira, um pouco de lado (radianos). */
const GIRO_DO_COELHO = Math.PI + 0.62

/**
 * O coelho de pano no meio (cx, cy), `e` vezes o tamanho de partida: as
 * pernas, os braços e as orelhas compridas por baixo, o corpo, a cabeça, o
 * retalho da barriga e a cara (dois olhos de linha e o focinho).
 */
function coelho(L: Peca[], P: CriarPeca, cx: number, cy: number, e: number): void {
  const co = Math.cos(GIRO_DO_COELHO)
  const si = Math.sin(GIRO_DO_COELHO)
  /** Do coelho (a ao longo do corpo, para a cabeça; b de través) para o berço. */
  const em = (a: number, b: number): Ponto => [cx + (a * co - b * si) * e, cy + (a * si + b * co) * e]
  const membro = (a0: number, b0: number, a1: number, b1: number, raio: number): Forma => capsula(...em(a0, b0), ...em(a1, b1), raio * e)
  const pano = (forma: Forma, raio: number, semente: number, tom = 1): Peca =>
    P(forma, PANO_DO_COELHO, { bisel: raio * e * 0.7, ruga: 0.5, contorno: 0.28, tom, semente, projeta: { dist: 0.9 * e, forca: 0.26, suave: 0.7 } })
  for (const lado of [-1, 1]) {
    L.push(pano(membro(-1.6, lado * 1.0, -4.3, lado * 1.7, 0.85), 0.85, 3160 + lado, 0.94))
    L.push(pano(membro(0.9, lado * 1.6, 0.1, lado * 3.3, 0.7), 0.7, 3163 + lado, 0.94))
    L.push(pano(membro(4.4, lado * 0.75, 7.3, lado * 1.55, 0.72), 0.72, 3166 + lado, 0.97))
    L.push(P(membro(5.0, lado * 0.92, 6.9, lado * 1.42, 0.26), RETALHO, { bisel: 0, contorno: 0, tom: 0.94, semente: 3169 + lado }))
  }
  L.push(pano(elipseGirada(...em(0, 0), 2.7 * e, 2.0 * e, GIRO_DO_COELHO), 2.0, 3172))
  L.push(P(elipseGirada(...em(-0.2, 0), 1.35 * e, 1.05 * e, GIRO_DO_COELHO), RETALHO, { bisel: 0.4 * e, contorno: 0.14, semente: 3173 }))
  L.push(pano(elipse(...em(3.3, 0), 1.85 * e, 1.85 * e), 1.85, 3174, 1.04))
  for (const lado of [-1, 1]) L.push(P(elipse(...em(3.75, lado * 0.78), 0.3 * e, 0.3 * e), BURACO, { bisel: 0, contorno: 0 }))
  L.push(P(elipse(...em(4.45, 0), 0.34 * e, 0.3 * e), FOCINHO, { bisel: 0, contorno: 0 }))
}

export const montarBerco: MontarMovel = (c, cena) => {
  const { hw, hh, w, g, peca: P } = c
  const mad = c.m.madeira
  const manta = c.m.manta
  const L = cena.partes
  /** A meia largura do corpo: o que sobra da pegada é a ponta dos balanços. */
  const B = hh - g * SOBRA_DO_BALANCO

  // A CABECEIRA: a fatia entre o arco de fora e a beira reta de dentro, mais grossa no meio.
  const flecha = g * FLECHA_DA_CABECEIRA
  const xCab = -hw + flecha + g * ESPESSURA_DA_CABECEIRA
  const raioDoArco = flecha * RAIO_DO_ARCO_EM_FLECHAS
  const raioDoArcoY = B * RAIO_DO_ARCO_EM_MEIOS_CORPOS
  const cabeceira = dentroDe(elipse(-hw + raioDoArco, 0, raioDoArco, raioDoArcoY), caixa(-hw - 1, -B, xCab, B))
  const corpo = uniao(cabeceira, caixa(xCab - 1, -B, hw, B, 1))
  cena.sombras.push(contato(corpo, 0.3))

  // Os BALANÇOS: só as quatro pontas, fora do corpo (o meio de cada arco fica debaixo dele).
  const zBalanco = g * ALTURA_DO_BALANCO
  const meioBalanco = (g * LARGURA_DO_BALANCO) / 2
  for (const [i, xb] of [-hw + BALANCO_DA_CABECA * w, hw - BALANCO_DOS_PES * w].entries()) {
    for (const lado of [-1, 1]) {
      const [y0, y1] = lado < 0 ? [-hh, -B + 1.2] : [B - 1.2, hh]
      const ponta = caixa(xb - meioBalanco, y0, xb + meioBalanco, y1, meioBalanco * 0.9)
      cena.sombras.push({ forma: ponta, z: zBalanco }, contato(ponta, 0.3))
      L.push(P(ponta, mad, { eixo: QUARTO, tabua: 0, bisel: 1.4, contorno: 0.26, tom: 0.84, curvaY: { c: 0, r: hh * 1.12, forca: FORCA_DO_ARCO_DO_BALANCO }, semente: 3100 + i * 2 + lado }))
    }
  }

  // As medidas da grade: a travessa de cada lado, por dentro do lábio da saia.
  const labio = g * LABIO_DA_SAIA
  const meiaTravessa = (g * LARGURA_DA_TRAVESSA) / 2
  const yGrade = B - labio - meiaTravessa
  const espessuraDaPeseira = g * ESPESSURA_DA_PESEIRA
  const [xTravessa0, xTravessa1] = [xCab - 0.5, hw - 1.2]

  // A SAIA: de cima, só o lábio fora da travessa; na 3/4, a tábua de baixo da grade. A estrutura dela entra debaixo
  // da grade (uma coluna mais rasa que 1 px a varredura da 3/4 pinta em riscos); a peça é só o lábio.
  const zSaia = g * ALTURA_DA_SAIA
  const fundoDaSaia = labio + g * LARGURA_DA_TRAVESSA
  for (const lado of [-1, 1]) {
    const [y0, y1] = lado < 0 ? [-B, -B + labio] : [B - labio, B]
    cena.sombras.push({ forma: caixa(xCab - 0.3, lado < 0 ? -B : B - fundoDaSaia, hw - 0.6, lado < 0 ? -B + fundoDaSaia : B, 0.3), z: zSaia })
    L.push(P(caixa(xCab - 0.3, y0, hw - 0.6, y1, 0.3), mad, { tabua: 0, bisel: 0.4, contorno: 0.2, tom: 0.82, semente: 3110 + lado }))
  }

  // O COLCHÃO com o lençol, da cabeceira à peseira, entrando debaixo das duas travessas.
  const yColchao = yGrade - meiaTravessa + COLCHAO_SOB_A_TRAVESSA
  const xColchao1 = hw - espessuraDaPeseira + 0.4
  const colchao = caixa(xCab - 0.5, -yColchao, xColchao1, yColchao, 1.6)
  cena.sombras.push({ forma: colchao, z: g * ALTURA_DO_COLCHAO })
  L.push(P(colchao, LENCOL, { bisel: 2.2, ruga: 1.3, semente: 3120 }))
  const comprimento = xColchao1 - xCab
  /** O vão livre entre as duas travessas. */
  const meioVao = yGrade - meiaTravessa

  // O travesseirinho, junto da cabeceira.
  const xTravesseiro = xCab + 1.9
  const larguraDoTravesseiro = LARGURA_DO_TRAVESSEIRO * comprimento
  const yTravesseiro = MEIA_ALTURA_DO_TRAVESSEIRO * meioVao
  L.push(P(caixa(xTravesseiro, -yTravesseiro, xTravesseiro + larguraDoTravesseiro, yTravesseiro, 2.8), LENCOL, { tom: 1.05, bisel: 0.28 * larguraDoTravesseiro, ruga: 1.5, contorno: 0.26, semente: 3121, projeta: { dist: 1.4, forca: 0.3, suave: 1.1 } }))

  // A MANTA dobrada nos pés: o corpo dela, as duas listras e a dobra virada para a cabeceira, mais clara.
  const xManta = xCab + COMECO_DA_MANTA * comprimento
  const xFimDaManta = hw - espessuraDaPeseira - 0.2
  const yManta = meioVao - 0.3
  L.push(P(caixa(xManta, -yManta, xFimDaManta, yManta, 1.8), manta, { bisel: 2.2, ruga: 2, eixo: QUARTO, semente: 3130, projeta: { dist: 1.1, forca: 0.28 } }))
  for (const [i, f] of LISTRAS_DA_MANTA.entries()) {
    const x = xManta + f * (xFimDaManta - xManta)
    L.push(P(caixa(x - MEIA_LISTRA, -yManta + 0.5, x + MEIA_LISTRA, yManta - 0.5), LISTRA, { bisel: 0.2, ruga: 2, eixo: QUARTO, contorno: 0.08, tom: 0.96, semente: 3132 + i }))
  }
  const xFimDaDobra = xManta + DOBRA_DA_MANTA * comprimento
  L.push(P(caixa(xManta - 0.5, -yManta - 0.2, xFimDaDobra, yManta + 0.2, 1.6), manta, { tom: 1.14, bisel: 2, ruga: 1, eixo: QUARTO, semente: 3134, projeta: { dist: 1.3, forca: 0.32 } }))

  // O coelho de pano, entre o travesseiro e a dobra da manta: encolhe se o berço for curto.
  const xDepoisDoTravesseiro = xTravesseiro + larguraDoTravesseiro
  const tamanhoDoCoelho = Math.min(g / 56, (xManta - xDepoisDoTravesseiro) / COMPRIMENTO_DO_COELHO, (2 * meioVao) / COMPRIMENTO_DO_COELHO)
  coelho(L, P, (xDepoisDoTravesseiro + xManta) / 2 + 0.6 * tamanhoDoCoelho, 0.09 * meioVao, tamanhoDoCoelho)

  // As GRADES. As ripas vão de duas em duas: em número par, o meio da travessa cai sempre entre duas ripas (a
  // peça da travessa tem de ficar com a estrutura da travessa, e não com a de uma ripa).
  const zGrade = g * ALTURA_DA_GRADE
  const raioDaRipa = g * RAIO_DA_RIPA
  const raioDaConta = g * RAIO_DA_CONTA
  const [xRipa0, xRipa1] = [xTravessa0 + g * RECUO_DAS_RIPAS, xTravessa1 - g * RECUO_DAS_RIPAS]
  const vaos = 2 * Math.max(1, Math.round((xRipa1 - xRipa0) / (g * PASSO_DAS_RIPAS) / 2 - 0.5)) + 1
  for (const lado of [-1, 1]) {
    const y = lado * yGrade
    for (let i = 0; i <= vaos; i += 1) {
      const x = xRipa0 + ((xRipa1 - xRipa0) * i) / vaos
      cena.sombras.push({ forma: elipse(x, y, raioDaRipa, raioDaRipa), z: zGrade })
      L.push(P(elipse(x, y, raioDaConta, raioDaConta), mad, { tabua: 0, bisel: raioDaConta * 0.8, contorno: 0.26, tom: 0.92, semente: 3140 + i }))
    }
  }
  for (const lado of [-1, 1]) {
    const travessa = caixa(xTravessa0, lado * yGrade - meiaTravessa, xTravessa1, lado * yGrade + meiaTravessa, 0.6)
    cena.sombras.push({ forma: travessa, z: zGrade, solta: true })
    L.push(P(travessa, mad, { tabua: 0, bisel: 0.9, contorno: 0.24, tom: 1.06, semente: 3150 + lado, projeta: { dist: 3, forca: 0.26, suave: 1.2 } }))
  }

  // A PESEIRA, entre os dois postes de pinha torneada.
  const raioDaPinha = g * RAIO_DA_PINHA
  const peseira = caixa(hw - espessuraDaPeseira, -B + raioDaPinha, hw, B - raioDaPinha, 0.5)
  cena.sombras.push({ forma: peseira, z: g * ALTURA_DA_PESEIRA })
  L.push(P(peseira, mad, { eixo: QUARTO, tabua: 0, bisel: 1.1, contorno: 0.24, semente: 3180, projeta: { dist: 2.4, forca: 0.26, suave: 1.2 } }))
  for (const lado of [-1, 1]) {
    const [x, y] = [hw - raioDaPinha, lado * (B - raioDaPinha)]
    cena.sombras.push({ forma: elipse(x, y, g * RAIO_DO_POSTE, g * RAIO_DO_POSTE), z: g * ALTURA_DO_POSTE })
    L.push(P(elipse(x, y, raioDaPinha, raioDaPinha), mad, { tabua: 0, bisel: raioDaPinha * 0.9, contorno: 0.26, tom: 1.04, semente: 3182 + lado, projeta: { dist: 1.2, forca: 0.28, suave: 0.8 } }))
  }

  // A CABECEIRA por último: é a mais alta, e faz sombra no travesseiro. As pinhas das pontas sobem com ela.
  cena.sombras.push({ forma: cabeceira, z: g * ALTURA_DA_CABECEIRA })
  L.push(P(cabeceira, mad, { eixo: QUARTO, tabua: 0, bisel: 1.5, contorno: 0.26, tom: 1.03, semente: 3190, projeta: { dist: 3.6, forca: 0.3, suave: 1.6 } }))
  // O friso entalhado, acompanhando o arco por dentro da beira.
  const friso = menos(
    elipse(-hw + raioDoArco, 0, raioDoArco - RECUO_DO_FRISO, raioDoArcoY - RECUO_DO_FRISO),
    elipse(-hw + raioDoArco, 0, raioDoArco - RECUO_DO_FRISO - LARGURA_DO_FRISO, raioDoArcoY - RECUO_DO_FRISO - LARGURA_DO_FRISO),
  )
  L.push(P(dentroDe(friso, caixa(-hw - 1, -B + 2 * RECUO_DO_FRISO, xCab - RECUO_DO_FRISO, B - 2 * RECUO_DO_FRISO)), mad, { eixo: QUARTO, tabua: 0, bisel: 0, contorno: 0, tom: 0.74, semente: 3191 }))
  const raioDaPinhaDaCabeceira = g * RAIO_DA_PINHA_DA_CABECEIRA
  for (const lado of [-1, 1]) {
    L.push(P(elipse(xCab - (g * ESPESSURA_DA_CABECEIRA) / 2, lado * (B - raioDaPinhaDaCabeceira), raioDaPinhaDaCabeceira, raioDaPinhaDaCabeceira), mad, { tabua: 0, bisel: raioDaPinhaDaCabeceira * 0.9, contorno: 0.26, tom: 1.06, semente: 3192 + lado }))
  }
}
