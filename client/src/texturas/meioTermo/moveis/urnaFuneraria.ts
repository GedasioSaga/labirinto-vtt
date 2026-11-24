/**
 * URNA FUNERÁRIA (lote L05 de 24/11/2026, item 48, do tema da cripta do mapa 8; desenho próprio, só a ideia do
 * objeto): o vaso de pedra polida para as cinzas, pequeno o bastante para ir em cima de um nicho ou de um pedestal.
 *
 * DESENHADO DE FRENTE nas duas vistas, como o crânio e a lápide (perfil `EM_PE`), visto um pouco de cima: do alto,
 * uma urna é uma roda de círculos e lê como pote ou bacia; o que diz "urna" é a silhueta. De baixo para cima: o PÉ
 * em degrau, a haste curta, o BOJO oval com as duas ASAS em argola, os dois frisos gravados e a moldura oval do meio
 * (o lugar do nome), o GARGALO, a BOCA (a beira de cima, vista um pouco do alto) e a TAMPA em cúpula com o BOTÃO. A
 * luz é a de sempre (de cima, à esquerda): o bisel largo arredonda o bojo, o lado direito escurece e um brilho
 * suave mostra a pedra polida. A sombra sai do pé, para baixo à direita.
 *
 * O desenho é feito em 28 x 28 px (meia casa) e cresce pelo menor lado da pegada, centrado: esticada, a urna
 * continua redonda. Material: `pedra`.
 */
import type { Rgb } from '../../ruido'
import { anel, caixa, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato } from './motor'
import type { MontarMovel } from './contexto'

/** O escuro da pedra (o do túmulo e do pilar): com a nogueira do padrão, a beira da urna saía avermelhada. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** O lado do desenho (px do protótipo): meia casa. */
const LADO_DO_DESENHO = 28
/** A altura da urna (casas, no tamanho do desenho): a sombra no chão. */
const ALTURA = 0.52

export const montarUrnaFuneraria: MontarMovel = (c, cena) => {
  const P = c.peca
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const k = Math.min(c.w, c.h) / LADO_DO_DESENHO
  const pt = (x: number, y: number): Ponto => [x * k, y * k]
  const ret = (x0: number, y0: number, x1: number, y1: number, raio = 0): Forma => caixa(x0 * k, y0 * k, x1 * k, y1 * k, raio * k)
  const oval = (x: number, y: number, rx: number, ry: number): Forma => elipse(x * k, y * k, rx * k, ry * k)

  // A sombra: a urna inteira, do pé até o botão, cai para baixo à direita; o contato firme debaixo do pé. A faixa do
  // pé é uma cápsula e não um oval: a distância do oval fino é aproximada longe da beira e, arrastada, a sombra saía
  // em listras (a folha do lote a 4x).
  cena.sombras.push({ forma: ret(-4.8, 10.6, 4.8, 12, 0.7), z: c.g * ALTURA * k, forca: 0.3 }, contato(oval(0, 11.8, 5.8, 1.5), 0.34))

  // As ASAS em argola, atrás do bojo (o bojo cobre a ponta de dentro delas).
  for (const lado of [-1, 1]) {
    L.push(P(anel(lado * 8.2 * k, -2.4 * k, 2.6 * k, 3 * k, 1.3 * k, 1.8 * k), pedra, { tabua: 0, bisel: 0.8 * k, tom: lado < 0 ? 0.98 : 0.8, contorno: 0.3, semente: 4800 + lado }))
  }

  // O PÉ em degrau e a HASTE.
  L.push(P(poligono([pt(-5.6, 12), pt(5.6, 12), pt(4.6, 9.8), pt(-4.6, 9.8)]), pedra, { tabua: 0, bisel: 0.8 * k, tom: 0.84, contorno: 0.32, semente: 4810 }))
  L.push(P(ret(-4.6, 9, 4.6, 10.1, 0.5), pedra, { tabua: 0, bisel: 0.5 * k, tom: 1.02, contorno: 0.26, semente: 4811 }))
  L.push(P(ret(-2.5, 6.4, 2.5, 9.2, 0.4), pedra, { tabua: 0, bisel: 0.8 * k, tom: 0.76, contorno: 0.3, semente: 4812 }))

  // O BOJO: o oval com o bisel largo, o lado direito na sombra e o brilho da pedra polida.
  const bojo = oval(0, 0.2, 8.4, 7.4)
  L.push(P(bojo, pedra, { tabua: 0, bisel: 3.4 * k, tom: 0.98, contorno: 0.3, semente: 4820 }))
  L.push(P(dentroDe(oval(3.4, 2, 7, 7.4), bojo), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, alfa: 0.32, suave: 2.6 * k, semente: 4821 }))
  L.push(P(oval(-3.6, -2.4, 1.9, 2.6), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 1.3, alfa: 0.34, suave: 1.4 * k, semente: 4822 }))

  // Os FRISOS gravados do ombro e de baixo, e a MOLDURA oval do meio, rebaixada.
  const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, recesso: { k: 0.4 * k, forca: 0.3 } }
  L.push(P(dentroDe(ret(-9, -4.1, 9, -3.2), bojo), pedra, { ...gravada, semente: 4830 }))
  L.push(P(dentroDe(ret(-9, 4.3, 9, 5), bojo), pedra, { ...gravada, semente: 4831 }))
  L.push(P(anel(-0.4 * k, 0.6 * k, 3.4 * k, 2.4 * k, 2.6 * k, 1.7 * k), pedra, { ...gravada, tom: 0.7, semente: 4832 }))

  // O GARGALO, a BOCA vista um pouco de cima e a TAMPA em cúpula, com a sombra dela na beira.
  L.push(P(ret(-3.8, -8.6, 3.8, -5.6, 0.6), pedra, { tabua: 0, bisel: 1 * k, tom: 0.86, contorno: 0.3, semente: 4840 }))
  L.push(P(oval(0, -8.6, 5, 1.5), pedra, { tabua: 0, bisel: 0.6 * k, tom: 1.1, contorno: 0.28, semente: 4841 }))
  L.push(P(dentroDe(oval(0, -8.9, 4.5, 4.2), ret(-5, -13.4, 5, -8.9)), pedra, { tabua: 0, bisel: 1.6 * k, tom: 1, contorno: 0.28, projeta: { dist: 0.6 * k, forca: 0.26 }, semente: 4842 }))
  L.push(P(oval(0, -9, 4.6, 0.9), pedra, { tabua: 0, bisel: 0.4 * k, tom: 0.84, contorno: 0.22, semente: 4843 }))

  // O BOTÃO da tampa: o pescoço e a bola, com o brilho.
  L.push(P(ret(-0.9, -14.6, 0.9, -12.8, 0.3), pedra, { tabua: 0, bisel: 0.4 * k, tom: 0.86, contorno: 0.26, semente: 4850 }))
  L.push(P(oval(0, -15.4, 1.8, 1.6), pedra, { tabua: 0, bisel: 0.9 * k, tom: 1.06, contorno: 0.28, semente: 4851 }))
  L.push(P(oval(-0.6, -15.9, 0.6, 0.5), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 1.3, alfa: 0.4, suave: 0.4 * k, semente: 4852 }))
}
