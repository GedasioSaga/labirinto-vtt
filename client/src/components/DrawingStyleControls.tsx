import { Toggle } from './Toggle'
import { TEXT_FONT_FAMILIES } from './labels'

export interface DrawingStyleControlsProps {
  color: string
  onColorChange: (color: string) => void
  width: number
  onWidthChange: (width: number) => void
  filled: boolean
  onFilledChange: (filled: boolean) => void
  /** Opacidade do preenchimento (0–1) — só relevante com `filled: true`;
   *  aplicado a `Drawing.fillAlpha` na criação da forma (círculo/retângulo/
   *  elipse/polígono). Ver drawDrawings.ts para a mesma opacidade multiplicada
   *  (não substituída) no destaque de seleção. */
  fillAlpha: number
  onFillAlphaChange: (fillAlpha: number) => void
  /** Círculo/retângulo/elipse/polígono têm preenchimento; pincel, linha e
   *  curva não. */
  showFilled: boolean
  /** Espessura não se aplica ao rótulo de texto. */
  showWidth: boolean
  fontSize: number
  onFontSizeChange: (size: number) => void
  fontFamily: string
  onFontFamilyChange: (fontFamily: string) => void
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
  fillAlpha,
  onFillAlphaChange,
  showFilled,
  showWidth,
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
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

      {showFontSize && (
        <div className="lb-field">
          <label className="lb-label" htmlFor="lb-draw-fontfamily">
            Fonte
          </label>
          <select
            id="lb-draw-fontfamily"
            className="lb-input"
            value={fontFamily}
            onChange={(event) => onFontFamilyChange(event.target.value)}
          >
            {TEXT_FONT_FAMILIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showFilled && <Toggle label="Preenchido" checked={filled} onChange={onFilledChange} />}

      {showFilled && filled && (
        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor="lb-draw-fillalpha">
              Opacidade do preenchimento
            </label>
            <span className="lb-num">{Math.round(fillAlpha * 100)}%</span>
          </div>
          <input
            id="lb-draw-fillalpha"
            className="lb-range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={fillAlpha}
            onChange={(event) => onFillAlphaChange(Number(event.target.value))}
          />
        </div>
      )}
    </section>
  )
}
