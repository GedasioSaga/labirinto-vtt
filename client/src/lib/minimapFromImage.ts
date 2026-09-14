import type { FloorPiece, MapLine, MapMarker } from '../types/map'
import type { TraceRect } from './traceImage'
import { traceMinimapImage } from './traceMinimap'
import { estimateLineWidth } from './estimateStroke'
import { calibrateStroke, insetPieces, pickTopologyCandidate } from './calibrateMinimap'
import { hexToRgb, type Rgb } from './minimapRaster'

/**
 * Pipeline completo "minimapa a partir de imagem": vetoriza chão, linhas,
 * portas, pontilhado e detalhes escuros (`traceMinimap.ts`), mede a largura
 * das linhas e calibra largura/recuo do contorno renderizando contra a
 * própria imagem. Com `lineDetection: 'auto'` vetoriza das duas formas e
 * fica com a de maior nota de calibração. É o mesmo código do botão do
 * painel e do harness de recriação.
 */

export type LineDetection = 'gray' | 'weight'

export interface MinimapImageOptions {
  rect: TraceRect
  floorColor: string
  strokeColor: string
  strokeAlpha: number
  lineAlpha: number
  lineDetection: LineDetection | 'auto'
  dark: boolean
  dotted: boolean
}

export interface MinimapImageResult {
  /** Peças com o recuo calibrado já aplicado. */
  pieces: FloorPiece[]
  lines: MapLine[]
  markers: MapMarker[]
  strokeWidth: number
  lineWidth: number
  inset: number
  calibrationScore: number | null
  lineDetection: LineDetection
}

/** Valores medidos nos mapas de referência (traço #858585 com alfa 0,955, chão #006b00). */
export const MINIMAP_IMAGE_DEFAULTS: Omit<MinimapImageOptions, 'rect'> = {
  floorColor: '#006b00',
  strokeColor: '#858585',
  strokeAlpha: 0.955,
  lineAlpha: 0.955,
  lineDetection: 'auto',
  dark: true,
  dotted: true,
}

const BORDER_RADIUS = 2
const RASTER_SAMPLES = 4
const FALLBACK_STROKE_WIDTH = 1
const FALLBACK_LINE_WIDTH = 1

export type MinimapIdKind = 'floor' | 'line' | 'marker' | 'dark' | 'blob' | 'dotted'

function buildWith(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  options: MinimapImageOptions,
  detection: LineDetection,
  makeId: (kind: MinimapIdKind, index: number) => string,
): MinimapImageResult {
  const trace = traceMinimapImage(
    pixels,
    width,
    height,
    {
      rect: options.rect,
      coverage: true,
      subpixel: true,
      lineDetection: detection,
      borderRadius: BORDER_RADIUS,
      lineColor: detection === 'weight' ? options.strokeColor : undefined,
      dark: options.dark,
      dotted: options.dotted,
    },
    makeId,
  )
  // Traço escuro e pontilhado saem com largura própria; só as linhas cinzas recebem a largura medida.
  const ownWidth = new Set([...trace.lines.filter((l) => l.dotted || l.color === '#000000').map((l) => l.id)])
  const grayLines = trace.lines.filter((l) => !ownWidth.has(l.id))
  const lineWidth = estimateLineWidth(pixels, width, height, grayLines) ?? FALLBACK_LINE_WIDTH
  const lines = trace.lines.map((line) => (ownWidth.has(line.id) ? line : { ...line, width: lineWidth }))

  const stroke: Rgb = hexToRgb(options.strokeColor)
  const style = {
    background: [0, 0, 0] as Rgb,
    floor: hexToRgb(options.floorColor),
    stroke,
    strokeAlpha: options.strokeAlpha,
    lineAlpha: options.lineAlpha,
    samples: RASTER_SAMPLES,
    // Borda do chão por área exata: a quantização de 16 subamostras consumia a tolerância de cor.
    pattern: 'analytic' as const,
  }
  const calibrationInput = { reference: pixels, width, height, rect: options.rect, basePieces: trace.basePieces, lines, markers: trace.markers, style }
  const calibrated = calibrateStroke(calibrationInput)
  // Proteção de topologia: melhor candidato que mantém ilhas e buracos da imagem.
  const picked = calibrated ? pickTopologyCandidate(calibrated, calibrationInput).candidate : null
  const strokeWidth = picked?.strokeWidth ?? FALLBACK_STROKE_WIDTH
  const inset = picked?.inset ?? strokeWidth / 2
  return {
    pieces: insetPieces(trace.basePieces, inset),
    lines,
    markers: trace.markers,
    strokeWidth,
    lineWidth,
    inset,
    calibrationScore: picked?.score ?? null,
    lineDetection: detection,
  }
}

export function buildMinimapFromImage(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  options: MinimapImageOptions,
  makeId: (kind: MinimapIdKind, index: number) => string,
): MinimapImageResult {
  const detections: LineDetection[] = options.lineDetection === 'auto' ? ['gray', 'weight'] : [options.lineDetection]
  let best: MinimapImageResult | null = null
  for (const detection of detections) {
    const result = buildWith(pixels, width, height, options, detection, makeId)
    if (!best || (result.calibrationScore ?? -1) > (best.calibrationScore ?? -1)) best = result
  }
  return best as MinimapImageResult
}
