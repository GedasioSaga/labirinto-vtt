/**
 * Todas as coordenadas e distâncias (x, y, x1/y1/x2/y2, radius) estão em pixels
 * do mundo. `grid` define o tamanho de uma célula em pixels — é a unidade que
 * a UI usa para "1 quadrado", não uma unidade separada.
 */
export interface Wall {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  blocksLight: boolean
  blocksMove: boolean
  door: DoorState | null
  /**
   * Vínculo opcional com uma Região (ex.: a ferramenta Sala cria as 4 paredes
   * do contorno já vinculadas). Ambos `undefined` numa parede solta —
   * compatível com mapa salvo antigo, sem migração.
   *
   * Convenção: esta parede traça a aresta de `region.points[regionEdgeIndex]`
   * até `region.points[(regionEdgeIndex + 1) % region.points.length]`.
   *
   * Invariante: para um dado `regionId`, o conjunto de `regionEdgeIndex` em
   * uso é um SUBCONJUNTO de `0..n-1` — nunca presumido completo. Uma parede
   * vinculada continua apagável individualmente, deixando um "buraco" (aresta
   * sem parede) nesse conjunto.
   */
  regionId?: string
  regionEdgeIndex?: number
}

export interface DoorState {
  open: boolean
  locked: boolean
}

export interface Light {
  id: string
  x: number
  y: number
  radius: number
  color: string
  intensity: number
}

export interface RegionPoint {
  x: number
  y: number
}

export interface Region {
  id: string
  points: RegionPoint[]
  tag: string
  fillColor: string
  fillPattern: 'solid' | 'hatch'
  data: Record<string, unknown>
}

export interface Token {
  id: string
  characterId: string | null
  name: string
  x: number
  y: number
  size: number
}

export interface Prop {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
  linkedMapPath: string | null
}

export interface DrawingPoint {
  x: number
  y: number
}

export type Drawing =
  | { id: string; kind: 'freehand'; points: DrawingPoint[]; color: string; width: number }
  | { id: string; kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { id: string; kind: 'circle'; cx: number; cy: number; radius: number; color: string; width: number; filled: boolean }
  | { id: string; kind: 'curve'; points: DrawingPoint[]; color: string; width: number }
  | { id: string; kind: 'text'; x: number; y: number; text: string; color: string; fontSize: number; fontFamily?: string }

export interface FogState {
  mode: 'per-token' | 'none'
  revealed: string[]
}

export interface MapBackground {
  type: 'image' | 'color'
  src: string
}

export type GridShape = 'square' | 'hex'

export interface MapData {
  id: string
  name: string
  width: number
  height: number
  grid: number
  gridShape: GridShape
  showGrid: boolean
  background: MapBackground
  walls: Wall[]
  lights: Light[]
  regions: Region[]
  tokens: Token[]
  props: Prop[]
  drawings: Drawing[]
  fog: FogState
  ownerId: string | null
  scenarioLink: string | null
}
