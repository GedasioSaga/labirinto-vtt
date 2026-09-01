import type { Graphics } from 'pixi.js'
import type { GridSettings } from '../types/map'
import { strokeDashedSegment, type GridLine, type Viewport } from './grid'

/**
 * `settings` vem direto de `MapData.gridSettings` (campo obrigatório desde a
 * Fase 0 — sempre presente, mapa antigo migra com os mesmos valores que este
 * arquivo hardcodava antes: `{ color: '#4a4a4a', opacity: 1, lineWidth: 1,
 * lineStyle: 'solid' }`, ver `lib/mapFile.ts`). Por isso não há default de
 * parâmetro aqui: duplicar o default nos dois lugares é como o `fillAlpha`
 * de círculo virou risco de regressão (PLANO-FASES.md §5.2) — um efeito
 * colateral divergir do outro silenciosamente.
 */
export function drawGrid(graphics: Graphics, lines: GridLine[], viewport: Viewport, settings: GridSettings): void {
  graphics.clear()
  if (lines.length === 0) return

  for (const line of lines) {
    if (line.axis === 'x') {
      strokeDashedSegment(graphics, line.position, viewport.top, line.position, viewport.bottom, settings.lineStyle)
    } else {
      strokeDashedSegment(graphics, viewport.left, line.position, viewport.right, line.position, settings.lineStyle)
    }
  }

  graphics.stroke({
    width: settings.lineWidth,
    color: settings.color,
    alpha: settings.opacity,
    // Pontilhado é desenhado como traços quase-zero (DOT_LENGTH em grid.ts);
    // cap 'round' é o que faz esses traços renderizarem como bolinhas em vez
    // de tracinhos retangulares minúsculos.
    cap: settings.lineStyle === 'dotted' ? 'round' : 'butt',
  })
}
