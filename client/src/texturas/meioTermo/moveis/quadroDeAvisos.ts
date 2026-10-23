/**
 * QUADRO DE AVISOS de cima com volume (peça nova da MT4), portado do quadro
 * do protótipo da vila (função `quadro`): os dois pés, a moldura de madeira,
 * o fundo de tábuas, três avisos de papel tortos com tachinha de latão e a
 * travessa de cima que faz o beiral. A vila desenhava num retângulo de 41 x
 * 23; aqui as medidas escalam para a pegada (1 x 0,4 casa). Material:
 * `madeira` (o fundo é a mesma madeira, mais escura).
 *
 * Revisão da MT4: a 1x ele lia como um aparador com 3 gavetas brancas. Agora
 * os papéis ficam tortos (até 8 graus), um é 1,4x mais alto, cada um tem 2
 * linhas de texto de 1 px, e os pés aparecem 5 px a 1x abaixo do quadro.
 */
import { caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** O papel dos avisos (o PAPEL da vila) e a tinta das linhas de texto. */
const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xd9, 0xcf, 0xb8] }
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x80, 0x70] }
const LARGURA_DA_VILA = 41
const ALTURA_DA_VILA = 23
/** Espessura da linha de texto, em px do protótipo (1 px a 1x). */
const LINHA = 1.12

/** Um aviso: centro e tamanho em unidades da vila, giro em graus. */
interface Aviso {
  readonly cx: number
  readonly cy: number
  readonly w: number
  readonly h: number
  readonly graus: number
  readonly tom: number
}

const AVISOS: readonly Aviso[] = [
  { cx: -9.4, cy: -0.6, w: 7.4, h: 6.2, graus: -8, tom: 1 },
  { cx: 0.3, cy: -0.5, w: 7.2, h: 8.7, graus: 5, tom: 0.95 },
  { cx: 9.8, cy: -1.1, w: 7, h: 6.2, graus: 8, tom: 0.9 },
]

/** Retângulo girado `ang` radianos em volta de (cx, cy), meias medidas `mx` e `my`, deslocado (dx, dy) no eixo dele. */
function girado(cx: number, cy: number, mx: number, my: number, ang: number, dx = 0, dy = 0): Forma {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const canto = (x: number, y: number): Ponto => [cx + (x + dx) * c - (y + dy) * s, cy + (x + dx) * s + (y + dy) * c]
  return poligono([canto(-mx, -my), canto(mx, -my), canto(mx, my), canto(-mx, my)])
}

export const montarQuadroDeAvisos: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const sx = (2 * hw) / LARGURA_DA_VILA
  const sy = (2 * hh) / ALTURA_DA_VILA
  const X = (x: number): number => x * sx
  const Y = (y: number): number => y * sy
  const cx = (x0: number, y0: number, x1: number, y1: number, r: number) => caixa(X(x0), Y(y0), X(x1), Y(y1), r)
  const mad = c.m.madeira
  cena.sombras.push({ forma: cx(-20, -3, 20, 3, 1), z: c.g * 0.6, solta: true, forca: 0.24 }, contato(cx(-17, 11, 17, 12.9, 0), 0.22))
  const L = cena.partes
  for (const lado of [-1, 1]) L.push(P(cx(lado * 15 - 1.8, 5, lado * 15 + 1.8, 12.9, 0.6), mad, { bisel: 0.8, tabua: 0, eixo: QUARTO, semente: 480 + lado }))
  L.push(P(cx(-18, -8, 18, 6.6, 1.2), mad, { bisel: 1.2, tabua: 0, semente: 482 }))
  L.push(P(cx(-15.5, -5.6, 15.5, 4.8, 0.5), mad, { bisel: 0.5, tabua: 4 * sy, tom: 0.78, semente: 483 }))
  const latao = materialDaPeca('latao')
  AVISOS.forEach((a, i) => {
    const ang = (a.graus * Math.PI) / 180
    const [px, py, mx, my] = [X(a.cx), Y(a.cy), X(a.w) / 2, Y(a.h) / 2]
    L.push(P(girado(px, py, mx, my, ang), PAPEL, { bisel: 0.4, contorno: 0.12, tom: a.tom, semente: 484 + i }))
    // Duas linhas de texto, a de baixo mais curta, tortas com o papel.
    const texto = { bisel: 0, contorno: 0, semente: 490 + i }
    L.push(P(girado(px, py, mx * 0.62, LINHA / 2, ang, -mx * 0.04, -my * 0.05), TINTA, texto))
    L.push(P(girado(px, py, mx * 0.44, LINHA / 2, ang, -mx * 0.22, my * 0.32), TINTA, texto))
    const [tx, ty] = [px - my * 0.72 * Math.sin(ang) * -1, py - my * 0.72 * Math.cos(ang)]
    L.push(P(elipse(tx, ty, 0.9 * sy, 0.9 * sy), latao, { bisel: 0.9 * sy, semente: 487 }))
  })
  L.push(P(cx(-20.5, -11.5, 20.5, -7.6, 1), mad, { bisel: 1.2, tabua: 0, tom: 1.08, semente: 488 }))
}
