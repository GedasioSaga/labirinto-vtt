/**
 * LEITO HOSPITALAR de cima com volume (lote L10 de 24/11/2026, presídio moderno, a enfermaria; versão da maca com
 * lençol): a cama de ferro de enfermaria, toda de TUBO pintado de esmalte creme, com a CABECEIRA alta e o PÉ mais
 * baixo (cada um com as bolas nas pontas dos postes), o COLCHÃO de napa azul apagado com o vivo da costura e o vinco
 * da dobra do encosto, o TRAVESSEIRO branco amassado na cabeceira e o COBERTOR cinza de lã, dobrado no pé, com as
 * duas listras de ponta. Nas laterais da metade de cima, as GRADES de tubo, cada uma com a trava no meio.
 *
 * NA 3/4 é derivada (`tresQuartos.ts`, beirada de `ESPESSURA_DO_COLCHAO_DO_LEITO`): o colchão é um tampo solto (a
 * beirada é a lateral de napa) e embaixo dele fica o vão, com o chão e a sombra; os quatro postes são colunas do chão
 * à cabeceira e ao pé; o tubo de cima de cada um sobe num pino; as grades sobem cada uma no seu pino, que sai depois
 * dos postes da cabeceira na ordem de pintura (a grade fica na frente deles; o colchão não cruza a grade na tela). Só
 * a 3/4 vê (`soNaTresQuartos`, sem giro) as barras da cabeceira com o tubo do meio, a descida das grades até o
 * colchão, as barras do pé com o tubo de baixo e a prancheta do prontuário (antes dos postes e do tubo de cima, que
 * cobrem as pontas) e as rodinhas (depois dos postes). Com giro, o leito fica com os postes, os tubos e as grades.
 *
 * Os tubos no ar não fazem estrutura: a sombra deles é posta direto no chão, já deslocada pela altura. Sem material
 * escolhido: o esmalte, a napa, o algodão, a lã e a prancheta são fixos.
 */
import type { Rgb } from '../../ruido'
import { caixa, capsula, elipse, menos, type Forma } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Sombra } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm, deslocada, pino, solta } from './andaimeDaTresQuartos'
import { BORRACHA, ESMALTE, NIQUEL, PAPEL, texEsmalte } from './apoioDoNecroterio'
import { REFLEXO, soNaTresQuartos, type PecaDaTela } from './apoioDoBanheiroModerno'

/** A grossura do colchão (px do protótipo): o perfil da 3/4 em `tresQuartos.ts` usa este valor. */
export const ESPESSURA_DO_COLCHAO_DO_LEITO = 0.09 * G

/** Alturas em casas: o colchão (0,6 m), a cabeceira (1,05 m), o pé (0,84 m) e a grade acima do colchão. */
const ALTURA_DO_COLCHAO = 0.4
const ALTURA_DA_CABECEIRA = 0.7
const ALTURA_DO_PE = 0.56
const GRADE_ACIMA_DO_COLCHAO = 0.2
/** Os postes: o raio, a distância da beira e o raio da bola de cima (px). */
const POSTE = { raio: 1.15, daBeira: 1.5, bola: 1.6 } as const
/** O raio do tubo de cima, o das barras e onde ficam as barras (px a partir do meio). */
const TUBO = 1.1
const BARRA = 0.6
const BARRAS = [-12, -6, 0, 6, 12] as const
/** O colchão: o recuo dos lados, o das pontas e a quina (px). */
const COLCHAO = { recuoX: 2.6, recuoY: 3.2, quina: 2.6 } as const
/** As grades: a distância da beira, o raio, onde começam (px da beira de trás) e o comprimento (px). */
const GRADE = { daBeira: 0.75, raio: 0.85, comeco: 7, comprimento: 30 } as const
/** Onde fica a prancheta do prontuário (px a partir do meio). */
const X_DA_PRANCHETA = 7.5

/** A napa azul apagada do colchão (saturação HSV ~0,35) e o vivo da costura. */
const NAPA: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x78, 0x8e] }
const COSTURA: MaterialDaPeca = { classe: 'liso', rgb: [0x38, 0x4a, 0x59] }
/** O travesseiro de algodão, o cobertor de lã cinza e as listras dele. */
const FRONHA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xdc, 0xd9, 0xd0] }
const COBERTOR: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x8c, 0x89, 0x80] }
const LISTRA: MaterialDaPeca = { classe: 'liso', rgb: [0x4f, 0x53, 0x56] }
/** A prancheta de eucatex e a tinta da ficha. */
const PRANCHETA: MaterialDaPeca = { classe: 'liso', rgb: [0x7d, 0x6b, 0x52] }
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x52, 0x5e] }
/** O escuro em que o pixel escuro demais é levantado: o azul-acinzentado escuro da napa. */
const PISO_DO_LEITO: Rgb = [0x3c, 0x46, 0x4e]

/** A sombra no chão de um tubo no ar, já deslocada pela altura (não faz estrutura: quem o sobe na 3/4 é o pino). */
function sombraNoChao(forma: Forma, z: number, forca: number): Sombra {
  return { forma: deslocada(forma, SOMBRA_X * z, SOMBRA_Y * z), z: 0, suave: 1.3, forca }
}

export const montarLeitoHospitalar: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_LEITO
  const esp = ESPESSURA_DO_COLCHAO_DO_LEITO
  const zColchao = g * ALTURA_DO_COLCHAO
  const zCabeceira = g * ALTURA_DA_CABECEIRA
  const zPe = g * ALTURA_DO_PE
  const zGrade = zColchao + g * GRADE_ACIMA_DO_COLCHAO
  const xP = hw - POSTE.daBeira
  const yCab = -hh + POSTE.daBeira
  const yPe = hh - POSTE.daBeira
  const xM = hw - COLCHAO.recuoX
  const colchao = caixa(-xM, -hh + COLCHAO.recuoY, xM, hh - COLCHAO.recuoY, COLCHAO.quina)
  const tuboDaCabeceira = capsula(-xP, yCab, xP, yCab, TUBO)
  const tuboDoPe = capsula(-xP, yPe, xP, yPe, TUBO)
  const xG = hw - GRADE.daBeira
  const yG0 = -hh + GRADE.comeco
  const yG1 = yG0 + GRADE.comprimento
  const yMeioDaGrade = (yG0 + yG1) / 2
  const grades = [-1, 1].map((lado) => capsula(lado * xG, yG0, lado * xG, yG1, GRADE.raio))
  const postes: readonly (readonly [number, number, number])[] = [[-xP, yCab, zCabeceira], [xP, yCab, zCabeceira], [-xP, yPe, zPe], [xP, yPe, zPe]]

  // As sombras: o colchão solto, os postes em coluna, os tubos no chão e os pinos que sobem os tubos na 3/4. O pino
  // de cada grade sai depois do colchão na ordem de pintura (a caixa cresce até passar da beira da frente).
  cena.sombras.push({ forma: colchao, z: zColchao, solta: true, suave: 1.8, forca: 0.3 })
  for (const [x, y, z] of postes) {
    const poste = elipse(x, y, POSTE.raio, POSTE.raio)
    cena.sombras.push({ forma: poste, z, forca: 0.2 }, contato(poste, 0.3))
  }
  cena.sombras.push(sombraNoChao(tuboDaCabeceira, zCabeceira, 0.16), sombraNoChao(tuboDoPe, zPe, 0.16))
  for (const grade of grades) cena.sombras.push(sombraNoChao(grade, zGrade, 0.14))
  cena.sombras.push(solta(pino(0, yCab), zCabeceira), solta(pino(0, yPe), zPe))
  for (const lado of [-1, 1]) cena.sombras.push(solta(pino(lado * xG, yMeioDaGrade), zGrade))

  const L = cena.partes
  const esmalte = { tabua: 0, textura: texEsmalte, contorno: 0.28 }
  const liso = { tabua: 0, bisel: 0, contorno: 0 }

  // A CABECEIRA e o PÉ vistos de cima: o tubo de cima e as bolas das pontas dos postes.
  L.push(P(tuboDaCabeceira, ESMALTE, { ...esmalte, bisel: TUBO, semente: 10301 }))
  L.push(P(tuboDoPe, ESMALTE, { ...esmalte, bisel: TUBO, semente: 10302 }))
  postes.forEach(([x, y], i) => {
    L.push(P(elipse(x, y, POSTE.bola, POSTE.bola), ESMALTE, { ...esmalte, bisel: POSTE.bola, tom: 1.04, semente: 10303 + i, projeta: { dist: 0.6, forca: 0.26 } }))
  })

  // O COLCHÃO de napa: o vivo da costura em volta, o vinco da dobra do encosto, o fundo gasto do corpo e o brilho.
  L.push(P(colchao, NAPA, { tabua: 0, bisel: 2.4, contorno: 0.28, semente: 10310, projeta: { dist: 0.8, forca: 0.22 } }))
  const vivo = menos(caixa(-xM + 1.2, -hh + COLCHAO.recuoY + 1.2, xM - 1.2, hh - COLCHAO.recuoY - 1.2, 1.6), caixa(-xM + 1.75, -hh + COLCHAO.recuoY + 1.75, xM - 1.75, hh - COLCHAO.recuoY - 1.75, 1.2))
  L.push(P(vivo, COSTURA, { ...liso, alfa: 0.45, semente: 10311 }))
  const yDobra = -hh + 27
  L.push(P(capsula(-xM + 2.4, yDobra, xM - 2.4, yDobra, 0.45), COSTURA, { ...liso, alfa: 0.3, suave: 0.5, semente: 10312 }))
  L.push(P(capsula(-xM + 2.6, yDobra + 1.1, xM - 2.6, yDobra + 1.1, 0.5), REFLEXO, { ...liso, alfa: 0.12, suave: 0.6, semente: 10313 }))
  L.push(P(elipse(0.5, 3, xM * 0.62, hh * 0.42), COSTURA, { ...liso, alfa: 0.08, suave: 4, semente: 10314 }))
  L.push(P(elipse(-xM * 0.45, -2, 2.4, 13), REFLEXO, { ...liso, alfa: 0.1, suave: 1.8, semente: 10315 }))

  // O TRAVESSEIRO amassado: a fronha, a cova da cabeça e o vinco do meio.
  const yTravesseiro = -hh + 10.2
  L.push(P(caixa(-11.5, yTravesseiro - 5.2, 11.5, yTravesseiro + 5.2, 4), FRONHA, { bisel: 2.8, ruga: 0.7, contorno: 0.24, semente: 10320, projeta: { dist: 1, forca: 0.3, suave: 1 } }))
  L.push(P(elipse(1.2, yTravesseiro + 0.4, 6.4, 3), COSTURA, { ...liso, alfa: 0.1, suave: 1.6, semente: 10321 }))
  L.push(P(capsula(-8.5, yTravesseiro - 3.2, -3, yTravesseiro - 2.4, 0.4), REFLEXO, { ...liso, alfa: 0.3, suave: 0.4, semente: 10322 }))

  // O COBERTOR de lã dobrado no pé: o pano, a dobra de cima que pega a luz e as duas listras da ponta.
  const yCobertor0 = hh - 19
  const yCobertor1 = hh - COLCHAO.recuoY - 2.4
  L.push(P(caixa(-xM + 0.5, yCobertor0, xM - 0.5, yCobertor1, 1.8), COBERTOR, { bisel: 1.8, ruga: 0.9, contorno: 0.24, semente: 10330, projeta: { dist: 1, forca: 0.32, suave: 1 } }))
  L.push(P(capsula(-xM + 2, yCobertor0 + 1, xM - 2, yCobertor0 + 1, 0.6), REFLEXO, { ...liso, alfa: 0.14, suave: 0.5, semente: 10331 }))
  for (const y of [yCobertor1 - 5.4, yCobertor1 - 3.6]) L.push(P(caixa(-xM + 0.9, y - 0.45, xM - 0.9, y + 0.45), LISTRA, { ...liso, alfa: 0.5, semente: 10332 }))

  // As GRADES de tubo com a trava no meio (sobem no pino delas).
  grades.forEach((grade, i) => {
    const x = (i === 0 ? -1 : 1) * xG
    L.push(P(grade, ESMALTE, { ...esmalte, bisel: GRADE.raio, tom: 0.98, semente: 10340 + i, projeta: { dist: 0.8, forca: 0.24 } }))
    L.push(P(caixa(x - 1.05, yMeioDaGrade - 1.7, x + 1.05, yMeioDaGrade + 1.7, 0.6), NIQUEL, { tabua: 0, bisel: 0.6, metal: 0.6, contorno: 0.28, semente: 10342 + i }))
  })

  // O prendedor da prancheta, de cima: sobe no pino dele até o tubo do pé.
  const xC = X_DA_PRANCHETA
  cena.sombras.push(solta(pino(xC, yPe + 1.2), zPe - 0.4))
  L.push(P(comMeioEm(caixa(xC - 1.7, yPe + 0.7, xC + 1.7, yPe + 1.7, 0.4), xC, yPe + 1.2), NIQUEL, { tabua: 0, bisel: 0.4, metal: 0.6, contorno: 0.28, semente: 10350 }))

  // Só a 3/4 (o chão de cada linha em y, para cima negativo): a cabeceira, pintada antes do colchão.
  const zMeioDaCabeceira = zColchao + 3
  const cabeceira: PecaDaTela[] = BARRAS.map((x) => ({
    forma: capsula(x, yCab - zCabeceira + TUBO, x, yCab - zMeioDaCabeceira, BARRA),
    mat: ESMALTE,
    o: { ...esmalte, bisel: BARRA, tom: 0.94, contorno: 0.26, semente: 10360 },
  }))
  cabeceira.push({ forma: capsula(-xP, yCab - zMeioDaCabeceira, xP, yCab - zMeioDaCabeceira, 0.9), mat: ESMALTE, o: { ...esmalte, bisel: 0.9, tom: 0.97, semente: 10361 } })
  soNaTresQuartos(P, cena, 0, -hh + 2.8, cabeceira)

  // A descida das grades até o colchão: depois dos postes da cabeceira (a grade fica na frente deles). A âncora fica
  // dentro do colchão, mais alta que ele; nada dela cruza o colchão na tela.
  const descida: PecaDaTela[] = [-xG, xG].map((x) => ({
    forma: capsula(x, yG0 - zGrade, x, yG1 - zColchao - 1, GRADE.raio),
    mat: ESMALTE,
    o: { ...esmalte, bisel: GRADE.raio, tom: 0.9, semente: 10374 },
  }))
  soNaTresQuartos(P, cena, 0, yMeioDaGrade + 0.2, descida)

  // O pé: as barras, o tubo de baixo e a prancheta, depois do colchão e antes dos postes e do tubo de cima (que
  // cobrem as pontas); por fim as rodinhas, depois dos postes.
  const zDeBaixo = zColchao - esp - 2
  const pe: PecaDaTela[] = BARRAS.map((x) => ({
    forma: capsula(x, yPe - zPe + TUBO, x, yPe - zDeBaixo, BARRA),
    mat: ESMALTE,
    o: { ...esmalte, bisel: BARRA, tom: 0.94, contorno: 0.26, semente: 10370 },
  }))
  pe.push({ forma: capsula(-xP, yPe - zDeBaixo, xP, yPe - zDeBaixo, 0.9), mat: ESMALTE, o: { ...esmalte, bisel: 0.9, tom: 0.92, semente: 10371 } })
  const rodinhas: PecaDaTela[] = []
  for (const x of [-xP, xP]) {
    const chao = yPe + POSTE.raio
    rodinhas.push({ forma: caixa(x - 1.4, chao - 3.6, x + 1.4, chao - 2.2, 0.4), mat: ESMALTE, o: { ...esmalte, bisel: 0.5, tom: 0.8, semente: 10372 } })
    rodinhas.push({ forma: elipse(x, chao - 1.3, 1.9, 1.35), mat: BORRACHA, o: { tabua: 0, bisel: 0.9, contorno: 0.3, semente: 10373 } })
  }
  soNaTresQuartos(P, cena, 0, yPe + POSTE.raio + 0.15, rodinhas)
  const topo = yPe - zPe + 1.6
  pe.push({ forma: caixa(xC - 3.8, topo, xC + 3.8, topo + 10.5, 0.6), mat: PRANCHETA, o: { tabua: 0, bisel: 0.5, contorno: 0.3, semente: 10375 } })
  pe.push({ forma: caixa(xC - 3.1, topo + 1.6, xC + 3.1, topo + 9.9, 0.2), mat: PAPEL, o: { tabua: 0, bisel: 0.2, contorno: 0.2, semente: 10376 } })
  for (let k = 0; k < 4; k += 1) {
    const y = topo + 3.6 + k * 1.5
    pe.push({ forma: caixa(xC - 2.4, y - 0.18, xC + (k === 3 ? 0.4 : 2.3), y + 0.18), mat: TINTA, o: { ...liso, alfa: 0.55, semente: 10377 } })
  }
  pe.push({ forma: caixa(xC - 1.9, topo - 0.5, xC + 1.9, topo + 1.4, 0.4), mat: NIQUEL, o: { tabua: 0, bisel: 0.5, metal: 0.6, contorno: 0.28, semente: 10378 } })
  soNaTresQuartos(P, cena, 0, hh - COLCHAO.recuoY + 0.5, pe)
}
