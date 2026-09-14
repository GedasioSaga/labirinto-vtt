import type { MapLine, MapMarker } from '../types/map'
import { isMinimapFloorPixel, type TraceRect } from './traceImage'
import { traceLines } from './traceLines'
import { traceMarkers } from './traceMarkers'
import { grayStrokeWeight, refineLine } from './refineLines'
import { orangeMarkerWeight, refineMarker } from './refineMarkers'

/**
 * Ferramenta "Linhas e portas a partir da imagem": vetoriza traços cinzas
 * (`traceLines`) e portas laranjas (`traceMarkers`) de uma imagem de
 * referência em entidades do mapa. Traço colado no fundo é ignorado — é o
 * contorno do próprio chão, que o render do chão desenha.
 */
export interface TraceDetailsOptions {
  rect?: TraceRect
  /** Raio (px) de exclusão do traço colado no fundo; 0 mantém tudo. */
  borderRadius?: number
  /** Ajusta vértices de linha e portas ao antisserrilhado da imagem (refineLines.ts / refineMarkers.ts). */
  subpixel?: boolean
  /** Espessura das linhas criadas, em px. Os mapas de referência medem ~1,5 (soma da cobertura através do traço). */
  lineWidth?: number
  /**
   * 'gray' = pixel cinza neutro (traço sem antisserrilhado). 'weight' = pixel
   * com intensidade de traço ≥ `LINE_WEIGHT_THRESHOLD` — pega também o ponto
   * de pontilhado misturado com o verde (#457f45), que não é cinza neutro.
   */
  lineDetection?: 'gray' | 'weight'
  /**
   * Cor fixa das linhas criadas. Sem ela a cor é a média dos pixels do traço —
   * com detecção por peso essa média inclui os pixels misturados com o verde
   * e sai escura demais.
   */
  lineColor?: string
  /** Afina a máscara de linha para 1 px antes de vetorizar (útil com detecção por peso). */
  thinLines?: boolean
}

const DEFAULT_BORDER_RADIUS = 2
const DEFAULT_LINE_WIDTH = 1
/** Acima disso o pixel é o miolo do traço; as bordas antisserrilhadas (~0,1–0,4) ficam para o ajuste subpixel. */
const LINE_WEIGHT_THRESHOLD = 0.45

export function traceMapDetails(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  options: TraceDetailsOptions,
  makeId: (kind: 'line' | 'marker', index: number) => string,
): { lines: MapLine[]; markers: MapMarker[] } {
  const radius = options.borderRadius ?? DEFAULT_BORDER_RADIUS
  const isBackground = (r: number, g: number, b: number, a: number) => !isMinimapFloorPixel(r, g, b, a)
  const traced = traceLines(pixels, width, height, {
    rect: options.rect,
    excludeNearBackground: radius > 0 ? { radius, isBackground } : undefined,
    isLine: options.lineDetection === 'weight' ? (r, g, b, a) => grayStrokeWeight(r, g, b, a) >= LINE_WEIGHT_THRESHOLD : undefined,
    thin: options.thinLines,
  })
  const lineWidth = options.lineWidth ?? DEFAULT_LINE_WIDTH
  return {
    lines: traced.map((line, index) => ({
      id: makeId('line', index),
      points: options.subpixel ? refineLine(line, pixels, width, height, { weight: grayStrokeWeight }) : line.points,
      closed: line.closed,
      dotted: line.dotted,
      color: options.lineColor ?? line.color,
      width: lineWidth,
    })),
    markers: traceMarkers(pixels, width, height, { rect: options.rect })
      .map((marker) => (options.subpixel ? refineMarker(marker, pixels, width, height, { weight: orangeMarkerWeight }) : marker))
      .map((marker, index) => ({
        id: makeId('marker', index),
        cx: marker.cx,
        cy: marker.cy,
        w: marker.w,
        h: marker.h,
        rotation: marker.rotation,
        color: marker.color,
      })),
  }
}
