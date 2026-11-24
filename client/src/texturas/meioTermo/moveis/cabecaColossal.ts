/**
 * CABEÇA COLOSSAL (lote L08 de 24/11/2026, item 73: objeto novo, do tema do templo na selva do mapa 6; desenho próprio,
 * feições próprias, só a ideia do objeto). Uma cabeça de pedra do tamanho de duas casas, meio enterrada, desenhada DE
 * FRENTE: o elmo redondo com a crista no alto e a faixa de três botões na testa, as rodelas das orelhas dos lados, a
 * sobrancelha pesada, os OLHOS FECHADOS (a pálpebra cheia com o risco da fenda), dois riscos gravados descendo de cada
 * olho (a marca dela), o nariz largo, a boca grossa de cantos caídos e o queixo sumindo na terra.
 *
 * O tempo por cima: o musgo tomando o alto do elmo e escorrendo pelo lado da luz, o escorrido da chuva em faixas de
 * pé, uma trinca que desce do elmo até a bochecha, uma lasca faltando no alto, dois cipós pendurados na testa e, no
 * pé, o monte de musgo com as moitas, a planta em roseta e duas pedras caídas.
 *
 * Para ler numa casa são poucas massas grandes: o elmo claro em cima, a sombra funda debaixo da sobrancelha, o nariz e
 * a boca no meio e o verde no alto e no pé.
 *
 * Figura desenhada de uma vista só: de cima e na 3/4 é a mesma imagem, e a 3/4 só põe a sombra de baixo (`EM_PE` em
 * `tresQuartos.ts`, como a lápide e a estátua de frente); o giro gira a imagem inteira. O desenho é feito numa meia
 * pegada de 56 px e escala com o menor lado. Material: `pedra`; o musgo e as plantas são fixos. Escreve `cena.corDoPiso`.
 */
import { cadeia, caixa, dentroDe, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { acasoDoTemplo, cipo, ESCURO_DA_PEDRA_DO_TEMPLO, moita, MUSGO_DO_TEMPLO, roseta, texDaPedraDoTemplo } from './piramideEmDegraus'

/** A meia pegada em que a cabeça é desenhada (px do protótipo). */
const MEIA_PEGADA = 56
/** A altura da cabeça para a sombra no chão (frações da meia pegada). */
const ALTURA_DA_SOMBRA = 0.62
/** O vão escuro dos sulcos (a fenda do olho, a boca, a narina, a trinca), meio transparente sobre a pedra. */
const SULCO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x3b, 0x34] }

export const montarCabecaColossal: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh) / MEIA_PEGADA
  if (!(k > 0)) return
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA_DO_TEMPLO

  // As formas no desenho de 56 px, já na escala.
  const cx = (x0: number, y0: number, x1: number, y1: number, raio = 0): Forma => caixa(x0 * k, y0 * k, x1 * k, y1 * k, raio * k)
  const el = (x: number, y: number, rx: number, ry: number): Forma => elipse(x * k, y * k, rx * k, ry * k)
  const fio = (pontos: readonly Ponto[], r: number): Forma => cadeia(pontos.map(([x, y]): Ponto => [x * k, y * k]), r * k)
  const pol = (pontos: readonly Ponto[]): Forma => poligono(pontos.map(([x, y]): Ponto => [x * k, y * k]))

  // A pedra com o escorrido da chuva em faixas de pé (a cabeça é desenhada de frente).
  const daPedra = texDaPedraDoTemplo(0.42, 31)
  const texDaCabeca: Textura = (u, v, x, y, p, s, escala) => {
    daPedra(u, v, x, y, p, s, escala)
    const faixa = ruido((x / k) * 0.5 + 41, (y / k) * 0.045 + 9)
    if (faixa > 0.08) s[3] -= (faixa - 0.08) * 0.34
  }
  const liso = { tabua: 0, textura: texDaCabeca }

  cena.sombras.push({ forma: el(0, 40, 40, 9), z: 2 * MEIA_PEGADA * k * ALTURA_DA_SOMBRA }, contato(el(0, 45, 45, 8), 0.32))

  // ---------- a CABEÇA: o crânio redondo e a mandíbula mais estreita ----------
  const cranio = cx(-44, -50, 44, 22, 30)
  const cabeca = uniao(cranio, cx(-40, -8, 40, 46, 17))
  L.push(P(cabeca, pedra, { ...liso, bisel: 15 * k, tom: 0.9, contorno: 0.3, semente: 5800 }))

  // As bochechas e o queixo: volumes mansos, por cima da pedra.
  for (const lado of [-1, 1]) L.push(P(el(lado * 25, 17, 11.5, 9.5), pedra, { ...liso, bisel: 6 * k, tom: 0.98, contorno: 0, alfa: 0.55, suave: 2.6 * k, semente: 5810 + lado }))
  L.push(P(el(0, 41, 13, 5), pedra, { ...liso, bisel: 3.4 * k, tom: 1, contorno: 0, alfa: 0.6, suave: 2 * k, semente: 5812 }))

  // ---------- os OLHOS fechados: a órbita funda, a pálpebra cheia, a fenda e os dois riscos gravados ----------
  for (const lado of [-1, 1]) {
    const ox = lado * 17.5
    L.push(P(el(ox, 2, 12, 7.6), pedra, { ...liso, bisel: 0, tom: 0.8, contorno: 0.06, recesso: { k: 3 * k, forca: 0.5 }, semente: 5820 + lado }))
    L.push(P(el(ox, 3.8, 10.6, 5.6), pedra, { ...liso, bisel: 4.2 * k, tom: 1, contorno: 0.16, semente: 5822 + lado }))
    L.push(P(fio([[ox - 8.6, 4.6], [ox - 3, 6.4], [ox + 3, 6.4], [ox + 8.6, 4.6]], 0.62), SULCO, { bisel: 0, contorno: 0, alfa: 0.82, semente: 5824 + lado }))
    for (const d of [-2.6, 2.6]) L.push(P(fio([[ox + d, 10.5], [ox + d + lado * 0.6, 20]], 0.75), SULCO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 5826 + lado + d }))
  }

  // ---------- o NARIZ largo e as narinas ----------
  L.push(P(pol([[-4.2, -9], [4.2, -9], [10, 16.5], [5, 20.6], [-5, 20.6], [-10, 16.5]]), pedra, { ...liso, bisel: 5 * k, tom: 1.04, contorno: 0.22, semente: 5830, projeta: { dist: 3.4 * k, forca: 0.42 } }))
  for (const lado of [-1, 1]) L.push(P(el(lado * 5.4, 18.2, 2.3, 1.5), SULCO, { bisel: 0, contorno: 0, alfa: 0.7, semente: 5832 + lado }))

  // ---------- a BOCA grossa, de cantos caídos ----------
  L.push(P(el(0, 27.4, 16.5, 3.9), pedra, { ...liso, bisel: 3 * k, tom: 0.96, contorno: 0.22, semente: 5840 }))
  L.push(P(el(0, 33.2, 13.6, 4.5), pedra, { ...liso, bisel: 3.8 * k, tom: 1.04, contorno: 0.22, semente: 5841, projeta: { dist: 2.2 * k, forca: 0.36 } }))
  L.push(P(fio([[-17.5, 31.4], [-13, 29.8], [-6, 30.5], [0, 30.1], [6, 30.5], [13, 29.8], [17.5, 31.4]], 0.72), SULCO, { bisel: 0, contorno: 0, alfa: 0.82, semente: 5842 }))

  // ---------- a SOBRANCELHA pesada: faz a sombra funda em cima dos olhos ----------
  L.push(P(uniao(el(-17, -9.4, 16, 5.2), el(17, -9.4, 16, 5.2)), pedra, { ...liso, bisel: 4.4 * k, tom: 1.02, contorno: 0.24, semente: 5850, projeta: { dist: 3.8 * k, forca: 0.46 } }))

  // ---------- as RODELAS das orelhas ----------
  for (const lado of [-1, 1]) {
    L.push(P(el(lado * 44.5, 2, 8, 9.6), pedra, { ...liso, bisel: 4 * k, tom: 0.98, contorno: 0.3, semente: 5860 + lado, projeta: { dist: 2.4 * k, forca: 0.34 } }))
    L.push(P(el(lado * 44.5, 2, 4, 4.9), pedra, { ...liso, bisel: 0, tom: 0.62, contorno: 0.16, recesso: { k: 1.4 * k, forca: 0.36 }, semente: 5862 + lado }))
  }

  // ---------- o ELMO: a calota (com a lasca que falta), a crista do alto e a faixa de três botões ----------
  const calota = menos(dentroDe(cx(-46, -52, 46, 6, 31), cx(-48, -54, 48, -17)), el(36, -47, 9, 7))
  L.push(P(calota, pedra, { ...liso, bisel: 13 * k, tom: 1, contorno: 0.28, semente: 5870, projeta: { dist: 2.6 * k, forca: 0.36 } }))
  L.push(P(dentroDe(cx(-5.5, -53, 5.5, -22, 3), cx(-46, -52, 46, 6, 31)), pedra, { ...liso, bisel: 2.8 * k, tom: 1.1, contorno: 0.24, semente: 5871, projeta: { dist: 2 * k, forca: 0.3 } }))
  L.push(P(cx(-47, -25, 47, -13.5, 4), pedra, { ...liso, bisel: 3.2 * k, tom: 1.06, contorno: 0.28, semente: 5872, projeta: { dist: 3.2 * k, forca: 0.42 } }))
  for (const bx of [-25, 0, 25]) {
    const meio = bx === 0
    const lado = meio ? 6 : 4.6
    L.push(P(cx(bx - lado, -19.2 - lado * 0.82, bx + lado, -19.2 + lado * 0.82, 1.4), pedra, { ...liso, bisel: 2 * k, tom: 1.16, contorno: 0.26, semente: 5874 + bx, projeta: { dist: 1.4 * k, forca: 0.3 } }))
    if (meio) L.push(P(el(0, -19.2, 2.7, 2.7), SULCO, { bisel: 0, contorno: 0, alfa: 0.62, recesso: { k: 0.8 * k, forca: 0.3 }, semente: 5879 }))
  }

  // ---------- o TEMPO: a trinca, o musgo no alto e escorrendo, os cipós ----------
  L.push(P(fio([[15, -50], [12, -38], [17, -28], [13, -14], [21, -5], [25, 7], [21, 19]], 0.55), SULCO, { bisel: 0, contorno: 0, alfa: 0.62, semente: 5880 }))
  L.push(P(fio([[17, -28], [24, -24], [28, -17]], 0.42), SULCO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 5881 }))
  const noElmo = cx(-46, -52, 46, 6, 31)
  // A manta de musgo do alto: gomos encostados, de beira recortada, com dois escorridos do lado da luz.
  const manta: readonly (readonly [number, number, number, number, number])[] = [
    [-25, -46, 21, 8.5, 0.95], [-38, -36, 9.5, 11, 0.9], [-8, -48.5, 13, 5.4, 1.02], [-16, -39, 10, 5.5, 1.06], [-42, -23, 5.6, 13, 0.86], [-31, -29, 5, 7, 0.98], [4, -46, 6, 3.6, 0.92],
  ]
  manta.forEach(([x, y, rx, ry, tom], i) => {
    L.push(P(dentroDe(noElmo, el(x, y, rx, ry)), MUSGO_DO_TEMPLO, { bisel: Math.min(rx, ry) * 0.7 * k, contorno: 0.1, alfa: 0.92, suave: 0.9 * k, tom, semente: 5890 + i, projeta: { dist: 0.9 * k, forca: 0.14 } }))
  })
  const tufos: readonly (readonly [number, number, number, number])[] = [[18, -45, 4, 2.4], [-37, -5, 3.6, 6], [30, -37, 3.4, 2.4], [-34, 23, 3.8, 6.5], [38, 24, 3, 5], [-30, -18.5, 5, 2.6]]
  tufos.forEach(([x, y, rx, ry], i) => {
    L.push(P(el(x, y, rx, ry), MUSGO_DO_TEMPLO, { bisel: 1.8 * k, contorno: 0.14, alfa: 0.8, suave: 0.8 * k, tom: 0.9 + 0.2 * acasoDoTemplo(i, 51), semente: 5900 + i }))
  })
  cipo(L, P, -38 * k, -14 * k, 0.1, 1, 25 * k, 600)
  cipo(L, P, 37 * k, -14 * k, -0.06, 1, 15 * k, 601)

  // ---------- o PÉ: o monte de musgo, as moitas, a roseta e as pedras caídas ----------
  const monte: readonly (readonly [number, number, number, number, number])[] = [[-30, 47, 17, 6.4, 0.86], [-4, 48.5, 19, 5.6, 0.94], [22, 47.5, 17, 5.8, 0.88], [41, 49, 9, 3.8, 0.8], [-45, 49.5, 7, 3.4, 0.8], [8, 45.5, 9, 3.6, 1]]
  monte.forEach(([x, y, rx, ry, tom], i) => {
    L.push(P(el(x, y, rx, ry), MUSGO_DO_TEMPLO, { bisel: ry * 0.6 * k, contorno: 0.22, tom, semente: 5920 + i, projeta: { dist: 1 * k, forca: 0.18 } }))
  })
  for (const [x, y, r, giro] of [[41, 43, 5.4, 0.5], [47, 49, 3.6, 2.1]] as const) {
    const [cs, sn] = [Math.cos(giro), Math.sin(giro)]
    const canto = (px: number, py: number): Ponto => [x + px * cs - py * sn, y + px * sn + py * cs]
    L.push(P(pol([canto(-r, -r * 0.7), canto(r, -r * 0.7), canto(r, r * 0.7), canto(-r, r * 0.7)]), pedra, { tabua: 0, bisel: 1.6 * k, tom: 0.98, contorno: 0.28, textura: daPedra, semente: 5940 + Math.round(x), projeta: { dist: 1.6 * k, forca: 0.3 } }))
  }
  moita(L, P, -37 * k, 44 * k, 8.4 * k, 610, 6)
  moita(L, P, -24 * k, 49 * k, 5.6 * k, 611, 4)
  moita(L, P, 30 * k, 48 * k, 6.4 * k, 612, 5)
  roseta(L, P, 6 * k, 49 * k, 7.4 * k, 613)
}
