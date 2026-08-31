import { TEXT_FONT_FAMILIES } from './labels'

export interface TextLabelControlsProps {
  text: string
  onTextChange: (text: string) => void
  color: string
  onColorChange: (color: string) => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  fontFamily: string
  onFontFamilyChange: (fontFamily: string) => void
}

/** Conteúdo, cor, tamanho e família da fonte do rótulo de texto selecionado. */
export function TextLabelControls({
  text,
  onTextChange,
  color,
  onColorChange,
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
}: TextLabelControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Rótulo de texto</h2>

      <div className="lb-field">
        <input
          id="lb-text-content"
          className="lb-input"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </div>

      <div className="lb-section__row">
        <label className="lb-label" htmlFor="lb-text-color">
          Cor
        </label>
        <input
          id="lb-text-color"
          className="lb-swatch"
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
        />
      </div>

      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-text-fontsize">
            Tamanho da fonte
          </label>
          <span className="lb-num">{fontSize} px</span>
        </div>
        <input
          id="lb-text-fontsize"
          className="lb-range"
          type="range"
          min={8}
          max={48}
          value={fontSize}
          onChange={(event) => onFontSizeChange(Number(event.target.value))}
        />
      </div>

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-text-fontfamily">
          Fonte
        </label>
        <select
          id="lb-text-fontfamily"
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
    </section>
  )
}
