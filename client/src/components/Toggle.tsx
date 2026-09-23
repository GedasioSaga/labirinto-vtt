interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Id do texto que explica o controle (vira `aria-describedby` do checkbox). */
  describedBy?: string
}

/**
 * Checkbox nativo apresentado como interruptor. O input real continua no DOM
 * (só visualmente escondido), então rótulo, foco e teclado seguem sendo os do
 * navegador.
 */
export function Toggle({ label, checked, onChange, describedBy }: ToggleProps) {
  return (
    <label className="lb-switch">
      <span>{label}</span>
      <input
        className="lb-switch__input"
        type="checkbox"
        checked={checked}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="lb-switch__track" aria-hidden="true" />
    </label>
  )
}
