export interface PolygonSidesControlsProps {
  sides: number
  onSidesChange: (sides: number) => void
}

const MIN_POLYGON_SIDES = 3
const MAX_POLYGON_SIDES = 12

/**
 * Número de lados do próximo Polígono Regular (3 = triângulo, 12 = quase um
 * círculo). Só aparece com a ferramenta "Polígono Regular" ativa — "Sala
 * Circular" usa segments fixo (24) e não expõe este controle.
 */
export function PolygonSidesControls({ sides, onSidesChange }: PolygonSidesControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Polígono</h2>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-polygon-sides">
            Lados
          </label>
          <span className="lb-num">{sides}</span>
        </div>
        <input
          id="lb-polygon-sides"
          className="lb-range"
          type="range"
          min={MIN_POLYGON_SIDES}
          max={MAX_POLYGON_SIDES}
          value={sides}
          onChange={(event) => onSidesChange(Number(event.target.value))}
        />
      </div>
    </section>
  )
}
