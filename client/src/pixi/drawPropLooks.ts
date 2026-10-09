import { Container, Sprite, Text, Texture } from 'pixi.js'
import type { Prop } from '../types/map'
import { propPlayerImage, propPlayerLabel } from '../lib/propPlayerLook'
import { ehRefDeMidia, type ResolverDeImagem } from '../lib/midia'
import { rotationToRadians } from '../lib/itemTransform'
import { screenLabelSizing } from './screenLabel'
import { textureFromDataUrl } from './tokenPhotoSprite'
import { WALL_COLOR } from './drawWalls'

/**
 * OBJETO COM RÓTULO OU IMAGEM — o que a silhueta sozinha não diz, na tela do
 * JOGADOR. A silhueta chapada (`drawPropSilhouettes.ts`) continua sendo a forma
 * do móvel; por cima dela:
 * - o RÓTULO ("Guarda-roupa"), escrito no centro, reto (não gira com o móvel:
 *   é texto para ler), no mesmo fio claro da parede com contorno escuro, e com
 *   a mesma regra de zoom do nome da sala (`screenLabel.ts`);
 * - a IMAGEM, quando o mestre ligou "Mostrar imagem ao jogador": a cópia
 *   pequena que viajou, esticada ao tamanho e girada na rotação do editor —
 *   exatamente onde o sprite do mestre está;
 * - a IMAGEM DO ITEM NO CHÃO (entrega 5), buscada por referência de mídia
 *   (`imagemDaMesa`), inteira dentro da caixa do objeto (`fitPropSprite`).
 *
 * O recorte (`lib/fogFilter.ts`) já tirou o que o jogador não pode ver; aqui
 * a imagem ainda passa pela regra de `propPlayerLook.ts`, para que nada que não
 * seja a cópia auto-contida vire endereço carregado pelo navegador dele.
 */

export interface PropLooksCount {
  images: number
  labels: number
}

export interface PropLooksRenderer {
  /**
   * Redesenha rótulos e imagens dos objetos recebidos; o que saiu da lista sai
   * da tela. `imagemDaMesa` diz de onde vem a imagem do ITEM NO CHÃO (a URL da
   * sala no jogador, a ponte de arquivos na janela de teste); sem ele, o item
   * no chão fica só no toque, sem desenho.
   */
  draw: (images: Container, labels: Container, props: readonly Prop[], grid: number, cameraScale: number, imagemDaMesa?: ResolverDeImagem) => PropLooksCount
  /** Só o zoom mudou: reescala e mostra/esconde os rótulos, sem refazer nada. */
  setCameraScale: (cameraScale: number) => void
}

/** Carrega a textura da cópia auto-contida; trocável no teste. */
export type PropTextureLoader = (dataUrl: string) => Promise<Texture>

/** Fonte do rótulo em fração da célula: menor que o nome da sala (0,3), é o nome de um móvel. */
const LABEL_FONT_PER_GRID = 0.25
const LABEL_MIN_FONT = 10
const LABEL_MAX_FONT = 20
/** Contorno escuro da letra: separa o fio claro de um chão claro. */
const LABEL_STROKE_COLOR = 0x000000
const LABEL_STROKE_WIDTH = 3

interface ImageView {
  sprite: Sprite
  /** A cópia que está (ou vai estar) no sprite: outra cópia pede carregamento novo. */
  data: string
  /** Geometria atual do objeto: a textura que chega depois se encaixa nela, não na do pedido. */
  prop: Prop
}

interface LabelView {
  text: Text
  fontSize: number
}

function labelFontSize(grid: number): number {
  const size = Number.isFinite(grid) && grid > 0 ? grid * LABEL_FONT_PER_GRID : LABEL_MIN_FONT
  return Math.min(LABEL_MAX_FONT, Math.max(LABEL_MIN_FONT, size))
}

/**
 * O tamanho do sprite na caixa do objeto, igual no editor (`drawProps.ts`) e
 * na tela do jogador: o objeto comum estica até a caixa, como sempre; o ITEM
 * NO CHÃO cabe INTEIRO nela, sem deformar — a espada comprida numa caixa
 * quadrada continua espada. Textura ainda vazia estica (não há proporção).
 */
export function fitPropSprite(sprite: Sprite, prop: Pick<Prop, 'width' | 'height' | 'item'>): void {
  const { width, height } = sprite.texture
  if (prop.item === undefined || width <= 1 || height <= 1) {
    sprite.width = prop.width
    sprite.height = prop.height
    return
  }
  sprite.scale.set(Math.min(prop.width / width, prop.height / height))
}

/** Tamanho e rotação do editor: âncora no centro, igual ao sprite do mestre (`drawProps.ts`). */
function placeImage(view: ImageView): void {
  const { sprite, prop } = view
  sprite.x = prop.x
  sprite.y = prop.y
  sprite.rotation = rotationToRadians(prop.rotation)
  fitPropSprite(sprite, prop)
}

/**
 * A imagem que o jogador vê no objeto: a do ITEM NO CHÃO (referência de mídia
 * resolvida pela tela, só a da forma `midia:<id>`) ou a cópia auto-contida do
 * "Mostrar imagem ao jogador". `undefined` = só a silhueta.
 */
function imagemDoObjeto(prop: Prop, imagemDaMesa: ResolverDeImagem | undefined): string | undefined {
  if (prop.item !== undefined) {
    const ref = prop.item.imagem
    return ehRefDeMidia(ref) && imagemDaMesa !== undefined ? (imagemDaMesa(ref) ?? undefined) : undefined
  }
  return propPlayerImage(prop.playerImage)
}

function sizeLabel(view: LabelView, cameraScale: number): void {
  const sizing = screenLabelSizing(view.fontSize, cameraScale)
  view.text.scale.set(sizing.scale)
  view.text.visible = sizing.visible
}

export function createPropLooksRenderer(loadTexture: PropTextureLoader = textureFromDataUrl): PropLooksRenderer {
  const imageViews = new Map<string, ImageView>()
  const labelViews = new Map<string, LabelView>()
  let lastCameraScale = 1

  function dropImage(id: string, view: ImageView): void {
    view.sprite.destroy()
    imageViews.delete(id)
  }

  function loadInto(view: ImageView): void {
    const { data } = view
    loadTexture(data)
      .then((texture) => {
        // Trocou de cópia, ou o objeto saiu da tela, durante o carregamento: a antiga não vence.
        if (view.sprite.destroyed || view.data !== data) return
        view.sprite.texture = texture
        placeImage(view)
      })
      .catch(() => {
        // Cópia que não decodifica deixa só a silhueta embaixo: a mesa não cai por uma imagem ruim.
      })
  }

  function drawImages(container: Container, props: readonly Prop[], imagemDaMesa: ResolverDeImagem | undefined): number {
    const wanted = new Map<string, { prop: Prop; data: string }>()
    for (const prop of props) {
      const data = imagemDoObjeto(prop, imagemDaMesa)
      if (data !== undefined) wanted.set(prop.id, { prop, data })
    }
    for (const [id, view] of imageViews) if (!wanted.has(id)) dropImage(id, view)
    for (const [id, { prop, data }] of wanted) {
      let view = imageViews.get(id)
      if (view === undefined) {
        const sprite = new Sprite(Texture.EMPTY)
        sprite.anchor.set(0.5)
        container.addChild(sprite)
        view = { sprite, data, prop }
        imageViews.set(id, view)
        loadInto(view)
      } else if (view.data !== data) {
        view.data = data
        view.sprite.texture = Texture.EMPTY
        loadInto(view)
      }
      view.prop = prop
      placeImage(view)
    }
    return wanted.size
  }

  function drawLabels(container: Container, props: readonly Prop[], grid: number): number {
    const fontSize = labelFontSize(grid)
    const wanted = new Map<string, { prop: Prop; label: string }>()
    for (const prop of props) {
      const label = propPlayerLabel(prop.playerLabel)
      if (label !== undefined) wanted.set(prop.id, { prop, label })
    }
    for (const [id, view] of labelViews) {
      if (wanted.has(id)) continue
      view.text.destroy()
      labelViews.delete(id)
    }
    for (const [id, { prop, label }] of wanted) {
      let view = labelViews.get(id)
      if (view === undefined) {
        const text = new Text({
          text: label,
          style: { fontSize, fill: WALL_COLOR, stroke: { color: LABEL_STROKE_COLOR, width: LABEL_STROKE_WIDTH } },
        })
        text.anchor.set(0.5)
        container.addChild(text)
        view = { text, fontSize }
        labelViews.set(id, view)
      }
      if (view.text.text !== label) view.text.text = label
      if (view.fontSize !== fontSize) {
        view.fontSize = fontSize
        view.text.style.fontSize = fontSize
      }
      view.text.x = prop.x
      view.text.y = prop.y
      sizeLabel(view, lastCameraScale)
    }
    return wanted.size
  }

  return {
    draw(images, labels, props, grid, cameraScale, imagemDaMesa) {
      lastCameraScale = cameraScale
      return { images: drawImages(images, props, imagemDaMesa), labels: drawLabels(labels, props, grid) }
    },
    setCameraScale(cameraScale) {
      lastCameraScale = cameraScale
      for (const view of labelViews.values()) sizeLabel(view, cameraScale)
    },
  }
}
