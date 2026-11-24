/**
 * PONTE DE CORRENTE de cima com volume (lote L04 de 24/11/2026, a Fortaleza do
 * ritual; versão da ponte). A ponte suspensa de uma fortaleza sobre o abismo:
 * as TÁBUAS soltas com vão entre elas (o que está embaixo aparece), presas
 * por grampos de ferro em duas CORRENTES DE CARGA que passam por baixo, as
 * duas CORRENTES DE MÃO dos lados, os TIRANTES de corrente que descem delas
 * até as tábuas e, em cada ponta, a TRAVESSA de ferro entre dois POSTES de
 * ferro com argola no alto.
 *
 * O que a separa da ponte de corda: lá é palha clara torcida e poste de
 * madeira; aqui é ferro escuro, elo por elo (o elo deitado é uma argola
 * comprida, o de pé é um traço), com ferrugem aqui e ali. Uma tábua está
 * lascada de um lado, e é por isso que ninguém atravessa correndo.
 *
 * A ponte corre ao longo do lado MAIOR da pegada, como a ponte de sempre: a de
 * partida, 4 x 1, deitada; esticada para ficar mais alta que larga, em pé. As
 * medidas de través (as correntes, a tábua, os elos) ficam em px do protótipo:
 * a ponte esticada fica mais longa ou mais larga, nunca com o elo maior.
 *
 * Está no ar: a sombra das tábuas cai solta (o abismo fica embaixo) e a dos
 * postes e das correntes de mão vai mais longe. Na 3/4 fica como de cima, em
 * pé (`EM_PE`), como a ponte. Materiais: `madeira` (as tábuas) e `metal` (as
 * correntes, os grampos e os postes). A ferrugem é fixa.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, caixa, capsula, elipse, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Alturas em casas (a sombra): o tabuleiro sobre o abismo, as correntes de mão e os postes. */
const ALTURA_DO_TABULEIRO = 0.32
const ALTURA_DAS_CORRENTES = 0.72
const ALTURA_DOS_POSTES = 0.9

/** Um elo: o passo de um ao outro, os meios eixos do elo deitado (ao longo e de través) e a meia grossura do ferro (px). */
interface Elo {
  readonly passo: number
  readonly aoLongo: number
  readonly deTraves: number
  readonly fio: number
}
const ELO_DE_CARGA: Elo = { passo: 6.6, aoLongo: 4.4, deTraves: 2.7, fio: 1 }
const ELO_DE_MAO: Elo = { passo: 5.2, aoLongo: 3.5, deTraves: 2.15, fio: 0.8 }
const ELO_DO_TIRANTE: Elo = { passo: 4.1, aoLongo: 2.75, deTraves: 1.7, fio: 0.62 }

/** O ferro: os tons, o brilho (ferro velho) e a ferrugem, que pega até este tanto do elo. */
const TOM_DA_CARGA = 0.78
const TOM_DA_MAO = 1.04
const TOM_DO_TIRANTE = 0.94
const TOM_DO_GRAMPO = 1.1
const TOM_DO_POSTE = 0.98
const BRILHO_DO_FERRO = 0.32
const FERRUGEM: Rgb = [0x8a, 0x5c, 0x40]
const QUANTO_DE_FERRUGEM = 0.42
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]

/** As tábuas: o passo (a tábua mais o vão), a largura, a folga de cada lado até a corrente de mão e os dois grampos. */
const PASSO_DAS_TABUAS = 11
const LARGURA_DA_TABUA = 7.2
const FOLGA_DO_TABULEIRO = 11
const GRAMPO: readonly [number, number] = [1.5, 2.6]
/** Onde as correntes de carga passam debaixo das tábuas (fração do meio tabuleiro) e a corrente de mão (px da beira). */
const CARGA_EM = 0.62
const MAO_DA_BEIRA = 5
/** Os postes: o raio, a chapa do pé e a argola do alto. */
const RAIO_DO_POSTE = 4.2
const CHAPA_DO_POSTE = 6.4
const ARGOLA_DO_POSTE: readonly [number, number] = [2.9, 1.5]

const DO_METAL = texturaDaClasse('metal')

/** 0..1 fixo por peça (o tom, o torto e o comprimento de cada tábua). */
function acaso(i: number, sal: number): number {
  return hash(i, sal, 4040)
}

/**
 * A régua da ponte, como a da ponte de sempre: `u` ao longo (do começo ao fim), `v` de través, centro na
 * origem. Deitada, u é x; em pé, u é y.
 */
interface Regua {
  readonly meioC: number
  readonly meiaL: number
  readonly ponto: (u: number, v: number) => Ponto
  readonly retangulo: (u0: number, v0: number, u1: number, v1: number, raio: number) => Forma
  readonly poligono: (pontos: readonly Ponto[]) => Forma
  /** O veio de través da ponte (as tábuas e a travessa). */
  readonly deTraves: number
}

function reguaDa(c: ContextoDoMovel): Regua {
  const deitada = c.w >= c.h
  const ponto = (u: number, v: number): Ponto => (deitada ? [u, v] : [-v, u])
  return {
    meioC: deitada ? c.hw : c.hh,
    meiaL: deitada ? c.hh : c.hw,
    ponto,
    retangulo: (u0, v0, u1, v1, raio) => (deitada ? caixa(u0, v0, u1, v1, raio) : caixa(-v1, u0, -v0, u1, raio)),
    poligono: (pontos) => poligono(pontos.map(([u, v]) => ponto(u, v))),
    deTraves: deitada ? QUARTO : 0,
  }
}

/**
 * A CORRENTE de (ax, ay) a (bx, by) numa forma só: os elos se alternam, um deitado (a argola comprida, vista de
 * cima) e um de pé (visto de quina: um traço que entra no furo dos dois vizinhos). A distância olha o elo do
 * ponto e os dois do lado.
 */
function corrente(ax: number, ay: number, bx: number, by: number, e: Elo): Forma {
  const l = Math.hypot(bx - ax, by - ay) || 1
  const [ux, uy] = [(bx - ax) / l, (by - ay) / l]
  // Número ímpar de elos: a corrente começa e acaba num elo deitado.
  const n = Math.max(1, Math.round((l / e.passo - 1) / 2) * 2 + 1)
  const passo = l / n
  const fora = e.deTraves + 0.5
  const b: Caixa = [Math.min(ax, bx) - fora, Math.min(ay, by) - fora, Math.max(ax, bx) + fora, Math.max(ay, by) + fora]
  const [a, c] = [e.aoLongo, e.deTraves]
  const meioDoTraco = passo - a + 2 * e.fio + 0.3
  return {
    b,
    d(x, y) {
      const px = x - ax
      const py = y - ay
      const s = px * ux + py * uy
      const t = -px * uy + py * ux
      const i = Math.floor(s / passo)
      let menor = Infinity
      for (let j = i - 1; j <= i + 1; j += 1) {
        if (j < 0 || j >= n) continue
        const ls = s - (j + 0.5) * passo
        let d: number
        if (j % 2 === 0) {
          // O elo deitado: o anel entre a elipse de fora e a de dentro (a de fora menos a grossura do ferro).
          const k0 = Math.sqrt((ls * ls) / (a * a) + (t * t) / (c * c))
          const k1 = Math.sqrt((ls * ls) / (a * a * a * a) + (t * t) / (c * c * c * c))
          const daElipse = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -c
          d = Math.max(daElipse, -(daElipse + 2 * e.fio))
        } else {
          const alem = Math.abs(ls) - meioDoTraco
          d = Math.hypot(alem > 0 ? alem : 0, t) - e.fio * 0.92
        }
        if (d < menor) menor = d
      }
      return menor
    },
  }
}

/** O ferro da corrente: o grão do metal e a ferrugem em manchas (mais onde o ruído manda), puxando a cor para o castanho. */
const texDaCorrente: Textura = (u, v, x, y, p, s, escala) => {
  if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
  const n = ruido(x * 0.11 + p.su, y * 0.11 + p.sv) + 0.5 * ruido(x * 0.45 + 9, y * 0.45 + 3)
  const t = Math.min(1, Math.max(0, (n - 0.02) * 2.4)) * QUANTO_DE_FERRUGEM
  if (t <= 0) return
  s[0] += (FERRUGEM[0] - s[0]) * t
  s[1] += (FERRUGEM[1] - s[1]) * t
  s[2] += (FERRUGEM[2] - s[2]) * t
}

/** As opções de uma peça de ferro. */
function doFerro(tom: number, bisel: number, semente: number, comFerrugem = true) {
  return { tabua: 0, bisel, tom, metal: BRILHO_DO_FERRO, contorno: 0.3, textura: comFerrugem ? texDaCorrente : undefined, semente }
}

function montar(c: ContextoDoMovel, cena: Cena, r: Regua): void {
  const P = c.peca
  const madeira: MaterialDaPeca = c.m.madeira
  const ferro: MaterialDaPeca = c.m.metal
  const { meioC: C, meiaL: A } = r
  const L: Peca[] = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const linhaDaMao = Math.max(2.5, A - MAO_DA_BEIRA)
  const deck = Math.max(5, A - FOLGA_DO_TABULEIRO)
  const pontaDaMao = Math.max(0, C - RAIO_DO_POSTE - 1)
  const doLado = (lado: number, v: number): number => lado * v

  // ---------- as duas correntes de carga, por baixo das tábuas: aparecem nos vãos ----------
  for (const lado of [-1, 1]) {
    const [ax, ay] = r.ponto(-pontaDaMao, doLado(lado, deck * CARGA_EM))
    const [bx, by] = r.ponto(pontaDaMao, doLado(lado, deck * CARGA_EM))
    L.push(P(corrente(ax, ay, bx, by, ELO_DE_CARGA), ferro, doFerro(TOM_DA_CARGA, ELO_DE_CARGA.fio * 0.9, 4000 + lado)))
  }

  // ---------- as tábuas soltas: cada uma torta, de comprimento e tom próprios, com um grampo em cada corrente ----------
  const n = Math.max(2, Math.round((2 * C - 14) / PASSO_DAS_TABUAS))
  const largura = (2 * C - 14) / n
  const lascada = n >= 6 ? Math.floor(n * 0.62) : -1
  for (let i = 0; i < n; i += 1) {
    const u0 = -C + 7 + i * largura + (largura - LARGURA_DA_TABUA) / 2
    const u1 = u0 + LARGURA_DA_TABUA
    const deslize = (acaso(i, 7) - 0.5) * 2
    const giro = (acaso(i, 9) - 0.5) * 0.08
    const [um, cos, sen] = [(u0 + u1) / 2, Math.cos(giro), Math.sin(giro)]
    const v0 = -deck - 1 + deslize
    const v1 = deck + 1 + deslize * 0.5 - acaso(i, 8) * 2
    const canto = (u: number, v: number): Ponto => [um + (u - um) * cos - v * sen, (u - um) * sen + v * cos]
    // A lascada perdeu a ponta de um lado: acaba num dente, antes da corrente de carga.
    const pontos: Ponto[] = i === lascada
      ? [canto(u0, v0), canto(u1, v0), canto(u1, v1 * 0.34), canto(u0 + LARGURA_DA_TABUA * 0.62, v1 * 0.5), canto(u0 + LARGURA_DA_TABUA * 0.3, v1 * 0.3), canto(u0, v1 * 0.44)]
      : [canto(u0, v0), canto(u1, v0), canto(u1, v1), canto(u0, v1)]
    const tabua = r.poligono(pontos)
    cena.sombras.push({ forma: tabua, z: c.g * ALTURA_DO_TABULEIRO, forca: 0.28, solta: true })
    L.push(P(tabua, madeira, { tabua: 0, eixo: r.deTraves, bisel: 1, tom: 0.82 + 0.24 * acaso(i, 10), contorno: 0.26, semente: 4010 + i, projeta: { dist: 1.2, forca: 0.22 } }))
    for (const lado of [-1, 1]) {
      if (i === lascada && lado > 0) continue
      const [gu, gv] = canto(um, doLado(lado, deck * CARGA_EM))
      const grampo = r.retangulo(gu - GRAMPO[1], gv - GRAMPO[0], gu + GRAMPO[1], gv + GRAMPO[0], 0.6)
      L.push(P(grampo, ferro, { ...doFerro(TOM_DO_GRAMPO, 0.7, 4100 + i * 2 + (lado + 1) / 2, false), projeta: { dist: 0.7, forca: 0.26 } }))
    }
  }

  // ---------- os tirantes: de duas em duas tábuas, a corrente fina que desce da corrente de mão até a beira da tábua ----------
  for (const lado of [-1, 1]) {
    for (let i = 1; i < n - 1; i += 2) {
      if (i === lascada && lado > 0) continue
      const u = -C + 7 + (i + 0.5) * largura
      const [ax, ay] = r.ponto(u, doLado(lado, linhaDaMao - 0.5))
      const [bx, by] = r.ponto(u - 1, doLado(lado, deck - 1))
      L.push(P(corrente(ax, ay, bx, by, ELO_DO_TIRANTE), ferro, doFerro(TOM_DO_TIRANTE, ELO_DO_TIRANTE.fio * 0.9, 4200 + i + lado)))
    }
  }

  // ---------- a travessa de ferro de cada ponta, entre os dois postes: é nela que as correntes de carga prendem ----------
  for (const ponta of [-1, 1]) {
    const travessa = r.retangulo(ponta * pontaDaMao - 1.7, -linhaDaMao, ponta * pontaDaMao + 1.7, linhaDaMao, 1.2)
    cena.sombras.push({ forma: travessa, z: c.g * ALTURA_DO_TABULEIRO, forca: 0.26, solta: true })
    L.push(P(travessa, ferro, { ...doFerro(0.88, 1.3, 4300 + ponta), eixo: r.deTraves, projeta: { dist: 1.2, forca: 0.24 } }))
  }

  // ---------- as correntes de mão dos dois lados, de poste a poste, no ar ----------
  for (const lado of [-1, 1]) {
    const v = doLado(lado, linhaDaMao)
    const [ax, ay] = r.ponto(-pontaDaMao, v)
    const [bx, by] = r.ponto(pontaDaMao, v)
    cena.sombras.push({ forma: capsula(ax, ay, bx, by, ELO_DE_MAO.deTraves * 0.7), z: c.g * ALTURA_DAS_CORRENTES, forca: 0.2, solta: true })
    L.push(P(corrente(ax, ay, bx, by, ELO_DE_MAO), ferro, { ...doFerro(TOM_DA_MAO, ELO_DE_MAO.fio * 0.9, 4400 + lado), projeta: { dist: 1.8, forca: 0.24 } }))
  }

  // ---------- os quatro postes de ferro nas pontas: a chapa do pé, o poste redondo e a argola do alto ----------
  let j = 0
  for (const ponta of [-1, 1]) {
    for (const lado of [-1, 1]) {
      const [x, y] = r.ponto(ponta * pontaDaMao, doLado(lado, linhaDaMao))
      const chapa = caixa(x - CHAPA_DO_POSTE, y - CHAPA_DO_POSTE, x + CHAPA_DO_POSTE, y + CHAPA_DO_POSTE, 1.4)
      const poste = elipse(x, y, RAIO_DO_POSTE, RAIO_DO_POSTE)
      cena.sombras.push(contato(chapa, 0.3), { forma: poste, z: c.g * ALTURA_DOS_POSTES })
      L.push(P(chapa, ferro, doFerro(0.8, 0.9, 4500 + j)))
      L.push(P(poste, ferro, { ...doFerro(TOM_DO_POSTE, RAIO_DO_POSTE * 0.55, 4510 + j), projeta: { dist: 2.6, forca: 0.32 } }))
      L.push(P(anel(x, y, ARGOLA_DO_POSTE[0], ARGOLA_DO_POSTE[0], ARGOLA_DO_POSTE[1], ARGOLA_DO_POSTE[1]), ferro, { ...doFerro(1.22, 0.7, 4520 + j, false), metal: 0.45 }))
      j += 1
    }
  }
}

export const montarPonteDeCorrente: MontarMovel = (c, cena) => {
  const r = reguaDa(c)
  if (!(r.meioC > 0) || !(r.meiaL > 0)) return
  montar(c, cena, r)
}
