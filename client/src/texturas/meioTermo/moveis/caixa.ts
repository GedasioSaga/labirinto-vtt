/**
 * CAIXA de madeira de cima com volume (`objetos.js:963-995`): o caixote com
 * moldura de 4 tábuas, tábuas afundadas no meio, o X das ripas por cima e um
 * prego em cada canto. Material: `madeira`.
 */
import { barra, caixa, dentroDe, elipse } from './formas'
import { contato, type MaterialDaPeca, type Peca } from './motor'
import { PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Um lado de caixote entre (x0, y0) e (x1, y1). `sem` = semente da primeira peça. */
function caixote(c: ContextoDoMovel, L: Peca[], x0: number, y0: number, x1: number, y1: number, mad: MaterialDaPeca, sem: number): void {
  const P = c.peca
  const m = Math.min(x1 - x0, y1 - y0) * 0.17
  const ix0 = x0 + m
  const iy0 = y0 + m
  const ix1 = x1 - m
  const iy1 = y1 - m
  const dentro = caixa(ix0, iy0, ix1, iy1)
  L.push(P(dentro, mad, { tabua: (iy1 - iy0) / 3, bisel: 0.5, recesso: { k: 2, forca: 0.34 }, tom: 0.9, semente: sem }))
  const larg = m * 0.9
  const a1 = Math.atan2(iy1 - iy0, ix1 - ix0)
  L.push(P(dentroDe(barra(ix0, iy0, ix1, iy1, larg), dentro), mad, { eixo: a1, tabua: 0, bisel: 0.9, semente: sem + 1 }))
  L.push(P(dentroDe(barra(ix1, iy0, ix0, iy1, larg), dentro), mad, { eixo: Math.PI - a1, tabua: 0, bisel: 0.9, semente: sem + 2, projeta: { dist: 1.1, forca: 0.3, suave: 0.7 } }))
  L.push(P(caixa(x0, y0, ix0, y1, 0.6), mad, { eixo: QUARTO, tabua: 0, bisel: 1, semente: sem + 3 }))
  L.push(P(caixa(ix1, y0, x1, y1, 0.6), mad, { eixo: QUARTO, tabua: 0, bisel: 1, semente: sem + 4 }))
  L.push(P(caixa(ix0, y0, ix1, iy0, 0.3), mad, { tabua: 0, bisel: 1, semente: sem + 5 }))
  L.push(P(caixa(ix0, iy1, ix1, y1, 0.3), mad, { tabua: 0, bisel: 1, semente: sem + 6 }))
  for (const [px, py] of [[x0 + m / 2, y0 + m / 2], [x1 - m / 2, y0 + m / 2], [x0 + m / 2, y1 - m / 2], [x1 - m / 2, y1 - m / 2]]) {
    L.push(P(elipse(px, py, 0.6, 0.6), PREGO, { bisel: 0.6, contorno: 0, metal: 0.2 }))
  }
}

export const montarCaixa: MontarMovel = (c, cena) => {
  const { hw, hh } = c
  const H = c.g * 0.5
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, hh), z: H }, contato(caixa(-hw, -hh, hw, hh)))
  caixote(c, cena.partes, -hw, -hh, hw, hh, c.m.madeira, 10)
}
