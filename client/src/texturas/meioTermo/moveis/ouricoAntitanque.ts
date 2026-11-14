/**
 * OURIÇO ANTITANQUE de cima com volume (14/11/2026, a base militar): três
 * cantoneiras de aço cruzadas no meio, cada uma com uma ponta no chão e a
 * outra no ar. Visto do alto é a estrela de seis braços: os três que SOBEM
 * (claros, com a sombra comprida no chão) se alternam com os três que DESCEM
 * (mais escuros, com o pé cravado). Cada braço é a cantoneira em L: a aba
 * deitada, larga, e a aba em pé, um filete claro do lado da luz ou escuro do
 * outro; a ponta do que sobe mostra o corte do aço. No meio, a chapa de
 * reforço com os três parafusos. Ferrugem em manchas por tudo.
 *
 * A 25% de zoom sobra o asterisco escuro com três braços claros e a sombra
 * longa e recortada deles: é o que diz "ouriço" e não "estrela de ferro" (a
 * sombra mostra que ele fica em pé). A estrela ocupa a pegada (1 x 1 casa de
 * partida); esticada, os braços acompanham a pegada. O aço, a ferrugem e os
 * parafusos são fixos.
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { barra, capsula, elipse, poligono, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** O aço da cantoneira, laminado e escuro, e o da chapa de reforço. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.96)) }
const CHAPA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.04)) }
const PARAFUSO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.12)) }
/** A ferrugem: o marrom-alaranjado baixo da âncora e da sucata. */
const FERRUGEM: Rgb = rgb('#935f47')
const FERRUGEM_CHEIA = 0.8
/** O escuro em que o pixel escuro demais é levantado: o cinza-escuro quente do canhão (com a nogueira, o aço saía marrom). */
const ESCURO_DO_ACO: Rgb = rgb('#4a4541')

/** O primeiro braço que sobe (radianos, 0 = para a direita): torto, para a estrela não sair de régua. */
const PRIMEIRO_BRACO = -1.32
/** Até onde vai a ponta de cada braço, em frações da meia pegada, e um nada de diferença entre eles (feito à mão). */
const ALCANCE = 0.95
const ALCANCES_DO_QUE_SOBE = [1, 0.93, 0.97]
const ALCANCES_DO_QUE_DESCE = [0.95, 1, 0.92]
/** A aba deitada e a aba em pé, em fração do menor lado da pegada e em px do protótipo. */
const ABA = 0.094
const ABA_EM_PE = 1.4
/** As alturas, em casas: a ponta do que sobe e o meio (o cruzamento). */
const ALTURA_DA_PONTA = 0.86
const ALTURA_DO_MEIO = 0.44
/** Em quantos pedaços a sombra de cada braço é cortada para subir aos poucos (com quatro, ela saía em degraus). */
const PEDACOS_DA_SOMBRA = 9
/** A luz vem de cima à esquerda (a sombra cai para baixo à direita). */
const LUZ_X = -0.6
const LUZ_Y = -0.8

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/**
 * O aço do braço: a ferrugem em manchas (mais perto do pé, no que desce), um grão miúdo e a luz que muda ao
 * longo dele (`luzNaPonta`: o que sobe clareia para a ponta, o que desce escurece).
 */
function texDoAco(ax: number, ay: number, bx: number, by: number, luzNaPonta: number, ferrugemNaPonta: number): Textura {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy || 1
  return (_u, _v, x, y, p, s) => {
    const t = limitar(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1)
    const mancha = ruido(x * 0.2 + p.su, y * 0.2 + p.sv) * 1.5 + ruido(x * 0.65 + p.sv, y * 0.65 + p.su) * 0.7
    const q = (mancha + ferrugemNaPonta * t - 0.1) / 0.45
    const f = q <= 0 ? 0 : q >= 1 ? FERRUGEM_CHEIA : q * q * (3 - 2 * q) * FERRUGEM_CHEIA
    s[0] += (FERRUGEM[0] - s[0]) * f
    s[1] += (FERRUGEM[1] - s[1]) * f
    s[2] += (FERRUGEM[2] - s[2]) * f
    s[3] += luzNaPonta * t + ruido(x * 0.9, y * 0.9 + p.su) * 0.05 - f * 0.04
  }
}

interface Braco {
  /** Do meio até a ponta, em px. */
  readonly ponta: Ponto
  readonly sobe: boolean
  readonly k: number
}

/** A altura (px) num ponto do braço, `t` de 0 (o meio) a 1 (a ponta). */
function alturaNoBraco(c: ContextoDoMovel, sobe: boolean, t: number): number {
  const meio = c.g * ALTURA_DO_MEIO
  return sobe ? meio + (c.g * ALTURA_DA_PONTA - meio) * t : meio * (1 - t)
}

/** A cantoneira de um braço: a aba deitada, a aba em pé (no lado de fora da volta) e o corte na ponta do que sobe. */
function montarBraco(c: ContextoDoMovel, cena: Cena, braco: Braco): void {
  const P = c.peca
  const [px, py] = braco.ponta
  const l = Math.hypot(px, py) || 1
  const ux = px / l
  const uy = py / l
  // A aba em pé fica de um lado só: a normal à esquerda do braço.
  const nx = -uy
  const ny = ux
  const aba = Math.min(c.w, c.h) * ABA
  const naLuz = nx * LUZ_X + ny * LUZ_Y
  const sem = 8400 + braco.k * 10 + (braco.sobe ? 0 : 5)

  // A sombra, em pedaços que sobem (ou descem) com o braço.
  for (let i = 0; i < PEDACOS_DA_SOMBRA; i += 1) {
    const t0 = i / PEDACOS_DA_SOMBRA
    const t1 = (i + 1) / PEDACOS_DA_SOMBRA
    const pedaco = capsula(px * t0, py * t0, px * t1, py * t1, aba / 2 + 0.4)
    cena.sombras.push({ forma: pedaco, z: alturaNoBraco(c, braco.sobe, (t0 + t1) / 2), solta: true, forca: 0.22, suave: 1.3 })
  }
  if (!braco.sobe) cena.sombras.push(contato(elipse(px * 0.96, py * 0.96, aba * 0.9, aba * 0.9), 0.4))

  const tom = braco.sobe ? 1.04 : 0.82
  const luzNaPonta = braco.sobe ? 0.16 : -0.12
  cena.partes.push(P(barra(0, 0, px, py, aba), ACO, {
    eixo: Math.atan2(py, px),
    tabua: 0,
    bisel: 0.7,
    tom,
    contorno: 0.32,
    metal: 0.22,
    textura: texDoAco(0, 0, px, py, luzNaPonta, braco.sobe ? 0.05 : 0.3),
    semente: sem,
    projeta: braco.sobe ? { dist: 1.6, forca: 0.36, suave: 1 } : undefined,
  }))
  const ox = (nx * (aba - ABA_EM_PE)) / 2
  const oy = (ny * (aba - ABA_EM_PE)) / 2
  cena.partes.push(P(barra(ox, oy, px + ox, py + oy, ABA_EM_PE), ACO, {
    eixo: Math.atan2(py, px),
    tabua: 0,
    bisel: 0.5,
    tom: tom * (naLuz > 0 ? 1.28 : 0.72),
    contorno: 0.2,
    metal: 0.4,
    textura: texDoAco(ox, oy, px + ox, py + oy, luzNaPonta, braco.sobe ? 0.05 : 0.3),
    semente: sem + 1,
  }))
  if (!braco.sobe) return
  // O corte do aço na ponta: o L claro da seção, vista meio de cima.
  const fim = 1.1
  const L: Ponto[] = [
    [px - (nx * aba) / 2, py - (ny * aba) / 2],
    [px + (nx * aba) / 2, py + (ny * aba) / 2],
    [px + (nx * aba) / 2 - ux * fim, py + (ny * aba) / 2 - uy * fim],
    [px - (nx * aba) / 2 - ux * fim, py - (ny * aba) / 2 - uy * fim],
  ]
  cena.partes.push(P(poligono(L), ACO, { tabua: 0, bisel: 0.3, tom: 1.36, contorno: 0.2, metal: 0.55, semente: sem + 2 }))
}

/** A chapa de reforço do cruzamento: o triângulo de pontas cortadas apontando para os braços que sobem, com os três parafusos. */
function montarChapa(c: ContextoDoMovel, cena: Cena, angulos: readonly number[]): void {
  const P = c.peca
  const k = Math.min(c.w, c.h)
  const raio = k * 0.13
  const corte = 0.32
  const pontos: Ponto[] = []
  for (const a of angulos) {
    pontos.push([Math.cos(a - corte) * raio, Math.sin(a - corte) * raio], [Math.cos(a + corte) * raio, Math.sin(a + corte) * raio])
  }
  cena.partes.push(P(poligono(pontos), CHAPA, { tabua: 0, bisel: 0.8, tom: 1.06, contorno: 0.34, metal: 0.26, textura: texDoAco(0, 0, raio, 0, 0, 0.1), semente: 8460, projeta: { dist: 1, forca: 0.34 } }))
  const rP = k * 0.026
  angulos.forEach((a, i) => {
    const x = Math.cos(a) * raio * 0.55
    const y = Math.sin(a) * raio * 0.55
    cena.partes.push(P(elipse(x, y, rP, rP), PARAFUSO, { tabua: 0, bisel: rP, tom: 1.1, contorno: 0.26, metal: 0.45, semente: 8461 + i, projeta: { dist: 0.5, forca: 0.3 } }))
  })
}

export const montarOuricoAntitanque: MontarMovel = (c, cena) => {
  cena.corDoPiso = ESCURO_DO_ACO
  const sobem: Braco[] = []
  const descem: Braco[] = []
  const angulos: number[] = []
  for (let k = 0; k < 3; k += 1) {
    const a = PRIMEIRO_BRACO + (k * 2 * Math.PI) / 3
    angulos.push(a)
    const s = ALCANCE * ALCANCES_DO_QUE_SOBE[k]
    const d = ALCANCE * ALCANCES_DO_QUE_DESCE[k]
    sobem.push({ ponta: [Math.cos(a) * c.hw * s, Math.sin(a) * c.hh * s], sobe: true, k })
    descem.push({ ponta: [-Math.cos(a) * c.hw * d, -Math.sin(a) * c.hh * d], sobe: false, k })
  }
  // De baixo para cima: os três que descem, depois os três que sobem por cima deles, e a chapa no cruzamento.
  for (const braco of descem) montarBraco(c, cena, braco)
  for (const braco of sobem) montarBraco(c, cena, braco)
  montarChapa(c, cena, angulos)
}
