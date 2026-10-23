/**
 * MESA REDONDA de cima com volume (peça nova da MT4), coerente com a mesa de
 * 2 x 1 (`mesa.ts`): a mesma altura (meia casa) com a sombra do tampo solto,
 * quatro pernas (nas diagonais, por baixo do tampo, só a sombra delas
 * aparece) e o tampo de tábuas com o chanfro de borda, como o da mesa antiga.
 * Revisão da MT4: a tira de borda com o veio dando a volta lia como o sulco da
 * tampa de um barril. Material: `madeira`.
 */
import { caixa, elipse } from './formas'
import { contato } from './motor'
import type { MontarMovel } from './contexto'

export const montarMesaRedonda: MontarMovel = (c, cena) => {
  const { hw, hh, h, peca: P } = c
  const mad = c.m.madeira
  const H = c.g * 0.5
  cena.sombras.push({ forma: elipse(0, 0, hw, hh), z: H, solta: true })
  for (const a of [0.25, 0.75, 1.25, 1.75]) {
    const lx = Math.cos(a * Math.PI) * hw * 0.62
    const ly = Math.sin(a * Math.PI) * hh * 0.62
    cena.sombras.push(contato(caixa(lx - 3, ly - 3, lx + 3, ly + 3), 0.32), { forma: caixa(lx - 2.5, ly - 2.5, lx + 2.5, ly + 2.5), z: H - 4, forca: 0.26 })
  }
  cena.partes.push(P(elipse(0, 0, hw, hh), mad, { tabua: h / 4.6, bisel: 2, semente: 70 }))
}
