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
  /** Id do miolo, para quem já procura o campo por ele (`#lb-stair-length`); ausente, um gerado. */
  id?: string
  /** Como o − e o + chamam o número para quem não vê ("o comprimento" → "Aumentar o comprimento"); ausente, o rótulo. */
  nome?: string
  /**
   * Casas decimais que o campo mostra (2: "4,37"); com elas, o número digitado
   * vale como foi digitado. Ausente, guarda as casas do passo e mostra o valor
   * como veio. Serve ao número que também muda por fora sem passo nenhum, como
   * a alça da escada no mapa.
   */
  decimais?: number
}

const MIN_PADRAO = 0
const MAX_PADRAO = 999
/** PageUp e PageDown andam dez passos, como no deslizante. */
const PASSOS_DA_PAGINA = 10
/** Resto de conta de ponto flutuante (0,3 / 0,1 = 2,9999…) não pode virar um passo a menos. */
const FOLGA = 1e-9
/** Com `decimais`, só some o resto de conta (4,37 + 0,5 = 4,869999…), nunca o que se digitou. */
const ALGARISMOS_GUARDADOS = 12

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
 * Anda `passos` a partir de `base`. Fora do passo (4,37 com passo 0,5), o
 * primeiro passo cai no múltiplo mais perto daquele lado (4,5 subindo, 4
 * descendo), como o `stepUp` do campo numérico nativo.
 */
function andarNoPasso(base: number, passos: number, passo: number): number {
  const emPassos = base / passo
  const alinhado = passos > 0 ? Math.floor(emPassos + FOLGA) : Math.ceil(emPassos - FOLGA)
  return (alinhado + passos) * passo
}

/**
 * Número com − e + (o `.num`). O miolo aceita digitação: Enter ou sair do campo
 * confirma, Esc desiste do que foi digitado, e as setas, PageUp/PageDown e
 * Home/End andam como num `spinbutton`. Valor fora dos limites volta ao limite;
 * texto que não é número volta ao valor de antes. No limite, o − (ou o +) fica
 * `aria-disabled` e não faz nada.
 */
export function CampoNum({ rotulo, valor, onChange, min = MIN_PADRAO, max = MAX_PADRAO, passo = 1, unidade, id, nome = rotulo, decimais }: CampoNumProps) {
  const gerado = useId()
  const campoId = id ?? `${gerado}-valor`
  const rotuloId = `${gerado}-rot`
  const [rascunho, setRascunho] = useState<string | null>(null)
  const mostrado = formatar(decimais === undefined ? valor : Number(valor.toFixed(decimais)))
  const noMinimo = valor <= min + FOLGA
  const noMaximo = valor >= max - FOLGA

  const limitar = (bruto: number) => {
    const limitado = Math.min(max, Math.max(min, bruto))
    return Number(decimais === undefined ? limitado.toFixed(casasDoPasso(passo)) : limitado.toPrecision(ALGARISMOS_GUARDADOS))
  }
  const entregar = (bruto: number) => {
    setRascunho(null)
    const novo = limitar(bruto)
    if (Math.abs(novo - valor) > FOLGA) onChange(novo)
  }
  const confirmar = () => {
    if (rascunho === null) return
    const lido = lerNumero(rascunho)
    if (lido === null) setRascunho(null)
    else entregar(lido)
  }
  const andar = (passos: number) => {
    const base = rascunho === null ? valor : (lerNumero(rascunho) ?? valor)
    entregar(andarNoPasso(base, passos, passo))
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
        <label id={rotuloId} htmlFor={campoId}>
          {rotulo}
        </label>
        {unidade && <b>{unidade}</b>}
      </span>
      <div className="gr-num" role="group" aria-labelledby={rotuloId}>
        <button
          type="button"
          className="gr-num__passo"
          tabIndex={-1}
          aria-label={`Diminuir ${nome}`}
          aria-disabled={noMinimo || undefined}
          onClick={noMinimo ? undefined : () => andar(-1)}
        >
          −
        </button>
        <input
          id={campoId}
          className="gr-num__valor"
          type="text"
          inputMode="decimal"
          role="spinbutton"
          autoComplete="off"
          aria-valuenow={valor}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={unidade ? `${mostrado} ${unidade}` : undefined}
          value={rascunho ?? mostrado}
          onChange={(evento) => setRascunho(evento.currentTarget.value)}
          onBlur={confirmar}
          onKeyDown={teclar}
        />
        <button
          type="button"
          className="gr-num__passo"
          tabIndex={-1}
          aria-label={`Aumentar ${nome}`}
          aria-disabled={noMaximo || undefined}
          onClick={noMaximo ? undefined : () => andar(1)}
        >
          +
        </button>
      </div>
    </div>
  )
}
