/**
 * ARMÁRIO DE COZINHA de cima com volume (`objetos.js:1292-1357`). De Frente:
 * a bancada de tábuas, o armário de cima (mais alto, faz sombra na bancada) e
 * os dois puxadores na frente. De Lado (a frente em pé, como `ARMARIO_DE_LADO`
 * de `lib/mobilia.ts`): a portinha de cima, o nicho aberto, a bancada, duas
 * gavetas e o rodapé. Materiais: `madeira` e `puxadores`.
 */
import { caixa, elipse } from './formas'
import { contato, type Cena, type MaterialDaPeca, type Peca, type CriarPeca } from './motor'
import { QUARTO, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Alturas da bancada e do armário de cima, em casas (as sombras). */
const ALTURA_DA_BANCADA = 0.9
const ALTURA_DO_ARMARIO_DE_CIMA = 1.52
/** Onde o armário de cima acaba, em fração da profundidade a partir de trás. */
const DEGRAU = 0.45
/** Altura da sombra do armário de lado (px do protótipo). */
const ALTURA_DE_LADO = 18

/**
 * Duas gavetas em relevo entre `y0` e `y1`, cada uma com um puxador deitado
 * no meio (`objetos.js:1330-1337`). Também serve ao armário de lado.
 */
export function gavetas(L: Peca[], P: CriarPeca, mad: MaterialDaPeca, pux: MaterialDaPeca, x0: number, y0: number, x1: number, y1: number, w: number): void {
  const meio = (y0 + y1) / 2
  for (const [a, b] of [[y0 + 0.7, meio - 0.7], [meio + 0.7, y1 - 0.7]]) {
    L.push(P(caixa(x0 + 2.2, a, x1 - 2.2, b, 1), mad, { tabua: 0, bisel: 1.3, semente: 140 + Math.round(a) }))
    const yc = (a + b) / 2
    L.push(P(caixa(-0.08 * w, yc - 1, 0.08 * w, yc + 1, 0.8), pux, { bisel: 0.9, contorno: 0.15, projeta: { dist: 0.8, forca: 0.3 } }))
  }
}

function montarArmarioDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const pux = c.m.puxadores
  const nA = (f: number): number => -hh + f * h
  sombraDeLado(cena, caixa(-hw, -hh, hw, hh, 1), ALTURA_DE_LADO)
  const L = cena.partes
  L.push(P(caixa(-hw, -hh, hw, hh, 0.6), mad, { tabua: 0, bisel: 0.8, tom: 0.88, semente: 150 }))
  L.push(P(caixa(-hw, -hh, hw, nA(0.04), 0.5), mad, { tabua: 0, bisel: 0.7, luz: 0.05, semente: 151 }))
  L.push(P(caixa(-0.34 * w, nA(0.06), 0.34 * w, nA(0.25), 1), mad, { eixo: QUARTO, tabua: 0, bisel: 1.4, semente: 152 }))
  L.push(P(elipse(0.25 * w, nA(0.155), 1.1, 1.1), pux, { bisel: 1.1, contorno: 0.1, projeta: { dist: 0.8, forca: 0.3 } }))
  L.push(P(caixa(-hw, nA(0.285), hw, nA(0.31), 0.3), mad, { tabua: 0, bisel: 0.6, luz: 0.04, semente: 153 }))
  L.push(P(caixa(-0.42 * w, nA(0.31), 0.42 * w, nA(0.555), 0.3), mad, { tabua: 0, bisel: 0, tom: 0.42, recesso: { k: 3.5, forca: 0.4 }, contorno: 0, semente: 154 }))
  L.push(P(caixa(-hw - 0.4, nA(0.555), hw + 0.4, nA(0.59), 0.5), mad, { tabua: 0, bisel: 0.8, luz: 0.05, semente: 155 }))
  gavetas(L, P, mad, pux, -hw, nA(0.59), hw, nA(0.94), w)
  L.push(P(caixa(-hw + 1, nA(0.94), hw - 1, hh, 0.3), mad, { tabua: 0, bisel: 0.4, tom: 0.58, semente: 156 }))
}

export const montarArmario: MontarMovel = (c, cena) => {
  if (c.lado === 'lado') {
    montarArmarioDeLado(c, cena)
    return
  }
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const zB = c.g * ALTURA_DA_BANCADA
  const zA = c.g * ALTURA_DO_ARMARIO_DE_CIMA
  const yDegrau = -hh + DEGRAU * h
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 1), z: zB }, { forma: caixa(-hw, -hh, hw, yDegrau, 1), z: zA }, contato(caixa(-hw, -hh, hw, hh, 1)))
  const L = cena.partes
  L.push(P(caixa(-hw, yDegrau - 1, hw, hh, 1), mad, { tabua: 6.5, bisel: 1.3, semente: 130 }))
  L.push(P(caixa(-hw, -hh, hw, yDegrau, 1), mad, { tabua: 0, bisel: 1.4, semente: 131, projeta: { dist: (zA - zB) * 0.3, forca: 0.33, suave: 2.2 } }))
  for (const sx of [-1, 1]) {
    const xc = sx * 0.25 * w
    L.push(P(caixa(xc - 0.8, hh - 0.18 * h, xc + 0.8, hh + 1.2, 0.5), c.m.puxadores, { bisel: 0.7, contorno: 0.2, projeta: { dist: 0.8, forca: 0.3 } }))
  }
}
