/**
 * PRATOS, a MESA POSTA de cima (móveis de casa, 28/10/2026): meia casa que o
 * mestre põe POR CIMA da mesa ou do balcão (a ordem de desenho a deixa por
 * último, `ehMovelDeCimaDaMesa`). Três formas, pela `variante`:
 * - 0, prato cheio: o prato de louça com o assado e o pão, o talher ao lado
 *   e a caneca no canto;
 * - 1, prato vazio: o prato limpo com o talher cruzado em cima, e a caneca;
 * - 2, pilha: quatro pratos empilhados, cada um um pouco fora do de baixo.
 * A louça clara é o que lê a 25% de zoom (um ponto creme no tampo de madeira);
 * as cores são todas próprias e contidas, como as flores da jardineira. Só
 * sombra de contato: o prato está no tampo. Na 3/4 tudo sobe a altura do
 * tampo, a sombra junto (`PERFIS` em `tresQuartos.ts`). Sem material.
 */
import { anel, capsula, elipse } from './formas'
import { contato, type Cena, type CriarPeca, type MaterialDaPeca } from './motor'
import { BURACO, materialDaPeca, type MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** A louça: o branco do Meio-Termo um pouco abaixo, para não estourar no tampo claro. */
const LOUCA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('branco', 0.93)) }
/** O assado (marrom quente) e o pão (ocre da palha), nos tons do Meio-Termo, sem saturar. */
const ASSADO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('madeiraEscura', 0.98)) }
const PAO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('palha', 0.92)) }
/** A bebida na caneca: a nogueira bem escura (cerveja escura, sem virar preto). */
const BEBIDA: MaterialDaPeca = { ...BURACO, rgb: rgb(tomDoMeio('nogueira', 0.72)) }

/** Um prato de louça de raio `r` (a aba e o fundo, que afunda um pouco). */
function prato(cena: Cena, P: CriarPeca, x: number, y: number, r: number, semente: number, sombra = true): void {
  if (sombra) cena.sombras.push(contato(elipse(x, y, r, r), 0.26))
  cena.partes.push(P(elipse(x, y, r, r), LOUCA, { bisel: r * 0.18, contorno: 0.16, semente, projeta: { dist: 0.9, forca: 0.24 } }))
  cena.partes.push(P(elipse(x, y, r * 0.66, r * 0.66), LOUCA, { bisel: r * 0.08, tom: 0.96, recesso: { k: r * 0.12, forca: 0.18 }, contorno: 0, semente: semente + 1 }))
}

/** O talher: a faca e o garfo, dois riscos de ferro de ponta a ponta. */
function talher(cena: Cena, P: CriarPeca, ax: number, ay: number, bx: number, by: number, k: number): void {
  const ferro = materialDaPeca('ferro')
  const nx = -(by - ay)
  const ny = bx - ax
  const n = Math.hypot(nx, ny) || 1
  const d = 1.3 * k
  for (const s of [-1, 1]) {
    const ox = (nx / n) * d * s
    const oy = (ny / n) * d * s
    cena.partes.push(P(capsula(ax + ox, ay + oy, bx + ox, by + oy, 0.55 * k), ferro, { bisel: 0.5 * k, metal: 0.5, contorno: 0.15, projeta: { dist: 0.6, forca: 0.25 } }))
  }
}

/** A caneca de madeira vista de cima: a borda, a bebida e a asa. */
function caneca(cena: Cena, P: CriarPeca, x: number, y: number, r: number, k: number): void {
  const madeira = materialDaPeca('nogueira')
  cena.sombras.push(contato(elipse(x, y, r, r), 0.3))
  cena.partes.push(P(capsula(x + r * 0.7, y, x + r * 1.45, y, 0.7 * k), madeira, { bisel: 0.6 * k, tom: 0.9, contorno: 0.2 }))
  cena.partes.push(P(anel(x, y, r, r, r * 0.68, r * 0.68), madeira, { bisel: 0.8 * k, contorno: 0.2, semente: 711, projeta: { dist: 0.9, forca: 0.28 } }))
  cena.partes.push(P(elipse(x, y, r * 0.68, r * 0.68), BEBIDA, { bisel: 0, contorno: 0.1, recesso: { k: 0.8 * k, forca: 0.25 }, semente: 712 }))
}

export const montarPratos: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  // O desenho foi medido em meia casa (14 px de meia largura): tudo escala por aqui.
  const k = Math.min(hw, hh) / 14
  if (c.variante === 2) {
    // A pilha: o de baixo maior na sombra, os de cima um pouco fora do lugar.
    const r = 10.2 * k
    cena.sombras.push(contato(elipse(0, 0, r, r), 0.3))
    const passos: readonly (readonly [number, number])[] = [[1.3, 1.3], [-0.6, 0.4], [0.8, -0.5], [-0.4, -1.4]]
    passos.forEach(([dx, dy], i) => prato(cena, P, dx * k, dy * k, r - i * 0.15 * k, 720 + i * 2, false))
    return
  }
  // O prato um pouco para baixo e para a esquerda: a caneca no canto de cima, o talher à direita.
  const xp = -2 * k
  const yp = 1.2 * k
  const rp = 9.2 * k
  prato(cena, P, xp, yp, rp, 700)
  if (c.variante === 1) {
    // Vazio: o talher cruzado em cima do prato, de quem acabou de comer.
    talher(cena, P, xp - 4.4 * k, yp + 5 * k, xp + 5 * k, yp - 3.6 * k, k)
  } else {
    // Cheio: o assado e o pão no fundo do prato, o talher deitado ao lado.
    cena.partes.push(P(elipse(xp - 1.2 * k, yp + 0.4 * k, 3.9 * k, 3 * k), ASSADO, { bisel: 2.2 * k, contorno: 0.2, ruga: 0.6, semente: 704, projeta: { dist: 0.9, forca: 0.26 } }))
    cena.partes.push(P(elipse(xp + 3 * k, yp - 2.6 * k, 2.3 * k, 1.7 * k), PAO, { bisel: 1.4 * k, contorno: 0.2, semente: 705, projeta: { dist: 0.8, forca: 0.24 } }))
    talher(cena, P, hw - 2.6 * k, yp - 4.5 * k, hw - 2.6 * k, hh - 1.6 * k, k)
  }
  caneca(cena, P, hw - 5.4 * k, -hh + 4.2 * k, 3.4 * k, k)
}
