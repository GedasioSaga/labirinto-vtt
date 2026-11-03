/**
 * PONTE de cima com volume (03/11/2026): o caminho por cima do rio, do
 * barranco ou do vão. Três formas (`lib/mobilia/ponte.ts`, a `variante`):
 *
 * - MADEIRA: as tábuas de través, cada uma no seu tom e um pouco torta, as
 *   duas vigas escuras aparecendo nas frestas, e o corrimão dos dois lados,
 *   com os postes quadrados por cima dele (um por casa e um em cada ponta);
 * - PEDRA: o arco de pedra, o calçamento de paralelepípedos em fiadas
 *   desencontradas e a mureta de blocos dos dois lados, com o pilar maior em
 *   cada ponta. O meio do arco é mais alto: pega mais luz que as pontas;
 * - CORDA: a ponte pênsil. As tábuas soltas com vão entre elas (o que está
 *   embaixo aparece), as duas cordas de pé que seguram as tábuas, as cordas
 *   de mão dos dois lados, os tirantes que descem delas e os quatro postes
 *   redondos nas pontas.
 *
 * A ponte corre ao longo do lado MAIOR da pegada (como o arco do portão): a
 * de partida, 4 x 1, deitada; esticada para ficar mais alta que larga, em pé.
 * As medidas de través (o corrimão, a mureta, as cordas, a tábua) ficam em px
 * do protótipo, na régua da casa (`g` = 56): a ponte esticada fica mais longa
 * ou mais larga, nunca com o corrimão mais grosso.
 *
 * Está no ar: a sombra do tabuleiro cai solta (o rio fica embaixo) e a dos
 * postes e do corrimão vai mais longe. Materiais: `madeira` (Madeira e Corda) e
 * `pedra` (Pedra); a corda é fixa, a mesma palha clara da cerca.
 */
import { lerVarianteDaPonte } from '../../../lib/mobilia/ponte'
import { caixa, capsula, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** A corda das três pontes: a palha clara da cerca de corda. */
const CORDA: MaterialDaPeca = materialDaPeca('corda')

/** Alturas em casas (a sombra): o tabuleiro sobre a água, o corrimão e os postes da ponte. */
const ALTURA_DO_TABULEIRO = 0.32
const ALTURA_DO_ARCO = 0.42
const ALTURA_DO_CORRIMAO = 0.72
const ALTURA_DOS_POSTES = 0.86

/** 0..1 fixo por peça (o tom, o torto e o comprimento de cada tábua e de cada pedra). */
function acaso(i: number, sal: number): number {
  const s = Math.sin(i * 12.9898 + sal * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/**
 * A régua da ponte: `u` ao longo (do começo ao fim), `v` de través (de um lado
 * ao outro), centro na origem. Deitada, u é x; em pé, u é y.
 */
interface Regua {
  /** Meio comprimento e meia largura, em px do protótipo. */
  readonly meioC: number
  readonly meiaL: number
  readonly ponto: (u: number, v: number) => Ponto
  readonly retangulo: (u0: number, v0: number, u1: number, v1: number, raio: number) => Forma
  /** A peça de quatro cantos girada `giro` radianos em volta do meio dela (a tábua um pouco torta). */
  readonly torta: (u0: number, v0: number, u1: number, v1: number, giro: number) => Forma
  readonly corda: (u0: number, v0: number, u1: number, v1: number, raio: number) => Forma
  /** O veio ao longo da ponte e de través. */
  readonly aoLongo: number
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
    torta: (u0, v0, u1, v1, giro) => {
      const um = (u0 + u1) / 2
      const vm = (v0 + v1) / 2
      const cos = Math.cos(giro)
      const sen = Math.sin(giro)
      const canto = (u: number, v: number): Ponto => ponto(um + (u - um) * cos - (v - vm) * sen, vm + (u - um) * sen + (v - vm) * cos)
      return poligono([canto(u0, v0), canto(u1, v0), canto(u1, v1), canto(u0, v1)])
    },
    corda: (u0, v0, u1, v1, raio) => {
      const [ax, ay] = ponto(u0, v0)
      const [bx, by] = ponto(u1, v1)
      return capsula(ax, ay, bx, by, raio)
    },
    aoLongo: deitada ? 0 : QUARTO,
    deTraves: deitada ? QUARTO : 0,
  }
}

/** Posições ao longo de `n` + 1 marcos igualmente espaçados de `de` a `ate`. */
function marcos(de: number, ate: number, n: number): number[] {
  return Array.from({ length: n + 1 }, (_, i) => de + ((ate - de) * i) / n)
}

function ponteDeMadeira(c: ContextoDoMovel, cena: Parameters<MontarMovel>[1], r: Regua): void {
  const P = c.peca
  const madeira = c.m.madeira
  const { meioC: C, meiaL: A } = r
  const L = cena.partes
  // O corrimão: a linha do meio dele a 5,5 px da beira, 5 de espessura; os postes de 7,5 por cima dele.
  const linhaDoCorrimao = Math.max(2.5, A - 5.5)
  const tabuleiro = r.retangulo(-C, -A + 1.5, C, A - 1.5, 1)
  cena.sombras.push({ forma: tabuleiro, z: c.g * ALTURA_DO_TABULEIRO, forca: 0.3, solta: true }, contato(tabuleiro, 0.16))

  // As duas vigas por baixo das tábuas, no escuro: aparecem nas frestas.
  for (const lado of [-1, 1]) L.push(P(r.retangulo(-C, lado * A * 0.48 - 3, C, lado * A * 0.48 + 3, 1), madeira, { tabua: 0, eixo: r.aoLongo, bisel: 0.8, tom: 0.52, contorno: 0.2, semente: 1000 + lado }))

  // As tábuas de través: ~9,8 px cada (6 por casa), com 1,2 de fresta; cada uma no seu tom e um pouco torta.
  const passo = 9.8
  const n = Math.max(2, Math.round((2 * C) / passo))
  const largura = (2 * C) / n
  for (let i = 0; i < n; i += 1) {
    const u0 = -C + i * largura + 0.6
    const u1 = u0 + largura - 1.2
    const sobra = (acaso(i, 1) - 0.5) * 1.6
    const forma = r.torta(u0, -A + 1.6 + sobra, u1, A - 1.6 + sobra * 0.6, (acaso(i, 2) - 0.5) * 0.035)
    L.push(P(forma, madeira, { tabua: 0, eixo: r.deTraves, bisel: 1, tom: 0.9 + 0.16 * acaso(i, 3), contorno: 0.24, semente: 1010 + i, projeta: { dist: 0.9, forca: 0.18 } }))
  }

  // O corrimão dos dois lados, no ar: a sombra dele vai mais longe que a do tabuleiro.
  const postes = Math.max(1, Math.round((2 * C - 9) / c.g))
  for (const lado of [-1, 1]) {
    const v = lado * linhaDoCorrimao
    const trave = r.retangulo(-C + 1, v - 2.5, C - 1, v + 2.5, 1.2)
    cena.sombras.push({ forma: trave, z: c.g * ALTURA_DO_CORRIMAO, forca: 0.22, solta: true })
    L.push(P(trave, madeira, { tabua: 0, eixo: r.aoLongo, bisel: 1.2, tom: 0.98, contorno: 0.26, semente: 1100 + lado, projeta: { dist: 2.2, forca: 0.26 } }))
    // Os postes por cima do corrimão: um em cada ponta e um por casa no meio.
    marcos(-C + 4.5, C - 4.5, postes).forEach((u, j) => {
      const poste = r.retangulo(u - 3.75, v - 3.75, u + 3.75, v + 3.75, 1)
      cena.sombras.push({ forma: poste, z: c.g * ALTURA_DOS_POSTES })
      L.push(P(poste, madeira, { tabua: 0, eixo: r.aoLongo, bisel: 1.4, tom: 1.06, contorno: 0.28, semente: 1120 + j * 2 + (lado + 1) / 2, projeta: { dist: 2.4, forca: 0.3 } }))
    })
  }
}

function ponteDePedra(c: ContextoDoMovel, cena: Parameters<MontarMovel>[1], r: Regua): void {
  const P = c.peca
  const pedra = c.m.pedra
  const { meioC: C, meiaL: A } = r
  const L = cena.partes
  // O meio do arco é o mais alto: pega mais luz que as pontas (pé no barranco).
  const arco = (u: number): number => 0.86 + 0.2 * (1 - (u / C) ** 2)
  const mureta = Math.min(8, A * 0.32)
  const tudo = r.retangulo(-C, -A, C, A, 1.5)
  cena.sombras.push({ forma: tudo, z: c.g * ALTURA_DO_ARCO, forca: 0.32, solta: true }, contato(tudo, 0.2))

  // O leito do calçamento, escuro: é o que aparece nas juntas.
  const dentro = A - mureta
  L.push(P(r.retangulo(-C + 0.5, -dentro - 0.5, C - 0.5, dentro + 0.5, 1), pedra, { tabua: 0, bisel: 0.6, tom: 0.58, contorno: 0.2, semente: 1200 }))
  // Os paralelepípedos em fiadas DE TRAVÉS (como na rua: a fiada corta o caminho), de ~8,5 px ao longo,
  // desencontradas, cada pedra de 9 a 13 px e no seu tom. Em fiada ao longo, a ponte lia como muro deitado.
  const fiadas = Math.max(2, Math.round((2 * C - 1) / 8.5))
  const passo = (2 * C - 1) / fiadas
  let k = 0
  for (let f = 0; f < fiadas; f += 1) {
    const u0 = -C + 0.5 + f * passo
    const meio = u0 + passo / 2
    let v = -dentro + (f % 2 === 0 ? 0 : -5.5)
    while (v < dentro) {
      const comprido = 9 + 4 * acaso(k, 4)
      const v0 = Math.max(-dentro, v)
      const v1 = Math.min(dentro, v + comprido)
      if (v1 - v0 > 3) {
        L.push(P(r.retangulo(u0 + 0.6, v0 + 0.6, u0 + passo - 0.6, v1 - 0.6, 2), pedra, { tabua: 0, bisel: 1.5, tom: (0.86 + 0.16 * acaso(k, 5)) * arco(meio), contorno: 0.22, semente: 1210 + (k % 400) }))
        k += 1
      }
      v += comprido
    }
  }

  // A mureta dos dois lados, em blocos de ~0,42 casa, e o pilar mais largo em cada ponta.
  const bloco = c.g * 0.42
  const blocos = Math.max(2, Math.round((2 * C - 24) / bloco))
  for (const lado of [-1, 1]) {
    const v0 = lado < 0 ? -A + 0.5 : A - mureta
    const v1 = lado < 0 ? -A + mureta : A - 0.5
    const muro = r.retangulo(-C + 12, v0, C - 12, v1, 1)
    cena.sombras.push({ forma: muro, z: c.g * (ALTURA_DO_ARCO + 0.24) })
    marcos(-C + 12, C - 12, blocos).slice(0, -1).forEach((u, j) => {
      const u1 = u + (2 * C - 24) / blocos
      L.push(P(r.retangulo(u + 0.6, v0, u1 - 0.6, v1, 1.4), pedra, { tabua: 0, bisel: 2, tom: (1.1 + 0.1 * acaso(j * 2 + lado, 6)) * arco((u + u1) / 2), contorno: 0.28, semente: 1700 + j * 2 + (lado + 1) / 2, projeta: { dist: 2.6, forca: 0.34 } }))
    })
    for (const ponta of [-1, 1]) {
      const u0 = ponta < 0 ? -C + 0.5 : C - 12
      const u1 = ponta < 0 ? -C + 12 : C - 0.5
      const pilar = r.retangulo(u0, lado < 0 ? -A + 0.5 : A - mureta - 2, u1, lado < 0 ? -A + mureta + 2 : A - 0.5, 1.6)
      cena.sombras.push({ forma: pilar, z: c.g * (ALTURA_DO_ARCO + 0.32) })
      L.push(P(pilar, pedra, { tabua: 0, bisel: 2.2, tom: 1.08 * arco(ponta * C), contorno: 0.28, semente: 1800 + ponta + lado * 3, projeta: { dist: 2.6, forca: 0.3 } }))
    }
  }
}

function ponteDeCorda(c: ContextoDoMovel, cena: Parameters<MontarMovel>[1], r: Regua): void {
  const P = c.peca
  const madeira = c.m.madeira
  const { meioC: C, meiaL: A } = r
  const L = cena.partes
  // As cordas de mão a 5 px da beira, entre os postes; as tábuas no meio, com folga de 11 px de cada lado.
  const linhaDaCorda = Math.max(2.5, A - 5)
  const deck = Math.max(5, A - 11)
  const pontaDaCorda = Math.max(0, C - 5)

  // As duas cordas de pé, por baixo das tábuas: aparecem nos vãos.
  for (const lado of [-1, 1]) {
    const v = lado * (deck - 2.5)
    L.push(P(r.corda(-C + 2, v, C - 2, v, 1.3), CORDA, { eixo: r.aoLongo, bisel: 1.3, tom: 0.84, contorno: 0.18, semente: 1300 + lado }))
  }

  // As tábuas soltas: 7 px de largura com 4 de vão, cada uma torta, de comprimento e tom próprios.
  const passo = 11
  const n = Math.max(2, Math.round((2 * C - 4) / passo))
  const largura = (2 * C - 4) / n
  for (let i = 0; i < n; i += 1) {
    const u0 = -C + 2 + i * largura + (largura - 7) / 2
    const deslize = (acaso(i, 7) - 0.5) * 2
    const forma = r.torta(u0, -deck - 1 + deslize, u0 + 7, deck + 1 + deslize * 0.5 - acaso(i, 8) * 2, (acaso(i, 9) - 0.5) * 0.09)
    cena.sombras.push({ forma, z: c.g * ALTURA_DO_TABULEIRO, forca: 0.28, solta: true })
    L.push(P(forma, madeira, { tabua: 0, eixo: r.deTraves, bisel: 1, tom: 0.84 + 0.22 * acaso(i, 10), contorno: 0.26, semente: 1310 + i, projeta: { dist: 1.2, forca: 0.22 } }))
  }

  // Os tirantes: de duas em duas tábuas, a cordinha que desce da corda de mão até a beira da tábua.
  for (const lado of [-1, 1]) {
    for (let i = 1; i < n - 1; i += 2) {
      const u = -C + 2 + (i + 0.5) * largura
      L.push(P(r.corda(u, lado * (linhaDaCorda - 1), u - 1.5, lado * (deck - 0.5), 0.65), CORDA, { eixo: r.deTraves, bisel: 0.6, tom: 0.92, contorno: 0.16, semente: 1500 + i + lado }))
    }
  }

  // As cordas de mão dos dois lados, de poste a poste, no ar.
  for (const lado of [-1, 1]) {
    const v = lado * linhaDaCorda
    const corda = r.corda(-pontaDaCorda, v, pontaDaCorda, v, 1.7)
    cena.sombras.push({ forma: corda, z: c.g * ALTURA_DO_CORRIMAO, forca: 0.2, solta: true })
    L.push(P(corda, CORDA, { eixo: r.aoLongo, bisel: 1.7, tom: 1, contorno: 0.2, semente: 1600 + lado, projeta: { dist: 1.8, forca: 0.22 } }))
  }

  // Os quatro postes redondos nas pontas, com a corda amarrada (a volta clara em cima).
  let j = 0
  for (const ponta of [-1, 1]) {
    for (const lado of [-1, 1]) {
      const [x, y] = r.ponto(ponta * pontaDaCorda, lado * linhaDaCorda)
      const poste = elipse(x, y, 4.4, 4.4)
      cena.sombras.push({ forma: poste, z: c.g * ALTURA_DOS_POSTES }, contato(poste, 0.3))
      L.push(P(poste, madeira, { tabua: 0, bisel: 1.8, tom: 0.98, contorno: 0.3, semente: 1650 + j, projeta: { dist: 2.6, forca: 0.32 } }))
      L.push(P(elipse(x, y, 2, 2), madeira, { tabua: 0, bisel: 0.8, tom: 1.16, contorno: 0.2, semente: 1660 + j }))
      j += 1
    }
  }
}

export const montarPonte: MontarMovel = (c, cena) => {
  const r = reguaDa(c)
  if (!(r.meioC > 0) || !(r.meiaL > 0)) return
  const forma = lerVarianteDaPonte(c.variante)
  if (forma === 'pedra') ponteDePedra(c, cena, r)
  else if (forma === 'corda') ponteDeCorda(c, cena, r)
  else ponteDeMadeira(c, cena, r)
}
