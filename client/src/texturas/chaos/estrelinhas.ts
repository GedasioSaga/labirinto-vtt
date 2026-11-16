import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * ESTRELINHAS (lote das referências, 15/11/2026: "piso branco com estrelinhas"; cartão Pisos de cerâmica): o
 * ladrilho hidráulico claro de copa, de corredor e de casa de pensão. Ladrilhos de cimento marfim de meia casa, a
 * junta quase sumida, e em ladrilho sim, ladrilho não (em xadrez, então as estrelas caem em quincôncio), uma
 * estrelinha de ardósia no meio: quatro pontas compridas nos eixos e quatro curtas nas diagonais, como rosa dos
 * ventos miúda. O cimento é fosco: nuvens largas, o poro miúdo, o caminho gasto mais claro, a estrela um nada
 * desbotada onde mais se pisa, e a sujeira na junta.
 *
 * A estrela é escura só até onde a régua deixa: ela cobre ~2% do chão, então o 1% mais escuro cai nela, e a faixa
 * de luz (o 1% mais claro menos o 1% mais escuro) tem teto de 0,4. Daí o marfim um nada abaixo do branco e a estrela
 * de ardósia em vez de preta.
 *
 * Diferente das Bolinhas pretas (o outro chão claro com desenho): aqui a peça é maior, a junta some, o desenho fica
 * no MEIO da peça e é estrela; lá a peça é octógono de junta clara e a bolinha fica no canto.
 */

const CASAS = 8
/** Ladrilhos por casa, de cada lado (meia casa cada). */
const POR_CASA = 2
const PECAS = CASAS * POR_CASA
const LADO = 1 / POR_CASA
const SEMENTE = 6600

/** A estrela, em casas: o raio das pontas compridas, o das curtas e o do miolo; a borda macia (sem serrilha). */
const ESTRELA = { comprida: 0.145, curta: 0.088, miolo: 0.042, macia: 0.006 } as const
/** O quanto a ponta afina: o cosseno do ângulo duplo vai à potência 2 x AFINA (6: ponta de uns 15° de cada lado). */
const AFINA = 3
/** A junta quase sumida, em casas a partir da beira, e o quanto ela pesa. */
const JUNTA = { fio: 0.004, fim: 0.016, forca: 0.55 } as const
/** O ladrilho de cimento: o quanto cada peça foge do tom, as nuvens largas e o poro miúdo. */
const VARIACAO_DA_PECA = 0.014
const NUVEM = 0.02
const PORO = 0.016
/** O caminho gasto: o cimento clareia e a estrela desbota (mistura com o marfim). */
const GASTO = { luz: 0.025, desbota: 0.22 } as const

const TONS: readonly Rgb[] = [rgb('#cfcabe'), rgb('#d1ccc1'), rgb('#ccc7bb'), rgb('#d0cbbf')]
/** Ardósia azulada, apagada: a estrela. */
const COR_DA_ESTRELA = rgb('#68717c')
const COR_DA_JUNTA = rgb('#b4aea2')
const JUNTA_SUJA = rgb('#9d978b')

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** |t| elevado a 2 x AFINA, só com multiplicação (a mesma conta em todo navegador). */
function ponta(t: number): number {
  const q = t * t
  let r = q
  for (let k = 1; k < AFINA; k += 1) r *= q
  return r
}

/** Quanto da estrela cobre o ponto (px, py), em casas a partir do centro dela (1 = dentro, 0 = fora). */
function estrela(px: number, py: number): number {
  const r2 = px * px + py * py
  if (r2 > ESTRELA.comprida * ESTRELA.comprida * 1.2) return 0
  if (r2 < 1e-12) return 1
  // Ângulo duplo sem trigonometria: cos 2θ = (x² - y²) / r², sen 2θ = 2xy / r².
  const cos2 = (px * px - py * py) / r2
  const sen2 = (2 * px * py) / r2
  const raio = ESTRELA.miolo + (ESTRELA.comprida - ESTRELA.miolo) * ponta(cos2) + (ESTRELA.curta - ESTRELA.miolo) * ponta(sen2)
  return passoSuave(ESTRELA.macia, -ESTRELA.macia, Math.sqrt(r2) - raio)
}

export function texturaEstrelinhas(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * PECAS
  const y = vv * PECAS
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const peca = (iy % PECAS) * PECAS + (ix % PECAS)
  const lx = x - ix
  const ly = y - iy
  const borda = Math.min(lx, ly, 1 - lx, 1 - ly) * LADO

  let c = TONS[Math.floor(hash(peca, 0, SEMENTE) * TONS.length) % TONS.length]
  let k = (hash(peca, 1, SEMENTE) - 0.5) * 2 * VARIACAO_DA_PECA
  k += fbm(uu, vv, 6, 3, SEMENTE + 1) * NUVEM
  k += (valor(uu * 320, vv * 320, 320, SEMENTE + 2) - 0.5) * PORO
  const gasto = passoSuave(0.15, 0.75, fbm(uu, vv, 2, 3, SEMENTE + 3))
  k += gasto * GASTO.luz
  c = luz(c, k)

  // A estrela, no ladrilho de cada casa do xadrez.
  if (((ix + iy) & 1) === 0) {
    const cobre = estrela((lx - 0.5) * LADO, (ly - 0.5) * LADO)
    if (cobre > 0) {
      const tinta = luz(COR_DA_ESTRELA, (valor(uu * 256, vv * 256, 256, SEMENTE + 4) - 0.5) * 0.06)
      c = misturar(c, tinta, cobre * (1 - gasto * GASTO.desbota))
    }
  }

  const sujo = passoSuave(-0.2, 0.7, fbm(uu, vv, 3, 3, SEMENTE + 5))
  return empacotar(misturar(c, misturar(COR_DA_JUNTA, JUNTA_SUJA, sujo), passoSuave(JUNTA.fim, JUNTA.fio, borda) * JUNTA.forca))
}
