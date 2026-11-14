/**
 * GANGORRA de cima com volume (lote L11 dos objetos novos, 14/11/2026,
 * "Descanso e brincadeira"): a gangorra de quintal, uma TÁBUA comprida
 * apoiada no meio num EIXO de ferro entre dois PILARES de madeira, com um
 * PEGADOR em T perto de cada ponta. Parada como fica quando ninguém está
 * nela: uma ponta no chão (oeste) e a outra no ar (leste). Debaixo de cada
 * ponta, o CHÃO GASTO de terra batida, de tanto pé empurrando.
 *
 * De cima, a gangorra é uma tábua com dois T: o que diz que ela está
 * inclinada é a SOMBRA, colada na ponta baixa e caída longe da ponta alta, e
 * a tábua que clareia para a ponta de cima (mais perto da luz). Os pilares e
 * o eixo aparecem dos dois lados da tábua, no meio.
 *
 * Na 3/4 a tábua sobe INCLINADA: ela é cortada em fatias ao comprido
 * (`tampoEmFatias.ts`), cada uma um tampo solto na altura da tábua naquele
 * ponto. O pegador sobe com a tábua: a haste, um pouco deitada para o meio, é
 * fatiada também (do pé dela na tábua até o pegador), e a barra do pegador é
 * um tampo no alto da haste. Os pilares são colunas até o eixo; o eixo é um
 * tampo na altura dele. O perfil é o derivado sem beirada (`espessura: 0`).
 *
 * Desenhada em 2,4 x 0,6 casas: o comprimento sai da largura da pegada e a
 * largura dos pegadores, da altura. Materiais: `madeira` (a tábua e os
 * pilares) e `metal` (o eixo e os pegadores).
 */
import { barra, caixa, capsula, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { circulo, emFatias, noAr } from './tampoEmFatias'

/** Alturas em casas: o eixo (o meio da tábua) e o quanto cada ponta desce ou sobe dele. */
const ALTURA_DO_EIXO = 0.42
const DESNIVEL_DA_PONTA = 0.33
/** A haste do pegador, da tábua até a barra (casas), e o quanto ela deita para o meio (px do protótipo). */
const ALTURA_DO_PEGADOR = 0.22
const DEITADA_DA_HASTE = 3

/** A tábua: a meia largura (casas) e o quanto ela fica dentro da pegada em cada ponta (fração da meia largura). */
const MEIA_LARGURA_DA_TABUA = 0.1
const ALCANCE_DA_TABUA = 0.97
/** O pegador fica a esta fração do meio comprimento da tábua; a barra vai até esta fração da meia altura da pegada. */
const LUGAR_DO_PEGADOR = 0.8
const MEIA_BARRA = 0.72
const RAIO_DA_BARRA = 1.25
const RAIO_DA_HASTE = 1.1
/** Os pilares: o lado (casas) e o afastamento da tábua (px do protótipo). */
const LADO_DO_PILAR = 0.12
const FOLGA_DO_PILAR = 1.2

/**
 * As fatias da tábua e da haste e a sobra de cada uma (px do protótipo). Fatia fina: o cisalhamento de cada uma
 * (`tampoEmFatias.ts`) aparece de cima como um dente na beira da tábua, de meio passo de altura; com 48 fatias o
 * dente passava de pixel no zoom grande.
 */
const FATIAS_DA_TABUA = 160
const FATIAS_DA_HASTE = 6
const SOBRA = 0.2
const SOBRA_DA_HASTE = 0.5

/** O chão gasto debaixo de cada ponta: os raios, em fração da meia altura da pegada e do meio comprimento. */
const CHAO_GASTO_Y = 0.95
const CHAO_GASTO_X = 0.2
const TERRA_BATIDA: MaterialDaPeca = { classe: 'liso', rgb: [0x86, 0x69, 0x4c] }
/** Fraco: a gangorra posta em lajota clara ficava com duas poças de barro nas pontas, a 0,5. */
const ALFA_DO_CHAO_GASTO = 0.3
/** A luz que a tábua ganha de uma ponta à outra: a de cima, mais perto da luz e menos suja. */
const LUZ_DA_SUBIDA = 0.08

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A terra batida: manchada, com a beira desfeita (a do balanço). */
const texDaTerra: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.35 + p.su, y * 0.35 + p.sv) * 0.12 + ruido(x * 1.2, y * 1.2 + p.su) * 0.05
  s[5] *= 0.75 + ruido(x * 0.12 + p.sv, y * 0.12 + p.su) * 0.5
}

/**
 * A TÁBUA: a madeira, clareando para a ponta de cima; o assento de cada ponta gasto (o meio da largura mais claro,
 * de tanto sentar) e a ponta de baixo suja de terra.
 */
function texDaTabua(meio: number, xAssento: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    s[3] += LUZ_DA_SUBIDA * limitar(x / meio, -1, 1)
    const noAssento = limitar(1 - Math.abs(Math.abs(x) - xAssento) / (meio * 0.18), 0, 1)
    s[3] += 0.07 * noAssento * (1 - (y * y) / 30)
    if (x < -meio * 0.9) s[3] -= 0.1 * limitar((-x - meio * 0.9) / (meio * 0.1), 0, 1)
  }
}

interface Obra {
  readonly c: ContextoDoMovel
  readonly cena: Cena
  /** A altura da tábua (px) em cada x. */
  readonly altura: (x: number) => number
  readonly meio: number
}

/** O CHÃO GASTO debaixo da ponta `lado`. */
function montarChao(o: Obra, lado: number, semente: number): void {
  const { c, cena } = o
  const cx = lado * o.meio * 0.93
  cena.partes.push(c.peca(elipse(cx, 0, o.meio * CHAO_GASTO_X, c.hh * CHAO_GASTO_Y), TERRA_BATIDA, { bisel: 0, contorno: 0, alfa: ALFA_DO_CHAO_GASTO, suave: 2.4, textura: texDaTerra, semente }))
}

/** Um PILAR do eixo, ao norte ou ao sul da tábua: a coluna até o eixo, o topo e o contato. */
function montarPilar(o: Obra, lado: number, mt: number, semente: number): void {
  const { c, cena } = o
  const l = c.g * LADO_DO_PILAR
  const y0 = lado * (mt + FOLGA_DO_PILAR)
  const y1 = y0 + lado * l
  const forma = caixa(-l / 2, Math.min(y0, y1), l / 2, Math.max(y0, y1), 0.6)
  cena.sombras.push({ forma, z: c.g * ALTURA_DO_EIXO }, contato(forma, 0.34))
  // A caixa puxada para o leste: o meio dela sai do eixo (que passa no meio do pilar, mais alto) e o pilar sobe
  // com a coluna dele, e não com o eixo.
  const naCaixa: Forma = { b: [forma.b[0], forma.b[1], forma.b[2] + l * 0.6, forma.b[3]], d: forma.d }
  cena.partes.push(c.peca(naCaixa, c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: 1.1, contorno: 0.28, tom: 0.8, semente }))
}

/** Um PEGADOR: a haste fatiada da tábua até a barra (deitada para o meio) e a barra em T no alto dela. */
function montarPegador(o: Obra, lado: number, semente: number): void {
  const { c, cena } = o
  const metal = c.m.metal
  const xPe = lado * o.meio * LUGAR_DO_PEGADOR
  const xAlto = xPe - lado * DEITADA_DA_HASTE
  const zPe = o.altura(xPe)
  const zAlto = zPe + c.g * ALTURA_DO_PEGADOR
  const haste = capsula(xPe, 0, xAlto, 0, RAIO_DA_HASTE)
  const de = Math.min(xPe, xAlto)
  const ate = Math.max(xPe, xAlto)
  emFatias(c, cena, haste, metal, { bisel: RAIO_DA_HASTE, contorno: 0.3, semente }, {
    eixo: 'x', de: de - RAIO_DA_HASTE, ate: ate + RAIO_DA_HASTE, fatias: FATIAS_DA_HASTE, sobra: SOBRA_DA_HASTE,
    altura: (x) => zPe + (zAlto - zPe) * limitar((x - xPe) / (xAlto - xPe), 0, 1),
  })
  const meia = c.hh * MEIA_BARRA
  const barraDoPegador = noAr(cena, capsula(xAlto, -meia, xAlto, meia, RAIO_DA_BARRA), zAlto)
  cena.partes.push(c.peca(barraDoPegador, metal, { eixo: QUARTO, bisel: RAIO_DA_BARRA, contorno: 0.3, semente: semente + 1, projeta: { dist: 1.2, forca: 0.3, suave: 0.8 } }))
  // As duas manoplas de madeira nas pontas da barra: o que a mão segura.
  for (const ponta of [-1, 1]) {
    const y = ponta * meia * 0.78
    const manopla = noAr(cena, capsula(xAlto, y - meia * 0.2, xAlto, y + meia * 0.2, RAIO_DA_BARRA * 1.35), zAlto + 0.2)
    cena.partes.push(c.peca(manopla, c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: RAIO_DA_BARRA * 1.2, contorno: 0.28, tom: 0.78, semente: semente + 2 + ponta }))
  }
  // A sombra do pegador no chão, caída da altura dele.
  const sx = SOMBRA_X * zAlto
  const sy = SOMBRA_Y * zAlto
  cena.sombras.push({ forma: capsula(xAlto + sx, -meia + sy, xAlto + sx, meia + sy, RAIO_DA_BARRA), z: 0, suave: 1.6, forca: 0.2 })
}

/** A SOMBRA da tábua no chão: cada ponta caída da altura dela (a de baixo, colada; a de cima, longe). */
function sombraDaTabua(o: Obra, mt: number): Forma {
  const pontos: Ponto[] = []
  for (const [x, y] of [[-o.meio, -mt], [o.meio, -mt], [o.meio, mt], [-o.meio, mt]] as const) {
    const z = o.altura(x)
    pontos.push([x + SOMBRA_X * z, y + SOMBRA_Y * z])
  }
  return poligono(pontos)
}

export const montarGangorra: MontarMovel = (c, cena) => {
  const { hw, g, peca: P } = c
  const meio = hw * ALCANCE_DA_TABUA
  const zEixo = g * ALTURA_DO_EIXO
  const desnivel = g * DESNIVEL_DA_PONTA
  const altura = (x: number): number => zEixo + desnivel * limitar(x / meio, -1, 1)
  const o: Obra = { c, cena, altura, meio }
  const mt = g * MEIA_LARGURA_DA_TABUA

  // No chão: a terra gasta debaixo das pontas e a sombra da tábua.
  montarChao(o, -1, 6100)
  montarChao(o, 1, 6102)
  cena.sombras.push({ forma: sombraDaTabua(o, mt), z: 0, suave: 2, forca: 0.26 })
  cena.sombras.push(contato(caixa(-meio, -mt, -meio + 6, mt, 1), 0.3))

  // Os pilares e o eixo, por baixo da tábua.
  montarPilar(o, -1, mt, 6110)
  montarPilar(o, 1, mt, 6112)
  const yEixo = mt + FOLGA_DO_PILAR + g * LADO_DO_PILAR + 1.4
  // O eixo em duas pontas, uma de cada lado da tábua: inteiro, a 3/4 o pintava por cima dela (a base dele fica
  // ao sul da tábua); a ponta do norte é pintada antes da tábua e some atrás dela.
  for (const lado of [-1, 1]) {
    const ponta = noAr(cena, barra(0, lado * yEixo, 0, lado * (mt - 1), 2.4), zEixo + 0.5)
    cena.partes.push(P(ponta, c.m.metal, { eixo: QUARTO, bisel: 1.2, contorno: 0.3, semente: 6114 + lado }))
  }
  for (const lado of [-1, 1]) {
    const porca = noAr(cena, elipse(0, lado * (yEixo - 0.6), 1.7, 1.2), zEixo + 0.8)
    cena.partes.push(P(porca, c.m.metal, { bisel: 1, contorno: 0.3, metal: 0.5, semente: 6116 + lado }))
  }

  // A tábua, fatiada ao comprido.
  const tabua = caixa(-meio, -mt, meio, mt, 1.4)
  emFatias(c, cena, tabua, c.m.madeira, { eixo: 0, tabua: 0, bisel: 1.5, contorno: 0.28, semente: 6120, textura: texDaTabua(meio, meio * 0.92) }, {
    eixo: 'x', de: -meio - 1, ate: meio + 1, altura, fatias: FATIAS_DA_TABUA, sobra: SOBRA,
  })
  // Os pregos que prendem a tábua no berço do eixo, no meio.
  for (const [i, [dx, dy]] of ([[-2.6, -0.5], [2.6, 0.5]] as const).entries()) {
    const prego = noAr(cena, elipse(dx, dy * mt, 0.65, 0.65), altura(dx) + 0.3)
    cena.partes.push(P(prego, c.m.metal, { bisel: 0.6, contorno: 0, metal: 0.25, semente: 6130 + i }))
  }

  montarPegador(o, -1, 6140)
  montarPegador(o, 1, 6150)
}
