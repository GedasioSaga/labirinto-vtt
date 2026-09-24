import { useId } from 'react'
import { PROP_PLAYER_LABEL_MAX } from '../lib/propPlayerLook'
import { Toggle } from './Toggle'

export interface PropPlayerControlsProps {
  /** Rótulo gravado no objeto; '' = sem rótulo. */
  label: string
  /** A cópia pequena da imagem está gravada ("Mostrar imagem ao jogador" ligado). */
  showImage: boolean
  onLabelChange: (label: string) => void
  onShowImageChange: (show: boolean) => void
}

/** O que os dois controles mudam — e o que continua escondido. */
export const PROP_PLAYER_HINT = 'Só quem enxerga o objeto recebe. Oculto, sob teto fechado ou fora da visão, nada chega.'

/**
 * OBJETO COM RÓTULO OU IMAGEM — o que o jogador fica sabendo do objeto
 * selecionado além da silhueta. Efeito imediato e sem botão Salvar, como o
 * nome da ficha (`TokenNameControls`) e os interruptores de "Travado"/"Oculto".
 */
export function PropPlayerControls({ label, showImage, onLabelChange, onShowImageChange }: PropPlayerControlsProps) {
  const inputId = useId()
  const hintId = useId()
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Para os jogadores</h2>
      <div className="lb-field">
        <label className="lb-label" htmlFor={inputId}>
          Rótulo para jogadores
        </label>
        <input
          id={inputId}
          className="lb-input"
          value={label}
          maxLength={PROP_PLAYER_LABEL_MAX}
          placeholder="Ex.: Guarda-roupa"
          aria-describedby={hintId}
          onChange={(event) => onLabelChange(event.target.value)}
        />
      </div>
      <Toggle label="Mostrar imagem ao jogador" checked={showImage} onChange={onShowImageChange} describedBy={hintId} />
      <p className="lb-field__hint" id={hintId}>
        {PROP_PLAYER_HINT}
      </p>
    </section>
  )
}
