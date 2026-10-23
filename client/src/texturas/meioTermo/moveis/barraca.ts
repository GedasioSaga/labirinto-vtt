/**
 * BARRACA DE FEIRA (peça nova da MT4). Materiais: `toldo` (tecido) e
 * `madeira` (balcão, esteios e cumeeira); as listras do toldo são de linho cru (de vinho no toldo de linho)
 * e as frutas do balcão têm cores fixas.
 *
 * - De Frente (de cima com volume), portada da barraca do protótipo da vila
 *   (função `barraca`): o toldo de duas águas visto do alto, a água de cima
 *   na luz e a de baixo na sombra, com listras, a beira recortada em gomos e
 *   a cumeeira; embaixo dele aparece o balcão com as frutas. A sombra do
 *   toldo alto cai para baixo e para a direita.
 * - De Lado (a frente em pé, como o armário de lado): o toldo listrado em
 *   trapézio no alto com a sanefa em gomos, os dois esteios com o vão aberto
 *   entre eles (o chão aparece) e o balcão de tábuas com as frutas em cima.
 */
import { caixa, capsula, dentroDe, elipse, poligono } from './formas'
import { contato, type Cena, type MaterialDaPeca } from './motor'
import { materialDaPeca, QUARTO, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'

/** As frutas e verduras do balcão (os PRODUTOS da vila). */
const PRODUTOS: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: [0x8a, 0x4c, 0x3e] },
  { classe: 'liso', rgb: [0x6b, 0x7a, 0x3e] },
  { classe: 'liso', rgb: [0xa3, 0x7a, 0x42] },
  { classe: 'liso', rgb: [0x7d, 0x5f, 0x86] },
  { classe: 'liso', rgb: [0x9a, 0x6a, 0x3a] },
]
/** Altura do toldo em casas (a sombra). */
const ALTURA_DO_TOLDO = 1.4
/** Medidas da vila: o toldo tinha meia largura 30 e meia altura 23, e o balcão descia até 31,5. */
const MEIA_LARGURA_DA_VILA = 30
const TOPO_DA_VILA = -23
const BASE_DA_VILA = 31.5
const LISTRAS = 3
/** De frente: as faixas do toldo (vermelho, creme, vermelho...), 3 listras entre 4 panos. */
const FAIXAS = LISTRAS * 2 + 1
/**
 * De frente, em fração da altura da pegada a partir de cima. Revisão da MT4: o
 * toldo da vila escondia o balcão (19% da altura) e os gomos caíam em cima das
 * frutas; agora o toldo vai até 60% (a cumeeira a 25%), os gomos até 66% e o
 * balcão de 68% ao pé, com as frutas inteiras a 76%.
 */
const CUMEEIRA = 0.25
const FIM_DO_TOLDO = 0.6
const FIM_DOS_GOMOS = 0.66
const INICIO_DO_BALCAO = 0.68
const LINHA_DAS_FRUTAS = 0.76
/** A faixa de sombra do toldo no fundo do balcão, em casas. */
const FAIXA_DE_SOMBRA = 0.05
const SOMBRA_DO_TOLDO: MaterialDaPeca = { classe: 'liso', rgb: [0x2a, 0x1e, 0x18] }

/**
 * A cor das listras: linho cru; no toldo de linho, vinho (linho sobre linho
 * dava um toldo liso, sem listra nenhuma).
 */
function listraDoToldo(toldo: MaterialDaPeca): MaterialDaPeca {
  return materialDaPeca(toldo.fio === 'linho' ? 'vinho' : 'linho')
}

function montarBarracaDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, w, h, peca: P } = c
  const toldo = c.m.toldo
  const mad = c.m.madeira
  const linho = listraDoToldo(toldo)
  const nA = (f: number): number => -hh + f * h
  const L = cena.partes
  const yBeira = nA(0.3)
  const yBalcao = nA(0.66)
  sombraDeLado(cena, caixa(-hw * 0.9, yBalcao, hw * 0.9, hh, 1), 10)
  // Os esteios, do toldo ao chão, por trás do balcão.
  for (const lado of [-1, 1]) L.push(P(caixa(lado * 0.4 * w - 2.2, yBeira - 2, lado * 0.4 * w + 2.2, hh - 0.5, 0.8), mad, { tabua: 0, eixo: QUARTO, bisel: 1.1, tom: 0.9, semente: 440 + lado }))
  // O toldo: trapézio (mais largo embaixo), listrado, a luz de cima.
  const topo = nA(0.04)
  L.push(P(poligono([[-hw * 0.82, topo], [hw * 0.82, topo], [hw, yBeira], [-hw, yBeira]]), toldo, { tabua: 0, bisel: 1.6, tom: 1.04, ruga: 1.1, semente: 410 }))
  for (let i = 0; i < LISTRAS; i += 1) {
    const f0 = (i * 2 + 0.5) / (LISTRAS * 2 + 0.5)
    const f1 = f0 + 0.6 / (LISTRAS * 2 + 0.5)
    const em = (f: number, y: number): number => {
      const meia = y === topo ? hw * 0.82 : hw
      return -meia + 2 * meia * f
    }
    L.push(P(poligono([[em(f0, topo), topo], [em(f1, topo), topo], [em(f1, yBeira), yBeira], [em(f0, yBeira), yBeira]]), linho, { tabua: 0, bisel: 0.8, tom: 1.0, ruga: 1.1, semente: 412 + i }))
  }
  // A sanefa em gomos, na sombra do toldo.
  const gomos = 7
  for (let i = 0; i < gomos; i += 1) {
    const x = -hw + (w * (i + 0.5)) / gomos
    L.push(P(elipse(x, yBeira, w / gomos / 2 + 0.4, 0.045 * h), toldo, { bisel: 1.4, tom: 0.76, semente: 420 + i }))
  }
  // O balcão de tábuas deitadas, com o tampo mais claro e as frutas em cima.
  L.push(P(caixa(-hw * 0.9, yBalcao, hw * 0.9, hh - 0.04 * h, 1), mad, { tabua: 0.075 * h, bisel: 1.2, tom: 0.84, semente: 401 }))
  L.push(P(caixa(-hw * 0.93, yBalcao - 0.035 * h, hw * 0.93, yBalcao + 0.015 * h, 0.8), mad, { tabua: 0, bisel: 0.8, tom: 1.06, semente: 402 }))
  for (let i = 0; i < 7; i += 1) {
    const x = -hw * 0.75 + (i * 1.5 * hw) / 6
    L.push(P(elipse(x, yBalcao - 0.06 * h, 0.05 * w, 0.045 * h), PRODUTOS[i % PRODUTOS.length], { bisel: 1.8, contorno: 0.25, semente: 403 + i }))
  }
}

export const montarBarraca: MontarMovel = (c, cena) => {
  if (c.lado === 'lado') {
    montarBarracaDeLado(c, cena)
    return
  }
  const { hw, hh, w, h, peca: P } = c
  const sx = (hw * 0.98) / MEIA_LARGURA_DA_VILA
  const sy = h / (BASE_DA_VILA - TOPO_DA_VILA)
  const X = (x: number): number => x * sx
  /** Altura em fração da pegada, de cima (0) para baixo (1). */
  const F = (f: number): number => -hh + f * h
  const toldo = c.m.toldo
  const mad = c.m.madeira
  const listra = listraDoToldo(toldo)
  const meiaDoToldo = X(MEIA_LARGURA_DA_VILA)
  const banda = (2 * meiaDoToldo) / FAIXAS
  cena.sombras.push(
    { forma: caixa(-meiaDoToldo, F(0), meiaDoToldo, F(FIM_DO_TOLDO), 2), z: c.g * ALTURA_DO_TOLDO, solta: true, forca: 0.3 },
    contato(caixa(X(-26), F(INICIO_DO_BALCAO), X(26), F(1) - 0.5, 1), 0.25),
  )
  const L = cena.partes
  // O balcão, inteiro abaixo do toldo, com a faixa de sombra do toldo no fundo e as frutas.
  L.push(P(caixa(X(-26), F(INICIO_DO_BALCAO), X(26), F(1) - 0.5, 1), mad, { bisel: 1.2, tabua: 5 * sy, semente: 401 }))
  L.push(P(caixa(X(-26), F(INICIO_DO_BALCAO), X(26), F(INICIO_DO_BALCAO) + FAIXA_DE_SOMBRA * c.g, 0.5), SOMBRA_DO_TOLDO, { alfa: 0.25, bisel: 0, contorno: 0, suave: 1, semente: 409 }))
  for (let i = 0; i < 7; i += 1) {
    L.push(P(elipse(X(-21 + i * 7), F(LINHA_DAS_FRUTAS), 2.9 * sx, 2.6 * sy), PRODUTOS[i % PRODUTOS.length], { bisel: 2 * sx, contorno: 0.25, semente: 402 + i }))
  }
  // As duas águas do toldo (0 a 60% da altura, a cumeeira a 25%): a de cima na luz, a de baixo na sombra.
  L.push(P(caixa(-meiaDoToldo, F(0), meiaDoToldo, F(CUMEEIRA) + 0.6, 1.5), toldo, { bisel: 2.6, tom: 1.08, ruga: 1.1, semente: 410 }))
  L.push(P(caixa(-meiaDoToldo, F(CUMEEIRA) - 0.6, meiaDoToldo, F(FIM_DO_TOLDO), 1.5), toldo, { bisel: 2.6, tom: 0.8, ruga: 1.1, semente: 411 }))
  for (let i = 1; i < FAIXAS; i += 2) {
    const x0 = -meiaDoToldo + banda * i
    L.push(P(caixa(x0, F(0), x0 + banda, F(CUMEEIRA) + 0.6, 0.6), listra, { bisel: 1.4, tom: 1.04, ruga: 1.1, semente: 413 + i }))
    L.push(P(caixa(x0, F(CUMEEIRA) - 0.6, x0 + banda, F(FIM_DO_TOLDO), 0.6), listra, { bisel: 1.4, tom: 0.78, ruga: 1.1, semente: 416 + i }))
  }
  // A beira recortada: um meio-disco por faixa, da cor da faixa (vermelho e creme alternados, como as listras).
  for (let i = 0; i < FAIXAS; i += 1) {
    const xc = -meiaDoToldo + banda * (i + 0.5)
    const gomo = dentroDe(elipse(xc, F(FIM_DO_TOLDO), banda / 2, (FIM_DOS_GOMOS - FIM_DO_TOLDO) * h), caixa(xc - banda / 2, F(FIM_DO_TOLDO) - 0.4, xc + banda / 2, F(FIM_DOS_GOMOS)))
    L.push(P(gomo, i % 2 === 1 ? listra : toldo, { bisel: 1.6, tom: 0.86, ruga: 1.1, semente: 420 + i }))
  }
  L.push(P(capsula(-hw + 1.5, F(CUMEEIRA), hw - 1.5, F(CUMEEIRA), 0.022 * w + 0.4), mad, { bisel: 1.3, tabua: 0, semente: 430 }))
}
