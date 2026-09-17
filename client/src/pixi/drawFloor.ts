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

/**
 * Uma cor de caminho já resolvida em polígonos. Ver `buildColorLayers`: o
 * contorno do chão continua sendo UM só (o da união de todas as peças), e isto
 * aqui é só a pintura por dentro dele.
 */
export interface FloorColorLayer {
  color: string
  polygons: FloorPolygon[]
}

function fillPolygons(graphics: Graphics, polygons: FloorPolygon[], color: string): void {
  const fill = new Color(color).toNumber()
  for (const polygon of polygons) {
    graphics.poly(flatten(polygon.outer), true).fill({ color: fill })
    for (const hole of polygon.holes) graphics.poly(flatten(hole), true).cut()
  }
}

/**
 * Preenche cada anel externo e recorta os buracos dele; os caminhos com cor
 * própria por cima, e o contorno opcional por último.
 *
 * A ordem importa: a cor do caminho entra ANTES do contorno para não comer
 * metade da linha de parede onde os dois encostam — a parede é uma só e fica
 * por cima de tudo.
 */
export function paintFloor(
  graphics: Graphics,
  polygons: FloorPolygon[],
  style: FloorStyle,
  colorLayers: readonly FloorColorLayer[] = [],
): void {
  graphics.clear()
  fillPolygons(graphics, polygons, style.fillColor)
  for (const layer of colorLayers) fillPolygons(graphics, layer.polygons, layer.color)
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
 * Polígonos de cada peça que tem cor própria (`FloorPiece.fillColor`), na ordem
 * da lista — peça mais nova pinta por cima da mais velha, igual ao motor do
 * chão.
 *
 * Cada peça é contornada SOZINHA, e não junto com as vizinhas, de propósito: o
 * chão inteiro já foi pintado e contornado uma vez, e o que falta é só a mancha
 * de cor por dentro. Contornar junto devolveria a costura entre um caminho e o
 * chão ao lado dele.
 *
 * As peças 'subtract' que vêm DEPOIS entram no cálculo: um buraco aberto em
 * cima do caminho tem de abrir na cor dele também, senão a borracha deixaria a
 * cor flutuando sobre o vazio.
 */
export function buildColorLayers(floor: FloorPiece[], step: number | undefined): FloorColorLayer[] {
  const layers: FloorColorLayer[] = []
  for (let i = 0; i < floor.length; i += 1) {
    const piece = floor[i]
    if (piece.hidden || piece.op !== 'add' || piece.fillColor === undefined) continue
    const buracosDepois = floor.slice(i + 1).filter((p) => p.op === 'subtract' && !p.hidden)
    layers.push({ color: piece.fillColor, polygons: buildFloorOutline([piece, ...buracosDepois], { step }) })
  }
  return layers
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
  let colorLayers: FloorColorLayer[] = []

  // Mesmo cache por referência para o destaque: redrawShapes roda a cada
  // mudança de seleção/forma, não só quando a peça selecionada muda.
  let lastSelected: FloorPiece | null = null
  let lastSelectedStep: number | undefined
  let selectedPolygons: FloorPolygon[] = []

  function draw(graphics: Graphics, floor: FloorPiece[], style: FloorStyle): void {
    if (floor !== lastFloor || style.sampleStep !== lastStep) {
      polygons = buildFloorOutline(floor, { step: style.sampleStep })
      colorLayers = buildColorLayers(floor, style.sampleStep)
      lastFloor = floor
      lastStep = style.sampleStep
    }
    paintFloor(graphics, polygons, style, colorLayers)
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

/**
 * Prévia ao vivo do pincel de blocos: as células já tocadas, pintadas uma a
 * uma.
 *
 * NÃO passa pelo contorno por campo de distância (`buildFloorOutline`) como as
 * outras prévias deste arquivo, de propósito: ele roda a cada pointermove, e
 * célula quadrada não precisa de marching squares para ser desenhada. O que a
 * pessoa vê é o mesmo — quadrado cheio, borda na grade —, e o gesto continua
 * fluido enquanto ela arrasta por dezenas de células.
 */
export function drawBlocosDraft(
  graphics: Graphics,
  blocos: readonly { col: number; row: number }[],
  cell: number,
  fillColor: string,
  apagando: boolean,
): void {
  graphics.clear()
  const fill = apagando ? SUBTRACT_DRAFT_COLOR : new Color(fillColor).toNumber()
  for (const bloco of blocos) {
    graphics.rect(bloco.col * cell, bloco.row * cell, cell, cell).fill({ color: fill, alpha: DRAFT_ALPHA })
  }
  // Uma borda por célula ficaria com costura; o contorno do traço é o conjunto
  // dos quadrados, e o realce fraco em cima basta para ele se ler como prévia.
  for (const bloco of blocos) {
    graphics
      .rect(bloco.col * cell, bloco.row * cell, cell, cell)
      .stroke({ width: STROKE_WEIGHT.thin, color: SELECTION_COLOR, alpha: 0.35 })
  }
}
