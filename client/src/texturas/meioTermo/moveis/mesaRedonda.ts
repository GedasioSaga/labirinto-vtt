/**
 * MESA REDONDA de cima com volume (peça nova da MT4), coerente com a mesa de
 * 2 x 1 (`mesa.ts`): a mesma altura (meia casa) com a sombra do tampo solto,
 * quatro pernas (nas diagonais, por baixo do tampo, só a sombra delas
 * aparece) e o tampo de tábuas. A borda do tampo é uma tira mais escura com o
 * veio dando a volta: diz que o tampo é redondo e tem espessura. Material:
 * `madeira`.
 */
import { anel, caixa, elipse } from './formas'
import { contato } from './motor'
import type { MontarMovel } from './contexto'

/** Largura da tira da borda, em fração do raio. */
const BORDA = 0.1

export const montarMesaRedonda: MontarMovel = (c, cena) => {
  const { hw, hh, h, peca: P } = c
  const mad = c.m.madeira
  const H = c.g * 0.5
  const R = Math.min(hw, hh)
  cena.sombras.push({ forma: elipse(0, 0, hw, hh), z: H, solta: true })
  for (const a of [0.25, 0.75, 1.25, 1.75]) {
    const lx = Math.cos(a * Math.PI) * hw * 0.62
    const ly = Math.sin(a * Math.PI) * hh * 0.62
    cena.sombras.push(contato(caixa(lx - 3, ly - 3, lx + 3, ly + 3), 0.32), { forma: caixa(lx - 2.5, ly - 2.5, lx + 2.5, ly + 2.5), z: H - 4, forca: 0.26 })
  }
  cena.partes.push(P(elipse(0, 0, hw * (1 - BORDA) + 0.6, hh * (1 - BORDA) + 0.6), mad, { tabua: h / 4.6, bisel: 0.8, semente: 70 }))
  cena.partes.push(P(anel(0, 0, hw, hh, hw * (1 - BORDA), hh * (1 - BORDA)), mad, { arco: { cx: 0, cy: 0, r: R * (1 - BORDA / 2), a0: 0 }, tabua: 0, bisel: 1.6, tom: 0.9, semente: 71 }))
}
