import { useId } from 'react'
import { Botao } from './Botao'
import { andarPelosRadios } from './comum'
import './grimorio.css'

export interface OpcaoDeCor {
  /** Cor CSS (`#e0a44a`). */
  valor: string
  /** Nome falado ("Latão"); sem ele o leitor diz "Cor #e0a44a". */
  nome?: string
}

export interface CampoCorProps {
  rotulo?: string
  nomeAcessivel?: string
  opcoes: readonly OpcaoDeCor[]
  valor: string
  onChange: (valor: string) => void
  /** Mostra "Cor padrão", que volta a esta cor. */
  padrao?: string
}

const mesmaCor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Paleta de bolinhas (o `.cores`): um `radiogroup`, setas escolhem a vizinha. */
export function CampoCor({ rotulo, nomeAcessivel, opcoes, valor, onChange, padrao }: CampoCorProps) {
  const rotuloId = useId()
  const escolhida = opcoes.findIndex((opcao) => mesmaCor(opcao.valor, valor))
  const focavel = escolhida < 0 ? 0 : escolhida
  return (
    <div className="gr-campo">
      {rotulo && (
        <span className="gr-campo__rot" id={rotuloId}>
          {rotulo}
        </span>
      )}
      <div
        className="gr-cores"
        role="radiogroup"
        aria-labelledby={rotulo ? rotuloId : undefined}
        aria-label={rotulo ? undefined : nomeAcessivel}
        onKeyDown={andarPelosRadios}
      >
        {opcoes.map((opcao, indice) => (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            className="gr-cor"
            aria-checked={indice === escolhida}
            aria-label={opcao.nome ?? `Cor ${opcao.valor}`}
            tabIndex={indice === focavel ? 0 : -1}
            style={{ background: opcao.valor }}
            onClick={() => onChange(opcao.valor)}
          />
        ))}
        {padrao !== undefined && (
          <Botao variante="fantasma" tamanho="p" onClick={() => onChange(padrao)}>
            Cor padrão
          </Botao>
        )}
      </div>
    </div>
  )
}
