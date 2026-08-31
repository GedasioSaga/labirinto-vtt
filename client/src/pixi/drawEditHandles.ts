import type { Graphics } from 'pixi.js'
import type { MapData, RegionPoint } from '../types/map'
import type { Selection, DrawingTool } from '../types/tools'
import { regionEdgeMidpoints } from '../lib/roomLink'
import { SELECTION_COLOR } from './constants'

const VERTEX_RADIUS = 5
const MIDPOINT_RADIUS = 4

/**
 * Vértice: círculo preenchido. Ponto médio de aresta: círculo vazado (só
 * stroke, sem fill) — mesma distinção visual usada pelo draft de Região
 * (`drawRegionDraft`) e pelos handles de Curva em `drawDrawings.ts`.
 */
function drawRegionHandles(graphics: Graphics, points: RegionPoint[]): void {
  for (const point of points) {
    graphics.circle(point.x, point.y, VERTEX_RADIUS).fill({ color: SELECTION_COLOR })
  }
  for (const midpoint of regionEdgeMidpoints(points)) {
    graphics.circle(midpoint.x, midpoint.y, MIDPOINT_RADIUS).stroke({ width: 2, color: SELECTION_COLOR })
  }
}

/**
 * Handles de edição de vértice/aresta para Parede, Região e Linha (Drawing
 * kind 'line') — só aparecem com a ferramenta Selecionar ativa e algo
 * relevante selecionado. Uma Parede vinculada a uma Região (`wall.regionId`
 * definido, caso da ferramenta Sala) delega para os handles da região dona
 * inteira, é assim que "clicar na parede da sala mostra os vértices da sala
 * inteira" se comporta. A Curva mantém seu próprio mecanismo de handle em
 * `drawDrawings.ts` — não mexer.
 */
export function drawEditHandles(graphics: Graphics, map: MapData, selection: Selection | null, activeTool: DrawingTool): void {
  graphics.clear()
  if (activeTool !== 'select' || !selection) return

  if (selection.kind === 'region') {
    const region = map.regions.find((r) => r.id === selection.id)
    if (region) drawRegionHandles(graphics, region.points)
    return
  }

  if (selection.kind === 'wall') {
    const wall = map.walls.find((w) => w.id === selection.id)
    if (!wall) return

    if (wall.regionId !== undefined) {
      const region = map.regions.find((r) => r.id === wall.regionId)
      if (region) drawRegionHandles(graphics, region.points)
      return
    }

    graphics.circle(wall.x1, wall.y1, VERTEX_RADIUS).fill({ color: SELECTION_COLOR })
    graphics.circle(wall.x2, wall.y2, VERTEX_RADIUS).fill({ color: SELECTION_COLOR })
    return
  }

  if (selection.kind === 'drawing') {
    const drawing = map.drawings.find((d) => d.id === selection.id)
    if (!drawing || drawing.kind !== 'line') return

    graphics.circle(drawing.x1, drawing.y1, VERTEX_RADIUS).fill({ color: SELECTION_COLOR })
    graphics.circle(drawing.x2, drawing.y2, VERTEX_RADIUS).fill({ color: SELECTION_COLOR })
  }
}
