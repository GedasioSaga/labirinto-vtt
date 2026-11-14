/**
 * POSTE COM RELÓGIO de cima com volume (lote L17 de 14/11/2026, construção do grupo Cidade e porto): o relógio
 * de rua da praça e do cais. A BASE de pedra em dois degraus, o POSTE de ferro fundido canelado com o ANEL do pé,
 * a CAIXA do relógio com um MOSTRADOR em cada uma das quatro caras, a CORNIJA, a CUPULINHA e o PINÁCULO com a bola.
 *
 * De cima: os dois degraus quadrados, a cornija escura com o fio de latão de cada mostrador nos quatro lados, a
 * cupulinha com a bola, e a SOMBRA comprida para baixo à direita: o risco do poste e, na ponta, a cabeça redonda
 * do relógio. É a sombra que diz "relógio no poste" (de cima um mostrador de pé não se vê), e não pilar nem lampião.
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada `ESPESSURA_DO_POSTE_COM_RELOGIO`, a espessura do perfil):
 * - os degraus vão em duas metades (a do norte NA TELA antes do poste, a do sul depois), cada uma furada pelo que
 *   fica em cima dela, como o plinto do pilar; o poste são oito GOMOS de coluna, cada um no tom do lado dele;
 * - a caixa são cinco tampos, cada um um tico para o lado, com o pingo de ferro na beira; a cornija, a cupulinha
 *   e a bola vêm depois, furadas onde caem os pingos de baixo (os gomos, o anel do pé, os tampos da caixa);
 * - o MOSTRADOR da frente NA TELA é pintado por uma estrutura mínima logo à frente da cornija (o "portador"): as
 *   peças dele ficam debaixo da caixa na vista de cima (escondidas) e sobem a altura do portador, que as deixa no
 *   meio da cara da frente. A maior peça do portador é o aro de ferro, para a frente dele (um fio debaixo da caixa)
 *   sair da cor do poste.
 * Por isso o desenho lê `c.giro`. Medidas e alturas pelo menor lado (`peloMenorLado`). Materiais: `metal` (poste,
 * caixa, cornija) e `pedra` (a base). O mostrador, os ponteiros e o latão são fixos.
 *
 * PEGADA SÓLIDA (para a colisão): o degrau de baixo, `DEGRAU_DE_BAIXO` do menor meio lado.
 */
import { luz, type Rgb } from '../../ruido'
import { anel, caixa, capsula, dentroDe, menos, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, materialDaPeca, type MontarMovel } from './contexto'
import {
  capsulaAfunilada,
  coluna,
  comMeioEm,
  deslocada,
  discosAoLongo,
  disco,
  doDesenho,
  esticadaAte,
  furada,
  pingo,
  quartosDoGiro,
  solta,
} from './apoioDaCidadeEPorto'

/** A beirada de cada tampo (px do protótipo): a altura de cada fatia da caixa do relógio. O perfil usa este valor. */
export const ESPESSURA_DO_POSTE_COM_RELOGIO = 0.08 * G

/** Medidas de cima em fração do menor meio lado. */
const DEGRAU_DE_BAIXO = 0.92
const DEGRAU_DE_CIMA = 0.62
const ANEL_DO_PE = 0.25
const RAIO_DO_POSTE = 0.15
const GOMOS = 8
/** Quanto do raio do poste é o meio do gomo (os vizinhos se encostam sem fresta, como no pilar). */
const MEIO_DO_GOMO = 0.78
const CAIXA = 0.4
const CORNIJA = 0.46
const CUPULA: readonly [number, number] = [0.3, 0.18]
const RAIO_DO_PINACULO = 0.04
const BOLA = 0.075
const MOSTRADOR = 0.29
const ARO = 0.36
const FIO_DE_LATAO = 0.325
/** Alturas em lados: os degraus e a caixa. */
const ALTURA_DO_DEGRAU_DE_BAIXO = 0.06
const ALTURA_DO_DEGRAU_DE_CIMA = 0.12
const PE_DA_CAIXA = 1.55
/** As fatias da caixa, e a cornija, a cupulinha, o pináculo e a bola acima do alto da caixa, em espessuras. */
const FATIAS_DA_CAIXA = 5
const CORNIJA_EM = 0.7
const CUPULA_EM: readonly [number, number] = [1.6, 2.3]
const PINACULO_ATE = 3.4
const BOLA_EM = 4
/** O tom dos gomos: um pouco mais claro do lado da luz e mais escuro do outro, como o fuste do pilar. */
const LUZ_DO_GOMO = 0.16
const SOMBRA_DO_GOMO = 0.26
/** Os ponteiros, NA TELA (rad; -90° é o 12): dez para as dez. */
const PONTEIRO_DAS_HORAS = (-150 * Math.PI) / 180
const PONTEIRO_DOS_MINUTOS = (-30 * Math.PI) / 180
/** A sombra: quanto anda por px de altura (para baixo à direita NA TELA) e a força. */
const SOMBRA_POR_ALTURA: readonly [number, number] = [0.27, 0.21]
const FORCA_DA_SOMBRA = 0.32
/** A vez da caixa e do que fica em cima dela na 3/4 (fração do menor meio lado). */
const VEZ_DA_CUPULA = 0.5
const VEZ_DO_PINACULO = 0.52

const MOSTRADOR_CREME: MaterialDaPeca = { classe: 'liso', rgb: [0xec, 0xe4, 0xcf] }
const PONTEIRO: MaterialDaPeca = { classe: 'metal', rgb: [0x2a, 0x2a, 0x2c] }
const LATAO = materialDaPeca('latao')
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

export const montarPosteComRelogio: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const lado = 2 * R
  const e = ESPESSURA_DO_POSTE_COM_RELOGIO
  const quartos = quartosDoGiro(c.giro)
  const L = cena.partes
  const S = cena.sombras
  cena.corDoPiso = ESCURO_DA_PEDRA
  const f = (v: number): number => v * R
  const pedra = c.m.pedra
  const metal = c.m.metal
  const z1 = ALTURA_DO_DEGRAU_DE_BAIXO * lado
  const z2 = ALTURA_DO_DEGRAU_DE_CIMA * lado
  const zPe = PE_DA_CAIXA * lado
  const zAlto = zPe + FATIAS_DA_CAIXA * e
  const zMeio = (zPe + zAlto) / 2
  const daTela = (x: number, y: number): Ponto => doDesenho(x, y, quartos)
  const sombraEm = (z: number): Ponto => daTela(SOMBRA_POR_ALTURA[0] * z, SOMBRA_POR_ALTURA[1] * z)
  const deLado = quartos % 2 === 1
  /** As duas metades de uma forma (norte e sul NA TELA, numa ordem ou na outra): o corte acompanha o giro. */
  const metades = (forma: Forma): [Forma, Forma] => {
    const [x0, y0, x1, y1] = forma.b
    if (deLado) return [dentroDe(forma, caixa(x0 - 1, y0 - 1, 0, y1 + 1)), dentroDe(forma, caixa(0, y0 - 1, x1 + 1, y1 + 1))]
    return [dentroDe(forma, caixa(x0 - 1, y0 - 1, x1 + 1, 0)), dentroDe(forma, caixa(x0 - 1, 0, x1 + 1, y1 + 1))]
  }
  /** Um ponto no meio de cada metade, a `r` do centro (o meio da peça daquela metade). */
  const meiosDasMetades = (r: number): [Ponto, Ponto] => (deLado ? [[-r, 0], [r, 0]] : [[0, -r], [0, r]])

  // ---------- a sombra no chão: o contato, o risco do poste, a cabeça redonda e a ponta ----------
  const [ax, ay] = sombraEm(zPe)
  const [bx, by] = sombraEm(zAlto)
  const [tx, ty] = sombraEm(zAlto + BOLA_EM * e)
  S.push(contato(caixa(-f(DEGRAU_DE_BAIXO), -f(DEGRAU_DE_BAIXO), f(DEGRAU_DE_BAIXO), f(DEGRAU_DE_BAIXO), 1.4), 0.32))
  S.push({ forma: capsula(0, 0, ax, ay, f(RAIO_DO_POSTE)), z: 0, suave: 1.8, forca: FORCA_DA_SOMBRA })
  S.push({ forma: capsulaAfunilada(ax, ay, f(ARO), bx, by, f(ARO)), z: 0, suave: 2, forca: FORCA_DA_SOMBRA })
  S.push({ forma: capsulaAfunilada(bx, by, f(CUPULA[0]), tx, ty, f(BOLA)), z: 0, suave: 2, forca: FORCA_DA_SOMBRA * 0.85 })
  S.push({ forma: deslocada(caixa(-f(DEGRAU_DE_CIMA), -f(DEGRAU_DE_CIMA), f(DEGRAU_DE_CIMA), f(DEGRAU_DE_CIMA), 1), ...sombraEm(z2)), z: 0, suave: 1.4, forca: 0.2 })

  // ---------- os degraus, em metades furadas pelo que fica em cima ----------
  const deBaixo = caixa(-f(DEGRAU_DE_BAIXO), -f(DEGRAU_DE_BAIXO), f(DEGRAU_DE_BAIXO), f(DEGRAU_DE_BAIXO), 1.4)
  const deCima = caixa(-f(DEGRAU_DE_CIMA), -f(DEGRAU_DE_CIMA), f(DEGRAU_DE_CIMA), f(DEGRAU_DE_CIMA), 1.2)
  const degraus: readonly (readonly [Forma, number, number, number])[] = [
    [menos(deBaixo, deCima), z1, (DEGRAU_DE_BAIXO + DEGRAU_DE_CIMA) / 2, 0.9],
    [menos(deCima, disco(0, 0, f(ANEL_DO_PE) + 0.4)), z2, (DEGRAU_DE_CIMA + CAIXA) / 2 + 0.04, 1],
  ]
  degraus.forEach(([forma, z, meio, tom], i) => {
    const [norte, sul] = metades(forma)
    const [mn, ms] = meiosDasMetades(f(meio))
    S.push(coluna(norte, z), coluna(sul, z))
    L.push(P(comMeioEm(norte, mn[0], mn[1]), pedra, { tabua: 0, bisel: 1.3, contorno: 0.28, tom, semente: 9801 + i * 2 }))
    L.push(P(comMeioEm(sul, ms[0], ms[1]), pedra, { tabua: 0, bisel: 1.3, contorno: 0.28, tom, semente: 9801 + i * 2 }))
  })

  // ---------- o poste: oito gomos de coluna, do chão ao pé da caixa ----------
  const rMeio = f(RAIO_DO_POSTE) * MEIO_DO_GOMO
  const rGomo = f(RAIO_DO_POSTE) - rMeio
  const furos: Ponto[] = []
  for (let i = 0; i < GOMOS; i += 1) {
    const a = (i * 2 * Math.PI) / GOMOS
    const [gx, gy] = [Math.cos(a) * rMeio, Math.sin(a) * rMeio]
    S.push(coluna(disco(gx, gy, rGomo + 0.35), zPe))
    const paraADireita = Math.cos(a + (quartos * Math.PI) / 2)
    L.push(P(disco(gx, gy, rGomo + 0.35), { ...metal, rgb: luz(metal.rgb, LUZ_DO_GOMO - SOMBRA_DO_GOMO * paraADireita) }, { tabua: 0, bisel: rGomo, contorno: 0.2, metal: 0.3, semente: 9810 + i }))
    furos.push([gx, gy])
  }

  // ---------- o anel do pé ----------
  const [px, py] = daTela(0, f(0.2))
  S.push(solta(disco(0, 0, f(ANEL_DO_PE)), z2 + e))
  L.push(P(comMeioEm(anel(0, 0, f(ANEL_DO_PE), f(ANEL_DO_PE), f(RAIO_DO_POSTE), f(RAIO_DO_POSTE)), px, py), metal, { tabua: 0, bisel: 1.2, contorno: 0.3, tom: 1.05, metal: 0.35, projeta: { dist: 1, forca: 0.3 }, semente: 9820 }))
  furos.push([px, py])

  // ---------- a caixa do relógio: cinco tampos, cada um um tico para o lado, com o pingo de ferro na beira ----------
  const furosDaCaixa: Ponto[] = []
  for (let k = 0; k < FATIAS_DA_CAIXA; k += 1) {
    const dx = 0.15 * k
    S.push(solta(furada(caixa(-f(CAIXA) + dx, -f(CAIXA), f(CAIXA) + dx, f(CAIXA), 0.8), furos), zPe + (k + 1) * e))
    const [qx, qy]: Ponto = [-f(CAIXA) + dx + 0.12, 0]
    L.push(pingo(P, qx, qy, metal, 9830 + k))
    furosDaCaixa.push([qx, qy])
  }
  const todosOsFuros = [...furos, ...furosDaCaixa]

  // ---------- o mostrador da frente NA TELA, levado pelo portador logo à frente da cornija ----------
  // As peças ficam debaixo da caixa na vista de cima, com o meio no centro; o portador sobe o bastante para o
  // centro cair no meio da cara da frente: a cara fica a `CAIXA` à frente do centro, a meia altura da caixa.
  const zPortador = zMeio - f(CAIXA)
  const [dx0, dy0] = daTela(0, f(CORNIJA) + 0.45)
  S.push(solta(disco(dx0, dy0, 0.2), zPortador))
  const doPortador = (forma: Forma): Forma => comMeioEm(forma, dx0, dy0)
  L.push(P(doPortador(disco(0, 0, f(ARO))), metal, { tabua: 0, bisel: 1, contorno: 0.32, tom: 0.8, metal: 0.35, semente: 9840 }))
  L.push(P(doPortador(anel(0, 0, f(FIO_DE_LATAO) + 0.6, f(FIO_DE_LATAO) + 0.6, f(MOSTRADOR), f(MOSTRADOR))), LATAO, { tabua: 0, bisel: 0.5, contorno: 0.2, metal: 0.5, semente: 9841 }))
  L.push(P(doPortador(disco(0, 0, f(MOSTRADOR))), MOSTRADOR_CREME, { tabua: 0, bisel: 0.6, contorno: 0.24, recesso: { k: 0.8, forca: 0.22 }, semente: 9842 }))
  for (let h = 0; h < 12; h += 1) {
    const a = (h * Math.PI) / 6
    const grossa = h % 3 === 0
    const [r0, r1] = [f(MOSTRADOR) * (grossa ? 0.68 : 0.78), f(MOSTRADOR) * 0.9]
    const [ix, iy] = daTela(Math.cos(a) * r0, Math.sin(a) * r0)
    const [ox, oy] = daTela(Math.cos(a) * r1, Math.sin(a) * r1)
    L.push(P(doPortador(capsula(ix, iy, ox, oy, grossa ? 0.42 : 0.26)), PONTEIRO, { tabua: 0, bisel: 0, contorno: 0, semente: 9843 + h }))
  }
  for (const [angulo, comprimento, grossura] of [[PONTEIRO_DAS_HORAS, 0.5, 0.5], [PONTEIRO_DOS_MINUTOS, 0.74, 0.36]] as const) {
    const [hx, hy] = daTela(Math.cos(angulo) * f(MOSTRADOR) * comprimento, Math.sin(angulo) * f(MOSTRADOR) * comprimento)
    L.push(P(doPortador(capsula(0, 0, hx, hy, grossura)), PONTEIRO, { tabua: 0, bisel: 0, contorno: 0.1, projeta: { dist: 0.5, forca: 0.25 }, semente: 9856 }))
  }
  L.push(P(doPortador(disco(0, 0, 0.6)), LATAO, { tabua: 0, bisel: 0.3, contorno: 0.2, metal: 0.5, semente: 9858 }))

  // ---------- a cornija: o tampo de cima da caixa, com o fio de latão de cada mostrador nos quatro lados ----------
  const cornija = caixa(-f(CORNIJA), -f(CORNIJA), f(CORNIJA), f(CORNIJA), 1.2)
  S.push(solta(furada(cornija, todosOsFuros), zAlto + CORNIJA_EM * e))
  L.push(P(comMeioEm(cornija, f(0.4), f(0.4)), metal, { tabua: 0, bisel: 1.4, contorno: 0.32, tom: 0.96, metal: 0.3, projeta: { dist: 1.3, forca: 0.32 }, semente: 9860 }))
  for (const [sx, sy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
    const fio = sx === 0 ? caixa(-f(ARO) * 0.8, sy * f(CORNIJA) - 0.7, f(ARO) * 0.8, sy * f(CORNIJA) + 0.7, 0.6) : caixa(sx * f(CORNIJA) - 0.7, -f(ARO) * 0.8, sx * f(CORNIJA) + 0.7, f(ARO) * 0.8, 0.6)
    L.push(P(comMeioEm(fio, f(0.4), f(0.4)), LATAO, { tabua: 0, bisel: 0.4, contorno: 0.25, metal: 0.5, semente: 9861 + sx + 2 * sy }))
  }

  // ---------- a cupulinha em dois degraus, o pináculo e a bola ----------
  const [c0, c1] = [f(CUPULA[0]), f(CUPULA[1])]
  S.push(solta(esticadaAte(furada(disco(0, 0, c0), todosOsFuros), f(VEZ_DA_CUPULA), quartos), zAlto + CUPULA_EM[0] * e))
  S.push(solta(esticadaAte(furada(disco(0, 0, c1), todosOsFuros), f(VEZ_DA_CUPULA) + 0.2, quartos), zAlto + CUPULA_EM[1] * e))
  const naCupula = daTela(-(c0 + c1) / 2, 0)
  L.push(P(comMeioEm(anel(0, 0, c0, c0, c1 - 0.3, c1 - 0.3), naCupula[0], naCupula[1]), metal, { tabua: 0, bisel: 1.4, contorno: 0.3, tom: 0.92, metal: 0.4, polar: { cx: 0, cy: 0, r: c0 }, projeta: { dist: 1.2, forca: 0.3 }, semente: 9870 }))
  const [ux, uy] = daTela(Math.cos(Math.PI / 8) * c1 * 0.8, Math.sin(Math.PI / 8) * c1 * 0.8)
  L.push(P(comMeioEm(disco(0, 0, c1), ux, uy), metal, { tabua: 0, bisel: c1 * 0.6, contorno: 0.3, tom: 1.04, metal: 0.45, projeta: { dist: 1, forca: 0.3 }, semente: 9871 }))
  const pingosDoPinaculo = discosAoLongo(S, [0, 0, zAlto + CUPULA_EM[1] * e], [0, 0, zAlto + PINACULO_ATE * e], f(RAIO_DO_PINACULO), e, f(VEZ_DO_PINACULO), quartos)
  pingosDoPinaculo.forEach(([qx, qy], k) => L.push(pingo(P, qx, qy, LATAO, 9872 + k)))
  S.push(solta(esticadaAte(furada(disco(0, 0, f(BOLA)), pingosDoPinaculo), f(VEZ_DO_PINACULO) + 0.5, quartos), zAlto + BOLA_EM * e))
  L.push(P(disco(0, 0, f(BOLA)), LATAO, { tabua: 0, bisel: f(BOLA) * 0.8, contorno: 0.3, metal: 0.55, projeta: { dist: 1, forca: 0.3 }, semente: 9879 }))
}
