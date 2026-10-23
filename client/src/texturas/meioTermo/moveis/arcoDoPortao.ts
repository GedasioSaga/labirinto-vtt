/**
 * ARCO DO PORTÃO de cima com volume (peça nova da MT5): desenho original
 * inspirado no arco do Estilo Mother da vila (`docs/design/vila-estilo-mother/
 * prototipo/mother.js`, `arco`): os dois postes de madeira escura, a trave de
 * ponta a ponta por cima deles, duas correntinhas e a placa clara pendurada na
 * frente, com uma flor. Visto de cima ele é ALTO: a sombra vai longe, para
 * baixo à direita. Materiais: `madeira` (postes e trave) e `placa`.
 *
 * Medidas do protótipo (caixa de 84 x 22 px, de -42 a 42 e de -8 a 14),
 * escaladas pela largura da pegada e centradas na altura dela.
 */
import { rgb } from '../../ruido'
import { capsula, caixa, elipse } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { PREGO, tomLongeDoChao, type MontarMovel } from './contexto'

const ROSA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#d49ab4') }
const MIOLO_DA_FLOR: MaterialDaPeca = { classe: 'liso', rgb: rgb('#d8c070') }

/** Alturas em casas (a sombra): os postes e a trave no alto, a placa pendurada um pouco abaixo. */
const ALTURA_DO_ARCO = 0.95
const ALTURA_DA_PLACA = 0.7

export const montarArcoDoPortao: MontarMovel = (c, cena) => {
  const P = c.peca
  const deitado = c.w >= c.h
  const comprido = deitado ? c.w : c.h
  const k = comprido / 84
  // O protótipo vai de -8 a 14 na altura: o meio da caixa fica em +3.
  const dy = -3 * k
  const em = (u0: number, v0: number, u1: number, v1: number, raio: number) => (deitado ? caixa(u0, v0 + dy, u1, v1 + dy, raio) : caixa(-v1 - dy, u0, -v0 - dy, u1, raio))
  const ponto = (u: number, v: number): [number, number] => (deitado ? [u, v + dy] : [-v - dy, u])
  const trave = em(-40 * k, -3.6 * k, 40 * k, 3.6 * k, 2 * k)
  const placa = em(-13 * k, 3.4 * k, 13 * k, 13.4 * k, 2.5 * k)
  const postes = [-34, 34].map((sx) => em((sx - 4) * k, -4 * k, (sx + 4) * k, 4 * k, 1.5 * k))
  cena.sombras.push({ forma: trave, z: c.g * ALTURA_DO_ARCO, forca: 0.26 })
  for (const poste of postes) cena.sombras.push({ forma: poste, z: c.g * ALTURA_DO_ARCO }, contato(poste, 0.3))
  cena.sombras.push({ forma: placa, z: c.g * ALTURA_DA_PLACA, forca: 0.22, solta: true })
  const L = cena.partes
  const eixo = deitado ? 0 : Math.PI / 2
  postes.forEach((poste, i) => L.push(P(poste, c.m.madeira, { eixo: eixo + Math.PI / 2, tabua: 0, bisel: 1.6 * k, contorno: 0.26, tom: 0.66, semente: 10 + i })))
  L.push(P(trave, c.m.madeira, { eixo, tabua: 0, bisel: 1.3 * k, contorno: 0.26, tom: tomLongeDoChao(c.m.madeira, 0.14), projeta: { dist: 1.2 * k, forca: 0.22, suave: 0.8 }, semente: 20 }))
  for (const sx of [-8, 8]) {
    const [ax, ay] = ponto(sx * k, 1.6 * k)
    const [bx, by] = ponto(sx * k, 5 * k)
    L.push(P(capsula(ax, ay, bx, by, 0.75 * k), PREGO, { bisel: 0.6 * k, contorno: 0.14, semente: 30 + sx }))
  }
  L.push(P(placa, c.m.placa, { eixo, tabua: 0, bisel: 1.1 * k, contorno: 0.26, tom: tomLongeDoChao(c.m.placa, 0.14), semente: 40 }))
  const [fx, fy] = ponto(0, 8.5 * k)
  L.push(P(elipse(fx, fy, 2 * k, 2 * k), ROSA, { bisel: 1.4 * k, contorno: 0.16, semente: 50 }))
  L.push(P(elipse(fx - 0.3 * k, fy - 0.3 * k, 0.7 * k, 0.7 * k), MIOLO_DA_FLOR, { bisel: 0, contorno: 0, semente: 51 }))
}
