import { useId, useState, type KeyboardEvent } from 'react'
import './grimorio.css'

export interface CampoNumProps {
  rotulo: string
  valor: number
  onChange: (valor: number) => void
  /** Os limites do protótipo: 0 a 999 quando ausentes. */
  min?: number
  max?: number
  passo?: number
  /** Unidade à direita do rótulo ("casas", "px"). */
  unidade?: string
}

const MIN_PADRAO = 0
const MAX_PADRAO = 999
/** PageUp e PageDown andam dez passos, como no deslizante. */
const PASSOS_DA_PAGINA = 10

/** "1,5" e "1.5" valem o mesmo; vazio ou texto que não é número não vale nada. */
function lerNumero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.').replace('−', '-')
  if (limpo === '') return null
  const lido = Number(limpo)
  return Number.isFinite(lido) ? lido : null
}

/** Vírgula decimal, como o mestre escreve. */
function formatar(valor: number): string {
  return String(valor).replace('.', ',')
}

function casasDoPasso(passo: number): number {
  const decimais = String(passo).split('.')[1]
  return decimais ? decimais.length : 0
}

/**
 * Número com − e + (o `.num`). O miolo aceita digitação: Enter ou sair do campo
 * confirma, Esc desiste do que foi digitado, e as setas, PageUp/PageDown e
 * Home/End andam como num `spinbutton`. Valor fora dos limites volta ao limite;
 * texto que não é número volta ao valor de antes.
 */
export function CampoNum({ rotulo, valor, onChange, min = MIN_PADRAO, max = MAX_PADRAO, passo = 1, unidade }: CampoNumProps) {
  const id = useId()
  const [rascunho, setRascunho] = useState<string | null>(null)
  const casas = casasDoPasso(passo)

  const limitar = (bruto: number) => Number(Math.min(max, Math.max(min, bruto)).toFixed(casas))
  const entregar = (bruto: number) => {
    setRascunho(null)
    const novo = limitar(bruto)
    if (novo !== valor) onChange(novo)
  }
  const confirmar = () => {
    if (rascunho === null) return
    const lido = lerNumero(rascunho)
    if (lido === null) setRascunho(null)
    else entregar(lido)
  }
  const andar = (passos: number) => {
    const base = rascunho === null ? valor : (lerNumero(rascunho) ?? valor)
    entregar(base + passos * passo)
  }

  const teclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    const acoes: Record<string, () => void> = {
      Enter: confirmar,
      ArrowUp: () => andar(1),
      ArrowDown: () => andar(-1),
      PageUp: () => andar(PASSOS_DA_PAGINA),
      PageDown: () => andar(-PASSOS_DA_PAGINA),
      Home: () => entregar(min),
      End: () => entregar(max),
    }
    if (evento.key === 'Escape') {
      // Esc só desiste da digitação; sem rascunho ele segue para quem fecha a seleção
      if (rascunho === null) return
      evento.stopPropagation()
      setRascunho(null)
      return
    }
    if (!Object.hasOwn(acoes, evento.key)) return
    evento.preventDefault()
    acoes[evento.key]()
  }

  return (
    <div className="gr-campo">
      <span className="gr-campo__rot">
        <label id={`${id}-rot`} htmlFor={`${id}-valor`}>
          {rotulo}
        </label>
        {unidade && <b>{unidade}</b>}
      </span>
      <div className="gr-num" role="group" aria-labelledby={`${id}-rot`}>
        <button type="button" className="gr-num__passo" tabIndex={-1} aria-label={`Diminuir ${rotulo}`} onClick={() => andar(-1)}>
          −
        </button>
        <input
          id={`${id}-valor`}
          className="gr-num__valor"
          type="text"
          inputMode="decimal"
          role="spinbutton"
          autoComplete="off"
          aria-valuenow={valor}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={unidade ? `${formatar(valor)} ${unidade}` : undefined}
          value={rascunho ?? formatar(valor)}
          onChange={(evento) => setRascunho(evento.currentTarget.value)}
          onBlur={confirmar}
          onKeyDown={teclar}
        />
        <button type="button" className="gr-num__passo" tabIndex={-1} aria-label={`Aumentar ${rotulo}`} onClick={() => andar(1)}>
          +
        </button>
      </div>
    </div>
  )
}
