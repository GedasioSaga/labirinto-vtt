/**
 * MANEQUIM COM ARMADURA (lote 10 dos objetos novos, 11/11/2026), EM PÉ, de
 * frente como o boneco de treino: o cabide em que o ferreiro pendura a
 * armadura pronta ou a que veio para conserto. Visto de cima seria um disco de
 * aço, e ninguém diria o que é. Numa BASE quadrada de madeira, o POSTE com a
 * TRAVESSA dos ombros (a cruz) veste o PEITORAL de aço polido, com a quina do
 * meio (um lado claro, o outro escuro), o reflexo comprido no peito e as duas
 * lâminas da FRALDA embaixo; o CINTO de couro com a fivela de latão aperta a
 * cintura; por cima dos ombros, as OMBREIRAS em três lâminas, presas por
 * correias com fivela; no alto, o GORJAL e o ELMO redondo com a abertura em T.
 * As MANOPLAS pendem das pontas da travessa por correias, e o ESCUDO de bico,
 * pintado de vinho com a asna clara, está encostado no pé.
 *
 * O que o separa do boneco de treino (palha e saco) e do espantalho (roupa e
 * chapéu) é o AÇO: os reflexos, os rebites e as correias de couro com fivela.
 * A silhueta é a de gente, mas feita de formas curvas (o peito que afina na
 * cintura, a ombreira em concha, o elmo em gota), e não de cilindros
 * empilhados, que liam como peça de xadrez.
 *
 * O desenho é feito numa casa de 56 px e escala com o menor lado da pegada;
 * como o boneco, passa da pegada para cima (o alto do elmo, 0,1 casa). A
 * sombra no chão é a do manequim em pé: o poste arrastado e, soltos, os
 * ombros, o peito, as manoplas e o elmo, cada um na sua altura; o escudo é uma
 * tábua baixa encostada. Material: `madeira` (o poste, a travessa e a base); o
 * aço, o couro, o latão e a pintura do escudo são fixos.
 */
import { rgb } from '../../ruido'
import { caixa, cadeia, capsula, dentroDe, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** O lado da casa em que o manequim é desenhado (px do protótipo). */
const CASA = 56

// As alturas do desenho, em y da casa (0 no meio, para baixo cresce).
/** O chão debaixo do poste, de onde a sombra sai. */
const CHAO = 20
/** O meio da travessa dos ombros. */
const OMBRO = -12.4
/** O meio do elmo. */
const CABECA = -26.6
/** As mãos das manoplas (a altura da sombra delas). */
const MAOS = -3

/** A base: o fundo e a frente do tampo, o pé da frente e as meias larguras do fundo e da frente (o tampo visto de cima e de frente). */
const BASE_FUNDO = 15.4
const BASE_FRENTE = 19
const BASE_PE = 24
const MEIA_BASE_FUNDO = 12.2
const MEIA_BASE_FRENTE = 14.6
/** A altura da base, para a sombra (px da casa). */
const ALTURA_DA_BASE = 5
/** O poste: a meia largura, o pé (no meio do tampo) e o alto (dentro do gorjal); a travessa: a meia grossura e o meio comprimento. */
const MEIO_POSTE = 1.9
const PE_DO_POSTE = 17.4
const ALTO_DO_POSTE = -17
const MEIA_TRAVESSA = 1.5
const MEIO_BRACO = 21.4
/** A manopla pende da travessa a este x (de cada lado). */
const X_DA_MANOPLA = 20

/** O peitoral, só a metade da direita, do meio do pescoço ao bico de baixo (a da esquerda é o espelho). */
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
/** As duas lâminas da fralda, a de baixo primeiro: cada uma passa por baixo da de cima. */
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
/** O elmo: a cúpula (raios), o fim das faces embaixo e os rebites. */
const RAIO_DO_ELMO_X = 6.6
const RAIO_DO_ELMO_Y = 7.2
const FIM_DO_ELMO = -19.2
const REBITES_DO_ELMO: readonly Ponto[] = [[4.9, -21.2], [5.6, -24.8]]

/** O escudo encostado: o meio, o giro e o contorno do bico (x de través, y de cima para baixo, já encurtado por estar deitado para trás). */
const ESCUDO_X = 10.8
const ESCUDO_Y = 16.6
const ESCUDO_GIRO = 0.16
const MEIA_LARGURA_DO_ESCUDO = 6.6
const ESCUDO: readonly Ponto[] = [[-6.6, -7.0], [6.6, -7.0], [6.5, -2.7], [5.7, 1.4], [3.8, 4.6], [0, 7.3], [-3.8, 4.6], [-5.7, 1.4], [-6.5, -2.7]]
/** A asna clara pintada no escudo (o V de cabeça para baixo) e os três rebites das alças, no alto. */
const ASNA: readonly Ponto[] = [[-7, 1.2], [0, -3.8], [7, 1.2], [7, 4.2], [0, -0.8], [-7, 4.2]]
const REBITES_DO_ESCUDO: readonly Ponto[] = [[-3.8, -5.4], [0, -5.4], [3.8, -5.4]]
/** A beira de aço do escudo (px da casa) e a altura dele encostado, para a sombra. */
const BEIRA_DO_ESCUDO = 0.9
const ALTURA_DO_ESCUDO = 13

// ---------- os materiais fixos ----------

/** O aço polido (o das lâminas do suporte de armas), o ferro do colar do pé e o vão escuro (a abertura do elmo, os dedos). */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0xb0, 0xb6, 0xba] }
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: [0x66, 0x69, 0x6c] }
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x34, 0x31, 0x30] }
/** O couro das correias e do cinto, e o latão das fivelas. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x4a, 0x33] }
const LATAO = materialDaPeca('latao')
/** O escudo: as tábuas de pinho, a pintura vinho gasta e a asna clara. */
const TABUAS_DO_ESCUDO = materialDaPeca('pinho')
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x86, 0x45, 0x40] }
const TINTA_CLARA: MaterialDaPeca = { classe: 'liso', rgb: [0xd0, 0xc3, 0x9c] }
/** O escuro para onde o pixel escuro demais é levantado: o do ferro (o do canhão). Com a nogueira do padrão, o vão do elmo saía vermelho. */
const ESCURO_DO_FERRO = rgb('#4a4541')

// ---------- a luz do aço ----------

/** De onde vem a luz (a do motor) e o meio-caminho entre ela e o olho, onde o metal brilha. */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
const MEIO_X = -0.344
const MEIO_Y = -0.267
const MEIO_Z = 0.9
/** Quanto a luz muda de um lado ao outro do peito e de uma concha (a ombreira, o elmo). */
const FORCA_NO_PEITO = 0.7
const FORCA_NA_CONCHA = 0.75
/** A quina do meio do peito: o lado da esquerda clareia, o da direita escurece, e a aresta pega um fio de luz. */
const LUZ_DA_QUINA = 0.05
const FIO_DA_QUINA = 0.12
/** A barriga do peitoral se curva para baixo: escurece a partir desta altura, ao longo desta altura. */
const PEITO = -6
const BARRIGA = 0.14
const ALTURA_DA_BARRIGA = 12
/** O reflexo comprido do peito: onde fica de través, a largura, a altura do meio e a meia altura dele, e o brilho. */
const LUGAR_DO_REFLEXO = 0.46
const LARGURA_DO_REFLEXO = 0.15
const ALTURA_DO_REFLEXO = -8
const MEIA_ALTURA_DO_REFLEXO = 9
const REFLEXO_DO_PEITO = 70
/** A luz que volta do chão na beira do lado da sombra. */
const LUGAR_DA_REBATIDA = 0.8
const LARGURA_DA_REBATIDA = 0.13
const LUZ_REBATIDA = 0.09
/** O ponto de brilho das conchas: a força e o quanto ele é pequeno. */
const REFLEXO_DA_OMBREIRA = 60
const REFLEXO_DO_ELMO = 80
const EXPOENTE_DO_REFLEXO = 30
/** O elmo é cúpula em cima e quase reto nas faces: a curva de cima para baixo vale só esta fração abaixo do meio. */
const FACES_RETAS = 0.35

const TEXTURA_DO_METAL = texturaDaClasse('metal')

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A meia largura do peito na altura `y` (px da casa). */
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
 * O aço do PEITO (e da fralda): o peito é redondo de través, com a quina no meio; a barriga se curva para
 * baixo; o reflexo comprido corre no lado da luz e a beira do outro lado pega a luz que volta do chão.
 * `e` = px da pegada por px da casa.
 */
function texDoPeito(e: number, reflexo: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    const xc = x / e
    const yc = y / e
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

/**
 * Uma CONCHA de aço (a lâmina da ombreira, o elmo, o punho da manopla): a normal de uma cúpula de meio
 * (cx, cy) e raios (rx, ry), com o ponto de brilho onde ela olha para o meio-caminho da luz. `achata` encolhe a
 * curva abaixo do meio (as faces do elmo, quase retas); `quina` clareia a metade da esquerda e escurece a da
 * direita (a aresta do alto do elmo).
 */
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

/** A pintura do escudo: redonda de través (o escudo é curvo) e gasta, falhando onde bateram nela. */
function texDaTinta(e: number): Textura {
  const co = Math.cos(ESCUDO_GIRO)
  const si = Math.sin(ESCUDO_GIRO)
  return (_u, _v, x, y, p, s) => {
    const deTraves = (x / e - ESCUDO_X) * co + (y / e - ESCUDO_Y) * si
    const q = limitar(deTraves / MEIA_LARGURA_DO_ESCUDO, -1, 1)
    s[3] += FORCA_NO_PEITO * (LUZ_X * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1)) + ruido(x * 0.2 + p.sv, y * 0.2) * 0.08
    s[5] = limitar(0.84 + ruido((x * 0.55) / e + p.su, (y * 0.55) / e + p.sv) * 1.1, 0.3, 1)
  }
}

/** A forma desenhada na casa de 56 px, espelhada de um lado para o outro. */
function espelho(meio: readonly Ponto[]): Ponto[] {
  return [...meio, ...[...meio].reverse().slice(1, -1).map(([x, y]): Ponto => [-x, y])]
}

export const montarManequimComArmadura: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const mad = c.m.madeira
  const e = Math.min(c.w, c.h) / CASA
  /** A forma desenhada na casa de 56 px, no tamanho da pegada. */
  const naPegada = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const L = cena.partes
  const por = (f: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    L.push(P(naPegada(f), mat, o))
  }
  const sombraMiuda = { dist: 0.45 * e, forca: 0.3, suave: 0.45 * e }
  const rebite = ([x, y]: Ponto, r: number, mat: MaterialDaPeca, tom: number, semente: number): void => {
    por(elipse(x, y, r, r), mat, { bisel: r * e, tom, contorno: 0.16, metal: 0.6, semente, projeta: sombraMiuda })
  }

  // A SOMBRA do manequim em pé: a base baixa, o poste arrastado e, soltos, os ombros, o peito, o elmo e as
  // manoplas, cada um na sua altura; o escudo encostado é uma tábua baixa.
  const zOmbro = (CHAO - OMBRO) * e
  const tampoDaBase = poligono([[-MEIA_BASE_FUNDO, BASE_FUNDO], [MEIA_BASE_FUNDO, BASE_FUNDO], [MEIA_BASE_FRENTE, BASE_FRENTE], [-MEIA_BASE_FRENTE, BASE_FRENTE]])
  const frenteDaBase = caixa(-MEIA_BASE_FRENTE, BASE_FRENTE, MEIA_BASE_FRENTE, BASE_PE, 0.6)
  cena.sombras.push(contato(naPegada(uniao(tampoDaBase, frenteDaBase)), 0.32))
  cena.sombras.push({ forma: naPegada(caixa(-MEIA_BASE_FRENTE, CHAO - 2.4, MEIA_BASE_FRENTE, CHAO + 2.4, 1)), z: ALTURA_DA_BASE * e, forca: 0.26 })
  cena.sombras.push({ forma: naPegada(caixa(-MEIO_POSTE, CHAO - 1.2, MEIO_POSTE, CHAO + 0.8)), z: zOmbro, forca: 0.3 })
  cena.sombras.push({ forma: naPegada(elipse(0, CHAO, 17.6, 2.8)), z: zOmbro, solta: true, forca: 0.26 })
  for (const f of [0.5, 0.68, 0.86]) cena.sombras.push({ forma: naPegada(elipse(0, CHAO, 10.2, 2.6)), z: zOmbro * f, solta: true, forca: 0.26 })
  cena.sombras.push({ forma: naPegada(elipse(0, CHAO, 6.4, 2.4)), z: (CHAO - CABECA) * e, solta: true, forca: 0.26 })
  for (const lado of [-1, 1]) cena.sombras.push({ forma: naPegada(elipse(lado * X_DA_MANOPLA, CHAO, 2.8, 1.4)), z: (CHAO - MAOS) * e, solta: true, forca: 0.22 })
  cena.sombras.push({ forma: naPegada(caixa(4.6, CHAO + 1.6, 17.4, CHAO + 3.4, 0.8)), z: ALTURA_DO_ESCUDO * e, forca: 0.26 })

  // A BASE: a frente (na sombra), o friso dela e o tampo; o colar de ferro em volta do pé do poste.
  por(frenteDaBase, mad, { eixo: 0, tabua: 0, bisel: 0.8 * e, tom: 0.66, contorno: 0.28, semente: 1301 })
  por(capsula(-MEIA_BASE_FRENTE + 0.6, BASE_FRENTE + 1.5, MEIA_BASE_FRENTE - 0.6, BASE_FRENTE + 1.5, 0.3), mad, { bisel: 0, contorno: 0, tom: 0.46, semente: 1302 })
  por(tampoDaBase, mad, { eixo: 0, tabua: 0, bisel: 0.9 * e, tom: 1.02, contorno: 0.26, semente: 1303 })
  por(elipse(0, PE_DO_POSTE - 0.2, 3.8, 1.2), FERRO, { bisel: 0.6 * e, tom: 0.9, contorno: 0.22, metal: 0.4, semente: 1304 })
  for (const lado of [-1, 1]) rebite([lado * 2.7, PE_DO_POSTE - 0.2], 0.45, FERRO, 1.3, 1305)

  // O POSTE e a TRAVESSA dos ombros (a cruz), de madeira.
  por(caixa(-MEIO_POSTE, ALTO_DO_POSTE, MEIO_POSTE, PE_DO_POSTE, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 1.2 * e, tom: 0.95, contorno: 0.26, semente: 1310, projeta: { dist: e, forca: 0.26 } })
  por(caixa(-MEIO_BRACO, OMBRO - MEIA_TRAVESSA, MEIO_BRACO, OMBRO + MEIA_TRAVESSA, 0.9), mad, { eixo: 0, tabua: 0, bisel: 1.1 * e, tom: 0.92, contorno: 0.26, semente: 1311, projeta: { dist: 0.9 * e, forca: 0.24 } })

  // As MANOPLAS, penduradas pelas correias nas pontas da travessa: o punho em sino com a beira virada, a mão em
  // lâminas, os dedos e o polegar para o lado de dentro.
  for (const lado of [-1, 1]) {
    const gx = lado * X_DA_MANOPLA
    por(capsula(gx, OMBRO + 0.4, gx, -9.6, 0.75), COURO, { eixo: QUARTO, bisel: 0.5 * e, contorno: 0.24, semente: 1320 })
    por(poligono([[gx - 3.2, -10.2], [gx + 3.2, -10.2], [gx + 2.4, -5.8], [gx - 2.4, -5.8]]), ACO, { tabua: 0, bisel: 0.9 * e, tom: 0.96, contorno: 0.28, metal: 0.5, textura: texDeConcha(e, gx, -8.4, 3.4, 3.2, REFLEXO_DA_OMBREIRA), semente: 1321 })
    por(capsula(gx - 3.0, -10.1, gx + 3.0, -10.1, 0.6), ACO, { bisel: 0.6 * e, tom: 1.16, contorno: 0.2, metal: 0.6, semente: 1322 })
    por(caixa(gx - 2.5, -6.4, gx + 2.5, -1.4, 1.2), ACO, { tabua: 0, bisel: 1 * e, tom: 0.92, contorno: 0.28, metal: 0.5, textura: texDeConcha(e, gx, -4.2, 2.8, 3.2, REFLEXO_DA_OMBREIRA), semente: 1323 })
    por(capsula(gx - 2.1, -3.7, gx + 2.1, -3.7, 0.28), VAO, { bisel: 0, contorno: 0, alfa: 0.7, semente: 1324 })
    por(caixa(gx - 2.3, -1.8, gx + 2.1, 2.6, 1.0), ACO, { tabua: 0, bisel: 0.8 * e, tom: 0.86, contorno: 0.28, metal: 0.45, semente: 1325 })
    for (const f of [-1.1, 0, 1.1]) por(capsula(gx + f, -1.1, gx + f, 2.2, 0.22), VAO, { bisel: 0, contorno: 0, alfa: 0.75, semente: 1326 })
    por(capsula(gx - lado * 2.3, -4.4, gx - lado * 3.3, -0.8, 0.85), ACO, { bisel: 0.7 * e, tom: 0.9, contorno: 0.26, metal: 0.45, semente: 1327 })
  }

  // A FRALDA (as duas lâminas, a de baixo primeiro), com os rebites dos lados.
  FRALDA.forEach((lamina, i) => {
    por(poligono(lamina), ACO, { tabua: 0, bisel: 1.1 * e, tom: 0.84 + i * 0.06, contorno: 0.3, metal: 0.5, textura: texDoPeito(e, 0), semente: 1330 + i, projeta: { dist: 0.8 * e, forca: 0.3 } })
    for (const lado of [-1, 1]) rebite([lado * REBITES_DA_FRALDA[i][0], REBITES_DA_FRALDA[i][1]], 0.5, LATAO, 1.05, 1332 + i)
  })
  // O PEITORAL, com a quina, o reflexo e os rebites do pescoço.
  por(poligono(espelho(MEIO_PEITORAL)), ACO, { tabua: 0, bisel: 1.6 * e, tom: 1, contorno: 0.3, metal: 0.6, textura: texDoPeito(e, REFLEXO_DO_PEITO), semente: 1340, projeta: { dist: 1.2 * e, forca: 0.3 } })
  for (const [x, y] of REBITES_DO_PEITO) for (const lado of [-1, 1]) rebite([lado * x, y], 0.5, LATAO, 1.05, 1341)
  // O CINTO de couro com a fivela de latão (o aro e o fuzilhão).
  por(cadeia(CINTO, RAIO_DO_CINTO), COURO, { eixo: 0, bisel: 0.7 * e, contorno: 0.28, semente: 1345, projeta: { dist: 0.7 * e, forca: 0.3 } })
  por(menos(caixa(-1.8, -0.2, 1.8, 2.6, 0.5), caixa(-0.95, 0.45, 0.95, 1.95, 0.2)), LATAO, { bisel: 0.5 * e, tom: 1.06, contorno: 0.22, metal: 0.6, semente: 1346, projeta: sombraMiuda })
  por(capsula(-0.95, 1.2, 0.6, 1.2, 0.22), LATAO, { bisel: 0.2 * e, tom: 0.92, contorno: 0.14, metal: 0.5, semente: 1347 })

  // As OMBREIRAS: a correia de cada uma (descendo até a fivela no peito) e as três lâminas, a de baixo primeiro.
  const [[cax, cay], [cbx, cby]] = CORREIA_DA_OMBREIRA
  for (const lado of [-1, 1]) {
    por(capsula(lado * cax, cay, lado * cbx, cby, 0.9), COURO, { eixo: Math.atan2(cby - cay, lado * (cbx - cax)), bisel: 0.6 * e, contorno: 0.26, semente: 1350 })
    por(capsula(lado * cbx, cby, lado * (cbx - 0.1), cby + 1.7, 0.8), COURO, { bisel: 0.5 * e, tom: 0.92, contorno: 0.26, semente: 1351 })
    por(menos(caixa(lado * cbx - 1.25, cby - 0.95, lado * cbx + 1.25, cby + 0.95, 0.35), caixa(lado * cbx - 0.6, cby - 0.4, lado * cbx + 0.6, cby + 0.4, 0.1)), LATAO, { bisel: 0.4 * e, tom: 1.06, contorno: 0.2, metal: 0.6, semente: 1352, projeta: sombraMiuda })
    OMBREIRA.forEach(([mx, my, rx, ry, tom], i) => {
      por(elipse(lado * mx, my, rx, ry), ACO, { tabua: 0, bisel: 1.4 * e, tom, contorno: 0.3, metal: 0.55, textura: texDeConcha(e, lado * mx, my, rx, ry, REFLEXO_DA_OMBREIRA), semente: 1355 + i, projeta: { dist: 1 * e, forca: 0.32 } })
    })
    REBITES_DA_OMBREIRA.forEach(([x, y], i) => rebite([lado * x, y], 0.55, ACO, 1.22, 1360 + i))
  }

  // O GORJAL, com o vinco entre as duas lâminas.
  por(poligono(GORJAL), ACO, { tabua: 0, bisel: 1.2 * e, tom: 0.98, contorno: 0.3, metal: 0.55, textura: texDeConcha(e, 0, -17.6, 6.2, 3.4, REFLEXO_DA_OMBREIRA, FACES_RETAS), semente: 1370, projeta: { dist: 0.9 * e, forca: 0.3 } })
  por(capsula(-5.2, -17.6, 5.2, -17.6, 0.28), ACO, { bisel: 0, contorno: 0, tom: 0.6, metal: 0, semente: 1371 })

  // O ELMO: a cúpula com as faces, a abertura em T (aberta embaixo), a aresta do alto e os rebites.
  const elmo = uniao(elipse(0, CABECA, RAIO_DO_ELMO_X, RAIO_DO_ELMO_Y), caixa(-6.0, CABECA, 6.0, FIM_DO_ELMO, 2.4))
  por(elmo, ACO, { tabua: 0, bisel: 1.6 * e, tom: 1.02, contorno: 0.3, metal: 0.6, textura: texDeConcha(e, 0, CABECA, RAIO_DO_ELMO_X, RAIO_DO_ELMO_Y, REFLEXO_DO_ELMO, FACES_RETAS, 0.05), semente: 1380, projeta: { dist: 1.1 * e, forca: 0.32 } })
  const abertura = dentroDe(uniao(caixa(-4.5, CABECA + 1.0, 4.5, CABECA + 2.6, 0.7), caixa(-1.05, CABECA + 1.6, 1.05, FIM_DO_ELMO + 1, 0.5)), elmo)
  por(abertura, VAO, { bisel: 0, contorno: 0.12, recesso: { k: 0.8 * e, forca: 0.3 }, semente: 1381 })
  por(capsula(0, CABECA - RAIO_DO_ELMO_Y + 0.8, 0, CABECA + 0.4, 0.5), ACO, { bisel: 0.5 * e, tom: 1.14, contorno: 0.12, metal: 0.7, semente: 1382 })
  for (const [x, y] of REBITES_DO_ELMO) for (const lado of [-1, 1]) rebite([lado * x, y], 0.5, ACO, 1.24, 1383)

  // O ESCUDO encostado no pé: a beira de aço, as tábuas, a pintura gasta, a asna e os rebites das alças.
  const co = Math.cos(ESCUDO_GIRO)
  const si = Math.sin(ESCUDO_GIRO)
  const noEscudo = ([lx, ly]: Ponto): Ponto => [ESCUDO_X + lx * co - ly * si, ESCUDO_Y + lx * si + ly * co]
  const escudo = poligono(ESCUDO.map(noEscudo))
  const campo: Forma = { b: escudo.b, d: (x, y) => escudo.d(x, y) + BEIRA_DO_ESCUDO }
  por(escudo, ACO, { tabua: 0, bisel: 0.8 * e, tom: 0.9, contorno: 0.3, metal: 0.5, semente: 1390, projeta: { dist: 1.6 * e, forca: 0.32 } })
  por(campo, TABUAS_DO_ESCUDO, { eixo: QUARTO + ESCUDO_GIRO, tabua: 3.3 * e, bisel: 0.5 * e, tom: 0.9, contorno: 0.2, semente: 1391 })
  por(campo, TINTA, { bisel: 0, contorno: 0, textura: texDaTinta(e), semente: 1392 })
  por(dentroDe(poligono(ASNA.map(noEscudo)), campo), TINTA_CLARA, { bisel: 0, contorno: 0.1, textura: texDaTinta(e), semente: 1393 })
  REBITES_DO_ESCUDO.forEach((ponto, i) => rebite(noEscudo(ponto), 0.55, ACO, 1.2, 1394 + i))
  cena.corDoPiso = ESCURO_DO_FERRO
}
