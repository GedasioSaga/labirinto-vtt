/**
 * BALCÃO de cima com volume (móveis de casa, 28/10/2026): o da cozinha e o da
 * taverna. ESTICA como o aparador: o mestre puxa o comprimento e as tábuas do
 * tampo correm por ele, sem nada que se repita por casa. A frente (o lado de
 * baixo, o do freguês) tem a moldura grossa do tampo e, rente ao chão, a
 * barra de pé de latão de ponta a ponta. A barra comprida e clara é o que
 * separa o balcão do aparador (que tem os dois puxadores no meio) a 25% de
 * zoom. A altura é a do aparador, perto da mesa, para a mesa posta (os Pratos)
 * ficar em cima dos dois na vista 3/4. Materiais: `madeira` e `barra`.
 */
import { caixa, capsula } from './formas'
import { contato } from './motor'
import type { MontarMovel } from './contexto'

/** Altura do balcão em casas (a do aparador). */
const ALTURA = 0.62
/** Altura da barra de pé em casas. */
const ALTURA_DA_BARRA = 0.14

export const montarBalcao: MontarMovel = (c, cena) => {
  const { hw, hh, h, peca: P } = c
  const mad = c.m.madeira
  // O tampo vai até a moldura; entre ela e a beira da frente fica a barra de pé.
  const fimDoTampo = hh - 0.24 * h
  const tampo = caixa(-hw, -hh, hw, fimDoTampo, 1.4)
  const yBarra = hh - 0.09 * h
  const barra = capsula(-hw + 2.4, yBarra, hw - 2.4, yBarra, 1.5)
  cena.sombras.push({ forma: tampo, z: c.g * ALTURA }, contato(tampo), { forma: barra, z: c.g * ALTURA_DA_BARRA, forca: 0.22 })
  const L = cena.partes
  L.push(P(tampo, mad, { tabua: 7, bisel: 1.6, semente: 661 }))
  // A prateleira de trás, um degrau abaixo do tampo: o lado de quem serve.
  L.push(P(caixa(-hw + 1.2, -hh, hw - 1.2, -hh + 0.2 * h, 0.8), mad, { tabua: 0, bisel: 0.8, tom: 0.72, recesso: { k: 1.4, forca: 0.22 }, semente: 664 }))
  // A moldura da frente: a beira grossa do tampo, mais clara, onde se debruça.
  L.push(P(caixa(-hw, fimDoTampo - 0.22 * h, hw, fimDoTampo, 1.2), mad, { tabua: 0, bisel: 1.3, luz: 0.08, semente: 662, projeta: { dist: 1.2, forca: 0.26 } }))
  L.push(P(barra, c.m.barra, { tabua: 0, bisel: 1, contorno: 0.2, semente: 663 }))
}
