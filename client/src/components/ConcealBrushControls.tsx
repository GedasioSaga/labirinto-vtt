import type { RevealBrushMode, RevealBrushWidth } from '../lib/concealBrush'

export interface ConcealBrushControlsProps {
  mode: RevealBrushMode
  onModeChange: (mode: RevealBrushMode) => void
  width: RevealBrushWidth
  onWidthChange: (width: RevealBrushWidth) => void
}

const MODES: Array<{ mode: RevealBrushMode; label: string }> = [
  { mode: 'revelar', label: 'Revelar' },
  { mode: 'esconder', label: 'Esconder' },
]

const WIDTHS: Array<{ width: RevealBrushWidth; label: string; hint: string }> = [
  { width: 1, label: 'Fino', hint: '1 quadrado' },
  { width: 2, label: 'Médio', hint: '2 quadrados' },
  { width: 4, label: 'Largo', hint: '4 quadrados' },
]

/**
 * Painel do Pincel de revelar: o que o PRÓXIMO arrasto faz e a largura do
 * traço. Mesmo segmentado de `DoorModeControls` (rádios de botão, preferência
 * de ferramenta no store — nunca de algo já pintado).
 *
 * "Esconder" existe além do Alt de propósito: Alt segurado durante um arrasto
 * não é gesto que todo mundo descobre, e no notebook sem tecla confortável o
 * modo fixo é o caminho. O Alt continua valendo e INVERTE o modo escolhido.
 */
export function ConcealBrushControls({ mode, onModeChange, width, onWidthChange }: ConcealBrushControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Ao pintar</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Ao pintar">
        {MODES.map((option) => (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={mode === option.mode}
            className="lb-seg__option"
            onClick={() => onModeChange(option.mode)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="lb-field__hint">
        {mode === 'esconder'
          ? 'Arraste sobre o que foi revelado para esconder de novo. Segure Alt para revelar.'
          : 'Arraste sobre uma zona oculta: os jogadores veem só o pedaço pintado. Segure Alt para esconder.'}
      </p>
      <h2 className="lb-eyebrow">Largura do pincel</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Largura do pincel">
        {WIDTHS.map((option) => (
          <button
            key={option.width}
            type="button"
            role="radio"
            aria-checked={width === option.width}
            className="lb-seg__option"
            title={option.hint}
            onClick={() => onWidthChange(option.width)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}
