/**
 * PIA de cima com volume (móveis de casa, 28/10/2026): a cuba de PEDRA
 * cavada num tampo de madeira, a bica de ferro saindo da parede (o fundo, em
 * cima) e, ao lado da cuba, o balde de aduelas com água. A frente é o lado de
 * baixo. A cuba funda e o balde redondo são as duas formas que leem a 25% de
 * zoom. Materiais: `pedra` (a cuba) e `madeira` (o tampo e o balde).
 */
import { caixa, capsula, elipse } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { BURACO, materialDaPeca, type MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** Altura da pia em casas (a do tampo). */
const ALTURA = 0.8
/** A água do balde, como a do balde do poço. */
const AGUA_DO_BALDE: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.6)) }

export const montarPia: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, peca: P } = c
  const pedra = c.m.pedra
  const mad = c.m.madeira
  const ferro = materialDaPeca('ferro')
  const tampo = caixa(-hw, -hh, hw, hh, 1.2)
  cena.sombras.push({ forma: tampo, z: c.g * ALTURA }, contato(tampo))
  const L = cena.partes
  L.push(P(tampo, mad, { tabua: 6, bisel: 1.3, semente: 641 }))
  // A cuba: a borda de pedra e o fundo cavado, com o ralo.
  const beira = 0.1 * h
  const x0 = -hw + beira
  const x1 = hw * 0.1
  L.push(P(caixa(x0, -hh + beira, x1, hh - beira, 2.4), pedra, { tabua: 0, bisel: 1.6, semente: 642 }))
  const funda = 0.11 * h
  L.push(P(caixa(x0 + funda, -hh + beira + funda, x1 - funda, hh - beira - funda, 1.8), pedra, { tabua: 0, bisel: 0.6, tom: 0.78, recesso: { k: 2.6, forca: 0.34 }, contorno: 0.1, semente: 643 }))
  const xMeio = (x0 + x1) / 2
  L.push(P(elipse(xMeio, 0.12 * h, 0.035 * w, 0.035 * w), BURACO, { bisel: 0.4, contorno: 0.1 }))
  // A bica de ferro, da parede (o fundo) até o meio da cuba.
  L.push(P(capsula(xMeio, -hh - 0.5, xMeio, -hh + 0.36 * h, 1.3), ferro, { bisel: 1, contorno: 0.2, projeta: { dist: 1.4, forca: 0.32 } }))
  // O balde no tampo, à direita: aduelas, a água e a alça.
  const rb = 0.32 * h
  const xb = hw * 0.55
  const yb = 0.02 * h
  L.push(P(elipse(xb, yb, rb, rb), mad, { tabua: 1.6, polar: { cx: xb, cy: yb, r: rb }, bisel: 1, tom: 0.92, semente: 644, projeta: { dist: 1.6, forca: 0.3 } }))
  L.push(P(elipse(xb, yb, rb - 1.9, rb - 1.9), AGUA_DO_BALDE, { bisel: 0, contorno: 0.2, recesso: { k: 0.9, forca: 0.25 }, semente: 645 }))
  L.push(P(capsula(xb - rb + 0.4, yb, xb + rb - 0.4, yb, 0.5), ferro, { bisel: 0.5, semente: 646 }))
}
