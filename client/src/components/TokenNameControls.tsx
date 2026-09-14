export interface TokenNameControlsProps {
  name: string
  onNameChange: (name: string) => void
}

/**
 * Nome do Token selecionado — é o texto que aparece embaixo do token no mapa
 * e na lista "Atribuir token" da aba de jogo. Mesmo formato do campo Nome de
 * `RoomControls`.
 */
export function TokenNameControls({ name, onNameChange }: TokenNameControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Token</h2>
      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-token-name">
          Nome
        </label>
        <input id="lb-token-name" className="lb-input" value={name} onChange={(event) => onNameChange(event.target.value)} />
      </div>
    </section>
  )
}
