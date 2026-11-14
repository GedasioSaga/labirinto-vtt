/**
 * CATAPULTA de cima com volume (lote L03 dos objetos novos, 14/11/2026: o
 * cerco e a defesa). A de braço e concha, armada, a frente para a direita: o
 * CHASSI de duas vigas compridas com as travessas da frente e de trás por
 * cima (as pontas saindo das vigas) e uma no meio, as quatro RODAS por fora,
 * vistas do alto (a tira redonda ao comprido, o aro de ferro e o cubo saindo
 * do lado), a MEADA de corda torcida atravessada entre as vigas, presa por
 * fora nas arruelas de ferro com a alavanca de apertar, o BRAÇO saindo da
 * meada para trás com as cintas de ferro e, na ponta, a CONCHA com a pedra,
 * puxada para baixo pela corda do SARILHO (o rolo com as manivelas de cruz
 * dos dois lados). Na frente, o BATENTE: os dois postes, a trave alta e a
 * almofada de pano amarrada onde o braço bate.
 *
 * A 25% de zoom sobra o quadro de madeira com as quatro rodas, a barra clara
 * do braço com a bola da pedra na concha e a trave com a sombra comprida: é o
 * que diz "catapulta" e não "carroça". Material: `madeira` (o chassi, o braço,
 * a concha e o batente); as ferragens, a corda, a almofada e a pedra são
 * fixas. O comprimento sai da largura da pegada e o través, da altura dela (3
 * x 2 casas de partida); o que é redondo (as rodas, a concha, a pedra, a
 * meada, o rolo) sai de `k`, o menor entre a altura e dois terços da largura.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, caixa, capsula, elipse, poligono, type Forma } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type ClasseDaPeca, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** As ferragens (aros, cintas, arruelas, cavilhas): ferro batido, um pouco mais escuro que o da tabela. */
const FERRAGEM: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
/** A corda da meada e do sarilho: cânhamo cru, mais escuro e mais quente que a corda clara da cerca (a do canhão). */
const TOM_DO_CANHAMO: Rgb = [0xc4, 0xac, 0x7e]
const TORCAO_DO_CANHAMO: Rgb = [0x8e, 0x76, 0x50]
const CANHAMO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_CANHAMO }
/** A pedra da concha: o granito, um pouco mais claro, para a bola se destacar no fundo escuro da concha. */
const TOM_DA_PEDRA = 1.12

// ---------- a luz do cilindro ----------

/** De onde vem a luz (a do motor: de cima à esquerda, 52° acima do chão). */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
/** Quanto a luz muda do lombo às beiras de um cilindro: menos no ferro escuro, que já está perto do piso de luz. */
const FORCA_NA_MADEIRA = 0.9
const FORCA_NA_CORDA = 0.8
const FORCA_NO_FERRO = 0.6

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/**
 * A luz de través de um CILINDRO deitado (a roda vista do alto, o rolo, o cubo): `onde` diz em que ponto entre
 * as duas beiras o pixel está (-1 e 1; 0 no lombo) e `paraALuz` é a parte da luz que atravessa o cilindro
 * (`LUZ_X` no que corre em y, `LUZ_Y` no que corre em x). Por baixo, a textura do material.
 */
function texDeCilindro(onde: (x: number, y: number) => number, paraALuz: number, forca: number, classe: ClasseDaPeca): Textura {
  const doMaterial = texturaDaClasse(classe)
  return (u, v, x, y, p, s, escala) => {
    const q = limitar(onde(x, y), -1, 1)
    s[3] += forca * (paraALuz * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

/** Comprimento de uma volta de fio na meada e no sarilho (px do protótipo): ~3 pixels no tamanho de mesa. */
const PASSO_DO_FIO = 3.2

/**
 * A CORDA ENROLADA (a meada e as voltas no rolo do sarilho): as voltas de fio atravessam o comprimento do rolo,
 * um pouco inclinadas, com a cor da torção nos vãos, e a luz de cilindro por cima. `aoLongo` diz onde o pixel
 * está ao longo do rolo (px) e `onde`, entre as beiras (-1 a 1).
 */
function texDeCordaEnrolada(aoLongo: (x: number, y: number) => number, onde: (x: number, y: number) => number, paraALuz: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = limitar(onde(x, y), -1, 1)
    const volta = Math.sin(((aoLongo(x, y) + q * 1.6) / PASSO_DO_FIO) * Math.PI * 2)
    const t = limitar((volta - 0.1) / 0.9, 0, 1)
    s[0] += (TORCAO_DO_CANHAMO[0] - s[0]) * t
    s[1] += (TORCAO_DO_CANHAMO[1] - s[1]) * t
    s[2] += (TORCAO_DO_CANHAMO[2] - s[2]) * t
    s[3] += FORCA_NA_CORDA * (paraALuz * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1)) + ruido(x * 0.7, y * 0.7) * 0.04 + 0.06
  }
}

// ---------- a régua ----------

/** As medidas são frações da pegada: `X` ao comprido (da largura), `Y` de través (da altura); `k` o redondo. */
interface Regua {
  readonly X: (f: number) => number
  readonly Y: (f: number) => number
  readonly k: number
}

/** Dois terços: na pegada de partida (3 x 2) `k` é a altura inteira. */
const PROPORCAO_DE_PARTIDA = 2 / 3

// ---------- o chassi e as rodas ----------

/** As vigas: de onde a onde vão (ao comprido) e de que través a que través (por dentro e por fora). */
const CHASSI_DE = -0.49
const CHASSI_ATE = 0.47
const VIGA_POR_DENTRO = 0.265
const VIGA_POR_FORA = 0.37
/** As travessas de cima (a de trás e a da frente) saem um pouco das vigas, como encaixe de tora. */
const TRAVESSA_DE_TRAS: readonly [number, number] = [-0.49, -0.44]
const TRAVESSA_DA_FRENTE: readonly [number, number] = [0.42, 0.47]
const PONTA_DA_TRAVESSA = 0.405
/** A travessa do meio, embaixo do braço, entre as vigas. */
const TRAVESSA_DO_MEIO: readonly [number, number] = [-0.13, -0.085]
/** As rodas: onde fica cada eixo, o raio (fração de `k`) e de que través a que través a roda vai. */
const EIXOS: readonly number[] = [-0.2, 0.355]
const RAIO_DA_RODA = 0.15
const RODA_POR_DENTRO = 0.38
const RODA_POR_FORA = 0.47
const MEIA_LARGURA_DO_EIXO = 0.028
const PONTA_DO_EIXO = 0.48
/** O cubo que sai da roda para fora, com a chaveta na ponta. */
const RAIO_DO_CUBO = 0.036
const PONTA_DO_CUBO = 0.5
/** Alturas em casas: o topo da roda, o das vigas e o das travessas de cima. */
const ALTURA_DA_RODA = 0.6
const ALTURA_DAS_VIGAS = 0.5
const ALTURA_DAS_TRAVESSAS = 0.56

function montarRodas(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  EIXOS.forEach((onde, i) => {
    const x = X(onde)
    const R = k * RAIO_DA_RODA
    // O eixo por baixo de tudo, de um cubo ao outro.
    L.push(P(caixa(x - k * MEIA_LARGURA_DO_EIXO, -Y(PONTA_DO_EIXO), x + k * MEIA_LARGURA_DO_EIXO, Y(PONTA_DO_EIXO), 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.62, semente: 4100 + i }))
    for (const lado of [-1, 1]) {
      const y0 = Math.min(lado * Y(RODA_POR_DENTRO), lado * Y(RODA_POR_FORA))
      const y1 = Math.max(lado * Y(RODA_POR_DENTRO), lado * Y(RODA_POR_FORA))
      const roda = caixa(x - R, y0, x + R, y1, 1.4)
      const sem = 4104 + i * 4 + (lado + 1)
      cena.sombras.push({ forma: roda, z: c.g * ALTURA_DA_RODA }, contato(roda, 0.32))
      L.push(P(roda, mad, { eixo: 0, tabua: 0, bisel: 0.9, tom: 1.0, contorno: 0.3, textura: texDeCilindro((px) => (px - x) / R, LUZ_X, FORCA_NA_MADEIRA, 'madeira'), semente: sem }))
      // O aro de ferro no meio da banda de rodagem, mais estreito que a roda: é ele que diz "roda" vista do alto.
      const meio = (y0 + y1) / 2
      const meioAro = (y1 - y0) * 0.17
      L.push(P(caixa(x - R * 0.97, meio - meioAro, x + R * 0.97, meio + meioAro, 0.6), FERRAGEM, { tabua: 0, bisel: 0.5, contorno: 0.2, metal: 0.3, textura: texDeCilindro((px) => (px - x) / R, LUZ_X, FORCA_NO_FERRO, 'metal'), semente: sem + 1 }))
      // O cubo saindo para fora da roda e a chaveta na ponta.
      const rc = k * RAIO_DO_CUBO
      const yc0 = Math.min(lado * Y(RODA_POR_FORA) - lado, lado * Y(PONTA_DO_CUBO))
      const yc1 = Math.max(lado * Y(RODA_POR_FORA) - lado, lado * Y(PONTA_DO_CUBO))
      L.push(P(caixa(x - rc, yc0, x + rc, yc1, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 0.7, tom: 0.92, contorno: 0.26, textura: texDeCilindro((px) => (px - x) / rc, LUZ_X, FORCA_NA_MADEIRA, 'madeira'), semente: sem + 2, projeta: { dist: 0.6, forca: 0.22 } }))
      L.push(P(elipse(x, (yc0 + yc1) / 2 + lado * 0.4, rc * 0.42, rc * 0.42), FERRAGEM, { bisel: 0.6, tom: 1.15, contorno: 0.1, metal: 0.4 }))
    }
  })
}

function montarChassi(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  // A travessa do meio primeiro: as vigas cobrem as pontas dela.
  const meio = caixa(X(TRAVESSA_DO_MEIO[0]), -Y(VIGA_POR_FORA) + 1, X(TRAVESSA_DO_MEIO[1]), Y(VIGA_POR_FORA) - 1, 0.6)
  cena.sombras.push({ forma: meio, z: c.g * ALTURA_DAS_VIGAS, solta: true, forca: 0.28 })
  L.push(P(meio, mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, tom: 0.8, contorno: 0.26, semente: 4130 }))
  for (const lado of [-1, 1]) {
    const y0 = Math.min(lado * Y(VIGA_POR_DENTRO), lado * Y(VIGA_POR_FORA))
    const y1 = Math.max(lado * Y(VIGA_POR_DENTRO), lado * Y(VIGA_POR_FORA))
    const viga = caixa(X(CHASSI_DE), y0, X(CHASSI_ATE), y1, 0.9)
    cena.sombras.push({ forma: viga, z: c.g * ALTURA_DAS_VIGAS, solta: true, forca: 0.3 })
    L.push(P(viga, mad, { eixo: 0, tabua: 0, bisel: 1.1, tom: 0.9, contorno: 0.3, semente: 4132 + lado, projeta: { dist: 1, forca: 0.24 } }))
    // As cavilhas da travessa do meio e as do pé do batente, na cara de cima da viga.
    const yMeio = (y0 + y1) / 2
    for (const onde of [(TRAVESSA_DO_MEIO[0] + TRAVESSA_DO_MEIO[1]) / 2, -0.32, 0.06, 0.2]) {
      L.push(P(elipse(X(onde), yMeio, k * 0.013, k * 0.013), FERRAGEM, { bisel: 0.6, tom: 1.1, contorno: 0.1, metal: 0.35 }))
    }
  }
  // As travessas de cima, de ponta a ponta, com a ponta saindo da viga e uma cantoneira de ferro em cada canto.
  for (const [i, [de, ate]] of [TRAVESSA_DE_TRAS, TRAVESSA_DA_FRENTE].entries()) {
    const travessa = caixa(X(de), -Y(PONTA_DA_TRAVESSA), X(ate), Y(PONTA_DA_TRAVESSA), 0.8)
    cena.sombras.push({ forma: travessa, z: c.g * ALTURA_DAS_TRAVESSAS, solta: true, forca: 0.3 })
    L.push(P(travessa, mad, { eixo: QUARTO, tabua: 0, bisel: 1.1, tom: 0.96, contorno: 0.3, semente: 4136 + i, projeta: { dist: 1, forca: 0.3 } }))
    for (const lado of [-1, 1]) {
      const yv = lado * (Y(VIGA_POR_DENTRO) + Y(VIGA_POR_FORA)) / 2
      L.push(P(caixa(X(de) + 0.8, yv - k * 0.035, X(ate) - 0.8, yv + k * 0.035, 0.4), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 0.95, contorno: 0.2, metal: 0.25, semente: 4140 + i * 2 + lado }))
      L.push(P(elipse((X(de) + X(ate)) / 2, yv, k * 0.012, k * 0.012), FERRAGEM, { bisel: 0.6, tom: 1.2, contorno: 0.1, metal: 0.4 }))
    }
  }
}

// ---------- o sarilho ----------

/** O rolo do sarilho, atrás da concha: onde fica e o raio; as manivelas de cruz por fora das vigas. */
const SARILHO = -0.405
const RAIO_DO_ROLO = 0.03
const MANIVELA_DE = -0.475
const MANIVELA_ATE = -0.335
const MANIVELA_TRAVES = 0.405
const ALTURA_DO_SARILHO = 0.58
/** As voltas da corda no meio do rolo (meia largura, fração da altura). */
const MEIAS_VOLTAS = 0.085

function montarSarilho(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const x = X(SARILHO)
  const r = k * RAIO_DO_ROLO
  const rolo = caixa(x - r, -Y(VIGA_POR_FORA) - 1, x + r, Y(VIGA_POR_FORA) + 1, r * 0.8)
  cena.sombras.push({ forma: rolo, z: c.g * ALTURA_DO_SARILHO, solta: true, forca: 0.28 })
  L.push(P(rolo, mad, { eixo: QUARTO, tabua: 0, bisel: 0.6, tom: 0.98, contorno: 0.3, textura: texDeCilindro((px) => (px - x) / r, LUZ_X, FORCA_NA_MADEIRA, 'madeira'), semente: 4150 }))
  // As voltas da corda no meio do rolo, mais grossas que ele.
  const rv = r * 1.25
  L.push(P(caixa(x - rv, -Y(MEIAS_VOLTAS), x + rv, Y(MEIAS_VOLTAS), rv * 0.6), CANHAMO, { bisel: 0.6, contorno: 0.28, textura: texDeCordaEnrolada((_px, py) => py, (px) => (px - x) / rv, LUZ_X), semente: 4151, projeta: { dist: 0.7, forca: 0.26 } }))
  // As manivelas: a barra de cada cruz, deitada ao comprido, e a ponta da outra barra de pé, vista de topo.
  for (const lado of [-1, 1]) {
    const y = lado * Y(MANIVELA_TRAVES)
    const barraDaCruz = capsula(X(MANIVELA_DE), y, X(MANIVELA_ATE), y, k * 0.016)
    cena.sombras.push({ forma: barraDaCruz, z: c.g * ALTURA_DO_SARILHO, solta: true, forca: 0.26 })
    L.push(P(barraDaCruz, mad, { eixo: 0, tabua: 0, bisel: k * 0.012, tom: 1.04, contorno: 0.3, semente: 4153 + lado }))
    L.push(P(caixa(x - k * 0.02, y - k * 0.02, x + k * 0.02, y + k * 0.02, 0.6), mad, { tabua: 0, bisel: 0.6, tom: 1.16, contorno: 0.3, semente: 4156 + lado, projeta: { dist: 0.5, forca: 0.24 } }))
  }
}

// ---------- a meada e o braço ----------

/** A meada atravessada entre as vigas: onde fica e o raio (fração de `k`). */
const MEADA = 0.13
const RAIO_DA_MEADA = 0.06
const ALTURA_DA_MEADA = 0.62
/** O braço: do pé (dentro da meada) até a concha, e a meia grossura no pé e na concha (fração da altura). */
const PE_DO_BRACO = 0.17
const CONCHA = -0.27
const MEIO_BRACO_NO_PE = 0.056
const MEIO_BRACO_NA_CONCHA = 0.04
const CINTAS_DO_BRACO: readonly number[] = [0.04, -0.06, -0.19]
const ALTURA_DO_BRACO = 0.64
/** A concha (raio, fração de `k`), a boca dela e a pedra. */
const RAIO_DA_CONCHA = 0.13
const BOCA_DA_CONCHA = 0.78
const RAIO_DA_PEDRA = 0.075
const ALTURA_DA_CONCHA = 0.76

function montarBraco(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const xC = X(CONCHA)
  const braco = poligono([
    [xC, -Y(MEIO_BRACO_NA_CONCHA)],
    [X(PE_DO_BRACO), -Y(MEIO_BRACO_NO_PE)],
    [X(PE_DO_BRACO), Y(MEIO_BRACO_NO_PE)],
    [xC, Y(MEIO_BRACO_NA_CONCHA)],
  ])
  cena.sombras.push({ forma: braco, z: c.g * ALTURA_DO_BRACO, solta: true, forca: 0.32 })
  // O braço é a madeira mais clara do desenho (o tronco descascado e alisado): é a barra que o olho acha primeiro.
  L.push(P(braco, mad, { eixo: 0, tabua: 0, bisel: 1.6, tom: 1.16, contorno: 0.32, semente: 4160, projeta: { dist: 1.4, forca: 0.32, suave: 0.9 } }))
  CINTAS_DO_BRACO.forEach((onde, i) => {
    const x = X(onde)
    const meio = Y(MEIO_BRACO_NA_CONCHA + ((MEIO_BRACO_NO_PE - MEIO_BRACO_NA_CONCHA) * (x - xC)) / (X(PE_DO_BRACO) - xC)) + 0.6
    L.push(P(caixa(x - k * 0.014, -meio, x + k * 0.014, meio, 0.4), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 1.02, contorno: 0.22, metal: 0.35, semente: 4162 + i, projeta: { dist: 0.5, forca: 0.22 } }))
  })

  // A meada por cima do pé do braço: as voltas de corda passam dos dois lados dele, presas fora das vigas.
  const xM = X(MEADA)
  const rM = k * RAIO_DA_MEADA
  const meada = caixa(xM - rM, -Y(VIGA_POR_DENTRO) - 1, xM + rM, Y(VIGA_POR_DENTRO) + 1, rM * 0.7)
  cena.sombras.push({ forma: meada, z: c.g * ALTURA_DA_MEADA, solta: true, forca: 0.3 })
  L.push(P(meada, CANHAMO, { bisel: 0.8, contorno: 0.3, textura: texDeCordaEnrolada((_px, py) => py, (px) => (px - xM) / rM, LUZ_X), semente: 4170, projeta: { dist: 1.2, forca: 0.32 } }))
  // Por fora de cada viga, a arruela de ferro (de pé, vista de topo) e a alavanca de apertar a meada.
  for (const lado of [-1, 1]) {
    const yv = lado * Y(VIGA_POR_FORA)
    const arruela = caixa(xM - rM * 1.3, Math.min(yv, yv + lado * k * 0.026), xM + rM * 1.3, Math.max(yv, yv + lado * k * 0.026), 0.5)
    L.push(P(arruela, FERRAGEM, { tabua: 0, bisel: 0.5, tom: 0.96, contorno: 0.24, metal: 0.3, textura: texDeCilindro((px) => (px - xM) / (rM * 1.3), LUZ_X, FORCA_NO_FERRO, 'metal'), semente: 4172 + lado }))
    const ya = yv + lado * k * 0.036
    const alavanca = capsula(xM - rM * 2, ya, xM + rM * 1.6, ya, k * 0.012)
    cena.sombras.push(contato(alavanca, 0.2))
    L.push(P(alavanca, FERRAGEM, { eixo: 0, bisel: k * 0.01, tom: 1.08, contorno: 0.24, metal: 0.4, semente: 4175 + lado, projeta: { dist: 0.5, forca: 0.24 } }))
  }

  // A corda do sarilho até a concha: dois fios curtos, que aparecem entre o rolo e a beira da concha.
  for (const lado of [-1, 1]) {
    const fio = capsula(X(SARILHO), lado * Y(0.03), xC - k * RAIO_DA_CONCHA * 0.6, lado * Y(0.012), k * 0.011)
    L.push(P(fio, CANHAMO, { eixo: 0, bisel: k * 0.009, contorno: 0.26, textura: texDeCordaEnrolada((px) => px, (_px, py) => (py - lado * Y(0.02)) / (k * 0.011), LUZ_Y), semente: 4178 + lado }))
  }

  // A concha: a tigela de madeira com o aro de ferro, a boca funda e a pedra dentro.
  const rC = k * RAIO_DA_CONCHA
  const concha = elipse(xC, 0, rC, rC)
  cena.sombras.push({ forma: concha, z: c.g * ALTURA_DA_CONCHA, solta: true, forca: 0.34 })
  L.push(P(concha, mad, { tabua: 0, bisel: rC * 0.32, tom: 1.0, contorno: 0.32, polar: { cx: xC, cy: 0, r: rC }, semente: 4180, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(elipse(xC, 0, rC * BOCA_DA_CONCHA, rC * BOCA_DA_CONCHA), mad, { tabua: 0, bisel: 0.6, tom: 0.58, contorno: 0.2, recesso: { k: rC * 0.35, forca: 0.4 }, polar: { cx: xC, cy: 0, r: rC }, semente: 4181 }))
  L.push(P(anel(xC, 0, rC, rC, rC * 0.88, rC * 0.88), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 1.05, contorno: 0.24, metal: 0.35, semente: 4182 }))
  const rP = k * RAIO_DA_PEDRA
  const xP = xC + rC * 0.08
  const yP = rC * 0.06
  L.push(P(elipse(xP, yP, rP, rP * 0.94), materialDaPeca('granito'), { tabua: 0, bisel: rP * 0.9, tom: TOM_DA_PEDRA, contorno: 0.3, semente: 4183, projeta: { dist: 1.6, forca: 0.42, suave: 0.9 } }))
}

// ---------- o batente ----------

/** Os postes do batente (de pé sobre as vigas), a trave alta e a almofada atrás dela, onde o braço bate. */
const BATENTE_DE = 0.255
const BATENTE_ATE = 0.315
const POSTE_POR_DENTRO = 0.255
const POSTE_POR_FORA = 0.382
const PONTA_DA_TRAVE = 0.395
const ALTURA_DO_BATENTE = 1.3
/** As escoras: do pé do poste até perto da travessa da frente, deitadas sobre a viga. */
const ESCORA_ATE = 0.415
/** A almofada: de onde a onde vai, ao comprido e de través. */
const ALMOFADA_DE = 0.205
const MEIA_ALMOFADA = 0.15
const ALTURA_DA_ALMOFADA = 1.24
/** As amarras da almofada na trave. */
const AMARRAS: readonly number[] = [-0.09, 0.09]

function montarBatente(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  for (const lado of [-1, 1]) {
    const yv = lado * (Y(VIGA_POR_DENTRO) + Y(VIGA_POR_FORA)) / 2
    // A escora deitada na viga, da frente do poste até a travessa da frente.
    const escora = barra(X(BATENTE_ATE) - 1, yv, X(ESCORA_ATE), yv, Y(0.07))
    L.push(P(escora, mad, { eixo: 0, tabua: 0, bisel: 0.9, tom: 1.04, contorno: 0.28, semente: 4190 + lado, projeta: { dist: 0.9, forca: 0.3 } }))
    const y0 = Math.min(lado * Y(POSTE_POR_DENTRO), lado * Y(POSTE_POR_FORA))
    const y1 = Math.max(lado * Y(POSTE_POR_DENTRO), lado * Y(POSTE_POR_FORA))
    const poste = caixa(X(BATENTE_DE), y0, X(BATENTE_ATE), y1, 0.8)
    cena.sombras.push({ forma: poste, z: c.g * ALTURA_DO_BATENTE, forca: 0.3 }, contato(poste, 0.28))
    L.push(P(poste, mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.9, contorno: 0.3, semente: 4193 + lado }))
  }
  const trave = caixa(X(BATENTE_DE) - 0.4, -Y(PONTA_DA_TRAVE), X(BATENTE_ATE) + 0.4, Y(PONTA_DA_TRAVE), 0.9)
  cena.sombras.push({ forma: trave, z: c.g * ALTURA_DO_BATENTE, solta: true, forca: 0.34 })
  L.push(P(trave, mad, { eixo: QUARTO, tabua: 0, bisel: 1.2, tom: 1.06, contorno: 0.32, semente: 4196, projeta: { dist: 1.2, forca: 0.3 } }))
  // As cavilhas da trave em cima de cada poste.
  for (const lado of [-1, 1]) {
    const yp = lado * (Y(POSTE_POR_DENTRO) + Y(POSTE_POR_FORA)) / 2
    L.push(P(elipse((X(BATENTE_DE) + X(BATENTE_ATE)) / 2, yp, k * 0.014, k * 0.014), FERRAGEM, { bisel: 0.6, tom: 1.2, contorno: 0.1, metal: 0.4 }))
  }
  // A almofada: um saco de pano recheado de palha, encostado atrás da trave e amarrado nela.
  const almofada = caixa(X(ALMOFADA_DE), -Y(MEIA_ALMOFADA), X(BATENTE_ATE) - 1.2, Y(MEIA_ALMOFADA), k * 0.03)
  cena.sombras.push({ forma: almofada, z: c.g * ALTURA_DA_ALMOFADA, solta: true, forca: 0.3 })
  L.push(P(almofada, materialDaPeca('linho'), { bisel: k * 0.028, ruga: 1.4, tom: 0.88, contorno: 0.3, semente: 4198, projeta: { dist: 1, forca: 0.3 } }))
  AMARRAS.forEach((f, i) => {
    const y = f * c.h
    const amarra = capsula(X(ALMOFADA_DE) + 0.8, y, X(BATENTE_ATE), y, k * 0.012)
    L.push(P(amarra, CANHAMO, { eixo: 0, bisel: k * 0.01, contorno: 0.26, textura: texDeCordaEnrolada((px) => px, (_px, py) => (py - y) / (k * 0.012), LUZ_Y), semente: 4199 + i }))
  })
}

/** Uma pedra de reserva no chão, ao lado da roda de trás (a munição): o sorteio só muda o feitio dela. */
function pedraDeReserva(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const r = k * 0.06
  const x = X(-0.075)
  const y = Y(0.432)
  const forma: Forma = elipse(x, y, r * (1 + hash(1, 2, 4201) * 0.1), r * 0.9)
  cena.sombras.push({ forma, z: r * 1.6, forca: 0.3 }, contato(forma, 0.34))
  cena.partes.push(c.peca(forma, materialDaPeca('granito'), { tabua: 0, bisel: r * 0.85, tom: 1.04, contorno: 0.3, semente: 4202 }))
}

export const montarCatapulta: MontarMovel = (c, cena) => {
  const regua: Regua = { X: (f) => f * c.w, Y: (f) => f * c.h, k: Math.min(c.h, c.w * PROPORCAO_DE_PARTIDA) }
  montarRodas(c, cena, regua)
  pedraDeReserva(c, cena, regua)
  montarChassi(c, cena, regua)
  montarSarilho(c, cena, regua)
  montarBraco(c, cena, regua)
  montarBatente(c, cena, regua)
}
