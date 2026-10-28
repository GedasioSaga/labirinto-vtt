/**
 * PRIVADA de época de cima com volume (móveis de casa, 28/10/2026): a caixa
 * de descarga de madeira encostada na parede (o fundo, em cima), com o puxador
 * de metal, e na frente o vaso de LOUÇA com o assento de madeira em volta e a
 * água no fundo. A 25% de zoom lê o oval claro com o aro de madeira diante da
 * caixa escura. Materiais: `madeira` e `ferragens`.
 */
import { anel, caixa, elipse } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** Alturas em casas: o assento e a caixa de descarga. */
const ALTURA_DO_ASSENTO = 0.42
const ALTURA_DA_CAIXA = 0.8
/** A louça, como a dos pratos, e a água clara do fundo do vaso (pálida: o azul do poço fazia do vaso um olho). */
const LOUCA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('branco', 0.93)) }
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0xa4, 0xb4, 0xb4] }

export const montarPrivada: MontarMovel = (c, cena) => {
  const { hw, hh, h, peca: P } = c
  const mad = c.m.madeira
  const fimDaCaixa = -hh + 0.3 * h
  const caixaDaDescarga = caixa(-hw, -hh, hw, fimDaCaixa, 1.2)
  // O vaso: o oval na frente da caixa, encostado nela.
  const cy = fimDaCaixa + (hh - fimDaCaixa) * 0.5
  const rx = hw * 0.86
  const ry = (hh - fimDaCaixa) * 0.5
  const vaso = elipse(0, cy, rx, ry)
  cena.sombras.push({ forma: vaso, z: c.g * ALTURA_DO_ASSENTO }, contato(vaso), { forma: caixaDaDescarga, z: c.g * ALTURA_DA_CAIXA }, contato(caixaDaDescarga))
  const L = cena.partes
  // A louça do vaso, o assento de madeira em volta da boca, o fundo e a água.
  L.push(P(elipse(0, cy, rx, ry), LOUCA, { bisel: 1.6, contorno: 0.18, semente: 781 }))
  L.push(P(anel(0, cy, rx * 0.9, ry * 0.9, rx * 0.56, ry * 0.56), mad, { tabua: 0, bisel: 1.4, contorno: 0.2, semente: 782, projeta: { dist: 0.9, forca: 0.26 } }))
  L.push(P(elipse(0, cy, rx * 0.56, ry * 0.56), LOUCA, { bisel: 0.6, tom: 0.9, recesso: { k: 1.8, forca: 0.3 }, contorno: 0, semente: 783 }))
  L.push(P(elipse(0, cy + ry * 0.14, rx * 0.34, ry * 0.3), AGUA, { bisel: 0, contorno: 0, recesso: { k: 0.8, forca: 0.16 }, semente: 784 }))
  // A caixa de descarga por cima (é mais alta), com a tampa de tábua e o puxador.
  L.push(P(caixaDaDescarga, mad, { tabua: 5, bisel: 1.3, semente: 785 }))
  L.push(P(caixa(hw * 0.3, fimDaCaixa - 0.12 * h, hw * 0.7, fimDaCaixa - 0.04 * h, 0.6), c.m.ferragens, { bisel: 0.7, contorno: 0.2, projeta: { dist: 0.8, forca: 0.3 } }))
}
