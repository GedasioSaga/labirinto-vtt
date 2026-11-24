/**
 * PERTENCES CONFISCADOS de cima com volume (lote L03 de 24/11/2026, Tortura e
 * fogo; desenho ORIGINAL, só a ideia do monte de coisas tomadas dos presos nos
 * mapas de referência): o que o carcereiro tirou de quem entrou. A SILHUETA do
 * monte vem antes do detalhe: atrás, à esquerda, a PILHA de roupas dobradas
 * (três peças DESENCONTRADAS, cada uma sobrando para um lado, para a pilha
 * não ler como quadro na moldura: a lã azul-acinzentada embaixo, a túnica
 * castanha no meio e a camisa de linho por cima, com a GOLA, a carreira de
 * botões e o CINTO enrolado em cima dela, a ponta escorrendo para a túnica);
 * atrás, à direita, a TROUXA de estopa amarrada no alto (o nó e as duas
 * orelhas do pano); na frente delas, o par de BOTAS de couro (uma em pé, com
 * a boca escura do cano, a costura da biqueira e a correia afivelada; a outra
 * tombada de lado, mostrando a sola); e, deitada na frente de tudo, a ESPADA
 * EMBAINHADA: o pomo e a guarda, o punho enrolado, a bainha escura com o bocal
 * e a ponteira de latão.
 *
 * Sem dono, sem sangue: roupa dobrada com cuidado de quem faz inventário.
 *
 * NA 3/4 é derivado (`tresQuartos.ts`): a pilha, a trouxa e o cano da bota em
 * pé são colunas de alturas diferentes (a trouxa é a mais alta); a bota
 * tombada é baixa, e a espada fica no chão. Nada lê o giro. Sem material
 * escolhido: os panos, o couro, o ferro e o latão são fixos.
 *
 * A 25% de zoom sobram a mancha de dois tons (o retângulo das roupas e a bola
 * da trouxa), as botas castanhas e o risco comprido da espada embaixo: é o que
 * diz "monte de pertences", e não lixo, cama desfeita ou saco. Tudo sai de
 * frações da pegada (1 x 1 casa de partida).
 */
import { hash, type Rgb } from '../../ruido'
import { anel, cadeia, caixa, capsula, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type OpcoesDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

/** O monte foi medido no tamanho de partida (1 casa, 28 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.5 * G

/** As alturas, em px de partida: a pilha de roupas, a trouxa, o cano da bota em pé e a bota tombada. */
const ALTURA_DA_PILHA = 7
const ALTURA_DA_TROUXA = 9
const ALTURA_DO_CANO = 10
const ALTURA_DA_TOMBADA = 4.5

/**
 * A pilha de roupas (px de partida): a peça de baixo e as duas de cima, cada
 * uma torta e sobrando para um lado. A túnica (no meio) sobra para a esquerda
 * e para a frente; a camisa (por cima) sobra para a direita e para trás, com a
 * GOLA no alto: é a gola que diz "roupa dobrada" (sem ela a pilha lia como
 * livro com etiqueta).
 */
const PILHA = { x0: -24.5, y0: -23.6, x1: -1.6, y1: -4 }
const TUNICA: readonly Ponto[] = [[-25.4, -19.6], [-6.6, -21], [-5.8, -5.2], [-24.6, -3.4]]
const CAMISA: readonly Ponto[] = [[-18.4, -22.8], [0.8, -24.2], [1.8, -10.4], [-17.4, -8.8]]
/** A gola: a meia largura de cada folha e até onde a ponta desce (px de partida, a partir do meio da beira de trás). */
const GOLA = { meia: 4.2, ponta: 4.4 }
/** A carreira de botões: até onde desce e onde fica cada botão (px a partir da beira de trás). */
const CARREIRA = { fim: 12.6, botoes: [7, 10.6] }
/** O cinto enrolado em cima da camisa (couro escuro no linho claro): o meio e os raios da volta. */
const CINTO = { x: -14.2, y: -14.4, fora: 3.8, dentro: 2.4 }
/** A trouxa: o meio, os raios e o nó no alto. */
const TROUXA = { x: 11.8, y: -9.8, rx: 11.4, ry: 10.4 }
const NO: Ponto = [11.4, -11.2]
/** A bota em pé: o meio do cano (o calcanhar) e para onde o bico aponta. */
const EM_PE: { readonly cano: Ponto; readonly bico: Ponto; readonly raio: number } = { cano: [-10.8, 2], bico: [-14, 13.8], raio: 3.8 }
/** A bota tombada: o calcanhar, a boca do cano e o bico. */
const TOMBADA: { readonly calcanhar: Ponto; readonly boca: Ponto; readonly bico: Ponto } = { calcanhar: [2.6, 9.2], boca: [13.2, 5], bico: [-0.4, 17.2] }
/** A espada: do pomo à ponteira, e onde cada parte fica ao longo dela (px de partida). */
const ESPADA: { readonly de: Ponto; readonly ate: Ponto } = { de: [-23.6, 20.4], ate: [24.4, 23.6] }
const AO_LONGO = { punho: 2.4, guarda: 10.4, bocal: 11.6, fimDoBocal: 15, ponteira: 41.4 }

/** Os panos, o couro, o ferro e o latão (todos fixos, em tons contidos). */
const LA_AZUL: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x62, 0x6e, 0x7e] }
const LINHO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xc9, 0xbd, 0xa4] }
const LA_CASTANHA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x86, 0x62, 0x50] }
const ESTOPA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xa6, 0x90, 0x6c] }
const COURO_DA_BOTA: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x5b, 0x40] }
const SOLA: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x37, 0x2c] }
const COURO_DO_CINTO: MaterialDaPeca = { classe: 'liso', rgb: [0x50, 0x3b, 0x2e] }
const BAINHA: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x38, 0x33] }
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: [0x6c, 0x6e, 0x71] }
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0x8a, 0x58] }
/** Os botões de osso da camisa. */
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0x80, 0x68] }
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x2a, 0x25] }
const ESCURO_DO_MONTE: Rgb = [0x4c, 0x3c, 0x32]

/** A forma `g` px mais gorda para todos os lados: a vira da sola em volta do pé da bota. */
function engordada(f: Forma, g: number): Forma {
  return { b: [f.b[0] - g, f.b[1] - g, f.b[2] + g, f.b[3] + g], d: (x, y) => f.d(x, y) - g }
}

export const montarPertencesConfiscados: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh) / MEIO_LADO_DE_PARTIDA
  const [ex, ey] = [hw / MEIO_LADO_DE_PARTIDA, hh / MEIO_LADO_DE_PARTIDA]
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_MONTE
  /** Um ponto do desenho de partida na pegada de hoje. */
  const p = ([x, y]: Ponto): Ponto => [x * ex, y * ey]
  const pol = (pontos: readonly Ponto[]): Forma => poligono(pontos.map(p))
  const cap = (a: Ponto, b: Ponto, r: number): Forma => capsula(a[0] * ex, a[1] * ey, b[0] * ex, b[1] * ey, r * k)
  const oval = (x: number, y: number, rx: number, ry: number): Forma => elipse(x * ex, y * ey, rx * k, ry * k)
  const pano = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 1.9 * k, contorno: 0.28, ruga: 0.6, semente, ...mais })
  const sombra = (dist: number): { dist: number; forca: number; suave: number } => ({ dist: dist * k, forca: 0.32, suave: 1.2 * k })
  const vinco = (a: Ponto, b: Ponto, alfa: number, semente: number): void => {
    L.push(P(cap(a, b, 0.35), VAO, { bisel: 0, contorno: 0, alfa, suave: 0.6 * k, semente }))
  }

  // ---------- as formas que fazem sombra ----------
  const dobrada = caixa(PILHA.x0 * ex, PILHA.y0 * ey, PILHA.x1 * ex, PILHA.y1 * ey, 3.6 * k)
  // O chão da pilha: a peça de baixo mais o que a camisa e a túnica sobram dela.
  const pilha = uniao(dobrada, uniao(pol(CAMISA), pol(TUNICA)))
  const trouxa = elipse(TROUXA.x * ex, TROUXA.y * ey, TROUXA.rx * ex, TROUXA.ry * ey)
  const cano = oval(EM_PE.cano[0], EM_PE.cano[1], EM_PE.raio, EM_PE.raio * 0.96)
  const rumoDoPe = Math.atan2(EM_PE.bico[1] - EM_PE.cano[1], EM_PE.bico[0] - EM_PE.cano[0])
  const peDaBota = uniao(cap(EM_PE.cano, EM_PE.bico, 2.9), elipseGirada(EM_PE.bico[0] * ex, EM_PE.bico[1] * ey, 4.6 * k, 3.6 * k, rumoDoPe))
  const canoTombado = cap(TOMBADA.calcanhar, TOMBADA.boca, 3.6)
  const rumoDoTombado = Math.atan2(TOMBADA.bico[1] - TOMBADA.calcanhar[1], TOMBADA.bico[0] - TOMBADA.calcanhar[0])
  const peTombado = uniao(cap(TOMBADA.calcanhar, TOMBADA.bico, 2.7), elipseGirada(TOMBADA.bico[0] * ex, TOMBADA.bico[1] * ey, 4.1 * k, 3 * k, rumoDoTombado))
  const tombada = uniao(canoTombado, peTombado)
  const [dx, dy] = [ESPADA.ate[0] - ESPADA.de[0], ESPADA.ate[1] - ESPADA.de[1]]
  const comprimento = Math.hypot(dx, dy)
  const [ux, uy] = [dx / comprimento, dy / comprimento]
  /** O ponto a `t` px do pomo, afastado `n` px para o lado. */
  const naEspada = (t: number, n = 0): Ponto => [ESPADA.de[0] + ux * t - uy * n, ESPADA.de[1] + uy * t + ux * n]
  const bainha = pol([naEspada(AO_LONGO.bocal, -2.7), naEspada(AO_LONGO.ponteira + 2, -2), naEspada(comprimento, 0), naEspada(AO_LONGO.ponteira + 2, 2), naEspada(AO_LONGO.bocal, 2.7)])
  const guarda = cap(naEspada(AO_LONGO.guarda, -5.2), naEspada(AO_LONGO.guarda, 5.2), 1.15)
  const punho = cap(naEspada(AO_LONGO.punho), naEspada(AO_LONGO.guarda - 0.6), 1.55)

  cena.sombras.push(contato(pilha, 0.32), { forma: pilha, z: ALTURA_DA_PILHA * k, forca: 0.3 })
  cena.sombras.push(contato(trouxa, 0.32), { forma: trouxa, z: ALTURA_DA_TROUXA * k, forca: 0.3 })
  cena.sombras.push(contato(uniao(cano, peDaBota), 0.32), { forma: cano, z: ALTURA_DO_CANO * k, forca: 0.28 })
  cena.sombras.push(contato(tombada, 0.3), { forma: tombada, z: ALTURA_DA_TOMBADA * k, forca: 0.28 })
  cena.sombras.push(contato(uniao(bainha, uniao(guarda, punho)), 0.3))

  // ---------- a pilha de roupas: a lã azul embaixo, a túnica castanha, a camisa de linho com a gola e o cinto enrolado ----------
  L.push(P(dobrada, LA_AZUL, pano(25401, { bisel: 2.4 * k })))
  // A dobra de cada peça: um vinco fino junto da beira da frente, onde o pano vira.
  vinco([PILHA.x0 + 2.6, PILHA.y1 - 2.4], [PILHA.x1 - 2.6, PILHA.y1 - 2.1], 0.3, 25402)
  L.push(P(pol(TUNICA), LA_CASTANHA, pano(25405, { projeta: sombra(1.4) })))
  // As camadas da túnica dobrada, à mostra na faixa da frente: dois vincos ao longo da beira.
  for (const [i, recuo] of [1.9, 3.7].entries()) vinco([TUNICA[3][0] + 1.4, TUNICA[3][1] - recuo], [TUNICA[2][0] - 1.4, TUNICA[2][1] - recuo], 0.28 - 0.06 * i, 25406 + i * 0.5)
  L.push(P(pol(CAMISA), LINHO, pano(25403, { ruga: 0.5, projeta: sombra(1.3) })))
  // As dobras da camisa à mostra na beira da direita: dois vincos finos ao longo dela.
  for (const [i, recuo] of [1.7, 3.3].entries()) vinco([CAMISA[1][0] - recuo, CAMISA[1][1] + 2], [CAMISA[2][0] - recuo, CAMISA[2][1] - 1.6], 0.24, 25404 + i * 0.5)
  // A gola: as duas folhas em V a partir do meio da beira de trás, a carreira de botões e dois botões de osso.
  const tras: Ponto = [(CAMISA[0][0] + CAMISA[1][0]) / 2, (CAMISA[0][1] + CAMISA[1][1]) / 2]
  const larguraDeTras = Math.hypot(CAMISA[1][0] - CAMISA[0][0], CAMISA[1][1] - CAMISA[0][1])
  const [gx, gy] = [(CAMISA[1][0] - CAMISA[0][0]) / larguraDeTras, (CAMISA[1][1] - CAMISA[0][1]) / larguraDeTras]
  /** O ponto a `a` px ao longo da beira de trás (a partir do meio dela) e `b` px para dentro da camisa. */
  const naCamisa = (a: number, b: number): Ponto => [tras[0] + gx * a - gy * b, tras[1] + gy * a + gx * b]
  vinco(naCamisa(0, GOLA.ponta), naCamisa(0.5, CARREIRA.fim), 0.24, 25470)
  for (const [i, lado] of [-1, 1].entries()) {
    const folha = pol([naCamisa(lado * GOLA.meia, 0.3), naCamisa(lado * 0.15, 0.2), naCamisa(lado * 0.85, GOLA.ponta)])
    L.push(P(folha, LINHO, pano(25471 + i, { bisel: 0.7 * k, tom: 1.09, ruga: 0.3, projeta: sombra(0.8) })))
  }
  vinco(naCamisa(0, 0.5), naCamisa(0, GOLA.ponta - 0.9), 0.42, 25473)
  for (const [i, b] of CARREIRA.botoes.entries()) {
    const [botaoX, botaoY] = naCamisa(0.95, b)
    L.push(P(oval(botaoX, botaoY, 0.62, 0.62), OSSO, { tabua: 0, bisel: 0.4 * k, contorno: 0.3, semente: 25474 + i }))
  }
  // O cinto enrolado em cima: a volta de couro, a ponta que escorre da camisa para a túnica e a fivela de latão.
  const [cx, cy] = p([CINTO.x, CINTO.y])
  L.push(P(anel(cx, cy, CINTO.fora * k, CINTO.fora * k, CINTO.dentro * k, CINTO.dentro * k), COURO_DO_CINTO, { tabua: 0, bisel: 0.7 * k, contorno: 0.32, tom: 1.1, semente: 25407, projeta: sombra(0.9) }))
  L.push(P(cap([CINTO.x - 1.4, CINTO.y + CINTO.fora - 0.7], [CINTO.x - 4, CINTO.y + CINTO.fora + 3.6], 0.8), COURO_DO_CINTO, { tabua: 0, bisel: 0.6 * k, contorno: 0.32, semente: 25408, projeta: sombra(0.7) }))
  const fivelaDoCinto = p([CINTO.x + CINTO.fora - 0.4, CINTO.y + 0.5])
  L.push(P(anel(fivelaDoCinto[0], fivelaDoCinto[1], 1.7 * k, 1.7 * k, 0.8 * k, 0.8 * k), LATAO, { tabua: 0, bisel: 0.6 * k, contorno: 0.3, metal: 0.5, semente: 25409 }))

  // ---------- a trouxa de estopa: a bola do pano, os vincos que correm para o nó, as duas orelhas e o nó ----------
  L.push(P(trouxa, ESTOPA, pano(25410, { bisel: 7.5 * k, ruga: 1.2, contorno: 0.3 })))
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.4
    const [r0, r1] = [2.8, 7 + 2.4 * hash(i, 1, 25411)]
    vinco([NO[0] + Math.cos(a) * r0, NO[1] + Math.sin(a) * r0], [NO[0] + Math.cos(a) * r1, NO[1] + Math.sin(a) * r1 * 0.94], 0.2, 25411 + i)
  }
  const orelhas: readonly (readonly Ponto[])[] = [
    [[NO[0] - 1.4, NO[1] - 0.8], [NO[0] - 7.2, NO[1] - 6.4], [NO[0] - 6.8, NO[1] - 1.6], [NO[0] - 2.2, NO[1] + 1.4]],
    [[NO[0] + 1.2, NO[1] - 1], [NO[0] + 6.6, NO[1] - 6.8], [NO[0] + 7.6, NO[1] - 2], [NO[0] + 2.2, NO[1] + 1.2]],
  ]
  orelhas.forEach((orelha, i) => {
    L.push(P(pol(orelha), ESTOPA, pano(25420 + i, { bisel: 1.2 * k, tom: 1.08 - 0.06 * i, ruga: 0.9, projeta: sombra(1.4) })))
  })
  L.push(P(oval(NO[0], NO[1], 2.5, 2.2), ESTOPA, pano(25424, { bisel: 1.8 * k, tom: 0.9, projeta: sombra(1) })))

  // ---------- a bota em pé: a vira da sola, o pé com a biqueira, o cano com a dobra clara e a boca escura ----------
  const couro = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 2 * k, contorno: 0.3, ruga: 0.3, semente, ...mais })
  L.push(P(engordada(peDaBota, 0.95 * k), SOLA, { tabua: 0, bisel: 0.6 * k, contorno: 0.3, semente: 25430 }))
  L.push(P(peDaBota, COURO_DA_BOTA, couro(25431, { tom: 0.92, bisel: 2.6 * k })))
  const [bicoX, bicoY] = p(EM_PE.bico)
  L.push(P(elipseGirada(bicoX, bicoY + 0.5 * k, 2.6 * k, 2.1 * k, rumoDoPe), COURO_DA_BOTA, { tabua: 0, bisel: 1.6 * k, contorno: 0, tom: 1.12, suave: 0.8 * k, semente: 25432 }))
  /** O ponto a `t` do pé (0 = o cano, 1 = o bico), afastado `n` px para o lado de fora. */
  const noPe = (t: number, n: number): Ponto => [
    EM_PE.cano[0] + (EM_PE.bico[0] - EM_PE.cano[0]) * t - Math.sin(rumoDoPe) * n,
    EM_PE.cano[1] + (EM_PE.bico[1] - EM_PE.cano[1]) * t + Math.cos(rumoDoPe) * n,
  ]
  // O que faz do tubo uma BOTA: a costura da biqueira e a correia do peito do pé, com a fivela de latão do lado de fora.
  vinco(noPe(0.78, -2.5), noPe(0.78, 2.5), 0.36, 25477)
  L.push(P(cap(noPe(0.46, -3.1), noPe(0.46, 3.1), 0.8), COURO_DO_CINTO, { tabua: 0, bisel: 0.6 * k, contorno: 0.3, tom: 1.15, semente: 25478, projeta: sombra(0.6) }))
  const fivelaDaBota = p(noPe(0.46, 2.3))
  L.push(P(elipse(fivelaDaBota[0], fivelaDaBota[1], 1.05 * k, 1.05 * k), LATAO, { tabua: 0, bisel: 0.6 * k, contorno: 0.3, metal: 0.5, semente: 25479 }))
  L.push(P(cano, COURO_DA_BOTA, couro(25433, { tom: 1.04, bisel: 1.5 * k, projeta: sombra(2.2) })))
  const [canoX, canoY] = p(EM_PE.cano)
  L.push(P(anel(canoX, canoY, EM_PE.raio * k, EM_PE.raio * 0.96 * k, (EM_PE.raio - 1.5) * k, (EM_PE.raio * 0.96 - 1.5) * k), COURO_DA_BOTA, { tabua: 0, bisel: 0.7 * k, contorno: 0.26, tom: 1.2, semente: 25434 }))
  L.push(P(oval(EM_PE.cano[0], EM_PE.cano[1], EM_PE.raio - 1.5, EM_PE.raio * 0.96 - 1.5), VAO, { bisel: 0, contorno: 0, recesso: { k: 1.4 * k, forca: 0.4 }, semente: 25435 }))

  // ---------- a bota tombada: o pé de lado com a sola à mostra e o salto, o cano deitado, a dobra e a boca ----------
  L.push(P(peTombado, COURO_DA_BOTA, couro(25440, { tom: 0.9, bisel: 2.2 * k })))
  /** O ponto `a` afastado `n` px para o lado da sola (o de fora do L que o pé faz com o cano). */
  const afasta = (a: Ponto, n: number): Ponto => [a[0] - Math.sin(rumoDoTombado) * n, a[1] + Math.cos(rumoDoTombado) * n]
  L.push(P(cap(afasta(TOMBADA.calcanhar, 2.6), afasta(TOMBADA.bico, 2.8), 1.1), SOLA, { tabua: 0, bisel: 0.6 * k, contorno: 0.26, semente: 25441 }))
  L.push(P(oval(afasta(TOMBADA.calcanhar, 3.1)[0], afasta(TOMBADA.calcanhar, 3.1)[1] + 0.6, 1.8, 1.5), SOLA, { tabua: 0, bisel: 0.8 * k, contorno: 0.26, tom: 0.9, semente: 25442 }))
  L.push(P(canoTombado, COURO_DA_BOTA, couro(25443, { tom: 1.02, bisel: 2.4 * k, projeta: sombra(1.2) })))
  const [bx, by] = TOMBADA.boca
  const rumoDoCano = Math.atan2(TOMBADA.boca[1] - TOMBADA.calcanhar[1], TOMBADA.boca[0] - TOMBADA.calcanhar[0])
  /** O ponto a `t` do cano tombado (0 = o calcanhar, 1 = a boca), afastado `n` px para o lado. */
  const noCano = (t: number, n: number): Ponto => [
    TOMBADA.calcanhar[0] + (TOMBADA.boca[0] - TOMBADA.calcanhar[0]) * t - Math.sin(rumoDoCano) * n,
    TOMBADA.calcanhar[1] + (TOMBADA.boca[1] - TOMBADA.calcanhar[1]) * t + Math.cos(rumoDoCano) * n,
  ]
  // A correia do tornozelo, a mesma da outra bota, com a fivela no lombo do cano.
  L.push(P(cap(noCano(0.36, -3.5), noCano(0.36, 3.5), 0.75), COURO_DO_CINTO, { tabua: 0, bisel: 0.6 * k, contorno: 0.3, tom: 1.15, semente: 25480, projeta: sombra(0.6) }))
  const fivelaDaTombada = p(noCano(0.36, -0.4))
  L.push(P(elipse(fivelaDaTombada[0], fivelaDaTombada[1], 1 * k, 1 * k), LATAO, { tabua: 0, bisel: 0.6 * k, contorno: 0.3, metal: 0.5, semente: 25481 }))
  const [bocaX, bocaY] = p([bx + 1.2, by - 0.5])
  L.push(P(elipseGirada(bocaX, bocaY, 2.5 * k, 3.7 * k, rumoDoCano), COURO_DA_BOTA, couro(25444, { tom: 1.2, bisel: 0.9 * k })))
  L.push(P(elipseGirada(bocaX + 0.4 * k, bocaY, 1.3 * k, 2.5 * k, rumoDoCano), VAO, { bisel: 0, contorno: 0, semente: 25445 }))

  // ---------- a espada embainhada, deitada na frente: a bainha, a ponteira, o bocal, a guarda, o punho e o pomo ----------
  L.push(P(bainha, BAINHA, { tabua: 0, bisel: 1.9 * k, contorno: 0.32, semente: 25450 }))
  // As duas braçadeiras de couro da bainha, onde o cinto prendia.
  for (const t of [21, 27]) {
    const [a, b] = [p(naEspada(t, -3)), p(naEspada(t + 0.6, 3))]
    L.push(P(capsula(a[0], a[1], b[0], b[1], 1 * k), COURO_DO_CINTO, { tabua: 0, bisel: 0.8 * k, contorno: 0.3, tom: 1.3, semente: 25451 + t, projeta: sombra(0.7) }))
  }
  // A ponta solta da correia, caída no chão para a frente.
  const solta: readonly Ponto[] = [naEspada(21.4, 2.6), naEspada(22.6, 5), naEspada(26.4, 5.6), naEspada(29.6, 4.6)]
  L.push(P(cadeia(solta.map(p), 0.95 * k), COURO_DO_CINTO, { tabua: 0, bisel: 0.8 * k, contorno: 0.3, tom: 1.2, semente: 25454 }))
  L.push(P(pol([naEspada(AO_LONGO.ponteira, -2.25), naEspada(AO_LONGO.ponteira + 2, -2.05), naEspada(comprimento + 0.3, 0), naEspada(AO_LONGO.ponteira + 2, 2.05), naEspada(AO_LONGO.ponteira, 2.25)]), LATAO, { tabua: 0, bisel: 1.3 * k, contorno: 0.3, metal: 0.45, semente: 25456 }))
  L.push(P(pol([naEspada(AO_LONGO.bocal, -2.9), naEspada(AO_LONGO.fimDoBocal, -2.8), naEspada(AO_LONGO.fimDoBocal, 2.8), naEspada(AO_LONGO.bocal, 2.9)]), LATAO, { tabua: 0, bisel: 1.2 * k, contorno: 0.3, metal: 0.45, semente: 25457 }))
  L.push(P(guarda, FERRO, { tabua: 0, bisel: 1 * k, contorno: 0.3, metal: 0.4, semente: 25458, projeta: sombra(0.7) }))
  L.push(P(punho, COURO_DO_CINTO, { tabua: 0, bisel: 1.3 * k, contorno: 0.32, tom: 0.92, semente: 25459 }))
  for (const t of [4.2, 6, 7.8]) vinco(naEspada(t, -1.3), naEspada(t + 0.5, 1.3), 0.4, 25460 + t)
  const pomo = p(naEspada(0.6))
  L.push(P(elipse(pomo[0], pomo[1], 2.3 * k, 2.3 * k), LATAO, { tabua: 0, bisel: 1.9 * k, contorno: 0.3, metal: 0.5, semente: 25464, projeta: sombra(0.7) }))
}
