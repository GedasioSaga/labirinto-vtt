import type { FloorPiece, MapLine, MapMarker } from '../types/map'
import { compileFloor } from './floorSdf'
import { extractFloorRings } from './floorContour'
import { rasterizeMinimap, type MinimapRasterStyle } from './minimapRaster'
import { maskTopology } from './maskTopology'

/**
 * Calibra largura e recuo do contorno do chão renderizando: para cada
 * candidato, rasteriza janelas pequenas ao longo da borda e mede quantos
 * pixels batem com a imagem de referência. A medida direta
 * (`estimateStroke.ts`, tinta ÷ perímetro) subestima quando o contorno
 * vetorizado é serrilhado (perímetro inflado); comparar o render com a
 * própria imagem de entrada não tem esse viés.
 *
 * `basePieces` são as peças vetorizadas SEM recuo (borda na face externa do
 * traço); o recuo de cada candidato vira `modifiers.grow`.
 */

export interface CalibrationWindow {
  x: number
  y: number
  w: number
  h: number
}

export interface StrokeCalibration {
  strokeWidth: number
  inset: number
  strokeAlpha: number
  /** Fração dos pixels com tinta, nas janelas, com cor dentro da tolerância. */
  score: number
  candidates: number
  /** Todos os candidatos avaliados, do melhor para o pior (para escolher por outro critério, como topologia). */
  ranked: { strokeWidth: number; inset: number; strokeAlpha: number; score: number }[]
}

export interface CalibrateOptions {
  reference: ArrayLike<number>
  width: number
  height: number
  /** Área útil (sem moldura): janelas nunca saem dela. */
  rect: CalibrationWindow
  basePieces: FloorPiece[]
  lines: MapLine[]
  markers: MapMarker[]
  /** Estilo sem `strokeWidth` (vem de cada candidato). */
  style: Omit<MinimapRasterStyle, 'strokeWidth'>
  windowSize?: number
  windowCount?: number
  /**
   * Recuo em torno do qual a busca varia, para cada largura. Padrão = metade
   * dela (peças na face externa do traço); com o contorno já no centro do
   * traço (lib/refineFloor.ts) o certo é 0.
   */
  insetCenter?: (strokeWidth: number) => number
  /**
   * 'match' = fração de pixels dentro da tolerância de cor. 'error' = menor erro
   * absoluto médio — enxerga o viés que a contagem ignora (medido: borda do
   * mapa1/mapa2 escura demais, do Mapa3 clara demais, com a mesma contagem).
   */
  metric?: 'match' | 'error'
  /** Opacidades do traço a testar depois de largura e recuo. Vazio = mantém a do estilo. */
  alphas?: number[]
}

const DEFAULT_WINDOW = 64
const DEFAULT_WINDOW_COUNT = 12
const COLOR_TOLERANCE = 60
const INK_MIN_SUM = 40
const WIDTHS = Array.from({ length: 16 }, (_, i) => 0.5 + i * 0.1)
const INSET_DELTAS = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]
const FINE_WIDTH_STEP = 0.05
/** Alcance (px) da segunda passada de largura depois de escolher a opacidade. */
const REFINE_WIDTH_SPAN = 0.3

const LINE_WIDTHS = Array.from({ length: 15 }, (_, i) => 0.6 + i * 0.1)

/** Linha que a calibração de estilo ajusta: contínua e não preta (as cinzas de contorno de prédio). */
export function isCalibratableLine(line: MapLine): boolean {
  return !line.dotted && line.color.toLowerCase() !== '#000000'
}

/** Janelas centradas em pontos espaçados ao longo das linhas calibráveis. */
export function lineWindows(lines: MapLine[], rect: CalibrationWindow, size: number, count: number): CalibrationWindow[] {
  const points = lines.filter(isCalibratableLine).flatMap((line) => line.points)
  if (points.length === 0) return []
  const stride = Math.max(1, Math.floor(points.length / count))
  const windows: CalibrationWindow[] = []
  for (let k = 0; k < count && k * stride < points.length; k += 1) {
    const p = points[k * stride]
    const w = Math.min(size, rect.w)
    const h = Math.min(size, rect.h)
    windows.push({
      x: Math.max(rect.x, Math.min(rect.x + rect.w - w, Math.round(p.x - w / 2))),
      y: Math.max(rect.y, Math.min(rect.y + rect.h - h, Math.round(p.y - h / 2))),
      w,
      h,
    })
  }
  return windows
}

export interface LineStyleCalibration {
  lineWidth: number
  /** `null` = mantém a cor vetorizada de cada linha. */
  lineColor: string | null
  score: number
}

/**
 * Calibra largura (e, opcionalmente, cor única) das linhas cinzas contínuas
 * renderizando janelas ao longo delas contra a referência — mesma ideia de
 * `calibrateStroke`, com o chão e o contorno já fixos.
 */
export function calibrateLineStyle(
  options: Pick<CalibrateOptions, 'reference' | 'width' | 'rect' | 'lines' | 'markers' | 'windowSize' | 'windowCount'> & {
    floorPieces: FloorPiece[]
    style: MinimapRasterStyle
    colors?: (string | null)[]
  },
): LineStyleCalibration | null {
  const windows = lineWindows(options.lines, options.rect, options.windowSize ?? DEFAULT_WINDOW, options.windowCount ?? DEFAULT_WINDOW_COUNT)
  if (windows.length === 0) return null
  const floor = compileFloor(options.floorPieces)
  let best: LineStyleCalibration | null = null
  for (const color of options.colors ?? [null]) {
    for (const lineWidth of LINE_WIDTHS) {
      const lines = options.lines.map((line) => (isCalibratableLine(line) ? { ...line, width: lineWidth, color: color ?? line.color } : line))
      let ink = 0
      let matches = 0
      for (const window of windows) {
        const raster = rasterizeMinimap(
          { originX: window.x, originY: window.y, width: window.w, height: window.h, floor, lines, markers: options.markers },
          options.style,
        )
        const s = scoreWindow(options.reference, options.width, raster, window)
        ink += s.ink
        matches += s.matches
      }
      const score = ink === 0 ? 0 : matches / ink
      if (!best || score > best.score) best = { lineWidth, lineColor: color, score }
    }
  }
  return best
}

/** Quantos candidatos, em ordem de nota, a proteção de topologia rasteriza no máximo. */
const TOPOLOGY_CANDIDATES = 10

/**
 * Proteção de topologia: entre os candidatos da calibração (melhor nota
 * primeiro), devolve o primeiro cujo render da área útil tem as mesmas ilhas
 * e buracos da referência. A nota de cor sozinha às vezes prefere um recuo
 * que funde dois buracos (mapa2) ou fecha uma fresta (mapa1). Sem nenhum que
 * bata, devolve o melhor por nota, com `matched: false`.
 */
export function pickTopologyCandidate(
  calibration: StrokeCalibration,
  options: Pick<CalibrateOptions, 'reference' | 'width' | 'rect' | 'basePieces' | 'lines' | 'markers' | 'style'>,
): { candidate: StrokeCalibration['ranked'][number]; matched: boolean } {
  const { rect } = options
  const target = maskTopology(options.reference, options.width, rect)
  const tried = new Set<string>()
  for (const candidate of calibration.ranked.slice(0, TOPOLOGY_CANDIDATES)) {
    const key = `${candidate.strokeWidth.toFixed(3)}:${candidate.inset.toFixed(3)}:${candidate.strokeAlpha}`
    if (tried.has(key)) continue
    tried.add(key)
    const raster = rasterizeMinimap(
      {
        originX: rect.x,
        originY: rect.y,
        width: rect.w,
        height: rect.h,
        floor: compileFloor(insetPieces(options.basePieces, candidate.inset)),
        lines: options.lines,
        markers: options.markers,
      },
      { ...options.style, strokeWidth: candidate.strokeWidth, strokeAlpha: candidate.strokeAlpha },
    )
    const topology = maskTopology(raster, rect.w, { x: 0, y: 0, w: rect.w, h: rect.h })
    if (topology.islands === target.islands && topology.holes === target.holes) return { candidate, matched: true }
  }
  return { candidate: calibration, matched: false }
}

/** Peças com o recuo aplicado; a forma continua a mesma referência (o índice espacial por forma é reaproveitado). */
export function insetPieces(pieces: FloorPiece[], inset: number): FloorPiece[] {
  return pieces.map((piece) => ({
    ...piece,
    modifiers: { ...piece.modifiers, grow: (piece.modifiers.grow ?? 0) + (piece.op === 'add' ? -inset : inset) },
  }))
}

/** Janelas centradas em pontos espaçados ao longo de toda a borda do chão. */
export function borderWindows(pieces: FloorPiece[], rect: CalibrationWindow, size: number, count: number): CalibrationWindow[] {
  const points = extractFloorRings(pieces, { step: 1 }).flat()
  if (points.length === 0) return []
  const windows: CalibrationWindow[] = []
  const stride = Math.max(1, Math.floor(points.length / count))
  for (let k = 0; k < count && k * stride < points.length; k += 1) {
    const p = points[k * stride]
    const w = Math.min(size, rect.w)
    const h = Math.min(size, rect.h)
    const x = Math.max(rect.x, Math.min(rect.x + rect.w - w, Math.round(p.x - w / 2)))
    const y = Math.max(rect.y, Math.min(rect.y + rect.h - h, Math.round(p.y - h / 2)))
    windows.push({ x, y, w, h })
  }
  return windows
}

/** Fração de pixels com tinta (em qualquer das duas) cuja cor bate dentro da tolerância. */
export function scoreWindow(reference: ArrayLike<number>, width: number, raster: Uint8ClampedArray, window: CalibrationWindow): { ink: number; matches: number; error: number } {
  let ink = 0
  let matches = 0
  let error = 0
  for (let y = 0; y < window.h; y += 1) {
    for (let x = 0; x < window.w; x += 1) {
      const r = ((window.y + y) * width + window.x + x) * 4
      const a = (y * window.w + x) * 4
      const refSum = reference[r] + reference[r + 1] + reference[r + 2]
      const rasSum = raster[a] + raster[a + 1] + raster[a + 2]
      if (refSum < INK_MIN_SUM && rasSum < INK_MIN_SUM) continue
      ink += 1
      const d = Math.abs(reference[r] - raster[a]) + Math.abs(reference[r + 1] - raster[a + 1]) + Math.abs(reference[r + 2] - raster[a + 2])
      if (d <= COLOR_TOLERANCE) matches += 1
      error += d
    }
  }
  return { ink, matches, error }
}

export function calibrateStroke(options: CalibrateOptions): StrokeCalibration | null {
  const windows = borderWindows(options.basePieces, options.rect, options.windowSize ?? DEFAULT_WINDOW, options.windowCount ?? DEFAULT_WINDOW_COUNT)
  if (windows.length === 0) return null
  let candidates = 0

  const metric = options.metric ?? 'match'
  /** Maior = melhor nas duas métricas (erro entra negativo, por pixel com tinta). */
  const evaluate = (strokeWidth: number, inset: number, strokeAlpha: number): number => {
    candidates += 1
    const floor = compileFloor(insetPieces(options.basePieces, inset))
    let ink = 0
    let matches = 0
    let error = 0
    for (const window of windows) {
      const raster = rasterizeMinimap(
        { originX: window.x, originY: window.y, width: window.w, height: window.h, floor, lines: options.lines, markers: options.markers },
        { ...options.style, strokeWidth, strokeAlpha },
      )
      const s = scoreWindow(options.reference, options.width, raster, window)
      ink += s.ink
      matches += s.matches
      error += s.error
    }
    if (ink === 0) return metric === 'match' ? 0 : -Infinity
    return metric === 'match' ? matches / ink : -error / ink
  }

  // Descida por coordenada: largura com o recuo central, depois o recuo, a largura fina e a opacidade.
  const center = options.insetCenter ?? ((w: number) => w / 2)
  const baseAlpha = options.style.strokeAlpha
  let best = { strokeWidth: WIDTHS[0], inset: center(WIDTHS[0]), strokeAlpha: baseAlpha, score: -Infinity }
  const evaluated: StrokeCalibration['ranked'] = []
  const consider = (strokeWidth: number, inset: number, strokeAlpha: number) => {
    // Recuo negativo (engordar) só faz sentido quando o centro da busca é o próprio traço.
    if (strokeWidth <= 0 || (inset < 0 && !options.insetCenter)) return
    const score = evaluate(strokeWidth, inset, strokeAlpha)
    evaluated.push({ strokeWidth, inset, strokeAlpha, score })
    if (score > best.score) best = { strokeWidth, inset, strokeAlpha, score }
  }
  for (const w of WIDTHS) consider(w, center(w), baseAlpha)
  const widthAfterFirst = best.strokeWidth
  for (const delta of INSET_DELTAS) if (delta !== 0) consider(widthAfterFirst, center(widthAfterFirst) + delta, baseAlpha)
  const insetAfterSecond = best.inset
  for (const delta of [-FINE_WIDTH_STEP, FINE_WIDTH_STEP]) consider(best.strokeWidth + delta, insetAfterSecond, baseAlpha)
  if (options.alphas && options.alphas.length > 0) {
    for (const alpha of options.alphas) if (alpha !== baseAlpha) consider(best.strokeWidth, best.inset, alpha)
    // Largura e opacidade se compensam (traço mais largo e mais transparente deposita a mesma tinta):
    // com a opacidade escolhida, refaz a largura em volta da atual mantendo o desvio do recuo.
    const insetOffset = best.inset - center(best.strokeWidth)
    const around = best.strokeWidth
    for (let dw = -REFINE_WIDTH_SPAN; dw <= REFINE_WIDTH_SPAN + 1e-9; dw += FINE_WIDTH_STEP) {
      if (Math.abs(dw) < 1e-9) continue
      consider(around + dw, center(around + dw) + insetOffset, best.strokeAlpha)
    }
  }
  const ranked = [...evaluated].sort((a, b) => b.score - a.score)
  return { ...best, candidates, ranked }
}
