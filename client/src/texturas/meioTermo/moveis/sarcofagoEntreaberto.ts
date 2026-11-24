/**
 * SARCÓFAGO ENTREABERTO (lote L05 de 24/11/2026, item 41: a versão do túmulo de pedra da cripta do mapa 8; desenho
 * próprio, só a ideia do objeto). A arca de pedra com a TAMPA empurrada na diagonal: ela deslizou para o pé e para a
 * direita e girou, então na cabeceira abre a FRESTA em cunha, larga à esquerda (uns 9 px) e quase fechada à direita,
 * com a borda da arca à vista em volta e dois fios de teia de uma beira à outra. O oco tem fundo: o escuro da parede
 * de trás clareia até perto da tampa, e a aresta de dentro da parede da esquerda pega um fio de luz. No pé e à
 * direita a tampa passa da arca e faz sombra no chão. Na tampa, dentro da moldura chanfrada, a ESPADA esculpida ao
 * comprido (o punho na cabeceira, a ponta no pé), as quatro rosetas dos cantos, a quina partida perto da fresta e o
 * musgo no canto do pé; no chão, as duas LASCAS que a tampa arrancou ao raspar, cada uma com a sombra dela.
 *
 * Revisão do diretor de arte (24/11): a fresta saía como um retângulo preto de largura igual; as lascas eram pixels
 * soltos; a trinca em Y repetia a das outras peças do lote e saiu; dos borrões de musgo ficou só o do canto do pé.
 *
 * Sem o basamento do túmulo: a tampa que passa da arca cairia em cima dele, e as lajes debaixo dela subiriam com a
 * tampa na 3/4. A tampa girada cabe na pegada (a arca fica mais à esquerda, para sobrar lugar ao deslize).
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura; cada peça sobe com a estrutura mais alta que
 * contém o meio da caixa dela):
 * - a ARCA é a coluna. O tampo dela (a borda, o fundo, o clarão perto da tampa e o fio de luz) tem a caixa esticada
 *   para cima até o meio dela cair na fresta, fora da tampa (`comMeioEm`): assim sobe com a arca, e não com a tampa,
 *   e a fresta fica na altura certa. A parte coberta pela tampa some debaixo dela nas duas vistas;
 * - a TAMPA é um tampo solto com a beirada `ESPESSURA_DA_TAMPA_DO_SARCOFAGO` (o perfil da 3/4 usa).
 * Material: `pedra`. O fundo, a teia e o musgo são fixos.
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, dentroDe, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

/** Altura do alto da tampa (casas) e a grossura dela (px do protótipo): a beirada na 3/4. */
const ALTURA = 0.68
export const ESPESSURA_DA_TAMPA_DO_SARCOFAGO = 0.1 * G
/** A arca dentro da pegada (px): sobra mais à direita e no pé, onde a tampa empurrada passa dela. */
const SOBRA = { esquerda: 4, direita: 12, tras: 4, frente: 22 } as const
/** A grossura da parede da arca (px): a borda que aparece em volta da fresta. */
const PAREDE = 4.2
/** Quanto a tampa passa da arca para os quatro lados, antes de deslizar (px). */
const ABA = 1.1
/**
 * O deslize da tampa (px, a partir do meio da arca) e o giro dela (radianos: a cabeceira desce à esquerda). Com
 * -0,15 a beira de cima da tampa cai 6 px de um lado ao outro: a fresta abre 9 px à esquerda e 4 px à direita.
 */
const DESLIZE: Ponto = [4, 11.6]
const GIRO_DA_TAMPA = -0.15
/** A moldura chanfrada da tampa e a quina partida dela (px). */
const MOLDURA = 3.4
const QUINA = 5
/** O fundo da arca: o escuro da parede de trás e o tom de perto da tampa, onde entra luz pela fresta. */
const FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2b, 0x29] }
const FUNDO_PERTO_DA_TAMPA: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x46, 0x42] }
/** O clarão perto da tampa: quanto ele entra na fresta acima da beira dela e o borrão (px). */
const CLARAO_ACIMA_DA_TAMPA = 2.4
const SUAVE_DO_CLARAO = 4.4
/** A teia: fios claros e finos, meio transparentes. */
const TEIA: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xd2, 0xc8] }
/** O musgo: o verde-oliva da lápide, um pouco mais escuro (o do túmulo de pedra). */
const MUSGO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.82)) }
/** O escuro da pedra (o do túmulo e do pilar): com a nogueira a beira cinza saía marrom. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]
/** As duas lascas no chão (4 a 5 px), fora da arca e da tampa: uma no pé, à esquerda, e uma na cabeceira, à direita. */
const LASCAS: readonly (readonly Ponto[])[] = [
  [[-23.6, 39.2], [-19.4, 38.6], [-18.4, 41.8], [-21.4, 43.4], [-23.9, 41.6]],
  [[19.4, -40.9], [23.4, -41.6], [24.2, -38.4], [21.6, -36.9], [19.1, -38.3]],
]

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

  // A arca e o oco dela.
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

  // As sombras: o contato e a coluna da arca, a tampa solta no alto (passa da arca e cai no chão) e o pé de cada lasca.
  cena.sombras.push(contato(arca, 0.32), { forma: arca, z: zArca }, { forma: tampa, z: zTopo, solta: true, forca: 0.3 })
  const lascas = LASCAS.map((pontos) => poligono(pontos))
  for (const lasca of lascas) cena.sombras.push(contato(lasca, 0.3))

  // As LASCAS no chão: pedaços da pedra da tampa, no tom dela, com o contorno e a sombrinha de contato.
  lascas.forEach((lasca, k) => L.push(P(lasca, pedra, { tabua: 0, bisel: 0.9, tom: 0.9, contorno: 0.3, semente: 4180 + k })))

  // O TAMPO DA ARCA: a borda de pedra e o oco, com o meio na fresta (sobem com a arca na 3/4). O oco vai do escuro da
  // parede de trás ao tom de perto da tampa (o clarão, uma faixa macia ao longo da beira dela), e a aresta de dentro
  // da parede da esquerda pega um fio de luz.
  L.push(P(comMeioEm(arca, xDaFresta, yDaFresta), pedra, { tabua: 0, bisel: 1, tom: 0.9, contorno: 0.26, semente: 4100 }))
  L.push(P(comMeioEm(oco, xDaFresta, yDaFresta), FUNDO, { tabua: 0, bisel: 0, contorno: 0.2, recesso: { k: 2.2, forca: 0.3 }, semente: 4101 }))
  // O borrão do clarão é centrado na beira da forma: o recorte fica meio borrão para dentro do oco, senão ele
  // escureceria a borda de pedra em volta.
  const meioBorrao = SUAVE_DO_CLARAO / 2
  const dentroDoOco = caixa(ax0 + PAREDE + meioBorrao, ay0 + PAREDE + meioBorrao, ax1 - PAREDE - meioBorrao, ay1 - PAREDE)
  const clarao = dentroDe(retanguloNaTampa(-meiaL - 6, -meioC - CLARAO_ACIMA_DA_TAMPA, meiaL + 6, -meioC + 8), dentroDoOco)
  L.push(P(comMeioEm(clarao, xDaFresta, yDaFresta), FUNDO_PERTO_DA_TAMPA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.92, suave: SUAVE_DO_CLARAO, semente: 4102 }))
  const xDaAresta = ax0 + PAREDE
  L.push(P(comMeioEm(caixa(xDaAresta + 0.25, ay0 + PAREDE + 0.6, xDaAresta + 1.35, yDaBeiraDaTampa + 8, 0.3), xDaFresta, yDaFresta), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 1.1, alfa: 0.7, semente: 4103 }))

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

  // O MUSGO no canto do pé da tampa (o único: os borrões do lado esquerdo liam como mancha).
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.5, suave: 0.9, semente: 4170 }
  L.push(P(elipseGirada(...na(meiaL - 3.4, meioC - 3.6), 3.8, 2, GIRO_DA_TAMPA - 0.5), MUSGO, musgo))
}
