/**
 * BALDE DE ÁGUA de madeira de cima com volume (29/10/2026): as aduelas em
 * volta, o aro de ferro na boca, a borda das aduelas, a água por dentro (a
 * borda faz sombra nela do lado da luz) com um reflexo claro, e a alça de
 * ferro atravessada de orelha a orelha. A 25% de zoom sobram o anel de
 * madeira, o disco de água e o risco da alça: é o que diz "balde" e não
 * "barril" (o barril é fechado). Materiais: `madeira` e `aros`.
 */
import { anel, caixa, capsula, elipse } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** Altura do balde em casas. */
const ALTURA = 0.42
/** A água: o azul-petróleo do Meio-Termo, mais claro que a boca do poço (o balde está cheio, a luz chega). */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.7)) }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xc7, 0xd2, 0xcf] }

export const montarBalde: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const mad = c.m.madeira
  const aro = c.m.aros
  const R = Math.min(hw, hh)
  const k = R / 14
  const polar = { cx: 0, cy: 0, r: R }
  /** A borda das aduelas faz sombra na água do lado da luz (cima à esquerda). */
  const rAgua = R * 0.72
  const texAgua: Textura = (_u, _v, x, y, _p, s) => {
    const d = Math.hypot(x + 1.6 * k, y + 1.3 * k) - rAgua
    s[3] += -0.34 * Math.max(0, Math.min(1, 0.5 + d / (1.4 * k))) + ruido(x * 0.4, y * 0.4) * 0.06
  }
  cena.sombras.push({ forma: elipse(0, 0, hw, hh), z: c.g * ALTURA }, contato(elipse(0, 0, hw, hh)))
  const L = cena.partes
  // As aduelas, o aro da boca e a borda das aduelas (a madeira cortada, mais clara).
  L.push(P(elipse(0, 0, hw, hh), mad, { polar, tabua: 3.4 * k, bisel: R * 0.18, semente: 41 }))
  L.push(P(anel(0, 0, hw * 0.99, hh * 0.99, hw * 0.91, hh * 0.91), aro, { bisel: 0.8, contorno: 0.3, semente: 42 }))
  L.push(P(anel(0, 0, hw * 0.9, hh * 0.9, hw * 0.74, hh * 0.74), mad, { polar, tabua: 3.4 * k, bisel: 0.8, luz: 0.06, semente: 41 }))
  // A água e o reflexo da luz.
  L.push(P(elipse(0, 0, hw * 0.75, hh * 0.75), AGUA, { bisel: 0, contorno: 0.15, textura: texAgua, semente: 43 }))
  L.push(P(elipse(R * 0.22, R * 0.3, R * 0.24, R * 0.09), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.18, suave: 1.2 * k }))
  // As orelhas da alça na borda e a alça de ferro atravessada.
  for (const lado of [-1, 1]) L.push(P(caixa(lado * hw * 0.82 - 1.2 * k, -1.6 * k, lado * hw * 0.82 + 1.2 * k, 1.6 * k, 0.5 * k), aro, { bisel: 0.6, contorno: 0.25, semente: 44 + lado }))
  L.push(P(capsula(-hw * 0.82, 0, hw * 0.82, 0, Math.max(0.55, 0.6 * k)), aro, { bisel: 0.6, contorno: 0.25, projeta: { dist: 1.4, forca: 0.32 }, semente: 47 }))
}
