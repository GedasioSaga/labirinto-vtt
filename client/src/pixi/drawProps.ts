import { Container, Sprite, Graphics, Assets, Texture } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { Prop } from '../types/map'
import { SELECTION_COLOR } from './constants'
import { isHidden, rotationToRadians } from '../lib/itemTransform'
import { useToastStore } from '../stores/toastStore'

/**
 * Onda 2, item 12 (notificação) — reduz um caminho de arquivo ao nome
 * exibível no toast ("C:\...\barril.png" → "barril.png"). Mesma função de
 * `pixi/tokensRenderer.ts` — não extraída pra lib compartilhada: só 2 usos
 * no projeto inteiro, abaixo do "regra do três" da convenção do projeto.
 */
function fileBaseName(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx === -1 ? normalized : normalized.slice(idx + 1)
}

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
  // Onda 2, item 12 — caminho de imagem já avisado, pra não empilhar o
  // mesmo toast de erro a cada `draw()` (chamado a cada mudança relevante do
  // mapa, não só uma vez). Fechado por closure igual `spriteCache`: nasce
  // vazio a cada mount. Guarda por CAMINHO, não por prop — dois props com a
  // mesma imagem quebrada avisam uma vez só, não duas.
  const warnedSrcPaths = new Set<string>()

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

        // Capturado num `const` separado: dentro do `.then()`/`.catch()`
        // abaixo (fronteira de função nova), o TS não carrega a narrowing
        // que o `if (!sprite)` fez do `let sprite` — mesmo motivo do
        // `sprite!` já existente logo abaixo (herdado, não desta mudança).
        const srcPath = prop.src
        const url = convertFileSrc(srcPath)
        Assets.load(url)
          .then((texture) => {
            if (spriteCache.get(prop.id) === sprite) {
              sprite!.texture = texture
            }
          })
          .catch(() => {
            // textura não carregou — sprite fica com Texture.EMPTY
            // (invisível), sem quebrar o resto do mapa. Onda 2, item 12:
            // antes isso era silencioso; agora avisa, uma vez por caminho
            // (warnedSrcPaths), não uma vez por prop nem por frame.
            if (!warnedSrcPaths.has(srcPath)) {
              warnedSrcPaths.add(srcPath)
              useToastStore.getState().push('error', `Imagem do objeto não carregou: ${fileBaseName(srcPath)}`)
            }
          })
      }
      sprite.x = prop.x
      sprite.y = prop.y
      sprite.width = prop.width
      sprite.height = prop.height
      // Anchor já é 0.5 (linha 45), então a rotação gira em torno do centro
      // do prop, não do canto. `undefined` → 0 radiano: aparência idêntica à
      // de hoje (types/map.ts documenta Prop.rotation undefined === 0).
      sprite.rotation = rotationToRadians(prop.rotation)
      // hidden === "não renderiza no editor" (organização de cena do
      // mestre) — não existe segunda tela/modo jogador neste app, ver
      // comentário de Prop.hidden em types/map.ts.
      sprite.visible = !isHidden(prop)

      if (prop.id === selectedPropId && sprite.visible) {
        highlightGraphics
          .rect(prop.x - prop.width / 2, prop.y - prop.height / 2, prop.width, prop.height)
          .stroke({ width: 3, color: SELECTION_COLOR })
      }
    }
  }

  return { draw }
}
