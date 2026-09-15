import { Container, Sprite, Graphics, Text, Assets, Texture } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { Token } from '../types/map'
import { SECRET_ITEM_ALPHA, SELECTION_COLOR } from './constants'
import { drawTokenCircle } from './drawTokens'
import { isHidden, rotationToRadians } from '../lib/itemTransform'
import { useToastStore } from '../stores/toastStore'
import { screenLabelSizing } from './screenLabel'

/**
 * Onda 2, item 12 (notificação) — reduz um caminho de arquivo ao nome
 * exibível no toast ("C:\...\tocha.png" → "tocha.png"). Aceita `/` e `\`
 * porque `Token.image`/`Prop.src` guardam caminho absoluto do SO (Windows
 * usa `\`, mas o projeto roda teste em jsdom, que não normaliza).
 */
/** Token "Oculto no editor": fantasma bem transparente, mas ainda clicável. */
const HIDDEN_TOKEN_GHOST_ALPHA = 0.3
const GHOST_DASH_COUNT = 16
const GHOST_OUTLINE_WIDTH = 2
const GHOST_OUTLINE_COLOR = 0xffffff

/** Contorno tracejado: metade de cada fatia do círculo é traço, metade é vão. */
function strokeDashedCircle(graphics: Graphics, radius: number): void {
  const slice = (Math.PI * 2) / GHOST_DASH_COUNT
  for (let i = 0; i < GHOST_DASH_COUNT; i++) {
    const start = i * slice
    graphics.moveTo(Math.cos(start) * radius, Math.sin(start) * radius)
    graphics.arc(0, 0, radius, start, start + slice / 2)
  }
  graphics.stroke({ width: GHOST_OUTLINE_WIDTH, color: GHOST_OUTLINE_COLOR })
}

function fileBaseName(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx === -1 ? normalized : normalized.slice(idx + 1)
}

/** Fonte do nome do token em px de mundo; na tela nunca abaixo de 11 px (screenLabel.ts). */
export const TOKEN_LABEL_FONT_SIZE = 12

export interface TokensRenderer {
  /** `cameraScale` omitido mantém o último zoom informado. */
  draw: (container: Container, tokens: Token[], gridSize: number, selectedTokenId?: string | null, cameraScale?: number) => void
  /** Só o zoom mudou: reescala e mostra/esconde os nomes sem redesenhar os tokens. */
  setCameraScale: (cameraScale: number) => void
}

interface TokenEntry {
  /** Único filho que este renderer adiciona a `container` por token — carrega
   *  o visual (sprite OU graphics, nunca os dois), o anel de seleção e o
   *  rótulo de nome como filhos internos, e é posicionado em (token.x, token.y)
   *  inteiro. Mantém `container.children.length === tokens.length` sempre,
   *  mesmo quando o token troca de "círculo" pra "imagem" e vice-versa. */
  wrapper: Container
  sprite: Sprite | null
  graphics: Graphics | null
  ring: Graphics
  label: Text
  /** `Token.image` já carregado no `sprite` atual, ou null enquanto nenhuma
   *  imagem foi carregada ainda (token sem imagem, ou sprite recém-criado). */
  loadedSrc: string | null
  /** Incrementado a cada novo Assets.load disparado para este token. O
   *  callback assíncrono só aplica a textura se o contador não mudou nesse
   *  meio-tempo — protege contra: (a) o token trocar de imagem de novo antes
   *  do primeiro load terminar (a textura antiga vence por engano) e (b) o
   *  próprio token ser removido do mapa antes do load terminar. */
  loadToken: number
}

/**
 * Cria um renderer de tokens com cache por id, fechado por closure — MESMA
 * lifecycle de createPropsRenderer (pixi/drawProps.ts:10-16): instanciar uma
 * vez dentro do setup() de cada mount do PixiCanvas, NUNCA em escopo de
 * módulo. Um cache em escopo de módulo sobreviveria ao destroy()/remount do
 * StrictMode: o draw() seguinte encontraria entradas cujo `wrapper`/`sprite`
 * já foram destruídos pelo unmount anterior (app.destroy(true, {children:
 * true}) desce recursivamente), tentaria reaproveitá-los em vez de recriar, e
 * o token sumiria da tela sem erro — exatamente o "sprite fantasma" que o
 * comentário de drawProps.ts já documenta para Prop. Instanciado dentro do
 * setup(), o cache nasce vazio a cada mount e o bug não tem como ocorrer.
 *
 * `Token.image === null` desenha o círculo genérico de sempre (drawTokenCircle,
 * idêntico ao antigo drawTokens.ts:10-18). `Token.image !== null` carrega a
 * imagem pelo mesmo pipeline de Prop (convertFileSrc + Assets.load, textura
 * ausente = Texture.EMPTY até o load resolver; load que falha deixa o sprite
 * invisível sem quebrar o resto do mapa, mesmo padrão de createPropsRenderer).
 */
export function createTokensRenderer(): TokensRenderer {
  const cache = new Map<string, TokenEntry>()
  // Onda 2, item 12 — caminho de imagem já avisado, pra não empilhar o
  // mesmo toast de erro a cada `draw()` (chamado a cada mudança relevante do
  // mapa, não só uma vez). Fechado por closure igual `cache`: nasce vazio a
  // cada mount, sem risco do "sprite fantasma" documentado acima. Guarda por
  // CAMINHO, não por token — dois tokens com a mesma imagem quebrada avisam
  // uma vez só, não duas.
  const warnedImagePaths = new Set<string>()
  let lastCameraScale = 1

  function applyLabelSizing(label: Text): void {
    const sizing = screenLabelSizing(TOKEN_LABEL_FONT_SIZE, lastCameraScale)
    label.scale.set(sizing.scale)
    label.visible = sizing.visible
  }

  function setCameraScale(cameraScale: number): void {
    lastCameraScale = cameraScale
    for (const entry of cache.values()) applyLabelSizing(entry.label)
  }

  function ensureSprite(entry: TokenEntry): Sprite {
    if (entry.graphics) {
      entry.wrapper.removeChild(entry.graphics)
      entry.graphics.destroy()
      entry.graphics = null
    }
    if (!entry.sprite) {
      const sprite = new Sprite(Texture.EMPTY)
      sprite.anchor.set(0.5)
      entry.sprite = sprite
      entry.wrapper.addChildAt(sprite, 0)
    }
    return entry.sprite
  }

  function ensureGraphics(entry: TokenEntry): Graphics {
    if (entry.sprite) {
      entry.wrapper.removeChild(entry.sprite)
      entry.sprite.destroy()
      entry.sprite = null
      // Imagem removida do token (voltou a ser círculo): esquece a imagem
      // carregada, senão reatribuir a MESMA imagem depois não dispara reload
      // (o guard de loadedSrc abaixo compara contra este campo).
      entry.loadedSrc = null
    }
    if (!entry.graphics) {
      const graphics = new Graphics()
      entry.graphics = graphics
      entry.wrapper.addChildAt(graphics, 0)
    }
    return entry.graphics
  }

  function draw(container: Container, tokens: Token[], gridSize: number, selectedTokenId: string | null = null, cameraScale?: number): void {
    if (cameraScale !== undefined) lastCameraScale = cameraScale
    const currentIds = new Set(tokens.map((t) => t.id))

    for (const [id, entry] of cache) {
      if (!currentIds.has(id)) {
        container.removeChild(entry.wrapper)
        entry.wrapper.destroy({ children: true })
        cache.delete(id)
      }
    }

    for (const token of tokens) {
      let entry = cache.get(token.id)
      if (!entry) {
        const wrapper = new Container()
        const ring = new Graphics()
        const label = new Text({ text: '', style: { fontSize: TOKEN_LABEL_FONT_SIZE, fill: 0xffffff } })
        label.anchor.set(0.5, 0)
        wrapper.addChild(ring, label)
        entry = { wrapper, sprite: null, graphics: null, ring, label, loadedSrc: null, loadToken: 0 }
        cache.set(token.id, entry)
        container.addChild(wrapper)
      }

      const selected = token.id === selectedTokenId
      const ghost = isHidden(token)
      entry.wrapper.alpha = ghost ? HIDDEN_TOKEN_GHOST_ALPHA : token.secret ? SECRET_ITEM_ALPHA : 1
      entry.ring.clear()
      let outlineRadius: number

      // Checagem por veracidade (truthy), não `!== null`: `Token.image` é
      // obrigatório no tipo (`string | null`), mas objeto construído fora do
      // type-checker (JSON de mapa legado antes da migração, ou um
      // `addToken` cru como o que vários specs e2e fazem via
      // `page.evaluate`) pode chegar com o campo `undefined` — e
      // `undefined !== null` é `true`, o que tentaria carregar
      // `convertFileSrc(undefined)` e quebrar quando a ponte do Tauri não
      // está disponível (ambiente de teste, sem `window.__TAURI_INTERNALS__`).
      if (token.image) {
        const sprite = ensureSprite(entry)
        const diameter = gridSize * token.size
        sprite.width = diameter
        sprite.height = diameter
        // Anchor já é 0.5 (ensureSprite), então gira em torno do centro do
        // token. `undefined` → 0 radiano: aparência idêntica à de hoje
        // (types/map.ts documenta Token.rotation undefined === 0).
        sprite.rotation = rotationToRadians(token.rotation)

        if (entry.loadedSrc !== token.image) {
          entry.loadToken += 1
          const localLoadToken = entry.loadToken
          const currentEntry = entry
          // Capturado num `const` separado: dentro do `.catch()` abaixo
          // (fronteira de função nova), o TS não carrega a narrowing de
          // `token.image` como `string` feita pelo `if (token.image)` da
          // linha 123 — precisa de uma variável própria para não perder o
          // tipo sem recorrer a `as`/`!`.
          const imagePath = token.image
          const tokenName = token.name
          const url = convertFileSrc(imagePath)
          entry.loadedSrc = token.image
          Assets.load(url)
            .then((texture) => {
              if (cache.get(token.id) === currentEntry && currentEntry.loadToken === localLoadToken && currentEntry.sprite) {
                currentEntry.sprite.texture = texture
              }
            })
            .catch(() => {
              // textura não carregou — sprite fica com Texture.EMPTY
              // (invisível), sem quebrar o resto do mapa. Onda 2, item 12:
              // antes isso era silencioso; agora avisa, uma vez por caminho
              // (warnedImagePaths), não uma vez por token nem por frame.
              if (!warnedImagePaths.has(imagePath)) {
                warnedImagePaths.add(imagePath)
                useToastStore.getState().push('error', `Imagem do token "${tokenName}" não carregou: ${fileBaseName(imagePath)}`)
              }
            })
        }

        if (selected) {
          entry.ring.circle(0, 0, diameter / 2).stroke({ width: 4, color: SELECTION_COLOR })
        }
        entry.label.position.set(0, diameter / 2 + 2)
        outlineRadius = diameter / 2
      } else {
        const graphics = ensureGraphics(entry)
        const radius = (gridSize * token.size) / 2 - 2
        drawTokenCircle(graphics, radius, selected)
        // Círculo genérico é simétrico hoje, mas gira igual ao sprite pra
        // não haver salto visual quando o token ganha/perde imagem depois.
        graphics.rotation = rotationToRadians(token.rotation)
        entry.label.position.set(0, radius + 2)
        outlineRadius = radius
      }

      // hidden === "Oculto no editor" (organização de cena do mestre). Antes
      // o token sumia de vez e não havia como clicar nele para desfazer; agora
      // fica como fantasma (alpha baixo acima + contorno tracejado), clicável.
      if (ghost) strokeDashedCircle(entry.ring, outlineRadius)

      entry.label.text = token.name
      applyLabelSizing(entry.label)
      entry.wrapper.position.set(token.x, token.y)
    }
  }

  return { draw, setCameraScale }
}
