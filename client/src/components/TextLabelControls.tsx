export interface TextLabelControlsProps {
  text: string
  onTextChange: (text: string) => void
  color: string
  onColorChange: (color: string) => void
  fontSize: number
  onFontSizeChange: (size: number) => void
}

/** Conteúdo, cor e tamanho da fonte do rótulo de texto selecionado. */
export function TextLabelControls({
  text,
  onTextChange,
  color,
  onColorChange,
  fontSize,
  onFontSizeChange,
}: TextLabelControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Rótulo de texto</h2>

      <div className="lb-field">
        <input
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
    </section>
  )
}
