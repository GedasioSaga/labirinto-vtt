/**
 * RALO DE MASMORRA de cima (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a versão de
 * masmorra do bueiro): a grade quadrada de ferro chumbada RENTE ao chão de pedra, no meio da sala de tortura ou no
 * fundo da cela, por onde se lava o chão. O QUADRO de ferro chato encaixado numa junta fina e escura na pedra, com
 * os quatro PARAFUSOS dos cantos e os riscos de ferrugem que escorrem deles; dentro, a GRADE de três barras de cada
 * lado, todas da mesma largura e do mesmo tom, abrindo dezesseis FUROS quadrados (cada um com o canto de cima à
 * esquerda no escuro e um fio de luz embaixo à direita) e, lá embaixo, o brilho da água parada. Em volta, a MANCHA
 * ÚMIDA da pedra molhada, justa e irregular, e um único FIO de água suja que chega por um lado.
 *
 * O que diz "ralo" (e não bueiro) a 25% de zoom é o quadrado escuro quadriculado, menor que a pegada, cercado pela
 * mancha escura e sem moldura de pedra.
 *
 * É OBJETO DE CHÃO rente: nenhuma sombra tem altura nem sai para fora (o quadro não projeta), e a 3/4 sai igual à
 * vista de cima (como o bueiro). Esticado, o ralo fica no meio, do tamanho do menor lado (a grade não estica: vira
 * retângulo só a mancha úmida).
 *
 * Material: `grade` (o ferro). O buraco, a água, a umidade, o sangue velho e a ferrugem são fixos.
 */
import type { Rgb } from '../../ruido'
import { caixa, cadeia, capsula, dentroDe, elipse, elipseGirada, menos, uniao, type Forma, type Ponto } from './formas'
import type { MaterialDaPeca } from './motor'
import type { MontarMovel } from './contexto'

// ---------- as medidas (frações do menor meio lado, salvo onde diz px) ----------

/** O meio lado de fora do quadro e a largura dele (px). */
const LADO_DO_QUADRO = 0.56
const LARGURA_DO_QUADRO = 3.2
/** A junta escura e fina entre o quadro e a pedra (px): no lugar da sombra para fora, que um objeto rente não faz. */
const JUNTA = 0.8
/** Quantas barras de cada lado, a meia largura de cada uma (px) e o tom: iguais nos dois rumos. */
const BARRAS = 3
const MEIA_BARRA = 1.3
const TOM_DA_GRADE = 0.95
/** A mancha úmida: justa (nenhum lobo passa de 0,75 do menor meio lado), de borda curta e mais firme. */
const SUAVE_DA_MANCHA = 1.6
const ALFA_DA_MANCHA = 0.28
/** Os lobos da mancha: meio e meios eixos (frações do menor meio lado). */
const LOBOS_DA_MANCHA: readonly (readonly [number, number, number, number])[] = [
  [-0.06, 0.04, 0.64, 0.58],
  [0.32, 0.34, 0.34, 0.26],
  [-0.5, 0.26, 0.24, 0.36],
  [0.12, -0.42, 0.3, 0.2],
  [-0.46, -0.3, 0.28, 0.2],
]
/** O fio de escorrido que chega pela esquerda, numa curva mansa (frações do menor meio lado), e a meia largura dele. */
const FIO: readonly Ponto[] = [
  [-1, -0.5],
  [-0.93, -0.45],
  [-0.86, -0.42],
  [-0.79, -0.37],
  [-0.72, -0.31],
  [-0.66, -0.26],
]
const MEIA_LARGURA_DO_FIO = 0.03
/** Os riscos de ferrugem: de que parafuso (sinais) e para onde escorrem (rumo em radianos, comprimento em px). */
const FERRUGENS: readonly (readonly [number, number, number, number])[] = [
  [-1, -1, 0.95, 2.6],
  [1, -1, 2.0, 2.1],
  [1, 1, -2.6, 2.4],
]

// ---------- os materiais fixos ----------

const BURACO_FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x29, 0x2a, 0x2a] }
const ESCURO_DO_BURACO: Rgb = [0x3c, 0x3d, 0x3e]
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x3d, 0x3b] }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x93, 0x90] }
const UMIDO: MaterialDaPeca = { classe: 'liso', rgb: [0x2a, 0x28, 0x25] }
const JUNTA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [0x26, 0x24, 0x22] }
/** O sangue velho diluído na água: vinho apagado, nunca vermelho. */
const SANGUE_VELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x2c, 0x27] }
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x56, 0x3d] }

/** A pedra molhada em volta: os lobos juntos numa mancha só (o x e o y esticam com a pegada). */
function manchaUmida(R: number, ex: number, ey: number): Forma {
  const [primeiro, ...resto] = LOBOS_DA_MANCHA.map(([x, y, rx, ry]) => elipse(x * R * ex, y * R * ey, rx * R * ex, ry * R * ey))
  return resto.reduce((soma, lobo) => uniao(soma, lobo), primeiro)
}

export const montarRaloDeMasmorra: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const grade = c.m.grade
  const L = cena.partes
  const R = Math.min(hw, hh)
  const ex = hw / R
  const ey = hh / R
  const s = LADO_DO_QUADRO * R
  const i = s - LARGURA_DO_QUADRO
  cena.corDoPiso = ESCURO_DO_BURACO

  // ---------- a pedra molhada, o fio de água suja e o sangue velho diluído ----------
  const mancha = manchaUmida(R, ex, ey)
  L.push(P(mancha, UMIDO, { bisel: 0, contorno: 0, alfa: ALFA_DA_MANCHA, suave: SUAVE_DA_MANCHA, semente: 9401 }))
  L.push(P(dentroDe(elipse(-0.3 * R * ex, -0.12 * R * ey, 0.36 * R * ex, 0.3 * R * ey), mancha), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.14, suave: 1.4, semente: 9402 }))
  const fio = FIO.map(([x, y]): Ponto => [x * hw * 0.98, y * R * ey])
  L.push(P(cadeia(fio, MEIA_LARGURA_DO_FIO * R), UMIDO, { bisel: 0, contorno: 0, alfa: ALFA_DA_MANCHA + 0.06, suave: 0.45, semente: 9403 }))

  // ---------- a junta fina e escura na pedra (no lugar da sombra para fora) ----------
  const fora = caixa(-s, -s, s, s, 1.2)
  L.push(P(caixa(-s - JUNTA, -s - JUNTA, s + JUNTA, s + JUNTA, 1.2 + JUNTA), JUNTA_ESCURA, { bisel: 0, contorno: 0, alfa: 0.85, suave: 0.25, semente: 9408 }))

  // ---------- o buraco, a água lá embaixo ----------
  const boca = caixa(-i, -i, i, i, 0.4)
  L.push(P(boca, BURACO_FUNDO, { bisel: 0, contorno: 0.2, recesso: { k: 2.4, forca: 0.5 }, semente: 9410 }))
  L.push(P(dentroDe(elipse(i * 0.12, i * 0.24, i * 0.72, i * 0.46), boca), AGUA, { bisel: 0, contorno: 0, alfa: 0.86, suave: 1.4, semente: 9411 }))
  L.push(P(dentroDe(elipseGirada(i * 0.3, i * 0.36, i * 0.3, 0.8, -0.1), boca), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.4, suave: 0.7, semente: 9412 }))

  // ---------- a grade: as seis barras numa peça só, da mesma largura e do mesmo tom ----------
  // Os quatro furos de cada fileira têm o mesmo lado: 4 furos + 3 barras enchem a boca. A grade inteira projeta no
  // fundo, e é isso que deixa o canto de cima à esquerda de cada furo no escuro.
  const furo = (2 * i - BARRAS * 2 * MEIA_BARRA) / (BARRAS + 1)
  const meios = Array.from({ length: BARRAS }, (_, b) => -i + furo + MEIA_BARRA + b * (furo + 2 * MEIA_BARRA))
  const barras: Forma[] = []
  for (const m of meios) {
    barras.push(caixa(m - MEIA_BARRA, -i - 0.4, m + MEIA_BARRA, i + 0.4, 0.25))
    barras.push(caixa(-i - 0.4, m - MEIA_BARRA, i + 0.4, m + MEIA_BARRA, 0.25))
  }
  const [primeira, ...outras] = barras
  const grelha = outras.reduce((soma, b) => uniao(soma, b), primeira)
  L.push(P(grelha, grade, { tabua: 0, bisel: 0.8, tom: TOM_DA_GRADE, contorno: 0.3, metal: 0.35, semente: 9420, projeta: { dist: 1.5, forca: 0.6, suave: 0.6 } }))
  // O fio de luz embaixo e à direita de cada furo: a beira da barra que olha para a luz, molhada.
  const bordas = [-i, ...meios.map((m) => m - MEIA_BARRA)]
  const fins = [...meios.map((m) => m - MEIA_BARRA), i]
  for (let a = 0; a <= BARRAS; a += 1) {
    for (let b = 0; b <= BARRAS; b += 1) {
      const [x0, x1] = [bordas[a] + (a === 0 ? 0 : 2 * MEIA_BARRA), fins[a]]
      const [y0, y1] = [bordas[b] + (b === 0 ? 0 : 2 * MEIA_BARRA), fins[b]]
      if (b < BARRAS) L.push(P(caixa(x0 + 0.3, y1, x1, y1 + 0.38), grade, { tabua: 0, bisel: 0, contorno: 0, tom: 1.5, metal: 0.4, alfa: 0.6, semente: 9430 }))
      if (a < BARRAS) L.push(P(caixa(x1, y0 + 0.3, x1 + 0.38, y1), grade, { tabua: 0, bisel: 0, contorno: 0, tom: 1.4, metal: 0.4, alfa: 0.5, semente: 9431 }))
    }
  }

  // ---------- o quadro, a ferrugem que escorre dos parafusos e os parafusos ----------
  const quadro = menos(fora, caixa(-i + 0.3, -i + 0.3, i - 0.3, i - 0.3, 0.4))
  L.push(P(quadro, grade, { tabua: 0, bisel: 1.1, tom: 0.86, contorno: 0.32, semente: 9440 }))
  // A junta escura de dentro, de 0,8 px, entre o quadro e a grade.
  L.push(P(menos(caixa(-i + 0.3, -i + 0.3, i - 0.3, i - 0.3, 0.4), caixa(-i + 0.3 + JUNTA, -i + 0.3 + JUNTA, i - 0.3 - JUNTA, i - 0.3 - JUNTA, 0.3)), JUNTA_ESCURA, { bisel: 0, contorno: 0, alfa: 0.6, suave: 0.2, semente: 9446 }))
  for (const [sx, sy, rumo, comp] of FERRUGENS) {
    const bx = sx * (s - LARGURA_DO_QUADRO / 2)
    const by = sy * (s - LARGURA_DO_QUADRO / 2)
    const risco = capsula(bx, by, bx + Math.cos(rumo) * comp, by + Math.sin(rumo) * comp, 0.32)
    L.push(P(dentroDe(risco, quadro), FERRUGEM, { bisel: 0, contorno: 0, alfa: 0.35, suave: 0.35, semente: 9443 }))
  }
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const bx = sx * (s - LARGURA_DO_QUADRO / 2)
    const by = sy * (s - LARGURA_DO_QUADRO / 2)
    L.push(P(elipse(bx, by, 1.15, 1.15), grade, { bisel: 0.7, contorno: 0.32, tom: 1.16, metal: 0.55, semente: 9441 }))
    L.push(P(caixa(bx - 0.75, by - 0.18, bx + 0.75, by + 0.18), JUNTA_ESCURA, { bisel: 0, contorno: 0, alfa: 0.6, semente: 9442 }))
  }
}
