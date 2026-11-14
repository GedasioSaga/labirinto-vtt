/**
 * HARPA (lote L10 dos objetos de 14/11/2026, grupo Taverna e festa; pedido do mestre: "harpa"). EM PÉ, de lado,
 * como a lápide, a bandeira pirata e o alvo: vista do alto a harpa é um risco fino (a coluna, o pescoço e a
 * caixa ficam um em cima do outro e as cordas somem), e o que todo mundo reconhece é o TRIÂNGULO de perfil.
 *
 * O desenho: o PÉ de madeira no chão; a COLUNA de pé na frente (à esquerda), com o anel de latão embaixo e a
 * COROA entalhada em cima; a CAIXA de ressonância subindo inclinada do pé até o ombro, mais larga embaixo, com o
 * TAMPO claro de abeto do lado das cordas e os furos delas; o PESCOÇO em curva de S do ombro até a coroa, com as
 * CRAVELHAS de latão; e as CORDAS de pé entre o tampo e o pescoço, claras, com as de dó vermelhas e as de fá
 * escuras, como nas harpas de verdade (é por elas que o harpista se acha).
 *
 * O desenho é feito na pegada de partida (0,8 x 1 casa) e escala inteiro com a menor razão; só a ponta da coroa
 * passa da pegada para cima (0,04 casa). O giro deita a imagem, como na lápide. Material: `madeira` (o pé, a coluna, a caixa e o
 * pescoço; cerejeira de partida). O tampo, as cordas e o latão são fixos.
 */
import { capsula, cadeia, caixa, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** A pegada de partida (px do protótipo) e a altura da harpa, em casas, para a sombra no chão. */
const LARGURA_DE_PARTIDA = 0.8 * G
const ALTURA_DE_PARTIDA = 1 * G
const ALTURA_DA_HARPA = 1.15

// O desenho, em px de partida (0 no meio da pegada, y para baixo).
const CHAO = 26.4
/** O pé: um bloco comprido no chão, por baixo da coluna e da caixa. */
const PE = { x0: -18.4, x1: 4.4, y0: 21.6, y1: 26 } as const
/** A coluna: o x, a meia grossura no pé e no alto, e onde ela começa e acaba. */
const COLUNA_X = -14.6
const MEIA_COLUNA_PE = 1.9
const MEIA_COLUNA_ALTO = 1.45
const COLUNA_Y0 = -24.6
const COLUNA_Y1 = 21.8
/** A caixa: o meio da base (no pé) e o do ombro (em cima), e a meia largura de cada ponta. */
const CAIXA_BASE: Ponto = [-5.6, 21.8]
const CAIXA_OMBRO: Ponto = [17.6, -12.4]
const MEIA_CAIXA_BASE = 5.2
const MEIA_CAIXA_OMBRO = 2.1
/** O pescoço em S, do ombro à coroa, e a grossura dele. */
const PESCOCO: readonly Ponto[] = [
  [18.6, -11.4],
  [17.4, -15.6],
  [13.6, -18.4],
  [8.6, -18.6],
  [3.6, -18.8],
  [-1.6, -20.6],
  [-6.6, -23.6],
  [-11.2, -25.8],
  [-14.4, -26.2],
]
const RAIO_DO_PESCOCO = 1.55
/** As cordas: da primeira (perto da coluna) à última (perto do ombro), o passo, e a cada quantas vem a de dó. */
const PRIMEIRA_CORDA_X = -8.4
const ULTIMA_CORDA_X = 15.4
const PASSO_DAS_CORDAS = 1.38
const OITAVA = 7
/** Dentro da oitava, a corda de dó (vermelha) e a de fá (escura). */
const DO = 0
const FA = 3

const TAMPO: MaterialDaPeca = { classe: 'madeira', rgb: [0xd4, 0xb0, 0x76] }
const CORDA_CLARA: MaterialDaPeca = { classe: 'liso', rgb: [0xe8, 0xdc, 0xc0] }
const CORDA_DE_DO: MaterialDaPeca = { classe: 'liso', rgb: [0xb0, 0x58, 0x4c] }
const CORDA_DE_FA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x46, 0x50] }
const LATAO = materialDaPeca('latao')
/** O lustro do verniz na madeira: o brilho do metal, bem fraco, no chanfro virado para a luz. */
const LUSTRO_DO_VERNIZ = 0.14

/** O y da beira de cima do tampo no ponto `x`: a reta da caixa, do lado das cordas. */
function beiraDoTampo(x: number): number {
  const [bx, by] = CAIXA_BASE
  const [ox, oy] = CAIXA_OMBRO
  const t = (x - bx) / (ox - bx)
  const meia = MEIA_CAIXA_BASE + (MEIA_CAIXA_OMBRO - MEIA_CAIXA_BASE) * t
  const yMeio = by + (oy - by) * t
  // A caixa sobe para a direita: o lado das cordas é o de cima e à esquerda; a beira fica `meia` px acima do meio.
  const inclinacao = Math.hypot(ox - bx, oy - by) / (ox - bx)
  return yMeio - meia * inclinacao
}

/** O y da beira de baixo do pescoço no ponto `x` (onde a corda prende), andando pela curva. */
function beiraDoPescoco(x: number): number {
  for (let i = 1; i < PESCOCO.length; i += 1) {
    const [ax, ay] = PESCOCO[i - 1]
    const [bx, by] = PESCOCO[i]
    if ((x <= ax && x >= bx) || (x >= ax && x <= bx)) {
      const t = (x - ax) / (bx - ax || 1)
      return ay + (by - ay) * t + RAIO_DO_PESCOCO * 0.7
    }
  }
  return PESCOCO[PESCOCO.length - 1][1] + RAIO_DO_PESCOCO
}

export const montarHarpa: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.w / LARGURA_DE_PARTIDA, c.h / ALTURA_DE_PARTIDA)
  const em = (x: number, y: number): Ponto => [x * k, y * k]
  const mad = c.m.madeira
  const L = cena.partes

  // A sombra: o pé no chão, alto como a harpa (a coluna e a caixa sobem dele).
  const pe = caixa(...em(PE.x0, PE.y0), ...em(PE.x1, PE.y1), 1 * k)
  cena.sombras.push(
    { forma: caixa(...em(PE.x0 + 1, CHAO - 1.4), ...em(PE.x1 - 1, CHAO), 0.5 * k), z: c.g * ALTURA_DA_HARPA * k, forca: 0.26, suave: 1.6 },
    contato(elipse(...em((PE.x0 + PE.x1) / 2, CHAO - 0.3), ((PE.x1 - PE.x0) / 2 + 1.4) * k, 1.8 * k), 0.32),
  )

  // As cordas primeiro: ficam atrás da coluna, do pescoço e do tampo.
  const cordas = Math.floor((ULTIMA_CORDA_X - PRIMEIRA_CORDA_X) / PASSO_DAS_CORDAS) + 1
  for (let i = 0; i < cordas; i += 1) {
    const x = PRIMEIRA_CORDA_X + i * PASSO_DAS_CORDAS
    const nota = i % OITAVA
    const mat = nota === DO ? CORDA_DE_DO : nota === FA ? CORDA_DE_FA : CORDA_CLARA
    // As graves (perto da coluna) são mais grossas.
    const raio = (0.34 - 0.14 * (i / cordas)) * k
    L.push(P(capsula(...em(x, beiraDoPescoco(x)), ...em(x, beiraDoTampo(x) + 0.6), raio), mat, { tabua: 0, eixo: QUARTO, bisel: 0, contorno: 0.12, alfa: 0.92, semente: 5100 + i }))
  }

  // A caixa de ressonância: o corpo inclinado, mais largo embaixo, e o tampo claro do lado das cordas.
  const [bx, by] = CAIXA_BASE
  const [ox, oy] = CAIXA_OMBRO
  const l = Math.hypot(ox - bx, oy - by)
  const nx = (oy - by) / l
  const ny = -(ox - bx) / l
  const angCaixa = Math.atan2(oy - by, ox - bx)
  const corpo = poligono([
    em(bx + nx * MEIA_CAIXA_BASE, by + ny * MEIA_CAIXA_BASE),
    em(ox + nx * MEIA_CAIXA_OMBRO, oy + ny * MEIA_CAIXA_OMBRO),
    em(ox - nx * MEIA_CAIXA_OMBRO * 1.3, oy - ny * MEIA_CAIXA_OMBRO * 1.3),
    em(bx - nx * MEIA_CAIXA_BASE * 1.25, by - ny * MEIA_CAIXA_BASE * 1.25),
  ])
  L.push(P(corpo, mad, { tabua: 0, eixo: angCaixa, bisel: 1.6 * k, contorno: 0.3, tom: 0.92, metal: LUSTRO_DO_VERNIZ, semente: 5200 }))
  const tampo = poligono([
    em(bx + nx * MEIA_CAIXA_BASE, by + ny * MEIA_CAIXA_BASE),
    em(ox + nx * MEIA_CAIXA_OMBRO, oy + ny * MEIA_CAIXA_OMBRO),
    em(ox + nx * MEIA_CAIXA_OMBRO * 0.15, oy + ny * MEIA_CAIXA_OMBRO * 0.15),
    em(bx + nx * MEIA_CAIXA_BASE * 0.42, by + ny * MEIA_CAIXA_BASE * 0.42),
  ])
  L.push(P(tampo, TAMPO, { tabua: 0, eixo: angCaixa, bisel: 0.7 * k, contorno: 0.24, semente: 5201 }))
  // Os furos das cordas no tampo e as três rosetas da caixa (as bocas do som, nas costas, de lado aparecem como furos).
  for (let i = 0; i < cordas; i += 1) {
    const x = PRIMEIRA_CORDA_X + i * PASSO_DAS_CORDAS
    if (x < bx + 1) continue
    L.push(P(elipse(...em(x, beiraDoTampo(x) + 0.9), 0.32 * k, 0.32 * k), CORDA_DE_FA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.7, semente: 5210 + i }))
  }
  for (const t of [0.22, 0.5, 0.76]) {
    const cx = bx + (ox - bx) * t - nx * 1.2
    const cy = by + (oy - by) * t - ny * 1.2
    const r = (MEIA_CAIXA_BASE + (MEIA_CAIXA_OMBRO - MEIA_CAIXA_BASE) * t) * 0.32
    L.push(P(elipse(...em(cx, cy), r * k, r * 0.8 * k), mad, { tabua: 0, bisel: 0, contorno: 0.2, tom: 0.45, recesso: { k: 0.8, forca: 0.3 }, semente: 5220 }))
  }

  // O pé, por cima da ponta da caixa e da coluna, com os dois pezinhos.
  for (const x of [PE.x0 + 2.4, PE.x1 - 2.4]) L.push(P(caixa(...em(x - 1.8, PE.y1 - 1), ...em(x + 1.8, CHAO), 0.6 * k), mad, { tabua: 0, bisel: 0.6 * k, contorno: 0.3, tom: 0.78, semente: 5230 }))
  L.push(P(pe, mad, { tabua: 0, bisel: 1.1 * k, contorno: 0.3, tom: 0.86, metal: LUSTRO_DO_VERNIZ, semente: 5231 }))
  L.push(P(caixa(...em(PE.x0 + 0.8, PE.y0 + 0.5), ...em(PE.x1 - 0.8, PE.y0 + 1.3), 0.3 * k), LATAO, { tabua: 0, bisel: 0.3 * k, contorno: 0.2, semente: 5232 }))

  // A coluna, afinando para cima, com o anel de latão no pé e o entalhe em gomos no meio.
  const coluna = poligono([em(COLUNA_X - MEIA_COLUNA_PE, COLUNA_Y1), em(COLUNA_X - MEIA_COLUNA_ALTO, COLUNA_Y0), em(COLUNA_X + MEIA_COLUNA_ALTO, COLUNA_Y0), em(COLUNA_X + MEIA_COLUNA_PE, COLUNA_Y1)])
  L.push(P(coluna, mad, { tabua: 0, eixo: QUARTO, bisel: 1.2 * k, contorno: 0.3, metal: LUSTRO_DO_VERNIZ, semente: 5240, projeta: { dist: 0.9 * k, forca: 0.3 } }))
  for (const y of [17.8, -2.4, -16]) {
    L.push(P(caixa(...em(COLUNA_X - MEIA_COLUNA_PE - 0.35, y - 0.8), ...em(COLUNA_X + MEIA_COLUNA_PE + 0.35, y + 0.8), 0.5 * k), LATAO, { tabua: 0, bisel: 0.5 * k, contorno: 0.28, semente: 5241 }))
  }

  // O pescoço em S, a coroa entalhada no alto da coluna e as cravelhas de latão.
  L.push(P(cadeia(PESCOCO.map(([x, y]) => em(x, y)), RAIO_DO_PESCOCO * k), mad, { tabua: 0, eixo: -0.2, bisel: 1.1 * k, contorno: 0.3, tom: 1.05, metal: LUSTRO_DO_VERNIZ, semente: 5250, projeta: { dist: 0.8 * k, forca: 0.3 } }))
  const coroa: Forma = uniao(elipse(...em(COLUNA_X, COLUNA_Y0 - 1.4), 2.6 * k, 2.1 * k), poligono([em(COLUNA_X - 2.2, COLUNA_Y0 - 2.6), em(COLUNA_X - 1, COLUNA_Y0 - 5.4), em(COLUNA_X + 0.2, COLUNA_Y0 - 3.4), em(COLUNA_X + 1.4, COLUNA_Y0 - 5.8), em(COLUNA_X + 2.4, COLUNA_Y0 - 2.4)]))
  L.push(P(coroa, mad, { tabua: 0, bisel: 1 * k, contorno: 0.3, tom: 1.1, metal: LUSTRO_DO_VERNIZ, semente: 5251 }))
  L.push(P(elipse(...em(COLUNA_X, COLUNA_Y0 - 1.4), 1 * k, 1 * k), LATAO, { tabua: 0, bisel: 0.6 * k, contorno: 0.25, semente: 5252 }))
  for (let i = 0; i < cordas; i += 2) {
    const x = PRIMEIRA_CORDA_X + i * PASSO_DAS_CORDAS
    L.push(P(elipse(...em(x, beiraDoPescoco(x) - RAIO_DO_PESCOCO * 0.9), 0.42 * k, 0.42 * k), LATAO, { tabua: 0, bisel: 0.3 * k, contorno: 0.2, semente: 5260 + i }))
  }
}
