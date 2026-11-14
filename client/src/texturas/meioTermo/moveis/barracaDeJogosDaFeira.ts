/**
 * BARRACA DE JOGOS DA FEIRA de cima com volume (lote L10 dos objetos de 14/11/2026, grupo Taverna e festa;
 * pedido do mestre: "barraca de jogos da feira: derrubar latas, argolas"). A barraca de quermesse inteira num
 * TABLADO de tábuas:
 * - atrás, o TOLDO listrado de uma água, alto, nos quatro esteios, com a SANEFA em gomos na beira da frente;
 *   debaixo dele, a PRATELEIRA dos prêmios (ursos de pelúcia e bonecas de pano), que só aparece na 3/4;
 * - à esquerda, o jogo de DERRUBAR LATAS: o caixote-pedestal com a pirâmide de latas pintadas (3 x 3, 2 x 2 e uma
 *   no alto), e na frente dele, no tablado, as latas que já caíram, deitadas, e uma bola;
 * - à direita, o jogo das ARGOLAS: a mesa baixa com doze garrafas verdes em grade e as argolas coloridas, umas
 *   enfiadas no gargalo, outras caídas na mesa;
 * - na frente, o BALCÃO de tábuas de onde se joga, com o cesto de bolas de pano, a lata do dinheiro aberta com as
 *   moedas e a pilha de argolas.
 *
 * Não é a barraca do catálogo (`barraca.ts`, o toldo de duas águas cobrindo quase tudo, com frutas no balcão) nem
 * a banca de frutas: aqui o toldo cobre só o fundo e o miolo da barraca fica à mostra, com os dois jogos. A 25% de
 * zoom sobram a faixa listrada atrás, o montinho de latas coloridas à esquerda, a grade de pontos verdes com os
 * aros de cor à direita e o balcão claro na frente.
 *
 * Na 3/4 (perfil derivado) o pedestal, a mesa das argolas, o balcão, a prateleira e os esteios são colunas, e as
 * garrafas sobem com a mesa; o tablado fica rente ao chão; o toldo é um tampo solto no alto dos esteios, e a sanefa
 * sobe com ele. A estrutura do toldo tem um vão em cima da prateleira, para os prêmios não subirem com o pano (ver
 * `montarToldo`). Materiais: `toldo` (tecido; as
 * listras são de linho cru, ou de vinho no toldo de linho) e `madeira` (o tablado, o pedestal, a mesa, o balcão e
 * os esteios). As latas, as garrafas, as argolas, as bolas, o cesto e as moedas são fixos. As posições saem de
 * frações da pegada (2 x 1,5 casas de partida); as latas, as garrafas e as argolas têm tamanho fixo.
 */
import { anel, barra, capsula, caixa, dentroDe, elipse, menos, type Caixa, type Forma } from './formas'
import { bordaDaSombra, contato, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type Peca } from './motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** As alturas, em casas. */
const ALTURA_DO_PEDESTAL = 0.55
const ALTURA_DA_MESA = 0.42
/** O balcão é baixo (meia casa): na 3/4, mais alto, a frente dele escondia os dois jogos. */
const ALTURA_DO_BALCAO = 0.5
const ALTURA_DA_PRATELEIRA = 0.85
const ALTURA_DO_TOLDO = 1.55

/** O toldo: do fundo até a beira da frente, e até onde descem os gomos da sanefa (frações da meia pegada). */
const TOLDO_Y0 = -0.99
const TOLDO_Y1 = -0.52
const GOMOS_Y1 = -0.43
const FAIXAS_DO_TOLDO = 9
/** Os esteios: o lado (px do protótipo) e o lugar (fração da meia pegada). */
const LADO_DO_ESTEIO = 3.6
const ESTEIO_X = 0.94

/** O pedestal das latas e a mesa das argolas (frações da meia pegada). */
const PEDESTAL = { x0: -0.86, x1: -0.36, y0: -0.38, y1: 0.24 } as const
const MESA = { x0: 0.04, x1: 0.92, y0: -0.38, y1: 0.48 } as const
const BALCAO = { x0: -0.97, x1: 0.97, y0: 0.64, y1: 0.97 } as const
/** A prateleira dos prêmios, debaixo do toldo: de cima fica escondida; na 3/4 o toldo sobe e ela aparece. */
const PRATELEIRA = { x0: -0.84, x1: 0.84, y0: -0.95, y1: -0.64 } as const
const PREMIOS = 7

/** A lata (px do protótipo): o raio e o passo da pirâmide. */
const RAIO_DA_LATA = 3.3
const PASSO_DA_LATA = 6.9
/** As garrafas: colunas e fileiras, e os raios do bojo, do gargalo e da boca (px do protótipo). */
const COLUNAS_DE_GARRAFAS = 4
const FILEIRAS_DE_GARRAFAS = 3
const RAIO_DO_BOJO = 3.3
const RAIO_DO_GARGALO = 1.35
const RAIO_DA_BOCA = 0.7
/** A argola: o raio de fora e o de dentro (px do protótipo). */
const ARGOLA_FORA = 4
const ARGOLA_DENTRO = 2.9

// ---------- as cores ----------

const LATA_VERMELHA: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0x5a, 0x4c] }
const LATA_CREME: MaterialDaPeca = { classe: 'metal', rgb: [0xd6, 0xcc, 0xb4] }
const LATA_AZUL: MaterialDaPeca = { classe: 'metal', rgb: [0x5c, 0x70, 0x96] }
const CORES_DAS_LATAS: readonly MaterialDaPeca[] = [LATA_VERMELHA, LATA_CREME, LATA_AZUL]
const FOLHA_DE_FLANDRES: MaterialDaPeca = { classe: 'metal', rgb: [0xa6, 0xa8, 0xa8] }
const VIDRO_VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0x58, 0x7a, 0x60] }
const ARGOLA_VERMELHA: MaterialDaPeca = { classe: 'liso', rgb: [0xb0, 0x5a, 0x4c] }
const ARGOLA_AMARELA: MaterialDaPeca = { classe: 'liso', rgb: [0xd2, 0xb2, 0x5e] }
const ARGOLA_AZUL: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x74, 0x9c] }
const CORES_DAS_ARGOLAS: readonly MaterialDaPeca[] = [ARGOLA_VERMELHA, ARGOLA_AMARELA, ARGOLA_AZUL]
const BOLA_VERMELHA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0xa4, 0x58, 0x4c] }
const BOLA_AZUL: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x58, 0x6a, 0x8e] }
const BOLA_OCRE: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0xb4, 0x90, 0x56] }
const BOCA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x3a, 0x32] }
/** Os prêmios: o urso de pelúcia (o pelo, o focinho) e a boneca de pano (a pele, o cabelo, os vestidos). */
const PELUCIA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x9a, 0x74, 0x52] }
const FOCINHO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0xd8, 0xc4, 0xa2] }
const PELE: MaterialDaPeca = { classe: 'liso', rgb: [0xe0, 0xc6, 0xa6] }
const CABELO: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x4c, 0x36] }
const VESTIDOS: readonly MaterialDaPeca[] = [BOLA_VERMELHA, BOLA_AZUL]
const PALHA = materialDaPeca('palha')
const LATAO = materialDaPeca('latao')
const FUNDO_DO_CESTO: MaterialDaPeca = { classe: 'palha', rgb: [0x8a, 0x76, 0x4a] }

/** A cor das listras: linho cru; no toldo de linho, vinho (linho sobre linho dava um toldo liso). */
function listraDoToldo(toldo: MaterialDaPeca): MaterialDaPeca {
  return materialDaPeca(toldo.fio === 'linho' ? 'vinho' : 'linho')
}

/** Uma lata em pé vista de cima: a borda de folha de flandres e a tampa pintada, um pouco funda. */
function lataEmPe(c: ContextoDoMovel, L: Peca[], x: number, y: number, tinta: MaterialDaPeca, tom: number, sem: number): void {
  const P = c.peca
  const r = RAIO_DA_LATA
  L.push(P(elipse(x, y, r, r), FOLHA_DE_FLANDRES, { tabua: 0, bisel: 0.7, contorno: 0.3, metal: 0.5, tom, semente: sem, projeta: { dist: 1.4, forca: 0.4, suave: 0.8 } }))
  L.push(P(elipse(x, y, r * 0.78, r * 0.78), tinta, { tabua: 0, bisel: 0.4, contorno: 0.1, metal: 0.25, tom, recesso: { k: 0.9, forca: 0.3 }, semente: sem + 1 }))
}

/** Uma lata caída, deitada no rumo `ang`: o corpo pintado, as duas bordas e o fundo à mostra numa ponta. */
function lataDeitada(c: ContextoDoMovel, cena: Cena, x: number, y: number, ang: number, tinta: MaterialDaPeca, sem: number): void {
  const P = c.peca
  const L = cena.partes
  const r = RAIO_DA_LATA
  const meia = r * 1.15
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  // De ponta reta (a cápsula de pontas redondas lia como pílula).
  const corpo = barra(x - co * meia, y - si * meia, x + co * meia, y + si * meia, r * 1.96)
  cena.sombras.push(contato(corpo, 0.34))
  L.push(P(corpo, tinta, { tabua: 0, eixo: ang, bisel: r * 0.8, contorno: 0.3, metal: 0.3, semente: sem }))
  for (const lado of [-1, 1]) {
    const bx = x + co * meia * lado
    const by = y + si * meia * lado
    L.push(P(capsula(bx - si * r * 0.9, by + co * r * 0.9, bx + si * r * 0.9, by - co * r * 0.9, 0.6), FOLHA_DE_FLANDRES, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.5, semente: sem + 1 }))
  }
}

/** Uma bola de pano. */
function bola(c: ContextoDoMovel, L: Peca[], x: number, y: number, r: number, pano: MaterialDaPeca, sem: number): void {
  L.push(c.peca(elipse(x, y, r, r), pano, { tabua: 0, bisel: r * 0.8, contorno: 0.3, semente: sem, projeta: { dist: 0.9, forca: 0.36 } }))
}

/** Uma argola deitada, de madeira pintada. */
function argola(c: ContextoDoMovel, L: Peca[], x: number, y: number, tinta: MaterialDaPeca, tom: number, sem: number): void {
  L.push(c.peca(anel(x, y, ARGOLA_FORA, ARGOLA_FORA, ARGOLA_DENTRO, ARGOLA_DENTRO), tinta, { tabua: 0, bisel: 0.55, contorno: 0.32, tom, semente: sem, projeta: { dist: 0.8, forca: 0.36 } }))
}

/**
 * A mesma forma com outra caixa de pintura (como no toldo listrado): a 3/4 lê o meio da caixa para saber com que
 * estrutura a peça sobe. A caixa é esticada para baixo até o meio cair em `yAlvo`; continua contendo a forma.
 */
function comMeioEm(f: Forma, yAlvo: number): Forma {
  const [x0, y0, x1, y1] = f.b
  const b: Caixa = [x0, y0, x1, Math.max(y1, 2 * yAlvo - y0)]
  return { b, d: (x, y) => f.d(x, y) }
}

/** A forma levada `dx`, `dy` (a sombra do pano no chão, já deslocada como a de um tampo solto naquela altura). */
function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/**
 * O tablado de tábuas por baixo de tudo, rente ao chão: sem altura. Com altura ele era a estrutura mais ao sul
 * da 3/4, pintada por último, e cobria o pedestal, a mesa e a prateleira.
 */
function montarTablado(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh } = c
  const forma = caixa(-hw * 0.99, -hh * 0.99, hw * 0.99, hh * 0.99, 0.8)
  cena.sombras.push(contato(forma, 0.3))
  cena.partes.push(c.peca(forma, c.m.madeira, { tabua: 6.2, bisel: 0.9, contorno: 0.3, tom: 0.84, semente: 3000 }))
}

/** O jogo de derrubar latas: o pedestal, a pirâmide e, no tablado, as latas que caíram e uma bola. */
function montarDerrubarLatas(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  // O que já caiu, no tablado, na frente do pedestal.
  lataDeitada(c, cena, hw * -0.5, hh * 0.38, 0.5, LATA_AZUL, 3100)
  lataDeitada(c, cena, hw * -0.33, hh * 0.31, -0.35, LATA_VERMELHA, 3105)
  lataDeitada(c, cena, hw * -0.7, hh * 0.44, 1.9, LATA_CREME, 3110)
  bola(c, L, hw * -0.16, hh * 0.45, 2.5, BOLA_VERMELHA, 3115)

  const x0 = PEDESTAL.x0 * hw
  const x1 = PEDESTAL.x1 * hw
  const y0 = PEDESTAL.y0 * hh
  const y1 = PEDESTAL.y1 * hh
  const pedestal = caixa(x0, y0, x1, y1, 0.8)
  cena.sombras.push({ forma: pedestal, z: c.g * (ALTURA_DO_PEDESTAL + 0.2) }, contato(pedestal, 0.32))
  L.push(P(pedestal, c.m.madeira, { tabua: (y1 - y0) / 4, bisel: 1, contorno: 0.3, tom: 0.96, semente: 3120 }))

  // A pirâmide: 3 x 3 no tampo, 2 x 2 por cima, nos vãos, e uma no alto; as de cima mais claras e com sombra nas de baixo.
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  let k = 0
  for (const [lado, tom] of [[3, 0.9], [2, 1], [1, 1.1]] as const) {
    for (let i = 0; i < lado; i += 1) {
      for (let j = 0; j < lado; j += 1) {
        const x = cx + (i - (lado - 1) / 2) * PASSO_DA_LATA
        const y = cy + (j - (lado - 1) / 2) * PASSO_DA_LATA
        lataEmPe(c, L, x, y, CORES_DAS_LATAS[(i + j * 2 + lado) % CORES_DAS_LATAS.length], tom, 3130 + k * 2)
        k += 1
      }
    }
  }
}

/** O jogo das argolas: a mesa baixa, as doze garrafas e as argolas (no gargalo e caídas). */
function montarArgolas(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const x0 = MESA.x0 * hw
  const x1 = MESA.x1 * hw
  const y0 = MESA.y0 * hh
  const y1 = MESA.y1 * hh
  const mesa = caixa(x0, y0, x1, y1, 1)
  cena.sombras.push({ forma: mesa, z: c.g * ALTURA_DA_MESA }, contato(mesa, 0.3))
  L.push(P(mesa, c.m.madeira, { tabua: (y1 - y0) / 5, bisel: 1, contorno: 0.3, tom: 1.04, semente: 3200 }))
  // As duas faixas pintadas no tampo, atrás da cor do toldo e na frente da das listras: dizem "jogo" e não "mesa".
  L.push(P(caixa(x0 + 0.8, y0 + 0.8, x1 - 0.8, y0 + 2.4, 0.6), c.m.toldo, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.75, semente: 3201 }))
  L.push(P(caixa(x0 + 0.8, y1 - 2.4, x1 - 0.8, y1 - 0.8, 0.6), listraDoToldo(c.m.toldo), { tabua: 0, bisel: 0, contorno: 0, alfa: 0.75, semente: 3202 }))

  const passoX = (x1 - x0) / COLUNAS_DE_GARRAFAS
  const passoY = (y1 - y0 - 3) / FILEIRAS_DE_GARRAFAS
  // Argolas caídas no tampo, entre as garrafas (por baixo delas).
  argola(c, L, x0 + passoX * 1, y0 + 1.5 + passoY * 2.05, ARGOLA_AZUL, 1, 3210)
  argola(c, L, x0 + passoX * 3.05, y0 + 1.5 + passoY * 1.02, ARGOLA_VERMELHA, 1, 3211)
  argola(c, L, x0 + passoX * 2.0, y0 + 1.5 + passoY * 0.0 + 0.6, ARGOLA_AMARELA, 1, 3212)

  // As garrafas, três com a argola enfiada no gargalo. Não são colunas: a coluna de uma coisa em cima da mesa é
  // pintada antes da mesa (a base dela fica ao norte da beira da mesa) e a mesa a cobria. Sobem com a mesa, e a
  // sombra delas cai no tampo (`projeta`).
  const comArgola = new Map<number, MaterialDaPeca>([[1, ARGOLA_AMARELA], [6, ARGOLA_AZUL], [8, ARGOLA_VERMELHA]])
  for (let j = 0; j < FILEIRAS_DE_GARRAFAS; j += 1) {
    for (let i = 0; i < COLUNAS_DE_GARRAFAS; i += 1) {
      const n = j * COLUNAS_DE_GARRAFAS + i
      const x = x0 + passoX * (i + 0.5)
      const y = y0 + 1.5 + passoY * (j + 0.5)
      const bojo = elipse(x, y, RAIO_DO_BOJO, RAIO_DO_BOJO)
      const sem = 3220 + n * 4
      L.push(P(bojo, VIDRO_VERDE, { tabua: 0, bisel: RAIO_DO_BOJO * 0.8, contorno: 0.3, metal: 0.55, tom: 0.9, alfa: 0.94, semente: sem, projeta: { dist: 2.2, forca: 0.36, suave: 1.2 } }))
      // O gargalo com o anel da boca, mais claro, e a boca aberta, escura: o furo no meio diz "garrafa", e não "bola".
      L.push(P(elipse(x, y, RAIO_DO_GARGALO, RAIO_DO_GARGALO), VIDRO_VERDE, { tabua: 0, bisel: RAIO_DO_GARGALO * 0.5, contorno: 0.3, metal: 0.6, tom: 1.18, semente: sem + 1, projeta: { dist: 0.8, forca: 0.32 } }))
      L.push(P(elipse(x, y, RAIO_DA_BOCA, RAIO_DA_BOCA), BOCA, { tabua: 0, bisel: 0, contorno: 0.2, semente: sem + 2 }))
      const tinta = comArgola.get(n)
      if (tinta !== undefined) argola(c, L, x + 0.4, y + 0.3, tinta, 1.08, sem + 3)
    }
  }
}

/** O balcão da frente: o tampo de tábuas e, nele, o cesto de bolas, a lata do dinheiro e a pilha de argolas. */
function montarBalcao(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const x0 = BALCAO.x0 * hw
  const x1 = BALCAO.x1 * hw
  const y0 = BALCAO.y0 * hh
  const y1 = BALCAO.y1 * hh
  const balcao = caixa(x0, y0, x1, y1, 1)
  cena.sombras.push({ forma: balcao, z: c.g * ALTURA_DO_BALCAO }, contato(balcao, 0.32))
  L.push(P(balcao, c.m.madeira, { tabua: (y1 - y0) / 3, bisel: 1.1, contorno: 0.32, tom: 1.08, semente: 3300 }))
  const cy = (y0 + y1) / 2
  const fundo = y1 - y0

  // O cesto de vime com as bolas de pano.
  const cx = x0 + (x1 - x0) * 0.12
  const rc = fundo * 0.44
  L.push(P(elipse(cx, cy, rc, rc), PALHA, { eixo: 0.3, bisel: 1.2, contorno: 0.3, semente: 3301, projeta: { dist: 1.1, forca: 0.34 } }))
  L.push(P(elipse(cx, cy, rc * 0.78, rc * 0.78), FUNDO_DO_CESTO, { eixo: 1.2, bisel: 0.3, contorno: 0.1, recesso: { k: 1.6, forca: 0.36 }, semente: 3302 }))
  bola(c, L, cx - rc * 0.32, cy - rc * 0.24, rc * 0.36, BOLA_AZUL, 3303)
  bola(c, L, cx + rc * 0.34, cy - rc * 0.1, rc * 0.36, BOLA_OCRE, 3304)
  bola(c, L, cx - rc * 0.02, cy + rc * 0.34, rc * 0.36, BOLA_VERMELHA, 3305)
  bola(c, L, x0 + (x1 - x0) * 0.24, cy + fundo * 0.08, rc * 0.34, BOLA_OCRE, 3306)

  // A lata do dinheiro, aberta, com as moedas, e a tampa encostada ao lado.
  const lx = x0 + (x1 - x0) * 0.56
  const meia = fundo * 0.26
  L.push(P(caixa(lx + meia * 1.2, cy - meia * 0.9, lx + meia * 2.9, cy + meia * 0.9, 0.6), LATAO, { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.92, semente: 3310, projeta: { dist: 0.6, forca: 0.3 } }))
  L.push(P(caixa(lx - meia, cy - meia, lx + meia, cy + meia, 0.7), LATAO, { tabua: 0, bisel: 0.6, contorno: 0.32, semente: 3311, projeta: { dist: 0.8, forca: 0.34 } }))
  L.push(P(caixa(lx - meia + 0.9, cy - meia + 0.9, lx + meia - 0.9, cy + meia - 0.9, 0.4), FUNDO_DO_CESTO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.7, recesso: { k: 1.2, forca: 0.36 }, semente: 3312 }))
  for (const [fx, fy] of [[-0.4, -0.3], [0.25, -0.35], [-0.1, 0.25], [0.42, 0.3]]) {
    L.push(P(elipse(lx + fx * meia, cy + fy * meia, 1.05, 1.05), LATAO, { tabua: 0, bisel: 0.6, contorno: 0.28, metal: 0.6, tom: 1.08, semente: 3313 }))
  }

  // A pilha de argolas, cada uma um pouco fora da de baixo.
  const ax = x0 + (x1 - x0) * 0.84
  for (let i = 0; i < 4; i += 1) argola(c, L, ax + i * 0.7, cy - i * 0.5, CORES_DAS_ARGOLAS[i % CORES_DAS_ARGOLAS.length], 0.94 + i * 0.05, 3320 + i)
}

/** Um prêmio sentado de frente (para o sul): o urso de pelúcia ou a boneca de pano, vistos do alto. */
function premio(c: ContextoDoMovel, L: Peca[], x: number, y: number, i: number, sem: number): void {
  const P = c.peca
  const pano = { tabua: 0, contorno: 0.3, projeta: { dist: 0.8, forca: 0.34 } }
  if (i % 2 === 0) {
    L.push(P(elipse(x, y - 0.6, 2.7, 2.4), PELUCIA, { ...pano, bisel: 1.6, semente: sem }))
    for (const lado of [-1, 1]) L.push(P(elipse(x + lado * 1.6, y - 0.2, 0.9, 0.9), PELUCIA, { ...pano, bisel: 0.6, tom: 0.86, semente: sem + 1 }))
    L.push(P(elipse(x, y + 0.9, 2.1, 2.1), PELUCIA, { ...pano, bisel: 1.3, tom: 1.06, semente: sem + 2 }))
    L.push(P(elipse(x, y + 2.1, 0.95, 0.8), FOCINHO, { ...pano, bisel: 0.5, semente: sem + 3 }))
    return
  }
  L.push(P(elipse(x, y - 0.4, 2.8, 2.2), VESTIDOS[(i >> 1) % VESTIDOS.length], { ...pano, bisel: 1.4, semente: sem }))
  L.push(P(elipse(x, y + 0.5, 1.75, 1.75), CABELO, { ...pano, bisel: 1, semente: sem + 1 }))
  L.push(P(elipse(x, y + 1.1, 1.45, 1.45), PELE, { ...pano, bisel: 0.9, semente: sem + 2 }))
}

/** A prateleira dos prêmios, debaixo do toldo, com os ursos e as bonecas enfileirados. */
function montarPrateleira(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const x0 = PRATELEIRA.x0 * hw
  const x1 = PRATELEIRA.x1 * hw
  const y0 = PRATELEIRA.y0 * hh
  const y1 = PRATELEIRA.y1 * hh
  const forma = caixa(x0, y0, x1, y1, 0.8)
  cena.sombras.push({ forma, z: c.g * ALTURA_DA_PRATELEIRA }, contato(forma, 0.3))
  cena.partes.push(P(forma, c.m.madeira, { tabua: (y1 - y0) / 2, bisel: 1, contorno: 0.3, tom: 0.9, semente: 3500 }))
  const passo = (x1 - x0) / PREMIOS
  for (let i = 0; i < PREMIOS; i += 1) premio(c, cena.partes, x0 + passo * (i + 0.5), (y0 + y1) / 2, i, 3510 + i * 4)
}

/** O toldo listrado de uma água no alto dos esteios, com a sanefa em gomos na beira da frente. */
function montarToldo(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const toldo = c.m.toldo
  const listra = listraDoToldo(toldo)
  const x0 = -hw * 0.99
  const x1 = hw * 0.99
  const y0 = TOLDO_Y0 * hh
  const y1 = TOLDO_Y1 * hh
  const yGomos = GOMOS_Y1 * hh
  // A estrutura do pano vai até a ponta dos gomos (na 3/4 eles sobem com ele) e tem um VÃO em cima da prateleira:
  // sem o vão, a prateleira e os prêmios (o meio deles fica debaixo do pano) subiam com o pano e sumiam debaixo
  // dele. Ela não pinta sombra (força 0); a sombra que se vê no chão é a do pano inteiro, já deslocada para longe.
  // As peças do pano têm a caixa esticada até a faixa da frente, fora do vão (`comMeioEm`).
  const z = c.g * ALTURA_DO_TOLDO
  const pano0 = caixa(x0, y0, x1, yGomos, 1.5)
  const vao = caixa(PRATELEIRA.x0 * hw - 0.6, PRATELEIRA.y0 * hh - 0.6, PRATELEIRA.x1 * hw + 0.6, PRATELEIRA.y1 * hh + 0.6)
  cena.sombras.push(
    { forma: menos(pano0, vao), z, solta: true, forca: 0 },
    { forma: deslocada(pano0, SOMBRA_X * z, SOMBRA_Y * z), z: 0, suave: bordaDaSombra({ z }), forca: 0.3 },
  )
  const yDaFaixa = (PRATELEIRA.y1 * hh + 0.6 + yGomos) / 2
  const naFaixa = (f: Forma): Forma => comMeioEm(f, yDaFaixa)

  // Os quatro esteios: os de trás escondidos debaixo do pano (na 3/4 seguram o fundo), os da frente na beira.
  for (const [fx, fy] of [[-ESTEIO_X, TOLDO_Y0 + 0.04], [ESTEIO_X, TOLDO_Y0 + 0.04], [-ESTEIO_X, TOLDO_Y1 + 0.02], [ESTEIO_X, TOLDO_Y1 + 0.02]]) {
    const ex = fx * hw
    const ey = fy * hh
    const esteio = caixa(ex - LADO_DO_ESTEIO / 2, ey - LADO_DO_ESTEIO / 2, ex + LADO_DO_ESTEIO / 2, ey + LADO_DO_ESTEIO / 2, 0.5)
    cena.sombras.push({ forma: esteio, z: c.g * ALTURA_DO_TOLDO, forca: 0.24 }, contato(esteio, 0.3))
    L.push(P(esteio, c.m.madeira, { tabua: 0, eixo: QUARTO, bisel: 0.9, contorno: 0.3, tom: 0.9, semente: 3400 }))
  }

  // O pano em faixas, um pouco na sombra (é inclinado para a frente), e a ripa de trás.
  const banda = (x1 - x0) / FAIXAS_DO_TOLDO
  const pano = { tabua: 0, bisel: 1.2, ruga: 1.1, contorno: 0.24 }
  L.push(P(naFaixa(caixa(x0, y0, x1, y1, 1.2)), toldo, { ...pano, bisel: 2, tom: 0.9, semente: 3410 }))
  for (let i = 1; i < FAIXAS_DO_TOLDO; i += 2) {
    const bx = x0 + banda * i
    L.push(P(naFaixa(caixa(bx, y0, bx + banda, y1, 0.4)), listra, { ...pano, contorno: 0, tom: 0.9, semente: 3411 + i }))
  }
  L.push(P(naFaixa(capsula(x0 + 1.5, y0 + 1.6, x1 - 1.5, y0 + 1.6, 1.3)), c.m.madeira, { tabua: 0, bisel: 1, contorno: 0.3, tom: 1.05, semente: 3430 }))
  // A sanefa: um meio-disco por faixa, da cor da faixa, um pouco mais escuro (cai de pé, longe da luz).
  for (let i = 0; i < FAIXAS_DO_TOLDO; i += 1) {
    const xc = x0 + banda * (i + 0.5)
    const gomo: Forma = dentroDe(elipse(xc, y1, banda / 2, yGomos - y1), caixa(xc - banda / 2, y1 - 0.4, xc + banda / 2, yGomos))
    L.push(P(gomo, i % 2 === 1 ? listra : toldo, { tabua: 0, bisel: 1.2, ruga: 1.1, contorno: 0.26, tom: 0.76, semente: 3440 + i }))
  }
  // A beira de pano dobrada, por cima da emenda dos gomos.
  L.push(P(caixa(x0, y1 - 1.2, x1, y1 + 0.5, 0.5), toldo, { tabua: 0, bisel: 0.5, ruga: 1.1, contorno: 0.24, tom: 1.02, semente: 3450 }))
}

export const montarBarracaDeJogosDaFeira: MontarMovel = (c, cena) => {
  montarTablado(c, cena)
  montarPrateleira(c, cena)
  montarDerrubarLatas(c, cena)
  montarArgolas(c, cena)
  montarBalcao(c, cena)
  montarToldo(c, cena)
}
