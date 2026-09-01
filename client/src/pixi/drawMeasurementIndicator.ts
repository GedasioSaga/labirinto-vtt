import { Container, Graphics, Text } from 'pixi.js'
import type { Point } from './world'
import { SELECTION_COLOR } from './constants'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'

export interface MeasurementIndicatorRenderer {
  /**
   * Desenha/atualiza a linha efêmera de `start` até `end` e o rótulo de
   * distância perto de `end` (mesmo offset de `drawAngleIndicator.ts`, pra
   * não cobrir o próprio ponto do cursor). Chamar a cada pointermove
   * enquanto a ferramenta "measure" está com o botão pressionado.
   * `label` vem pronto de `lib/measurement.ts` (`measureDistance(...).label`)
   * — este módulo só desenha, não calcula distância.
   */
  show: (container: Container, start: Point, end: Point, label: string) => void
  /** Esconde linha e rótulo. Chamar no pointerup/pointerupoutside da
   *  ferramenta "measure" — senão a régua fica "grudada" na tela depois que
   *  o arrasto termina, mesmo bug que o comentário de
   *  `AngleIndicatorRenderer.hide` documenta pro indicador de ângulo. */
  hide: () => void
}

const LINE_WIDTH = 2
const FONT_SIZE = 13
// Mesmo offset de drawAngleIndicator.ts — desloca o rótulo pra cima e pra
// direita do ponto final do arrasto, pra não cobrir o próprio cursor.
const LABEL_OFFSET_X = 12
const LABEL_OFFSET_Y = -12

/**
 * Cache de um Graphics (linha) + um Text (rótulo) por instância, fechado por
 * closure — mesma lifecycle de `createAngleIndicatorRenderer`: instanciar
 * uma vez por mount do PixiCanvas (dentro do `setup()`), nunca em escopo de
 * módulo, senão StrictMode remonta e o objeto Pixi já destruído.
 */
export function createMeasurementIndicatorRenderer(): MeasurementIndicatorRenderer {
  let lineGraphics: Graphics | null = null
  let labelText: Text | null = null

  function ensure(container: Container): { line: Graphics; label: Text } {
    if (!lineGraphics) {
      lineGraphics = new Graphics()
      container.addChild(lineGraphics)
    }
    if (!labelText) {
      labelText = new Text({
        style: {
          fontSize: FONT_SIZE,
          fill: SELECTION_COLOR,
          fontFamily: DEFAULT_TEXT_FONT_FAMILY,
        },
      })
      container.addChild(labelText)
    }
    return { line: lineGraphics, label: labelText }
  }

  function show(container: Container, start: Point, end: Point, label: string): void {
    const { line, label: text } = ensure(container)

    line.clear()
    line.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: LINE_WIDTH, color: SELECTION_COLOR, alpha: 0.85 })
    line.visible = true

    text.text = label
    text.x = end.x + LABEL_OFFSET_X
    text.y = end.y + LABEL_OFFSET_Y
    text.visible = true
  }

  function hide(): void {
    if (lineGraphics) lineGraphics.visible = false
    if (labelText) labelText.visible = false
  }

  return { show, hide }
}
