/**
 * LITEIRA (cadeirinha de nobre) de cima com volume (objetos de 14/11/2026,
 * grupo Cidade e vila): a caixa fechada em que o nobre vai sentado, levada por
 * dois carregadores pelos VARAIS compridos. De cima aparecem o TELHADO de
 * quatro águas forrado de pano (as águas da esquerda e do alto pegam a luz),
 * com os frisos de metal nas quinas, a CUMEEIRA curta com o remate no meio e as
 * quatro pinhas na cornija; a franja de borlas em volta da cornija; e os dois
 * VARAIS de pau, presos nos lados da caixa por braçadeiras de metal, passando
 * bem à frente e bem atrás dela, com as ponteiras de metal.
 *
 * O que diz "liteira" a 1x: a caixa de telhado de pano no meio de duas varas
 * compridas que sobram dos dois lados (é carregada, não é casinha nem baú).
 *
 * NA 3/4 (`tresQuartos.ts`, derivado, espessura 0) a caixa é uma coluna alta
 * com o telhado em cima e a FACE DA PORTA na frente (ver `guardarFace`), e os
 * varais são tampos soltos na altura da cintura.
 *
 * Materiais: `madeira` (os varais e a cornija), `pano` (o forro do telhado, um
 * tecido) e `metal` (os frisos, as pinhas, o remate, as borlas, as braçadeiras
 * e as ponteiras).
 */
import { caixa, capsula, elipse, menos, poligono, type Forma } from './formas'
import { contato, type Cena, type MaterialDaPeca, type OpcoesDaPeca } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/**
 * Alturas, em casas: a caixa (até a cornija; o telhado, o remate e as pinhas
 * sobem com ela) e os varais. A caixa não passa muito do fundo dela na pegada
 * (0,44 da altura de 2,2 casas, ~0,97 casa): a face da porta, guardada debaixo
 * do telhado, tem de caber nele.
 */
const ALTURA_DA_CAIXA = 0.95
const ALTURA_DOS_VARAIS = 0.42
/** A fresta que leva a face da porta (px do protótipo): a grossura e quanto ela sobe. */
const FRESTA = 0.25
const SUBIDA_DA_FACE = 1
/** O vidro escuro da janela da porta e o reflexo dele. */
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x35, 0x3a] }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xc7, 0xd2, 0xcf] }

/** A caixa (frações da pegada): a meia largura e a meia altura dela; a cornija passa da caixa esta fração da largura. */
const MEIA_CAIXA_X = 0.37
const MEIA_CAIXA_Y = 0.22
const CORNIJA = 0.05
/** A cumeeira: a meia altura dela, em fração da meia altura da caixa. */
const CUMEEIRA = 0.38
/** Os varais: o centro de cada um (fração da largura) e o raio (fração da largura). */
const VARAL_X = 0.445
const RAIO_DO_VARAL = 0.045
/** A ponteira de metal em cada ponta do varal (fração da altura). */
const PONTEIRA = 0.025
/** A luz de cada água do telhado (esquerda, alto, direita, baixo): a luz vem de cima à esquerda. */
const LUZ_DAS_AGUAS = [1.12, 1.06, 0.8, 0.74] as const
/** O passo das borlas da franja, em px do protótipo. */
const PASSO_DAS_BORLAS = 4.6

/** Um friso de metal de `grossura` px em volta do retângulo (x0, y0)-(x1, y1). */
function moldura(x0: number, y0: number, x1: number, y1: number, grossura: number): Forma {
  return menos(caixa(x0, y0, x1, y1, 1.2), caixa(x0 + grossura, y0 + grossura, x1 - grossura, y1 - grossura, 0.8))
}

/**
 * A FACE DA PORTA, desenhada de frente no lugar em que a 3/4 a mostra (entre
 * `yTopo`, debaixo da cornija, e `yBase`, o pé da caixa) e GUARDADA na vista
 * de cima, como a face do espaldar do trono: cada peça é pintada `SUBIDA_DA_FACE`
 * px mais abaixo, debaixo do telhado, com a caixa de pintura espelhada em volta
 * da FRESTA (um tampo no ar de um quarto de px, sem sombra, logo à frente da
 * caixa). A fresta sobe o mesmo tanto e leva a face de volta ao lugar; como a
 * base dela fica ao sul da caixa, a face é pintada por cima da frente varrida.
 * O friso dourado da porta, a janela de vidro com as duas cortinas presas e a
 * bandô, o painel de baixo com o brasão e o puxador.
 */
function guardarFace(c: ContextoDoMovel, cena: Cena, cxC: number, yTopo: number, yBase: number, yFresta: number): void {
  const { peca: P } = c
  const meio = yFresta + FRESTA / 2
  const naFace = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    const alcance = Math.max(Math.abs(forma.b[1] + SUBIDA_DA_FACE - meio), Math.abs(forma.b[3] + SUBIDA_DA_FACE - meio))
    const guardada: Forma = { b: [forma.b[0], meio - alcance, forma.b[2], meio + alcance], d: (x, y) => forma.d(x, y - SUBIDA_DA_FACE) }
    cena.partes.push(P(guardada, mat, o))
  }
  const alto = yBase - yTopo
  const y = (t: number): number => yTopo + t * alto
  const x = (t: number): number => t * cxC
  const ouro = { bisel: 0.4, contorno: 0.24, metal: 0.55 }
  // A porta: o friso de fora.
  naFace(moldura(x(-0.66), y(0.06), x(0.66), y(0.96), 1.3), c.m.metal, { ...ouro, semente: 70 })
  // A janela: o vidro, o reflexo de través, a bandô de pano e as duas cortinas presas no meio da altura.
  const [jx0, jx1, jy0, jy1] = [x(-0.5), x(0.5), y(0.14), y(0.5)]
  naFace(caixa(jx0, jy0, jx1, jy1, 1), VIDRO, { tabua: 0, bisel: 0.6, contorno: 0.3, metal: 0.6, semente: 71 })
  naFace(poligono([[x(0.05), jy0 + 1], [x(0.22), jy0 + 1], [x(-0.02), jy1 - 1], [x(-0.19), jy1 - 1]]), REFLEXO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, semente: 72 })
  for (const [i, s] of [-1, 1].entries()) {
    const cortina = poligono([[s * x(0.5), jy0], [s * x(0.2), jy0], [s * x(0.36), y(0.36)], [s * x(0.3), jy1], [s * x(0.5), jy1]])
    naFace(cortina, c.m.pano, { tabua: 0, bisel: 1, tom: 1.04, contorno: 0.26, semente: 73 + i })
    naFace(elipse(s * x(0.37), y(0.37), 0.9, 0.9), c.m.metal, { ...ouro, semente: 75 + i })
  }
  naFace(caixa(jx0 - 0.4, jy0 - 0.6, jx1 + 0.4, jy0 + alto * 0.05, 0.6), c.m.pano, { tabua: 0, bisel: 0.8, tom: 0.9, contorno: 0.26, semente: 77 })
  naFace(moldura(jx0 - 0.9, jy0 - 0.9, jx1 + 0.9, jy1 + 0.9, 0.9), c.m.metal, { ...ouro, semente: 78 })
  // O painel de baixo, com o brasão no meio, e o puxador.
  naFace(moldura(x(-0.46), y(0.58), x(0.46), y(0.88), 0.9), c.m.metal, { ...ouro, semente: 79 })
  naFace(elipse(0, y(0.73), x(0.15), x(0.15)), c.m.metal, { bisel: 0.8, contorno: 0.28, metal: 0.55, semente: 80 })
  naFace(elipse(0, y(0.73), x(0.09), x(0.09)), c.m.pano, { tabua: 0, bisel: 0.6, contorno: 0.26, semente: 81 })
  naFace(elipse(x(0.54), y(0.54), 0.9, 0.9), c.m.metal, { ...ouro, semente: 82 })
  cena.sombras.push({ forma: caixa(-cxC + 0.5, yFresta, cxC - 0.5, yFresta + FRESTA), z: SUBIDA_DA_FACE, solta: true, forca: 0 })
}

export const montarLiteira: MontarMovel = (c, cena) => {
  const { w, h, hh, g, peca: P } = c
  const mad = c.m.madeira
  const pano = c.m.pano
  const metal = c.m.metal
  const L = cena.partes
  const cxC = MEIA_CAIXA_X * w
  const cyC = MEIA_CAIXA_Y * h
  const corn = CORNIJA * w
  const xV = VARAL_X * w
  const rV = RAIO_DO_VARAL * w
  const yCume = CUMEEIRA * cyC
  const xCume = 0.06 * w

  // As alturas: a caixa é uma coluna; os varais, tampos soltos.
  cena.sombras.push(
    contato(caixa(-cxC, -cyC, cxC, cyC, 1.2), 0.32),
    // A coluna vai até a beira da cornija: as pinhas e as borlas, que passam da caixa, sobem com ela.
    { forma: caixa(-cxC - corn, -cyC - corn, cxC + corn, cyC + corn, 1.6), z: g * ALTURA_DA_CAIXA },
  )
  for (const s of [-1, 1]) {
    cena.sombras.push({ forma: capsula(s * xV, -hh + rV, s * xV, hh - rV, rV), z: g * ALTURA_DOS_VARAIS, solta: true, forca: 0.3 })
  }

  // A face da porta, só de frente, guardada antes de tudo: o telhado e a cornija a cobrem na vista de cima.
  // Girada, a 3/4 mostra o lado ou as costas da caixa, lisas.
  if (c.giro === 0) {
    const zCaixa = g * ALTURA_DA_CAIXA
    const yPe = cyC + corn
    guardarFace(c, cena, cxC, yPe - zCaixa + corn + 0.6, yPe, yPe + 0.3)
  }

  // Os VARAIS, de ponta a ponta, com as ponteiras de metal e as braçadeiras na caixa.
  for (const [i, s] of [-1, 1].entries()) {
    const x = s * xV
    L.push(P(capsula(x, -hh + rV, x, hh - rV, rV), mad, { eixo: QUARTO, tabua: 0, bisel: rV * 0.7, tom: 1.0, contorno: 0.26, semente: 10 + i, projeta: { dist: 1.2, forca: 0.3, suave: 0.6 } }))
    for (const [j, [y0, y1]] of ([[-hh + 0.2, -hh + PONTEIRA * h], [hh - PONTEIRA * h, hh - 0.2]] as const).entries()) {
      L.push(P(capsula(x, y0 + rV * 0.8, x, y1 - rV * 0.8, rV * 1.05), metal, { bisel: rV * 0.6, contorno: 0.28, metal: 0.55, semente: 12 + i * 2 + j }))
    }
  }

  // A CORNIJA de madeira em volta do alto da caixa, um pouco mais larga que ela.
  L.push(P(caixa(-cxC - corn, -cyC - corn, cxC + corn, cyC + corn, 1.6), mad, { tabua: 0, bisel: 1.4, tom: 0.9, semente: 20, projeta: { dist: 1.4, forca: 0.32, suave: 0.8 } }))

  // A FRANJA: as borlas de metal em volta da beira da cornija.
  const borla = (x: number, y: number, k: number): void => {
    L.push(P(elipse(x, y, 0.85, 0.85), metal, { bisel: 0.5, contorno: 0.3, metal: 0.55, semente: 30 + k }))
  }
  const nx = Math.max(2, Math.round((2 * (cxC + corn)) / PASSO_DAS_BORLAS))
  const ny = Math.max(2, Math.round((2 * (cyC + corn)) / PASSO_DAS_BORLAS))
  for (let i = 0; i <= nx; i += 1) {
    const x = -cxC - corn + (i / nx) * 2 * (cxC + corn)
    borla(x, -cyC - corn + 0.9, i)
    borla(x, cyC + corn - 0.9, i + 1)
  }
  for (let i = 1; i < ny; i += 1) {
    const y = -cyC - corn + (i / ny) * 2 * (cyC + corn)
    borla(-cxC - corn + 0.9, y, i + 2)
    borla(cxC + corn - 0.9, y, i + 3)
  }

  // O TELHADO de quatro águas forrado de pano: cada água com a luz dela.
  const a = cxC
  const b = cyC
  const aguas = [
    [[-a, -b], [-xCume, -yCume], [-xCume, yCume], [-a, b]],
    [[-a, -b], [a, -b], [xCume, -yCume], [-xCume, -yCume]],
    [[a, -b], [a, b], [xCume, yCume], [xCume, -yCume]],
    [[-a, b], [-xCume, yCume], [xCume, yCume], [a, b]],
  ] as const
  for (const [i, pts] of aguas.entries()) {
    L.push(P(poligono(pts), pano, { tabua: 0, bisel: 0.5, tom: LUZ_DAS_AGUAS[i], contorno: 0.18, semente: 40 + i }))
  }
  L.push(P(caixa(-xCume, -yCume, xCume, yCume), pano, { tabua: 0, bisel: 0.4, tom: 1.16, contorno: 0.2, semente: 44 }))

  // Os FRISOS de metal nas quinas do telhado e na cumeeira.
  const friso = { bisel: 0.4, contorno: 0.28, metal: 0.55 }
  for (const [i, [sx, sy]] of ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).entries()) {
    L.push(P(capsula(sx * a, sy * b, sx * xCume, sy * yCume, 0.7), metal, { ...friso, semente: 50 + i }))
  }
  L.push(P(capsula(0, -yCume, 0, yCume, 0.8), metal, { ...friso, semente: 54 }))

  // As PINHAS nos cantos da cornija e o REMATE no meio da cumeeira.
  for (const [i, [sx, sy]] of ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).entries()) {
    L.push(P(elipse(sx * (a + corn * 0.4), sy * (b + corn * 0.4), corn * 0.75, corn * 0.75), metal, { bisel: corn * 0.4, contorno: 0.3, metal: 0.6, semente: 60 + i, projeta: { dist: 0.8, forca: 0.3 } }))
  }
  L.push(P(elipse(0, 0, 0.06 * w, 0.06 * w), metal, { bisel: 0.035 * w, contorno: 0.32, metal: 0.62, semente: 64, projeta: { dist: 1.4, forca: 0.36, suave: 0.6 } }))
}
