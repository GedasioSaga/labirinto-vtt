/**
 * LIÇA DE JUSTA de cima com volume (lote L13 dos objetos novos, 14/11/2026,
 * grupo Descanso e brincadeira): a barreira comprida do meio do campo do
 * torneio, que separa os dois cavaleiros na carga. A cerca de tábuas fica
 * coberta pelo PANO jogado por cima da trave, em PAINÉIS alternados (a cor
 * escolhida e o linho cru), cada um caindo dos dois lados até a barra em
 * BICOS; entre os painéis, os POSTES de madeira com a BOLA torneada no alto.
 *
 * De cima, cada painel tem as duas águas do pano: a do lado da luz clara, a
 * do outro escura, e a cumeeira da trave no meio. A 25% de zoom sobra a faixa
 * comprida listrada de través, de beira dentada, marcada pelas bolas dos
 * postes: é o que diz "liça de torneio" e não "cerca" ou "muro".
 *
 * O mestre estica o trecho em linha, como a cerca e o muro baixo de pedra: a
 * liça ganha mais PAINÉIS (um a cada `VAO` casa), nunca painéis esticados. O
 * trecho corre pelo lado MAIOR da pegada (`u` ao comprido, `v` de través,
 * trocados no trecho em pé, como a barreira de concreto); a água clara é a de
 * cima, ou a da esquerda no trecho em pé (a luz do mapa vem de cima à
 * esquerda).
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) cada painel é uma coluna da altura da
 * trave, com a forma dentada: a frente sai na cor do painel, listrada como a
 * de cima, com a barra em bicos no pé. Os postes são colunas um pouco mais
 * altas, com a bola em cima.
 *
 * Materiais: `madeira` (os postes e as bolas) e `pano` (os painéis de cor; a
 * listra clara é linho, fixa).
 */
import { caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { LENCOL, QUARTO, type MontarMovel } from './contexto'

/** Um painel a cada tanto de casa, ao comprido (de poste a poste). */
const VAO = 1
/** De través, em fração da meia grossura: onde o pano dobra para os bicos e a ponta dos bicos. */
const BEIRA_DO_PANO = 0.66
const PONTA_DOS_BICOS = 0.97
/** Os bicos de cada lado de um painel. */
const BICOS_POR_PAINEL = 5
/** O poste (meio lado) e a bola torneada (raio), em casas; os das pontas são mais grossos. */
const MEIO_POSTE = 0.075
const MEIO_POSTE_DA_PONTA = 0.095
const RAIO_DA_BOLA = 0.06
const RAIO_DA_BOLA_DA_PONTA = 0.075
/** As alturas, em casas: a trave com o pano e o alto dos postes. */
const ALTURA_DO_PANO = 0.75
const ALTURA_DO_POSTE = 0.86
/** A meia largura da trave de cima, em fração da meia grossura. */
const MEIA_TRAVE = 0.2
/** Os tons do pano (a água do lado da luz e a do outro lado) e o da trave. */
const TOM_DA_AGUA_CLARA = 1.1
const TOM_DA_AGUA_ESCURA = 0.78
const TOM_DA_TRAVE = 1.04

export const montarLicaDeJusta: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const comprido = c.w >= c.h
  // u ao comprido, v de través: (u, v) no desenho.
  const U = comprido ? c.hw : c.hh
  const V = comprido ? c.hh : c.hw
  const em = (u: number, v: number): Ponto => (comprido ? [u, v] : [v, u])
  const retangulo = (u0: number, v0: number, u1: number, v1: number, raio = 0): Forma => {
    const [x0, y0] = em(Math.min(u0, u1), Math.min(v0, v1))
    const [x1, y1] = em(Math.max(u0, u1), Math.max(v0, v1))
    return caixa(x0, y0, x1, y1, raio)
  }
  const mad = c.m.madeira
  const pano = c.m.pano
  const L = cena.partes
  const S = cena.sombras
  const mpPonta = MEIO_POSTE_DA_PONTA * g
  const ultimo = U - mpPonta - 0.5
  const vaos = Math.max(1, Math.round((ultimo * 2) / (VAO * g)))
  const postes = Array.from({ length: vaos + 1 }, (_, i) => -ultimo + (i * ultimo * 2) / vaos)
  const meioPoste = (i: number): number => (i === 0 || i === vaos ? mpPonta : MEIO_POSTE * g)
  const vTrave = MEIA_TRAVE * V
  const vPano = BEIRA_DO_PANO * V
  const vBicos = PONTA_DOS_BICOS * V
  const zPano = ALTURA_DO_PANO * g
  const zPoste = ALTURA_DO_POSTE * g

  // ---------- os painéis de pano, de poste a poste ----------
  for (let i = 0; i < vaos; i += 1) {
    const u0 = postes[i] + meioPoste(i) - 0.4
    const u1 = postes[i + 1] - meioPoste(i + 1) + 0.4
    const claro = i % 2 === 1
    const mat: MaterialDaPeca = claro ? LENCOL : pano
    // A beira de um lado: da quina do painel aos bicos, ida e volta (`lado` -1 do lado da luz, 1 do outro).
    const beira = (lado: -1 | 1): Ponto[] => {
      const pontos: Ponto[] = []
      for (let j = 0; j <= BICOS_POR_PAINEL * 2; j += 1) {
        const u = u0 + ((u1 - u0) * j) / (BICOS_POR_PAINEL * 2)
        pontos.push(em(u, lado * (j % 2 === 1 ? vBicos : vPano + (vBicos - vPano) * 0.25)))
      }
      return lado < 0 ? pontos : pontos.reverse()
    }
    // A estrutura da 3/4 é o retângulo do painel: com a beira dentada, a varredura custava 2 s numa liça de 4 casas.
    const painel = retangulo(u0, -vBicos, u1, vBicos)
    S.push({ forma: painel, z: zPano, forca: 0.3 }, contato(painel, 0.3))
    for (const lado of [-1, 1] as const) {
      // Da trave (u0 a u1) volta pela beira do lado, de u1 a u0.
      const agua = poligono([em(u0, lado * vTrave), em(u1, lado * vTrave), ...(lado < 0 ? beira(-1).reverse() : beira(1))])
      L.push(P(agua, mat, { eixo: comprido ? QUARTO : 0, bisel: 1.2, contorno: 0.24, ruga: 0.3, tom: (lado < 0 ? TOM_DA_AGUA_CLARA : TOM_DA_AGUA_ESCURA) * (claro ? 0.97 : 1), semente: 7600 + i * 2 + (lado + 1) / 2, projeta: { dist: 0.8, forca: 0.3 } }))
    }
    // A trave de madeira por cima, de poste a poste: o pano pende dos dois lados dela. Ela amarra os painéis numa
    // barreira só (sem ela, de cima, a liça lia como uma fila de almofadas). Um pedaço por painel, que sobe com ele.
    L.push(P(retangulo(u0, -vTrave, u1, vTrave, 0.6), mad, { eixo: comprido ? 0 : QUARTO, tabua: 0, bisel: 1.1, tom: TOM_DA_TRAVE, contorno: 0.3, semente: 7660, projeta: { dist: 1.2, forca: 0.4 } }))
  }

  // ---------- os postes, com a bola torneada no alto ----------
  postes.forEach((u, i) => {
    const mp = meioPoste(i)
    const rb = (i === 0 || i === vaos ? RAIO_DA_BOLA_DA_PONTA : RAIO_DA_BOLA) * g
    const poste = retangulo(u - mp, -mp, u + mp, mp, 0.6)
    S.push({ forma: poste, z: zPoste, forca: 0.32 }, contato(poste, 0.34))
    L.push(P(poste, mad, { tabua: 0, bisel: 1.2, tom: 0.92, contorno: 0.3, semente: 7670 + i, projeta: { dist: 1, forca: 0.3 } }))
    const [bx, by] = em(u, 0)
    L.push(P(elipse(bx, by, rb, rb), mad, { tabua: 0, bisel: rb * 0.85, tom: 1.12, contorno: 0.3, semente: 7690 + i, projeta: { dist: 1.2, forca: 0.32 } }))
  })
}
