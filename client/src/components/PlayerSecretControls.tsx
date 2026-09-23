import { Toggle } from './Toggle'

export interface PlayerSecretControlsProps {
  secret: boolean
  onSecretChange: (secret: boolean) => void
}

/**
 * "Oculto para jogadores" (A5) de Região, Escada e Desenho — Token e Objeto
 * têm o mesmo toggle dentro de `ItemTransformControls`. Diferente de "Oculto
 * no editor": o item continua no editor, só não sai para o jogador.
 */
export function PlayerSecretControls({ secret, onSecretChange }: PlayerSecretControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Jogadores</h2>
      <Toggle label="Oculto para jogadores" checked={secret} onChange={onSecretChange} />
    </section>
  )
}
