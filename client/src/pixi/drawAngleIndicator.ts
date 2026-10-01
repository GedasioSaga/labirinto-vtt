import { Container, Text } from 'pixi.js'
import type { Point } from './world'
import { measureLabelStyle, resolveStrokeLabelPosition, type WorldViewport } from './drawDimensionLabel'

export interface AngleIndicatorRenderer {
  /**
   * Mostra/atualiza o rótulo "comprimento · ângulo" do traço que vai de `from`
   * até `end`, a ponta que o cursor puxa. Chamar a cada pointermove enquanto
   * desenha Parede/Linha e no segmento em curso do Caminho. O lado sai de
   * `resolveStrokeLabelPosition`: depois da ponta, fora do traço e das guias
   * que encaixam a ponta. `viewport` é o retângulo visível em MUNDO
   * (`computeViewport()` do canvas), para o rótulo trocar de lado na borda.
   */
  show: (container: Container, from: Point, end: Point, label: string, viewport: WorldViewport) => void
  /** Esconde o indicador. Chamar nos 3 lugares de limpeza de estado de draft
   * (clearDrafts, pointerup, pointerupoutside) — senão o texto fica "grudado"
   * na tela depois que o arrasto termina. */
  hide: () => void
}

/** Cache de um único objeto Text por instância, fechado por closure — mesma
 * lifecycle de createTextLabelsRenderer/createPropsRenderer: instanciar uma
 * vez por mount do PixiCanvas, nunca em escopo de módulo.
 *
 * O estilo é o do rótulo das formas (`measureLabelStyle`): branco com contorno
 * preto. O cinza sem contorno de antes sumia sobre o chão da sala
 * (conferência guias-4e5). */
export function createAngleIndicatorRenderer(): AngleIndicatorRenderer {
  let textObj: Text | null = null

  function ensureText(container: Container): Text {
    if (!textObj) {
      textObj = new Text({ style: measureLabelStyle() })
      container.addChild(textObj)
    }
    return textObj
  }

  function show(container: Container, from: Point, end: Point, label: string, viewport: WorldViewport): void {
    const text = ensureText(container)
    text.text = label
    const position = resolveStrokeLabelPosition(from, end, label, viewport)
    text.x = position.x
    text.y = position.y
    text.visible = true
  }

  function hide(): void {
    if (textObj) textObj.visible = false
  }

  return { show, hide }
}
