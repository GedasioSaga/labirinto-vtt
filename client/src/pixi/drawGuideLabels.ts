/**
 * NÚMERO DO VÃO (pedido 3, fatia 3): a medida de cada vão que a guia
 * inteligente mostra (`GapMark` de `lib/smartGuides.ts`), numa pílula
 * magenta com texto branco, no meio da cota que `drawSmartGuides.ts` desenha.
 * Tamanho constante na tela em qualquer zoom: é leitura, não desenho do mapa.
 *
 * Um POOL fixo, criado na montagem do canvas e escondido. Criar `Text` e
 * medir fonte no meio do arrasto é engasgo: a primeira medida de uma fonte
 * custou 91 ms de tarefa longa no `ux-driver medir` (ver
 * `createMarqueeHintRenderer`). Cada rótulo só troca o texto, e com ele a
 * pílula, quando a string muda — o mesmo número sob o cursor preso no encaixe
 * não rasteriza de novo.
 *
 * Sem animação: o número acompanha cada pointermove, e movimento numa ação de
 * alta frequência só atrasa a leitura (skill emil-kowalski-ui-craft). Nada a
 * reduzir em `prefers-reduced-motion`.
 */
import { Container, Graphics, Text } from 'pixi.js'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'
import { SMART_GUIDE_LABEL_COLOR } from './constants'
import type { Point } from './world'

/** Quantos números cabem na tela de uma vez. Mais que isso vira poluição; as cotas continuam desenhadas. */
export const GUIDE_LABEL_POOL_SIZE = 8

/** Fonte do número, em px de TELA. */
export const GUIDE_LABEL_FONT_SCREEN_PX = 11

const LABEL_TEXT_COLOR = 0xffffff
/** Meio-negrito: 11 px branco sobre cor cheia some com o traço regular de Arial. */
const LABEL_FONT_WEIGHT = '600'
/** Respiro dos lados do texto, em px de tela. */
const LABEL_PAD_X_SCREEN_PX = 5
/** Altura da pílula em px de tela: a linha de 11 px e um respiro de 3 px em cima e embaixo. */
const LABEL_HEIGHT_SCREEN_PX = 17
/** Largura por caractere quando o Pixi não consegue medir (jsdom, sem canvas 2D): chute um pouco largo. */
const CHAR_WIDTH_PER_FONT = 0.62
/** Texto que mede a fonte na montagem: o formato de um número do mapa. */
const FONT_WARMUP_TEXT = '0,0 m'

export interface GuideLabel {
  /** Meio do vão, em px de mundo. */
  at: Point
  text: string
}

export interface GuideLabelPool {
  /**
   * Mostra um número por vão, na ordem dada (o primeiro ganha número primeiro),
   * até o tamanho do pool; esconde as sobras. `rendererResolution` é a do
   * renderer: com a escala 1/zoom o texto nunca é esticado, e rasterizar na
   * resolução do renderer basta para sair nítido.
   */
  show: (labels: readonly GuideLabel[], cameraScale: number, rendererResolution: number) => void
  /** Esconde todos. Chamar no fim do gesto, junto da limpeza das guias. */
  hide: () => void
}

interface LabelSlot {
  holder: Container
  plate: Graphics
  text: Text
  /** O texto que a pílula mede agora; `null` = nunca mostrado. */
  shown: string | null
}

function validPositive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}

/** Largura do texto medida pelo Pixi, ou `null` onde não dá para medir (jsdom não tem canvas 2D). */
function measuredWidth(text: Text): number | null {
  try {
    const width = text.getLocalBounds().width
    return Number.isFinite(width) && width > 0 ? width : null
  } catch {
    return null
  }
}

function textWidth(text: Text): number {
  return measuredWidth(text) ?? Math.max(1, text.text.length) * GUIDE_LABEL_FONT_SCREEN_PX * CHAR_WIDTH_PER_FONT
}

/** A pílula centrada no ponto do rótulo, em px de tela (o `holder` desfaz o zoom). */
function drawPlate(slot: LabelSlot): void {
  const width = textWidth(slot.text) + 2 * LABEL_PAD_X_SCREEN_PX
  const height = LABEL_HEIGHT_SCREEN_PX
  slot.plate.clear()
  slot.plate.roundRect(-width / 2, -height / 2, width, height, height / 2).fill({ color: SMART_GUIDE_LABEL_COLOR })
}

function createSlot(parent: Container): LabelSlot {
  const holder = new Container()
  const plate = new Graphics()
  const text = new Text({
    text: '',
    anchor: 0.5,
    // Quad no pixel físico inteiro: a textura sai 1:1, sem meia amostra de borda.
    roundPixels: true,
    style: {
      fontFamily: DEFAULT_TEXT_FONT_FAMILY,
      fontSize: GUIDE_LABEL_FONT_SCREEN_PX,
      fontWeight: LABEL_FONT_WEIGHT,
      fill: LABEL_TEXT_COLOR,
    },
  })
  holder.addChild(plate, text)
  holder.visible = false
  parent.addChild(holder)
  return { holder, plate, text, shown: null }
}

export function createGuideLabelPool(parent: Container, size = GUIDE_LABEL_POOL_SIZE): GuideLabelPool {
  const slots = Array.from({ length: size }, () => createSlot(parent))
  // Mede a fonte JÁ na montagem (a medida fica em cache por fonte): o custo
  // some no meio da montagem do canvas, e não no primeiro arrasto com número.
  const [first] = slots
  if (first !== undefined) {
    first.text.text = FONT_WARMUP_TEXT
    measuredWidth(first.text)
  }

  function show(labels: readonly GuideLabel[], cameraScale: number, rendererResolution: number): void {
    const scale = 1 / validPositive(cameraScale)
    const resolution = validPositive(rendererResolution)
    slots.forEach((slot, index) => {
      if (index >= labels.length) {
        slot.holder.visible = false
        return
      }
      const label = labels[index]
      if (slot.shown !== label.text) {
        slot.text.text = label.text
        drawPlate(slot)
        slot.shown = label.text
      }
      // Atribuir resolução rasteriza de novo: só quando muda.
      if (slot.text.resolution !== resolution) slot.text.resolution = resolution
      slot.holder.position.set(label.at.x, label.at.y)
      slot.holder.scale.set(scale)
      slot.holder.visible = true
    })
  }

  function hide(): void {
    for (const slot of slots) slot.holder.visible = false
  }

  return { show, hide }
}
