import { useId, type ReactNode } from 'react'
import './grimorio.css'

export interface OpcaoDeChip<V extends string> {
  valor: V
  rotulo: string
  /** Obrigatório na forma `icones`; nos chips fica à esquerda do texto. */
  icone?: ReactNode
}

export interface CampoChipsProps<V extends string> {
  rotulo?: string
  nomeAcessivel?: string
  opcoes: readonly OpcaoDeChip<V>[]
  valores: readonly V[]
  onChange: (valores: V[]) => void
  /** `chips`: pílulas de texto. `icones`: cartõezinhos com ícone e legenda. */
  forma?: 'chips' | 'icones'
}

/**
 * Várias escolhas ao mesmo tempo (o `chips` e o `icones` do protótipo): cada
 * opção é um botão que liga e desliga (`aria-pressed`), e o Tab passa por todas.
 */
export function CampoChips<V extends string>({ rotulo, nomeAcessivel, opcoes, valores, onChange, forma = 'chips' }: CampoChipsProps<V>) {
  const rotuloId = useId()
  const alternar = (valor: V) =>
    onChange(valores.includes(valor) ? valores.filter((v) => v !== valor) : [...valores, valor])
  return (
    <div className="gr-campo">
      {rotulo && (
        <span className="gr-campo__rot" id={rotuloId}>
          {rotulo}
        </span>
      )}
      <div
        className={forma === 'icones' ? 'gr-icones' : 'gr-chips'}
        role="group"
        aria-labelledby={rotulo ? rotuloId : undefined}
        aria-label={rotulo ? undefined : nomeAcessivel}
      >
        {opcoes.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            className={forma === 'icones' ? 'gr-icone-tg' : 'gr-chip'}
            aria-pressed={valores.includes(opcao.valor)}
            onClick={() => alternar(opcao.valor)}
          >
            {opcao.icone}
            {forma === 'icones' ? <span>{opcao.rotulo}</span> : opcao.rotulo}
          </button>
        ))}
      </div>
    </div>
  )
}
