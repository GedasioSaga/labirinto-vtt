export type DrawingTool = 'select' | 'wall' | 'light' | 'region' | 'prop' | 'brush' | 'line' | 'circle' | 'curve'

export type SelectionKind = 'token' | 'wall' | 'light' | 'region' | 'prop' | 'drawing'

export interface Selection {
  kind: SelectionKind
  id: string
}
