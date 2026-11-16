/**
 * VASO SANITÁRIO MODERNO de cima com volume (banheiro moderno, pedido do mestre de 15/11/2026): o vaso de LOUÇA
 * branca com a CAIXA ACOPLADA, encostado na parede (o fundo, a beira de cima), e a TAMPA fechada. De cima se vê a
 * caixa de cantos macios com a tampa dela (a laje de cima, um degrau mais clara) e o botão de descarga duplo de
 * CROMO no meio; na frente, o oval do vaso: o aro de louça em volta, a beira do assento e a tampa por cima, com o
 * brilho largo da louça polida e as duas tampinhas cromadas da dobradiça junto da caixa. A privada antiga é a caixa
 * de madeira com o assento de madeira e a água à mostra; esta é toda branca e lisa, e o que diz "vaso" de longe é
 * o bloco da caixa diante do oval da tampa.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado, beirada de `ESPESSURA_DA_BORDA_DO_VASO_MODERNO`):
 * - a CAIXA é uma coluna do chão até a altura dela (de lado ela é o fundo do pé e a caixa numa peça só, como no vaso
 *   de verdade): a frente é a louça, e a tampa e o botão sobem com ela;
 * - o PÉ do vaso é uma coluna mais estreita e mais baixa que a borda (o vaso afina para o chão);
 * - a BORDA é um tampo solto na altura do assento, com a beirada da grossura dela: o assento e a tampa sobem com
 *   ela, e a silhueta fica a de louça de verdade, a borda larga em cima do pé estreito.
 * O giro não muda nada: a 3/4 gira as estruturas e a caixa fica atrás, do lado ou na frente, como de verdade.
 *
 * Sem material escolhido: a louça e o cromo são fixos (o estilo Moderno).
 */
import { caixa, elipse } from './formas'
import { contato } from './motor'
import type { MontarMovel } from './contexto'
import { BORDA_DA_LOUCA, BRILHO_DO_CROMO, CROMO, ESCURO, LOUCA, PISO_DO_BANHEIRO, REFLEXO, texLouca } from './apoioDoBanheiroModerno'

/** A grossura da borda do vaso (px do protótipo): o perfil da 3/4 em `tresQuartos.ts` usa este valor. */
export const ESPESSURA_DA_BORDA_DO_VASO_MODERNO = BORDA_DA_LOUCA

/** Alturas em casas: o assento (a borda do vaso) e a caixa acoplada. */
const ALTURA_DO_ASSENTO = 0.3
const ALTURA_DA_CAIXA = 0.58
/** A caixa: a fundura em fração da pegada e quanto ela é mais estreita que a pegada (px de cada lado). */
const FUNDURA_DA_CAIXA = 0.3
const RECUO_DA_CAIXA = 0.6
/** O vaso entra este tanto debaixo da caixa (px) e fica com esta meia largura (fração da meia pegada). */
const DEBAIXO_DA_CAIXA = 3
const MEIA_LARGURA_DO_VASO = 0.86
/** O pé: a parte da borda que ele ocupa (de lado e ao comprido) e quanto ele recua para trás (fração do raio). */
const PE = { largura: 0.6, comprido: 0.72, paraTras: 0.1 } as const
/** O assento e a tampa: quanto da borda eles cobrem e quanto andam para a frente (px). */
const ASSENTO = { parte: 0.955, frente: 0.5 } as const
const TAMPA = { parte: 0.915, frente: 0.7 } as const
/** O botão de descarga: o raio (px) e a fresta do meio. */
const RAIO_DO_BOTAO = 2.5
const FRESTA_DO_BOTAO = 0.36

export const montarVasoSanitarioModerno: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  cena.corDoPiso = PISO_DO_BANHEIRO
  const frenteDaCaixa = -hh + h * FUNDURA_DA_CAIXA
  const caixaDeDescarga = caixa(-hw + RECUO_DA_CAIXA, -hh, hw - RECUO_DA_CAIXA, frenteDaCaixa, 2.6)

  // O vaso: o oval da borda, com a ponta de trás debaixo da caixa.
  const yTras = frenteDaCaixa - DEBAIXO_DA_CAIXA
  const yFrente = hh - 0.3
  const cy = (yTras + yFrente) / 2
  const ry = (yFrente - yTras) / 2
  const rx = hw * MEIA_LARGURA_DO_VASO
  const borda = elipse(0, cy, rx, ry)
  const pe = elipse(0, cy - ry * PE.paraTras, rx * PE.largura, ry * PE.comprido)

  // As alturas da 3/4: a caixa e o pé são colunas; a borda é um tampo solto (a sombra dela é a do bojo no ar).
  const zAssento = g * ALTURA_DO_ASSENTO
  cena.sombras.push(
    { forma: caixaDeDescarga, z: g * ALTURA_DA_CAIXA },
    contato(caixaDeDescarga, 0.3),
    { forma: pe, z: zAssento - ESPESSURA_DA_BORDA_DO_VASO_MODERNO - 0.4 },
    contato(pe, 0.32),
    { forma: borda, z: zAssento, solta: true, forca: 0.22 },
  )

  const L = cena.partes
  // A BORDA de louça, o assento por cima dela (a beira dele aparece em volta da tampa) e a TAMPA fechada.
  L.push(P(borda, LOUCA, { bisel: 1.8, contorno: 0.24, textura: texLouca, semente: 9101 }))
  const assento = elipse(0, cy + ASSENTO.frente, rx * ASSENTO.parte, ry * ASSENTO.parte)
  L.push(P(assento, LOUCA, { bisel: 0.9, tom: 0.95, contorno: 0.3, textura: texLouca, semente: 9102, projeta: { dist: 0.7, forca: 0.22 } }))
  const tampa = elipse(0, cy + TAMPA.frente, rx * TAMPA.parte, ry * TAMPA.parte)
  L.push(P(tampa, LOUCA, { bisel: 2.6, tom: 1.02, contorno: 0.2, textura: texLouca, semente: 9103, projeta: { dist: 0.9, forca: 0.24 } }))
  // O brilho largo da tampa polida, do lado da luz.
  L.push(P(elipse(-rx * 0.28, cy - ry * 0.12, rx * 0.34, ry * 0.42), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.4, suave: 1.6, semente: 9104 }))
  // As duas tampinhas da dobradiça, junto da caixa (o meio delas fica fora da caixa: sobem com a borda).
  for (const lado of [-1, 1]) {
    L.push(P(elipse(lado * rx * 0.42, frenteDaCaixa + 1.6, 1.5, 1.1), CROMO, { bisel: 1.1, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9105, projeta: { dist: 0.6, forca: 0.24 } }))
  }

  // A CAIXA por cima (é mais alta): o corpo, a tampa dela um degrau mais clara e o botão duplo de cromo.
  L.push(P(caixaDeDescarga, LOUCA, { bisel: 2.2, tom: 0.97, contorno: 0.24, textura: texLouca, semente: 9110 }))
  const tampaDaCaixa = caixa(-hw + RECUO_DA_CAIXA + 1.3, -hh + 1.1, hw - RECUO_DA_CAIXA - 1.3, frenteDaCaixa - 1.2, 1.8)
  L.push(P(tampaDaCaixa, LOUCA, { bisel: 1.2, tom: 1.03, contorno: 0.16, textura: texLouca, semente: 9111 }))
  const yBotao = (-hh + frenteDaCaixa) / 2
  L.push(P(elipse(0, yBotao, RAIO_DO_BOTAO + 0.5, RAIO_DO_BOTAO + 0.5), ESCURO, { bisel: 0, contorno: 0, alfa: 0.35, suave: 0.6, semente: 9112 }))
  L.push(P(elipse(0, yBotao, RAIO_DO_BOTAO, RAIO_DO_BOTAO), CROMO, { bisel: 1.6, contorno: 0.3, metal: BRILHO_DO_CROMO, semente: 9113 }))
  // A fresta que divide o botão em dois (a metade grande e a pequena da descarga dupla).
  L.push(P(caixa(0.5 - FRESTA_DO_BOTAO / 2, yBotao - RAIO_DO_BOTAO + 0.4, 0.5 + FRESTA_DO_BOTAO / 2, yBotao + RAIO_DO_BOTAO - 0.4), ESCURO, { bisel: 0, contorno: 0, alfa: 0.8, semente: 9114 }))
}
