import { Toggle } from './Toggle'

export interface ConcealZoneControlsProps {
  name: string
  onNameChange: (name: string) => void
  revealed: boolean
  onRevealedChange: (revealed: boolean) => void
  onDelete: () => void
}

/**
 * Zona oculta aberta no painel (A5). "Revelar para jogadores" não apaga a
 * zona: o mestre pode esconder de novo sem redesenhar.
 */
export function ConcealZoneControls({ name, onNameChange, revealed, onRevealedChange, onDelete }: ConcealZoneControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Zona oculta</h2>
      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-conceal-zone-name">
          Nome
        </label>
        <input id="lb-conceal-zone-name" className="lb-input" value={name} onChange={(event) => onNameChange(event.target.value)} />
      </div>
      <Toggle label="Revelar para jogadores" checked={revealed} onChange={onRevealedChange} />
      <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={onDelete}>
        Excluir zona
      </button>
    </section>
  )
}
