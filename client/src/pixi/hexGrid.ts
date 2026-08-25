import type { Point } from './world'
import type { Viewport } from './grid'

export interface AxialCoord {
  q: number
  r: number
}

export function axialToPixel(coord: AxialCoord, size: number): Point {
  return {
    x: size * Math.sqrt(3) * (coord.q + coord.r / 2),
    y: size * 1.5 * coord.r,
  }
}

export function roundAxial(coord: AxialCoord): AxialCoord {
  const x = coord.q
  const z = coord.r
  const y = -x - z

  let rx = Math.round(x)
  let ry = Math.round(y)
  let rz = Math.round(z)

  const xDiff = Math.abs(rx - x)
  const yDiff = Math.abs(ry - y)
  const zDiff = Math.abs(rz - z)

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz
  } else if (yDiff > zDiff) {
    ry = -rx - rz
  } else {
    rz = -rx - ry
  }

  return { q: rx, r: rz }
}

export function pixelToAxial(point: Point, size: number): AxialCoord {
  const q = ((Math.sqrt(3) / 3) * point.x - (1 / 3) * point.y) / size
  const r = ((2 / 3) * point.y) / size
  return roundAxial({ q, r })
}

export function hexCorners(center: Point, size: number): Point[] {
  const corners: Point[] = []
  for (let i = 0; i < 6; i += 1) {
    const angleDeg = 60 * i - 30
    const angleRad = (Math.PI / 180) * angleDeg
    corners.push({
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    })
  }
  return corners
}

export function snapToHexGrid(x: number, y: number, size: number): Point {
  if (size <= 0) return { x, y }
  const axial = pixelToAxial({ x, y }, size)
  return axialToPixel(axial, size)
}

export function computeVisibleHexCenters(size: number, viewport: Viewport): Point[] {
  if (size <= 0) return []

  const corners = [
    { x: viewport.left, y: viewport.top },
    { x: viewport.right, y: viewport.top },
    { x: viewport.left, y: viewport.bottom },
    { x: viewport.right, y: viewport.bottom },
  ]
  const axials = corners.map((c) => ({
    q: ((Math.sqrt(3) / 3) * c.x - (1 / 3) * c.y) / size,
    r: ((2 / 3) * c.y) / size,
  }))

  const qMin = Math.floor(Math.min(...axials.map((a) => a.q))) - 1
  const qMax = Math.ceil(Math.max(...axials.map((a) => a.q))) + 1
  const rMin = Math.floor(Math.min(...axials.map((a) => a.r))) - 1
  const rMax = Math.ceil(Math.max(...axials.map((a) => a.r))) + 1

  const centers: Point[] = []
  for (let r = rMin; r <= rMax; r += 1) {
    for (let q = qMin; q <= qMax; q += 1) {
      centers.push(axialToPixel({ q, r }, size))
    }
  }
  return centers
}
