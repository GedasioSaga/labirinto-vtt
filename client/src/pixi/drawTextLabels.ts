import { Container, Text, Graphics, Color } from 'pixi.js'
import type { Drawing } from '../types/map'
import { SECRET_ITEM_ALPHA, SELECTION_COLOR } from './constants'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'

export interface TextLabelsRenderer {
  draw: (container: Container, drawings: Drawing[], selectedId?: string | null) => void
}

/** Cache de objeto Text por id, fechado por closure — mesma lifecycle de
 * createPropsRenderer: instanciar uma vez por mount do PixiCanvas, nunca em
 * escopo de módulo (StrictMode destrói/remonta, cache em módulo sobreviveria
 * e acharia objetos já destruídos). */
export function createTextLabelsRenderer(): TextLabelsRenderer {
  const cache = new Map<string, Text>()
  const highlightGraphics = new Graphics()
  let highlightAttached = false

  function draw(container: Container, drawings: Drawing[], selectedId: string | null = null): void {
    if (!highlightAttached) {
      container.addChild(highlightGraphics)
      highlightAttached = true
    }

    const texts = drawings.filter((d): d is Extract<Drawing, { kind: 'text' }> => d.kind === 'text')
    const currentIds = new Set(texts.map((t) => t.id))

    // Esconde em vez de destruir: destruir Text durante a sessão quebra o Pixi
    // 8.20 em TexturePool.returnTexture (texto que sai e volta ao payload do
    // jogador, ou apagado no editor). O objeto fica no cache e é reaproveitado.
    for (const [id, textObj] of cache) {
      if (!currentIds.has(id)) textObj.visible = false
    }

    highlightGraphics.clear()

    for (const label of texts) {
      let textObj = cache.get(label.id)
      if (!textObj) {
        textObj = new Text()
        cache.set(label.id, textObj)
        container.addChild(textObj)
      }
      textObj.visible = true
      textObj.alpha = label.secret ? SECRET_ITEM_ALPHA : 1
      textObj.text = label.text
      textObj.x = label.x
      textObj.y = label.y
      textObj.style = {
        fontSize: label.fontSize,
        fill: new Color(label.color).toNumber(),
        // Passthrough sem migração (map.json antigo não tem o campo): cai no
        // mesmo default que o PIXI.TextStyle já usava antes deste campo existir.
        fontFamily: label.fontFamily ?? DEFAULT_TEXT_FONT_FAMILY,
      }

      if (label.id === selectedId) {
        highlightGraphics
          .rect(label.x - 4, label.y - 4, textObj.width + 8, textObj.height + 8)
          .stroke({ width: 2, color: SELECTION_COLOR })
      }
    }
  }

  return { draw }
}
