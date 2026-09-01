export interface LightControlsProps {
  color: string
  onColorChange: (color: string) => void
  intensity: number
  onIntensityChange: (intensity: number) => void
}

/**
 * Cor e intensidade da Luz selecionada. O raio não tem campo aqui de
 * propósito — é editado arrastando a alça desenhada em `drawEditHandles.ts`
 * diretamente sobre o círculo da luz no canvas, mesmo padrão de "editar no
 * lugar" usado por vértice de Parede/Região/Curva.
 */
export function LightControls({ color, onColorChange, intensity, onIntensityChange }: LightControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Luz</h2>
      <div className="lb-section__row">
        <label className="lb-label" htmlFor="lb-light-color">
          Cor
        </label>
        <input
          id="lb-light-color"
          className="lb-swatch"
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
        />
      </div>
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-light-intensity">
            Intensidade
          </label>
          <span className="lb-num">{Math.round(intensity * 100)}%</span>
        </div>
        <input
          id="lb-light-intensity"
          className="lb-range"
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={intensity}
          onChange={(event) => onIntensityChange(Number(event.target.value))}
        />
      </div>
    </section>
  )
}
