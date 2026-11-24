/**
 * SARCÓFAGO DE BRONZE (lote L05 de 24/11/2026, item 42: a "versão de metal" do túmulo de pedra que o dono pediu, da
 * cripta do mapa 8; desenho próprio, só a ideia do objeto). A forma do túmulo (`tumuloDePedra.ts`): o BASAMENTO de
 * lajes de pedra, a ARCA e a TAMPA grossa que passa um pouco dela, agora de bronze fundido. Na tampa, a MOLDURA em
 * relevo em volta do campo rebaixado, o MEDALHÃO oval na cabeceira com a coroa de louro e o botão do meio, os quatro
 * CRAVOS dos cantos e a PLACA do epitáfio no pé, com as letras gastas. A PÁTINA verde, contida, junta nos cantos do
 * campo, no pé do medalhão e da placa e escorre pela beira da direita; onde a mão passa (a moldura do lado da luz),
 * o bronze fica mais claro. A cabeceira é o lado de cima da pegada.
 *
 * Na 3/4 é o túmulo de pedra: o basamento em quatro estruturas baixas em volta da arca (inteiro, ele seria pintado
 * depois da arca e cobriria a tampa), a arca é a coluna e a tampa é um tampo solto com a beirada
 * `ESPESSURA_DA_TAMPA_DO_SARCOFAGO_DE_BRONZE` (o perfil da 3/4 usa).
 * Material: `pedra` (o basamento); o bronze e a pátina são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, caixa, elipse, elipseGirada, menos } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

/** O basamento (casas de altura) e o que ele sobra em volta da arca, dos lados, atrás e na frente (px). */
const ALTURA_DO_BASAMENTO = 0.08
const SOBRA = { lados: 5, tras: 5, frente: 7 } as const
/** Altura do alto da tampa (casas) e a grossura dela (px do protótipo): a beirada na 3/4. */
const ALTURA = 0.7
export const ESPESSURA_DA_TAMPA_DO_SARCOFAGO_DE_BRONZE = 0.14 * G
/** Quanto a tampa passa da arca, a moldura em relevo (de fora e de dentro) e o comprimento de uma laje (casas). */
const ABA = 1.7
const MOLDURA_FORA = 2
const MOLDURA_DENTRO = 5.4
const LAJE = 0.5
const JUNTA = 0.8
/**
 * O bronze fundido: marrom-dourado calmo (saturação HSV 0,50, abaixo do teto de 0,62), mais escuro e mais quente que
 * o latão das ferragens, para a peça grande não brilhar como ouro.
 */
const BRONZE: MaterialDaPeca = { classe: 'metal', rgb: rgb('#8d6e47') }
/** A pátina: verde-acinzentado (saturação 0,22), meio transparente por cima do bronze. */
const PATINA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#6b8a77') }
/** O musgo do basamento: o verde-oliva da lápide, um pouco mais escuro (o do túmulo de pedra). */
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do túmulo e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

export const montarSarcofagoDeBronze: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const zBase = g * ALTURA_DO_BASAMENTO
  const zTopo = g * ALTURA
  const zArca = zTopo - ESPESSURA_DA_TAMPA_DO_SARCOFAGO_DE_BRONZE

  const [ax0, ay0, ax1, ay1] = [-hw + SOBRA.lados, -hh + SOBRA.tras, hw - SOBRA.lados, hh - SOBRA.frente]
  const [tx0, ty0, tx1, ty1] = [ax0 - ABA, ay0 - ABA, ax1 + ABA, ay1 + ABA]

  // O BASAMENTO de pedra: a fileira de trás, os dois braços e a fileira da frente, cada trecho com as lajes dele.
  cena.sombras.push(contato(caixa(-hw, -hh, hw, hh, 1), 0.3))
  const trechos: readonly (readonly [number, number, number, number])[] = [
    [-hw + 0.5, -hh + 0.5, hw - 0.5, ty0],
    [-hw + 0.5, ty0, tx0, ty1],
    [tx1, ty0, hw - 0.5, ty1],
    [-hw + 0.5, ty1, hw - 0.5, hh - 0.5],
  ]
  trechos.forEach(([x0, y0, x1, y1], t) => {
    const trecho = caixa(x0, y0, x1, y1)
    cena.sombras.push({ forma: trecho, z: zBase })
    L.push(P(trecho, pedra, { tabua: 0, bisel: 0.6, tom: 0.56, contorno: 0.24, semente: 4200 + t }))
    const comprido = y1 - y0 > x1 - x0
    const lajes = Math.max(1, Math.round((comprido ? y1 - y0 : x1 - x0) / (LAJE * g)))
    for (let i = 0; i < lajes; i += 1) {
      const [a, b] = comprido ? [y0 + ((y1 - y0) * i) / lajes, y0 + ((y1 - y0) * (i + 1)) / lajes] : [x0 + ((x1 - x0) * i) / lajes, x0 + ((x1 - x0) * (i + 1)) / lajes]
      const laje = comprido ? caixa(x0 + JUNTA / 2, a + JUNTA / 2, x1 - JUNTA / 2, b - JUNTA / 2, 0.6) : caixa(a + JUNTA / 2, y0 + JUNTA / 2, b - JUNTA / 2, y1 - JUNTA / 2, 0.6)
      L.push(P(laje, pedra, { tabua: 0, bisel: 0.9, tom: 0.8 + 0.12 * hash(i, t, 4210), contorno: 0.22, semente: 4211 + t * 7 + i }))
    }
  })
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9, semente: 4290 }
  L.push(P(elipse(-hw + 3, hh - 3.2, 2.6, 1.8), MUSGO, musgo))
  L.push(P(elipse(hw - 2.4, -hh + 8, 1.5, 2.8), MUSGO, { ...musgo, alfa: 0.5, semente: 4291 }))

  // A ARCA de bronze: a coluna (de cima a tampa a cobre; na 3/4 é a frente).
  const arca = caixa(ax0, ay0, ax1, ay1, 0.8)
  cena.sombras.push({ forma: arca, z: zArca })
  L.push(P(arca, BRONZE, { tabua: 0, bisel: 1, tom: 0.84, contorno: 0.28, semente: 4230 }))

  // A TAMPA: a laje de bronze, a moldura em relevo e o campo rebaixado.
  const tampa = caixa(tx0, ty0, tx1, ty1, 1.2)
  cena.sombras.push({ forma: tampa, z: zTopo, solta: true, forca: 0.32 })
  L.push(P(tampa, BRONZE, { tabua: 0, bisel: 2.2, tom: 0.94, contorno: 0.32, semente: 4240 }))
  const fora = caixa(tx0 + MOLDURA_FORA, ty0 + MOLDURA_FORA, tx1 - MOLDURA_FORA, ty1 - MOLDURA_FORA, 1)
  const [fx0, fy0, fx1, fy1] = [tx0 + MOLDURA_DENTRO, ty0 + MOLDURA_DENTRO, tx1 - MOLDURA_DENTRO, ty1 - MOLDURA_DENTRO]
  const campo = caixa(fx0, fy0, fx1, fy1, 0.6)
  L.push(P(menos(fora, campo), BRONZE, { tabua: 0, bisel: 1.1, tom: 1.1, contorno: 0.22, projeta: { dist: 0.9, forca: 0.26 }, semente: 4241 }))
  L.push(P(campo, BRONZE, { tabua: 0, bisel: 0.5, tom: 0.82, contorno: 0.18, recesso: { k: 1.3, forca: 0.3 }, semente: 4242 }))

  // A PÁTINA do campo: nos quatro cantos e na beira da direita, por baixo do relevo.
  const patina = { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, suave: 1.6, semente: 4250 }
  L.push(P(elipse(fx0 + 2.4, fy0 + 2.2, 3.4, 2.6), PATINA, patina))
  L.push(P(elipse(fx1 - 2, fy0 + 2.6, 2.6, 3.2), PATINA, { ...patina, alfa: 0.42, semente: 4251 }))
  L.push(P(elipse(fx0 + 2.2, fy1 - 2.8, 3, 3.6), PATINA, { ...patina, alfa: 0.48, semente: 4252 }))
  L.push(P(elipse(fx1 - 2.4, fy1 - 2.4, 3.8, 3), PATINA, { ...patina, alfa: 0.55, semente: 4253 }))
  L.push(P(elipseGirada(tx1 - 1.2, (ty0 + ty1) / 2 + 9, 1.3, 9, 0.04), PATINA, { ...patina, alfa: 0.4, suave: 1.2, semente: 4254 }))

  // O MEDALHÃO da cabeceira: o oval em relevo, a coroa de louro (o anel e as folhas) e o botão do meio.
  const my = fy0 + (fy1 - fy0) * 0.27
  const rx = (fx1 - fx0) * 0.34
  const ry = rx * 1.18
  L.push(P(elipse(0, my, rx, ry), BRONZE, { tabua: 0, bisel: 1.8, tom: 1.06, contorno: 0.26, projeta: { dist: 1.1, forca: 0.3 }, semente: 4260 }))
  L.push(P(elipse(rx * 0.25, my + ry * 0.62, rx * 0.7, ry * 0.32), PATINA, { ...patina, alfa: 0.4, semente: 4261 }))
  const rCoroa = rx * 0.64
  L.push(P(anel(0, my, rCoroa, rCoroa * 1.1, rCoroa * 0.78, rCoroa * 0.88), BRONZE, { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.16, semente: 4262 }))
  const folhas = 14
  for (let k = 0; k < folhas; k += 1) {
    const a = (k / folhas) * 2 * Math.PI
    L.push(P(elipseGirada(Math.cos(a) * rCoroa * 0.9, my + Math.sin(a) * rCoroa * 0.99, rx * 0.17, rx * 0.075, a + 0.75), BRONZE, { tabua: 0, bisel: 0.5, tom: 1.2, contorno: 0.16, semente: 4263 + k }))
  }
  L.push(P(elipse(0, my, rx * 0.24, rx * 0.24), BRONZE, { tabua: 0, bisel: 1.2, tom: 1.24, contorno: 0.2, projeta: { dist: 0.5, forca: 0.22 }, semente: 4280 }))

  // Os CRAVOS dos cantos do campo: o botão e o furo do meio.
  for (const [cx, cy] of [[fx0 + 3.6, fy0 + 3.6], [fx1 - 3.6, fy0 + 3.6], [fx0 + 3.6, fy1 - 3.6], [fx1 - 3.6, fy1 - 3.6]] as const) {
    L.push(P(elipse(cx, cy, 2.3, 2.3), BRONZE, { tabua: 0, bisel: 1.2, tom: 1.2, contorno: 0.24, projeta: { dist: 0.6, forca: 0.24 }, semente: 4281 }))
    L.push(P(elipse(cx, cy, 0.7, 0.7), BRONZE, { tabua: 0, bisel: 0, tom: 0.55, contorno: 0, semente: 4282 }))
  }

  // A PLACA do epitáfio no pé: a tábua em relevo, a pátina no pé dela e duas linhas gastas.
  const py0 = fy1 - (fy1 - fy0) * 0.3
  const pw = (fx1 - fx0) * 0.33
  L.push(P(caixa(-pw, py0, pw, py0 + 10, 0.6), BRONZE, { tabua: 0, bisel: 0.9, tom: 1.08, contorno: 0.22, projeta: { dist: 0.8, forca: 0.26 }, semente: 4283 }))
  L.push(P(elipse(pw * 0.4, py0 + 10.6, pw * 0.8, 1.8), PATINA, { ...patina, alfa: 0.45, semente: 4284 }))
  const palavras: readonly (readonly [number, number, number, number])[] = [[-0.72, -0.18, 0.08, 0.7], [-0.6, 0.2, 0.34, 0.5]]
  palavras.forEach(([a0, a1, b0, b1], k) => {
    const y = py0 + 3.3 + k * 3.6
    const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.62, recesso: { k: 0.6, forca: 0.3 }, semente: 4285 + k }
    L.push(P(caixa(a0 * pw, y - 0.5, a1 * pw, y + 0.5, 0.3), BRONZE, gravada))
    L.push(P(caixa(b0 * pw, y - 0.5, b1 * pw, y + 0.5, 0.3), BRONZE, { ...gravada, alfa: 0.7 }))
  })

  // O BRILHO de mão na moldura do lado da luz (de cima, à esquerda).
  L.push(P(elipseGirada(tx0 + 3.6, (ty0 + ty1) / 2 - 18, 1.1, 10, 0), BRONZE, { tabua: 0, bisel: 0, contorno: 0, tom: 1.34, alfa: 0.4, suave: 1.2, semente: 4289 }))
}
