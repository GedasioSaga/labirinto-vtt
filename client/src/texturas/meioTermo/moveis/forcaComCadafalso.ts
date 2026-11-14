/**
 * FORCA de cima com volume (construção do lote L15, 14/11/2026, grupo Fortes
 * e castelos): o CADAFALSO de tábuas com a ESCADA de quatro degraus na frente,
 * à esquerda, o POSTE alto no fundo, a TRAVE que sai dele para a direita com a
 * MÃO-FRANCESA, e a CORDA com o LAÇO pendurada na ponta, em cima do ALÇAPÃO
 * (as tábuas mais escuras com a fresta em volta, as dobradiças e o ferrolho)
 * e a ALAVANCA que o solta.
 *
 * De cima: o tablado, a escada, o poste e a trave, e a corda com o laço
 * deitados da ponta da trave para a frente (de cima o laço pendurado seria um
 * ponto; deitado, é a corda com a argola que diz "forca"). A sombra do poste,
 * da trave e do laço é pintada no tablado (o Γ com a corda), e a do cadafalso
 * cai no chão.
 *
 * NA 3/4 (`tresQuartos.ts`, perfil derivado com a beirada
 * `ESPESSURA_DA_TRAVE_DA_FORCA`, a da trave):
 * - o cadafalso e cada degrau são colunas de tábuas; o poste é uma coluna do
 *   chão ao alto, pintada antes do tablado (fica no fundo dele): o tablado cobre
 *   o pé, e o poste sobe da beira de trás;
 * - a trave e os três tocos da mão-francesa são tampos soltos;
 * - a corda e o laço são peças deitadas na planta, levantadas por um PINO até o
 *   alto da trave: na 3/4 a corda deitada para a frente vira a corda caindo, e o
 *   laço, a argola pendurada no fim dela.
 *
 * Planta em fração da pegada (2 x 2 casas de partida), alturas em casas do
 * menor lado. Material: `madeira`; a corda, o ferro e o escuro são fixos.
 */
import { caixa, capsula, elipse, anel, type Forma } from './formas'
import { contato, texturaDaClasse, type OpcoesDaPeca } from './motor'
import { BURACO, G, materialDaPeca, PREGO, type MontarMovel } from './contexto'
import { arrastada, comMeioEm, crescida, pino, solta, texturaComSombra, type QueFazSombra } from './andaimeDaTresQuartos'

/** A espessura da trave (casas e px do protótipo): a beirada de todo tampo solto da forca. O perfil da 3/4 usa. */
const TRAVE_EM_CASAS = 0.12
export const ESPESSURA_DA_TRAVE_DA_FORCA = TRAVE_EM_CASAS * G

/** O tablado, em fração da meia pegada: meia largura, a beira de trás e a da frente. */
const TABLADO = { l: 0.92, tras: -0.66, frente: 0.48 }
/** A escada na frente, à esquerda: de onde a onde em x (fração) e quantos degraus. */
const ESCADA = { x0: -0.86, x1: -0.36 }
const DEGRAUS = 4
/** O poste (meio em fração da meia pegada, meio lado em casas), a trave (até onde vai, fração) e o laço (x, fração). */
const POSTE = { x: -0.56, y: -0.5, meio: 0.075 }
const PONTA_DA_TRAVE = 0.44
const LACO_X = 0.3
/** As alturas em casas: o tablado, o alto do poste (e da trave) e o pé do laço. */
const ALTURA_DO_TABLADO = 0.62
const ALTURA_DO_POSTE = 2.6
const ALTURA_DO_LACO = 1.5
/** O laço: os raios da argola (casas) e o da corda (px). */
const LACO = { rx: 0.075, ry: 0.11 }
const RAIO_DA_CORDA = 0.9
/** O alçapão: meia largura e meia profundidade em casas, e quanto o meio dele fica na frente do poste (debaixo do laço). */
const ALCAPAO = { l: 0.24, p: 0.2, frente: 0.08 }
/** O meio da caixa das peças do alçapão (casas na frente do poste): no tablado livre, longe da trave e do pino da corda. */
const MEIO_DO_ALCAPAO = 0.34
/** As tábuas do tablado e dos degraus (px). */
const TABUA = 7
/** A sombra no chão e a pintada no tablado. */
const FORCA_DA_SOMBRA = 0.32
const BORDA_DA_SOMBRA = 2.2
const BORDA_DA_SOMBRA_PINTADA = 1.3
const FORCA_DA_SOMBRA_PINTADA = 0.3

const CORDA = materialDaPeca('corda')
const DA_MADEIRA = texturaDaClasse('madeira')

export const montarForcaComCadafalso: MontarMovel = (c, cena) => {
  const P = c.peca
  const { hw, hh } = c
  const k = Math.min(hw, hh)
  const casas = (v: number): number => v * k
  const madeira = c.m.madeira
  const L = cena.partes
  const S = cena.sombras
  const daMadeira = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel: 1, contorno: 0.3, semente, ...mais })
  const e = ESPESSURA_DA_TRAVE_DA_FORCA
  const [zTablado, zPoste, zLaco] = [casas(ALTURA_DO_TABLADO), casas(ALTURA_DO_POSTE), casas(ALTURA_DO_LACO)]
  const [tx, tTras, tFrente] = [TABLADO.l * hw, TABLADO.tras * hh, TABLADO.frente * hh]
  const tablado = caixa(-tx, tTras, tx, tFrente)
  const [px, py, pm] = [POSTE.x * hw, POSTE.y * hh, casas(POSTE.meio)]
  const poste = caixa(px - pm, py - pm, px + pm, py + pm)
  const meiaTrave = casas(TRAVE_EM_CASAS) / 2
  const trave = caixa(px - pm - casas(0.06), py - meiaTrave, PONTA_DA_TRAVE * hw, py + meiaTrave)
  const xLaco = LACO_X * hw
  const yCorda = py + meiaTrave
  // A corda deitada para a frente tem o comprimento da queda dela: na 3/4 ela sobe com o pino até o alto da trave.
  const queda = zPoste - e - zLaco
  const [lrx, lry] = [casas(LACO.rx), casas(LACO.ry)]
  const yLaco = yCorda + queda + lry
  const maoFrancesa = [0, 1, 2].map((i) => {
    const lado = casas(0.1)
    const x = px + pm + lado * (i + 0.5)
    return { forma: caixa(x - lado / 2, py - meiaTrave * 0.8, x + lado / 2, py + meiaTrave * 0.8), z: zPoste - e * (3 - i) }
  })

  // ---------- as sombras no chão (o cadafalso, a escada e o poste) e as estruturas da 3/4 ----------
  S.push(contato(tablado, 0.36))
  S.push({ forma: arrastada(tablado, zTablado), z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })
  S.push({ forma: arrastada(poste, zPoste), z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })
  // O poste do chão ao alto: a base dele fica atrás da do tablado, e ele sai antes (o tablado cobre o pé).
  S.push({ forma: poste, z: zPoste, forca: 0 })
  S.push({ forma: tablado, z: zTablado, forca: 0 })
  const passo = (hh - tFrente) / DEGRAUS
  const [ex0, ex1] = [ESCADA.x0 * hw, ESCADA.x1 * hw]
  const degraus = Array.from({ length: DEGRAUS }, (_, i) => ({
    forma: caixa(ex0, tFrente + passo * i, ex1, tFrente + passo * (i + 1)),
    z: (zTablado * (DEGRAUS - i)) / (DEGRAUS + 1),
  }))
  for (const d of degraus) S.push({ forma: d.forma, z: d.z, suave: 1.6, forca: 0.26 })
  S.push(solta(trave, zPoste))
  for (const m of maoFrancesa) S.push(solta(m.forma, m.z))
  // O pino da corda e do laço: sai depois de tudo (a caixa crescida passa da frente da pegada).
  const pinoDaCorda = pino(xLaco, yCorda + queda / 2)
  S.push(solta(crescida(pinoDaCorda, 2 * hh), zPoste - e))

  // ---------- a sombra do poste, da trave, da corda e do laço, pintada no tablado ----------
  const alto = zPoste - zTablado
  const sombrasNoTablado: QueFazSombra[] = [
    { forma: poste, de: 0, ate: alto },
    { forma: trave, de: alto - e, ate: alto },
    ...maoFrancesa.map((m) => ({ forma: m.forma, de: m.z - zTablado - e, ate: m.z - zTablado })),
    { forma: elipse(xLaco, yCorda, RAIO_DA_CORDA, RAIO_DA_CORDA), de: zLaco - zTablado + 2 * lry, ate: alto - e },
    { forma: anel(xLaco, yCorda, lrx, lrx * 0.5, lrx - 1.4, lrx * 0.5 - 1.2), de: zLaco - zTablado, ate: zLaco - zTablado + 2 * lry },
  ]
  const comSombra = texturaComSombra(DA_MADEIRA, sombrasNoTablado, BORDA_DA_SOMBRA_PINTADA, FORCA_DA_SOMBRA_PINTADA)

  // ---------- o tablado de tábuas (com a sombra pintada) e o alçapão ----------
  L.push(P(comMeioEm(tablado, 0, (tTras + tFrente) / 2 + casas(0.3)), madeira, daMadeira(18600, { tabua: TABUA, bisel: 1.4, textura: comSombra })))
  const [al, ap] = [casas(ALCAPAO.l), casas(ALCAPAO.p)]
  const ay = py + casas(ALCAPAO.frente)
  // O alçapão fica debaixo do laço, e a trave passa por cima dele na planta: o meio da caixa vai para o tablado livre.
  const noTablado = (f: Forma): Forma => comMeioEm(f, xLaco, py + casas(MEIO_DO_ALCAPAO))
  L.push(P(noTablado(caixa(xLaco - al - 1.2, ay - ap - 1.2, xLaco + al + 1.2, ay + ap + 1.2, 0.6)), BURACO, { tabua: 0, bisel: 0, contorno: 0.2, tom: 0.7, semente: 18601 }))
  for (const lado of [-1, 1]) {
    const folha = caixa(lado < 0 ? xLaco - al : xLaco + 0.4, ay - ap, lado < 0 ? xLaco - 0.4 : xLaco + al, ay + ap, 0.5)
    L.push(P(noTablado(folha), madeira, daMadeira(18602 + lado, { tabua: TABUA, tom: 0.8, bisel: 0.8, textura: comSombra })))
    // As duas dobradiças de cada folha, na beira de fora.
    for (const dy of [-0.55, 0.55]) {
      const hx = lado < 0 ? xLaco - al + 1.5 : xLaco + al - 1.5
      L.push(P(noTablado(caixa(hx - 2.6, ay + dy * ap - 1, hx + 2.6, ay + dy * ap + 1, 0.4)), PREGO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.35, semente: 18606 + lado + dy }))
    }
  }
  // O ferrolho que segura as folhas e a alavanca que o puxa, ao lado do alçapão.
  L.push(P(noTablado(caixa(xLaco - 3, ay + ap * 0.2 - 0.8, xLaco + 3, ay + ap * 0.2 + 0.8, 0.4)), PREGO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.4, semente: 18610 }))
  const [lx, ly] = [xLaco + al + casas(0.16), ay + ap * 0.4]
  L.push(P(elipse(lx, ly, 2.2, 2.2), PREGO, { bisel: 1, contorno: 0.3, metal: 0.4, semente: 18611 }))
  L.push(P(capsula(lx, ly, lx + casas(0.12), ly - casas(0.2), 1.3), madeira, daMadeira(18612, { tabua: 0, tom: 1.08, projeta: { dist: 1.2, forca: 0.3 } })))

  // ---------- a escada: cada degrau com o meio nele ----------
  degraus.forEach((d, i) => {
    L.push(P(d.forma, madeira, daMadeira(18620 + i, { tabua: TABUA, tom: 0.98 - 0.04 * i, bisel: 1.2 })))
  })

  // ---------- o poste, a trave e a mão-francesa ----------
  L.push(P(comMeioEm(trave, (px + PONTA_DA_TRAVE * hw) / 2 + pm, py), madeira, daMadeira(18631, { tabua: 0, bisel: 1.4, tom: 1.04, projeta: { dist: 1.4, forca: 0.3 } })))
  // A cabeça do poste por cima da trave (o encaixe), com o prego.
  L.push(P(caixa(px - pm, py - pm, px + pm, py + pm, 1), madeira, daMadeira(18632, { tabua: 0, bisel: 1.6, tom: 0.98, polar: { cx: px, cy: py, r: pm } })))
  L.push(P(elipse(px, py, 1.2, 1.2), PREGO, { bisel: 0.8, contorno: 0.3, metal: 0.4, semente: 18633 }))

  // ---------- a corda e o laço, deitados da ponta da trave para a frente (o pino os sobe na 3/4) ----------
  const corda: Forma = capsula(xLaco, yCorda, xLaco, yLaco - lry, RAIO_DA_CORDA)
  L.push(P(comMeioEm(corda, xLaco, yCorda + queda / 2), CORDA, { bisel: RAIO_DA_CORDA, contorno: 0.34, eixo: Math.PI / 2, projeta: { dist: 1, forca: 0.32 }, semente: 18640 }))
  L.push(P(comMeioEm(anel(xLaco, yLaco, lrx, lry, lrx - 1.6, lry - 1.6), xLaco, yCorda + queda / 2), CORDA, { bisel: 0.9, contorno: 0.34, projeta: { dist: 1, forca: 0.32 }, semente: 18641 }))
  // O nó do laço: as voltas da corda em cima da argola.
  L.push(P(comMeioEm(caixa(xLaco - 1.6, yLaco - lry - 2.6, xLaco + 1.6, yLaco - lry + 0.6, 0.9), xLaco, yCorda + queda / 2), CORDA, { bisel: 0.9, contorno: 0.34, tom: 0.9, semente: 18642 }))
  // A volta da corda na trave.
  L.push(P(caixa(xLaco - 1.8, py - meiaTrave - 0.6, xLaco + 1.8, py + meiaTrave + 0.6, 0.8), CORDA, { bisel: 0.8, contorno: 0.32, semente: 18643 }))
}
