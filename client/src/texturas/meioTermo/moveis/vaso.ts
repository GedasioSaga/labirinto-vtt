/**
 * VASO DE PLANTA de cima com volume (peça nova da MT4), portado do vaso do
 * protótipo da vila (`docs/design/vila-meio-termo/prototipo/index.html`,
 * função `vaso`): a boca do vaso com chanfro, a terra escura dentro e um tufo
 * de cinco folhas redondas com uma no meio, cada folha com o próprio chanfro e
 * um ruído de luz (sem listra). Material: `vaso` (barro, arenito ou granito);
 * as folhas e a terra são fixas.
 */
import { elipse } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** A terra do vaso: a lenha do Meio-Termo mais escura, acima do piso de luz. */
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('lenha', 0.78)) }
/** As folhas: o verde-oliva da vila (#4f6238), um pouco mais claro para não sumir no chão escuro. */
const FOLHA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x70, 0x40] }

/** Folha: luz manchada em duas escalas, como `texFolha` da vila. */
const texFolha: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.42 + p.su, y * 0.42 + p.sv) * 0.3 + ruido(x * 1.05 + 7, y * 1.05) * 0.14
}

export const montarVaso: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  /** A vila desenhava o vaso com raio 7,6: tudo escala por aqui. */
  const k = R / 7.8
  cena.sombras.push({ forma: elipse(0, 0, R, R), z: c.g * 0.45 }, contato(elipse(0, 0, R, R), 0.25))
  const L = cena.partes
  L.push(P(elipse(0, 0, R * 0.98, R * 0.98), c.m.vaso, { tabua: 0, bisel: 2.4 * k, contorno: 0.24, semente: 90 }))
  L.push(P(elipse(0, 0, 5.8 * k, 5.8 * k), TERRA, { bisel: 0, contorno: 0, recesso: { k: 1.4 * k, forca: 0.3 }, semente: 91 }))
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * 2 * Math.PI + 0.4
    L.push(P(elipse(Math.cos(a) * 2.6 * k, Math.sin(a) * 2.6 * k, 3.1 * k, 3.1 * k), FOLHA, { bisel: 2.8 * k, textura: texFolha, contorno: 0.2, tom: 0.95 + 0.025 * i, semente: 92 + i }))
  }
  L.push(P(elipse(-0.6 * k, -0.6 * k, 3 * k, 3 * k), FOLHA, { bisel: 2.8 * k, textura: texFolha, contorno: 0.15, tom: 1.08, semente: 99 }))
}
