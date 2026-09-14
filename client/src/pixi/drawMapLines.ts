import { Color, type Graphics } from 'pixi.js'
import { rasterizePixelLine, type PixelLineInput } from '../lib/pixelLine'

/**
 * Traços e marcadores estilo minimapa (etapa 2/3 do plano "chão por peças").
 * Traço = pixels acesos um a um (`lib/pixelLine.ts`), nunca `stroke()` do
 * Pixi: o stroke antisserrilha e espalha a linha de 1 px por 2–3 pixels,
 * que é exatamente a diferença que a comparação com a referência acusaria.
 */

export interface MapLineShape extends PixelLineInput {
  color: string
}

export interface MapMarkerShape {
  cx: number
  cy: number
  w: number
  h: number
  /** Graus, sentido horário. */
  rotation: number
  color: string
  shape?: 'rect' | 'ellipse'
}

export function drawMapLines(graphics: Graphics, lines: MapLineShape[]): void {
  for (const line of lines) {
    const color = new Color(line.color).toNumber()
    const pixels = rasterizePixelLine(line)
    if (pixels.length === 0) continue
    for (const p of pixels) graphics.rect(p.x, p.y, 1, 1)
    graphics.fill({ color })
  }
}

/** Cantos do retângulo girado, no sentido horário. */
export function markerCorners(marker: MapMarkerShape): number[] {
  const rad = (marker.rotation * Math.PI) / 180
  const ux = Math.cos(rad)
  const uy = Math.sin(rad)
  const hw = marker.w / 2
  const hh = marker.h / 2
  const corner = (su: number, sv: number) => [marker.cx + su * hw * ux - sv * hh * uy, marker.cy + su * hw * uy + sv * hh * ux]
  return [...corner(-1, -1), ...corner(1, -1), ...corner(1, 1), ...corner(-1, 1)]
}

const ELLIPSE_SEGMENTS = 32

/** Contorno da elipse girada como polígono (o `ellipse()` do Pixi não gira sozinho). */
export function markerEllipsePoints(marker: MapMarkerShape): number[] {
  const rad = (marker.rotation * Math.PI) / 180
  const ux = Math.cos(rad)
  const uy = Math.sin(rad)
  const out: number[] = []
  for (let i = 0; i < ELLIPSE_SEGMENTS; i += 1) {
    const t = (i / ELLIPSE_SEGMENTS) * Math.PI * 2
    const u = (Math.cos(t) * marker.w) / 2
    const v = (Math.sin(t) * marker.h) / 2
    out.push(marker.cx + u * ux - v * uy, marker.cy + u * uy + v * ux)
  }
  return out
}

export function drawMapMarkers(graphics: Graphics, markers: MapMarkerShape[]): void {
  for (const marker of markers) {
    const points = marker.shape === 'ellipse' ? markerEllipsePoints(marker) : markerCorners(marker)
    graphics.poly(points, true).fill({ color: new Color(marker.color).toNumber() })
  }
}
