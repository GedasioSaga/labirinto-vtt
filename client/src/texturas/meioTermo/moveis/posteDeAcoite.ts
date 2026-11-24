/**
 * POSTE DE AÇOITE (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura): o tronco grosso FINCADO
 * no chão do pátio da masmorra, desenhado DE FRENTE, como a armadura e o boneco de treino (visto de cima, um poste é
 * só uma bolinha). O TRONCO roliço, um pouco torto, de casca rachada, com o topo cortado a machado; no alto, a ARGOLA
 * de ferro presa por um grampo, e nela a CORDA com o nó, caindo em duas pontas pela frente. Onde as mãos ficam, a
 * madeira está gasta e clara; embaixo da argola, o sangue velho que escorreu e secou. No pé, a TERRA pisada, umas
 * pedras e, largado no chão, o AÇOITE de cabo de couro com a tira enrolada em S.
 *
 * O que diz "poste de açoite" a 25% de zoom é a coluna escura de madeira com a argola e a corda clara no alto, e a
 * sombra comprida no chão.
 *
 * A sombra no chão sai do pé do tronco, arrastada até a altura dele. A 3/4 é a mesma imagem (perfil em pé).
 *
 * Esticado, o desenho fica no meio, do tamanho do menor lado. Materiais: `madeira` (o tronco) e `ferragens` (a
 * argola e o grampo). A corda, o couro, a terra e o sangue são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, capsula, caixa, cadeia, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, TOM_DA_CORDA, type MaterialDaPeca, type Textura } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo no tamanho de partida, 1 x 1 casa; y para baixo) ----------

const LADO_DE_PARTIDA = G
/** O chão (onde o tronco entra) e o topo cortado. */
const CHAO = 19.4
const TOPO = -24.6
/** A meia largura do tronco no pé e no topo, e a altura (px) que a sombra arrasta. */
const MEIO_NO_PE = 6.4
const MEIO_NO_TOPO = 5.1
const ALTURA_DO_TRONCO = 0.86 * G
/** A argola: o grampo e o meio do anel. */
const GRAMPO = -15.4
const MEIO_DA_ARGOLA = -10.4
/** As duas pontas da corda, do nó para baixo (px). */
const PONTA_LONGA: readonly Ponto[] = [[0.6, -5.4], [1.4, -1], [0.8, 3.6], [1.8, 8.2], [1.2, 11.4]]
const PONTA_CURTA: readonly Ponto[] = [[-0.6, -5.4], [-1.6, -2.2], [-1.2, 1.2], [-2.2, 3.4]]

// ---------- os materiais fixos ----------

const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x3d, 0x2d] }
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: [0x5b, 0x4b, 0x3c] }
const PEDRA: MaterialDaPeca = { classe: 'pedra', rgb: [0x7a, 0x76, 0x70], pedra: 'granito' }
const SANGUE_VELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x27, 0x23] }
const GASTO: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0xa0, 0x7e] }
const MIOLO: Rgb = [0xa8, 0x8c, 0x66]

/** O tronco de frente: a luz roliça (o lado esquerdo pega a luz), a casca rachada ao comprido e os nós. */
function texTronco(veio: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const meio = MEIO_NO_PE + ((MEIO_NO_TOPO - MEIO_NO_PE) * (CHAO - y)) / (CHAO - TOPO)
    const t = Math.max(-1, Math.min(1, x / meio))
    let luz = -t * 0.26 - t * t * t * 0.08 + 0.04
    const fenda = ruido(x * 0.95 + p.su, y * 0.085 + veio)
    luz += fenda * 0.16
    if (fenda < -0.16) luz -= 0.14
    luz += ruido(x * 0.4, y * 0.4 + p.sv) * 0.05
    s[3] += luz
  }
}

/** O topo cortado: o miolo claro com os anéis em volta do meio. */
function texTopo(cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const r = Math.hypot(x, (y - cy) * 2.6) + ruido(x * 0.3 + p.su, y * 0.3) * 1.1
    s[0] = MIOLO[0]
    s[1] = MIOLO[1]
    s[2] = MIOLO[2]
    s[3] += Math.sin(r * 2.6) * 0.04 - Math.max(0, r - 3.6) * 0.05
  }
}

/** O contorno do tronco: um pouco torto, mais grosso no pé, com o nó do lado direito. */
function contornoDoTronco(k: number): Forma {
  const esquerda: Ponto[] = []
  const direita: Ponto[] = []
  const passos = 9
  for (let i = 0; i <= passos; i += 1) {
    const f = i / passos
    const y = CHAO + 1.2 + (TOPO - CHAO - 1.2) * f
    const meio = MEIO_NO_PE + (MEIO_NO_TOPO - MEIO_NO_PE) * f
    const torto = Math.sin(f * 2.6 + 0.4) * 0.9
    esquerda.push([(torto - meio - (hash(i, 1, 9801) - 0.5) * 0.7) * k, y * k])
    direita.push([(torto + meio + (hash(i, 2, 9801) - 0.5) * 0.7 + (i === 4 ? 1.1 : 0)) * k, y * k])
  }
  return poligono([...esquerda, ...direita.reverse()])
}

export const montarPosteDeAcoite: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const L = cena.partes
  const k = Math.min(c.w, c.h) / LADO_DE_PARTIDA
  const tronco = contornoDoTronco(k)
  const topoY = (TOPO + 0.4) * k
  const torto = Math.sin(2.6 + 0.4) * 0.9 * k

  // ---------- as sombras: o tronco arrastado até a altura dele, e o contato no pé ----------
  cena.sombras.push({ forma: elipse(0.6 * k, CHAO * k, MEIO_NO_PE * k, 2.3 * k), z: ALTURA_DO_TRONCO * k, forca: 0.3 })
  cena.sombras.push(contato(elipse(0, CHAO * k, (MEIO_NO_PE + 1.6) * k, 2.6 * k), 0.38))

  // ---------- o chão: a terra pisada, as pedras e o sangue que pingou ----------
  L.push(P(elipse(0.4 * k, (CHAO + 1.6) * k, 16 * k, 5 * k), TERRA, { bisel: 0, contorno: 0, alfa: 0.5, suave: 2.6, semente: 9802 }))
  L.push(P(elipse(0, (CHAO + 0.8) * k, 9.5 * k, 2.8 * k), TERRA, { bisel: 0, contorno: 0, alfa: 0.55, suave: 1.4, tom: 0.8, semente: 9803 }))
  for (const [px, py, r] of [[-10.6, 21.6, 1.5], [-12.6, 19.6, 0.9], [11.8, 18.8, 1.1]] as const) {
    L.push(P(elipse(px * k, py * k, r * 1.3 * k, r * k), PEDRA, { bisel: 0.8, contorno: 0.3, tom: 0.9, semente: 9804, projeta: { dist: 0.6, forca: 0.4 } }))
  }
  for (const [px, py, r] of [[3.4, 22.4, 1.1], [5.8, 21.2, 0.7], [-3.6, 23, 0.8]] as const) {
    L.push(P(elipse(px * k, py * k, r * 1.5 * k, r * 0.8 * k), SANGUE_VELHO, { bisel: 0.3, contorno: 0.1, alfa: 0.7, semente: 9805 }))
  }

  // ---------- o tronco, o topo cortado e a madeira gasta ----------
  L.push(P(tronco, mad, { textura: texTronco(hash(3, 3, 9806) * 40), eixo: QUARTO, tabua: 0, bisel: 1.1, contorno: 0.36, tom: 0.86, semente: 9806 }))
  L.push(P(elipse(torto, topoY, (MEIO_NO_TOPO + 0.2) * k, 1.8 * k), mad, { textura: texTopo(topoY), tabua: 0, bisel: 0.6, contorno: 0.3, tom: 1, semente: 9807 }))
  L.push(P(dentroDe(elipse(torto * 0.6 - 0.8 * k, (GRAMPO - 0.4) * k, 5.6 * k, 3.2 * k), tronco), GASTO, { bisel: 0, contorno: 0, alfa: 0.26, suave: 1.6, semente: 9808 }))
  // O sangue que escorreu da argola para baixo e secou na casca.
  L.push(P(dentroDe(elipse(0.9 * k, -1.6 * k, 3.1 * k, 6.4 * k), tronco), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.42, suave: 1.8, semente: 9809 }))
  for (const [px, y0, y1] of [[-0.6, 2, 9.4], [2.2, 1, 6.2], [0.9, 3, 12.6]] as const) {
    L.push(P(dentroDe(capsula(px * k, y0 * k, px * k, y1 * k, 0.55 * k), tronco), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.5, semente: 9810 }))
  }

  // ---------- a argola de ferro, presa pelo grampo ----------
  const ax = torto * 0.5
  L.push(P(caixa(ax - 1.9 * k, (GRAMPO - 2) * k, ax + 1.9 * k, (GRAMPO + 1.7) * k, 0.6), fer, { tabua: 0, bisel: 0.6, contorno: 0.34, tom: 0.76, metal: 0.35, semente: 9811, projeta: { dist: 0.8, forca: 0.45 } }))
  L.push(P(elipse(ax, (GRAMPO - 0.2) * k, 0.8 * k, 0.8 * k), fer, { bisel: 0.5, contorno: 0.3, tom: 1.2, metal: 0.6, semente: 9812 }))
  const argola = anel(ax, MEIO_DA_ARGOLA * k, 4.4 * k, 4.9 * k, 3 * k, 3.5 * k)
  L.push(P(argola, fer, { tabua: 0, bisel: 0.9, contorno: 0.36, tom: 1, metal: 0.55, semente: 9813, projeta: { dist: 1.4, forca: 0.5, suave: 0.8 } }))

  // ---------- a corda: o nó na argola e as duas pontas caindo pela frente ----------
  const em = (pontos: readonly Ponto[]): Ponto[] => pontos.map(([x, y]): Ponto => [(ax + x * k), y * k])
  L.push(P(cadeia(em(PONTA_CURTA), 1.25 * k), CORDA, { eixo: QUARTO, bisel: 1, contorno: 0.28, tom: 0.92, semente: 9814, projeta: { dist: 1.2, forca: 0.42 } }))
  L.push(P(cadeia(em(PONTA_LONGA), 1.3 * k), CORDA, { eixo: QUARTO, bisel: 1, contorno: 0.28, tom: 1, semente: 9815, projeta: { dist: 1.3, forca: 0.45 } }))
  const [fx, fy] = em(PONTA_LONGA)[PONTA_LONGA.length - 1]
  for (const a of [-0.5, 0, 0.45]) {
    L.push(P(capsula(fx, fy, fx + Math.sin(a) * 2.2 * k, fy + Math.cos(a) * 2.2 * k, 0.45 * k), CORDA, { eixo: QUARTO, bisel: 0.3, contorno: 0.22, tom: 0.9, semente: 9816 }))
  }
  L.push(P(elipse(ax, (MEIO_DA_ARGOLA + 4.6) * k, 2.4 * k, 2 * k), CORDA, { bisel: 1.3, contorno: 0.3, tom: 1.04, ruga: 0.3, semente: 9817, projeta: { dist: 1, forca: 0.4 } }))

  // ---------- o açoite largado no chão: o cabo de couro e a tira em S ----------
  const cabo = capsula(5.2 * k, 24.2 * k, 11.2 * k, 22.4 * k, 1.1 * k)
  cena.sombras.push(contato(cabo, 0.3))
  const tira: readonly (readonly [readonly Ponto[], number])[] = [
    [[[11.2, 22.4], [13.6, 21.6], [15.8, 22.6]], 0.78],
    [[[15.8, 22.6], [17.6, 23.8], [19.8, 23.4]], 0.62],
    [[[19.8, 23.4], [21.8, 22.4], [23.6, 23]], 0.46],
  ]
  tira.forEach(([pontos, r], i) => {
    L.push(P(cadeia(pontos.map(([x, y]): Ponto => [x * k, y * k]), r * k), COURO, { bisel: 0.4, contorno: 0.3, tom: 1.04, semente: 9820 + i, projeta: { dist: 0.6, forca: 0.35 } }))
  })
  L.push(P(cabo, COURO, { eixo: -0.3, tabua: 1.3 * k, bisel: 0.8, contorno: 0.34, tom: 0.84, semente: 9824, projeta: { dist: 0.8, forca: 0.4 } }))
  L.push(P(elipse(5.2 * k, 24.2 * k, 1.3 * k, 1.3 * k), fer, { bisel: 0.5, contorno: 0.32, tom: 0.9, metal: 0.5, semente: 9825 }))
}
