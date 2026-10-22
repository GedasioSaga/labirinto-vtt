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
  /** O que o leitor de tela diz quando o texto visível é curto demais para ouvir ("60°" → "60 graus"); ausente, o mesmo do `<output>`. */
  falar?: (valor: number) => string
  /** Id do deslizante, para quem já procura o campo por ele (`#lb-stair-curve`); ausente, um gerado. */
  id?: string
  desativado?: boolean
}

/**
 * Deslizante (o `.faixa`): o `<input type="range">` nativo, então setas,
 * PageUp/PageDown e Home/End já andam pelo teclado e o valor muda durante o
 * arrasto, não só ao soltar. O número aparece à direita do rótulo.
 */
export function CampoFaixa({ rotulo, valor, onChange, min, max, passo = 1, unidade, formatar, falar, id, desativado }: CampoFaixaProps) {
  const gerado = useId()
  const campoId = id ?? gerado
  const texto = formatar ? formatar(valor) : unidade ? `${valor} ${unidade}` : String(valor)
  return (
    <div className="gr-campo">
      <div className="gr-campo__rot">
        <label htmlFor={campoId}>{rotulo}</label>
        <output htmlFor={campoId}>{texto}</output>
      </div>
      <input
        id={campoId}
        className="gr-faixa"
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        disabled={desativado}
        aria-valuetext={falar ? falar(valor) : texto}
        onChange={(evento) => onChange(Number(evento.currentTarget.value))}
      />
    </div>
  )
}
