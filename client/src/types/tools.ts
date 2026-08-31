export type DrawingTool = 'select' | 'wall' | 'door' | 'light' | 'region' | 'room' | 'roomCircle' | 'roomPolygon' | 'prop' | 'brush' | 'line' | 'circle' | 'curve' | 'text' | 'eraser'

export type SelectionKind = 'token' | 'wall' | 'light' | 'region' | 'prop' | 'drawing'

export interface Selection {
  kind: SelectionKind
  id: string
}
