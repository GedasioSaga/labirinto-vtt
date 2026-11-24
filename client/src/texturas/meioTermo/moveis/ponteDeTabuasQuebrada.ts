/**
 * PONTE DE TÁBUAS QUEBRADA (lote L07 "Selva: ruína e água", 24/11/2026; versão da `ponte` de madeira, só a ideia).
 * As tábuas de través pregadas nas duas VIGAS, com as cordas de mão presas nos quatro postes das pontas, e o estrago
 * da mata: um VÃO de duas tábuas que caíram (as vigas e os pregos à mostra, e o rio do mapa lá embaixo), uma tábua
 * partida ao meio com a ponta lascada, uma solta e torta, outra rachada e mais um buraco de uma tábua só. Do lado da
 * frente a CORDA DE MÃO arrebentou em cima do vão: as duas pontas soltas caem pela beira e somem na água, e um
 * tirante ficou pendurado. A outra corda segura.
 *
 * Corre ao longo do lado MAIOR da pegada, como a ponte (4 x 1 de partida). Está no ar: a sombra de cada tábua cai
 * solta (o vão deixa a luz passar) e a das cordas e dos postes vai mais longe. Não barra (o mestre decide se o vão
 * se pula). Perfil da 3/4: o da ponte (`EM_PE`). Material: `madeira`; a corda é fixa, a palha clara das pontes.
 */
import { hash } from '../../ruido'
import { capsula, elipse, poligono, type Ponto } from './formas'
import { contato, texturaDaClasse, type Textura } from './motor'
import { materialDaPeca, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { misturarCor } from './muroEmRuina'

const CORDA = materialDaPeca('corda')

/** Alturas em casas (a sombra): as tábuas e as vigas, a corda de mão e os postes. */
const ALTURA_DO_TABULEIRO = 0.32
const ALTURA_DA_VIGA = 0.3
const ALTURA_DA_CORDA = 0.72
const ALTURA_DOS_POSTES = 0.86
/** O passo das tábuas e a largura de uma (px); a beira do tabuado e a linha das cordas (px da beira da pegada). */
const PASSO = 10.5
const LARGURA = 8.2
const BEIRA_DO_TABUADO = 9
const LINHA_DA_CORDA = 4.5
/** As vigas: onde ficam (fração da meia largura) e a meia largura delas (px). */
const VIGA = { onde: 0.44, meia: 3 } as const
/** O poste e a volta de corda em cima dele (raios, px). */
const POSTE = 4.4
const VOLTA = 2
/** O raio da corda de mão e o do tirante (px). */
const RAIO_DA_CORDA = 1.6
const RAIO_DO_TIRANTE = 0.65
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

  // As TÁBUAS: quais faltam, qual partiu, qual soltou e qual rachou (sempre longe das pontas).
  const n = Math.max(6, Math.round((2 * C - 4) / PASSO))
  const passo = (2 * C - 4) / n
  const vao = Math.floor(n * 0.47)
  const faltam = new Set([vao, vao + 1, Math.floor(n * 0.76)])
  const partida = vao - 1
  const solta = vao + 2
  const rachada = Math.min(n - 2, Math.floor(n * 0.76) + 2)
  const meioDa = (i: number): number => -C + 2 + (i + 0.5) * passo

  // As VIGAS, no escuro: aparecem nas frestas e no vão, com os pregos que ficaram onde a tábua caiu.
  vigas.forEach((v, k) => {
    const forma = corda(-C + 1, v, C - 1, v, VIGA.meia)
    cena.sombras.push({ forma, z: g * ALTURA_DA_VIGA, forca: 0.22, solta: true })
    L.push(P(forma, madeira, { tabua: 0, eixo: r.aoLongo, bisel: 1, tom: 0.62, contorno: 0.22, semente: 6300 + k }))
    for (const i of faltam) {
      const [x, y] = r.ponto(meioDa(i), v)
      L.push(P(elipse(x, y, RAIO_DO_PREGO, RAIO_DO_PREGO), PREGO, { tabua: 0, bisel: 0.6, contorno: 0.2, metal: 0.5, semente: 6305 + i, projeta: { dist: 0.6, forca: 0.3 } }))
    }
  })

  for (let i = 0; i < n; i += 1) {
    if (faltam.has(i)) continue
    const um = meioDa(i)
    const u0 = um - LARGURA / 2
    const u1 = um + LARGURA / 2
    const sobra = (hash(i, 1, 6310) - 0.5) * 1.6
    let cantos: (readonly [number, number])[] = [[u0, -deck + sobra], [u1, -deck + sobra * 0.6], [u1, deck + sobra * 0.4], [u0, deck + sobra]]
    if (i === partida) {
      // Partida: sobrou a metade de trás, com a ponta lascada.
      const vb = deck * 0.12
      cantos = [[u0, -deck + sobra], [u1, -deck + sobra * 0.6], [u1, vb + 1.4], [u0 + LARGURA * 0.68, vb - 1.8], [u0 + LARGURA * 0.36, vb + 2.2], [u0, vb - 0.4]]
    }
    if (i === solta) {
      // Solta: girada e escorregada, a ponta saindo da beira.
      const giro = 0.15
      cantos = cantos.map(([u, v]) => [um + 2.2 + (u - um) * Math.cos(giro) - v * Math.sin(giro), 2 + (u - um) * Math.sin(giro) + v * Math.cos(giro)] as const)
    }
    const forma = poligono(quadra(cantos))
    const rachar = i === rachada
    const textura: Textura = (u, v, x, y, p, s, escala) => {
      if (veio !== null) veio(u, v, x, y, p, s, escala)
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
    L.push(P(forma, madeira, { tabua: 0, eixo: r.deTraves, bisel: 1, tom: (i === solta ? 0.8 : 0.86) + 0.2 * hash(i, 2, 6310), contorno: 0.26, textura, semente: 6320 + i, projeta: { dist: i === solta ? 1.8 : 1.1, forca: 0.24 } }))
  }

  // As CORDAS DE MÃO. A de trás inteira; a da frente arrebentou em cima do vão, e as pontas caem pela beira.
  const ponta = C - 5
  const uQuebra = meioDa(vao) + 1.5
  const pedacosDaCorda: (readonly [number, number])[] = [[-ponta, ponta]]
  for (const lado of [-1, 1]) {
    const v = lado * linha
    const trechos: readonly (readonly [number, number])[] = lado < 0 ? pedacosDaCorda : [[-ponta, uQuebra - 3.5], [uQuebra + 6.5, ponta]]
    trechos.forEach(([a, b], k) => {
      const forma = corda(a, v, b, v, RAIO_DA_CORDA)
      cena.sombras.push({ forma, z: g * ALTURA_DA_CORDA, forca: 0.2, solta: true })
      L.push(P(forma, CORDA, { eixo: r.aoLongo, bisel: RAIO_DA_CORDA, tom: 1, contorno: 0.2, semente: 6400 + k + (lado + 1) * 2, projeta: { dist: 1.8, forca: 0.22 } }))
    })
    // Os tirantes de duas em duas tábuas, da corda até a beira do tabuado (menos onde a corda arrebentou).
    for (let i = 1; i < n - 1; i += 2) {
      const u = meioDa(i)
      if (lado > 0 && u > uQuebra - 6 && u < uQuebra + 9) continue
      L.push(P(corda(u, lado * (linha - 1), u - 1.5, lado * (deck - 0.5), RAIO_DO_TIRANTE), CORDA, { eixo: r.deTraves, bisel: 0.6, tom: 0.92, contorno: 0.16, semente: 6420 + i + lado }))
    }
  }
  // As pontas soltas: cada uma vira para fora e cai; a parte de baixo, já perto da água, vai sumindo.
  const pontas: readonly (readonly (readonly [number, number])[])[] = [
    [[uQuebra - 3.5, linha], [uQuebra - 1.6, linha + 1.4], [uQuebra - 0.6, A - 1.2], [uQuebra - 0.2, A + 1.4]],
    [[uQuebra + 6.5, linha], [uQuebra + 5, linha + 1.6], [uQuebra + 4.4, A - 0.8], [uQuebra + 4.6, A + 1.8]],
    [[uQuebra + 1.4, deck + 0.4], [uQuebra + 2.2, deck + 2.6], [uQuebra + 1.6, deck + 4.6]],
  ]
  pontas.forEach((caminho, k) => {
    const raio = k === 2 ? RAIO_DO_TIRANTE : RAIO_DA_CORDA * 0.92
    for (let j = 1; j < caminho.length; j += 1) {
      const [a, b] = [caminho[j - 1], caminho[j]]
      const alfa = j === caminho.length - 1 ? 0.45 : j === caminho.length - 2 ? 0.8 : 1
      L.push(P(corda(a[0], a[1], b[0], b[1], raio), CORDA, { bisel: raio, tom: 0.95, contorno: 0.18, alfa, semente: 6440 + k * 4 + j, projeta: { dist: 1.2, forca: 0.2 } }))
    }
  })

  // Os quatro POSTES redondos nas pontas, com a volta de corda em cima.
  let j = 0
  for (const lado of [-1, 1]) {
    for (const extremo of [-1, 1]) {
      const [x, y] = r.ponto(extremo * ponta, lado * linha)
      const poste = elipse(x, y, POSTE, POSTE)
      cena.sombras.push({ forma: poste, z: g * ALTURA_DOS_POSTES }, contato(poste, 0.3))
      L.push(P(poste, madeira, { tabua: 0, bisel: 1.8, tom: 0.96, contorno: 0.3, semente: 6460 + j, projeta: { dist: 2.6, forca: 0.32 } }))
      L.push(P(elipse(x, y, VOLTA, VOLTA), CORDA, { tabua: 0, bisel: 0.8, tom: 1.04, contorno: 0.2, semente: 6470 + j }))
      j += 1
    }
  }
}
