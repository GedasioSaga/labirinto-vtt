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
import { clampToMaxStep, maxStepOf, passoMaximoDaFicha } from '../lib/movementRules'
import { rotuloDeQuadradosAndados } from '../lib/tokenDragDistance'

export interface TokenDragPreview {
  /** Onde a ficha fica: o dedo, ou o último ponto do alcance quando a cena tem passo máximo. */
  at: Point
  /** "6 quadrados", ou `null` enquanto a ficha não saiu da casa. */
  label: string | null
}

type DragMap = Pick<MapData, 'grid' | 'gridShape' | 'measurementMode' | 'movement'>

/**
 * `ficha`: a ficha arrastada, como a tela a recebeu. Com a pastilha "Lento"
 * (Fase 3), o alcance é a METADE do passo da cena (`passoMaximoDaFicha`), o
 * mesmo corte que o host faz ao soltar. Ausente = o passo da cena.
 */
export function previewTokenDrag(map: DragMap, origin: Point, wanted: Point, ficha?: { conditions?: unknown }): TokenDragPreview {
  const at = clampToMaxStep(map, origin, wanted, ficha === undefined ? maxStepOf(map) : passoMaximoDaFicha(map, ficha))
  return { at, label: rotuloDeQuadradosAndados(origin, at, map.grid, map.gridShape, map.measurementMode) }
}
