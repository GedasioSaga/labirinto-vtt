/**
 * QUIOSQUE de cima com volume (lote L17 de 14/11/2026, construção do grupo Cidade e porto): a banca redonda da
 * praça e do cais, de madeira pintada. No PEDESTAL de pedra, a PAREDE redonda em gomos (os painéis), a JANELA de
 * atender com o BALCÃO de jornais na frente (a frente do quiosque é o lado da janela), o TOLDO listrado em três
 * caimentos por cima dela, os CARTAZES nos painéis e a CÚPULA em gomos com a franja de latão e o PINÁCULO.
 *
 * De cima: a cúpula redonda em doze gomos (os do lado da luz mais claros) com a franja de latão, o toldo listrado
 * saindo na frente e a beira do pedestal, e a SOMBRA da cúpula e do toldo para baixo à direita. São o toldo listrado
 * e a cúpula redonda que dizem "quiosque", e não coreto (aberto, de oito lados, com guarda-corpo) nem tenda.
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada `ESPESSURA_DO_QUIOSQUE`, a espessura do perfil):
 * - o pedestal vai em duas metades (a do norte NA TELA antes da parede, a do sul depois), furadas pela parede;
 * - a parede são dezesseis GOMOS de coluna, cada um no tom do lado dele NA TELA (a luz faz o redondo);
 * - os cartazes, a janela e as mercadorias da prateleira vão num PORTADOR (uma estrutura mínima logo à frente da
 *   parede): as peças ficam debaixo da cúpula na vista de cima e sobem a altura do portador, que as deixa na cara
 *   da frente NA TELA. A janela só entra quando está na frente NA TELA; girado, o quiosque mostra outro cartaz;
 * - o balcão é um tampo; o toldo são três faixas em degrau, cada uma em sete listras (uma estrutura por listra, com
 *   o pingo da cor dela); a cúpula são seis tampos em degrau, todos furados onde caem os pingos de baixo.
 * Por isso o desenho lê `c.giro`. Medidas de cima pelo menor meio lado, alturas em casas.
 * Materiais: `pintura` (parede e cúpula, um pano da tabela pintado como madeira), `toldo` (as listras de cor; as
 * outras são linho cru) e `pedra` (o pedestal). O latão, o vidro, os jornais e os cartazes são fixos.
 */
import { hash, luz, type Rgb } from '../../ruido'
import { anel, caixa, dentroDe, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca } from './motor'
import { G, LENCOL, materialDaPeca, type MontarMovel } from './contexto'
import {
  capsulaAfunilada,
  coluna,
  comMeioEm,
  deslocada,
  disco,
  discosAoLongo,
  doDesenho,
  esticadaAte,
  furada,
  naTela,
  pingo,
  quartosDoGiro,
  setor,
  solta,
} from './apoioDaCidadeEPorto'

/** A beirada de cada tampo do quiosque (px do protótipo): a altura de cada degrau do toldo e da cúpula. O perfil usa este valor. */
export const ESPESSURA_DO_QUIOSQUE = 0.08 * G

/** Medidas de cima em fração do menor meio lado. */
const PEDESTAL = 0.9
/** Onde fica o meio de cada metade do pedestal (graus no desenho): norte e sul, ou oeste e leste quando de lado. */
const MEIOS_DO_PEDESTAL: readonly number[] = [-110, 135]
const MEIOS_DO_PEDESTAL_DE_LADO: readonly number[] = [200, -20]
const PAREDE = 0.62
const GOMOS_DA_PAREDE = 16
const RAIO_DO_GOMO = 0.09
const CUPULA: readonly number[] = [0.79, 0.7, 0.59, 0.47, 0.34, 0.2]
const GOMOS_DA_CUPULA = 12
const FRANJA_PASSA = 1.3
/** O toldo: a meia largura, onde cada faixa acaba (de dentro para fora) e as listras. */
const MEIA_LARGURA_DO_TOLDO = 0.34
const FAIXAS_DO_TOLDO: readonly number[] = [0.62, 0.7, 0.78, 0.86]
const LISTRAS = 7
/** O balcão: a meia largura e de onde a onde vai (frente); passa do toldo, para os jornais aparecerem de cima e na 3/4. */
const MEIA_LARGURA_DO_BALCAO = 0.27
const BALCAO: readonly [number, number] = [0.58, 0.92]
/** Alturas em casas: o pedestal, o alto da parede, o balcão e o toldo (o alto, de onde cai). */
const ALTURA_DO_PEDESTAL = 0.1
const ALTURA_DA_PAREDE = 1.15
const ALTURA_DO_BALCAO = 0.55
const ALTURA_DO_TOLDO = 1.08
/** Quanto cada camada da cúpula sobe acima da de baixo, em espessuras; o pináculo e a bola acima da de cima. */
const SUBIDA_DA_CUPULA = 0.9
const ALTURA_DO_PINACULO = 2.2
const RAIO_DO_PINACULO = 0.03
const RAIO_DA_BOLA = 0.055
/** O portador: a altura (px) em que as peças da cara da frente são levadas. */
const ALTURA_DO_PORTADOR = 8
/** O tom dos gomos da parede pelo lado NA TELA, como o fuste do pilar. */
const LUZ_DA_PAREDE = 0.12
const SOMBRA_DA_PAREDE = 0.24
/** A sombra: quanto anda por px de altura (para baixo à direita NA TELA) e a força. */
const SOMBRA_POR_ALTURA: readonly [number, number] = [0.27, 0.21]
const FORCA_DA_SOMBRA = 0.3
/** A vez das coisas da frente na 3/4 (fração do menor meio lado). */
const VEZ_DA_CUPULA = 0.8

const LATAO = materialDaPeca('latao')
const VIDRO_ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x33, 0x33] }
const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xd4, 0xc0] }
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x58, 0x55] }
/** As cores dos cartazes e das revistas: contidas, de tinta velha. */
const CORES_DOS_CARTAZES: readonly Rgb[] = [[0xa8, 0x55, 0x3e], [0x4d, 0x67, 0x7e], [0xb8, 0x93, 0x45], [0x5e, 0x7a, 0x52]]
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]
const DA_MADEIRA = texturaDaClasse('madeira')

export const montarQuiosque: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const e = ESPESSURA_DO_QUIOSQUE
  const g = G
  const quartos = quartosDoGiro(c.giro)
  const L = cena.partes
  const S = cena.sombras
  cena.corDoPiso = ESCURO_DA_PEDRA
  const f = (v: number): number => v * R
  const pedra = c.m.pedra
  const pintura: MaterialDaPeca = { classe: 'madeira', rgb: c.m.pintura.rgb }
  const daCupula: MaterialDaPeca = { classe: 'madeira', rgb: luz(c.m.pintura.rgb, -0.18) }
  const toldo = c.m.toldo
  const zPedestal = ALTURA_DO_PEDESTAL * g
  const zParede = ALTURA_DA_PAREDE * g
  const zCamada = (i: number): number => zParede + e * (1 + SUBIDA_DA_CUPULA * i)
  const zTopo = zCamada(CUPULA.length - 1)
  const rParede = f(PAREDE)
  const daTela = (x: number, y: number): Ponto => doDesenho(x, y, quartos)
  const sombraEm = (z: number): Ponto => daTela(SOMBRA_POR_ALTURA[0] * z, SOMBRA_POR_ALTURA[1] * z)
  const janelaNaFrente = quartos === 0

  // ---------- os pontos que as estruturas de cima furam (os pingos e meios das de baixo) ----------
  const rMeioDoGomo = rParede - f(RAIO_DO_GOMO)
  const meiosDosGomos: Ponto[] = Array.from({ length: GOMOS_DA_PAREDE }, (_, i) => {
    const a = ((i + 0.5) * 2 * Math.PI) / GOMOS_DA_PAREDE
    return [Math.cos(a) * rMeioDoGomo, Math.sin(a) * rMeioDoGomo]
  })
  const portador = daTela(0, rParede + 1.2)
  const meioDoBalcao: Ponto = [0, f(0.74)]
  const larguraDaListra = (2 * f(MEIA_LARGURA_DO_TOLDO)) / LISTRAS
  /** O meio de cada listra de cada faixa do toldo (é ali o pingo da cor dela). */
  const meioDaListra = (faixa: number, j: number): Ponto => [-f(MEIA_LARGURA_DO_TOLDO) + (j + 0.5) * larguraDaListra, f((FAIXAS_DO_TOLDO[faixa] + FAIXAS_DO_TOLDO[faixa + 1]) / 2)]
  const meiosDaPrimeiraFaixa = Array.from({ length: LISTRAS }, (_, j) => meioDaListra(0, j))
  const furos: Ponto[] = [...meiosDosGomos, portador, meioDoBalcao, ...meiosDaPrimeiraFaixa]

  // ---------- as sombras no chão: o contato, a parede, o toldo e a cúpula que afina ----------
  const [px, py] = sombraEm(zParede)
  const [tx, ty] = sombraEm(zTopo + ALTURA_DO_PINACULO * e)
  S.push(contato(disco(0, 0, f(PEDESTAL)), 0.3))
  S.push({ forma: capsulaAfunilada(0, 0, rParede, px, py, rParede), z: 0, suave: 2.6, forca: FORCA_DA_SOMBRA * 0.9 })
  S.push({ forma: deslocada(disco(0, 0, f(CUPULA[0])), ...sombraEm(zCamada(0))), z: 0, suave: 3, forca: FORCA_DA_SOMBRA })
  S.push({ forma: capsulaAfunilada(...sombraEm(zCamada(0)), f(CUPULA[1]), tx, ty, f(RAIO_DA_BOLA)), z: 0, suave: 3, forca: FORCA_DA_SOMBRA * 0.85 })
  const areaDoToldo = caixa(-f(MEIA_LARGURA_DO_TOLDO), f(FAIXAS_DO_TOLDO[0]), f(MEIA_LARGURA_DO_TOLDO), f(FAIXAS_DO_TOLDO[3]), 1)
  S.push({ forma: deslocada(areaDoToldo, ...sombraEm(ALTURA_DO_TOLDO * g)), z: 0, suave: 2.4, forca: FORCA_DA_SOMBRA * 0.85 })

  // ---------- o pedestal em duas metades, furadas pela parede ----------
  const pedestal = menos(disco(0, 0, f(PEDESTAL)), disco(0, 0, rParede + 0.3))
  const deLado = quartos % 2 === 1
  const [x0, y0, x1, y1] = pedestal.b
  const metades: readonly Forma[] = deLado
    ? [dentroDe(pedestal, caixa(x0 - 1, y0 - 1, 0, y1 + 1)), dentroDe(pedestal, caixa(0, y0 - 1, x1 + 1, y1 + 1))]
    : [dentroDe(pedestal, caixa(x0 - 1, y0 - 1, x1 + 1, 0)), dentroDe(pedestal, caixa(x0 - 1, 0, x1 + 1, y1 + 1))]
  // O meio de cada metade fica na beira que passa da cúpula e fora do toldo: dentro deles, a pedra subiria com eles.
  const rMeioDoPedestal = (f(PEDESTAL) + f(CUPULA[0]) + FRANJA_PASSA) / 2
  const angulos = deLado ? MEIOS_DO_PEDESTAL_DE_LADO : MEIOS_DO_PEDESTAL
  metades.forEach((metade, i) => {
    S.push(coluna(metade, zPedestal))
    const a = (angulos[i] * Math.PI) / 180
    L.push(P(comMeioEm(metade, Math.cos(a) * rMeioDoPedestal, Math.sin(a) * rMeioDoPedestal), pedra, { tabua: 0, bisel: 1.5, contorno: 0.28, tom: 0.92, semente: 10601 }))
  })

  // ---------- a parede: dezesseis gomos de coluna, cada um no tom do lado dele NA TELA ----------
  meiosDosGomos.forEach(([gx, gy], i) => {
    S.push(coluna(disco(gx, gy, f(RAIO_DO_GOMO) + 0.2), zParede))
    const [sx] = naTela(gx, gy, quartos)
    const tom = LUZ_DA_PAREDE * (-sx / rMeioDoGomo) - (sx > 0 ? SOMBRA_DA_PAREDE - LUZ_DA_PAREDE : 0) * (sx / rMeioDoGomo)
    L.push(P(disco(gx, gy, f(RAIO_DO_GOMO) + 0.2), { ...pintura, rgb: luz(pintura.rgb, tom) }, { tabua: 0, eixo: Math.PI / 2, bisel: 1, contorno: 0.22, semente: 10610 + i }))
  })

  // ---------- o portador: os cartazes e a janela, na cara da frente NA TELA ----------
  S.push(solta(disco(portador[0], portador[1], 0.2), ALTURA_DO_PORTADOR))
  const zP = ALTURA_DO_PORTADOR
  /** O ponto da cara da frente NA TELA a `sx` px do meio e `h` px do chão, levado para o desenho pelo portador. */
  const naCara = (sx: number, h: number): Ponto => daTela(sx, Math.sqrt(Math.max(0, rParede * rParede - sx * sx)) - h + zP)
  /** O pedaço da cara entre `sx0` e `sx1` e entre as alturas `h0` e `h1`, curvo como a parede. */
  const pedacoDaCara = (sx0: number, sx1: number, h0: number, h1: number): Forma => {
    const n = 6
    const de = Array.from({ length: n + 1 }, (_, k): Ponto => naCara(sx0 + ((sx1 - sx0) * k) / n, h1))
    const ate = Array.from({ length: n + 1 }, (_, k): Ponto => naCara(sx1 - ((sx1 - sx0) * k) / n, h0))
    return comMeioEm(poligono([...de, ...ate]), portador[0], portador[1])
  }
  // A maior peça do portador é o painel da cor da parede: o fio que ele deixa na frente some na parede.
  L.push(P(pedacoDaCara(-rParede * 0.86, rParede * 0.86, zPedestal + 2, zPedestal + 4), pintura, { tabua: 0, bisel: 0, contorno: 0, tom: 0.74, semente: 10630 }))
  const cartaz = (sx0: number, sx1: number, cor: number, semente: number): void => {
    const [h0, h1] = [0.36 * g, 0.84 * g]
    L.push(P(pedacoDaCara(sx0, sx1, h0, h1), PAPEL, { tabua: 0, bisel: 0.4, contorno: 0.3, tom: 0.92, semente }))
    L.push(P(pedacoDaCara(sx0 + 1, sx1 - 1, h1 - 0.16 * g, h1 - 1.2), { classe: 'liso', rgb: CORES_DOS_CARTAZES[cor % CORES_DOS_CARTAZES.length] }, { tabua: 0, bisel: 0, contorno: 0.15, semente: semente + 1 }))
    for (let k = 0; k < 3; k += 1) {
      const h = h0 + (0.08 + 0.09 * k) * g
      L.push(P(pedacoDaCara(sx0 + 1.6, sx1 - 1.6 - k * 0.8, h, h + 0.8), TINTA, { tabua: 0, bisel: 0, contorno: 0, semente: semente + 2 + k }))
    }
  }
  cartaz(-rParede * 0.84, -rParede * 0.46, 0, 10640)
  cartaz(rParede * 0.46, rParede * 0.84, 1, 10650)
  if (janelaNaFrente) {
    // A janela: o vão escuro, a prateleira com as revistas e o caixilho de latão.
    const [j0, j1] = [ALTURA_DO_BALCAO * g + e, 1.0 * g]
    const meia = rParede * 0.34
    L.push(P(pedacoDaCara(-meia, meia, j0, j1), VIDRO_ESCURO, { tabua: 0, bisel: 0, contorno: 0.3, semente: 10660 }))
    const hPrateleira = j0 + (j1 - j0) * 0.45
    L.push(P(pedacoDaCara(-meia + 1, meia - 1, hPrateleira - 0.6, hPrateleira + 0.6), pintura, { tabua: 0, bisel: 0, contorno: 0.1, tom: 1.1, semente: 10661 }))
    for (let k = 0; k < 6; k += 1) {
      const sx = -meia + 2 + k * ((2 * meia - 4) / 6)
      const alto = (0.1 + 0.05 * hash(k, 2, 10662)) * g
      L.push(P(pedacoDaCara(sx, sx + (2 * meia - 4) / 6 - 0.8, hPrateleira + 0.6, hPrateleira + 0.6 + alto), { classe: 'liso', rgb: CORES_DOS_CARTAZES[k % CORES_DOS_CARTAZES.length] }, { tabua: 0, bisel: 0.3, contorno: 0.25, semente: 10663 + k }))
    }
    for (const sx of [-meia, meia]) L.push(P(pedacoDaCara(sx - 0.7, sx + 0.7, j0, j1), LATAO, { tabua: 0, bisel: 0.3, contorno: 0.2, metal: 0.4, semente: 10670 }))
  } else {
    cartaz(-rParede * 0.3, rParede * 0.3, 2, 10680)
  }

  // ---------- o balcão de jornais ----------
  const balcao = caixa(-f(MEIA_LARGURA_DO_BALCAO), f(BALCAO[0]), f(MEIA_LARGURA_DO_BALCAO), f(BALCAO[1]), 0.8)
  S.push(solta(furada(balcao, [...meiosDosGomos, portador]), ALTURA_DO_BALCAO * g))
  const doBalcao = (forma: Forma): Forma => comMeioEm(forma, meioDoBalcao[0], meioDoBalcao[1])
  L.push(P(doBalcao(balcao), pintura, { tabua: 5, eixo: 0, bisel: 0.8, contorno: 0.3, tom: 1.06, textura: DA_MADEIRA ?? undefined, semente: 10690 }))
  for (let k = 0; k < 5; k += 1) {
    const x = -f(MEIA_LARGURA_DO_BALCAO) + 2.5 + k * ((2 * f(MEIA_LARGURA_DO_BALCAO) - 5) / 5)
    const jornal = caixa(x, f(BALCAO[1]) - 0.17 * R - (k % 2) * 1.2, x + (2 * f(MEIA_LARGURA_DO_BALCAO) - 5) / 5 - 1, f(BALCAO[1]) - 1.2, 0.3)
    const mat = k === 2 ? { classe: 'liso' as const, rgb: CORES_DOS_CARTAZES[3] } : PAPEL
    L.push(P(doBalcao(jornal), mat, { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.96 + 0.06 * hash(k, 1, 10691), projeta: { dist: 0.8, forca: 0.26 }, semente: 10692 + k }))
    L.push(P(doBalcao(caixa(x + 1, f(BALCAO[1]) - 0.12 * R, x + 3, f(BALCAO[1]) - 3, 0.2)), TINTA, { tabua: 0, bisel: 0, contorno: 0, semente: 10697 + k }))
  }

  // ---------- o toldo: três faixas em degrau, cada uma em sete listras ----------
  const zToldo = ALTURA_DO_TOLDO * g
  for (let faixa = 0; faixa < FAIXAS_DO_TOLDO.length - 1; faixa += 1) {
    const [ya, yb] = [f(FAIXAS_DO_TOLDO[faixa]), f(FAIXAS_DO_TOLDO[faixa + 1])]
    const z = zToldo - faixa * e
    for (let j = 0; j < LISTRAS; j += 1) {
      const xa = -f(MEIA_LARGURA_DO_TOLDO) + j * larguraDaListra
      const listra = caixa(xa, ya, xa + larguraDaListra, yb + (faixa === FAIXAS_DO_TOLDO.length - 2 ? 0 : 0.2))
      const daCor = j % 2 === 0
      const mat = daCor ? toldo : LENCOL
      S.push(solta(furada(listra, [...meiosDosGomos, portador, meioDoBalcao]), z))
      const [mx, my] = meioDaListra(faixa, j)
      L.push(P(comMeioEm(listra, mx, my), mat, { tabua: 0, bisel: 0, contorno: 0.12, tom: 1 - 0.05 * faixa, semente: 10700 + faixa * 10 + j }))
    }
  }
  // A franja da ponta: um dente de cada listra, na faixa de baixo.
  for (let j = 0; j < LISTRAS; j += 1) {
    const xa = -f(MEIA_LARGURA_DO_TOLDO) + j * larguraDaListra
    const yb = f(FAIXAS_DO_TOLDO[3])
    const dente = poligono([[xa, yb - 1.4], [xa + larguraDaListra, yb - 1.4], [xa + larguraDaListra / 2, yb + 1.2]])
    const [mx, my] = meioDaListra(2, j)
    L.push(P(comMeioEm(dente, mx, my), j % 2 === 0 ? toldo : LENCOL, { tabua: 0, bisel: 0.4, contorno: 0.28, tom: 0.92, semente: 10730 + j }))
  }

  // ---------- a cúpula: seis camadas em degrau, cada uma em doze gomos; a franja de latão e o pináculo ----------
  CUPULA.forEach((raio, i) => {
    const r1 = f(raio)
    const r2 = i + 1 < CUPULA.length ? f(CUPULA[i + 1]) : 0
    S.push(solta(esticadaAte(furada(disco(0, 0, r1), furos), f(VEZ_DA_CUPULA) + 0.4 * i, quartos), zCamada(i)))
    for (let j = 0; j < GOMOS_DA_CUPULA; j += 1) {
      const meio = ((j + 0.5) * 2 * Math.PI) / GOMOS_DA_CUPULA
      const gomo = setor(Math.max(0.01, r2 - 0.2), r1, meio, Math.PI / GOMOS_DA_CUPULA + 0.004)
      const [sx, sy] = naTela(Math.cos(meio), Math.sin(meio), quartos)
      const tom = 0.94 - 0.14 * (sx * 0.62 + sy * 0.78) + (j % 2 === 0 ? 0.04 : -0.04)
      const rMeio = (r1 + r2) / 2
      L.push(P(comMeioEm(gomo, Math.cos(meio) * rMeio, Math.sin(meio) * rMeio), daCupula, { tabua: 0, bisel: 0, contorno: 0.14, tom, projeta: i === 0 ? { dist: 1.2, forca: 0.3 } : undefined, semente: 10740 + i * 12 + j }))
    }
  })
  const r0 = f(CUPULA[0])
  const franja: Forma = { b: [-r0 - FRANJA_PASSA - 1, -r0 - FRANJA_PASSA - 1, r0 + FRANJA_PASSA + 1, r0 + FRANJA_PASSA + 1], d: (x, y) => Math.max(Math.hypot(x, y) - r0 - FRANJA_PASSA, r0 - 0.3 - Math.hypot(x, y), -0.3 * R - naTela(x, y, quartos)[1]) }
  S.push(solta(esticadaAte(franja, f(VEZ_DA_CUPULA) + 4, quartos), zCamada(0)))
  const [fx, fy] = daTela(0, r0 + FRANJA_PASSA * 0.6)
  L.push(P(comMeioEm(anel(0, 0, r0 + FRANJA_PASSA, r0 + FRANJA_PASSA, r0 - 0.3, r0 - 0.3), fx, fy), LATAO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.45, semente: 10820 }))
  const pingosDoPinaculo = discosAoLongo(S, [0, 0, zTopo + 0.6 * e], [0, 0, zTopo + ALTURA_DO_PINACULO * e], f(RAIO_DO_PINACULO), e, f(VEZ_DA_CUPULA) + 5, quartos)
  pingosDoPinaculo.forEach(([qx, qy], k) => L.push(pingo(P, qx, qy, LATAO, 10821 + k)))
  const bola = disco(0, 0, f(RAIO_DA_BOLA))
  S.push(solta(esticadaAte(furada(bola, pingosDoPinaculo), f(VEZ_DA_CUPULA) + 6, quartos), zTopo + (ALTURA_DO_PINACULO + 0.8) * e))
  L.push(P(bola, LATAO, { tabua: 0, bisel: f(RAIO_DA_BOLA) * 0.8, contorno: 0.3, metal: 0.55, projeta: { dist: 1.2, forca: 0.32 }, semente: 10829 }))
}
