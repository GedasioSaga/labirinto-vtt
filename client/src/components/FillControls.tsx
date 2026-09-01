import { Toggle } from './Toggle'

export interface FillControlsProps {
  filled: boolean
  onFilledChange: (filled: boolean) => void
  /**
   * Opacidade do preenchimento (0–1). Só existe no schema de `Drawing`
   * (rect/ellipse/circle/polygon) — `Region` não tem `fillAlpha` (só
   * `fillColor`/`fillPattern`, ver types/map.ts). `undefined` = não mostra o
   * controle; usar junto com `onFillAlphaChange` (os dois presentes ou os
   * dois ausentes — só um dos dois não muda nada, sobra o outro sem efeito).
   */
  fillAlpha?: number
  onFillAlphaChange?: (fillAlpha: number) => void
}

/**
 * "Tirar o fundo" de algo que JÁ EXISTE no mapa — pedido literal do usuário,
 * feito duas vezes (linha e área preenchida). Cobre os dois casos reais
 * (relatório do F4-0):
 *
 * 1. **Região/Sala** (`Region.filled`, schema NOVO do F4-0): liga em
 *    `regionFillEnabled`/`setRegionFillEnabled` pra PRÓXIMA região (mesma
 *    classe de `regionFillColor`) OU em
 *    `selectedRegion.filled ?? true`/`(f) => setRegionFilled(selectedRegion.id, f)`
 *    pra editar a selecionada — `fillAlpha` fica de fora (schema não tem).
 * 2. **Forma preenchível JÁ SELECIONADA** (`Drawing.filled`/`fillAlpha` —
 *    schema não é novo, mas não tinha UI de EDIÇÃO: `DrawingStyleControls`
 *    só cobre a PRÓXIMA forma). Liga em `selectedDrawing.filled`/
 *    `(f) => setDrawingFilled(selectedDrawing.id, f)` +
 *    `selectedDrawing.fillAlpha`/`(a) => setDrawingFillAlpha(selectedDrawing.id, a)`
 *    — as duas actions já existem na store, sem nenhuma UI usando (`rg`
 *    confirmou), exatamente a "lição 2" do prompt desta fase.
 *
 * Não decide a fonte — mesmo padrão de `LineCapControls`/`RegionStyleControls`.
 * Ver CONTRATO no relatório do F4-N2.
 */
export function FillControls({ filled, onFilledChange, fillAlpha, onFillAlphaChange }: FillControlsProps) {
  const showAlpha = fillAlpha !== undefined && onFillAlphaChange !== undefined

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Preenchimento</h2>
      <Toggle label="Preenchido" checked={filled} onChange={onFilledChange} />
      {showAlpha && filled && (
        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor="lb-fill-alpha">
              Opacidade do preenchimento
            </label>
            <span className="lb-num">{Math.round((fillAlpha ?? 0) * 100)}%</span>
          </div>
          <input
            id="lb-fill-alpha"
            className="lb-range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={fillAlpha}
            onChange={(event) => onFillAlphaChange?.(Number(event.target.value))}
          />
        </div>
      )}
    </section>
  )
}
