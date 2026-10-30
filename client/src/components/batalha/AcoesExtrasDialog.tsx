import { useState, type FormEvent } from 'react'
import type { AcoesExtras, DuracaoDaExtra } from '../../lib/batalha/turnos'
import { JanelaDaBatalha } from './JanelaDaBatalha'
import './batalha.css'
import './combate.css'

/**
 * AÇÕES EXTRAS: o mestre dá Simples, Bônus e Movimento a mais para a vez de
 * uma carta (atacar duas vezes), "só nesta vez" ou "todas". Pelo menu da
 * carta e pelo painel da vez. Vira linha no registro; "Tirar extras" apaga.
 */

export interface AcoesExtrasDialogProps {
  /** De quem é a carta ("Bruno"). */
  quem: string
  /** As extras de agora; `null` = nenhuma. */
  inicial: AcoesExtras | null
  /** O pedido valeu? `false` mantém a janela, com o aviso. */
  onConfirmar: (extras: AcoesExtras | null) => boolean
  onFechar: () => void
}

const TETO = 9
type Campo = 'simples' | 'bonus' | 'mov'
const CAMPOS: readonly { id: Campo; rotulo: string }[] = [
  { id: 'simples', rotulo: 'Simples' },
  { id: 'bonus', rotulo: 'Bônus' },
  { id: 'mov', rotulo: 'Movimento' },
]

export function AcoesExtrasDialog({ quem, inicial, onConfirmar, onFechar }: AcoesExtrasDialogProps) {
  const [valores, setValores] = useState<Record<Campo, number>>(() => ({ simples: inicial?.simples ?? 0, bonus: inicial?.bonus ?? 0, mov: inicial?.mov ?? 0 }))
  const [duracao, setDuracao] = useState<DuracaoDaExtra>(inicial?.duracao ?? 'rodada')
  const [erro, setErro] = useState<string | null>(null)
  const nenhuma = valores.simples + valores.bonus + valores.mov === 0

  const mudar = (campo: Campo, passo: number) => {
    setErro(null)
    setValores((antes) => ({ ...antes, [campo]: Math.max(0, Math.min(TETO, antes[campo] + passo)) }))
  }
  const enviar = (extras: AcoesExtras | null) => {
    if (onConfirmar(extras)) onFechar()
    else setErro('Não valeu: a carta saiu da ordem ou a batalha acabou.')
  }
  const confirmar = (evento: FormEvent) => {
    evento.preventDefault()
    enviar(nenhuma ? null : { ...valores, duracao })
  }

  return (
    <JanelaDaBatalha titulo={`Ações extras · ${quem}`} descricao="A mais na vez desta carta, além da Simples e do Movimento de sempre." onFechar={onFechar}>
      <form className="bt-form" onSubmit={confirmar}>
        {CAMPOS.map((campo) => (
          <div key={campo.id} className="bt-form__linha" role="group" aria-label={campo.rotulo}>
            <span>{campo.rotulo}</span>
            <span className="bt-contador">
              <button type="button" className="bt-botao bt-botao--p" aria-label={`Menos ${campo.rotulo}`} disabled={valores[campo.id] === 0} onClick={() => mudar(campo.id, -1)}>
                −
              </button>
              <output aria-live="polite">+{valores[campo.id]}</output>
              <button type="button" className="bt-botao bt-botao--p" aria-label={`Mais ${campo.rotulo}`} disabled={valores[campo.id] === TETO} onClick={() => mudar(campo.id, 1)}>
                +
              </button>
            </span>
          </div>
        ))}
        <fieldset className="bt-npc__lista">
          <legend>Quanto dura</legend>
          <label className="bt-opcao">
            <input type="radio" name="duracao-das-extras" checked={duracao === 'rodada'} onChange={() => setDuracao('rodada')} />
            <span className="bt-opcao__nome">
              Só nesta vez<small>Some quando a carta passa a vez</small>
            </span>
            <span />
            <span />
          </label>
          <label className="bt-opcao">
            <input type="radio" name="duracao-das-extras" checked={duracao === 'sempre'} onChange={() => setDuracao('sempre')} />
            <span className="bt-opcao__nome">
              Todas as vezes<small>Fica até você tirar</small>
            </span>
            <span />
            <span />
          </label>
        </fieldset>
        {erro !== null && (
          <p className="bt-form__erro" role="alert">
            {erro}
          </p>
        )}
        <div className="bt-form__acoes">
          {inicial !== null && (
            <button type="button" className="bt-botao bt-botao--fantasma" onClick={() => enviar(null)}>
              Tirar extras
            </button>
          )}
          <button type="button" className="bt-botao" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="bt-botao bt-botao--primario" disabled={nenhuma && inicial === null}>
            {nenhuma ? 'Tirar extras' : 'Dar ações'}
          </button>
        </div>
      </form>
    </JanelaDaBatalha>
  )
}
