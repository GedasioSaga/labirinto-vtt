/**
 * POSTE DE AÇOITE (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura): o tronco grosso FINCADO
 * no chão do pátio da masmorra, desenhado DE FRENTE, como a armadura e o boneco de treino (visto de cima, um poste é
 * só uma bolinha). O TRONCO roliço, um pouco torto, de casca rachada, com o topo cortado a machado; no alto, a ARGOLA
 * de ferro presa por um grampo, e nela a CORDA velha de sisal, fina e escura, com o nó justo, caindo em duas pontas
 * pela frente que se desfiam em fios soltos. Onde as mãos ficam, a madeira está gasta e clara; embaixo da argola, os
 * dois fios de sangue velho que escorreram e secaram. No pé, a TERRA pisada, umas pedras, a SOMBRA comprida do tronco
 * deitada no chão e, largado nele, o AÇOITE de cabo curto e grosso com a tira afinando numa curva em S.
 *
 * O que diz "poste de açoite" a 25% de zoom é a coluna escura de madeira com a argola e a corda no alto, e a
 * sombra comprida no chão.
 *
 * A sombra no chão sai do pé do tronco e deita no rumo da luz, afinando na ponta (desenhada, sem altura: a casa não
 * cabe a sombra arrastada inteira). A 3/4 é a mesma imagem (perfil em pé).
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
/** A meia largura do tronco no pé e no topo. */
const MEIO_NO_PE = 6.4
const MEIO_NO_TOPO = 5.1
/** A argola: o grampo e o meio do anel. */
const GRAMPO = -15.4
const MEIO_DA_ARGOLA = -10.4
/** As duas pontas da corda, do nó para baixo (px). */
const PONTA_LONGA: readonly Ponto[] = [[0.5, -5.2], [1.2, -1], [0.7, 3.6], [1.5, 8.2], [1.1, 11]]
const PONTA_CURTA: readonly Ponto[] = [[-0.5, -5.2], [-1.4, -2.2], [-1.1, 1.2], [-1.9, 3.4]]
/** A corda: o raio (fina, de sisal velho) e o tom (escuro, sobre o tom da corda). */
const RAIO_DA_CORDA = 0.85
const TOM_DA_CORDA_VELHA = 0.8
/** O desfiado de cada ponta: quantos fios, o comprimento (px) e o raio de cada um. */
const FIOS_DA_PONTA = 6
const COMPRIMENTO_DO_FIO = 2.4
const RAIO_DO_FIO = 0.15
/** A sombra comprida no chão: a ponta dela (px) e a meia largura lá (afina). */
const PONTA_DA_SOMBRA: Ponto = [26.2, 25.4]
const MEIA_PONTA_DA_SOMBRA = 0.9
/**
 * O açoite, à esquerda do pé (à direita ele sumia na sombra comprida): o cabo (de, até, raio) e a tira em S (os
 * pontos de controle da curva e os raios do começo e da ponta).
 */
const CABO_DO_ACOITE: readonly [Ponto, Ponto, number] = [[-6.6, 23.9], [-10.6, 22.7], 1.45]
const TIRA: readonly Ponto[] = [[-11, 22.6], [-15.8, 20.3], [-17, 26.2], [-24.8, 23.2]]
const RAIO_DA_TIRA: Ponto = [0.78, 0.16]

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

/** Um tubo que afina: a linha por `pontos`, do raio `r0` no começo ao `r1` no fim. */
function tuboAfinando(pontos: readonly Ponto[], r0: number, r1: number): Forma {
  const comp: number[] = [0]
  for (let i = 1; i < pontos.length; i += 1) comp.push(comp[i - 1] + Math.hypot(pontos[i][0] - pontos[i - 1][0], pontos[i][1] - pontos[i - 1][1]))
  const total = comp[comp.length - 1] || 1
  const xs = pontos.map((p) => p[0])
  const ys = pontos.map((p) => p[1])
  return {
    b: [Math.min(...xs) - r0, Math.min(...ys) - r0, Math.max(...xs) + r0, Math.max(...ys) + r0],
    d: (x, y) => {
      let melhor = Infinity
      for (let i = 1; i < pontos.length; i += 1) {
        const [ax, ay] = pontos[i - 1]
        const vx = pontos[i][0] - ax
        const vy = pontos[i][1] - ay
        const l2 = vx * vx + vy * vy || 1
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2))
        const r = r0 + (r1 - r0) * ((comp[i - 1] + t * (comp[i] - comp[i - 1])) / total)
        melhor = Math.min(melhor, Math.hypot(x - ax - vx * t, y - ay - vy * t) - r)
      }
      return melhor
    },
  }
}

/** Os pontos da curva de Bézier cúbica de controle `c`, em `n` passos. */
function curva(c: readonly Ponto[], n: number): Ponto[] {
  return Array.from({ length: n + 1 }, (_, i): Ponto => {
    const t = i / n
    const u = 1 - t
    const a = u * u * u
    const b = 3 * u * u * t
    const d = 3 * u * t * t
    const e = t * t * t
    return [a * c[0][0] + b * c[1][0] + d * c[2][0] + e * c[3][0], a * c[0][1] + b * c[1][1] + d * c[2][1] + e * c[3][1]]
  })
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

  // ---------- as sombras: a comprida, deitada no rumo da luz e afinando, e o contato no pé ----------
  const [sx, sy] = PONTA_DA_SOMBRA
  const m = MEIA_PONTA_DA_SOMBRA
  const sombra = poligono([[-5.6 * k, 18.6 * k], [6.2 * k, 18.4 * k], [(sx + m) * k, (sy - m) * k], [(sx - m) * k, (sy + m) * k], [4.6 * k, 22.4 * k], [-5.2 * k, 21.2 * k]])
  cena.sombras.push({ forma: sombra, z: 0, forca: 0.34, suave: 1.5 })
  cena.sombras.push(contato(elipse(0, CHAO * k, (MEIO_NO_PE + 1.6) * k, 2.6 * k), 0.38))

  // ---------- o chão: a terra pisada, as pedras e o sangue que pingou ----------
  L.push(P(elipse(0.4 * k, (CHAO + 1.6) * k, 16 * k, 5 * k), TERRA, { bisel: 0, contorno: 0, alfa: 0.5, suave: 2.6, semente: 9802 }))
  L.push(P(elipse(0, (CHAO + 0.8) * k, 9.5 * k, 2.8 * k), TERRA, { bisel: 0, contorno: 0, alfa: 0.55, suave: 1.4, tom: 0.8, semente: 9803 }))
  for (const [px, py, r] of [[-14.6, 18.6, 0.9], [12.2, 24.6, 1.3], [9.4, 21.4, 0.8]] as const) {
    L.push(P(elipse(px * k, py * k, r * 1.3 * k, r * k), PEDRA, { bisel: 0.8, contorno: 0.3, tom: 0.9, semente: 9804, projeta: { dist: 0.6, forca: 0.4 } }))
  }
  for (const [px, py, r] of [[3.4, 22.4, 1.1], [5.8, 21.2, 0.7], [-3.6, 23, 0.8]] as const) {
    L.push(P(elipse(px * k, py * k, r * 1.5 * k, r * 0.8 * k), SANGUE_VELHO, { bisel: 0.3, contorno: 0.1, alfa: 0.7, semente: 9805 }))
  }

  // ---------- o tronco, o topo cortado e a madeira gasta onde as mãos ficam ----------
  L.push(P(tronco, mad, { textura: texTronco(hash(3, 3, 9806) * 40), eixo: QUARTO, tabua: 0, bisel: 1.1, contorno: 0.36, tom: 0.86, semente: 9806 }))
  L.push(P(elipse(torto, topoY, (MEIO_NO_TOPO + 0.2) * k, 1.8 * k), mad, { textura: texTopo(topoY), tabua: 0, bisel: 0.6, contorno: 0.3, tom: 1, semente: 9807 }))
  L.push(P(dentroDe(elipse(torto * 0.6 - 0.6 * k, (MEIO_DA_ARGOLA + 1.2) * k, 5.2 * k, 6.4 * k), tronco), GASTO, { bisel: 0, contorno: 0, alfa: 0.36, suave: 1.2, semente: 9808 }))

  // ---------- a argola de ferro, presa pelo grampo ----------
  const ax = torto * 0.5
  L.push(P(caixa(ax - 1.9 * k, (GRAMPO - 2) * k, ax + 1.9 * k, (GRAMPO + 1.7) * k, 0.6), fer, { tabua: 0, bisel: 0.6, contorno: 0.34, tom: 0.76, metal: 0.35, semente: 9811, projeta: { dist: 0.8, forca: 0.45 } }))
  L.push(P(elipse(ax, (GRAMPO - 0.2) * k, 0.8 * k, 0.8 * k), fer, { bisel: 0.5, contorno: 0.3, tom: 1.2, metal: 0.6, semente: 9812 }))

  // ---------- o sangue velho: dois fios escorrendo de debaixo da argola ----------
  // Os dois fios passam por fora das pontas da corda, para não sumirem atrás dela.
  const fios: readonly (readonly Ponto[])[] = [
    [[ax - 3.2 * k, -5 * k], [ax - 3.8 * k, -1 * k], [ax - 3.4 * k, 3.2 * k], [ax - 3.9 * k, 8.4 * k]],
    [[ax + 2.9 * k, -4.6 * k], [ax + 3.3 * k, 0.4 * k], [ax + 3 * k, 5.6 * k], [ax + 3.4 * k, 11.6 * k]],
  ]
  L.push(P(dentroDe(elipse(ax + 0.2 * k, -4.8 * k, 4.6 * k, 1.6 * k), tronco), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.24, suave: 1, semente: 9809 }))
  fios.forEach((fio, i) => {
    L.push(P(dentroDe(tuboAfinando(fio, (0.72 - i * 0.04) * k, 0.28 * k), tronco), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.45, suave: 0.3, semente: 9810 + i }))
  })

  const argola = anel(ax, MEIO_DA_ARGOLA * k, 4.4 * k, 4.9 * k, 3 * k, 3.5 * k)
  L.push(P(argola, fer, { tabua: 0, bisel: 0.9, contorno: 0.36, tom: 1, metal: 0.55, semente: 9813, projeta: { dist: 1.4, forca: 0.5, suave: 0.8 } }))

  // ---------- a corda velha: as duas pontas caindo pela frente, o desfiado e o nó justo na argola ----------
  const em = (pontos: readonly Ponto[]): Ponto[] => pontos.map(([x, y]): Ponto => [ax + x * k, y * k])
  const pontas: readonly (readonly [readonly Ponto[], number, number])[] = [
    [PONTA_CURTA, 0.92, 9814],
    [PONTA_LONGA, 1, 9815],
  ]
  for (const [pontos, tom, semente] of pontas) {
    const linha = em(pontos)
    L.push(P(cadeia(linha, RAIO_DA_CORDA * k), CORDA, { eixo: QUARTO, bisel: 0.7, contorno: 0.28, tom: TOM_DA_CORDA_VELHA * tom, semente, projeta: { dist: 1, forca: 0.4 } }))
    // O desfiado: fios finos abrindo em leque e sumindo, nunca dedos rombudos.
    const [fx, fy] = linha[linha.length - 1]
    const [gx, gy] = linha[linha.length - 2]
    const rumo = Math.atan2(fy - gy, fx - gx)
    for (let i = 0; i < FIOS_DA_PONTA; i += 1) {
      const a = rumo + (i / (FIOS_DA_PONTA - 1) - 0.5) * 0.9 + (hash(i, semente, 9816) - 0.5) * 0.16
      const comp = COMPRIMENTO_DO_FIO * (0.75 + hash(i, semente, 9817) * 0.5) * k
      const meio: Ponto = [fx + Math.cos(a) * comp * 0.5, fy + Math.sin(a) * comp * 0.5]
      const fim: Ponto = [fx + Math.cos(a + 0.08) * comp, fy + Math.sin(a + 0.08) * comp]
      L.push(P(tuboAfinando([[fx, fy], meio], RAIO_DO_FIO * 1.3 * k, RAIO_DO_FIO * k), CORDA, { bisel: 0, contorno: 0, tom: TOM_DA_CORDA_VELHA * 0.95, alfa: 0.78, semente: 9818 }))
      L.push(P(tuboAfinando([meio, fim], RAIO_DO_FIO * k, RAIO_DO_FIO * 0.5 * k), CORDA, { bisel: 0, contorno: 0, tom: TOM_DA_CORDA_VELHA * 1.05, alfa: 0.4, semente: 9819 }))
    }
  }
  const raioDoNo = RAIO_DA_CORDA * 1.3 * k
  L.push(P(elipse(ax, (MEIO_DA_ARGOLA + 4.9) * k, raioDoNo * 1.12, raioDoNo), CORDA, { bisel: 0.8, contorno: 0.3, tom: TOM_DA_CORDA_VELHA * 1.02, ruga: 0.3, semente: 9817, projeta: { dist: 0.8, forca: 0.4 } }))

  // ---------- o açoite largado no chão: o cabo curto e grosso e a tira em S, afinando ----------
  const [[c0x, c0y], [c1x, c1y], rc] = CABO_DO_ACOITE
  const cabo = capsula(c0x * k, c0y * k, c1x * k, c1y * k, rc * k)
  const tira = tuboAfinando(curva(TIRA, 18).map(([x, y]): Ponto => [x * k, y * k]), RAIO_DA_TIRA[0] * k, RAIO_DA_TIRA[1] * k)
  cena.sombras.push(contato(cabo, 0.32), contato(tira, 0.24))
  L.push(P(tira, COURO, { bisel: 0.45, contorno: 0.3, tom: 0.98, semente: 9820, projeta: { dist: 0.6, forca: 0.35 } }))
  L.push(P(cabo, COURO, { eixo: Math.atan2(c1y - c0y, c1x - c0x) + QUARTO, tabua: 1.1 * k, bisel: 1, contorno: 0.34, tom: 0.88, semente: 9824, projeta: { dist: 0.8, forca: 0.4 } }))
  // A ponta do cabo, de couro gasto e claro.
  L.push(P(elipse(c0x * k, c0y * k, rc * 1.02 * k, rc * 1.02 * k), COURO, { bisel: 0.6, contorno: 0.32, tom: 1.36, semente: 9825 }))
}
