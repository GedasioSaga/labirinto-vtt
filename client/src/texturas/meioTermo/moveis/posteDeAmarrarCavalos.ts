/**
 * POSTE DE AMARRAR CAVALOS de cima com volume (lote L13 dos objetos novos,
 * 14/11/2026, grupo Cidade e vila): a trave de amarrar da frente da taverna
 * ou da estalagem. Os POSTES roliços, com o topo cortado (os anéis da
 * madeira), e a TRAVE de tronco deitada em cima deles, passando um pouco das
 * pontas; na trave, as ARGOLAS de ferro presas por grampos e caídas para a
 * frente, e numa delas a CORDA de cabresto enrolada na trave, com o nó e a
 * ponta solta. No chão, a FERRADURA perdida e os fiapos de PALHA que os
 * cavalos espalharam.
 *
 * O que diz "amarrar cavalos" e não "cerca" a 25% de zoom é o conjunto: a
 * trave clara e grossa sobre dois postes, curta, com a corda clara enrolada,
 * as argolas escuras e a ferradura no chão; e a sombra comprida da trave, que
 * diz que ela está no alto.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) os postes são colunas e a trave, um
 * tampo solto na altura deles, com a beirada da grossura do tronco
 * (`ESPESSURA_DA_TRAVE_DE_AMARRAR`). As argolas e a corda têm a caixa com o
 * meio na trave (`comMeioEm`), para subirem com ela. A palha e a ferradura
 * ficam no chão.
 *
 * Esticado ao comprido, ganha mais postes (um a cada `VAO_ENTRE_POSTES`
 * casas), nunca postes mais grossos. Material: `madeira` (os postes e a
 * trave). O ferro, a corda e a palha são fixos.
 */
import { hash, rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, caixa, capsula, elipse, elipseGirada, menos, type Forma } from './formas'
import { contato, ruido, TOM_DA_CORDA, type MaterialDaPeca, type Textura } from './motor'
import { G, materialDaPeca, type MontarMovel } from './contexto'

// ---------- as medidas, em casas ----------

/** O raio do poste e o da trave (o tronco deitado); mais fina, a trave virava um palito no tamanho de mesa. */
const RAIO_DO_POSTE = 0.105
const RAIO_DA_TRAVE = 0.075
/** Um poste a cada tanto de casa, ao comprido; quanto a trave passa do último poste. */
const VAO_ENTRE_POSTES = 1.6
const SOBRA_DA_TRAVE = 0.12
/** A linha da trave, em fração da meia altura (um pouco ao norte: a frente fica para as argolas e a palha). */
const LINHA_DA_TRAVE = -0.12
/** As alturas: o alto dos postes, onde a trave assenta. */
const ALTURA_DO_POSTE = 0.68
/** A beirada da trave na 3/4 (px do protótipo): a grossura do tronco. */
export const ESPESSURA_DA_TRAVE_DE_AMARRAR = RAIO_DA_TRAVE * 2 * G
/** As argolas, em casas: o raio de fora e o de dentro, e o quanto caem para a frente da trave. */
const RAIO_DA_ARGOLA = 0.06
const RAIO_DE_DENTRO_DA_ARGOLA = 0.038
const QUEDA_DA_ARGOLA = 0.085
/** Onde ficam as argolas ao longo da trave (fração do vão entre os dois primeiros postes). */
const ARGOLAS: readonly number[] = [0.3, 0.7]
/** As voltas da corda em volta da trave e a ponta solta (casas). */
const VOLTAS_DA_CORDA = 3
const PASSO_DA_VOLTA = 0.045
const PONTA_DA_CORDA = 0.13

// ---------- os materiais fixos ----------

const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.86)) }
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
const PALHA = materialDaPeca('palha')

/**
 * Os fiapos de palha no chão, em dois tufos (onde os cavalos comeram) e alguns soltos: o meio (frações da meia
 * pegada), o comprimento (casas) e o ângulo. Soltos e iguais, saíam como palitos de fósforo.
 */
const FIAPOS: readonly (readonly [number, number, number, number])[] = [
  [-0.52, 0.6, 0.15, 0.3],
  [-0.49, 0.66, 0.12, -0.4],
  [-0.46, 0.58, 0.13, 0.9],
  [-0.55, 0.7, 0.1, 2.5],
  [-0.43, 0.68, 0.09, -1.2],
  [0.4, 0.64, 0.14, -0.2],
  [0.44, 0.7, 0.12, 0.5],
  [0.37, 0.72, 0.1, 2.9],
  [0.47, 0.6, 0.09, 1.4],
  [-0.05, 0.74, 0.09, 0.2],
  [0.12, 0.56, 0.08, 2.2],
]
/** A grossura do fiapo (px do protótipo) e a faixa de tom: palha seca, entre o claro e o mais escuro. */
const RAIO_DO_FIAPO = 0.42
const TOM_DO_FIAPO = 0.82
const VARIACAO_DO_FIAPO = 0.18

/** O topo cortado do poste: os anéis em volta do meio (a regra do mourão da cerca). */
function texTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const raio = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.2
    s[3] += Math.sin(raio * 4.2) * 0.035 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.07
  }
}

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 sobe a peça com a estrutura que contém esse ponto. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

export const montarPosteDeAmarrarCavalos: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const rp = RAIO_DO_POSTE * g
  const rt = RAIO_DA_TRAVE * g
  const y = LINHA_DA_TRAVE * hh
  const pontaDaTrave = hw - 0.6
  const ultimoPoste = pontaDaTrave - SOBRA_DA_TRAVE * g
  const vaos = Math.max(1, Math.round((ultimoPoste * 2) / (VAO_ENTRE_POSTES * g)))
  const postes = Array.from({ length: vaos + 1 }, (_, i) => -ultimoPoste + (i * ultimoPoste * 2) / vaos)
  const zPoste = ALTURA_DO_POSTE * g
  const trave = capsula(-pontaDaTrave + rt, y, pontaDaTrave - rt, y, rt)

  // ---------- as sombras: os postes, a trave no alto e o contato ----------
  for (const px of postes) cena.sombras.push({ forma: elipse(px, y, rp, rp), z: zPoste, forca: 0.3 }, contato(elipse(px, y, rp, rp), 0.34))
  cena.sombras.push({ forma: trave, z: zPoste, solta: true, forca: 0.28 })

  // ---------- no chão: a palha espalhada e a ferradura perdida ----------
  FIAPOS.forEach(([fx, fy, comp, ang], k) => {
    const meio = (comp * g) / 2
    const x = fx * hw
    const yy = fy * hh
    const fiapo = capsula(x - Math.cos(ang) * meio, yy - Math.sin(ang) * meio, x + Math.cos(ang) * meio, yy + Math.sin(ang) * meio, RAIO_DO_FIAPO)
    L.push(P(fiapo, PALHA, { eixo: ang, bisel: 0.4, contorno: 0.16, tom: TOM_DO_FIAPO + hash(k, 3, 7201) * VARIACAO_DO_FIAPO, semente: 7210 + k }))
  })
  const fx = -hw * 0.3
  const fy = hh * 0.62
  const ferradura = menos(anel(fx, fy, 0.085 * g, 0.075 * g, 0.05 * g, 0.042 * g), caixa(fx - 0.03 * g, fy - 0.1 * g, fx + 0.03 * g, fy - 0.02 * g))
  cena.sombras.push(contato(ferradura, 0.3))
  L.push(P(ferradura, FERRO, { tabua: 0, bisel: 0.9, tom: 0.95, contorno: 0.34, metal: 0.3, semente: 7220 }))
  for (const [ux, uy] of [[-0.062, 0.02], [0.062, 0.02], [-0.045, -0.04], [0.045, -0.04]] as const) {
    L.push(P(elipse(fx + ux * g, fy + uy * g, 0.5, 0.5), FERRO, { bisel: 0.4, contorno: 0.3, tom: 0.6, semente: 7221 }))
  }

  // ---------- os postes: a casca roliça e o topo cortado ----------
  postes.forEach((px, i) => {
    L.push(P(elipse(px, y, rp, rp), mad, { polar: { cx: px, cy: y, r: rp }, tabua: 2.4, bisel: 1.2, tom: 0.7, contorno: 0.3, semente: 7230 + i }))
    L.push(P(elipse(px, y, rp * 0.8, rp * 0.8), mad, { textura: texTopo(px, y), bisel: 0.9, tom: 1.04, semente: 7240 + i }))
  })

  // ---------- a trave: o tronco deitado em cima dos postes, com os topos cortados nas pontas ----------
  L.push(P(trave, mad, { tabua: 0, bisel: rt * 0.9, tom: 0.96, contorno: 0.3, semente: 7250, projeta: { dist: 1.8, forca: 0.4 } }))
  for (const lado of [-1, 1]) {
    const px = lado * (pontaDaTrave - rt * 0.55)
    L.push(P(elipseGirada(px, y, rt * 0.5, rt * 0.86, 0), mad, { textura: texTopo(px, y), bisel: 0.6, tom: 1.12, contorno: 0.2, semente: 7255 + lado }))
  }

  // ---------- as argolas de ferro, caídas para a frente da trave, com o grampo em cima ----------
  const x0 = postes[0]
  const x1 = postes[1]
  ARGOLAS.forEach((f, k) => {
    const ax = x0 + (x1 - x0) * f
    const ay = y + QUEDA_DA_ARGOLA * g
    const argola = anel(ax, ay, RAIO_DA_ARGOLA * g, RAIO_DA_ARGOLA * g * 0.82, RAIO_DE_DENTRO_DA_ARGOLA * g, RAIO_DE_DENTRO_DA_ARGOLA * g * 0.78)
    L.push(P(comMeioEm(argola, ax, y), FERRO, { tabua: 0, bisel: 0.9, tom: 0.92, contorno: 0.34, metal: 0.32, semente: 7260 + k, projeta: { dist: 1.4, forca: 0.4 } }))
    L.push(P(caixa(ax - 1.6, y - rt * 0.5, ax + 1.6, y + rt * 0.9, 0.6), FERRO, { tabua: 0, bisel: 0.6, tom: 0.8, contorno: 0.34, metal: 0.3, semente: 7265 + k }))
  })

  // ---------- a corda de cabresto enrolada na trave, junto da segunda argola, com o nó e a ponta solta ----------
  const cx = x0 + (x1 - x0) * ARGOLAS[1] + 0.09 * g
  const passo = PASSO_DA_VOLTA * g
  for (let v = 0; v < VOLTAS_DA_CORDA; v += 1) {
    const vx = cx + v * passo
    L.push(P(capsula(vx - rt * 0.5, y - rt * 1.05, vx + rt * 0.5, y + rt * 1.05, 1.3), CORDA, { eixo: 1.1, bisel: 1.2, contorno: 0.24, tom: 1 - v * 0.03, semente: 7270 + v, projeta: { dist: 0.8, forca: 0.3 } }))
  }
  const noX = cx + VOLTAS_DA_CORDA * passo
  const ponta = capsula(noX, y + rt * 0.6, noX + PONTA_DA_CORDA * g * 0.4, y + rt + PONTA_DA_CORDA * g, 1.2)
  L.push(P(comMeioEm(ponta, noX, y), CORDA, { eixo: 1.2, bisel: 1.1, contorno: 0.24, tom: 0.94, semente: 7275, projeta: { dist: 1.2, forca: 0.35 } }))
  L.push(P(elipse(noX, y + rt * 0.35, 2.1, 1.8), CORDA, { bisel: 1.6, contorno: 0.26, tom: 1.04, ruga: 0.3, semente: 7276 }))
}
