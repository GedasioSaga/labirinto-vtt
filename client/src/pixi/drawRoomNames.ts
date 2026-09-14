import { Container, Text } from 'pixi.js'
import type { Region, RegionPoint } from '../types/map'

export interface RoomNamesRenderer {
  draw: (container: Container, regions: Region[], grid: number) => void
}

const FONT_SIZE_PER_GRID = 0.3
const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 28
// Abaixo disso o polígono é praticamente uma linha ou um ponto: o centróide
// por área divide por ~0 e explode, então vale a média dos vértices.
const DEGENERATE_AREA_EPSILON = 1e-6
const LABEL_FILL = 0xffffff
const LABEL_STROKE = 0x111111

/** Centróide por área (fórmula do shoelace). Para polígono côncavo (sala em L)
 * a média dos vértices puxa o rótulo para o lado com mais cantos; o centróide
 * de área não. Pontos degenerados (área ~0) caem na média simples. */
export function roomLabelAnchor(points: RegionPoint[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 }
  let doubleArea = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const cross = a.x * b.y - b.x * a.y
    doubleArea += cross
    cx += (a.x + b.x) * cross
    cy += (a.y + b.y) * cross
  }
  if (Math.abs(doubleArea) < DEGENERATE_AREA_EPSILON) {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
    return { x: sum.x / points.length, y: sum.y / points.length }
  }
  return { x: cx / (3 * doubleArea), y: cy / (3 * doubleArea) }
}

export function roomLabelFontSize(grid: number): number {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, grid * FONT_SIZE_PER_GRID))
}

/** Cache de Text por id, fechado por closure (instanciar uma vez por mount).
 * NUNCA destrói Text durante a sessão: Text destruído antes de renderizar
 * derruba o Pixi 8.20 em TexturePool.returnTexture (ver PlayerView.tsx).
 * Região que some ou perde o nome só fica invisível; tudo morre no app.destroy. */
export function createRoomNamesRenderer(): RoomNamesRenderer {
  const cache = new Map<string, Text>()
  const styledFontSize = new Map<string, number>()

  function draw(container: Container, regions: Region[], grid: number): void {
    const named = regions.filter((r) => r.room !== undefined && r.room.name.trim() !== '')
    const namedIds = new Set(named.map((r) => r.id))
    for (const [id, textObj] of cache) {
      if (!namedIds.has(id)) textObj.visible = false
    }

    const fontSize = roomLabelFontSize(grid)
    for (const region of named) {
      let textObj = cache.get(region.id)
      if (!textObj) {
        textObj = new Text()
        textObj.anchor.set(0.5)
        cache.set(region.id, textObj)
      }
      // Container pode ter sido trocado entre redraws; addChild reparenta sem duplicar.
      if (textObj.parent !== container) container.addChild(textObj)
      const anchor = roomLabelAnchor(region.points)
      textObj.text = region.room?.name ?? ''
      textObj.position.set(anchor.x, anchor.y)
      // redrawShapes dispara a cada mudança do mapa; recriar o estilo toda vez
      // força o Pixi a re-rasterizar o texto mesmo sem nada ter mudado.
      // Compara com o último tamanho aplicado, não com style.fontSize: o default
      // do Pixi (26) coincide com grid ~86,7 e deixaria o texto preto sem contorno.
      if (styledFontSize.get(region.id) !== fontSize) {
        styledFontSize.set(region.id, fontSize)
        textObj.style = {
          fontSize,
          fill: LABEL_FILL,
          stroke: { color: LABEL_STROKE, width: Math.max(2, fontSize / 6) },
          align: 'center',
        }
      }
      textObj.visible = true
    }
  }

  return { draw }
}
