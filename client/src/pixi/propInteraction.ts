import type { Prop } from '../types/map'
import { contornoDaCercaCurva } from '../lib/cercaCurva'
import { ehMovelDoChao } from '../lib/mobilia'
import { pointInPolygonInclusive } from '../lib/roomNesting'

/**
 * O objeto sob o ponto, de trás para a frente (o último da lista está por
 * cima). O TAPETE fica no chão, por baixo de todo objeto (`emOrdemDeDesenho`):
 * o clique procura primeiro no resto e só depois nos tapetes — a cadeira em
 * cima do tapete é a cadeira.
 */
export function findPropAt(props: Prop[], point: { x: number; y: number }): Prop | null {
  // O tapete longo (MT5) também mora no chão (`ehMovelDoChao`).
  return findTopmostAt(props, point, (prop) => !ehMovelDoChao(prop.mobilia)) ?? findTopmostAt(props, point, (prop) => ehMovelDoChao(prop.mobilia))
}

function findTopmostAt(props: Prop[], point: { x: number; y: number }, accepts: (prop: Prop) => boolean): Prop | null {
  for (let i = props.length - 1; i >= 0; i -= 1) {
    const prop = props[i]
    if (!accepts(prop)) continue
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
