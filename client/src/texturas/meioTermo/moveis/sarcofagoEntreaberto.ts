/**
 * SARCÓFAGO ENTREABERTO (lote L05 de 24/11/2026, item 41: a versão do túmulo de pedra da cripta do mapa 8; desenho
 * próprio, só a ideia do objeto). A arca de pedra com a TAMPA empurrada na diagonal: ela deslizou para o pé e um
 * tico para a direita e girou um pouco, então na cabeceira abre a FRESTA escura em cunha, mais larga à esquerda,
 * com a borda da arca à vista em volta e dois fios de teia de uma beira à outra. No pé e à direita a tampa passa da
 * arca e faz sombra no chão. Na tampa, dentro da moldura chanfrada, a ESPADA esculpida ao comprido (o punho na
 * cabeceira, a ponta no pé), as quatro rosetas dos cantos, a quina partida perto da fresta e uma trinca; no chão,
 * as lascas que a tampa arrancou ao raspar.
 *
 * Sem o basamento do túmulo: a tampa que passa da arca cairia em cima dele, e as lajes debaixo dela subiriam com a
 * tampa na 3/4.
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura; cada peça sobe com a estrutura mais alta que
 * contém o meio da caixa dela):
 * - a ARCA é a coluna. O tampo dela (a borda e o fundo escuro) é UMA peça cada, com a caixa esticada para cima até o
 *   meio dela cair na fresta, fora da tampa (`comMeioEm`): assim sobe com a arca, e não com a tampa, e a fresta fica
 *   na altura certa. A parte coberta pela tampa some debaixo dela nas duas vistas;
 * - a TAMPA é um tampo solto com a beirada `ESPESSURA_DA_TAMPA_DO_SARCOFAGO` (o perfil da 3/4 usa).
 * Material: `pedra`. O fundo, a teia e o musgo são fixos.
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

/** Altura do alto da tampa (casas) e a grossura dela (px do protótipo): a beirada na 3/4. */
const ALTURA = 0.68
export const ESPESSURA_DA_TAMPA_DO_SARCOFAGO = 0.1 * G
/** A arca dentro da pegada (px): sobra mais à direita e no pé, onde a tampa empurrada passa dela. */
const SOBRA = { esquerda: 6.5, direita: 8, tras: 4, frente: 22 } as const
/** A grossura da parede da arca (px): a borda que aparece em volta da fresta. */
const PAREDE = 4.2
/** Quanto a tampa passa da arca para os quatro lados, antes de deslizar (px). */
const ABA = 1.6
/** O deslize da tampa (px, a partir do meio da arca) e o giro dela (radianos: a cabeceira desce à esquerda). */
const DESLIZE: Ponto = [2.2, 14.5]
const GIRO_DA_TAMPA = -0.07
/** A moldura chanfrada da tampa e a quina partida dela (px). */
const MOLDURA = 3.4
const QUINA = 5
/** O fundo da arca: o escuro frio da pedra, que o piso de luz segura. */
const FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x36, 0x33] }
/** A teia: fios claros e finos, meio transparentes. */
const TEIA: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xd2, 0xc8] }
/** O musgo: o verde-oliva da lápide, um pouco mais escuro (o do túmulo de pedra). */
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do túmulo e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/**
 * A mesma forma com a caixa esticada até o meio dela cair em (cx, cy). A caixa só limita onde a peça é pintada (a
 * distância decide o resto), então a imagem não muda; muda a estrutura da 3/4 em que a peça sobe.
 */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const [x0, y0, x1, y1] = f.b
  const rx = Math.max(cx - x0, x1 - cx)
  const ry = Math.max(cy - y0, y1 - cy)
  return { b: [cx - rx, cy - ry, cx + rx, cy + ry], d: f.d }
}

export const montarSarcofagoEntreaberto: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const zTopo = g * ALTURA
  const zArca = zTopo - ESPESSURA_DA_TAMPA_DO_SARCOFAGO

  // A arca e o fundo dela.
  const [ax0, ay0, ax1, ay1] = [-hw + SOBRA.esquerda, -hh + SOBRA.tras, hw - SOBRA.direita, hh - SOBRA.frente]
  const arca = caixa(ax0, ay0, ax1, ay1, 1)
  const oco = caixa(ax0 + PAREDE, ay0 + PAREDE, ax1 - PAREDE, ay1 - PAREDE, 0.8)

  // A tampa: o retângulo da arca mais a aba, deslizado e girado. (u, v) = através e ao longo, a partir do meio dela.
  const meiaL = (ax1 - ax0) / 2 + ABA
  const meioC = (ay1 - ay0) / 2 + ABA
  const tcx = (ax0 + ax1) / 2 + DESLIZE[0]
  const tcy = (ay0 + ay1) / 2 + DESLIZE[1]
  const cos = Math.cos(GIRO_DA_TAMPA)
  const sin = Math.sin(GIRO_DA_TAMPA)
  const na = (u: number, v: number): Ponto => [tcx + u * cos - v * sin, tcy + u * sin + v * cos]
  const retanguloNaTampa = (u0: number, v0: number, u1: number, v1: number): Forma => poligono([na(u0, v0), na(u1, v0), na(u1, v1), na(u0, v1)])
  const tampa = poligono([na(-meiaL + QUINA, -meioC), na(meiaL, -meioC), na(meiaL, meioC), na(-meiaL, meioC), na(-meiaL, -meioC + QUINA * 0.8), na(-meiaL + QUINA * 0.42, -meioC + QUINA * 0.3)])

  // O meio da fresta: acima da beira de cima da tampa (o canto dela mais alto), dentro da arca.
  const yDaBeiraDaTampa = Math.min(na(-meiaL, -meioC)[1], na(meiaL, -meioC)[1])
  const xDaFresta = (ax0 + ax1) / 2
  const yDaFresta = (ay0 + PAREDE + yDaBeiraDaTampa) / 2

  // As sombras: o contato e a coluna da arca, e a tampa solta no alto, que passa da arca e cai no chão.
  cena.sombras.push(contato(arca, 0.32), { forma: arca, z: zArca }, { forma: tampa, z: zTopo, solta: true, forca: 0.3 })

  // O musgo no pé da arca, no chão (fica embaixo de tudo).
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9, semente: 4190 }
  L.push(P(elipse(ax0 - 1.2, ay1 - 2.5, 2.6, 3.6), MUSGO, musgo))
  L.push(P(elipse(ax1 + 0.6, ay0 + 6, 1.8, 2.8), MUSGO, { ...musgo, alfa: 0.45, semente: 4191 }))

  // As LASCAS no chão: duas do lado do pé, à esquerda, e uma na cabeceira, à direita (fora da tampa).
  const lascas: readonly (readonly Ponto[])[] = [
    [[ax0 - 4.6, ay1 + 5.2], [ax0 - 1.6, ay1 + 4.1], [ax0 - 0.9, ay1 + 6.6], [ax0 - 3.4, ay1 + 7.9]],
    [[ax0 - 1.8, ay1 + 11], [ax0 + 0.6, ay1 + 10.2], [ax0 + 0.2, ay1 + 12.4]],
    [[ax1 + 2.6, ay0 + 1.5], [ax1 + 5, ay0 + 2.4], [ax1 + 3.6, ay0 + 4.4], [ax1 + 2, ay0 + 3.4]],
  ]
  lascas.forEach((pontos, k) => L.push(P(poligono(pontos), pedra, { tabua: 0, bisel: 0.6, tom: 0.92 - k * 0.04, contorno: 0.3, semente: 4180 + k })))

  // O TAMPO DA ARCA: a borda de pedra e o fundo escuro, com o meio na fresta (sobem com a arca na 3/4).
  L.push(P(comMeioEm(arca, xDaFresta, yDaFresta), pedra, { tabua: 0, bisel: 1, tom: 0.9, contorno: 0.26, semente: 4100 }))
  L.push(P(comMeioEm(oco, xDaFresta, yDaFresta), FUNDO, { tabua: 0, bisel: 0, contorno: 0.2, recesso: { k: 2.8, forca: 0.45 }, semente: 4101 }))

  // A TEIA atravessando a fresta: dois fios da borda de trás até debaixo da tampa e um laço no canto da esquerda.
  const teia = { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, semente: 4110 }
  const yBorda = ay0 + PAREDE - 0.3
  L.push(P(cadeia([[ax0 + PAREDE + 2.2, yBorda], [ax0 + PAREDE + 4.8, yDaBeiraDaTampa + 3.5]], 0.22), TEIA, teia))
  L.push(P(cadeia([[ax0 + PAREDE + 9.5, yBorda], [ax0 + PAREDE + 7.4, yDaBeiraDaTampa + 3]], 0.2), TEIA, { ...teia, semente: 4111 }))
  L.push(P(cadeia([[ax0 + PAREDE - 0.2, yBorda + 3.6], [ax0 + PAREDE + 2.6, yBorda + 2.2], [ax0 + PAREDE + 5.6, yBorda + 1.6], [ax0 + PAREDE + 8.6, yBorda + 2.4]], 0.17), TEIA, { ...teia, alfa: 0.4, semente: 4112 }))

  // A TAMPA, com a sombra dela caindo na borda e no fundo da arca.
  L.push(P(tampa, pedra, { tabua: 0, bisel: 2.2, tom: 0.98, contorno: 0.3, projeta: { dist: 2.4, forca: 0.42 }, semente: 4120 }))
  const u0 = -meiaL + MOLDURA
  const u1 = meiaL - MOLDURA
  const v0 = -meioC + MOLDURA + 1.4
  const v1 = meioC - MOLDURA
  L.push(P(retanguloNaTampa(u0, v0, u1, v1), pedra, { tabua: 0, bisel: 1.5, tom: 1.05, contorno: 0.24, projeta: { dist: 0.9, forca: 0.22 }, semente: 4121 }))

  // A ESPADA em relevo, ao comprido: o pomo, o punho, a guarda, a lâmina e o sulco dela, a ponta no pé.
  const relevo = { tabua: 0, bisel: 0.7, tom: 1.12, contorno: 0.2, projeta: { dist: 0.8, forca: 0.24 }, semente: 4130 }
  const vPomo = v0 + 4.2
  const vGuarda = v0 + 16
  const vPonta = v1 - 6
  L.push(P(retanguloNaTampa(-1.3, vPomo + 1.6, 1.3, vGuarda - 1), pedra, { ...relevo, tom: 1.04 }))
  L.push(P(elipse(...na(0, vPomo), 2.4, 2.4), pedra, { ...relevo, bisel: 1.1, semente: 4131 }))
  L.push(P(poligono([na(-2.6, vGuarda + 1.4), na(-2, vPonta - 7), na(0, vPonta), na(2, vPonta - 7), na(2.6, vGuarda + 1.4)]), pedra, { ...relevo, semente: 4132 }))
  L.push(P(poligono([na(-8.4, vGuarda - 1), na(8.4, vGuarda - 1), na(9.4, vGuarda + 0.2), na(8.4, vGuarda + 1.4), na(-8.4, vGuarda + 1.4), na(-9.4, vGuarda + 0.2)]), pedra, { ...relevo, bisel: 0.8, semente: 4133 }))
  L.push(P(cadeia([na(0, vGuarda + 3), na(0, vPonta - 12)], 0.4), pedra, { tabua: 0, bisel: 0, tom: 0.62, contorno: 0, recesso: { k: 0.6, forca: 0.3 }, semente: 4134 }))

  // As ROSETAS dos quatro cantos da moldura: o botão e o furo do meio.
  for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const [rx, ry] = na(su * (meiaL - MOLDURA - 3.8), sv * (meioC - MOLDURA - 3.8) + (sv < 0 ? 1.4 : 0))
    L.push(P(elipse(rx, ry, 2.2, 2.2), pedra, { tabua: 0, bisel: 1, tom: 1.1, contorno: 0.22, projeta: { dist: 0.6, forca: 0.2 }, semente: 4140 + su + sv * 3 }))
    L.push(P(elipse(rx, ry, 0.7, 0.7), pedra, { tabua: 0, bisel: 0, tom: 0.6, contorno: 0, recesso: { k: 0.5, forca: 0.3 }, semente: 4150 }))
  }

  // A TRINCA perto do pé, com um galho, e o MUSGO num canto da tampa.
  const trinca: Ponto[] = [na(-meiaL + 1, meioC - 17), na(-meiaL + 6, meioC - 15.4), na(-meiaL + 9, meioC - 16.6), na(-meiaL + 14, meioC - 13)]
  L.push(P(cadeia(trinca, 0.34), pedra, { tabua: 0, bisel: 0, tom: 0.45, contorno: 0, semente: 4160 }))
  L.push(P(cadeia([na(-meiaL + 9, meioC - 16.6), na(-meiaL + 11, meioC - 20)], 0.26), pedra, { tabua: 0, bisel: 0, tom: 0.5, contorno: 0, semente: 4161 }))
  L.push(P(elipseGirada(...na(meiaL - 3.4, meioC - 3.6), 3.8, 2, GIRO_DA_TAMPA - 0.5), MUSGO, { ...musgo, alfa: 0.5, semente: 4170 }))
  L.push(P(elipseGirada(...na(-meiaL + 2.2, -meioC + 12), 1.6, 3.4, GIRO_DA_TAMPA), MUSGO, { ...musgo, alfa: 0.42, semente: 4171 }))
}
