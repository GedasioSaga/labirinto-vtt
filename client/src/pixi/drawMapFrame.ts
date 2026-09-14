import { Color, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { MapFrameLayout } from '../lib/mapFrame'
import { renderTitleBitmap, titleBitmapOrigin, type TitleFont } from './frameTitle'

/**
 * Pinta a moldura calculada por `lib/mapFrame.ts`. Com `titleFont` (ajustada
 * à referência), o título é o bitmap de `frameTitle.ts` posicionado pela
 * caixa de tinta; sem ela, texto do Pixi girado −90° e escalado para o
 * comprimento medido.
 */
export function drawMapFrame(layout: MapFrameLayout, titleFont?: TitleFont, fontFamily = 'Verdana, Tahoma, sans-serif'): Container {
  const container = new Container()
  const graphics = new Graphics()
  for (const rect of layout.rects) {
    graphics.rect(rect.x, rect.y, rect.w, rect.h).fill({ color: new Color(rect.color).toNumber() })
  }
  container.addChild(graphics)

  const title = layout.title
  if (!title) return container

  const bitmap = titleFont ? renderTitleBitmap(title.text, titleFont, title.color) : null
  if (bitmap) {
    const sprite = new Sprite(Texture.from(bitmap.canvas))
    const origin = titleBitmapOrigin(title, bitmap)
    sprite.position.set(origin.x, origin.y)
    container.addChild(sprite)
    return container
  }

  const text = new Text({
    text: title.text,
    style: { fontFamily, fontSize: title.thickness, fontWeight: 'bold', fill: new Color(title.color).toNumber() },
  })
  // Âncora no fim da linha, no meio da altura: após girar −90°, o fim do texto cai em `bottom`.
  text.anchor.set(1, 0.5)
  text.rotation = -Math.PI / 2
  const naturalLength = text.width
  if (naturalLength > 0) text.scale.set(title.length / naturalLength, 1)
  text.position.set(title.cx, title.bottom - title.length)
  container.addChild(text)
  return container
}
