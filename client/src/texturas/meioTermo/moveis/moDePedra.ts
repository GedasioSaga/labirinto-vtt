/**
 * MÓ DE PEDRA (moer grão à mão) de cima com volume (objetos de 14/11/2026,
 * grupo Cidade e vila): o moinho de mão da cozinha da vila, montado num
 * ESTRADO de tábuas. As duas pedras redondas, uma em cima da outra: a de
 * BAIXO, mais larga, com a farinha que sai pela junta e se junta num montinho
 * na bica; a de CIMA, picada, com o OLHO no meio cheio de grão e o CABO de pau
 * em pé perto da beira, que é por onde se gira. Num canto do estrado, o SACO
 * de grão aberto com o trigo à mostra; no outro, a GAMELA com farinha.
 *
 * O que diz "mó" a 1x, e não poço nem mesa: a pedra cinza com o furo de grão
 * amarelo no meio, a farinha branca em volta e o cabo com a sombra comprida.
 * O saco e a gamela contam para que serve.
 *
 * NA 3/4 (`tresQuartos.ts`, derivado) o estrado fica no chão (é uma tábua
 * rasa), as pedras são duas colunas baixas uma sobre a outra (o cabo sobe com
 * a de cima), o saco e a gamela colunas próprias.
 *
 * Materiais: `pedra` (as duas pedras), `madeira` (o estrado, o cabo e a
 * gamela) e `saco` (um tecido). A farinha e o trigo são fixos.
 */
import { caixa, capsula, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca } from './motor'
import { QUARTO, type MontarMovel } from './contexto'

/** Alturas, em casas: a pedra de baixo, a de cima, o cabo, o saco e a gamela. */
const ALTURA_DA_PEDRA_DE_BAIXO = 0.13
const ALTURA_DA_PEDRA_DE_CIMA = 0.23
const ALTURA_DO_CABO = 0.44
const ALTURA_DO_SACO = 0.26
const ALTURA_DA_GAMELA = 0.1

/** As medidas (fração do menor lado): o estrado, o centro das pedras, os raios delas, o olho e o cabo. */
const MEIO_ESTRADO = 0.48
const CENTRO_X = -0.08
const CENTRO_Y = -0.08
const RAIO_DE_BAIXO = 0.31
const RAIO_DE_CIMA = 0.255
const RAIO_DO_OLHO = 0.06
const RAIO_DO_CABO = 0.034
/** O rumo do cabo a partir do centro (radianos; para baixo à direita, onde a mão pega). */
const RUMO_DO_CABO = 0.62
/** O rumo da bica da pedra de baixo, por onde sai a farinha (radianos). */
const RUMO_DA_BICA = 2.2

/**
 * As âncoras da 3/4: a do estrado, a esta fração do menor lado dentro do canto
 * de cima à direita (longe das pedras), e o rumo, a partir do centro, da
 * âncora da pedra de baixo (para cima à esquerda, longe do cabo).
 */
const ANCORA_DO_CANTO = 0.05
const RUMO_DA_ANCORA = 3.5
/** Quanto a caixa da pedra de cima passa da pegada (px): a ordem de pintura dela na 3/4. */
const ORDEM_DA_PEDRA_DE_CIMA = 0.1

/** A farinha (branco quente) e o trigo (palha dourada, sem saturar). */
const FARINHA: MaterialDaPeca = { classe: 'liso', rgb: [0xe4, 0xdd, 0xcc] }
const TRIGO: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xa0, 0x62] }
/** A sombra pintada do cabo na pedra: o escuro quente, meio transparente. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x24, 0x1d, 0x18] }

/** Um borrão irregular de `n` pontas em volta de (x, y), raio `r` mexido por `variacao` (a farinha espalhada). */
function borrao(x: number, y: number, rx: number, ry: number, n: number, variacao: number, semente: number): Ponto[] {
  const pts: Ponto[] = []
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + variacao * Math.sin(i * 2.7 + semente) * Math.cos(i * 1.3 + semente * 0.7)
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k])
  }
  return pts
}

/** A forma com a caixa de pintura centrada na âncora (x, y), como a `presa` da pedra de amolar: o desenho não muda. */
function ancorada(forma: Forma, x: number, y: number): Forma {
  const ax = Math.max(Math.abs(forma.b[0] - x), Math.abs(forma.b[2] - x))
  const ay = Math.max(Math.abs(forma.b[1] - y), Math.abs(forma.b[3] - y))
  return { b: [x - ax, y - ay, x + ax, y + ay], d: forma.d }
}

/**
 * A estrutura com a caixa esticada até a pegada inteira mais `folga` px para
 * cada lado: a 3/4 pinta as estruturas pela base da caixa, e assim a pedra de
 * cima (e o cabo, com folga maior) vai depois da de baixo em qualquer giro. O
 * desenho não muda.
 */
function pintadaDepois(forma: Forma, hw: number, hh: number, folga: number): Forma {
  const b = forma.b
  return { b: [Math.min(b[0], -hw - folga), Math.min(b[1], -hh - folga), Math.max(b[2], hw + folga), Math.max(b[3], hh + folga)], d: forma.d }
}

export const montarMoDePedra: MontarMovel = (c, cena) => {
  const { w, h, hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const mad = c.m.madeira
  const saco = c.m.saco
  const L = cena.partes
  const lado = Math.min(w, h)
  const ex = MEIO_ESTRADO * w
  const ey = MEIO_ESTRADO * h
  const cx = CENTRO_X * w
  const cy = CENTRO_Y * h
  const r1 = RAIO_DE_BAIXO * lado
  const r2 = RAIO_DE_CIMA * lado
  const rOlho = RAIO_DO_OLHO * lado
  const rCabo = RAIO_DO_CABO * lado
  const xCabo = cx + Math.cos(RUMO_DO_CABO) * r2 * 0.74
  const yCabo = cy + Math.sin(RUMO_DO_CABO) * r2 * 0.74
  // O saco no canto de baixo à direita e a gamela no de baixo à esquerda.
  const xSaco = hw - 0.17 * w
  const ySaco = hh - 0.17 * h
  const rSaco = 0.165 * lado
  const xGamela = -hw + 0.16 * w
  const yGamela = hh - 0.15 * h
  const rGamela = 0.12 * lado
  const estrado = caixa(-ex, -ey, ex, ey, 1.4)

  // O estrado é raso (uma tábua no chão): fica sem coluna, no chão, e é pintado antes de tudo na 3/4. A pedra de
  // cima acaba antes do pé da de baixo, e a 3/4 pinta as estruturas pela base da caixa: ela vai com a caixa
  // esticada, para ser pintada depois. O cabo não tem coluna (a frente dele seria varrida desde o chão, por cima
  // das pedras): sobe com a pedra de cima, e a sombra comprida dele vai pintada na pedra.
  cena.sombras.push(
    contato(estrado, 0.3),
    { forma: elipse(cx, cy, r1, r1), z: g * ALTURA_DA_PEDRA_DE_BAIXO },
    { forma: pintadaDepois(elipse(cx, cy, r2, r2), hw, hh, ORDEM_DA_PEDRA_DE_CIMA), z: g * ALTURA_DA_PEDRA_DE_CIMA },
    { forma: elipse(xSaco, ySaco, rSaco, rSaco * 0.92), z: g * ALTURA_DO_SACO },
    { forma: elipse(xGamela, yGamela, rGamela, rGamela * 0.8), z: g * ALTURA_DA_GAMELA },
  )

  // As âncoras (a 3/4 sobe cada peça com a estrutura que contém o meio da caixa dela): a do estrado num canto
  // livre dele, fora de toda estrutura, e a da pedra de baixo na faixa dela que a de cima não cobre. Sem elas o
  // estrado, a farinha e a pedra de baixo, que têm o meio debaixo da pedra de cima, subiriam até o alto dela.
  const noEstrado = (f: Forma): Forma => ancorada(f, ex - ANCORA_DO_CANTO * lado, -ey + ANCORA_DO_CANTO * lado)
  const naPedraDeBaixo = (f: Forma): Forma => ancorada(f, cx + Math.cos(RUMO_DA_ANCORA) * (r1 + r2) / 2, cy + Math.sin(RUMO_DA_ANCORA) * (r1 + r2) / 2)

  // O ESTRADO de tábuas de través.
  L.push(P(noEstrado(estrado), mad, { tabua: 0.24 * h, bisel: 1.2, tom: 0.92, semente: 10 }))

  // A FARINHA espalhada em volta da pedra de baixo, mais grossa no montinho da bica, e uns grãos caídos.
  L.push(P(noEstrado(poligono(borrao(cx, cy, r1 * 1.14, r1 * 1.12, 22, 0.05, 3))), FARINHA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.55, semente: 11 }))
  const xBica = cx + Math.cos(RUMO_DA_BICA) * r1
  const yBica = cy + Math.sin(RUMO_DA_BICA) * r1
  L.push(P(poligono(borrao(xBica - 0.03 * w, yBica + 0.04 * h, 0.12 * lado, 0.09 * lado, 14, 0.12, 7)), FARINHA, { tabua: 0, bisel: 1.6, contorno: 0.14, semente: 12 }))
  for (const [i, [gx, gy]] of ([[0.2, -0.36], [0.33, -0.2], [0.07, 0.34], [-0.36, -0.38], [0.28, 0.04]] as const).entries()) {
    L.push(P(elipse(gx * w, gy * h, 0.9, 0.6), TRIGO, { tabua: 0, bisel: 0.4, contorno: 0.3, semente: 13 + i }))
  }

  // A PEDRA DE BAIXO, com a bica de saída da farinha na beira.
  L.push(P(naPedraDeBaixo(elipse(cx, cy, r1, r1)), pedra, { tabua: 0, bisel: 1.6, tom: 0.84, semente: 20 }))
  L.push(P(capsula(cx + Math.cos(RUMO_DA_BICA) * r2, cy + Math.sin(RUMO_DA_BICA) * r2, xBica, yBica, 1.1), FARINHA, { tabua: 0, bisel: 0.6, contorno: 0.14, semente: 21 }))
  // A farinha que sai pela junta das pedras: um anel fino e claro logo fora da de cima.
  L.push(P(naPedraDeBaixo(elipse(cx, cy, r2 * 1.07, r2 * 1.07)), FARINHA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.6, semente: 22 }))

  // A PEDRA DE CIMA, picada, com o OLHO cheio de grão.
  L.push(P(elipse(cx, cy, r2, r2), pedra, { tabua: 0, bisel: 2.2, tom: 1.04, semente: 23, projeta: { dist: 1.4, forca: 0.3, suave: 0.8 } }))
  for (let i = 0; i < 9; i += 1) {
    // As picadas do canteiro: risquinhos curtos, sorteados pelo índice, mais escuros.
    const a = i * 2.39 + 0.3
    const r = r2 * (0.42 + ((i * 37) % 5) * 0.1)
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    L.push(P(capsula(x - 0.8, y - 0.4, x + 0.8, y + 0.4, 0.35), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.62, semente: 24 + i }))
  }
  L.push(P(elipse(cx, cy, rOlho * 1.35, rOlho * 1.35), pedra, { tabua: 0, bisel: 0.6, tom: 0.7, contorno: 0.2, recesso: { k: 1, forca: 0.3 }, semente: 34 }))
  L.push(P(elipse(cx, cy, rOlho, rOlho), TRIGO, { tabua: 0, bisel: 0.4, tom: 0.88, contorno: 0.28, recesso: { k: 1, forca: 0.34 }, semente: 35 }))
  for (const [i, [gx, gy]] of ([[-0.35, -0.2], [0.25, -0.3], [0.05, 0.3], [-0.2, 0.38], [0.4, 0.18]] as const).entries()) {
    L.push(P(elipse(cx + gx * rOlho, cy + gy * rOlho, 0.85, 0.55), TRIGO, { tabua: 0, bisel: 0.3, contorno: 0.32, tom: 1.08, semente: 36 + i }))
  }

  // O CABO de pau em pé, com o topo gasto e claro, e a sombra dele na pedra, para baixo à direita (a da luz do motor).
  const alturaDoCabo = g * (ALTURA_DO_CABO - ALTURA_DA_PEDRA_DE_CIMA)
  L.push(P(capsula(xCabo, yCabo, xCabo + SOMBRA_X * alturaDoCabo, yCabo + SOMBRA_Y * alturaDoCabo, rCabo * 0.9), SOMBRA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.4, semente: 41 }))
  L.push(P(elipse(xCabo, yCabo, rCabo, rCabo), mad, { tabua: 0, bisel: rCabo * 0.5, tom: 1.12, contorno: 0.34, semente: 42 }))

  // O SACO de grão aberto: o pano, a boca enrolada e o trigo dentro.
  // O saco deitado de leve para o alto à esquerda: a boca fica fora do meio, e as dobras correm dela para o fundo.
  L.push(P(poligono(borrao(xSaco, ySaco, rSaco, rSaco * 0.9, 14, 0.09, 5)), saco, { tabua: 0, bisel: 3, contorno: 0.24, semente: 50 }))
  const xBoca = xSaco - rSaco * 0.28
  const yBoca = ySaco - rSaco * 0.26
  for (const [i, a] of [0.2, 0.95, 1.7].entries()) {
    L.push(P(capsula(xBoca + Math.cos(a) * rSaco * 0.55, yBoca + Math.sin(a) * rSaco * 0.55, xBoca + Math.cos(a) * rSaco * 1.15, yBoca + Math.sin(a) * rSaco * 1.15, 0.45), saco, { tabua: 0, bisel: 0, contorno: 0, tom: 0.74, semente: 53 + i }))
  }
  L.push(P(elipse(xBoca, yBoca, rSaco * 0.55, rSaco * 0.5), saco, { tabua: 0, bisel: 1.4, tom: 1.12, contorno: 0.28, semente: 51, projeta: { dist: 0.8, forca: 0.26 } }))
  L.push(P(elipse(xBoca, yBoca, rSaco * 0.38, rSaco * 0.33), TRIGO, { tabua: 0, bisel: 0.6, tom: 0.92, contorno: 0.26, recesso: { k: 1, forca: 0.3 }, semente: 52 }))

  // A GAMELA de pau com farinha.
  L.push(P(elipse(xGamela, yGamela, rGamela, rGamela * 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 1.2, tom: 1.0, contorno: 0.26, semente: 60 }))
  L.push(P(elipse(xGamela, yGamela, rGamela * 0.74, rGamela * 0.56), FARINHA, { tabua: 0, bisel: 0.8, contorno: 0.2, recesso: { k: 1, forca: 0.2 }, semente: 61 }))
}
