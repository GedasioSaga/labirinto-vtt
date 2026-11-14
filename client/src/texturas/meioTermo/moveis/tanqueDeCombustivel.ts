/**
 * TANQUE DE COMBUSTÍVEL de cima com volume (14/11/2026, lote L16, construções da base militar): o tanque
 * cilíndrico deitado de chapa pintada, de tampos abaulados, em dois BERÇOS de concreto, dentro do DIQUE baixo de
 * concreto que segura o vazamento. No alto, a PASSARELA de grade com o corrimão, a BOCA DE VISITA aparafusada, o
 * RESPIRO com o chapéu, as duas COSTURAS de solda e o LOSANGO vermelho de inflamável; numa ponta, a BOMBA vermelha
 * com a MANGUEIRA enrolada; no chão do dique, a mancha de óleo.
 *
 * De cima: o cilindro comprido em faixas (a de cima, do lado da luz, clara, a de baixo escura) com as pontas
 * arredondadas, o losango vermelho, a passarela, o dique em volta e a SOMBRA para baixo à direita. É o cilindro
 * deitado no dique que diz "tanque de combustível" e não o contêiner (caixa de chapa ondulada) nem o barril.
 *
 * NA 3/4 (`tresQuartos.ts`): o cilindro são tampos do equador ao alto, cada um mais estreito (o corte do
 * cilindro), com a frente de cada um mais escura quanto mais baixo, e dois tampos debaixo do equador, cada um um
 * tico mais comprido (o pingo deles mora na ponta do oeste); os berços, o dique e a bomba são colunas. Lê
 * `c.giro` para as fatias saírem na ordem certa (a de baixo antes), depois do dique e dos berços.
 *
 * Corre pelo lado MAIOR da pegada (u ao comprido, v de través, trocados no tanque em pé). Alturas em fração do
 * lado MENOR. Sem material escolhido: a pintura, o concreto, o aço e a bomba são fixos.
 */
import { hash } from '../../ruido'
import { anel, caixa, capsula, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'
import { esticadaParaAFrente, pingo, tingido } from './apoioDasConstrucoes'

/** A beirada dos tampos do tanque (px do protótipo): a altura de cada fatia do cilindro. O perfil usa este valor. */
export const ESPESSURA_DA_FATIA_DO_TANQUE = 0.1 * 56

/** O dique (fração da meia pegada) e a grossura da parede dele (px). */
const DIQUE = 0.97
const PAREDE_DO_DIQUE = 2.8
/** O tanque: o meio comprimento do corpo reto (fração do meio comprimento) e quanto o tampo abaulado passa dele (fração do raio). */
const CORPO = 0.6
const TAMPO_ABAULADO = 0.32
/** As faixas do cilindro vistas de cima, de um lado ao outro. */
const FAIXAS = 9
/** Os berços: onde ficam (fração do corpo) e a meia grossura (px). */
const BERCOS: readonly number[] = [-0.62, 0.62]
const MEIO_BERCO = 3.4
/** As costuras de solda (fração do corpo), a boca de visita e o respiro (u em fração do corpo). */
const COSTURAS: readonly number[] = [-0.34, 0.34]
const BOCA_EM = 0.3
const RESPIRO_EM = -0.42
/** A passarela no alto: até onde vai (fração do corpo) e a meia largura (fração do raio). */
const PASSARELA = 0.56
const MEIA_PASSARELA = 0.2
/** A bomba na ponta do leste: a meia medida (px) e a mangueira (raio de fora e de dentro, px). */
const MEIA_BOMBA = 5.2
const MANGUEIRA: readonly [number, number] = [5.4, 3.4]
/** Alturas em lados: o dique, o pé do tanque (o alto do berço) e o raio do cilindro. */
const ALTURA_DO_DIQUE = 0.09
const PE_DO_TANQUE = 0.1
const RAIO_DO_TANQUE = 0.3
const ALTURA_DA_BOMBA = 0.24
/** O quanto cada tampo de baixo do equador é mais comprido (px): o tico em que mora o pingo dele. */
const ESTICA_O_DE_BAIXO = 0.6

const PINTURA: MaterialDaPeca = { classe: 'metal', rgb: [0xc2, 0xc1, 0xb6] }
const CONCRETO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0xa6, 0xa3, 0x9a] }
const GRADE = materialDaPeca('ferro')
const VERMELHO: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x4a, 0x3e] }
const BOMBA: MaterialDaPeca = { classe: 'metal', rgb: [0x9c, 0x4a, 0x40] }
const BORRACHA: MaterialDaPeca = { classe: 'liso', rgb: [0x36, 0x34, 0x32] }
const OLEO: MaterialDaPeca = { classe: 'liso', rgb: [0x3c, 0x38, 0x33] }
const BRANCO: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xd3, 0xc6] }

export const montarTanqueDeCombustivel: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const S = cena.sombras
  const deitado = c.w >= c.h
  const [meioC, meiaL] = deitado ? [c.hw, c.hh] : [c.hh, c.hw]
  const lado = 2 * Math.min(c.hw, c.hh)
  const e = ESPESSURA_DA_FATIA_DO_TANQUE
  const r = RAIO_DO_TANQUE * lado
  const U = CORPO * meioC
  const zMeio = PE_DO_TANQUE * lado + r
  cena.corDoPiso = [0x48, 0x46, 0x42]
  /** As fatias saem depois do dique e dos berços, a de baixo antes: a caixa de todas vai até além da pegada, embaixo na tela. */
  const noAlto = (f: Forma): Forma => esticadaParaAFrente(f, Math.max(c.hw, c.hh) + 1, c.giro)
  const bloco = (u0: number, v0: number, u1: number, v1: number, raio = 0): Forma => (deitado ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio))
  const pt = (u: number, v: number): Ponto => (deitado ? [u, v] : [v, u])
  const disco = (u: number, v: number, raio: number): Forma => {
    const [x, y] = pt(u, v)
    return elipse(x, y, raio, raio)
  }
  /** Até onde vai o tanque ao comprido na distância `v` do eixo: o corpo reto mais o tampo abaulado. */
  const pontaEm = (v: number): number => U + TAMPO_ABAULADO * r * Math.sqrt(Math.max(0, 1 - (v / r) ** 2))

  // ---------- o dique: o chão de concreto, a mancha de óleo e as quatro paredes baixas ----------
  const [DU, DV] = [DIQUE * meioC, DIQUE * meiaL]
  const zDique = ALTURA_DO_DIQUE * lado
  // O chão em quatro pedaços em volta do tanque (nenhum maior que a faixa do tanque, a frente das fatias sem pingo).
  const chao: readonly Forma[] = [bloco(-DU, -DV, DU, -r * 0.5), bloco(-DU, r * 0.5, DU, DV), bloco(-DU, -r * 0.5, -U, r * 0.5), bloco(U, -r * 0.5, DU, r * 0.5)]
  chao.forEach((forma, i) => L.push(P(forma, CONCRETO, { tabua: 0, bisel: 0.4, tom: 0.84, contorno: 0.1, semente: 17500 + i })))
  const [ox, oy] = pt(-0.2 * U, 0.84 * r + 6)
  L.push(P(elipse(ox, oy, deitado ? 9 : 5, deitado ? 5 : 9), OLEO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.4, suave: 2, semente: 17505 }))
  const paredes: readonly Forma[] = [
    bloco(-DU, -DV, DU, -DV + PAREDE_DO_DIQUE),
    bloco(-DU, DV - PAREDE_DO_DIQUE, DU, DV),
    bloco(-DU, -DV + PAREDE_DO_DIQUE, -DU + PAREDE_DO_DIQUE, DV - PAREDE_DO_DIQUE),
    bloco(DU - PAREDE_DO_DIQUE, -DV + PAREDE_DO_DIQUE, DU, DV - PAREDE_DO_DIQUE),
  ]
  S.push(contato(bloco(-DU, -DV, DU, DV, 1.5), 0.24))
  paredes.forEach((forma, i) => {
    S.push({ forma, z: zDique, forca: 0.22 })
    L.push(P(forma, CONCRETO, { tabua: 0, bisel: 0.7, tom: i === 0 || i === 2 ? 1.1 : 0.96, contorno: 0.28, semente: 17506 + i }))
  })

  // ---------- os berços de concreto ----------
  BERCOS.forEach((b, i) => {
    const berco = bloco(b * U - MEIO_BERCO, -r - 2, b * U + MEIO_BERCO, r + 2, 1)
    S.push({ forma: berco, z: zMeio - r * 0.7, forca: 0 })
    // De cima só aparecem as duas beiras do berço, fora do cilindro: são elas as peças dele (no meio, a caixa
    // cairia dentro das fatias e o berço subiria com o alto do tanque).
    for (const lado2 of [-1, 1]) {
      L.push(P(bloco(b * U - MEIO_BERCO, lado2 > 0 ? r - 0.6 : -r - 2, b * U + MEIO_BERCO, lado2 > 0 ? r + 2 : -r + 0.6, 0.8), CONCRETO, { tabua: 0, bisel: 0.8, tom: 1.02, contorno: 0.3, semente: 17510 + i * 2 + (lado2 > 0 ? 1 : 0) }))
    }
  })

  // ---------- o cilindro: fatias do equador ao alto, e duas debaixo dele ----------
  const fatias = Math.ceil(r / e - 0.01)
  for (let k = 0; k < fatias; k += 1) {
    const z = zMeio + r - (k * r) / fatias
    const h = Math.max(0, z - e - zMeio)
    const meia = Math.sqrt(Math.max(1, r * r - h * h))
    const ponta = pontaEm(h)
    S.push({ forma: noAlto(bloco(-ponta, -meia, ponta, meia, Math.min(meia, r * TAMPO_ABAULADO))), z, solta: true, forca: k === fatias - 1 ? 0.32 : 0 })
    const [px, py] = pt(0, meia - 0.15)
    L.push(pingo(P, px, py, tingido(PINTURA, 1.14 - 0.5 * (k / Math.max(1, fatias - 1)) ** 1.6), 17520 + k))
  }
  for (let j = 0; j < 2; j += 1) {
    const meia = r * (0.86 - 0.36 * j)
    const ponta = pontaEm(0) * 0.98 + ESTICA_O_DE_BAIXO * (j + 1)
    S.push({ forma: noAlto(bloco(-ponta, -meia, ponta, meia, meia * 0.6)), z: zMeio - e * j, solta: true, forca: 0 })
    const [px, py] = pt(-ponta + ESTICA_O_DE_BAIXO / 2, 0)
    L.push(pingo(P, px, py, tingido(PINTURA, 0.58 - 0.1 * j), 17540 + j))
  }
  // De cima: as faixas ao comprido, a de cima (norte) clara e a de baixo escura, cada uma com as pontas abauladas.
  for (let i = 0; i < FAIXAS; i += 1) {
    const [v0, v1] = [-r + (2 * r * i) / FAIXAS, -r + (2 * r * (i + 1)) / FAIXAS]
    const meio = (v0 + v1) / 2
    const ponta = pontaEm(Math.abs(meio))
    const tom = 1.16 - 0.42 * (i / (FAIXAS - 1)) ** 1.3
    L.push(P(bloco(-ponta, v0, ponta, v1 + 0.3, 1.2), PINTURA, { tabua: 0, eixo: deitado ? 0 : Math.PI / 2, bisel: 0.3, tom, contorno: i === 0 || i === FAIXAS - 1 ? 0.3 : 0.06, metal: 0.24, semente: 17550 + i }))
  }
  // As duas costuras de solda de través, em pedaços, um por faixa (cada pedaço sobe com a fatia da faixa dele).
  COSTURAS.forEach((t, i) => {
    for (let k = 0; k < FAIXAS; k += 1) {
      const [a, b] = [pt(t * U, -r + (2 * r * k) / FAIXAS + 0.2), pt(t * U, -r + (2 * r * (k + 1)) / FAIXAS - 0.2)]
      L.push(P(capsula(a[0], a[1], b[0], b[1], 0.35), tingido(PINTURA, 0.7), { tabua: 0, bisel: 0, contorno: 0, alfa: 0.8, semente: 17560 + i * FAIXAS + k }))
    }
  })

  // ---------- no alto: a passarela de grade com o corrimão, a boca de visita, o respiro e o losango ----------
  const mp = MEIA_PASSARELA * r
  L.push(P(bloco(-PASSARELA * U, -mp, PASSARELA * U, mp, 0.5), GRADE, { tabua: 1.6, eixo: deitado ? Math.PI / 2 : 0, bisel: 0.5, tom: 0.96, contorno: 0.32, metal: 0.3, projeta: { dist: 1.2, forca: 0.32 }, semente: 17570 }))
  const [c0, c1] = [pt(-PASSARELA * U, -mp - 1.2), pt(PASSARELA * U, -mp - 1.2)]
  L.push(P(capsula(c0[0], c0[1], c1[0], c1[1], 0.6), GRADE, { tabua: 0, bisel: 0.4, tom: 1.15, contorno: 0.3, metal: 0.4, projeta: { dist: 1.6, forca: 0.34 }, semente: 17571 }))
  for (let k = 0; k <= 4; k += 1) {
    L.push(P(disco((-PASSARELA + (2 * PASSARELA * k) / 4) * U, -mp - 1.2, 0.95), GRADE, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.4, semente: 17572 + k }))
  }
  const bocaR = 0.2 * r
  L.push(P(disco(BOCA_EM * U, 0, bocaR), PINTURA, { tabua: 0, bisel: 1, tom: 1.08, contorno: 0.34, metal: 0.3, projeta: { dist: 1.2, forca: 0.32 }, semente: 17580 }))
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * 2 * Math.PI
    L.push(P(disco(BOCA_EM * U + Math.cos(a) * bocaR * 0.78, Math.sin(a) * bocaR * 0.78, 0.5), GRADE, { tabua: 0, bisel: 0.3, contorno: 0.2, metal: 0.4, semente: 17581 + k }))
  }
  L.push(P(disco(RESPIRO_EM * U, 0, 2.6), GRADE, { tabua: 0, bisel: 1.2, tom: 1, contorno: 0.34, metal: 0.36, projeta: { dist: 1.4, forca: 0.34 }, semente: 17590 }))
  L.push(P(disco(RESPIRO_EM * U - 0.6, -0.6, 0.9), GRADE, { tabua: 0, bisel: 0.3, tom: 1.3, contorno: 0, metal: 0.5, semente: 17591 }))
  // O losango de inflamável na faixa clara, entre a passarela e a ponta do oeste.
  const [lx, ly] = pt(-0.78 * U, -0.1 * r)
  const lr = 0.3 * r
  L.push(P(poligono([[lx, ly - lr], [lx + lr, ly], [lx, ly + lr], [lx - lr, ly]]), BRANCO, { tabua: 0, bisel: 0, contorno: 0.24, semente: 17592 }))
  L.push(P(poligono([[lx, ly - lr * 0.75], [lx + lr * 0.75, ly], [lx, ly + lr * 0.75], [lx - lr * 0.75, ly]]), VERMELHO, { tabua: 0, bisel: 0, contorno: 0.1, semente: 17593 }))

  // ---------- a bomba vermelha na ponta do leste, com a mangueira enrolada ----------
  const ub = (pontaEm(0) + DU - PAREDE_DO_DIQUE) / 2
  const bomba = bloco(ub - MEIA_BOMBA, -r * 0.9 - MEIA_BOMBA, ub + MEIA_BOMBA, -r * 0.9 + MEIA_BOMBA, 1)
  S.push({ forma: bomba, z: ALTURA_DA_BOMBA * lado })
  L.push(P(bomba, BOMBA, { tabua: 0, bisel: 1, contorno: 0.32, metal: 0.24, semente: 17600 }))
  const [vx, vy] = pt(ub, -r * 0.9)
  L.push(P(elipse(vx, vy, 2.2, 2.2), BRANCO, { tabua: 0, bisel: 0.4, tom: 0.9, contorno: 0.3, semente: 17601 }))
  const [mx, my] = pt(ub, r * 0.35)
  const mangueira = anel(mx, my, MANGUEIRA[0], MANGUEIRA[0], MANGUEIRA[1], MANGUEIRA[1])
  S.push(contato(mangueira, 0.26))
  L.push(P(mangueira, BORRACHA, { tabua: 0, bisel: 0.8, contorno: 0.3, tom: 1 + 0.1 * hash(1, 2, 1760), semente: 17602 }))
  const [b0, b1] = [pt(ub, -r * 0.9 + MEIA_BOMBA), pt(ub, r * 0.35 - MANGUEIRA[0])]
  L.push(P(capsula(b0[0], b0[1], b1[0], b1[1], 1), BORRACHA, { tabua: 0, bisel: 0.6, contorno: 0.3, semente: 17603 }))
}
