import { Container, Sprite, Assets, Texture } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { Prop } from '../types/map'

const spriteCache = new Map<string, Sprite>()

export function drawProps(container: Container, props: Prop[]): void {
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
