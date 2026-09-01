import type { Graphics } from 'pixi.js'
import type { GridSettings } from '../types/map'
import type { TriEdge } from './triGrid'
import { strokeDashedSegment } from './grid'

/**
 * Assinatura difere de `drawHexGrid`/`drawGrid` de propósito: aquelas recebem
 * "centros"/"linhas" e calculam a geometria (cantos do hexágono, extremos da
 * linha) dentro da própria função de desenho. Uma malha triangular é
 * naturalmente uma lista de ARESTAS (segmento entre 2 vértices) — não faz
 * sentido computar de novo aqui o que `computeVisibleTriEdges` (triGrid.ts)
 * já devolve pronto, então esta função só percorre e traça.
 *
 * Ver comentário no topo de `drawGrid.ts` sobre não ter default de
 * `settings`: mesmo motivo — duplicar o default aqui e no schema diverge em
 * silêncio.
 */
export function drawTriGrid(graphics: Graphics, edges: TriEdge[], settings: GridSettings): void {
  graphics.clear()
  if (edges.length === 0) return

  for (const edge of edges) {
    strokeDashedSegment(graphics, edge.a.x, edge.a.y, edge.b.x, edge.b.y, settings.lineStyle)
  }

  graphics.stroke({
    width: settings.lineWidth,
    color: settings.color,
    alpha: settings.opacity,
    cap: settings.lineStyle === 'dotted' ? 'round' : 'butt',
  })
}
