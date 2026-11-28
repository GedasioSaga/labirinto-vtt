/**
 * FONTE DE PAREDE (lote L06 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Cidade
 * medieval): a bica da rua, presa no muro. A PAREDE é a beira de cima da pegada (giro 0), como na tocha de parede.
 *
 * De cima com volume: a LÁPIDE de pedra encostada no muro, com a cornija mais larga no alto; a CARRANCA, a meia
 * cúpula de pedra lavrada que sai da lápide, e a BICA de bronze saindo dela; embaixo, o COCHO em meia-lua, de borda
 * grossa, com a água; e os sinais do uso: o limo na borda junto do muro e a mancha verde que a água deixou no bronze.
 * A lápide alta faz a sombra comprida que cai para a frente e para a direita, por cima do cocho.
 *
 * As duas versões:
 * - CORRENDO: a água no cocho, o reflexo do céu, os anéis que abrem onde o fio cai e a espuma no ponto da queda; o
 *   FIO DE ÁGUA (`montarFonteDeParedeQueMexe`) é a peça que mexe, do animador `fioDeAgua` (`lib/mobilia/animadores.ts`)
 *   com o pivô na boca da bica (`ANIMACAO_DO_FONTE_DE_PAREDE`). `montarFonteDeParede` é só a parte parada (o que o
 *   animador não desenha); `montarFonteDeParedeCorrendo` junta as duas numa imagem só: é o desenho de `MONTADORES`
 *   enquanto o animador não está ligado, e é o que "menos movimento" mostra.
 * - SECA: o cocho vazio, o fundo de pedra com a terra e as folhas secas que o vento juntou, a marca da água que
 *   sumiu na borda de dentro e a bica sem fio, com a mancha escura do que escorria.
 *
 * O desenho é feito numa pegada de 1 x 0,75 casa e escala inteiro com o menor lado, preso ao muro (a beira de cima).
 * Material: `pedra` (a lápide, a carranca e o cocho); o bronze da bica, a água, o limo e as folhas são fixos.
 */
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'
import type { AnimacaoDoMovel } from '../../../lib/mobilia/animadores'
import { anel, caixa, capsula, dentroDe, elipse, menos, uniao, type Forma } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** A pegada de partida: 1 x 0,75 casa (px do protótipo); as medidas abaixo valem nela, com o muro em y = -21. */
const LARGURA_DE_PARTIDA = 56
const FUNDO_DE_PARTIDA = 42
const MURO = -FUNDO_DE_PARTIDA / 2
/** A lápide: a meia largura, a frente dela (a partir do muro) e a cornija, mais larga e mais rasa. */
const MEIA_LAPIDE = 18.5
const FRENTE_DA_LAPIDE = MURO + 6
const MEIA_CORNIJA = 20.5
const FRENTE_DA_CORNIJA = MURO + 3.6
/** A carranca (meia cúpula na frente da lápide) e a bica de bronze: a boca dela é o pivô do fio de água. */
const RAIO_DA_CARRANCA = 4.6
const BOCA_DA_BICA = FRENTE_DA_LAPIDE + 8.2
/** Onde o fio cai no cocho (ele sai da bica e cai um nada para a frente). */
const QUEDA = BOCA_DA_BICA + 3.4
/** O cocho em meia-lua: o raio de fora (meia largura e fundo a partir da lápide) e a borda. */
const MEIO_COCHO = 18.4
const FUNDO_DO_COCHO = 31.5
const BORDA_DO_COCHO = 3.6
/** As alturas, em casas: a lápide e a borda do cocho (as sombras), e a boca da bica. */
const ALTURA_DA_LAPIDE = 1.35
const ALTURA_DO_COCHO = 0.42

const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 0.86)) }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xc7, 0xd2, 0xcf] }
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xe2, 0xdc] }
const FIO: MaterialDaPeca = { classe: 'liso', rgb: [0xa9, 0xc4, 0xc6] }
const BRONZE: MaterialDaPeca = { classe: 'metal', rgb: [0x8f, 0x6e, 0x45] }
const AZINHAVRE: MaterialDaPeca = { classe: 'liso', rgb: [0x5f, 0x84, 0x74] }
const LIMO: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x6a, 0x45] }
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x66, 0x4f] }
const FOLHA_SECA: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: [0x96, 0x6e, 0x3e] },
  { classe: 'liso', rgb: [0x7e, 0x5c, 0x38] },
  { classe: 'liso', rgb: [0xa5, 0x86, 0x4c] },
]
const MANCHA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x4e, 0x44] }

/** O fio de água sai da boca da bica, no meio da largura e a 0,33 do fundo da pegada (a 1 x 0,75 casa). */
export const ANIMACAO_DO_FONTE_DE_PAREDE: AnimacaoDoMovel = {
  animador: 'fioDeAgua',
  pivo: { x: 0.5, y: (BOCA_DA_BICA - MURO) / FUNDO_DE_PARTIDA },
  periodoMs: 900,
}

/** A pegada de partida levada para a pegada do objeto: o tamanho e o ponto, presos ao muro. */
interface Prancheta {
  readonly s: number
  readonly x: (x: number) => number
  readonly y: (y: number) => number
}

function prancheta(c: ContextoDoMovel): Prancheta {
  const s = Math.min(c.w / LARGURA_DE_PARTIDA, c.h / FUNDO_DE_PARTIDA)
  return { s, x: (x) => x * s, y: (y) => -c.hh + (y - MURO) * s }
}

/** O cocho em meia-lua de raio (mx, my) a partir da frente da lápide (a parte reta encosta nela). */
function meiaLua(t: Prancheta, mx: number, my: number): Forma {
  const y0 = t.y(FRENTE_DA_LAPIDE)
  return dentroDe(elipse(0, y0, t.x(mx), my * t.s), caixa(-t.x(mx) - 1, y0, t.x(mx) + 1, y0 + my * t.s + 1))
}

/** A água: a borda de pedra faz sombra do lado da luz e a superfície treme de leve. */
function texAgua(t: Prancheta): Textura {
  return (_u, _v, x, y, _p, s) => {
    const borda = Math.hypot(x / (MEIO_COCHO - BORDA_DO_COCHO), (y - t.y(FRENTE_DA_LAPIDE)) / (FUNDO_DO_COCHO - BORDA_DO_COCHO)) / t.s
    s[3] += -0.24 * Math.max(0, Math.min(1, (borda - 0.7) / 0.3)) + ruido(x * 0.35, y * 0.35) * 0.06
  }
}

/** A lápide, a cornija, a carranca, a bica e o cocho de pedra (vazio): o que as duas versões têm. */
function pedraEBica(c: ContextoDoMovel, cena: Cena, t: Prancheta, seca: boolean): void {
  const P = c.peca
  const L = cena.partes
  const pedra = c.m.pedra
  const lapide = caixa(t.x(-MEIA_LAPIDE), t.y(MURO), t.x(MEIA_LAPIDE), t.y(FRENTE_DA_LAPIDE), 0.8 * t.s)
  const cocho = meiaLua(t, MEIO_COCHO, FUNDO_DO_COCHO)
  cena.sombras.push({ forma: lapide, z: c.g * ALTURA_DA_LAPIDE, forca: 0.3 })
  cena.sombras.push({ forma: cocho, z: c.g * ALTURA_DO_COCHO, forca: 0.3 }, contato(cocho, 0.3))
  // O cocho: a borda grossa de pedra e o fundo, mais baixo (a borda faz sombra dentro).
  const dentro = meiaLua(t, MEIO_COCHO - BORDA_DO_COCHO, FUNDO_DO_COCHO - BORDA_DO_COCHO)
  L.push(P(menos(cocho, dentro), pedra, { bisel: 1.6 * t.s, tabua: 0, tom: 1.02, contorno: 0.3, semente: 6700 }))
  L.push(P(dentro, pedra, { bisel: 0.5 * t.s, tabua: 0, tom: seca ? 0.8 : 0.77, contorno: 0.15, recesso: { k: 2.2 * t.s, forca: 0.35 }, semente: 6701 }))
  // A lápide e a cornija em cima dela (a cornija pega mais luz).
  L.push(P(lapide, pedra, { bisel: 1.2 * t.s, tabua: 0, tom: 0.94, contorno: 0.3, semente: 6702 }))
  L.push(P(caixa(t.x(-MEIA_CORNIJA), t.y(MURO), t.x(MEIA_CORNIJA), t.y(FRENTE_DA_CORNIJA), 0.6 * t.s), pedra, { bisel: 1 * t.s, tabua: 0, tom: 1.1, contorno: 0.3, semente: 6703, projeta: { dist: 1.6 * t.s, forca: 0.3 } }))
  // A carranca: a meia cúpula lavrada na frente da lápide, com o friso do contorno.
  const y0 = t.y(FRENTE_DA_LAPIDE)
  const cupula = dentroDe(elipse(0, y0, t.x(RAIO_DA_CARRANCA), RAIO_DA_CARRANCA * t.s), caixa(-t.x(RAIO_DA_CARRANCA) - 1, y0 - 0.6 * t.s, t.x(RAIO_DA_CARRANCA) + 1, y0 + RAIO_DA_CARRANCA * t.s + 1))
  L.push(P(cupula, pedra, { bisel: 2.6 * t.s, tabua: 0, tom: 1.04, contorno: 0.3, semente: 6704, projeta: { dist: 1.4 * t.s, forca: 0.32 } }))
  L.push(P(anel(0, y0, t.x(RAIO_DA_CARRANCA) * 0.62, RAIO_DA_CARRANCA * t.s * 0.62, t.x(RAIO_DA_CARRANCA) * 0.45, RAIO_DA_CARRANCA * t.s * 0.45), pedra, { bisel: 0.4 * t.s, tom: 0.82, contorno: 0.12, semente: 6705 }))
  // A bica de bronze saindo da boca da carranca, com o azinhavre na ponta (seca: a mancha escura do que escorria).
  L.push(P(capsula(0, y0 + 2.8 * t.s, 0, t.y(BOCA_DA_BICA), 0.95 * t.s), BRONZE, { bisel: 0.8 * t.s, contorno: 0.3, metal: 0.4, semente: 6706, projeta: { dist: 1.2 * t.s, forca: 0.35 } }))
  L.push(P(elipse(0, t.y(BOCA_DA_BICA) - 0.4 * t.s, 0.75 * t.s, 0.6 * t.s), seca ? MANCHA_ESCURA : AZINHAVRE, { bisel: 0.3 * t.s, contorno: 0, alfa: 0.75, semente: 6707 }))
  // O limo na borda, junto do muro, dos dois lados (onde a água respinga e o sol não chega).
  for (const lado of [-1, 1]) {
    const x = lado * (MEIO_COCHO - BORDA_DO_COCHO * 0.5) * t.s * 0.94
    L.push(P(elipse(x, y0 + 2.6 * t.s, 1.8 * t.s, 3.4 * t.s), LIMO, { bisel: 0.6 * t.s, contorno: 0, alfa: seca ? 0.4 : 0.62, suave: 0.8 * t.s, semente: 6708 + lado }))
  }
}

/** A água do cocho: a superfície, o reflexo, e os anéis e a espuma onde o fio cai. */
function agua(c: ContextoDoMovel, cena: Cena, t: Prancheta): void {
  const P = c.peca
  const L = cena.partes
  const dentro = meiaLua(t, MEIO_COCHO - BORDA_DO_COCHO, FUNDO_DO_COCHO - BORDA_DO_COCHO)
  L.push(P(dentro, AGUA, { bisel: 0, contorno: 0, textura: texAgua(t), semente: 6720 }))
  L.push(P(elipse(t.x(6), t.y(FRENTE_DA_LAPIDE + 17), 6 * t.s, 2 * t.s), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.16, suave: 1.8 * t.s, semente: 6721 }))
  const yq = t.y(QUEDA)
  for (const [i, r] of [3, 6.2, 9.6].entries()) {
    L.push(P(dentroDe(anel(0, yq, r * t.s, r * 0.62 * t.s, (r - 0.55) * t.s, (r - 0.55) * 0.62 * t.s), dentro), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.3 - i * 0.08, suave: 0.4 * t.s, semente: 6722 + i }))
  }
  L.push(P(uniao(elipse(0, yq, 1.9 * t.s, 1.2 * t.s), elipse(0.9 * t.s, yq + 0.6 * t.s, 1.2 * t.s, 0.8 * t.s)), ESPUMA, { bisel: 0.5 * t.s, contorno: 0, alfa: 0.7, suave: 0.6 * t.s, semente: 6725 }))
}

/** O fundo seco: a terra juntada no fundo, as folhas secas e a marca da água na borda de dentro. */
function fundoSeco(c: ContextoDoMovel, cena: Cena, t: Prancheta): void {
  const P = c.peca
  const L = cena.partes
  const dentro = meiaLua(t, MEIO_COCHO - BORDA_DO_COCHO, FUNDO_DO_COCHO - BORDA_DO_COCHO)
  const marca = menos(dentro, meiaLua(t, MEIO_COCHO - BORDA_DO_COCHO - 1.3, FUNDO_DO_COCHO - BORDA_DO_COCHO - 1.3))
  L.push(P(marca, MANCHA_ESCURA, { bisel: 0, contorno: 0, alfa: 0.35, suave: 0.6 * t.s, semente: 6730 }))
  L.push(P(dentroDe(elipse(t.x(-2), t.y(FRENTE_DA_LAPIDE + 16), 11 * t.s, 7.5 * t.s), dentro), TERRA, { bisel: 0.8 * t.s, contorno: 0, alfa: 0.8, suave: 1.6 * t.s, semente: 6731 }))
  const folhas: readonly [number, number, number][] = [[-8, 12, 0.6], [-3, 19, 2.1], [5, 15, 1.2], [9, 21, 2.8], [-11, 18, 0.2], [2, 24, 1.7], [12, 12, 2.4]]
  folhas.forEach(([x, y, giro], i) => {
    const [cx, cy] = [t.x(x), t.y(FRENTE_DA_LAPIDE + y)]
    const [dx, dy] = [Math.cos(giro) * 1.6 * t.s, Math.sin(giro) * 1.6 * t.s]
    L.push(P(capsula(cx - dx, cy - dy, cx + dx, cy + dy, 0.85 * t.s), FOLHA_SECA[i % FOLHA_SECA.length], { bisel: 0.4 * t.s, contorno: 0.28, semente: 6732 + i, projeta: { dist: 0.6 * t.s, forca: 0.3 } }))
  })
}

/** CORRENDO, a parte parada: a pedra, a bica e a água do cocho (o fio é do animador). */
export const montarFonteDeParede: MontarMovel = (c, cena) => {
  const t = prancheta(c)
  pedraEBica(c, cena, t, false)
  agua(c, cena, t)
}

/** A peça que mexe: o fio de água em repouso, da boca da bica até onde ele cai no cocho. */
export const montarFonteDeParedeQueMexe: MontarMovel = (c, cena) => {
  const t = prancheta(c)
  const [y0, y1] = [t.y(BOCA_DA_BICA) + 0.3 * t.s, t.y(QUEDA)]
  cena.partes.push(c.peca(capsula(0, y0, 0, y1, 0.75 * t.s), FIO, { bisel: 0.5 * t.s, contorno: 0.14, alfa: 0.88, semente: 6740 }))
  cena.partes.push(c.peca(capsula(-0.2 * t.s, y0 + 0.4 * t.s, -0.2 * t.s, y1 - 0.6 * t.s, 0.25 * t.s), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.7, semente: 6741 }))
}

/** CORRENDO numa imagem só (a parte parada e o fio): o desenho de `MONTADORES` e o de "menos movimento". */
export const montarFonteDeParedeCorrendo: MontarMovel = (c, cena) => {
  montarFonteDeParede(c, cena)
  montarFonteDeParedeQueMexe(c, cena)
}

/** SECA: a pedra e a bica, o cocho vazio com a terra e as folhas. */
export const montarFonteDeParedeSeca: MontarMovel = (c, cena) => {
  const t = prancheta(c)
  pedraEBica(c, cena, t, true)
  fundoSeco(c, cena, t)
}
