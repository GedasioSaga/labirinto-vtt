/**
 * POLEIRO DE FALCÃO de cima com volume (lote L02 de 14/11/2026, o castelo): o
 * poleiro em T da falcoaria. No chão, os PÉS em X, quatro braços saindo do
 * poste; no alto, a TRAVE com as pontas torneadas e a corda enrolada dos dois
 * lados da ave. Na trave, o FALCÃO de capuz, virado para baixo na tela: as
 * asas fechadas cinza-ardósia e pontudas, com as penas barradas, cruzando as
 * pontas por cima da cauda comprida (listrada, com a faixa escura e a ponta
 * clara), o peito claro estufado dos dois lados da cabeça, o CAPUZ de couro
 * com o penacho e a ponta do bico saindo dele. Das pernas descem as piós de
 * couro e a trela, amarrada na trave; no chão, uma pena caída.
 *
 * O que lê a 25% de zoom é a ave cinza com a cabeça marrom no meio da trave
 * clara, e o X dos pés. Na 3/4 as alturas saem das sombras: os pés são
 * colunas baixas, o poste uma coluna até a trave, e a trave e a ave são
 * tampos no ar (a ave quase na altura da trave, para não flutuar: a 3/4 sobe a
 * peça até a estrutura mais alta que contém o meio dela). O desenho é feito na
 * casa de 56 px e encolhe com a pegada. Material: `madeira`; a ave, o couro e
 * a corda são fixos.
 */
import { anel, barra, capsula, caixa, dentroDe, elipse, elipseGirada, poligono, uniao, type Forma } from './formas'
import { contato, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** O lado em que o poleiro é desenhado (px do protótipo): uma casa. */
const CASA = 56
/** Alturas em casas: os pés, a trave (no peito de quem cuida da ave) e a ave sobre ela. */
const ALTURA_DOS_PES = 0.07
const ALTURA_DA_TRAVE = 0.78
const ALTURA_DA_AVE = 0.85
/** Os pés em X: o alcance de cada ponta (na diagonal) e a largura da tábua. */
const ALCANCE_DO_PE = 20.5
const LARGURA_DO_PE = 5.2
/** A trave: meio comprimento e meia grossura; o poste: o raio. */
const MEIA_TRAVE = 22.5
const MEIA_GROSSURA_DA_TRAVE = 2.6
const RAIO_DO_POSTE = 3.4

/** As penas: o dorso ardósia, a asa um pouco mais escura, o peito creme e o bico de chifre. */
const DORSO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('ardosia', 1.16)) }
const ASA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('ardosia', 1.02)) }
const PEITO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('linho', 1.0)) }
const BICO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('palha', 0.82)) }
/** O couro do capuz (escuro) e o das piós e da trela (claro, curtido). */
const CAPUZ: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('madeiraEscura', 0.92)) }
const COURO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('madeira', 0.94)) }
const PENACHO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('vinho', 1.08)) }
const LATAO: MaterialDaPeca = materialDaPeca('latao')
const CORDA: MaterialDaPeca = materialDaPeca('corda')
/** A pena caída no chão: o cinza claro do peito com a haste. */
const PENA_SOLTA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('pedra', 0.92)) }

/** Período das barras das penas ao longo da asa e da cauda (px do protótipo). */
const PERIODO_DAS_BARRAS = 2.8

/** As penas barradas: faixas escuras de través a cada `PERIODO_DAS_BARRAS` e a franja clara na beira. */
function texDasPenas(forca: number): Textura {
  return (u, _v, _x, _y, _p, s) => {
    const f = u / PERIODO_DAS_BARRAS - Math.floor(u / PERIODO_DAS_BARRAS)
    if (f < 0.32) s[3] -= forca * (1 - Math.abs(f - 0.16) / 0.16)
  }
}

export const montarPoleiroDeFalcao: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const mad = c.m.madeira
  const e = Math.min(c.w, c.h) / CASA
  /** A forma desenhada na casa de 56 px, no tamanho da pegada. */
  const naPegada = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const L = cena.partes
  const zPes = c.g * ALTURA_DOS_PES
  const zTrave = c.g * ALTURA_DA_TRAVE
  const zAve = c.g * ALTURA_DA_AVE

  // A pena caída no chão, perto de um pé (por baixo de tudo).
  cena.sombras.push(contato(naPegada(elipseGirada(-15.5, 17, 4.2, 1.2, -0.5)), 0.18))
  L.push(P(naPegada(elipseGirada(-15.5, 17, 4.2, 1.3, -0.5)), PENA_SOLTA, { bisel: 0.6, contorno: 0.22, eixo: -0.5, textura: texDasPenas(0.06), semente: 7000 }))
  L.push(P(naPegada(capsula(-19.6, 19.3, -11.6, 14.8, 0.3)), CAPUZ, { bisel: 0.2, contorno: 0, tom: 1.1, semente: 7001 }))

  // Os pés em X, em quatro braços que saem do poste: com a tábua inteira, o meio dela caía debaixo da ave e
  // a 3/4 subia o X até a altura da trave.
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const pe = barra(sx * 2.4, sy * 2.4, sx * ALCANCE_DO_PE, sy * ALCANCE_DO_PE, LARGURA_DO_PE)
    cena.sombras.push({ forma: naPegada(pe), z: zPes }, contato(naPegada(pe), 0.3))
    L.push(P(naPegada(pe), mad, { eixo: Math.atan2(sy, sx), tabua: 0, bisel: 1.1, tom: sx === sy ? 0.78 : 0.86, contorno: 0.26, semente: 7010 + sx + sy * 3, projeta: { dist: 0.6, forca: 0.24 } }))
  }

  // O poste, do meio do X até a trave (de cima, só a 3/4 o mostra).
  const poste = elipse(0, 0, RAIO_DO_POSTE, RAIO_DO_POSTE)
  cena.sombras.push({ forma: naPegada(poste), z: zTrave, suave: 1, forca: 0.3 })
  L.push(P(naPegada(poste), mad, { tabua: 0, bisel: RAIO_DO_POSTE, tom: 0.9, contorno: 0.24, semente: 7014 }))

  // A trave com as pontas torneadas e a corda enrolada dos dois lados da ave.
  const trave = caixa(-MEIA_TRAVE + 2, -MEIA_GROSSURA_DA_TRAVE, MEIA_TRAVE - 2, MEIA_GROSSURA_DA_TRAVE, MEIA_GROSSURA_DA_TRAVE)
  const pontas = uniao(elipse(-MEIA_TRAVE + 2.6, 0, 3.4, 3.4), elipse(MEIA_TRAVE - 2.6, 0, 3.4, 3.4))
  cena.sombras.push({ forma: naPegada(uniao(trave, pontas)), z: zTrave, solta: true, forca: 0.26 })
  L.push(P(naPegada(trave), mad, { tabua: 0, bisel: MEIA_GROSSURA_DA_TRAVE, tom: 1.08, contorno: 0.24, semente: 7020, projeta: { dist: 0.8, forca: 0.26 } }))
  for (const lado of [-1, 1]) {
    L.push(P(naPegada(elipse(lado * (MEIA_TRAVE - 2.6), 0, 3.4, 3.4)), mad, { tabua: 0, bisel: 2.6, tom: 1.02, contorno: 0.26, semente: 7021 + lado }))
    L.push(P(naPegada(elipse(lado * (MEIA_TRAVE - 2.6), 0, 1.3, 1.3)), mad, { tabua: 0, bisel: 1, tom: 1.2, contorno: 0.1, semente: 7024 + lado }))
    for (let i = 0; i < 4; i += 1) {
      const x = lado * (9.2 + i * 1.5)
      L.push(P(naPegada(capsula(x - 0.35, -MEIA_GROSSURA_DA_TRAVE - 0.3, x + 0.35, MEIA_GROSSURA_DA_TRAVE + 0.3, 0.75)), CORDA, { eixo: Math.PI / 2, bisel: 0.7, contorno: 0.2, tom: 0.96 + (i % 2) * 0.06, semente: 7030 + i + lado * 5 }))
    }
  }

  // A ave inteira é um tampo no ar, um pouco acima da trave: a sombra dela vai com a da trave.
  const contornoDaAve = uniao(elipse(0, 0, 8.4, 9), uniao(elipse(0, 8.6, 6.8, 5.4), poligono([[-4, -8], [4, -8], [4.4, -23], [-4.4, -23]])))
  cena.sombras.push({ forma: naPegada(contornoDaAve), z: zAve, solta: true, forca: 0.3, suave: 1.6 })

  // A cauda comprida e estreita, caindo para trás da trave: listrada, com a faixa escura e a ponta clara.
  L.push(P(naPegada(poligono([[-2.6, -6], [2.6, -6], [3.9, -21.4], [2.4, -23], [-2.4, -23], [-3.9, -21.4]])), ASA, { eixo: -Math.PI / 2, bisel: 1.1, contorno: 0.28, tom: 0.98, textura: texDasPenas(0.17), semente: 7040, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(naPegada(poligono([[-3.7, -19.2], [3.7, -19.2], [3.9, -21.4], [2.4, -23], [-2.4, -23], [-3.9, -21.4]])), ASA, { bisel: 0.5, contorno: 0.2, tom: 0.58, semente: 7041 }))
  L.push(P(naPegada(poligono([[-3.8, -21.6], [3.8, -21.6], [2.4, -23], [-2.4, -23]])), PEITO, { bisel: 0.3, contorno: 0.1, tom: 0.94, semente: 7042 }))

  // O dorso: largo nas espáduas, afinando até a cauda.
  L.push(P(naPegada(uniao(elipse(0, 1.2, 7.2, 6.8), poligono([[-6.4, 0], [6.4, 0], [2.8, -11], [-2.8, -11]]))), DORSO, { eixo: Math.PI / 2, bisel: 3.2, contorno: 0.26, textura: texDasPenas(0.07), semente: 7043, projeta: { dist: 1, forca: 0.28 } }))

  // As asas fechadas: das espáduas até a ponta fina, as duas pontas cruzando por cima da cauda.
  for (const lado of [-1, 1]) {
    const asa = poligono([[lado * 5.4, 6], [lado * 8.2, 1.4], [lado * 7.4, -6], [lado * 3.6, -15], [lado * -1.4, -20.4], [lado * 0.4, -12], [lado * 1.2, 3.6]])
    L.push(P(naPegada(asa), ASA, { eixo: -Math.PI / 2 + lado * 0.32, bisel: 2.2, contorno: 0.28, tom: lado < 0 ? 1.06 : 0.9, textura: texDasPenas(0.14), semente: 7050 + lado, projeta: { dist: 0.9, forca: 0.32 } }))
    // As rêmiges: a ponta da asa mais escura, do meio para trás.
    L.push(P(naPegada(dentroDaAsa(asa)), ASA, { eixo: -Math.PI / 2 + lado * 0.32, bisel: 1, contorno: 0.2, tom: 0.66, textura: texDasPenas(0.08), semente: 7053 + lado }))
  }

  // O peito claro estufado na frente das asas, dos dois lados do capuz.
  L.push(P(naPegada(elipse(0, 6.6, 6.6, 3.9)), PEITO, { bisel: 2.4, contorno: 0.26, tom: 0.98, semente: 7044, projeta: { dist: 0.8, forca: 0.26 } }))

  // As piós de couro descendo das pernas por cima da trave e a trela, que dá a volta na trave e cai.
  for (const lado of [-1, 1]) L.push(P(naPegada(capsula(lado * 1.6, 3.6, lado * 2.4, 7.6, 0.55)), COURO, { bisel: 0.5, contorno: 0.24, semente: 7060 + lado, projeta: { dist: 0.6, forca: 0.3 } }))
  L.push(P(naPegada(anel(2.4, 8.2, 1.2, 1.2, 0.55, 0.55)), LATAO, { bisel: 0.5, metal: 0.6, contorno: 0.2, semente: 7063 }))
  L.push(P(naPegada(capsula(3.4, 8.4, 15, 2.4, 0.6)), COURO, { bisel: 0.5, contorno: 0.24, semente: 7064, projeta: { dist: 0.7, forca: 0.3 } }))
  L.push(P(naPegada(capsula(15.4, -2.6, 15.4, 3, 0.85)), COURO, { eixo: Math.PI / 2, bisel: 0.7, contorno: 0.26, tom: 0.9, semente: 7065 }))
  L.push(P(naPegada(capsula(15.8, 2.8, 17.6, 11.4, 0.55)), COURO, { bisel: 0.5, contorno: 0.24, semente: 7066, projeta: { dist: 0.6, forca: 0.28 } }))

  // A cabeça: o capuz de couro com a costura escura e as tiras, o penacho no alto e a ponta do bico.
  L.push(P(naPegada(poligono([[-1.2, 12.6], [1.2, 12.6], [0.3, 15.2], [-0.4, 14.6]])), BICO, { bisel: 0.6, contorno: 0.3, semente: 7070 }))
  L.push(P(naPegada(elipse(0, 8.6, 4.9, 5.3)), CAPUZ, { bisel: 3, contorno: 0.3, semente: 7071, projeta: { dist: 1.1, forca: 0.32 } }))
  // A costura do capuz, de través, e as duas tiras de amarrar caindo na nuca.
  L.push(P(naPegada(capsula(-3.9, 7.2, 3.9, 7.2, 0.35)), CAPUZ, { bisel: 0.2, contorno: 0, tom: 0.6, semente: 7072 }))
  for (const lado of [-1, 1]) L.push(P(naPegada(capsula(lado * 1.4, 4, lado * 2.6, 1.2, 0.5)), CAPUZ, { bisel: 0.4, contorno: 0.24, tom: 1.18, semente: 7075 + lado }))
  for (const [x, y, giro] of [[-0.9, 6.8, -0.5], [0.9, 6.8, 0.5], [0, 5.9, 0]] as const) {
    L.push(P(naPegada(elipseGirada(x, y, 0.9, 2.2, giro)), PENACHO, { bisel: 0.7, contorno: 0.24, tom: x === 0 ? 1.06 : 0.92, semente: 7073 + x * 2, projeta: { dist: 0.7, forca: 0.3 } }))
  }
}

/** A ponta da asa (as rêmiges), a metade de trás da asa fechada. */
function dentroDaAsa(asa: Forma): Forma {
  return dentroDe(asa, caixa(-12, -22, 12, -7.5))
}
