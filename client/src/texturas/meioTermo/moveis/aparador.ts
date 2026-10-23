/**
 * APARADOR de cima com volume (`objetos.js:1360-1412`). De Frente: o tampo de
 * tábuas, um pouco mais largo que o corpo, e os dois puxadores em pé no
 * encontro das portas. De Lado (a frente em pé, como `APARADOR_DE_LADO` de
 * `lib/mobilia.ts`): o tampo sobrando dos dois lados, as duas portas, os
 * puxadores e o rodapé. Materiais: `madeira` e `puxadores`.
 */
import { caixa, uniao } from './formas'
import { contato, type Cena, type CriarPeca, type MaterialDaPeca, type Peca } from './motor'
import { QUARTO, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Altura do aparador em casas (a sombra). */
const ALTURA = 0.62
/** Quanto o tampo sobra do corpo de cada lado, em fração da largura. */
const SOBRA_DO_TAMPO = 0.035
/** Altura da sombra do aparador de lado (px do protótipo). */
const ALTURA_DE_LADO = 12

/** Duas portas em relevo que se encontram no meio, com um puxador em pé de cada lado do encontro. */
function portas(L: Peca[], P: CriarPeca, mad: MaterialDaPeca, pux: MaterialDaPeca, x0: number, y0: number, x1: number, y1: number, w: number): void {
  for (const [a, b] of [[x0 + 2, -0.7], [0.7, x1 - 2]]) L.push(P(caixa(a, y0 + 2, b, y1 - 1.5, 1), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 160 + Math.round(a) }))
  const xp = 0.045 * w
  const ya = y0 + (y1 - y0) * 0.3
  const yb = y0 + (y1 - y0) * 0.58
  for (const sx of [-1, 1]) L.push(P(caixa(sx * xp - 0.9, ya, sx * xp + 0.9, yb, 0.6), pux, { bisel: 0.8, contorno: 0.15, projeta: { dist: 0.8, forca: 0.3 } }))
}

function montarAparadorDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const nA = (f: number): number => -hh + f * h
  const meioCorpo = hw - SOBRA_DO_TAMPO * w
  const tampo = caixa(-hw, -hh, hw, nA(0.14), 0.8)
  const corpo = caixa(-meioCorpo, nA(0.14), meioCorpo, hh, 0.4)
  sombraDeLado(cena, uniao(tampo, corpo), ALTURA_DE_LADO)
  const L = cena.partes
  L.push(P(corpo, mad, { tabua: 0, bisel: 0.6, tom: 0.88, semente: 180 }))
  portas(L, P, mad, c.m.puxadores, -meioCorpo, nA(0.14), meioCorpo, nA(0.88), w)
  L.push(P(caixa(-meioCorpo, nA(0.88), meioCorpo, hh, 0.3), mad, { tabua: 0, bisel: 0.4, tom: 0.58, semente: 181 }))
  L.push(P(tampo, mad, { tabua: 0, bisel: 1, luz: 0.03, semente: 182 }))
}

export const montarAparador: MontarMovel = (c, cena) => {
  if (c.lado === 'lado') {
    montarAparadorDeLado(c, cena)
    return
  }
  const { hw, hh, w, h, peca: P } = c
  const sobra = SOBRA_DO_TAMPO * w
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 1.2), z: c.g * ALTURA }, contato(caixa(-hw + sobra, -hh, hw - sobra, hh)))
  const L = cena.partes
  L.push(P(caixa(-hw, -hh, hw, hh, 1.4), c.m.madeira, { tabua: 7, bisel: 1.6, semente: 170 }))
  for (const sx of [-1, 1]) {
    const xc = sx * 0.045 * w
    L.push(P(caixa(xc - 0.8, hh - 0.28 * h, xc + 0.8, hh + 1, 0.5), c.m.puxadores, { bisel: 0.7, contorno: 0.2, projeta: { dist: 0.8, forca: 0.3 } }))
  }
}
