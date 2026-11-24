/**
 * VASO COM PIA DE AÇO de cima com volume (lote L10 de 24/11/2026, presídio moderno; versão do vaso sanitário
 * moderno): a peça de cela feita de uma chapa de inox só, privada e pia no mesmo bloco, sem tampa e sem assento solto
 * (nada que se arranque nem vire arma). Encostada na parede do fundo (a beira de cima) fica a TORRE da pia; no tampo
 * dela, a cuba rasa com o ralo e a bica curta, os dois botões de apertar (o grande é a descarga, o pequeno a água) e
 * os quatro parafusos de segurança nos cantos. Na frente fica o DECK do vaso, uma chapa larga escovada de trás para a
 * frente, com o aro contornado em volta da boca e, lá no fundo, a água escura com um brilho.
 *
 * O que diz "presídio" de longe é o bloco único e cinza, sem a louça branca e sem a tampa do vaso moderno: a torre
 * alta atrás e o oval escuro da boca no deck. A 1x sobram o retângulo claro da torre, o deck arredondado e o furo.
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): a torre e o deck são colunas do chão até a altura de cada um. A frente
 * varrida é lisa; as duas peças que só a 3/4 vê (`soNaTresQuartos`, sem giro) põem o escovado de pé e a tampa de
 * inspeção parafusada na frente da torre (por baixo do deck) e a faixa de luz na frente curva do deck (por cima
 * dele). Com giro elas somem, e a 3/4 mostra a lateral ou as costas lisas, que é o que se veria.
 *
 * Sem material escolhido: o inox, a água e o escuro das frestas são fixos.
 */
import { anel, caixa, capsula, elipse, uniao } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { QUARTO, type MontarMovel } from './contexto'
import { ESCURO, ESCURO_DO_INOX, INOX, texEscovado } from './geladeira'
import { REFLEXO, soNaTresQuartos, type PecaDaTela } from './apoioDoBanheiroModerno'

/** Alturas em casas: a torre da pia (1 m) e o deck do vaso (0,45 m). */
const ALTURA_DA_TORRE = 0.68
const ALTURA_DO_DECK = 0.3
/** A torre ocupa esta parte da fundura da pegada; o deck, esta parte da meia largura. */
const FUNDURA_DA_TORRE = 0.36
const MEIA_LARGURA_DO_DECK = 0.86
/** O brilho do aço escovado (o `metal` do motor) e o dos botões e da bica, polidos. */
const BRILHO_DO_ACO = 0.38
const BRILHO_POLIDO = 0.75
/** A boca do vaso (raios e quanto ela recua da frente do deck, px) e o aro contornado em volta dela. */
const BOCA = { rx: 6.6, ry: 8.2, recuo: 4.2 } as const
const ARO = 2.4
/** A cuba: o recuo da beira da torre e o quanto ela vai na largura (fração da meia largura a partir do meio). */
const CUBA = { recuo: 2.4, ate: 0.3, frente: 2.4 } as const
/** Os botões de apertar: raio da descarga e da água (px). */
const BOTAO_DA_DESCARGA = 2.2
const BOTAO_DA_AGUA = 1.6
/** A água do fundo do vaso: cinza-esverdeado escuro, contido. */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x58, 0x66, 0x69] }

export const montarVasoComPiaDeAco: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  cena.corDoPiso = ESCURO_DO_INOX
  const zTorre = g * ALTURA_DA_TORRE
  const zDeck = g * ALTURA_DO_DECK
  const yTorre = -hh + h * FUNDURA_DA_TORRE
  const torre = caixa(-hw, -hh, hw, yTorre, 2.2)
  // O deck: um retângulo que entra debaixo da torre e a frente redonda (meia elipse).
  const rx = hw * MEIA_LARGURA_DO_DECK
  const yFrente = hh - 0.6
  const ry = (yFrente - yTorre) * 0.55
  const cyFrente = yFrente - ry
  const deck = uniao(caixa(-rx, yTorre - 2, rx, cyFrente, 1.2), elipse(0, cyFrente, rx, ry))

  cena.sombras.push({ forma: torre, z: zTorre }, contato(torre, 0.32), { forma: deck, z: zDeck }, contato(deck, 0.3))
  const L = cena.partes
  const aco = { tabua: 0, metal: BRILHO_DO_ACO, textura: texEscovado }
  const polido = { tabua: 0, metal: BRILHO_POLIDO }
  const liso = { tabua: 0, bisel: 0, contorno: 0 }

  // O DECK escovado de trás para a frente, o aro contornado em volta da boca e a boca: a parede inclinada (o aro faz
  // sombra no alto à esquerda), a garganta mais funda e a água com o brilho.
  L.push(P(deck, INOX, { ...aco, eixo: QUARTO, bisel: 1.5, contorno: 0.26, semente: 9701 }))
  const cyBoca = yFrente - BOCA.recuo - BOCA.ry
  L.push(P(anel(0, cyBoca, BOCA.rx + ARO, BOCA.ry + ARO, BOCA.rx, BOCA.ry), INOX, { ...aco, eixo: QUARTO, bisel: 1.2, tom: 1.05, contorno: 0.16, semente: 9702, projeta: { dist: 0.5, forca: 0.16 } }))
  L.push(P(elipse(0, cyBoca, BOCA.rx, BOCA.ry), INOX, { ...aco, bisel: 0.8, tom: 0.8, contorno: 0.26, recesso: { k: 2.6, forca: 0.38 }, semente: 9703 }))
  L.push(P(elipse(0, cyBoca + 0.6, BOCA.rx * 0.66, BOCA.ry * 0.62), INOX, { ...liso, tom: 0.66, alfa: 0.85, suave: 1.6, semente: 9704 }))
  L.push(P(elipse(0, cyBoca - BOCA.ry * 0.12, BOCA.rx * 0.46, BOCA.ry * 0.4), AGUA, { tabua: 0, bisel: 0.5, contorno: 0.14, semente: 9705 }))
  L.push(P(elipse(-BOCA.rx * 0.16, cyBoca - BOCA.ry * 0.25, BOCA.rx * 0.17, BOCA.ry * 0.09), REFLEXO, { ...liso, alfa: 0.45, suave: 0.6, semente: 9706 }))

  // A TORRE, mais alta: o tampo escovado de lado a lado, que faz sombra no deck.
  L.push(P(torre, INOX, { ...aco, eixo: 0, bisel: 1.7, contorno: 0.26, semente: 9710, projeta: { dist: 2.2, forca: 0.3, suave: 1.4 } }))
  // A cuba rasa à esquerda, o ralo e a bica curta junto da parede.
  const [cx0, cx1] = [-hw + CUBA.recuo, hw * CUBA.ate]
  const [cy0, cy1] = [-hh + CUBA.recuo + 0.8, yTorre - CUBA.frente]
  const xCuba = (cx0 + cx1) / 2
  const yCuba = (cy0 + cy1) / 2
  L.push(P(caixa(cx0, cy0, cx1, cy1, 2.8), INOX, { ...aco, eixo: 0, bisel: 0.7, tom: 0.84, contorno: 0.24, recesso: { k: 2, forca: 0.32 }, semente: 9711 }))
  L.push(P(elipse(xCuba + 1, yCuba + 0.5, 1.5, 1.5), INOX, { ...polido, bisel: 0.5, tom: 0.95, contorno: 0.26, semente: 9712 }))
  L.push(P(elipse(xCuba + 1, yCuba + 0.5, 0.8, 0.8), ESCURO, { ...liso, alfa: 0.85, semente: 9713 }))
  L.push(P(capsula(xCuba, -hh + 1.3, xCuba, cy0 + 1.6, 0.95), INOX, { ...polido, bisel: 0.8, tom: 1.1, contorno: 0.26, semente: 9714, projeta: { dist: 0.8, forca: 0.3 } }))
  // Os dois botões à direita, cada um na cova escura dele.
  const xBotoes = (cx1 + hw) / 2 + 0.3
  const botoes: readonly (readonly [number, number])[] = [[yTorre - 4.2, BOTAO_DA_DESCARGA], [-hh + 4.2, BOTAO_DA_AGUA]]
  botoes.forEach(([y, r], i) => {
    L.push(P(elipse(xBotoes, y, r + 0.7, r + 0.7), ESCURO, { ...liso, alfa: 0.45, suave: 0.5, semente: 9720 + i }))
    L.push(P(elipse(xBotoes, y, r, r), INOX, { ...polido, bisel: r * 0.7, tom: 1.06, contorno: 0.28, semente: 9722 + i }))
  })
  // Os parafusos de segurança nos quatro cantos do tampo.
  for (const sx of [-1, 1]) {
    for (const y of [-hh + 1.5, yTorre - 1.5]) L.push(P(elipse(sx * (hw - 1.5), y, 0.75, 0.75), ESCURO, { tabua: 0, bisel: 0.3, contorno: 0.2, tom: 1.3, semente: 9730 }))
  }

  // Só a 3/4: a frente da torre (o escovado de pé e a tampa de inspeção com quatro parafusos), presa antes do deck,
  // que a cobre embaixo; e a faixa de luz na frente curva do deck, por cima dele.
  const topoDaTorre = yTorre - zTorre
  const tampa = { x: 7, de: topoDaTorre + 5, ate: topoDaTorre + 12.5 } as const
  const frenteDaTorre: PecaDaTela[] = [
    { forma: caixa(-hw + 0.5, topoDaTorre + 0.7, hw - 0.5, yTorre - 0.3, 1.4), mat: INOX, o: { ...aco, eixo: QUARTO, bisel: 0.6, tom: 0.8, contorno: 0.2, semente: 9740 } },
    { forma: caixa(-tampa.x, tampa.de, tampa.x, tampa.ate, 0.8), mat: INOX, o: { ...aco, eixo: QUARTO, bisel: 0.5, tom: 0.9, contorno: 0.26, semente: 9741 } },
  ]
  for (const sx of [-1, 1]) {
    for (const y of [tampa.de + 1.3, tampa.ate - 1.3]) frenteDaTorre.push({ forma: elipse(sx * (tampa.x - 1.3), y, 0.6, 0.6), mat: ESCURO, o: { tabua: 0, bisel: 0.2, contorno: 0.2, tom: 1.25, semente: 9742 } })
  }
  soNaTresQuartos(P, cena, 0, yTorre + 0.4, frenteDaTorre)
  const arcoDaFrente = (f: number): number => cyFrente + ry * Math.sqrt(1 - f * f)
  const baseDaLuz = arcoDaFrente(0.56)
  soNaTresQuartos(P, cena, 0, hh + 0.3, [
    { forma: caixa(-rx * 0.56, baseDaLuz - zDeck + 1.8, -rx * 0.38, baseDaLuz - 1.2, 1), mat: REFLEXO, o: { ...liso, alfa: 0.2, suave: 1.2, semente: 9750 } },
  ])
}
