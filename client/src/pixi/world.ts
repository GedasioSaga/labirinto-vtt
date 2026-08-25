export interface Camera {
  x: number
  y: number
  scale: number
}

export interface Point {
  x: number
  y: number
}

export const MIN_SCALE = 0.1
export const MAX_SCALE = 4

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

export function zoomAt(camera: Camera, pointer: Point, wheelDeltaY: number): Camera {
  const zoomFactor = Math.exp(-wheelDeltaY * 0.001)
  const newScale = clampScale(camera.scale * zoomFactor)

  const worldX = (pointer.x - camera.x) / camera.scale
  const worldY = (pointer.y - camera.y) / camera.scale

  return {
    scale: newScale,
    x: pointer.x - worldX * newScale,
    y: pointer.y - worldY * newScale,
  }
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy }
}
