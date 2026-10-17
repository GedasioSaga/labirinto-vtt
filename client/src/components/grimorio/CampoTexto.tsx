import { useId } from 'react'
import './grimorio.css'

export interface CampoTextoProps {
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  placeholder?: string
  /** Caixa de várias linhas (o `area` do protótipo, 3 linhas e altura ajustável). */
  multilinha?: boolean
  /** Id fixo do campo, para quem já o achava por ele; ausente = um gerado. */
  id?: string
  maxLength?: number
}

/** Texto (o `texto`/`area` do protótipo): rótulo em cima, clicar nele foca o campo. */
export function CampoTexto({ rotulo, valor, onChange, placeholder, multilinha, id: idFixo, maxLength }: CampoTextoProps) {
  const idGerado = useId()
  const id = idFixo ?? idGerado
  return (
    <div className="gr-campo">
      <label className="gr-campo__rot" htmlFor={id}>
        {rotulo}
      </label>
      {multilinha ? (
        <textarea
          id={id}
          className="gr-entrada"
          rows={3}
          maxLength={maxLength}
          placeholder={placeholder}
          value={valor}
          onChange={(evento) => onChange(evento.currentTarget.value)}
        />
      ) : (
        <input
          id={id}
          className="gr-entrada"
          type="text"
          autoComplete="off"
          maxLength={maxLength}
          placeholder={placeholder}
          value={valor}
          onChange={(evento) => onChange(evento.currentTarget.value)}
        />
      )}
    </div>
  )
}

export interface OpcaoDoSel<V extends string> {
  valor: V
  rotulo: string
}

export interface CampoSelProps<V extends string> {
  rotulo: string
  opcoes: readonly OpcaoDoSel<V>[]
  valor: V
  onChange: (valor: V) => void
}

/** Lista suspensa nativa (o `sel`): setas, inicial e Esc são do navegador. */
export function CampoSel<V extends string>({ rotulo, opcoes, valor, onChange }: CampoSelProps<V>) {
  const id = useId()
  return (
    <div className="gr-campo">
      <label className="gr-campo__rot" htmlFor={id}>
        {rotulo}
      </label>
      <select
        id={id}
        className="gr-entrada"
        value={valor}
        onChange={(evento) => {
          const escolhida = opcoes.find((opcao) => opcao.valor === evento.currentTarget.value)
          if (escolhida) onChange(escolhida.valor)
        }}
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </div>
  )
}
