import type { GridShape } from '../types/map'
import { GridShapePicker } from './GridShapePicker'
import { Toggle } from './Toggle'

export interface GridControlsProps {
  showGrid: boolean
  onShowGridChange: (show: boolean) => void
  gridShape: GridShape
  onGridShapeChange: (shape: GridShape) => void
  snapEnabled: boolean
  onSnapEnabledChange: (enabled: boolean) => void
}

/** Visibilidade, formato e travamento da grade. */
export function GridControls({
  showGrid,
  onShowGridChange,
  gridShape,
  onGridShapeChange,
  snapEnabled,
  onSnapEnabledChange,
}: GridControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Grade</h2>
      <Toggle label="Mostrar grade" checked={showGrid} onChange={onShowGridChange} />
      <Toggle label="Travar na grade" checked={snapEnabled} onChange={onSnapEnabledChange} />
      <div className="lb-field">
        <span className="lb-label">Formato</span>
        <GridShapePicker value={gridShape} onChange={onGridShapeChange} groupLabel="Formato da grade" />
      </div>
    </section>
  )
}
