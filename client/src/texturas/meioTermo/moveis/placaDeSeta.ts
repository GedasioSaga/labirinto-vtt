/**
 * PLACA DE SETA de cima com volume (peça nova da MT5): desenho original
 * inspirado na placa de seta do Estilo Mother da vila (`docs/design/
 * vila-estilo-mother/prototipo/mother.js`, `placa`): a tábua em forma de seta
 * pregada no alto de um poste, com um sulco ao longo dela. A seta aponta para a
 * DIREITA do objeto; o giro dele dá a direção (a imagem gira junto).
 *
 * É a peça menor do lote (meia casa): a 1x ela só não vira mancha se tiver
 * volume (chanfro, sombra legível de quem está no alto) e contorno forte, e se
 * a seta ocupar a pegada (a do protótipo, de 27 em 50 px, cobria 20% dela).
 * Material: `madeira`; o poste é a mesma madeira, mais escura.
 */
import { capsula, elipse, poligono } from './formas'
import { contato } from './motor'
import { BURACO, tomLongeDoChao, type MontarMovel } from './contexto'

/** Altura da seta em casas (a sombra cai longe: ela fica no alto do poste). */
const ALTURA_DA_SETA = 0.75

export const montarPlacaDeSeta: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  // A seta em frações da pegada: corpo de -0,42 a 0,22 da largura e a ponta em 0,48; meia altura 0,22.
  const meia = 0.44 * hh
  const seta = poligono([
    [-0.84 * hw, -meia],
    [0.44 * hw, -meia],
    [0.96 * hw, 0],
    [0.44 * hw, meia],
    [-0.84 * hw, meia],
  ])
  const poste = Math.min(hw, hh) * 0.2
  cena.sombras.push({ forma: seta, z: c.g * ALTURA_DA_SETA, forca: 0.3, solta: true })
  cena.sombras.push({ forma: elipse(0, 0, poste, poste), z: c.g * ALTURA_DA_SETA }, contato(elipse(0, 0, poste, poste), 0.3))
  cena.partes.push(P(seta, c.m.madeira, { eixo: 0, tabua: 0, bisel: 1.6, contorno: 0.32, tom: tomLongeDoChao(c.m.madeira, 0.2), semente: 10 }))
  // O sulco ao longo da seta (o traço do protótipo): mais escuro, para a direção ler a 1x.
  cena.partes.push(P(capsula(-0.6 * hw, 0, 0.42 * hw, 0, Math.max(0.9, 0.09 * hh)), BURACO, { bisel: 0.4, contorno: 0, tom: 1.15, semente: 11 }))
  // O topo do poste, pregado no meio da seta.
  cena.partes.push(P(elipse(0, 0, poste * 0.7, poste * 0.7), c.m.madeira, { polar: { cx: 0, cy: 0, r: poste }, tabua: 0, bisel: 0.9, contorno: 0.3, tom: 0.62, semente: 12 }))
}
