/**
 * BALDE DE DEJETOS de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"; a versão de cela
 * do balde, que faz o papel do penico). As aduelas de MADEIRA ESCURA em volta, o ARO de ferro na boca (com a ferrugem
 * em manchas), a borda das aduelas e, por dentro, o CONTEÚDO escuro e discreto. Por cima, a TAMPA TORTA: um disco de
 * três tábuas com a travessa que serve de pega, menor que a boca, caído para um lado e inclinado (por isso achatado),
 * fazendo sombra no que sobra à mostra, uma meia-lua escura embaixo à direita. A 25% de zoom sobram o anel escuro, a
 * tampa clara e a meia-lua: é o que o separa do balde de água (água clara, alça de ferro, sem tampa). Desenho
 * original.
 *
 * As sombras são as do balde de água: o corpo é uma coluna de 0,42 casa (a 3/4 DERIVADA mostra a frente das aduelas)
 * e o contato no pé. Sem material escolhido: a madeira escura, o ferro e o conteúdo são fixos.
 */
import { limitar01, misturar, rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, capsula, elipse, elipseGirada } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type MontarMovel } from './contexto'
import { FERRO_DA_PRISAO, texFerroGasto } from './cadeiraDeFerro'

/** Altura do balde em casas (a do balde de água). */
const ALTURA = 0.42
/**
 * A madeira escura: a nogueira mais funda puxada para o cinza (sem o cinza, saturação p95 de 0,59, quase no teto de
 * 0,62: o balde saía vermelho). A tampa é de madeira velha, cinzenta e seca: clara contra o balde escuro.
 */
const MADEIRA_ESCURA: MaterialDaPeca = { classe: 'madeira', rgb: misturar(rgb(tomDoMeio('nogueira', 0.86)), [0x56, 0x51, 0x4b], 0.38) }
const MADEIRA_DA_TAMPA: MaterialDaPeca = { classe: 'madeira', rgb: rgb(tomDoMeio('granito', 0.84)) }
/** O conteúdo: um castanho-oliva escuro e fosco, sem cor viva. */
const CONTEUDO: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x42, 0x30] }
/** A tampa: o deslocamento do meio (fração do raio), o giro, o achatado da inclinação e o raio (fração do raio). */
const TAMPA = { dx: -0.2, dy: -0.21, giro: -0.42, achata: 0.8, raio: 0.6 } as const

/** O conteúdo: a borda das aduelas faz sombra nele do lado da luz, e um ruído largo e fraco tira o liso. */
function texDoConteudo(raio: number, k: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const d = Math.hypot(x + 1.4 * k, y + 1.2 * k) - raio
    s[3] += -0.3 * limitar01(0.5 + d / (1.4 * k)) + ruido(x * 0.35 + p.su, y * 0.35 + p.sv) * 0.07
  }
}

export const montarBaldeDeDejetos: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / 14
  const polar = { cx: 0, cy: 0, r: R }
  const L = cena.partes
  cena.sombras.push({ forma: elipse(0, 0, hw, hh), z: g * ALTURA }, contato(elipse(0, 0, hw, hh), 0.32))

  // As aduelas, o aro de ferro da boca e a borda das aduelas (a madeira cortada, mais clara).
  L.push(P(elipse(0, 0, hw, hh), MADEIRA_ESCURA, { polar, tabua: 3.2 * k, bisel: R * 0.18, contorno: 0.26, semente: 24901 }))
  const aro = anel(0, 0, hw * 0.99, hh * 0.99, hw * 0.9, hh * 0.9)
  L.push(P(aro, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.8 * k, tom: 0.96, metal: 0.36, contorno: 0.3, textura: texFerroGasto(aro, 0, 0.42), semente: 24902 }))
  L.push(P(anel(0, 0, hw * 0.9, hh * 0.9, hw * 0.75, hh * 0.75), MADEIRA_ESCURA, { polar, tabua: 3.2 * k, bisel: 0.8 * k, tom: 1.1, luz: 0.05, contorno: 0.2, semente: 24903 }))

  // O conteúdo escuro.
  L.push(P(elipse(0, 0, hw * 0.76, hh * 0.76), CONTEUDO, { tabua: 0, bisel: 0, contorno: 0.12, textura: texDoConteudo(R * 0.73, k), semente: 24904 }))

  // A TAMPA TORTA: o disco de tábuas inclinado (achatado), a beira dele na sombra e a travessa da pega.
  const [tx, ty] = [TAMPA.dx * R, TAMPA.dy * R]
  const rTampa = TAMPA.raio * R
  const tampa = elipseGirada(tx, ty, rTampa, rTampa * TAMPA.achata, TAMPA.giro)
  L.push(P(tampa, MADEIRA_DA_TAMPA, { dx: 0.5 * k, dy: 1 * k, tabua: 0, bisel: 0.6 * k, tom: 0.58, contorno: 0.26, semente: 24905 }))
  L.push(P(tampa, MADEIRA_DA_TAMPA, { eixo: TAMPA.giro + QUARTO, tabua: (rTampa * 2) / 3, bisel: 1.1 * k, contorno: 0.24, semente: 24906, projeta: { dist: 1.8 * k, forca: 0.38, suave: 1.3 * k } }))
  const [ex, ey] = [Math.cos(TAMPA.giro) * rTampa * 0.62, Math.sin(TAMPA.giro) * rTampa * 0.62 * TAMPA.achata]
  const travessa = capsula(tx - ex, ty - ey, tx + ex, ty + ey, 1.15 * k)
  L.push(P(travessa, MADEIRA_DA_TAMPA, { eixo: TAMPA.giro, tabua: 0, bisel: 0.9 * k, tom: 0.92, contorno: 0.26, semente: 24907, projeta: { dist: 0.9 * k, forca: 0.32, suave: 0.8 * k } }))
  // Os dois pregos da travessa.
  for (const f of [-0.62, 0.62]) {
    L.push(P(elipse(tx + ex * f, ty + ey * f, 0.55 * k, 0.55 * k), FERRO_DA_PRISAO, { tabua: 0, bisel: 0.45 * k, tom: 1.05, contorno: 0.2, semente: 24908 + Math.sign(f) }))
  }
}
