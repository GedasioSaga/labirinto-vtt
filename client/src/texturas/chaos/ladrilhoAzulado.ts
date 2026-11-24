import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * LADRILHO AZULADO (lista de 24/11/2026, item 116; forma no cartão Pisos de pedra; o "ladrilho miúdo azulado" do
 * salão azul do mapa 4): quadradinhos de pedra cinza-azulada de MEIA CASA (a Laje de templo tem 2 x 2 casas), em
 * grade reta, dois por dois em cada casa. O assentamento anda 1/4 de casa nos dois eixos: a linha da grade do mapa
 * passa no MEIO do ladrilho e não some dentro da junta (com a junta na linha, a grade dobrava e o chão lia como papel
 * quadriculado). Cada ladrilho no seu tom de pedra azulada, a beira gasta e redonda (o ombro de cima à esquerda pega
 * a luz), assentado um nada torto, a poeira juntando na beira; um em seis CEDIDO (mais torto e mais escuro), um ou
 * outro manchado e um ou outro com o canto LASCADO (o rejunte toma o canto que falta).
 */

const CASAS = 8
const POR_CASA = 2
const N = CASAS * POR_CASA
/** O lado do ladrilho, em casas. */
const LADO = 1 / POR_CASA
/** O deslocamento do assentamento, em ladrilhos: meio ladrilho = 1/4 de casa. */
const DESLOCA = 0.5
const SEMENTE = 11600

/** Meia junta de cada ladrilho, em casas. */
const MEIA_JUNTA = [0.016, 0.021] as const
/** O raio do canto gasto, em casas. */
const CANTO = [0.02, 0.05] as const
/** O quanto a borda serpenteia (pedra serrada à mão), em casas. */
const TORCAO = { larga: 0.005, miuda: 0.0025 } as const
/** O ombro gasto: a faixa (casas) e a inclinação na borda. */
const OMBRO = { largura: 0.035, inclinacao: 0.24 } as const
const TORTO = 0.03
/** O ladrilho cedido: em quantos, o quanto fica torto (no lugar de `TORTO`) e o quanto escurece. */
const CEDIDO = { chance: 1 / 6, torto: 0.05, luz: -0.06 } as const
const LUZ_DO_RELEVO = 0.22
/** A passagem macia do ladrilho para a junta, em casas a partir da borda. */
const PASSAGEM = { dentro: -0.007, fora: 0.006 } as const
/** A poeira na beira: até onde entra (casas) e quanto escurece. */
const POEIRA = { largura: 0.07, forca: 0.045 } as const
/** O canto lascado: em quantos ladrilhos, e o raio da lasca em casas. */
const LASCA = { chance: 0.16, raio: [0.04, 0.075] as const } as const
/** O ladrilho manchado: em quantos, e o quanto escurece. */
const MANCHADO = { chance: 0.1, luz: -0.09 } as const

/** Pedra cinza-azulada (croma ~0,06): o azul é de pedra, não de azulejo. */
const TONS: readonly Rgb[] = [rgb('#78808a'), rgb('#737b84'), rgb('#7b838b'), rgb('#707881'), rgb('#7a8187'), rgb('#757d86'), rgb('#7c8286')]
/** O rejunte: o mesmo azul-cinza, sujo, perto do ladrilho (o fundo de antes dava contraste de azulejo de banheiro). */
const COR_DA_JUNTA = rgb('#535b64')
/** As nuvens da pedra dentro do ladrilho: o tanto que escurecem e clareiam (a pedra não é vidrada). */
const NUVENS_DA_PEDRA = 0.06

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** A cor do ladrilho azulado no ponto (u, v) do ladrilho de 8 casas. */
export function texturaLadrilhoAzulado(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  // A emenda do ladrilho e a linha da grade caem no meio de um ladrilho, nunca numa junta.
  const x = uu * N + DESLOCA
  const y = vv * N + DESLOCA
  const ix = Math.floor(x) % N
  const iy = Math.floor(y) % N
  const ladrilho = iy * N + ix
  // O ponto no ladrilho, em casas a partir do meio, com a borda um nada torta.
  const torceX = fbm(uu, vv, 24, 2, SEMENTE + 1) * TORCAO.larga + fbm(uu, vv, 96, 1, SEMENTE + 2) * TORCAO.miuda
  const torceY = fbm(uu, vv, 24, 2, SEMENTE + 3) * TORCAO.larga + fbm(uu, vv, 96, 1, SEMENTE + 4) * TORCAO.miuda
  const dx = (x - Math.floor(x) - 0.5) * LADO + torceX
  const dy = (y - Math.floor(y) - 0.5) * LADO + torceY
  const meiaJunta = MEIA_JUNTA[0] + (MEIA_JUNTA[1] - MEIA_JUNTA[0]) * hash(ladrilho, 0, SEMENTE)
  const a = LADO / 2 - meiaJunta
  const r = CANTO[0] + (CANTO[1] - CANTO[0]) * hash(ladrilho, 1, SEMENTE)
  const sx = Math.abs(dx) - (a - r)
  const sy = Math.abs(dy) - (a - r)
  const ox = Math.max(sx, 0)
  const oy = Math.max(sy, 0)
  const fora = Math.sqrt(ox * ox + oy * oy)
  // Distância assinada à borda (negativa dentro) e o rumo para fora dela.
  let borda = fora + Math.min(Math.max(sx, sy), 0) - r
  let nx = 0
  let ny = 0
  if (fora > 0) {
    nx = (Math.sign(dx) * ox) / fora
    ny = (Math.sign(dy) * oy) / fora
  } else if (sx > sy) nx = Math.sign(dx)
  else ny = Math.sign(dy)
  // O canto lascado: a lasca é rejunte.
  if (hash(ladrilho, 7, SEMENTE) < LASCA.chance) {
    const qual = Math.floor(hash(ladrilho, 8, SEMENTE) * 4)
    const cantoX = (qual & 1 ? 1 : -1) * a
    const cantoY = (qual & 2 ? 1 : -1) * a
    const raio = LASCA.raio[0] + (LASCA.raio[1] - LASCA.raio[0]) * hash(ladrilho, 9, SEMENTE)
    const dLasca = Math.sqrt((dx - cantoX) ** 2 + (dy - cantoY) ** 2) + fbm(uu, vv, 64, 1, SEMENTE + 5) * 0.012
    borda = Math.max(borda, raio - dLasca)
  }

  let c = TONS[Math.floor(hash(ladrilho, 2, SEMENTE) * TONS.length) % TONS.length]
  const grao = valor(uu * 256, vv * 256, 256, SEMENTE + 6)
  const poro = passoSuave(0.18, 0.05, grao)
  let k = fbm(uu, vv, 12, 3, SEMENTE + 7) * NUVENS_DA_PEDRA + (hash(ladrilho, 3, SEMENTE) - 0.5) * 0.08 + (grao - 0.5) * 0.04 - poro * 0.06
  if (hash(ladrilho, 4, SEMENTE) < MANCHADO.chance) k += MANCHADO.luz * (0.6 + 0.4 * passoSuave(-0.4, 0.4, fbm(uu, vv, 16, 2, SEMENTE + 8)))
  // O cedido afundou um nada: mais escuro e mais torto que os vizinhos (a grade deixa de ser de régua).
  const cedido = hash(ladrilho, 10, SEMENTE) < CEDIDO.chance
  if (cedido) k += CEDIDO.luz
  c = luz(c, k)
  c = luz(c, -passoSuave(POEIRA.largura, 0, -borda) * POEIRA.forca)
  // O ombro gasto pega a luz de cima à esquerda; o ladrilho inteiro um nada torto.
  const torto = cedido ? CEDIDO.torto : TORTO
  const ombro = OMBRO.inclinacao * (1 - passoSuave(0, OMBRO.largura, -borda))
  const dhx = -nx * ombro + (hash(ladrilho, 5, SEMENTE) - 0.5) * 2 * torto
  const dhy = -ny * ombro + (hash(ladrilho, 6, SEMENTE) - 0.5) * 2 * torto
  c = luz(c, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * LUZ_DO_RELEVO)
  const naJunta = passoSuave(PASSAGEM.dentro, PASSAGEM.fora, borda)
  if (naJunta <= 0) return empacotar(c)
  return empacotar(misturar(c, luz(COR_DA_JUNTA, (grao - 0.5) * 0.1 + fbm(uu, vv, 20, 2, SEMENTE + 10) * 0.05), naJunta))
}
