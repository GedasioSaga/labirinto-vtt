import type { Prop } from '../types/map'
import { contornoDaCercaCurva } from '../lib/cercaCurva'
import { ehMovelDeCimaDaMesa, ehMovelDoChao } from '../lib/mobilia'
import { pointInPolygonInclusive } from '../lib/roomNesting'
import { rotatePointAround, rotationTrig } from '../lib/roomRotation'

/**
 * O objeto sob o ponto, de trás para a frente (o último da lista está por
 * cima). O TAPETE fica no chão, por baixo de todo objeto (`emOrdemDeDesenho`):
 * o clique procura primeiro no resto e só depois nos tapetes — a cadeira em
 * cima do tapete é a cadeira.
 */
export function findPropAt(props: Prop[], point: { x: number; y: number }): Prop | null {
  // O tapete longo (MT5) também mora no chão (`ehMovelDoChao`).
  // A mesa posta (os Pratos) é desenhada por cima da mesa: o clique pega ela primeiro (`ehMovelDeCimaDaMesa`).
  return (
    findTopmostAt(props, point, (prop) => ehMovelDeCimaDaMesa(prop.mobilia)) ??
    findTopmostAt(props, point, (prop) => !ehMovelDoChao(prop.mobilia)) ??
    findTopmostAt(props, point, (prop) => ehMovelDoChao(prop.mobilia))
  )
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
    // OBJETO GIRADO: o ponto volta para o referencial do objeto (o giro ao contrário em volta do
    // centro, onde a tela gira a imagem). Sem isso a sebe, o arco ou o tapete longo girados 90° só
    // respondiam onde a caixa SEM giro cruzava o desenho. Sem giro, o ponto fica como está.
    const local = prop.rotation ? rotatePointAround(point, prop, rotationTrig(-prop.rotation)) : point
    const halfWidth = prop.width / 2
    const halfHeight = prop.height / 2
    const withinX = local.x >= prop.x - halfWidth && local.x <= prop.x + halfWidth
    const withinY = local.y >= prop.y - halfHeight && local.y <= prop.y + halfHeight
    if (withinX && withinY) {
      return prop
    }
  }
  return null
}
