import { useState, type FormEvent } from 'react'
import { JanelaDaBatalha } from './JanelaDaBatalha'
import './batalha.css'
import './combate.css'

/**
 * A ESCOLHA DE ARMAS da batalha (Q1/Q8): a ficha diz "Armas por batalha" (1 a
 * 6); o jogador marca até o limite e troca quando quiser, sempre dentro dele.
 * O mestre usa a mesma janela pelo menu da carta. Sem limite, todas valem e a
 * janela não precisa abrir.
 */

export interface ArmaNaEscolha {
  id: string
  nome: string
  /** "Dano 5 · Simples": o que a tira mostra. */
  detalhe?: string
}

export interface EscolhaDeArmasProps {
  /** De quem são as armas ("Siegfried"). */
  quem: string
  armas: readonly ArmaNaEscolha[]
  /** `null` = sem limite. */
  limite: number | null
  /** As levadas agora; `null` = ainda não escolheu. */
  escolhidas: readonly string[] | null
  /** O pedido saiu? `false` mantém a janela, com o aviso. */
  onConfirmar: (armas: readonly string[]) => boolean
  onFechar: () => void
}

export function EscolhaDeArmas({ quem, armas, limite, escolhidas, onConfirmar, onFechar }: EscolhaDeArmasProps) {
  const [marcadas, setMarcadas] = useState<readonly string[]>(() => (escolhidas ?? armas.slice(0, limite ?? armas.length).map((arma) => arma.id)).filter((id) => armas.some((arma) => arma.id === id)))
  const [erro, setErro] = useState<string | null>(null)
  const cheio = limite !== null && marcadas.length >= limite

  const alternar = (id: string) => {
    setErro(null)
    setMarcadas((antes) => (antes.includes(id) ? antes.filter((outro) => outro !== id) : limite !== null && antes.length >= limite ? antes : [...antes, id]))
  }
  const confirmar = (evento: FormEvent) => {
    evento.preventDefault()
    if (marcadas.length === 0) {
      setErro('Marque ao menos uma arma.')
      return
    }
    if (onConfirmar(marcadas)) onFechar()
    else setErro('Não saiu: sem conexão com o mestre, ou o personagem saiu da batalha.')
  }

  return (
    <JanelaDaBatalha
      titulo={escolhidas === null ? 'Armas desta batalha' : 'Trocar armas'}
      descricao={limite === null ? `${quem} leva todas as armas da ficha.` : `${quem} leva até ${limite} ${limite === 1 ? 'arma' : 'armas'} nesta batalha. Dá para trocar quando quiser.`}
      onFechar={onFechar}
    >
      <form className="bt-form" onSubmit={confirmar}>
        {armas.length === 0 ? (
          <p className="bt-texto">A aba Armas da ficha está vazia: o Atacar usa só a Força.</p>
        ) : (
          <fieldset className="bt-npc__lista">
            <legend>
              {marcadas.length}
              {limite === null ? '' : ` de ${limite}`} {marcadas.length === 1 ? 'marcada' : 'marcadas'}
            </legend>
            {armas.map((arma) => {
              const marcada = marcadas.includes(arma.id)
              const apagada = !marcada && cheio
              return (
                <label key={arma.id} className="bt-opcao" data-apagada={apagada ? 'sim' : 'nao'}>
                  <input type="checkbox" checked={marcada} disabled={apagada} onChange={() => alternar(arma.id)} />
                  <span className="bt-opcao__nome">
                    {arma.nome}
                    {arma.detalhe !== undefined && <small>{arma.detalhe}</small>}
                  </span>
                  <span className="bt-opcao__lado">{apagada ? 'limite' : ''}</span>
                  <span />
                </label>
              )
            })}
          </fieldset>
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
          <button type="submit" className="bt-botao bt-botao--primario" disabled={armas.length === 0}>
            Levar {marcadas.length === 1 ? 'esta arma' : `estas ${marcadas.length}`}
          </button>
        </div>
      </form>
    </JanelaDaBatalha>
  )
}
