import type { GridSettings, GridShape } from '../types/map'
import type { SnapTargetKind, SnapTargets } from '../pixi/grid'
import { GridShapePicker } from './GridShapePicker'
import { Toggle } from './Toggle'

const LINE_STYLES: Array<{ value: GridSettings['lineStyle']; label: string }> = [
  { value: 'solid', label: 'Sólida' },
  { value: 'dashed', label: 'Tracejada' },
  { value: 'dotted', label: 'Pontilhada' },
]

/**
 * Array explícito (não `Object.keys(SNAP_TARGET_LABELS)`) para não precisar
 * de `as SnapTargetKind[]` — `Object.keys` sempre tipa como `string[]`,
 * mesmo vindo de um `Record` com union de chaves fechada.
 */
const SNAP_TARGET_ORDER: SnapTargetKind[] = ['token', 'wall', 'prop']

const SNAP_TARGET_LABELS: Record<SnapTargetKind, string> = {
  token: 'Grudar Token no centro',
  wall: 'Grudar Parede na grade',
  prop: 'Grudar Objeto na grade',
}

export interface GridControlsProps {
  showGrid: boolean
  onShowGridChange: (show: boolean) => void
  gridShape: GridShape
  onGridShapeChange: (shape: GridShape) => void
  /**
   * Substitui o antigo `snapEnabled` único: cada alvo (Token/Parede/Objeto)
   * liga o snap independentemente. Token gruda no CENTRO da célula; Parede
   * e Objeto grudam no VÉRTICE/aresta — a regra vive em
   * `pixi/tokenInteraction.ts` (`snapPointForTarget`), não aqui.
   */
  snapTargets: SnapTargets
  onSnapTargetChange: (kind: SnapTargetKind, on: boolean) => void
  gridSettings: GridSettings
  onGridSettingsChange: (patch: Partial<GridSettings>) => void
}

/** Visibilidade, formato, estilo visual e snap por alvo da grade. */
export function GridControls({
  showGrid,
  onShowGridChange,
  gridShape,
  onGridShapeChange,
  snapTargets,
  onSnapTargetChange,
  gridSettings,
  onGridSettingsChange,
}: GridControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Grade</h2>
      <Toggle label="Mostrar grade" checked={showGrid} onChange={onShowGridChange} />

      {SNAP_TARGET_ORDER.map((kind) => (
        <Toggle
          key={kind}
          label={SNAP_TARGET_LABELS[kind]}
          checked={snapTargets[kind]}
          onChange={(on) => onSnapTargetChange(kind, on)}
        />
      ))}

      <div className="lb-field">
        <span className="lb-label">Formato</span>
        <GridShapePicker value={gridShape} onChange={onGridShapeChange} groupLabel="Formato da grade" />
      </div>

      <div className="lb-section__row">
        <label className="lb-label" htmlFor="lb-grid-color">
          Cor da grade
        </label>
        <input
          id="lb-grid-color"
          className="lb-swatch"
          type="color"
          value={gridSettings.color}
          onChange={(event) => onGridSettingsChange({ color: event.target.value })}
        />
      </div>

      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-grid-opacity">
            Opacidade
          </label>
          <span className="lb-num">{Math.round(gridSettings.opacity * 100)}%</span>
        </div>
        <input
          id="lb-grid-opacity"
          className="lb-range"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={gridSettings.opacity}
          onChange={(event) => onGridSettingsChange({ opacity: Number(event.target.value) })}
        />
      </div>

      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-grid-linewidth">
            Espessura
          </label>
          <span className="lb-num">{gridSettings.lineWidth} px</span>
        </div>
        <input
          id="lb-grid-linewidth"
          className="lb-range"
          type="range"
          min={1}
          max={6}
          step={1}
          value={gridSettings.lineWidth}
          onChange={(event) => onGridSettingsChange({ lineWidth: Number(event.target.value) })}
        />
      </div>

      <div className="lb-field">
        <span className="lb-label">Estilo da linha</span>
        <div className="lb-seg" role="radiogroup" aria-label="Estilo da linha da grade">
          {LINE_STYLES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={gridSettings.lineStyle === value}
              className="lb-seg__option"
              onClick={() => onGridSettingsChange({ lineStyle: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
