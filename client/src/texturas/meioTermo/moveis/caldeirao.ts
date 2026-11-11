/**
 * CALDEIRÃO de cima com volume (lote 2 dos objetos novos, 11/11/2026): o
 * caldeirão de ferro preto, bojudo, apoiado em TRÊS PEDRAS por cima do fogo
 * de chão. De baixo para cima: o LEITO de cinza (a beira roída, mais clara
 * para fora e queimada no meio), as três TORAS cruzadas, carvão por fora e
 * cinza clara nas pontas, as BRASAS nos três vãos entre as pedras e debaixo
 * do bojo, o clarão quente em volta, as três pedras e o caldeirão: o BOJO, o
 * beiço da boca, o CALDO (com a sombra do beiço, as rodelas de cenoura, a
 * batata, a couve e as bolhas), a CONCHA de madeira encostada na beira e a
 * ALÇA de ferro caída para o fundo, presa nas duas orelhas.
 *
 * O fogo é só PINTURA (decisão do mestre): não há chama animada nem Aceso /
 * Apagado. A brasa é a da fogueira (`fogueira.ts`), contida.
 *
 * NA 3/4 o caldeirão não é um cilindro. `tresQuartos.ts` sobe cada peça com a
 * estrutura mais alta que contém o meio da caixa dela, e a sombra com altura é
 * a estrutura. Aqui as estruturas do caldeirão são PINOS, pontos de um décimo
 * de px, sem sombra, cravados no meio das peças (só o meio exato cai neles: uma
 * brasa do chão não sobe por engano):
 * - o pino do BOJO o sobe até a altura da barriga. O bojo é um disco só, com
 *   o chanfro de esfera: de cima sobra dele o ombro em volta da boca; na 3/4 é
 *   a barriga redonda vista de frente;
 * - os pinos da BOCA (o beiço, o caldo e o que está nele, a concha, a alça)
 *   sobem mais um pouco: a boca aparece no alto da barriga, como em quem olha
 *   de cima e de frente;
 * - o chão não tem pino: o leito, as toras e as brasas ficam onde estão, e o
 *   fogo aparece DEBAIXO do caldeirão. As pedras são colunas baixas.
 * O bojo fica um nada para a frente da boca, para os dois pinos não caírem no
 * mesmo ponto. Os pinos giram com o objeto, como tudo; a sombra do caldeirão
 * pintada no leito lê o quarto de volta que a 3/4 pinta (`c.giro`) e cai
 * sempre para baixo à direita na tela.
 *
 * A 25% de zoom sobram o anel preto, o disco castanho do caldo com o risco
 * claro da concha e os pontos de brasa em volta: é o que diz "caldeirão" e não
 * "barril" nem "poço". As medidas saem do menor lado da pegada (1 x 1 casa de
 * partida) e as posições, de frações dela. Materiais: `metal` (o caldeirão) e
 * `pedras` (as três de apoio).
 */
import { hash, limitar01, type Rgb } from '../../ruido'
import { anel, cadeia, capsula, elipse, elipseGirada, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { CINZA, G, materialDaPeca, QUARTO, type MontarMovel } from './contexto'
import { CARVAO_FRIO, FOGO_PARADO, texBrasa, texLenhaQueimada } from './fogoDeCasa'
import { BRASA_QUENTE } from './fogueira'

/** O desenho foi medido numa casa (28 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIA_CASA = G / 2
const GRAUS = Math.PI / 180

/**
 * Altura da boca do caldeirão e das pedras de apoio, em fração do menor lado (0,44 e 0,14 casa no tamanho de
 * partida). Com 0,55 a barriga ficava solta no ar, longe das pedras; com 0,44 o fundo dela encosta no fogo.
 */
const ALTURA_DA_BOCA = 0.44
const ALTURA_DAS_PEDRAS = 0.14
/** Quanto a barriga fica abaixo da boca na 3/4, em fração do menor meio lado: é o que faz o bojo aparecer. */
const DESCIDA_DO_BOJO = 0.27
/** O raio do bojo, em fração da meia pegada, e o recuo dele para o fundo: sobra mais fogo na frente, o lado que a 3/4 mostra. */
const RAIO_DO_BOJO = 0.66
const RECUO_DO_BOJO = 0.05
/** A boca fica este tanto atrás do meio do bojo (fração do menor meio lado): os dois pinos não podem coincidir. */
const RECUO_DA_BOCA = 0.036
/** Os raios da boca, em fração do raio do bojo: o beiço por fora e por dentro, a parede de dentro e o caldo. */
const BEICO_DE_FORA = 0.77
const BEICO_DE_DENTRO = 0.66
const PAREDE_DE_DENTRO = 0.595
const RAIO_DO_CALDO = 0.615
/** O raio do pino, em fração do menor meio lado: um décimo de px na casa de partida (só o meio exato da peça cai nele). */
const RAIO_DO_PINO = 0.004

/**
 * O ferro preto: o metal escolhido bem abaixo, ainda acima do piso de luz na face clara. O beiço e as orelhas
 * ficam no tom do metal, e a alça acima dele: polida pela mão, é o risco claro que se lê contra o bojo.
 */
const TOM_DO_FERRO_PRETO = 0.7
const TOM_DO_BEICO = 1.02
const TOM_DA_ALCA = 1.3
/**
 * O escuro em que o pixel escuro demais é levantado: o cinza-escuro quente do canhão (`canhao.ts`). Com o
 * piso padrão (a nogueira) o lado da sombra do bojo saía marrom, e o caldeirão ficava de duas cores.
 */
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
/** O caldo castanho, os legumes e a espuma das bolhas: cores próprias e contidas, como a comida dos pratos. */
const CALDO: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x6e, 0x44] }
const CENOURA: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0x86, 0x54] }
const BATATA: MaterialDaPeca = { classe: 'liso', rgb: [0xd9, 0xc6, 0x98] }
const COUVE: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x93, 0x58] }
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xcf, 0xa8] }
/** A sombra do caldeirão pintada no leito: o chão do motor fica debaixo das peças, e o leito cobre o chão. */
const SOMBRA_NO_LEITO: MaterialDaPeca = { classe: 'liso', rgb: [0x1c, 0x16, 0x12] }
const ALFA_DA_SOMBRA_NO_LEITO = 0.36
/** Quanto ela cai para a direita e para baixo do meio do bojo, em px da casa de partida. */
const SOMBRA_NO_LEITO_X = 2.6
const SOMBRA_NO_LEITO_Y = 3

/** O leito: até onde a cinza vai (fração da meia pegada), quanto o ruído rói a beira e a largura do esfumado. */
const BEIRA_DO_LEITO = 0.87
const RECORTE_DA_BEIRA = 0.2
const ESFUMADO_DA_BEIRA = 0.07
/** O miolo queimado do leito: escurece do raio para dentro. */
const RAIO_DO_QUEIMADO = 0.72
const FORCA_DO_QUEIMADO = 0.34
/** O clarão das brasas: cheio até o miolo, some na beira; alfa no cheio (o halo da fogueira é 0,2). */
const MIOLO_DO_CLARAO = 0.4
const BEIRA_DO_CLARAO = 0.92
const ALFA_DO_CLARAO = 0.3

/** As três pedras de apoio: o ângulo de cada uma (a de trás e as duas da frente) e o raio em que ficam. */
const PEDRAS: readonly number[] = [270, 30, 150]
const RAIO_DAS_PEDRAS = 0.74
/**
 * As três toras, cruzadas no meio do fogo: o ângulo, o meio comprimento (fração do menor meio lado) e o
 * desvio do meio (px da casa de partida). As seis pontas caem nos vãos, nunca debaixo de uma pedra.
 */
const TORAS: readonly (readonly [angulo: number, meia: number, dx: number, dy: number])[] = [
  [3, 0.93, -1.5, -0.4],
  [63, 0.88, 1.6, 0.6],
  [118, 0.95, -1.6, 1.5],
]
const RAIO_DA_TORA = 0.084
/** Até onde a tora é carvão (fração do menor meio lado, a partir do meio do fogo) e quanto. */
const RAIO_DO_CARVAO_DA_TORA = 0.86
const FORCA_DO_CARVAO_DA_TORA = 0.62

/** As brasas dos três vãos entre as pedras, as que se veem de cima: ângulo, raio (fração da meia pegada) e tamanho (px). */
const BRASAS_DOS_VAOS: readonly (readonly [angulo: number, raio: number, tamanho: number])[] = [
  [78, 0.76, 2],
  [97, 0.82, 1.7],
  [89, 0.92, 1.3],
  [106, 0.73, 1.8],
  [199, 0.77, 1.8],
  [215, 0.84, 1.5],
  [228, 0.75, 1.9],
  [318, 0.76, 1.9],
  [333, 0.85, 1.5],
  [347, 0.75, 1.7],
]
/** As brasas debaixo do bojo, as que a 3/4 mostra: x, y e tamanho, em px da casa de partida a partir do meio do fogo. */
const BRASAS_DE_BAIXO: readonly (readonly [x: number, y: number, tamanho: number])[] = [
  [0.4, 4.2, 1.8],
  [-5.2, 2.3, 1.6],
  [5.6, 3.1, 1.7],
  [2.2, 9.1, 1.5],
  [-3.4, 8.6, 1.6],
  [8.3, -2.2, 1.4],
  [-8.6, -1.7, 1.5],
  [-1.1, -4.3, 1.4],
  [9.6, 7.2, 1.4],
  [-9.2, 6.4, 1.3],
  [0.7, 13.6, 1.6],
  [-6.1, 13.1, 1.3],
  [6.4, 12.4, 1.4],
]
/** Os carvões apagados entre as brasas: ângulo, raio (fração da meia pegada) e tamanho (px). */
const CARVOES: readonly (readonly [angulo: number, raio: number, tamanho: number])[] = [
  [70, 0.86, 1.3],
  [112, 0.86, 1.2],
  [84, 0.66, 1.4],
  [207, 0.9, 1.1],
  [222, 0.66, 1.3],
  [326, 0.92, 1.2],
  [340, 0.65, 1.3],
  [190, 0.68, 1.2],
]

/** O que boia no caldo: x e y em fração do raio do caldo a partir do meio da boca, o que é, e o giro. */
type Legume = 'cenoura' | 'batata' | 'couve'
const LEGUMES: readonly (readonly [x: number, y: number, tipo: Legume, giro: number])[] = [
  [-0.5, -0.32, 'cenoura', 0],
  [0.3, -0.56, 'cenoura', 0],
  [-0.2, 0.62, 'cenoura', 0],
  [-0.24, -0.66, 'batata', 0.5],
  [-0.66, 0.26, 'batata', -0.4],
  [0.58, -0.3, 'batata', 1.1],
  [0.04, -0.24, 'couve', 0.7],
  [-0.42, 0.08, 'couve', -0.9],
  [0.34, 0.72, 'couve', 0.2],
]
/** As bolhas: x e y em fração do raio do caldo, e o raio em px da casa de partida. */
const BOLHAS: readonly (readonly [x: number, y: number, raio: number])[] = [
  [-0.08, -0.46, 1.2],
  [0.44, 0.02, 0.9],
  [-0.34, 0.42, 1.3],
  [0.1, 0.44, 0.8],
  [-0.64, -0.1, 0.9],
]
/** A concha: a cuia mergulhada e a ponta do cabo, por cima da beira da frente, em fração do raio do bojo a partir do meio da boca. */
const CUIA_DA_CONCHA: Ponto = [0.05, 0.1]
const PONTA_DA_CONCHA: Ponto = [0.93, 0.74]
/** A alça caída para o fundo: de uma orelha à outra pelo lado de trás, no raio dela (fração do raio do bojo). */
const ORELHAS: readonly [number, number] = [200, 340]
const RAIO_DA_ALCA = 0.9
const PASSOS_DA_ALCA = 14

/** O leito de cinza: a variação miúda da cinza, mais clara para fora, queimada no meio, e a beira roída que some no chão. */
function texLeito(hw: number, hh: number, k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const rr = Math.hypot(x / hw, y / hh)
    const xs = x / k
    const ys = y / k
    const miudo = ruido(xs * 0.3 + 11, ys * 0.3) + ruido(xs * 0.85 + 3, ys * 0.85 + 7) * 0.5
    const queimado = FORCA_DO_QUEIMADO * limitar01((RAIO_DO_QUEIMADO - rr) / RAIO_DO_QUEIMADO)
    s[3] += ruido(xs * 0.12, ys * 0.12) * 0.16 + miudo * 0.08 + (rr - 0.6) * 0.16 - queimado
    const beira = BEIRA_DO_LEITO + ruido(xs * 0.21 + 31, ys * 0.21 + 5) * RECORTE_DA_BEIRA
    s[5] = limitar01((beira - rr) / ESFUMADO_DA_BEIRA)
  }
}

/** O clarão: o tom do miolo das brasas, cheio debaixo do caldeirão e caindo suave até a beira do leito. */
function texClarao(hw: number, hh: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const rr = Math.hypot(x / hw, y / hh)
    const t = limitar01((BEIRA_DO_CLARAO - rr) / (BEIRA_DO_CLARAO - MIOLO_DO_CLARAO))
    s[0] = BRASA_QUENTE[0]
    s[1] = BRASA_QUENTE[1]
    s[2] = BRASA_QUENTE[2]
    s[4] = 1
    s[5] = ALFA_DO_CLARAO * t * t * (3 - 2 * t)
  }
}

/** O caldo: as manchas largas da gordura, tortas, de quem acabou de mexer com a concha. */
function texCaldo(k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const xs = x / k
    const ys = y / k
    const torto = ruido(xs * 0.11 + 5, ys * 0.11) * 4
    s[3] += ruido(xs * 0.24 + torto, ys * 0.24 - torto) * 0.2 + ruido(xs * 0.8, ys * 0.8) * 0.05
  }
}

/** O meio da caixa da peça: onde `tresQuartos.ts` procura a estrutura dela, e onde o pino é cravado. */
function meioDaPeca(p: Peca): Ponto {
  const b = p.forma.b
  return [(b[0] + b[2]) / 2 + p.dx, (b[1] + b[3]) / 2 + p.dy]
}

/**
 * O deslocamento no desenho que cai em (x, y) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; 0 fora dela): a luz e a sombra ficam onde estão.
 */
function desgirada(x: number, y: number, giro: number): readonly [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** Os pinos de uma altura: um disco de raio `r` em cada ponto, numa forma só. */
function pinos(pontos: readonly Ponto[], r: number): Forma {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of pontos) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return {
    b: [x0 - r, y0 - r, x1 + r, y1 + r],
    d(x, y) {
      let menor = Infinity
      for (const [px, py] of pontos) {
        const dd = (x - px) * (x - px) + (y - py) * (y - py)
        if (dd < menor) menor = dd
      }
      return Math.sqrt(menor) - r
    },
  }
}

export const montarCaldeirao: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / MEIA_CASA
  const ferro = c.m.metal
  const pedra = c.m.pedras
  const lenha = materialDaPeca('lenhaCarvalho')
  const madeira = materialDaPeca('pinho')
  /** O ponto do chão no ângulo (graus, 90 = a frente) e no raio (fração da meia pegada), em volta do meio do fogo. */
  const noChao = (graus: number, raio: number): Ponto => [Math.cos(graus * GRAUS) * raio * hw, Math.sin(graus * GRAUS) * raio * hh]
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO

  // ---------- o fogo de chão ----------
  L.push(P(elipse(0, 0, hw * 0.98, hh * 0.98), CINZA, { textura: texLeito(hw, hh, k), tom: 1.2, bisel: 0, contorno: 0, semente: 3301 }))
  // O bojo: o disco do ombro, no meio dele; a boca fica um nada para trás.
  const yBojo = -RECUO_DO_BOJO * hh
  const yBoca = yBojo - RECUO_DA_BOCA * R
  const rx = RAIO_DO_BOJO * hw
  const ry = RAIO_DO_BOJO * hh
  const rBojo = RAIO_DO_BOJO * R
  // A sombra do caldeirão no leito cai para baixo à direita NA TELA, com o objeto girado ou não.
  const [sombraX, sombraY] = desgirada(SOMBRA_NO_LEITO_X * k, SOMBRA_NO_LEITO_Y * k, c.giro)
  L.push(P(elipse(sombraX, yBojo + sombraY, rx * 0.98, ry * 0.98), SOMBRA_NO_LEITO, { bisel: 0, contorno: 0, alfa: ALFA_DA_SOMBRA_NO_LEITO, suave: 2.4 * k, semente: 3302 }))
  L.push(P(elipse(0, 0, hw * BEIRA_DO_CLARAO, hh * BEIRA_DO_CLARAO), FOGO_PARADO, { textura: texClarao(hw, hh), bisel: 0, contorno: 0, semente: 3303 }))
  // As toras cruzadas: carvão no meio do fogo, a casca nas pontas, que saem do leito.
  const raioDaTora = RAIO_DA_TORA * R
  TORAS.forEach(([angulo, meia, dx, dy], i) => {
    const co = Math.cos(angulo * GRAUS)
    const si = Math.sin(angulo * GRAUS)
    const meioX = dx * k
    const meioY = dy * k
    const tora = capsula(meioX - co * meia * hw, meioY - si * meia * hh, meioX + co * meia * hw, meioY + si * meia * hh, raioDaTora)
    cena.sombras.push(contato(tora, 0.22))
    L.push(P(tora, lenha, {
      eixo: Math.atan2(si * hh, co * hw),
      textura: texLenhaQueimada(0, 0, RAIO_DO_CARVAO_DA_TORA * R, FORCA_DO_CARVAO_DA_TORA),
      bisel: raioDaTora,
      contorno: 0.2,
      semente: 3310 + i,
      projeta: { dist: 1.1 * k, forca: 0.3 },
    }))
  })
  // Os carvões apagados e, por cima, as brasas: as dos vãos, que se veem de cima, e as de baixo do bojo, que a 3/4 mostra.
  CARVOES.forEach(([angulo, raio, tamanho], i) => {
    const [x, y] = noChao(angulo, raio)
    const r = tamanho * k
    L.push(P(elipseGirada(x, y, r * 1.25, r * 0.85, hash(i, 1, 3320) * Math.PI), CARVAO_FRIO, { bisel: r * 0.8, contorno: 0.15, tom: 0.9 + 0.25 * hash(i, 2, 3320), semente: 3320 + i }))
  })
  const brasa = (x: number, y: number, r: number, semente: number): void => {
    L.push(P(elipseGirada(x, y, r * 1.15, r * 0.85, hash(semente, 3, 3340) * Math.PI), FOGO_PARADO, { textura: texBrasa(x, y, r * 1.1), bisel: 0, contorno: 0, semente }))
  }
  BRASAS_DE_BAIXO.forEach(([x, y, tamanho], i) => brasa(x * k, y * k, tamanho * k, 3340 + i))
  BRASAS_DOS_VAOS.forEach(([angulo, raio, tamanho], i) => {
    const [x, y] = noChao(angulo, raio)
    brasa(x, y, tamanho * k, 3360 + i)
  })
  // As três pedras de apoio, deitadas ao longo da roda: colunas baixas, a de trás some atrás do bojo na 3/4.
  PEDRAS.forEach((angulo, i) => {
    const [x, y] = noChao(angulo, RAIO_DAS_PEDRAS)
    const tang = 0.26 * R * (0.92 + 0.16 * hash(i, 4, 3380))
    const rad = 0.18 * R * (0.92 + 0.16 * hash(i, 5, 3380))
    const giro = angulo * GRAUS + QUARTO
    const forma = elipseGirada(x, y, tang, rad, giro)
    cena.sombras.push({ forma, z: 2 * R * ALTURA_DAS_PEDRAS, forca: 0.3 })
    L.push(P(forma, pedra, { eixo: giro, tabua: 0, bisel: rad * 0.92, contorno: 0.22, semente: 3380 + i, projeta: { dist: 1.4 * k, forca: 0.3 } }))
  })

  // ---------- o caldeirão ----------
  const bojo = P(elipse(0, yBojo, rx, ry), ferro, { bisel: rBojo * 0.62, tom: TOM_DO_FERRO_PRETO, metal: 0.3, contorno: 0.3, semente: 3400 })
  L.push(bojo)
  /** As peças da boca: sobem juntas na 3/4, pelos pinos delas. */
  const boca: Peca[] = []
  const aro = (fora: number, dentro: number): Forma => anel(0, yBoca, rx * fora, ry * fora, rx * dentro, ry * dentro)
  boca.push(P(aro(BEICO_DE_FORA, BEICO_DE_DENTRO), ferro, { bisel: 1.2 * k, tom: TOM_DO_BEICO, metal: 0.5, contorno: 0.25, semente: 3401, projeta: { dist: 1.1 * k, forca: 0.3 } }))
  boca.push(P(aro(BEICO_DE_DENTRO + 0.01, PAREDE_DE_DENTRO), ferro, { bisel: 0, tom: 0.5, metal: 0, contorno: 0, semente: 3402 }))
  // O caldo: a sombra do beiço cai nele do lado da luz.
  const cx = rx * RAIO_DO_CALDO
  const cy = ry * RAIO_DO_CALDO
  boca.push(P(elipse(0, yBoca, cx, cy), CALDO, { bisel: 0, contorno: 0.12, textura: texCaldo(k), recesso: { k: 2.2 * k, forca: 0.42 }, semente: 3403 }))
  boca.push(P(elipse(cx * -0.05, yBoca + cy * 0.32, cx * 0.34, cy * 0.11), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.16, suave: 1.2 * k, semente: 3404 }))
  LEGUMES.forEach(([fx, fy, tipo, giro], i) => {
    const x = fx * cx
    const y = yBoca + fy * cy
    const o = { contorno: 0.2, semente: 3410 + i, projeta: { dist: 0.5 * k, forca: 0.22 } }
    if (tipo === 'cenoura') boca.push(P(elipse(x, y, 1.5 * k, 1.5 * k), CENOURA, { ...o, bisel: 1 * k }))
    else if (tipo === 'batata') boca.push(P(elipseGirada(x, y, 1.7 * k, 1.2 * k, giro), BATATA, { ...o, bisel: 1 * k }))
    else boca.push(P(capsula(x - Math.cos(giro) * 1.3 * k, y - Math.sin(giro) * 1.3 * k, x + Math.cos(giro) * 1.3 * k, y + Math.sin(giro) * 1.3 * k, 0.6 * k), COUVE, { ...o, bisel: 0.5 * k }))
  })
  BOLHAS.forEach(([fx, fy, raio], i) => {
    const r = raio * k
    boca.push(P(anel(fx * cx, yBoca + fy * cy, r, r, r - 0.45 * k, r - 0.45 * k), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.72, semente: 3430 + i }))
  })
  // A concha de madeira: a cuia mergulhada, com o caldo dentro, e o cabo por cima da beira da frente.
  const [cuiaX, cuiaY] = [CUIA_DA_CONCHA[0] * rx, yBoca + CUIA_DA_CONCHA[1] * ry]
  const [pontaX, pontaY] = [PONTA_DA_CONCHA[0] * rx, yBoca + PONTA_DA_CONCHA[1] * ry]
  const rCuia = 0.17 * rBojo
  boca.push(P(elipse(cuiaX, cuiaY, rCuia * 0.7, rCuia * 0.7), CALDO, { bisel: 0, contorno: 0, tom: 0.84, semente: 3440 }))
  boca.push(P(anel(cuiaX, cuiaY, rCuia, rCuia, rCuia * 0.66, rCuia * 0.66), madeira, { tabua: 0, bisel: 0.7 * k, tom: 0.92, contorno: 0.24, semente: 3441, projeta: { dist: 0.6 * k, forca: 0.24 } }))
  const cabo = Math.atan2(pontaY - cuiaY, pontaX - cuiaX)
  boca.push(P(capsula(cuiaX + Math.cos(cabo) * rCuia * 0.9, cuiaY + Math.sin(cabo) * rCuia * 0.9, pontaX, pontaY, 0.05 * rBojo), madeira, {
    eixo: cabo,
    tabua: 0,
    bisel: 0.9 * k,
    contorno: 0.26,
    semente: 3442,
    projeta: { dist: 1.3 * k, forca: 0.32 },
  }))
  // As duas orelhas no beiço e a alça de ferro, caída para o fundo.
  const naAlca = (graus: number): Ponto => [Math.cos(graus * GRAUS) * RAIO_DA_ALCA * rx, yBoca + Math.sin(graus * GRAUS) * RAIO_DA_ALCA * ry]
  const arco: Ponto[] = []
  for (let i = 0; i <= PASSOS_DA_ALCA; i += 1) arco.push(naAlca(ORELHAS[0] + ((ORELHAS[1] - ORELHAS[0]) * i) / PASSOS_DA_ALCA))
  boca.push(P(cadeia(arco, 0.045 * rBojo), ferro, { bisel: 0.8 * k, tom: TOM_DA_ALCA, metal: 0.5, contorno: 0.26, semente: 3450, projeta: { dist: 0.9 * k, forca: 0.34 } }))
  ORELHAS.forEach((graus, i) => {
    const [x, y] = naAlca(graus)
    boca.push(P(elipse(x, y, 0.085 * rBojo, 0.085 * rBojo), ferro, { bisel: 1 * k, tom: TOM_DO_BEICO, metal: 0.4, contorno: 0.26, semente: 3451 + i }))
  })
  L.push(...boca)

  // Os pinos: o do bojo, na altura da barriga, e os da boca, na altura dela. Sem sombra: são só a altura.
  const alturaDaBoca = 2 * R * ALTURA_DA_BOCA
  const pino = RAIO_DO_PINO * R
  cena.sombras.push(
    { forma: pinos([meioDaPeca(bojo)], pino), z: alturaDaBoca - DESCIDA_DO_BOJO * R, solta: true, forca: 0 },
    { forma: pinos(boca.map(meioDaPeca), pino), z: alturaDaBoca, solta: true, forca: 0 },
  )
}
