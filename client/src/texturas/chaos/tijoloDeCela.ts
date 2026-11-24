import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * TIJOLO DE CELA (lista de 24/11/2026, item 112; versão da Rua de tijolos; junta o "tijolo avermelhado" dos
 * corredores do mapa 4 e o chão das celas do mapa 2): tijolo MIÚDO, de 1/5 x 2/5 de casa (a Rua usa 1/3 x 2/3),
 * escuro e encardido, puxando para o vinho, assentado em fiadas corridas com a fiada de baixo meio tijolo adiante (e
 * um nada fora do lugar: assentado à mão). Cada tijolo de uma queima (um mais roxo, um mais pardo, um ou outro bem
 * queimado e escuro, um raro desbotado), o barro manchado e poroso, os cantos gastos e a borda roída; o ombro de cima
 * à esquerda pega a luz. O ENCARDIDO é largo e por posição: a sujeira escurece e acinzenta trechos inteiros do chão,
 * junta mais na beira de cada tijolo e escurece a junta, que é de argamassa suja, mais escura que o tijolo.
 *
 * Diferente da Rua de tijolos: lá é barro vermelho vivo em espinha de peixe, de junta larga e clara de areia; aqui o
 * tijolo é menor, em fiada corrida, escuro, cor de vinho, e a junta é estreita e escura.
 */

const CASAS = 8
const FILAS_POR_CASA = 5
const FILAS = CASAS * FILAS_POR_CASA
/** O tijolo, em casas: 1/5 de altura e o dobro de comprimento. */
const ALTURA = 1 / FILAS_POR_CASA
const COMPRIMENTO = 2 * ALTURA
const POR_FILA = Math.round(CASAS / COMPRIMENTO)
const SEMENTE = 11200

/** Meia junta de cada tijolo, em casas (a junta inteira tem uns 4 cm). */
const MEIA_JUNTA = [0.011, 0.015] as const
/** O canto gasto (raio em casas) e o quanto a borda é roída. */
const CANTO = [0.01, 0.03] as const
const ROIDO = 0.0045
/** O quanto cada fiada sai do meio tijolo certinho (fração do tijolo): assentado à mão. */
const DESALINHO = 0.14
/** O ombro gasto: a faixa (casas) e a inclinação na borda. */
const OMBRO = { largura: 0.03, inclinacao: 0.22 } as const
const LUZ_DO_RELEVO = 0.22
/** Cada tijolo assentado um nada torto. */
const TORTO = 0.03
/** A passagem macia do tijolo para a junta, em casas a partir da borda. */
const PASSAGEM = { dentro: -0.006, fora: 0.006 } as const
/** O tijolo: o quanto foge do tom, o bem queimado, o raro desbotado, a mancha do barro e o poro. */
const VARIACAO = 0.06
const QUEIMADO = { chance: 0.09, luz: -0.22 } as const
const DESBOTADO = { chance: 0.06, luz: 0.1, tinta: 0.3 } as const
const MANCHA = 0.04
const PORO = 0.035
/** O encardido largo: o quanto acinzenta e escurece onde está; e a sujeira que junta na beira do tijolo. */
const ENCARDIDO = { tinta: 0.45, escuro: 0.14 } as const
const SUJEIRA_NA_BEIRA = { largura: 0.035, forca: 0.07 } as const

/** Barro cor de vinho, escuro e contido (croma ~0,15): o azul nunca abaixo do verde, para puxar ao vinho e não ao telha. */
const TONS: readonly Rgb[] = [rgb('#563236'), rgb('#5b3539'), rgb('#502f33'), rgb('#5f383a'), rgb('#553437'), rgb('#52323a')]
/** O tijolo desbotado e o encardido: o mesmo barro lavado de cinza. */
const DESBOTADA = rgb('#665052')
const ENCARDIDA = rgb('#3c3534')
/** A argamassa suja (mais escura que o tijolo) e a dos trechos encardidos. */
const COR_DA_JUNTA = rgb('#312a29')
const JUNTA_SUJA = rgb('#272322')

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function voltaInteira(n: number, m: number): number {
  const r = n % m
  return r < 0 ? r + m : r
}

/** A cor do tijolo de cela no ponto (u, v) do ladrilho de 8 casas. */
export function texturaTijoloDeCela(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  // Meia fiada de deslocamento: a emenda do ladrilho cai no meio do tijolo, nunca numa junta.
  const y = vv * FILAS + 0.5
  const fila = Math.floor(y) % FILAS
  const fy = y - Math.floor(y)
  const desloca = (fila % 2) * 0.5 + (hash(fila, 0, SEMENTE) - 0.5) * DESALINHO
  const x = uu * POR_FILA + desloca
  const coluna = voltaInteira(Math.floor(x), POR_FILA)
  const fx = x - Math.floor(x)
  const tijolo = fila * POR_FILA + coluna

  // O ponto no tijolo, em casas a partir do meio, e a distância assinada à borda (negativa dentro).
  const px = (fx - 0.5) * COMPRIMENTO
  const py = (fy - 0.5) * ALTURA
  const meiaJunta = MEIA_JUNTA[0] + (MEIA_JUNTA[1] - MEIA_JUNTA[0]) * hash(tijolo, 6, SEMENTE)
  const ax = COMPRIMENTO / 2 - meiaJunta
  const ay = ALTURA / 2 - meiaJunta
  const r = CANTO[0] + (CANTO[1] - CANTO[0]) * hash(tijolo, 7, SEMENTE)
  const sx = Math.abs(px) - (ax - r)
  const sy = Math.abs(py) - (ay - r)
  const ox = Math.max(sx, 0)
  const oy = Math.max(sy, 0)
  const fora = Math.sqrt(ox * ox + oy * oy)
  const roido = (valor(uu * 192, vv * 192, 192, SEMENTE + 1) - 0.5) * 2 * ROIDO
  const borda = fora + Math.min(Math.max(sx, sy), 0) - r + roido
  let nx = 0
  let ny = 0
  if (fora > 0) {
    nx = (Math.sign(px) * ox) / fora
    ny = (Math.sign(py) * oy) / fora
  } else if (sx > sy) nx = Math.sign(px)
  else ny = Math.sign(py)

  let c = TONS[Math.floor(hash(tijolo, 1, SEMENTE) * TONS.length) % TONS.length]
  let k = (hash(tijolo, 2, SEMENTE) - 0.5) * 2 * VARIACAO
  const sorte = hash(tijolo, 3, SEMENTE)
  if (sorte < QUEIMADO.chance) k += QUEIMADO.luz
  else if (sorte > 1 - DESBOTADO.chance) {
    c = misturar(c, DESBOTADA, DESBOTADO.tinta)
    k += DESBOTADO.luz
  }
  k += fbm(naVolta(uu + hash(tijolo, 4, SEMENTE)), naVolta(vv + hash(tijolo, 5, SEMENTE)), 24, 2, SEMENTE + 2) * MANCHA
  k += (valor(uu * 448, vv * 448, 448, SEMENTE + 3) - 0.5) * PORO
  // O encardido: trechos largos do chão mais sujos (por posição), e a sujeira que junta na beira de cada tijolo.
  const encardido = passoSuave(-0.15, 0.75, fbm(uu, vv, 3, 3, SEMENTE + 4))
  c = misturar(c, ENCARDIDA, encardido * ENCARDIDO.tinta)
  k -= encardido * ENCARDIDO.escuro
  k -= passoSuave(SUJEIRA_NA_BEIRA.largura, 0, -borda) * SUJEIRA_NA_BEIRA.forca
  c = luz(c, k)
  // O ombro gasto pega a luz de cima à esquerda; cada tijolo um nada torto.
  const ombro = OMBRO.inclinacao * (1 - passoSuave(0, OMBRO.largura, -borda))
  const dhx = -nx * ombro + (hash(tijolo, 8, SEMENTE) - 0.5) * 2 * TORTO
  const dhy = -ny * ombro + (hash(tijolo, 9, SEMENTE) - 0.5) * 2 * TORTO
  c = luz(c, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * LUZ_DO_RELEVO)
  const naJunta = passoSuave(PASSAGEM.dentro, PASSAGEM.fora, borda)
  if (naJunta <= 0) return empacotar(c)
  const junta = luz(misturar(COR_DA_JUNTA, JUNTA_SUJA, encardido), (valor(uu * 256, vv * 256, 256, SEMENTE + 5) - 0.5) * 0.1)
  return empacotar(misturar(c, junta, naJunta))
}
