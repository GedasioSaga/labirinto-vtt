/**
 * CARROÇA (peça nova da MT4). Materiais: `madeira` (caixa, tábuas, varais e
 * raios) e `aros` (o aro de ferro das rodas); os sacos de linho e o barrilzinho
 * são fixos.
 *
 * - De Frente (de cima com volume), a partir da carroça do protótipo da vila
 *   (função `carroca`): os dois varais saindo para a esquerda com a travessa
 *   na ponta, a caixa com a borda e o fundo de tábuas, as duas rodas vistas do
 *   alto (tiras estreitas com o aro de ferro por fora), dois sacos e um
 *   barrilzinho em cima. A sombra da caixa solta no ar sobre as rodas.
 * - De Lado (de perfil, em pé): a roda de raios na frente da caixa de
 *   tábuas, o saco em cima da caixa e o varal descendo até o chão à esquerda.
 *   Entre os raios e embaixo da caixa o chão aparece.
 */
import { anel, barra, caixa, elipse } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import { materialDaPeca, QUARTO, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'

const RAIOS = 8
/** Saco de linho, um pouco mais escuro que o linho do lençol (de pano grosso). */
function linhoDoSaco(): MaterialDaPeca {
  return materialDaPeca('linho')
}

function roda(c: ContextoDoMovel, cena: Cena, cx: number, cy: number, R: number): void {
  const P = c.peca
  const L = cena.partes
  const mad = c.m.madeira
  const aro = c.m.aros
  const larguraDoAro = Math.max(1.6, R * 0.1)
  const cambota = Math.max(2, R * 0.13)
  for (let i = 0; i < RAIOS; i += 1) {
    const a = (i / RAIOS) * 2 * Math.PI + 0.2
    L.push(P(barra(cx, cy, cx + Math.cos(a) * (R - larguraDoAro), cy + Math.sin(a) * (R - larguraDoAro), Math.max(1.6, R * 0.09)), mad, { tabua: 0, eixo: a, bisel: 0.7, tom: 0.92, semente: 470 + i }))
  }
  L.push(P(anel(cx, cy, R - larguraDoAro + 0.3, R - larguraDoAro + 0.3, R - larguraDoAro - cambota, R - larguraDoAro - cambota), mad, { arco: { cx, cy, r: R - larguraDoAro - cambota / 2, a0: 0 }, tabua: 0, bisel: 1, semente: 478 }))
  L.push(P(anel(cx, cy, R, R, R - larguraDoAro, R - larguraDoAro), aro, { bisel: 0.8, contorno: 0.3, semente: 479 }))
  L.push(P(elipse(cx, cy, R * 0.2, R * 0.2), mad, { tabua: 0, bisel: R * 0.12, tom: 0.86, semente: 480 }))
  L.push(P(elipse(cx, cy, R * 0.08, R * 0.08), aro, { bisel: R * 0.06, semente: 481 }))
}

function montarCarrocaDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const R = Math.min(0.4 * h, 0.27 * w)
  const cxRoda = 0.12 * w
  const cyRoda = hh - R
  const caixaX0 = -0.3 * w
  const caixaY0 = cyRoda - 0.42 * h
  const caixaY1 = cyRoda + 0.04 * h
  // A carroça em pé faz sombra no chão: uma faixa baixa debaixo da caixa (o vão entre a caixa e o
  // chão fica aberto; o perfil inteiro escurecia esse vão e virava um painel escuro) e o contato da roda.
  sombraDeLado(cena, caixa(caixaX0, hh - 0.12 * h, hw, hh, 2), 6)
  cena.sombras.push(contato(caixa(cxRoda - R * 0.6, hh - 2, cxRoda + R * 0.6, hh, 1), 0.3))
  cena.sombras.push(contato(caixa(-hw, hh - 2, -hw + 0.06 * w, hh, 0.5), 0.3))
  // O varal: da frente da caixa até o chão, à esquerda.
  L.push(P(barra(caixaX0 + 2, (caixaY0 + caixaY1) / 2 + 2, -hw + 1.6, hh - 1.6, Math.max(2, 0.03 * h)), mad, { tabua: 0, bisel: 0.9, tom: 0.88, semente: 450 }))
  // A caixa de tábuas deitadas, com a borda de cima mais clara e as duas travessas de pé.
  L.push(P(caixa(caixaX0, caixaY0, hw - 0.5, caixaY1, 1), mad, { tabua: 0.1 * h, bisel: 1.1, tom: 0.86, semente: 460 }))
  L.push(P(caixa(caixaX0 - 1, caixaY0 - 0.02 * h, hw, caixaY0 + 0.05 * h, 0.8), mad, { tabua: 0, bisel: 0.8, tom: 1.05, semente: 461 }))
  for (const fx of [0.02, 0.62]) L.push(P(caixa(caixaX0 + (hw - caixaX0) * fx, caixaY0, caixaX0 + (hw - caixaX0) * fx + 0.035 * w, caixaY1, 0.5), mad, { tabua: 0, eixo: QUARTO, bisel: 0.8, tom: 0.78, semente: 462 }))
  // O saco em cima da caixa.
  L.push(P(elipse(-0.05 * w, caixaY0 - 0.06 * h, 0.15 * w, 0.12 * h), linhoDoSaco(), { bisel: 3.4, ruga: 1.5, tom: 0.84, semente: 463, projeta: { dist: 1.5, forca: 0.25 } }))
  roda(c, cena, cxRoda, cyRoda, R)
}

export const montarCarroca: MontarMovel = (c, cena) => {
  if (c.lado === 'lado') {
    montarCarrocaDeLado(c, cena)
    return
  }
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const aro = c.m.aros
  const L = cena.partes
  const x0 = -hw + 0.32 * w
  const meiaCaixa = 0.33 * h
  const xRoda = 0.1 * w
  const meiaRoda = 0.11 * w
  const corpo = caixa(x0, -meiaCaixa, hw, meiaCaixa, 1.2)
  cena.sombras.push({ forma: corpo, z: c.g * 0.45, solta: true, forca: 0.3 }, contato(caixa(xRoda - meiaRoda, -hh, xRoda + meiaRoda, hh, 1.5), 0.3))
  // Os varais e a travessa na ponta.
  for (const lado of [-1, 1]) L.push(P(caixa(-hw + 2, lado * 0.12 * h - 1.4, x0 + 3, lado * 0.12 * h + 1.4, 0.8), mad, { bisel: 0.9, tabua: 0, semente: 450 + lado }))
  L.push(P(caixa(-hw, -0.17 * h, -hw + 3.2, 0.17 * h, 0.6), mad, { bisel: 0.8, tabua: 0, eixo: QUARTO, semente: 452 }))
  // As rodas vistas do alto: a tira de madeira e o aro de ferro por fora.
  for (const lado of [-1, 1]) {
    const yDentro = lado * meiaCaixa
    const yFora = lado * (hh - 0.5)
    L.push(P(caixa(xRoda - meiaRoda, Math.min(yDentro, yFora - lado * 2.6), xRoda + meiaRoda, Math.max(yDentro, yFora - lado * 2.6), 1.6), mad, { bisel: 1.6, tabua: 0, tom: 0.85, semente: 455 + lado }))
    L.push(P(caixa(xRoda - meiaRoda - 0.5, Math.min(yFora, yFora - lado * 2.6), xRoda + meiaRoda + 0.5, Math.max(yFora, yFora - lado * 2.6), 0.6), aro, { bisel: 0.6, semente: 457 + lado }))
  }
  L.push(P(corpo, mad, { bisel: 1.6, tabua: 0, semente: 460 }))
  L.push(P(caixa(x0 + 2.6, -meiaCaixa + 2.6, hw - 2.6, meiaCaixa - 2.6, 0.6), mad, { bisel: 0.8, tabua: 0.1 * h, eixo: 0, tom: 0.92, recesso: { k: 2, forca: 0.22 }, semente: 461 }))
  const saco = linhoDoSaco()
  L.push(P(elipse(x0 + 0.17 * w, -0.1 * h, 0.13 * w, 0.17 * h), saco, { bisel: 5, ruga: 1.5, tom: 0.8, semente: 462, projeta: { dist: 2, forca: 0.3 } }))
  L.push(P(elipse(x0 + 0.3 * w, 0.12 * h, 0.12 * w, 0.16 * h), saco, { bisel: 5, ruga: 1.5, tom: 0.74, semente: 463, projeta: { dist: 2, forca: 0.3 } }))
  const rb = 0.17 * h
  const bx = hw - 0.13 * w
  L.push(P(elipse(bx, -0.02 * h, rb, rb), mad, { bisel: 3, tabua: 3, semente: 464, projeta: { dist: 2.5, forca: 0.3 } }))
  L.push(P(anel(bx, -0.02 * h, rb + 0.1, rb + 0.1, rb * 0.86, rb * 0.86), aro, { bisel: 0.6, semente: 465 }))
}
