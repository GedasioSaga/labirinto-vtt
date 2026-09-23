/**
 * Desenho da ferramenta "Selecionar área" (pedido N3): o retângulo tracejado
 * enquanto o usuário arrasta (`drawSelectionMarquee`) e o contorno sólido ao
 * redor do conjunto já selecionado, depois de soltar (`drawAreaSelectionOutline`).
 * Mesmo esqueleto dos outros `draw*Draft` deste diretório (`drawDraft.ts`):
 * `graphics.clear()` no início, sem estado próprio, chamado a cada redraw
 * pelo integrador (PixiCanvas.tsx).
 */
import { Text, type Container, type Graphics } from 'pixi.js'
import type { Point } from './world'
import { SELECTION_COLOR } from './constants'
import { marqueeHintPlacement, type AreaBounds, type AreaRect } from '../lib/areaSelection'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'

const MARQUEE_FILL_ALPHA = 0.12
const MARQUEE_STROKE_ALPHA = 0.9
const MARQUEE_STROKE_WIDTH = 1.5
const DASH_LENGTH = 6
const GAP_LENGTH = 4

/**
 * Traça de `a` até `b` alternando trecho/vão de comprimento fixo — PixiJS 8
 * não tem `dash` nativo em `Graphics.stroke` (confirmado em
 * `node_modules/pixi.js/lib/scene/graphics/shared/GraphicsContext.js`, sem
 * opção de dash na assinatura de `stroke`), então cada trecho vira seu
 * próprio par `moveTo`+`lineTo`, todos acumulados no mesmo `stroke()` no
 * final da chamada (mesma convenção de acumular path antes de UM stroke só,
 * ver `drawRegions.ts`).
 */
function dashedSegment(graphics: Graphics, a: Point, b: Point): void {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return
  const ux = dx / length
  const uy = dy / length
  const step = DASH_LENGTH + GAP_LENGTH
  for (let travelled = 0; travelled < length; travelled += step) {
    const dashEnd = Math.min(travelled + DASH_LENGTH, length)
    graphics.moveTo(a.x + ux * travelled, a.y + uy * travelled)
    graphics.lineTo(a.x + ux * dashEnd, a.y + uy * dashEnd)
  }
}

/**
 * Marquee VIVO durante o arrasto: retângulo semitransparente com borda
 * tracejada — o tracejado é o sinal visual de "isto ainda não é uma seleção
 * definitiva", diferente do contorno sólido de `drawAreaSelectionOutline`
 * (que aparece DEPOIS de soltar, com o grupo já fechado). Cor herda
 * `SELECTION_COLOR`, mesma convenção de todo `draw*Draft` deste diretório.
 * `rect` aceita `x2 < x1`/`y2 < y1` (arrasto em qualquer direção) — a
 * normalização pro canto superior-esquerdo é feita aqui dentro, igual
 * `drawRoomDraft`/`drawRectDraft` em `drawDraft.ts`.
 */
export function drawSelectionMarquee(graphics: Graphics, rect: AreaRect): void {
  graphics.clear()
  const x = Math.min(rect.x1, rect.x2)
  const y = Math.min(rect.y1, rect.y2)
  const w = Math.abs(rect.x2 - rect.x1)
  const h = Math.abs(rect.y2 - rect.y1)
  if (w === 0 || h === 0) return

  graphics.rect(x, y, w, h).fill({ color: SELECTION_COLOR, alpha: MARQUEE_FILL_ALPHA })

  const corners: Point[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ]
  for (let i = 0; i < 4; i += 1) {
    dashedSegment(graphics, corners[i], corners[(i + 1) % 4])
  }
  graphics.stroke({ width: MARQUEE_STROKE_WIDTH, color: SELECTION_COLOR, alpha: MARQUEE_STROKE_ALPHA })
}

/**
 * Contorno sólido ao redor do bounding box do CONJUNTO já selecionado
 * (`lib/areaSelection.ts` → `areaSelectionBounds`) — some ao começar um novo
 * arrasto de marquee (o integrador troca de `drawSelectionMarquee` pra isto
 * só depois do pointerup que fecha a seleção, e chama com `null` pra limpar
 * quando a seleção de área é descartada). Sem fill, sem tracejado:
 * visualmente distinto do marquee vivo, mesma lógica de "vazado = definitivo"
 * que `drawRegionHandles` (vértice preenchido) x ponto-médio (vazado) usa em
 * `drawEditHandles.ts`.
 */
export function drawAreaSelectionOutline(graphics: Graphics, bounds: AreaBounds | null): void {
  graphics.clear()
  if (!bounds) return
  const w = bounds.maxX - bounds.minX
  const h = bounds.maxY - bounds.minY
  if (w <= 0 || h <= 0) return
  graphics.rect(bounds.minX, bounds.minY, w, h).stroke({ width: 2, color: SELECTION_COLOR, alpha: 0.9 })
}

// ─────────────────────────────────────────────────────────────
// Dica "e como eu movo a vista, então?"
//
// A partir de 17/09/2026 arrastar em área vazia com a ferramenta Selecionar
// desenha o marquee — o gesto que ANTES panava a câmera. Trocar o significado
// de um gesto sem dizer nada é deixar a pessoa procurando o que sumiu, então
// a resposta aparece no único momento em que ela é pedida: enquanto o
// retângulo está aberto, dentro dele, do lado de onde o gesto começou.
//
// Some sozinha: ao soltar, e de vez depois que a pessoa usa qualquer um dos
// dois caminhos de pan (`PixiCanvas.tsx` para de chamar `show`). Dica que
// continua aparecendo depois de aprendida vira ruído.
// ─────────────────────────────────────────────────────────────

/** Os DOIS caminhos de pan que já existiam antes desta mudança e continuam
 *  valendo em qualquer ferramenta (`PixiCanvas.tsx`, pointerdown: `button === 1`
 *  e `spaceHeld`, os dois antes de qualquer if de ferramenta). */
export const MARQUEE_HINT_TEXT = 'Espaço ou botão do meio move a vista'

const HINT_FONT_SIZE = 13
/** Discreta de propósito: é rodapé do gesto, não o gesto. */
const HINT_ALPHA = 0.7

export interface MarqueeHintRenderer {
  /** Chamar a cada pointermove do marquee. `cameraScale` mantém a dica do
   *  mesmo tamanho na tela em qualquer zoom (mesma ideia de
   *  `screenLabelSizing`, aqui sem piso porque o texto nunca é conteúdo do
   *  mapa — ou cabe inteiro, ou não aparece). */
  show: (rect: AreaRect, cameraScale: number) => void
  hide: () => void
}

/**
 * Um `Text` por instância, criado JÁ no `setup()` do PixiCanvas e escondido —
 * nunca em escopo de módulo (StrictMode remonta e o objeto Pixi já foi
 * destruído), e nunca no primeiro `show()`: medir a fonte custou 91 ms de
 * long task no `ux-driver medir` de 17/09/2026, e 91 ms dentro do primeiro
 * arrasto é exatamente o lugar onde eles aparecem como engasgo. No `setup()`
 * o mesmo custo some no meio da montagem do canvas.
 *
 * `container` é onde a dica entra; quem chama passa o `world` DEPOIS do
 * `addChild` das outras camadas, pra dica ficar por cima (é o lugar de uma
 * dica).
 */
export function createMarqueeHintRenderer(container: Container): MarqueeHintRenderer {
  const label = new Text({
    text: MARQUEE_HINT_TEXT,
    style: { fontSize: HINT_FONT_SIZE, fill: SELECTION_COLOR, fontFamily: DEFAULT_TEXT_FONT_FAMILY },
  })
  label.alpha = HINT_ALPHA
  label.visible = false
  /** Tamanho do texto em px de TELA, medido UMA vez com escala 1 — depois
   *  disso `label.width` já vem multiplicado pela escala anti-zoom e não
   *  serviria para decidir se a dica cabe. */
  const labelScreenSize = { width: label.width, height: label.height }
  container.addChild(label)

  function show(rect: AreaRect, cameraScale: number): void {
    const placement = marqueeHintPlacement(rect, cameraScale, labelScreenSize)
    label.visible = placement.visible
    if (!placement.visible) return
    label.scale.set(1 / (Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1))
    label.position.set(placement.x, placement.y)
  }

  function hide(): void {
    label.visible = false
  }

  return { show, hide }
}
