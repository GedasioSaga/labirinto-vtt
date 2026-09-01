import type { DoorState } from '../types/map'
import { Toggle } from './Toggle'

export interface WallDoorControlsProps {
  door: DoorState | null
  onToggleDoor: () => void
  onToggleOpen: () => void
  /** `DoorState.locked` existe no schema desde sempre e nunca teve UI (grep:
   *  só tipo e teste) — este é o primeiro leitor/escritor com interface. */
  onToggleLocked: () => void
}

/** Vira a parede selecionada em porta (ou de volta em parede sólida), e alterna aberta/fechada e trancada. */
export function WallDoorControls({ door, onToggleDoor, onToggleOpen, onToggleLocked }: WallDoorControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Porta</h2>
      <button type="button" className="lb-btn lb-btn--block" onClick={onToggleDoor}>
        {door === null ? 'Virar porta' : 'Virar parede sólida'}
      </button>
      {door !== null && (
        <div className="lb-field">
          <Toggle label={door.open ? 'Aberta' : 'Fechada'} checked={door.open} onChange={onToggleOpen} />
          <Toggle label={door.locked ? 'Trancada' : 'Destrancada'} checked={door.locked} onChange={onToggleLocked} />
        </div>
      )}
    </section>
  )
}
