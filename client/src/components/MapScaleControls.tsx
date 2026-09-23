import type { GridShape, MapScale, MeasurementMode } from '../types/map'
import { MAX_MEASUREMENT_PRECISION, MEASUREMENT_MODE_LABELS, measurementModesForShape } from '../lib/measurement'

export interface MapScaleControlsProps {
  scale: MapScale
  onScaleChange: (patch: Partial<MapScale>) => void
  measurementMode: MeasurementMode
  onMeasurementModeChange: (mode: MeasurementMode) => void
  /** Filtra as opções do modo de medição — ver measurementModesForShape
   *  (lib/measurement.ts). Vem de `map.gridShape`, não editável aqui. */
  gridShape: GridShape
}

/**
 * Escala do mapa (unidades por célula, texto livre da unidade, casas
 * decimais do rótulo) e modo de medição da régua efêmera. Painel de mapa,
 * não de item selecionado — mesma classe de GridControls: fica sempre
 * visível, independente de seleção ou ferramenta ativa.
 *
 * As opções de `measurementMode` mudam com `gridShape` (só 'hex'+'euclidean'
 * em grade hex; os outros 4 em grade quadrada) — nunca oferecer aqui um modo
 * que `measurementModesForShape` não devolveu pro formato atual.
 */
export function MapScaleControls({
  scale,
  onScaleChange,
  measurementMode,
  onMeasurementModeChange,
  gridShape,
}: MapScaleControlsProps) {
  const modes = measurementModesForShape(gridShape)

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Medição</h2>

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-scale-units">
          Unidades por célula
        </label>
        <input
          id="lb-scale-units"
          className="lb-input"
          type="number"
          min={0.1}
          step={0.5}
          value={scale.unitsPerCell}
          onChange={(event) => onScaleChange({ unitsPerCell: Number(event.target.value) })}
        />
      </div>

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-scale-unit">
          Unidade
        </label>
        <input
          id="lb-scale-unit"
          className="lb-input"
          type="text"
          value={scale.unit}
          onChange={(event) => onScaleChange({ unit: event.target.value })}
        />
      </div>

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-scale-precision">
          Casas decimais
        </label>
        <input
          id="lb-scale-precision"
          className="lb-input"
          type="number"
          min={0}
          max={MAX_MEASUREMENT_PRECISION}
          step={1}
          value={scale.precision}
          onChange={(event) => onScaleChange({ precision: Number(event.target.value) })}
        />
      </div>

      <div className="lb-field">
        <span className="lb-label">Modo de medição</span>
        <div className="lb-seg" role="radiogroup" aria-label="Modo de medição">
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={measurementMode === mode}
              className="lb-seg__option"
              onClick={() => onMeasurementModeChange(mode)}
            >
              {MEASUREMENT_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
