import { useId } from 'react'
import './grimorio.css'

export interface CampoLigaProps {
  rotulo: string
  /** Frase curta embaixo do rótulo; vira a descrição do interruptor. */
  ajuda?: string
  ligado: boolean
  onChange: (ligado: boolean) => void
  disabled?: boolean
}

/**
 * Interruptor (o `.liga`): a linha inteira é o botão, então clicar no rótulo
 * também alterna, e Espaço ou Enter alternam com o foco nele, por ser um
 * `<button>` nativo com `role="switch"`. O efeito é na hora, sem Salvar.
 */
export function CampoLiga({ rotulo, ajuda, ligado, onChange, disabled }: CampoLigaProps) {
  const id = useId()
  return (
    <button
      type="button"
      role="switch"
      className="gr-liga"
      aria-checked={ligado}
      aria-labelledby={`${id}-rot`}
      aria-describedby={ajuda ? `${id}-ajuda` : undefined}
      disabled={disabled}
      onClick={() => onChange(!ligado)}
    >
      <span className="gr-liga__rot" id={`${id}-rot`}>
        {rotulo}
      </span>
      {ajuda && (
        <span className="gr-liga__ajuda" id={`${id}-ajuda`}>
          {ajuda}
        </span>
      )}
      <span className="gr-liga__trilho" aria-hidden="true" />
    </button>
  )
}
