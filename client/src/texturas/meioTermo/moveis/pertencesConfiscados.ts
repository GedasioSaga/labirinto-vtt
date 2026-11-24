/**
 * PERTENCES CONFISCADOS de cima com volume (lote L03 de 24/11/2026, Tortura e
 * fogo; desenho ORIGINAL, só a ideia do monte de coisas tomadas dos presos nos
 * mapas de referência): o que o carcereiro tirou de quem entrou, largado num
 * MONTE só. A SILHUETA vem antes do detalhe: uma massa oval (uns 70% da casa)
 * com uma sombra de contato única. Atrás, no meio, a TROUXA grande de estopa
 * amarrada no alto (o nó e as duas orelhas do pano); encostada nela e por cima
 * dela, na frente à esquerda, a PILHA de roupas dobradas (a lã cinza-azulada
 * embaixo, a túnica castanha e a camisa de linho com a gola); na frente à
 * direita, as duas BOTAS de couro DEITADAS, de perfil (a sola, o salto e o
 * cano em L); atravessada na diagonal POR CIMA de tudo, a ESPADA EMBAINHADA
 * (o pomo, o punho enrolado, a guarda, a bainha escura e a ponteira de ferro);
 * e o CINTO dela caindo da pilha até o chão como uma fita, com a fivela na
 * ponta.
 *
 * Revisão do diretor de arte (24/11/2026): antes eram quatro ícones soltos em
 * L (as botas pela boca do cano liam como canos, a bainha de ponteira dourada
 * como lápis, o cinto enrolado como lupa). Agora nada mostra boca redonda nem
 * faz círculo, e o azul das roupas caiu para um cinza quase neutro.
 *
 * Sem dono, sem sangue: roupa dobrada com cuidado de quem faz inventário.
 *
 * NA 3/4 é derivado (`tresQuartos.ts`): a trouxa, a pilha e as botas são
 * colunas de alturas diferentes (a trouxa é a mais alta); a espada sobe por um
 * pino até o alto do monte e sai por último, por cima de tudo; o cinto tem um
 * pedaço que sobe com a pilha e outro que fica no chão e desce pela frente
 * dela. Nada lê o giro. Sem material escolhido: os panos, o couro e o ferro
 * são fixos.
 *
 * A 25% de zoom sobram a mancha oval de panos pardos e o risco escuro da
 * espada atravessado nela: é o que diz "monte de pertences", e não lixo, cama
 * desfeita ou saco. Tudo sai de frações da pegada (1 x 1 casa de partida).
 */
import { hash, type Rgb } from '../../ruido'
import { barra, cadeia, caixa, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type OpcoesDaPeca, type Peca } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm, emOrdem, pino, solta } from './andaimeDaTresQuartos'

/** O monte foi medido no tamanho de partida (1 casa, 28 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.5 * G
const GRAUS = Math.PI / 180

/** As alturas, em px de partida: a trouxa, a pilha de roupas, as botas deitadas e a espada, pousada no alto do monte. */
const ALTURA_DA_TROUXA = 9
const ALTURA_DA_PILHA = 6
const ALTURA_DAS_BOTAS = 3.4
const ALTURA_DA_ESPADA = 9.6

/** A massa do monte (px de partida): a oval da sombra única debaixo de tudo. */
const MASSA = { x: 0, y: 1.5, rx: 20.5, ry: 16 }
/** A trouxa: o meio, os raios e o nó no alto. */
const TROUXA = { x: 1.5, y: -5.5, rx: 13.5, ry: 11.5 }
const NO: Ponto = [1, -8.2]
/**
 * A pilha de roupas (px de partida), torta e encostada na trouxa: o meio, o giro e o meio tamanho de cada peça, com o
 * quanto ela sobra para o lado (a de baixo é a maior). O `apoio` é um ponto dela fora da trouxa (o próprio meio da
 * pilha): a caixa de toda peça da pilha é centrada nele, para subir com a pilha.
 */
const PILHA = { x: -8.8, y: 6, graus: -12, apoio: [-8.8, 6] as Ponto }
const ROUPAS = {
  la: { dx: 0, dy: 0, mx: 9.6, my: 7.5 },
  tunica: { dx: -0.8, dy: 0.9, mx: 8.6, my: 6.4 },
  camisa: { dx: -1.4, dy: -0.8, mx: 7.4, my: 5.4 },
}
/** A gola: a meia largura de cada folha e até onde a ponta desce (px de partida, a partir do meio da beira de trás). */
const GOLA = { meia: 3.6, ponta: 3.8 }
/** As duas botas deitadas (px de partida): onde fica o calcanhar de cada uma e o giro; a segunda fica por baixo da primeira. */
const BOTAS: readonly { readonly x: number; readonly y: number; readonly graus: number }[] = [
  { x: 10.4, y: 5.2, graus: -31 },
  { x: 5.4, y: 9.6, graus: 7 },
]
/** A espada: do pomo à ponteira, e onde cada parte fica ao longo dela (px de partida). */
const ESPADA: { readonly de: Ponto; readonly ate: Ponto } = { de: [-19, 3.6], ate: [18, -14] }
const AO_LONGO = { punho: 2.2, guarda: 9.6, bocal: 10.8, fimDoBocal: 13.6, ponteira: 36 }
/**
 * O cinto da espada: o trecho que corre por cima da pilha até a beira da frente dela, e o que desce pela frente e
 * serpenteia no chão até a fivela. Na vista de cima os dois se cobrem nos últimos `ALTURA_DA_PILHA` px de cima.
 */
const CINTO_EM_CIMA: readonly Ponto[] = [[-3.6, -3.4], [-5.4, 1.4], [-3.5, 6.6], [-3, 12]]
const CINTO_NO_CHAO: readonly Ponto[] = [[-3, 12], [-2.4, 14.6], [0.6, 16.5], [4.6, 16.3], [7.6, 15.6], [10.6, 16.8]]
const LARGURA_DO_CINTO = 1.9

/** Os panos, o couro e o ferro (todos fixos, em tons contidos; nenhum frio que salte). */
const LA_CINZA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x6a, 0x6f, 0x76] }
const LINHO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xc9, 0xbd, 0xa4] }
const LA_CASTANHA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x86, 0x62, 0x50] }
const ESTOPA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xa6, 0x90, 0x6c] }
const COURO_DA_BOTA: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x5b, 0x40] }
const SOLA: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x37, 0x2c] }
const COURO_DO_CINTO: MaterialDaPeca = { classe: 'liso', rgb: [0x50, 0x3b, 0x2e] }
const BAINHA: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x38, 0x33] }
/** O ferro escuro da guarda, da ponteira e das fivelas, e o latão sujo do pomo e do bocal (nada de dourado claro). */
const FERRO_ESCURO: MaterialDaPeca = { classe: 'metal', rgb: [0x5a, 0x56, 0x52] }
const LATAO_SUJO: MaterialDaPeca = { classe: 'metal', rgb: [0x7d, 0x6a, 0x48] }
/** Os botões de osso da camisa. */
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0x80, 0x68] }
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x2a, 0x25] }
const ESCURO_DO_MONTE: Rgb = [0x4c, 0x3c, 0x32]

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
  const fita = (pontos: readonly Ponto[], r: number): Forma => cadeia(pontos.map(p), r * k)
  const oval = (x: number, y: number, rx: number, ry: number): Forma => elipse(x * ex, y * ey, rx * k, ry * k)
  /** O ponto local (x, y) girado `graus` e posto em (ox, oy), no desenho de partida. */
  const posto = (x: number, y: number, ox: number, oy: number, graus: number): Ponto => {
    const [co, si] = [Math.cos(graus * GRAUS), Math.sin(graus * GRAUS)]
    return [ox + x * co - y * si, oy + x * si + y * co]
  }
  const pano = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 1.9 * k, contorno: 0.28, ruga: 0.6, semente, ...mais })
  const couro = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 2 * k, contorno: 0.3, ruga: 0.3, semente, ...mais })
  const sombra = (dist: number): { dist: number; forca: number; suave: number } => ({ dist: dist * k, forca: 0.32, suave: 1.2 * k })
  const vinco = (a: Ponto, b: Ponto, alfa: number, semente: number): Peca => P(cap(a, b, 0.35), VAO, { bisel: 0, contorno: 0, alfa, suave: 0.6 * k, semente })

  // ---------- as formas: a trouxa, a pilha (a peça de baixo) e as duas botas ----------
  const trouxa = elipse(TROUXA.x * ex, TROUXA.y * ey, TROUXA.rx * ex, TROUXA.ry * ey)
  /** O retângulo torto de uma roupa da pilha. */
  const roupa = (r: { dx: number; dy: number; mx: number; my: number }): Ponto[] =>
    [[-r.mx, -r.my], [r.mx, -r.my], [r.mx, r.my], [-r.mx, r.my]].map(([x, y]) => posto(x + r.dx, y + r.dy, PILHA.x, PILHA.y, PILHA.graus))
  const [la, tunica, camisa] = [roupa(ROUPAS.la), roupa(ROUPAS.tunica), roupa(ROUPAS.camisa)]
  const pilha = pol(la)
  /** As peças de uma bota deitada, de perfil, no desenho local (o calcanhar na origem, o cano para trás, o pé para a direita, a sola na frente). */
  const bota = (b: { x: number; y: number; graus: number }) => {
    const em = (x: number, y: number): Ponto => posto(x, y, b.x, b.y, b.graus)
    const cano = pol([em(-2.7, -12), em(2.5, -12.3), em(2.9, -0.6), em(-2.9, 1.4)])
    const pe = uniao(cap(em(0, 0.3), em(7.4, 0.9), 2.75), cap(em(7.6, 1.2), em(9.2, 1.3), 2.45))
    const sola = uniao(pol([em(-3, 2.7), em(11.6, 3), em(11.4, 4.3), em(-3, 4.1)]), pol([em(-3.1, 3.4), em(0.9, 3.5), em(0.9, 5.7), em(-3.1, 5.6)]))
    return { em, cano, pe, sola, inteira: uniao(cano, uniao(pe, sola)) }
  }
  const botas = BOTAS.map(bota)
  const massaDasBotas = uniao(botas[0].inteira, botas[1].inteira)
  // O apoio das botas: um ponto do pé da bota de trás, fora da trouxa e perto do meio das duas (a caixa das peças quase não cresce).
  const apoioDasBotas = p(botas[0].em(1, 0.6))
  const [dx, dy] = [ESPADA.ate[0] - ESPADA.de[0], ESPADA.ate[1] - ESPADA.de[1]]
  const comprimento = Math.hypot(dx, dy)
  const [ux, uy] = [dx / comprimento, dy / comprimento]
  /** O ponto a `t` px do pomo, afastado `n` px para o lado. */
  const naEspada = (t: number, n = 0): Ponto => [ESPADA.de[0] + ux * t - uy * n, ESPADA.de[1] + uy * t + ux * n]

  // ---------- as sombras: UMA de contato debaixo do monte inteiro, e a de cada volume (as colunas da 3/4) ----------
  cena.sombras.push({ forma: oval(MASSA.x, MASSA.y, MASSA.rx, MASSA.ry), z: 0, suave: 3 * k, forca: 0.24 })
  cena.sombras.push(contato(uniao(trouxa, uniao(pilha, massaDasBotas)), 0.34))
  cena.sombras.push({ forma: trouxa, z: ALTURA_DA_TROUXA * k, forca: 0.3 }, { forma: pilha, z: ALTURA_DA_PILHA * k, forca: 0.3 }, { forma: massaDasBotas, z: ALTURA_DAS_BOTAS * k, forca: 0.28 })
  // O cinto que desce pela frente da pilha e a espada saem por último na 3/4: cada um no seu pino, em ordem, depois de tudo.
  const frente = Math.max(trouxa.b[3], pilha.b[3], massaDasBotas.b[3])
  const pinoDoCinto = p(CINTO_NO_CHAO[1])
  const pinoDaEspada = p(naEspada(comprimento * 0.5, -1.1))
  const [formaDoPinoDoCinto, formaDoPinoDaEspada] = emOrdem([pino(pinoDoCinto[0], pinoDoCinto[1]), pino(pinoDaEspada[0], pinoDaEspada[1])], frente)
  cena.sombras.push(solta(formaDoPinoDoCinto, 0.02), solta(formaDoPinoDaEspada, ALTURA_DA_ESPADA * k))
  const naTrouxa = (peca: Peca): Peca => ({ ...peca, forma: comMeioEm(peca.forma, TROUXA.x * ex, TROUXA.y * ey) })
  const naPilha = (peca: Peca): Peca => ({ ...peca, forma: comMeioEm(peca.forma, PILHA.apoio[0] * ex, PILHA.apoio[1] * ey) })
  const nasBotas = (peca: Peca): Peca => ({ ...peca, forma: comMeioEm(peca.forma, apoioDasBotas[0], apoioDasBotas[1]) })
  const noPinoDoCinto = (peca: Peca): Peca => ({ ...peca, forma: comMeioEm(peca.forma, pinoDoCinto[0], pinoDoCinto[1]) })
  const noPinoDaEspada = (peca: Peca): Peca => ({ ...peca, forma: comMeioEm(peca.forma, pinoDaEspada[0], pinoDaEspada[1]) })

  // ---------- a trouxa de estopa, atrás no meio: a bola do pano, os vincos que correm para o nó, as duas orelhas e o nó ----------
  L.push(naTrouxa(P(trouxa, ESTOPA, pano(25410, { bisel: 7.5 * k, ruga: 1.2, contorno: 0.3 }))))
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + 0.4
    const [r0, r1] = [2.8, 7.4 + 2.6 * hash(i, 1, 25411)]
    L.push(naTrouxa(vinco([NO[0] + Math.cos(a) * r0, NO[1] + Math.sin(a) * r0], [NO[0] + Math.cos(a) * r1, NO[1] + Math.sin(a) * r1 * 0.9], 0.2, 25411 + i)))
  }
  const orelhas: readonly (readonly Ponto[])[] = [
    [[NO[0] - 1.4, NO[1] - 0.8], [NO[0] - 7.2, NO[1] - 5.6], [NO[0] - 6.8, NO[1] - 1.2], [NO[0] - 2.2, NO[1] + 1.4]],
    [[NO[0] + 1.2, NO[1] - 1], [NO[0] + 6.6, NO[1] - 6], [NO[0] + 7.6, NO[1] - 1.6], [NO[0] + 2.2, NO[1] + 1.2]],
  ]
  orelhas.forEach((orelha, i) => {
    L.push(naTrouxa(P(pol(orelha), ESTOPA, pano(25420 + i, { bisel: 1.2 * k, tom: 1.08 - 0.06 * i, ruga: 0.9, projeta: sombra(1.4) }))))
  })
  L.push(naTrouxa(P(oval(NO[0], NO[1], 2.5, 2.2), ESTOPA, pano(25424, { bisel: 1.8 * k, tom: 0.9, projeta: sombra(1) }))))

  // ---------- as botas deitadas, de perfil: a sola e o salto, o pé, o cano em L, a dobra do cano e a correia com a fivela de ferro ----------
  botas.forEach((b, i) => {
    const s = 25430 + i * 12
    const tom = i === 0 ? 0.9 : 1
    L.push(nasBotas(P(b.sola, SOLA, { tabua: 0, bisel: 0.7 * k, contorno: 0.28, tom, semente: s })))
    L.push(nasBotas(P(b.pe, COURO_DA_BOTA, couro(s + 1, { tom: 0.92 * tom, bisel: 2.3 * k }))))
    // O claro do peito do pé e a costura da biqueira.
    L.push(nasBotas(P(cap(b.em(2.2, -0.6), b.em(6.4, -0.2), 1), COURO_DA_BOTA, { tabua: 0, bisel: 0.9 * k, contorno: 0, tom: 1.14 * tom, suave: 0.8 * k, semente: s + 2 })))
    L.push(nasBotas(vinco(b.em(7.3, -1.4), b.em(7.5, 2.5), 0.34, s + 3)))
    L.push(nasBotas(P(b.cano, COURO_DA_BOTA, couro(s + 4, { tom: 1.02 * tom, bisel: 2.2 * k, projeta: sombra(1.2) }))))
    // A boca do cano é um corte reto com a dobra clara por fora: nenhum círculo à mostra.
    L.push(nasBotas(P(pol([b.em(-2.9, -12.2), b.em(2.7, -12.5), b.em(2.8, -9.9), b.em(-2.9, -9.6)]), COURO_DA_BOTA, couro(s + 5, { tom: 1.2 * tom, bisel: 0.9 * k, projeta: sombra(0.7) }))))
    L.push(nasBotas(vinco(b.em(-2.2, -5.4), b.em(2.3, -6.2), 0.26, s + 6)))
    L.push(nasBotas(P(cap(b.em(-3, -2.6), b.em(3, -3), 0.8), COURO_DO_CINTO, { tabua: 0, bisel: 0.6 * k, contorno: 0.3, tom: 1.15, semente: s + 7, projeta: sombra(0.6) })))
    const fivela = p(b.em(1.1, -2.9))
    L.push(nasBotas(P(elipse(fivela[0], fivela[1], 1 * k, 1 * k), FERRO_ESCURO, { tabua: 0, bisel: 0.6 * k, contorno: 0.3, metal: 0.36, tom: 1.15, semente: s + 8 })))
  })

  // ---------- a pilha de roupas, encostada na trouxa: a lã cinza embaixo, a túnica castanha e a camisa de linho com a gola ----------
  L.push(naPilha(P(pilha, LA_CINZA, pano(25401, { bisel: 2.4 * k, projeta: sombra(1.6) }))))
  // A dobra de cada peça: um vinco fino junto da beira da frente, onde o pano vira.
  const aoLongoDaFrente = (r: readonly Ponto[], recuo: number): [Ponto, Ponto] => {
    const [f0, f1] = [r[3], r[2]]
    const [t0, t1] = [r[0], r[1]]
    const sobe = (a: Ponto, b: Ponto, q: number): Ponto => [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]
    const q = recuo / (2 * ROUPAS.la.my)
    return [sobe(sobe(f0, f1, 0.1), sobe(t0, t1, 0.1), q), sobe(sobe(f0, f1, 0.9), sobe(t0, t1, 0.9), q)]
  }
  L.push(naPilha(vinco(...aoLongoDaFrente(la, 1.9), 0.3, 25402)))
  L.push(naPilha(P(pol(tunica), LA_CASTANHA, pano(25405, { projeta: sombra(1.4) }))))
  for (const [i, recuo] of [1.8, 3.5].entries()) L.push(naPilha(vinco(...aoLongoDaFrente(tunica, recuo), 0.28 - 0.06 * i, 25406 + i)))
  L.push(naPilha(P(pol(camisa), LINHO, pano(25403, { ruga: 0.5, tom: 0.93, projeta: sombra(1.3) }))))
  for (const [i, recuo] of [1.6, 3.1].entries()) L.push(naPilha(vinco(...aoLongoDaFrente(camisa, recuo), 0.24, 25408 + i)))
  // A gola: as duas folhas em V a partir do meio da beira de trás, a carreira de botões e dois botões de osso.
  const tras: Ponto = [(camisa[0][0] + camisa[1][0]) / 2, (camisa[0][1] + camisa[1][1]) / 2]
  const larguraDeTras = Math.hypot(camisa[1][0] - camisa[0][0], camisa[1][1] - camisa[0][1])
  const [gx, gy] = [(camisa[1][0] - camisa[0][0]) / larguraDeTras, (camisa[1][1] - camisa[0][1]) / larguraDeTras]
  /** O ponto a `a` px ao longo da beira de trás (a partir do meio dela) e `b` px para dentro da camisa. */
  const naCamisa = (a: number, b: number): Ponto => [tras[0] + gx * a - gy * b, tras[1] + gy * a + gx * b]
  L.push(naPilha(vinco(naCamisa(0, GOLA.ponta), naCamisa(0.4, 9.4), 0.24, 25470)))
  for (const [i, lado] of [-1, 1].entries()) {
    const folha = pol([naCamisa(lado * GOLA.meia, 0.3), naCamisa(lado * 0.15, 0.2), naCamisa(lado * 0.8, GOLA.ponta)])
    L.push(naPilha(P(folha, LINHO, pano(25471 + i, { bisel: 0.7 * k, tom: 1.04, ruga: 0.3, projeta: sombra(0.8) }))))
  }
  L.push(naPilha(vinco(naCamisa(0, 0.5), naCamisa(0, GOLA.ponta - 0.8), 0.42, 25473)))
  for (const [i, b] of [5.6, 8.2].entries()) {
    const [botaoX, botaoY] = naCamisa(0.9, b)
    L.push(naPilha(P(oval(botaoX, botaoY, 0.6, 0.6), OSSO, { tabua: 0, bisel: 0.4 * k, contorno: 0.3, semente: 25474 + i })))
  }

  // ---------- o cinto da espada: corre por cima da pilha, desce pela frente dela e serpenteia no chão até a fivela ----------
  const doCinto = (semente: number): OpcoesDaPeca => ({ tabua: 0, bisel: 0.7 * k, contorno: 0.32, tom: 1.12, semente, projeta: sombra(0.8) })
  L.push(naPilha(P(fita(CINTO_EM_CIMA, LARGURA_DO_CINTO / 2), COURO_DO_CINTO, doCinto(25480))))
  const descida: readonly Ponto[] = [[CINTO_NO_CHAO[0][0], CINTO_NO_CHAO[0][1] - ALTURA_DA_PILHA], ...CINTO_NO_CHAO]
  cena.sombras.push(contato(fita(CINTO_NO_CHAO.slice(1), LARGURA_DO_CINTO / 2), 0.26))
  L.push(noPinoDoCinto(P(fita(descida, LARGURA_DO_CINTO / 2), COURO_DO_CINTO, doCinto(25481))))
  // Os furos da ponta e a fivela de ferro (um quadro reto com o fuzilhão, nada de argola), deitada no chão.
  for (const q of [0.35, 0.65]) {
    const [a, b] = [CINTO_NO_CHAO[2], CINTO_NO_CHAO[3]]
    L.push(noPinoDoCinto(P(oval(a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, 0.38, 0.38), VAO, { bisel: 0, contorno: 0, alfa: 0.7, semente: 25482 })))
  }
  const [fivX, fivY] = CINTO_NO_CHAO[CINTO_NO_CHAO.length - 1]
  const [qx, qy] = [fivX * ex, fivY * ey]
  const quadro = uniao(menos(caixa(qx - 2.1 * k, qy - 1.7 * k, qx + 2.1 * k, qy + 1.7 * k, 0.4 * k), caixa(qx - 1.2 * k, qy - 0.85 * k, qx + 1.2 * k, qy + 0.85 * k)), cap([fivX - 2, fivY + 0.1], [fivX - 0.1, fivY - 0.1], 0.36))
  L.push(noPinoDoCinto(P(quadro, FERRO_ESCURO, { tabua: 0, bisel: 0.6 * k, contorno: 0.3, metal: 0.36, tom: 1.1, semente: 25484, projeta: sombra(0.6) })))

  // ---------- a espada embainhada, atravessada por cima do monte: a bainha, as braçadeiras, a ponteira de ferro, o bocal, a guarda, o punho e o pomo ----------
  const espada: Peca[] = []
  const bainha = pol([naEspada(AO_LONGO.bocal, -2.6), naEspada(AO_LONGO.ponteira + 2, -1.9), naEspada(comprimento, 0), naEspada(AO_LONGO.ponteira + 2, 1.9), naEspada(AO_LONGO.bocal, 2.6)])
  espada.push(P(bainha, BAINHA, { tabua: 0, bisel: 1.9 * k, contorno: 0.32, semente: 25450, projeta: { dist: 2.4 * k, forca: 0.36, suave: 1.5 * k } }))
  // As duas braçadeiras de couro da bainha, de onde o cinto sai.
  for (const t of [16.6, 22.6]) {
    const [a, b] = [p(naEspada(t, -2.9)), p(naEspada(t + 0.5, 2.9))]
    espada.push(P(capsula(a[0], a[1], b[0], b[1], 0.95 * k), COURO_DO_CINTO, { tabua: 0, bisel: 0.8 * k, contorno: 0.3, tom: 1.3, semente: 25451 + t, projeta: sombra(0.7) }))
  }
  espada.push(P(pol([naEspada(AO_LONGO.ponteira, -2.15), naEspada(AO_LONGO.ponteira + 2, -1.95), naEspada(comprimento + 0.3, 0), naEspada(AO_LONGO.ponteira + 2, 1.95), naEspada(AO_LONGO.ponteira, 2.15)]), FERRO_ESCURO, { tabua: 0, bisel: 1.3 * k, contorno: 0.3, metal: 0.3, semente: 25456 }))
  espada.push(P(pol([naEspada(AO_LONGO.bocal, -2.8), naEspada(AO_LONGO.fimDoBocal, -2.7), naEspada(AO_LONGO.fimDoBocal, 2.7), naEspada(AO_LONGO.bocal, 2.8)]), LATAO_SUJO, { tabua: 0, bisel: 1.2 * k, contorno: 0.3, metal: 0.3, semente: 25457 }))
  const guarda = barra(...p(naEspada(AO_LONGO.guarda, -5.4)), ...p(naEspada(AO_LONGO.guarda, 5.4)), 2.2 * k)
  espada.push(P(guarda, FERRO_ESCURO, { tabua: 0, bisel: 1 * k, contorno: 0.3, metal: 0.34, tom: 1.08, semente: 25458, projeta: { dist: 2 * k, forca: 0.34, suave: 1.2 * k } }))
  espada.push(P(cap(naEspada(AO_LONGO.punho), naEspada(AO_LONGO.guarda - 0.6), 1.5), COURO_DO_CINTO, { tabua: 0, bisel: 1.3 * k, contorno: 0.32, tom: 0.92, semente: 25459, projeta: { dist: 2 * k, forca: 0.34, suave: 1.2 * k } }))
  for (const t of [3.8, 5.5, 7.2]) espada.push(vinco(naEspada(t, -1.3), naEspada(t + 0.5, 1.3), 0.4, 25460 + t))
  const pomo = p(naEspada(0.6))
  espada.push(P(elipse(pomo[0], pomo[1], 2.2 * k, 2.2 * k), LATAO_SUJO, { tabua: 0, bisel: 1.9 * k, contorno: 0.3, metal: 0.34, semente: 25464, projeta: { dist: 2 * k, forca: 0.34, suave: 1.2 * k } }))
  L.push(...espada.map(noPinoDaEspada))
}
