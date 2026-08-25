import { Container, Sprite, Graphics, Assets, Texture } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { Prop } from '../types/map'
import { SELECTION_COLOR } from './constants'

export interface PropsRenderer {
  draw: (container: Container, props: Prop[], selectedPropId?: string | null) => void
}

/**
 * Cria um renderer de props com cache de sprite fechado por closure — mesma
 * lifecycle de backgroundSprite/backgroundLoadToken em PixiCanvas.tsx: deve
 * ser instanciado uma vez dentro do setup() de cada mount do PixiCanvas, nunca
 * em escopo de módulo. Um cache em escopo de módulo sobreviveria ao
 * destroy()/remount do StrictMode e faria drawProps encontrar sprites já
 * destruídos, pulando o addChild e sumindo com os objetos silenciosamente.
 */
export function createPropsRenderer(): PropsRenderer {
  const spriteCache = new Map<string, Sprite>()
  const highlightGraphics = new Graphics()
  let highlightAttached = false

  function draw(container: Container, props: Prop[], selectedPropId: string | null = null): void {
    if (!highlightAttached) {
      container.addChild(highlightGraphics)
      highlightAttached = true
    }

    const currentIds = new Set(props.map((p) => p.id))

    for (const [id, sprite] of spriteCache) {
      if (!currentIds.has(id)) {
        container.removeChild(sprite)
        sprite.destroy()
        spriteCache.delete(id)
      }
    }

    highlightGraphics.clear()

    for (const prop of props) {
      let sprite = spriteCache.get(prop.id)
      if (!sprite) {
        sprite = new Sprite(Texture.EMPTY)
        sprite.anchor.set(0.5)
        spriteCache.set(prop.id, sprite)
        container.addChildAt(sprite, 0)

        const url = convertFileSrc(prop.src)
        Assets.load(url)
          .then((texture) => {
            if (spriteCache.get(prop.id) === sprite) {
              sprite!.texture = texture
            }
          })
          .catch(() => {
            // textura não carregou — sprite fica com Texture.EMPTY (invisível), sem quebrar o resto do mapa
          })
      }
      sprite.x = prop.x
      sprite.y = prop.y
      sprite.width = prop.width
      sprite.height = prop.height

      if (prop.id === selectedPropId) {
        highlightGraphics
          .rect(prop.x - prop.width / 2, prop.y - prop.height / 2, prop.width, prop.height)
          .stroke({ width: 3, color: SELECTION_COLOR })
      }
    }
  }

  return { draw }
}
