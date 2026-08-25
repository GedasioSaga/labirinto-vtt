import type { DoorState } from '../types/map'
import { Toggle } from './Toggle'

export interface WallDoorControlsProps {
  door: DoorState | null
  onToggleDoor: () => void
  onToggleOpen: () => void
}

/** Vira a parede selecionada em porta (ou de volta em parede sólida), e alterna aberta/fechada. */
export function WallDoorControls({ door, onToggleDoor, onToggleOpen }: WallDoorControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Porta</h2>
      <button type="button" className="lb-btn lb-btn--block" onClick={onToggleDoor}>
        {door === null ? 'Virar porta' : 'Virar parede sólida'}
      </button>
      {door !== null && (
        <div className="lb-field">
          <Toggle label={door.open ? 'Aberta' : 'Fechada'} checked={door.open} onChange={onToggleOpen} />
        </div>
      )}
    </section>
  )
}
