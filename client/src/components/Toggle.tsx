interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Id do texto que explica o controle (vira `aria-describedby` do checkbox). */
  describedBy?: string
}

/**
 * Checkbox nativo apresentado como interruptor, então rótulo, foco e teclado
 * seguem sendo os do navegador. O input mora DENTRO do trilho, transparente e
 * do tamanho dele: quem clica no interruptor desenhado clica no próprio
 * checkbox, e a caixa do controle (a que o leitor de tela realça e o
 * Playwright mira) é o interruptor, não um ponto escondido sob o texto. Por
 * isso o trilho não é `aria-hidden`: levaria o checkbox junto para fora da
 * árvore de acessibilidade.
 */
export function Toggle({ label, checked, onChange, describedBy }: ToggleProps) {
  return (
    <label className="lb-switch">
      <span>{label}</span>
      <span className="lb-switch__track">
        <input
          className="lb-switch__input"
          type="checkbox"
          checked={checked}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.checked)}
        />
      </span>
    </label>
  )
}
