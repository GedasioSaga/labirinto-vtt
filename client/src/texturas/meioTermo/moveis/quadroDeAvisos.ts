/**
 * QUADRO DE AVISOS de cima com volume (peça nova da MT4), portado do quadro
 * do protótipo da vila (função `quadro`): os dois pés, a moldura de madeira,
 * o fundo de tábuas, três avisos de papel tortos com tachinha de latão e a
 * travessa de cima que faz o beiral. A vila desenhava num retângulo de 41 x
 * 23; aqui as medidas escalam para a pegada (1 x 0,4 casa). Material:
 * `madeira` (o fundo é a mesma madeira, mais escura).
 */
import { caixa, elipse, poligono, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** O papel dos avisos (o PAPEL da vila). */
const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xd9, 0xcf, 0xb8] }
const LARGURA_DA_VILA = 41
const ALTURA_DA_VILA = 23

export const montarQuadroDeAvisos: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const sx = (2 * hw) / LARGURA_DA_VILA
  const sy = (2 * hh) / ALTURA_DA_VILA
  const X = (x: number): number => x * sx
  const Y = (y: number): number => y * sy
  const cx = (x0: number, y0: number, x1: number, y1: number, r: number) => caixa(X(x0), Y(y0), X(x1), Y(y1), r)
  const poli = (pontos: readonly Ponto[]) => poligono(pontos.map(([x, y]) => [X(x), Y(y)] as const))
  const mad = c.m.madeira
  cena.sombras.push({ forma: cx(-20, -3, 20, 3, 1), z: c.g * 0.6, solta: true, forca: 0.24 }, contato(cx(-17, 8, 17, 11, 0), 0.22))
  const L = cena.partes
  for (const lado of [-1, 1]) L.push(P(cx(lado * 15 - 1.8, 6, lado * 15 + 1.8, 11.5, 0.6), mad, { bisel: 0.8, tabua: 0, eixo: QUARTO, semente: 480 + lado }))
  L.push(P(cx(-18, -8, 18, 8, 1.2), mad, { bisel: 1.2, tabua: 0, semente: 482 }))
  L.push(P(cx(-15.5, -5.6, 15.5, 6, 0.5), mad, { bisel: 0.5, tabua: 4 * sy, tom: 0.78, semente: 483 }))
  L.push(P(poli([[-13.5, -4.2], [-5.5, -4.8], [-5, 3.6], [-13, 4.1]]), PAPEL, { bisel: 0.4, contorno: 0.12, semente: 484 }))
  L.push(P(poli([[-3.6, -3.6], [4.2, -3.9], [4.6, 4.6], [-3.4, 4.4]]), PAPEL, { bisel: 0.4, contorno: 0.12, tom: 0.95, semente: 485 }))
  L.push(P(poli([[6.2, -4.4], [13.4, -3.6], [13, 2.4], [6.4, 2.1]]), PAPEL, { bisel: 0.4, contorno: 0.12, tom: 0.9, semente: 486 }))
  const latao = materialDaPeca('latao')
  for (const [px, py] of [[-9.4, -3.2], [0.3, -2.6], [9.8, -2.8]]) L.push(P(elipse(X(px), Y(py), 0.9 * sy, 0.9 * sy), latao, { bisel: 0.9 * sy, semente: 487 }))
  L.push(P(cx(-20.5, -11.5, 20.5, -7.6, 1), mad, { bisel: 1.2, tabua: 0, tom: 1.08, semente: 488 }))
}
