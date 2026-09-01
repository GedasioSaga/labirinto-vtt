/**
 * Desenho da ferramenta "Selecionar área" (pedido N3): o retângulo tracejado
 * enquanto o usuário arrasta (`drawSelectionMarquee`) e o contorno sólido ao
 * redor do conjunto já selecionado, depois de soltar (`drawAreaSelectionOutline`).
 * Mesmo esqueleto dos outros `draw*Draft` deste diretório (`drawDraft.ts`):
 * `graphics.clear()` no início, sem estado próprio, chamado a cada redraw
 * pelo integrador (PixiCanvas.tsx).
 */
import type { Graphics } from 'pixi.js'
import type { Point } from './world'
import { SELECTION_COLOR } from './constants'
import type { AreaBounds, AreaRect } from '../lib/areaSelection'

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
