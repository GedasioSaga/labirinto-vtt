/**
 * ESCADA DE CERCO de cima com volume (lote L03 dos objetos novos, 14/11/2026:
 * o cerco e a defesa). A escada comprida e larga que se leva até a muralha,
 * deitada no chão, a ponta de cima para a direita: os dois BANZOS de tronco
 * roliço, mais grossos e mais abertos no pé (a escada de cerco é larga embaixo
 * para dois subirem lado a lado) e afinando para cima, os DEGRAUS roliços
 * passando por cima deles com as pontas para fora e AMARRADOS com corda em
 * cada encontro, a TRAVESSA grossa de cima cintada de ferro e, saindo dela, os
 * dois GANCHOS de ferro curvos que mordem a beira da muralha; no pé, as
 * PONTEIRAS de ferro que firmam a escada no chão.
 *
 * A 25% de zoom sobra a faixa comprida dos dois banzos com os degraus em
 * escadinha e as garras escuras na ponta: é o que diz "escada de cerco" e não
 * "cerca" (que tem mourões fincados) nem escada de mão (que não tem ganchos).
 * Material: `madeira` (os banzos, os degraus e a travessa); a corda e o ferro
 * são fixos. O comprimento sai da largura da pegada e o través, da altura (4 x
 * 1 casas de partida): esticada, a escada ganha degraus, nunca degraus
 * esticados.
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, capsula, elipse, poligono, type Ponto } from './formas'
import { contato, texturaDaClasse, type Cena, type ClasseDaPeca, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** As ferragens (os ganchos, as cintas, as ponteiras): ferro batido, um pouco mais escuro que o da tabela. */
const FERRAGEM: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
/** As amarras: cânhamo cru (o do canhão), mais escuro que a corda clara da cerca, que some na madeira de pinho. */
const TOM_DO_CANHAMO: Rgb = [0xb4, 0x9a, 0x6c]
const TORCAO_DO_CANHAMO: Rgb = [0x80, 0x68, 0x44]
const CANHAMO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_CANHAMO }

// ---------- a luz e as texturas ----------

/** De onde vem a luz (a do motor: de cima à esquerda, 52° acima do chão). */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
const FORCA_NA_MADEIRA = 0.9
const FORCA_NO_FERRO = 0.6
const FORCA_NA_CORDA = 0.7
/** Comprimento de uma volta de fio na amarra (px do protótipo): ~2 pixels no tamanho de mesa. */
const PASSO_DO_FIO = 2.4

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A luz de través de um CILINDRO deitado (o banzo, o degrau, o gancho): `onde` vai de -1 a 1 entre as beiras. */
function texDeCilindro(onde: (x: number, y: number) => number, paraALuz: number, forca: number, classe: ClasseDaPeca): Textura {
  const doMaterial = texturaDaClasse(classe)
  return (u, v, x, y, p, s, escala) => {
    const q = limitar(onde(x, y), -1, 1)
    s[3] += forca * (paraALuz * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

/** A AMARRA: as voltas de corda em diagonal sobre o encontro do degrau com o banzo, mais escuras nos vãos. */
function texDaAmarra(cx: number, cy: number, raio: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const volta = Math.sin(((x - cx + (y - cy) * 0.8) / PASSO_DO_FIO) * Math.PI * 2)
    const t = limitar((volta - 0.1) / 0.9, 0, 1)
    s[0] += (TORCAO_DO_CANHAMO[0] - s[0]) * t
    s[1] += (TORCAO_DO_CANHAMO[1] - s[1]) * t
    s[2] += (TORCAO_DO_CANHAMO[2] - s[2]) * t
    const q = limitar(Math.hypot(x - cx, y - cy) / raio, 0, 1)
    s[3] += FORCA_NA_CORDA * (((LUZ_X * (x - cx) + LUZ_Y * (y - cy)) / raio) * 0.5 + LUZ_Z * (Math.sqrt(1 - q * q) - 1)) + 0.05
  }
}

// ---------- a régua ----------

/** As medidas são frações da pegada: `X` ao comprido (da largura), `Y` de través (da altura); `k` o redondo. */
interface Regua {
  readonly X: (f: number) => number
  readonly Y: (f: number) => number
  readonly k: number
}

// ---------- os banzos ----------

/** Os banzos: do pé à ponta de cima; o meio de cada um, de través, no pé e em cima (a escada abre embaixo). */
const PE = -0.465
const TOPO = 0.43
const ABERTURA_NO_PE = 0.31
const ABERTURA_NO_TOPO = 0.235
/** A meia grossura do banzo no pé e em cima (fração da altura). */
const MEIO_BANZO_NO_PE = 0.085
const MEIO_BANZO_NO_TOPO = 0.068
const ALTURA_DOS_BANZOS = 0.13

/** O meio do banzo de través e a meia grossura dele no ponto `x` (px), do pé à ponta de cima. */
function banzoEm(x: number, { X, Y }: Regua): { readonly meio: number; readonly meia: number } {
  const t = limitar((x - X(PE)) / (X(TOPO) - X(PE)), 0, 1)
  return {
    meio: Y(ABERTURA_NO_PE + (ABERTURA_NO_TOPO - ABERTURA_NO_PE) * t),
    meia: Y(MEIO_BANZO_NO_PE + (MEIO_BANZO_NO_TOPO - MEIO_BANZO_NO_PE) * t),
  }
}

function montarBanzos(c: ContextoDoMovel, cena: Cena, regua: Regua): void {
  const { X, Y, k } = regua
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const pe = banzoEm(X(PE), regua)
  const topo = banzoEm(X(TOPO), regua)
  for (const lado of [-1, 1]) {
    const banzo = poligono([
      [X(PE), lado * (pe.meio - pe.meia)],
      [X(TOPO), lado * (topo.meio - topo.meia)],
      [X(TOPO), lado * (topo.meio + topo.meia)],
      [X(PE), lado * (pe.meio + pe.meia)],
    ])
    cena.sombras.push({ forma: banzo, z: c.g * ALTURA_DOS_BANZOS, forca: 0.3 }, contato(banzo, 0.32))
    // A luz do tronco roliço: a beira de través acompanha o banzo, que afina e fecha para cima.
    const onde = (px: number, py: number): number => {
      const b = banzoEm(px, regua)
      return (lado * py - b.meio) / b.meia
    }
    L.push(P(banzo, mad, { eixo: Math.atan2(lado * (topo.meio - pe.meio), X(TOPO) - X(PE)), tabua: 0, bisel: 0.8, tom: 0.92, contorno: 0.3, textura: texDeCilindro(onde, LUZ_Y * lado, FORCA_NA_MADEIRA, 'madeira'), semente: 7100 + lado }))
    // A ponteira de ferro do pé: o bico que firma a escada no chão.
    const yP = lado * pe.meio
    const ponteira = poligono([[X(PE) + k * 0.05, yP - pe.meia * 0.95], [X(PE) - Y(0.07), yP], [X(PE) + k * 0.05, yP + pe.meia * 0.95]])
    cena.sombras.push(contato(ponteira, 0.28))
    L.push(P(ponteira, FERRAGEM, { eixo: 0, tabua: 0, bisel: 0.7, tom: 0.98, contorno: 0.3, metal: 0.4, semente: 7103 + lado }))
    L.push(P(caixa(X(PE) + k * 0.04, yP - pe.meia - 0.3, X(PE) + k * 0.075, yP + pe.meia + 0.3, 0.4), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 1.02, contorno: 0.24, metal: 0.35, textura: texDeCilindro((_px, py) => (py - yP) / (pe.meia + 0.3), LUZ_Y, FORCA_NO_FERRO, 'metal'), semente: 7105 + lado }))
  }
}

// ---------- os degraus e as amarras ----------

/** Um degrau a cada tanto do comprimento (em casas, do tamanho de mesa): esticada, a escada ganha degraus. */
const VAO_DOS_DEGRAUS = 0.38
/** O primeiro e o último degrau, a partir do pé e antes da travessa de cima. */
const PRIMEIRO_DEGRAU = -0.405
const ULTIMO_DEGRAU = 0.33
const MEIO_DEGRAU = 0.05
/** Quanto a ponta do degrau sai para fora do banzo (fração da altura). */
const PONTA_DO_DEGRAU = 0.06
const ALTURA_DOS_DEGRAUS = 0.2

function montarDegraus(c: ContextoDoMovel, cena: Cena, regua: Regua): void {
  const { X, Y } = regua
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const de = X(PRIMEIRO_DEGRAU)
  const ate = X(ULTIMO_DEGRAU)
  const quantos = Math.max(2, Math.round((ate - de) / (c.g * VAO_DOS_DEGRAUS)) + 1)
  const r = Y(MEIO_DEGRAU)
  for (let i = 0; i < quantos; i += 1) {
    const x = de + ((ate - de) * i) / (quantos - 1)
    const b = banzoEm(x, regua)
    const fora = b.meio + b.meia + Y(PONTA_DO_DEGRAU)
    const degrau = capsula(x, -fora, x, fora, r)
    cena.sombras.push({ forma: degrau, z: c.g * ALTURA_DOS_DEGRAUS, solta: true, forca: 0.3 })
    L.push(P(degrau, mad, { eixo: QUARTO, tabua: 0, bisel: 0.6, tom: 1.04 - (i % 2) * 0.05, contorno: 0.3, textura: texDeCilindro((px) => (px - x) / r, LUZ_X, FORCA_NA_MADEIRA, 'madeira'), semente: 7110 + i, projeta: { dist: 0.9, forca: 0.3 } }))
    // A amarra em cada encontro: as voltas de corda em X por cima do degrau e do banzo.
    for (const lado of [-1, 1]) {
      const cy = lado * b.meio
      const raio = Math.max(r, b.meia) * 1.05
      const amarra = elipse(x, cy, r * 1.55, b.meia * 1.12)
      L.push(P(amarra, CANHAMO, { tabua: 0, bisel: 0.6, contorno: 0.3, textura: texDaAmarra(x, cy, raio), semente: 7140 + i * 2 + lado, projeta: { dist: 0.5, forca: 0.24 } }))
    }
  }
}

// ---------- a travessa de cima e os ganchos ----------

/**
 * A travessa de cima: onde fica (fração do comprimento), a meia largura dela ao comprido (fração de `k`, para
 * não engordar com a escada esticada) e quanto sai para fora dos banzos (fração da altura).
 */
const TRAVESSA = 0.405
const MEIA_TRAVESSA = 0.068
const PONTA_DA_TRAVESSA = 0.04
const ALTURA_DA_TRAVESSA = 0.24
/**
 * Os ganchos: o caminho de cada um a partir da ponta do banzo, em frações de `k` (ao comprido, para fora),
 * para a garra não esticar com a escada: vai para a frente, abre para fora e volta com a ponta para trás.
 */
const CAMINHO_DO_GANCHO: readonly Ponto[] = [
  [0.0, 0.0],
  [0.14, 0.0],
  [0.232, 0.04],
  [0.24, 0.11],
  [0.18, 0.17],
  [0.088, 0.19],
  [0.032, 0.165],
]
const RAIO_DO_GANCHO = 0.04
/** Quanto o bico da ponta do gancho avança além da curva, em raios do ferro. */
const BICO_DO_GANCHO = 2.4
const ALTURA_DOS_GANCHOS = 0.18

function montarTopo(c: ContextoDoMovel, cena: Cena, regua: Regua): void {
  const { X, Y, k } = regua
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const topo = banzoEm(X(TOPO), regua)
  // Os ganchos primeiro: a ponta do banzo e a travessa ficam por cima do pé deles.
  for (const lado of [-1, 1]) {
    const x0 = X(TOPO) - k * 0.02
    const y0 = lado * topo.meio
    const caminho = CAMINHO_DO_GANCHO.map(([fx, fy]): Ponto => [x0 + k * fx, y0 + lado * k * fy])
    const rg = k * RAIO_DO_GANCHO
    const gancho = cadeia(caminho, rg)
    cena.sombras.push({ forma: gancho, z: c.g * ALTURA_DOS_GANCHOS, solta: true, forca: 0.32 }, contato(gancho, 0.26))
    L.push(P(gancho, FERRAGEM, { bisel: rg * 0.9, tom: 0.92, contorno: 0.32, metal: 0.45, semente: 7170 + lado, projeta: { dist: 0.7, forca: 0.28 } }))
    // A ponta afiada do gancho, mais clara (o ferro gasto de morder pedra): o bico continua o último pedaço da
    // curva e afina até a ponta, para a garra ler como gancho e não como argola.
    const [px, py] = caminho[caminho.length - 1]
    const [ax, ay] = caminho[caminho.length - 2]
    const comp = Math.hypot(px - ax, py - ay) || 1
    const ux = (px - ax) / comp
    const uy = (py - ay) / comp
    const bico = poligono([[px - uy * rg * 1.1, py + ux * rg * 1.1], [px + ux * rg * BICO_DO_GANCHO, py + uy * rg * BICO_DO_GANCHO], [px + uy * rg * 1.1, py - ux * rg * 1.1]])
    L.push(P(bico, FERRAGEM, { tabua: 0, bisel: rg * 0.5, tom: 1.2, contorno: 0.28, metal: 0.55, semente: 7173 + lado }))
    // A cinta que prende o gancho na ponta do banzo.
    L.push(P(caixa(X(TOPO) - k * 0.06, y0 - topo.meia - 0.4, X(TOPO) - k * 0.035, y0 + topo.meia + 0.4, 0.4), FERRAGEM, { tabua: 0, bisel: 0.5, tom: 1.0, contorno: 0.24, metal: 0.35, textura: texDeCilindro((_px, py) => (py - y0) / (topo.meia + 0.4), LUZ_Y, FORCA_NO_FERRO, 'metal'), semente: 7176 + lado }))
  }
  // A travessa grossa de cima, por cima dos banzos, com a cinta de ferro em cada encontro.
  const xT = X(TRAVESSA)
  const fora = topo.meio + topo.meia + Y(PONTA_DA_TRAVESSA)
  const travessa = caixa(xT - k * MEIA_TRAVESSA, -fora, xT + k * MEIA_TRAVESSA, fora, 1)
  cena.sombras.push({ forma: travessa, z: c.g * ALTURA_DA_TRAVESSA, solta: true, forca: 0.32 })
  L.push(P(travessa, mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.98, contorno: 0.32, semente: 7180, projeta: { dist: 1, forca: 0.32 } }))
  for (const lado of [-1, 1]) {
    const y = lado * topo.meio
    L.push(P(caixa(xT - k * MEIA_TRAVESSA - 0.4, y - k * 0.012, xT + k * MEIA_TRAVESSA + 0.4, y + k * 0.012, 0.3), FERRAGEM, { tabua: 0, bisel: 0.4, tom: 1.04, contorno: 0.22, metal: 0.35, semente: 7182 + lado }))
  }
}

export const montarEscadaDeCerco: MontarMovel = (c, cena) => {
  const regua: Regua = { X: (f) => f * c.w, Y: (f) => f * c.h, k: Math.min(c.h, c.w / 4) }
  montarBanzos(c, cena, regua)
  montarDegraus(c, cena, regua)
  montarTopo(c, cena, regua)
}
