/**
 * URNA FUNERÁRIA (lote L05 de 24/11/2026, item 48, do tema da cripta do mapa 8; desenho próprio, só a ideia do
 * objeto): o vaso de pedra polida para as cinzas, pequeno o bastante para ir em cima de um nicho ou de um pedestal.
 *
 * DESENHADO DE FRENTE nas duas vistas, como o crânio e a lápide (perfil `EM_PE`), visto um pouco de cima: do alto,
 * uma urna é uma roda de círculos e lê como pote ou bacia; o que diz "urna" é a silhueta. De baixo para cima: o PÉ
 * baixo e largo em dois degraus, o colo curto, o BOJO de ovo invertido (o OMBRO largo a um terço do alto, afinando
 * até o pé), as duas VOLUTAS coladas no ombro, o friso gravado do ombro, a moldura oval do meio (o lugar do nome), a
 * BOCA (a beira de cima, vista um pouco do alto), a TAMPA em cúpula baixa e a PINHA no alto. A pedra é lisa e polida,
 * com um VEIO macio na diagonal. A luz é a de sempre (de cima, à esquerda): o bisel largo arredonda o bojo, o lado
 * direito escurece e um brilho suave mostra o polido. A sombra sai do pé, para baixo à direita.
 *
 * Revisão do diretor de arte (24/11): o bojo redondo com as asas em argola (com o furo) lia como ânfora ou troféu; o
 * grão da pedra saía em quadradinhos sobre a pedra polida; a sombra arrastada de uma faixa fina saía em listras.
 *
 * O desenho é feito em 28 x 28 px (meia casa) e cresce pelo menor lado da pegada, centrado: esticada, a urna
 * continua redonda. Material: `pedra`, sem o grão (polida).
 */
import type { Rgb } from '../../ruido'
import { anel, cadeia, caixa, dentroDe, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** O escuro da pedra (o do túmulo e do pilar): com a nogueira do padrão, a beira da urna saía avermelhada. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** O lado do desenho (px do protótipo): meia casa. */
const LADO_DO_DESENHO = 28
/** A altura da urna (casas, no tamanho do desenho): a sombra no chão. */
const ALTURA = 0.52
/**
 * O bojo de ovo invertido: o alto e o pé dele (y do desenho), a meia largura do ovo e o quanto ele pende para cima
 * (a largura vai de `LARGURA_DO_BOJO * raiz(1 - t²) * (1 - PENDE * t)`, com t de -1 no alto a 1 no pé: com 0,35 o
 * ombro fica a um terço do alto). O ovo é cortado em t = -0,9 (a boca) e em t = 0,95 (o colo).
 */
const ALTO_DO_BOJO = -7
const PE_DO_BOJO = 8.6
const LARGURA_DO_BOJO = 8.3
const PENDE = 0.35
const CORTE_DE_CIMA = -0.9
const CORTE_DE_BAIXO = 0.95
const PONTOS_DO_BOJO = 28

/** O contorno do bojo, de cima para baixo pelo lado direito e de volta pelo esquerdo (pontos do desenho). */
function contornoDoBojo(): Ponto[] {
  const b = (PE_DO_BOJO - ALTO_DO_BOJO) / (CORTE_DE_BAIXO - CORTE_DE_CIMA)
  const yc = ALTO_DO_BOJO - b * CORTE_DE_CIMA
  const direito: Ponto[] = []
  for (let i = 0; i <= PONTOS_DO_BOJO; i += 1) {
    const t = CORTE_DE_CIMA + ((CORTE_DE_BAIXO - CORTE_DE_CIMA) * i) / PONTOS_DO_BOJO
    direito.push([LARGURA_DO_BOJO * Math.sqrt(1 - t * t) * (1 - PENDE * t), yc + b * t])
  }
  return [...direito, ...direito.map(([x, y]): Ponto => [-x, y]).reverse()]
}

export const montarUrnaFuneraria: MontarMovel = (c, cena) => {
  const P = c.peca
  // A pedra polida: a cor do material sem o grão (o grão saía em quadradinhos no tamanho da urna).
  const pedra: MaterialDaPeca = { classe: 'liso', rgb: c.m.pedra.rgb }
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const k = Math.min(c.w, c.h) / LADO_DO_DESENHO
  const pt = (x: number, y: number): Ponto => [x * k, y * k]
  const ret = (x0: number, y0: number, x1: number, y1: number, raio = 0): Forma => caixa(x0 * k, y0 * k, x1 * k, y1 * k, raio * k)
  const oval = (x: number, y: number, rx: number, ry: number): Forma => elipse(x * k, y * k, rx * k, ry * k)

  // A sombra: a urna inteira, do pé até a pinha, cai para baixo à direita; o contato firme debaixo do pé. A forma
  // arrastada é a do pé inteiro (3,6 px de alto, cantos redondos): com uma faixa fina, as amostras do arraste se
  // separavam e a sombra saía em listras na diagonal.
  cena.sombras.push({ forma: ret(-5.4, 8.4, 5.4, 12, 1.8), z: c.g * ALTURA * k, forca: 0.3 }, contato(oval(0, 11.9, 6.8, 1.4), 0.34))

  // O PÉ baixo e largo, em dois degraus, e o COLO curto.
  L.push(P(poligono([pt(-6.6, 12), pt(6.6, 12), pt(6.2, 10.7), pt(-6.2, 10.7)]), pedra, { tabua: 0, bisel: 0.7 * k, tom: 0.82, contorno: 0.32, semente: 4810 }))
  L.push(P(ret(-5, 9.7, 5, 10.9, 0.5), pedra, { tabua: 0, bisel: 0.5 * k, tom: 1.02, contorno: 0.26, semente: 4811 }))
  L.push(P(poligono([pt(-1.9, 8.2), pt(1.9, 8.2), pt(2.6, 9.9), pt(-2.6, 9.9)]), pedra, { tabua: 0, bisel: 0.7 * k, tom: 0.76, contorno: 0.3, semente: 4812 }))

  // As VOLUTAS, coladas no ombro (atrás do bojo, que cobre a raiz delas): o rolo e o olho rebaixado de cada uma.
  const yOmbro = -2.6
  for (const lado of [-1, 1]) {
    L.push(P(elipseGirada(lado * 8.5 * k, (yOmbro - 1.2) * k, 1.9 * k, 1.5 * k, lado * 0.5), pedra, { tabua: 0, bisel: 0.8 * k, tom: lado < 0 ? 1 : 0.8, contorno: 0.3, semente: 4800 + lado }))
    L.push(P(oval(lado * 9.1, yOmbro - 1.5, 0.55, 0.55), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.62, recesso: { k: 0.3 * k, forca: 0.3 }, semente: 4803 }))
  }

  // O BOJO: o ovo invertido com o bisel largo, o lado direito na sombra, o brilho do polido e o veio na diagonal.
  const bojo = poligono(contornoDoBojo().map(([x, y]) => pt(x, y)))
  L.push(P(bojo, pedra, { tabua: 0, bisel: 3.2 * k, tom: 0.98, contorno: 0.3, semente: 4820 }))
  L.push(P(dentroDe(oval(3.8, 1, 7, 9), bojo), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, alfa: 0.3, suave: 2.6 * k, semente: 4821 }))
  L.push(P(oval(-3.8, -3.2, 1.8, 2.4), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 1.3, alfa: 0.34, suave: 1.4 * k, semente: 4822 }))
  const veio = { tabua: 0, bisel: 0, contorno: 0, tom: 0.74, suave: 0.6 * k }
  L.push(P(dentroDe(cadeia([pt(-7, -4.6), pt(-3.2, -1.4), pt(-0.6, 0.4), pt(2.8, 3.8), pt(5, 6.6)], 0.3 * k), bojo), pedra, { ...veio, alfa: 0.32, semente: 4823 }))
  L.push(P(dentroDe(cadeia([pt(-0.6, 0.4), pt(1.6, 0.8), pt(4.4, 0.2)], 0.22 * k), bojo), pedra, { ...veio, alfa: 0.22, semente: 4824 }))

  // O FRISO gravado do ombro e a MOLDURA oval do meio, rebaixada.
  const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, recesso: { k: 0.4 * k, forca: 0.3 } }
  L.push(P(dentroDe(ret(-9, -5.3, 9, -4.6), bojo), pedra, { ...gravada, semente: 4830 }))
  L.push(P(anel(-0.3 * k, 1.6 * k, 3.2 * k, 2.3 * k, 2.5 * k, 1.65 * k), pedra, { ...gravada, tom: 0.7, semente: 4832 }))

  // A BOCA vista um pouco de cima, a TAMPA em cúpula baixa (com a sombra dela na beira) e a PINHA.
  L.push(P(ret(-4.1, -8.4, 4.1, -6.6, 0.5), pedra, { tabua: 0, bisel: 0.8 * k, tom: 0.86, contorno: 0.3, semente: 4840 }))
  L.push(P(oval(0, -8.5, 5.1, 1.4), pedra, { tabua: 0, bisel: 0.6 * k, tom: 1.1, contorno: 0.28, semente: 4841 }))
  L.push(P(dentroDe(oval(0, -8.8, 4.5, 2.6), ret(-5, -11.6, 5, -8.8)), pedra, { tabua: 0, bisel: 1.2 * k, tom: 1, contorno: 0.28, projeta: { dist: 0.6 * k, forca: 0.26 }, semente: 4842 }))
  L.push(P(oval(0, -8.9, 4.6, 0.8), pedra, { tabua: 0, bisel: 0.4 * k, tom: 0.84, contorno: 0.22, semente: 4843 }))
  const pinha = uniao(oval(0, -12.5, 1.5, 1.6), poligono([pt(-1.3, -13), pt(1.3, -13), pt(0, -15.2)]))
  L.push(P(ret(-0.7, -11.9, 0.7, -11, 0.3), pedra, { tabua: 0, bisel: 0.3 * k, tom: 0.84, contorno: 0.24, semente: 4850 }))
  L.push(P(pinha, pedra, { tabua: 0, bisel: 0.7 * k, tom: 1.04, contorno: 0.28, semente: 4851 }))
  const escama = { tabua: 0, bisel: 0, contorno: 0, tom: 0.66, alfa: 0.6 }
  L.push(P(dentroDe(cadeia([pt(-1.2, -13.4), pt(0.6, -11.4)], 0.16 * k), pinha), pedra, { ...escama, semente: 4852 }))
  L.push(P(dentroDe(cadeia([pt(1.2, -13.4), pt(-0.6, -11.4)], 0.16 * k), pinha), pedra, { ...escama, semente: 4853 }))
  L.push(P(oval(-0.5, -13.2, 0.5, 0.6), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 1.3, alfa: 0.4, suave: 0.4 * k, semente: 4854 }))
}
