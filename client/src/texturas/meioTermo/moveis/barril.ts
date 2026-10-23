/**
 * BARRIL de cima com volume (`objetos.js:928-946`): o bojo com as aduelas
 * saindo do centro, dois aros, a borda das aduelas, a tampa afundada e o
 * batoque. Materiais: `madeira` e `aros`.
 */
import { anel, elipse } from './formas'
import { contato } from './motor'
import type { MontarMovel } from './contexto'

export const montarBarril: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const H = c.g * 0.62
  const mad = c.m.madeira
  const aro = c.m.aros
  const R = Math.min(hw, hh)
  const polar = { cx: 0, cy: 0, r: R }
  cena.sombras.push({ forma: elipse(0, 0, hw, hh), z: H }, contato(elipse(0, 0, hw, hh)))
  cena.partes.push(
    P(elipse(0, 0, hw, hh), mad, { polar, tabua: 5.6, bisel: R * 0.3, semente: 3 }),
    P(anel(0, 0, hw * 0.985, hh * 0.985, hw * 0.93, hh * 0.93), aro, { bisel: 0.9, contorno: 0.3, semente: 4 }),
    P(anel(0, 0, hw * 0.885, hh * 0.885, hw * 0.835, hh * 0.835), aro, { bisel: 0.8, contorno: 0.3, semente: 5 }),
    P(anel(0, 0, hw * 0.836, hh * 0.836, hw * 0.7, hh * 0.7), mad, { polar, tabua: 5.6, bisel: 1, luz: 0.07, semente: 3 }),
    P(elipse(0, 0, hw * 0.705, hh * 0.705), mad, { tabua: hh * 0.47, bisel: 0.5, recesso: { k: 2.4, forca: 0.36 }, semente: 6, tom: 0.93 }),
    P(elipse(hw * 0.3, hh * 0.2, R * 0.09, R * 0.09), mad, { tabua: 0, bisel: R * 0.09, tom: 0.62, contorno: 0.15 }),
  )
}
