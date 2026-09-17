export type DrawingTool =
  | 'select'
  | 'wall'
  | 'door'
  | 'light'
  | 'region'
  | 'room'
  | 'roomCircle'
  | 'roomPolygon'
  | 'roomFree'
  | 'stair'
  | 'token'
  | 'prop'
  | 'brush'
  | 'line'
  | 'circle'
  | 'ellipse'
  | 'rect'
  | 'polygon'
  | 'curve'
  | 'text'
  | 'measure'
  | 'eraser'
  | 'floor'
  | 'concealZone'
  | 'pin'

export type SelectionKind = 'token' | 'wall' | 'light' | 'region' | 'stair' | 'prop' | 'drawing' | 'floor'

export interface Selection {
  kind: SelectionKind
  id: string
}
