export interface RegionStyleControlsProps {
  color: string
  onColorChange: (color: string) => void
}

/**
 * Cor de preenchimento da região: antes de desenhar (liga em `regionFillColor`)
 * ou editando a região já selecionada (liga em `setRegionColor`) — o chamador
 * decide qual fonte usar, este componente só mostra o swatch.
 */
export function RegionStyleControls({ color, onColorChange }: RegionStyleControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Região</h2>
      <div className="lb-section__row">
        <label className="lb-label" htmlFor="lb-region-color">
          Cor
        </label>
        <input
          id="lb-region-color"
          className="lb-swatch"
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
        />
      </div>
    </section>
  )
}
