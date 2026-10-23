/**
 * LAMPIÃO de cima com volume (peça nova da MT4), portado do lampião do
 * protótipo da vila (função `lampiao`): o poste alto faz uma sombra comprida
 * no chão, a caixa de vidro aparece como uma moldura clara em volta do chapéu
 * de metal (pirâmide de chanfro largo) e a ponta dele no meio.
 *
 * APAGADO, sem chama e sem brilho no chão: a vila pintava o vidro aceso
 * (emissão) e um halo quente; aqui a luz, quando houver, é a luz do mapa
 * (a ferramenta Luz), não um desenho parado. O vidro é âmbar pálido e pega
 * luz e sombra como o resto. Material: `metal`.
 */
import { caixa, capsula, elipse } from './formas'
import { SOMBRA_X, SOMBRA_Y, type MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

/** Vidro apagado: âmbar bem pálido, liso. */
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xcc, 0xa6] }
/** Altura do lampião no poste, em casas. */
const ALTURA = 1.3

export const montarLampiao: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  /** A vila desenhava a caixa com meia largura de 6,2: tudo escala por aqui. */
  const k = R / 6.6
  const H = c.g * ALTURA
  const metal = c.m.metal
  cena.sombras.push({ forma: capsula(0, 0, SOMBRA_X * H, SOMBRA_Y * H, 1.5 * k), z: 0, suave: 1.6, forca: 0.2 })
  cena.sombras.push({ forma: caixa(-6 * k, -6 * k, 6 * k, 6 * k, 1.6 * k), z: H, solta: true, forca: 0.22 })
  const L = cena.partes
  L.push(P(caixa(-6.2 * k, -6.2 * k, 6.2 * k, 6.2 * k, 1.6 * k), VIDRO, { bisel: 1 * k, contorno: 0.12, semente: 470 }))
  // As quatro hastes do vidro, nas quinas, do mesmo metal do chapéu.
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    L.push(P(elipse(sx * 5.3 * k, sy * 5.3 * k, 0.9 * k, 0.9 * k), metal, { bisel: 0.9 * k, semente: 473 }))
  }
  L.push(P(caixa(-4.6 * k, -4.6 * k, 4.6 * k, 4.6 * k, 1.8 * k), metal, { bisel: 4.2 * k, semente: 471 }))
  L.push(P(elipse(0, 0, 1.5 * k, 1.5 * k), metal, { bisel: 1.5 * k, tom: 0.8, semente: 472 }))
}
