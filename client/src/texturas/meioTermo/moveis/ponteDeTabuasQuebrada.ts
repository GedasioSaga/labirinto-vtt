/**
 * PONTE DE TÁBUAS QUEBRADA (lote L07 "Selva: ruína e água", 24/11/2026; versão da `ponte` de madeira, só a ideia).
 * As tábuas de través, de madeira gasta e quente, de veio à mostra e pontas tortas, pregadas nas duas VIGAS (que só
 * aparecem nas frestas e no vão, no escuro da própria madeira), com as cordas de mão presas nos quatro postes das
 * pontas, e o estrago da mata: um VÃO de duas tábuas que caíram (as vigas e os pregos à mostra, e o chão lá embaixo
 * na sombra do tabuleiro), uma tábua partida ao meio com a ponta lascada, uma solta e torta, outra rachada e mais um
 * buraco de uma tábua só. Do lado da frente a CORDA DE MÃO arrebentou em cima do vão: as duas pontas ficaram
 * penduradas para dentro dele, desfiadas na ponta. A outra corda segura.
 *
 * Corre ao longo do lado MAIOR da pegada, como a ponte (4 x 1 de partida). Está no ar: a sombra do tabuleiro escurece
 * o chão por baixo dele (também pelo vão) e a das cordas e dos postes vai mais longe. Não barra (o mestre decide se o
 * vão se pula). Perfil da 3/4: o da ponte (`EM_PE`). Material: `madeira`; a corda é fixa, a palha clara das pontes.
 */
import { hash, type Rgb } from '../../ruido'
import { capsula, elipse, menos, poligono, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Peca, type Textura } from './motor'
import { materialDaPeca, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { lascar, misturarCor } from './muroEmRuina'

const CORDA = materialDaPeca('corda')

/** Alturas em casas (a sombra): as tábuas e as vigas, a corda de mão e os postes. */
const ALTURA_DO_TABULEIRO = 0.32
const ALTURA_DA_CORDA = 0.72
const ALTURA_DOS_POSTES = 0.86
/** A sombra do tabuleiro no chão: escurece também o que se vê pelo vão (com o chão limpo, o vão não lia buraco). */
const SOMBRA_DO_TABULEIRO = 0.4
/** O passo das tábuas e a largura de uma (px); a beira do tabuado e a linha das cordas (px da beira da pegada). */
const PASSO = 10.5
const LARGURA = 8.2
const BEIRA_DO_TABUADO = 9
const LINHA_DA_CORDA = 4.5
/** As vigas: onde ficam (fração da meia largura), a meia largura delas (px) e o tom (o escuro da madeira, nunca preto). */
const VIGA = { onde: 0.44, meia: 3, tom: 0.55 } as const
/**
 * A madeira gasta: o quanto a cor das tábuas vai para o castanho quente desbotado (a 'velha' do catálogo é cinza fria
 * e, a 2,5x, a ponte lia como trilho de trem) e o tom das tábuas.
 */
const GASTO_QUENTE: Rgb = [0xa5, 0x8b, 0x68]
const PUXA_PARA_O_GASTO = 0.24
const TOM_DA_TABUA = 0.9
/** O quanto a ponta de cada tábua entorta (px, para cada lado). */
const PONTA_TORTA = 1.3
/** O poste (raio do topo, px), a volta de corda em volta dele (px a mais) e o tom dela (a torção, mais escura). */
const POSTE = 6
const VOLTA = 1.8
const TOM_DA_VOLTA = 0.64
/** O raio da corda de mão e o do tirante (px). */
const RAIO_DA_CORDA = 1.6
const RAIO_DO_TIRANTE = 0.65
/** As pontas da corda arrebentada: o comprimento (casas), a sobra antes da beira do vão (px) e os fios desfiados. */
const PONTA_SOLTA = 0.58
/** O quanto a ponta escurece até o fim (tom), descendo para dentro do vão. */
const FUNDO_DA_PONTA = 0.2
const FIOS = { quantos: 3, comprimento: 3.6, abertura: 0.42, raio: 0.45 } as const
/** O prego: o raio da cabeça (px). */
const RAIO_DO_PREGO = 0.8

/** A régua da ponte: `u` ao longo, `v` de través, centro na origem (deitada, u é x; em pé, u é y). */
interface Regua {
  readonly C: number
  readonly A: number
  readonly ponto: (u: number, v: number) => Ponto
  readonly aoLongo: number
  readonly deTraves: number
}

function reguaDa(c: ContextoDoMovel): Regua {
  const deitada = c.w >= c.h
  return {
    C: deitada ? c.hw : c.hh,
    A: deitada ? c.hh : c.hw,
    ponto: (u, v) => (deitada ? [u, v] : [-v, u]),
    aoLongo: deitada ? 0 : QUARTO,
    deTraves: deitada ? QUARTO : 0,
  }
}

export const montarPonteDeTabuasQuebrada: MontarMovel = (c, cena) => {
  const r = reguaDa(c)
  if (!(r.C > 0) || !(r.A > 0)) return
  const { g, peca: P } = c
  const madeira = c.m.madeira
  const veio = texturaDaClasse(madeira.classe)
  const L = cena.partes
  const { C, A } = r
  const deck = A - BEIRA_DO_TABUADO
  const linha = A - LINHA_DA_CORDA
  const vigas = [-A * VIGA.onde, A * VIGA.onde]
  const quadra = (pontos: readonly (readonly [number, number])[]): Ponto[] => pontos.map(([u, v]) => r.ponto(u, v))
  const corda = (u0: number, v0: number, u1: number, v1: number, raio: number) => {
    const [ax, ay] = r.ponto(u0, v0)
    const [bx, by] = r.ponto(u1, v1)
    return capsula(ax, ay, bx, by, raio)
  }
  /** A madeira gasta: o veio do material, mais um veio largo ao comprido, e a cor puxada para o castanho desbotado. */
  const gasta = (u: number, v: number, x: number, y: number, p: Peca, s: Float32Array, escala: number, sal: number): void => {
    if (veio !== null) veio(u, v, x, y, p, s, escala)
    misturarCor(s, GASTO_QUENTE, PUXA_PARA_O_GASTO)
    s[3] += ruido(u * 0.045 + sal * 13.1, v * 0.85 + sal) * 0.12
  }

  // As TÁBUAS: quais faltam, qual partiu, qual soltou e qual rachou (sempre longe das pontas).
  const n = Math.max(6, Math.round((2 * C - 4) / PASSO))
  const passo = (2 * C - 4) / n
  const vao = Math.floor(n * 0.47)
  const faltam = new Set([vao, vao + 1, Math.floor(n * 0.76)])
  const partida = vao - 1
  const solta = vao + 2
  const rachada = Math.min(n - 2, Math.floor(n * 0.76) + 2)
  const meioDa = (i: number): number => -C + 2 + (i + 0.5) * passo
  const uDoVao = [meioDa(vao) - passo / 2, meioDa(vao + 1) + passo / 2] as const

  // A sombra do tabuleiro inteiro no chão, também pelo vão: o vão lê buraco, e não chão limpo.
  cena.sombras.push({ forma: poligono(quadra([[-C + 2, -deck], [C - 2, -deck], [C - 2, deck], [-C + 2, deck]])), z: g * ALTURA_DO_TABULEIRO, forca: SOMBRA_DO_TABULEIRO, solta: true })

  // As VIGAS, no escuro da própria madeira, rentes à primeira e à última tábua: aparecem nas frestas e no vão, com os
  // pregos que ficaram onde a tábua caiu.
  const [uIni, uFim] = [meioDa(0) - LARGURA / 2, meioDa(n - 1) + LARGURA / 2]
  vigas.forEach((v, k) => {
    const forma = corda(uIni + VIGA.meia, v, uFim - VIGA.meia, v, VIGA.meia)
    const textura: Textura = (u, vv, x, y, p, s, escala) => gasta(u, vv, x, y, p, s, escala, 30 + k)
    L.push(P(forma, madeira, { tabua: 0, eixo: r.aoLongo, bisel: 0.6, tom: VIGA.tom, contorno: 0.14, textura, semente: 6300 + k }))
    for (const i of faltam) {
      const [x, y] = r.ponto(meioDa(i), v)
      L.push(P(elipse(x, y, RAIO_DO_PREGO, RAIO_DO_PREGO), PREGO, { tabua: 0, bisel: 0.6, contorno: 0.2, metal: 0.5, semente: 6305 + i, projeta: { dist: 0.6, forca: 0.3 } }))
    }
  })

  // As pontas da CORDA ARREBENTADA, penduradas para dentro do vão, cada uma com a ponta desfiada em três fios abertos.
  // Saem da beira do corte, seguem um nada ao longo da corda e vão dobrando para dentro do vão (curva, e não pau reto),
  // por cima das vigas (descem da corda de mão: a viga fica embaixo, debaixo do tabuado). A torção corre ao longo de
  // cada pedaço e, quanto mais longe do corte, mais funda no vão: a corda escurece e afina.
  const comprida = g * PONTA_SOLTA
  const pontasSoltas: readonly (readonly (readonly [number, number])[])[] = [
    [[uDoVao[0] + 1.6, linha], [uDoVao[0] + 4.2, linha - comprida * 0.11], [uDoVao[0] + 6.2, linha - comprida * 0.32], [uDoVao[0] + 7.6, linha - comprida * 0.62], [uDoVao[0] + 8.4, linha - comprida * 0.96]],
    [[uDoVao[1] - 1.6, linha], [uDoVao[1] - 3.8, linha - comprida * 0.09], [uDoVao[1] - 5.2, linha - comprida * 0.28], [uDoVao[1] - 5.9, linha - comprida * 0.53], [uDoVao[1] - 6.1, linha - comprida * 0.75]],
  ]
  const rumoNoObjeto = (a: readonly [number, number], b: readonly [number, number]): number => {
    const [ax, ay] = r.ponto(a[0], a[1])
    const [bx, by] = r.ponto(b[0], b[1])
    return Math.atan2(by - ay, bx - ax)
  }
  pontasSoltas.forEach((caminho, k) => {
    const pedacos = caminho.length - 1
    for (let j = 1; j < caminho.length; j += 1) {
      const [a, b] = [caminho[j - 1], caminho[j]]
      const fundo = (j - 1) / pedacos
      L.push(P(corda(a[0], a[1], b[0], b[1], RAIO_DA_CORDA * (0.9 - 0.14 * fundo)), CORDA, { eixo: rumoNoObjeto(a, b), bisel: RAIO_DA_CORDA, tom: 0.94 - FUNDO_DA_PONTA * fundo, contorno: 0.24, semente: 6440 + k * 5 + j, projeta: { dist: 1.4 + 1.4 * fundo, forca: 0.24 } }))
    }
    const [a, b] = [caminho[caminho.length - 2], caminho[caminho.length - 1]]
    const rumo = Math.atan2(b[1] - a[1], b[0] - a[0])
    for (let fio = 0; fio < FIOS.quantos; fio += 1) {
      const giro = rumo + (fio - (FIOS.quantos - 1) / 2) * FIOS.abertura
      const longe = FIOS.comprimento * (0.8 + 0.4 * hash(k, fio, 6450))
      const fim: readonly [number, number] = [b[0] + Math.cos(giro) * longe, b[1] + Math.sin(giro) * longe]
      L.push(P(corda(b[0], b[1], fim[0], fim[1], FIOS.raio), CORDA, { eixo: rumoNoObjeto(b, fim), bisel: 0.4, tom: 0.94 - FUNDO_DA_PONTA, contorno: 0.2, semente: 6452 + k * 3 + fio }))
    }
  })

  for (let i = 0; i < n; i += 1) {
    if (faltam.has(i)) continue
    const um = meioDa(i)
    const u0 = um - LARGURA / 2
    const u1 = um + LARGURA / 2
    // A ponta de cada tábua torta: os quatro cantos andam cada um para um lado.
    const torto = (k: number): number => (hash(i, 10 + k, 6310) - 0.5) * 2 * PONTA_TORTA
    let cantos: (readonly [number, number])[] = [[u0, -deck + torto(0)], [u1, -deck + torto(1)], [u1, deck + torto(2)], [u0, deck + torto(3)]]
    if (i === partida) {
      // Partida: sobrou a metade de trás, com a ponta lascada.
      const vb = deck * 0.12
      cantos = [[u0, -deck + torto(0)], [u1, -deck + torto(1)], [u1, vb + 1.4], [u0 + LARGURA * 0.68, vb - 1.8], [u0 + LARGURA * 0.36, vb + 2.2], [u0, vb - 0.4]]
    }
    if (i === solta) {
      // Solta: girada e escorregada, a ponta saindo da beira.
      const giro = 0.15
      cantos = cantos.map(([u, v]) => [um + 2.2 + (u - um) * Math.cos(giro) - v * Math.sin(giro), 2 + (u - um) * Math.sin(giro) + v * Math.cos(giro)] as const)
    }
    let pontos = quadra(cantos)
    if (cantos.length === 4 && hash(i, 3, 6310) < 0.35) pontos = lascar(pontos, Math.floor(hash(i, 4, 6310) * 4), 1.3)
    const forma = poligono(pontos)
    const rachar = i === rachada
    const textura: Textura = (u, v, x, y, p, s, escala) => {
      gasta(u, v, x, y, p, s, escala, i)
      // Os pregos em cima de cada viga (a tábua solta perdeu os dela) e a racha ao comprido da rachada.
      if (i !== solta) {
        for (const vv of vigas) {
          const [px, py] = r.ponto(um, vv)
          if (Math.hypot(x - px, y - py) < RAIO_DO_PREGO) {
            misturarCor(s, PREGO.rgb, 0.9)
            s[3] += x - px + y - py < 0 ? 0.14 : -0.06
            return
          }
        }
      }
      if (rachar) {
        // A racha corre de través, um nada ondulada, perto do meio da tábua.
        const [aoLongo, deTraves] = c.w >= c.h ? [x, y] : [y, -x]
        if (Math.abs(aoLongo - um - 0.8 - Math.sin(deTraves * 0.21) * 1.1) < 0.45) s[3] -= 0.3
      }
    }
    cena.sombras.push({ forma, z: g * ALTURA_DO_TABULEIRO, forca: 0.28, solta: true })
    L.push(P(forma, madeira, { tabua: 0, eixo: r.deTraves, bisel: 1, tom: (i === solta ? 0.84 : TOM_DA_TABUA) + 0.12 * hash(i, 2, 6310), contorno: 0.26, textura, semente: 6320 + i, projeta: { dist: i === solta ? 1.8 : 1.1, forca: 0.24 } }))
  }

  // As CORDAS DE MÃO. A de trás inteira; a da frente arrebentou em cima do vão.
  const ponta = C - 8
  const trechosDaFrente: readonly (readonly [number, number])[] = [[-ponta, uDoVao[0] + 2.2], [uDoVao[1] - 2.2, ponta]]
  for (const lado of [-1, 1]) {
    const v = lado * linha
    const trechos: readonly (readonly [number, number])[] = lado < 0 ? [[-ponta, ponta]] : trechosDaFrente
    trechos.forEach(([a, b], k) => {
      const forma = corda(a, v, b, v, RAIO_DA_CORDA)
      cena.sombras.push({ forma, z: g * ALTURA_DA_CORDA, forca: 0.2, solta: true })
      L.push(P(forma, CORDA, { eixo: r.aoLongo, bisel: RAIO_DA_CORDA, tom: 1, contorno: 0.2, semente: 6400 + k + (lado + 1) * 2, projeta: { dist: 1.8, forca: 0.22 } }))
    })
    // Os tirantes de duas em duas tábuas, da corda até a beira do tabuado (menos onde a corda arrebentou).
    for (let i = 1; i < n - 1; i += 2) {
      const u = meioDa(i)
      if (lado > 0 && u > uDoVao[0] - 1 && u < uDoVao[1] + 1) continue
      L.push(P(corda(u, lado * (linha - 1), u - 1.5, lado * (deck - 0.5), RAIO_DO_TIRANTE), CORDA, { eixo: r.deTraves, bisel: 0.6, tom: 0.92, contorno: 0.16, semente: 6420 + i + lado }))
    }
  }

  // Os quatro POSTES redondos nas pontas: o topo de madeira com os anéis e o contorno escuro, e a volta de corda em
  // volta dele, no tom da torção.
  let j = 0
  for (const lado of [-1, 1]) {
    for (const extremo of [-1, 1]) {
      const [x, y] = r.ponto(extremo * ponta, lado * linha)
      const poste = elipse(x, y, POSTE, POSTE)
      cena.sombras.push({ forma: poste, z: g * ALTURA_DOS_POSTES }, contato(poste, 0.3))
      const volta = menos(elipse(x, y, POSTE + VOLTA, POSTE + VOLTA), elipse(x, y, POSTE - 0.4, POSTE - 0.4))
      L.push(P(volta, CORDA, { tabua: 0, bisel: 0.9, tom: TOM_DA_VOLTA, contorno: 0.26, arco: { cx: x, cy: y, r: POSTE + VOLTA / 2, a0: 0 }, semente: 6470 + j, projeta: { dist: 2.6, forca: 0.32 } }))
      const racha = hash(j, 1, 6480) * 2 * Math.PI
      const aneis: Textura = (_u, _v, px, py, _p, s) => {
        const dx = px - x
        const dy = py - y
        const d = Math.hypot(dx, dy)
        let luz = Math.sin(d * 2.1 + ruido(px * 0.5 + j * 9, py * 0.5) * 1.6) * 0.07 + 0.04
        if (d < 0.9) luz -= 0.16
        // A racha do topo, do miolo para a beira.
        const a = Math.atan2(dy, dx) - racha
        if (d > 1.2 && Math.abs(Math.sin(a)) * d < 0.35 && Math.cos(a) > 0) luz -= 0.24
        s[3] += luz
      }
      L.push(P(poste, madeira, { tabua: 0, bisel: 1.4, tom: 1.02, contorno: 0.42, textura: aneis, semente: 6460 + j }))
      j += 1
    }
  }
}
