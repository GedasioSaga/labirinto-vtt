/**
 * ARMADURA em pé (lote 15 dos objetos novos, 12/11/2026): a armadura de cavaleiro inteira, de enfeite de
 * corredor de castelo, de pé num pedestal baixo de pedra. É a mesma armadura do manequim (o peitoral com a
 * quina e o reflexo comprido, a fralda, as ombreiras em três lâminas com as correias, o gorjal, o elmo fechado
 * com a fresta em T e os rebites de latão), agora com o corpo inteiro: a pluma discreta no alto do elmo, os
 * braços dobrados com as duas manoplas pousadas no pomo da espada, que está de ponta no pedestal; o saiote de
 * lâminas sobre as coxas; e as pernas com o coxote, a joelheira de asa, a greva com a quina e o pé de ferro.
 * Aço polido de vitrine, com o reflexo.
 *
 * Do manequim ela se separa de longe: lá é uma cruz de madeira com o peito e o elmo pendurados e as manoplas
 * nas pontas da travessa; aqui é um corpo de gente (ombros, cintura, quadril e pernas), de pé, com a espada na
 * frente.
 *
 * Figura em pé, desenhada de frente nas duas vistas, como o manequim e o boneco de treino: de cima e na 3/4 é a
 * mesma imagem, e a 3/4 só põe a sombra de baixo; o quarto de volta deita a figura, como nos outros em pé. O
 * desenho é feito numa casa de 56 px e sobra um pouco para cima (o elmo e a pluma), como o elmo do manequim. O
 * tronco é o do manequim em 0,64 do tamanho, para a figura inteira caber com pernas de gente.
 *
 * A pedra do pedestal vem do painel (`c.m.pedra`); o aço, o couro, o latão e a pluma são fixos.
 */
import { rgb } from '../../ruido'
import { caixa, cadeia, capsula, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'

/** O lado da casa em que a armadura é desenhada (px do protótipo). */
const CASA = 56

// ---------- as alturas, em y da casa (0 no meio, para baixo cresce) ----------

/** O tronco é o do manequim, em ESCALA_DO_TRONCO do tamanho, com o y 0 dele nesta altura. */
const ESCALA_DO_TRONCO = 0.64
const ALTO_DO_TRONCO = -9.4
/** O chão em que a armadura pisa (o meio do tampo do pedestal), os ombros, o quadril e o meio do elmo: as alturas da sombra. */
const CHAO = 19.4
const OMBRO = -16
const QUADRIL = -3
const COTOVELO = -8.6
/** O elmo: o meio da cúpula, os raios e o fim das faces embaixo. */
const CABECA = -25.4
const RAIO_DO_ELMO_X = 4.4
const RAIO_DO_ELMO_Y = 4.8
const FIM_DO_ELMO = -21.4

/** O pedestal: o fundo e a frente do tampo, o pé da frente, as meias larguras e a altura dele (para a sombra). */
const BASE_FUNDO = 17.0
const BASE_FRENTE = 21.6
const BASE_PE = 26.4
const MEIA_BASE_FUNDO = 9.8
const MEIA_BASE_FRENTE = 11.6
const ALTURA_DA_BASE = 4.8

// ---------- o tronco do manequim (px da casa dele: o y 0 é a cintura) ----------

/** O peitoral, só a metade da direita, do meio do pescoço ao bico de baixo. */
const MEIO_PEITORAL: readonly Ponto[] = [
  [0, -14.6],
  [2.2, -15.0],
  [3.9, -16.2],
  [6.0, -16.6],
  [8.8, -15.6],
  [10.6, -12.8],
  [10.9, -9.0],
  [10.5, -5.0],
  [9.6, -1.5],
  [8.5, 1.4],
  [8.2, 2.8],
  [5.0, 3.4],
  [2.0, 4.4],
  [0, 5.0],
]
/** A meia largura do peito em cada altura [y, meia largura]: a luz de través do aço anda por ela. */
const LARGURA_DO_PEITO: readonly (readonly [number, number])[] = [
  [-16.6, 9.0],
  [-12.8, 10.6],
  [-9.0, 10.9],
  [-5.0, 10.5],
  [-1.5, 9.6],
  [1.4, 8.5],
  [9.8, 9.7],
]
/** As duas lâminas da fralda, a de baixo primeiro, e os rebites dos lados. */
const FRALDA: readonly (readonly Ponto[])[] = [
  [[-8.9, 3.6], [8.9, 3.6], [9.7, 8.4], [4.8, 9.0], [0, 9.8], [-4.8, 9.0], [-9.7, 8.4]],
  [[-8.4, 1.2], [8.4, 1.2], [9.1, 5.6], [4.6, 6.2], [0, 7.0], [-4.6, 6.2], [-9.1, 5.6]],
]
const REBITES_DA_FRALDA: readonly Ponto[] = [[7.6, 7.1], [7.3, 4.5]]
const REBITES_DO_PEITO: readonly Ponto[] = [[3.4, -13.4]]
/** O cinto, de um lado ao outro da cintura, um pouco caído no meio, e o raio dele. */
const CINTO: readonly Ponto[] = [[-9.5, 0.1], [-4.6, 0.9], [0, 1.2], [4.6, 0.9], [9.5, 0.1]]
const RAIO_DO_CINTO = 1.15
/** A correia da ombreira: de baixo da concha até a fivela no peito (só o lado da direita). */
const CORREIA_DA_OMBREIRA: readonly [Ponto, Ponto] = [[6.5, -13.6], [5.3, -7.9]]
/** As lâminas da ombreira da direita, de baixo para cima: [meio x, meio y, raio x, raio y, tom]. */
const OMBREIRA: readonly (readonly [number, number, number, number, number])[] = [
  [12.0, -8.4, 5.8, 2.9, 0.86],
  [11.6, -10.8, 6.3, 3.4, 0.94],
  [11.0, -13.8, 6.2, 4.6, 1.02],
]
const REBITES_DA_OMBREIRA: readonly Ponto[] = [[14.2, -15.6], [7.6, -12.2], [15.4, -8.6], [15.0, -6.3]]
/** O gorjal, o colar de aço entre o peito e o elmo. */
const GORJAL: readonly Ponto[] = [[-4.3, -19.8], [4.3, -19.8], [6.2, -16.4], [3.1, -15.1], [0, -14.7], [-3.1, -15.1], [-6.2, -16.4]]

// ---------- o que o manequim não tem: braços, mãos, espada, saiote e pernas (px da casa) ----------

/** O braço de cima (do ombro ao cotovelo) e o de baixo (do cotovelo ao punho), só o lado da direita. */
const BRACO: readonly [Ponto, Ponto] = [[8.4, -15.6], [10.0, -9.4]]
const ANTEBRACO: readonly [Ponto, Ponto] = [[9.8, -8.0], [4.6, -7.8]]
/** A manopla da direita, pousada no pomo: o punho em sino e o dorso da mão (a da esquerda é o espelho, por baixo). */
const PUNHO_DA_MANOPLA: readonly Ponto[] = [[5.9, -10.1], [3.6, -9.3], [3.6, -6.7], [5.9, -5.9]]
const MAO = { x0: -0.6, y0: -9.0, x1: 3.8, y1: -6.6 } as const
const DEDOS: readonly number[] = [0.3, 1.3, 2.3]
/** A espada de ponta no pedestal: o pomo, o punho de couro, a guarda e a lâmina (com a quina). */
const POMO = { y: -10.1, rx: 1.2, ry: 1.1 } as const
const GUARDA: readonly Ponto[] = [[-4.4, -4.5], [-2.2, -5.0], [2.2, -5.0], [4.4, -4.5]]
const LAMINA: readonly Ponto[] = [[-0.95, -4.9], [0.95, -4.9], [0.8, 18.4], [0, 20.9], [-0.8, 18.4]]
/** O saiote: as duas lâminas de cada coxa (a de baixo primeiro), só o lado da direita, e os rebites de cima. */
const ESCARCELA: readonly (readonly Ponto[])[] = [
  [[1.2, -1.6], [6.4, -1.6], [6.8, 1.6], [4.0, 2.5], [1.4, 1.9]],
  [[0.9, -4.4], [6.0, -4.4], [6.5, -0.6], [3.8, 0.2], [1.2, -0.3]],
]
const REBITES_DA_ESCARCELA: readonly Ponto[] = [[1.9, -3.6], [5.1, -3.6]]
/** As pernas, só a da direita: o coxote, a joelheira, a greva e o pé de ferro. */
const COXOTE: readonly [Ponto, Ponto] = [[3.3, -4.6], [3.4, 6.4]]
const JOELHO: Ponto = [3.4, 7.2]
const GREVA: readonly [Ponto, Ponto] = [[3.4, 8.2], [3.5, 17.8]]
const PE: readonly Ponto[] = [[2.2, 17.2], [5.2, 17.2], [6.5, 19.4], [6.3, 20.6], [4.1, 21.0], [1.9, 20.6], [1.7, 19.4]]
const MEIO_DO_PE = 4.1
/** A pluma: as penas (meio, raios e giro) e o canudo de latão em que elas entram. */
const PENAS: readonly (readonly [number, number, number, number, number])[] = [
  [-1.0, CABECA - 6.6, 1.2, 2.8, -0.5],
  [0.4, CABECA - 6.4, 0.9, 2.3, -0.2],
]

// ---------- os materiais fixos ----------

/** O aço polido (o do manequim), o vão escuro, o couro, o latão e a pluma vinho, escura e pequena. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0xb0, 0xb6, 0xba] }
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x34, 0x31, 0x30] }
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x4a, 0x33] }
const LATAO = materialDaPeca('latao')
const PLUMA: MaterialDaPeca = { classe: 'liso', rgb: [0x74, 0x36, 0x32] }
/** O escuro para onde o pixel escuro demais é levantado: o do ferro (o do canhão e do manequim). */
const ESCURO_DO_FERRO = rgb('#4a4541')

// ---------- a luz do aço (a do manequim) ----------

const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
const MEIO_X = -0.344
const MEIO_Y = -0.267
const MEIO_Z = 0.9
const FORCA_NO_PEITO = 0.7
const FORCA_NA_CONCHA = 0.75
const LUZ_DA_QUINA = 0.05
const FIO_DA_QUINA = 0.12
const PEITO = -6
const BARRIGA = 0.14
const ALTURA_DA_BARRIGA = 12
const LUGAR_DO_REFLEXO = 0.46
const LARGURA_DO_REFLEXO = 0.15
const ALTURA_DO_REFLEXO = -8
const MEIA_ALTURA_DO_REFLEXO = 9
const REFLEXO_DO_PEITO = 70
const LUGAR_DA_REBATIDA = 0.8
const LARGURA_DA_REBATIDA = 0.13
const LUZ_REBATIDA = 0.09
const REFLEXO_DA_OMBREIRA = 60
const REFLEXO_DO_ELMO = 80
const REFLEXO_DO_TUBO = 56
const EXPOENTE_DO_REFLEXO = 30
const FACES_RETAS = 0.35
/** As peças com quina (a greva, o coxote, a lâmina): o quanto cada aba se inclina para o seu lado. */
const ABA_DA_QUINA = 0.18
/**
 * O polido dos tubos, medido pelo quanto o lado olha para a luz (1 de frente para ela, -1 de costas): a faixa
 * escura do reflexo do corredor (onde, a largura e o quanto escurece) e a beira que pega a luz do chão.
 */
const LUZ_NO_PLANO = Math.hypot(LUZ_X, LUZ_Y)
const LUGAR_DO_ESCURO = -0.3
const LARGURA_DO_ESCURO = 0.28
const ESCURO_DO_POLIDO = 0.24
const LUGAR_DA_BEIRA = -0.86

const TEXTURA_DO_METAL = texturaDaClasse('metal')

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** O ponto do tronco do manequim na casa da armadura. */
function doTronco([x, y]: Ponto): Ponto {
  return [x * ESCALA_DO_TRONCO, ALTO_DO_TRONCO + y * ESCALA_DO_TRONCO]
}

/** A meia largura do peito na altura `y` (px da casa do manequim). */
function meiaLarguraDoPeito(y: number): number {
  if (y <= LARGURA_DO_PEITO[0][0]) return LARGURA_DO_PEITO[0][1]
  for (let i = 1; i < LARGURA_DO_PEITO.length; i += 1) {
    const [y1, m1] = LARGURA_DO_PEITO[i]
    if (y <= y1) {
      const [y0, m0] = LARGURA_DO_PEITO[i - 1]
      return m0 + ((m1 - m0) * (y - y0)) / (y1 - y0)
    }
  }
  return LARGURA_DO_PEITO[LARGURA_DO_PEITO.length - 1][1]
}

/**
 * O aço do PEITO (e da fralda e do saiote), o do manequim: redondo de través, com a quina no meio; a barriga se
 * curva para baixo; o reflexo comprido corre no lado da luz e a beira do outro lado pega a luz que volta do chão.
 */
function texDoPeito(e: number, reflexo: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    const xc = x / e / ESCALA_DO_TRONCO
    const yc = (y / e - ALTO_DO_TRONCO) / ESCALA_DO_TRONCO
    const q = limitar(xc / meiaLarguraDoPeito(yc), -1, 1)
    s[3] += FORCA_NO_PEITO * (LUZ_X * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    s[3] += xc < 0 ? LUZ_DA_QUINA : -LUZ_DA_QUINA
    const naQuina = (xc + 0.45) / 0.5
    s[3] += FIO_DA_QUINA * Math.exp(-naQuina * naQuina)
    s[3] -= BARRIGA * limitar((yc - PEITO) / ALTURA_DA_BARRIGA, 0, 1)
    if (reflexo > 0) {
      const polido = (q + LUGAR_DO_REFLEXO) / LARGURA_DO_REFLEXO
      const alto = limitar(1 - Math.abs(yc - ALTURA_DO_REFLEXO) / MEIA_ALTURA_DO_REFLEXO, 0, 1)
      const brilho = reflexo * Math.exp(-polido * polido) * alto
      s[0] += brilho
      s[1] += brilho
      s[2] += brilho
    }
    const rebatida = (q - LUGAR_DA_REBATIDA) / LARGURA_DA_REBATIDA
    s[3] += LUZ_REBATIDA * Math.exp(-rebatida * rebatida)
    if (TEXTURA_DO_METAL !== null) TEXTURA_DO_METAL(u, v, x, y, p, s, escala)
  }
}

/** Uma CONCHA de aço (a ombreira, o elmo, a joelheira, a manopla): a cúpula de meio (cx, cy) e raios (rx, ry), a do manequim. */
function texDeConcha(e: number, cx: number, cy: number, rx: number, ry: number, reflexo: number, achata = 1, quina = 0): Textura {
  return (u, v, x, y, p, s, escala) => {
    const nx = limitar((x / e - cx) / rx, -1, 1)
    let ny = limitar((y / e - cy) / ry, -1, 1)
    if (ny > 0) ny *= achata
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
    s[3] += FORCA_NA_CONCHA * (nx * LUZ_X + ny * LUZ_Y + nz * LUZ_Z - LUZ_Z)
    if (quina > 0 && ny < 0) s[3] += nx < 0 ? quina : -quina
    const brilho = reflexo * Math.pow(Math.max(0, nx * MEIO_X + ny * MEIO_Y + nz * MEIO_Z), EXPOENTE_DO_REFLEXO)
    s[0] += brilho
    s[1] += brilho
    s[2] += brilho
    if (TEXTURA_DO_METAL !== null) TEXTURA_DO_METAL(u, v, x, y, p, s, escala)
  }
}

/**
 * O TUBO de aço (o braço, a coxa, a canela, a lâmina da espada), de `a` até `b`: redondo de través, de meia
 * largura w0 a w1; com `quina`, duas abas que se encontram na aresta do meio, com o fio claro dela.
 */
function texDoTubo(e: number, [ax, ay]: Ponto, [bx, by]: Ponto, w0: number, w1: number, reflexo: number, quina: boolean): Textura {
  const comp = Math.hypot(bx - ax, by - ay) || 1
  const tx = (bx - ax) / comp
  const ty = (by - ay) / comp
  return (u, v, x, y, p, s, escala) => {
    const wx = x / e - ax
    const wy = y / e - ay
    const t = limitar((wx * tx + wy * ty) / comp, 0, 1)
    const d = -wx * ty + wy * tx
    const q = limitar(d / (w0 + (w1 - w0) * t), -1, 1)
    const inclina = quina ? q * 0.7 + (q < 0 ? -ABA_DA_QUINA : ABA_DA_QUINA) * Math.min(1, Math.abs(d) / 0.4) : q
    const nx = -inclina * ty
    const ny = inclina * tx
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
    s[3] += FORCA_NA_CONCHA * (nx * LUZ_X + ny * LUZ_Y + nz * LUZ_Z - LUZ_Z)
    // O polido: o tubo espelha o escuro do corredor numa faixa do lado da sombra, e a beira de lá pega a luz que
    // volta do chão; sem isso o aço fino das pernas e dos braços parecia louça branca.
    const paraALuz = (nx * LUZ_X + ny * LUZ_Y) / LUZ_NO_PLANO
    const faixa = (paraALuz - LUGAR_DO_ESCURO) / LARGURA_DO_ESCURO
    s[3] -= ESCURO_DO_POLIDO * Math.exp(-faixa * faixa)
    const beira = (paraALuz - LUGAR_DA_BEIRA) / LARGURA_DA_REBATIDA
    s[3] += LUZ_REBATIDA * Math.exp(-beira * beira)
    if (quina) {
      const naQuina = d / 0.35
      s[3] += FIO_DA_QUINA * Math.exp(-naQuina * naQuina)
    }
    const brilho = reflexo * Math.pow(Math.max(0, nx * MEIO_X + ny * MEIO_Y + nz * MEIO_Z), EXPOENTE_DO_REFLEXO)
    s[0] += brilho
    s[1] += brilho
    s[2] += brilho
    if (TEXTURA_DO_METAL !== null) TEXTURA_DO_METAL(u, v, x, y, p, s, escala)
  }
}

/** A forma do tubo de `a` até `b`, de meia largura w0 a w1, com a barriga no meio (a panturrilha da greva). */
function tubo([ax, ay]: Ponto, [bx, by]: Ponto, w0: number, w1: number, barriga = 0): Forma {
  const comp = Math.hypot(bx - ax, by - ay) || 1
  const px = -(by - ay) / comp
  const py = (bx - ax) / comp
  const mx = ax + (bx - ax) * 0.42
  const my = ay + (by - ay) * 0.42
  const wm = w0 + (w1 - w0) * 0.42 + barriga
  return poligono([
    [ax + px * w0, ay + py * w0],
    [mx + px * wm, my + py * wm],
    [bx + px * w1, by + py * w1],
    [bx - px * w1, by - py * w1],
    [mx - px * wm, my - py * wm],
    [ax - px * w0, ay - py * w0],
  ])
}

/** A pluma: as farpas das penas, de través, e a sombra de uma pena na outra. */
const texDaPluma: Textura = (_u, _v, x, y, p, s) => {
  s[3] += Math.sin(x * 2.4 + y * 1.1 + ruido(x * 0.4 + p.su, y * 0.4) * 3) * 0.06 + ruido(x * 0.3, y * 0.3 + p.sv) * 0.1
}

/** A forma desenhada de um lado, espelhada para o outro. */
function espelho(meio: readonly Ponto[]): Ponto[] {
  return [...meio, ...[...meio].reverse().slice(1, -1).map(([x, y]): Ponto => [-x, y])]
}

/** O contorno desenhado do lado da direita, levado para o lado `lado` (1 ou -1). */
function doLado(pontos: readonly Ponto[], lado: number): Ponto[] {
  return pontos.map(([x, y]): Ponto => [x * lado, y])
}

export const montarArmadura: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const pedra = c.m.pedra
  const e = Math.min(c.w, c.h) / CASA
  const S = ESCALA_DO_TRONCO
  /** A forma desenhada na casa de 56 px, no tamanho da pegada. */
  const naPegada = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const L = cena.partes
  const por = (f: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    L.push(P(naPegada(f), mat, o))
  }
  const sombraMiuda = { dist: 0.4 * e, forca: 0.3, suave: 0.4 * e }
  const rebite = ([x, y]: Ponto, r: number, mat: MaterialDaPeca, tom: number, semente: number): void => {
    por(elipse(x, y, r, r), mat, { bisel: r * e, tom, contorno: 0.16, metal: 0.6, semente, projeta: sombraMiuda })
  }
  const aco = (f: Forma, textura: Textura, tom: number, bisel: number, semente: number, projeta = 0.8): void => {
    por(f, ACO, { tabua: 0, bisel: bisel * e, tom, contorno: 0.3, metal: 0.55, textura, semente, projeta: { dist: projeta * e, forca: 0.3 } })
  }

  // A SOMBRA da armadura em pé: o pedestal baixo, as pernas arrastadas até o quadril e, soltos, os ombros, o
  // peito, os cotovelos, o elmo e a pluma, cada um na sua altura.
  const zOmbro = (CHAO - OMBRO) * e
  const tampo = poligono([[-MEIA_BASE_FUNDO, BASE_FUNDO], [MEIA_BASE_FUNDO, BASE_FUNDO], [MEIA_BASE_FRENTE, BASE_FRENTE], [-MEIA_BASE_FRENTE, BASE_FRENTE]])
  const frente = caixa(-MEIA_BASE_FRENTE, BASE_FRENTE, MEIA_BASE_FRENTE, BASE_PE, 0.5)
  cena.sombras.push(contato(naPegada(uniao(tampo, frente)), 0.32))
  cena.sombras.push({ forma: naPegada(caixa(-MEIA_BASE_FRENTE, CHAO, MEIA_BASE_FRENTE, BASE_FRENTE + 2.4, 1)), z: ALTURA_DA_BASE * e, forca: 0.26 })
  for (const lado of [-1, 1]) cena.sombras.push({ forma: naPegada(elipse(lado * 3.5, CHAO, 2.4, 1.3)), z: (CHAO - QUADRIL) * e, forca: 0.28 })
  cena.sombras.push({ forma: naPegada(elipse(0, CHAO, 11.6, 2.6)), z: zOmbro, solta: true, forca: 0.26 })
  for (const f of [0.6, 0.76, 0.9]) cena.sombras.push({ forma: naPegada(elipse(0, CHAO, 7.0, 2.4)), z: zOmbro * f, solta: true, forca: 0.26 })
  for (const lado of [-1, 1]) cena.sombras.push({ forma: naPegada(elipse(lado * 10.4, CHAO, 2.0, 1.3)), z: (CHAO - COTOVELO) * e, solta: true, forca: 0.22 })
  cena.sombras.push({ forma: naPegada(elipse(0, CHAO, RAIO_DO_ELMO_X, 2.2)), z: (CHAO - CABECA) * e, solta: true, forca: 0.26 })
  cena.sombras.push({ forma: naPegada(elipse(-0.6, CHAO, 1.4, 1.0)), z: (CHAO - CABECA + 6.4) * e, solta: true, forca: 0.18 })

  // O PEDESTAL de pedra: a frente (na sombra), o friso dela e o tampo.
  por(frente, pedra, { bisel: 0.8 * e, tom: 0.7, contorno: 0.28, semente: 7401 })
  por(capsula(-MEIA_BASE_FRENTE + 0.8, BASE_FRENTE + 1.5, MEIA_BASE_FRENTE - 0.8, BASE_FRENTE + 1.5, 0.3), pedra, { bisel: 0, contorno: 0, tom: 0.5, semente: 7402 })
  por(tampo, pedra, { bisel: 0.9 * e, tom: 1.04, contorno: 0.26, semente: 7403 })

  // As PERNAS: o pé de ferro, a greva, o coxote e a joelheira com a asa para fora.
  for (const lado of [-1, 1]) {
    const pe = poligono(doLado(PE, lado))
    aco(pe, texDeConcha(e, lado * MEIO_DO_PE, 19.8, 2.8, 2.6, REFLEXO_DA_OMBREIRA), 0.96, 0.9, 7410, 0.6)
    for (const [y, meia] of [[18.3, 1.6], [19.3, 2.1]] as const) {
      por(capsula(lado * MEIO_DO_PE - meia, y, lado * MEIO_DO_PE + meia, y, 0.17), VAO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 7411 })
    }
    const [ga, gb] = doLado(GREVA, lado)
    aco(tubo(ga, gb, 1.9, 1.45, 0.4), texDoTubo(e, ga, gb, 2.1, 1.5, REFLEXO_DO_TUBO, true), 1, 0.9, 7412)
    const [ca, cb] = doLado(COXOTE, lado)
    aco(tubo(ca, cb, 2.8, 2.1), texDoTubo(e, ca, cb, 2.8, 2.1, REFLEXO_DO_TUBO, true), 0.98, 1, 7413)
    const [jx, jy] = [lado * JOELHO[0], JOELHO[1]]
    aco(elipse(jx + lado * 2.1, jy + 0.3, 1.2, 1.8), texDeConcha(e, jx + lado * 2.1, jy + 0.3, 1.2, 1.8, REFLEXO_DA_OMBREIRA), 0.9, 0.6, 7414, 0.5)
    por(capsula(jx + lado * 2.0, jy - 0.8, jx + lado * 2.8, jy + 0.4, 0.14), VAO, { bisel: 0, contorno: 0, alfa: 0.45, semente: 7415 })
    aco(elipse(jx, jy, 2.3, 1.7), texDeConcha(e, jx, jy, 2.3, 1.7, REFLEXO_DA_OMBREIRA, 1, 0.05), 1.02, 0.9, 7416)
    rebite([jx + lado * 2.1, jy + 0.6], 0.38, LATAO, 1.05, 7417)
  }

  // Os BRAÇOS de cima, que descem dos ombros por trás do peito e das ombreiras.
  for (const lado of [-1, 1]) {
    const [ba, bb] = doLado(BRACO, lado)
    aco(tubo(ba, bb, 1.7, 1.5), texDoTubo(e, ba, bb, 1.7, 1.5, REFLEXO_DO_TUBO, false), 0.94, 0.8, 7420)
  }

  // O SAIOTE de lâminas sobre as coxas (as de baixo primeiro) e a FRALDA, que cobre o alto dele.
  for (const lado of [-1, 1]) {
    ESCARCELA.forEach((lamina, i) => aco(poligono(doLado(lamina, lado)), texDoPeito(e, 0), 0.86 + i * 0.06, 0.9, 7425 + i))
    for (const [x, y] of REBITES_DA_ESCARCELA) rebite([lado * x, y], 0.42, LATAO, 1.05, 7427)
  }
  FRALDA.forEach((lamina, i) => {
    aco(poligono(lamina.map(doTronco)), texDoPeito(e, 0), 0.84 + i * 0.06, 1.1 * S, 7430 + i)
    for (const lado of [-1, 1]) rebite(doTronco([lado * REBITES_DA_FRALDA[i][0], REBITES_DA_FRALDA[i][1]]), 0.4, LATAO, 1.05, 7432 + i)
  })

  // O PEITORAL, com a quina, o reflexo e os rebites do pescoço; o CINTO com a fivela.
  aco(poligono(espelho(MEIO_PEITORAL).map(doTronco)), texDoPeito(e, REFLEXO_DO_PEITO), 1, 1.6 * S, 7440, 1.1)
  for (const [x, y] of REBITES_DO_PEITO) for (const lado of [-1, 1]) rebite(doTronco([lado * x, y]), 0.4, LATAO, 1.05, 7441)
  por(cadeia(CINTO.map(doTronco), RAIO_DO_CINTO * S), COURO, { eixo: 0, bisel: 0.5 * e, contorno: 0.28, semente: 7445, projeta: { dist: 0.5 * e, forca: 0.3 } })

  // As OMBREIRAS: a correia de cada uma (até a fivela no peito) e as três lâminas, a de baixo primeiro.
  for (const lado of [-1, 1]) {
    const [ca, cb] = CORREIA_DA_OMBREIRA.map(([x, y]) => doTronco([lado * x, y]))
    por(capsula(ca[0], ca[1], cb[0], cb[1], 0.9 * S), COURO, { eixo: Math.atan2(cb[1] - ca[1], cb[0] - ca[0]), bisel: 0.4 * e, contorno: 0.26, semente: 7450 })
    por(menos(caixa(cb[0] - 0.8, cb[1] - 0.6, cb[0] + 0.8, cb[1] + 0.6, 0.25), caixa(cb[0] - 0.38, cb[1] - 0.26, cb[0] + 0.38, cb[1] + 0.26, 0.08)), LATAO, { bisel: 0.3 * e, tom: 1.06, contorno: 0.2, metal: 0.6, semente: 7451, projeta: sombraMiuda })
    OMBREIRA.forEach(([mx, my, rx, ry, tom], i) => {
      const [x, y] = doTronco([lado * mx, my])
      aco(elipse(x, y, rx * S, ry * S), texDeConcha(e, x, y, rx * S, ry * S, REFLEXO_DA_OMBREIRA), tom, 1.4 * S, 7455 + i, 0.9)
    })
    REBITES_DA_OMBREIRA.forEach(([x, y], i) => rebite(doTronco([lado * x, y]), 0.42, ACO, 1.22, 7460 + i))
  }

  // O GORJAL, com o vinco entre as duas lâminas.
  const [, yDoVinco] = doTronco([0, -17.6])
  aco(poligono(GORJAL.map(doTronco)), texDeConcha(e, 0, yDoVinco, 6.2 * S, 3.4 * S, REFLEXO_DA_OMBREIRA, FACES_RETAS), 0.98, 1.2 * S, 7470)
  por(capsula(-5.2 * S, yDoVinco, 5.2 * S, yDoVinco, 0.22), ACO, { bisel: 0, contorno: 0, tom: 0.6, metal: 0, semente: 7471 })

  // A PLUMA discreta, por trás do alto do elmo, e o canudo de latão dela.
  PENAS.forEach(([x, y, rx, ry, ang], i) => {
    por(elipseGirada(x, y, rx, ry, ang), PLUMA, { bisel: 0.6 * e, tom: 0.9 + i * 0.12, contorno: 0.26, textura: texDaPluma, semente: 7475 + i, projeta: { dist: 0.6 * e, forca: 0.28 } })
  })
  por(capsula(0.2, CABECA - RAIO_DO_ELMO_Y - 0.2, 0.2, CABECA - RAIO_DO_ELMO_Y + 0.9, 0.5), LATAO, { bisel: 0.4 * e, tom: 1.04, contorno: 0.2, metal: 0.6, semente: 7477 })

  // O ELMO fechado: a cúpula com as faces, a fresta em T, a aresta do alto e os rebites.
  const elmo = uniao(elipse(0, CABECA, RAIO_DO_ELMO_X, RAIO_DO_ELMO_Y), caixa(-4.0, CABECA, 4.0, FIM_DO_ELMO, 1.6))
  aco(elmo, texDeConcha(e, 0, CABECA, RAIO_DO_ELMO_X, RAIO_DO_ELMO_Y, REFLEXO_DO_ELMO, FACES_RETAS, 0.05), 1.02, 1.2, 7480, 1)
  const fresta = dentroDe(uniao(caixa(-3.0, CABECA + 0.7, 3.0, CABECA + 1.75, 0.45), caixa(-0.7, CABECA + 1.1, 0.7, FIM_DO_ELMO + 0.7, 0.35)), elmo)
  por(fresta, VAO, { bisel: 0, contorno: 0.12, recesso: { k: 0.6 * e, forca: 0.3 }, semente: 7481 })
  por(capsula(0, CABECA - RAIO_DO_ELMO_Y + 0.6, 0, CABECA + 0.3, 0.36), ACO, { bisel: 0.36 * e, tom: 1.14, contorno: 0.12, metal: 0.7, semente: 7482 })
  for (const [x, y] of [[3.3, CABECA + 3.6], [3.75, CABECA + 1.2]] as const) for (const lado of [-1, 1]) rebite([lado * x, y], 0.36, ACO, 1.24, 7483)

  // A ESPADA de ponta no pedestal: a lâmina com a quina, a guarda, o punho de couro e o pomo de latão.
  aco(poligono(LAMINA), texDoTubo(e, [0, -4.9], [0, 20.9], 0.95, 0.8, REFLEXO_DO_TUBO, true), 1.04, 0.5, 7490, 0.7)
  aco(cadeia(GUARDA, 0.55), texDoTubo(e, [-4.4, -4.8], [4.4, -4.8], 0.55, 0.55, REFLEXO_DO_TUBO, false), 0.9, 0.5, 7491, 0.6)
  por(capsula(0, -6.9, 0, -5.4, 0.5), COURO, { eixo: Math.PI / 2, bisel: 0.4 * e, contorno: 0.26, semente: 7492 })
  por(elipse(0, POMO.y, POMO.rx, POMO.ry), LATAO, { bisel: 1.0 * e, tom: 1.06, contorno: 0.24, metal: 0.7, semente: 7493, projeta: sombraMiuda })

  // Os ANTEBRAÇOS dobrados para dentro, as COTOVELEIRAS e as MANOPLAS pousadas no pomo (a da esquerda por baixo).
  for (const lado of [-1, 1]) {
    const [aa, ab] = doLado(ANTEBRACO, lado)
    aco(tubo(aa, ab, 1.5, 1.3), texDoTubo(e, aa, ab, 1.5, 1.3, REFLEXO_DO_TUBO, false), 0.96, 0.8, 7500)
    // A cotoveleira: a concha baixa na dobra (mais comprida que larga, para não virar bola de boneco) e a asa
    // em leque para fora, com o rebite.
    const cx = lado * 10.0
    aco(elipse(cx + lado * 1.0, COTOVELO + 0.5, 0.9, 1.5), texDeConcha(e, cx + lado * 1.0, COTOVELO + 0.5, 0.9, 1.5, REFLEXO_DA_OMBREIRA), 0.88, 0.5, 7501, 0.5)
    aco(elipse(cx, COTOVELO, 1.4, 1.8), texDeConcha(e, cx, COTOVELO, 1.4, 1.8, REFLEXO_DA_OMBREIRA, 1, 0.05), 1.0, 0.7, 7502)
    rebite([cx + lado * 1.1, COTOVELO + 0.6], 0.3, LATAO, 1.05, 7503)
  }
  for (const lado of [-1, 1]) {
    const punho = poligono(doLado(PUNHO_DA_MANOPLA, lado))
    aco(punho, texDeConcha(e, lado * 4.9, -8.0, 2.4, 2.6, REFLEXO_DA_OMBREIRA), 0.94, 0.8, 7510, 0.6)
    por(capsula(lado * 5.8, -9.9, lado * 5.8, -6.1, 0.4), ACO, { bisel: 0.36 * e, tom: 1.14, contorno: 0.18, metal: 0.6, semente: 7511 })
    const x0 = lado > 0 ? MAO.x0 : -MAO.x1
    const x1 = lado > 0 ? MAO.x1 : -MAO.x0
    // A mão: a da esquerda, por baixo, um tom mais escura; os nós numa lâmina clara e os dedos dobrados por cima do punho.
    const mao = caixa(x0, MAO.y0, x1, MAO.y1, 0.9)
    aco(mao, texDeConcha(e, lado * 1.6, -7.8, 2.6, 1.6, REFLEXO_DA_OMBREIRA), lado > 0 ? 1 : 0.88, 0.8, 7512, 0.7)
    por(capsula(x0 + 0.5, -8.1, x1 - 0.5, -8.1, 0.32), ACO, { bisel: 0.3 * e, tom: 1.16, contorno: 0.16, metal: 0.6, semente: 7513 })
    por(capsula(x0 + 0.5, -7.6, x1 - 0.5, -7.6, 0.18), VAO, { bisel: 0, contorno: 0, alfa: 0.65, semente: 7514 })
    for (const d of DEDOS) por(capsula(lado * d, -7.5, lado * d, -6.7, 0.2), VAO, { bisel: 0, contorno: 0, alfa: 0.72, semente: 7515 })
  }
  cena.corDoPiso = ESCURO_DO_FERRO
}
