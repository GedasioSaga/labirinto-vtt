/**
 * ARCO DO PORTÃO de cima com volume (peça nova da MT5): desenho original
 * inspirado no arco do Estilo Mother da vila (`docs/design/vila-estilo-mother/
 * prototipo/mother.js`, `arco`): a trave de ponta a ponta, os dois postes
 * quadrados POR CIMA dela (a silhueta ■━━■, com o topo cortado), duas
 * correntinhas e a placa clara pendurada na frente, com uma flor. Visto de
 * cima ele é ALTO: a sombra dos postes vai longe, para baixo à direita.
 * Materiais: `madeira` (postes e trave) e `placa`.
 *
 * Medidas da revisão de design da MT5, em px do protótipo (a caixa de 84 de
 * comprimento): postes de 11 x 11 em ±33, trave de -41 a 41 com 6 de
 * espessura, placa de 18 x 7 (de 5 a 12, abaixo da trave) e a flor de raio
 * 1,5. Entre a trave e a placa fica um VÃO de 2, com as correntinhas à mostra:
 * é o vão que diz que a placa está pendurada.
 *
 * A escala ao LONGO (`kx`) segue o comprimento da pegada; a de ATRAVESSADO
 * (`ky`: espessura, postes, placa, flor) nunca passa do lado curto. Assim o arco
 * esticado (3 x 0,5, 4 x 0,5) fica mais largo, nunca mais grosso, e a placa
 * não sai da pegada (onde o clique e a seleção não a alcançam).
 */
import { rgb } from '../../ruido'
import { capsula, caixa, elipse } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { PREGO, tomLongeDoChao, type MontarMovel } from './contexto'

const ROSA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#d49ab4') }
const MIOLO_DA_FLOR: MaterialDaPeca = { classe: 'liso', rgb: rgb('#d8c070') }

/** Alturas em casas (a sombra): os postes no alto, a trave quase lá, a placa pendurada um pouco abaixo. */
const ALTURA_DOS_POSTES = 1
const ALTURA_DA_TRAVE = 0.95
const ALTURA_DA_PLACA = 0.7

/** Comprimento do desenho e a faixa que ele ocupa no atravessado (do topo dos postes, -5,5, ao pé da placa, 12). */
const COMPRIMENTO = 84
const TOPO = -5.5
const PE = 12
/** O atravessado com folga de meio px de cada lado (o contorno). */
const ATRAVESSADO = PE - TOPO + 0.5

export const montarArcoDoPortao: MontarMovel = (c, cena) => {
  const P = c.peca
  const deitado = c.w >= c.h
  const comprido = deitado ? c.w : c.h
  const curto = deitado ? c.h : c.w
  const kx = comprido / COMPRIMENTO
  const ky = Math.min(kx, curto / ATRAVESSADO)
  // A faixa de -5,5 a 12 fica centrada na altura da pegada.
  const dv = (-(TOPO + PE) / 2) * ky
  const em = (u0: number, v0: number, u1: number, v1: number, raio: number) => (deitado ? caixa(u0, v0 + dv, u1, v1 + dv, raio) : caixa(-v1 - dv, u0, -v0 - dv, u1, raio))
  const ponto = (u: number, v: number): [number, number] => (deitado ? [u, v + dv] : [-v - dv, u])
  const trave = em(-41 * kx, -3 * ky, 41 * kx, 3 * ky, 2 * ky)
  const placa = em(-9 * ky, 5 * ky, 9 * ky, 12 * ky, 2 * ky)
  const postes = [-33, 33].map((su) => ({ forma: em(su * kx - 5.5 * ky, -5.5 * ky, su * kx + 5.5 * ky, 5.5 * ky, 1.2 * ky), centro: ponto(su * kx, 0) }))
  // Os postes são o mais alto: a sombra deles é arrastada do pé até 1 casa. A trave e a placa ficam no ar (sombra solta).
  for (const poste of postes) cena.sombras.push({ forma: poste.forma, z: c.g * ALTURA_DOS_POSTES }, contato(poste.forma, 0.3))
  cena.sombras.push({ forma: trave, z: c.g * ALTURA_DA_TRAVE, forca: 0.24, solta: true })
  cena.sombras.push({ forma: placa, z: c.g * ALTURA_DA_PLACA, forca: 0.22, solta: true })
  const L = cena.partes
  const eixo = deitado ? 0 : Math.PI / 2
  // A ordem é de baixo para cima (a última fica por cima): trave, correntes, placa, flor, e os postes por cima de tudo.
  L.push(P(trave, c.m.madeira, { eixo, tabua: 0, bisel: 1.3 * ky, contorno: 0.26, tom: tomLongeDoChao(c.m.madeira, 0.14), projeta: { dist: 1.2 * ky, forca: 0.22, suave: 0.8 }, semente: 20 }))
  for (const su of [-5.5, 5.5]) {
    const [ax, ay] = ponto(su * ky, 2.2 * ky)
    const [bx, by] = ponto(su * ky, 5.8 * ky)
    L.push(P(capsula(ax, ay, bx, by, 0.7 * ky), PREGO, { bisel: 0.6 * ky, contorno: 0.14, semente: 30 + su }))
  }
  L.push(P(placa, c.m.placa, { eixo, tabua: 0, bisel: 1.1 * ky, contorno: 0.26, tom: tomLongeDoChao(c.m.placa, 0.14), semente: 40 }))
  const [fx, fy] = ponto(0, 8.5 * ky)
  L.push(P(elipse(fx, fy, 1.5 * ky, 1.5 * ky), ROSA, { bisel: 1.05 * ky, contorno: 0.16, semente: 50 }))
  L.push(P(elipse(fx - 0.25 * ky, fy - 0.25 * ky, 0.55 * ky, 0.55 * ky), MIOLO_DA_FLOR, { bisel: 0, contorno: 0, semente: 51 }))
  postes.forEach((poste, i) => {
    const [cx, cy] = poste.centro
    L.push(P(poste.forma, c.m.madeira, { polar: { cx, cy, r: 5.5 * ky }, tabua: 0, bisel: 2 * ky, contorno: 0.26, tom: 0.62, projeta: { dist: 1.2 * ky, forca: 0.2, suave: 0.8 }, semente: 10 + i }))
  })
}
