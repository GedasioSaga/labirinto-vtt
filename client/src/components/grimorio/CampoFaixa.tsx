import { useId } from 'react'
import './grimorio.css'

export interface CampoFaixaProps {
  rotulo: string
  valor: number
  onChange: (valor: number) => void
  min: number
  max: number
  passo?: number
  /** Unidade depois do número ("%", "px"). */
  unidade?: string
  /** Texto do valor (no `<output>` e no `aria-valuetext`); manda mais que a `unidade` ("1,5x"). */
  formatar?: (valor: number) => string
}

/**
 * Deslizante (o `.faixa`): o `<input type="range">` nativo, então setas,
 * PageUp/PageDown e Home/End já andam pelo teclado e o valor muda durante o
 * arrasto, não só ao soltar. O número aparece à direita do rótulo.
 */
export function CampoFaixa({ rotulo, valor, onChange, min, max, passo = 1, unidade, formatar }: CampoFaixaProps) {
  const id = useId()
  const texto = formatar ? formatar(valor) : unidade ? `${valor} ${unidade}` : String(valor)
  return (
    <div className="gr-campo">
      <div className="gr-campo__rot">
        <label htmlFor={id}>{rotulo}</label>
        <output htmlFor={id}>{texto}</output>
      </div>
      <input
        id={id}
        className="gr-faixa"
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        aria-valuetext={texto}
        onChange={(evento) => onChange(Number(evento.currentTarget.value))}
      />
    </div>
  )
}
