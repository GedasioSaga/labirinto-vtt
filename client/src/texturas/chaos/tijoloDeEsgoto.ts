import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * TIJOLO DE ESGOTO (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Esgotos):
 * o piso de tijolo do canal, sempre molhado. Tijolo de 1/3 x 2/3 de casa (o da Rua de tijolos) em FIADA CORRIDA, um
 * nada fora do lugar; o barro é pardo-avermelhado e lavado pela água (cada tijolo de uma queima: um mais pardo, um
 * mais tijolo, um raro bem queimado, um raro desbotado), com o ombro de cima à esquerda pegando a luz como pedra
 * molhada. O ENCARDIDO é um filme verde-cinza por posição, largo, e a JUNTA é escura, com o LIMO verde-oliva nos
 * trechos úmidos. As POÇAS são o que diz "esgoto": manchas rasas de uma a duas casas onde a água junta (um sexto do
 * chão, várias por ladrilho), com a água transparente por cima do tijolo (ele escurece, a junta só esmaece), a beira de
 * menisco um nada mais clara e o brilho macio do céu batendo nelas.
 *
 * Diferente do Tijolo de cela (miúdo, vinho escuro, seco) e da Rua de tijolos (vermelho vivo em espinha de peixe,
 * junta de areia clara): aqui o tijolo é pardo, a junta é verde de limo e o chão tem poças.
 */

const CASAS = 8
const FILAS_POR_CASA = 3
const FILAS = CASAS * FILAS_POR_CASA
const ALTURA = 1 / FILAS_POR_CASA
const COMPRIMENTO = 2 * ALTURA
const POR_FILA = Math.round(CASAS / COMPRIMENTO)
const SEMENTE = 12500

const MEIA_JUNTA = [0.016, 0.021] as const
const CANTO = [0.012, 0.035] as const
const ROIDO = 0.005
const DESALINHO = 0.12
const OMBRO = { largura: 0.035, inclinacao: 0.24 } as const
const LUZ_DO_RELEVO = 0.26
const TORTO = 0.03
const PASSAGEM = { dentro: -0.007, fora: 0.007 } as const
const VARIACAO = 0.06
const QUEIMADO = { chance: 0.05, luz: -0.2 } as const
const DESBOTADO = { chance: 0.07, luz: 0.08, tinta: 0.35 } as const
const MANCHA = 0.045
const PORO = 0.03
/** O filme verde-cinza por posição e a sujeira que junta na beira do tijolo. */
const ENCARDIDO = { tinta: 0.5, escuro: 0.1 } as const
const SUJEIRA_NA_BEIRA = { largura: 0.04, forca: 0.08 } as const
/** O limo na junta: onde o ruído largo passa deste limiar a junta fica verde. */
const LIMO_NA_JUNTA = { de: -0.05, ate: 0.3 } as const
/**
 * As poças: o ruído (a escala dá poças de uma a duas casas, várias por ladrilho, para a repetição não aparecer), o
 * limiar (um sexto do chão), a água rasa e transparente por cima (o tijolo escurece e a junta só esmaece), o menisco e
 * o brilho do céu.
 */
const ESCALA_DA_POCA = 5
const POCA = { de: 0.17, ate: 0.27, tinta: 0.3, escuro: 0.16, junta: 0.5 } as const
const MENISCO = 0.06
/** O fundo da poça grande: onde o ruído passa deste limiar, a água lisa reflete o céu e cobre o tijolo pela metade. */
const FUNDO = { de: 0.26, ate: 0.42, forca: 0.5 } as const

/** Barro pardo-avermelhado lavado (matiz ~15°, croma contido): o azul nunca acima do verde. */
const TONS: readonly Rgb[] = [rgb('#6b4a3a'), rgb('#72503e'), rgb('#634536'), rgb('#76563f'), rgb('#6e4c3b'), rgb('#5f4334')]
const DESBOTADA = rgb('#7a6b5d')
/** O filme verde-cinza do encardido. */
const ENCARDIDA = rgb('#4b4a3c')
/** A junta: argamassa escura suja e a de limo. */
const COR_DA_JUNTA = rgb('#2f2d27')
const JUNTA_DE_LIMO = rgb('#3e4a2c')
/** A água da poça (parda-esverdeada, a da Poça de esgoto) e o reflexo liso do céu no fundo dela. */
const AGUA = rgb('#3b443c')
const COR_DO_REFLEXO = rgb('#56605a')

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function voltaInteira(n: number, m: number): number {
  const r = n % m
  return r < 0 ? r + m : r
}

/** A cor do tijolo de esgoto no ponto (u, v) do ladrilho de 8 casas. */
export function texturaTijoloDeEsgoto(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const y = vv * FILAS + 0.5
  const fila = Math.floor(y) % FILAS
  const fy = y - Math.floor(y)
  // O quarto de tijolo a mais tira a junta da emenda do ladrilho (sem ele, a junta das filas pares caía em cima dela).
  const desloca = (fila % 2) * 0.5 + 0.25 + (hash(fila, 0, SEMENTE) - 0.5) * DESALINHO
  const x = uu * POR_FILA + desloca
  const coluna = voltaInteira(Math.floor(x), POR_FILA)
  const fx = x - Math.floor(x)
  const tijolo = fila * POR_FILA + coluna

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

  // O tijolo: a queima, a mancha do barro, o poro, o encardido largo e a sujeira na beira.
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
  const encardido = passoSuave(-0.2, 0.7, fbm(uu, vv, 3, 3, SEMENTE + 4))
  c = misturar(c, ENCARDIDA, encardido * ENCARDIDO.tinta)
  k -= encardido * ENCARDIDO.escuro
  k -= passoSuave(SUJEIRA_NA_BEIRA.largura, 0, -borda) * SUJEIRA_NA_BEIRA.forca
  c = luz(c, k)
  // O ombro molhado pega a luz de cima à esquerda; cada tijolo um nada torto.
  const ombro = OMBRO.inclinacao * (1 - passoSuave(0, OMBRO.largura, -borda))
  const dhx = -nx * ombro + (hash(tijolo, 8, SEMENTE) - 0.5) * 2 * TORTO
  const dhy = -ny * ombro + (hash(tijolo, 9, SEMENTE) - 0.5) * 2 * TORTO
  c = luz(c, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * LUZ_DO_RELEVO)

  // A junta: escura, e verde de limo onde o chão fica sempre úmido.
  const limo = passoSuave(LIMO_NA_JUNTA.de, LIMO_NA_JUNTA.ate, fbm(uu, vv, 4, 3, SEMENTE + 6))
  const naJunta = passoSuave(PASSAGEM.dentro, PASSAGEM.fora, borda)
  const junta = luz(misturar(COR_DA_JUNTA, JUNTA_DE_LIMO, limo), (valor(uu * 256, vv * 256, 256, SEMENTE + 5) - 0.5) * 0.1)

  // A poça: a água por cima do tijolo e da junta (a junta quase some), o menisco e o céu macio.
  const campo = fbm(uu, vv, ESCALA_DA_POCA, 3, SEMENTE + 7)
  const poca = passoSuave(POCA.de, POCA.ate, campo)
  c = misturar(c, junta, naJunta * (1 - POCA.junta * poca))
  if (poca <= 0) return empacotar(c)
  c = luz(misturar(c, AGUA, POCA.tinta * poca), -POCA.escuro * poca)
  const menisco = poca * (1 - poca) * 4
  c = luz(c, MENISCO * menisco)
  const fundo = passoSuave(FUNDO.de, FUNDO.ate, campo)
  return empacotar(misturar(c, COR_DO_REFLEXO, FUNDO.forca * fundo))
}
