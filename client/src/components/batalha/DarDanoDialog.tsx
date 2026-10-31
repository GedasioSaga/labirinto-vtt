import { useId, useRef, useState, type FormEvent } from 'react'
import { DANO_MAX } from '../../lib/batalha/combate'
import { BotaoDaCalculadora, CalculadoraDeDano } from './CalculadoraDeDano'
import { lerInteiro } from './dadosDoMenu'
import { JanelaDaBatalha } from './JanelaDaBatalha'
import './batalha.css'
import './combate.css'

/**
 * DAR DANO: o mestre dá dano personalizado a qualquer ficha (pelo menu da
 * carta e pelo painel da vez); o jogador, "Me dar dano" na carta dele. Vira
 * linha "dano" no registro e a animação do número toca sempre. O Escudo é
 * gasto primeiro (Q4); o Desfazer do registro volta.
 */

export interface AlvoDoDano {
  tokenId: string
  nome: string
}

export interface DarDanoDialogProps {
  titulo?: string
  alvos: readonly AlvoDoDano[]
  alvoInicial?: string | null
  /** O pedido saiu? `false` mantém a janela, com o aviso. */
  onConfirmar: (tokenId: string, valor: number) => boolean
  onFechar: () => void
}

export function DarDanoDialog({ titulo = 'Dar dano', alvos, alvoInicial, onConfirmar, onFechar }: DarDanoDialogProps) {
  const [alvo, setAlvo] = useState<string>(() => alvoInicial ?? alvos[0]?.tokenId ?? '')
  const [valorTexto, setValorTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const valor = lerInteiro(valorTexto, DANO_MAX)
  // A calculadora do dano: abre no lugar, "Usar este valor" põe o número no campo.
  const idBase = useId()
  const [calculando, setCalculando] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const botaoDaCalculadora = useRef<HTMLButtonElement>(null)

  const confirmar = (evento: FormEvent) => {
    evento.preventDefault()
    if (alvo === '') {
      setErro('Escolha quem leva o dano.')
      return
    }
    if (valor === null || valor < 1) {
      setErro('Digite um dano de 1 para cima.')
      return
    }
    if (onConfirmar(alvo, valor)) onFechar()
    else setErro('Não saiu: a ficha saiu da batalha, ou sem conexão com o mestre.')
  }

  const sozinho = alvos.length === 1
  return (
    <JanelaDaBatalha titulo={titulo} descricao="Gasta o Escudo primeiro e o resto vai ao HP. Entra no registro; o Desfazer volta." onFechar={onFechar}>
      <form className="bt-form" onSubmit={confirmar} noValidate>
        {!sozinho && (
          <label className="bt-form__linha">
            <span>Em quem</span>
            <select className="bt-num" style={{ width: 'auto' }} value={alvo} onChange={(evento) => setAlvo(evento.target.value)}>
              {alvos.map((candidato) => (
                <option key={candidato.tokenId} value={candidato.tokenId}>
                  {candidato.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="bt-form__linha">
          <label htmlFor={`${idBase}-dano`}>{sozinho ? `Dano em ${alvos[0]?.nome ?? 'você'}` : 'Dano'}</label>
          <span className="bt-calc-junto">
            <input
              ref={campo}
              id={`${idBase}-dano`}
              className="bt-num"
              inputMode="numeric"
              autoFocus
              value={valorTexto}
              aria-invalid={erro !== null && (valor === null || valor < 1) ? true : undefined}
              onChange={(evento) => {
                setErro(null)
                setValorTexto(evento.target.value)
              }}
            />
            <BotaoDaCalculadora aberta={calculando} controla={`${idBase}-calc`} botao={botaoDaCalculadora} onAlternar={() => setCalculando((antes) => !antes)} />
          </span>
        </div>
        {calculando && (
          <CalculadoraDeDano
            id={`${idBase}-calc`}
            inicial={valorTexto}
            onUsar={(dano) => {
              setErro(null)
              setValorTexto(String(dano))
              setCalculando(false)
              campo.current?.focus()
            }}
            onFechar={() => {
              setCalculando(false)
              botaoDaCalculadora.current?.focus()
            }}
          />
        )}
        {erro !== null && (
          <p className="bt-form__erro" role="alert">
            {erro}
          </p>
        )}
        <div className="bt-form__acoes">
          <button type="button" className="bt-botao" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="bt-botao bt-botao--batalha">
            Dar {valor === null || valor < 1 ? 'dano' : `${valor} de dano`}
          </button>
        </div>
      </form>
    </JanelaDaBatalha>
  )
}
