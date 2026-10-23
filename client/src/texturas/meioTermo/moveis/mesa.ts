/**
 * MESA de cima com volume (`objetos.js:1111-1141`): o tampo de tábuas entre
 * duas travessas de topo, a sombra do tampo solto no ar e a de cada perna.
 * Material: `madeira`.
 */
import { caixa } from './formas'
import { contato } from './motor'
import { QUARTO, type MontarMovel } from './contexto'

export const montarMesa: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const H = c.g * 0.5
  const ponta = 0.06 * w
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 1.5), z: H, solta: true })
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = sx * (hw - 0.065 * w)
    const ly = sy * (hh - 0.1 * h)
    cena.sombras.push(contato(caixa(lx - 3, ly - 3, lx + 3, ly + 3), 0.32), { forma: caixa(lx - 2.5, ly - 2.5, lx + 2.5, ly + 2.5), z: H - 4, forca: 0.26 })
  }
  cena.partes.push(P(caixa(-hw + ponta, -hh, hw - ponta, hh, 0), mad, { tabua: h / 4.2, bisel: 1.2, semente: 50 }))
  cena.partes.push(P(caixa(-hw, -hh, -hw + ponta, hh, 1.5), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 51 }))
  cena.partes.push(P(caixa(hw - ponta, -hh, hw, hh, 1.5), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 52 }))
}
