import type { Prop } from '../types/map'

export function findPropAt(props: Prop[], point: { x: number; y: number }): Prop | null {
  for (let i = props.length - 1; i >= 0; i -= 1) {
    const prop = props[i]
    const halfWidth = prop.width / 2
    const halfHeight = prop.height / 2
    const withinX = point.x >= prop.x - halfWidth && point.x <= prop.x + halfWidth
    const withinY = point.y >= prop.y - halfHeight && point.y <= prop.y + halfHeight
    if (withinX && withinY) {
      return prop
    }
  }
  return null
}
