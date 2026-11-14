/**
 * BELICHE de cima com volume (14/11/2026, lote L05 dos objetos novos, base
 * militar): a cama de dois andares do alojamento, de tubo de ferro (ou de
 * madeira, se o mestre escolher), com a cabeceira no lado de cima da pegada e
 * a ESCADA na ponta dos pés. De cima aparece a cama de CIMA: o estrado, o
 * colchão, o cobertor esticado com o lençol dobrado por cima (a cama feita do
 * quartel), o travesseiro, os tubos das laterais, a GRADE de proteção na
 * lateral esquerda (alta, faz sombra no cobertor), os quatro POSTES altos com
 * a tampa e, na ponta dos pés, a escada inclinada: os dois banzos com o gancho
 * por cima do tubo do pé e os degraus, cada um mais longe e mais baixo. A
 * sombra no chão é a de um móvel alto.
 *
 * NA 3/4 APARECE A CAMA DE BAIXO. Cada andar é um tampo no ar
 * (`tresQuartos.ts`), e cada peça sobe com a estrutura mais alta que contém o
 * meio da caixa dela. A cama de baixo é montada inteira, escondida debaixo do
 * estrado de cima na vista de cima; as peças dela declaram todas a mesma caixa
 * (a do estrado, um nada mais larga), cujo meio fica um pouco à direita do
 * meio da cama, e o tampo de cima tem um FURO de um terço de px bem nesse
 * ponto: só o tampo de baixo contém o meio delas. Na 3/4 a cama de cima sobe
 * até a altura dela e deixa à mostra, por baixo da beirada, o pé da cama de
 * baixo, com a escada na frente. Os degraus são tampos no ar (a escada é
 * inclinada: cada degrau tem um lugar de cima próprio) e os banzos, colunas.
 * A grade declara a caixa até depois do pé da cama, para ser pintada depois
 * da cama de cima.
 *
 * Materiais: `estrutura` (o tubo; ferro, latão ou madeira), `cobertor` e
 * `travesseiro`. O lençol e o colchão são fixos.
 */
import { type Rgb } from '../../ruido'
import { caixa, elipse, menos, type Caixa, type Forma } from './formas'
import { contato, type Sombra } from './motor'
import { LENCOL, QUARTO, type MontarMovel } from './contexto'

/** As alturas, em casas: o colchão de baixo, o de cima, a grade, o pé de cima e o alto dos postes. */
const ALTURA_DE_BAIXO = 0.32
const ALTURA_DE_CIMA = 0.98
const ALTURA_DA_GRADE = 1.16
const ALTURA_DO_PE = 1.06
const ALTURA_DOS_POSTES = 1.2
/** A cabeceira de cima tem duas travessas: a do alto dos postes e a do meio, até o colchão. */
const ALTURA_DA_TRAVESSA_DO_MEIO = 1.08
/** Quanto os banzos da escada passam do colchão de cima (o gancho), em casas. */
const GANCHO_DA_ESCADA = 0.1
/** O lado do poste e a grossura do tubo, em fração da largura (a cama de partida tem 1 casa). */
const POSTE = 0.08
const TUBO = 0.05
/** A escada: a fundura dela na ponta dos pés (fração do comprimento), o meio vão entre os banzos (fração da largura) e os degraus. */
const ESCADA = 0.09
const MEIO_VAO_DA_ESCADA = 0.3
const DEGRAUS = 4
/** O banzo e o degrau (px do protótipo). */
const BANZO = 1.7
const DEGRAU = 1.6
/** A grade de proteção: até que fração do comprimento ela vai, a partir da cabeceira, e a grossura (px do protótipo). */
const FIM_DA_GRADE = 0.62
const GROSSURA_DA_GRADE = 2.2
/** Onde o cobertor começa (fração do comprimento a partir da cabeceira) e a largura da dobra do lençol (fração do comprimento). */
const DOBRA = 0.3
const LARGURA_DA_DOBRA = 0.07
/** O travesseiro: a fração do comprimento que ele ocupa e o recuo dos lados (fração da largura). */
const TRAVESSEIRO = 0.15
const RECUO_DO_TRAVESSEIRO = 0.14
/**
 * O meio declarado das peças da cama de baixo sai do meio do estrado este tanto para a direita (px do
 * protótipo), e o furo do tampo de cima tem este raio: nenhuma peça de cima tem o meio ali (são todas
 * simétricas ou encostadas nas laterais).
 */
const DESVIO_DA_CAMA_DE_BAIXO = 1.5
const FURO = 0.3
/** O tom do estrado (escuro, por baixo do colchão) e da tampa dos postes. */
const TOM_DO_ESTRADO = 0.72
const TOM_DA_TAMPA = 0.6
/** O escuro em que o pixel escuro demais é levantado: o cinza do ferro (com a nogueira, o tubo saía marrom). */
const ESCURO_DO_FERRO: Rgb = [0x48, 0x46, 0x44]

export const montarBeliche: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const est = c.m.estrutura
  const metal = est.classe === 'metal'
  const tubo = TUBO * w
  const poste = POSTE * w
  const yPe = hh - ESCADA * h
  const zBaixo = ALTURA_DE_BAIXO * g
  const zCima = ALTURA_DE_CIMA * g
  /** O tubo: redondo (chanfro de meio tubo) e com brilho se for metal; de madeira, o veio ao comprido. */
  const opcoesDoTubo = (eixo: number, semente: number, tom = 1) => ({ eixo, tabua: 0, bisel: metal ? tubo * 0.5 : tubo * 0.35, contorno: 0.26, metal: metal ? 0.5 : 0, tom, semente })

  const cama = caixa(-hw, -hh, hw, yPe, 1)
  const meioDeBaixo: [number, number] = [DESVIO_DA_CAMA_DE_BAIXO, (-hh + yPe) / 2]
  const caixaDeBaixo: Caixa = [-hw, -hh, hw + 2 * DESVIO_DA_CAMA_DE_BAIXO, yPe]
  const naCamaDeBaixo = (f: Forma): Forma => ({ b: caixaDeBaixo, d: f.d })
  const postes = [[-hw, -hh], [hw - poste, -hh], [-hw, yPe - poste], [hw - poste, yPe - poste]].map(([x, y]) => caixa(x, y, x + poste, y + poste, 0.8))

  // As estruturas e as sombras: os postes, os dois andares (o de cima com o furo) e o contato.
  const sombras: Sombra[] = [
    { forma: cama, z: zBaixo, solta: true, forca: 0.2 },
    { forma: menos(cama, elipse(meioDeBaixo[0], meioDeBaixo[1], FURO, FURO)), z: zCima, solta: true },
    contato(caixa(-hw, -hh, hw, hh, 1), 0.26),
  ]
  for (const p of postes) sombras.push({ forma: p, z: ALTURA_DOS_POSTES * g, forca: 0.3 }, contato(p, 0.34))
  cena.sombras.push(...sombras)

  // As peças de uma cama (as duas são iguais): o estrado, o colchão, o travesseiro, o cobertor e a dobra do lençol.
  const L = cena.partes
  const montarCama = (por: (f: Forma) => Forma, s: number, ruga: number): void => {
    L.push(P(por(cama), est, { eixo: QUARTO, tabua: metal ? 0 : 6, bisel: 1, contorno: 0.3, metal: metal ? 0.3 : 0, tom: TOM_DO_ESTRADO, semente: s }))
    L.push(P(por(caixa(-hw + tubo, -hh + tubo, hw - tubo, yPe - tubo, 2.4)), LENCOL, { bisel: 2.4, ruga: ruga * 0.6, semente: s + 1 }))
    const yTr = -hh + tubo + 1.2
    L.push(P(por(caixa(-hw + RECUO_DO_TRAVESSEIRO * w, yTr, hw - RECUO_DO_TRAVESSEIRO * w, yTr + TRAVESSEIRO * h, 4)), c.m.travesseiro, { bisel: 0.07 * h, ruga: 1.5, semente: s + 2, projeta: { dist: 1.6, forca: 0.3, suave: 1.2 } }))
    const yDobra = -hh + DOBRA * h
    L.push(P(por(caixa(-hw + tubo * 0.7, yDobra, hw - tubo * 0.7, yPe - tubo * 0.6, 2)), c.m.cobertor, { bisel: 2.2, ruga, eixo: QUARTO, semente: s + 3, projeta: { dist: 1.2, forca: 0.28 } }))
    L.push(P(por(caixa(-hw + tubo * 0.7 - 0.3, yDobra - 0.5, hw - tubo * 0.7 + 0.3, yDobra + LARGURA_DA_DOBRA * h, 2)), LENCOL, { tom: 1.05, bisel: 2.2, ruga: 0.8, semente: s + 4, projeta: { dist: 1.4, forca: 0.32 } }))
    for (const x0 of [-hw, hw - tubo]) L.push(P(por(caixa(x0, -hh, x0 + tubo, yPe, tubo / 2)), est, opcoesDoTubo(QUARTO, s + 5)))
  }
  // A cama de baixo primeiro (escondida pelo estrado de cima, só a 3/4 a mostra), um nada mais desarrumada.
  montarCama(naCamaDeBaixo, 500, 2)
  montarCama((f) => f, 520, 1.1)

  // A cabeceira de cima: duas travessas entre os postes (a do meio só aparece na 3/4, debaixo da do alto).
  const travessa = caixa(-hw + poste, -hh, hw - poste, -hh + tubo, tubo / 2)
  cena.sombras.push({ forma: travessa, z: ALTURA_DA_TRAVESSA_DO_MEIO * g, solta: true, forca: 0 }, { forma: travessa, z: (ALTURA_DOS_POSTES - 0.02) * g, solta: true, forca: 0.22 })
  L.push(P(travessa, est, opcoesDoTubo(0, 540)))
  // O tubo do pé de cima, um pouco acima do colchão.
  const pe = caixa(-hw + poste, yPe - tubo, hw - poste, yPe, tubo / 2)
  cena.sombras.push({ forma: pe, z: ALTURA_DO_PE * g, solta: true, forca: 0.2 })
  L.push(P(pe, est, opcoesDoTubo(0, 541)))

  // A grade de proteção na lateral esquerda, por dentro do tubo, com o pé dela na ponta; a caixa declarada vai até
  // depois do pé da cama (a 3/4 a pinta depois da cama de cima).
  const xGrade = -hw + tubo + 0.3
  const yGrade = -hh + FIM_DA_GRADE * (yPe + hh)
  const grade = caixa(xGrade, -hh + poste, xGrade + GROSSURA_DA_GRADE, yGrade, GROSSURA_DA_GRADE / 2)
  cena.sombras.push({ forma: { b: [grade.b[0], grade.b[1], grade.b[2], yPe + 0.1], d: grade.d }, z: ALTURA_DA_GRADE * g, solta: true, forca: 0.24 })
  L.push(P(grade, est, { ...opcoesDoTubo(QUARTO, 542), projeta: { dist: 3.4, forca: 0.34, suave: 1.6 } }))
  L.push(P(caixa(xGrade - 0.4, yGrade - GROSSURA_DA_GRADE - 0.4, xGrade + GROSSURA_DA_GRADE + 0.4, yGrade + 0.4, 0.8), est, { ...opcoesDoTubo(0, 543, 0.92), projeta: { dist: 3, forca: 0.3, suave: 1.4 } }))

  // A escada: os degraus (cada um mais longe da cama e mais baixo) e os banzos, com o gancho por cima do tubo do pé.
  const xBanzo = MEIO_VAO_DA_ESCADA * w
  for (let i = 0; i < DEGRAUS; i += 1) {
    const y = yPe + 1 + ((hh - DEGRAU - (yPe + 1)) * i) / (DEGRAUS - 1)
    const degrau = caixa(-xBanzo + BANZO / 2, y - DEGRAU / 2, xBanzo - BANZO / 2, y + DEGRAU / 2, DEGRAU / 2)
    cena.sombras.push({ forma: degrau, z: (zCima * (DEGRAUS - i)) / (DEGRAUS + 1), solta: true, forca: 0.18, suave: 0.7 })
    L.push(P(degrau, est, opcoesDoTubo(0, 550 + i)))
  }
  for (const lado of [-1, 1]) {
    const banzo = caixa(lado * xBanzo - BANZO / 2, yPe - tubo - 0.6, lado * xBanzo + BANZO / 2, hh, BANZO / 2)
    cena.sombras.push({ forma: banzo, z: zCima + GANCHO_DA_ESCADA * g, forca: 0.24 }, contato(caixa(lado * xBanzo - BANZO, hh - 2, lado * xBanzo + BANZO, hh, 0.8), 0.3))
    L.push(P(banzo, est, { ...opcoesDoTubo(QUARTO, 556 + lado), projeta: { dist: 1.2, forca: 0.3 } }))
  }

  // Os postes por cima de tudo: o tubo quadrado e a tampa escura.
  postes.forEach((p, i) => {
    L.push(P(p, est, opcoesDoTubo(QUARTO, 560 + i)))
    const [x0, y0, x1, y1] = p.b
    const r = (x1 - x0) * 0.28
    L.push(P(elipse((x0 + x1) / 2, (y0 + y1) / 2, r, r), est, { tabua: 0, bisel: r * 0.6, contorno: 0.2, metal: metal ? 0.3 : 0, tom: TOM_DA_TAMPA, semente: 565 + i }))
  })
  if (metal) cena.corDoPiso = ESCURO_DO_FERRO
}
