import type { Ref } from 'react'
import './BotaoMais.css'

export interface BotaoMaisProps {
  /**
   * Nome acessível, com o verbo inteiro ("Adicionar token", "Nova pasta"): é o
   * que o leitor de tela anuncia e o que as jornadas procuram. Contém a palavra
   * que se vê ("Token", "Pasta"), para quem comanda por voz dizer o que lê.
   */
  nome: string
  /** O que se lê depois do "+" ("Token", "Pasta"). */
  texto: string
  /** Balão nativo ao pairar: o que o clique faz além do nome. */
  dica?: string
  /** Alvo de 44 px, a altura da faixa do topo; fora dela, os 24 px mínimos do tema. */
  alto?: boolean
  onClick: () => void
  ref?: Ref<HTMLButtonElement>
}

/**
 * A ação "+ Coisa" de linha de título: "+ Token" na faixa sem seleção e no
 * Acervo, "+ Pasta" no Acervo. Texto pequeno e apagado em repouso — a linha é
 * para ler, não para chamar —, e a pastilha de pedra aparece sob o ponteiro,
 * mostrando o tamanho do alvo sem desenhar uma caixa a mais na coluna.
 */
export function BotaoMais({ nome, texto, dica, alto = false, onClick, ref }: BotaoMaisProps) {
  return (
    <button ref={ref} type="button" className={alto ? 'lb-mais lb-mais--alto' : 'lb-mais'} aria-label={nome} title={dica} onClick={onClick}>
      <span className="lb-mais__chip">
        <span className="lb-mais__sinal" aria-hidden="true">
          +
        </span>{' '}
        {texto}
      </span>
    </button>
  )
}
