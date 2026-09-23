import { Container, Graphics, Text } from 'pixi.js'
import type { ConcealZone } from '../types/map'
import { concealZoneLabel } from '../lib/concealZones'
import { concealedPieces, unveiledCellsOf } from '../lib/concealBrush'
import { computeHatchSegments } from './drawRegions'
import { roomLabelAnchor, roomLabelFontSize } from './drawRoomNames'
import { SELECTION_COLOR } from './constants'

export interface ConcealZonesRenderer {
  draw: (container: Container, zones: ConcealZone[], grid: number, selectedId: string | null) => void
}

const ZONE_COLOR = 0x000000
/** Ativa: escura o bastante para o mestre ler "isto o jogador não vê", sem apagar o que está embaixo. */
const ACTIVE_FILL_ALPHA = 0.45
const HATCH_COLOR = 0xffffff
const HATCH_ALPHA = 0.25
const HATCH_WIDTH = 1
const OUTLINE_COLOR = 0xdddddd
const OUTLINE_WIDTH = 2
const SELECTED_OUTLINE_WIDTH = 3
/** Revelada: só o contorno fraco, para o mestre achar e esconder de novo. */
const REVEALED_ALPHA = 0.35
const LABEL_FILL = 0xffffff
const LABEL_STROKE = 0x000000

/**
 * Overlay das zonas ocultas no editor (A5): preto translúcido hachurado com o
 * nome no centro. Nada disto vai para o jogador; ele recebe só os polígonos
 * ativos em `snapshot.concealed` e pinta preto opaco.
 * Um Graphics para todas as zonas e Text por id que NUNCA é destruído (mesmo
 * motivo de `drawRoomNames.ts`: Pixi 8.20 quebra em TexturePool.returnTexture).
 */
export function createConcealZonesRenderer(): ConcealZonesRenderer {
  const graphics = new Graphics()
  const labels = new Map<string, Text>()
  const styledFontSize = new Map<string, number>()

  function draw(container: Container, zones: ConcealZone[], grid: number, selectedId: string | null): void {
    if (graphics.parent !== container) container.addChildAt(graphics, 0)
    graphics.clear()

    const drawable = zones.filter((z) => z.points.length >= 3)
    const ids = new Set(drawable.map((z) => z.id))
    for (const [id, label] of labels) {
      if (!ids.has(id)) label.visible = false
    }

    const fontSize = roomLabelFontSize(grid)
    for (const zone of drawable) {
      const selected = zone.id === selectedId
      // Pincel de revelar: o pedaço pintado sai do escurecido, igual ao buraco
      // que o jogador recebe no preto (`lib/fogFilter.ts`). Hachura só na zona
      // sem pedaço revelado: riscada por cima de faixas finas, ela esconderia
      // justamente o corredor que o mestre acabou de abrir.
      const unveiled = zone.revealed ? 0 : unveiledCellsOf(zone).size
      if (!zone.revealed) {
        const pieces = unveiled > 0 ? concealedPieces(zone.points, unveiledCellsOf(zone)) : [zone.points]
        for (const piece of pieces) graphics.poly(piece, true)
        if (pieces.length > 0) graphics.fill({ color: ZONE_COLOR, alpha: ACTIVE_FILL_ALPHA })
      }
      graphics.poly(zone.points, true)
      graphics.stroke({
        width: selected ? SELECTED_OUTLINE_WIDTH : OUTLINE_WIDTH,
        color: selected ? SELECTION_COLOR : OUTLINE_COLOR,
        alpha: zone.revealed && !selected ? REVEALED_ALPHA : 1,
      })
      if (!zone.revealed && unveiled === 0) {
        const segments = computeHatchSegments(zone.points)
        for (const s of segments) graphics.moveTo(s.x1, s.y1).lineTo(s.x2, s.y2)
        if (segments.length > 0) graphics.stroke({ width: HATCH_WIDTH, color: HATCH_COLOR, alpha: HATCH_ALPHA })
      }

      let label = labels.get(zone.id)
      if (!label) {
        label = new Text()
        label.anchor.set(0.5)
        labels.set(zone.id, label)
      }
      if (label.parent !== container) container.addChild(label)
      if (styledFontSize.get(zone.id) !== fontSize) {
        styledFontSize.set(zone.id, fontSize)
        label.style = { fontSize, fill: LABEL_FILL, stroke: { color: LABEL_STROKE, width: Math.max(2, fontSize / 6) }, align: 'center' }
      }
      const anchor = roomLabelAnchor(zone.points)
      label.text = concealZoneLabel(zone)
      label.position.set(anchor.x, anchor.y)
      label.alpha = zone.revealed ? REVEALED_ALPHA : 1
      label.visible = true
    }
  }

  return { draw }
}
