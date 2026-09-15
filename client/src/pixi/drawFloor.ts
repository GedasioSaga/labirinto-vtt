import { Color, type Graphics } from 'pixi.js'
import type { FloorPiece, FloorStyle, RegionPoint } from '../types/map'
import { buildFloorOutline, type FloorPolygon } from '../lib/floorContour'
import { SELECTION_COLOR, STROKE_WEIGHT } from './constants'

export interface FloorRenderer {
  draw: (graphics: Graphics, floor: FloorPiece[], style: FloorStyle, selectedPieceId?: string | null) => void
  /** Contorno da peça selecionada, isolada das outras; `null` limpa. */
  drawSelection: (graphics: Graphics, piece: FloorPiece | null, step?: number) => void
  /** Polígonos do último `draw` (cache por referência): a hachura e a máscara do piso reusam sem recalcular. */
  polygons: () => FloorPolygon[]
}

/** Prévia do arrasto com amostragem fixa: fluidez vale mais que o detalhe de 1 px aqui. */
const DRAFT_SAMPLE_STEP = 2
/** Prévia de peça 'subtract': escura, lê como "buraco" contra o verde do chão. */
const SUBTRACT_DRAFT_COLOR = 0x000000
const DRAFT_ALPHA = 0.35

function flatten(ring: RegionPoint[]): number[] {
  const out: number[] = new Array(ring.length * 2)
  ring.forEach((p, i) => {
    out[i * 2] = p.x
    out[i * 2 + 1] = p.y
  })
  return out
}

/** Preenche cada anel externo e recorta os buracos dele; contorno opcional por cima. */
export function paintFloor(graphics: Graphics, polygons: FloorPolygon[], style: FloorStyle): void {
  graphics.clear()
  const fill = new Color(style.fillColor).toNumber()
  for (const polygon of polygons) {
    graphics.poly(flatten(polygon.outer), true).fill({ color: fill })
    for (const hole of polygon.holes) graphics.poly(flatten(hole), true).cut()
  }
  if (style.strokeColor && style.strokeWidth > 0) {
    const stroke = new Color(style.strokeColor).toNumber()
    for (const polygon of polygons) {
      for (const ring of [polygon.outer, ...polygon.holes]) {
        graphics.poly(flatten(ring), true).stroke({ width: style.strokeWidth, color: stroke })
      }
    }
  }
}

/**
 * Contorno da peça SOZINHA — uma 'subtract' isolada não gera chão nenhum no
 * motor, então é contornada como se somasse; o que importa é a forma dela.
 */
function isolatedOutline(piece: FloorPiece, step: number | undefined): FloorPolygon[] {
  return buildFloorOutline([{ ...piece, op: 'add', hidden: false }], { step })
}

function strokeRings(graphics: Graphics, polygons: FloorPolygon[], width: number, alpha: number): void {
  for (const polygon of polygons) {
    for (const ring of [polygon.outer, ...polygon.holes]) {
      graphics.poly(flatten(ring), true).stroke({ width, color: SELECTION_COLOR, alpha })
    }
  }
}

/** Prévia ao vivo da peça sendo desenhada (arrasto ou corredor em construção). */
export function drawFloorDraft(graphics: Graphics, piece: FloorPiece, fillColor: string): void {
  graphics.clear()
  const polygons = isolatedOutline(piece, DRAFT_SAMPLE_STEP)
  const fill = piece.op === 'add' ? new Color(fillColor).toNumber() : SUBTRACT_DRAFT_COLOR
  for (const polygon of polygons) {
    graphics.poly(flatten(polygon.outer), true).fill({ color: fill, alpha: DRAFT_ALPHA })
    for (const hole of polygon.holes) graphics.poly(flatten(hole), true).cut()
  }
  strokeRings(graphics, polygons, STROKE_WEIGHT.medium, 0.8)
}

/**
 * Recalcula o contorno (caro) só quando a lista de peças muda de referência
 * — a store é imutável, então mesma referência = mesmo chão. Troca de estilo
 * ou de seleção só repinta.
 */
export function createFloorRenderer(): FloorRenderer {
  let lastFloor: FloorPiece[] | null = null
  let lastStep: number | undefined
  let polygons: FloorPolygon[] = []

  // Mesmo cache por referência para o destaque: redrawShapes roda a cada
  // mudança de seleção/forma, não só quando a peça selecionada muda.
  let lastSelected: FloorPiece | null = null
  let lastSelectedStep: number | undefined
  let selectedPolygons: FloorPolygon[] = []

  function draw(graphics: Graphics, floor: FloorPiece[], style: FloorStyle): void {
    if (floor !== lastFloor || style.sampleStep !== lastStep) {
      polygons = buildFloorOutline(floor, { step: style.sampleStep })
      lastFloor = floor
      lastStep = style.sampleStep
    }
    paintFloor(graphics, polygons, style)
  }

  function drawSelection(graphics: Graphics, piece: FloorPiece | null, step?: number): void {
    graphics.clear()
    if (!piece) {
      lastSelected = null
      selectedPolygons = []
      return
    }
    if (piece !== lastSelected || step !== lastSelectedStep) {
      selectedPolygons = isolatedOutline(piece, step)
      lastSelected = piece
      lastSelectedStep = step
    }
    strokeRings(graphics, selectedPolygons, STROKE_WEIGHT.medium, 1)
  }

  return { draw, drawSelection, polygons: () => polygons }
}
