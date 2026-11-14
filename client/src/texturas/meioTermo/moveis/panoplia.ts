/**
 * PANÓPLIA (objetos de 14/11/2026, grupo Castelo: "escudo com duas espadas
 * cruzadas na parede"). EM PÉ, desenhada DE FRENTE nas duas vistas, como a
 * lápide: presa na parede, vista do alto ela seria um risco. A PAREDE é a beira
 * de cima da pegada (giro 0, como a tocha de parede); o giro deita a imagem.
 *
 * Duas ESPADAS em X, os punhos em cima (o pomo, o cabo de couro enrolado e a
 * guarda de metal) e as lâminas de aço com o sulco descendo para os cantos de
 * baixo; por cima delas, o ESCUDO redondo de tábuas pintadas, esquartelado
 * (dois quartos da cor do escudo, dois da cor do metal), com o aro, os rebites
 * e a bossa de metal no meio. O redondo com o X atrás é o que se lê a 1x; os
 * escudos de beira reta ficaram para os panos (o estandarte e a tapeçaria).
 * A sombra é rasa: tudo está colado na parede.
 *
 * Materiais: `escudo` (a cor da pintura, um tecido da tabela) e `metal` (as
 * guardas, os pomos, o aro, os rebites, a bossa e os quartos de metal). O aço
 * das lâminas e o couro dos cabos são fixos.
 */
import { anel, caixa, capsula, elipse, poligono, uniao, type Forma } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type MontarMovel } from './contexto'

/** O aço das lâminas, claro (o ferro da tabela é escuro como chapa velha), e o couro dos cabos. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0xad, 0xb2] }
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x3c, 0x2b] }

/** O pomo e a ponta de cada espada, em fração da pegada (a da esquerda; a outra é o espelho). */
const POMO: readonly [number, number] = [-0.4, -0.4]
const PONTA: readonly [number, number] = [0.43, 0.45]
/** Ao longo da espada (fração do comprimento): o fim do cabo (onde fica a guarda). */
const FIM_DO_CABO = 0.2
/** As grossuras, em fração do menor lado: o pomo, o cabo, a guarda (o comprimento e a grossura) e a lâmina na guarda. */
const RAIO_DO_POMO = 0.045
const MEIO_CABO = 0.022
const MEIA_GUARDA = 0.13
const MEIA_GROSSURA_DA_GUARDA = 0.02
const MEIA_LAMINA = 0.035
/** O escudo: o meio (fração da altura), o raio e o aro (fração do menor lado), e a bossa (fração do raio). */
const Y_DO_ESCUDO = 0.05
const RAIO_DO_ESCUDO = 0.3
const ARO = 0.03
const RAIO_DA_BOSSA = 0.27
const REBITES = 8
/** As tábuas do escudo (px do protótipo) e o enrolado do couro do cabo. */
const TABUA_DO_ESCUDO = 5
const PASSO_DO_ENROLADO = 1.6
/** O que está colado na parede faz pouca sombra: a altura dela (casas) e a força. */
const ALTURA_DA_SOMBRA = 0.05
const FORCA_DA_SOMBRA = 0.3

/** O couro enrolado do cabo: faixas de través a cada `PASSO_DO_ENROLADO` px ao longo dele. */
function texEnrolado(ax: number, ay: number, ux: number, uy: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = (x - ax) * ux + (y - ay) * uy
    const f = t / PASSO_DO_ENROLADO - Math.floor(t / PASSO_DO_ENROLADO)
    s[3] += f < 0.25 ? -0.14 : 0.03
  }
}

/** A pintura esquartelada: os quartos de cima à direita e de baixo à esquerda levam a cor do metal. */
function texEsquartelado(cx: number, cy: number, metal: MaterialDaPeca): Textura {
  const daMadeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if ((x > cx) !== (y > cy)) {
      s[0] = metal.rgb[0]
      s[1] = metal.rgb[1]
      s[2] = metal.rgb[2]
    }
    if (daMadeira !== null) daMadeira(u, v, x, y, p, s, escala)
  }
}

/** Uma espada do pomo (px, py) à ponta (tx, ty): pomo, cabo, guarda e lâmina com o sulco. */
function espada(px: number, py: number, tx: number, ty: number, w: number): { cabo: Forma; guarda: Forma; pomo: Forma; lamina: Forma; sulco: Forma; px: number; py: number; ux: number; uy: number } {
  const comp = Math.hypot(tx - px, ty - py)
  const ux = (tx - px) / comp
  const uy = (ty - py) / comp
  const [nx, ny] = [-uy, ux]
  const gx = px + ux * comp * FIM_DO_CABO
  const gy = py + uy * comp * FIM_DO_CABO
  const ml = MEIA_LAMINA * w
  const mg = MEIA_GUARDA * w
  const lamina = poligono([[gx + nx * ml, gy + ny * ml], [tx - ux * ml * 2.4 + nx * ml * 0.7, ty - uy * ml * 2.4 + ny * ml * 0.7], [tx, ty], [tx - ux * ml * 2.4 - nx * ml * 0.7, ty - uy * ml * 2.4 - ny * ml * 0.7], [gx - nx * ml, gy - ny * ml]])
  const sulco = capsula(gx + ux * ml * 1.6, gy + uy * ml * 1.6, gx + ux * comp * 0.55, gy + uy * comp * 0.55, ml * 0.22)
  const guarda = uniao(capsula(gx - nx * mg, gy - ny * mg, gx + nx * mg, gy + ny * mg, MEIA_GROSSURA_DA_GUARDA * w), elipse(gx, gy, ml * 1.3, ml * 1.3))
  return {
    cabo: capsula(px, py, gx, gy, MEIO_CABO * w),
    guarda,
    pomo: elipse(px, py, RAIO_DO_POMO * w, RAIO_DO_POMO * w),
    lamina,
    sulco,
    px,
    py,
    ux,
    uy,
  }
}

export const montarPanoplia: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  // As grossuras e o escudo saem do menor lado: a panóplia esticada abre o X das espadas, sem engrossá-las.
  const w = Math.min(c.w, c.h)
  const metal = c.m.metal
  const pintura: MaterialDaPeca = { classe: 'madeira', rgb: c.m.escudo.rgb }
  const L = cena.partes
  const cy = Y_DO_ESCUDO * c.h
  const r = RAIO_DO_ESCUDO * w
  const espadas = [-1, 1].map((lado) => espada(lado * POMO[0] * 2 * hw, POMO[1] * 2 * hh, lado * PONTA[0] * 2 * hw, PONTA[1] * 2 * hh, w))

  // A sombra rasa na parede: as lâminas, os cabos e o escudo, colados nela.
  for (const e of espadas) cena.sombras.push({ forma: uniao(e.lamina, e.cabo), z: g * ALTURA_DA_SOMBRA, forca: FORCA_DA_SOMBRA, suave: 1.2 })
  cena.sombras.push({ forma: elipse(0, cy, r, r), z: g * ALTURA_DA_SOMBRA * 1.4, forca: FORCA_DA_SOMBRA, suave: 1.6 }, contato(elipse(0, cy, r, r), 0.12))

  // As ESPADAS em X, por trás do escudo: a lâmina com o sulco, o cabo enrolado, a guarda e o pomo.
  for (const [i, e] of espadas.entries()) {
    const eixo = Math.atan2(e.uy, e.ux)
    L.push(P(e.lamina, ACO, { eixo, bisel: MEIA_LAMINA * w * 0.9, contorno: 0.28, metal: 0.6, semente: 160 + i * 6, projeta: { dist: 0.8, forca: 0.28 } }))
    L.push(P(e.sulco, ACO, { eixo, bisel: 0.4, tom: 0.78, contorno: 0, metal: 0.3, semente: 161 + i * 6 }))
    L.push(P(e.cabo, COURO, { eixo, bisel: MEIO_CABO * w * 0.8, contorno: 0.26, textura: texEnrolado(e.px, e.py, e.ux, e.uy), semente: 162 + i * 6 }))
    L.push(P(e.guarda, metal, { eixo: eixo + QUARTO, bisel: MEIA_GROSSURA_DA_GUARDA * w * 0.9, contorno: 0.28, metal: 0.55, semente: 163 + i * 6, projeta: { dist: 0.8, forca: 0.3 } }))
    L.push(P(e.pomo, metal, { bisel: RAIO_DO_POMO * w * 0.7, contorno: 0.28, metal: 0.6, semente: 164 + i * 6 }))
  }

  // O ESCUDO: as tábuas pintadas esquarteladas, o aro, os rebites e a bossa.
  L.push(P(elipse(0, cy, r, r), pintura, { eixo: QUARTO, tabua: TABUA_DO_ESCUDO, bisel: 1.4, contorno: 0.28, textura: texEsquartelado(0, cy, metal), semente: 175, projeta: { dist: 1.4, forca: 0.34, suave: 0.8 } }))
  const aro = ARO * w
  L.push(P(anel(0, cy, r, r, r - aro, r - aro), metal, { bisel: aro * 0.6, contorno: 0.28, metal: 0.5, semente: 176 }))
  for (let i = 0; i < REBITES; i += 1) {
    const a = (i * 2 * Math.PI) / REBITES + Math.PI / REBITES
    const rr = r - aro * 2.4
    L.push(P(elipse(Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.8, 0.8), metal, { bisel: 0.6, contorno: 0.2, metal: 0.5, semente: 177 + i }))
  }
  const rb = RAIO_DA_BOSSA * r
  L.push(P(elipse(0, cy, rb * 1.25, rb * 1.25), metal, { bisel: 0.8, tom: 0.85, contorno: 0.26, semente: 186 }))
  L.push(P(elipse(0, cy, rb, rb), metal, { bisel: rb * 0.85, contorno: 0.26, metal: 0.65, semente: 187, projeta: { dist: 1, forca: 0.3 } }))
  // Um ponto na tábua de cima, onde o escudo pendura no prego da parede.
  L.push(P(caixa(-0.9, cy - r - 1.2, 0.9, cy - r + 0.8, 0.4), metal, { bisel: 0.5, tom: 0.8, contorno: 0.2, semente: 188 }))
}
