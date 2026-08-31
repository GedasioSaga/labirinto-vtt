import { Container, Text } from 'pixi.js'
import type { Point } from './world'
import { ANGLE_INDICATOR_COLOR } from './constants'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'

export interface AngleIndicatorRenderer {
  /** Mostra/atualiza o texto de ângulo perto de `end` (com um pequeno offset,
   * pra não cobrir o próprio ponto do cursor). Chamar a cada pointermove
   * enquanto desenha Parede/Linha. */
  show: (container: Container, end: Point, label: string) => void
  /** Esconde o indicador. Chamar nos 3 lugares de limpeza de estado de draft
   * (clearDrafts, pointerup, pointerupoutside) — senão o texto fica "grudado"
   * na tela depois que o arrasto termina. */
  hide: () => void
}

// Offset em unidades de mundo a partir do ponto final do arrasto — desloca o
// texto pra cima e pra direita do cursor, pra não cobrir o próprio ponto.
const OFFSET_X = 12
const OFFSET_Y = -12
const FONT_SIZE = 13

/** Cache de um único objeto Text por instância, fechado por closure — mesma
 * lifecycle de createTextLabelsRenderer/createPropsRenderer: instanciar uma
 * vez por mount do PixiCanvas, nunca em escopo de módulo. */
export function createAngleIndicatorRenderer(): AngleIndicatorRenderer {
  let textObj: Text | null = null

  function ensureText(container: Container): Text {
    if (!textObj) {
      textObj = new Text({
        style: {
          fontSize: FONT_SIZE,
          fill: ANGLE_INDICATOR_COLOR,
          fontFamily: DEFAULT_TEXT_FONT_FAMILY,
        },
      })
      container.addChild(textObj)
    }
    return textObj
  }

  function show(container: Container, end: Point, label: string): void {
    const text = ensureText(container)
    text.text = label
    text.x = end.x + OFFSET_X
    text.y = end.y + OFFSET_Y
    text.visible = true
  }

  function hide(): void {
    if (textObj) textObj.visible = false
  }

  return { show, hide }
}
