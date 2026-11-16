/**
 * BIDÊ de cima com volume (banheiro moderno, pedido do mestre de 15/11/2026): a peça de LOUÇA branca de chão,
 * encostada na parede (o fundo, a beira de cima), irmã do vaso sanitário moderno. De cima se vê a borda larga de
 * cantos macios, reta atrás e redonda na frente, a BACIA funda no meio (a parede de dentro na sombra da borda do lado
 * da luz e o fundo um degrau mais escuro), o RALO de cromo no fundo e, na laje de trás, o MISTURADOR monocomando de
 * CROMO: a base redonda, a bica que avança sobre a bacia e a alavanca para trás. Sem tampa e sem caixa: é a bacia
 * aberta com a torneira que diz "bidê" e não "vaso" de longe.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado, beirada de `ESPESSURA_DA_BORDA_DO_BIDE`, a mesma do vaso moderno): o PÉ é uma
 * coluna mais estreita e a BORDA é um tampo solto na altura dela, com a beirada da grossura da louça; a bacia, o ralo
 * e o misturador sobem com a borda. O giro não muda nada.
 *
 * Sem material escolhido: a louça e o cromo são fixos.
 */
import { caixa, capsula, elipse, uniao } from './formas'
import { contato } from './motor'
import type { MontarMovel } from './contexto'
import { BORDA_DA_LOUCA, BRILHO_DO_CROMO, CROMO, ESCURO, LOUCA, PISO_DO_BANHEIRO, REFLEXO, texLouca } from './apoioDoBanheiroModerno'

/** A grossura da borda do bidê (px do protótipo), a mesma do vaso: o perfil da 3/4 em `tresQuartos.ts` usa este valor. */
export const ESPESSURA_DA_BORDA_DO_BIDE = BORDA_DA_LOUCA

/** A altura da borda, em casas (a do assento do vaso). */
const ALTURA = 0.28
/** A laje de trás (onde fica o misturador), em fração da fundura, e o raio dos cantos de trás (px). */
const LAJE_DE_TRAS = 0.27
const CANTO_DE_TRAS = 3
/** A bacia: a meia largura e a meia fundura em fração da borda, e a largura da borda em volta (px). */
const BACIA = { largura: 0.7, fundura: 0.74 } as const
const PAREDE_DA_BACIA = 2.2
/** O pé: a parte da borda que ele ocupa (de lado e ao comprido). */
const PE = { largura: 0.62, comprido: 0.7 } as const

export const montarBide: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  cena.corDoPiso = PISO_DO_BANHEIRO
  // A borda: a laje reta de trás unida ao oval da frente (de lado a lado da pegada).
  const yLaje = -hh + h * LAJE_DE_TRAS
  const cy = (yLaje - 2 + hh) / 2
  const ry = (hh - (yLaje - 2)) / 2
  const oval = elipse(0, cy, hw, ry)
  const laje = caixa(-hw, -hh, hw, cy, CANTO_DE_TRAS)
  const borda = uniao(laje, oval)
  const pe = elipse(0, cy - ry * 0.12, hw * PE.largura, hh * PE.comprido)

  const zBorda = g * ALTURA
  cena.sombras.push(
    { forma: pe, z: zBorda - ESPESSURA_DA_BORDA_DO_BIDE - 0.4 },
    contato(pe, 0.32),
    { forma: borda, z: zBorda, solta: true, forca: 0.22 },
  )

  const L = cena.partes
  L.push(P(borda, LOUCA, { bisel: 2, contorno: 0.24, textura: texLouca, semente: 9201 }))
  // A BACIA: a parede de dentro, na sombra da borda do lado da luz, e o fundo um degrau abaixo.
  const bx = hw * BACIA.largura
  const by = ry * BACIA.fundura
  const yBacia = cy + 0.8
  L.push(P(elipse(0, yBacia, bx, by), LOUCA, { bisel: 0.5, tom: 0.9, contorno: 0.26, recesso: { k: 2.6, forca: 0.36 }, textura: texLouca, semente: 9202 }))
  L.push(P(elipse(0.4, yBacia + 0.9, bx - PAREDE_DA_BACIA, by - PAREDE_DA_BACIA), LOUCA, { bisel: 1.6, tom: 0.84, contorno: 0, textura: texLouca, semente: 9203 }))
  // O RALO de cromo no fundo, com o furo escuro.
  const yRalo = yBacia + by * 0.28
  L.push(P(elipse(0, yRalo, 1.7, 1.5), CROMO, { bisel: 1, contorno: 0.26, metal: BRILHO_DO_CROMO, semente: 9204 }))
  L.push(P(elipse(0, yRalo, 0.75, 0.65), ESCURO, { bisel: 0, contorno: 0, semente: 9205 }))
  // O brilho da borda polida, do lado da luz.
  L.push(P(elipse(-hw * 0.62, cy - ry * 0.28, hw * 0.16, ry * 0.36), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.35, suave: 1.2, semente: 9206 }))

  // O MISTURADOR na laje de trás: a base redonda, a bica sobre a bacia e a alavanca para trás.
  const yBase = (-hh + yLaje) / 2 + 0.6
  L.push(P(capsula(0, yBase - 1, 0, yBase - 4.2, 0.85), CROMO, { bisel: 0.8, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9207, projeta: { dist: 1.2, forca: 0.28 } }))
  L.push(P(capsula(0, yBase, 0, yBacia - by + 1.4, 1.2), CROMO, { bisel: 1.05, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9208, projeta: { dist: 1.8, forca: 0.3 } }))
  L.push(P(elipse(0, yBase, 2.3, 2.3), CROMO, { bisel: 1.8, contorno: 0.28, metal: BRILHO_DO_CROMO, semente: 9209, projeta: { dist: 1.2, forca: 0.28 } }))
}
