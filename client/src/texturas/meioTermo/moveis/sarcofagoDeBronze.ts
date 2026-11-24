/**
 * SARCÓFAGO DE BRONZE (lote L05 de 24/11/2026, item 42: a "versão de metal" do túmulo de pedra que o dono pediu, da
 * cripta do mapa 8; desenho próprio, só a ideia do objeto). A arca de bronze fundido sobre o BASAMENTO baixo de lajes
 * de pedra, com a TAMPA ABAULADA no comprido: a lombada pega a luz numa faixa a um terço da esquerda e a metade da
 * direita escurece, como metal curvo. Um FRISO só em volta da tampa, os quatro CRAVOS dos cantos, o MEDALHÃO oval
 * na cabeceira com o ANEL liso e grosso de seis entalhes e o botão do meio, a PLACA do epitáfio no pé e as quatro
 * ALÇAS de argola, duas de cada lado comprido, fora da arca, com a sombra delas no basamento. A PÁTINA verde fica só
 * nos recessos: no pé do medalhão, no canto da placa e escorrida na beira da direita. A cabeceira é o lado de cima.
 *
 * Revisão do diretor de arte (24/11): era o túmulo de pedra pintado de bronze e, no tamanho de mesa, lia como porta
 * ou placa de parede. Saíram a moldura dupla (quatro retângulos concêntricos), as 14 folhas de louro (dentes de
 * engrenagem) e a pátina espalhada nos cantos; entraram a tampa abaulada e as alças.
 *
 * Na 3/4 é o túmulo de pedra: o basamento em quatro estruturas baixas em volta da arca (inteiro, ele seria pintado
 * depois da arca e cobriria a tampa), a arca é a coluna e a tampa é um tampo solto com a beirada
 * `ESPESSURA_DA_TAMPA_DO_SARCOFAGO_DE_BRONZE` (o perfil da 3/4 usa). As alças têm o meio da caixa dentro da tampa
 * (`comMeioEm`): sobem com ela e aparecem na beira de cima, e não deitadas no basamento.
 * Material: `pedra` (o basamento); o bronze e a pátina são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, caixa, capsula, dentroDe, elipse, elipseGirada, menos, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

/** O basamento (casas de altura) e o que ele sobra em volta da arca, dos lados, atrás e na frente (px). */
const ALTURA_DO_BASAMENTO = 0.08
const SOBRA = { lados: 6.5, tras: 5, frente: 7 } as const
/** Altura do alto da tampa (casas) e a grossura dela (px do protótipo): a beirada na 3/4. */
const ALTURA = 0.7
export const ESPESSURA_DA_TAMPA_DO_SARCOFAGO_DE_BRONZE = 0.14 * G
/** Quanto a tampa passa da arca, o friso (px da beira da tampa e largura) e o comprimento de uma laje (casas). */
const ABA = 1.7
const FRISO = 3
const LARGURA_DO_FRISO = 1.3
const LAJE = 0.5
const JUNTA = 0.8
/** A lombada: a fração da largura da tampa, a partir da esquerda, onde ela pega a luz, e o brilho dela. */
const LOMBADA = 1 / 3
const TOM_DA_LOMBADA = 1.25
const ALFA_DA_LOMBADA = 0.35
/** A largura da faixa de brilho (px): com 3 px, o borrão comia o brilho e ela clareava só 5%. */
const LARGURA_DA_LOMBADA = 5.6
/**
 * A metade da direita: 12% mais escura (o véu de bronze escuro a meia transparência), entrando num degradê de
 * `DEGRADE_DA_DIREITA` px em volta do meio. `NITIDEZ` afia o recorte do véu na beira da tampa (o borrão do véu só
 * vale para o degradê).
 */
const TOM_DO_VEU = 0.76
const ALFA_DO_VEU = 0.5
const DEGRADE_DA_DIREITA = 12
const NITIDEZ = 24
/** As alças: a posição ao longo da arca (fração do comprimento a partir do meio) e os raios da argola (px). */
const ALCAS: readonly number[] = [-0.3, 0.3]
const ARGOLA = { rx: 2.9, ry: 4.6, rxDentro: 1.5, ryDentro: 3.1 } as const
/** Os entalhes do anel do medalhão. */
const ENTALHES = 6
/**
 * O bronze fundido: marrom-dourado calmo (saturação HSV 0,50, abaixo do teto de 0,62), mais escuro e mais quente que
 * o latão das ferragens, para a peça grande não brilhar como ouro. O liso é o mesmo tom sem o grão do metal (os
 * véus de luz e sombra da tampa não somam um segundo grão).
 */
const BRONZE: MaterialDaPeca = { classe: 'metal', rgb: rgb('#8d6e47') }
const BRONZE_LISO: MaterialDaPeca = { classe: 'liso', rgb: BRONZE.rgb }
/** A pátina: verde-acinzentado (saturação 0,22), meio transparente por cima do bronze, só nos recessos. */
const PATINA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#6b8a77') }
const ALFA_DA_PATINA = 0.65
/** O musgo do basamento: o verde-oliva da lápide, um pouco mais escuro (o do túmulo de pedra). */
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do túmulo e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** A mesma forma com a caixa esticada até o meio dela cair em (cx, cy): muda só a estrutura da 3/4 em que ela sobe. */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const [x0, y0, x1, y1] = f.b
  const rx = Math.max(cx - x0, x1 - cx)
  const ry = Math.max(cy - y0, y1 - cy)
  return { b: [cx - rx, cy - ry, cx + rx, cy + ry], d: f.d }
}

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

  // As ALÇAS de argola, duas de cada lado comprido, por baixo da tampa (ela cobre a metade de dentro): de cima, cada
  // uma é um meio aro que sai da beira, com a sombra dele no basamento.
  for (const lado of [-1, 1]) {
    ALCAS.forEach((t, i) => {
      const y = (ay0 + ay1) / 2 + t * (ay1 - ay0)
      const argola = anel(lado * (tx1 + 0.2), y, ARGOLA.rx, ARGOLA.ry, ARGOLA.rxDentro, ARGOLA.ryDentro)
      L.push(P(comMeioEm(argola, lado * (tx1 - 3), y), BRONZE, { tabua: 0, bisel: 0.7, tom: 0.96, contorno: 0.32, projeta: { dist: 1, forca: 0.34 }, semente: 4232 + i + (lado > 0 ? 2 : 0) }))
    })
  }

  // A TAMPA abaulada: a laje de bronze, o friso, os cravos, a lombada clara e o véu escuro da metade da direita.
  const tampa = caixa(tx0, ty0, tx1, ty1, 1.2)
  cena.sombras.push({ forma: tampa, z: zTopo, solta: true, forca: 0.32 })
  L.push(P(tampa, BRONZE, { tabua: 0, bisel: 2.2, tom: 0.94, contorno: 0.32, semente: 4240 }))
  const fora = caixa(tx0 + FRISO, ty0 + FRISO, tx1 - FRISO, ty1 - FRISO, 1)
  const dentro = caixa(tx0 + FRISO + LARGURA_DO_FRISO, ty0 + FRISO + LARGURA_DO_FRISO, tx1 - FRISO - LARGURA_DO_FRISO, ty1 - FRISO - LARGURA_DO_FRISO, 0.7)
  L.push(P(menos(fora, dentro), BRONZE, { tabua: 0, bisel: 0.5, tom: 1.08, contorno: 0.2, projeta: { dist: 0.7, forca: 0.22 }, semente: 4241 }))
  const campo = FRISO + LARGURA_DO_FRISO
  for (const [cx, cy] of [[tx0 + campo + 3, ty0 + campo + 3], [tx1 - campo - 3, ty0 + campo + 3], [tx0 + campo + 3, ty1 - campo - 3], [tx1 - campo - 3, ty1 - campo - 3]] as const) {
    L.push(P(elipse(cx, cy, 2.1, 2.1), BRONZE, { tabua: 0, bisel: 1.1, tom: 1.16, contorno: 0.24, projeta: { dist: 0.6, forca: 0.24 }, semente: 4281 }))
    L.push(P(elipse(cx, cy, 0.65, 0.65), BRONZE, { tabua: 0, bisel: 0, tom: 0.55, contorno: 0, semente: 4282 }))
  }
  const xLombada = tx0 + (tx1 - tx0) * LOMBADA
  L.push(P(capsula(xLombada, ty0 + 6, xLombada, ty1 - 6, LARGURA_DA_LOMBADA / 2), BRONZE_LISO, { tabua: 0, bisel: 0, contorno: 0, tom: TOM_DA_LOMBADA, alfa: ALFA_DA_LOMBADA, suave: 3, semente: 4243 }))
  const xMeio = (tx0 + tx1) / 2
  const veu: Forma = { b: tampa.b, d: (x, y) => Math.max(tampa.d(x, y) * NITIDEZ, xMeio - x) }
  L.push(P(veu, BRONZE_LISO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.94 * TOM_DO_VEU, alfa: ALFA_DO_VEU, suave: DEGRADE_DA_DIREITA, semente: 4244 }))

  // O MEDALHÃO da cabeceira: a pátina no pé dele, o oval em relevo, o anel liso e grosso com os entalhes e o botão.
  const [fx0, fy0, fx1, fy1] = [tx0 + campo, ty0 + campo, tx1 - campo, ty1 - campo]
  const my = fy0 + (fy1 - fy0) * 0.25
  const rx = (fx1 - fx0) * 0.34
  const ry = rx * 1.18
  const patina = { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DA_PATINA, suave: 1.3 }
  L.push(P(dentroDe(anel(0.6, my + 0.9, rx + 1.4, ry + 1.4, rx - 1, ry - 1), caixa(-rx * 0.6, my + ry * 0.45, rx + 2, my + ry + 3)), PATINA, { ...patina, semente: 4250 }))
  L.push(P(elipse(0, my, rx, ry), BRONZE, { tabua: 0, bisel: 1.8, tom: 1.04, contorno: 0.26, projeta: { dist: 1.1, forca: 0.3 }, semente: 4260 }))
  const rAnel = rx * 0.62
  L.push(P(anel(0, my, rAnel, rAnel * 1.1, rAnel * 0.62, rAnel * 0.68), BRONZE, { tabua: 0, bisel: 1, tom: 1.14, contorno: 0.2, projeta: { dist: 0.6, forca: 0.24 }, semente: 4262 }))
  for (let k = 0; k < ENTALHES; k += 1) {
    const a = ((k + 0.5) / ENTALHES) * 2 * Math.PI
    const [ca, sa] = [Math.cos(a), Math.sin(a)]
    // O entalhe só morde a beira de fora do anel: cortando o anel de lado a lado, ele virava roda de leme.
    L.push(P(barra(ca * rAnel * 0.84, my + sa * rAnel * 0.92, ca * rAnel * 1.04, my + sa * rAnel * 1.14, 0.8), BRONZE, { tabua: 0, bisel: 0, tom: 0.6, contorno: 0, recesso: { k: 0.4, forca: 0.3 }, semente: 4263 + k }))
  }
  L.push(P(elipse(0, my, rx * 0.2, rx * 0.2), BRONZE, { tabua: 0, bisel: 1.1, tom: 1.22, contorno: 0.2, projeta: { dist: 0.5, forca: 0.22 }, semente: 4280 }))

  // A PLACA do epitáfio no pé: a pátina no canto dela, a tábua em relevo e duas linhas gastas.
  const py0 = fy1 - (fy1 - fy0) * 0.3
  const pw = (fx1 - fx0) * 0.33
  L.push(P(elipse(pw - 0.4, py0 + 10.3, 2.8, 1.6), PATINA, { ...patina, semente: 4284 }))
  L.push(P(caixa(-pw, py0, pw, py0 + 10, 0.6), BRONZE, { tabua: 0, bisel: 0.9, tom: 1.08, contorno: 0.22, projeta: { dist: 0.8, forca: 0.26 }, semente: 4283 }))
  const palavras: readonly (readonly [number, number, number, number])[] = [[-0.72, -0.18, 0.08, 0.7], [-0.6, 0.2, 0.34, 0.5]]
  palavras.forEach(([a0, a1, b0, b1], k) => {
    const y = py0 + 3.3 + k * 3.6
    const gravada = { tabua: 0, bisel: 0, contorno: 0, tom: 0.62, recesso: { k: 0.6, forca: 0.3 }, semente: 4285 + k }
    L.push(P(caixa(a0 * pw, y - 0.5, a1 * pw, y + 0.5, 0.3), BRONZE, gravada))
    L.push(P(caixa(b0 * pw, y - 0.5, b1 * pw, y + 0.5, 0.3), BRONZE, { ...gravada, alfa: 0.7 }))
  })

  // A pátina ESCORRIDA na beira da direita, do friso para baixo.
  L.push(P(elipseGirada(tx1 - 1.7, ty0 + (ty1 - ty0) * 0.56, 1, 7.5, 0.05), PATINA, { ...patina, alfa: ALFA_DA_PATINA * 0.92, suave: 1.1, semente: 4254 }))
}
