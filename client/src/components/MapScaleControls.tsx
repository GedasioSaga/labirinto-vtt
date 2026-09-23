import type { GridShape, MapScale, MeasurementMode } from '../types/map'
import { MEASUREMENT_MODE_LABELS, measurementModesForShape } from '../lib/measurement'

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
 * Uma frase por modo, dita do jeito que a régua conta — cada texto espelha a
 * fórmula de `measureCells` (lib/measurement.ts). O usuário não sabia para
 * que servia o seletor só com o nome do modo.
 */
export const MEASUREMENT_MODE_DESCRIPTIONS: Record<MeasurementMode, string> = {
  chessboard: 'A diagonal conta 1 célula, igual a um passo reto.',
  alternating: 'Diagonais alternam: a primeira conta 1 célula, a segunda conta 2 (5-10-5).',
  euclidean: 'Distância em linha reta, como uma régua, sem contar por células.',
  manhattan: 'Só anda na horizontal e na vertical: cada diagonal custa 2 células.',
  hex: 'Conta os hexágonos atravessados; cada vizinho vale 1 célula.',
}

/**
 * Escala do mapa (unidades por célula, texto livre da unidade, casas
 * decimais do rótulo) e modo de medição da régua efêmera. Configuração do
 * mapa inteiro — mora na janela "Configurações do mapa" (MapSettingsDialog).
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

  function changeMode(value: string) {
    // Procurar na lista filtrada em vez de converter a string: assim um valor
    // fora do formato atual nunca chega à store, e não precisa de `as`.
    const mode = modes.find((candidate) => candidate === value)
    if (mode) onMeasurementModeChange(mode)
  }

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
          max={3}
          step={1}
          value={scale.precision}
          onChange={(event) => onScaleChange({ precision: Number(event.target.value) })}
        />
      </div>

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-scale-mode">
          Modo de medição
        </label>
        <select
          id="lb-scale-mode"
          className="lb-input"
          value={measurementMode}
          aria-describedby="lb-scale-mode-hint"
          onChange={(event) => changeMode(event.target.value)}
        >
          {modes.map((mode) => (
            <option key={mode} value={mode}>
              {MEASUREMENT_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
        <p id="lb-scale-mode-hint" className="lb-field__hint">
          {MEASUREMENT_MODE_DESCRIPTIONS[measurementMode]}
        </p>
      </div>
    </section>
  )
}
