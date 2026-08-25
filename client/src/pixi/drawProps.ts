import { Container, Sprite, Assets, Texture } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { Prop } from '../types/map'

export interface PropsRenderer {
  draw: (container: Container, props: Prop[]) => void
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

  function draw(container: Container, props: Prop[]): void {
    const currentIds = new Set(props.map((p) => p.id))

    for (const [id, sprite] of spriteCache) {
      if (!currentIds.has(id)) {
        container.removeChild(sprite)
        sprite.destroy()
        spriteCache.delete(id)
      }
    }

    for (const prop of props) {
      let sprite = spriteCache.get(prop.id)
      if (!sprite) {
        sprite = new Sprite(Texture.EMPTY)
        sprite.anchor.set(0.5)
        spriteCache.set(prop.id, sprite)
        container.addChild(sprite)

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
    }
  }

  return { draw }
}
