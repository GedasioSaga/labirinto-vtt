/**
 * PONTE LEVADIÇA de cima com volume (lote L02 de 14/11/2026, o castelo): a
 * ponte do fosso, baixada, por onde se anda (fica no Objeto, como a ponte).
 * De ponta a ponta, do lado do castelo (o começo da régua) para o lado de
 * fora:
 *
 * - o EIXO, a tora grossa de través em que a ponte gira, com as pontas de
 *   ferro e as três DOBRADIÇAS (a chapa que abraça o eixo e corre pelo
 *   tabuleiro, cravada);
 * - o TABULEIRO de pranchas AO COMPRIDO (é a porta deitada; a ponte comum tem
 *   as tábuas de través), entre as duas VIGAS da beira, com as frestas escuras;
 * - as CINTAS DE FERRO de través, rebitadas em cada prancha, e a chapa da
 *   ponta de fora, que bate na margem;
 * - as duas CORRENTES, presas nas argolas da ponta de fora e correndo por cima
 *   das vigas até o lado do castelo, subindo: a sombra de cada elo cai mais
 *   longe quanto mais alto ele está (no tabuleiro, `projeta`; no chão, a
 *   sombra solta), e é isso que diz que elas sobem até o portão.
 *
 * O que lê a 25% de zoom é o retângulo de pranchas cortado pelas faixas
 * escuras de ferro, com a tora no começo e as correntes nas beiras. A ponte
 * corre ao longo do lado MAIOR da pegada (a de partida, 3 x 2, deitada, com o
 * castelo à esquerda); esticada, ganha pranchas, cintas e elos, nunca ferro
 * mais grosso. Está no ar, sobre o fosso: a sombra do tabuleiro cai solta.
 * Na 3/4 fica como de cima, como a ponte (perfil em pé). Materiais: `madeira`
 * e `ferragens`.
 */
import { anel, caixa, capsula, elipse, menos, type Forma, type Ponto } from './formas'
import { contato, type Cena } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Alturas em casas: o tabuleiro sobre o fosso, a corrente na ponta de fora e no lado do castelo. */
const ALTURA_DO_TABULEIRO = 0.32
const CORRENTE_NA_PONTA = 0.06
const CORRENTE_NO_CASTELO = 1.15
/** Medidas de través e ao comprido, em px do protótipo (na régua da casa de 56): esticar não engrossa nada. */
const RAIO_DO_EIXO = 6.6
const MEIO_DO_EIXO = 7.2
const COMECO_DO_TABULEIRO = 13
const LARGURA_DA_VIGA = 7.4
const PRANCHA = 9.6
const LARGURA_DA_CINTA = 3.8
/**
 * Uma cinta de ferro a cada tanto de casa ao comprido. Com uma a cada 0,62
 * casa (5 na de 3 casas), o ferro fazia grade e a ponte lia como portão
 * deitado a 25% de zoom.
 */
const PASSO_DA_CINTA = 1
const RAIO_DO_REBITE = 0.95
/**
 * A corrente: o passo de um elo, as medidas do elo deitado (o anel, meio
 * comprimento e meia largura, e a grossura do ferro) e as do de pé (o risco).
 * Grossa de propósito: é ela que diz "ponte levadiça" no tamanho de mesa.
 */
const PASSO_DO_ELO = 4.8
const ELO = { ru: 3.2, rv: 2.3, ferro: 1.4, du: 1.6, dv: 0.85 } as const
/** A argola da ponta de fora, onde a corrente é presa: a chapa, o raio da argola. */
const CHAPA_DA_ARGOLA = 4
const RAIO_DA_ARGOLA = 3.4
/** Quanto da altura do elo vira distância da sombra dele no tabuleiro (a do banco de praça é 0,3). */
const SOMBRA_POR_ALTURA = 0.3

/** 0..1 fixo por peça (o tom, o comprimento de cada prancha). */
function acaso(i: number, sal: number): number {
  const s = Math.sin(i * 12.9898 + sal * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/**
 * A régua da ponte: `u` ao longo (do castelo para fora), `v` de través, centro
 * na origem. Deitada, u é x; em pé, u é y (como a ponte).
 */
interface Regua {
  readonly C: number
  readonly A: number
  readonly pt: (u: number, v: number) => Ponto
  readonly ret: (u0: number, v0: number, u1: number, v1: number, raio: number) => Forma
  readonly circ: (u: number, v: number, r: number) => Forma
  readonly cap: (u0: number, v0: number, u1: number, v1: number, r: number) => Forma
  readonly aoLongo: number
  readonly deTraves: number
}

function reguaDa(c: ContextoDoMovel): Regua {
  const deitada = c.w >= c.h
  const pt = (u: number, v: number): Ponto => (deitada ? [u, v] : [-v, u])
  return {
    C: deitada ? c.hw : c.hh,
    A: deitada ? c.hh : c.hw,
    pt,
    ret: (u0, v0, u1, v1, raio) => (deitada ? caixa(u0, v0, u1, v1, raio) : caixa(-v1, u0, -v0, u1, raio)),
    circ: (u, v, r) => elipse(...pt(u, v), r, r),
    cap: (u0, v0, u1, v1, r) => capsula(...pt(u0, v0), ...pt(u1, v1), r),
    aoLongo: deitada ? 0 : QUARTO,
    deTraves: deitada ? QUARTO : 0,
  }
}

/** O tabuleiro: o fundo escuro das frestas, as pranchas ao comprido e as duas vigas da beira. */
function tabuleiro(c: ContextoDoMovel, cena: Cena, r: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const { C, A } = r
  const L = cena.partes
  const u0 = -C + COMECO_DO_TABULEIRO
  const dentro = A - LARGURA_DA_VIGA
  L.push(P(r.ret(u0, -dentro - 0.5, C - 0.5, dentro + 0.5, 0.6), mad, { tabua: 0, eixo: r.aoLongo, bisel: 0.4, tom: 0.42, contorno: 0.1, semente: 9000 }))
  const n = Math.max(2, Math.round((2 * dentro) / PRANCHA))
  const largura = (2 * dentro) / n
  for (let i = 0; i < n; i += 1) {
    const v0 = -dentro + i * largura + 0.55
    const fim = C - 1.2 - acaso(i, 1) * 1.4
    L.push(P(r.ret(u0 + acaso(i, 2) * 0.8, v0, fim, v0 + largura - 1.1, 0.7), mad, { tabua: 0, eixo: r.aoLongo, bisel: 1.1, tom: 0.88 + 0.18 * acaso(i, 3), contorno: 0.22, semente: 9010 + i }))
  }
  for (const lado of [-1, 1]) {
    const v0 = lado < 0 ? -A + 0.6 : dentro
    const v1 = lado < 0 ? -dentro : A - 0.6
    L.push(P(r.ret(u0 - 1, v0, C - 0.4, v1, 1.2), mad, { tabua: 0, eixo: r.aoLongo, bisel: 1.6, tom: 0.8, contorno: 0.28, semente: 9100 + lado, projeta: { dist: 0.8, forca: 0.24 } }))
  }
}

/** As cintas de ferro de través, rebitadas em cada prancha e nas vigas, e a chapa da ponta de fora. */
function cintas(c: ContextoDoMovel, cena: Cena, r: Regua): void {
  const P = c.peca
  const ferro = c.m.ferragens
  const { C, A } = r
  const L = cena.partes
  const dentro = A - LARGURA_DA_VIGA
  const n = Math.max(2, Math.round((2 * C) / (PASSO_DA_CINTA * c.g)))
  // A primeira cinta fica depois das chapas das dobradiças.
  const de = -C + COMECO_DO_TABULEIRO + 24
  const ate = C - 9
  const pranchas = Math.max(2, Math.round((2 * dentro) / PRANCHA))
  const largura = (2 * dentro) / pranchas
  for (let i = 0; i < n; i += 1) {
    const u = de + ((ate - de) * i) / (n - 1)
    L.push(P(r.ret(u - LARGURA_DA_CINTA / 2, -A + 1.2, u + LARGURA_DA_CINTA / 2, A - 1.2, 0.6), ferro, { tabua: 0, eixo: r.deTraves, bisel: 0.9, metal: 0.3, contorno: 0.26, tom: 0.96, semente: 9200 + i, projeta: { dist: 0.6, forca: 0.26 } }))
    const rebite = (v: number): void => {
      L.push(P(r.circ(u, v, RAIO_DO_REBITE), ferro, { bisel: RAIO_DO_REBITE, metal: 0.6, contorno: 0.2, tom: 1.18, semente: 9250 }))
    }
    for (let j = 0; j < pranchas; j += 1) rebite(-dentro + (j + 0.5) * largura)
    for (const lado of [-1, 1]) rebite(lado * (A - LARGURA_DA_VIGA / 2))
  }
  // A chapa da ponta de fora, a que bate na margem.
  L.push(P(r.ret(C - 3.4, -A + 0.8, C - 0.3, A - 0.8, 0.5), ferro, { tabua: 0, eixo: r.deTraves, bisel: 0.8, metal: 0.35, contorno: 0.28, tom: 0.9, semente: 9300 }))
}

/** O eixo de través no lado do castelo, com as pontas de ferro e as três dobradiças cravadas no tabuleiro. */
function eixo(c: ContextoDoMovel, cena: Cena, r: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const ferro = c.m.ferragens
  const { C, A } = r
  const L = cena.partes
  const ue = -C + MEIO_DO_EIXO
  const tora = r.cap(ue, -A + RAIO_DO_EIXO * 0.6, ue, A - RAIO_DO_EIXO * 0.6, RAIO_DO_EIXO)
  cena.sombras.push(contato(tora, 0.34))
  L.push(P(tora, mad, { tabua: 0, eixo: r.deTraves, bisel: RAIO_DO_EIXO * 0.9, tom: 0.74, contorno: 0.28, semente: 9400, projeta: { dist: 1.2, forca: 0.3 } }))
  for (const lado of [-1, 1]) {
    L.push(P(r.circ(ue, lado * (A - 2.6), RAIO_DO_EIXO * 0.62), ferro, { bisel: 2, metal: 0.5, contorno: 0.28, semente: 9410 + lado }))
  }
  for (const v of [-(A - LARGURA_DA_VIGA - 6), 0, A - LARGURA_DA_VIGA - 6]) {
    // A chapa corre do eixo pelo tabuleiro; o nó abraça a tora.
    L.push(P(r.ret(ue - 1, v - 2.6, -C + COMECO_DO_TABULEIRO + 15, v + 2.6, 0.8), ferro, { tabua: 0, eixo: r.aoLongo, bisel: 0.9, metal: 0.32, contorno: 0.26, semente: 9420 + v, projeta: { dist: 0.6, forca: 0.26 } }))
    L.push(P(r.ret(ue - RAIO_DO_EIXO - 0.4, v - 3.2, ue + RAIO_DO_EIXO * 0.7, v + 3.2, 2.2), ferro, { tabua: 0, eixo: r.aoLongo, bisel: 2.2, metal: 0.45, contorno: 0.28, tom: 1.06, semente: 9430 + v }))
    for (const du of [8.5, 13]) L.push(P(r.circ(-C + COMECO_DO_TABULEIRO + du, v, RAIO_DO_REBITE), ferro, { bisel: RAIO_DO_REBITE, metal: 0.6, contorno: 0.2, tom: 1.2, semente: 9440 }))
  }
}

/** As correntes: a chapa e a argola na ponta de fora e os elos subindo até o lado do castelo. */
function correntes(c: ContextoDoMovel, cena: Cena, r: Regua): void {
  const P = c.peca
  const ferro = c.m.ferragens
  const { C, A } = r
  const L = cena.partes
  const uArgola = C - 9.5
  const uFim = -C + 2
  const elos = Math.max(2, Math.floor((uArgola - RAIO_DA_ARGOLA - uFim) / PASSO_DO_ELO))
  for (const lado of [-1, 1]) {
    const v = lado * (A - LARGURA_DA_VIGA / 2 - 0.6)
    L.push(P(r.ret(uArgola - CHAPA_DA_ARGOLA, v - CHAPA_DA_ARGOLA, uArgola + CHAPA_DA_ARGOLA, v + CHAPA_DA_ARGOLA, 0.8), ferro, { tabua: 0, bisel: 0.9, metal: 0.35, contorno: 0.28, semente: 9500 + lado }))
    L.push(P(anel(...r.pt(uArgola, v), RAIO_DA_ARGOLA, RAIO_DA_ARGOLA, RAIO_DA_ARGOLA * 0.56, RAIO_DA_ARGOLA * 0.56), ferro, { bisel: 1, metal: 0.6, contorno: 0.28, tom: 1.12, semente: 9502 + lado, projeta: { dist: 0.6, forca: 0.3 } }))
    for (let i = 0; i < elos; i += 1) {
      const u = uArgola - RAIO_DA_ARGOLA - (i + 0.5) * PASSO_DO_ELO
      const t = (uArgola - u) / (uArgola - uFim)
      const z = c.g * (CORRENTE_NA_PONTA + (CORRENTE_NO_CASTELO - CORRENTE_NA_PONTA) * t)
      // Os elos alternam: um deitado (o anel aberto) e um de pé (só o risco, de lado).
      const deitado = i % 2 === 0
      const forma = deitado ? r.ret(u - ELO.ru, v - ELO.rv, u + ELO.ru, v + ELO.rv, ELO.rv) : r.cap(u - ELO.du * 1.6, v, u + ELO.du * 1.6, v, ELO.dv + 0.15)
      cena.sombras.push({ forma, z, solta: true, suave: 0.8 + z * 0.02, forca: 0.22 })
      const projeta = { dist: z * SOMBRA_POR_ALTURA, forca: 0.28, suave: 0.7 + z * 0.015 }
      if (deitado) {
        L.push(P(menosDoMeio(forma, r, u, v), ferro, { bisel: 0.8, metal: 0.55, contorno: 0.28, tom: 1.08, semente: 9600 + i, projeta }))
      } else {
        L.push(P(forma, ferro, { eixo: r.aoLongo, bisel: 0.7, metal: 0.6, contorno: 0.28, tom: 0.94, semente: 9600 + i, projeta }))
      }
    }
  }
}

/** O elo deitado: o anel de ferro, com o vão do meio aberto (o tabuleiro aparece). */
function menosDoMeio(forma: Forma, r: Regua, u: number, v: number): Forma {
  return menos(forma, r.ret(u - ELO.ru + ELO.ferro, v - ELO.rv + ELO.ferro * 0.8, u + ELO.ru - ELO.ferro, v + ELO.rv - ELO.ferro * 0.8, 0.6))
}

export const montarPonteLevadica: MontarMovel = (c, cena) => {
  const r = reguaDa(c)
  if (!(r.C > COMECO_DO_TABULEIRO) || !(r.A > LARGURA_DA_VIGA)) return
  const { C, A } = r
  const deck = r.ret(-C + COMECO_DO_TABULEIRO - 1, -A + 0.6, C - 0.3, A - 0.6, 1)
  cena.sombras.push({ forma: deck, z: c.g * ALTURA_DO_TABULEIRO, forca: 0.3, solta: true }, contato(deck, 0.16))
  tabuleiro(c, cena, r)
  cintas(c, cena, r)
  eixo(c, cena, r)
  correntes(c, cena, r)
}
