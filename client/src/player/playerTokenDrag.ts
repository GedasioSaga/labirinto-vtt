/**
 * Arrasto da PRÓPRIA ficha na tela do jogador, lógica pura: onde a ficha
 * aparece sob o dedo e o que o rótulo diz. O desenho é do `PlayerView`.
 *
 * As duas perguntas usam as funções que o host usa para decidir
 * (`lib/movementRules.ts`) e a régua do Medir (`lib/tokenDragDistance.ts` →
 * `measureCells`): a ficha para na tela exatamente onde o host vai aceitar, e
 * "6 quadrados" aqui é o mesmo 6 que o Medir diria.
 */
import type { MapData } from '../types/map'
import type { Point } from '../pixi/world'
import { clampToMaxStep } from '../lib/movementRules'
import { rotuloDeQuadradosAndados } from '../lib/tokenDragDistance'

export interface TokenDragPreview {
  /** Onde a ficha fica: o dedo, ou o último ponto do alcance quando a cena tem passo máximo. */
  at: Point
  /** "6 quadrados", ou `null` enquanto a ficha não saiu da casa. */
  label: string | null
}

type DragMap = Pick<MapData, 'grid' | 'gridShape' | 'measurementMode' | 'movement'>

export function previewTokenDrag(map: DragMap, origin: Point, wanted: Point): TokenDragPreview {
  const at = clampToMaxStep(map, origin, wanted)
  return { at, label: rotuloDeQuadradosAndados(origin, at, map.grid, map.gridShape, map.measurementMode) }
}
