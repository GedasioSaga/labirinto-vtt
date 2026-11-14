/**
 * PEBOLIM de cima com volume (lote L12 dos objetos novos, 14/11/2026, "Descanso e brincadeira"): a mesa de
 * futebol de botequim. A CAIXA de madeira com a borda grossa e as duas BOCAS de gol nas cabeceiras; dentro, o
 * CAMPO verde afundado, com as faixas de grama e as linhas a giz (o meio, o círculo, as duas áreas); por cima,
 * as oito VARETAS de aço de lado a lado, cada uma com os BONECOS do time dela (vinho de um lado, azul do outro:
 * goleiro, dois zagueiros, cinco no meio e três no ataque, alternados como na mesa de verdade) e o PUNHO escuro
 * para fora do lado de quem joga; do outro lado sai só a ponta da vareta. A BOLA está no campo, e nas cabeceiras,
 * ao lado de cada gol, o PLACAR de contas no arame.
 *
 * A 25% de zoom sobram o retângulo verde na moldura de madeira, as listras claras das varetas com as pintas
 * vermelhas e azuis em fila e os punhos para fora dos dois lados compridos: é o que diz pebolim, e não sinuca (a
 * sinuca não tem vareta nem punho, e tem as caçapas e as bolas soltas).
 *
 * Na 3/4 (`tresQuartos.ts`, derivado, beirada de `ESPESSURA_DO_PEBOLIM`): a caixa é um tampo solto na altura da
 * borda, com a beirada da altura da lateral; a peça maior dela é o fundo de madeira (debaixo do campo), por isso a
 * lateral sai de madeira. As quatro PERNAS são colunas (os topos delas, debaixo da caixa, são as peças de cada
 * uma). As varetas com os punhos são uma peça só cada, com o meio dentro da caixa: sobem inteiras com ela, os punhos
 * para fora junto. A sombra das varetas fora da caixa é a forma delas afastada pela altura, calculada aqui.
 *
 * Material: `madeira` (a caixa e as pernas). O campo, o giz, os bonecos, os punhos, a bola e as contas são fixos.
 */
import type { Rgb } from '../../ruido'
import { capsula, caixa, elipse, uniao, type Forma } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, G, materialDaPeca, PREGO, QUARTO, type MontarMovel } from './contexto'

/** A altura da borda da caixa (casas) e a beirada da 3/4: a lateral da caixa (px). */
const ALTURA_DA_BORDA = 0.52
export const ESPESSURA_DO_PEBOLIM = 0.2 * G
/** As varetas passam um pouco abaixo da borda (casas). */
const VARETA_ABAIXO_DA_BORDA = 0.06

/** O desenho foi medido em 1,2 x 0,9 casa: as medidas miúdas (px) escalam por aqui. */
const MEIA_LARGURA_DE_PARTIDA = 0.6 * G
const MEIA_FUNDURA_DE_PARTIDA = 0.45 * G

/** A caixa ocupa esta fração da meia fundura (o resto é dos punhos); px de partida: a borda e o fundo do gol. */
const MEIA_CAIXA = 0.62
const BORDA = 3.4
const BOCA_DO_GOL = 0.34
/** As varetas: o raio, o alcance da ponta (fração da meia fundura), o punho (raio, px) e a ponta do outro lado (px além da caixa). */
const RAIO_DA_VARETA = 0.65
const ALCANCE = 0.96
const RAIO_DO_PUNHO = 1.35
const PONTA_SEM_PUNHO = 4
/** Os bonecos de cada vareta, do gol do poente ao do nascente, e o time de cada uma (0 = vinho, joga para o nascente). */
const BONECOS: readonly number[] = [1, 2, 3, 5, 5, 3, 2, 1]
const TIME: readonly (0 | 1)[] = [0, 0, 1, 0, 1, 0, 1, 1]
/** As meias medidas do boneco (px de partida): de través da vareta (os ombros) e ao longo do campo; o raio da cabeça. */
const OMBROS = 1.75
const PEITO = 1.05
const CABECA = 0.85

/** O campo e o giz; os punhos, a bola e as contas do placar. */
const CAMPO: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x7f, 0x51] }
const GIZ: Rgb = [0xe6, 0xe2, 0xd0]
const PUNHO: Rgb = [0x3b, 0x31, 0x2b]
const BOLA: MaterialDaPeca = { classe: 'liso', rgb: [0xe9, 0xe1, 0xcc] }
const CONTA: MaterialDaPeca = { classe: 'liso', rgb: [0xd9, 0xcf, 0xb4] }
/** A meia largura do giz e o recuo da linha de fundo (px de partida). */
const MEIO_GIZ = 0.4
const RECUO_DA_LINHA = 1.2

/** O campo: as faixas de grama ao longo do comprimento e as linhas a giz. */
function texDoCampo(x0: number, y0: number, x1: number, y1: number, k: number): Textura {
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const mw = (x1 - x0) / 2
  const mh = (y1 - y0) / 2
  const lw = MEIO_GIZ * k
  const recuo = RECUO_DA_LINHA * k
  const area = mw * 0.8
  return (_u, _v, x, y, p, s) => {
    const faixa = Math.floor(((x - x0) / (x1 - x0)) * 8)
    s[3] += (faixa % 2 === 0 ? 0.04 : -0.035) + ruido(x * 0.4 + p.su, y * 0.4) * 0.04
    const dx = Math.abs(x - cx)
    const dy = Math.abs(y - cy)
    const fundo = mw - recuo
    const lado = mh - recuo
    const noMeio = dx < lw && dy < lado
    const noCirculo = Math.abs(Math.hypot(x - cx, y - cy) - mh * 0.34) < lw || Math.hypot(x - cx, y - cy) < lw * 1.6
    const naArea = (Math.abs(dx - area) < lw && dy < mh * 0.5) || (dx > area && dx < fundo && Math.abs(dy - mh * 0.5) < lw)
    const naBeira = (Math.abs(dx - fundo) < lw && dy < lado) || (Math.abs(dy - lado) < lw && dx < fundo)
    if (noMeio || noCirculo || naArea || naBeira) {
      s[0] += (GIZ[0] - s[0]) * 0.72
      s[1] += (GIZ[1] - s[1]) * 0.72
      s[2] += (GIZ[2] - s[2]) * 0.72
    }
  }
}

/** A vareta de aço e o punho escuro do lado de `lado` (1 = sul), a partir de `inicio` (y em que o punho começa). */
function texDaVareta(lado: number, inicio: number): Textura {
  const metal = texturaDaClasse('metal')
  return (u, v, x, y, p, s, escala) => {
    if (y * lado > inicio) {
      s[0] = PUNHO[0]
      s[1] = PUNHO[1]
      s[2] = PUNHO[2]
      s[3] += ruido(x * 0.6 + p.su, y * 0.6) * 0.05
      return
    }
    if (metal !== null) metal(u, v, x, y, p, s, escala)
    s[3] += 0.16
  }
}

/** A forma `f` andada de (dx, dy): a sombra no chão da vareta fora da caixa. */
function andada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

export const montarPebolim: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const k = Math.min(hw / MEIA_LARGURA_DE_PARTIDA, hh / MEIA_FUNDURA_DE_PARTIDA)
  const zBorda = g * ALTURA_DA_BORDA
  const zVareta = zBorda - g * VARETA_ABAIXO_DA_BORDA

  const x0 = -hw + 0.5 * k
  const x1 = hw - 0.5 * k
  const mc = hh * MEIA_CAIXA
  const W = BORDA * k
  const fx0 = x0 + W
  const fx1 = x1 - W
  const fy0 = -mc + W
  const fy1 = mc - W

  // As PERNAS nos cantos, debaixo da caixa: colunas até a borda (de cima a caixa as tapa).
  const meiaPerna = 1.4 * k
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const px = sx * (hw - 3.2 * k)
    const py = sy * (mc - 2.6 * k)
    const perna = caixa(px - meiaPerna, py - meiaPerna, px + meiaPerna, py + meiaPerna, 0.4 * k)
    cena.sombras.push({ forma: perna, z: zBorda }, contato(perna, 0.3))
    L.push(P(perna, mad, { eixo: QUARTO, tabua: 0, bisel: 0.8 * k, tom: 0.82, semente: 7900 + sx + sy * 2 }))
  }

  // A CAIXA: tampo solto na altura da borda, com a sombra afastada. O fundo de madeira é a peça maior (a lateral da 3/4).
  const corpo = caixa(x0, -mc, x1, mc, 1 * k)
  cena.sombras.push({ forma: corpo, z: zBorda, solta: true })
  L.push(P(corpo, mad, { eixo: 0, tabua: 0, bisel: 1 * k, tom: 0.7, semente: 7905 }))

  // O CAMPO afundado, com o giz, e a borda: as duas laterais compridas inteiras e as cabeceiras entre elas, com o gol.
  L.push(P(caixa(fx0, fy0, fx1, fy1, 0.4 * k), CAMPO, { bisel: 0, contorno: 0.14, recesso: { k: 2.6 * k, forca: 0.42 }, textura: texDoCampo(fx0, fy0, fx1, fy1, k), semente: 7906 }))
  L.push(P(caixa(x0, -mc, x1, fy0, 0.8 * k), mad, { eixo: 0, tabua: 0, bisel: 1.1 * k, contorno: 0.26, semente: 7907 }))
  L.push(P(caixa(x0, fy1, x1, mc, 0.8 * k), mad, { eixo: 0, tabua: 0, bisel: 1.1 * k, contorno: 0.26, semente: 7908 }))
  const bocaDoGol = (fy1 - fy0) * BOCA_DO_GOL
  for (const lado of [-1, 1]) {
    const xa = lado < 0 ? x0 : fx1
    const xb = lado < 0 ? fx0 : x1
    L.push(P(caixa(xa, fy0, xb, fy1, 0.3 * k), mad, { eixo: QUARTO, tabua: 0, bisel: 1.1 * k, tom: 0.94, contorno: 0.26, semente: 7909 + lado }))
    // A boca do gol: a fenda escura na cabeceira, aberta para o campo.
    const gx0 = lado < 0 ? fx0 - W * 0.75 : fx1
    const gx1 = lado < 0 ? fx0 : fx1 + W * 0.75
    L.push(P(caixa(gx0, -bocaDoGol / 2, gx1, bocaDoGol / 2, 0.4 * k), BURACO, { bisel: 0.4 * k, contorno: 0.3, recesso: { k: 1.4 * k, forca: 0.4 }, semente: 7912 + lado }))
    // O PLACAR: o arame e quatro contas, na cabeceira, do lado de trás do gol.
    const ax = (xa + xb) / 2
    const ay0 = fy0 + 0.8 * k
    const ay1 = -bocaDoGol / 2 - 1.2 * k
    L.push(P(capsula(ax, ay0, ax, ay1, 0.22 * k), PREGO, { bisel: 0, contorno: 0, metal: 0.4, semente: 7914 }))
    for (let i = 0; i < 4; i += 1) {
      const passo = (ay1 - ay0) / 5.2
      const y = i < 2 ? ay0 + passo * (i + 0.6) : ay1 - passo * (3.6 - i)
      L.push(P(elipse(ax, y, 0.75 * k, 0.75 * k), CONTA, { bisel: 0.75 * k, tom: lado < 0 ? 0.92 : 1.05, contorno: 0.3, semente: 7915 + i }))
    }
  }

  // A BOLA no campo, com a sombra dela.
  const larguraDoCampo = fx1 - fx0
  L.push(P(elipse(fx0 + larguraDoCampo * 0.58, fy0 + (fy1 - fy0) * 0.66, 1.05 * k, 1.05 * k), BOLA, { bisel: 1.05 * k, contorno: 0.3, semente: 7920, projeta: { dist: 1.2 * k, forca: 0.36 } }))

  // As VARETAS com os punhos (uma peça cada, o meio dentro da caixa) e os BONECOS de cada time.
  const vinho = materialDaPeca('vinho')
  const azul = materialDaPeca('azul')
  const times: readonly MaterialDaPeca[] = [{ classe: 'liso', rgb: vinho.rgb }, { classe: 'liso', rgb: azul.rgb }]
  const alcance = hh * ALCANCE
  const sombraDaVareta = { dist: 2.2 * k, forca: 0.3, suave: 0.8 * k }
  BONECOS.forEach((quantos, i) => {
    const x = fx0 + (larguraDoCampo * (i + 0.5)) / BONECOS.length
    const time = TIME[i]
    // O time 0 joga do lado sul (o punho sai no sul); o 1, do norte.
    const lado = time === 0 ? 1 : -1
    const inicioDoPunho = mc + 1.2 * k
    const ponta = -lado * (mc + PONTA_SEM_PUNHO * k)
    const vareta = uniao(capsula(x, ponta, x, lado * alcance, RAIO_DA_VARETA * k), capsula(x, lado * (inicioDoPunho + RAIO_DO_PUNHO * k), x, lado * alcance, RAIO_DO_PUNHO * k))
    cena.sombras.push({ forma: andada(vareta, SOMBRA_X * zVareta, SOMBRA_Y * zVareta), z: 0, suave: 1.3 * k, forca: 0.24 })
    L.push(P(vareta, mad, { eixo: QUARTO, tabua: 0, bisel: RAIO_DO_PUNHO * k, contorno: 0.28, metal: 0.5, textura: texDaVareta(lado, inicioDoPunho), semente: 7930 + i, projeta: sombraDaVareta }))
    const mat = times[time]
    for (let j = 0; j < quantos; j += 1) {
      const y = fy0 + ((fy1 - fy0) * (j + 1)) / (quantos + 1)
      const ombros = caixa(x - PEITO * k, y - OMBROS * k, x + PEITO * k, y + OMBROS * k, 0.9 * k)
      L.push(P(ombros, mat, { bisel: 0.9 * k, tom: 1.1, contorno: 0.3, semente: 7940 + i * 8 + j, projeta: { dist: 1.8 * k, forca: 0.34 } }))
      L.push(P(elipse(x, y, CABECA * k, CABECA * k), mat, { bisel: CABECA * k, tom: 1.32, contorno: 0.24, semente: 7990 + i * 8 + j }))
    }
  })
}
