import type { FloorPiece, MapLine, MapMarker } from '../types/map'
import { isMinimapFloorPixel, minimapCoverage, traceFloorPieces, type TraceRect } from './traceImage'
import { traceDottedLines } from './traceDotted'
import { refineFloorPieces } from './refineFloor'
import { grayStrokeWeight } from './refineLines'
import { traceMapDetails } from './traceDetails'
import { darkGreenBlobs, darkStrokeMask, paintOver, traceDarkLines } from './traceDark'

/**
 * Vetorização completa de uma imagem de minimapa, na ordem que evita um
 * detalhe contaminar o outro:
 * 1. traços pretos finos e manchas verde-escuras viram linha/marcador e são
 *    pintados de verde numa cópia da imagem;
 * 2. o chão é vetorizado da cópia (sem os detalhes escuros virarem buraco);
 * 3. linhas cinzas e portas laranjas saem da cópia também.
 * Usado pelo harness de recriação e pensado para o botão do painel.
 */

export interface MinimapTraceOptions {
  rect: TraceRect
  /** Contorno do chão subpixel pela cobertura do antisserrilhado. */
  coverage: boolean
  /** Linhas e portas ajustadas ao antisserrilhado. */
  subpixel: boolean
  lineDetection: 'gray' | 'weight'
  /** Raio de exclusão do traço cinza colado no fundo (é o contorno do chão). */
  borderRadius: number
  lineColor?: string
  /** Detalhes escuros (escada, glifos, poço). */
  dark: boolean
  /** Pontilhado antisserrilhado com período e ponto medidos (lib/traceDotted.ts). */
  dotted?: boolean
  /** Contorno do chão ajustado ao centro do traço cinza (lib/refineFloor.ts): peças saem com a borda verdadeira. */
  refineFloor?: boolean
  /** Afina a máscara das linhas cinzas para 1 px antes de vetorizar. */
  thinLines?: boolean
}

export interface MinimapTrace {
  /** Peças do chão SEM recuo: a borda está na face externa do traço de contorno. */
  basePieces: FloorPiece[]
  lines: MapLine[]
  markers: MapMarker[]
}

export type MinimapIdKind = 'floor' | 'line' | 'marker' | 'dark' | 'blob' | 'dotted'

const DEFAULT_LINE_COLOR = '#858585'

const FLOOR_GREEN: [number, number, number] = [0, 107, 0]
/** Folga pintada em volta do detalhe escuro: cobre a borda antisserrilhada dele. */
const PAINT_DILATE = 1

export function traceMinimapImage(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  options: MinimapTraceOptions,
  makeId: (kind: MinimapIdKind, index: number) => string,
): MinimapTrace {
  const { rect } = options
  let source: ArrayLike<number> = pixels
  let darkLines: MapLine[] = []
  let blobMarkers: MapMarker[] = []
  if (options.dark) {
    const strokeMask = darkStrokeMask(pixels, width, height, rect)
    const blobs = darkGreenBlobs(pixels, width, height, rect, (i) => makeId('blob', i))
    const union = new Uint8Array(width * height)
    for (let i = 0; i < union.length; i += 1) union[i] = strokeMask[i] | blobs.mask[i]
    source = paintOver(pixels, width, height, union, FLOOR_GREEN, PAINT_DILATE)
    darkLines = traceDarkLines(pixels, width, height, strokeMask, rect, (i) => makeId('dark', i))
    blobMarkers = blobs.markers
  }

  const tracedPieces = traceFloorPieces(
    source,
    width,
    height,
    { rect, coverage: options.coverage ? minimapCoverage : undefined },
    (i) => makeId('floor', i),
  )
  const basePieces = options.refineFloor ? refineFloorPieces(tracedPieces, source, width, height) : tracedPieces
  const details = traceMapDetails(
    source,
    width,
    height,
    {
      rect,
      borderRadius: options.borderRadius,
      subpixel: options.subpixel,
      lineDetection: options.lineDetection,
      lineColor: options.lineColor,
      thinLines: options.thinLines,
    },
    (kind, i) => makeId(kind, i),
  )
  const dottedLines = options.dotted
    ? traceDottedLines(
        source,
        width,
        height,
        {
          rect,
          weight: grayStrokeWeight,
          isBackground: (r, g, b, a) => (isMinimapFloorPixel(r, g, b, a) ? 0 : 1),
          backgroundRadius: Math.max(1, options.borderRadius),
          color: options.lineColor ?? DEFAULT_LINE_COLOR,
        },
        (i) => makeId('dotted', i),
      )
    : []
  return {
    basePieces,
    lines: [...details.lines, ...darkLines, ...dottedLines],
    markers: [...details.markers, ...blobMarkers],
  }
}
