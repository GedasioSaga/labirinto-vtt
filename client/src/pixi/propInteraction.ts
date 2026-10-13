import type { Prop } from '../types/map'
import { contornoDaCercaCurva } from '../lib/cercaCurva'
import { pointInPolygonInclusive } from '../lib/roomNesting'

export function findPropAt(props: Prop[], point: { x: number; y: number }): Prop | null {
  for (let i = props.length - 1; i >= 0; i -= 1) {
    const prop = props[i]
    // CERCA CURVA: o clique pega a faixa dobrada no arco, não o retângulo reto (`lib/cercaCurva.ts`).
    const curva = contornoDaCercaCurva(prop)
    if (curva !== null) {
      if (pointInPolygonInclusive(point, curva)) return prop
      continue
    }
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
