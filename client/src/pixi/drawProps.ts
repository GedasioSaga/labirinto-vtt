import { Container, Sprite, Graphics, Assets, Texture } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { Prop } from '../types/map'
import { SECRET_ITEM_ALPHA, SELECTION_COLOR } from './constants'
import { isHidden, rotationToRadians } from '../lib/itemTransform'
import { useToastStore } from '../stores/toastStore'
import { drawPropSilhouettes } from './drawPropSilhouettes'

/**
 * Onda 2, item 12 (notificação) — reduz um caminho de arquivo ao nome
 * exibível no toast ("C:\...\barril.png" → "barril.png"). Mesma função de
 * `pixi/tokensRenderer.ts` — não extraída pra lib compartilhada: só 2 usos
 * no projeto inteiro, abaixo do "regra do três" da convenção do projeto.
 */
/** Objeto "Oculto no editor": fantasma bem transparente, mas ainda clicável (igual ao token). */
const HIDDEN_PROP_GHOST_ALPHA = 0.3
const GHOST_DASH_LENGTH = 8
const GHOST_OUTLINE_WIDTH = 2
const GHOST_OUTLINE_COLOR = 0xffffff

/** Contorno tracejado de retângulo: traço e vão de `GHOST_DASH_LENGTH` em cada lado. */
function strokeDashedRect(graphics: Graphics, x: number, y: number, width: number, height: number): void {
  const corners = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ]
  for (let i = 0; i < corners.length; i++) {
    const [ax, ay] = corners[i]
    const [bx, by] = corners[(i + 1) % corners.length]
    const sideLength = Math.hypot(bx - ax, by - ay)
    if (sideLength === 0) continue
    const ux = (bx - ax) / sideLength
    const uy = (by - ay) / sideLength
    for (let t = 0; t < sideLength; t += GHOST_DASH_LENGTH * 2) {
      const end = Math.min(t + GHOST_DASH_LENGTH, sideLength)
      graphics.moveTo(ax + ux * t, ay + uy * t).lineTo(ax + ux * end, ay + uy * end)
    }
  }
  graphics.stroke({ width: GHOST_OUTLINE_WIDTH, color: GHOST_OUTLINE_COLOR })
}

/** Rótulo do `Graphics` de cada móvel da mobília desenhada (achado pelos testes e pelo inspetor do Pixi). */
export const FURNITURE_LABEL = 'mobilia'

/** Transparência do objeto no editor: fantasma do "Oculto no editor", meio apagado se "Oculto para jogadores". */
function propAlpha(prop: Prop): number {
  return isHidden(prop) ? HIDDEN_PROP_GHOST_ALPHA : prop.secret ? SECRET_ITEM_ALPHA : 1
}

function fileBaseName(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx === -1 ? normalized : normalized.slice(idx + 1)
}

/**
 * Zoom e densidade de pixel do quadro: o fio do móvel desenhado é em px de
 * TELA (como a parede), então a largura em mundo depende dos dois. Obrigatório
 * de propósito: sem ele o fio caía no padrão de 1 px de MUNDO e engrossava e
 * afinava com o zoom.
 */
export interface PropsView {
  cameraScale: number
  rendererResolution: number
}

export interface PropsRenderer {
  draw: (container: Container, props: Prop[], selectedPropId: string | null, view: PropsView) => void
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
  // Móveis da mobília desenhada, por id — mesma vida do `spriteCache`.
  const furnitureCache = new Map<string, Graphics>()
  const highlightGraphics = new Graphics()
  let highlightAttached = false
  // Onda 2, item 12 — caminho de imagem já avisado, pra não empilhar o
  // mesmo toast de erro a cada `draw()` (chamado a cada mudança relevante do
  // mapa, não só uma vez). Fechado por closure igual `spriteCache`: nasce
  // vazio a cada mount. Guarda por CAMINHO, não por prop — dois props com a
  // mesma imagem quebrada avisam uma vez só, não duas.
  const warnedSrcPaths = new Set<string>()

  function draw(container: Container, props: Prop[], selectedPropId: string | null, view: PropsView): void {
    if (!highlightAttached) {
      container.addChild(highlightGraphics)
      highlightAttached = true
    }

    // Móvel da mobília desenhada não tem imagem: fica fora do cache de sprite
    // (e o sprite de um objeto que virou móvel sai), e vice-versa.
    const imageIds = new Set(props.filter((p) => p.mobilia === undefined).map((p) => p.id))
    const furnitureIds = new Set(props.filter((p) => p.mobilia !== undefined).map((p) => p.id))

    for (const [id, sprite] of spriteCache) {
      if (!imageIds.has(id)) {
        container.removeChild(sprite)
        sprite.destroy()
        spriteCache.delete(id)
      }
    }
    for (const [id, drawing] of furnitureCache) {
      if (!furnitureIds.has(id)) {
        container.removeChild(drawing)
        drawing.destroy()
        furnitureCache.delete(id)
      }
    }

    highlightGraphics.clear()

    for (const prop of props) {
      if (prop.mobilia !== undefined) {
        drawFurniture(container, prop, view)
        markPropState(prop, selectedPropId)
        continue
      }
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
      // hidden === "Oculto no editor" (organização de cena do mestre). Antes
      // o objeto sumia e não havia como clicar nele para desfazer; agora fica
      // como fantasma (alpha baixo + contorno tracejado), clicável — mesma
      // regra dos tokens (tokensRenderer.ts).
      sprite.visible = true
      sprite.alpha = propAlpha(prop)
      markPropState(prop, selectedPropId)
    }
  }

  /**
   * MOBÍLIA DESENHADA no editor: a mesma silhueta chapada com o glifo que o
   * jogador vê (`drawPropSilhouettes`), um `Graphics` por móvel para o
   * fantasma e o "Oculto para jogadores" valerem por móvel, como no sprite.
   * Nada de imagem: nem pedido de arquivo, nem aviso de imagem quebrada.
   */
  function drawFurniture(container: Container, prop: Prop, view: PropsView): void {
    let drawing = furnitureCache.get(prop.id)
    if (!drawing) {
      drawing = new Graphics()
      drawing.label = FURNITURE_LABEL
      furnitureCache.set(prop.id, drawing)
      container.addChildAt(drawing, 0)
    }
    drawPropSilhouettes(drawing, [prop], view.cameraScale, view.rendererResolution)
    drawing.alpha = propAlpha(prop)
  }

  /** Fantasma do "Oculto no editor" e destaque de seleção, iguais para imagem e móvel. */
  function markPropState(prop: Prop, selectedPropId: string | null): void {
    const left = prop.x - prop.width / 2
    const top = prop.y - prop.height / 2
    if (isHidden(prop)) strokeDashedRect(highlightGraphics, left, top, prop.width, prop.height)
    if (prop.id === selectedPropId) {
      highlightGraphics.rect(left, top, prop.width, prop.height).stroke({ width: 3, color: SELECTION_COLOR })
    }
  }

  return { draw }
}
