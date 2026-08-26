import { Toggle } from './Toggle'

export interface DrawingStyleControlsProps {
  color: string
  onColorChange: (color: string) => void
  width: number
  onWidthChange: (width: number) => void
  filled: boolean
  onFilledChange: (filled: boolean) => void
  /** Só o círculo tem preenchimento; pincel e linha não. */
  showFilled: boolean
  /** Espessura não se aplica ao rótulo de texto. */
  showWidth: boolean
  fontSize: number
  onFontSizeChange: (size: number) => void
  /** Só a ferramenta Texto ajusta o tamanho da fonte antes de colocar o rótulo. */
  showFontSize: boolean
}

/** Cor, espessura/preenchimento (desenho) ou tamanho de fonte (texto), com amostra do resultado. */
export function DrawingStyleControls({
  color,
  onColorChange,
  width,
  onWidthChange,
  filled,
  onFilledChange,
  showFilled,
  showWidth,
  fontSize,
  onFontSizeChange,
  showFontSize,
}: DrawingStyleControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Estilo de desenho</h2>

      <div className="lb-section__row">
        <label className="lb-label" htmlFor="lb-draw-color">
          Cor
        </label>
        <input
          id="lb-draw-color"
          className="lb-swatch"
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
        />
      </div>

      {showWidth && (
        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor="lb-draw-width">
              Espessura
            </label>
            <span className="lb-num">{width} px</span>
          </div>
          <input
            id="lb-draw-width"
            className="lb-range"
            type="range"
            min={1}
            max={20}
            value={width}
            onChange={(event) => onWidthChange(Number(event.target.value))}
          />
          <div className="lb-stroke-preview">
            <span
              className="lb-stroke-preview__line"
              style={{ height: width, background: color }}
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      {showFontSize && (
        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor="lb-draw-fontsize">
              Tamanho da fonte
            </label>
            <span className="lb-num">{fontSize} px</span>
          </div>
          <input
            id="lb-draw-fontsize"
            className="lb-range"
            type="range"
            min={8}
            max={48}
            value={fontSize}
            onChange={(event) => onFontSizeChange(Number(event.target.value))}
          />
        </div>
      )}

      {showFilled && <Toggle label="Preenchido" checked={filled} onChange={onFilledChange} />}
    </section>
  )
}
