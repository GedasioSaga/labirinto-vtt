import { useId } from 'react'
import { Toggle } from './Toggle'

export interface TokenPlayerCharacterControlsProps {
  playerCharacter: boolean
  onPlayerCharacterChange: (playerCharacter: boolean) => void
}

/** O porquê do interruptor, lido pelo leitor de tela junto do rótulo. */
export const PLAYER_CHARACTER_HINT = 'Quem entrar na sala sem personagem pode pedir esta ficha enquanto ela não tiver dono. Você confirma o pedido.'

/**
 * "Ficha de jogador": o que põe a ficha na lista de quem chega no meio da
 * sessão (`Token.playerCharacter`). Desligado é ficha de NPC — nunca aparece
 * na lista, e é o padrão de toda ficha.
 */
export function TokenPlayerCharacterControls({ playerCharacter, onPlayerCharacterChange }: TokenPlayerCharacterControlsProps) {
  const hintId = useId()
  return (
    <section className="lb-section">
      <Toggle label="Ficha de jogador" checked={playerCharacter} onChange={onPlayerCharacterChange} describedBy={hintId} />
      <p id={hintId} className="lb-field__hint">
        {PLAYER_CHARACTER_HINT}
      </p>
    </section>
  )
}
