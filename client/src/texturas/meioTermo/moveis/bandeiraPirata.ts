/**
 * BANDEIRA PIRATA (lote L07 dos objetos de 14/11/2026, grupo Mar e piratas; pedido do mestre: "bandeira pirata:
 * caveira desenhada por nós, no mastro"). EM PÉ, de frente, como a lápide e o alvo: do alto o pano seria um
 * risco. O MASTRO de madeira, fincado num monte de PEDRAS, com a bola de latão na ponta, a ADRIÇA (a corda de
 * içar) descendo rente a ele até o cunho e as duas AMARRAS que prendem o pano; a BANDEIRA preta (carvão,
 * desbotada) tremulando para a direita, com as dobras do vento, a ponta de fora ESFIAPADA em dentes e dois
 * FUROS de bala.
 *
 * A caveira é nossa: o crânio redondo com uma rachadura no alto à direita, as órbitas fundas, o nariz em
 * coração de ponta para cima e a queixada com três dentes, sobre dois OSSOS cruzados de pontas em nó. Ela anda
 * com a onda do pano (sobe e desce com ele) e pega a mesma luz das dobras: é pintada no pano, não colada por
 * cima. A 1x sobram o retângulo escuro no alto do mastro e a mancha clara da caveira com o X dos ossos.
 *
 * O desenho é feito na pegada de partida (0,9 casa) e escala inteiro com o menor lado; passa da pegada para
 * cima 0,18 casa (a bola do mastro). O piso de luz é um cinza-escuro neutro (`cena.corDoPiso`): com o marrom da
 * nogueira, o pano preto saía marrom. Material: `madeira` (o mastro); o pano, a caveira, as cordas, o latão e as
 * pedras são fixos.
 */
import { barra, capsula, caixa, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, QUARTO, materialDaPeca, type MontarMovel } from './contexto'
import type { Rgb } from '../../ruido'

/** A pegada de partida (lado, px do protótipo) e as alturas, em casas, para as sombras no chão. */
const LADO_DE_PARTIDA = 0.9 * G
const ALTURA_DO_MASTRO = 1
const ALTURA_DO_PANO = 0.75

// O desenho, em px de partida (0 no meio da pegada, y para baixo).
const CHAO = 24
const MASTRO_X = -17
/** O mastro afina para cima: a meia grossura no pé e no alto. */
const MEIO_MASTRO_PE = 1.5
const MEIO_MASTRO_ALTO = 1.05
const ALTO_DO_MASTRO = -32
const BOLA_Y = -33.6
const RAIO_DA_BOLA = 1.9
/** O pano: a beira do mastro, a ponta de fora, o alto e o pé (antes da onda). */
const PANO_X0 = -15.8
const PANO_X1 = 24.5
const PANO_Y0 = -30.5
const PANO_Y1 = -3.6
/** A onda do pano: quantas ondas no comprimento, a fase e a amplitude na ponta (cresce a partir do mastro). */
const ONDAS = 1.05
const FASE = 0.3
const AMPLITUDE = 1.9
/** Os dentes da ponta esfiapada: a fração da altura e o quanto o pano recua ali (px). */
const PONTA: readonly (readonly [number, number])[] = [[0, 0], [0.16, -3.2], [0.28, -0.2], [0.48, -2.4], [0.6, -0.6], [0.8, -4.2], [0.92, -1], [1, -0.4]]
/** Os furos de bala: o meio e os raios. */
const FUROS: readonly (readonly [number, number, number, number])[] = [[14.4, -12.6, 1.05, 0.9], [19.6, -24.4, 0.8, 0.7]]
/** O meio da caveira no pano, antes da onda. */
const CAVEIRA_X = 4.4
const CAVEIRA_Y = -17.6
/** A caveira e os ossos, maiores que o desenho de partida: a 1x a caveira é o que diz "pirata". */
const ESCALA_DA_CAVEIRA = 1.15
/** A luz das dobras do vento. */
const LUZ_DA_DOBRA = 0.17

const PANO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x46, 0x42, 0x3f] }
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: [0xe0, 0xd9, 0xc6] }
const CORDA: MaterialDaPeca = materialDaPeca('corda')
const LATAO: MaterialDaPeca = materialDaPeca('latao')
const PEDRA: MaterialDaPeca = materialDaPeca('granito')
/** O escuro neutro do piso de luz (luminância linear ~0,054, acima do piso de 0,045). */
const ESCURO_DO_PANO: Rgb = [0x45, 0x40, 0x3c]

/** O quanto o pano sobe ou desce no ponto `x` (px de partida): zero no mastro, crescendo até a ponta. */
function onda(x: number): number {
  const t = (x - PANO_X0) / (PANO_X1 - PANO_X0)
  return AMPLITUDE * t * Math.sin(t * ONDAS * Math.PI * 2 + FASE)
}

/** A inclinação do pano no ponto `x`: a dobra virada para a luz (para cima à esquerda) clareia. */
function dobra(x: number): number {
  const t = (x - PANO_X0) / (PANO_X1 - PANO_X0)
  return -Math.cos(t * ONDAS * Math.PI * 2 + FASE) * Math.min(1, t * 5)
}

/** O pano e o que é pintado nele: a luz das dobras pela posição em x (px da pegada, `k` = escala). */
function texDoPano(k: number, base: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    s[3] += dobra(x / k) * LUZ_DA_DOBRA + ruido(x * 0.2 + p.su, y * 0.06) * 0.05
  }
}

/** A caveira, de frente, com o meio em (0, 0) e o tamanho de desenho: o crânio com a queixada numa forma só. */
function cranio(em: (x: number, y: number) => Ponto, k: number): Forma {
  return uniao(elipse(...em(0, -1.4), 4.6 * k, 4.2 * k), caixa(...em(-2.7, 0.8), ...em(2.7, 4.3), 1.1 * k))
}

/** Um osso de `a` até `b` (px de desenho), cada ponta com o nó de duas bolinhas. */
function osso(em: (x: number, y: number) => Ponto, k: number, a: Ponto, b: Ponto): Forma {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy)
  const nx = (-dy / l) * 0.95
  const ny = (dx / l) * 0.95
  const no = ([px, py]: Ponto): Forma => uniao(elipse(...em(px + nx, py + ny), 1.2 * k, 1.2 * k), elipse(...em(px - nx, py - ny), 1.2 * k, 1.2 * k))
  return uniao(capsula(...em(a[0], a[1]), ...em(b[0], b[1]), 1 * k), uniao(no(a), no(b)))
}

/** Os dois ossos cruzados atrás da caveira. */
function ossos(em: (x: number, y: number) => Ponto, k: number): Forma {
  return uniao(osso(em, k, [-7.2, -5], [7.2, 6.4]), osso(em, k, [7.2, -5], [-7.2, 6.4]))
}

export const montarBandeiraPirata: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.w, c.h) / LADO_DE_PARTIDA
  const em = (x: number, y: number): Ponto => [x * k, y * k]
  const mad = c.m.madeira
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_PANO

  cena.sombras.push(
    { forma: caixa(...em(MASTRO_X - MEIO_MASTRO_PE, CHAO - 1.2), ...em(MASTRO_X + MEIO_MASTRO_PE, CHAO), 0.5 * k), z: c.g * ALTURA_DO_MASTRO * k, forca: 0.28 },
    { forma: caixa(...em(PANO_X0, CHAO - 1.4), ...em(PANO_X1 - 2, CHAO - 0.4), 0.5 * k), z: c.g * ALTURA_DO_PANO * k, solta: true, forca: 0.2, suave: 2 },
    contato(elipse(...em(MASTRO_X, CHAO), 6.4 * k, 2.2 * k), 0.3),
  )

  // O mastro, afinando para cima, e a bola de latão da ponta.
  const mastro = poligono([em(MASTRO_X - MEIO_MASTRO_PE, CHAO), em(MASTRO_X - MEIO_MASTRO_ALTO, ALTO_DO_MASTRO), em(MASTRO_X + MEIO_MASTRO_ALTO, ALTO_DO_MASTRO), em(MASTRO_X + MEIO_MASTRO_PE, CHAO)])
  L.push(P(mastro, mad, { tabua: 0, eixo: QUARTO, bisel: 0.8 * k, contorno: 0.28, semente: 7401 }))
  L.push(P(elipse(...em(MASTRO_X, BOLA_Y), RAIO_DA_BOLA * k, RAIO_DA_BOLA * k), LATAO, { bisel: 1.2 * k, contorno: 0.28, semente: 7402 }))
  // A adriça: desce rente ao mastro, do alto até o cunho.
  L.push(P(capsula(...em(MASTRO_X + MEIO_MASTRO_ALTO + 0.4, ALTO_DO_MASTRO + 0.6), ...em(MASTRO_X + MEIO_MASTRO_PE + 0.4, 6.4), 0.33 * k), CORDA, { bisel: 0.25 * k, contorno: 0.3, tom: 0.9, eixo: QUARTO, semente: 7403 }))
  L.push(P(barra(...em(MASTRO_X + 0.2, 6.8), ...em(MASTRO_X + 3.4, 6.2), 1.1 * k), LATAO, { bisel: 0.5 * k, contorno: 0.3, semente: 7404 }))

  // O pano: as beiras de cima e de baixo seguem a onda; a ponta tem os dentes; os furos atravessam.
  const passos = 18
  const alto: Ponto[] = []
  const baixo: Ponto[] = []
  for (let i = 0; i <= passos; i += 1) {
    const x = PANO_X0 + ((PANO_X1 - PANO_X0) * i) / passos
    alto.push(em(x, PANO_Y0 + onda(x)))
    baixo.push(em(x, PANO_Y1 + onda(x)))
  }
  const ponta: Ponto[] = PONTA.map(([f, recua]) => em(PANO_X1 + recua, PANO_Y0 + (PANO_Y1 - PANO_Y0) * f + onda(PANO_X1 + recua)))
  let pano: Forma = poligono([...alto, ...ponta.slice(1, -1), ...baixo.reverse()])
  for (const [x, y, rx, ry] of FUROS) pano = menos(pano, elipse(...em(x, y + onda(x)), rx * k, ry * k))
  const texturaDoPano = texDoPano(k, texturaDaClasse('tecido'))
  L.push(P(pano, PANO, { tabua: 0, bisel: 0.6 * k, contorno: 0.3, textura: texturaDoPano, semente: 7405 }))

  // A caveira, pintada no pano: os ossos atrás, o crânio, as órbitas, o nariz, os dentes e a rachadura.
  const sobe = onda(CAVEIRA_X)
  const kc = k * ESCALA_DA_CAVEIRA
  const naCaveira = (x: number, y: number): Ponto => em(CAVEIRA_X + x * ESCALA_DA_CAVEIRA, CAVEIRA_Y + sobe + y * ESCALA_DA_CAVEIRA)
  const noOsso = { tabua: 0, bisel: 0.45 * kc, contorno: 0.24, textura: texDoPano(k, null) }
  L.push(P(ossos(naCaveira, kc), OSSO, { ...noOsso, semente: 7406 }))
  L.push(P(cranio(naCaveira, kc), OSSO, { ...noOsso, bisel: 0.7 * kc, semente: 7407 }))
  const furo = { tabua: 0, bisel: 0.3 * kc, contorno: 0, textura: texDoPano(k, null), recesso: { k: 1.2, forca: 0.3 } }
  for (const lado of [-1, 1]) L.push(P(elipse(...naCaveira(lado * 1.8, -1.1), 1.3 * kc, 1.45 * kc), PANO, { ...furo, semente: 7408 }))
  L.push(P(poligono([naCaveira(0, 0.7), naCaveira(0.75, 2), naCaveira(-0.75, 2)]), PANO, { ...furo, semente: 7409 }))
  L.push(P(uniao(caixa(...naCaveira(-2.1, 2.85), ...naCaveira(2.1, 3.2)), uniao(caixa(...naCaveira(-0.85, 2.85), ...naCaveira(-0.55, 4.3)), caixa(...naCaveira(0.55, 2.85), ...naCaveira(0.85, 4.3)))), PANO, { tabua: 0, bisel: 0, contorno: 0, semente: 7410 }))
  L.push(P(poligono([naCaveira(1.6, -5.5), naCaveira(2.4, -4.2), naCaveira(1.9, -3.6), naCaveira(2.6, -2.7), naCaveira(2.3, -2.6), naCaveira(1.6, -3.6), naCaveira(2.05, -4.2), naCaveira(1.35, -5.4)]), PANO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.85, semente: 7411 }))

  // As duas amarras do pano no mastro, por cima de tudo.
  for (const y of [PANO_Y0 + 0.9, PANO_Y1 - 0.9]) {
    L.push(P(caixa(...em(MASTRO_X - MEIO_MASTRO_PE - 0.3, y - 0.7), ...em(PANO_X0 + 0.8, y + 0.7), 0.6 * k), CORDA, { bisel: 0.4 * k, contorno: 0.3, eixo: 0.9, semente: 7412 }))
  }

  // O monte de pedras do pé: as de trás primeiro, a da frente esconde o pé do mastro.
  const pedras: readonly (readonly [number, number, number, number, number])[] = [
    [-20.2, 21.2, 2.4, 1.7, 0.95],
    [-13.6, 21.6, 2.2, 1.6, 1.05],
    [-22.6, 23.2, 3.4, 2.1, 1],
    [-11.6, 23.4, 3.2, 1.9, 0.9],
    [-17.2, 24, 3.9, 1.9, 1.08],
  ]
  pedras.forEach(([x, y, rx, ry, tom], i) => {
    L.push(P(elipse(...em(x, y), rx * k, ry * k), PEDRA, { tabua: 0, bisel: 1.1 * k, contorno: 0.26, tom, projeta: { dist: 0.8 * k, forca: 0.3, suave: 0.6 * k }, semente: 7420 + i }))
  })
}
