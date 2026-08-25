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
}

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
  fog: FogState
  ownerId: string | null
  scenarioLink: string | null
}
