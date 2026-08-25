export type DrawingTool = 'select' | 'wall' | 'light' | 'region' | 'prop'

export type SelectionKind = 'token' | 'wall' | 'light' | 'region' | 'prop'

export interface Selection {
  kind: SelectionKind
  id: string
}
