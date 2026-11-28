/**
 * As versões do RALO DE MASMORRA (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`;
 * tema Esgotos). A 1ª, SECO, é o desenho de `MONTADORES` (`montarRaloDeMasmorra`). Aqui fica o TRANSBORDANDO: o esgoto
 * subiu e o ralo devolve a água. A POÇA suja se espalha quase até a beira da pegada, em lóbulos largos, com a beira
 * que pega luz e a pedra encharcada em volta; o quadro e a grade ficam DEBAIXO da lâmina de água (mais apagados, com o
 * reflexo atravessado por cima), e em cinco dos dezesseis furos a água BORBULHA (os anéis de espuma e as bolhinhas).
 * A espuma suja junta na beira de baixo da poça, um fio de água foge pela esquerda (o caminho do fio do ralo seco, agora
 * saindo) e boiam um graveto de palha e uma folha.
 *
 * Mesma pegada e mesmo lugar de material do tipo (`grade`). As medidas do quadro e da grade são as de
 * `moveis/raloDeMasmorra.ts` (lá não são exportadas: copiadas aqui, com o mesmo nome). Rente ao chão: nenhuma sombra
 * com altura, a 3/4 igual à de cima.
 */
import type { VersoesDesenhadas } from '.'
import { hash, type Rgb } from '../../../ruido'
import { anel, caixa, cadeia, capsula, dentroDe, elipse, elipseGirada, menos, uniao, type Forma, type Ponto } from '../formas'
import type { MaterialDaPeca } from '../motor'
import type { MontarMovel } from '../contexto'

// ---------- as medidas de `raloDeMasmorra.ts` ----------

const LADO_DO_QUADRO = 0.56
const LARGURA_DO_QUADRO = 3.2
const JUNTA = 0.8
const BARRAS = 3
const MEIA_BARRA = 1.3
const TOM_DA_GRADE = 0.95
const FIO: readonly Ponto[] = [
  [-1, -0.5],
  [-0.93, -0.45],
  [-0.86, -0.42],
  [-0.79, -0.37],
  [-0.72, -0.31],
  [-0.66, -0.26],
]

// ---------- as medidas do transbordando ----------

/** Os lóbulos da poça: meio e meios eixos (frações do menor meio lado; nenhum passa de 0,97 dele). */
const LOBOS_DA_POCA: readonly (readonly [number, number, number, number])[] = [
  [-0.04, 0.05, 0.84, 0.76],
  [0.4, 0.42, 0.5, 0.4],
  [-0.56, 0.36, 0.38, 0.46],
  [0.14, -0.58, 0.46, 0.32],
  [-0.5, -0.44, 0.4, 0.32],
  [0.6, -0.22, 0.34, 0.38],
]
/** Os furos que borbulham (coluna, linha, de 0 a 3). */
const FUROS_QUE_BORBULHAM: readonly (readonly [number, number])[] = [
  [1, 1],
  [2, 2],
  [0, 2],
  [3, 0],
  [2, 0],
]

// ---------- os materiais fixos ----------

const BURACO_FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x29, 0x2a, 0x2a] }
const ESCURO_DO_BURACO: Rgb = [0x3c, 0x3d, 0x3e]
const AGUA_NO_FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x35, 0x3d, 0x3b] }
const UMIDO: MaterialDaPeca = { classe: 'liso', rgb: [0x2a, 0x28, 0x25] }
const JUNTA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [0x26, 0x24, 0x22] }
const SANGUE_VELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x2c, 0x27] }
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x56, 0x3d] }
/** A água suja do esgoto que subiu: parda esverdeada (a da poça de esgoto) e a beira dela que pega luz. */
const AGUA_SUJA: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x42, 0x3a] }
const BEIRA_DE_LUZ: MaterialDaPeca = { classe: 'liso', rgb: [0x80, 0x84, 0x6c] }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0x96, 0xa0, 0x94] }
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xa2, 0x9c, 0x82] }
const ESPUMA_SUJA: MaterialDaPeca = { classe: 'liso', rgb: [0x74, 0x6e, 0x58] }
const PALHA: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x86, 0x5a] }
const FOLHA: MaterialDaPeca = { classe: 'folha', rgb: [0x6e, 0x5a, 0x36] }

function lobos(lista: readonly (readonly [number, number, number, number])[], R: number, ex: number, ey: number, cresce: number): Forma {
  const [primeiro, ...resto] = lista.map(([x, y, rx, ry]) => elipse(x * R * ex, y * R * ey, rx * R * ex * cresce, ry * R * ey * cresce))
  return resto.reduce((soma, l) => uniao(soma, l), primeiro)
}

/** TRANSBORDANDO: a poça suja em volta, o ralo debaixo da lâmina de água e os furos borbulhando. */
const montarRaloTransbordando: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const grade = c.m.grade
  const L = cena.partes
  const R = Math.min(hw, hh)
  const ex = hw / R
  const ey = hh / R
  const s = LADO_DO_QUADRO * R
  const i = s - LARGURA_DO_QUADRO
  cena.corDoPiso = ESCURO_DO_BURACO

  // ---------- a pedra encharcada, o fio que foge pela esquerda e a poça ----------
  const poca = lobos(LOBOS_DA_POCA, R, ex, ey, 1)
  L.push(P(lobos(LOBOS_DA_POCA, R, ex, ey, 1.12), UMIDO, { bisel: 0, contorno: 0, alfa: 0.3, suave: 2, semente: 9501 }))
  const fio = cadeia(
    FIO.map(([x, y]): Ponto => [x * hw * 0.98, y * R * ey]),
    0.05 * R,
  )
  L.push(P(fio, BEIRA_DE_LUZ, { bisel: 0, contorno: 0, alfa: 0.36, suave: 0.4, semente: 9502 }))
  L.push(P(fio, AGUA_SUJA, { dy: -0.3, bisel: 0, contorno: 0, alfa: 0.72, suave: 0.4, semente: 9503 }))
  L.push(P(poca, BEIRA_DE_LUZ, { bisel: 0, contorno: 0, alfa: 0.42, suave: 0.6, semente: 9504 }))
  L.push(P(poca, AGUA_SUJA, { dy: -0.6, bisel: 0, contorno: 0.1, alfa: 0.72, suave: 0.8, semente: 9505 }))
  L.push(P(dentroDe(elipse(-0.34 * R * ex, -0.14 * R * ey, 0.4 * R * ex, 0.32 * R * ey), poca), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.12, suave: 1.6, semente: 9506 }))

  // ---------- o ralo debaixo da água: a junta, o buraco, a grade, o quadro e os parafusos (os de hoje) ----------
  const fora = caixa(-s, -s, s, s, 1.2)
  L.push(P(caixa(-s - JUNTA, -s - JUNTA, s + JUNTA, s + JUNTA, 1.2 + JUNTA), JUNTA_ESCURA, { bisel: 0, contorno: 0, alfa: 0.7, suave: 0.3, semente: 9508 }))
  const boca = caixa(-i, -i, i, i, 0.4)
  L.push(P(boca, BURACO_FUNDO, { bisel: 0, contorno: 0.2, recesso: { k: 2.4, forca: 0.5 }, semente: 9510 }))
  L.push(P(dentroDe(elipse(i * 0.12, i * 0.24, i * 0.72, i * 0.46), boca), AGUA_NO_FUNDO, { bisel: 0, contorno: 0, alfa: 0.86, suave: 1.4, semente: 9511 }))
  const furo = (2 * i - BARRAS * 2 * MEIA_BARRA) / (BARRAS + 1)
  const meios = Array.from({ length: BARRAS }, (_, b) => -i + furo + MEIA_BARRA + b * (furo + 2 * MEIA_BARRA))
  const barras: Forma[] = []
  for (const m of meios) {
    barras.push(caixa(m - MEIA_BARRA, -i - 0.4, m + MEIA_BARRA, i + 0.4, 0.25))
    barras.push(caixa(-i - 0.4, m - MEIA_BARRA, i + 0.4, m + MEIA_BARRA, 0.25))
  }
  const [primeira, ...outras] = barras
  const grelha = outras.reduce((soma, b) => uniao(soma, b), primeira)
  L.push(P(grelha, grade, { tabua: 0, bisel: 0.8, tom: TOM_DA_GRADE, contorno: 0.3, metal: 0.35, semente: 9520, projeta: { dist: 1.2, forca: 0.5, suave: 0.6 } }))
  const quadro = menos(fora, caixa(-i + 0.3, -i + 0.3, i - 0.3, i - 0.3, 0.4))
  L.push(P(quadro, grade, { tabua: 0, bisel: 1.1, tom: 0.86, contorno: 0.32, semente: 9540 }))
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const bx = sx * (s - LARGURA_DO_QUADRO / 2)
    const by = sy * (s - LARGURA_DO_QUADRO / 2)
    L.push(P(dentroDe(capsula(bx, by, bx + sx * 0.4, by + 2.2, 0.32), quadro), FERRUGEM, { bisel: 0, contorno: 0, alfa: 0.32, suave: 0.35, semente: 9543 }))
    L.push(P(elipse(bx, by, 1.15, 1.15), grade, { bisel: 0.7, contorno: 0.32, tom: 1.12, metal: 0.5, semente: 9541 }))
  }

  // ---------- a lâmina de água por cima do ralo e o reflexo atravessado ----------
  L.push(P(caixa(-s - 2.4, -s - 2.4, s + 2.4, s + 2.4, 3), AGUA_SUJA, { bisel: 0, contorno: 0, alfa: 0.36, suave: 1.6, semente: 9550 }))
  L.push(P(dentroDe(elipseGirada(-0.18 * R * ex, -0.3 * R * ey, 0.5 * R * ex, 0.035 * R, -0.08), poca), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.36, suave: 0.6, semente: 9551 }))
  L.push(P(dentroDe(elipseGirada(0.3 * R * ex, 0.62 * R * ey, 0.2 * R * ex, 0.025 * R, -0.05), poca), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.26, suave: 0.5, semente: 9552 }))

  // ---------- a água borbulhando nos furos: o anel de espuma e duas bolhinhas ----------
  const meioDoFuro = (k: number): number => -i + furo / 2 + k * (furo + 2 * MEIA_BARRA)
  FUROS_QUE_BORBULHAM.forEach(([cx, cy], k) => {
    const x = meioDoFuro(cx)
    const y = meioDoFuro(cy)
    const r = furo * (0.38 + 0.12 * hash(k, 1, 9560))
    L.push(P(anel(x, y, r, r * 0.9, r - 0.4, r * 0.9 - 0.4), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.72, semente: 9561 }))
    for (let j = 0; j < 2; j += 1) {
      const a = hash(k, j + 2, 9560) * Math.PI * 2
      L.push(P(elipse(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.3, 0.45, 0.42), ESPUMA, { bisel: 0, contorno: 0.1, alfa: 0.7, semente: 9562 }))
    }
  })

  // ---------- a espuma suja na beira de baixo da poça, o graveto de palha e a folha boiando ----------
  for (let k = 0; k < 14; k += 1) {
    const a = 0.35 + (k / 13) * 2.3 + (hash(k, 1, 9570) - 0.5) * 0.1
    const raio = 0.6 + hash(k, 2, 9570) * 0.7
    const x = Math.cos(a) * 0.8 * R * ex
    const y = 0.05 * R * ey + Math.sin(a) * 0.72 * R * ey
    L.push(P(dentroDe(elipse(x, y, raio * 1.2, raio), poca), ESPUMA_SUJA, { bisel: 0, contorno: 0, alfa: 0.78, semente: 9571 }))
    L.push(P(dentroDe(elipse(x - raio * 0.2, y - raio * 0.2, raio * 0.55, raio * 0.45), poca), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.62, semente: 9572 }))
  }
  L.push(P(capsula(-0.66 * R * ex, 0.12 * R * ey, -0.44 * R * ex, 0.3 * R * ey, 0.45), PALHA, { bisel: 0.3, contorno: 0.28, semente: 9573, projeta: { dist: 0.5, forca: 0.3 } }))
  L.push(P(elipseGirada(0.6 * R * ex, 0.18 * R * ey, 2.3, 1.1, 0.7), FOLHA, { bisel: 0.6, contorno: 0.26, tom: 0.95, semente: 9574, projeta: { dist: 0.6, forca: 0.32 } }))
}

export const versoesDoRaloDeMasmorra: VersoesDesenhadas = {
  transbordando: montarRaloTransbordando,
}
