import { useId, type ReactNode } from 'react'
import { andarPelosRadios, classes } from './comum'
import './grimorio.css'

export interface OpcaoDoSeg<V extends string> {
  valor: V
  rotulo: string
  icone?: ReactNode
  /** Mostra só o ícone; o rótulo vira o nome acessível e o balão nativo. */
  soIcone?: boolean
  /** Tecla que arma esta opção: vai no balão e, na forma `grade`, embaixo do rótulo. */
  atalho?: string
}

export interface CampoSegProps<V extends string> {
  /** Rótulo visível em cima. Sem ele, ou quando o grupo tem outro nome ("Tipo do pino"), `nomeAcessivel` dá o nome. */
  rotulo?: string
  nomeAcessivel?: string
  opcoes: readonly OpcaoDoSeg<V>[]
  valor: V
  onChange: (valor: V) => void
  /** `grade`: cartões com ícone e tecla (variantes da ferramenta). `icone`: linha de ícones mais alta. */
  forma?: 'linha' | 'grade' | 'icone'
}

/**
 * Escolha de uma entre poucas opções, sempre à vista (o `.seg`). É um
 * `radiogroup`: o Tab entra só na opção escolhida e as setas escolhem a vizinha.
 */
export function CampoSeg<V extends string>({ rotulo, nomeAcessivel, opcoes, valor, onChange, forma = 'linha' }: CampoSegProps<V>) {
  const rotuloId = useId()
  const escolhida = opcoes.findIndex((opcao) => opcao.valor === valor)
  const focavel = escolhida < 0 ? 0 : escolhida
  return (
    <div className="gr-campo">
      {rotulo && (
        <span className="gr-campo__rot" id={rotuloId}>
          {rotulo}
        </span>
      )}
      <div
        className={classes('gr-seg', forma === 'grade' && 'gr-seg--grade', forma === 'icone' && 'gr-seg--icone')}
        role="radiogroup"
        aria-labelledby={rotulo && nomeAcessivel === undefined ? rotuloId : undefined}
        aria-label={nomeAcessivel}
        onKeyDown={andarPelosRadios}
      >
        {opcoes.map((opcao, indice) => (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            className={classes('gr-seg__op', opcao.soIcone && 'gr-seg__op--ic')}
            aria-checked={opcao.valor === valor}
            tabIndex={indice === focavel ? 0 : -1}
            aria-label={opcao.soIcone ? opcao.rotulo : undefined}
            title={opcao.atalho ? `${opcao.rotulo} (${opcao.atalho})` : opcao.soIcone ? opcao.rotulo : undefined}
            onClick={() => onChange(opcao.valor)}
          >
            {opcao.icone}
            {!opcao.soIcone && <span>{opcao.rotulo}</span>}
            {/* a tecla já está no balão (title): fora do nome, que fica só o rótulo */}
            {forma === 'grade' && opcao.atalho && (
              <kbd className="gr-kbd" aria-hidden="true">
                {opcao.atalho}
              </kbd>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
