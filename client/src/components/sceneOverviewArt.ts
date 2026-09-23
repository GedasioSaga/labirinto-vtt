import type { FloorPiece, MapData, Wall } from '../types/map'
import { buildFloorOutline, type FloorPolygon } from '../lib/floorContour'
import { isHidden } from '../lib/itemTransform'
import { isLayerVisible, visibleRegions, visibleTokens, visibleWalls } from '../lib/layers'
import { tokenFillColor } from '../lib/tokenColor'
import { DOOR_COLOR, DOOR_LENGTH_RATIO, DOOR_LOCKED_COLOR } from '../pixi/drawDoors'
import { buildColorLayers, type FloorColorLayer } from '../pixi/drawFloor'
import { mapBoundsRect } from '../pixi/drawMapBounds'
import { markerCorners, markerEllipsePoints } from '../pixi/drawMapLines'
import { clampWallWidth } from '../pixi/drawWalls'

/**
 * Desenho da MINIATURA de uma cena (visão geral das cenas, G14): o mesmo mapa
 * do editor, reduzido e no estilo minimapa — chão chapado, parede em linha fina
 * clara, porta em retângulo pequeno, ficha em disco da cor dela, sem grade e
 * sem hachura. Tudo em px de MUNDO: o SVG escala pelo `viewBox`, então o que
 * está no canto de cima à direita do mapa fica no canto de cima à direita da
 * miniatura.
 *
 * Fica de fora de propósito o que não se lê numa caixa de 200 px (escada,
 * peça, desenho, pino, luz, texto) e a imagem de fundo importada.
 */

/** Cor com que o editor limpa o canvas (`backgroundColor` do Pixi; ver MapPreview.tsx). */
const EDITOR_BACKGROUND = '#2b2b2b'
/** Render fiel (`floorStyle.renderMode: 'raster'`): o minimapa rasterizado tem fundo preto (PixiCanvas). */
const RASTER_BACKGROUND = '#000000'

/** A miniatura mais estreita, em px de tela: a coluna mínima da grade da janela, com a caixa 4:3. */
export const THUMB_MIN_WIDTH_PX = 200
const THUMB_MIN_HEIGHT_PX = 150

/**
 * Amostras do contorno do chão no lado maior do mapa. O editor amostra a cada
 * 2 px de mundo; numa caixa de 200 px isso seria calcular dezenas de vezes mais
 * pontos do que a tela mostra.
 */
const FLOOR_SAMPLES = 160
/** Passo do editor (`FloorStyle.sampleStep` ausente): a miniatura nunca amostra mais fino que ele. */
const EDITOR_FLOOR_STEP = 2
/** Menor raio da ficha na miniatura, em px de tela: abaixo disso a ficha some num mapa grande. */
const MIN_TOKEN_RADIUS_PX = 3
/** Espessura da porta na miniatura, em px de tela (no editor são 5 px, fixos na tela). */
const DOOR_THICKNESS_PX = 2
/** O disco do token sem foto é 2 px menor que a célula (`drawTokenCircle`, tokensRenderer.ts). */
const TOKEN_INSET = 2

export interface ArtFrame {
  x: number
  y: number
  width: number
  height: number
}

/** Uma cor e o caminho (`d` de SVG) de tudo o que é pintado com ela. */
export interface ArtShape {
  key: string
  d: string
  color: string
}

export interface ArtRegion extends ArtShape {
  /** `false` = sala sem fundo ("tirar o fundo"): só o contorno. */
  filled: boolean
  /** "Oculto para jogadores": o editor desenha esmaecido. */
  faded: boolean
}

export interface ArtWalls {
  key: string
  d: string
  /** Parede interna: mesma cor, mais transparente (`WALL_INTERIOR_ALPHA`). */
  interior: boolean
  /** Muralha com largura própria, em px de mundo; `null` = fio de planta (1 px de tela). */
  width: number | null
}

export interface ArtLines extends ArtShape {
  dotted: boolean
}

export interface ArtDoors extends ArtShape {
  /** Fechada ou trancada: retângulo cheio. Aberta: só o contorno. */
  filled: boolean
}

export interface ArtToken {
  id: string
  name: string
  cx: number
  cy: number
  /** Raio desenhado em px de mundo: o do editor, ou o mínimo legível na miniatura. */
  r: number
  color: string
  /** "Oculto no editor": o editor desenha um fantasma transparente. */
  ghost: boolean
}

export interface SceneArt {
  /** O `viewBox`: o retângulo do mapa, alargado pelo que foi desenhado fora dele. */
  frame: ArtFrame
  /** O retângulo do mapa (`width × grid` por `height × grid`); `null` em mapa sem dimensão válida. */
  mapRect: ArtFrame | null
  /** px de mundo por px de tela na miniatura mais estreita — base dos mínimos legíveis. */
  worldPerPx: number
  background: string
  /** O chão e, por cima, os caminhos com cor própria, na ordem de pintura. */
  floor: ArtShape[]
  /** Contorno do chão, quando o estilo do chão pede um. */
  floorEdge: ArtShape | null
  regions: ArtRegion[]
  lines: ArtLines[]
  markers: ArtShape[]
  walls: ArtWalls[]
  doors: ArtDoors[]
  tokens: ArtToken[]
}

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function emptyBox(): Box {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
}

function grow(box: Box, x: number, y: number, pad = 0): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  box.minX = Math.min(box.minX, x - pad)
  box.minY = Math.min(box.minY, y - pad)
  box.maxX = Math.max(box.maxX, x + pad)
  box.maxY = Math.max(box.maxY, y + pad)
}

/** Uma casa decimal: o `d` fica curto e a miniatura não perde nada que se veja. */
function num(value: number): string {
  return String(Math.round(value * 10) / 10)
}

function pathOf(points: readonly { x: number; y: number }[], closed: boolean): string {
  if (points.length < 2) return ''
  let d = `M${num(points[0].x)} ${num(points[0].y)}`
  for (let i = 1; i < points.length; i += 1) d += `L${num(points[i].x)} ${num(points[i].y)}`
  return closed ? `${d}Z` : d
}

/** `[x0, y0, x1, y1, …]` (formato do Pixi, `markerCorners`) → pontos. */
function pairs(flat: readonly number[]): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] })
  return points
}

function polygonsPath(polygons: readonly FloorPolygon[]): string {
  let d = ''
  for (const polygon of polygons) {
    d += pathOf(polygon.outer, true)
    for (const hole of polygon.holes) d += pathOf(hole, true)
  }
  return d
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/** Junta tudo o que tem o mesmo estilo num caminho só: a miniatura é um punhado de `<path>`, não um por parede. */
function groupInto<T extends { key: string; d: string }>(groups: Map<string, T>, key: string, d: string, make: () => T): void {
  if (d === '') return
  const found = groups.get(key)
  if (found) found.d += d
  else groups.set(key, { ...make(), key, d })
}

interface FloorOutline {
  step: number
  polygons: FloorPolygon[]
  layers: FloorColorLayer[]
}

/**
 * O contorno do chão é o cálculo caro da miniatura (campo de distância +
 * marching squares). A store é imutável: mesma lista de peças = mesmo chão.
 * Guardar por referência faz a janela reabrir na hora, e uma ficha andando
 * numa cena não recalcula o chão de nenhuma.
 */
const floorOutlines = new WeakMap<FloorPiece[], FloorOutline>()

function floorOutlineOf(floor: FloorPiece[], step: number): FloorOutline {
  const cached = floorOutlines.get(floor)
  if (cached && cached.step === step) return cached
  const outline = { step, polygons: buildFloorOutline(floor, { step }), layers: buildColorLayers(floor, step) }
  floorOutlines.set(floor, outline)
  return outline
}

function floorStepFor(map: MapData, mapRect: ArtFrame | null): number {
  const editorStep = map.floorStyle.sampleStep ?? EDITOR_FLOOR_STEP
  const side = mapRect ? Math.max(mapRect.width, mapRect.height) : 0
  return Math.max(editorStep, side / FLOOR_SAMPLES)
}

function tokenRadius(map: MapData, size: number): number {
  const cell = Number.isFinite(map.grid) && map.grid > 0 ? map.grid : 0
  const cells = Number.isFinite(size) && size > 0 ? size : 1
  return Math.max(0, (cell * cells) / 2 - TOKEN_INSET)
}

/** Largura própria da muralha (`thickness` numérico), ou `null` para os degraus nomeados. */
function wallWidth(wall: Wall): number | null {
  return typeof wall.thickness === 'number' && Number.isFinite(wall.thickness) ? clampWallWidth(wall.thickness) : null
}

/** Retângulo da porta no vão da parede: 60% do vão, espessura fixa na tela (como `drawDoors`). */
function doorPath(wall: Wall, thickness: number): string {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const length = Math.hypot(dx, dy)
  if (!(length > 0)) return ''
  const ux = dx / length
  const uy = dy / length
  const cx = (wall.x1 + wall.x2) / 2
  const cy = (wall.y1 + wall.y2) / 2
  const ax = (ux * length * DOOR_LENGTH_RATIO) / 2
  const ay = (uy * length * DOOR_LENGTH_RATIO) / 2
  const bx = (-uy * thickness) / 2
  const by = (ux * thickness) / 2
  return pathOf(
    [
      { x: cx - ax - bx, y: cy - ay - by },
      { x: cx + ax - bx, y: cy + ay - by },
      { x: cx + ax + bx, y: cy + ay + by },
      { x: cx - ax + bx, y: cy - ay + by },
    ],
    true,
  )
}

/**
 * A miniatura de `map`, ou `null` quando não há o que desenhar (mapa sem
 * dimensão válida e sem nada dentro). Respeita as camadas ocultas do editor:
 * a miniatura mostra o que o mestre veria ao abrir a cena.
 */
export function sceneArt(map: MapData): SceneArt | null {
  const hidden = map.hiddenLayers
  const bounds = mapBoundsRect(map)
  const mapRect = bounds ? { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY } : null
  const content = emptyBox()

  const floorVisible = isLayerVisible(hidden, 'salas') && map.floor.length > 0
  const outline = floorVisible ? floorOutlineOf(map.floor, floorStepFor(map, mapRect)) : null
  if (outline) {
    for (const polygon of outline.polygons) for (const p of polygon.outer) grow(content, p.x, p.y)
  }

  const regions = visibleRegions(map.regions, hidden).filter((region) => region.points.length >= 3)
  for (const region of regions) for (const p of region.points) grow(content, p.x, p.y)

  const walls = visibleWalls(map.walls, hidden)
  for (const wall of walls) {
    grow(content, wall.x1, wall.y1)
    grow(content, wall.x2, wall.y2)
  }

  // Traço de minimapa mora na camada Paredes, e o marcador (porta de minimapa) na Portas, como no editor.
  const lines: MapData['lines'] = isLayerVisible(hidden, 'paredes') ? map.lines : []
  for (const line of lines) for (const p of line.points) grow(content, p.x, p.y)

  const markers: MapData['markers'] = isLayerVisible(hidden, 'portas') ? map.markers : []
  const markerPoints = markers.map((marker) => ({
    color: marker.color,
    points: pairs(marker.shape === 'ellipse' ? markerEllipsePoints(marker) : markerCorners(marker)),
  }))
  for (const marker of markerPoints) for (const p of marker.points) grow(content, p.x, p.y)

  const tokens = visibleTokens(map.tokens, hidden)
  for (const token of tokens) grow(content, token.x, token.y, tokenRadius(map, token.size))

  const box = emptyBox()
  if (bounds) {
    grow(box, bounds.minX, bounds.minY)
    grow(box, bounds.maxX, bounds.maxY)
  }
  if (content.minX <= content.maxX) {
    grow(box, content.minX, content.minY)
    grow(box, content.maxX, content.maxY)
  }
  const width = box.maxX - box.minX
  const height = box.maxY - box.minY
  if (!(width > 0) || !(height > 0)) return null
  const frame = { x: box.minX, y: box.minY, width, height }
  const worldPerPx = Math.max(width / THUMB_MIN_WIDTH_PX, height / THUMB_MIN_HEIGHT_PX)

  const floor: ArtShape[] = []
  let floorEdge: ArtShape | null = null
  if (outline) {
    const base = polygonsPath(outline.polygons)
    if (base !== '') floor.push({ key: 'chao', d: base, color: map.floorStyle.fillColor })
    outline.layers.forEach((layer, index) => {
      const d = polygonsPath(layer.polygons)
      if (d !== '') floor.push({ key: `caminho-${index}`, d, color: layer.color })
    })
    const { strokeColor, strokeWidth } = map.floorStyle
    if (strokeColor && strokeWidth > 0 && base !== '') floorEdge = { key: 'contorno', d: base, color: strokeColor }
  }

  const lineGroups = new Map<string, ArtLines>()
  for (const line of lines) {
    groupInto(lineGroups, `${line.color}|${line.dotted}`, pathOf(line.points, line.closed), () => ({ key: '', d: '', color: line.color, dotted: line.dotted }))
  }

  const markerGroups = new Map<string, ArtShape>()
  for (const marker of markerPoints) {
    groupInto(markerGroups, marker.color, pathOf(marker.points, true), () => ({ key: '', d: '', color: marker.color }))
  }

  const wallGroups = new Map<string, ArtWalls>()
  const doorGroups = new Map<string, ArtDoors>()
  const doorThickness = DOOR_THICKNESS_PX * worldPerPx
  for (const wall of walls) {
    const door = wall.door
    if (door) {
      // Como no editor: a linha da parede com porta não é desenhada, o vão é da porta.
      const filled = door.locked || !door.open
      const color = hex(door.locked ? DOOR_LOCKED_COLOR : DOOR_COLOR)
      groupInto(doorGroups, `${color}|${filled}`, doorPath(wall, doorThickness), () => ({ key: '', d: '', color, filled }))
      continue
    }
    const interior = wall.wallKind === 'interior'
    const width = wallWidth(wall)
    groupInto(wallGroups, `${interior}|${width}`, pathOf([{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }], false), () => ({ key: '', d: '', interior, width }))
  }

  const minRadius = MIN_TOKEN_RADIUS_PX * worldPerPx
  return {
    frame,
    mapRect,
    worldPerPx,
    background: map.floorStyle.renderMode === 'raster' ? RASTER_BACKGROUND : EDITOR_BACKGROUND,
    floor,
    floorEdge,
    regions: regions.map((region) => ({
      key: region.id,
      d: pathOf(region.points, true),
      color: region.fillColor,
      filled: region.filled !== false,
      faded: region.secret === true,
    })),
    lines: [...lineGroups.values()],
    markers: [...markerGroups.values()],
    walls: [...wallGroups.values()],
    doors: [...doorGroups.values()],
    tokens: tokens.map((token) => ({
      id: token.id,
      name: token.name,
      cx: token.x,
      cy: token.y,
      r: Math.max(tokenRadius(map, token.size), minRadius),
      color: hex(tokenFillColor(token)),
      ghost: isHidden(token),
    })),
  }
}
